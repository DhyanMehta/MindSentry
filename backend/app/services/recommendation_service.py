"""
Rule-based recommendation engine.
Generates supportive (non-diagnostic) recommendations from score objects.
"""
from __future__ import annotations
from typing import List, Dict


def generate(
    assessment_id: str,
    user_id: int,
    scores: Dict,
) -> List[Dict]:
    """
    Return a list of recommendation dicts ready for DB insert.

    Priority tiers map to support_level / risk scores.
    """
    recs: List[Dict] = []
    risk = scores.get("final_risk_level", "low")
    stress = scores.get("stress_score", 0.0)
    mood = scores.get("mood_score", 0.5)
    crisis = scores.get("crisis_flag", 0)
    distress = scores.get("emotional_distress_score", 0.0)

    def _add(title, description, rec_type, priority):
        recs.append({
            "assessment_id": assessment_id,
            "user_id": user_id,
            "title": title,
            "description": description,
            "recommendation_type": rec_type,
            "priority": priority,
        })

    # ── Crisis response (always first if flagged) ──────────────
    if crisis:
        _add(
            "Reach Out for Support",
            "You may be going through a really difficult time. Please consider "
            "reaching out to a trusted person, a counsellor, or a crisis helpline. "
            "You don't have to face this alone.",
            "professional",
            "high",
        )

    # ── High stress ───────────────────────────────────────────
    if stress >= 0.65:
        _add(
            "Box Breathing Exercise",
            "Try box breathing: inhale for 4 counts, hold for 4, exhale for 4, "
            "hold for 4. Repeat 5 times. This activates the parasympathetic nervous system.",
            "breathing",
            "high" if stress >= 0.75 else "medium",
        )

    # ── Low mood ──────────────────────────────────────────────
    if mood <= 0.4:
        _add(
            "Journaling Prompt",
            "Take a few minutes to write down three small things you noticed today — "
            "they don't need to be positive. Journaling can help process emotions gently.",
            "journaling",
            "medium",
        )

    # ── General wellness ──────────────────────────────────────
    if distress >= 0.4:
        _add(
            "Hydration & Rest Check",
            "When we feel overwhelmed, basic needs are often the first to slip. "
            "Have you had enough water and rest today?",
            "rest",
            "medium",
        )

    # ── Social connection nudge ───────────────────────────────
    if risk in ("medium", "high") and not crisis:
        _add(
            "Connect with Someone",
            "Spending even a short time with a trusted friend or family member "
            "can provide relief. Consider a brief check-in call or message.",
            "social",
            "medium",
        )

    # ── Always include a general self-care tip ─────────────────
    _add(
        "Mindful Moment",
        "Pause for one minute. Notice five things you can see, four you can touch, "
        "three you can hear. This grounding technique can help reduce acute stress.",
        "breathing",
        "low",
    )

    return recs
