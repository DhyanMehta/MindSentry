"""
History / trend router.

Endpoints:
  GET /history/assessments        – paginated assessment list with results
  GET /history/trend              – last-N risk scores for trend chart
  GET /history/summary            – aggregate stats for current user
"""
from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.assessment import Assessment
from app.models.analysis_result import AnalysisResult
from app.models.risk_score import RiskScore
from app.schemas.assessment import AssessmentResponse
from app.schemas.analysis import AnalysisResultResponse, RiskScoreResponse

router = APIRouter(prefix="/history", tags=["History"])


@router.get("/assessments", response_model=List[AssessmentResponse])
def assessment_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(Assessment)
        .where(Assessment.user_id == current_user.id)
        .order_by(Assessment.started_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()


@router.get("/trend", response_model=List[RiskScoreResponse])
def risk_trend(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return the last N risk scores ordered by assessment date for trend charts."""
    scores = session.exec(
        select(RiskScore)
        .where(RiskScore.user_id == current_user.id)
        .order_by(RiskScore.id.desc())
        .limit(limit)
    ).all()
    return list(reversed(scores))


@router.get("/summary")
def summary(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    assessments = session.exec(
        select(Assessment).where(Assessment.user_id == current_user.id)
    ).all()
    completed = [a for a in assessments if a.status == "completed"]
    results = session.exec(
        select(AnalysisResult).where(AnalysisResult.user_id == current_user.id)
    ).all()

    avg_stress = (
        round(sum(r.stress_score or 0 for r in results) / len(results), 3)
        if results else None
    )
    avg_mood = (
        round(sum(r.mood_score or 0 for r in results) / len(results), 3)
        if results else None
    )

    return {
        "total_assessments": len(assessments),
        "completed_assessments": len(completed),
        "avg_stress_score": avg_stress,
        "avg_mood_score": avg_mood,
        "crisis_events": sum(1 for r in results if r.crisis_flag),
    }
