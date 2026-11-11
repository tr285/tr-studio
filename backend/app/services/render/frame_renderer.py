"""
Deterministic server-side 2D anime frame renderer using Pillow.
Renders evaluated animation frames into high-resolution RGBA/RGB image buffers:
- Camera transforms (zoom, pan, rotation)
- Layer-ordered object composition (character sprites, environment layers, props)
- Stylized vector anime placeholders when asset images are not present
- Professional burned-in anime subtitles with speaker badges
"""

import math
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from app.services.render.frame_evaluator import (
    EvaluatedCameraState,
    EvaluatedFrame,
    EvaluatedObjectState,
    camera_matrix,
    world_to_screen,
)


# Default anime color palette for stylized vector objects
PALETTE = {
    "character": (79, 70, 229),      # Indigo
    "prop": (16, 185, 129),          # Emerald
    "background": (15, 23, 42),      # Dark Slate
    "camera": (245, 158, 11),        # Amber
    "text": (248, 250, 252),         # Near white
    "shadow": (0, 0, 0, 160),
    "sky_top": (15, 23, 42),         # Deep indigo night
    "sky_bottom": (30, 41, 59),      # Slate horizon
}


class FrameRenderer:
    """
    Renders an EvaluatedFrame into a PIL Image.
    Maintains an in-memory image cache to avoid re-reading disk assets on every frame.
    """

    def __init__(
        self,
        target_width: int = 1920,
        target_height: int = 1080,
        asset_resolver: Optional[Callable[[str], Optional[Path]]] = None,
    ) -> None:
        self.target_width = target_width
        self.target_height = target_height
        self.asset_resolver = asset_resolver
        self._image_cache: Dict[str, Image.Image] = {}

    def get_asset_image(self, asset_id: str) -> Optional[Image.Image]:
        if not asset_id or not self.asset_resolver:
            return None
        if asset_id in self._image_cache:
            return self._image_cache[asset_id]

        file_path = self.asset_resolver(asset_id)
        if file_path and file_path.exists() and file_path.is_file():
            try:
                img = Image.open(file_path).convert("RGBA")
                self._image_cache[asset_id] = img
                return img
            except Exception:
                return None
        return None

    def render_frame(
        self,
        frame: EvaluatedFrame,
        bg_color: Tuple[int, int, int] = (15, 23, 42),
        bg_asset_id: Optional[str] = None,
        active_subtitle: Optional[Dict[str, str]] = None,
    ) -> Image.Image:
        """
        Renders a single video frame.
        """
        canvas = Image.new("RGBA", (self.target_width, self.target_height), (*bg_color, 255))

        # 1. Background image or gradient
        bg_img = self.get_asset_image(bg_asset_id) if bg_asset_id else None
        if bg_img:
            # Scale background to fill canvas
            bg_scaled = bg_img.resize((self.target_width, self.target_height), Image.Resampling.LANCZOS)
            canvas.alpha_composite(bg_scaled)
        else:
            self._render_cinematic_backdrop(canvas)

        # 2. Camera matrix [a, b, c, d, tx, ty]
        scale_x = self.target_width / float(frame.width)
        scale_y = self.target_height / float(frame.height)
        render_scale = min(scale_x, scale_y)

        matrix = camera_matrix(
            cam_x=frame.camera.x,
            cam_y=frame.camera.y,
            zoom=frame.camera.zoom * render_scale,
            rotation_deg=frame.camera.rotation,
            view_width=self.target_width,
            view_height=self.target_height,
        )

        # 3. Sort objects by z-index
        sorted_objects = sorted(frame.objects.values(), key=lambda o: o.z_index)

        # 4. Render objects
        for obj in sorted_objects:
            if not obj.visible or obj.opacity <= 0.0:
                continue
            self._render_object(canvas, obj, matrix)

        # 5. Burn-in subtitles if provided
        if active_subtitle and active_subtitle.get("text"):
            self._render_subtitle(canvas, active_subtitle)

        return canvas

    def _render_cinematic_backdrop(self, canvas: Image.Image) -> None:
        draw = ImageDraw.Draw(canvas)
        # Subtle horizontal perspective lines
        w, h = self.target_width, self.target_height
        horizon_y = int(h * 0.65)
        
        # Ground plane fill
        draw.rectangle([0, horizon_y, w, h], fill=(20, 25, 38, 255))
        # Subtle grid lines
        for y in range(horizon_y, h, max(24, int(h / 30))):
            draw.line([(0, y), (w, y)], fill=(30, 41, 59, 120), width=1)

    def _render_object(
        self,
        canvas: Image.Image,
        obj: EvaluatedObjectState,
        matrix: List[float],
    ) -> None:
        screen_x, screen_y = world_to_screen(matrix, obj.x, obj.y)
        zoom = math.hypot(matrix[0], matrix[1])
        cam_rot = math.degrees(math.atan2(matrix[1], matrix[0]))

        final_width = max(8, int(obj.width * abs(obj.scale_x) * zoom))
        final_height = max(8, int(obj.height * abs(obj.scale_y) * zoom))
        total_rotation = obj.rotation - cam_rot

        asset_img = self.get_asset_image(obj.asset_id) if obj.asset_id else None

        if asset_img:
            # Scale asset image
            resized = asset_img.resize((final_width, final_height), Image.Resampling.LANCZOS)
            if obj.scale_x < 0:
                resized = resized.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if obj.scale_y < 0:
                resized = resized.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

            if abs(total_rotation) > 0.1:
                resized = resized.rotate(
                    -total_rotation,
                    resample=Image.Resampling.BICUBIC,
                    expand=True,
                )

            # Apply opacity
            if obj.opacity < 0.999:
                alpha = resized.getchannel("A")
                alpha = alpha.point(lambda p: int(p * max(0.0, min(1.0, obj.opacity))))
                resized.putalpha(alpha)

            # Top-left from anchor
            rw, rh = resized.size
            top_left_x = int(screen_x - rw * obj.anchor_x)
            top_left_y = int(screen_y - rh * obj.anchor_y)

            # Composite onto canvas
            canvas.alpha_composite(resized, (top_left_x, top_left_y))
        else:
            # Render stylized anime actor silhouette / card
            self._render_stylized_placeholder(
                canvas,
                obj,
                screen_x,
                screen_y,
                final_width,
                final_height,
                total_rotation,
            )

    def _render_stylized_placeholder(
        self,
        canvas: Image.Image,
        obj: EvaluatedObjectState,
        cx: float,
        cy: float,
        width: int,
        height: int,
        rotation_deg: float,
    ) -> None:
        """
        Draws a crisp geometric anime character / prop figure when asset image is pending or unavailable.
        """
        card = Image.new("RGBA", (width + 40, height + 40), (0, 0, 0, 0))
        draw = ImageDraw.Draw(card)
        pad = 20

        color_primary = PALETTE.get(obj.kind, (99, 102, 241))
        # Draw rounded card body with accent border
        box = [pad, pad, pad + width, pad + height]
        draw.rounded_rectangle(box, radius=max(4, int(width * 0.08)), fill=(*color_primary, 220), outline=(255, 255, 255, 230), width=2)

        # Draw icon / silhouette head if character
        if obj.kind == "character":
            head_radius = max(6, int(min(width, height) * 0.18))
            head_cx = pad + int(width / 2)
            head_cy = pad + int(height * 0.35)
            draw.ellipse(
                [head_cx - head_radius, head_cy - head_radius, head_cx + head_radius, head_cy + head_radius],
                fill=(255, 255, 255, 240),
            )
            # Body curve
            body_top = head_cy + head_radius + 4
            body_bottom = pad + int(height * 0.85)
            draw.rounded_rectangle(
                [head_cx - int(width * 0.22), body_top, head_cx + int(width * 0.22), body_bottom],
                radius=4,
                fill=(255, 255, 255, 200),
            )

        # Draw name badge
        font = ImageFont.load_default()
        label = obj.name[:18]
        draw.text((pad + 6, pad + height - 16), label, fill=(255, 255, 255, 255), font=font)

        # Rotate if needed
        if abs(rotation_deg) > 0.1:
            card = card.rotate(-rotation_deg, resample=Image.Resampling.BICUBIC, expand=True)

        # Apply opacity
        if obj.opacity < 0.999:
            alpha = card.getchannel("A")
            alpha = alpha.point(lambda p: int(p * max(0.0, min(1.0, obj.opacity))))
            card.putalpha(alpha)

        cw, ch = card.size
        dest_x = int(cx - cw * obj.anchor_x)
        dest_y = int(cy - ch * obj.anchor_y)
        canvas.alpha_composite(card, (dest_x, dest_y))

    def _render_subtitle(self, canvas: Image.Image, subtitle: Dict[str, str]) -> None:
        """
        Renders anime dialogue / narration subtitles at the bottom center.
        """
        text = subtitle.get("text", "").strip()
        if not text:
            return

        speaker = subtitle.get("speaker")
        font = ImageFont.load_default()
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Calculate bounding box
        display_text = f"[{speaker}] {text}" if speaker else text
        bbox = draw.textbbox((0, 0), display_text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        # Padding & Pill
        pad_x = 24
        pad_y = 10
        pill_w = text_w + pad_x * 2
        pill_h = text_h + pad_y * 2
        pill_x = int((self.target_width - pill_w) / 2)
        pill_y = int(self.target_height - pill_h - 48)

        # Dark pill container with golden accent border
        draw.rounded_rectangle(
            [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
            radius=12,
            fill=(10, 15, 25, 215),
            outline=(245, 158, 11, 230) if speaker else (255, 255, 255, 180),
            width=2,
        )

        # Subtitle text
        draw.text(
            (pill_x + pad_x, pill_y + pad_y),
            display_text,
            fill=(255, 255, 255, 255),
            font=font,
        )

        canvas.alpha_composite(overlay)
