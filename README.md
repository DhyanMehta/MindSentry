## MindSentry – AI-Based Multi-Modal Mental Health Monitoring & Early Intervention System

This repo contains the **initial project setup** for MindSentry, built as:

- **Frontend**: React Native + Expo (`frontend/`)
- **Backend**: FastAPI + LangChain-ready skeleton (`backend/`)
- **Containerization**: Docker + `docker-compose` (planned)

This is an early scaffold only – most AI logic and UI will be implemented later.

### Project Structure

- `frontend/` – Expo React Native app
  - `App.js` – root component
  - Future modules:
    - Text Emotion & Sentiment screens
    - Voice Stress screens
    - Facial Emotion screens
    - Behavioral patterns & trends
    - Dashboard & visualizations
- `backend/` – FastAPI service
  - `app/main.py` – API entrypoint
  - Future modules:
    - `/text` – text sentiment/emotion analysis
    - `/voice` – voice stress detection
    - `/face` – facial emotion recognition
    - `/behavior` – behavioral pattern monitoring
    - `/score` – mental wellness score
    - `/forecast` – time-series forecasting
    - `/anomaly` – stress anomaly detection
    - `/sleep` – sleep pattern estimation
    - `/chat` – AI supportive counselor (LangChain)

### Running the Frontend (Expo)

```bash
cd frontend
npm start
```

Then:
- Press **a** for Android emulator / device
- Press **w** for web
- Or scan the QR code in the Expo Go app.

### Running the Backend (FastAPI)

Later, you will:

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate  # on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Next Steps

- Add module-specific routes and ML model code in `backend/app/`.
- Build basic navigation and placeholder screens in the Expo app for each module.
- Connect frontend to backend via REST endpoints.


