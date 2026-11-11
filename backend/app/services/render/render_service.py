"""
Orchestration Service for TR STUDIO Step 9 — Professional Video Rendering, Export & Production Pipeline.
Coordinates:
- Scene animation documents & keyframe tracks
- Character & environment visual assets
- Dialogue TTS, narration, music, sound effects mixing
- Deterministic frame rendering via Pillow
- Direct streaming into FFmpeg encoding
- Validation via FFprobe
- Secure storage and signed media URLs
"""

import os
import shutil
import tempfile
import threading
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException, NotFoundException
from app.database.session import SessionLocal
from app.models.animation import SceneAnimation
from app.models.audio import AudioAsset, SubtitleEntry, SubtitleTrack
from app.models.character import CharacterAsset
from app.models.environment import EnvironmentAsset
from app.models.project import Project
from app.models.render import RenderJob, RenderOutput
from app.models.story import DialogueEntry, NarrationEntry, Story, StoryScene
from app.schemas.render import RenderJobCreateRequest
from app.services.render.audio_compositor import AudioClipInput, AudioCompositor
from app.services.render.ffmpeg_encoder import FFmpegEncoder
from app.services.render.frame_evaluator import (
    evaluate_animation_document,
    frame_to_ms,
    ms_to_frame,
)
from app.services.render.frame_renderer import FrameRenderer
from app.services.storage_service import get_storage_backend


class RenderService:
    """Manages the lifecycle, background execution, and diagnostics of video render jobs."""

    def __init__(self) -> None:
        self.encoder = FFmpegEncoder()
        self.audio_compositor = AudioCompositor()
        self.storage = get_storage_backend()
        self._active_processes: Dict[uuid.UUID, Any] = {}

    def create_render_job(
        self,
        session: Session,
        project_id: uuid.UUID,
        owner_id: uuid.UUID,
        req: RenderJobCreateRequest,
    ) -> RenderJob:
        # Verify project access
        proj = session.execute(
            select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
        ).scalar_one_or_none()
        if not proj:
            raise NotFoundException("Project not found.")

        # If scene_id provided, verify
        scene = None
        if req.scene_id:
            scene = session.execute(
                select(StoryScene)
                .join(Story, StoryScene.story_id == Story.id)
                .where(
                    StoryScene.id == req.scene_id,
                    Story.project_id == project_id,
                )
            ).scalar_one_or_none()
            if not scene:
                raise NotFoundException("Scene not found in project.")

        # Determine duration
        total_duration_ms = 5000  # Default 5s fallback
        if scene and scene.duration_ms:
            total_duration_ms = scene.duration_ms
        elif req.export_range_type == "custom" and req.export_range_end_ms:
            total_duration_ms = max(500, req.export_range_end_ms - req.export_range_start_ms)
        else:
            # Query story scenes total duration
            scenes = session.execute(
                select(StoryScene)
                .join(Story, StoryScene.story_id == Story.id)
                .where(Story.project_id == project_id)
            ).scalars().all()
            if scenes:
                total_duration_ms = sum(s.duration_ms or 5000 for s in scenes)

        total_frames = max(1, ms_to_frame(total_duration_ms, req.fps))

        job = RenderJob(
            project_id=project_id,
            owner_id=owner_id,
            scene_id=req.scene_id,
            status="queued",
            progress_pct=0.0,
            current_stage="Queued for processing",
            total_frames=total_frames,
            rendered_frames=0,
            fps=req.fps,
            resolution_width=req.resolution_width,
            resolution_height=req.resolution_height,
            aspect_ratio=req.aspect_ratio,
            container_format=req.container_format,
            video_codec=req.video_codec,
            audio_codec=req.audio_codec,
            quality_preset=req.quality_preset,
            bitrate_kbps=req.bitrate_kbps,
            include_audio=req.include_audio,
            include_subtitles=req.include_subtitles,
            burn_subtitles=req.burn_subtitles,
            subtitle_track_id=req.subtitle_track_id,
            export_range_type=req.export_range_type,
            export_range_start_ms=req.export_range_start_ms,
            export_range_end_ms=req.export_range_end_ms or total_duration_ms,
            duration_ms=total_duration_ms,
            settings_json=req.model_dump(mode="json"),
            render_logs=["Job created and queued."],
        )
        session.add(job)
        session.commit()
        session.refresh(job)

        # Trigger background processing
        self._dispatch_job(job.id)
        return job

    def _dispatch_job(self, job_id: uuid.UUID) -> None:
        t = threading.Thread(target=self.execute_render_job, args=(job_id,), daemon=True)
        t.start()

    def execute_render_job(self, job_id: uuid.UUID) -> None:
        with SessionLocal() as session:
            job = session.get(RenderJob, job_id)
            if not job or job.status in ("preparing", "rendering", "encoding", "validating", "completed", "cancelled"):
                return

            # Check if output already exists
            existing_output = session.execute(
                select(RenderOutput).where(RenderOutput.job_id == job_id)
            ).scalar_one_or_none()
            if existing_output:
                return

            temp_dir = Path(tempfile.mkdtemp(prefix=f"tr_render_{job.id}_"))
            try:
                self._update_job(
                    session,
                    job,
                    status="preparing",
                    stage="Preparing timeline and asset references",
                    progress=5.0,
                    log="Initializing rendering pipeline workspace.",
                )

                # 1. Resolve animation document
                anim_doc = self._resolve_animation_document(session, job)

                # 2. Resolve assets resolver callback
                asset_resolver = self._build_asset_resolver(session, job.project_id)

                # 3. Resolve audio clips & build master audio file if requested
                master_audio_path: Optional[Path] = None
                if job.include_audio:
                    self._update_job(
                        session,
                        job,
                        stage="Compositing audio tracks",
                        progress=15.0,
                        log="Mixing dialogue, voice, music, and sound effects.",
                    )
                    master_audio_path = self._compose_audio(session, job, temp_dir)

                # 4. Resolve subtitles if burning subtitles
                subtitles: List[Dict[str, Any]] = []
                if job.burn_subtitles:
                    subtitles = self._gather_subtitles(session, job)

                # 5. Initialize FrameRenderer
                renderer = FrameRenderer(
                    target_width=job.resolution_width,
                    target_height=job.resolution_height,
                    asset_resolver=asset_resolver,
                )

                # 6. Encode video via FFmpeg
                self._update_job(
                    session,
                    job,
                    status="rendering",
                    stage=f"Rendering frames (0/{job.total_frames})",
                    progress=20.0,
                    log="Beginning deterministic frame evaluation and FFmpeg encoding.",
                )

                output_ext = job.container_format.lower()
                intermediate_video_path = temp_dir / f"render_output.{output_ext}"

                def frame_generator():
                    fps = job.fps
                    total = job.total_frames
                    start_ms = job.export_range_start_ms
                    for i in range(total):
                        # Check cancellation
                        if i % 4 == 0:
                            current_job = session.get(RenderJob, job_id)
                            if current_job and current_job.status == "cancelled":
                                return

                        t_ms = start_ms + frame_to_ms(i, fps)
                        eval_frame = evaluate_animation_document(anim_doc, float(t_ms))

                        # Active subtitle line for this timestamp
                        active_sub = None
                        for s in subtitles:
                            if s["start_ms"] <= t_ms <= s["end_ms"]:
                                active_sub = s
                                break

                        pil_frame = renderer.render_frame(
                            frame=eval_frame,
                            active_subtitle=active_sub,
                        )
                        yield pil_frame.tobytes()

                def on_render_progress(rendered: int, pct: float):
                    if rendered % max(1, job.total_frames // 10) == 0 or rendered == job.total_frames:
                        scaled_pct = 20.0 + (pct * 0.65)
                        self._update_job(
                            session,
                            job,
                            stage=f"Rendering & encoding frames ({rendered}/{job.total_frames})",
                            progress=min(88.0, scaled_pct),
                            rendered_frames=rendered,
                        )

                self.encoder.encode_from_raw_frames(
                    frame_generator=frame_generator,
                    total_frames=job.total_frames,
                    width=job.resolution_width,
                    height=job.resolution_height,
                    fps=job.fps,
                    output_path=intermediate_video_path,
                    video_codec=job.video_codec,
                    audio_codec=job.audio_codec,
                    quality_preset=job.quality_preset,
                    bitrate_kbps=job.bitrate_kbps,
                    audio_file=master_audio_path,
                    on_progress=on_render_progress,
                    on_process_spawned=lambda p: self._active_processes.update({job_id: p}),
                )

                # 7. Validating with ffprobe
                self._update_job(
                    session,
                    job,
                    status="validating",
                    stage="Validating video stream with FFprobe",
                    progress=90.0,
                    log="Inspecting output streams, codecs, and durations.",
                )
                probe_meta = self.encoder.probe_media(intermediate_video_path)

                # Check cancellation before persisting
                current_job = session.get(RenderJob, job_id)
                if current_job and current_job.status == "cancelled":
                    return

                # 8. Persist video file to secure storage
                video_bytes = intermediate_video_path.read_bytes()
                output_id = uuid.uuid4()
                file_ref = self.storage.save_render_output_bytes(
                    project_id=job.project_id,
                    output_id=output_id,
                    extension=output_ext,
                    data=video_bytes,
                )

                # 9. Create or update RenderOutput
                title = f"{job.project.title if job.project else 'Project'} - Render"
                if job.scene:
                    title += f" ({job.scene.title})"

                existing_out = session.execute(
                    select(RenderOutput).where(RenderOutput.job_id == job.id)
                ).scalar_one_or_none()

                if existing_out:
                    render_output = existing_out
                    render_output.file_path = file_ref
                    render_output.file_size_bytes = probe_meta.file_size_bytes
                    render_output.duration_ms = probe_meta.duration_ms or job.duration_ms
                    render_output.width = probe_meta.width
                    render_output.height = probe_meta.height
                    render_output.fps = probe_meta.fps
                    render_output.video_codec = probe_meta.video_codec
                    render_output.audio_codec = probe_meta.audio_codec
                    render_output.has_audio = probe_meta.has_audio
                    render_output.has_subtitles = job.burn_subtitles
                    render_output.metadata_json = {
                        "ffprobe_streams": probe_meta.raw_streams,
                        "file_size": probe_meta.file_size_bytes,
                        "storage_file_reference": file_ref,
                    }
                else:
                    render_output = RenderOutput(
                        id=output_id,
                        job_id=job.id,
                        project_id=job.project_id,
                        owner_id=job.owner_id,
                        scene_id=job.scene_id,
                        title=title,
                        file_path=file_ref,
                        mime_type=f"video/{output_ext}",
                        file_size_bytes=probe_meta.file_size_bytes,
                        duration_ms=probe_meta.duration_ms or job.duration_ms,
                        width=probe_meta.width,
                        height=probe_meta.height,
                        fps=probe_meta.fps,
                        aspect_ratio=job.aspect_ratio,
                        video_codec=probe_meta.video_codec,
                        audio_codec=probe_meta.audio_codec,
                        has_audio=probe_meta.has_audio,
                        has_subtitles=job.burn_subtitles,
                        metadata_json={
                            "ffprobe_streams": probe_meta.raw_streams,
                            "file_size": probe_meta.file_size_bytes,
                            "storage_file_reference": file_ref,
                        },
                    )
                    session.add(render_output)

                try:
                    session.flush()
                except Exception:
                    session.rollback()
                    return

                # 10. Mark completed
                job.output_file_path = file_ref
                job.output_file_size_bytes = probe_meta.file_size_bytes
                job.completed_at = datetime.now(timezone.utc)
                self._update_job(
                    session,
                    job,
                    status="completed",
                    stage="Export complete and ready for download",
                    progress=100.0,
                    log="Render completed successfully and validated with ffprobe.",
                )

            except Exception as exc:
                try:
                    session.refresh(job)
                except Exception:
                    pass
                if job.status != "cancelled":
                    err_detail = traceback.format_exc()
                    job.status = "failed"
                    job.error_message = str(exc)
                    job.render_logs.append(f"Render failed: {str(exc)}\n{err_detail[-300:]}")
                    session.commit()
            finally:
                self._active_processes.pop(job_id, None)
                if temp_dir.exists():
                    shutil.rmtree(temp_dir, ignore_errors=True)

    def _update_job(
        self,
        session: Session,
        job: RenderJob,
        status: Optional[str] = None,
        stage: Optional[str] = None,
        progress: Optional[float] = None,
        rendered_frames: Optional[int] = None,
        log: Optional[str] = None,
    ) -> None:
        try:
            session.refresh(job)
        except Exception:
            pass
        if job.status == "cancelled":
            return
        if status:
            job.status = status
            if status == "preparing" and not job.started_at:
                job.started_at = datetime.now(timezone.utc)
        if stage:
            job.current_stage = stage
        if progress is not None:
            job.progress_pct = round(progress, 1)
        if rendered_frames is not None:
            job.rendered_frames = rendered_frames
        if log:
            logs = list(job.render_logs or [])
            logs.append(log)
            job.render_logs = logs
        session.commit()

    def _resolve_animation_document(self, session: Session, job: RenderJob) -> Dict[str, Any]:
        """
        Retrieves or synthesizes a valid AnimationDocument for the job's project/scene.
        """
        # Look for SceneAnimation
        scene_anim = None
        if job.scene_id:
            scene_anim = session.execute(
                select(SceneAnimation).where(SceneAnimation.scene_id == job.scene_id)
            ).scalar_one_or_none()
        else:
            scene_anim = session.execute(
                select(SceneAnimation).where(SceneAnimation.project_id == job.project_id)
            ).scalars().first()

        if scene_anim and scene_anim.document:
            return scene_anim.document

        # Synthesize a clean default document from the scene characters/props
        doc_width = job.resolution_width
        doc_height = job.resolution_height
        return {
            "schema_version": "1.0",
            "fps": job.fps,
            "duration_ms": job.duration_ms,
            "width": doc_width,
            "height": doc_height,
            "camera": {
                "x": doc_width / 2.0,
                "y": doc_height / 2.0,
                "zoom": 1.0,
                "rotation": 0.0,
            },
            "objects": [
                {
                    "id": "char_hero",
                    "name": "Lead Hero",
                    "kind": "character",
                    "base": {
                        "x": doc_width * 0.4,
                        "y": doc_height * 0.55,
                        "scale_x": 1.0,
                        "scale_y": 1.0,
                        "rotation": 0.0,
                        "opacity": 1.0,
                        "visible": True,
                        "anchor_x": 0.5,
                        "anchor_y": 0.5,
                        "width": int(doc_width * 0.18),
                        "height": int(doc_height * 0.45),
                    },
                },
                {
                    "id": "char_partner",
                    "name": "Companion",
                    "kind": "character",
                    "base": {
                        "x": doc_width * 0.65,
                        "y": doc_height * 0.58,
                        "scale_x": 1.0,
                        "scale_y": 1.0,
                        "rotation": 0.0,
                        "opacity": 1.0,
                        "visible": True,
                        "anchor_x": 0.5,
                        "anchor_y": 0.5,
                        "width": int(doc_width * 0.16),
                        "height": int(doc_height * 0.42),
                    },
                },
            ],
            "tracks": [
                {
                    "id": "tr_hero_x",
                    "target_id": "char_hero",
                    "property": "x",
                    "enabled": True,
                    "keyframes": [
                        {"id": "kf1", "time_ms": 0, "value": doc_width * 0.35, "interpolation": "ease-out"},
                        {"id": "kf2", "time_ms": job.duration_ms, "value": doc_width * 0.45, "interpolation": "ease-in-out"},
                    ],
                }
            ],
            "motion_paths": [],
        }

    def _build_asset_resolver(self, session: Session, project_id: uuid.UUID):
        """Returns a function that maps an asset_id string to an absolute local Path."""
        def resolver(asset_id_str: str) -> Optional[Path]:
            try:
                asset_uuid = uuid.UUID(asset_id_str)
            except ValueError:
                return None

            # Look in CharacterAsset
            char_asset = session.get(CharacterAsset, asset_uuid)
            if char_asset and char_asset.file_path:
                return self.storage.resolve_safe_path(char_asset.file_path)

            # Look in EnvironmentAsset
            env_asset = session.get(EnvironmentAsset, asset_uuid)
            if env_asset and env_asset.file_path:
                return self.storage.resolve_safe_path(env_asset.file_path)

            return None

        return resolver

    def _compose_audio(
        self,
        session: Session,
        job: RenderJob,
        temp_dir: Path,
    ) -> Optional[Path]:
        """Collects audio clips from dialogue, narration, and audio assets and mixes via FFmpeg."""
        clips: List[AudioClipInput] = []

        # Query dialogue lines with audio
        dialogues = session.execute(
            select(DialogueEntry)
            .join(StoryScene, DialogueEntry.scene_id == StoryScene.id)
            .join(Story, StoryScene.story_id == Story.id)
            .where(
                Story.project_id == job.project_id,
                DialogueEntry.audio_asset_id.is_not(None),
            )
        ).scalars().all()

        for d in dialogues:
            if d.audio_asset_id:
                audio_asset = session.get(AudioAsset, d.audio_asset_id)
                if audio_asset and audio_asset.file_path:
                    clip_path = self.storage.resolve_safe_path(audio_asset.file_path)
                    if clip_path.exists():
                        clips.append(
                            AudioClipInput(
                                file_path=clip_path,
                                start_ms=d.start_ms or 0,
                                duration_ms=d.duration_ms or 2000,
                                volume=1.0,
                                track_category="dialogue",
                            )
                        )

        # Query narration lines with audio
        narrations = session.execute(
            select(NarrationEntry)
            .join(StoryScene, NarrationEntry.scene_id == StoryScene.id)
            .join(Story, StoryScene.story_id == Story.id)
            .where(
                Story.project_id == job.project_id,
                NarrationEntry.audio_asset_id.is_not(None),
            )
        ).scalars().all()

        for n in narrations:
            if n.audio_asset_id:
                audio_asset = session.get(AudioAsset, n.audio_asset_id)
                if audio_asset and audio_asset.file_path:
                    clip_path = self.storage.resolve_safe_path(audio_asset.file_path)
                    if clip_path.exists():
                        clips.append(
                            AudioClipInput(
                                file_path=clip_path,
                                start_ms=n.start_ms or 0,
                                duration_ms=n.duration_ms or 2500,
                                volume=1.0,
                                track_category="narration",
                            )
                        )

        # Query music & sound effect assets
        audio_assets = session.execute(
            select(AudioAsset).where(AudioAsset.project_id == job.project_id)
        ).scalars().all()

        for a in audio_assets:
            if a.category in ("music", "sound_effect") and a.file_path:
                clip_path = self.storage.resolve_safe_path(a.file_path)
                if clip_path.exists():
                    vol = 0.4 if a.category == "music" else 0.8
                    clips.append(
                        AudioClipInput(
                            file_path=clip_path,
                            start_ms=0,
                            duration_ms=min(job.duration_ms, a.duration_ms),
                            volume=vol,
                            fade_in_ms=500 if a.category == "music" else 0,
                            fade_out_ms=1000 if a.category == "music" else 0,
                            track_category=a.category,
                        )
                    )

        if not clips:
            return None

        # Render composite audio with FFmpeg into temp WAV
        mixed_audio_file = temp_dir / "master_audio.wav"
        input_args, filter_str = self.audio_compositor.build_filter_complex(
            clips=clips,
            total_duration_ms=job.duration_ms,
        )

        import subprocess
        cmd = [
            self.encoder.ffmpeg_bin,
            "-y",
            *input_args,
            "-filter_complex", filter_str,
            "-map", "[aout]",
            "-ac", "2",
            "-ar", "44100",
            str(mixed_audio_file),
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode == 0 and mixed_audio_file.exists():
            return mixed_audio_file
        return None

    def _gather_subtitles(self, session: Session, job: RenderJob) -> List[Dict[str, Any]]:
        """Gathers dialogue, narration, or SubtitleTrack entries."""
        subtitles: List[Dict[str, Any]] = []

        # Check for explicit SubtitleTrack
        track = None
        if job.subtitle_track_id:
            track = session.get(SubtitleTrack, job.subtitle_track_id)
        else:
            track = session.execute(
                select(SubtitleTrack).where(
                    SubtitleTrack.project_id == job.project_id,
                    SubtitleTrack.is_default.is_(True),
                )
            ).scalars().first()

        if track:
            entries = session.execute(
                select(SubtitleEntry).where(SubtitleEntry.track_id == track.id)
            ).scalars().all()
            for e in entries:
                subtitles.append({
                    "start_ms": e.start_time_ms,
                    "end_ms": e.end_time_ms,
                    "text": e.text,
                    "speaker": e.speaker_name,
                })
            if subtitles:
                return subtitles

        # Fallback to dialogue and narration entries
        dialogues = session.execute(
            select(DialogueEntry)
            .join(StoryScene, DialogueEntry.scene_id == StoryScene.id)
            .join(Story, StoryScene.story_id == Story.id)
            .where(Story.project_id == job.project_id)
        ).scalars().all()
        for d in dialogues:
            if d.line:
                st = d.start_ms or 0
                dur = d.duration_ms or 2000
                subtitles.append({
                    "start_ms": st,
                    "end_ms": st + dur,
                    "text": d.line,
                    "speaker": d.character_name,
                })

        narrations = session.execute(
            select(NarrationEntry)
            .join(StoryScene, NarrationEntry.scene_id == StoryScene.id)
            .join(Story, StoryScene.story_id == Story.id)
            .where(Story.project_id == job.project_id)
        ).scalars().all()
        for n in narrations:
            if n.text:
                st = n.start_ms or 0
                dur = n.duration_ms or 2500
                subtitles.append({
                    "start_ms": st,
                    "end_ms": st + dur,
                    "text": n.text,
                    "speaker": "Narrator",
                })

        return subtitles

    def cancel_render_job(self, session: Session, job_id: uuid.UUID, owner_id: uuid.UUID) -> RenderJob:
        job = session.execute(
            select(RenderJob).where(RenderJob.id == job_id, RenderJob.owner_id == owner_id)
        ).scalar_one_or_none()
        if not job:
            raise NotFoundException("Render job not found.")

        # Terminate active process if running
        proc = self._active_processes.pop(job_id, None)
        if proc:
            try:
                proc.kill()
            except Exception:
                pass

        if job.status not in ("completed", "failed", "cancelled"):
            job.status = "cancelled"
            job.current_stage = "Job cancelled by user"
            session.commit()
            session.refresh(job)
        return job

    def retry_render_job(self, session: Session, job_id: uuid.UUID, owner_id: uuid.UUID) -> RenderJob:
        job = session.execute(
            select(RenderJob).where(RenderJob.id == job_id, RenderJob.owner_id == owner_id)
        ).scalar_one_or_none()
        if not job:
            raise NotFoundException("Render job not found.")

        # Terminate active process if running
        proc = self._active_processes.pop(job_id, None)
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        
        # Clean up existing output if any before re-running
        old_output = session.execute(
            select(RenderOutput).where(RenderOutput.job_id == job_id)
        ).scalar_one_or_none()
        if old_output:
            try:
                self.storage.delete_asset(old_output.file_path)
            except Exception:
                pass
            session.delete(old_output)

        job.status = "queued"
        job.progress_pct = 0.0
        job.current_stage = "Re-queued for processing"
        job.rendered_frames = 0
        job.error_message = None
        job.output_file_path = None
        job.output_file_size_bytes = None
        job.started_at = None
        job.completed_at = None
        job.render_logs = ["Job retried by user."]
        session.commit()
        session.refresh(job)

        self._dispatch_job(job.id)
        return job

    def list_jobs(self, session: Session, project_id: uuid.UUID, owner_id: uuid.UUID) -> List[RenderJob]:
        return list(session.execute(
            select(RenderJob)
            .where(RenderJob.project_id == project_id, RenderJob.owner_id == owner_id)
            .order_by(desc(RenderJob.created_at))
        ).scalars().all())

    def get_job(self, session: Session, job_id: uuid.UUID, owner_id: uuid.UUID) -> RenderJob:
        job = session.execute(
            select(RenderJob).where(RenderJob.id == job_id, RenderJob.owner_id == owner_id)
        ).scalar_one_or_none()
        if not job:
            raise NotFoundException("Render job not found.")
        return job

    def list_outputs(self, session: Session, project_id: uuid.UUID, owner_id: uuid.UUID) -> List[RenderOutput]:
        return list(session.execute(
            select(RenderOutput)
            .where(RenderOutput.project_id == project_id, RenderOutput.owner_id == owner_id)
            .order_by(desc(RenderOutput.created_at))
        ).scalars().all())

    def get_output(self, session: Session, output_id: uuid.UUID, owner_id: uuid.UUID) -> RenderOutput:
        output = session.execute(
            select(RenderOutput).where(RenderOutput.id == output_id, RenderOutput.owner_id == owner_id)
        ).scalar_one_or_none()
        if not output:
            raise NotFoundException("Render output not found.")
        return output

    def delete_output(self, session: Session, output_id: uuid.UUID, owner_id: uuid.UUID) -> None:
        output = session.execute(
            select(RenderOutput).where(RenderOutput.id == output_id, RenderOutput.owner_id == owner_id)
        ).scalar_one_or_none()
        if not output:
            raise NotFoundException("Render output not found.")
        try:
            self.storage.delete_asset(output.file_path)
        except Exception:
            pass
        session.delete(output)
        session.commit()
