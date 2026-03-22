"""
Analysis router – triggers fusion scoring and generates results.

Endpoints:
  POST /analysis/run/{assessment_id}          – run full fusion pipeline
  GET  /analysis/result/{assessment_id}       – get analysis result
  GET  /analysis/risk/{assessment_id}         – get risk scores
  GET  /analysis/safety/{assessment_id}       – get safety flags
  GET  /analysis/recommendations/{assessment_id} – get recommendations
"""
from __future__ import annotations
from typing import List
from datetime import datetime, timezone
import hashlib
import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
import json

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.assessment import Assessment
from app.models.text_entry import TextEntry
from app.models.audio_recording import AudioRecording
from app.models.video_recording import VideoRecording
from app.models.questionnaire import QuestionnaireResponse
from app.models.extracted_feature import ExtractedFeature
from app.models.analysis_result import AnalysisResult
from app.models.risk_score import RiskScore
from app.models.recommendation import Recommendation
from app.models.safety_flag import SafetyFlag
from app.models.inference_run import InferenceRun
from app.schemas.analysis import AnalysisResultResponse, RiskScoreResponse
from app.schemas.recommendation import RecommendationResponse, SafetyFlagResponse
from app.services.scoring_service import compute_scores
from app.services.recommendation_service import generate as generate_recommendations

router = APIRouter(prefix="/analysis", tags=["Analysis"])


def _load_feature_json(session: Session, assessment_id: str, modality: str) -> dict | None:
    feat = session.exec(
        select(ExtractedFeature)
        .where(ExtractedFeature.assessment_id == assessment_id)
        .where(ExtractedFeature.modality_type == modality)
        .order_by(ExtractedFeature.computed_at.desc())
    ).first()
    if feat and feat.feature_json:
        try:
            return json.loads(feat.feature_json)
        except Exception:
            pass
    return None


def _build_analysis_payload(session: Session, obj: AnalysisResult, scores: dict | None = None) -> dict:
    """Build response payload with per-modality confidences."""
    inference_tracking = None
    if scores is None:
        run = session.exec(
            select(InferenceRun)
            .where(InferenceRun.assessment_id == obj.assessment_id)
            .order_by(InferenceRun.created_at.desc())
        ).first()
        if run and run.output_json:
            try:
                inference_tracking = json.loads(run.output_json)
            except Exception:
                inference_tracking = None

    if scores is None:
        text_feat = _load_feature_json(session, obj.assessment_id, "text") or {}
        audio_feat = _load_feature_json(session, obj.assessment_id, "audio") or {}
        video_feat = _load_feature_json(session, obj.assessment_id, "video") or {}
        text_conf = text_feat.get("text_emotion_confidence", text_feat.get("emotion_score"))
        text_integrity_score = text_feat.get("text_integrity_score")
        text_spoof_risk = text_feat.get("text_spoof_risk")
        text_integrity_flags = text_feat.get("text_integrity_flags")
        audio_conf = audio_feat.get("audio_emotion_confidence")
        audio_integrity_score = audio_feat.get("audio_integrity_score")
        audio_spoof_risk = audio_feat.get("audio_spoof_risk")
        audio_integrity_flags = audio_feat.get("audio_integrity_flags")
        video_conf = video_feat.get("video_emotion_confidence")
        visual_input_type = video_feat.get("visual_input_type")
        visual_integrity_score = video_feat.get("visual_integrity_score")
        visual_spoof_risk = video_feat.get("visual_spoof_risk")
        visual_integrity_flags = video_feat.get("visual_integrity_flags")
        overall_integrity_score = (inference_tracking or {}).get("overall_integrity_score")
        overall_spoof_risk = (inference_tracking or {}).get("overall_spoof_risk")
    else:
        text_conf = scores.get("text_confidence")
        text_integrity_score = (scores.get("text_features") or {}).get("text_integrity_score")
        text_spoof_risk = (scores.get("text_features") or {}).get("text_spoof_risk")
        text_integrity_flags = (scores.get("text_features") or {}).get("text_integrity_flags")
        audio_conf = scores.get("audio_confidence")
        audio_integrity_score = (scores.get("audio_features") or {}).get("audio_integrity_score")
        audio_spoof_risk = (scores.get("audio_features") or {}).get("audio_spoof_risk")
        audio_integrity_flags = (scores.get("audio_features") or {}).get("audio_integrity_flags")
        video_conf = scores.get("video_confidence")
        visual_input_type = (scores.get("video_features") or {}).get("visual_input_type")
        visual_integrity_score = (scores.get("video_features") or {}).get("visual_integrity_score")
        visual_spoof_risk = (scores.get("video_features") or {}).get("visual_spoof_risk")
        visual_integrity_flags = (scores.get("video_features") or {}).get("visual_integrity_flags")
        overall_integrity_score = scores.get("overall_integrity_score")
        overall_spoof_risk = scores.get("overall_spoof_risk")
        inference_tracking = {
            "scoring_source": scores.get("scoring_source"),
            "model_name": scores.get("model_name"),
            "model_input_features": scores.get("model_input_features") or {},
            "model_output_scores": scores.get("model_output_scores") or {},
            "dominant_features": scores.get("dominant_features") or {},
            "overall_integrity_score": overall_integrity_score,
            "overall_spoof_risk": overall_spoof_risk,
        }

    stress_score = float(obj.stress_score or 0.0)
    mood_score = float(obj.mood_score or 0.0)
    wellness_score = int(round(((1.0 - stress_score) * 0.45 + mood_score * 0.55) * 100.0))

    return {
        "id": obj.id,
        "assessment_id": obj.assessment_id,
        "user_id": obj.user_id,
        "text_emotion": obj.text_emotion,
        "text_confidence": text_conf,
        "text_integrity_score": text_integrity_score,
        "text_spoof_risk": text_spoof_risk,
        "text_integrity_flags": text_integrity_flags,
        "audio_emotion": obj.audio_emotion,
        "audio_confidence": audio_conf,
        "audio_integrity_score": audio_integrity_score,
        "audio_spoof_risk": audio_spoof_risk,
        "audio_integrity_flags": audio_integrity_flags,
        "video_emotion": obj.video_emotion,
        "video_confidence": video_conf,
        "visual_input_type": visual_input_type,
        "visual_integrity_score": visual_integrity_score,
        "visual_spoof_risk": visual_spoof_risk,
        "visual_integrity_flags": visual_integrity_flags,
        "stress_score": obj.stress_score,
        "mood_score": obj.mood_score,
        "wellness_score": wellness_score,
        "emotional_distress_score": obj.emotional_distress_score,
        "wellness_flag": obj.wellness_flag,
        "support_level": obj.support_level,
        "crisis_flag": obj.crisis_flag,
        "confidence_score": obj.confidence_score,
        "overall_integrity_score": overall_integrity_score,
        "overall_spoof_risk": overall_spoof_risk,
        "scoring_source": (inference_tracking or {}).get("scoring_source"),
        "model_name": (inference_tracking or {}).get("model_name"),
        "model_input_features": (inference_tracking or {}).get("model_input_features"),
        "model_output_scores": (inference_tracking or {}).get("model_output_scores"),
        "dominant_features": (inference_tracking or {}).get("dominant_features"),
        "inference_tracking": inference_tracking,
        "created_at": obj.created_at,
    }


@router.post("/run/{assessment_id}", response_model=AnalysisResultResponse)
def run_analysis(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    assessment = session.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    # Load extracted features per modality
    text_feat = _load_feature_json(session, assessment_id, "text")
    audio_feat = _load_feature_json(session, assessment_id, "audio")
    video_feat = _load_feature_json(session, assessment_id, "video")

    # Build questionnaire data dict if available
    q_feat = _load_feature_json(session, assessment_id, "questionnaire")
    if q_feat:
        q_data = q_feat
    else:
        q_resp = session.exec(
            select(QuestionnaireResponse)
            .where(QuestionnaireResponse.assessment_id == assessment_id)
            .order_by(QuestionnaireResponse.submitted_at.desc())
        ).first()
        q_data = {"total_score": q_resp.total_score} if q_resp else None

    start = time.perf_counter()
    scores = compute_scores(
        text_features=text_feat,
        audio_features=audio_feat,
        video_features=video_feat,
        questionnaire_data=q_data,
    )
    latency_ms = int((time.perf_counter() - start) * 1000)

    model_input_features = scores.get("model_input_features") or {}
    hash_basis = json.dumps(model_input_features, sort_keys=True)
    input_hash = hashlib.sha256(hash_basis.encode("utf-8")).hexdigest()
    
    # Sanitize modality features to prevent PII leakage - only store aggregated scores and metadata
    sanitized_modalities = {}
    if text_feat:
        sanitized_modalities["text"] = {
            "feature_count": len(text_feat) if isinstance(text_feat, dict) else 0,
            "integrity_score": text_feat.get("integrity_score") if isinstance(text_feat, dict) else None,
        }
    if audio_feat:
        sanitized_modalities["audio"] = {
            "feature_count": len(audio_feat) if isinstance(audio_feat, dict) else 0,
            "integrity_score": audio_feat.get("integrity_score") if isinstance(audio_feat, dict) else None,
        }
    if video_feat:
        sanitized_modalities["video"] = {
            "feature_count": len(video_feat) if isinstance(video_feat, dict) else 0,
            "integrity_score": video_feat.get("integrity_score") if isinstance(video_feat, dict) else None,
        }
    if q_data:
        sanitized_modalities["questionnaire"] = {
            "total_score": q_data.get("total_score") if isinstance(q_data, dict) else None,
        }
    
    inference_tracking = {
        "scoring_source": scores.get("scoring_source"),
        "model_name": scores.get("model_name"),
        "overall_integrity_score": scores.get("overall_integrity_score"),
        "overall_spoof_risk": scores.get("overall_spoof_risk"),
        "input_modalities": sanitized_modalities,
        "model_input_features": model_input_features,
        "model_output_scores": scores.get("model_output_scores") or {},
        "dominant_features": scores.get("dominant_features") or {},
    }

    session.add(InferenceRun(
        assessment_id=assessment_id,
        input_snapshot_hash=input_hash,
        output_json=json.dumps(inference_tracking),
        confidence_score=scores.get("confidence_score"),
        latency_ms=latency_ms,
        run_status="completed",
    ))

    # Upsert AnalysisResult
    existing = session.exec(
        select(AnalysisResult).where(AnalysisResult.assessment_id == assessment_id)
    ).first()
    if existing:
        for k, v in scores.items():
            if hasattr(existing, k):
                setattr(existing, k, v)
        result_obj = existing
    else:
        result_obj = AnalysisResult(
            assessment_id=assessment_id,
            user_id=current_user.id,
            text_emotion=scores.get("text_emotion"),
            audio_emotion=scores.get("audio_emotion"),
            video_emotion=scores.get("video_emotion"),
            stress_score=scores.get("stress_score"),
            mood_score=scores.get("mood_score"),
            emotional_distress_score=scores.get("emotional_distress_score"),
            wellness_flag=scores.get("wellness_flag", 0),
            support_level=scores.get("support_level", "low"),
            crisis_flag=scores.get("crisis_flag", 0),
            confidence_score=scores.get("confidence_score"),
        )
        session.add(result_obj)

    # Upsert RiskScore
    existing_risk = session.exec(
        select(RiskScore).where(RiskScore.assessment_id == assessment_id)
    ).first()
    if existing_risk:
        for field in ("stress_score", "low_mood_score", "burnout_score",
                      "social_withdrawal_score", "crisis_score", "final_risk_level"):
            setattr(existing_risk, field, scores.get(field))
    else:
        session.add(RiskScore(
            assessment_id=assessment_id,
            user_id=current_user.id,
            stress_score=scores.get("stress_score"),
            low_mood_score=scores.get("low_mood_score"),
            burnout_score=scores.get("burnout_score"),
            social_withdrawal_score=scores.get("social_withdrawal_score"),
            crisis_score=scores.get("crisis_score"),
            final_risk_level=scores.get("final_risk_level", "low"),
        ))

    # Generate recommendations (replace previous ones)
    session.exec(
        select(Recommendation).where(Recommendation.assessment_id == assessment_id)
    )
    old_recs = session.exec(
        select(Recommendation).where(Recommendation.assessment_id == assessment_id)
    ).all()
    for r in old_recs:
        session.delete(r)

    for rec_data in generate_recommendations(assessment_id, current_user.id, scores):
        session.add(Recommendation(**rec_data))

    # Mark assessment complete
    assessment.status = "completed"
    assessment.completed_at = datetime.now(timezone.utc).isoformat()
    session.add(assessment)

    session.commit()
    session.refresh(result_obj)
    return _build_analysis_payload(session, result_obj, scores)


@router.get("/result/{assessment_id}", response_model=AnalysisResultResponse)
def get_result(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    obj = session.exec(
        select(AnalysisResult)
        .where(AnalysisResult.assessment_id == assessment_id)
        .where(AnalysisResult.user_id == current_user.id)
    ).first()
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Analysis result not found. Run /analysis/run first.")
    return _build_analysis_payload(session, obj)


@router.get("/risk/{assessment_id}", response_model=RiskScoreResponse)
def get_risk(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    obj = session.exec(
        select(RiskScore)
        .where(RiskScore.assessment_id == assessment_id)
        .where(RiskScore.user_id == current_user.id)
    ).first()
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Risk score not found")
    return obj


@router.get("/safety/{assessment_id}", response_model=List[SafetyFlagResponse])
def get_safety(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(SafetyFlag)
        .where(SafetyFlag.assessment_id == assessment_id)
        .where(SafetyFlag.user_id == current_user.id)
    ).all()


@router.get("/recommendations/{assessment_id}", response_model=List[RecommendationResponse])
def get_recommendations(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(Recommendation)
        .where(Recommendation.assessment_id == assessment_id)
        .where(Recommendation.user_id == current_user.id)
    ).all()


@router.get("/inference/{assessment_id}")
def get_inference_tracking(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    assessment = session.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    run = session.exec(
        select(InferenceRun)
        .where(InferenceRun.assessment_id == assessment_id)
        .order_by(InferenceRun.created_at.desc())
    ).first()
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Inference run not found")

    payload = {}
    if run.output_json:
        try:
            payload = json.loads(run.output_json)
        except Exception:
            payload = {"raw": run.output_json}

    return {
        "assessment_id": assessment_id,
        "created_at": run.created_at,
        "latency_ms": run.latency_ms,
        "confidence_score": run.confidence_score,
        "input_snapshot_hash": run.input_snapshot_hash,
        "run_status": run.run_status,
        "tracking": payload,
    }
