from __future__ import annotations

from typing import Dict, List, Tuple

from sqlmodel import Session, select

from app.models.questionnaire import QuestionnaireQuestion, QuestionnaireTemplate

DAILY_CHECKIN_TEMPLATE_CODE = "daily_checkin_v1"
DAILY_CHECKIN_TEMPLATE_VERSION = "1.0"

DAILY_CHECKIN_QUESTIONS: List[dict] = [
    {
        "question_code": "mood_overall",
        "question_text": "How would you describe your overall mood today?",
        "response_type": "single_choice",
        "display_order": 1,
        "is_required": 1,
    },
    {
        "question_code": "sleep_quality",
        "question_text": "How was your sleep quality last night?",
        "response_type": "single_choice",
        "display_order": 2,
        "is_required": 1,
    },
    {
        "question_code": "stress_load",
        "question_text": "How intense was your stress today?",
        "response_type": "single_choice",
        "display_order": 3,
        "is_required": 1,
    },
    {
        "question_code": "focus_consistency",
        "question_text": "How consistent was your focus during work or study?",
        "response_type": "single_choice",
        "display_order": 4,
        "is_required": 1,
    },
    {
        "question_code": "social_energy",
        "question_text": "How connected and supported did you feel today?",
        "response_type": "single_choice",
        "display_order": 5,
        "is_required": 1,
    },
    {
        "question_code": "physical_energy",
        "question_text": "How was your physical energy through the day?",
        "response_type": "single_choice",
        "display_order": 6,
        "is_required": 1,
    },
    {
        "question_code": "day_summary",
        "question_text": "What did you do throughout the day?",
        "response_type": "free_text",
        "display_order": 7,
        "is_required": 1,
    },
    {
        "question_code": "food_summary",
        "question_text": "What did you eat and drink today?",
        "response_type": "free_text",
        "display_order": 8,
        "is_required": 0,
    },
]


def ensure_daily_checkin_template(session: Session) -> Tuple[QuestionnaireTemplate, List[QuestionnaireQuestion]]:
    template = session.exec(
        select(QuestionnaireTemplate).where(QuestionnaireTemplate.code == DAILY_CHECKIN_TEMPLATE_CODE)
    ).first()

    if not template:
        template = QuestionnaireTemplate(
            name="Daily Wellness Check-in",
            code=DAILY_CHECKIN_TEMPLATE_CODE,
            version=DAILY_CHECKIN_TEMPLATE_VERSION,
            description="Core self-report questionnaire for daily wellness check-ins.",
            scoring_method="distress_weighted_sum",
            is_active=1,
        )
        session.add(template)
        session.flush()

    existing_questions = session.exec(
        select(QuestionnaireQuestion)
        .where(QuestionnaireQuestion.template_id == template.id)
        .order_by(QuestionnaireQuestion.display_order)
    ).all()
    questions_by_code: Dict[str, QuestionnaireQuestion] = {
        question.question_code: question for question in existing_questions if question.question_code
    }

    changed = False
    for definition in DAILY_CHECKIN_QUESTIONS:
        current = questions_by_code.get(definition["question_code"])
        if current:
            current.question_text = definition["question_text"]
            current.response_type = definition["response_type"]
            current.display_order = definition["display_order"]
            current.is_required = definition["is_required"]
            session.add(current)
            continue

        changed = True
        session.add(
            QuestionnaireQuestion(
                template_id=template.id,
                question_code=definition["question_code"],
                question_text=definition["question_text"],
                response_type=definition["response_type"],
                display_order=definition["display_order"],
                is_required=definition["is_required"],
            )
        )

    if changed:
        session.flush()

    questions = session.exec(
        select(QuestionnaireQuestion)
        .where(QuestionnaireQuestion.template_id == template.id)
        .order_by(QuestionnaireQuestion.display_order)
    ).all()
    return template, questions
