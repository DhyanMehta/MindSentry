from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

class ChatPromptTemplate:
    def __init__(self, messages):
        self._messages = messages

    @classmethod
    def from_messages(cls, messages):
        return cls(messages)

    def format_messages(self, **kwargs):
        formatted = []
        for role, template in self._messages:
            content = template.format(**kwargs)
            formatted.append({"role": "user" if role == "human" else role, "content": content})
        return formatted

from app.services.agent_v2.context import get_user_score_data
from app.services.agent_v2.context_preparation import prepare_llm_context
from app.services.agent_v2.conversation_memory import (
    add_assistant_message,
    add_user_message,
    build_memory_context,
    derive_memory_signals,
    get_memory_key,
    get_recent_history,
)
from app.services.agent_v2.health_safety import (
    detect_severity,
    build_health_response_with_safety,
    should_include_score_context_in_health_response,
    validate_health_response_quality,
)
from app.services.agent_v2.llm import safe_llm_invoke
from app.services.agent_v2.response_normalizer import normalize_response_payload
from app.services.agent_v2.state import ChatAgentState


AGENT_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are an intelligent health assistant.

Rules:
- Answer ONLY based on the user query.
- Use provided context ONLY if relevant.
- Do NOT inject unrelated score or data.
- Provide actionable health advice when needed.
- If the user explicitly asks for score/check-in details, you may use the provided context.
""",
        ),
        (
            "human",
            """User Query:
{query}

Context:
{context}
""",
        ),
    ]
)


def _safe_json_loads(raw_text: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(raw_text[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    return {"intent": "GENERAL", "needs_score": False}


_TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:'[a-z0-9]+)?", re.IGNORECASE)

_SCORE_TOKENS = {
    "score",
    "scores",
    "result",
    "results",
    "history",
    "report",
    "reports",
    "metric",
    "metrics",
    "progress",
    "trend",
    "risk",
    "snapshot",
    "summary",
}

_HEALTH_TOKENS = {
    "health",
    "feel",
    "feeling",
    "sick",
    "pain",
    "exercise",
    "fever",
    "headache",
    "anxiety",
    "panic",
    "stress",
    "sleep",
    "diet",
    "workout",
    "unwell",
    "nausea",
    "tired",
}

_GREETING_TOKENS = {"hi", "hello", "hey", "namaste"}

_ANALYSIS_PHRASES = {
    ("what", "do", "you", "think"),
    ("what", "do", "you", "suggest"),
    ("why",),
    ("explain",),
    ("opinion",),
    ("analyze",),
    ("analysis",),
    ("how", "come"),
}

_SOURCE_SCORE_OVERRIDES = {"scores_tab", "score-tab", "history-result", "fresh-checkin"}


def _tokenize(query: str) -> list[str]:
    return [token.lower() for token in _TOKEN_PATTERN.findall(query or "")]


def _contains_any_token(tokens: list[str], candidates: set[str]) -> bool:
    return any(token in candidates for token in tokens)


def _contains_phrase(tokens: list[str], phrase: tuple[str, ...]) -> bool:
    if not phrase:
        return False
    if len(phrase) == 1:
        return phrase[0] in tokens
    window_size = len(phrase)
    for index in range(len(tokens) - window_size + 1):
        if tuple(tokens[index : index + window_size]) == phrase:
            return True
    return False


def _detect_intent_deterministic(query: str, source: Optional[str]) -> Dict[str, Any]:
    tokens = _tokenize(query)
    source_value = (source or "").strip().lower()

    score_signal = _contains_any_token(tokens, _SCORE_TOKENS)
    health_signal = _contains_any_token(tokens, _HEALTH_TOKENS)
    greeting_signal = _contains_any_token(tokens, _GREETING_TOKENS)

    analytical_signal = any(_contains_phrase(tokens, phrase) for phrase in _ANALYSIS_PHRASES)
    # Broader analysis cue for questions like "what do you think about..." or "why is this happening?"
    if not analytical_signal:
        analytical_signal = any(token in {"why", "explain", "think", "suggest", "opinion", "analyze"} for token in tokens)

    secondary_signals: list[str] = []

    if score_signal:
        intent = "SCORE_QUERY"
    elif health_signal:
        intent = "HEALTH_QUERY"
    elif greeting_signal:
        intent = "GREETING"
    else:
        intent = "GENERAL"
    if intent != "SCORE_QUERY" and score_signal:
        secondary_signals.append("SCORE_QUERY")
    if intent != "HEALTH_QUERY" and health_signal:
        secondary_signals.append("HEALTH_QUERY")
    if intent != "GREETING" and greeting_signal:
        secondary_signals.append("GREETING")
    if analytical_signal:
        secondary_signals.append("ANALYSIS")

    needs_score = score_signal or source_value in _SOURCE_SCORE_OVERRIDES
    requires_analysis = analytical_signal or (score_signal and health_signal)

    return {
        "intent": intent,
        "needs_score": needs_score,
        "requires_analysis": requires_analysis,
        "secondary_signals": secondary_signals,
        "source_forced_score": source_value in _SOURCE_SCORE_OVERRIDES,
        "provider": "deterministic",
    }


# ============================================================================
# STRUCTURED LOGGING FOR OBSERVABILITY
# ============================================================================

def _log_intent_stage(intent_data: Dict[str, Any], user_id: Any) -> None:
    """Log intent classification results."""
    print(f"[INTENT] user_id={user_id}")
    print(f"[INTENT] primary_intent={intent_data.get('intent')}")
    print(f"[INTENT] secondary_signals={intent_data.get('secondary_signals', [])}")
    print(f"[INTENT] requires_analysis={intent_data.get('requires_analysis')}")


def _log_context_stage(context_fetched: bool, context_layers: Optional[Dict[str, Any]]) -> None:
    """Log context building results."""
    if context_layers is None:
        context_layers = {}
    
    layers_included = []
    if context_layers.get("recent_scores"):
        layers_included.append("recent_scores")
    if context_layers.get("latest_analysis"):
        layers_included.append("latest_analysis")
    if context_layers.get("recommendations"):
        layers_included.append("recommendations")
    
    print(f"[CONTEXT] context_fetched={context_fetched}")
    print(f"[CONTEXT] layers_included={layers_included}")
    print(f"[CONTEXT] has_scores={context_layers.get('has_scores', False)}")


def _log_memory_stage(memory_key: str, memory_history: list[Dict[str, Any]], memory_signals: Dict[str, Any]) -> None:
    """Log short-term memory state without exposing raw content."""
    print(f"[MEMORY] key={memory_key}")
    print(f"[MEMORY] history_count={len(memory_history)}")
    print(f"[MEMORY] is_follow_up={memory_signals.get('is_follow_up', False)}")
    print(f"[MEMORY] emotional_tone={memory_signals.get('emotional_tone', 'neutral')}")
    print(f"[MEMORY] ongoing_topic={memory_signals.get('ongoing_topic', 'general')}")


def _log_response_stage(handler_name: str, llm_invoked: bool) -> None:
    """Log response handler execution."""
    print(f"[RESPONSE] handler={handler_name}")
    print(f"[RESPONSE] llm_invoked={llm_invoked}")


def _log_final_output(response_type: str, llm_provider: Optional[str]) -> None:
    """Log final response type and origin."""
    print(f"[OUTPUT] type={response_type}")
    if llm_provider:
        print(f"[OUTPUT] llm_provider={llm_provider}")


def _build_memory_context_for_state(state: ChatAgentState) -> Dict[str, Any]:
    history = state.get("memory_history") or []
    signals = state.get("memory_signals") or {}
    return build_memory_context(history, signals)


def _debug_state(state: ChatAgentState) -> None:
    print("---- DEBUG ----")
    print("QUERY:", state.get("input"))
    print("INTENT:", state.get("intent_data"))
    print("CONTEXT:", state.get("context"))
    print("----------------")


def intent_reasoning_node(state: ChatAgentState) -> ChatAgentState:
    query = (state.get("input") or "").strip()
    session_id = state.get("session_id")
    memory_key = get_memory_key(state.get("user_id"), session_id)
    memory_history = get_recent_history(memory_key)
    memory_signals = derive_memory_signals(memory_history, query)

    intent_data = _detect_intent_deterministic(query, state.get("source"))

    # Memory enriches interpretation metadata but never overrides deterministic intent.
    intent_data["memory_follow_up"] = memory_signals.get("is_follow_up", False)
    intent_data["memory_emotional_tone"] = memory_signals.get("emotional_tone", "neutral")
    intent_data["memory_topic"] = memory_signals.get("ongoing_topic", "general")
    
    # Log intent classification
    _log_intent_stage(intent_data, state.get("user_id"))
    _log_memory_stage(memory_key, memory_history, memory_signals)

    _debug_state({**state, "intent": intent_data, "intent_data": intent_data})
    return {
        **state,
        "intent": intent_data,
        "intent_data": intent_data,
        "memory_key": memory_key,
        "memory_history": memory_history,
        "memory_signals": memory_signals,
        "llm_provider": intent_data["provider"],
    }


def context_builder_node(state: ChatAgentState, db) -> ChatAgentState:
    intent_data = state.get("intent") or state.get("intent_data") or {}
    needs_score = intent_data.get("needs_score") is True

    context: Optional[Dict[str, Any]] = None
    context_fetched = False
    
    if needs_score:
        context = get_user_score_data(db, state["user_id"])
        if context and context.get("has_scores"):
            context_fetched = True
        else:
            context = None
    
    # Log context stage
    _log_context_stage(context_fetched, context)

    memory_context = _build_memory_context_for_state(state)

    _debug_state({**state, "intent": intent_data, "context": context})
    return {
        **state,
        "intent": intent_data,
        "intent_data": intent_data,
        "context": context,
        "memory_context": memory_context,
    }


def format_scores(scores: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    formatted: list[Dict[str, Any]] = []
    for s in scores:
        formatted.append(
            {
                "date": s.get("created_at"),
                "wellness": s.get("wellness_score"),
                "stress": s.get("stress_score"),
                "mood": s.get("mood_score"),
                "risk": s.get("risk_level"),
            }
        )
    return formatted


def _summarize_scores(scores: list[Dict[str, Any]]) -> str:
    if not scores:
        return "I could not find recent score history yet. Please complete a few check-ins first."

    parts = []
    for item in scores[:5]:
        date_value = item.get("date") or "unknown date"
        wellness_value = item.get("wellness")
        parts.append(f"{date_value}: {wellness_value}/100" if wellness_value is not None else f"{date_value}: n/a")
    return "Your latest 5 wellness scores are: " + ", ".join(parts) + "."


def _safe_score_context(state: ChatAgentState) -> Dict[str, Any]:
    context = state.get("context") or {}
    return context if (state.get("intent") or state.get("intent_data") or {}).get("needs_score") else {}


def _safe_reasoning_context(state: ChatAgentState) -> Optional[Dict[str, Any]]:
    intent_data = state.get("intent") or state.get("intent_data") or {}
    if intent_data.get("intent") != "SCORE_QUERY" or not intent_data.get("requires_analysis"):
        return None
    context = state.get("context") or {}
    if not context.get("has_scores"):
        return None
    return {
        "latest_analysis": context.get("latest_analysis"),
        "recent_scores": context.get("recent_scores", []),
        "recommendations": context.get("recommendations", []),
    }


def _get_secondary_context_summary(secondary_signals: list[str], context: Optional[Dict[str, Any]] = None) -> str:
    """Build a concise summary of secondary signals for LLM context."""
    if not secondary_signals:
        return ""
    
    parts = []
    if "HEALTH_QUERY" in secondary_signals:
        parts.append("User mentioned a health concern alongside this query.")
    if "SCORE_QUERY" in secondary_signals:
        if context and context.get("has_scores"):
            parts.append("User has recent wellness metrics available.")
        else:
            parts.append("User is interested in their wellness scores.")
    if "GREETING" in secondary_signals:
        parts.append("User is greeting or checking in casually.")
    if "ANALYSIS" in secondary_signals:
        parts.append("User is asking for reasoning or explanation, not just facts.")
    
    return " ".join(parts) if parts else ""


def _get_secondary_signal_suffix(secondary_signals: list[str], context: Optional[Dict[str, Any]] = None) -> str:
    """Generate a brief, deterministic suffix based on secondary signals."""
    if not secondary_signals:
        return ""
    
    suffix_parts = []
    
    if "HEALTH_QUERY" in secondary_signals:
        if context and context.get("has_scores"):
            latest_analysis = context.get("latest_analysis") or {}
            if latest_analysis.get("summary"):
                suffix_parts.append(f"Given your health concern, your recent wellness trends show {latest_analysis['summary'].lower()}.")
            else:
                suffix_parts.append("Since you mentioned a health concern, focusing on your stress and sleep scores can help.")
        else:
            suffix_parts.append("Since you have a health concern, tracking your wellness regularly could help you understand patterns.")
    
    if "ANALYSIS" in secondary_signals and "HEALTH_QUERY" not in secondary_signals:
        suffix_parts.append("The patterns in your wellness data align with this question.")
    
    if "GREETING" in secondary_signals and "HEALTH_QUERY" not in secondary_signals and "SCORE_QUERY" not in secondary_signals:
        suffix_parts.append("Thanks for checking in!")
    
    return " ".join(suffix_parts) if suffix_parts else ""


def handle_greeting(state: ChatAgentState) -> Dict[str, Any]:
    intent_data = state.get("intent") or state.get("intent_data") or {}
    context = _safe_score_context(state)
    secondary_signals = intent_data.get("secondary_signals", [])

    # Log greeting handler
    _log_response_stage("handle_greeting", False)

    # If greeting was triggered by scores_tab or has SCORE_QUERY secondary signal
    if intent_data.get("needs_score") and context.get("has_scores"):
        scores = format_scores(context.get("recent_scores", []))
        response = "Hi! 👋 Here's a quick look at your recent scores."
        
        # Acknowledge secondary signals
        if "HEALTH_QUERY" in secondary_signals:
            response = "Hi! 👋 I see you have a health concern. Here are your recent wellness scores."
        
        _log_final_output("deterministic", None)
        return {
            "response": response,
            "data": scores,
        }

    # Build context-aware greeting based on secondary signals
    response = "Hi! 👋 How are you feeling today?"
    
    if "HEALTH_QUERY" in secondary_signals:
        response = "Hi! 👋 I noticed you mentioned a health concern. How can I support you?"
    elif "SCORE_QUERY" in secondary_signals:
        response = "Hi! 👋 Ready to check your wellness scores and see how you're doing?"
    elif "ANALYSIS" in secondary_signals:
        response = "Hi! 👋 Looking to understand your wellness better? I'm here to help."
    
    _log_final_output("deterministic", None)
    return {"response": response}


def handle_score_query(state: ChatAgentState) -> Dict[str, Any]:
    intent_data = state.get("intent") or state.get("intent_data") or {}
    if intent_data.get("needs_score") is not True:
        return {"response": "I can share score insights when requested, but no score context is currently enabled."}

    context = _safe_score_context(state)
    scores = format_scores(context.get("recent_scores", [])) if context.get("has_scores") else []
    if not scores:
        _log_response_stage("handle_score_query", False)
        return {
            "response": "I could not find recent score history yet. Please complete a few check-ins first.",
            "data": [],
        }

    if intent_data.get("requires_analysis"):
        # LLM-based score analysis with structured context
        _log_response_stage("handle_score_query", True)
        
        analysis_query = (state.get("input") or "").strip()
        
        # Use clean context preparation for LLM
        llm_context = prepare_llm_context(
            handler_type="score_analysis",
            query=analysis_query,
            state=state,
            intent_data=intent_data,
            context=context,
        )
        
        messages = AGENT_PROMPT.format_messages(query=analysis_query, context=llm_context)
        response, provider = safe_llm_invoke(messages)
        response_text = getattr(response, "content", str(response))
        
        _log_final_output("llm_based", provider)
        return {"response": response_text, "data": scores, "llm_provider": provider}

    # Deterministic score summary with signals
    _log_response_stage("handle_score_query", False)
    response_text = _summarize_scores(scores)
    secondary_signals = intent_data.get("secondary_signals", [])
    
    # Use secondary signals to generate intelligent suffix (no new LLM call)
    suffix = _get_secondary_signal_suffix(secondary_signals, context)
    if suffix:
        response_text += " " + suffix
    
    _log_final_output("deterministic", None)
    return {"response": response_text, "data": scores[:5]}


def handle_health_query(state: ChatAgentState) -> Dict[str, Any]:
    """
    Health query handler with safety layer.
    
    Safety guarantees:
    - Detects severity and adjusts tone
    - Constructs safe responses (no diagnosis)
    - Only includes score context if user explicitly asked
    - Validates response quality
    """
    query = (state.get("input") or "").strip()
    intent_data = state.get("intent") or state.get("intent_data") or {}
    context = _safe_score_context(state)
    
    # [SAFETY] Detect severity and adjust handling
    is_severe, severity_level = detect_severity(query)
    print(f"[HEALTH_SAFETY] severity_detected={is_severe}, severity_level={severity_level}")
    
    # [SAFETY] Determine if score context should be included
    include_score_context = should_include_score_context_in_health_response(query)
    
    # Prepare structured context for LLM
    _log_response_stage("handle_health_query", True)
    
    llm_context = prepare_llm_context(
        handler_type="health_query",
        query=query,
        state=state,
        intent_data=intent_data,
        context=context if include_score_context else None,
    )
    
    messages = AGENT_PROMPT.format_messages(query=query, context=llm_context)
    response, provider = safe_llm_invoke(messages)
    response_text = getattr(response, "content", str(response))
    
    # [SAFETY] Sanitize response for medical claim language
    response_text = build_health_response_with_safety(response_text, query, severity=severity_level)
    
    # [SAFETY] Validate response quality
    is_valid, issue = validate_health_response_quality(response_text)
    if issue:
        print(f"[HEALTH_SAFETY] validation_issue={issue}")
    
    # Add signal-aware suffix if appropriate
    secondary_signals = intent_data.get("secondary_signals", [])
    if include_score_context and "SCORE_QUERY" in secondary_signals and context.get("has_scores"):
        response_text += " Your wellness scores might provide additional context for this concern."
    
    _log_final_output("llm_based", provider)
    return {"response": response_text, "llm_provider": provider}


def handle_general_query(state: ChatAgentState) -> Dict[str, Any]:
    query = (state.get("input") or "").strip()
    intent_data = state.get("intent") or state.get("intent_data") or {}
    context = _safe_score_context(state)
    
    # Log response stage
    _log_response_stage("handle_general_query", True)
    
    # Use clean context preparation for LLM
    llm_context = prepare_llm_context(
        handler_type="general_query",
        query=query,
        state=state,
        intent_data=intent_data,
        context=context,
    )
    
    messages = AGENT_PROMPT.format_messages(query=query, context=llm_context)
    response, provider = safe_llm_invoke(messages)
    response_text = getattr(response, "content", str(response))
    
    _log_final_output("llm_based", provider)
    return {"response": response_text, "llm_provider": provider}


def response_router(state: ChatAgentState) -> ChatAgentState:
    intent_data = state.get("intent") or state.get("intent_data") or {"intent": "GENERAL", "needs_score": False}
    intent = intent_data.get("intent")

    # Log intent and context information at router
    print(f"[ROUTER] Starting response routing for intent={intent}")

    if intent == "GREETING":
        payload = handle_greeting(state)
    elif intent == "SCORE_QUERY":
        payload = handle_score_query(state)
    elif intent == "HEALTH_QUERY":
        payload = handle_health_query(state)
    else:
        payload = handle_general_query(state)

    payload = normalize_response_payload(payload if isinstance(payload, dict) else {"response": str(payload)}, state)

    memory_key = state.get("memory_key") or get_memory_key(state.get("user_id"), state.get("session_id"))
    add_user_message(memory_key, state.get("input") or "")
    add_assistant_message(memory_key, payload.get("response", ""), intent=intent)

    print(f"[MEMORY] stored_turns_for_key={memory_key}")

    _debug_state({**state, "intent": intent_data, "context": state.get("context")})
    return {
        **state,
        "intent": intent_data,
        "intent_data": intent_data,
        "output": payload,
        "llm_provider": payload.get("llm_provider", state.get("llm_provider")),
    }


# OLD RESPONSE IMPLEMENTATION (DO NOT DELETE)
# def response_node(state: ChatAgentState) -> ChatAgentState:
#     query = (state.get("input") or "").strip()
#     intent_data = state.get("intent") or state.get("intent_data") or {"intent": "GENERAL", "needs_score": False}
#
#     print("[FLOW] Intent ->", intent_data)
#     print("[FLOW] Context ->", bool(state.get("context")))
#
#     if intent_data.get("intent") == "GREETING":
#         response_text = "Hi! How are you feeling today?"
#         _debug_state({**state, "intent": intent_data})
#         return {**state, "intent": intent_data, "intent_data": intent_data, "output": response_text}
#
#     if intent_data.get("intent") == "SCORE_QUERY" and intent_data.get("needs_score") is True:
#         context = state.get("context") or {}
#         recent_scores = context.get("recent_scores") or []
#         if recent_scores:
#             points = ", ".join(
#                 f"{item.get('created_at', 'unknown')}: {item.get('wellness_score', 'n/a')}/100"
#                 for item in recent_scores[:5]
#             )
#             response_text = f"Your latest 5 wellness scores are: {points}."
#         else:
#             response_text = "I could not find recent score history yet. Please complete a few check-ins first."
#         _debug_state({**state, "intent": intent_data, "context": context})
#         return {**state, "intent": intent_data, "intent_data": intent_data, "output": response_text}
#
#     context_text = state.get("context") if state.get("context") else "No relevant context"
#     messages = AGENT_PROMPT.format_messages(query=query, context=context_text)
#     response, provider = safe_llm_invoke(messages)
#     response_text = getattr(response, "content", str(response))
#
#     if intent_data.get("intent") == "HEALTH_QUERY" and "score" in response_text.lower():
#         response_text = response_text.replace("score", "").replace("Score", "").strip()
#
#     _debug_state({**state, "intent": intent_data, "context": state.get("context")})
#     return {**state, "intent": intent_data, "intent_data": intent_data, "output": response_text, "llm_provider": provider}


def response_node(state: ChatAgentState) -> ChatAgentState:
    return response_router(state)


def agent_llm_node(state: ChatAgentState) -> ChatAgentState:
    return response_router(state)
