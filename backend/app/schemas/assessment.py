"""Pydantic schemas for Assessment and AssessmentModality."""
from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel


class AssessmentCreate(BaseModel):
    session_type: str = "checkin"
    notes: Optional[str] = None


class AssessmentUpdate(BaseModel):
    status: Optional[str] = None
    completed_at: Optional[str] = None
    overall_confidence: Optional[float] = None
    notes: Optional[str] = None


class AssessmentResponse(BaseModel):
    id: str
    user_id: int
    session_type: str
    started_at: Optional[str]
    completed_at: Optional[str]
    status: str
    overall_confidence: Optional[float]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class AssessmentModalityCreate(BaseModel):
    modality_type: str
    availability_status: str = "available"
    quality_score: Optional[float] = None


class AssessmentModalityResponse(BaseModel):
    id: str
    assessment_id: str
    modality_type: str
    availability_status: str
    quality_score: Optional[float]
    processing_status: str

    model_config = {"from_attributes": True}
