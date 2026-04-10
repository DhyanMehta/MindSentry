from __future__ import annotations

from app.services.graph.state import AssistantGraphState
from app.services.safety.crisis_detector import get_crisis_detector


def crisis_detection_node(state: AssistantGraphState) -> AssistantGraphState:
    detector = get_crisis_detector()
    result = detector.detect(
        state.get("user_message", ""),
        {"wellness_score": state.get("wellness_score")},
    )
    state["risk_level"] = result["risk_level"]
    state["audit_entries"].append({"event": "crisis_check", "result": result})

    if result["risk_level"] == "crisis":
        state["assistant_response"] = result["safety_message"]
        state["ui_payload"].append(
            {
                "type": "safety_escalation",
                "risk_level": "crisis",
                "message": result["safety_message"],
                "crisis_resources": [
                    "Contact local emergency services immediately.",
                    "Reach out to a trusted person near you right now.",
                ],
            }
        )

    return state
