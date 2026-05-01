"""Canonical media preprocessing for audio/video inference.

This service normalizes raw uploads into model-ready artifacts so inference
services can consume consistent inputs across Android/iOS capture formats.
"""
from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path

import imageio_ffmpeg


class MediaPreprocessingError(RuntimeError):
    """Raised when ffmpeg preprocessing fails."""


def _canonical_dir(source_path: Path, modality: str) -> Path:
    # Keep canonical artifacts next to uploads for easier debugging/auditing.
    base = source_path.parent / "_canonical" / modality
    base.mkdir(parents=True, exist_ok=True)
    return base


def _run_ffmpeg(args: list[str]) -> None:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ffmpeg_exe, "-y", *args]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        raise MediaPreprocessingError(stderr or "ffmpeg failed")


def _run_ffprobe_json(input_path: Path) -> dict:
    ffprobe_exe = Path(imageio_ffmpeg.get_ffmpeg_exe()).with_name("ffprobe.exe")
    if not ffprobe_exe.exists():
        return {}

    cmd = [
        str(ffprobe_exe),
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        str(input_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return {}
    try:
        return json.loads(proc.stdout or "{}")
    except Exception:
        return {}


def preprocess_audio(input_path: str | Path) -> dict:
    source = Path(input_path)
    if not source.exists():
        raise MediaPreprocessingError(f"Audio file not found: {source}")

    out_dir = _canonical_dir(source, "audio")
    canonical_path = out_dir / f"{uuid.uuid4().hex}.wav"

    # Canonical audio contract: mono, 16kHz, PCM16 WAV.
    # Hard cap at 30s — HF Inference API free tier times out on longer clips.
    _run_ffmpeg([
        "-i",
        str(source),
        "-vn",
        "-t",
        "30",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(canonical_path),
    ])

    import wave

    with wave.open(str(canonical_path), "rb") as wav_file:
        sr = int(wav_file.getframerate() or 16000)
        channels = int(wav_file.getnchannels() or 1)
        frame_count = int(wav_file.getnframes() or 0)
    duration = (frame_count / sr) if sr > 0 else 0.0

    return {
        "canonical_path": canonical_path,
        "sample_rate_hz": sr,
        "channels": channels,
        "duration_seconds": round(float(duration), 3),
        "source_path": source,
    }


def preprocess_video(input_path: str | Path) -> dict:
    source = Path(input_path)
    if not source.exists():
        raise MediaPreprocessingError(f"Video file not found: {source}")

    out_dir = _canonical_dir(source, "video")
    canonical_path = out_dir / f"{uuid.uuid4().hex}.mp4"

    # Canonical video contract for frame sampling:
    # - H.264 mp4
    # - yuv420p pixel format
    # - 15 FPS (stable sampling budget)
    # - 15s max duration (guided face task is ~10s)
    # - width scaled down for efficient face detection
    _run_ffmpeg([
        "-i",
        str(source),
        "-an",
        "-t",
        "15",
        "-vf",
        "fps=15,scale='min(640,iw)':-2:flags=bilinear",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "28",
        "-pix_fmt",
        "yuv420p",
        str(canonical_path),
    ])

    probe = _run_ffprobe_json(canonical_path)
    streams = probe.get("streams") or []
    format_info = probe.get("format") or {}
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), {})

    width = int(video_stream.get("width") or 0)
    height = int(video_stream.get("height") or 0)
    fps_raw = str(video_stream.get("avg_frame_rate") or "0/1")
    if "/" in fps_raw:
        num, den = fps_raw.split("/", 1)
        fps = (float(num) / float(den)) if float(den or 1) != 0 else 0.0
    else:
        fps = float(video_stream.get("r_frame_rate") or 0.0)
    duration = float(format_info.get("duration") or 0.0)

    return {
        "canonical_path": canonical_path,
        "width": width,
        "height": height,
        "fps": round(float(fps), 3),
        "duration_seconds": round(float(duration), 3),
        "source_path": source,
    }
