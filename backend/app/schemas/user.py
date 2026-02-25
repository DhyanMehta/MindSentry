"""
Pydantic schemas for request/response validation
"""
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    password: str
    confirmPassword: str
    
    @field_validator('confirmPassword')
    @classmethod
    def passwords_match(cls, v, info):
        """Validate that password and confirmPassword match"""
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response data (minimal - no timestamps for frontend)"""
    id: int
    email: str
    
    class Config:
        from_attributes = True


class UserResponseWithTimestamp(BaseModel):
    """Schema for user response data with timestamp"""
    id: int
    email: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """Schema for JWT token response (legacy)"""
    access_token: str
    token_type: str = "bearer"


class TokenResponse(BaseModel):
    """Schema for authentication response matching frontend expectations"""
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for decoded token data"""
    email: str | None = None
