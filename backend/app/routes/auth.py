"""Auth router - auth/login endpoints."""
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt, JWTError

from ..database import get_db
from ..schemas import LoginRequest, TokenResponse, UserRead
from ..config import settings
from ..models import User as UserModel

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = 3600  # seconds


@router.post("/login", tags=["auth"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = db.query(UserModel).filter(UserModel.username == req.username).first()
    if not user or not pwd_context.verify(req.password, user.password_hash or ""):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    payload = {"sub": str(user.id), "role": user.role}
    access = jwt.encode(
        payload, settings.API_SECRET_KEY, algorithm=ALGORITHM
    )
    refresh = jwt.encode(
        {
            "sub": str(user.id),
            "exp": datetime.utcnow() + timedelta(hours=72),
            "type": "refresh",
        },
        settings.API_SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=ACCESS_TOKEN_EXPIRE,
    )


def get_current_user_from_request(
    authorization: str,
    db: Session = Depends(get_db),
) -> UserModel:
    """Decode the Bearer token and return the authenticated user."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    try:
        payload = jwt.decode(token, settings.API_SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(UserModel).filter(UserModel.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/me", response_model=UserRead, tags=["auth"])
def get_current_user(
    auth: UserModel = Depends(get_current_user_from_request),
):
    """Get current authenticated user info."""
    return auth


@router.get("/roles", tags=["auth"])
def get_roles():
    """List available roles and their permissions."""
    return {
        "roles": {
            "VIEWER": ["read"],
            "TECHNICIAN": ["read", "write"],
            "LEAD": ["read", "write", "verify_classify"],
            "ADMIN": ["read", "write", "verify_classify", "manage_all"],
        }
    }
