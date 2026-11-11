"""
FastAPI dependencies for database sessions and authenticated current user resolution.
"""

import uuid
from typing import Annotated
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.exceptions import UnauthorizedException
from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedException("Authentication required. Please sign in.")

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        if not sub:
            raise UnauthorizedException("Invalid authentication token payload.")
        user_id = uuid.UUID(str(sub))
    except (InvalidTokenError, ValueError) as exc:
        raise UnauthorizedException("Your session has expired or the token is invalid.") from exc

    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if user is None:
        raise UnauthorizedException("User account associated with this token no longer exists.")
    if not user.is_active:
        raise UnauthorizedException("User account is inactive.")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
