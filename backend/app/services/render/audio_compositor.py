"""
Audio compositor for TR STUDIO Step 9 — Multi-Track Audio Mixing & FFmpeg Filter Graphs.
Combines dialogue, narration, music, and sound effect clips into a synchronized stereo master.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple


@dataclass
class AudioClipInput:
    file_path: Path
    start_ms: int
    duration_ms: int
    volume: float = 1.0
    fade_in_ms: int = 0
    fade_out_ms: int = 0
    track_category: str = "dialogue"  # dialogue | narration | music | sfx


class AudioCompositor:
    """
    Builds FFmpeg filter graphs and executes audio mixing for timeline clips.
    """

    def __init__(self, sample_rate: int = 44100, channels: int = 2) -> None:
        self.sample_rate = sample_rate
        self.channels = channels

    def build_filter_complex(
        self,
        clips: List[AudioClipInput],
        total_duration_ms: int,
    ) -> Tuple[List[str], str]:
        """
        Returns (ffmpeg_input_args, filter_complex_string).
        """
        if not clips:
            # Generate silent audio track for the requested duration
            dur_sec = max(0.5, total_duration_ms / 1000.0)
            args = ["-f", "lavfi", "-i", f"anullsrc=r={self.sample_rate}:cl=stereo:d={dur_sec:.3f}"]
            return args, "[0:a]aresample=44100[aout]"

        input_args: List[str] = []
        filter_chains: List[str] = []
        mix_inputs: List[str] = []

        for idx, clip in enumerate(clips):
            input_args.extend(["-i", str(clip.file_path)])
            delay_ms = max(0, clip.start_ms)
            vol = max(0.0, min(2.0, clip.volume))
            
            # Chain: adelay -> volume -> optional afade -> output label
            chain = f"[{idx}:a]adelay={delay_ms}|{delay_ms},volume={vol:.2f}"
            
            if clip.fade_in_ms > 0:
                fin_sec = clip.fade_in_ms / 1000.0
                chain += f",afade=t=in:ss=0:d={fin_sec:.3f}"
            
            if clip.fade_out_ms > 0 and clip.duration_ms > clip.fade_out_ms:
                fout_st = (clip.duration_ms - clip.fade_out_ms) / 1000.0
                fout_dur = clip.fade_out_ms / 1000.0
                chain += f",afade=t=out:st={fout_st:.3f}:d={fout_dur:.3f}"

            label = f"a{idx}"
            chain += f"[{label}]"
            filter_chains.append(chain)
            mix_inputs.append(f"[{label}]")

        # Combine all processed audio inputs with amix
        if len(mix_inputs) == 1:
            # Just route single input through aformat
            final_chain = f"{filter_chains[0]}; {mix_inputs[0]}aformat=sample_fmts=fltp:sample_rates={self.sample_rate}:channel_layouts=stereo[aout]"
        else:
            inputs_str = "".join(mix_inputs)
            # amix with dropout_transition and normalize=0 to preserve master volumes
            mix_chain = (
                f"{inputs_str}amix=inputs={len(mix_inputs)}:duration=longest:dropout_transition=2:normalize=0,"
                f"aformat=sample_fmts=fltp:sample_rates={self.sample_rate}:channel_layouts=stereo[aout]"
            )
            final_chain = "; ".join(filter_chains) + "; " + mix_chain

        return input_args, final_chain
