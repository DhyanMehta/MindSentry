"""
Re-exports for all models: auth (SQLModel) + new non-auth (SQLAlchemy).
Importing this module ensures all tables are registered in their respective
metadata objects before create_all() is called.
"""
# ── Auth (keep untouched) ──────────────────────────────────────
from app.models.user import User  # noqa: F401

# ── Non-auth ──────────────────────────────────────────────────
from app.models.user_profile import UserProfile  # noqa: F401
from app.models.consent import Consent  # noqa: F401
from app.models.assessment import Assessment, AssessmentModality  # noqa: F401
from app.models.text_entry import TextEntry  # noqa: F401
from app.models.audio_recording import AudioRecording  # noqa: F401
from app.models.video_recording import VideoRecording  # noqa: F401
from app.models.questionnaire import (  # noqa: F401
    QuestionnaireTemplate,
    QuestionnaireQuestion,
    QuestionnaireResponse,
    QuestionnaireResponseItem,
)
from app.models.passive_metric import PassiveBehaviorMetric  # noqa: F401
from app.models.extracted_feature import ExtractedFeature  # noqa: F401
from app.models.model_registry import ModelRegistry  # noqa: F401
from app.models.inference_run import InferenceRun  # noqa: F401
from app.models.risk_score import RiskScore  # noqa: F401
from app.models.analysis_result import AnalysisResult  # noqa: F401
from app.models.recommendation import Recommendation  # noqa: F401
from app.models.safety_flag import SafetyFlag  # noqa: F401

__all__ = [
    "User",
    "UserProfile", "Consent",
    "Assessment", "AssessmentModality",
    "TextEntry", "AudioRecording", "VideoRecording",
    "QuestionnaireTemplate", "QuestionnaireQuestion",
    "QuestionnaireResponse", "QuestionnaireResponseItem",
    "PassiveBehaviorMetric",
    "ExtractedFeature", "ModelRegistry", "InferenceRun",
    "RiskScore", "AnalysisResult", "Recommendation", "SafetyFlag",
]
