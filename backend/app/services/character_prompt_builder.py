"""
Character Prompt Builder & Consistency Bible Composer for TR STUDIO Step 3.
Constructs rich, deterministic, style-consistent character generation prompts
while stripping any accidental private user data or credentials.
"""

import re
from typing import List, Optional

from app.models.character import Character
from app.schemas.character import (
    CharacterExtendedMetadata,
)

STYLE_DESCRIPTORS = {
    "2D Cartoon": "clean 2D western animation cel-shaded character design, expressive vector linework, vibrant flat studio colors",
    "Anime": "high-production Japanese anime character design, crisp cel shading, detailed expressive eyes, dynamic anime studio lighting",
    "Chibi": "super-deformed cute chibi character design, 2.5 heads tall proportions, oversized expressive eyes, bold clean outlines",
    "3D Cartoon": "feature-film stylized 3D animated character render, soft subsurface scattering, appealing Pixar/DreamWorks-inspired proportions",
    "Realistic 3D": "cinematic photorealistic 3D digital human/creature render, PBR materials, micro-surface skin and fabric textures, studio rim lighting",
    "Pixel Art": "crisp 32-bit sprite pixel art character design, deliberate hand-placed pixel clusters, cohesive retro palette",
    "Comic / Manga": "detailed graphic novel & manga ink illustration, dynamic cross-hatching, screen-tone shading, bold silhouettes",
    "Storybook": "whimsical hand-painted children's storybook illustration, warm gouache and colored-pencil textures, soft narrative lighting",
    "Watercolor": "expressive traditional watercolor character illustration, delicate pigment blooms, cold-press paper grain, ink accents",
    "Clay Animation": "stop-motion claymation character sculpt, subtle handcrafted clay thumbprint textures, miniature studio softbox lighting",
    "Fantasy Illustration": "epic concept art fantasy character illustration, painterly brushwork, atmospheric rim lighting, intricate costume detailing",
}

VIEW_FRAMING_DESCRIPTORS = {
    "concept": "full character concept design hero pose, clear silhouette and costume details",
    "portrait": "head-and-shoulders close-up character portrait, sharp focus on facial features and eyes",
    "full_body": "full-body standing character design from head to toe, complete footwear and proportions visible",
    "front_view": "orthographic front-view full-body character turnaround pose, symmetrical A-pose, head to toe",
    "side_view": "orthographic 90-degree profile side-view full-body character turnaround pose, head to toe",
    "back_view": "orthographic rear back-view full-body character turnaround pose showing back of hair and outfit, head to toe",
    "three_quarter_view": "three-quarter (3/4) angle full-body character design pose, dimensional volume, head to toe",
    "full_body_view": "full-body character design standing pose from head to toe",
    "turnaround_sheet": "multi-angle character model turnaround reference sheet showing front view, side profile view, three-quarter view, and back view side by side",
    "expression_sheet": "character facial expression reference sheet showing multiple distinct emotional expressions",
    "outfit_sheet": "full-body character wardrobe and costume design reference sheet",
    "pose_sheet": "dynamic character action and gesture pose reference sheet",
}


def sanitize_prompt_text(text: str) -> str:
    """
    Ensure no private user emails, bearer tokens, or API keys are ever leaked into prompts.
    """
    if not text:
        return ""
    # Strip email addresses
    cleaned = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[REDACTED]", text)
    # Strip anything resembling an API key or Bearer token
    cleaned = re.sub(r"(?:sk-|AIza|Bearer\s+)[A-Za-z0-9_\-]{12,}", "[REDACTED]", cleaned)
    return cleaned.strip()


class CharacterPromptBuilder:
    """Builds canonical prompts combining Character Bible, appearance, style, framing, and instructions."""

    @staticmethod
    def extract_extended_metadata(character: Character) -> CharacterExtendedMetadata:
        raw = character.character_metadata or {}
        try:
            return CharacterExtendedMetadata.model_validate(raw)
        except Exception:
            return CharacterExtendedMetadata()

    @classmethod
    def build_prompt(
        cls,
        character: Character,
        generation_type: str = "concept",
        style_override: Optional[str] = None,
        camera_framing: Optional[str] = None,
        background: Optional[str] = "clean neutral studio character sheet background",
        expression_name: Optional[str] = None,
        expression_description: Optional[str] = None,
        pose_name: Optional[str] = None,
        pose_category: Optional[str] = None,
        pose_description: Optional[str] = None,
        outfit_name: Optional[str] = None,
        outfit_description: Optional[str] = None,
        outfit_palette: Optional[List[str]] = None,
        outfit_accessories: Optional[List[str]] = None,
        view_type: Optional[str] = None,
        user_instructions: Optional[str] = None,
    ) -> str:
        ext = cls.extract_extended_metadata(character)
        app = ext.appearance
        bible = ext.character_bible

        active_style = (style_override or character.style or "Anime").strip()
        style_phrase = STYLE_DESCRIPTORS.get(
            active_style,
            ext.custom_style_description
            or f"{active_style} professional animated character design",
        )
        if bible.style_description:
            style_phrase = f"{style_phrase}, {bible.style_description.strip()}"

        sections: List[str] = []

        # 1. Style & Framing Header
        framing_key = (view_type or generation_type or "concept").lower()
        framing_desc = VIEW_FRAMING_DESCRIPTORS.get(
            framing_key,
            camera_framing or "full-body character design",
        )
        if camera_framing and camera_framing not in framing_desc:
            framing_desc = f"{framing_desc} ({camera_framing})"

        sections.append(f"Style: {style_phrase}.")
        sections.append(f"Framing: {framing_desc}.")

        # 2. Core Identity & Species
        identity_parts = [f"Character Name: {character.name}"]
        if character.role:
            identity_parts.append(f"Role: {character.role}")
        if character.species:
            identity_parts.append(f"Species: {character.species}")
        if character.age_description:
            identity_parts.append(f"Age: {character.age_description}")
        if ext.gender_presentation:
            identity_parts.append(f"Presentation: {ext.gender_presentation}")
        sections.append("Identity: " + ", ".join(identity_parts) + ".")

        # 3. Canonical Character Bible (highest priority for visual consistency)
        if bible.canonical_description and bible.canonical_description.strip():
            sections.append(
                f"Canonical Character Bible: {bible.canonical_description.strip()}."
            )
        elif character.appearance_description and character.appearance_description.strip():
            sections.append(
                f"Character Appearance: {character.appearance_description.strip()}."
            )

        # 4. Detailed Physical Attributes
        phys_parts: List[str] = []
        if app.face_shape:
            phys_parts.append(f"face shape: {app.face_shape}")
        if app.eye_shape or app.eye_color:
            eye_str = " ".join(x for x in [app.eye_color, app.eye_shape, "eyes"] if x)
            phys_parts.append(eye_str)
        if app.hair_style or app.hair_color:
            hair_str = " ".join(x for x in [app.hair_color, app.hair_style, "hair"] if x)
            phys_parts.append(hair_str)
        if app.skin_tone:
            phys_parts.append(f"skin/material tone: {app.skin_tone}")
        if app.body_type:
            phys_parts.append(f"body type: {app.body_type}")
        if app.height:
            phys_parts.append(f"height/proportions: {app.height}")
        if app.distinguishing_features:
            phys_parts.append(f"distinguishing features: {app.distinguishing_features}")
        if bible.facial_features:
            phys_parts.append(f"facial details: {bible.facial_features}")
        if bible.body_proportions:
            phys_parts.append(f"proportions: {bible.body_proportions}")
        if phys_parts:
            sections.append("Physical Features: " + "; ".join(phys_parts) + ".")

        # 5. Clothing, Outfit & Accessories (respecting outfit variation without erasing identity)
        if outfit_name or outfit_description:
            outfit_parts = [f"Wearing outfit '{outfit_name or 'Custom Outfit'}'"]
            if outfit_description:
                outfit_parts.append(outfit_description)
            if outfit_palette:
                outfit_parts.append(f"outfit colors: {', '.join(outfit_palette)}")
            if outfit_accessories:
                outfit_parts.append(f"outfit accessories: {', '.join(outfit_accessories)}")
            sections.append("Wardrobe Override: " + "; ".join(outfit_parts) + ".")
        else:
            attire_parts: List[str] = []
            if app.clothing:
                attire_parts.append(f"clothing: {app.clothing}")
            elif bible.clothing_details:
                attire_parts.append(f"clothing: {bible.clothing_details}")
            if app.accessories:
                attire_parts.append(f"accessories: {app.accessories}")
            elif bible.accessories_details:
                attire_parts.append(f"accessories: {bible.accessories_details}")
            if app.shoes:
                attire_parts.append(f"footwear: {app.shoes}")
            if attire_parts:
                sections.append("Wardrobe & Accessories: " + "; ".join(attire_parts) + ".")

        # 6. Color Palette
        palette = list(bible.color_palette or app.color_palette or [])
        if palette:
            sections.append(f"Main Color Palette: {', '.join(palette)}.")

        # 7. Personality, Expression, or Pose Specifics
        if character.personality:
            sections.append(f"Personality traits: {', '.join(character.personality)}.")

        if expression_name:
            expr_clause = f"Facial Expression: {expression_name}"
            if expression_description:
                expr_clause += f" ({expression_description})"
            sections.append(expr_clause + ". Maintain exact character facial identity and hair.")

        if pose_name:
            pose_clause = f"Action Pose: {pose_name} (Category: {pose_category or 'Dynamic'})"
            if pose_description:
                pose_clause += f" — {pose_description}"
            sections.append(pose_clause + ". Maintain exact character proportions and costume.")

        # 8. Background & User Instructions
        bg = (background or "clean neutral studio character sheet background").strip()
        sections.append(f"Background: {bg}, no watermarks, no text overlays.")

        if user_instructions and user_instructions.strip():
            sections.append(f"Additional Direction: {user_instructions.strip()}.")

        raw_prompt = " ".join(sections)
        return sanitize_prompt_text(raw_prompt)
