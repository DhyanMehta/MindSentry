"""
Video analysis service.

Uses OpenCV only:
  - Haar Cascade face detector  (bundled inside opencv-python-headless, no download)
  - Frame brightness measurement (lighting score)

MediaPipe solutions API was removed in 0.10.14+. We use cv2.CascadeClassifier
with the frontal-face Haar cascade that ships inside the OpenCV package data.
This requires no internet access and no separate model file.
"""
from __future__ import annotations
from pathlib import Path
import httpx

from app.core.config import get_settings

_face_cascade = None
_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'}
_HF_FACE_URL = "https://api-inference.huggingface.co/models/dima806/facial_emotions_image_detection"

_EMOTION_MAP = {
    "angry": "anger",
    "disgust": "disgust",
    "fear": "fear",
    "happy": "joy",
    "neutral": "neutral",
    "sad": "sadness",
    "surprise": "surprise",
}


def _visual_integrity(
    input_type: str,
    face_detected: int,
    lighting_score: float | None,
    face_ratio: float,
    video_confidence: float,
) -> dict:
    risk = 0.0
    flags: list[str] = []

    if face_detected == 0:
        risk += 0.35
        flags.append("no_face_detected")
    if lighting_score is not None and lighting_score < 0.28:
        risk += 0.2
        flags.append("poor_lighting")
    if input_type == "photo":
        risk += 0.1
        flags.append("single_frame_capture")
    if input_type == "video" and face_ratio < 0.22:
        risk += 0.2
        flags.append("inconsistent_face_presence")
    if video_confidence < 0.5:
        risk += 0.15
        flags.append("low_model_confidence")

    spoof_risk = max(0.0, min(1.0, risk))
    return {
        "video_input_type": input_type,
        "video_integrity_score": round(1.0 - spoof_risk, 4),
        "video_spoof_risk": round(spoof_risk, 4),
        "video_integrity_flags": flags,
    }


def _infer_face_emotion(face_bgr):
    """Infer emotion from a face crop using HF image model. Returns (label, score) or (None, None)."""
    settings = get_settings()
    if not settings.huggingface_api_key:
        return None, None

    try:
        import cv2
        ok, encoded = cv2.imencode('.jpg', face_bgr)
        if not ok:
            return None, None

        resp = httpx.post(
            _HF_FACE_URL,
            headers={
                "Authorization": f"Bearer {settings.huggingface_api_key}",
                "Content-Type": "image/jpeg",
            },
            content=encoded.tobytes(),
            timeout=30.0,
        )
        if resp.status_code != 200:
            return None, None

        data = resp.json()
        rows = data[0] if data and isinstance(data[0], list) else data
        if not rows or not isinstance(rows, list):
            return None, None
        top = max(rows, key=lambda x: x.get("score", 0.0))
        label = str(top.get("label", "")).lower().strip()
        mapped = _EMOTION_MAP.get(label, label or None)
        return mapped, float(top.get("score", 0.0) or 0.0)
    except Exception:
        return None, None


def _analyse_image(file_path) -> dict:
    """Analyse a single still image captured from the phone camera."""
    try:
        import cv2
        import numpy as np

        img = cv2.imread(str(file_path))
        if img is None:
            raise RuntimeError("Could not read image file")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        brightness = float(np.mean(gray)) / 255.0
        lighting_score = round(min(1.0, brightness / 0.67), 3)

        face_detected = 0
        video_emotion = None
        video_confidence = None
        cascade = _get_face_cascade()
        if cascade is not None:
            faces = cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=4, minSize=(60, 60)
            )
            face_detected = 1 if len(faces) > 0 else 0
            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda box: box[2] * box[3])
                face_crop = img[y:y + h, x:x + w]
                video_emotion, video_confidence = _infer_face_emotion(face_crop)

        if not video_emotion:
            # Non-model fallback heuristic when no face emotion was inferred.
            if face_detected == 0:
                video_emotion = "fear"
            elif lighting_score < 0.32:
                video_emotion = "sadness"
            else:
                video_emotion = "neutral"
            video_confidence = 0.48

        integrity = _visual_integrity(
            input_type="photo",
            face_detected=face_detected,
            lighting_score=lighting_score,
            face_ratio=float(face_detected),
            video_confidence=float(video_confidence or 0.0),
        )

        return {
            "duration_seconds": 0.0,
            "fps": 0.0,
            "resolution_width": width,
            "resolution_height": height,
            "face_detected": face_detected,
            "face_ratio": float(face_detected),
            "lighting_score": lighting_score,
            "video_emotion": video_emotion,
            "video_emotion_confidence": round(float(video_confidence or 0.0), 4),
            **integrity,
        }
    except Exception as e:
        return {
            "duration_seconds": None, "fps": None,
            "resolution_width": None, "resolution_height": None,
            "face_detected": 0, "face_ratio": 0.0,
            "lighting_score": None, "video_emotion": None,
            "video_emotion_confidence": 0.0,
            "error": str(e),
        }


def _get_face_cascade():
    """Load OpenCV's bundled frontal-face Haar cascade (lazy, once)."""
    global _face_cascade
    if _face_cascade is None:
        try:
            import cv2
            xml = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            cascade = cv2.CascadeClassifier(xml)
            if cascade.empty():
                raise RuntimeError("Haar cascade XML not found inside cv2 package")
            _face_cascade = cascade
        except Exception:
            _face_cascade = None
    return _face_cascade


def analyse_video(file_path) -> dict:
    """
    Extract face presence, lighting score and basic metadata from a video or image.

    If the file is a still image (jpg/png/etc.), delegates to _analyse_image.
    Otherwise samples up to 10 evenly-spaced video frames.
    """
    # Route still images (phone camera photos) to the image analyser
    if Path(str(file_path)).suffix.lower() in _IMAGE_EXTENSIONS:
        return _analyse_image(file_path)

    try:
        import cv2
        import numpy as np

        cap = cv2.VideoCapture(str(file_path))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps  = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = total_frames / fps if fps > 0 else 0.0

        sample_count = min(10, max(1, total_frames))
        step = max(1, total_frames // sample_count)
        indices = list(range(0, total_frames, step))[:sample_count]

        face_detections = 0
        inferred_emotions = []
        inferred_scores = []
        brightness_values = []
        cascade = _get_face_cascade()

        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness_values.append(float(np.mean(gray)) / 255.0)

            if cascade is not None:
                faces = cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=4,
                    minSize=(60, 60),
                )
                if len(faces) > 0:
                    face_detections += 1
                    x, y, w, h = max(faces, key=lambda box: box[2] * box[3])
                    face_crop = frame[y:y + h, x:x + w]
                    emotion, confidence = _infer_face_emotion(face_crop)
                    if emotion:
                        inferred_emotions.append(emotion)
                        inferred_scores.append(float(confidence or 0.0))

        cap.release()

        face_ratio   = face_detections / max(1, len(indices))
        avg_lighting = float(np.mean(brightness_values)) if brightness_values else 0.5
        # Normalise: perfect brightness ~170/255 ≈ 0.67; scale so 0.67 maps to 1.0
        lighting_score = round(min(1.0, avg_lighting / 0.67), 3)

        if inferred_emotions:
            # Majority vote across sampled frames.
            video_emotion = max(set(inferred_emotions), key=inferred_emotions.count)
            video_confidence = sum(inferred_scores) / max(1, len(inferred_scores))
        else:
            if face_ratio < 0.2:
                video_emotion = "fear"
            elif lighting_score < 0.32:
                video_emotion = "sadness"
            else:
                video_emotion = "neutral"
            video_confidence = 0.46

        integrity = _visual_integrity(
            input_type="video",
            face_detected=int(face_ratio > 0.3),
            lighting_score=lighting_score,
            face_ratio=face_ratio,
            video_confidence=float(video_confidence or 0.0),
        )

        return {
            "duration_seconds": round(duration, 2),
            "fps":              round(fps, 1),
            "resolution_width": width,
            "resolution_height": height,
            "face_detected":    int(face_ratio > 0.3),
            "face_ratio":       round(face_ratio, 3),
            "lighting_score":   lighting_score,
            "video_emotion":    video_emotion,
            "video_emotion_confidence": round(float(video_confidence or 0.0), 4),
            **integrity,
        }

    except Exception as e:
        return {
            "duration_seconds": None, "fps": None,
            "resolution_width": None, "resolution_height": None,
            "face_detected": 0, "face_ratio": 0.0,
            "lighting_score": None, "video_emotion": None,
            "video_emotion_confidence": 0.0,
            "error": str(e),
        }
