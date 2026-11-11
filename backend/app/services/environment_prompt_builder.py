"""
Environment Prompt Builder Service for TR STUDIO Step 4 — World & Environment Creation Studio.
Synthesizes structured, high-consistency visual background prompts combining:
- Environment description & name
- Environment category & location type
- Architecture, terrain, vegetation, and props
- Lighting, weather, and time of day
- Color palette, art style, and visual mood / atmosphere
- Camera angle / perspective
- Story context & user instructions

Reuses `sanitize_prompt_fragment` from Step 3 so PII, emails, and tokens never leak.
"""

from typing import List, Optional

from app.models.environment import Environment
from app.services.character_prompt_builder import (
    STYLE_DESCRIPTORS,
    sanitize_prompt_text,
)


def sanitize_prompt_fragment(
    value: Optional[str], max_length: int = 500
) -> str:
    if not value:
        return ""
    cleaned = sanitize_prompt_text(str(value))
    return cleaned[:max_length].strip()


class EnvironmentPromptBuilder:
    """
    Deterministic prompt builder for environment concepts, landscapes,
    interiors, exteriors, lighting/weather/camera variations, and close-up details.
    """

    @staticmethod
    def build_prompt(
        environment: Environment,
        generation_type: str = "concept",
        art_style_override: Optional[str] = None,
        time_of_day_override: Optional[str] = None,
        weather_override: Optional[str] = None,
        lighting_override: Optional[str] = None,
        camera_perspective_override: Optional[str] = None,
        color_palette_override: Optional[List[str]] = None,
        variation_name: Optional[str] = None,
        variation_description: Optional[str] = None,
        detail_focus: Optional[str] = None,
        story_context: Optional[str] = None,
        user_instructions: Optional[str] = None,
    ) -> str:
        meta = environment.environment_metadata or {}

        active_style = sanitize_prompt_fragment(
            art_style_override or environment.art_style or "Anime", 120
        )
        custom_style = sanitize_prompt_fragment(meta.get("custom_art_style"), 240)
        style_descriptor = STYLE_DESCRIPTORS.get(
            active_style,
            custom_style
            or f"{active_style} animation background art, clean staging and atmospheric depth",
        )
        if active_style == "Custom" and custom_style:
            style_descriptor = custom_style

        name = sanitize_prompt_fragment(environment.name, 140)
        desc = sanitize_prompt_fragment(environment.description, 600)
        category = sanitize_prompt_fragment(environment.category or "Natural", 80)
        loc_type = sanitize_prompt_fragment(
            meta.get("location_type") or "Environment", 120
        )

        # Time, weather, camera
        raw_time = time_of_day_override or environment.time_of_day or "Afternoon"
        if raw_time == "Custom" and meta.get("custom_time_of_day"):
            raw_time = str(meta["custom_time_of_day"])
        time_str = sanitize_prompt_fragment(raw_time, 120)

        raw_weather = weather_override or environment.weather or "Clear"
        if raw_weather == "Custom" and meta.get("custom_weather"):
            raw_weather = str(meta["custom_weather"])
        weather_str = sanitize_prompt_fragment(raw_weather, 120)

        raw_cam = (
            camera_perspective_override
            or environment.camera_perspective
            or "Wide establishing shot"
        )
        if raw_cam == "Custom" and meta.get("custom_camera_perspective"):
            raw_cam = str(meta["custom_camera_perspective"])
        cam_str = sanitize_prompt_fragment(raw_cam, 140)

        mood = sanitize_prompt_fragment(environment.visual_mood, 160)
        architecture = sanitize_prompt_fragment(meta.get("architecture"), 300)
        terrain = sanitize_prompt_fragment(meta.get("terrain"), 300)
        vegetation = sanitize_prompt_fragment(meta.get("vegetation"), 300)
        props = sanitize_prompt_fragment(meta.get("props"), 300)
        lighting = sanitize_prompt_fragment(
            lighting_override or meta.get("lighting"), 300
        )
        atmosphere = sanitize_prompt_fragment(meta.get("atmosphere"), 300)

        palette_list = (
            color_palette_override
            if color_palette_override is not None
            else (environment.color_palette or [])
        )
        palette_str = ", ".join(
            sanitize_prompt_fragment(c, 40) for c in palette_list if c
        )

        # Generation framing header
        gen_headers = {
            "concept": "Master Environment Concept Art, wide cinematic animated background composition, no text or watermarks.",
            "landscape": "Panoramic Landscape Background Plate, multi-plane parallax depth (foreground, midground, distant horizon), no characters blocking the scene.",
            "interior": "Detailed Interior Environment Background Plate, clear architectural layout, staging depth, and ambient room lighting.",
            "exterior": "Detailed Exterior Environment Establishing Background Plate, cohesive architecture and surrounding world geography.",
            "variation": f"Environment Variation ('{sanitize_prompt_fragment(variation_name or 'Alternate State', 120)}'): preserve exact architectural and terrain layout of the canonical environment while applying the variation conditions.",
            "lighting_variation": f"Environment Lighting Study ('{sanitize_prompt_fragment(lighting or variation_name or time_str, 120)}'): preserve spatial geometry and camera angle while transforming illumination and shadows.",
            "weather_variation": f"Environment Weather State ('{sanitize_prompt_fragment(weather_str or variation_name, 120)}'): preserve canonical structures while rendering authentic atmospheric weather effects.",
            "camera_view": f"Environment Camera Angle Study ({cam_str}): depict the same canonical environment from a {cam_str} perspective.",
            "environment_detail": f"Environment Hero Prop & Detail Close-Up ({sanitize_prompt_fragment(detail_focus or props or 'architectural & natural textures', 160)}).",
        }
        header = gen_headers.get(generation_type, gen_headers["concept"])

        sections: List[str] = [
            header,
            f"Art Style: {active_style} — {style_descriptor}.",
            f"Environment Identity: '{name}' ({category} — {loc_type}).",
        ]

        if desc:
            sections.append(f"Core Environment Description: {desc}.")

        world_elements: List[str] = []
        if architecture:
            world_elements.append(f"Architecture: {architecture}")
        if terrain:
            world_elements.append(f"Terrain & Topography: {terrain}")
        if vegetation:
            world_elements.append(f"Flora & Vegetation: {vegetation}")
        if props:
            world_elements.append(f"Set Dressing & Props: {props}")
        if world_elements:
            sections.append("World Construction: " + "; ".join(world_elements) + ".")

        env_conditions = [
            f"Time of Day: {time_str}",
            f"Weather: {weather_str}",
            f"Camera Perspective: {cam_str}",
        ]
        if lighting:
            env_conditions.append(f"Lighting: {lighting}")
        if mood:
            env_conditions.append(f"Visual Mood: {mood}")
        if atmosphere:
            env_conditions.append(f"Atmosphere: {atmosphere}")
        sections.append("Cinematography & Atmosphere: " + "; ".join(env_conditions) + ".")

        if palette_str:
            sections.append(f"Color Palette: {palette_str}.")

        if variation_description:
            sections.append(
                f"Variation Specification: {sanitize_prompt_fragment(variation_description, 350)}."
            )

        if story_context:
            sections.append(
                f"Story World Context: {sanitize_prompt_fragment(story_context, 300)}."
            )

        combined_instructions = user_instructions or meta.get("additional_instructions")
        if combined_instructions:
            sections.append(
                f"Director Instructions: {sanitize_prompt_fragment(str(combined_instructions), 400)}."
            )

        return " ".join(sections)
