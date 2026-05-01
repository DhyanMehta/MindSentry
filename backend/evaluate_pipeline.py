"""Evaluate pipeline quality and performance metrics from stored runs.

Reports:
- latency p50/p90/p95 for analysis fusion and modality pipelines (when available)
- audio fallback rate
- emotion agreement metrics across modalities

Usage:
    cd backend
    python evaluate_pipeline.py
"""
from __future__ import annotations

import json

import numpy as np
from sqlmodel import Session, select

from app.core.database import engine
from app.models.analysis_result import AnalysisResult
from app.models.extracted_feature import ExtractedFeature
from app.models.inference_run import InferenceRun


def _percentiles(values: list[float]) -> dict:
    if not values:
        return {"count": 0, "p50": None, "p90": None, "p95": None}
    arr = np.asarray(values, dtype=np.float32)
    return {
        "count": int(len(values)),
        "p50": float(np.percentile(arr, 50)),
        "p90": float(np.percentile(arr, 90)),
        "p95": float(np.percentile(arr, 95)),
    }


def _load_latest_feature(session: Session, assessment_id: str, modality: str) -> dict | None:
    row = session.exec(
        select(ExtractedFeature)
        .where(ExtractedFeature.assessment_id == assessment_id)
        .where(ExtractedFeature.modality_type == modality)
        .order_by(ExtractedFeature.computed_at.desc())
    ).first()
    if not row or not row.feature_json:
        return None
    try:
        return json.loads(row.feature_json)
    except Exception:
        return None


def evaluate() -> None:
    with Session(engine) as session:
        runs = session.exec(select(InferenceRun).where(InferenceRun.run_status == "completed")).all()
        analyses = session.exec(select(AnalysisResult)).all()

        fusion_lat = [float(r.latency_ms) for r in runs if r.latency_ms is not None]

        audio_lat = []
        video_lat = []
        fallback_audio = 0
        total_audio = 0

        agreement_audio_text = []
        agreement_video_text = []
        agreement_audio_video = []

        for ar in analyses:
            aid = ar.assessment_id
            audio = _load_latest_feature(session, aid, "audio") or {}
            video = _load_latest_feature(session, aid, "video") or {}

            if audio:
                total_audio += 1
                model_name = str(audio.get("audio_model_name", ""))
                source = str(audio.get("inference_source", ""))
                if "fallback" in model_name or source == "fallback":
                    fallback_audio += 1
                if audio.get("analysis_latency_ms") is not None:
                    audio_lat.append(float(audio.get("analysis_latency_ms")))

            if video and video.get("analysis_latency_ms") is not None:
                video_lat.append(float(video.get("analysis_latency_ms")))

            text_em = ar.text_emotion
            audio_em = ar.audio_emotion
            video_em = ar.video_emotion

            if text_em and audio_em:
                agreement_audio_text.append(1.0 if text_em == audio_em else 0.0)
            if text_em and video_em:
                agreement_video_text.append(1.0 if text_em == video_em else 0.0)
            if audio_em and video_em:
                agreement_audio_video.append(1.0 if audio_em == video_em else 0.0)

        print("\n=== MindSentry Pipeline Evaluation ===")
        print("Fusion latency (ms):", _percentiles(fusion_lat))
        print("Audio latency (ms):", _percentiles(audio_lat))
        print("Video latency (ms):", _percentiles(video_lat))

        fallback_rate = (fallback_audio / total_audio) if total_audio else 0.0
        print("Audio fallback rate:", round(fallback_rate, 4), f"({fallback_audio}/{total_audio})")

        def mean_or_none(vals: list[float]):
            return round(float(sum(vals) / len(vals)), 4) if vals else None

        print("Agreement audio-text:", mean_or_none(agreement_audio_text), f"n={len(agreement_audio_text)}")
        print("Agreement video-text:", mean_or_none(agreement_video_text), f"n={len(agreement_video_text)}")
        print("Agreement audio-video:", mean_or_none(agreement_audio_video), f"n={len(agreement_audio_video)}")


if __name__ == "__main__":
    evaluate()
