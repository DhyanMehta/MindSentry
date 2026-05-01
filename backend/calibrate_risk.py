"""Train isotonic probability calibrators for final risk outputs.

This uses historical inference outputs and questionnaire totals as an
available proxy target for probability calibration.

Usage:
    cd backend
    python calibrate_risk.py
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sqlmodel import Session, select

from app.core.database import engine
from app.models.extracted_feature import ExtractedFeature
from app.models.inference_run import InferenceRun


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def _load_questionnaire_target(session: Session, assessment_id: str) -> float | None:
    row = session.exec(
        select(ExtractedFeature)
        .where(ExtractedFeature.assessment_id == assessment_id)
        .where(ExtractedFeature.modality_type == "questionnaire")
        .order_by(ExtractedFeature.computed_at.desc())
    ).first()
    if not row or not row.feature_json:
        return None
    try:
        payload = json.loads(row.feature_json)
    except Exception:
        return None

    total = payload.get("total_score")
    if total is None:
        return None
    # Typical daily check-in score space in this project is ~0..40
    return _clamp(float(total) / 40.0)


def train() -> Path | None:
    x_crisis = []
    x_distress = []
    y_target = []

    with Session(engine) as session:
        runs = session.exec(
            select(InferenceRun)
            .where(InferenceRun.run_status == "completed")
            .order_by(InferenceRun.created_at.desc())
        ).all()

        for run in runs:
            if not run.output_json:
                continue
            try:
                payload = json.loads(run.output_json)
            except Exception:
                continue

            outputs = payload.get("model_output_scores") or {}
            crisis = outputs.get("crisis_score")
            distress = outputs.get("emotional_distress_score", outputs.get("low_mood_score"))
            if crisis is None or distress is None:
                continue

            target = _load_questionnaire_target(session, run.assessment_id)
            if target is None:
                continue

            x_crisis.append(_clamp(crisis))
            x_distress.append(_clamp(distress))
            y_target.append(target)

    if len(y_target) < 15:
        print(f"Not enough samples for calibration: {len(y_target)} (need >= 15)")
        return None

    y = np.asarray(y_target, dtype=np.float32)
    crisis_cal = IsotonicRegression(out_of_bounds="clip")
    distress_cal = IsotonicRegression(out_of_bounds="clip")
    crisis_cal.fit(np.asarray(x_crisis, dtype=np.float32), y)
    distress_cal.fit(np.asarray(x_distress, dtype=np.float32), y)

    model = {
        "crisis_score": crisis_cal,
        "emotional_distress_score": distress_cal,
        "sample_count": len(y_target),
        "target": "questionnaire_total_norm",
    }

    model_path = Path(__file__).parent / "ml_models" / "risk_calibration.pkl"
    model_path.parent.mkdir(exist_ok=True)
    with open(model_path, "wb") as f:
        pickle.dump(model, f)

    print(f"Saved calibrator to: {model_path}")
    print(f"Sample count: {len(y_target)}")
    return model_path


if __name__ == "__main__":
    train()
