from __future__ import annotations

import re
from typing import Any

from app.services.graph.state import AssistantGraphState
from app.services.tools.registry import ToolRegistry


_COORD_PATTERN = re.compile(r"(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)")


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_coords_from_text(text: str) -> tuple[float | None, float | None]:
    if not text:
        return None, None
    match = _COORD_PATTERN.search(text)
    if not match:
        return None, None

    lat = _safe_float(match.group(1))
    lon = _safe_float(match.group(2))
    if lat is None or lon is None:
        return None, None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None, None
    return lat, lon


def tool_decision_node(state: AssistantGraphState, registry: ToolRegistry) -> AssistantGraphState:
    selected_tool = state.get("selected_tool")
    if not selected_tool:
        state["requires_consent"] = False
        state["consent_status"] = "not_required"
        state["audit_entries"].append({"event": "tool_decision", "decision": "no_tool"})
        return state

    if selected_tool == "find_nearby_clinics":
        tool_input = dict(state.get("tool_input") or {})

        lat = _safe_float(tool_input.get("latitude"))
        lon = _safe_float(tool_input.get("longitude"))
        if lat is None:
            lat = _safe_float(tool_input.get("lat"))
        if lon is None:
            lon = _safe_float(tool_input.get("lng"))

        # If the LLM omitted coordinates, try extracting from user text/context.
        if lat is None or lon is None:
            search_texts = [state.get("user_message", "")]
            for item in state.get("recent_messages", []):
                msg = (item or {}).get("message")
                if isinstance(msg, str):
                    search_texts.append(msg)
            for text in search_texts:
                lat_candidate, lon_candidate = _extract_coords_from_text(text)
                if lat_candidate is not None and lon_candidate is not None:
                    lat = lat_candidate
                    lon = lon_candidate
                    break

        if lat is None or lon is None:
            raise RuntimeError(
                "LOCATION_CONTEXT_MISSING: clinic search requires latitude and longitude"
            )

        tool_input["latitude"] = lat
        tool_input["longitude"] = lon
        state["tool_input"] = tool_input

    needs_consent = registry.requires_consent(selected_tool)
    state["requires_consent"] = needs_consent
    if needs_consent and state.get("consent_status") not in {"approved", "denied"}:
        state["consent_status"] = "pending"
    elif not needs_consent:
        state["consent_status"] = "not_required"

    state["audit_entries"].append(
        {
            "event": "tool_decision",
            "decision": "tool_selected",
            "selected_tool": selected_tool,
            "requires_consent": needs_consent,
            "consent_status": state["consent_status"],
        }
    )
    return state
