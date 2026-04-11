"""
Structured LLM Context Preparation Layer

Provides clean, minimal, and well-organized context for LLM invocations.
Ensures high-quality input with clear separation of concerns.
"""

from typing import Any, Dict, Optional


def prepare_score_analysis_context(
    query: str,
    latest_analysis: Optional[Dict[str, Any]] = None,
    recent_scores: Optional[list] = None,
    secondary_signals: Optional[list] = None,
    memory_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Prepare structured context for score query analysis.
    
    Used when: requires_analysis=True for SCORE_QUERY
    
    Guarantees:
    - Clean separation: [QUERY] | [ANALYSIS] | [METRICS]
    - Bounded data: max 5 recent scores
    - Minimal noise: only latest_analysis included, not full history
    """
    context_parts = []
    
    # Explicit query section
    context_parts.append(f"QUERY:\n{query}")
    
    # Analysis section (if available)
    if latest_analysis and latest_analysis.get("summary"):
        context_parts.append(f"LATEST_ANALYSIS:\n{latest_analysis['summary']}")
    
    # Bounded recent scores (max 5, clearly labeled)
    if recent_scores and len(recent_scores) > 0:
        bounded_scores = recent_scores[:5]
        score_summaries = []
        for score in bounded_scores:
            wellness = score.get("wellness_score", "n/a")
            stress = score.get("stress_score", "n/a")
            mood = score.get("mood_score", "n/a")
            date = score.get("created_at", "unknown")
            score_summaries.append(f"{date}: wellness={wellness}, stress={stress}, mood={mood}")
        context_parts.append(f"RECENT_SCORES (max 5):\n" + "\n".join(score_summaries))
    
    # Signal awareness (structured)
    if secondary_signals:
        signal_str = ", ".join(secondary_signals)
        context_parts.append(f"SECONDARY_SIGNALS:\n{signal_str}")

    if memory_context:
        context_parts.append(f"MEMORY_CONTEXT:\n{memory_context}")
    
    return "\n\n".join(context_parts)


def prepare_health_query_context(
    query: str,
    secondary_signals: Optional[list] = None,
    latest_analysis: Optional[Dict[str, Any]] = None,
    recent_scores: Optional[list] = None,
    memory_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Prepare structured context for health query.
    
    Used when: HEALTH_QUERY intent with optional score secondary
    
    Guarantees:
    - Clear task: respond to health concern
    - Minimal score context: only if SCORE_QUERY signal present
    - No data mixing: health context separate from score context
    """
    context_parts = []
    
    # Primary context: signal awareness
    if secondary_signals and "SCORE_QUERY" in secondary_signals:
        context_parts.append("USER_CONTEXT:\nUser has wellness metrics available and may be interested in score insights.")
        
        # Include only latest analysis summary, not raw scores
        if latest_analysis and latest_analysis.get("summary"):
            context_parts.append(f"RECENT_WELLNESS_SUMMARY:\n{latest_analysis['summary']}")
    else:
        context_parts.append("USER_CONTEXT:\nRespond to the health concern directly without assuming score context.")

    if memory_context:
        context_parts.append(f"MEMORY_CONTEXT:\n{memory_context}")
    
    return "\n\n".join(context_parts) if context_parts else "No relevant context"


def prepare_general_query_context(
    query: str,
    secondary_signals: Optional[list] = None,
    has_scores: bool = False,
    memory_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Prepare structured context for general/unclassified query.
    
    Used when: GENERAL intent with possible secondary signals
    
    Guarantees:
    - Minimal scope: only signal hints, no data injection
    - Clean guidance: when to mention scores if relevant
    - No assumption: doesn't force score inclusion
    """
    if not secondary_signals or "SCORE_QUERY" not in secondary_signals:
        if memory_context:
            return f"MEMORY_CONTEXT:\n{memory_context}"
        return "No relevant context"
    
    if has_scores:
        base_context = "USER_CONTEXT:\nUser has wellness metrics available. Mention scores if directly relevant to their question."
    else:
        base_context = "USER_CONTEXT:\nUser may be interested in wellness tracking. Suggest it if appropriate to their question."

    if memory_context:
        return f"{base_context}\n\nMEMORY_CONTEXT:\n{memory_context}"
    return base_context


def prepare_llm_context(
    handler_type: str,
    query: str,
    state: Optional[Dict[str, Any]] = None,
    intent_data: Optional[Dict[str, Any]] = None,
    context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Main entry point: Prepare clean, structured context for LLM invocation.
    
    Args:
        handler_type: "score_analysis" | "health_query" | "general_query"
        query: User's input query
        state: Full chat state (optional)
        intent_data: Intent classification data (optional)
        context: Fetched score context (optional)
    
    Returns:
        Formally structured context string for LLM prompt
    
    Design:
        - Consistent formatting across all handler types
        - Only includes necessary data (no bloat)
        - Clear separation of concerns
        - Minimal, high-quality input for better reasoning
    """
    context = context or {}
    intent_data = intent_data or {}
    
    latest_analysis = context.get("latest_analysis")
    recent_scores = context.get("recent_scores")
    secondary_signals = intent_data.get("secondary_signals", [])
    has_scores = context.get("has_scores", False)
    memory_context = (state or {}).get("memory_context")
    
    if handler_type == "score_analysis":
        return prepare_score_analysis_context(
            query=query,
            latest_analysis=latest_analysis,
            recent_scores=recent_scores,
            secondary_signals=secondary_signals,
            memory_context=memory_context,
        )
    elif handler_type == "health_query":
        return prepare_health_query_context(
            query=query,
            secondary_signals=secondary_signals,
            latest_analysis=latest_analysis,
            recent_scores=recent_scores,
            memory_context=memory_context,
        )
    elif handler_type == "general_query":
        return prepare_general_query_context(
            query=query,
            secondary_signals=secondary_signals,
            has_scores=has_scores,
            memory_context=memory_context,
        )
    else:
        return "No relevant context"


def _log_context_preparation(
    handler_type: str,
    query: str,
    context_prepared: str,
    context_layers_included: list,
) -> None:
    """Log structured context preparation for observability."""
    print(f"[CONTEXT_PREP] handler={handler_type}")
    print(f"[CONTEXT_PREP] layers_included={context_layers_included}")
    print(f"[CONTEXT_PREP] query_length={len(query)}")
    print(f"[CONTEXT_PREP] context_length={len(context_prepared)}")
