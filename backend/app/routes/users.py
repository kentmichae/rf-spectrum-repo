"""Users router - user CRUD endpoints."""
import uuid

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    UserCreate, UserUpdate, UserRead,
)
from ..models import User as UserModel

router = APIRouter()


@router.get("", tags=["users"])
def list_users(
    page_size: int = 20,
    page: int = 1,
    db: Session = Depends(get_db),
):
    """List all users."""
    users = db.query(UserModel).offset((page - 1) * page_size).limit(page_size).all()
    return users


@router.get("/{user_id}", response_model=UserRead, tags=["users"])
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Get a single user by ID."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("", status_code=201, response_model=UserRead, tags=["users"])
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    """Create a new user account.
    
    NOTE: Self-assigned ADMIN or LEAD roles will default to VIEWER.
    """
    # Self-assigned privileged roles default to VIEWER
    if payload.role in ("ADMIN", "LEAD"):
        role = "VIEWER"
    else:
        role = payload.role
    
    # Check duplicate username
    existing = db.query(UserModel).filter(UserModel.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    
    # Check duplicate email
    existing_email = db.query(UserModel).filter(UserModel.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    # Hash password
    import bcrypt
    hashed = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    user = UserModel(
        username=payload.username,
        email=payload.email,
        password_hash=hashed,
        role=role,
        region_id=payload.region_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserRead, tags=["users"])
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing user."""
    existing = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Handle password update
    if "password" in update_data:
        import bcrypt
        update_data["password_hash"] = bcrypt.hashpw(
            update_data.pop("password").encode("utf-8"), 
            bcrypt.gensalt()
        ).decode("utf-8")
    
    for key, value in update_data.items():
        setattr(existing, key, value)
    
    db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


@router.delete("/{user_id}", status_code=204, tags=["users"])
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Delete a user account."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return None


@router.get("/search", response_model=list[UserRead], tags=["users"])
def search_users(
    q: str,
    db: Session = Depends(get_db),
):
    """Search users by username or email."""
    users = db.query(UserModel).filter(
        (UserModel.username.ilike(f"%{q}%")) | 
        (UserModel.email.ilike(f"%{q}%"))
    ).limit(20).all()
    return users
