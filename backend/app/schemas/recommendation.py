"""Pydantic schemas for Recommendation and SafetyFlag."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class RecommendationResponse(BaseModel):
    id: str
    assessment_id: str
    user_id: int
    title: str
    description: str
    recommendation_type: str
    priority: str
    created_at: Optional[str]

    model_config = {"from_attributes": True}


class SafetyFlagResponse(BaseModel):
    id: str
    assessment_id: str
    user_id: int
    flag_type: str
    severity: str
    reason: Optional[str]
    resolved: int
    created_at: Optional[str]

    model_config = {"from_attributes": True}
