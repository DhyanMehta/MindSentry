"""Pydantic schemas for VideoRecording."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class VideoRecordingResponse(BaseModel):
    id: str
    assessment_id: str
    user_id: int
    storage_key: Optional[str]
    duration_seconds: Optional[float]
    fps: Optional[int]
    face_detected: Optional[int]
    lighting_score: Optional[float]
    processing_status: str
    created_at: Optional[str]

    model_config = {"from_attributes": True}
