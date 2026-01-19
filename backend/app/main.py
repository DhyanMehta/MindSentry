from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="MindSentry API",
    description="AI-based multi-modal mental health monitoring & early intervention backend.",
    version="0.1.0",
)

# Allow Expo dev client / web to call the API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "name": "MindSentry API",
        "status": "ok",
        "modules": [
            "text",
            "voice",
            "face",
            "behavior",
            "score",
            "forecast",
            "anomaly",
            "sleep",
            "chat",
        ],
    }


# Placeholder routers for future modules
@app.get("/health")
def health_check():
    return {"status": "healthy"}


