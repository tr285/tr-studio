"""
Modular AI Provider Architecture for TR STUDIO Step 2 — AI Story Creation Engine.

Provides:
- Abstract `AIStoryProvider` interface covering:
  1. Story generation (`generate_story`)
  2. Story continuation (`continue_story`)
  3. Story rewriting (`rewrite_story`)
  4. Story improvement (`improve_story`)
  5. Dialogue generation (`generate_dialogue`)
  6. Translation (`translate_story`)
  7. Story summarization (`summarize_story`)
- Concrete `GeminiStoryProvider` (Google Gemini REST API)
- Concrete `OpenAIStoryProvider` (OpenAI / OpenAI-compatible Chat Completions REST API)
- Strict Pydantic validation & UUID normalization on every AI response
- Honest error handling when `AI_API_KEY` is missing or when providers return rate limits/errors
"""

from __future__ import annotations

import abc
import json
import re
import uuid
from typing import Any, Dict, Optional

import httpx
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.core.exceptions import AIConfigurationException, AIProviderException
from app.core.logging import logger
from app.schemas.story import (
    StoryAIAssistRequest,
    StoryGenerationRequest,
    StoryOutputDocument,
)


STORY_JSON_SCHEMA_INSTRUCTIONS = """
Return ONLY a valid JSON object matching this exact structure (no markdown code fences, no commentary outside JSON):
{
  "schema_version": "1.0",
  "story": {
    "title": "String (compelling title)",
    "logline": "String (one-sentence hook)",
    "summary": "String (detailed paragraph summary)",
    "full_plot": "String (complete narrative overview)",
    "beginning": "String (Act I setup & inciting incident)",
    "middle": "String (Act II rising action, confrontations, midpoint)",
    "ending": "String (Act III climax & resolution)",
    "genre": "String",
    "animation_style": "String",
    "tone": "String",
    "complexity": "String",
    "ending_type": "String",
    "target_audience": "String",
    "duration_minutes": 5,
    "language": "String",
    "themes": ["Theme 1", "Theme 2", "Theme 3"],
    "world_description": "String (rich overview of world rules, visual aesthetic, and lore)"
  },
  "characters": [
    {
      "id": "UUID string",
      "name": "Character Name",
      "role": "Protagonist | Deuteragonist | Antagonist | Mentor | Supporting",
      "age_description": "e.g., 14-year-old apprentice",
      "personality": ["Trait 1", "Trait 2"],
      "appearance_description": "Detailed visual design notes for animation",
      "motivation": "Core goal driving the character",
      "backstory": "Concise character history",
      "relationships": [
        {
          "id": "UUID string",
          "target_character_name": "Other Character Name",
          "relationship_type": "Ally | Rival | Mentor | Sibling",
          "description": "Dynamic between the characters"
        }
      ]
    }
  ],
  "locations": [
    {
      "id": "UUID string",
      "name": "Location Name",
      "description": "Visual & architectural description",
      "atmosphere": "Mood and lighting tone",
      "time_of_day": "Dawn | Day | Dusk | Night",
      "environment_requirements": "Key props, weather, parallax background notes"
    }
  ],
  "scenes": [
    {
      "id": "UUID string",
      "scene_number": 1,
      "title": "Scene Title",
      "scene_heading": "EXT. ABANDONED VILLAGE - EVENING",
      "location_name": "Location Name",
      "description": "Narrative summary of what happens in this scene",
      "action_description": "Detailed screenplay action beats and staging",
      "duration_seconds": 45,
      "characters": ["Character Name"],
      "dialogue": [
        {
          "id": "UUID string",
          "character_name": "Character Name",
          "line": "Spoken dialogue line",
          "emotion": "Wonder | Tense | Determined",
          "delivery_direction": "Whispered while stepping back"
        }
      ],
      "narration": [
        {
          "id": "UUID string",
          "narrator_voice": "Narrator (V.O.)",
          "text": "Narration line accompanying the visual",
          "emotion": "Mysterious"
        }
      ],
      "camera_directions": ["WIDE ESTABLISHING SHOT of the village", "SLOW PUSH IN on the glowing tome"],
      "audio_directions": ["Soft wind chimes and distant thunder", "Ethereal orchestral swell"],
      "visual_directions": ["Golden dust motes swirl around the book"],
      "emotional_directions": ["Transition from quiet curiosity to awe"],
      "storyboard_notes": "Key framing and composition guidance for storyboard artists"
    }
  ]
}
""".strip()


def _ensure_valid_uuid(val: Any) -> str:
    if isinstance(val, str):
        try:
            return str(uuid.UUID(val))
        except ValueError:
            pass
    return str(uuid.uuid4())


def extract_and_normalize_story_json(raw_text: str) -> StoryOutputDocument:
    """
    Parse raw LLM text, strip optional markdown fences, normalize entity IDs to stable UUIDs
    (never relying on array indexes as identifiers), and validate against `StoryOutputDocument`.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        # Attempt to extract the first top-level JSON object if extra prose was included
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise AIProviderException(
                detail=f"AI provider returned malformed JSON that could not be parsed: {exc.msg}",
                error_code="AI_INVALID_JSON",
            ) from exc
        try:
            payload = json.loads(match.group(0))
        except json.JSONDecodeError as inner_exc:
            raise AIProviderException(
                detail=f"AI provider returned invalid JSON structure: {inner_exc.msg}",
                error_code="AI_INVALID_JSON",
            ) from inner_exc

    if not isinstance(payload, dict):
        raise AIProviderException(
            detail="AI provider response root must be a JSON object.",
            error_code="AI_INVALID_SCHEMA",
        )

    payload["schema_version"] = str(payload.get("schema_version") or "1.0")

    # Normalize character UUIDs and map both symbolic IDs and names -> UUIDs
    char_name_to_id: Dict[str, str] = {}
    old_char_id_to_uuid: Dict[str, str] = {}
    char_uuid_to_name: Dict[str, str] = {}
    characters = payload.get("characters")
    if isinstance(characters, list):
        for char in characters:
            if isinstance(char, dict):
                raw_cid = str(char.get("id") or "").strip()
                new_cid = _ensure_valid_uuid(raw_cid)
                char["id"] = new_cid
                name = str(char.get("name") or "Character").strip()
                char["name"] = name
                char_name_to_id[name.lower()] = new_cid
                char_uuid_to_name[new_cid] = name
                if raw_cid:
                    old_char_id_to_uuid[raw_cid] = new_cid

                # Normalize personality if returned as comma-separated string
                personality = char.get("personality")
                if isinstance(personality, str):
                    char["personality"] = [
                        p.strip() for p in personality.split(",") if p.strip()
                    ]

                rels = char.get("relationships")
                if isinstance(rels, list):
                    for rel in rels:
                        if isinstance(rel, dict):
                            rel["id"] = _ensure_valid_uuid(rel.get("id"))

        # Second pass to populate target_character_id, target_character_name, and relationship_type
        for char in characters:
            if isinstance(char, dict) and isinstance(char.get("relationships"), list):
                for rel in char["relationships"]:
                    if isinstance(rel, dict):
                        raw_target_id = str(rel.get("target_character_id") or "").strip()
                        target_name = str(rel.get("target_character_name") or "").strip()
                        if raw_target_id in old_char_id_to_uuid:
                            resolved_uid = old_char_id_to_uuid[raw_target_id]
                            rel["target_character_id"] = resolved_uid
                            if not target_name:
                                rel["target_character_name"] = char_uuid_to_name.get(
                                    resolved_uid, "Character"
                                )
                        elif target_name.lower() in char_name_to_id:
                            rel["target_character_id"] = char_name_to_id[target_name.lower()]
                        elif not target_name:
                            rel["target_character_name"] = "Companion"

                        if not rel.get("relationship_type"):
                            rel["relationship_type"] = str(
                                rel.get("relation") or rel.get("type") or "Ally"
                            )

    # Normalize location UUIDs and map both symbolic IDs and names -> UUIDs
    loc_name_to_id: Dict[str, str] = {}
    old_loc_id_to_uuid: Dict[str, str] = {}
    loc_uuid_to_name: Dict[str, str] = {}
    locations = payload.get("locations")
    if isinstance(locations, list):
        for loc in locations:
            if isinstance(loc, dict):
                raw_lid = str(loc.get("id") or "").strip()
                new_lid = _ensure_valid_uuid(raw_lid)
                loc["id"] = new_lid
                loc_name = str(loc.get("name") or "Location").strip()
                loc["name"] = loc_name
                loc_name_to_id[loc_name.lower()] = new_lid
                loc_uuid_to_name[new_lid] = loc_name
                if raw_lid:
                    old_loc_id_to_uuid[raw_lid] = new_lid

    # Normalize scenes, dialogue, and narration UUIDs
    scenes = payload.get("scenes")
    if isinstance(scenes, list):
        for idx, scene in enumerate(scenes, start=1):
            if isinstance(scene, dict):
                scene["id"] = _ensure_valid_uuid(scene.get("id"))
                scene["scene_number"] = int(scene.get("scene_number") or idx)
                raw_scene_loc_id = str(scene.get("location_id") or "").strip()
                loc_name = str(scene.get("location_name") or "").strip()
                if raw_scene_loc_id in old_loc_id_to_uuid:
                    resolved_loc_id = old_loc_id_to_uuid[raw_scene_loc_id]
                    scene["location_id"] = resolved_loc_id
                    if not loc_name:
                        scene["location_name"] = loc_uuid_to_name.get(resolved_loc_id, "")
                elif loc_name.lower() in loc_name_to_id:
                    scene["location_id"] = loc_name_to_id[loc_name.lower()]
                elif locations and isinstance(locations[0], dict) and not scene.get("location_id"):
                    scene["location_id"] = locations[0]["id"]
                    if not loc_name:
                        scene["location_name"] = locations[0].get("name", "")

                # Normalize scene.characters symbolic IDs or names -> UUIDs
                raw_scene_chars = scene.get("characters")
                if isinstance(raw_scene_chars, list):
                    normalized_scene_chars: List[str] = []
                    for sc_c in raw_scene_chars:
                        sc_c_str = str(sc_c).strip()
                        if sc_c_str in old_char_id_to_uuid:
                            normalized_scene_chars.append(old_char_id_to_uuid[sc_c_str])
                        elif sc_c_str.lower() in char_name_to_id:
                            normalized_scene_chars.append(char_name_to_id[sc_c_str.lower()])
                        else:
                            normalized_scene_chars.append(sc_c_str)
                    scene["characters"] = normalized_scene_chars

                dialogues = scene.get("dialogue")
                if isinstance(dialogues, list):
                    for d in dialogues:
                        if isinstance(d, dict):
                            d["id"] = _ensure_valid_uuid(d.get("id"))
                            if not d.get("line") and d.get("text"):
                                d["line"] = str(d.get("text"))
                            if not d.get("delivery_direction") and d.get("action"):
                                d["delivery_direction"] = str(d.get("action"))
                            raw_dc_id = str(d.get("character_id") or "").strip()
                            c_name = str(d.get("character_name") or "").strip()
                            if raw_dc_id in old_char_id_to_uuid:
                                d["character_id"] = old_char_id_to_uuid[raw_dc_id]
                            elif c_name.lower() in char_name_to_id:
                                d["character_id"] = char_name_to_id[c_name.lower()]

                narrations = scene.get("narration")
                if isinstance(narrations, list):
                    for n in narrations:
                        if isinstance(n, dict):
                            n["id"] = _ensure_valid_uuid(n.get("id"))

    try:
        return StoryOutputDocument.model_validate(payload)
    except ValidationError as exc:
        logger.error("AI response failed StoryOutputDocument validation: %s", exc)
        raise AIProviderException(
            detail=f"AI response did not match the required TR STUDIO story schema: {exc.errors()[0].get('msg', 'validation error')}",
            error_code="AI_SCHEMA_VALIDATION_FAILED",
        ) from exc


class AIStoryProvider(abc.ABC):
    """Abstract interface for all AI story operations in TR STUDIO."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @abc.abstractmethod
    def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any] | str:
        """Execute a single structured JSON completion against the underlying LLM provider."""
        raise NotImplementedError

    def complete_structured_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """
        Execute a structured JSON completion and parse the output into a Python dictionary.
        Raises `AIProviderException` (`AI_INVALID_JSON` / `AI_INVALID_SCHEMA`) if the response
        is not valid JSON or not a JSON object.
        """
        raw = self._complete_json(system_prompt, user_prompt)
        if isinstance(raw, dict):
            return raw

        cleaned = str(raw).strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
            if not match:
                raise AIProviderException(
                    detail=f"AI provider returned malformed JSON that could not be parsed: {exc.msg}",
                    error_code="AI_INVALID_JSON",
                ) from exc
            try:
                payload = json.loads(match.group(0))
            except json.JSONDecodeError as inner_exc:
                raise AIProviderException(
                    detail=f"AI provider returned invalid JSON structure: {inner_exc.msg}",
                    error_code="AI_INVALID_JSON",
                ) from inner_exc

        if not isinstance(payload, dict):
            raise AIProviderException(
                detail="AI provider response root must be a JSON object.",
                error_code="AI_INVALID_SCHEMA",
            )
        return payload

    def generate_story(self, request: StoryGenerationRequest) -> StoryOutputDocument:
        system_prompt = (
            "You are the Lead Story Architect & Screenplay Director for TR STUDIO, "
            "a professional animated story creation platform. "
            "Generate a complete, emotionally resonant, production-ready animated story and screenplay.\n\n"
            f"{STORY_JSON_SCHEMA_INSTRUCTIONS}"
        )
        title_directive = (
            f"Use the requested title: {request.title!r}."
            if request.title and request.title.strip()
            else "Create an evocative, memorable title for this story."
        )
        recommended_scenes = max(3, min(12, request.duration_minutes + 2))
        user_prompt = (
            f"Create a complete animated story based on these specifications:\n"
            f"- Core Idea: {request.idea}\n"
            f"- Title Directive: {title_directive}\n"
            f"- Genre: {request.resolved_genre}\n"
            f"- Animation Style: {request.resolved_animation_style}\n"
            f"- Target Audience: {request.target_audience}\n"
            f"- Target Duration: {request.duration_minutes} minutes (generate approximately {recommended_scenes} scenes)\n"
            f"- Language: {request.resolved_language} (write all titles, descriptions, narration, and dialogue in {request.resolved_language})\n"
            f"- Number of Main Characters: {request.main_character_count}\n"
            f"- Story Tone: {request.tone}\n"
            f"- Story Complexity: {request.complexity}\n"
            f"- Ending Preference: {request.ending_type}\n"
            f"- Additional Instructions: {request.additional_instructions or 'None'}\n"
        )
        raw = self._complete_json(system_prompt, user_prompt)
        raw_str = json.dumps(raw) if isinstance(raw, dict) else str(raw)
        return extract_and_normalize_story_json(raw_str)

    def _transform_document(
        self,
        current_doc: StoryOutputDocument,
        instruction: str,
    ) -> tuple[StoryOutputDocument, str]:
        system_prompt = (
            "You are the Senior Script Doctor & Story Editor for TR STUDIO. "
            "You will receive an existing StoryOutputDocument JSON and an editing directive. "
            "Return the updated StoryOutputDocument JSON keeping existing UUIDs where entities are preserved, "
            "and generating new UUIDs for newly added entities.\n\n"
            f"{STORY_JSON_SCHEMA_INSTRUCTIONS}"
        )
        user_prompt = (
            f"Editing Directive:\n{instruction}\n\n"
            f"Current Story JSON:\n{current_doc.model_dump_json(indent=2)}"
        )
        raw = self._complete_json(system_prompt, user_prompt)
        raw_str = json.dumps(raw) if isinstance(raw, dict) else str(raw)
        updated_doc = extract_and_normalize_story_json(raw_str)
        return updated_doc, f"Applied AI transformation: {instruction[:120]}"

    def continue_story(
        self,
        current_doc: StoryOutputDocument,
        instructions: Optional[str] = None,
    ) -> tuple[StoryOutputDocument, str]:
        directive = (
            "Continue the story by adding 1 to 2 compelling new scenes that advance the plot naturally, "
            "including full character dialogue, narration, camera directions, and audio cues."
        )
        if instructions:
            directive += f" Additional user direction: {instructions}"
        return self._transform_document(current_doc, directive)

    def improve_story(
        self,
        current_doc: StoryOutputDocument,
        request: StoryAIAssistRequest,
    ) -> tuple[StoryOutputDocument, str]:
        action_prompts: Dict[str, str] = {
            "improve_story": "Elevate pacing, emotional resonance, visual storytelling, and dialogue sharpness across the entire story.",
            "make_funnier": "Infuse witty comedic timing, humorous visual gags, and playful character banter while keeping the core plot intact.",
            "make_emotional": "Deepen the emotional stakes, vulnerability, character longing, and poignant atmospheric moments.",
            "add_suspense": "Heighten tension, mystery, dramatic irony, ominous audio cues, and cliffhanger scene transitions.",
            "improve_ending": "Strengthen the climax and resolution so the ending feels earned, cinematic, and unforgettable.",
            "unexpected_twist": "Introduce a clever, well-foreshadowed plot twist that recontextualizes the characters' journey.",
            "simplify_story": "Streamline subplots and clarify character motivations and dialogue for effortless audience comprehension.",
            "expand_story": "Expand worldbuilding, scene descriptions, character relationships, and dramatic beats with richer detail.",
            "improve_character": "Deepen character personalities, distinct voice patterns, motivations, and interpersonal dynamics.",
            "add_detailed_scenes": "Enrich every scene with more granular action beats, storyboard notes, camera framing, and sound design.",
        }
        base_directive = action_prompts.get(
            request.action,
            "Improve the overall quality and cinematic impact of the story.",
        )
        if request.target_scene_id:
            base_directive += f" Focus especially on scene ID {request.target_scene_id}."
        if request.target_character_id:
            base_directive += f" Focus especially on character ID {request.target_character_id}."
        if request.instructions:
            base_directive += f" User notes: {request.instructions}"
        return self._transform_document(current_doc, base_directive)

    def rewrite_story(
        self,
        current_doc: StoryOutputDocument,
        request: StoryAIAssistRequest,
    ) -> tuple[StoryOutputDocument, str]:
        directive = "Rewrite the targeted sections of the story for maximum narrative impact."
        if request.target_scene_id:
            directive = f"Rewrite scene ID {request.target_scene_id} with fresh dialogue, stronger staging, and vivid camera directions."
        if request.selected_text:
            directive += f" Specifically rewrite this dialogue/text: {request.selected_text!r}."
        if request.instructions:
            directive += f" Follow these instructions: {request.instructions}"
        return self._transform_document(current_doc, directive)

    def generate_dialogue(
        self,
        current_doc: StoryOutputDocument,
        scene_id: str,
        instructions: Optional[str] = None,
    ) -> tuple[StoryOutputDocument, str]:
        directive = (
            f"Generate expressive, natural character dialogue and emotional delivery directions "
            f"for scene ID {scene_id}."
        )
        if instructions:
            directive += f" Additional direction: {instructions}"
        return self._transform_document(current_doc, directive)

    def translate_story(
        self,
        current_doc: StoryOutputDocument,
        target_language: str,
    ) -> tuple[StoryOutputDocument, str]:
        directive = (
            f"Translate the entire story (title, logline, summary, plot acts, character descriptions, "
            f"locations, scene titles, action descriptions, dialogue lines, and narration) into {target_language} "
            f"while preserving character names, cultural nuance, and setting story.language = {target_language!r}."
        )
        return self._transform_document(current_doc, directive)

    def summarize_story(
        self,
        current_doc: StoryOutputDocument,
    ) -> tuple[StoryOutputDocument, str]:
        directive = (
            "Refine and sharpen the story's logline, summary, full_plot, beginning, middle, and ending "
            "so they concisely and powerfully reflect all scenes and character arcs."
        )
        return self._transform_document(current_doc, directive)


class GeminiStoryProvider(AIStoryProvider):
    """Real Google Gemini API integration via REST (`generateContent`)."""

    def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any] | str:
        api_key = (self.settings.AI_API_KEY or "").strip()
        if not api_key:
            raise AIConfigurationException()

        model = self.settings.AI_MODEL or "gemini-2.5-flash"
        base_url = (
            self.settings.AI_BASE_URL
            or "https://generativelanguage.googleapis.com/v1beta"
        ).rstrip("/")
        url = f"{base_url}/models/{model}:generateContent"

        payload = {
            "systemInstruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "responseMimeType": "application/json",
            },
        }

        try:
            with httpx.Client(timeout=self.settings.AI_TIMEOUT_SECONDS) as client:
                response = client.post(
                    url,
                    params={"key": api_key},
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise AIProviderException(
                detail="AI provider request timed out. Please try again or reduce story duration.",
                status_code=504,
                error_code="AI_TIMEOUT",
            ) from exc
        except httpx.RequestError as exc:
            raise AIProviderException(
                detail=f"Network error communicating with Gemini API: {exc}",
                status_code=502,
                error_code="AI_NETWORK_ERROR",
            ) from exc

        if response.status_code == 429:
            raise AIProviderException(
                detail="AI provider rate limit exceeded (HTTP 429). Please wait a moment and try again.",
                status_code=429,
                error_code="AI_RATE_LIMITED",
            )
        if response.status_code in (401, 403):
            raise AIProviderException(
                detail="AI provider rejected the configured AI_API_KEY (authentication failed).",
                status_code=502,
                error_code="AI_AUTH_FAILED",
            )
        if response.status_code >= 400:
            raise AIProviderException(
                detail=f"Gemini API returned HTTP {response.status_code}: {response.text[:300]}",
                status_code=502,
                error_code="AI_UPSTREAM_ERROR",
            )

        data = response.json()
        try:
            candidates = data.get("candidates") or []
            text_part = candidates[0]["content"]["parts"][0]["text"]
            return text_part
        except (IndexError, KeyError, TypeError) as exc:
            raise AIProviderException(
                detail="Gemini API returned an unexpected response structure.",
                error_code="AI_INVALID_RESPONSE",
            ) from exc


class OpenAIStoryProvider(AIStoryProvider):
    """Real OpenAI / OpenAI-Compatible Chat Completions API integration."""

    def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any] | str:
        api_key = (self.settings.AI_API_KEY or "").strip()
        if not api_key:
            raise AIConfigurationException()

        model = self.settings.AI_MODEL or "gpt-4o-mini"
        base_url = (
            self.settings.AI_BASE_URL or "https://api.openai.com/v1"
        ).rstrip("/")
        url = f"{base_url}/chat/completions"

        payload = {
            "model": model,
            "response_format": {"type": "json_object"},
            "temperature": 0.7,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        try:
            with httpx.Client(timeout=self.settings.AI_TIMEOUT_SECONDS) as client:
                response = client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise AIProviderException(
                detail="AI provider request timed out. Please try again.",
                status_code=504,
                error_code="AI_TIMEOUT",
            ) from exc
        except httpx.RequestError as exc:
            raise AIProviderException(
                detail=f"Network error communicating with OpenAI API: {exc}",
                status_code=502,
                error_code="AI_NETWORK_ERROR",
            ) from exc

        if response.status_code == 429:
            raise AIProviderException(
                detail="AI provider rate limit exceeded (HTTP 429). Please wait and retry.",
                status_code=429,
                error_code="AI_RATE_LIMITED",
            )
        if response.status_code in (401, 403):
            raise AIProviderException(
                detail="AI provider rejected the configured AI_API_KEY.",
                status_code=502,
                error_code="AI_AUTH_FAILED",
            )
        if response.status_code >= 400:
            raise AIProviderException(
                detail=f"OpenAI API returned HTTP {response.status_code}: {response.text[:300]}",
                status_code=502,
                error_code="AI_UPSTREAM_ERROR",
            )

        data = response.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (IndexError, KeyError, TypeError) as exc:
            raise AIProviderException(
                detail="OpenAI API returned an unexpected response structure.",
                error_code="AI_INVALID_RESPONSE",
            ) from exc


def get_ai_story_provider(settings: Optional[Settings] = None) -> AIStoryProvider:
    """
    Factory that returns the configured `AIStoryProvider`.
    Raises `AIConfigurationException` if `AI_API_KEY` is not configured.
    Never returns fake or canned AI responses.
    """
    cfg = settings or get_settings()
    if not cfg.is_ai_configured:
        raise AIConfigurationException()

    provider_name = (cfg.AI_PROVIDER or "gemini").strip().lower()
    if provider_name == "gemini":
        return GeminiStoryProvider(cfg)
    if provider_name in ("openai", "openai_compatible"):
        return OpenAIStoryProvider(cfg)

    raise AIConfigurationException(
        detail=f"Unsupported AI_PROVIDER '{cfg.AI_PROVIDER}'. Supported values: 'gemini', 'openai', 'openai_compatible'."
    )
