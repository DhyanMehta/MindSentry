# MindSentry Backend API

Clean, scalable FastAPI backend with PostgreSQL (recommended) and JWT authentication.

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

### 3. Configure Environment (.env)

Create a `backend/.env` file:

```env
# PostgreSQL (recommended)
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/mindsentry

# App settings
DEBUG=true
SECRET_KEY=your-secret-key-change-in-production-min-32-chars-long
```

If you still want SQLite for local testing, you can use:

```env
DATABASE_URL=sqlite:///./mindsentry.db
```

### 4. Run the Server

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

PostgreSQL is recommended. On startup, the app auto-creates all tables from models.

### pgAdmin Setup

1. Create database:

```sql
CREATE DATABASE mindsentry;
```

2. Optional: create dedicated DB user:

```sql
CREATE USER mindsentry_user WITH PASSWORD 'StrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE mindsentry TO mindsentry_user;
```

3. Use matching connection string in `.env`:

```env
DATABASE_URL=postgresql+psycopg://mindsentry_user:StrongPassword123!@localhost:5432/mindsentry
```

4. Start API. Tables are created automatically.

## Security

- Passwords are hashed using Bcrypt
- JWT tokens are used for authentication
- Tokens expire after 30 days (configurable)
-All protected routes require valid JWT token
