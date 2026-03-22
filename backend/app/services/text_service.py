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
_HF_URL_B = (
    "https://api-inference.huggingface.co/models/"
    "SamLowe/roberta-base-go_emotions"
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

_KEYWORD_EMOTION = {
    "anger": {
        "angry", "mad", "furious", "annoyed", "irritated", "rage", "frustrated",
    },
    "fear": {
        "anxious", "afraid", "scared", "panic", "worried", "terrified", "nervous",
    },
    "sadness": {
        "sad", "down", "depressed", "hopeless", "tired", "lonely", "crying",
    },
    "joy": {
        "happy", "great", "awesome", "joy", "excited", "grateful", "calm", "good",
    },
    "surprise": {
        "surprised", "shocked", "unexpected", "suddenly", "wow",
    },
    "disgust": {
        "disgusted", "gross", "sick", "nausea", "revolting",
    },
}


def _keyword_fallback(text: str) -> dict:
    """Simple lexical emotion inference used when remote model is unavailable."""
    tokens = re.findall(r"[a-z']+", text.lower())
    if not tokens:
        return {"label": "neutral", "score": 0.5}

    hits = {k: 0 for k in _KEYWORD_EMOTION.keys()}
    for token in tokens:
        for label, vocab in _KEYWORD_EMOTION.items():
            if token in vocab:
                hits[label] += 1

    best_label, best_hits = max(hits.items(), key=lambda kv: kv[1])
    if best_hits == 0:
        return {"label": "neutral", "score": 0.52}

    # Keep fallback confidence conservative.
    score = min(0.82, 0.56 + best_hits * 0.08)
    return {"label": best_label, "score": round(score, 4)}


def _map_label(raw_label: str) -> str:
    label = (raw_label or "").lower().strip().replace("-", "_").replace(" ", "_")
    mapping = {
        "angry": "anger",
        "mad": "anger",
        "joy": "joy",
        "happiness": "joy",
        "happy": "joy",
        "fearful": "fear",
        "afraid": "fear",
        "sad": "sadness",
        "grief": "sadness",
        "surprised": "surprise",
        "disgusted": "disgust",
    }
    return mapping.get(label, label or "neutral")


def _call_hf_emotion_model(url: str, key: str, text: str) -> dict | None:
    try:
        resp = httpx.post(
            url,
            headers={"Authorization": f"Bearer {key}"},
            json={"inputs": text[:512], "options": {"wait_for_model": True}},
            timeout=35.0,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data or not isinstance(data, list):
            return None
        rows = data[0] if isinstance(data[0], list) else data
        if not rows or not isinstance(rows, list):
            return None
        top = max(rows, key=lambda x: x.get("score", 0.0))
        return {
            "label": _map_label(str(top.get("label", "neutral"))),
            "score": float(top.get("score", 0.0) or 0.0),
        }
    except Exception:
        return None


def _ensemble_emotion(primary: dict, secondary: dict | None) -> dict:
    if not secondary:
        return primary
    p_label, p_score = primary.get("label", "neutral"), float(primary.get("score", 0.0) or 0.0)
    s_label, s_score = secondary.get("label", "neutral"), float(secondary.get("score", 0.0) or 0.0)

    if p_label == s_label:
        return {"label": p_label, "score": round(min(0.99, (p_score + s_score) / 2.0 + 0.04), 4)}

    if p_score >= s_score + 0.12:
        return {"label": p_label, "score": round(p_score, 4)}
    if s_score >= p_score + 0.12:
        return {"label": s_label, "score": round(s_score, 4)}

    # Near tie: retain primary but lower confidence.
    return {"label": p_label, "score": round(max(0.45, (p_score + s_score) / 2.0 - 0.05), 4)}


def _text_integrity(text: str, emotion_score: float) -> dict:
    clean = text.strip()
    tokens = re.findall(r"\w+", clean.lower())
    token_count = len(tokens)
    unique_ratio = (len(set(tokens)) / token_count) if token_count > 0 else 0.0
    repeated_char = bool(re.search(r"(.)\1{5,}", clean.lower()))
    repeated_token = bool(re.search(r"\b(\w+)\b(?:\s+\1\b){2,}", clean.lower()))
    too_short = token_count < 4

    risk = 0.0
    flags: list[str] = []
    if too_short:
        risk += 0.35
        flags.append("very_short_text")
    if unique_ratio < 0.45 and token_count >= 6:
        risk += 0.25
        flags.append("low_vocabulary_diversity")
    if repeated_char:
        risk += 0.2
        flags.append("excessive_character_repetition")
    if repeated_token:
        risk += 0.2
        flags.append("repeated_words_pattern")
    if emotion_score < 0.5:
        risk += 0.1
        flags.append("low_model_confidence")

    spoof_risk = max(0.0, min(1.0, risk))
    integrity = round(1.0 - spoof_risk, 4)
    return {
        "text_integrity_score": integrity,
        "text_spoof_risk": round(spoof_risk, 4),
        "text_integrity_flags": flags,
        "token_count": token_count,
    }


def classify_emotion(text: str) -> dict:
    """
    Call HF Inference API and return the top emotion.

    Returns:
        {"label": str, "score": float}
    """
    settings = get_settings()
    if not text.strip():
        return {"label": "neutral", "score": 0.5}

    if not settings.huggingface_api_key:
        return _keyword_fallback(text)

    primary = _call_hf_emotion_model(_HF_URL, settings.huggingface_api_key, text)
    secondary = _call_hf_emotion_model(_HF_URL_B, settings.huggingface_api_key, text)
    if primary:
        return _ensemble_emotion(primary, secondary)
    if secondary:
        return secondary
    return _keyword_fallback(text)


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
    integrity = _text_integrity(text, float(result.get("score", 0.0) or 0.0))

    return {
        "emotion": emotion,
        "emotion_score": round(result["score"], 4),
        "text_emotion_confidence": round(result["score"], 4),
        "sentiment_summary": sentiment,
        "word_count": word_count,
        "stress_score": _STRESS_MAP.get(emotion, 0.30),
        "mood_score": _MOOD_MAP.get(emotion, 0.50),
        **integrity,
    }
