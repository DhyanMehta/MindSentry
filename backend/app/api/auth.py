"""
Authentication API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session
from app.core.database import get_session
from app.core.security import create_access_token, verify_token
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.services.auth_service import create_user, authenticate_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(
    user_data: UserCreate,
    session: Session = Depends(get_session)
):
    """
    Register a new user
    
    - **email**: Valid email address
    - **password**: User password (will be hashed)
    - **confirmPassword**: Password confirmation (must match password)
    """
    # Check if user already exists
    existing_user = get_user_by_email(session, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = create_user(session, user_data)
    
    # Generate access token
    access_token = create_access_token(data={"sub": user.email})
    
    # Return response matching frontend expectations
    return TokenResponse(
        user=UserResponse(id=user.id, email=user.email),
        access_token=access_token,
        token_type="bearer"
    )


@router.post("/login", response_model=TokenResponse)
def login(
    credentials: UserLogin,
    session: Session = Depends(get_session)
):
    """
    Login with email and password
    
    - **email**: User email
    - **password**: User password
    """
    user = authenticate_user(session, credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate access token
    access_token = create_access_token(data={"sub": user.email})
    
    # Return response matching frontend expectations
    return TokenResponse(
        user=UserResponse(id=user.id, email=user.email),
        access_token=access_token,
        token_type="bearer"
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
) -> UserResponse:
    """
    Get current authenticated user from JWT token
    
    This is a dependency that can be used to protect routes
    """
    token = credentials.credentials
    
    # Verify token
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    user = get_user_by_email(session, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return UserResponse(id=user.id, email=user.email)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """
    Get current user information
    
    Requires authentication via Bearer token in the Authorization header
    """
    return current_user
