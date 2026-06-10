"""Pydantic request/response schemas for RF-SOR API."""
from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


# ---- Shared ----

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- Regions ----

class RegionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    boundary: str = Field(..., description="WKT polygon string (e.g. POLYGON((...)))")


class RegionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    boundary: Optional[str] = None


class RegionRead(BaseSchema):
    id: UUID
    name: str
    created_at: datetime


# ---- Users ----

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str
    password: str = Field(..., min_length=8)
    role: str = Field(default="VIEWER", pattern="^(VIEWER|TECHNICIAN|LEAD|ADMIN)$")
    region_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(VIEWER|TECHNICIAN|LEAD|ADMIN)$")
    region_id: Optional[UUID] = None


class UserRead(BaseSchema):
    id: UUID
    username: str
    email: str
    role: str
    region_id: Optional[UUID]


# ---- Equipment ----

class EquipmentCreate(BaseModel):
    model: str = Field(..., min_length=1, max_length=255)
    serial_number: str = Field(..., min_length=1, max_length=100)
    firmware_version: Optional[str] = None


class EquipmentUpdate(BaseModel):
    firmware_version: Optional[str] = None


class EquipmentRead(BaseSchema):
    id: UUID
    model: str
    serial_number: str
    firmware_version: Optional[str]
    created_at: datetime


# ---- Observations ----

class ObservationCreate(BaseModel):
    timestamp: datetime
    frequency_start: float = Field(..., gt=0)
    frequency_end: float = Field(..., gt=0)
    bandwidth: Optional[float] = Field(None, gt=0)
    modulation_type: Optional[str] = None
    signal_strength: Optional[float] = None  # dBm
    classification_status: str = Field(default="UNCERTAIN", pattern="^(UNCERTAIN|VERIFIED|DISCARDED)$")
    notes: Optional[str] = None
    equipment_id: Optional[UUID] = None
    technician_id: Optional[UUID] = None
    location_wkt: str = Field(..., description="WKT point string, e.g. POINT(lon lat)")
    is_current: bool = Field(default=True)


class ObservationUpdate(BaseModel):
    frequency_start: Optional[float] = Field(None, gt=0)
    frequency_end: Optional[float] = Field(None, gt=0)
    bandwidth: Optional[float] = Field(None, gt=0)
    modulation_type: Optional[str] = None
    signal_strength: Optional[float] = None
    classification_status: Optional[str] = Field(None, pattern="^(UNCERTAIN|VERIFIED|DISCARDED)$")
    notes: Optional[str] = None
    location_wkt: Optional[str] = None


class ObservationRead(BaseSchema):
    id: UUID
    observation_uuid: UUID
    version: int
    timestamp: datetime
    frequency_start: float
    frequency_end: float
    bandwidth: Optional[float]
    modulation_type: Optional[str]
    signal_strength: Optional[float]
    classification_status: str
    notes: Optional[str]
    equipment_id: Optional[UUID]
    technician_id: Optional[UUID]
    location_wkt: str
    is_current: bool
    created_at: datetime


class ObservationBulkCreate(BaseModel):
    records: list[ObservationCreate]
    source_filename: Optional[str] = None


# ---- Sync ----

class SyncDelta(BaseModel):
    """Incremental sync payload."""
    changed_by: Optional[UUID] = None
    observation_uuid: UUID
    version: int
    changes: dict[str, Any]


class SyncRequest(BaseModel):
    """Incoming sync from a field node."""
    client_id: str
    last_sync_epoch: int  # epoch seconds of last successful sync
    deltas: list[SyncDelta]


class SyncResponse(BaseModel):
    status: str
    accepted_count: int = 0
    rejected_count: int = 0
    missing_deltas: list[UUID] = Field(default_factory=list)


# ---- Auth ----

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginRequest(BaseModel):
    username: str
    password: str


class OIDCCallback(BaseModel):
    code: str
    state: str
    provider: str = "keycloak"


# ---- Health ----

class HealthResponse(BaseModel):
    status: str
    version: str


class DBResponse(BaseModel):
    status: str
    error: Optional[str] = None


# ---- Ingestion ----

class IngestionJob(BaseModel):
    job_id: UUID
    status: str
    total_records: int = 0
    processed_records: int = 0
    errors: list[str] = Field(default_factory=list)
