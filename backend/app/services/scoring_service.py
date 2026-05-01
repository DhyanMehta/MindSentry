"""
Scoring service — fuses multimodal signals into normalised risk scores.

Primary path:  Neural Network (ml_models/fusion_nn.pkl)
Fallback path: weighted-average heuristic (runs when NN not trained yet)

Train the NN:
    cd backend && python train_nn.py
"""
from __future__ import annotations
from typing import Optional, Dict
from app.services.fusion_nn import (
    build_feature_vector,
    explain_dominant_features,
    feature_vector_to_dict,
    predict as nn_predict,
    MODEL_NAME,
)
from app.services.risk_calibration_service import calibrate_probability


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))

# Modality weights for the heuristic fallback
_W = {"text": 0.35, "audio": 0.25, "video": 0.15, "questionnaire": 0.25}


def _heuristic(available: list, contributions: dict) -> dict:
    """Weighted-average heuristic used when the NN model is not available."""
    total_w = sum(_W[m] for m in available)
    w_stress = w_mood = 0.0
    for m in available:
        w = _W[m] / total_w
        w_stress += w * contributions[m]["stress"]
        w_mood   += w * contributions[m]["mood"]

    sleep_pen  = contributions.get("questionnaire", {}).get("sleep_pen", 0.0)
    stress     = _clamp(w_stress + sleep_pen * 0.1)
    mood       = _clamp(w_mood)
    low_mood   = _clamp(1.0 - mood)
    burnout    = _clamp((stress + low_mood) / 2.0)
    soc_w      = contributions.get("video", {}).get("stress", 0.0) * 0.5
    crisis     = _clamp(stress * 0.6 + low_mood * 0.4)
    confidence = _clamp(total_w)

    return {
        "stress_score": round(stress, 4),
        "low_mood_score": round(low_mood, 4),
        "burnout_score": round(burnout, 4),
        "social_withdrawal_score": round(soc_w, 4),
        "crisis_score": round(crisis, 4),
        "mood_score": round(mood, 4),
        "confidence_score": round(confidence, 4),
    }


def compute_scores(
    text_features: Optional[Dict] = None,
    audio_features: Optional[Dict] = None,
    video_features: Optional[Dict] = None,
    questionnaire_data: Optional[Dict] = None,
) -> Dict:
    """
    Fuse available modality signals.

    Pipeline:
      1. Build 15-dim feature vector
      2. Run NN (if trained)      → primary path
      3. Fallback to heuristic    → when NN not ready

    Returns a dict with stress_score, low_mood_score, burnout_score,
    social_withdrawal_score, crisis_score, emotional_distress_score,
    mood_score, wellness_flag, crisis_flag, support_level,
    final_risk_level, confidence_score, text/audio/video_emotion.
    """
    available = (
        (["text"]          if text_features       else []) +
        (["audio"]         if audio_features      else []) +
        (["video"]         if video_features      else []) +
        (["questionnaire"] if questionnaire_data  else [])
    )
    if not available:
        return _default_scores()

    # ── Build feature vector for NN ───────────────────────────
    feat_vec, flags = build_feature_vector(
        text_features, audio_features, video_features, questionnaire_data
    )

    # ── Try NN ────────────────────────────────────────────────
    nn_out = nn_predict(feat_vec)
    source = "nn" if nn_out else "heuristic"

    if nn_out:
        stress   = nn_out["stress_score"]
        low_mood = nn_out["low_mood_score"]
        burnout  = nn_out["burnout_score"]
        soc_w    = nn_out["social_withdrawal_score"]
        crisis   = nn_out["crisis_score"]
        mood     = _clamp(1.0 - low_mood)
        confidence = _clamp(sum(flags.values()) / 4.0 + 0.2)
    else:
        # Build contributions dict for heuristic
        contributions: Dict[str, Dict] = {}
        if text_features:
            contributions["text"] = {
                "stress": text_features.get("stress_score", 0.3),
                "mood":   text_features.get("mood_score",   0.5),
            }
        if audio_features:
            feat    = audio_features.get("features", {})
            silence = feat.get("silence_ratio", 0.0)
            rms     = feat.get("rms_energy", 0.03)
            a_s     = _clamp(silence * 0.6 + (0.05 - min(rms, 0.05)) / 0.05 * 0.4)
            contributions["audio"] = {"stress": a_s, "mood": _clamp(1.0 - silence)}
        if video_features:
            light = video_features.get("lighting_score") or 0.5
            face  = video_features.get("face_detected", 0)
            v_s   = _clamp((1.0 - light) * 0.5 + (0.5 if not face else 0.0))
            contributions["video"] = {"stress": v_s, "mood": _clamp(light * 0.7 + (0.3 if face else 0.0))}
        if questionnaire_data:
            sleep_h   = float(questionnaire_data.get("sleep_hours", 7))
            sleep_pen = _clamp((8.0 - min(sleep_h, 8.0)) / 8.0)
            contributions["questionnaire"] = {
                "stress":    _clamp(questionnaire_data.get("stress_level", 5) / 10.0),
                "mood":      _clamp(questionnaire_data.get("mood_level",   5) / 10.0),
                "sleep_pen": sleep_pen,
            }
        h = _heuristic(available, contributions)
        stress   = h["stress_score"]
        low_mood = h["low_mood_score"]
        burnout  = h["burnout_score"]
        soc_w    = h["social_withdrawal_score"]
        crisis   = h["crisis_score"]
        mood     = h["mood_score"]
        confidence = h["confidence_score"]

    text_conf = None
    if text_features:
        text_conf = text_features.get("text_emotion_confidence", text_features.get("emotion_score"))
    audio_conf = audio_features.get("audio_emotion_confidence") if audio_features else None
    video_conf = video_features.get("video_emotion_confidence") if video_features else None

    text_integrity = float((text_features or {}).get("text_integrity_score", 1.0) or 1.0)
    audio_integrity = float((audio_features or {}).get("audio_integrity_score", 1.0) or 1.0)
    video_integrity = float((video_features or {}).get("video_integrity_score", 1.0) or 1.0)
    text_spoof = float((text_features or {}).get("text_spoof_risk", 0.0) or 0.0)
    audio_spoof = float((audio_features or {}).get("audio_spoof_risk", 0.0) or 0.0)
    video_spoof = float((video_features or {}).get("video_spoof_risk", 0.0) or 0.0)

    integrity_parts = []
    if text_features:
        integrity_parts.append((text_integrity, 0.4))
    if audio_features:
        integrity_parts.append((audio_integrity, 0.35))
    if video_features:
        integrity_parts.append((video_integrity, 0.25))
    if integrity_parts:
        denom = sum(w for _, w in integrity_parts)
        overall_integrity = sum(v * w for v, w in integrity_parts) / denom
    else:
        overall_integrity = 1.0

    overall_spoof_risk = _clamp(1.0 - overall_integrity)
    confidence = _clamp(confidence - overall_spoof_risk * 0.25)

    reliability_parts = []
    if text_conf is not None:
        reliability_parts.append((float(text_conf), 0.35))
    if audio_conf is not None:
        reliability_parts.append((float(audio_conf), 0.35))
    if video_conf is not None:
        reliability_parts.append((float(video_conf), 0.30))
    if reliability_parts:
        reliability_weight = sum(v * w for v, w in reliability_parts) / sum(w for _, w in reliability_parts)
        confidence = _clamp(confidence * (0.8 + 0.2 * reliability_weight))

    crisis_probability, calibration_source = calibrate_probability("crisis_score", crisis)
    distress_probability, distress_calibration_source = calibrate_probability(
        "emotional_distress_score",
        _clamp((stress + low_mood) / 2.0),
    )

    distress     = distress_probability
    crisis       = crisis_probability
    risk         = "high" if crisis >= 0.7 else ("medium" if crisis >= 0.4 else "low")
    wellness_f   = int(distress >= 0.5)
    crisis_f     = int(crisis >= 0.65)

    output_scores = {
        "stress_score": round(stress, 4),
        "low_mood_score": round(low_mood, 4),
        "burnout_score": round(burnout, 4),
        "social_withdrawal_score": round(soc_w, 4),
        "crisis_score": round(crisis, 4),
    }
    model_inputs = {
        k: round(float(v), 6)
        for k, v in feature_vector_to_dict(feat_vec).items()
    }
    dominance = explain_dominant_features(feat_vec, output_scores)

    return {
        "stress_score":               round(stress,   4),
        "low_mood_score":             round(low_mood, 4),
        "burnout_score":              round(burnout,  4),
        "social_withdrawal_score":    round(soc_w,    4),
        "crisis_score":               round(crisis,   4),
        "emotional_distress_score":   round(distress, 4),
        "final_risk_probability":     round(crisis, 4),
        "mood_score":                 round(mood,     4),
        "wellness_flag":              wellness_f,
        "crisis_flag":                crisis_f,
        "support_level":              risk,
        "final_risk_level":           risk,
        "confidence_score":           round(confidence, 4),
        "overall_integrity_score":    round(overall_integrity, 4),
        "overall_spoof_risk":         round(overall_spoof_risk, 4),
        "text_integrity_score":       round(text_integrity, 4) if text_features else None,
        "audio_integrity_score":      round(audio_integrity, 4) if audio_features else None,
        "video_integrity_score":      round(video_integrity, 4) if video_features else None,
        "text_spoof_risk":            round(text_spoof, 4) if text_features else None,
        "audio_spoof_risk":           round(audio_spoof, 4) if audio_features else None,
        "video_spoof_risk":           round(video_spoof, 4) if video_features else None,
        "text_confidence":            round(float(text_conf), 4) if text_conf is not None else None,
        "audio_confidence":           round(float(audio_conf), 4) if audio_conf is not None else None,
        "video_confidence":           round(float(video_conf), 4) if video_conf is not None else None,
        "scoring_source":             source,
        "calibration_source":         calibration_source,
        "distress_calibration_source": distress_calibration_source,
        "model_name":                 MODEL_NAME,
        "model_input_features":       model_inputs,
        "model_output_scores":        output_scores,
        "dominant_features":          dominance,
        "text_features":              text_features if text_features else None,
        "audio_features":             audio_features if audio_features else None,
        "video_features":             video_features if video_features else None,
        "text_emotion":  text_features.get("emotion")              if text_features  else None,
        "audio_emotion": audio_features.get("audio_emotion")       if audio_features else None,
        "video_emotion": video_features.get("video_emotion") if video_features else None,
    }


def _default_scores() -> Dict:
    return {
        "stress_score": 0.0, "low_mood_score": 0.0, "burnout_score": 0.0,
        "social_withdrawal_score": 0.0, "crisis_score": 0.0,
        "emotional_distress_score": 0.0, "mood_score": 0.5,
        "wellness_flag": 0, "crisis_flag": 0,
        "support_level": "low", "final_risk_level": "low",
        "confidence_score": 0.0, "scoring_source": "default",
        "overall_integrity_score": 1.0, "overall_spoof_risk": 0.0,
        "text_integrity_score": None, "audio_integrity_score": None, "video_integrity_score": None,
        "text_spoof_risk": None, "audio_spoof_risk": None, "video_spoof_risk": None,
        "text_confidence": None, "audio_confidence": None, "video_confidence": None,
        "model_name": MODEL_NAME,
        "model_input_features": {},
        "model_output_scores": {},
        "dominant_features": {},
        "text_features": None,
        "audio_features": None,
        "video_features": None,
        "text_emotion": None, "audio_emotion": None, "video_emotion": None,
    }
