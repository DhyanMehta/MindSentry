"""
Fusion Neural Network for multimodal risk scoring.

Architecture:
  Input  : 17 features from text, audio, video, questionnaire modalities
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
    "text_stress",            # 0-1  stress derived from text emotion
    "text_mood",              # 0-1  mood derived from text emotion
    "audio_stress",           # 0-1  derived from silence + energy
    "audio_silence",          # 0-1  proportion of silence frames
    "audio_rms_norm",         # 0-1  RMS energy normalised to [0,1]
    "audio_emotion_valence",  # 0-1  audio emotion mapped to valence (0=neg, 0.5=neutral, 1=pos)
    "video_face",             # 0-1  fraction of frames with face detected
    "video_lighting",         # 0-1  average frame brightness
    "video_emotion_valence",  # 0-1  video emotion mapped to valence (0=neg, 0.5=neutral, 1=pos)
    "q_stress",               # 0-1  questionnaire stress_level / 10
    "q_mood",                 # 0-1  questionnaire mood_level / 10
    "q_sleep_pen",            # 0-1  sleep deprivation penalty
    "has_text",               # 0/1  text modality present
    "has_audio",              # 0/1  audio modality present
    "has_video",              # 0/1  video modality present
    "has_q",                  # 0/1  questionnaire modality present
    "n_modalities",           # 0-1  count of available modalities / 4
]

# ── Output names ───────────────────────────────────────────────
OUTPUT_NAMES = [
    "stress_score",
    "low_mood_score",
    "burnout_score",
    "social_withdrawal_score",
    "crisis_score",
]

MODEL_NAME = "tuned_mlp"


def feature_vector_to_dict(feature_vector: list[float]) -> dict:
    """Return named feature mapping in production order."""
    return {
        name: float(feature_vector[i])
        for i, name in enumerate(FEATURE_NAMES)
    }


def explain_dominant_features(feature_vector: list[float], output_scores: Dict[str, float]) -> dict:
    """Estimate dominant drivers for each output score.

    Uses the same synthetic-data target structure used in notebook training.
    Returned values are contribution magnitudes (not SHAP values).
    """
    f = feature_vector_to_dict(feature_vector)

    stress = float(output_scores.get("stress_score", 0.0) or 0.0)
    low_mood = float(output_scores.get("low_mood_score", 0.0) or 0.0)
    burnout = float(output_scores.get("burnout_score", 0.0) or 0.0)
    social = float(output_scores.get("social_withdrawal_score", 0.0) or 0.0)

    contribution_map = {
        "stress_score": {
            "text_stress": 0.25 * f["text_stress"],
            "audio_stress": 0.18 * f["audio_stress"],
            "audio_valence_inv": 0.10 * (1.0 - f["audio_emotion_valence"]),
            "video_valence_inv": 0.17 * (1.0 - f["video_emotion_valence"]),
            "q_stress": 0.20 * f["q_stress"],
            "q_sleep_pen": 0.10 * f["q_sleep_pen"],
        },
        "low_mood_score": {
            "text_mood_inverse": 0.30 * (1.0 - f["text_mood"]),
            "audio_valence_inv": 0.10 * (1.0 - f["audio_emotion_valence"]),
            "video_valence_inv": 0.12 * (1.0 - f["video_emotion_valence"]),
            "q_mood_inverse": 0.18 * (1.0 - f["q_mood"]),
            "q_sleep_pen": 0.17 * f["q_sleep_pen"],
            "video_lighting_inverse": 0.03 * (1.0 - f["video_lighting"]),
            "text_stress": 0.10 * f["text_stress"],
        },
        "burnout_score": {
            "stress_score": 0.55 * stress,
            "low_mood_score": 0.35 * low_mood,
            "q_sleep_pen": 0.10 * f["q_sleep_pen"],
        },
        "social_withdrawal_score": {
            "video_valence_inv": 0.30 * (1.0 - f["video_emotion_valence"]),
            "audio_valence_inv": 0.15 * (1.0 - f["audio_emotion_valence"]),
            "low_mood_score": 0.30 * low_mood,
            "stress_score": 0.15 * stress,
            "q_sleep_pen": 0.10 * f["q_sleep_pen"],
        },
        "crisis_score": {
            "stress_score": 0.45 * stress,
            "low_mood_score": 0.35 * low_mood,
            "burnout_score": 0.15 * burnout,
            "social_withdrawal_score": 0.05 * social,
        },
    }

    explained = {}
    for score_name, contrib in contribution_map.items():
        total = sum(max(v, 0.0) for v in contrib.values())
        ranked = sorted(contrib.items(), key=lambda kv: kv[1], reverse=True)
        top_items = []
        for feature_name, value in ranked[:3]:
            pct = (value / total * 100.0) if total > 0 else 0.0
            top_items.append({
                "feature": feature_name,
                "contribution": round(float(value), 6),
                "share_pct": round(float(pct), 2),
            })

        dominant = top_items[0] if top_items else None
        explained[score_name] = {
            "dominant_feature": dominant["feature"] if dominant else None,
            "dominant_share_pct": dominant["share_pct"] if dominant else 0.0,
            "top_features": top_items,
        }

    return explained


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


def _safe_float(value, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def build_feature_vector(
    text_features: Optional[Dict] = None,
    audio_features: Optional[Dict] = None,
    video_features: Optional[Dict] = None,
    questionnaire_data: Optional[Dict] = None,
) -> tuple[list[float], dict]:
    """
    Build the 17-dim input feature vector from modality dicts.

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
    # Derive audio_stress from the ACTUAL SER emotion label, not silence/energy.
    # Silence ratio and RMS energy are still included as raw features.
    _AUDIO_STRESS_FROM_EMOTION = {
        "anger": 0.85, "fear": 0.80, "sadness": 0.70, "disgust": 0.65,
        "neutral": 0.25, "surprise": 0.35, "joy": 0.10,
    }
    if has_audio:
        feat          = audio_features.get("features", {})
        silence       = float(feat.get("silence_ratio",  0.0))
        rms           = float(feat.get("rms_energy",     0.03))
        rms_norm      = min(rms / 0.1, 1.0)          # cap at 0.1 → maps to 1.0
        audio_emo_raw = str(audio_features.get("audio_emotion", "neutral") or "neutral").lower()
        audio_stress  = _AUDIO_STRESS_FROM_EMOTION.get(audio_emo_raw, 0.3)
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
        has_direct_q_fields = all(
            key in questionnaire_data for key in ("stress_level", "mood_level", "sleep_hours")
        )

        if has_direct_q_fields:
            q_stress = _safe_float(questionnaire_data.get("stress_level", 5.0), 5.0) / 10.0
            q_mood = _safe_float(questionnaire_data.get("mood_level", 5.0), 5.0) / 10.0
            sleep_h = _safe_float(questionnaire_data.get("sleep_hours", 7.0), 7.0)
            q_sleep_pen = max(0.0, (8.0 - min(sleep_h, 8.0)) / 8.0)
        elif "total_score" in questionnaire_data and questionnaire_data.get("total_score") is not None:
            # Fallback path for compact questionnaire payloads that only provide total score.
            # Assume a common 0..40 band and project it into the trained feature spaces.
            total_score = _safe_float(questionnaire_data.get("total_score"), 20.0)
            total_norm = float(np.clip(total_score / 40.0, 0.0, 1.0))
            q_stress = total_norm
            q_mood = 1.0 - total_norm
            q_sleep_pen = float(np.clip(0.2 + 0.6 * total_norm, 0.0, 1.0))
        else:
            # Unknown questionnaire schema: do not inject misleading defaults.
            q_stress = q_mood = q_sleep_pen = 0.0
    else:
        q_stress = q_mood = q_sleep_pen = 0.0

    # ── Emotion valence mappings ──────────────────────────────
    # Maps emotion labels to a 0-1 valence scale (0=very negative, 0.5=neutral, 1=very positive)
    _EMOTION_VALENCE = {
        "anger": 0.1, "fear": 0.15, "sadness": 0.05, "disgust": 0.2,
        "surprise": 0.55, "neutral": 0.5, "joy": 0.9,
    }

    if has_audio:
        audio_emo = str(audio_features.get("audio_emotion", "neutral") or "neutral").lower()
        audio_emotion_valence = _EMOTION_VALENCE.get(audio_emo, 0.5)
    else:
        audio_emotion_valence = 0.5

    if has_video:
        video_emo = str(video_features.get("video_emotion", "neutral") or "neutral").lower()
        video_emotion_valence = _EMOTION_VALENCE.get(video_emo, 0.5)
    else:
        video_emotion_valence = 0.5

    features = [
        text_stress, text_mood,
        audio_stress, silence, rms_norm, audio_emotion_valence,
        video_face, video_lighting, video_emotion_valence,
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
