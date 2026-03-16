"""
Safety service – keyword and signal-based crisis/distress flagging.

This is NOT a clinical system. Flags are informational signals only.
"""
from __future__ import annotations
from typing import List, Dict
from app.utils.constants import CRISIS_KEYWORDS, DISTRESS_KEYWORDS


def scan_text(text: str) -> Dict:
    """
    Scan free-text for crisis or distress signals.

    Returns:
        crisis_flag: bool  – true if crisis keywords found
        distress_flag: bool – true if distress keywords found
        matched_keywords: list of matched phrases
        severity: 'low' | 'medium' | 'high' | 'critical'
    """
    lower = text.lower()
    crisis_matches = [kw for kw in CRISIS_KEYWORDS if kw in lower]
    distress_matches = [kw for kw in DISTRESS_KEYWORDS if kw in lower]
    all_matches = crisis_matches + distress_matches

    crisis_flag = len(crisis_matches) > 0
    distress_flag = len(distress_matches) > 0

    if crisis_flag:
        severity = "critical" if len(crisis_matches) >= 2 else "high"
    elif distress_flag:
        severity = "high" if len(distress_matches) >= 3 else "medium"
    else:
        severity = "low"

    return {
        "crisis_flag": crisis_flag,
        "distress_flag": distress_flag,
        "matched_keywords": all_matches,
        "severity": severity,
    }


def build_safety_flags(
    assessment_id: str,
    user_id: int,
    scan_result: Dict,
) -> List[Dict]:
    """
    Convert a scan result into a list of safety flag dicts ready for DB insert.
    """
    flags = []
    if scan_result["crisis_flag"]:
        flags.append({
            "assessment_id": assessment_id,
            "user_id": user_id,
            "flag_type": "crisis_language",
            "severity": scan_result["severity"],
            "reason": "Crisis keywords detected: " + ", ".join(scan_result["matched_keywords"][:5]),
        })
    elif scan_result["distress_flag"]:
        flags.append({
            "assessment_id": assessment_id,
            "user_id": user_id,
            "flag_type": "severe_distress",
            "severity": scan_result["severity"],
            "reason": "Distress keywords detected: " + ", ".join(scan_result["matched_keywords"][:5]),
        })
    return flags
