from __future__ import annotations

from fastapi import HTTPException, status
from sqlmodel import Session

from app.models.assessment import Assessment
from app.models.user import User


def get_user_assessment_or_404(session: Session, assessment_id: str, current_user: User) -> Assessment:
    assessment = session.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return assessment
