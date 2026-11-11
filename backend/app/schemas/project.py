"""Pydantic schemas for Project CRUD operations."""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.project import ProjectStatus


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Project title")
    description: Optional[str] = Field(None, max_length=5000, description="Project synopsis or logline")
    status: ProjectStatus = Field(default=ProjectStatus.DRAFT, description="Initial project workflow status")

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Project title cannot be blank")
        return cleaned


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    status: Optional[ProjectStatus] = None

    @field_validator("title")
    @classmethod
    def clean_optional_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Project title cannot be blank")
            return cleaned
        return v


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
