"""
MindSentry Backend API
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.core.database import create_db_and_tables
from app.api.auth import router as auth_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup: Create database tables
    create_db_and_tables()
    yield
    # Shutdown: Cleanup if needed


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="Production-ready backend API for MindSentry mental health application",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for React Native and Web Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:8081",  # Expo default port
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8081",
        "*",  # Allow all origins for development
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth_router)


@app.get("/")
def root():
    """Root endpoint - API health check"""
    return {
        "message": "MindSentry API is running",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
