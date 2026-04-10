"""Wellness context and safety-related assistant tools."""
from __future__ import annotations

from typing import Any, Dict

from sqlmodel import Session, select

from app.models.analysis_result import AnalysisResult
from app.models.risk_score import RiskScore
from app.models.assistant_models import UserAssistantPreference
from app.services.safety.crisis_detector import get_crisis_detector


def _derive_wellness_score(result: AnalysisResult) -> float | None:
    """Derive a normalized wellness score from available AnalysisResult fields."""
    mood_score = getattr(result, "mood_score", None)
    if mood_score is not None:
        return float(mood_score)

    distress_score = getattr(result, "emotional_distress_score", None)
    if distress_score is not None:
        # Higher distress should map to lower wellness.
        return max(0.0, min(1.0, 1.0 - float(distress_score)))

    return None


def get_wellness_context(db: Session, user_id: int) -> Dict[str, Any]:
    stmt = (
        select(AnalysisResult)
        .where(AnalysisResult.user_id == user_id)
        .order_by(AnalysisResult.created_at.desc())
        .limit(1)
    )
    latest = db.exec(stmt).first()
    if not latest:
        return {
            "wellness_score": 50.0,
            "support_level": "general",
            "confidence": 0.0,
            "updated_at": None,
        }
    wellness_score = _derive_wellness_score(latest)
    return {
        "wellness_score": wellness_score if wellness_score is not None else 50.0,
        "support_level": latest.support_level,
        "confidence": latest.confidence_score,
        "updated_at": latest.created_at,
    }


def get_recent_wellness_trend(db: Session, user_id: int) -> Dict[str, Any]:
    stmt = (
        select(AnalysisResult)
        .where(AnalysisResult.user_id == user_id)
        .order_by(AnalysisResult.created_at.desc())
        .limit(5)
    )
    rows = list(db.exec(stmt).all())
    if not rows:
        return {"trend": "stable", "recent_scores": []}
    scores = [score for score in (_derive_wellness_score(r) for r in rows) if score is not None]
    if len(scores) < 2:
        trend = "stable"
    else:
        trend = "improving" if scores[0] >= scores[-1] else "declining"

    return {"trend": trend, "recent_scores": scores}


def detect_crisis_risk(message: str, score_context: Dict[str, Any]) -> Dict[str, Any]:
    detector = get_crisis_detector()
    return detector.detect(message=message, score_context=score_context)


def get_user_saved_preferences(db: Session, user_id: int) -> Dict[str, Any]:
    pref = db.exec(select(UserAssistantPreference).where(UserAssistantPreference.user_id == user_id)).first()
    if not pref:
        raise RuntimeError("PREFERENCE_CONTEXT_MISSING: no saved assistant preferences found for this user")
    return {
        "preferred_radius_km": pref.preferred_radius_km,
        "preferred_specialty": pref.preferred_specialty,
        "timezone": pref.timezone,
        "allow_proactive_followups": pref.allow_proactive_followups,
    }


def summarize_wellness_support_options(user_id: int) -> Dict[str, Any]:
    raise RuntimeError("TOOL_NOT_IMPLEMENTED_DYNAMIC_DATA_REQUIRED: summarize_wellness_support_options")
