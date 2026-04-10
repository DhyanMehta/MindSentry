from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlmodel import Session, select

from app.models.analysis_result import AnalysisResult
from app.models.assistant_models import ChatMessage, UserAssistantPreference
from app.models.recommendation import Recommendation
from app.models.risk_score import RiskScore
from app.models.user_profile import UserProfile
from app.services.safety.crisis_detector import get_crisis_detector
from app.services.tools.appointment_tools import create_appointment_request
from app.services.tools.clinic_tools import find_nearby_clinics
from app.services.tools.reminder_tools import create_followup_reminder


COORD_REGEX = re.compile(r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)")
CLINIC_ACTION_REGEX = re.compile(
    r"\[clinic_search\]\s+latitude=(?P<latitude>-?\d+(?:\.\d+)?)\s+longitude=(?P<longitude>-?\d+(?:\.\d+)?)"
    r"(?:\s+specialty=(?P<specialty>[^\s]+))?(?:\s+radius_km=(?P<radius>\d+(?:\.\d+)?))?",
    re.IGNORECASE,
)
APPOINTMENT_ACTION_REGEX = re.compile(
    r"\[appointment_request\]\s+clinic_id=(?P<clinic_id>[^\s]+)\s+preferred_datetime=(?P<datetime>[^\s]+)"
    r"(?:\s+notes=(?P<notes>.*))?",
    re.IGNORECASE,
)
REMINDER_ACTION_REGEX = re.compile(
    r"\[reminder_request\]\s+title=(?P<title>.+?)\s+remind_at=(?P<datetime>[^\s]+)(?:\s+context=(?P<context>.*))?$",
    re.IGNORECASE,
)
GREETING_REGEX = re.compile(r"^(hi|hello|hey|namaste|good morning|good afternoon|good evening)\b", re.IGNORECASE)
FOLLOWUP_REGEX = re.compile(
    r"\b(this|that|it|these|those)\b|^(why|what does that mean|is that bad|how so|what should i do for this)\b",
    re.IGNORECASE,
)


def _parse_iso_datetime(datetime_text: str) -> tuple[str, str]:
    parsed = datetime.fromisoformat(datetime_text)
    return parsed.date().isoformat(), parsed.time().replace(microsecond=0).isoformat()


def _score_to_percent(value: Optional[float]) -> Optional[int]:
    if value is None:
        return None
    return max(0, min(100, int(round(float(value) * 100))))


def _compute_wellness_score(result: Optional[AnalysisResult]) -> Optional[int]:
    if not result:
        return None
    stress_score = float(result.stress_score or 0.0)
    mood_score = float(result.mood_score or 0.0)
    return max(0, min(100, int(round(((1.0 - stress_score) * 0.45 + mood_score * 0.55) * 100.0))))


def _trend_label(analyses: List[AnalysisResult]) -> str:
    if len(analyses) < 2:
        return "stable"

    latest = _compute_wellness_score(analyses[0])
    earliest = _compute_wellness_score(analyses[-1])
    if latest is None or earliest is None:
        return "stable"
    if latest > earliest:
        return "improving"
    if latest < earliest:
        return "declining"
    return "stable"


def _clean_message_text(message: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (message or "")).strip()


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _unique_nonempty(values: List[str]) -> List[str]:
    return sorted({value for value in values if value})


class GroundedAssistantService:
    """
    Active retrieval-first assistant.

    The previous graph-based assistant remains in the repo but is intentionally not used
    by the active chat route anymore.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def load_context_bundle(self, user_id: int) -> Dict[str, Any]:
        analyses = self.db.exec(
            select(AnalysisResult)
            .where(AnalysisResult.user_id == user_id)
            .order_by(AnalysisResult.created_at.desc())
            .limit(5)
        ).all()
        latest_analysis = analyses[0] if analyses else None

        latest_risk = None
        recommendations: List[Recommendation] = []
        if latest_analysis:
            latest_risk = self.db.exec(
                select(RiskScore).where(RiskScore.assessment_id == latest_analysis.assessment_id)
            ).first()
            recommendations = self.db.exec(
                select(Recommendation)
                .where(Recommendation.assessment_id == latest_analysis.assessment_id)
                .where(Recommendation.user_id == user_id)
            ).all()

        profile = self.db.exec(select(UserProfile).where(UserProfile.user_id == user_id)).first()
        preferences = self.db.exec(
            select(UserAssistantPreference).where(UserAssistantPreference.user_id == user_id)
        ).first()

        return {
            "latest_analysis": latest_analysis,
            "latest_risk": latest_risk,
            "recent_analyses": list(analyses),
            "recommendations": recommendations,
            "profile": profile,
            "preferences": preferences,
            "wellness_score": _compute_wellness_score(latest_analysis),
            "trend": _trend_label(list(analyses)),
        }

    def detect_risk(self, message: str, context: Dict[str, Any]) -> str:
        score_context = {"wellness_score": context.get("wellness_score", 50)}
        detector_result = get_crisis_detector().detect(message=message, score_context=score_context)
        if detector_result["risk_level"] == "crisis":
            return "crisis"

        latest_risk = context.get("latest_risk")
        if latest_risk and getattr(latest_risk, "final_risk_level", None):
            return str(latest_risk.final_risk_level)
        return detector_result["risk_level"]

    def handle_information_message(self, message: str, user_id: int) -> Dict[str, Any]:
        context = self.load_context_bundle(user_id)
        risk_level = self.detect_risk(message, context)

        if risk_level == "crisis":
            crisis_message = (
                "I’m really glad you reached out. You may need urgent support right now. "
                "Please contact local emergency services or a trusted person nearby immediately."
            )
            return {
                "response": crisis_message,
                "risk_level": "crisis",
                "requires_consent": False,
                "consent_status": "not_required",
                "selected_tool": None,
                "tool_execution_status": None,
                "ui_payload": [
                    {
                        "type": "safety_escalation",
                        "risk_level": "crisis",
                        "message": crisis_message,
                        "crisis_resources": [
                            "Call local emergency services if you are in immediate danger.",
                            "Reach out to a trusted person near you right now.",
                        ],
                    }
                ],
                "used_data": [],
                "warnings": ["Crisis language detected from your message."],
                "suggested_actions": ["Seek immediate human support."],
                "audit_entries": [{"event": "grounded_information_crisis"}],
            }

        latest_analysis = context["latest_analysis"]
        latest_risk = context["latest_risk"]
        recommendations = context["recommendations"]
        message_lower = message.lower()
        used_data: List[str] = []
        warnings: List[str] = []
        suggested_actions: List[str] = []

        if not latest_analysis:
            return {
                "response": (
                    "I do not have any completed wellness analysis for you yet. "
                    "Please complete a check-in first, and then I can explain your scores, emotions, and recommendations."
                ),
                "risk_level": risk_level,
                "requires_consent": False,
                "consent_status": "not_required",
                "selected_tool": None,
                "tool_execution_status": None,
                "ui_payload": [],
                "used_data": [],
                "warnings": ["No completed wellness analysis found."],
                "suggested_actions": ["Complete a new check-in to generate your latest wellness data."],
                "audit_entries": [{"event": "grounded_information_no_data"}],
            }

        wellness_score = context["wellness_score"]
        stress_percent = _score_to_percent(latest_analysis.stress_score)
        mood_percent = _score_to_percent(latest_analysis.mood_score)
        distress_percent = _score_to_percent(latest_analysis.emotional_distress_score)
        text_emotion = latest_analysis.text_emotion or "not available"
        audio_emotion = latest_analysis.audio_emotion or "not available"
        video_emotion = latest_analysis.video_emotion or "not available"
        trend = context["trend"]
        risk_text = getattr(latest_risk, "final_risk_level", risk_level)

        response_parts: List[str] = []

        if any(keyword in message_lower for keyword in ("score", "wellness", "summary", "snapshot", "how am i")):
            used_data.extend(["wellness_score", "stress_score", "mood_score", "risk_level"])
            response_parts.append(
                f"Your latest wellness score is {wellness_score}/100. "
                f"Your latest stress score is {stress_percent if stress_percent is not None else 'not available'}%, "
                f"your mood score is {mood_percent if mood_percent is not None else 'not available'}%, "
                f"and your current recorded risk level is {risk_text}."
            )

        if any(keyword in message_lower for keyword in ("stress", "mood", "emotion", "feel", "distress")):
            used_data.extend(["stress_score", "mood_score", "emotions"])
            response_parts.append(
                f"The latest analysis shows text emotion as {text_emotion}, audio emotion as {audio_emotion}, "
                f"video emotion as {video_emotion}, and emotional distress at "
                f"{distress_percent if distress_percent is not None else 'not available'}%."
            )

        if any(keyword in message_lower for keyword in ("trend", "history", "improve", "better", "recommend", "advice", "what should i do")):
            used_data.extend(["trend", "recommendations"])
            if recommendations:
                top_recommendations = recommendations[:3]
                rec_text = "; ".join(
                    f"{rec.title}: {rec.description}" for rec in top_recommendations if rec.title and rec.description
                )
                response_parts.append(
                    f"Your recent wellness trend looks {trend}. Based on your latest recommendations, here are the most relevant next steps: {rec_text}."
                )
                suggested_actions.extend([rec.title for rec in top_recommendations if rec.title])
            else:
                response_parts.append(
                    f"Your recent wellness trend looks {trend}. I do not have stored recommendations for your latest assessment yet, "
                    "so the safest next step is to complete a fresh check-in and review the updated results."
                )
                warnings.append("No stored recommendations found for the latest assessment.")

        if any(keyword in message_lower for keyword in ("clinic", "doctor", "appointment", "book")):
            response_parts.append(
                "For clinic search or appointment help, please use the clinic finder flow so I can ask for location permission and show verified nearby clinics."
            )
            suggested_actions.append("Open the clinic finder to search for nearby clinics.")

        if not response_parts:
            used_data.extend(["wellness_score", "risk_level", "recommendations"])
            response_parts.append(
                f"I can explain your stored wellness results and recommendations. "
                f"Right now, your latest wellness score is {wellness_score}/100 and your recorded risk level is {risk_text}."
            )
            if recommendations:
                titles = ", ".join(rec.title for rec in recommendations[:3] if rec.title)
                if titles:
                    response_parts.append(f"Your latest recommendation focus areas are: {titles}.")
                    suggested_actions.extend([rec.title for rec in recommendations[:3] if rec.title])
            response_parts.append(
                "You can ask me about your score, stress, mood, emotions, recent trend, or what steps may help improve your wellness."
            )

        if latest_analysis.confidence_score is not None and float(latest_analysis.confidence_score) < 0.45:
            warnings.append("Your latest analysis confidence is relatively low, so treat this as supportive guidance, not a diagnosis.")

        return {
            "response": " ".join(part for part in response_parts if part),
            "risk_level": risk_level,
            "requires_consent": False,
            "consent_status": "not_required",
            "selected_tool": None,
            "tool_execution_status": None,
            "ui_payload": [],
            "used_data": sorted(set(used_data)),
            "warnings": warnings,
            "suggested_actions": suggested_actions[:5],
            "audit_entries": [{"event": "grounded_information_answer", "used_data": sorted(set(used_data))}],
        }

    def load_recent_history(
        self,
        *,
        session_id: Optional[str],
        current_message: Optional[str] = None,
        limit: int = 8,
    ) -> List[Dict[str, str]]:
        if not session_id:
            return []

        rows = self.db.exec(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        ).all()

        current_clean = _clean_message_text(current_message).lower()
        history: List[Dict[str, str]] = []
        for row in reversed(list(rows)):
            cleaned = _clean_message_text(row.message)
            if not cleaned:
                continue
            if row.role == "user" and current_clean and cleaned.lower() == current_clean:
                continue
            history.append({"role": row.role, "message": cleaned})
        return history

    def _detect_intent(self, *, message: str, history: List[Dict[str, str]]) -> str:
        message_lower = message.lower()
        word_count = len(message_lower.split())

        if GREETING_REGEX.search(message_lower) and word_count <= 8 and not _contains_any(
            message_lower, ("score", "stress", "mood", "trend", "clinic", "appointment")
        ):
            return "greeting"

        if _contains_any(message_lower, ("clinic", "doctor", "appointment", "book", "nearby", "reminder")):
            return "clinic_or_action_request"

        if FOLLOWUP_REGEX.search(message_lower) and history:
            return "clarification_followup"

        if _contains_any(message_lower, ("score", "wellness score", "risk level", "result", "snapshot")):
            return "score_explanation"

        if _contains_any(message_lower, ("trend", "history", "getting better", "improving", "declining", "change")):
            return "trend_or_change_question"

        if _contains_any(message_lower, ("what should i do", "how can i improve", "improve", "recommend", "advice", "next step")):
            return "recommendation_or_next_step"

        if _contains_any(
            message_lower,
            ("stress", "mood", "emotion", "feel", "feeling", "anxious", "sad", "overwhelmed", "distress"),
        ):
            return "emotion_or_symptom_question"

        return "general_wellness_question"

    def _infer_topic(self, text: str) -> Optional[str]:
        lowered = text.lower()
        if _contains_any(lowered, ("stress", "anxiety", "anxious", "distress", "overwhelmed")):
            return "stress"
        if _contains_any(lowered, ("mood", "emotion", "feel", "sad", "happy", "angry")):
            return "mood"
        if _contains_any(lowered, ("score", "wellness", "risk level", "result", "snapshot")):
            return "score"
        if _contains_any(lowered, ("trend", "history", "better", "worse", "change")):
            return "trend"
        if _contains_any(lowered, ("recommend", "advice", "what should i do", "next step", "improve")):
            return "recommendation"
        if _contains_any(lowered, ("clinic", "doctor", "appointment", "book")):
            return "clinic"
        return None

    def _resolve_followup_topic(self, history: List[Dict[str, str]]) -> Optional[str]:
        for item in reversed(history):
            topic = self._infer_topic(item["message"])
            if topic:
                return topic
        return None

    def _no_data_response(self, intent: str) -> Dict[str, Any]:
        if intent == "greeting":
            return {
                "response": (
                    "Hello. I am ArogyaAI. I can help explain your wellness scores, patterns, and supportive next steps. "
                    "Once you complete a check-in, I can ground my answers in your latest results."
                ),
                "used_data": [],
                "warnings": [],
                "suggested_actions": ["Complete a new check-in if you want a grounded wellness review."],
                "answer_topic": None,
            }

        return {
            "response": (
                "I do not have any completed wellness analysis for you yet, so I cannot answer that from your stored results. "
                "Please complete a check-in first, and then I can explain your scores, emotions, trend, and next supportive steps."
            ),
            "used_data": [],
            "warnings": ["No completed wellness analysis found."],
            "suggested_actions": ["Complete a new check-in to generate your latest wellness data."],
            "answer_topic": None,
        }

    def _build_greeting_response(self, has_data: bool) -> Dict[str, Any]:
        response = "Hello. I am ArogyaAI. I can help explain your wellness scores, recent patterns, and practical next steps."
        if has_data:
            response += " You can ask what your latest score means, why stress changed, or what may help next."
        else:
            response += " Once you complete a check-in, I can ground my answers in your latest results."
        return {
            "response": response,
            "used_data": [],
            "warnings": [],
            "suggested_actions": ["Ask about your score, stress, mood, or trend." if has_data else "Complete a new check-in."],
            "answer_topic": None,
        }

    def _build_score_response(self, context: Dict[str, Any], risk_text: str) -> Dict[str, Any]:
        latest_analysis = context["latest_analysis"]
        wellness_score = context["wellness_score"]
        stress_percent = _score_to_percent(latest_analysis.stress_score)
        mood_percent = _score_to_percent(latest_analysis.mood_score)
        return {
            "response": (
                f"Your latest wellness score is {wellness_score}/100. "
                f"Your stress score is {stress_percent if stress_percent is not None else 'not available'}%, "
                f"your mood score is {mood_percent if mood_percent is not None else 'not available'}%, "
                f"and your current recorded risk level is {risk_text}. "
                "This is supportive wellness information, not a diagnosis."
            ),
            "used_data": ["wellness_score", "stress_score", "mood_score", "risk_level"],
            "warnings": [],
            "suggested_actions": ["Ask if you want me to explain what is driving that score."],
            "answer_topic": "score",
        }

    def _build_emotion_response(self, context: Dict[str, Any]) -> Dict[str, Any]:
        latest_analysis = context["latest_analysis"]
        stress_percent = _score_to_percent(latest_analysis.stress_score)
        mood_percent = _score_to_percent(latest_analysis.mood_score)
        distress_percent = _score_to_percent(latest_analysis.emotional_distress_score)
        return {
            "response": (
                f"Your latest results suggest stress at {stress_percent if stress_percent is not None else 'not available'}% "
                f"and mood at {mood_percent if mood_percent is not None else 'not available'}%. "
                f"The recorded emotions are text: {latest_analysis.text_emotion or 'not available'}, "
                f"audio: {latest_analysis.audio_emotion or 'not available'}, and "
                f"video: {latest_analysis.video_emotion or 'not available'}. "
                f"Emotional distress is {distress_percent if distress_percent is not None else 'not available'}%. "
                "If you want, I can explain which part matters most or what small step may help next."
            ),
            "used_data": ["stress_score", "mood_score", "emotions", "emotional_distress_score"],
            "warnings": [],
            "suggested_actions": ["Ask what may help with stress or mood next."],
            "answer_topic": "stress",
        }

    def _build_recommendation_response(self, context: Dict[str, Any], topic: Optional[str]) -> Dict[str, Any]:
        recommendations = context["recommendations"]
        trend = context["trend"]
        if recommendations:
            top_recommendations = recommendations[:3]
            rec_lines = [
                f"{index + 1}. {rec.title}: {rec.description}"
                for index, rec in enumerate(top_recommendations)
                if rec.title and rec.description
            ]
            intro = "Here are the most relevant next steps from your latest recommendations."
            if topic == "stress":
                intro = "For the stress we were discussing, these are the most relevant next steps from your latest recommendations."
            elif topic == "mood":
                intro = "For the mood pattern we were discussing, these are the most relevant next steps from your latest recommendations."
            elif topic == "score":
                intro = "To improve the overall score we were discussing, these are the most relevant next steps from your latest recommendations."
            return {
                "response": f"{intro} {' '.join(rec_lines)} Your recent wellness trend looks {trend}.",
                "used_data": ["recommendations", "trend"],
                "warnings": [],
                "suggested_actions": [rec.title for rec in top_recommendations if rec.title][:3],
                "answer_topic": topic or "recommendation",
            }

        return {
            "response": (
                f"I do not have stored recommendations for your latest assessment yet. "
                f"Your recent wellness trend looks {trend}, so the safest next step is to complete a fresh check-in and review the updated guidance."
            ),
            "used_data": ["trend"],
            "warnings": ["No stored recommendations found for the latest assessment."],
            "suggested_actions": ["Complete a fresh check-in for updated guidance."],
            "answer_topic": topic or "recommendation",
        }

    def _build_trend_response(self, context: Dict[str, Any]) -> Dict[str, Any]:
        analyses = context["recent_analyses"]
        latest_score = context["wellness_score"]
        previous_score = _compute_wellness_score(analyses[1]) if len(analyses) > 1 else None

        if previous_score is not None and latest_score is not None:
            if latest_score > previous_score:
                change_text = f"Your latest score moved up from {previous_score}/100 to {latest_score}/100."
            elif latest_score < previous_score:
                change_text = f"Your latest score moved down from {previous_score}/100 to {latest_score}/100."
            else:
                change_text = f"Your latest score stayed the same at {latest_score}/100."
        else:
            change_text = f"Your recent wellness trend looks {context['trend']}."

        return {
            "response": (
                f"{change_text} Based on your recent analyses, the overall pattern looks {context['trend']}. "
                "If you want, I can break down whether stress, mood, or recommendations are contributing most."
            ),
            "used_data": ["trend", "wellness_score", "history"],
            "warnings": [],
            "suggested_actions": ["Ask why the trend changed or what may help improve it."],
            "answer_topic": "trend",
        }

    def _build_general_response(self, context: Dict[str, Any], risk_text: str) -> Dict[str, Any]:
        return {
            "response": (
                "I can help with that. "
                f"Your latest recorded wellness score is {context['wellness_score']}/100 and your recent trend looks {context['trend']}. "
                "Tell me whether you want help understanding the score, the stress and mood signals, or what supportive next step may help."
            ),
            "used_data": ["wellness_score", "trend", "risk_level"],
            "warnings": [],
            "suggested_actions": ["Ask about your score, stress, mood, or next steps."],
            "answer_topic": "general_wellness",
        }

    def _build_clarification_response(self, context: Dict[str, Any], topic: Optional[str], risk_text: str) -> Dict[str, Any]:
        if topic in {"stress", "mood"}:
            return self._build_recommendation_response(context, topic)
        if topic == "score":
            return {
                "response": (
                    f"That means your latest wellness score reflects a mix of stress, mood, and overall risk context. "
                    f"Right now your recorded risk level is {risk_text}, so the score should be used as a supportive check-in signal rather than a medical judgment. "
                    "If you want, I can also explain what part of the score seems to matter most."
                ),
                "used_data": ["wellness_score", "risk_level", "stress_score", "mood_score"],
                "warnings": [],
                "suggested_actions": ["Ask what is driving the score or what may help improve it."],
                "answer_topic": "score",
            }
        if topic == "trend":
            return {
                "response": (
                    f"It means the recent pattern looks {context['trend']} based on your latest recorded analyses. "
                    "This is a supportive trend summary, not a diagnosis. I can also explain what may be pushing it up or down."
                ),
                "used_data": ["trend", "history"],
                "warnings": [],
                "suggested_actions": ["Ask why the trend changed or what to do next."],
                "answer_topic": "trend",
            }
        return self._build_general_response(context, risk_text)

    def handle_information_message(
        self,
        message: str,
        user_id: int,
        *,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        context = self.load_context_bundle(user_id)
        risk_level = self.detect_risk(message, context)
        history = self.load_recent_history(session_id=session_id, current_message=message)
        intent = self._detect_intent(message=message, history=history)

        if risk_level == "crisis":
            crisis_message = (
                "I am really glad you reached out. You may need urgent support right now. "
                "Please contact local emergency services or a trusted person nearby immediately."
            )
            return {
                "response": crisis_message,
                "risk_level": "crisis",
                "requires_consent": False,
                "consent_status": "not_required",
                "selected_tool": None,
                "tool_execution_status": None,
                "ui_payload": [
                    {
                        "type": "safety_escalation",
                        "risk_level": "crisis",
                        "message": crisis_message,
                        "crisis_resources": [
                            "Call local emergency services if you are in immediate danger.",
                            "Reach out to a trusted person near you right now.",
                        ],
                    }
                ],
                "used_data": [],
                "warnings": ["Crisis language detected from your message."],
                "suggested_actions": ["Seek immediate human support."],
                "answer_intent": "crisis_or_high_risk",
                "answer_topic": None,
                "audit_entries": [{"event": "grounded_information_crisis"}],
            }

        latest_analysis = context["latest_analysis"]
        if not latest_analysis:
            payload = self._no_data_response(intent)
            return {
                "response": payload["response"],
                "risk_level": risk_level,
                "requires_consent": False,
                "consent_status": "not_required",
                "selected_tool": None,
                "tool_execution_status": None,
                "ui_payload": [],
                "used_data": payload["used_data"],
                "warnings": payload["warnings"],
                "suggested_actions": payload["suggested_actions"],
                "answer_intent": intent,
                "answer_topic": payload["answer_topic"],
                "audit_entries": [{"event": "grounded_information_no_data", "intent": intent}],
            }

        latest_risk = context["latest_risk"]
        risk_text = getattr(latest_risk, "final_risk_level", risk_level)
        followup_topic = self._resolve_followup_topic(history) if intent == "clarification_followup" else None

        if intent == "greeting":
            payload = self._build_greeting_response(True)
        elif intent == "score_explanation":
            payload = self._build_score_response(context, risk_text)
        elif intent == "emotion_or_symptom_question":
            payload = self._build_emotion_response(context)
        elif intent == "recommendation_or_next_step":
            payload = self._build_recommendation_response(context, self._infer_topic(message) or followup_topic)
        elif intent == "trend_or_change_question":
            payload = self._build_trend_response(context)
        elif intent == "clarification_followup":
            payload = self._build_clarification_response(context, followup_topic, risk_text)
        elif intent == "clinic_or_action_request":
            payload = {
                "response": (
                    "For clinic search, appointment help, or reminders, please use the clinic flow so I can ask for approval before taking action."
                ),
                "used_data": [],
                "warnings": [],
                "suggested_actions": ["Open the clinic finder if you want to continue with a clinic-related action."],
                "answer_topic": "clinic",
            }
        else:
            payload = self._build_general_response(context, risk_text)

        warnings = list(payload["warnings"])
        if latest_analysis.confidence_score is not None and float(latest_analysis.confidence_score) < 0.45:
            warnings.append(
                "Your latest analysis confidence is relatively low, so treat this as supportive guidance, not a diagnosis."
            )

        return {
            "response": payload["response"],
            "risk_level": risk_level,
            "requires_consent": False,
            "consent_status": "not_required",
            "selected_tool": None,
            "tool_execution_status": None,
            "ui_payload": [],
            "used_data": _unique_nonempty(payload["used_data"]),
            "warnings": warnings,
            "suggested_actions": payload["suggested_actions"][:5],
            "answer_intent": intent,
            "answer_topic": payload["answer_topic"],
            "audit_entries": [
                {
                    "event": "grounded_information_answer",
                    "intent": intent,
                    "topic": payload["answer_topic"],
                    "used_data": _unique_nonempty(payload["used_data"]),
                }
            ],
        }

    def detect_action_request(self, message: str) -> Optional[Dict[str, Any]]:
        clinic_match = CLINIC_ACTION_REGEX.search(message)
        if clinic_match:
            specialty = clinic_match.group("specialty")
            return {
                "tool_name": "find_nearby_clinics",
                "tool_input": {
                    "latitude": float(clinic_match.group("latitude")),
                    "longitude": float(clinic_match.group("longitude")),
                    "specialty": None if not specialty or specialty == "none" else specialty.replace("_", " "),
                    "radius": float(clinic_match.group("radius") or 10.0),
                },
                "reason": "This uses your location to find nearby clinics and needs your approval first.",
            }

        appointment_match = APPOINTMENT_ACTION_REGEX.search(message)
        if appointment_match:
            preferred_date, preferred_time = _parse_iso_datetime(appointment_match.group("datetime"))
            notes = (appointment_match.group("notes") or "").strip() or None
            return {
                "tool_name": "create_appointment_request",
                "tool_input": {
                    "clinic_id": appointment_match.group("clinic_id"),
                    "preferred_date": preferred_date,
                    "preferred_time": preferred_time,
                    "notes": notes,
                },
                "reason": "This creates an internal appointment request and needs your approval first.",
            }

        reminder_match = REMINDER_ACTION_REGEX.search(message)
        if reminder_match:
            return {
                "tool_name": "create_followup_reminder",
                "tool_input": {
                    "title": reminder_match.group("title").strip(),
                    "datetime": reminder_match.group("datetime").strip(),
                    "context": (reminder_match.group("context") or "").strip() or None,
                },
                "reason": "This creates a follow-up reminder and needs your approval first.",
            }

        lowered = message.lower()
        if any(keyword in lowered for keyword in ("clinic", "doctor", "hospital", "nearby")):
            coord_match = COORD_REGEX.search(message)
            if coord_match:
                return {
                    "tool_name": "find_nearby_clinics",
                    "tool_input": {
                        "latitude": float(coord_match.group(1)),
                        "longitude": float(coord_match.group(2)),
                        "specialty": None,
                        "radius": 10.0,
                    },
                    "reason": "This uses your location to find nearby clinics and needs your approval first.",
                }
        return None

    def execute_action(self, tool_name: str, user_id: int, session_id: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        if tool_name == "find_nearby_clinics":
            return find_nearby_clinics(
                self.db,
                user_id,
                session_id,
                float(tool_input["latitude"]),
                float(tool_input["longitude"]),
                float(tool_input.get("radius", 10.0)),
                tool_input.get("specialty"),
            )
        if tool_name == "create_appointment_request":
            return create_appointment_request(
                self.db,
                user_id,
                tool_input["clinic_id"],
                tool_input["preferred_date"],
                tool_input["preferred_time"],
                tool_input.get("notes"),
                session_id=session_id,
            )
        if tool_name == "create_followup_reminder":
            return create_followup_reminder(
                self.db,
                user_id,
                tool_input["title"],
                tool_input["datetime"],
                tool_input.get("context"),
                session_id=session_id,
            )
        raise ValueError(f"Unsupported tool: {tool_name}")

    def build_action_followup(
        self,
        tool_name: str,
        tool_output: Dict[str, Any],
        consent_status: str,
    ) -> Dict[str, Any]:
        if consent_status == "denied":
            return {
                "response": "Okay, I did not continue with that action.",
                "ui_payload": [],
                "warnings": [],
                "suggested_actions": [],
            }

        if tool_output.get("error"):
            return {
                "response": "I could not complete that action successfully.",
                "ui_payload": [],
                "warnings": [str(tool_output.get("error"))],
                "suggested_actions": ["Please try again or adjust the request details."],
            }

        if tool_name == "find_nearby_clinics":
            clinics = tool_output.get("clinics") or []
            warning = tool_output.get("warning")
            if clinics:
                response = f"I found {len(clinics)} nearby clinics and listed them below."
            else:
                response = warning or "I could not find any nearby clinics from the available verified provider data."
            return {
                "response": response,
                "ui_payload": [{"type": "clinic_cards", "clinics": clinics}],
                "warnings": [warning] if warning else [],
                "suggested_actions": ["Choose a clinic if you want to request an appointment."] if clinics else [],
            }

        if tool_name == "create_appointment_request":
            response = (
                f"I created your internal appointment request for clinic {tool_output.get('clinic_id')}. "
                f"The requested time is {tool_output.get('preferred_date')} at {tool_output.get('preferred_time')}."
            )
            reminder_datetime = f"{tool_output.get('preferred_date')}T{tool_output.get('preferred_time')}"
            return {
                "response": response,
                "ui_payload": [
                    {
                        "type": "reminder_prompt",
                        "title": "Appointment follow-up reminder",
                        "suggested_datetime": reminder_datetime,
                        "context": f"Appointment request {tool_output.get('appointment_request_id')}",
                    }
                ],
                "warnings": ["This is an internal appointment request, not a confirmed live booking."],
                "suggested_actions": ["If you want, I can also create a reminder for this appointment request."],
            }

        if tool_name == "create_followup_reminder":
            response = (
                f"I created a reminder titled \"{tool_output.get('title')}\" for {tool_output.get('remind_at')}."
            )
            return {
                "response": response,
                "ui_payload": [],
                "warnings": [],
                "suggested_actions": [],
            }

        return {
            "response": "I completed that action.",
            "ui_payload": [],
            "warnings": [],
            "suggested_actions": [],
        }
