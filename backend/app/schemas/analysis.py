"""Pydantic schemas for AnalysisResult, RiskScore, InferenceRun."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class AnalysisResultResponse(BaseModel):
    id: str
    assessment_id: str
    user_id: int
    text_emotion: Optional[str]
    audio_emotion: Optional[str]
    video_emotion: Optional[str]
    stress_score: Optional[float]
    mood_score: Optional[float]
    emotional_distress_score: Optional[float]
    wellness_flag: int
    support_level: str
    crisis_flag: int
    confidence_score: Optional[float]
    created_at: Optional[str]

    model_config = {"from_attributes": True}


class RiskScoreResponse(BaseModel):
    id: str
    assessment_id: str
    user_id: int
    stress_score: Optional[float]
    low_mood_score: Optional[float]
    burnout_score: Optional[float]
    social_withdrawal_score: Optional[float]
    crisis_score: Optional[float]
    final_risk_level: str

    model_config = {"from_attributes": True}
