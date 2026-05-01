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

# ── Feature index constants (MUST match fusion_nn.py FEATURE_NAMES) ──
# 17 features total:
#  0  text_stress            0-1  stress derived from text emotion
#  1  text_mood              0-1  mood derived from text emotion
#  2  audio_stress           0-1  derived from audio SER emotion label
#  3  audio_silence          0-1  proportion of silence frames
#  4  audio_rms_norm         0-1  RMS energy normalised to [0,1]
#  5  audio_emotion_valence  0-1  audio emotion mapped to valence
#  6  video_face             0-1  fraction of frames with face detected (data quality)
#  7  video_lighting         0-1  average frame brightness
#  8  video_emotion_valence  0-1  video emotion mapped to valence
#  9  q_stress               0-1  questionnaire stress_level / 10
# 10  q_mood                 0-1  questionnaire mood_level / 10
# 11  q_sleep_pen            0-1  sleep deprivation penalty
# 12  has_text               0/1  text modality present
# 13  has_audio              0/1  audio modality present
# 14  has_video              0/1  video modality present
# 15  has_q                  0/1  questionnaire modality present
# 16  n_modalities           0-1  count of available modalities / 4
N_FEATURES = 17

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
    X = np.zeros((n, N_FEATURES))
    y = np.zeros((n, 5))

    if scenario == "healthy":
        for i in range(n):
            has = RNG.choice([True, False], size=4, p=[0.85, 0.15])
            t_stress = max(0.0, RNG.uniform(0.05, 0.25) + _noise())
            t_mood   = max(0.0, RNG.uniform(0.70, 0.95) + _noise())
            audio_emo_val = max(0.0, RNG.uniform(0.70, 0.95) + _noise())  # happy/calm
            video_emo_val = max(0.0, RNG.uniform(0.60, 0.95) + _noise())  # happy/neutral
            audio_stress  = max(0.0, 1.0 - audio_emo_val + _noise(0.02))  # low stress
            X[i] = [
                t_stress, t_mood,
                audio_stress,                                       # audio_stress (from emotion)
                max(0, RNG.uniform(0.00, 0.15) + _noise()),        # audio_silence
                max(0, RNG.uniform(0.30, 0.70) + _noise()),        # audio_rms_norm
                audio_emo_val,                                      # audio_emotion_valence
                max(0, RNG.uniform(0.70, 1.00) + _noise()),        # video_face (data quality)
                max(0, RNG.uniform(0.65, 1.00) + _noise()),        # video_lighting
                video_emo_val,                                      # video_emotion_valence
                max(0, RNG.uniform(0.05, 0.30) + _noise()),        # q_stress
                max(0, RNG.uniform(0.70, 0.95) + _noise()),        # q_mood
                max(0, RNG.uniform(0.00, 0.15) + _noise()),        # q_sleep_pen
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
            audio_emo_val = max(0.0, RNG.uniform(0.35, 0.60) + _noise())
            video_emo_val = max(0.0, RNG.uniform(0.35, 0.60) + _noise())
            audio_stress  = max(0.0, 1.0 - audio_emo_val + _noise(0.03))
            X[i] = [
                max(0, RNG.uniform(0.35, 0.60) + _noise()),        # text_stress
                max(0, RNG.uniform(0.40, 0.65) + _noise()),        # text_mood
                audio_stress,                                       # audio_stress
                max(0, RNG.uniform(0.15, 0.35) + _noise()),        # audio_silence
                max(0, RNG.uniform(0.25, 0.55) + _noise()),        # audio_rms_norm
                audio_emo_val,                                      # audio_emotion_valence
                max(0, RNG.uniform(0.50, 0.85) + _noise()),        # video_face
                max(0, RNG.uniform(0.45, 0.75) + _noise()),        # video_lighting
                video_emo_val,                                      # video_emotion_valence
                max(0, RNG.uniform(0.35, 0.60) + _noise()),        # q_stress
                max(0, RNG.uniform(0.40, 0.65) + _noise()),        # q_mood
                max(0, RNG.uniform(0.10, 0.35) + _noise()),        # q_sleep_pen
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
            audio_emo_val = max(0.0, RNG.uniform(0.10, 0.35) + _noise())  # sad/fear
            video_emo_val = max(0.0, RNG.uniform(0.10, 0.35) + _noise())
            audio_stress  = max(0.0, 1.0 - audio_emo_val + _noise(0.03))
            X[i] = [
                max(0, RNG.uniform(0.55, 0.80) + _noise()),
                max(0, RNG.uniform(0.20, 0.45) + _noise()),
                audio_stress,
                max(0, RNG.uniform(0.40, 0.70) + _noise()),
                max(0, RNG.uniform(0.10, 0.35) + _noise()),
                audio_emo_val,
                max(0, RNG.uniform(0.30, 0.65) + _noise()),        # video_face (varies)
                max(0, RNG.uniform(0.30, 0.60) + _noise()),
                video_emo_val,
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
            audio_emo_val = max(0.0, RNG.uniform(0.05, 0.30) + _noise())
            video_emo_val = max(0.0, RNG.uniform(0.05, 0.30) + _noise())
            audio_stress  = max(0.0, 1.0 - audio_emo_val + _noise(0.03))
            X[i] = [
                max(0, RNG.uniform(0.50, 0.75) + _noise()),
                max(0, RNG.uniform(0.10, 0.35) + _noise()),
                audio_stress,
                max(0, RNG.uniform(0.50, 0.80) + _noise()),
                max(0, RNG.uniform(0.05, 0.25) + _noise()),
                audio_emo_val,
                max(0, RNG.uniform(0.15, 0.45) + _noise()),
                max(0, RNG.uniform(0.20, 0.50) + _noise()),
                video_emo_val,
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
            audio_emo_val = max(0.0, RNG.uniform(0.00, 0.20) + _noise(0.02))
            video_emo_val = max(0.0, RNG.uniform(0.00, 0.20) + _noise(0.02))
            audio_stress  = max(0.0, 1.0 - audio_emo_val + _noise(0.02))
            X[i] = [
                max(0, RNG.uniform(0.78, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.00, 0.22) + _noise(0.02)),
                audio_stress,
                max(0, RNG.uniform(0.65, 1.00) + _noise(0.02)),
                max(0, RNG.uniform(0.00, 0.15) + _noise(0.02)),
                audio_emo_val,
                max(0, RNG.uniform(0.00, 0.25) + _noise(0.02)),
                max(0, RNG.uniform(0.10, 0.35) + _noise(0.02)),
                video_emo_val,
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

    assert X_train.shape[1] == N_FEATURES, (
        f"Feature mismatch! Expected {N_FEATURES}, got {X_train.shape[1]}"
    )

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
