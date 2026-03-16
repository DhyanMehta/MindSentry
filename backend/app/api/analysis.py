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
from datetime import datetime
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
    ).first()
    if feat and feat.feature_json:
        try:
            return json.loads(feat.feature_json)
        except Exception:
            pass
    return None


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
    q_resp = session.exec(
        select(QuestionnaireResponse).where(QuestionnaireResponse.assessment_id == assessment_id)
    ).first()
    q_data = {"total_score": q_resp.total_score} if q_resp else None

    scores = compute_scores(
        text_features=text_feat,
        audio_features=audio_feat,
        video_features=video_feat,
        questionnaire_data=q_data,
    )

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
    assessment.completed_at = datetime.utcnow().isoformat()
    session.add(assessment)

    session.commit()
    session.refresh(result_obj)
    return result_obj


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
    return obj


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
