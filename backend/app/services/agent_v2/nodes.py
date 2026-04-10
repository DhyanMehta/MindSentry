from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

try:
    from langchain.prompts import ChatPromptTemplate
except Exception:
    from langchain_core.prompts import ChatPromptTemplate

from app.services.agent_v2.context import get_user_score_data
from app.services.agent_v2.llm import safe_llm_invoke
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


def _debug_state(state: ChatAgentState) -> None:
    print("---- DEBUG ----")
    print("QUERY:", state.get("input"))
    print("INTENT:", state.get("intent_data"))
    print("CONTEXT:", state.get("context"))
    print("----------------")


def intent_reasoning_node(state: ChatAgentState) -> ChatAgentState:
    query = (state.get("input") or "").strip()
    prompt = f"""
You MUST return ONLY valid JSON.

Format:
{{
    "intent": "HEALTH_QUERY | SCORE_QUERY | GREETING | GENERAL",
    "needs_score": true or false
}}

Rules:
- HEALTH_QUERY: symptoms, exercise, feeling unwell
- SCORE_QUERY: asking about score, metrics, progress
- GREETING: hi, hello
- GENERAL: everything else

IMPORTANT:
- Do NOT include score unless explicitly needed
- For general health questions -> needs_score = false

Query: {query}
""".strip()

    response, provider = safe_llm_invoke(prompt)
    raw_text = getattr(response, "content", str(response))
    intent_data = _safe_json_loads(raw_text)

    intent_value = intent_data.get("intent")
    if not isinstance(intent_value, str):
        intent_value = "GENERAL"
    intent_value = intent_value.upper().strip()
    if intent_value not in {"HEALTH_QUERY", "SCORE_QUERY", "GREETING", "GENERAL"}:
        intent_value = "GENERAL"

    intent_data = {
        "intent": intent_value,
        "needs_score": bool(intent_data.get("needs_score")),
        "provider": provider,
    }

    _debug_state({**state, "intent_data": intent_data})
    return {**state, "intent_data": intent_data, "llm_provider": provider}


def context_builder_node(state: ChatAgentState, db) -> ChatAgentState:
    intent_data = state.get("intent_data") or {}
    source = state.get("source")
    needs_score = intent_data.get("needs_score") is True

    context: Optional[Dict[str, Any]] = None
    if needs_score or source == "scores_tab":
        context = get_user_score_data(db, state["user_id"])

    _debug_state({**state, "context": context})
    return {**state, "context": context}


def agent_llm_node(state: ChatAgentState) -> ChatAgentState:
    query = (state.get("input") or "").strip()
    context_text = state["context"] if state.get("context") else "No relevant context"

    messages = AGENT_PROMPT.format_messages(query=query, context=context_text)
    response, provider = safe_llm_invoke(messages)
    response_text = getattr(response, "content", str(response))

    if state.get("intent_data", {}).get("intent") == "HEALTH_QUERY" and "score" in response_text.lower():
        response_text = re.sub(r"score", "", response_text, flags=re.IGNORECASE).strip()

    _debug_state({**state, "context": state.get("context")})
    return {**state, "output": response_text, "llm_provider": provider}
