"""
Assessment CRUD router.

Endpoints:
  POST   /assessments/            – create a new assessment
  GET    /assessments/            – list user's assessments
  GET    /assessments/{id}        – get one assessment
  PATCH  /assessments/{id}        – update status / notes
  DELETE /assessments/{id}        – delete
"""
from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.assessment import Assessment
from app.schemas.assessment import AssessmentCreate, AssessmentUpdate, AssessmentResponse

router = APIRouter(prefix="/assessments", tags=["Assessments"])

VALID_SESSION_TYPES = {
    "checkin",
    "scheduled_assessment",
    "crisis_screen",
    "clinician_review",
}

SESSION_TYPE_ALIASES = {
    "capture": "checkin",
    "chat": "clinician_review",
}


def _normalize_session_type(value: Optional[str]) -> str:
    normalized = (value or "checkin").strip().lower()
    return SESSION_TYPE_ALIASES.get(normalized, normalized)


@router.post("/", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
def create_assessment(
    data: AssessmentCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    session_type = _normalize_session_type(data.session_type)
    if session_type not in VALID_SESSION_TYPES:
        allowed = ", ".join(sorted(VALID_SESSION_TYPES))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid session_type '{data.session_type}'. Allowed values: {allowed}.",
        )

    assessment = Assessment(
        user_id=current_user.id,
        session_type=session_type,
        notes=data.notes,
    )
    session.add(assessment)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment payload.",
        )
    session.refresh(assessment)
    return assessment


@router.get("/", response_model=List[AssessmentResponse])
def list_assessments(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    results = session.exec(
        select(Assessment).where(Assessment.user_id == current_user.id)
    ).all()
    return results


@router.get("/{assessment_id}", response_model=AssessmentResponse)
def get_assessment(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    obj = session.get(Assessment, assessment_id)
    if not obj or obj.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return obj


@router.patch("/{assessment_id}", response_model=AssessmentResponse)
def update_assessment(
    assessment_id: str,
    data: AssessmentUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    obj = session.get(Assessment, assessment_id)
    if not obj or obj.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assessment(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    obj = session.get(Assessment, assessment_id)
    if not obj or obj.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    session.delete(obj)
    session.commit()
