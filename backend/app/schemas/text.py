"""Pydantic schemas for TextEntry."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class TextEntryCreate(BaseModel):
    assessment_id: str
    raw_text: str
    language: str = "en"


class TextEntryResponse(BaseModel):
    id: str
    assessment_id: str
    user_id: int
    raw_text: Optional[str]
    language: Optional[str]
    word_count: Optional[int]
    sentiment_summary: Optional[str]
    created_at: Optional[str]

    model_config = {"from_attributes": True}
