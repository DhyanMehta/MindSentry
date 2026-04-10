"""Hosted Hugging Face text-emotion analysis for MindSentry."""
from __future__ import annotations

import re

from app.core.config import get_settings
from app.services.hf_inference_service import HFInferenceError, get_hf_client

_STRESS_MAP = {
    "anger": 0.78,
    "fear": 0.82,
    "sadness": 0.68,
    "disgust": 0.65,
    "surprise": 0.38,
    "neutral": 0.28,
    "joy": 0.12,
}
_MOOD_MAP = {
    "joy": 0.88,
    "surprise": 0.62,
    "neutral": 0.52,
    "fear": 0.28,
    "anger": 0.24,
    "disgust": 0.22,
    "sadness": 0.18,
}
_LABEL_MAP = {
    "angry": "anger",
    "anger": "anger",
    "fear": "fear",
    "fearful": "fear",
    "sad": "sadness",
    "sadness": "sadness",
    "disgust": "disgust",
    "disgusted": "disgust",
    "happy": "joy",
    "happiness": "joy",
    "joy": "joy",
    "neutral": "neutral",
    "surprise": "surprise",
    "surprised": "surprise",
}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())[:512]


def _map_label(raw_label: str) -> str:
    label = (raw_label or "").strip().lower().replace("-", "_").replace(" ", "_")
    return _LABEL_MAP.get(label, "neutral")


def _top_classification_label(payload: object) -> tuple[str, float]:
    rows = payload[0] if isinstance(payload, list) and payload and isinstance(payload[0], list) else payload
    if not isinstance(rows, list) or not rows:
        return "neutral", 0.0
    top = max(rows, key=lambda item: float(item.get("score", 0.0) or 0.0))
    return _map_label(str(top.get("label", "neutral"))), float(top.get("score", 0.0) or 0.0)


def _text_integrity(text: str, emotion_score: float) -> dict:
    tokens = re.findall(r"\w+", text.lower())
    token_count = len(tokens)
    unique_ratio = (len(set(tokens)) / token_count) if token_count else 0.0
    repeated_char = bool(re.search(r"(.)\1{5,}", text.lower()))
    repeated_token = bool(re.search(r"\b(\w+)\b(?:\s+\1\b){2,}", text.lower()))

    risk = 0.0
    flags: list[str] = []
    if token_count < 4:
        risk += 0.35
        flags.append("very_short_text")
    if token_count >= 6 and unique_ratio < 0.45:
        risk += 0.2
        flags.append("low_vocabulary_diversity")
    if repeated_char:
        risk += 0.2
        flags.append("excessive_character_repetition")
    if repeated_token:
        risk += 0.2
        flags.append("repeated_words_pattern")
    if emotion_score < 0.45:
        risk += 0.1
        flags.append("low_model_confidence")

    spoof_risk = max(0.0, min(1.0, risk))
    return {
        "text_integrity_score": round(1.0 - spoof_risk, 4),
        "text_spoof_risk": round(spoof_risk, 4),
        "text_integrity_flags": flags,
        "token_count": token_count,
    }


def classify_emotion(text: str) -> dict:
    clean_text = _normalize_text(text)
    settings = get_settings()
    if not clean_text:
        return {
            "label": "neutral",
            "score": 0.35,
            "model_name": settings.huggingface_text_model,
            "inference_source": "fallback",
            "warnings": ["No text provided for inference."],
        }

    try:
        payload = get_hf_client().text_classification(clean_text)
        label, score = _top_classification_label(payload)
        return {
            "label": label,
            "score": round(score, 4),
            "model_name": settings.huggingface_text_model,
            "inference_source": "huggingface",
            "warnings": [],
        }
    except HFInferenceError as exc:
        return {
            "label": "neutral",
            "score": 0.36,
            "model_name": settings.huggingface_text_model,
            "inference_source": "fallback",
            "warnings": [f"Hosted text inference unavailable: {exc}"],
        }


def get_sentiment_summary(emotion_label: str) -> str:
    if emotion_label in {"anger", "disgust", "fear", "sadness"}:
        return "negative"
    if emotion_label in {"joy", "surprise"}:
        return "positive"
    return "neutral"


def count_words(text: str) -> int:
    return len(re.findall(r"\w+", text))


def analyse_text(text: str) -> dict:
    clean_text = _normalize_text(text)
    result = classify_emotion(clean_text)
    emotion = result["label"]
    score = float(result.get("score", 0.0) or 0.0)
    integrity = _text_integrity(clean_text, score)
    stress_score = min(1.0, max(0.0, _STRESS_MAP.get(emotion, 0.28) * (0.7 + 0.3 * score)))
    mood_score = min(1.0, max(0.0, _MOOD_MAP.get(emotion, 0.52) * (0.75 + 0.25 * score)))

    return {
        "emotion": emotion,
        "emotion_score": round(score, 4),
        "text_emotion_confidence": round(score, 4),
        "sentiment_summary": get_sentiment_summary(emotion),
        "word_count": count_words(clean_text),
        "stress_score": round(stress_score, 4),
        "mood_score": round(mood_score, 4),
        "model_name": result["model_name"],
        "inference_source": result["inference_source"],
        "preprocessing": {
            "normalized_whitespace": True,
            "max_characters": 512,
            "language_assumption": "en",
        },
        "warnings": result.get("warnings", []),
        **integrity,
    }
