"""
MindSentry Backend API
Main application entry point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import create_db_and_tables

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

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
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
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
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
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
