"""
Questionnaire router.

Endpoints:
  GET  /questionnaires/templates              - list active templates
  GET  /questionnaires/templates/{id}         - get one template with questions
  POST /questionnaires/submit                 - submit response (with items)
  GET  /questionnaires/responses/{assessment_id} - get response for assessment
"""
from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
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
from app.services.assessment_scope_service import get_user_assessment_or_404
from app.services.questionnaire_catalog_service import ensure_daily_checkin_template

router = APIRouter(prefix="/questionnaires", tags=["Questionnaires"])


@router.get("/templates", response_model=List[QuestionnaireTemplateResponse])
def list_templates(session: Session = Depends(get_session)):
    ensure_daily_checkin_template(session)
    return session.exec(
        select(QuestionnaireTemplate).where(QuestionnaireTemplate.is_active == 1)
    ).all()


@router.get("/templates/{template_id}/questions", response_model=List[QuestionnaireQuestionResponse])
def get_questions(template_id: str, session: Session = Depends(get_session)):
    ensure_daily_checkin_template(session)
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
    assessment = get_user_assessment_or_404(session, data.assessment_id, current_user)
    template, _ = ensure_daily_checkin_template(session)

    if data.template_id != template.id:
        valid_template = session.get(QuestionnaireTemplate, data.template_id)
        if not valid_template or valid_template.id != data.template_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Questionnaire template not found")

    total = sum(i.scored_value or 0.0 for i in data.items if i.scored_value is not None)

    response = session.exec(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.assessment_id == data.assessment_id)
        .where(QuestionnaireResponse.template_id == data.template_id)
    ).first()
    if response:
        for existing_item in list(response.items):
            session.delete(existing_item)
        response.total_score = total
        session.add(response)
        session.flush()
    else:
        response = QuestionnaireResponse(
            assessment_id=data.assessment_id,
            template_id=data.template_id,
            total_score=total,
        )
        session.add(response)
        session.flush()

    question_map = {
        question.id: question
        for question in session.exec(
            select(QuestionnaireQuestion).where(QuestionnaireQuestion.template_id == data.template_id)
        ).all()
    }
    item_summaries = []
    for item_data in data.items:
        item = QuestionnaireResponseItem(
            questionnaire_response_id=response.id,
            question_id=item_data.question_id,
            answer_value=item_data.answer_value,
            answer_text=item_data.answer_text,
            scored_value=item_data.scored_value,
        )
        session.add(item)
        question = question_map.get(item_data.question_id)
        item_summaries.append({
            "question_id": item_data.question_id,
            "question_code": question.question_code if question else None,
            "response_type": question.response_type if question else None,
            "answer_value": item_data.answer_value,
            "answer_text": item_data.answer_text,
            "scored_value": item_data.scored_value,
        })

    q_features = {
        "template_id": data.template_id,
        "template_code": template.code if data.template_id == template.id else None,
        "total_score": float(total),
        "item_count": len(data.items),
        "scored_item_count": sum(1 for i in data.items if i.scored_value is not None),
        "items": item_summaries,
        "items_by_code": {
            item["question_code"]: {
                "answer_value": item["answer_value"],
                "answer_text": item["answer_text"],
                "scored_value": item["scored_value"],
            }
            for item in item_summaries
            if item.get("question_code")
        },
    }
    feature = session.exec(
        select(ExtractedFeature)
        .where(ExtractedFeature.assessment_id == data.assessment_id)
        .where(ExtractedFeature.modality_type == "questionnaire")
        .order_by(ExtractedFeature.computed_at.desc())
    ).first()
    if feature:
        feature.feature_namespace = "questionnaire"
        feature.feature_json = json.dumps(q_features)
        feature.extractor_name = "questionnaire-aggregator"
        feature.extractor_version = "2.0"
        session.add(feature)
    else:
        session.add(ExtractedFeature(
            assessment_id=data.assessment_id,
            modality_type="questionnaire",
            feature_namespace="questionnaire",
            feature_json=json.dumps(q_features),
            extractor_name="questionnaire-aggregator",
            extractor_version="2.0",
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
    get_user_assessment_or_404(session, assessment_id, current_user)
    resp = session.exec(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.assessment_id == assessment_id)
    ).first()
    if not resp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Questionnaire response not found")
    return resp
