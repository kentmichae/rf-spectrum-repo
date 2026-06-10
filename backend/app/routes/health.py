"""Health check router + app-level health endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["health"])
def health_check():
    return {"status": "healthy", "version": "0.3.0"}


@router.get("/readiness", tags=["health"])
def readiness_check():
    return {"status": "ready"}
