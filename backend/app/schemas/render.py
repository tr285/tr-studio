"""
Pydantic Schemas for TR STUDIO Step 9 — Professional Video Rendering, Export & Production Pipeline.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


ContainerFormat = Literal["mp4", "webm", "mov"]
VideoCodec = Literal["h264", "h265", "vp9", "prores"]
AudioCodec = Literal["aac", "opus", "mp3"]
QualityPreset = Literal["draft", "standard", "high", "production"]
ExportRangeType = Literal["full", "scene", "custom"]
AspectRatio = Literal["16:9", "9:16", "1:1", "4:3", "21:9"]


ASPECT_RATIO_DIMENSIONS = {
    "16:9": {"720p": (1280, 720), "1080p": (1920, 1080), "4k": (3840, 2160)},
    "9:16": {"720p": (720, 1280), "1080p": (1080, 1920), "4k": (2160, 3840)},
    "1:1": {"720p": (720, 720), "1080p": (1080, 1080), "4k": (2160, 2160)},
    "4:3": {"720p": (960, 720), "1080p": (1440, 1080), "4k": (2880, 2160)},
    "21:9": {"720p": (1680, 720), "1080p": (2560, 1080), "4k": (5120, 2160)},
}


class RenderJobCreateRequest(BaseModel):
    scene_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional scene ID to render a single scene instead of full story timeline",
    )
    export_range_type: ExportRangeType = Field(
        default="full",
        description="full project, single scene, or custom millisecond range",
    )
    export_range_start_ms: int = Field(default=0, ge=0)
    export_range_end_ms: Optional[int] = Field(default=None, ge=100)

    # Video specs
    resolution_width: int = Field(default=1920, ge=320, le=7680)
    resolution_height: int = Field(default=1080, ge=240, le=4320)
    aspect_ratio: AspectRatio = Field(default="16:9")
    fps: int = Field(default=24, ge=12, le=60)
    container_format: ContainerFormat = Field(default="mp4")
    video_codec: VideoCodec = Field(default="h264")
    audio_codec: AudioCodec = Field(default="aac")
    quality_preset: QualityPreset = Field(default="standard")
    bitrate_kbps: Optional[int] = Field(default=None, ge=500, le=50000)

    # Audio & Subtitles
    include_audio: bool = Field(default=True)
    include_subtitles: bool = Field(default=False)
    burn_subtitles: bool = Field(
        default=False,
        description="Burn subtitles directly onto video frames using anime styling",
    )
    subtitle_track_id: Optional[uuid.UUID] = Field(default=None)

    @model_validator(mode="after")
    def validate_codecs_and_bounds(self) -> "RenderJobCreateRequest":
        # Check custom range
        if self.export_range_type == "custom":
            if self.export_range_end_ms is not None and self.export_range_end_ms <= self.export_range_start_ms:
                raise ValueError("export_range_end_ms must be greater than export_range_start_ms")
        
        # Ensure container and codec compatibility
        if self.container_format == "webm":
            if self.video_codec not in ("vp9", "h264"):
                self.video_codec = "vp9"
            if self.audio_codec not in ("opus",):
                self.audio_codec = "opus"
        elif self.container_format == "mp4":
            if self.video_codec not in ("h264", "h265"):
                self.video_codec = "h264"
            if self.audio_codec not in ("aac", "mp3"):
                self.audio_codec = "aac"

        return self


class RenderJobResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    scene_id: Optional[uuid.UUID] = None

    status: str
    progress_pct: float
    current_stage: str

    total_frames: int
    rendered_frames: int

    fps: int
    resolution_width: int
    resolution_height: int
    aspect_ratio: str
    container_format: str
    video_codec: str
    audio_codec: str
    quality_preset: str
    bitrate_kbps: Optional[int] = None

    include_audio: bool
    include_subtitles: bool
    burn_subtitles: bool
    subtitle_track_id: Optional[uuid.UUID] = None

    export_range_type: str
    export_range_start_ms: int
    export_range_end_ms: Optional[int] = None

    duration_ms: int
    output_file_path: Optional[str] = None
    output_file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None
    render_logs: List[str] = Field(default_factory=list)

    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RenderOutputResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    scene_id: Optional[uuid.UUID] = None

    title: str
    file_path: str
    mime_type: str
    file_size_bytes: int
    duration_ms: int

    width: int
    height: int
    fps: int
    aspect_ratio: str

    video_codec: str
    audio_codec: Optional[str] = None
    has_audio: bool
    has_subtitles: bool

    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    media_url: Optional[str] = None
    download_url: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RenderJobListResponse(BaseModel):
    jobs: List[RenderJobResponse]
    total: int


class RenderOutputListResponse(BaseModel):
    outputs: List[RenderOutputResponse]
    total: int
