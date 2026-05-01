"""Hosted Hugging Face visual-emotion analysis with canonical video preprocessing."""
from __future__ import annotations

import logging
import time
from pathlib import Path

from app.utils.ffmpeg_path import *  # noqa: F401,F403
from app.core.config import get_settings
from app.services.hf_inference_service import HFInferenceError, get_hf_client
from app.services.media_preprocessing_service import MediaPreprocessingError, preprocess_video
from app.services.text_inference_service import _map_label as map_text_label

logger = logging.getLogger(__name__)

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".gif"}
_MAX_FACE_INFERENCE_FRAMES = 3
_face_detector = None
_haar_detector = None
_LOCAL_FACE_PIPELINES: dict[str, object] = {}
_PRELOAD_COMPLETE = False


def _get_face_detector():
    global _face_detector
    if _face_detector is None:
        try:
            import mediapipe as mp

            _face_detector = mp.solutions.face_detection.FaceDetection(
                model_selection=0,
                min_detection_confidence=0.35,
            )
        except Exception:
            _face_detector = False
    return _face_detector


def _get_haar_detector():
    global _haar_detector
    if _haar_detector is None:
        try:
            import cv2

            path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            detector = cv2.CascadeClassifier(path)
            _haar_detector = detector if not detector.empty() else False
        except Exception:
            _haar_detector = False
    return _haar_detector


def _crop_from_box(frame, x1: int, y1: int, x2: int, y2: int):
    height, width = frame.shape[:2]
    pad_x = max(6, int((x2 - x1) * 0.12))
    pad_y = max(6, int((y2 - y1) * 0.12))
    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(width, x2 + pad_x)
    y2 = min(height, y2 + pad_y)
    if x2 <= x1 or y2 <= y1:
        return None
    return frame[y1:y2, x1:x2]


def _extract_face_from_mediapipe(frame):
    detector = _get_face_detector()
    if not detector:
        return None

    import cv2

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = detector.process(rgb)
    if not results or not results.detections:
        return None

    height, width = frame.shape[:2]
    best = max(
        results.detections,
        key=lambda det: det.location_data.relative_bounding_box.width * det.location_data.relative_bounding_box.height,
    )
    box = best.location_data.relative_bounding_box
    x1 = max(0, int(box.xmin * width))
    y1 = max(0, int(box.ymin * height))
    x2 = min(width, int((box.xmin + box.width) * width))
    y2 = min(height, int((box.ymin + box.height) * height))
    return _crop_from_box(frame, x1, y1, x2, y2)


def _extract_face_from_haar(frame):
    detector = _get_haar_detector()
    if not detector:
        return None

    import cv2

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detections = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(detections) == 0:
        return None
    x, y, w, h = max(detections, key=lambda box: box[2] * box[3])
    return _crop_from_box(frame, int(x), int(y), int(x + w), int(y + h))


def _extract_best_face(frame):
    """Single-pass face detection — no rotation variants needed after ffmpeg normalization."""
    face = _extract_face_from_mediapipe(frame)
    if face is not None:
        return face
    return _extract_face_from_haar(frame)


def _encode_face(face) -> bytes | None:
    import cv2

    ok, encoded = cv2.imencode(".jpg", face)
    if not ok:
        return None
    return encoded.tobytes()


def _parse_face_payload(payload: object) -> tuple[str | None, float]:
    rows = payload[0] if isinstance(payload, list) and payload and isinstance(payload[0], list) else payload
    if not isinstance(rows, list) or not rows:
        return None, 0.0
    top = max(rows, key=lambda item: float(item.get("score", 0.0) or 0.0))
    return map_text_label(str(top.get("label", ""))), float(top.get("score", 0.0) or 0.0)


def _get_local_face_pipeline(model_name: str):
    if model_name in _LOCAL_FACE_PIPELINES:
        return _LOCAL_FACE_PIPELINES[model_name]

    settings = get_settings()
    cache_dir = str(Path(settings.huggingface_local_model_cache_dir).resolve())

    try:
        from transformers import pipeline
    except Exception as exc:
        raise RuntimeError(f"transformers_unavailable:{exc}")

    logger.info(
        "Loading local face emotion pipeline '%s' (cache_dir=%s)...",
        model_name,
        cache_dir,
    )
    classifier = pipeline(
        task="image-classification",
        model=model_name,
        top_k=5,
        model_kwargs={"cache_dir": cache_dir},
    )
    _LOCAL_FACE_PIPELINES[model_name] = classifier
    logger.info("Local face emotion pipeline '%s' loaded successfully.", model_name)
    return classifier


def _clean_incomplete_blobs(cache_dir: str) -> None:
    """Remove .incomplete blob files left over from interrupted downloads."""
    import glob
    pattern = str(Path(cache_dir) / "**" / "*.incomplete")
    for incomplete_file in glob.glob(pattern, recursive=True):
        try:
            Path(incomplete_file).unlink()
            logger.info("Cleaned incomplete blob: %s", incomplete_file)
        except OSError:
            pass


def preload_local_face_pipeline() -> None:
    """Warm the configured local face model so analysis does not download on first request."""
    global _PRELOAD_COMPLETE
    settings = get_settings()
    if not settings.huggingface_use_local_video_cache:
        _PRELOAD_COMPLETE = True
        return

    cache_dir = str(Path(settings.huggingface_local_model_cache_dir).resolve())

    # Clean up any interrupted downloads before attempting fresh load
    _clean_incomplete_blobs(cache_dir)

    _get_local_face_pipeline(settings.huggingface_face_emotion_model)
    _PRELOAD_COMPLETE = True
    logger.info("Face model preload complete — all analysis-time loads will use local_files_only=True.")


def _score_face_with_local_cache(face_bytes: bytes) -> tuple[str | None, float, list[str]]:
    settings = get_settings()
    model_name = settings.huggingface_face_emotion_model
    try:
        import cv2
        import numpy as np

        image = cv2.imdecode(np.frombuffer(face_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            return None, 0.0, ["Local cached visual model skipped: could not decode face image."]

        # Convert BGR (cv2) to RGB for transformers pipeline compatibility
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        classifier = _get_local_face_pipeline(model_name)
        payload = classifier(image)
        label, score = _parse_face_payload(payload)
        return label, max(0.0, min(1.0, score)), []
    except Exception as exc:
        return None, 0.0, [f"Local cached visual model {model_name} unavailable: {exc}"]


def _visual_integrity(input_type: str, face_ratio: float, lighting_score: float | None, confidence: float, frame_success_ratio: float) -> dict:
    risk = 0.0
    flags: list[str] = []
    if frame_success_ratio < 0.5:
        risk += 0.35
        flags.append("frame_decode_instability")
    if face_ratio <= 0.0:
        risk += 0.35
        flags.append("no_face_detected")
    if lighting_score is not None and lighting_score < 0.28:
        risk += 0.15
        flags.append("poor_lighting")
    if input_type == "video" and face_ratio < 0.25:
        risk += 0.1
        flags.append("inconsistent_face_presence")
    if confidence < 0.45:
        risk += 0.1
        flags.append("low_model_confidence")

    spoof_risk = max(0.0, min(1.0, risk))
    return {
        "video_input_type": input_type,
        "video_integrity_score": round(1.0 - spoof_risk, 4),
        "video_spoof_risk": round(spoof_risk, 4),
        "video_integrity_flags": flags,
    }


def _score_face(face_bytes: bytes) -> tuple[str | None, float, list[str], str]:
    settings = get_settings()

    # ── Try local model first (fast, reliable, no cold-start) ──
    if settings.huggingface_use_local_video_cache:
        local_label, local_score, local_warnings = _score_face_with_local_cache(face_bytes)
        if local_label:
            return local_label, local_score, local_warnings, "local_cached"

    # ── Fall back to hosted HF API ──
    try:
        payload = get_hf_client().image_classification(
            face_bytes,
            model_id=settings.huggingface_face_emotion_model,
        )
        label, score = _parse_face_payload(payload)
        score = max(0.0, min(1.0, score))
        return label, score, [], "huggingface"
    except HFInferenceError as exc:
        return None, 0.0, [f"Hosted visual emotion inference unavailable: {exc}"], "huggingface"


def _analyse_image(file_path) -> dict:
    import cv2

    img = cv2.imread(str(file_path))
    if img is None:
        raise RuntimeError("Could not read image file")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    lighting_score = round(min(1.0, (float(gray.mean()) / 255.0) / 0.67), 3)

    face_crop = _extract_best_face(img)
    warnings: list[str] = []
    video_emotion = None
    confidence = 0.0
    inference_source = "huggingface"
    if face_crop is not None:
        face_bytes = _encode_face(face_crop)
        if face_bytes:
            video_emotion, confidence, warnings, inference_source = _score_face(face_bytes)
    else:
        warnings.append("No usable face crop found.")

    integrity = _visual_integrity("photo", 1.0 if face_crop is not None else 0.0, lighting_score, confidence, 1.0)
    return {
        "duration_seconds": 0.0,
        "fps": 0.0,
        "resolution_width": width,
        "resolution_height": height,
        "face_detected": 1 if face_crop is not None else 0,
        "face_ratio": 1.0 if face_crop is not None else 0.0,
        "lighting_score": lighting_score,
        "video_emotion": video_emotion,
        "video_emotion_confidence": round(float(confidence or 0.0), 4),
        "video_model_name": get_settings().huggingface_face_emotion_model,
        "inference_source": inference_source,
        "warnings": warnings,
        **integrity,
    }


def analyse_video(file_path) -> dict:
    import cv2

    total_start = time.perf_counter()
    path = Path(str(file_path))
    if path.suffix.lower() in _IMAGE_EXTENSIONS:
        return _analyse_image(file_path)

    warnings: list[str] = []
    try:
        preprocess_start = time.perf_counter()
        canonical = preprocess_video(file_path)
        logger.info(
            "Video preprocessing completed in %.2fs for %s",
            time.perf_counter() - preprocess_start,
            file_path,
        )
        canonical_path = canonical["canonical_path"]
    except MediaPreprocessingError as exc:
        logger.error("Video preprocessing failed for %s: %s", file_path, exc)
        return {
            "duration_seconds": 0.0,
            "fps": 0.0,
            "resolution_width": 0,
            "resolution_height": 0,
            "face_detected": 0,
            "face_ratio": 0.0,
            "lighting_score": 0.0,
            "video_emotion": None,
            "video_emotion_confidence": 0.0,
            "video_model_name": get_settings().huggingface_face_emotion_model,
            "inference_source": "huggingface",
            "warnings": [f"Video preprocessing error: {str(exc)}"],
            "video_input_type": "video",
            "video_integrity_score": 0.0,
            "video_spoof_risk": 1.0,
            "video_integrity_flags": ["preprocessing_error"],
        }

    cap = cv2.VideoCapture(str(canonical_path))
    if not cap.isOpened():
        return {
            "duration_seconds": 0.0,
            "fps": 0.0,
            "resolution_width": 0,
            "resolution_height": 0,
            "face_detected": 0,
            "face_ratio": 0.0,
            "lighting_score": 0.0,
            "video_emotion": None,
            "video_emotion_confidence": 0.0,
            "video_model_name": get_settings().huggingface_face_emotion_model,
            "inference_source": "huggingface",
            "warnings": ["Could not open canonical video stream."],
            "video_input_type": "video",
            "video_integrity_score": 0.0,
            "video_spoof_risk": 1.0,
            "video_integrity_flags": ["decoding_error"],
        }

    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or canonical.get("fps") or 0.0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or canonical.get("width") or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or canonical.get("height") or 0)
        duration = float((total_frames / fps) if fps > 0 and total_frames > 0 else canonical.get("duration_seconds") or 0.0)

        if total_frames <= 0:
            sample_indices = [0, 5, 10, 15]
        else:
            sample_count = min(6, max(3, total_frames))
            start_frame = int(total_frames * 0.1)
            end_frame = max(start_frame + 1, int(total_frames * 0.9))
            span = max(1, end_frame - start_frame)
            step = max(1, span // sample_count)
            sample_indices = list(range(start_frame, end_frame, step))[:sample_count]
            if not sample_indices:
                sample_indices = [max(0, total_frames // 2)]

        brightness_values = []
        emotions: list[str] = []
        confidences: list[float] = []
        warning_set: set[str] = set(warnings)
        used_local_face_model = False
        face_hits = 0
        decode_hits = 0
        model_calls = 0
        model_inference_seconds = 0.0

        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, float(idx))
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            decode_hits += 1

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness_values.append(float(gray.mean()) / 255.0)

            face_crop = _extract_best_face(frame)
            if face_crop is None:
                continue

            face_hits += 1
            face_bytes = _encode_face(face_crop)
            if not face_bytes:
                continue

            if model_calls >= _MAX_FACE_INFERENCE_FRAMES:
                continue

            frame_infer_start = time.perf_counter()
            label, score, score_warnings, score_source = _score_face(face_bytes)
            model_inference_seconds += time.perf_counter() - frame_infer_start
            model_calls += 1
            warning_set.update(score_warnings)
            if score_source == "local_cached":
                used_local_face_model = True
            if label:
                emotions.append(label)
                confidences.append(score)

        if face_hits > _MAX_FACE_INFERENCE_FRAMES:
            warning_set.add(
                f"Capped hosted visual emotion inference to {_MAX_FACE_INFERENCE_FRAMES} face frames to bound latency."
            )

        sampled = max(1, len(sample_indices))
        face_ratio = face_hits / sampled
        frame_success_ratio = decode_hits / sampled

        lighting_score = (
            round(min(1.0, ((sum(brightness_values) / max(1, len(brightness_values))) / 0.67)), 3)
            if brightness_values
            else 0.0
        )

        video_emotion = None
        confidence = 0.0
        if emotions:
            candidates: dict[str, float] = {}
            for label, score in zip(emotions, confidences):
                candidates[label] = candidates.get(label, 0.0) + score
            video_emotion = max(candidates.items(), key=lambda item: item[1])[0]
            count = max(1, emotions.count(video_emotion))
            confidence = candidates[video_emotion] / count
        else:
            warning_set.add("No valid face crop produced a supported visual emotion result.")

        integrity = _visual_integrity("video", face_ratio, lighting_score, confidence, frame_success_ratio)

        logger.info(
            "Video analysis completed in %.2fs for %s (model_calls=%d, model_inference=%.2fs)",
            time.perf_counter() - total_start,
            file_path,
            model_calls,
            model_inference_seconds,
        )

        return {
            "duration_seconds": round(duration, 2),
            "fps": round(fps, 1),
            "resolution_width": width,
            "resolution_height": height,
            "face_detected": int(face_ratio > 0.0),
            "face_ratio": round(face_ratio, 3),
            "lighting_score": lighting_score,
            "video_emotion": video_emotion,
            "video_emotion_confidence": round(float(confidence or 0.0), 4),
            "video_model_name": get_settings().huggingface_face_emotion_model,
            "inference_source": "local_cached" if used_local_face_model else "huggingface",
            "analysis_latency_ms": int((time.perf_counter() - total_start) * 1000),
            "warnings": sorted(warning_set),
            "frame_success_ratio": round(frame_success_ratio, 3),
            **integrity,
        }
    except Exception as exc:
        logger.error("Unexpected error processing video %s: %s", file_path, exc, exc_info=True)
        return {
            "duration_seconds": 0.0,
            "fps": 0.0,
            "resolution_width": 0,
            "resolution_height": 0,
            "face_detected": 0,
            "face_ratio": 0.0,
            "lighting_score": 0.0,
            "video_emotion": None,
            "video_emotion_confidence": 0.0,
            "video_model_name": get_settings().huggingface_face_emotion_model,
            "inference_source": "huggingface",
            "warnings": [f"Video processing error: {str(exc)}"],
            "video_input_type": "video",
            "video_integrity_score": 0.0,
            "video_spoof_risk": 1.0,
            "video_integrity_flags": ["decoding_error"],
        }
    finally:
        cap.release()
