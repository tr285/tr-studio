"""
Authentication service encapsulating registration, login, password hashing,
and token generation. Kept strictly separate from HTTP route handlers.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import (
    AppException,
    ConflictException,
    UnauthorizedException,
)
from app.core.logging import logger
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse, UserUpdate


class AuthService:
    def __init__(self, db: Session) -> None:
        self.user_repo = UserRepository(db)

    def register_user(self, payload: UserCreate) -> TokenResponse:
        existing_email = self.user_repo.get_by_email(payload.email)
        if existing_email is not None:
            raise ConflictException("An account with this email address already exists.")

        existing_username = self.user_repo.get_by_username(payload.username)
        if existing_username is not None:
            raise ConflictException("This username is already taken. Please choose another.")

        hashed_pw = hash_password(payload.password)
        user = self.user_repo.create(
            email=payload.email,
            username=payload.username,
            hashed_password=hashed_pw,
        )
        logger.info("Registered new user id=%s email=%s", user.id, user.email)

        access_token, expires_in = create_access_token(subject=str(user.id))
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=expires_in,
            user=UserResponse.model_validate(user),
        )

    def authenticate_user(self, payload: UserLogin) -> TokenResponse:
        user = self.user_repo.get_by_email(payload.email)
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise UnauthorizedException("Invalid email address or password.")

        if not user.is_active:
            raise UnauthorizedException("This user account has been deactivated.")

        access_token, expires_in = create_access_token(subject=str(user.id))
        logger.info("Authenticated user id=%s", user.id)
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=expires_in,
            user=UserResponse.model_validate(user),
        )

    def update_profile(self, current_user: User, payload: UserUpdate) -> User:
        if payload.username is not None and payload.username.strip() != current_user.username:
            conflict = self.user_repo.get_by_username(payload.username)
            if conflict is not None and conflict.id != current_user.id:
                raise ConflictException("This username is already taken.")
            current_user.username = payload.username.strip()

        if payload.new_password:
            if not payload.current_password:
                raise AppException("Current password is required to set a new password.")
            if not verify_password(payload.current_password, current_user.hashed_password):
                raise UnauthorizedException("Current password is incorrect.")
            current_user.hashed_password = hash_password(payload.new_password)

        return self.user_repo.update(current_user)
