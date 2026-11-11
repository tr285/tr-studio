"""Authentication & user profile API routes."""

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.user import (
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import AuthService

router = APIRouter()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new TR STUDIO user account",
)
def register(payload: UserCreate, db: DbSession) -> TokenResponse:
    service = AuthService(db)
    return service.register_user(payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and return JWT access token",
)
def login(payload: UserLogin, db: DbSession) -> TokenResponse:
    service = AuthService(db)
    return service.authenticate_user(payload)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the currently authenticated user profile",
)
def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update the currently authenticated user's profile or password",
)
def update_me(payload: UserUpdate, current_user: CurrentUser, db: DbSession) -> UserResponse:
    service = AuthService(db)
    updated_user = service.update_profile(current_user, payload)
    return UserResponse.model_validate(updated_user)
