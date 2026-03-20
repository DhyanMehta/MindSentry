"""
Secure file upload utilities.

Files are stored under BASE_UPLOAD_DIR (uploads/ next to the app root).
Each modality gets its own sub-directory.
Original filenames are replaced with a UUID to prevent path traversal.
"""
import uuid
import os
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from app.utils.constants import (
    MAX_AUDIO_SIZE_MB, MAX_VIDEO_SIZE_MB,
    ALLOWED_AUDIO_TYPES, ALLOWED_VIDEO_TYPES,
)

BASE_UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_key(subdir: str, extension: str) -> str:
    """Return a storage key (relative path string) for the uploaded file."""
    return f"{subdir}/{uuid.uuid4().hex}{extension}"


def _ext(content_type: str) -> str:
    mapping = {
        "audio/wav": ".wav", "audio/mpeg": ".mp3", "audio/ogg": ".ogg",
        "audio/webm": ".webm", "audio/mp4": ".m4a",
        "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
        "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
        "image/webp": ".webp", "image/bmp": ".bmp",
    }
    return mapping.get(content_type, ".bin")


async def save_audio(file: UploadFile) -> str:
    """Validate and save an audio file. Returns the storage_key."""
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            detail=f"Unsupported audio type: {file.content_type}")
    data = await file.read()
    if len(data) > MAX_AUDIO_SIZE_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Audio file exceeds {MAX_AUDIO_SIZE_MB} MB limit")
    key = _safe_key("audio", _ext(file.content_type))
    dest = _ensure_dir(BASE_UPLOAD_DIR / "audio") / Path(key).name
    dest.write_bytes(data)
    return key


async def save_video(file: UploadFile) -> str:
    """Validate and save a video file. Returns the storage_key."""
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            detail=f"Unsupported video type: {file.content_type}")
    data = await file.read()
    if len(data) > MAX_VIDEO_SIZE_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Video file exceeds {MAX_VIDEO_SIZE_MB} MB limit")
    key = _safe_key("video", _ext(file.content_type))
    dest = _ensure_dir(BASE_UPLOAD_DIR / "video") / Path(key).name
    dest.write_bytes(data)
    return key


def full_path(storage_key: str) -> Path:
    """Resolve a storage_key to an absolute filesystem path."""
    return BASE_UPLOAD_DIR / storage_key
