"""RF-SOR API (v0.4.0)"""

import logging
from contextlib import asynccontextmanager
import traceback

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    version="0.4.0",
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

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    logger.error("Unhandled exception: %s", exc)
    logger.error("Traceback: %s", traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )


# ========= Health ==
# Top-level /health for Docker healthcheck and K8s probes;
# /api/health/* for the router-based endpoints.

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "0.4.0"}


# ====== TODO: Wire routers ===

from .routes import equipment, health, observations, users, auth, ingestion, sync, spatial  # noqa: E402
app.include_router(equipment.router, prefix="/api/equipment", tags=["equipment"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(observations.router, prefix="/api/observations", tags=["observations"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["ingestion"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])
app.include_router(spatial.router, prefix="/api/spatial", tags=["spatial"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
