"""Pydantic schemas for AudioRecording."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class AudioRecordingResponse(BaseModel):
    id: str
    assessment_id: str
    user_id: int
    storage_key: Optional[str]
    duration_seconds: Optional[float]
    transcript_text: Optional[str]
    transcript_language: Optional[str]
    snr_score: Optional[float]
    processing_status: str
    created_at: Optional[str]

    model_config = {"from_attributes": True}
