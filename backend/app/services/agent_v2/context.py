from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from sqlmodel import Session, select

from app.models.analysis_result import AnalysisResult
from app.models.recommendation import Recommendation
from app.models.risk_score import RiskScore


def _score_to_percent(value: float | None) -> int | None:
    if value is None:
        return None
    return max(0, min(100, int(round(float(value) * 100))))


def _compute_wellness_score(result: AnalysisResult | None) -> int | None:
    if not result:
        return None
    stress_score = float(result.stress_score or 0.0)
    mood_score = float(result.mood_score or 0.0)
    return max(0, min(100, int(round(((1.0 - stress_score) * 0.45 + mood_score * 0.55) * 100.0))))


def get_user_score_data(db: Session, user_id: int) -> Dict[str, Any]:
    latest_analysis = db.exec(
        select(AnalysisResult)
        .where(AnalysisResult.user_id == user_id)
        .order_by(AnalysisResult.created_at.desc())
        .limit(1)
    ).first()

    if not latest_analysis:
        return {}

    latest_risk = db.exec(
        select(RiskScore).where(RiskScore.assessment_id == latest_analysis.assessment_id)
    ).first()
    recommendations: List[Recommendation] = db.exec(
        select(Recommendation)
        .where(Recommendation.assessment_id == latest_analysis.assessment_id)
        .where(Recommendation.user_id == user_id)
        .order_by(Recommendation.created_at.desc())
    ).all()

    wellness_score = _compute_wellness_score(latest_analysis)
    latest_timestamp = getattr(latest_analysis, "created_at", None)
    if isinstance(latest_timestamp, datetime):
        latest_timestamp = latest_timestamp.isoformat()

    return {
        "source": "score_lookup",
        "assessment_id": latest_analysis.assessment_id,
        "wellness_score": wellness_score,
        "stress_score": _score_to_percent(latest_analysis.stress_score),
        "mood_score": _score_to_percent(latest_analysis.mood_score),
        "distress_score": _score_to_percent(latest_analysis.emotional_distress_score),
        "text_emotion": latest_analysis.text_emotion,
        "audio_emotion": latest_analysis.audio_emotion,
        "video_emotion": latest_analysis.video_emotion,
        "risk_level": getattr(latest_risk, "final_risk_level", latest_analysis.support_level or "low"),
        "recommendations": [
            {
                "title": rec.title,
                "description": rec.description,
                "priority": rec.priority,
            }
            for rec in recommendations[:3]
        ],
        "created_at": latest_timestamp,
    }
