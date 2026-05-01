"""Probability calibration helpers for final risk scoring."""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

_MODEL_PATH = Path(__file__).resolve().parents[2] / "ml_models" / "risk_calibration.pkl"
_calibrator: dict[str, Any] | None = None


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _load() -> dict[str, Any] | None:
    global _calibrator
    if _calibrator is not None:
        return _calibrator
    if not _MODEL_PATH.exists():
        return None
    try:
        with open(_MODEL_PATH, "rb") as f:
            obj = pickle.load(f)
        _calibrator = obj if isinstance(obj, dict) else None
    except Exception:
        _calibrator = None
    return _calibrator


def calibrate_probability(metric_name: str, raw_score: float) -> tuple[float, str]:
    model = _load()
    raw = _clamp(raw_score)
    if not model:
        return raw, "identity"

    calibrator = model.get(metric_name)
    if calibrator is None:
        return raw, "identity"

    try:
        calibrated = float(calibrator.predict([raw])[0])
        return _clamp(calibrated), "isotonic"
    except Exception:
        return raw, "identity"
