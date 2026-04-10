"""
Audio upload + analysis router.

Endpoints:
  POST /audio/upload/{assessment_id} – upload audio file, run transcription + analysis
  GET  /audio/{assessment_id}        – get audio record for an assessment
"""
from __future__ import annotations
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.audio_recording import AudioRecording
from app.models.extracted_feature import ExtractedFeature
from app.models.safety_flag import SafetyFlag
from app.schemas.audio import AudioRecordingResponse
from app.services.audio_inference_service import analyse_audio
from app.services.safety_service import scan_text, build_safety_flags
from app.services.assessment_scope_service import get_user_assessment_or_404
from app.utils.file_handler import save_audio, full_path
import json

router = APIRouter(prefix="/audio", tags=["Audio Analysis"])


@router.post("/upload/{assessment_id}", response_model=AudioRecordingResponse, status_code=status.HTTP_201_CREATED)
async def upload_audio(
    assessment_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_user_assessment_or_404(session, assessment_id, current_user)

    storage_key = await save_audio(file)
    file_path = full_path(storage_key)

    # Run analysis in thread pool — analyse_audio makes blocking HTTP calls
    result = await asyncio.to_thread(analyse_audio, file_path)
    features = result.get("features", {})

    recording = AudioRecording(
        assessment_id=assessment_id,
        user_id=current_user.id,
        storage_key=storage_key,
        duration_seconds=features.get("duration_seconds"),
        transcript_text=result.get("transcript"),
        transcript_language=result.get("language"),
        snr_score=None,
        processing_status="completed",
    )
    session.add(recording)

    feature = ExtractedFeature(
        assessment_id=assessment_id,
        modality_type="audio",
        feature_namespace="acoustic+emotion",
        feature_json=json.dumps(result),
        extractor_name=result.get("audio_model_name", "superb/wav2vec2-base-superb-er"),
        extractor_version="2.0",
    )
    session.add(feature)

    # Safety scan on transcript
    transcript = result.get("transcript", "")
    if transcript:
        scan = scan_text(transcript)
        for flag_data in build_safety_flags(assessment_id, current_user.id, scan):
            session.add(SafetyFlag(**flag_data))

    session.commit()
    session.refresh(recording)
    return recording


@router.get("/{assessment_id}", response_model=AudioRecordingResponse)
def get_audio(
    assessment_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rec = session.exec(
        select(AudioRecording)
        .where(AudioRecording.assessment_id == assessment_id)
        .where(AudioRecording.user_id == current_user.id)
    ).first()
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Audio recording not found")
    return rec
