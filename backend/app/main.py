"""
MindSentry Backend API
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.database import create_db_and_tables

# ── Import all models so their metadata is registered before create_all ──
import app.models  # noqa: F401 – side-effect import registers all tables

# ── Auth router (untouched) ───────────────────────────────────────────────
from app.api.auth import router as auth_router

# ── New non-auth routers ──────────────────────────────────────────────────
from app.api.assessments import router as assessments_router
from app.api.text_analysis import router as text_router
from app.api.audio_analysis import router as audio_router
from app.api.video_analysis import router as video_router
from app.api.questionnaires import router as questionnaires_router
from app.api.analysis import router as analysis_router
from app.api.history import router as history_router
from app.api.chatbot_agent import router as chatbot_agent_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup: Create all database tables (auth + non-auth)
    create_db_and_tables()
    yield
    # Shutdown: cleanup if needed


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="MindSentry — multimodal mental-health analysis API",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS for React Native / Expo
# allow_credentials=False + allow_origins=["*"] is the correct pairing for Bearer-token auth
# React Native does not use cookies, so credentials header is not needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
)

# ── Register routers ──────────────────────────────────────────────────────
app.include_router(auth_router)           # /auth/*
app.include_router(assessments_router)    # /assessments/*
app.include_router(text_router)           # /text/*
app.include_router(audio_router)          # /audio/*
app.include_router(video_router)          # /video/*
app.include_router(questionnaires_router) # /questionnaires/*
app.include_router(analysis_router)       # /analysis/*
app.include_router(history_router)        # /history/*
app.include_router(chatbot_agent_router)  # /api/v2/chat-agent/*


@app.get("/")
def root():
    """Root endpoint — API health check"""
    return {
        "message": "MindSentry API is running",
        "status": "healthy",
        "version": "2.0.0",
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
