"""Pydantic schemas for AnalysisResult, RiskScore, InferenceRun."""
from __future__ import annotations
from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class AnalysisResultResponse(BaseModel):
    id: str
    assessment_id: str
    user_id: int
    text_emotion: Optional[str]
    text_confidence: Optional[float] = None
    text_integrity_score: Optional[float] = None
    text_spoof_risk: Optional[float] = None
    text_integrity_flags: Optional[List[str]] = None
    audio_emotion: Optional[str]
    audio_confidence: Optional[float] = None
    audio_integrity_score: Optional[float] = None
    audio_spoof_risk: Optional[float] = None
    audio_integrity_flags: Optional[List[str]] = None
    video_emotion: Optional[str]
    video_confidence: Optional[float] = None
    video_input_type: Optional[str] = None
    video_integrity_score: Optional[float] = None
    video_spoof_risk: Optional[float] = None
    video_integrity_flags: Optional[List[str]] = None
    stress_score: Optional[float]
    mood_score: Optional[float]
    wellness_score: Optional[int] = None
    emotional_distress_score: Optional[float]
    wellness_flag: int
    support_level: str
    crisis_flag: int
    confidence_score: Optional[float]
    overall_integrity_score: Optional[float] = None
    overall_spoof_risk: Optional[float] = None
    scoring_source: Optional[str] = None
    model_name: Optional[str] = None
    model_input_features: Optional[Dict[str, float]] = None
    model_output_scores: Optional[Dict[str, float]] = None
    dominant_features: Optional[Dict[str, Any]] = None
    inference_tracking: Optional[Dict[str, Any]] = None
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
