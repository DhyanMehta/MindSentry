"""Pydantic schemas for questionnaires."""
from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel


class QuestionnaireTemplateResponse(BaseModel):
    id: str
    name: str
    code: str
    version: Optional[str]
    description: Optional[str]
    scoring_method: Optional[str]
    is_active: int

    model_config = {"from_attributes": True}


class QuestionnaireQuestionResponse(BaseModel):
    id: str
    template_id: str
    question_code: Optional[str]
    question_text: Optional[str]
    response_type: Optional[str]
    display_order: int
    is_required: int

    model_config = {"from_attributes": True}


class QuestionnaireResponseItemCreate(BaseModel):
    question_id: str
    answer_value: Optional[str] = None
    answer_text: Optional[str] = None
    scored_value: Optional[float] = None


class QuestionnaireResponseCreate(BaseModel):
    assessment_id: str
    template_id: str
    items: List[QuestionnaireResponseItemCreate]


class QuestionnaireResponseOut(BaseModel):
    id: str
    assessment_id: str
    template_id: str
    total_score: Optional[float]
    severity_band: Optional[str]
    submitted_at: Optional[str]

    model_config = {"from_attributes": True}
