"""
App-wide constants for MindSentry backend.
These are safe, non-diagnosis labels used throughout the system.
"""

# ── Modality types ─────────────────────────────────────────────
MODALITY_TEXT = "text"
MODALITY_AUDIO = "audio"
MODALITY_VIDEO = "video"
MODALITY_QUESTIONNAIRE = "questionnaire"
MODALITY_PASSIVE = "passive_behavior"

# ── Support / risk levels ──────────────────────────────────────
SUPPORT_LOW = "low"
SUPPORT_MEDIUM = "medium"
SUPPORT_HIGH = "high"

RISK_LOW = "low"
RISK_MEDIUM = "medium"
RISK_HIGH = "high"

# ── Assessment session types ───────────────────────────────────
SESSION_CHECKIN = "checkin"
SESSION_SCHEDULED = "scheduled_assessment"
SESSION_CRISIS = "crisis_screen"
SESSION_CLINICIAN = "clinician_review"

# ── Crisis / safety keyword list (bare minimum) ────────────────
CRISIS_KEYWORDS = [
    "kill myself", "end my life", "want to die", "suicidal",
    "suicide", "self harm", "cut myself", "no reason to live",
    "hurt myself", "don't want to be here", "better off dead",
]

DISTRESS_KEYWORDS = [
    "hopeless", "worthless", "can't go on", "no hope",
    "overwhelmed", "breaking down", "can't cope", "desperate",
    "exhausted", "numb", "empty inside",
]

# ── Scoring thresholds ─────────────────────────────────────────
RISK_HIGH_THRESHOLD = 0.7
RISK_MEDIUM_THRESHOLD = 0.4

CRISIS_SCORE_THRESHOLD = 0.65
WELLNESS_FLAG_THRESHOLD = 0.5   # distress_score above this raises wellness_flag

# ── File upload limits ─────────────────────────────────────────
MAX_AUDIO_SIZE_MB = 50
MAX_VIDEO_SIZE_MB = 200
ALLOWED_AUDIO_TYPES = {"audio/wav", "audio/mpeg", "audio/ogg", "audio/webm", "audio/mp4"}
ALLOWED_VIDEO_TYPES = {
    "video/mp4", "video/webm", "video/quicktime",
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp",
}

# ── ML model names (local / HF hub) ───────────────────────────
MODEL_TEXT_EMOTION = "j-hartmann/emotion-english-distilroberta-base"
MODEL_TEXT_EMBEDDING = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_AUDIO_TRANSCRIBE = "faster-whisper"   # local model tag
