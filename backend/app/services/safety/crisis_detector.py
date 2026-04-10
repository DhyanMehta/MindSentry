"""Crisis detection heuristics for high-risk language."""
from __future__ import annotations

from typing import Dict, Any


CRISIS_PHRASES = {
    "suicide",
    "kill myself",
    "end my life",
    "self harm",
    "hurt myself",
    "no reason to live",
    "want to die",
}

HIGH_RISK_PHRASES = {
    "i am unsafe",
    "i cannot go on",
    "panic attack",
    "hopeless",
    "severe distress",
}


class CrisisDetector:
    def detect(self, message: str, score_context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        text = (message or "").lower()
        score_context = score_context or {}
        score = float(score_context.get("wellness_score") or 50)

        crisis_match = [p for p in CRISIS_PHRASES if p in text]
        high_match = [p for p in HIGH_RISK_PHRASES if p in text]

        if crisis_match:
            return {
                "risk_level": "crisis",
                "trigger_terms": crisis_match,
                "requires_escalation": True,
                "safety_message": (
                    "I am really glad you reached out. You may be in immediate danger. "
                    "Please contact local emergency services now or a trusted person nearby."
                ),
            }

        if high_match or score < 25:
            return {
                "risk_level": "high",
                "trigger_terms": high_match,
                "requires_escalation": False,
                "safety_message": (
                    "It sounds like this is very heavy right now. If you are in immediate danger, "
                    "please contact emergency services right away."
                ),
            }

        if score < 45:
            return {
                "risk_level": "medium",
                "trigger_terms": [],
                "requires_escalation": False,
                "safety_message": "",
            }

        return {
            "risk_level": "low",
            "trigger_terms": [],
            "requires_escalation": False,
            "safety_message": "",
        }


_detector: CrisisDetector | None = None


def get_crisis_detector() -> CrisisDetector:
    global _detector
    if _detector is None:
        _detector = CrisisDetector()
    return _detector
