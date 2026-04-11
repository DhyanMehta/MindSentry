"""
Health Response Safety Layer

Ensures health-related responses are safe, responsible, and helpful.
Prevents medical diagnosis claims and enforces supportive tone.
"""

import re
from typing import Optional, Tuple


# Severity indicators - used to adjust tone and attentiveness
_SEVERE_INDICATORS = {
    "panic",
    "anxiety attack",
    "heart attack",
    "severe",
    "emergency",
    "critical",
    "suicidal",
    "self-harm",
    "overdose",
    "cannot breathe",
    "chest pain",
    "dangerous",
}

# Medical claim keywords to avoid
_MEDICAL_CLAIM_INDICATORS = {
    "diagnosed",
    "diagnosis",
    "disease",
    "condition",
    "disorder",
    "syndrome",
    "illness",
    "infection",
    "treatment",
    "medication",
    "prescription",
    "cure",
}

# Safe, supportive response patterns
_SUPPORTIVE_OPENINGS = [
    "I understand this is concerning for you.",
    "That sounds challenging. I'm here to help.",
    "I hear you. Let's think through this together.",
    "Thank you for sharing. I'm listening.",
]

_PRACTICAL_SUGGESTIONS = [
    "Try some deep breathing exercises—slow, steady breaths can help.",
    "Make sure you're getting enough rest and staying hydrated.",
    "A short walk or light movement might help you feel better.",
    "Consider a calming activity like stretching or meditation.",
    "If possible, talk to someone you trust about how you're feeling.",
]

_EMERGENCY_RESOURCES = [
    "If this feels urgent or gets worse, please reach out to a healthcare provider or call emergency services.",
    "For immediate support, consider reaching out to a crisis helpline.",
]


def detect_severity(query: str) -> Tuple[bool, str]:
    """
    Detect if user is experiencing severe distress.
    
    Returns:
        (is_severe: bool, severity_type: str)
        - is_severe: True if severe distress detected
        - severity_type: "emergency" | "high" | "moderate"
    """
    query_lower = query.lower()
    
    # Check for emergency-level severity
    emergency_terms = {"panic", "anxiety attack", "heart attack", "breathe", "chest pain"}
    if any(term in query_lower for term in emergency_terms):
        return True, "emergency"
    
    # Check for crisis-level
    crisis_indicators = {"suicidal", "self-harm", "overdose", "dangerous"}
    if any(term in query_lower for term in crisis_indicators):
        return True, "emergency"
    
    # Check for high severity
    high_severity_terms = {"severe", "critical", "unbearable", "worst", "terrible"}
    if any(term in query_lower for term in high_severity_terms):
        return True, "high"
    
    # Moderate (we care, but not emergency)
    moderate_indicators = {"worried", "concerned", "struggling", "difficult", "overwhelmed"}
    if any(term in query_lower for term in moderate_indicators):
        return False, "moderate"
    
    return False, "standard"


def sanitize_response(response_text: str) -> str:
    """
    Sanitize LLM response to ensure safety and responsibility.
    
    Rules:
    1. Remove or qualify medical claims
    2. Avoid definitive diagnoses
    3. Suggest professional help when appropriate
    """
    text = response_text.strip()
    
    # Check for medical claim indicators and qualify them
    for claim in _MEDICAL_CLAIM_INDICATORS:
        # Replace accusatory diagnoses with qualified statements
        pattern = rf"\b(you have|you're|you are) .*? {claim}\b"
        if re.search(pattern, text.lower()):
            # Qualify the statement
            text = re.sub(
                pattern,
                f"these symptoms might be worth discussing with a healthcare provider",
                text,
                flags=re.IGNORECASE
            )
    
    return text


def build_health_response_with_safety(
    base_response: str,
    query: str,
    severity: str = "standard",
) -> str:
    """
    Build a complete health response with safety guarantees.
    
    Process:
    1. Sanitize the base response
    2. Adjust tone based on severity
    3. Add appropriate supportive elements
    4. Include resources if needed
    """
    sanitized = sanitize_response(base_response)
    
    # For high/emergency severity, add supportive opening and resources
    if severity == "emergency":
        return (
            "I can see this is really serious. " +
            sanitized +
            "\n\n" +
            f"Please reach out to emergency services or a crisis helpline if you need immediate support. "
            "Your safety is the priority."
        )
    elif severity == "high":
        # Add concern acknowledgment
        opening = "I can see this is very difficult for you. "
        # Ensure response is supportive
        if "suggest" not in sanitized.lower() and "help" not in sanitized.lower():
            sanitized += " Please also consider reaching out to a healthcare provider who can give you personalized support."
        return opening + sanitized
    
    return sanitized


def should_include_score_context_in_health_response(query: str) -> bool:
    """
    Determine if score data should be mentioned in health response.
    
    Returns True only if:
    - User explicitly asked about scores
    - User explicitly asked for analysis of health in relation to scores
    
    Returns False otherwise (safety: don't inject unrelated data)
    """
    query_lower = query.lower()
    
    # Explicit score requests
    if any(term in query_lower for term in ["score", "metric", "wellness data", "check-in", "history"]):
        return True
    
    # Explicit analysis requests
    if any(phrase in query_lower for phrase in ["compare to my scores", "relate to my wellness", "my data shows"]):
        return True
    
    # Default: don't mix data
    return False


def validate_health_response_quality(response_text: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that a health response meets safety standards.
    
    Returns:
        (is_valid: bool, issue: Optional[str])
        - is_valid: True if response is safe and helpful
        - issue: Specific issue found, if any
    """
    text = response_text.lower()
    
    # Check for medical diagnosis language
    if any(term in text for term in ["you have", "you have a", "you're suffering from"]):
        if "condition" in text or "disease" in text or "disorder" in text:
            return False, "Contains medical diagnosis (unsafe)"
    
    # Check for dismissive language
    if any(term in text for term in ["nothing serious", "probably nothing", "don't worry"]):
        return False, "Contains dismissive language (unsafe for health)"
    
    # Check for reasonable supportive tone
    # (responses should show empathy)
    empathy_indicators = ["understand", "hear you", "i can see", "concern", "difficult", "support"]
    has_empathy = any(term in text for term in empathy_indicators)
    
    if not has_empathy and ("health" in text or "pain" in text or "sick" in text or "worry" in text):
        # Health topic but no empathy shown - might be okay for technical advice, but flag it
        return True, "Missing empathy (consider adding)"
    
    return True, None
