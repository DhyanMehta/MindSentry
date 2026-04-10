from __future__ import annotations

from app.services.graph.state import AssistantGraphState
from app.services.tools.wellness_tools import get_wellness_context, get_recent_wellness_trend


def wellness_context_node(state: AssistantGraphState, db) -> AssistantGraphState:
    context = get_wellness_context(db, state["user_id"])
    trend = get_recent_wellness_trend(db, state["user_id"])

    if "wellness_score" not in context:
        raise RuntimeError("WELLNESS_CONTEXT_INVALID: missing wellness_score")
    if "trend" not in trend:
        raise RuntimeError("WELLNESS_CONTEXT_INVALID: missing trend")
    if "recent_scores" not in trend:
        raise RuntimeError("WELLNESS_CONTEXT_INVALID: missing recent_scores")

    state["wellness_score"] = context["wellness_score"]
    state["wellness_trend"] = trend["trend"]
    state["recent_scores"] = trend["recent_scores"]
    state["audit_entries"].append(
        {
            "event": "wellness_context_loaded",
            "wellness_score": state["wellness_score"],
            "wellness_trend": state["wellness_trend"],
        }
    )
    return state
