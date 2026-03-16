"""
Text analysis service.

Uses Hugging Face Inference API (free tier) for emotion classification.
  Model: j-hartmann/emotion-english-distilroberta-base
  Key:   HUGGINGFACE_API_KEY in .env

Falls back to "neutral" gracefully when the API key is missing or the
API is unavailable (cold start / rate limit).
"""
from __future__ import annotations
import re
import httpx

from app.core.config import get_settings

_HF_URL = (
    "https://api-inference.huggingface.co/models/"
    "j-hartmann/emotion-english-distilroberta-base"
)

# ─── Heuristic lookup tables ──────────────────────────────────
_STRESS_MAP = {
    "anger": 0.80, "fear": 0.80, "sadness": 0.60,
    "disgust": 0.65, "neutral": 0.30, "joy": 0.10, "surprise": 0.25,
}
_MOOD_MAP = {
    "joy": 0.90, "surprise": 0.70, "neutral": 0.50,
    "sadness": 0.20, "fear": 0.30, "anger": 0.25, "disgust": 0.20,
}


def classify_emotion(text: str) -> dict:
    """
    Call HF Inference API and return the top emotion.

    Returns:
        {"label": str, "score": float}
    """
    settings = get_settings()
    if not settings.huggingface_api_key or not text.strip():
        return {"label": "neutral", "score": 1.0}

    try:
        resp = httpx.post(
            _HF_URL,
            headers={"Authorization": f"Bearer {settings.huggingface_api_key}"},
            # wait_for_model: true tells HF to block until the model warms up
            # (free tier puts models to sleep between calls)
            json={"inputs": text[:512], "options": {"wait_for_model": True}},
            timeout=30.0,   # increased — cold-start warm-up can take ~20 s
        )
        if resp.status_code == 200:
            data = resp.json()
            # HF returns [[{"label":..., "score":...}, ...]] or [{"label":..., ...}]
            if data and isinstance(data, list):
                rows = data[0] if isinstance(data[0], list) else data
                top = max(rows, key=lambda x: x.get("score", 0))
                return {"label": top["label"].lower(), "score": top["score"]}
        # Non-200 even after wait_for_model — treat as neutral
    except Exception:
        pass
    return {"label": "neutral", "score": 1.0}


def get_sentiment_summary(emotion_label: str) -> str:
    """Map emotion label -> coarse sentiment string."""
    if emotion_label in {"anger", "disgust", "fear", "sadness"}:
        return "negative"
    if emotion_label in {"joy", "surprise"}:
        return "positive"
    return "neutral"


def count_words(text: str) -> int:
    return len(re.findall(r"\w+", text))


def analyse_text(text: str) -> dict:
    """
    Full text analysis pipeline.

    Returns:
        emotion:           dominant emotion label
        emotion_score:     confidence 0-1
        sentiment_summary: coarse sentiment
        word_count:        int
        stress_score:      0-1 heuristic
        mood_score:        0-1 heuristic
    """
    result = classify_emotion(text)
    emotion = result["label"]
    sentiment = get_sentiment_summary(emotion)
    word_count = count_words(text)

    return {
        "emotion": emotion,
        "emotion_score": round(result["score"], 4),
        "sentiment_summary": sentiment,
        "word_count": word_count,
        "stress_score": _STRESS_MAP.get(emotion, 0.30),
        "mood_score": _MOOD_MAP.get(emotion, 0.50),
    }
