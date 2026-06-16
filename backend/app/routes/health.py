"""Health check router + app-level health endpoints."""
from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import Depends

from ..database import get_db, engine

router = APIRouter()


@router.get("/health", tags=["health"])
def health_check():
    return {"status": "healthy", "version": "0.4.0"}


@router.get("/readiness", tags=["health"])
def readiness_check():
    return {"status": "ready"}


@router.get("/db-check", tags=["health"])
def db_check(db: Session = Depends(get_db)):
    """Database connectivity check."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}
