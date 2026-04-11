from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import desc
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


def _serialize_analysis(row: AnalysisResult, latest_risk: RiskScore | None = None) -> Dict[str, Any]:
    return {
        "assessment_id": row.assessment_id,
        "date": row.created_at,
        "wellness_score": _compute_wellness_score(row),
        "stress_score": _score_to_percent(row.stress_score),
        "mood_score": _score_to_percent(row.mood_score),
        "distress_score": _score_to_percent(row.emotional_distress_score),
        "text_emotion": row.text_emotion,
        "audio_emotion": row.audio_emotion,
        "video_emotion": row.video_emotion,
        "risk_level": getattr(latest_risk, "final_risk_level", row.support_level or "low"),
    }


def _serialize_recommendation(rec: Recommendation) -> Dict[str, Any]:
    return {
        "title": rec.title,
        "description": rec.description,
        "priority": rec.priority,
    }


def get_user_score_data(db: Session, user_id: int) -> Dict[str, Any]:
    analyses: List[AnalysisResult] = db.exec(
        select(AnalysisResult)
        .where(AnalysisResult.user_id == user_id)
        .order_by(desc(AnalysisResult.created_at))
        .limit(5)
    ).all()

    latest_analysis = analyses[0] if analyses else None

    if not latest_analysis:
        return {
            "has_scores": False,
            "score_count": 0,
            "latest_analysis": None,
            "recent_scores": [],
            "recommendations": [],
        }

    latest_risk = db.exec(
        select(RiskScore).where(RiskScore.assessment_id == latest_analysis.assessment_id)
    ).first()
    recommendations: List[Recommendation] = db.exec(
        select(Recommendation)
        .where(Recommendation.assessment_id == latest_analysis.assessment_id)
        .where(Recommendation.user_id == user_id)
        .order_by(Recommendation.created_at.desc())
    ).all()

    latest_timestamp = getattr(latest_analysis, "created_at", None)
    if isinstance(latest_timestamp, datetime):
        latest_timestamp = latest_timestamp.isoformat()

    latest_analysis_payload = _serialize_analysis(latest_analysis, latest_risk)
    recent_scores = [_serialize_analysis(row, latest_risk) for row in analyses]
    recommendations_payload = [_serialize_recommendation(rec) for rec in recommendations[:3]]

    return {
        "source": "score_lookup",
        "has_scores": True,
        "score_count": len(analyses),
        "latest_analysis": latest_analysis_payload,
        "recent_scores": recent_scores,
        "recommendations": recommendations_payload,
        "created_at": latest_timestamp,
    }
