"""Retrain or recalibrate the fusion NN from historical MindSentry data.

This script uses existing assessment history as a calibration signal when
explicit human labels are not available yet. It mixes historical feature/
output pairs with the synthetic training generator so the model keeps its
baseline coverage while adapting to current-user data distribution.

Usage:
    cd backend
    python retrain_nn.py

Optional arguments:
    --total-samples N      Total training samples to build (default: 6000)
    --real-weight F        Fraction of the training set reserved for real history
                           (default: 0.40)
    --history-limit N      Maximum historical runs to load (default: 5000)
"""
from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path
from typing import Iterable

import numpy as np
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler
from sqlmodel import Session, select

from app.core.database import engine
from app.models.extracted_feature import ExtractedFeature
from app.models.inference_run import InferenceRun
from app.models.risk_score import RiskScore
from app.services.fusion_nn import FEATURE_NAMES, OUTPUT_NAMES, build_feature_vector, feature_vector_to_dict
from train_nn import generate_dataset


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def _load_feature_json(session: Session, assessment_id: str, modality: str) -> dict | None:
    feature = session.exec(
        select(ExtractedFeature)
        .where(ExtractedFeature.assessment_id == assessment_id)
        .where(ExtractedFeature.modality_type == modality)
        .order_by(ExtractedFeature.computed_at.desc())
    ).first()
    if feature and feature.feature_json:
        try:
            return json.loads(feature.feature_json)
        except Exception:
            return None
    return None


def _load_history_samples(history_limit: int) -> tuple[np.ndarray, np.ndarray]:
    real_features: list[list[float]] = []
    real_targets: list[list[float]] = []

    with Session(engine) as session:
        runs: Iterable[InferenceRun] = session.exec(
            select(InferenceRun)
            .where(InferenceRun.run_status == "completed")
            .order_by(InferenceRun.created_at.desc())
        ).all()

        for run in list(runs)[:history_limit]:
            if not run.output_json:
                continue

            try:
                tracking = json.loads(run.output_json)
            except Exception:
                continue

            model_inputs = tracking.get("model_input_features") or {}
            if not model_inputs:
                text_feat = _load_feature_json(session, run.assessment_id, "text")
                audio_feat = _load_feature_json(session, run.assessment_id, "audio")
                video_feat = _load_feature_json(session, run.assessment_id, "video")
                q_feat = _load_feature_json(session, run.assessment_id, "questionnaire")
                questionnaire_data = q_feat
                if questionnaire_data is None:
                    questionnaire_data = None
                feature_vector, _ = build_feature_vector(text_feat, audio_feat, video_feat, questionnaire_data)
            else:
                feature_vector = [
                    _safe_float(model_inputs.get(name, 0.0), 0.0)
                    for name in FEATURE_NAMES
                ]

            targets = tracking.get("model_output_scores") or {}
            if not targets:
                risk_score = session.exec(
                    select(RiskScore).where(RiskScore.assessment_id == run.assessment_id)
                ).first()
                if risk_score:
                    targets = {
                        "stress_score": risk_score.stress_score,
                        "low_mood_score": risk_score.low_mood_score,
                        "burnout_score": risk_score.burnout_score,
                        "social_withdrawal_score": risk_score.social_withdrawal_score,
                        "crisis_score": risk_score.crisis_score,
                    }

            if not targets:
                continue

            target_vector = [_safe_float(targets.get(name, 0.0), 0.0) for name in OUTPUT_NAMES]
            real_features.append(feature_vector)
            real_targets.append(target_vector)

    if not real_features:
        return np.empty((0, len(FEATURE_NAMES))), np.empty((0, len(OUTPUT_NAMES)))

    return np.asarray(real_features, dtype=np.float32), np.asarray(real_targets, dtype=np.float32)


def _mix_real_and_synthetic(
    real_x: np.ndarray,
    real_y: np.ndarray,
    total_samples: int,
    real_weight: float,
) -> tuple[np.ndarray, np.ndarray]:
    synthetic_x, synthetic_y = generate_dataset(total_samples)

    if len(real_x) == 0:
        return synthetic_x, synthetic_y

    real_weight = max(0.05, min(0.9, real_weight))
    target_real = max(1, int(total_samples * real_weight))
    target_synth = max(1, total_samples - target_real)

    real_indices = np.random.default_rng(42).choice(len(real_x), size=target_real, replace=len(real_x) < target_real)
    synth_indices = np.random.default_rng(43).choice(len(synthetic_x), size=target_synth, replace=False)

    mixed_x = np.vstack([real_x[real_indices], synthetic_x[synth_indices]])
    mixed_y = np.vstack([real_y[real_indices], synthetic_y[synth_indices]])

    permutation = np.random.default_rng(44).permutation(len(mixed_x))
    return mixed_x[permutation], mixed_y[permutation]


def train(total_samples: int = 6000, real_weight: float = 0.4, history_limit: int = 5000) -> Path:
    print("\nMindSentry Fusion NN Retraining")
    print("=" * 48)

    print(f"\nLoading historical inference runs (limit={history_limit})...")
    real_x, real_y = _load_history_samples(history_limit)
    print(f"  Historical samples loaded: {len(real_x)}")

    print(f"\nBuilding mixed training set (real_weight={real_weight:.2f})...")
    x, y = _mix_real_and_synthetic(real_x, real_y, total_samples, real_weight)

    x_train, x_val, y_train, y_val = train_test_split(
        x, y, test_size=0.15, random_state=42
    )
    print(f"Train: {len(x_train)} samples  |  Val: {len(x_val)} samples")
    print(f"Input  shape: {x_train.shape[1]} features")
    print(f"Output shape: {y_train.shape[1]} targets")

    model = Pipeline([
        ("scaler", MinMaxScaler()),
        ("mlp", MLPRegressor(
            hidden_layer_sizes=(64, 32, 16),
            activation="relu",
            solver="adam",
            learning_rate_init=0.001,
            max_iter=800,
            early_stopping=True,
            validation_fraction=0.1,
            n_iter_no_change=30,
            random_state=42,
            verbose=False,
        )),
    ])

    print("\nTraining... (this can take a short while)")
    model.fit(x_train, y_train)
    iters = model.named_steps["mlp"].n_iter_
    print(f"  Converged in {iters} iterations")

    y_pred = model.predict(x_val)
    y_pred_c = np.clip(y_pred, 0.0, 1.0)
    mae = mean_absolute_error(y_val, y_pred_c)
    print(f"  Validation MAE: {mae:.4f}")

    output_names = ["stress", "low_mood", "burnout", "social_w", "crisis"]
    for i, name in enumerate(output_names):
        col_mae = mean_absolute_error(y_val[:, i], y_pred_c[:, i])
        print(f"    {name:20s}  MAE = {col_mae:.4f}")

    model_dir = Path(__file__).parent / "ml_models"
    model_dir.mkdir(exist_ok=True)
    model_path = model_dir / "fusion_nn.pkl"

    with open(model_path, "wb") as f:
        pickle.dump(model, f)

    size_kb = model_path.stat().st_size / 1024
    print(f"\n  Saved to: {model_path}  ({size_kb:.1f} KB)")
    print("  Restart the FastAPI server to activate the refreshed model.")
    return model_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Retrain MindSentry fusion NN from history + synthetic data")
    parser.add_argument("--total-samples", type=int, default=6000)
    parser.add_argument("--real-weight", type=float, default=0.4)
    parser.add_argument("--history-limit", type=int, default=5000)
    args = parser.parse_args()
    train(args.total_samples, args.real_weight, args.history_limit)
