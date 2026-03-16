"""
Authentication API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session as DBSession
from app.core.database import get_session
from app.core.security import create_access_token, verify_token
from app.schemas.user import (
    UserCreate, UserLogin, UserUpdate,
    UserResponse, UserProfileResponse, TokenResponse,
)
from app.services.auth_service import (
    create_user, authenticate_user, get_user_by_email,
    get_user_by_id, update_user, soft_delete_user,
)
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


# ── Dependency: get current user from JWT ─────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: DBSession = Depends(get_session),
) -> User:
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = get_user_by_email(session, email)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(user_data: UserCreate, session: DBSession = Depends(get_session)):
    existing = get_user_by_email(session, user_data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = create_user(session, user_data)
    token = create_access_token(data={"sub": user.email})

    return TokenResponse(
        user=UserResponse(id=user.id, email=user.email, name=user.name),
        access_token=token,
    )


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, session: DBSession = Depends(get_session)):
    user = authenticate_user(session, credentials.email, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(data={"sub": user.email})

    return TokenResponse(
        user=UserResponse(id=user.id, email=user.email, name=user.name),
        access_token=token,
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserProfileResponse)
async def update_me(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: DBSession = Depends(get_session),
):
    updated = update_user(session, current_user, updates.model_dump(exclude_unset=True))
    return updated


@router.delete("/me", status_code=204)
async def delete_me(
    current_user: User = Depends(get_current_user),
    session: DBSession = Depends(get_session),
):
    soft_delete_user(session, current_user)
    return None
