"""RF-SOR API (v0.3.0)"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect as sqla_inspect
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db, engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("RF-SOR API starting — version %s", app.version)
    db_url = settings.DATABASE_URL
    masked = db_url[:30] + "..." + db_url[-10:] if len(db_url) > 40 else db_url
    logger.info("DATABASE_URL = %s", masked)
    yield
    engine.dispose()
    logger.info("RF-SOR API stopped")


app = FastAPI(
    title="RF Spectrum Observation Repository (RF-SOR) API",
    version="0.3.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
origins = ["http://localhost:3000", "http://localhost:8081"]
cors_str = getattr(settings, "CORS_ORIGINS", "")
if cors_str:
    origins = [o.strip() for o in cors_str.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================== Health ===

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": app.version}


@app.get("/db-check")
async def db_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}


# ============ TODO: Wire routers ===

from .routes import health, observations, users, auth, ingestion, sync  # noqa: E402
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(observations.router, prefix="/api/observations", tags=["observations"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["ingestion"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
