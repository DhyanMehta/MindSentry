"""
MindSentry Chatbot Service — unified LLM-powered assistant.

Replaces the fragmented grounded_assistant_service + agent_v2 pipeline with
a single coherent flow:
  1. Crisis detection (fast keyword check — runs BEFORE LLM)
  2. Intent classification (LLM JSON mode)
  3. Tool execution (clinic search, appointment booking, emergency)
  4. Response generation (LLM with injected wellness context)

All wellness data is fetched from the DB and injected into the prompt.
The LLM never invents scores or results.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlmodel import Session, select

from app.core.config import get_settings
from app.models.analysis_result import AnalysisResult
from app.models.assistant_models import (
    ChatMessage,
    ChatSession,
    CrisisFlag,
    WellnessContextSnapshot,
)
from app.models.recommendation import Recommendation
from app.models.risk_score import RiskScore
from app.models.user import User
from app.services.llm.llm_client import chat_completion, chat_completion_json
from app.services.safety.crisis_detector import get_crisis_detector
from app.services.tools.clinic_tools import find_nearby_clinics
from app.services.tools.appointment_tools import create_appointment_request
from app.services.tools.emergency_tools import get_emergency_info

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Helpers ────────────────────────────────────────────────────────────────

def _score_to_percent(value: Optional[float]) -> Optional[int]:
    if value is None:
        return None
    return max(0, min(100, int(round(float(value) * 100))))


def _compute_wellness_score(result: Optional[AnalysisResult]) -> Optional[int]:
    if not result:
        return None
    stress = float(result.stress_score or 0.0)
    mood = float(result.mood_score or 0.0)
    return max(0, min(100, int(round(((1.0 - stress) * 0.45 + mood * 0.55) * 100.0))))


def _uuid() -> str:
    import uuid
    return uuid.uuid4().hex


# ─── Prompts ────────────────────────────────────────────────────────────────

INTENT_SYSTEM_PROMPT = """You are an intent classifier for ArogyaAI, a mental health wellness assistant app.

Given the user's message and recent conversation history, classify the intent.

Available intents:
- "greeting": User is saying hi, hello, good morning, etc.
- "general_chat": General conversation, small talk, questions about the app
- "wellness_query": User asks about their wellness scores, stress, mood, check-in results, trends
- "health_concern": User describes health symptoms, feelings, seeks health advice
- "clinic_search": User wants to find nearby clinics, hospitals, doctors, therapists
- "book_appointment": User wants to book/schedule an appointment at a specific clinic
- "emergency_call": User explicitly asks to call emergency services or a helpline
- "crisis": User expresses suicidal thoughts, self-harm, or extreme distress

Rules:
- If the user mentions wanting to hurt themselves, dying, or suicide → ALWAYS return "crisis"
- If the user asks to find clinics/doctors/hospitals → return "clinic_search"
- If the user wants to book/schedule with a specific clinic → return "book_appointment"
- If the user asks about their scores/results/progress → return "wellness_query"
- If the user describes symptoms or how they feel → return "health_concern"
- Detect distress level from the message tone and content

Return ONLY valid JSON:
{
  "intent": "<one of the intents above>",
  "distress_level": "none" | "mild" | "moderate" | "severe",
  "needs_wellness_data": true | false,
  "reasoning": "<brief explanation>"
}"""

RESPONSE_SYSTEM_PROMPT = """You are ArogyaAI, a warm and empathetic mental health wellness assistant.

Core rules:
1. Be warm, caring, and concise — like a trusted friend who also understands mental health.
2. ONLY use the wellness data provided below. NEVER invent, fabricate, or guess scores, dates, or results.
3. If no wellness data is available, honestly tell the user you don't have any data yet and suggest completing a check-in.
4. NEVER diagnose. You provide supportive guidance only. Always recommend professional help for serious concerns.
5. If the user seems distressed, gently acknowledge their feelings and suggest talking to a professional.
6. For clinic search results: present them clearly with name, address, and distance.
7. For appointment confirmations: confirm the details back to the user.
8. Keep responses under 200 words unless the user asks for detail.
9. Use natural conversational language, not clinical jargon.
10. If the user just greets you, greet them back warmly and ask how they're doing."""

CRISIS_RESPONSE = (
    "I hear you, and I'm really glad you reached out. What you're going through sounds incredibly hard, "
    "and you deserve support right now.\n\n"
    "Please reach out to a crisis helpline immediately — they are trained to help with exactly this:\n\n"
    "🔴 **{service_name}: {number}**\n\n"
    "You can also reach out to a trusted person near you. "
    "You are not alone, and help is available right now."
)


# ─── Main Service ───────────────────────────────────────────────────────────

class ChatbotService:
    """Unified chatbot service for the MindSentry assistant."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Public entry point ──────────────────────────────────────────────

    def handle_message(
        self,
        *,
        user_id: int,
        message: str,
        session_id: Optional[str] = None,
        location: Optional[Dict[str, float]] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process a user message and return the chatbot response.

        This is the single entry point — it orchestrates:
        1. Session management
        2. Crisis detection
        3. Intent classification
        4. Wellness context loading
        5. Tool execution
        6. Response generation
        7. Message persistence
        """
        # Step 0: Get or create session
        session = self._get_or_create_session(user_id, session_id)
        session_id = session.id

        # Persist user message
        self._save_message(session_id, user_id, "user", message)

        # Step 1: Crisis check (fast, runs BEFORE LLM)
        wellness_context = self._load_wellness_context(user_id)
        crisis_result = self._check_crisis(message, wellness_context, user_id, session_id)
        if crisis_result:
            self._save_message(session_id, user_id, "assistant", crisis_result["response"])
            return crisis_result

        # Step 2: Load conversation history
        history = self._load_conversation_history(session_id, limit=settings.assistant_recent_message_limit)

        # Step 3: Classify intent via LLM
        intent_data, intent_provider = self._classify_intent(message, history)
        logger.info(
            "chatbot intent user_id=%s intent=%s distress=%s provider=%s",
            user_id, intent_data.get("intent"), intent_data.get("distress_level"), intent_provider,
        )

        # Step 4: Load wellness data if needed
        if intent_data.get("needs_wellness_data"):
            # Already loaded above
            pass

        # Step 5: Execute tool if the intent requires one
        tool_result = None
        ui_payloads: List[Dict[str, Any]] = []

        intent = intent_data.get("intent", "general_chat")

        if intent == "clinic_search":
            tool_result, ui_payloads = self._handle_clinic_search(
                user_id, session_id, message, location
            )

        elif intent == "book_appointment":
            tool_result, ui_payloads = self._handle_appointment(
                user_id, session_id, message, history
            )

        elif intent == "emergency_call":
            tool_result, ui_payloads = self._handle_emergency(user_id, session_id)

        # Step 6: Generate response via LLM
        response_text, response_provider = self._generate_response(
            message=message,
            intent_data=intent_data,
            wellness_context=wellness_context,
            tool_result=tool_result,
            history=history,
        )

        # Step 7: Handle moderate/severe distress detected by LLM
        distress_level = intent_data.get("distress_level", "none")
        if distress_level in ("moderate", "severe") and intent != "emergency_call":
            emergency_info = get_emergency_info(self.db, user_id, session_id)
            ui_payloads.append(emergency_info["ui_payload"])

        # Step 8: Persist assistant response and update session
        self._save_message(
            session_id, user_id, "assistant", response_text,
            ui_payload={"items": ui_payloads} if ui_payloads else None,
        )
        self._update_session(session, response_text)

        return {
            "session_id": session_id,
            "response": response_text,
            "ui_payload": ui_payloads,
            "intent": intent,
            "distress_level": distress_level,
            "llm_provider": response_provider,
            "source": source,
        }

    # ── Session management ──────────────────────────────────────────────

    def _get_or_create_session(self, user_id: int, session_id: Optional[str]) -> ChatSession:
        if session_id:
            existing = self.db.exec(
                select(ChatSession).where(
                    ChatSession.id == session_id,
                    ChatSession.user_id == user_id,
                )
            ).first()
            if existing:
                return existing

        now = datetime.now(timezone.utc)
        session = ChatSession(
            user_id=user_id,
            title="ArogyaAI Chat",
            last_message_at=now,
            updated_at=now,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def _update_session(self, session: ChatSession, last_response: str) -> None:
        now = datetime.now(timezone.utc)
        session.last_message_at = now
        session.updated_at = now
        session.conversation_summary = last_response[:500]
        self.db.add(session)
        self.db.commit()

    def _save_message(
        self,
        session_id: str,
        user_id: int,
        role: str,
        content: str,
        *,
        ui_payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        msg = ChatMessage(
            session_id=session_id,
            user_id=user_id,
            role=role,
            message=content,
            ui_payload=ui_payload,
        )
        self.db.add(msg)
        self.db.commit()

    # ── Conversation history ────────────────────────────────────────────

    def _load_conversation_history(
        self, session_id: str, *, limit: int = 8
    ) -> List[Dict[str, str]]:
        rows = self.db.exec(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit + 1)  # +1 because the latest user message was just saved
        ).all()

        history = []
        for row in reversed(list(rows)):
            content = (row.message or "").strip()
            if content:
                history.append({"role": row.role, "content": content})

        # Remove the very last user message (it's the current one, not history)
        if history and history[-1]["role"] == "user":
            history = history[:-1]

        return history

    # ── Wellness context ────────────────────────────────────────────────

    def _load_wellness_context(self, user_id: int) -> Dict[str, Any]:
        """Load real wellness data from the database."""
        analyses = self.db.exec(
            select(AnalysisResult)
            .where(AnalysisResult.user_id == user_id)
            .order_by(AnalysisResult.created_at.desc())
            .limit(5)
        ).all()

        if not analyses:
            return {"has_data": False}

        latest = analyses[0]
        wellness_score = _compute_wellness_score(latest)

        # Get risk score
        risk_row = self.db.exec(
            select(RiskScore).where(RiskScore.assessment_id == latest.assessment_id)
        ).first()
        risk_level = getattr(risk_row, "final_risk_level", "low") if risk_row else "low"

        # Get recommendations
        recs = self.db.exec(
            select(Recommendation)
            .where(
                Recommendation.assessment_id == latest.assessment_id,
                Recommendation.user_id == user_id,
            )
            .limit(3)
        ).all()

        # Build trend
        trend = "stable"
        if len(analyses) >= 2:
            prev_score = _compute_wellness_score(analyses[1])
            if wellness_score is not None and prev_score is not None:
                if wellness_score > prev_score:
                    trend = "improving"
                elif wellness_score < prev_score:
                    trend = "declining"

        return {
            "has_data": True,
            "wellness_score": wellness_score,
            "stress_score": _score_to_percent(latest.stress_score),
            "mood_score": _score_to_percent(latest.mood_score),
            "emotional_distress": _score_to_percent(latest.emotional_distress_score),
            "text_emotion": latest.text_emotion or "not available",
            "audio_emotion": latest.audio_emotion or "not available",
            "video_emotion": latest.video_emotion or "not available",
            "risk_level": risk_level,
            "trend": trend,
            "check_in_date": str(latest.created_at)[:19] if latest.created_at else "unknown",
            "recommendations": [
                {"title": r.title, "description": r.description}
                for r in recs
                if r.title and r.description
            ],
            "recent_scores": [
                {
                    "date": str(a.created_at)[:19] if a.created_at else "unknown",
                    "wellness": _compute_wellness_score(a),
                    "stress": _score_to_percent(a.stress_score),
                    "mood": _score_to_percent(a.mood_score),
                }
                for a in analyses[:5]
            ],
        }

    def _format_wellness_for_prompt(self, ctx: Dict[str, Any]) -> str:
        """Format wellness context as a clean text block for the LLM prompt."""
        if not ctx.get("has_data"):
            return "No wellness data available. The user has not completed any check-ins yet."

        parts = [
            f"Latest check-in: {ctx.get('check_in_date', 'unknown')}",
            f"Wellness score: {ctx.get('wellness_score', 'N/A')}/100",
            f"Stress: {ctx.get('stress_score', 'N/A')}%",
            f"Mood: {ctx.get('mood_score', 'N/A')}%",
            f"Emotional distress: {ctx.get('emotional_distress', 'N/A')}%",
            f"Text emotion: {ctx.get('text_emotion', 'N/A')}",
            f"Audio emotion: {ctx.get('audio_emotion', 'N/A')}",
            f"Video emotion: {ctx.get('video_emotion', 'N/A')}",
            f"Risk level: {ctx.get('risk_level', 'N/A')}",
            f"Trend: {ctx.get('trend', 'N/A')}",
        ]

        recs = ctx.get("recommendations", [])
        if recs:
            parts.append("Top recommendations:")
            for i, r in enumerate(recs, 1):
                parts.append(f"  {i}. {r['title']}: {r['description']}")

        recent = ctx.get("recent_scores", [])
        if len(recent) > 1:
            parts.append("Recent score history:")
            for s in recent:
                parts.append(f"  {s['date']}: wellness={s['wellness']}/100, stress={s['stress']}%, mood={s['mood']}%")

        return "\n".join(parts)

    # ── Crisis detection ────────────────────────────────────────────────

    def _check_crisis(
        self,
        message: str,
        wellness_context: Dict[str, Any],
        user_id: int,
        session_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Run keyword-based crisis detection. Returns response dict if crisis detected."""
        score_context = {"wellness_score": wellness_context.get("wellness_score", 50)}
        detector = get_crisis_detector()
        result = detector.detect(message=message, score_context=score_context)

        if result["risk_level"] != "crisis":
            return None

        # Get emergency info for the user
        emergency_info = get_emergency_info(self.db, user_id, session_id)

        # Build crisis response
        response_text = CRISIS_RESPONSE.format(
            service_name=emergency_info["service_name"],
            number=emergency_info["emergency_number"],
        )

        # Log crisis flag
        try:
            flag = CrisisFlag(
                user_id=user_id,
                session_id=session_id,
                risk_level="crisis",
                trigger_message=message,
                detector_output=result,
                escalation_message=response_text,
            )
            self.db.add(flag)
            self.db.commit()
        except Exception as exc:
            logger.warning("Failed to log crisis flag: %s", exc)

        return {
            "session_id": session_id,
            "response": response_text,
            "ui_payload": [
                emergency_info["ui_payload"],
                {
                    "type": "safety_escalation",
                    "risk_level": "crisis",
                    "message": response_text,
                    "crisis_resources": [
                        f"Call {emergency_info['service_name']}: {emergency_info['emergency_number']}",
                        "Reach out to a trusted person near you right now.",
                    ],
                },
            ],
            "intent": "crisis",
            "distress_level": "severe",
            "llm_provider": None,
            "source": None,
        }

    # ── Intent classification ───────────────────────────────────────────

    def _classify_intent(
        self,
        message: str,
        history: List[Dict[str, str]],
    ) -> Tuple[Dict[str, Any], str]:
        """Classify user intent via LLM (JSON mode)."""
        history_text = ""
        if history:
            history_lines = []
            for h in history[-4:]:  # Last 4 messages for context
                role_label = "User" if h["role"] == "user" else "Assistant"
                history_lines.append(f"{role_label}: {h['content'][:200]}")
            history_text = "\n".join(history_lines)

        user_prompt = f"""Recent conversation history:
{history_text or "(no previous messages)"}

Current user message:
{message}"""

        try:
            result, provider = chat_completion_json(
                messages=[
                    {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
            )
            # Validate required fields
            if "intent" not in result:
                result["intent"] = "general_chat"
            if "distress_level" not in result:
                result["distress_level"] = "none"
            if "needs_wellness_data" not in result:
                result["needs_wellness_data"] = False
            return result, provider
        except Exception as exc:
            logger.error("Intent classification failed: %s", exc)
            # Safe fallback: treat as general chat
            return {
                "intent": "general_chat",
                "distress_level": "none",
                "needs_wellness_data": False,
                "reasoning": f"Fallback due to error: {exc}",
            }, "fallback"

    # ── Tool handlers ───────────────────────────────────────────────────

    def _handle_clinic_search(
        self,
        user_id: int,
        session_id: str,
        message: str,
        location: Optional[Dict[str, float]],
    ) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        """Search for nearby clinics using Google Places."""
        if not location or "latitude" not in location or "longitude" not in location:
            return (
                {"status": "need_location", "message": "I need your location to search for nearby clinics."},
                [{"type": "location_request", "message": "Please share your location so I can find clinics near you."}],
            )

        try:
            result = find_nearby_clinics(
                self.db,
                user_id=user_id,
                session_id=session_id,
                latitude=float(location["latitude"]),
                longitude=float(location["longitude"]),
                radius=10.0,
                specialty="mental health clinic",
            )
            clinics = result.get("clinics", [])
            ui_payloads = []
            if clinics:
                ui_payloads.append({"type": "clinic_cards", "clinics": clinics})
            return result, ui_payloads
        except Exception as exc:
            logger.error("Clinic search failed: %s", exc)
            return {"status": "error", "message": str(exc)}, []

    def _handle_appointment(
        self,
        user_id: int,
        session_id: str,
        message: str,
        history: List[Dict[str, str]],
    ) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Handle appointment booking.

        The LLM will extract clinic and datetime info from the conversation context.
        If not enough info, we ask the user to provide it.
        """
        # Try to extract appointment details from the message using LLM
        extraction_prompt = f"""Extract appointment booking details from this conversation.

Recent conversation (may contain clinic search results):
{json.dumps(history[-6:], indent=2) if history else "No history"}

Current message:
{message}

Return JSON with these fields (use null if not found):
{{
  "clinic_id": "the place_id or clinic identifier",
  "clinic_name": "name of the clinic",
  "preferred_date": "YYYY-MM-DD format",
  "preferred_time": "HH:MM:SS format",
  "notes": "any notes from the user"
}}"""

        try:
            extracted, _ = chat_completion_json(
                messages=[
                    {"role": "system", "content": "You extract structured data from conversations. Return only valid JSON."},
                    {"role": "user", "content": extraction_prompt},
                ],
                temperature=0.1,
            )

            clinic_id = extracted.get("clinic_id")
            preferred_date = extracted.get("preferred_date")
            preferred_time = extracted.get("preferred_time")

            if not clinic_id or not preferred_date or not preferred_time:
                return (
                    {
                        "status": "need_details",
                        "missing": [
                            f for f in ["clinic_id", "preferred_date", "preferred_time"]
                            if not extracted.get(f)
                        ],
                    },
                    [],
                )

            result = create_appointment_request(
                self.db,
                user_id=user_id,
                clinic_id=clinic_id,
                preferred_date=preferred_date,
                preferred_time=preferred_time,
                notes=extracted.get("notes"),
                session_id=session_id,
            )
            return result, []

        except Exception as exc:
            logger.error("Appointment extraction/booking failed: %s", exc)
            return {"status": "error", "message": str(exc)}, []

    def _handle_emergency(
        self,
        user_id: int,
        session_id: str,
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """Provide emergency contact information."""
        emergency_info = get_emergency_info(self.db, user_id, session_id)
        return emergency_info, [emergency_info["ui_payload"]]

    # ── Response generation ─────────────────────────────────────────────

    def _generate_response(
        self,
        *,
        message: str,
        intent_data: Dict[str, Any],
        wellness_context: Dict[str, Any],
        tool_result: Optional[Dict[str, Any]],
        history: List[Dict[str, str]],
    ) -> Tuple[str, str]:
        """Generate the final chatbot response via LLM."""
        wellness_text = self._format_wellness_for_prompt(wellness_context)

        # Build the context sections
        context_parts = [f"## User's Wellness Data\n{wellness_text}"]

        if tool_result:
            context_parts.append(f"## Tool Execution Result\n{json.dumps(tool_result, indent=2, default=str)}")

        intent = intent_data.get("intent", "general_chat")
        distress = intent_data.get("distress_level", "none")

        # Add intent-specific guidance
        if intent == "clinic_search":
            if tool_result and tool_result.get("status") == "need_location":
                context_parts.append(
                    "## Important\nThe user hasn't shared their location yet. "
                    "Ask them to enable location sharing so you can search for clinics near them."
                )
            elif tool_result and tool_result.get("clinics"):
                clinics = tool_result["clinics"]
                context_parts.append(
                    f"## Clinic Results\nFound {len(clinics)} clinics. "
                    "Present them clearly. The frontend will render clinic cards — "
                    "you should summarize the top results and ask if they want to book an appointment."
                )
        elif intent == "book_appointment":
            if tool_result and tool_result.get("status") == "need_details":
                missing = tool_result.get("missing", [])
                context_parts.append(
                    f"## Important\nCould not book yet. Missing: {', '.join(missing)}. "
                    "Ask the user to provide these details."
                )
            elif tool_result and tool_result.get("appointment_request_id"):
                context_parts.append(
                    "## Appointment Booked\nThe appointment request was created successfully. "
                    "Confirm the details to the user."
                )
        elif intent == "emergency_call":
            if tool_result:
                context_parts.append(
                    f"## Emergency Info\nEmergency number: {tool_result.get('emergency_number')}. "
                    f"Service: {tool_result.get('service_name')}. "
                    "The frontend will show a call button. Be supportive and caring."
                )

        if distress in ("moderate", "severe"):
            context_parts.append(
                "## DISTRESS DETECTED\n"
                f"Distress level: {distress}. Be extra gentle and empathetic. "
                "Gently suggest professional help. The frontend will show emergency contact options."
            )

        context_block = "\n\n".join(context_parts)

        # Build messages
        messages_for_llm: List[Dict[str, str]] = [
            {"role": "system", "content": RESPONSE_SYSTEM_PROMPT + f"\n\n{context_block}"},
        ]

        # Add conversation history
        for h in history[-4:]:
            messages_for_llm.append({
                "role": h["role"] if h["role"] in ("user", "assistant") else "assistant",
                "content": h["content"][:500],
            })

        # Add current message
        messages_for_llm.append({"role": "user", "content": message})

        try:
            response_text, provider = chat_completion(
                messages_for_llm,
                json_mode=False,
                temperature=0.4,
            )
            return response_text.strip(), provider
        except Exception as exc:
            logger.error("Response generation failed: %s", exc)
            # Safe fallback
            if intent == "greeting":
                return "Hello! I'm ArogyaAI, your wellness companion. How are you feeling today?", "fallback"
            return (
                "I'm having a bit of trouble right now, but I'm still here for you. "
                "Could you try again in a moment?",
                "fallback",
            )
