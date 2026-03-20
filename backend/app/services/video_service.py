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

_face_cascade = None
_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'}


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
        cascade = _get_face_cascade()
        if cascade is not None:
            faces = cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=4, minSize=(60, 60)
            )
            face_detected = 1 if len(faces) > 0 else 0

        return {
            "duration_seconds": 0.0,
            "fps": 0.0,
            "resolution_width": width,
            "resolution_height": height,
            "face_detected": face_detected,
            "face_ratio": float(face_detected),
            "lighting_score": lighting_score,
            "video_emotion": "neutral",
        }
    except Exception as e:
        return {
            "duration_seconds": None, "fps": None,
            "resolution_width": None, "resolution_height": None,
            "face_detected": 0, "face_ratio": 0.0,
            "lighting_score": None, "video_emotion": "neutral",
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

        cap.release()

        face_ratio   = face_detections / max(1, len(indices))
        avg_lighting = float(np.mean(brightness_values)) if brightness_values else 0.5
        # Normalise: perfect brightness ~170/255 ≈ 0.67; scale so 0.67 maps to 1.0
        lighting_score = round(min(1.0, avg_lighting / 0.67), 3)

        return {
            "duration_seconds": round(duration, 2),
            "fps":              round(fps, 1),
            "resolution_width": width,
            "resolution_height": height,
            "face_detected":    int(face_ratio > 0.3),
            "face_ratio":       round(face_ratio, 3),
            "lighting_score":   lighting_score,
            "video_emotion":    "neutral",
        }

    except Exception as e:
        return {
            "duration_seconds": None, "fps": None,
            "resolution_width": None, "resolution_height": None,
            "face_detected": 0, "face_ratio": 0.0,
            "lighting_score": None, "video_emotion": "neutral",
            "error": str(e),
        }
