"""Repository for User persistence operations."""

import uuid
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        return self.db.scalar(stmt)

    def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(func.lower(User.email) == email.lower().strip())
        return self.db.scalar(stmt)

    def get_by_username(self, username: str) -> Optional[User]:
        stmt = select(User).where(func.lower(User.username) == username.lower().strip())
        return self.db.scalar(stmt)

    def create(self, email: str, username: str, hashed_password: str) -> User:
        user = User(
            email=email.lower().strip(),
            username=username.strip(),
            hashed_password=hashed_password,
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
