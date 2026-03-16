"""
MindSentry Fusion Neural Network Training Script
=================================================
Generates synthetic training data covering 5 wellness archetypes,
then trains a sklearn MLPRegressor and saves it to ml_models/fusion_nn.pkl.

Usage:
    cd backend
    python train_nn.py

Requirements:
    pip install scikit-learn numpy

The model is automatically used by scoring_service.py on the next server
restart.  If this script has not been run yet, scoring falls back to the
built-in heuristic — the API still works.
"""
import numpy as np
import pickle
from pathlib import Path
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error


# ── Reproducibility ───────────────────────────────────────────
RNG = np.random.default_rng(42)

# ── Feature / output index constants ──────────────────────────
# Input  (15 features — matches fusion_nn.py FEATURE_NAMES)
IDX_TEXT_STRESS   = 0
IDX_TEXT_MOOD     = 1
IDX_AUDIO_STRESS  = 2
IDX_AUDIO_SIL     = 3
IDX_AUDIO_RMS     = 4
IDX_VIDEO_FACE    = 5
IDX_VIDEO_LIGHT   = 6
IDX_Q_STRESS      = 7
IDX_Q_MOOD        = 8
IDX_Q_SLEEP_PEN   = 9
IDX_HAS_TEXT      = 10
IDX_HAS_AUDIO     = 11
IDX_HAS_VIDEO     = 12
IDX_HAS_Q         = 13
IDX_N_MOD         = 14

# Output (5 targets)
OUT_STRESS    = 0
OUT_LOW_MOOD  = 1
OUT_BURNOUT   = 2
OUT_SOC_W     = 3
OUT_CRISIS    = 4


def _noise(sigma: float = 0.04) -> float:
    return float(RNG.normal(0, sigma))


def _sample_scenario(scenario: str, n: int) -> tuple[np.ndarray, np.ndarray]:
    """Generate n samples for a given wellness archetype."""
    X = np.zeros((n, 15))
    y = np.zeros((n, 5))

    if scenario == "healthy":
        for i in range(n):
            has = RNG.choice([True, False], size=4, p=[0.85, 0.15])
            t_stress = max(0.0, RNG.uniform(0.05, 0.25) + _noise())
            t_mood   = max(0.0, RNG.uniform(0.70, 0.95) + _noise())
            X[i] = [
                t_stress, t_mood,
                max(0, RNG.uniform(0.05, 0.25) + _noise()), # audio_stress
                max(0, RNG.uniform(0.00, 0.15) + _noise()), # audio_silence
                max(0, RNG.uniform(0.30, 0.70) + _noise()), # audio_rms_norm
                max(0, RNG.uniform(0.70, 1.00) + _noise()), # video_face
                max(0, RNG.uniform(0.65, 1.00) + _noise()), # video_lighting
                max(0, RNG.uniform(0.05, 0.30) + _noise()), # q_stress
                max(0, RNG.uniform(0.70, 0.95) + _noise()), # q_mood
                max(0, RNG.uniform(0.00, 0.15) + _noise()), # q_sleep_pen
                float(has[0]), float(has[1]), float(has[2]), float(has[3]),
                sum(has) / 4.0,
            ]
            y[i] = [
                max(0, RNG.uniform(0.05, 0.25) + _noise()),  # stress
                max(0, RNG.uniform(0.05, 0.25) + _noise()),  # low_mood
                max(0, RNG.uniform(0.05, 0.20) + _noise()),  # burnout
                max(0, RNG.uniform(0.00, 0.10) + _noise()),  # social_w
                max(0, RNG.uniform(0.00, 0.10) + _noise()),  # crisis
            ]

    elif scenario == "mildly_stressed":
        for i in range(n):
            has = RNG.choice([True, False], size=4, p=[0.75, 0.25])
            X[i] = [
                max(0, RNG.uniform(0.35, 0.60) + _noise()),
                max(0, RNG.uniform(0.40, 0.65) + _noise()),
                max(0, RNG.uniform(0.30, 0.55) + _noise()),
                max(0, RNG.uniform(0.15, 0.35) + _noise()),
                max(0, RNG.uniform(0.25, 0.55) + _noise()),
                max(0, RNG.uniform(0.50, 0.85) + _noise()),
                max(0, RNG.uniform(0.45, 0.75) + _noise()),
                max(0, RNG.uniform(0.35, 0.60) + _noise()),
                max(0, RNG.uniform(0.40, 0.65) + _noise()),
                max(0, RNG.uniform(0.10, 0.35) + _noise()),
                float(has[0]), float(has[1]), float(has[2]), float(has[3]),
                sum(has) / 4.0,
            ]
            y[i] = [
                max(0, RNG.uniform(0.35, 0.60) + _noise()),
                max(0, RNG.uniform(0.35, 0.60) + _noise()),
                max(0, RNG.uniform(0.30, 0.55) + _noise()),
                max(0, RNG.uniform(0.10, 0.25) + _noise()),
                max(0, RNG.uniform(0.20, 0.40) + _noise()),
            ]

    elif scenario == "anxious_depressed":
        for i in range(n):
            has = RNG.choice([True, False], size=4, p=[0.70, 0.30])
            X[i] = [
                max(0, RNG.uniform(0.55, 0.80) + _noise()),
                max(0, RNG.uniform(0.20, 0.45) + _noise()),
                max(0, RNG.uniform(0.50, 0.75) + _noise()),
                max(0, RNG.uniform(0.40, 0.70) + _noise()),
                max(0, RNG.uniform(0.10, 0.35) + _noise()),
                max(0, RNG.uniform(0.30, 0.65) + _noise()),
                max(0, RNG.uniform(0.30, 0.60) + _noise()),
                max(0, RNG.uniform(0.55, 0.80) + _noise()),
                max(0, RNG.uniform(0.20, 0.45) + _noise()),
                max(0, RNG.uniform(0.35, 0.65) + _noise()),
                float(has[0]), float(has[1]), float(has[2]), float(has[3]),
                sum(has) / 4.0,
            ]
            y[i] = [
                max(0, RNG.uniform(0.55, 0.80) + _noise()),
                max(0, RNG.uniform(0.55, 0.80) + _noise()),
                max(0, RNG.uniform(0.50, 0.75) + _noise()),
                max(0, RNG.uniform(0.25, 0.50) + _noise()),
                max(0, RNG.uniform(0.40, 0.65) + _noise()),
            ]

    elif scenario == "burnt_out":
        for i in range(n):
            has = RNG.choice([True, False], size=4, p=[0.65, 0.35])
            X[i] = [
                max(0, RNG.uniform(0.50, 0.75) + _noise()),
                max(0, RNG.uniform(0.10, 0.35) + _noise()),
                max(0, RNG.uniform(0.45, 0.70) + _noise()),
                max(0, RNG.uniform(0.50, 0.80) + _noise()),
                max(0, RNG.uniform(0.05, 0.25) + _noise()),
                max(0, RNG.uniform(0.15, 0.45) + _noise()),
                max(0, RNG.uniform(0.20, 0.50) + _noise()),
                max(0, RNG.uniform(0.50, 0.75) + _noise()),
                max(0, RNG.uniform(0.10, 0.35) + _noise()),
                max(0, RNG.uniform(0.50, 0.80) + _noise()),
                float(has[0]), float(has[1]), float(has[2]), float(has[3]),
                sum(has) / 4.0,
            ]
            y[i] = [
                max(0, RNG.uniform(0.60, 0.85) + _noise()),
                max(0, RNG.uniform(0.65, 0.90) + _noise()),
                max(0, RNG.uniform(0.65, 0.90) + _noise()),
                max(0, RNG.uniform(0.45, 0.70) + _noise()),
                max(0, RNG.uniform(0.50, 0.75) + _noise()),
            ]

    elif scenario == "crisis":
        for i in range(n):
            has = RNG.choice([True, False], size=4, p=[0.60, 0.40])
            X[i] = [
                max(0, RNG.uniform(0.78, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.00, 0.22) + _noise(0.02)),
                max(0, RNG.uniform(0.70, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.65, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.00, 0.15) + _noise(0.02)),
                max(0, RNG.uniform(0.00, 0.25) + _noise(0.02)),
                max(0, RNG.uniform(0.10, 0.35) + _noise(0.02)),
                max(0, RNG.uniform(0.78, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.00, 0.22) + _noise(0.02)),
                max(0, RNG.uniform(0.65, 1.00) + _noise(0.02)),
                float(has[0]), float(has[1]), float(has[2]), float(has[3]),
                sum(has) / 4.0,
            ]
            y[i] = [
                max(0, RNG.uniform(0.78, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.78, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.75, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.60, 0.90) + _noise(0.02)),
                max(0, RNG.uniform(0.70, 1.00) + _noise(0.02)),
            ]

    # Clip all values to [0, 1]
    X = np.clip(X, 0.0, 1.0)
    y = np.clip(y, 0.0, 1.0)
    return X, y


def generate_dataset(total: int = 6000) -> tuple[np.ndarray, np.ndarray]:
    """
    Build the full training set from 5 scenarios.

    Distribution (proportions):
        healthy          25 %
        mildly_stressed  20 %
        anxious_depressed 20 %
        burnt_out        15 %
        crisis           20 %
    """
    scenarios = {
        "healthy":           int(total * 0.25),
        "mildly_stressed":   int(total * 0.20),
        "anxious_depressed": int(total * 0.20),
        "burnt_out":         int(total * 0.15),
        "crisis":            int(total * 0.20),
    }

    all_X, all_y = [], []
    for name, n in scenarios.items():
        Xs, ys = _sample_scenario(name, n)
        all_X.append(Xs)
        all_y.append(ys)
        print(f"  Generated {n:4d} samples  [{name}]")

    X = np.vstack(all_X)
    y = np.vstack(all_y)

    # Shuffle
    idx = RNG.permutation(len(X))
    return X[idx], y[idx]


def train(total_samples: int = 6000):
    print("\nMindSentry Fusion NN Training")
    print("=" * 45)

    # ── Data ──────────────────────────────────────────────────
    print(f"\nGenerating {total_samples} synthetic samples...")
    X, y = generate_dataset(total_samples)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.15, random_state=42
    )
    print(f"\nTrain: {len(X_train)} samples  |  Val: {len(X_val)} samples")
    print(f"Input  shape: {X_train.shape[1]} features")
    print(f"Output shape: {y_train.shape[1]} targets")

    # ── Model ─────────────────────────────────────────────────
    print("\nBuilding sklearn MLPRegressor pipeline...")
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

    # ── Training ──────────────────────────────────────────────
    print("Training... (this takes ~10-20 seconds)")
    model.fit(X_train, y_train)
    iters = model.named_steps["mlp"].n_iter_
    print(f"  Converged in {iters} iterations")

    # ── Evaluation ────────────────────────────────────────────
    y_pred = model.predict(X_val)
    y_pred_c = np.clip(y_pred, 0.0, 1.0)
    mae = mean_absolute_error(y_val, y_pred_c)
    print(f"  Validation MAE: {mae:.4f}  (lower is better; <0.05 is great)")

    output_names = ["stress", "low_mood", "burnout", "social_w", "crisis"]
    for i, name in enumerate(output_names):
        col_mae = mean_absolute_error(y_val[:, i], y_pred_c[:, i])
        print(f"    {name:20s}  MAE = {col_mae:.4f}")

    # ── Save ──────────────────────────────────────────────────
    model_dir = Path(__file__).parent / "ml_models"
    model_dir.mkdir(exist_ok=True)
    model_path = model_dir / "fusion_nn.pkl"

    with open(model_path, "wb") as f:
        pickle.dump(model, f)

    size_kb = model_path.stat().st_size / 1024
    print(f"\n  Saved to: {model_path}  ({size_kb:.1f} KB)")
    print("\n  The scoring service will automatically use this model.")
    print("  Restart the FastAPI server to activate it.")


if __name__ == "__main__":
    train()
