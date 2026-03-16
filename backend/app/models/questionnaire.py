"""
Questionnaire-related models:
  - questionnaire_templates
  - questionnaire_questions
  - questionnaire_responses
  - questionnaire_response_items
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, CheckConstraint, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class QuestionnaireTemplate(Base):
    __tablename__ = "questionnaire_templates"
    __table_args__ = (
        CheckConstraint("is_active IN (0,1)", name="ck_qt_active"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    name = Column(String(128))
    code = Column(String(32))
    version = Column(String(16))
    description = Column(Text, nullable=True)
    scoring_method = Column(String(64), nullable=True)
    is_active = Column(Integer, default=1)

    questions = relationship("QuestionnaireQuestion", back_populates="template", cascade="all, delete-orphan")
    responses = relationship("QuestionnaireResponse", back_populates="template")


class QuestionnaireQuestion(Base):
    __tablename__ = "questionnaire_questions"
    __table_args__ = (
        CheckConstraint("is_required IN (0,1)", name="ck_qq_required"),
        Index("idx_questionnaire_questions_template_id", "template_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    template_id = Column(String(32), ForeignKey("questionnaire_templates.id"), nullable=False)
    question_code = Column(String(32))
    question_text = Column(Text)
    response_type = Column(String(32))
    display_order = Column(Integer, default=0)
    is_required = Column(Integer, default=1)

    template = relationship("QuestionnaireTemplate", back_populates="questions")
    response_items = relationship("QuestionnaireResponseItem", back_populates="question")


class QuestionnaireResponse(Base):
    __tablename__ = "questionnaire_responses"
    __table_args__ = (
        Index("idx_questionnaire_responses_assessment_id", "assessment_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    assessment_id = Column(String(32), ForeignKey("assessments.id"), nullable=False)
    template_id = Column(String(32), ForeignKey("questionnaire_templates.id"), nullable=False)
    total_score = Column(Float, nullable=True)
    severity_band = Column(String(32), nullable=True)
    submitted_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())

    assessment = relationship("Assessment", back_populates="questionnaire_responses")
    template = relationship("QuestionnaireTemplate", back_populates="responses")
    items = relationship("QuestionnaireResponseItem", back_populates="response", cascade="all, delete-orphan")


class QuestionnaireResponseItem(Base):
    __tablename__ = "questionnaire_response_items"
    __table_args__ = (
        Index("idx_questionnaire_response_items_response_id", "questionnaire_response_id"),
    )

    id = Column(String(32), primary_key=True, default=_uuid)
    questionnaire_response_id = Column(String(32), ForeignKey("questionnaire_responses.id"), nullable=False)
    question_id = Column(String(32), ForeignKey("questionnaire_questions.id"), nullable=False)
    answer_value = Column(String(256), nullable=True)
    answer_text = Column(Text, nullable=True)
    scored_value = Column(Float, nullable=True)

    response = relationship("QuestionnaireResponse", back_populates="items")
    question = relationship("QuestionnaireQuestion", back_populates="response_items")
