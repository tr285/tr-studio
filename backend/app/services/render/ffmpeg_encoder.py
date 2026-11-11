"""
FFmpeg & FFprobe Integration for TR STUDIO Step 9.
Handles video encoding, progress tracking, codec mapping, and output verification.
"""

import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.core.exceptions import AppException


def find_binary(name: str) -> str:
    """Finds binary path honoring macOS Homebrew and standard Linux paths."""
    candidates = [
        f"/opt/homebrew/bin/{name}",
        f"/usr/local/bin/{name}",
        f"/usr/bin/{name}",
    ]
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    found = shutil.which(name)
    if found:
        return found
    return name


FFMPEG_PATH = find_binary("ffmpeg")
FFPROBE_PATH = find_binary("ffprobe")


QUALITY_CRF = {
    "draft": 28,
    "standard": 23,
    "high": 18,
    "production": 14,
}

CODEC_MAP = {
    "h264": "libx264",
    "h265": "libx265",
    "vp9": "libvpx-vp9",
    "prores": "prores_ks",
    "aac": "aac",
    "opus": "libopus",
    "mp3": "libmp3lame",
}


@dataclass
class VideoProbeMetadata:
    width: int
    height: int
    fps: int
    duration_ms: int
    file_size_bytes: int
    video_codec: str
    audio_codec: Optional[str]
    has_audio: bool
    raw_streams: List[Dict[str, Any]] = field(default_factory=list)


class FFmpegEncoder:
    """Encodes animated frames and audio tracks into validated video outputs."""

    def __init__(self, ffmpeg_bin: str = FFMPEG_PATH, ffprobe_bin: str = FFPROBE_PATH) -> None:
        self.ffmpeg_bin = ffmpeg_bin
        self.ffprobe_bin = ffprobe_bin

    def probe_media(self, file_path: Path) -> VideoProbeMetadata:
        """
        Executes ffprobe and parses video/audio stream properties.
        """
        if not file_path.exists() or file_path.stat().st_size == 0:
            raise AppException(
                detail=f"Output file does not exist or is empty: {file_path}",
                status_code=500,
                error_code="RENDER_OUTPUT_NOT_FOUND",
            )

        cmd = [
            self.ffprobe_bin,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(file_path),
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            raise AppException(
                detail=f"ffprobe failed to inspect media output: {res.stderr}",
                status_code=500,
                error_code="FFPROBE_FAILED",
            )

        try:
            data = json.loads(res.stdout)
        except json.JSONDecodeError as exc:
            raise AppException(
                detail="ffprobe output could not be parsed as JSON.",
                status_code=500,
                error_code="FFPROBE_PARSE_ERROR",
            ) from exc

        streams = data.get("streams", [])
        fmt = data.get("format", {})

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        if not video_stream:
            raise AppException(
                detail="Exported file contains no valid video stream.",
                status_code=500,
                error_code="NO_VIDEO_STREAM",
            )

        width = int(video_stream.get("width", 0))
        height = int(video_stream.get("height", 0))
        video_codec = video_stream.get("codec_name", "unknown")

        # Frame rate calculation
        r_frame_rate = video_stream.get("r_frame_rate", "24/1")
        if "/" in r_frame_rate:
            num, den = r_frame_rate.split("/")
            fps = round(float(num) / float(den)) if float(den) > 0 else 24
        else:
            fps = int(float(r_frame_rate)) if r_frame_rate else 24

        duration_sec = float(fmt.get("duration", video_stream.get("duration", 0.0)))
        duration_ms = int(duration_sec * 1000)
        file_size = int(fmt.get("size", file_path.stat().st_size))

        return VideoProbeMetadata(
            width=width,
            height=height,
            fps=fps,
            duration_ms=duration_ms,
            file_size_bytes=file_size,
            video_codec=video_codec,
            audio_codec=audio_stream.get("codec_name") if audio_stream else None,
            has_audio=audio_stream is not None,
            raw_streams=streams,
        )

    def encode_from_raw_frames(
        self,
        frame_generator: Callable[[], Any],
        total_frames: int,
        width: int,
        height: int,
        fps: int,
        output_path: Path,
        video_codec: str = "h264",
        audio_codec: str = "aac",
        quality_preset: str = "standard",
        bitrate_kbps: Optional[int] = None,
        audio_file: Optional[Path] = None,
        on_progress: Optional[Callable[[int, float], None]] = None,
        on_process_spawned: Optional[Callable[[subprocess.Popen], None]] = None,
    ) -> None:
        """
        Pipes raw RGBA frames directly into FFmpeg stdin, eliminating temporary disk PNG files.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        v_encoder = CODEC_MAP.get(video_codec, "libx264")
        crf = QUALITY_CRF.get(quality_preset, 23)

        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-f", "rawvideo",
            "-pix_fmt", "rgba",
            "-s", f"{width}x{height}",
            "-r", str(fps),
            "-i", "pipe:0",
        ]

        if audio_file and audio_file.exists():
            cmd.extend(["-i", str(audio_file)])
            a_encoder = CODEC_MAP.get(audio_codec, "aac")
            cmd.extend(["-c:a", a_encoder, "-b:a", "192k"])
            # Map stream 0 (video) and stream 1 (audio)
            cmd.extend(["-map", "0:v:0", "-map", "1:a:0?"])
            cmd.extend(["-shortest"])
        else:
            cmd.extend(["-an"])

        cmd.extend([
            "-c:v", v_encoder,
            "-pix_fmt", "yuv420p",
        ])

        if bitrate_kbps:
            cmd.extend(["-b:v", f"{bitrate_kbps}k"])
        elif video_codec in ("h264", "h265"):
            cmd.extend(["-crf", str(crf), "-preset", "medium"])

        cmd.append(str(output_path))

        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if on_process_spawned:
            on_process_spawned(process)

        try:
            rendered = 0
            for frame_rgba_bytes in frame_generator():
                process.stdin.write(frame_rgba_bytes)
                rendered += 1
                if on_progress:
                    pct = (rendered / float(total_frames)) * 100.0 if total_frames > 0 else 0.0
                    on_progress(rendered, min(99.0, pct))
            try:
                process.stdin.flush()
                process.stdin.close()
            except (BrokenPipeError, OSError):
                pass
            finally:
                process.stdin = None

            _, stderr_data = process.communicate()
        except Exception as exc:
            try:
                process.kill()
            except Exception:
                pass
            raise AppException(
                detail=f"FFmpeg pipeline crashed: {str(exc)}",
                status_code=500,
                error_code="FFMPEG_ENCODE_ERROR",
            ) from exc

        if process.returncode != 0:
            err_msg = stderr_data.decode("utf-8", errors="replace")[-500:]
            raise AppException(
                detail=f"FFmpeg encoding failed with code {process.returncode}: {err_msg}",
                status_code=500,
                error_code="FFMPEG_RETURN_CODE_ERROR",
            )
