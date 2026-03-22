"""
Questionnaire router.

Endpoints:
  GET  /questionnaires/templates              – list active templates
  GET  /questionnaires/templates/{id}         – get one template with questions
  POST /questionnaires/submit                 – submit response (with items)
  GET  /questionnaires/responses/{assessment_id} – get response for assessment
"""
from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.assessment import Assessment
from app.models.questionnaire import (
    QuestionnaireTemplate, QuestionnaireQuestion,
    QuestionnaireResponse, QuestionnaireResponseItem,
)
from app.models.extracted_feature import ExtractedFeature
from app.schemas.questionnaire import (
    QuestionnaireTemplateResponse, QuestionnaireQuestionResponse,
    QuestionnaireResponseCreate, QuestionnaireResponseOut,
)
import json

router = APIRouter(prefix="/questionnaires", tags=["Questionnaires"])


@router.get("/templates", response_model=List[QuestionnaireTemplateResponse])
def list_templates(session: Session = Depends(get_session)):
    return session.exec(
        select(QuestionnaireTemplate).where(QuestionnaireTemplate.is_active == 1)
    ).all()


@router.get("/templates/{template_id}/questions", response_model=List[QuestionnaireQuestionResponse])
def get_questions(template_id: str, session: Session = Depends(get_session)):
    questions = session.exec(
        select(QuestionnaireQuestion)
        .where(QuestionnaireQuestion.template_id == template_id)
        .order_by(QuestionnaireQuestion.display_order)
    ).all()
    if not questions:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Template or questions not found")
    return questions


@router.post("/submit", response_model=QuestionnaireResponseOut, status_code=status.HTTP_201_CREATED)
def submit_questionnaire(
    data: QuestionnaireResponseCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    assessment = session.get(Assessment, data.assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    # Compute total score from items
    total = sum(i.scored_value or 0.0 for i in data.items if i.scored_value is not None)

    response = QuestionnaireResponse(
        assessment_id=data.assessment_id,
        template_id=data.template_id,
        total_score=total,
    )
    session.add(response)
    session.flush()  # get response.id

    for item_data in data.items:
        item = QuestionnaireResponseItem(
            questionnaire_response_id=response.id,
            question_id=item_data.question_id,
            answer_value=item_data.answer_value,
            answer_text=item_data.answer_text,
            scored_value=item_data.scored_value,
        )
        session.add(item)

    # Persist questionnaire modality features so fusion consumes a stored modality output,
    # just like text/audio/video extracted features.
    q_features = {
        "total_score": float(total),
        "item_count": len(data.items),
        "scored_item_count": sum(1 for i in data.items if i.scored_value is not None),
    }
    session.add(ExtractedFeature(
        assessment_id=data.assessment_id,
        modality_type="questionnaire",
        feature_namespace="questionnaire",
        feature_json=json.dumps(q_features),
        extractor_name="questionnaire-aggregator",
        extractor_version="1.0",
    ))

    session.commit()
    session.refresh(response)
    return response


@router.get("/responses/{assessment_id}", response_model=QuestionnaireResponseOut)
def get_response(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    resp = session.exec(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.assessment_id == assessment_id)
    ).first()
    if not resp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Questionnaire response not found")
    return resp
