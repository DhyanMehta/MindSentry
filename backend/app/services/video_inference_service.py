"""Hosted Hugging Face facial-emotion analysis with local face extraction."""
from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings
from app.services.hf_inference_service import HFInferenceError, get_hf_client
from app.services.text_inference_service import _map_label as map_text_label

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".gif"}
_face_detector = None
_haar_detector = None


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
    import cv2

    variants = [
        frame,
        cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE),
        cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE),
        cv2.rotate(frame, cv2.ROTATE_180),
    ]

    best_face = None
    best_area = 0
    for variant in variants:
        face = _extract_face_from_mediapipe(variant) or _extract_face_from_haar(variant)
        if face is None:
            continue
        area = face.shape[0] * face.shape[1]
        if area > best_area:
            best_face = face
            best_area = area
    return best_face


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


def _visual_integrity(input_type: str, face_ratio: float, lighting_score: float | None, confidence: float) -> dict:
    risk = 0.0
    flags: list[str] = []
    if face_ratio <= 0.0:
        risk += 0.4
        flags.append("no_face_detected")
    if lighting_score is not None and lighting_score < 0.28:
        risk += 0.2
        flags.append("poor_lighting")
    if input_type == "video" and face_ratio < 0.25:
        risk += 0.2
        flags.append("inconsistent_face_presence")
    if confidence < 0.45:
        risk += 0.15
        flags.append("low_model_confidence")
    spoof_risk = max(0.0, min(1.0, risk))
    return {
        "video_input_type": input_type,
        "video_integrity_score": round(1.0 - spoof_risk, 4),
        "video_spoof_risk": round(spoof_risk, 4),
        "video_integrity_flags": flags,
    }


def _score_face(face_bytes: bytes) -> tuple[str | None, float, list[str]]:
    settings = get_settings()
    try:
        payload = get_hf_client().image_classification(face_bytes)
        label, score = _parse_face_payload(payload)
        return label, score, []
    except HFInferenceError as exc:
        return None, 0.0, [f"Hosted visual emotion inference unavailable: {exc}"]


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
    if face_crop is not None:
        face_bytes = _encode_face(face_crop)
        if face_bytes:
            video_emotion, confidence, warnings = _score_face(face_bytes)
    else:
        warnings.append("No usable face crop found.")

    integrity = _visual_integrity("photo", 1.0 if face_crop is not None else 0.0, lighting_score, confidence)
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
        "video_model_name": settings.huggingface_face_emotion_model,
        "inference_source": "huggingface",
        "warnings": warnings,
        **integrity,
    }


def analyse_video(file_path) -> dict:
    import cv2

    path = Path(str(file_path))
    if path.suffix.lower() in _IMAGE_EXTENSIONS:
        return _analyse_image(file_path)

    cap = cv2.VideoCapture(str(file_path))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0.0

    sample_count = min(12, max(4, total_frames if total_frames > 0 else 1))
    if total_frames > 0:
        start_frame = int(total_frames * 0.1)
        end_frame = max(start_frame + 1, int(total_frames * 0.9))
        span = max(1, end_frame - start_frame)
        step = max(1, span // sample_count)
        indices = list(range(start_frame, end_frame, step))[:sample_count]
        if not indices:
            indices = [max(0, total_frames // 2)]
    else:
        indices = [0]

    brightness_values = []
    emotions: list[str] = []
    confidences: list[float] = []
    warning_set: set[str] = set()
    face_hits = 0

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness_values.append(float(gray.mean()) / 255.0)
        face_crop = _extract_best_face(frame)
        if face_crop is None:
            continue
        face_hits += 1
        face_bytes = _encode_face(face_crop)
        if not face_bytes:
            continue
        label, score, warnings = _score_face(face_bytes)
        warning_set.update(warnings)
        if label:
            emotions.append(label)
            confidences.append(score)

    cap.release()

    face_ratio = face_hits / max(1, len(indices))
    lighting_score = round(min(1.0, ((sum(brightness_values) / max(1, len(brightness_values))) / 0.67)), 3) if brightness_values else None
    video_emotion = None
    confidence = 0.0
    if emotions:
        candidates = {}
        for label, score in zip(emotions, confidences):
            candidates[label] = candidates.get(label, 0.0) + score
        video_emotion = max(candidates.items(), key=lambda item: item[1])[0]
        confidence = sum(confidences) / len(confidences)
    else:
        warning_set.add("No valid face crop produced a supported visual emotion result.")

    integrity = _visual_integrity("video", face_ratio, lighting_score, confidence)
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
        "inference_source": "huggingface",
        "warnings": sorted(warning_set),
        **integrity,
    }
