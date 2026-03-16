"""
Fusion Neural Network for multimodal risk scoring.

Architecture:
  Input  : 15 features from text, audio, video, questionnaire modalities
  Hidden : 64 -> 32 -> 16 neurons (ReLU)
  Output : 5 scores — stress, low_mood, burnout, social_withdrawal, crisis

Model file: backend/ml_models/fusion_nn.pkl  (sklearn Pipeline)
Train with: python train_nn.py  (from backend/ directory)

If the model file does not exist, predict() returns None and scoring_service
falls back to the heuristic weighted-average method.
"""
from __future__ import annotations
import pickle
import numpy as np
from pathlib import Path
from typing import Optional, Dict

_MODEL_PATH = Path(__file__).resolve().parents[2] / "ml_models" / "fusion_nn.pkl"
_model = None   # loaded lazily on first predict call

# ── Feature names (must match train_nn.py order exactly) ──────
FEATURE_NAMES = [
    "text_stress",       # 0-1  stress derived from text emotion
    "text_mood",         # 0-1  mood derived from text emotion
    "audio_stress",      # 0-1  derived from silence + energy
    "audio_silence",     # 0-1  proportion of silence frames
    "audio_rms_norm",    # 0-1  RMS energy normalised to [0,1]
    "video_face",        # 0-1  fraction of frames with face detected
    "video_lighting",    # 0-1  average frame brightness
    "q_stress",          # 0-1  questionnaire stress_level / 10
    "q_mood",            # 0-1  questionnaire mood_level / 10
    "q_sleep_pen",       # 0-1  sleep deprivation penalty
    "has_text",          # 0/1  text modality present
    "has_audio",         # 0/1  audio modality present
    "has_video",         # 0/1  video modality present
    "has_q",             # 0/1  questionnaire modality present
    "n_modalities",      # 0-1  count of available modalities / 4
]

# ── Output names ───────────────────────────────────────────────
OUTPUT_NAMES = [
    "stress_score",
    "low_mood_score",
    "burnout_score",
    "social_withdrawal_score",
    "crisis_score",
]


def _load() -> Optional[object]:
    """Load model from disk (once). Returns None if file not found."""
    global _model
    if _model is not None:
        return _model
    if _MODEL_PATH.exists():
        try:
            with open(_MODEL_PATH, "rb") as f:
                _model = pickle.load(f)
        except Exception:
            _model = None
    return _model


def build_feature_vector(
    text_features: Optional[Dict] = None,
    audio_features: Optional[Dict] = None,
    video_features: Optional[Dict] = None,
    questionnaire_data: Optional[Dict] = None,
) -> tuple[list[float], dict]:
    """
    Build the 15-dim input feature vector from modality dicts.

    Returns:
        (feature_list, availability_dict)

    Missing modalities contribute zeros; availability flags are set accordingly.
    """
    has_text  = text_features  is not None
    has_audio = audio_features is not None
    has_video = video_features is not None
    has_q     = questionnaire_data is not None

    n_mod = sum([has_text, has_audio, has_video, has_q]) / 4.0

    # ── Text ──────────────────────────────────────────────────
    text_stress = float(text_features.get("stress_score", 0.3)) if has_text else 0.0
    text_mood   = float(text_features.get("mood_score",   0.5)) if has_text else 0.0

    # ── Audio ─────────────────────────────────────────────────
    if has_audio:
        feat          = audio_features.get("features", {})
        silence       = float(feat.get("silence_ratio",  0.0))
        rms           = float(feat.get("rms_energy",     0.03))
        rms_norm      = min(rms / 0.1, 1.0)          # cap at 0.1 → maps to 1.0
        audio_stress  = min(silence * 0.6 + (1.0 - rms_norm) * 0.4, 1.0)
    else:
        silence = rms_norm = audio_stress = 0.0

    # ── Video ─────────────────────────────────────────────────
    if has_video:
        video_face     = float(video_features.get("face_ratio",    0.0))
        video_lighting = float(video_features.get("lighting_score", 0.5) or 0.5)
    else:
        video_face = video_lighting = 0.0

    # ── Questionnaire ─────────────────────────────────────────
    if has_q:
        q_stress    = float(questionnaire_data.get("stress_level", 5)) / 10.0
        q_mood      = float(questionnaire_data.get("mood_level",   5)) / 10.0
        sleep_h     = float(questionnaire_data.get("sleep_hours",  7))
        q_sleep_pen = max(0.0, (8.0 - min(sleep_h, 8.0)) / 8.0)
    else:
        q_stress = q_mood = q_sleep_pen = 0.0

    features = [
        text_stress, text_mood,
        audio_stress, silence, rms_norm,
        video_face, video_lighting,
        q_stress, q_mood, q_sleep_pen,
        float(has_text), float(has_audio), float(has_video), float(has_q),
        n_mod,
    ]

    return features, {"has_text": has_text, "has_audio": has_audio,
                      "has_video": has_video, "has_q": has_q}


def predict(feature_vector: list[float]) -> Optional[Dict]:
    """
    Run the NN and return a dict of 5 clamped scores.
    Returns None if the model file has not been trained yet.
    """
    model = _load()
    if model is None:
        return None

    try:
        x = np.array([feature_vector], dtype=np.float32)
        y = model.predict(x)[0]
        return {
            name: float(np.clip(val, 0.0, 1.0))
            for name, val in zip(OUTPUT_NAMES, y)
        }
    except Exception:
        return None
