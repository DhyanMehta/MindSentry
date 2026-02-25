# MindSentry Backend API

Clean, scalable FastAPI backend with SQLite database and JWT authentication.

## Setup Instructions

### 1. Create Virtual Environment

**Windows:**
```powershell
python -m venv venv
venv\Scripts\activate
```

**Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Server

```bash
uvicorn app.main:app --reload
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs

## Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py          # Configuration settings
│   │   ├── security.py        # JWT and password utilities
│   │   └── database.py        # Database connection
│   ├── models/
│   │   └── user.py            # User database model
│   ├── schemas/
│   │   └── user.py            # Pydantic schemas
│   ├── api/
│   │   └── auth.py            # Authentication routes
│   ├── services/
│   │   └── auth_service.py    # Authentication business logic
│   └── main.py                # FastAPI application
├── mindsentry.db              # SQLite database (auto-created)
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## API Endpoints

### Authentication

#### POST /auth/signup
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbG...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2026-02-24T10:00:00"
  }
}
```

#### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbG...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2026-02-24T10:00:00"
  }
}
```

#### GET /auth/me
Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <your_access_token>
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "created_at": "2026-02-24T10:00:00"
}
```

## Testing

1. Start the server: `uvicorn app.main:app --reload`
2. Open http://localhost:8000/docs
3. Test endpoints:
   - Signup a new user
   - Login to get access token
   - Click "Authorize" button and enter token
   - Test /auth/me endpoint

## Database

This project uses SQLite for simplicity. The database file `mindsentry.db` is automatically created on first run.

## Security

- Passwords are hashed using Bcrypt
- JWT tokens are used for authentication
- Tokens expire after 30 days (configurable)
-All protected routes require valid JWT token
