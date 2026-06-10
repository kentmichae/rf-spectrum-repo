"""Users router."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..schemas import (
    UserCreate, UserRead, UserUpdate
)
from ..models import User as UserModel

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter()


@router.get("", tags=["users"])
def list_users(
    page_size: int = 20,
    page: int = 1,
    db: Session = Depends(get_db),
) -> List[UserRead]:
    """List all users."""
    users = db.query(UserModel).offset((page - 1) * page_size).limit(page_size).all()
    return users  # type: ignore[return-value]


@router.post("", tags=["users"])
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
) -> UserRead:
    """Create a new user."""
    user = UserModel(
        username=payload.username,
        email=payload.email,
        password_hash=pwd_context.hash(payload.password),
        role=payload.role,
        region_id=payload.region_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user  # type: ignore[return-value]


@router.put("/{user_id}", tags=["users"])
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
) -> UserRead:
    """Update a existing user."""
    existing = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not existing:
        raise HTTPException(status=404, detail="User not found")

    update_fields = payload.model_dump(exclude_unset=True)
    if "password" in update_fields:
        update_fields["password_hash"] = pwd_context.hash(update_fields.pop("password"))

    for key, value in update_fields.items():
        setattr(existing, key, value)

    db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing  # type: ignore[return-value]


@router.delete("/{user_id}", tags=["users"])
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """Delete (disable) a user."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}