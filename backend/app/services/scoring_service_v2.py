"""
Deterministic uncertainty-aware multimodal fusion for MindSentry.

The legacy synthetic neural network remains in the repository as an
experimental artifact, but is no longer used as the production default.
"""
from __future__ import annotations

from typing import Dict, Optional


MODEL_NAME = "hf_weighted_fusion_v2"

_BASE_WEIGHTS = {
    "text": 0.30,
    "audio": 0.22,
    "video": 0.12,
    "questionnaire": 0.36,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def _questionnaire_signals(questionnaire_data: Optional[Dict]) -> dict | None:
    if not questionnaire_data:
        return None
    has_direct = all(key in questionnaire_data for key in ("stress_level", "mood_level"))
    if has_direct:
        stress = _clamp(_safe_float(questionnaire_data.get("stress_level"), 5.0) / 10.0)
        mood = _clamp(_safe_float(questionnaire_data.get("mood_level"), 5.0) / 10.0)
        sleep_hours = questionnaire_data.get("sleep_hours")
        sleep_pen = _clamp((8.0 - min(_safe_float(sleep_hours, 7.0), 8.0)) / 8.0) if sleep_hours is not None else 0.15
        interpretability = 1.0
    elif questionnaire_data.get("total_score") is not None:
        total_score = _safe_float(questionnaire_data.get("total_score"), 0.0)
        stress = _clamp(total_score / 40.0)
        mood = _clamp(1.0 - stress)
        sleep_pen = 0.15
        interpretability = 0.55
    else:
        return None

    return {
        "stress": stress,
        "mood": mood,
        "sleep_pen": sleep_pen,
        "confidence": 0.9 * interpretability,
        "integrity": 1.0,
        "warnings": [] if interpretability >= 1.0 else ["Questionnaire data is aggregated only, so interpretation is limited."],
        "feature_map": {
            "questionnaire_stress": round(stress, 6),
            "questionnaire_mood": round(mood, 6),
            "questionnaire_sleep_penalty": round(sleep_pen, 6),
            "questionnaire_interpretability": round(interpretability, 6),
        },
    }


def _text_signals(text_features: Optional[Dict]) -> dict | None:
    if not text_features:
        return None
    confidence = _clamp(_safe_float(text_features.get("text_emotion_confidence", text_features.get("emotion_score")), 0.0))
    integrity = _clamp(_safe_float(text_features.get("text_integrity_score"), 1.0))
    return {
        "stress": _clamp(_safe_float(text_features.get("stress_score"), 0.28)),
        "mood": _clamp(_safe_float(text_features.get("mood_score"), 0.52)),
        "confidence": confidence,
        "integrity": integrity,
        "warnings": list(text_features.get("warnings", [])),
        "feature_map": {
            "text_stress": round(_safe_float(text_features.get("stress_score"), 0.28), 6),
            "text_mood": round(_safe_float(text_features.get("mood_score"), 0.52), 6),
            "text_confidence": round(confidence, 6),
            "text_integrity": round(integrity, 6),
        },
    }


def _audio_signals(audio_features: Optional[Dict]) -> dict | None:
    if not audio_features:
        return None
    feat = audio_features.get("features", {}) or {}
    confidence = _clamp(_safe_float(audio_features.get("audio_emotion_confidence"), 0.0))
    integrity = _clamp(_safe_float(audio_features.get("audio_integrity_score"), 1.0))
    transcript = str(audio_features.get("transcript", "") or "").strip()
    silence = _clamp(_safe_float(feat.get("silence_ratio"), 0.0))
    clipping = _clamp(_safe_float(feat.get("clipping_ratio"), 0.0))
    audio_stress = _clamp(max(_safe_float(audio_features.get("stress_score"), 0.0), silence * 0.55 + clipping * 2.5))
    audio_mood = _clamp(1.0 - max(silence * 0.5, clipping * 2.0))
    if not transcript and confidence < 0.45:
        audio_stress = _clamp(audio_stress * 0.8)
        audio_mood = _clamp(0.5 + (audio_mood - 0.5) * 0.6)
    return {
        "stress": audio_stress,
        "mood": audio_mood,
        "confidence": confidence,
        "integrity": integrity,
        "warnings": list(audio_features.get("warnings", [])),
        "feature_map": {
            "audio_stress_proxy": round(audio_stress, 6),
            "audio_mood_proxy": round(audio_mood, 6),
            "audio_confidence": round(confidence, 6),
            "audio_integrity": round(integrity, 6),
            "audio_silence_ratio": round(silence, 6),
        },
    }


def _video_signals(video_features: Optional[Dict]) -> dict | None:
    if not video_features:
        return None
    confidence = _clamp(_safe_float(video_features.get("video_emotion_confidence"), 0.0))
    integrity = _clamp(_safe_float(video_features.get("video_integrity_score"), 1.0))
    face_ratio = _clamp(_safe_float(video_features.get("face_ratio"), 0.0))
    lighting = _clamp(_safe_float(video_features.get("lighting_score"), 0.5))
    if not video_features.get("video_emotion"):
        confidence *= 0.4
    visual_stress = _clamp((1.0 - face_ratio) * 0.35 + (1.0 - lighting) * 0.25)
    visual_mood = _clamp(0.45 + lighting * 0.25 + face_ratio * 0.2)
    return {
        "stress": visual_stress,
        "mood": visual_mood,
        "confidence": confidence,
        "integrity": integrity,
        "warnings": list(video_features.get("warnings", [])),
        "feature_map": {
            "video_stress_proxy": round(visual_stress, 6),
            "video_mood_proxy": round(visual_mood, 6),
            "video_confidence": round(confidence, 6),
            "video_integrity": round(integrity, 6),
            "video_face_ratio": round(face_ratio, 6),
            "video_lighting": round(lighting, 6),
        },
    }


def _weighted_fusion(signals: dict[str, dict]) -> tuple[float, float, dict[str, float], dict[str, dict]]:
    weighted_stress = 0.0
    weighted_mood = 0.0
    total_weight = 0.0
    effective_weights: dict[str, float] = {}
    dominant_features: dict[str, dict] = {}

    for modality, signal in signals.items():
        effective_weight = _BASE_WEIGHTS[modality] * _clamp(signal["confidence"]) * _clamp(signal["integrity"])
        if effective_weight <= 0:
            continue
        effective_weights[modality] = round(effective_weight, 6)
        total_weight += effective_weight
        weighted_stress += effective_weight * _clamp(signal["stress"])
        weighted_mood += effective_weight * _clamp(signal["mood"])

    if total_weight <= 0:
        return 0.0, 0.5, effective_weights, {}

    stress = _clamp(weighted_stress / total_weight)
    mood = _clamp(weighted_mood / total_weight)

    for modality, signal in signals.items():
        if modality not in effective_weights:
            continue
        dominant_features[f"{modality}_contribution"] = {
            "effective_weight": round(effective_weights[modality], 6),
            "stress_component": round(signal["stress"], 6),
            "mood_component": round(signal["mood"], 6),
            "confidence": round(signal["confidence"], 6),
            "integrity": round(signal["integrity"], 6),
        }

    return stress, mood, effective_weights, dominant_features


def compute_scores(
    text_features: Optional[Dict] = None,
    audio_features: Optional[Dict] = None,
    video_features: Optional[Dict] = None,
    questionnaire_data: Optional[Dict] = None,
) -> Dict:
    signals = {}
    warnings: list[str] = []

    text_signal = _text_signals(text_features)
    if text_signal:
        signals["text"] = text_signal
        warnings.extend(text_signal["warnings"])

    audio_signal = _audio_signals(audio_features)
    if audio_signal:
        signals["audio"] = audio_signal
        warnings.extend(audio_signal["warnings"])

    video_signal = _video_signals(video_features)
    if video_signal:
        signals["video"] = video_signal
        warnings.extend(video_signal["warnings"])

    questionnaire_signal = _questionnaire_signals(questionnaire_data)
    if questionnaire_signal:
        signals["questionnaire"] = questionnaire_signal
        warnings.extend(questionnaire_signal["warnings"])

    if not signals:
        return _default_scores()

    stress, mood, effective_weights, dominance = _weighted_fusion(signals)
    low_mood = _clamp(1.0 - mood)
    burnout = _clamp(stress * 0.55 + low_mood * 0.25 + questionnaire_signal["sleep_pen"] * 0.2 if questionnaire_signal else stress * 0.6 + low_mood * 0.4)
    social_withdrawal = _clamp((1.0 - _safe_float(video_features.get("face_ratio"), 0.5)) * 0.45 if video_features else 0.0)
    crisis = _clamp(stress * 0.45 + low_mood * 0.35 + burnout * 0.2)

    confidences = [signal["confidence"] for signal in signals.values()]
    integrities = [signal["integrity"] for signal in signals.values()]
    confidence = _clamp(sum(confidences) / len(confidences) * 0.7 + sum(integrities) / len(integrities) * 0.3)
    overall_integrity = _clamp(sum(integrities) / len(integrities))
    overall_spoof_risk = _clamp(1.0 - overall_integrity)
    confidence = _clamp(confidence - overall_spoof_risk * 0.2)

    emotional_distress = _clamp(stress * 0.55 + low_mood * 0.45)
    final_risk_level = "high" if crisis >= 0.72 else ("medium" if crisis >= 0.42 else "low")
    wellness_flag = int(emotional_distress >= 0.55)
    crisis_flag = int(crisis >= 0.75 and len(signals) >= 2)

    model_input_features: dict[str, float] = {}
    for signal in signals.values():
        model_input_features.update(signal["feature_map"])
    for modality, value in effective_weights.items():
        model_input_features[f"{modality}_effective_weight"] = round(value, 6)
    model_input_features["available_modalities"] = float(len(signals))

    model_output_scores = {
        "stress_score": round(stress, 4),
        "low_mood_score": round(low_mood, 4),
        "burnout_score": round(burnout, 4),
        "social_withdrawal_score": round(social_withdrawal, 4),
        "crisis_score": round(crisis, 4),
    }

    return {
        "stress_score": round(stress, 4),
        "low_mood_score": round(low_mood, 4),
        "burnout_score": round(burnout, 4),
        "social_withdrawal_score": round(social_withdrawal, 4),
        "crisis_score": round(crisis, 4),
        "emotional_distress_score": round(emotional_distress, 4),
        "mood_score": round(mood, 4),
        "wellness_flag": wellness_flag,
        "crisis_flag": crisis_flag,
        "support_level": final_risk_level,
        "final_risk_level": final_risk_level,
        "confidence_score": round(confidence, 4),
        "overall_integrity_score": round(overall_integrity, 4),
        "overall_spoof_risk": round(overall_spoof_risk, 4),
        "text_integrity_score": round(_safe_float((text_features or {}).get("text_integrity_score"), 0.0), 4) if text_features else None,
        "audio_integrity_score": round(_safe_float((audio_features or {}).get("audio_integrity_score"), 0.0), 4) if audio_features else None,
        "video_integrity_score": round(_safe_float((video_features or {}).get("video_integrity_score"), 0.0), 4) if video_features else None,
        "text_spoof_risk": round(_safe_float((text_features or {}).get("text_spoof_risk"), 0.0), 4) if text_features else None,
        "audio_spoof_risk": round(_safe_float((audio_features or {}).get("audio_spoof_risk"), 0.0), 4) if audio_features else None,
        "video_spoof_risk": round(_safe_float((video_features or {}).get("video_spoof_risk"), 0.0), 4) if video_features else None,
        "text_confidence": round(_safe_float((text_features or {}).get("text_emotion_confidence", (text_features or {}).get("emotion_score")), 0.0), 4) if text_features else None,
        "audio_confidence": round(_safe_float((audio_features or {}).get("audio_emotion_confidence"), 0.0), 4) if audio_features else None,
        "video_confidence": round(_safe_float((video_features or {}).get("video_emotion_confidence"), 0.0), 4) if video_features else None,
        "scoring_source": "huggingface+deterministic_weighted_fusion",
        "model_name": MODEL_NAME,
        "model_input_features": model_input_features,
        "model_output_scores": model_output_scores,
        "dominant_features": dominance,
        "fusion_warnings": sorted(set(warnings)),
        "text_features": text_features if text_features else None,
        "audio_features": audio_features if audio_features else None,
        "video_features": video_features if video_features else None,
        "text_emotion": text_features.get("emotion") if text_features else None,
        "audio_emotion": audio_features.get("audio_emotion") if audio_features else None,
        "video_emotion": video_features.get("video_emotion") if video_features else None,
    }


def _default_scores() -> Dict:
    return {
        "stress_score": 0.0,
        "low_mood_score": 0.0,
        "burnout_score": 0.0,
        "social_withdrawal_score": 0.0,
        "crisis_score": 0.0,
        "emotional_distress_score": 0.0,
        "mood_score": 0.5,
        "wellness_flag": 0,
        "crisis_flag": 0,
        "support_level": "low",
        "final_risk_level": "low",
        "confidence_score": 0.0,
        "scoring_source": "default",
        "overall_integrity_score": 1.0,
        "overall_spoof_risk": 0.0,
        "text_integrity_score": None,
        "audio_integrity_score": None,
        "video_integrity_score": None,
        "text_spoof_risk": None,
        "audio_spoof_risk": None,
        "video_spoof_risk": None,
        "text_confidence": None,
        "audio_confidence": None,
        "video_confidence": None,
        "model_name": MODEL_NAME,
        "model_input_features": {},
        "model_output_scores": {},
        "dominant_features": {},
        "fusion_warnings": [],
        "text_features": None,
        "audio_features": None,
        "video_features": None,
        "text_emotion": None,
        "audio_emotion": None,
        "video_emotion": None,
    }
