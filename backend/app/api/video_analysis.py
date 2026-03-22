"""
Video upload + analysis router.

Endpoints:
  POST /video/upload/{assessment_id} – upload video file, run face/lighting analysis
  GET  /video/{assessment_id}        – get video record for an assessment
"""
from __future__ import annotations
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.assessment import Assessment
from app.models.video_recording import VideoRecording
from app.models.extracted_feature import ExtractedFeature
from app.schemas.video import VideoRecordingResponse
from app.services.video_service import analyse_video
from app.utils.file_handler import save_video, full_path
import json

router = APIRouter(prefix="/video", tags=["Video Analysis"])


@router.post("/upload/{assessment_id}", response_model=VideoRecordingResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(
    assessment_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    assessment = session.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    storage_key = await save_video(file)
    file_path = full_path(storage_key)

    # Run analysis in thread pool — analyse_video does CPU-bound frame processing
    result = await asyncio.to_thread(analyse_video, file_path)

    recording = VideoRecording(
        assessment_id=assessment_id,
        user_id=current_user.id,
        storage_key=storage_key,
        duration_seconds=result.get("duration_seconds"),
        fps=int(result["fps"]) if result.get("fps") else None,
        resolution_width=result.get("resolution_width"),
        resolution_height=result.get("resolution_height"),
        face_detected=result.get("face_detected", 0),
        lighting_score=result.get("lighting_score"),
        processing_status="completed",
    )
    session.add(recording)

    feature = ExtractedFeature(
        assessment_id=assessment_id,
        modality_type="video",
        feature_namespace="visual_emotion+integrity",
        feature_json=json.dumps(result),
        extractor_name="opencv+hf_face_emotion",
        extractor_version="1.1",
    )
    session.add(feature)

    session.commit()
    session.refresh(recording)
    return recording


@router.get("/{assessment_id}", response_model=VideoRecordingResponse)
def get_video(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rec = session.exec(
        select(VideoRecording)
        .where(VideoRecording.assessment_id == assessment_id)
        .where(VideoRecording.user_id == current_user.id)
    ).first()
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Video recording not found")
    return rec
