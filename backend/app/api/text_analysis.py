"""
Text entry + analysis router.

Endpoints:
  POST /text/submit   – submit text for an assessment, runs analysis immediately
  GET  /text/{assessment_id} – get text entry for an assessment
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.assessment import Assessment
from app.models.text_entry import TextEntry
from app.models.extracted_feature import ExtractedFeature
from app.models.safety_flag import SafetyFlag
from app.schemas.text import TextEntryCreate, TextEntryResponse
from app.services.text_service import analyse_text
from app.services.safety_service import scan_text, build_safety_flags
import json

router = APIRouter(prefix="/text", tags=["Text Analysis"])


@router.post("/submit", response_model=TextEntryResponse, status_code=status.HTTP_201_CREATED)
def submit_text(
    data: TextEntryCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Validate assessment belongs to user
    assessment = session.get(Assessment, data.assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    # Run text analysis
    result = analyse_text(data.raw_text)

    # Persist text entry
    entry = TextEntry(
        assessment_id=data.assessment_id,
        user_id=current_user.id,
        raw_text=data.raw_text,
        language=data.language,
        word_count=result["word_count"],
        sentiment_summary=result["sentiment_summary"],
    )
    session.add(entry)

    # Persist extracted features
    feature = ExtractedFeature(
        assessment_id=data.assessment_id,
        modality_type="text",
        feature_namespace="emotion",
        feature_json=json.dumps(result),
        extractor_name="j-hartmann/emotion-english-distilroberta-base",
        extractor_version="1.0",
    )
    session.add(feature)

    # Safety scan
    scan = scan_text(data.raw_text)
    for flag_data in build_safety_flags(data.assessment_id, current_user.id, scan):
        session.add(SafetyFlag(**flag_data))

    session.commit()
    session.refresh(entry)
    return entry


@router.get("/{assessment_id}", response_model=TextEntryResponse)
def get_text_entry(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    entry = session.exec(
        select(TextEntry)
        .where(TextEntry.assessment_id == assessment_id)
        .where(TextEntry.user_id == current_user.id)
    ).first()
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Text entry not found")
    return entry
