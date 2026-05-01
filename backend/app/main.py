"""
MindSentry Backend API
Main application entry point
"""
# ── CRITICAL: Set offline env vars BEFORE any library imports ──────────
# huggingface_hub reads HF_HUB_OFFLINE at import time and caches it as a
# module-level constant.  Setting it after import has ZERO effect.
# This block MUST stay above all other imports.
import os as _os
_os.environ["HF_HUB_OFFLINE"] = "1"
_os.environ["TRANSFORMERS_OFFLINE"] = "1"
_os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
# ── END offline lock ──────────────────────────────────────────────────

from contextlib import asynccontextmanager
import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import create_db_and_tables
from app.services.model_health_service import run_startup_model_health_checks, get_cached_model_health
from app.services.video_inference_service import preload_local_face_pipeline
from app.services.audio_inference_service import preload_local_audio_pipelines

import app.models  # noqa: F401

from app.api.auth import router as auth_router
from app.api.assessments import router as assessments_router
from app.api.text_analysis import router as text_router
from app.api.audio_analysis import router as audio_router
from app.api.video_analysis import router as video_router
from app.api.questionnaires import router as questionnaires_router
from app.api.analysis import router as analysis_router
from app.api.history import router as history_router
from app.api.routes.chat import router as assistant_chat_router
from app.api.routes.chat_v2 import router as assistant_chat_v2_router
from app.api.routes.assistant_actions import router as assistant_actions_router

logger = logging.getLogger(__name__)
settings = get_settings()


def _setup_hf_environment() -> None:
    """Configure HuggingFace cache directory and authentication.

    NOTE: HF_HUB_OFFLINE and TRANSFORMERS_OFFLINE are already set at the
    top of this module (before any imports) to prevent background downloads.
    """
    cache_dir = str(Path(settings.huggingface_local_model_cache_dir).resolve())
    os.environ["HF_HOME"] = cache_dir
    os.environ["HF_HUB_CACHE"] = cache_dir

    # Propagate the API key (used by the hosted HTTP fallback, not by local loads)
    if settings.huggingface_api_key:
        os.environ.setdefault("HF_TOKEN", settings.huggingface_api_key)

    logger.info(
        "HF environment configured: cache_dir=%s, offline=True", cache_dir,
    )


def _preload_all_models() -> None:
    """Load ALL local models from cache into memory. No network calls."""
    logger.info("=== MODEL PRELOAD START (offline mode — loading from cache only) ===")

    # Phase 1: Load face model (video) from cache
    logger.info("[Preload] Loading face emotion model from cache...")
    preload_local_face_pipeline()

    # Phase 2: Load audio SER models from cache
    logger.info("[Preload] Loading audio SER models from cache...")
    preload_local_audio_pipelines()

    logger.info("=== MODEL PRELOAD COMPLETE — all models loaded from local cache ===")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    try:
        _setup_hf_environment()
        await asyncio.to_thread(_preload_all_models)
        app.state.model_health = await asyncio.to_thread(run_startup_model_health_checks)
    except Exception as exc:
        logger.error("Model preload failed: %s", exc, exc_info=True)
        app.state.model_health = get_cached_model_health()
    yield


app = FastAPI(
    title=settings.app_name,
    description="MindSentry - multimodal mental-health analysis API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_router)
app.include_router(assessments_router)
app.include_router(text_router)
app.include_router(audio_router)
app.include_router(video_router)
app.include_router(questionnaires_router)
app.include_router(analysis_router)
app.include_router(history_router)
app.include_router(assistant_chat_router)
app.include_router(assistant_chat_v2_router)
app.include_router(assistant_actions_router)


@app.get("/")
def root():
    return {
        "message": "MindSentry API is running",
        "status": "healthy",
        "version": "2.0.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_health": get_cached_model_health(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
