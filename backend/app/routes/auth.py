"""Auth router - auth/login endpoints."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
import bcrypt
from jose import jwt, JWTError

from ..database import get_db
from ..schemas import LoginRequest, TokenResponse, UserRead, UserCreate
from ..config import settings
from ..models import User as UserModel

router = APIRouter()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = 3600  # seconds
JWT_AUDIENCE = "rf-sor-api"
JWT_ISSUER = "rf-sor"


# Maximum login attempts per username per hour (brute-force protection)
_LOGIN_ATTEMPTS: dict = {}
MAX_LOGIN_ATTEMPTS = 10
LOGIN_ATTEMPT_WINDOW = 3600  # 1 hour


def _check_login_rate_limit(username: str) -> None:
    """Reject login attempts that exceed the rate limit.
    
    Raises HTTPException(429) if the user has exceeded the limit.
    """
    now = datetime.now(timezone.utc)
    attempts = _LOGIN_ATTEMPTS.get(username, [])
    # Clean old entries
    attempts = [t for t in attempts if (now - t).total_seconds() < LOGIN_ATTEMPT_WINDOW]
    _LOGIN_ATTEMPTS[username] = attempts
    if len(attempts) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many login attempts. Please try again later.",
        )


def _record_login_attempt(username: str) -> None:
    """Record a login attempt for rate limiting."""
    now = datetime.now(timezone.utc)
    attempts = _LOGIN_ATTEMPTS.get(username, [])
    attempts.append(now)
    _LOGIN_ATTEMPTS[username] = attempts


def _verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt has a hard 72-byte limit; truncate silently
    truncated = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(truncated, hashed_password.encode("utf-8"))


def _hash_password(plain_password: str) -> str:
    # bcrypt has a hard 72-byte limit; truncate silently
    truncated = plain_password.encode("utf-8")[:72]
    return bcrypt.hashpw(truncated, bcrypt.gensalt()).decode("utf-8")


@router.post("/login", tags=["auth"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    # Rate limiting check
    _check_login_rate_limit(req.username)
    
    user = db.query(UserModel).filter(UserModel.username == req.username).first()
    if not user or not _verify_password(req.password, user.password_hash or ""):
        _record_login_attempt(req.username)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Clean failed attempts on successful login
    _LOGIN_ATTEMPTS.pop(req.username, None)

    payload = {"sub": str(user.id), "role": user.role, "aud": JWT_AUDIENCE, "iss": JWT_ISSUER}
    exp = datetime.now(timezone.utc) + timedelta(seconds=ACCESS_TOKEN_EXPIRE)
    access = jwt.encode(
        payload | {"exp": exp},
        settings.API_SECRET_KEY,
        algorithm=ALGORITHM
    )
    refresh = jwt.encode(
        {
            "sub": str(user.id),
            "exp": datetime.now(timezone.utc) + timedelta(hours=72),
            "type": "refresh",
            "aud": JWT_AUDIENCE,
            "iss": JWT_ISSUER
        },
        settings.API_SECRET_KEY,
        algorithm=ALGORITHM
    )

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=ACCESS_TOKEN_EXPIRE,
    )

def get_current_user_from_request(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> UserModel:
    """Decode the Bearer token and return the authenticated user."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    try:
        payload = jwt.decode(
            token,
            settings.API_SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(UserModel).filter(UserModel.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/register", status_code=201, tags=["auth"])
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    """Register a new user account.
    
    NOTE: Public registration is DEPRECATED and will be removed.
    Self-assignment of ADMIN/LEAD roles is not permitted.
    All new registrations default to VIEWER role.
    """
    # Check for duplicate username/email
    existing_user = db.query(UserModel).filter(UserModel.username == payload.username).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Username already registered")
    existing_email = db.query(UserModel).filter(UserModel.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    # Prevent self-assigned privileged roles
    if payload.role in ("ADMIN", "LEAD"):
        raise HTTPException(
            status_code=403,
            detail="Cannot self-assign privileged role. Default role is VIEWER.",
        )
    
    # Force VIEWER role for public registration
    user = UserModel(
        username=payload.username,
        email=payload.email,
        password_hash=_hash_password(payload.password),
        role=payload.role or "VIEWER",  # Default to VIEWER
        region_id=payload.region_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
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


@router.post("/logout", tags=["auth"])
def logout():
    """Logout endpoint - JWT is stateless, so client simply discards token.
    
    This endpoint exists for API contract completeness. In a stateless JWT
    system, logout is handled client-side by removing the token from storage.
    """
    return {"status": "logged_out", "message": "Token invalidation is handled client-side. Discard your JWT token."}
