"""Pydantic schemas for User authentication and profile management."""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="Valid email address")
    username: str = Field(..., min_length=3, max_length=64, description="Unique studio handle")
    password: str = Field(..., min_length=8, max_length=128, description="Account password")

    @field_validator("username")
    @classmethod
    def clean_username(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Username cannot be empty")
        return cleaned


class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="Account email address")
    password: str = Field(..., min_length=1, max_length=128)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=64)
    current_password: Optional[str] = Field(None, min_length=1, max_length=128)
    new_password: Optional[str] = Field(None, min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    username: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
