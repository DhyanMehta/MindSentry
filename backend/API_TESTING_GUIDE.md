# MindSentry API — Testing Guide

Complete reference for testing all 24 endpoints via FastAPI's interactive docs at `http://localhost:8000/docs`.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Start the Server](#2-start-the-server)
3. [Open Swagger UI](#3-open-swagger-ui)
4. [How to Authenticate in /docs](#4-how-to-authenticate-in-docs)
5. [Testing Order (Recommended Flow)](#5-testing-order-recommended-flow)
6. [Authentication Endpoints](#6-authentication-endpoints)
7. [Assessment Endpoints](#7-assessment-endpoints)
8. [Text Analysis Endpoints](#8-text-analysis-endpoints)
9. [Audio Analysis Endpoints](#9-audio-analysis-endpoints)
10. [Video Analysis Endpoints](#10-video-analysis-endpoints)
11. [Questionnaire Endpoints](#11-questionnaire-endpoints)
12. [Analysis / Scoring Endpoints](#12-analysis--scoring-endpoints)
13. [History Endpoints](#13-history-endpoints)
14. [What Each Response Field Means](#14-what-each-response-field-means)
15. [Error Reference](#15-error-reference)

---

## 1. Prerequisites

Before testing, make sure:

### Server dependencies installed
```bash
cd backend
pip install -r requirements.txt
```

### API keys set in `.env`
```env
HUGGINGFACE_API_KEY=hf_...      # https://huggingface.co/settings/tokens
GROQ_API_KEY=gsk_...            # https://console.groq.com/keys
```

### NN model trained (only once)
```bash
cd backend
python train_nn.py
```
Expected output: `Saved to: ml_models/fusion_nn.pkl (98 KB)`

### Verify everything is ready
```bash
python check_models.py
```
All 7 components should show `[OK]`.

---

## 2. Start the Server

```bash
cd backend
uvicorn app.main:app --reload
```

Server runs at: `http://localhost:8000`

Health check: `http://localhost:8000/health` → `{"status": "healthy"}`

---

## 3. Open Swagger UI

```
http://localhost:8000/docs
```

You will see all endpoints grouped by tag:
- **Authentication**
- **Assessments**
- **Text Analysis**
- **Audio Analysis**
- **Video Analysis**
- **Questionnaires**
- **Analysis**
- **History**

There is also ReDoc at `http://localhost:8000/redoc` (read-only, no testing).

---

## 4. How to Authenticate in /docs

Most endpoints require a Bearer JWT token. Follow these steps once per session:

### Step 1 — Create an account or log in
Use `POST /auth/signup` or `POST /auth/login` (see Section 6).

Copy the `access_token` value from the response. Example:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2 — Click the Authorize button
At the top-right of the Swagger UI page, click the **Authorize** button (lock icon).

### Step 3 — Enter the token
In the dialog, find **HTTPBearer** and paste:
```
your_token_here
```
Do **not** add `Bearer ` prefix — Swagger adds it automatically.

Click **Authorize** → **Close**.

### Step 4 — All protected endpoints now include your token
Every request made from Swagger will include `Authorization: Bearer <token>`.

> **Token expiry:** The token lasts 30 days. If you get `401 Invalid or expired token`, repeat steps 1–4.

---

## 5. Testing Order (Recommended Flow)

Run endpoints in this order for a complete end-to-end test:

```
1. POST /auth/signup           → create account, get token
2. POST /assessments/          → create assessment, copy assessment_id
3. POST /text/submit            → submit text with assessment_id
4. POST /audio/upload/{id}     → upload audio file
5. POST /video/upload/{id}     → upload video file
6. POST /questionnaires/submit → submit questionnaire
7. POST /analysis/run/{id}     → run fusion NN scoring
8. GET  /analysis/result/{id}  → view full result
9. GET  /analysis/risk/{id}    → view risk scores
10. GET /analysis/recommendations/{id} → view recommendations
11. GET /analysis/safety/{id}  → check safety flags
12. GET /history/summary       → view aggregate stats
```

---

## 6. Authentication Endpoints

### `POST /auth/signup`
**Create a new account.**
No authentication required.

**Request body:**
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123",
  "birthday": "1995-06-15",
  "gender": "male",
  "timezone": "Asia/Kolkata"
}
```

**Response `201`:**
```json
{
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": "Test User"
  },
  "access_token": "eyJhbGci...",
  "token_type": "bearer"
}
```

> Copy `access_token` and paste it in the Authorize dialog.

---

### `POST /auth/login`
**Log in to an existing account.**
No authentication required.

**Request body:**
```json
{
  "email": "test@example.com",
  "password": "SecurePass123"
}
```

**Response `200`:** Same as signup — returns `access_token`.

---

### `GET /auth/me`
**Get your profile.**
Requires authentication.
No request body.

**Response `200`:**
```json
{
  "id": 1,
  "email": "test@example.com",
  "name": "Test User",
  "birthday": "1995-06-15",
  "gender": "male",
  "timezone": "Asia/Kolkata",
  "is_active": true,
  "created_at": "2026-03-16T10:00:00",
  "last_login": "2026-03-16T10:05:00"
}
```

---

### `PUT /auth/me`
**Update your profile.**
Requires authentication.

**Request body** (all fields optional):
```json
{
  "name": "Updated Name",
  "timezone": "UTC",
  "gender": "other"
}
```

**Response `200`:** Updated user profile.

---

### `DELETE /auth/me`
**Soft-delete your account** (sets `is_active=false`, does not physically delete).
Requires authentication.
No request body.

**Response `204`:** No content.

---

## 7. Assessment Endpoints

> An assessment is a session that groups all modality inputs (text, audio, video, questionnaire) together.

### `POST /assessments/`
**Create a new assessment.**
Requires authentication.

**Request body:**
```json
{
  "session_type": "checkin",
  "notes": "Evening check-in"
}
```

`session_type` options: `checkin` | `scheduled_assessment` | `crisis_screen` | `clinician_review`

**Response `201`:**
```json
{
  "id": "a1b2c3d4e5f6...",
  "user_id": 1,
  "session_type": "checkin",
  "started_at": "2026-03-16T10:10:00",
  "completed_at": null,
  "status": "pending",
  "overall_confidence": null,
  "notes": "Evening check-in"
}
```

> **Save the `id` value** — this is your `assessment_id` for all subsequent calls.

---

### `GET /assessments/`
**List all your assessments.**
Requires authentication. No body.

**Response `200`:** Array of assessment objects.

---

### `GET /assessments/{assessment_id}`
**Get one assessment by ID.**
Requires authentication.

**Path parameter:** `assessment_id` — the UUID from `POST /assessments/`

**Response `200`:** Single assessment object.

---

### `PATCH /assessments/{assessment_id}`
**Update an assessment's status or notes.**
Requires authentication.

**Request body** (all optional):
```json
{
  "status": "completed",
  "notes": "Feeling better now"
}
```

`status` options: `pending` | `completed` | `failed`

**Response `200`:** Updated assessment.

---

### `DELETE /assessments/{assessment_id}`
**Delete an assessment and all its data.**
Requires authentication.

**Response `204`:** No content.

---

## 8. Text Analysis Endpoints

### `POST /text/submit`
**Submit a text entry for an assessment.**
Requires authentication.

Automatically runs:
- HF Inference API emotion classification
- Safety / crisis keyword scan
- Stores extracted features

**Request body:**
```json
{
  "assessment_id": "a1b2c3d4e5f6...",
  "raw_text": "I have been feeling really overwhelmed lately and can't seem to focus on anything. Everything feels heavy.",
  "language": "en"
}
```

**Response `201`:**
```json
{
  "id": "f1e2d3c4...",
  "assessment_id": "a1b2c3d4e5f6...",
  "user_id": 1,
  "raw_text": "I have been feeling really overwhelmed...",
  "language": "en",
  "word_count": 22,
  "sentiment_summary": "negative",
  "created_at": "2026-03-16T10:12:00"
}
```

> **Try these test texts for different emotions:**
> - Sadness: `"I feel so alone and empty. Nothing brings me joy anymore."`
> - Anger: `"Everything is frustrating me today. I can't handle this."`
> - Fear: `"I am terrified about what's going to happen. I can't stop worrying."`
> - Joy: `"Today was amazing! I feel genuinely happy and hopeful."`
> - Crisis (triggers safety flag): `"I don't want to be here anymore. No reason to live."`

---

### `GET /text/{assessment_id}`
**Get the text entry for an assessment.**
Requires authentication.

**Path parameter:** `assessment_id`

**Response `200`:** TextEntry object as above.

---

## 9. Audio Analysis Endpoints

### `POST /audio/upload/{assessment_id}`
**Upload an audio file for transcription and feature extraction.**
Requires authentication.

Uses:
- **Groq Whisper API** → transcript + language
- **librosa** → RMS energy, silence ratio, zero-crossing rate

**How to test in Swagger:**
1. Click on `POST /audio/upload/{assessment_id}`
2. Click **Try it out**
3. Enter `assessment_id` in the path field
4. Under `file`, click **Choose File** and select a `.wav` or `.mp3` file
5. Click **Execute**

**Accepted file types:** `audio/wav`, `audio/mpeg`, `audio/ogg`, `audio/webm`, `audio/mp4`
**Max size:** 50 MB

**Response `201`:**
```json
{
  "id": "g5h6i7j8...",
  "assessment_id": "a1b2c3d4e5f6...",
  "user_id": 1,
  "storage_key": "audio/abc123def456.wav",
  "duration_seconds": 15.4,
  "transcript_text": "I have been feeling quite anxious lately and I cannot concentrate.",
  "transcript_language": "en",
  "processing_status": "completed",
  "created_at": "2026-03-16T10:15:00"
}
```

> **No audio file?** Use any free TTS tool (e.g. `say` on Mac, `espeak` on Linux) or download a sample `.wav` from freesound.org.

---

### `GET /audio/{assessment_id}`
**Get the audio recording record for an assessment.**
Requires authentication.

**Response `200`:** AudioRecording object as above.

---

## 10. Video Analysis Endpoints

### `POST /video/upload/{assessment_id}`
**Upload a video file for face detection and lighting analysis.**
Requires authentication.

Uses:
- **OpenCV Haar Cascade** → face detection ratio per frame
- **Grayscale brightness** → lighting score

**How to test in Swagger:**
1. Click on `POST /video/upload/{assessment_id}`
2. Click **Try it out**
3. Enter `assessment_id`
4. Click **Choose File** and select a `.mp4`, `.webm`, or `.mov` file
5. Click **Execute**

**Accepted file types:** `video/mp4`, `video/webm`, `video/quicktime`
**Max size:** 200 MB

**Response `201`:**
```json
{
  "id": "k9l0m1n2...",
  "assessment_id": "a1b2c3d4e5f6...",
  "user_id": 1,
  "storage_key": "video/xyz789.mp4",
  "duration_seconds": 30.0,
  "fps": 30.0,
  "resolution_width": 1280,
  "resolution_height": 720,
  "face_detected": 1,
  "lighting_score": 0.82,
  "processing_status": "completed",
  "created_at": "2026-03-16T10:18:00"
}
```

> **Quick test video:** Record a 5-second selfie from your webcam and save as `.mp4`.

---

### `GET /video/{assessment_id}`
**Get the video recording record for an assessment.**
Requires authentication.

**Response `200`:** VideoRecording object as above.

---

## 11. Questionnaire Endpoints

### `GET /questionnaires/templates`
**List all active questionnaire templates.**
No authentication required.

**Response `200`:**
```json
[
  {
    "id": "template-uuid-here",
    "name": "Daily Wellness Check",
    "code": "DWC",
    "version": "1.0",
    "description": "Daily mood and stress check-in",
    "scoring_method": "sum",
    "is_active": 1
  }
]
```

> **Note:** Templates must be seeded manually or added via DB. If the list is empty, create one directly in SQLite or use the DB setup script. The questionnaire submit endpoint works with any `template_id` you provide.

---

### `GET /questionnaires/templates/{template_id}/questions`
**Get all questions for a template — ordered by `display_order`.**
No authentication required.

**Path parameter:** `template_id` — from the templates list above.

**Response `200`:** Array of question objects.

---

### `POST /questionnaires/submit`
**Submit questionnaire answers for an assessment.**
Requires authentication.

**Request body:**
```json
{
  "assessment_id": "a1b2c3d4e5f6...",
  "template_id": "template-uuid-here",
  "items": [
    {
      "question_id": "q1-uuid",
      "answer_value": "7",
      "answer_text": "Quite stressed",
      "scored_value": 7.0
    },
    {
      "question_id": "q2-uuid",
      "answer_value": "3",
      "answer_text": "Low mood",
      "scored_value": 3.0
    }
  ]
}
```

> **Testing without real questions:** You can use any placeholder UUID strings for `template_id` and `question_id` — the system stores the values and the NN uses `total_score` for fusion. For example:
> ```json
> {
>   "assessment_id": "a1b2c3d4e5f6...",
>   "template_id": "dummy-template-001",
>   "items": [
>     {"question_id": "q1", "answer_value": "8", "scored_value": 8.0},
>     {"question_id": "q2", "answer_value": "2", "scored_value": 2.0}
>   ]
> }
> ```

**Response `201`:**
```json
{
  "id": "resp-uuid...",
  "assessment_id": "a1b2c3d4e5f6...",
  "template_id": "template-uuid-here",
  "total_score": 10.0,
  "severity_band": null,
  "submitted_at": null
}
```

---

### `GET /questionnaires/responses/{assessment_id}`
**Get the questionnaire response for an assessment.**
Requires authentication.

**Response `200`:** QuestionnaireResponse object as above.

---

## 12. Analysis / Scoring Endpoints

> These endpoints use the trained Fusion Neural Network (98 KB MLP) to combine all available modality outputs into a single score object.

### `POST /analysis/run/{assessment_id}`
**Run the full multimodal fusion pipeline.**
Requires authentication.

This endpoint:
1. Loads extracted features from all submitted modalities (text, audio, video, questionnaire)
2. Runs them through the NN (`ml_models/fusion_nn.pkl`)
3. Produces stress, mood, burnout, social withdrawal, and crisis scores
4. Generates personalised recommendations
5. Marks the assessment as `completed`

**No request body.** Just the path parameter.

**Response `200`:**
```json
{
  "id": "result-uuid...",
  "assessment_id": "a1b2c3d4e5f6...",
  "user_id": 1,
  "text_emotion": "sadness",
  "audio_emotion": "neutral",
  "video_emotion": "neutral",
  "stress_score": 0.6791,
  "mood_score": 0.2416,
  "emotional_distress_score": 0.7187,
  "wellness_flag": 1,
  "support_level": "high",
  "crisis_flag": 0,
  "confidence_score": 0.6,
  "created_at": "2026-03-16T10:22:00"
}
```

> **You can re-run this endpoint** after adding more modalities — it updates (upserts) the result.

---

### `GET /analysis/result/{assessment_id}`
**Get the stored analysis result.**
Requires authentication.

Returns `404` if `/run` has not been called yet.

**Response `200`:** AnalysisResult object (same structure as `/run` response).

---

### `GET /analysis/risk/{assessment_id}`
**Get the detailed risk score breakdown.**
Requires authentication.

**Response `200`:**
```json
{
  "id": "risk-uuid...",
  "assessment_id": "a1b2c3d4e5f6...",
  "user_id": 1,
  "stress_score": 0.6791,
  "low_mood_score": 0.7583,
  "burnout_score": 0.7187,
  "social_withdrawal_score": 0.1234,
  "crisis_score": 0.6837,
  "final_risk_level": "high"
}
```

---

### `GET /analysis/safety/{assessment_id}`
**Get safety / crisis flags for an assessment.**
Requires authentication.

Returns an array. Empty array `[]` means no flags were raised.

**Response `200` (with a crisis-language text submission):**
```json
[
  {
    "id": "flag-uuid...",
    "assessment_id": "a1b2c3d4e5f6...",
    "user_id": 1,
    "flag_type": "crisis_language",
    "severity": "high",
    "reason": "Crisis keywords detected: kill myself, no reason to live",
    "resolved": 0,
    "created_at": "2026-03-16T10:12:00"
  }
]
```

`flag_type` values: `crisis_language` | `severe_distress`
`severity` values: `low` | `medium` | `high` | `critical`

---

### `GET /analysis/recommendations/{assessment_id}`
**Get personalised recommendations generated during the analysis run.**
Requires authentication.

**Response `200`:**
```json
[
  {
    "id": "rec-uuid-1...",
    "assessment_id": "a1b2c3d4e5f6...",
    "user_id": 1,
    "title": "Box Breathing Exercise",
    "description": "Try box breathing: inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat 5 times.",
    "recommendation_type": "breathing",
    "priority": "high",
    "created_at": "2026-03-16T10:22:00"
  },
  {
    "id": "rec-uuid-2...",
    "title": "Journaling Prompt",
    "description": "Take a few minutes to write down three small things you noticed today...",
    "recommendation_type": "journaling",
    "priority": "medium",
    "created_at": "2026-03-16T10:22:00"
  }
]
```

`recommendation_type` values: `breathing` | `journaling` | `rest` | `social` | `professional`
`priority` values: `low` | `medium` | `high`

---

## 13. History Endpoints

### `GET /history/assessments`
**Paginated list of your assessments, newest first.**
Requires authentication.

**Query parameters:**
| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `limit` | 20 | 1–100 | Items per page |
| `offset` | 0 | ≥ 0 | Skip N items |

In Swagger, these appear as form fields under the endpoint.

**Example:** `GET /history/assessments?limit=5&offset=0`

**Response `200`:** Array of AssessmentResponse objects.

---

### `GET /history/trend`
**Last N risk scores for trend charting.**
Requires authentication.

**Query parameter:**
| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `limit` | 10 | 1–50 | Number of scores to return |

**Response `200`:** Array of RiskScore objects ordered by recency.
Useful for plotting stress/crisis trends over multiple sessions.

---

### `GET /history/summary`
**Aggregate statistics for your account.**
Requires authentication. No parameters.

**Response `200`:**
```json
{
  "total_assessments": 5,
  "completed_assessments": 4,
  "avg_stress_score": 0.412,
  "avg_mood_score": 0.581,
  "crisis_events": 1
}
```

---

## 14. What Each Response Field Means

| Field | Range | Meaning |
|-------|-------|---------|
| `stress_score` | 0.0 – 1.0 | Higher = more stress signals detected |
| `mood_score` | 0.0 – 1.0 | Higher = better mood |
| `low_mood_score` | 0.0 – 1.0 | Inverse of mood — higher = lower mood |
| `burnout_score` | 0.0 – 1.0 | Combined stress + low mood exhaustion signal |
| `social_withdrawal_score` | 0.0 – 1.0 | Absence/avoidance signals from video + audio |
| `crisis_score` | 0.0 – 1.0 | Overall risk signal — above 0.65 raises `crisis_flag` |
| `emotional_distress_score` | 0.0 – 1.0 | Average of stress + low_mood |
| `confidence_score` | 0.0 – 1.0 | How many modalities were used (0.25 per modality) |
| `wellness_flag` | 0 or 1 | 1 = distress score ≥ 0.5 |
| `crisis_flag` | 0 or 1 | 1 = crisis score ≥ 0.65 |
| `support_level` | low / medium / high | Mirrors `final_risk_level` |
| `final_risk_level` | low / medium / high | low < 0.4 / medium < 0.7 / high ≥ 0.7 (crisis_score) |
| `scoring_source` | nn / heuristic | `nn` = NN model used; `heuristic` = fallback |
| `face_detected` | 0 or 1 | 1 = face found in >30% of video frames |
| `lighting_score` | 0.0 – 1.0 | Average frame brightness, 1.0 = well-lit |

---

## 15. Error Reference

| Code | Meaning | Fix |
|------|---------|-----|
| `400 Email already registered` | Duplicate signup | Use a different email |
| `401 Invalid or expired token` | Missing / expired JWT | Re-login and re-authorize in Swagger |
| `401 Invalid token payload` | Malformed token | Re-login |
| `404 Assessment not found` | Wrong ID or not your assessment | Check `assessment_id` |
| `404 Text entry not found` | No text submitted yet | Call `POST /text/submit` first |
| `404 Analysis result not found` | Run not called | Call `POST /analysis/run/{id}` first |
| `413 Request Entity Too Large` | File too big | Audio max 50 MB, Video max 200 MB |
| `415 Unsupported Media Type` | Wrong file format | Use wav/mp3/mp4/webm/mov |
| `422 Unprocessable Entity` | Invalid request body | Check required fields and types |
| `500 Internal Server Error` | Server crash | Check `uvicorn` terminal output |

---

## Quick-Copy Test Payloads

### Minimal full test (text only)
```
1. POST /auth/signup          → copy token, authorize
2. POST /assessments/         → {"session_type": "checkin"}  → copy id
3. POST /text/submit          → {"assessment_id": "<id>", "raw_text": "I feel anxious and overwhelmed today"}
4. POST /analysis/run/<id>    → no body
5. GET  /analysis/result/<id>
6. GET  /analysis/recommendations/<id>
```

### High-risk text (triggers crisis_flag and safety flags)
```json
{
  "assessment_id": "<id>",
  "raw_text": "I feel completely hopeless. I want to kill myself. There is no reason to live.",
  "language": "en"
}
```
Expected: `crisis_flag=1`, `final_risk_level=high`, safety flags returned.

### Healthy user text
```json
{
  "assessment_id": "<id>",
  "raw_text": "Had a great day today! Feeling energetic and motivated. Looking forward to tomorrow.",
  "language": "en"
}
```
Expected: `final_risk_level=low`, `mood_score > 0.7`, no safety flags.
