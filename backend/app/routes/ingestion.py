"""Ingestion router - bulk import from JSON/CSV."""
import uuid
from datetime import datetime
from io import StringIO
from typing import List, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from geoalchemy2 import WKTElement
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ObservationCreate
from ..models import Observation

router = APIRouter()


# Standard column headers that ingestion should map to the Observation model.
EXPECTED_FIELDS = [
    "observation_uuid", "timestamp", "frequency_start", "frequency_end",
    "bandwidth", "modulation_type", "signal_strength", "classification_status",
    "notes", "equipment_id", "technician_id", "location_wkt", "is_current",
]


class JSONIngestionPayload(BaseModel):
    """Payload for JSON/CSV ingestion via route."""
    data: List[dict]
    source: str = "frontend"


@router.post("/upload", tags=["ingestion"])
def upload_observations(
    file: UploadFile = File(...),
    source_name: str = "upload",
    db: Session = Depends(get_db),
) -> dict:
    """Import observations from JSON or CSV file."""
    content = file.file.read()
    filename = file.filename or ""

    if filename.endswith(".json"):
        records = _parse_json(content)
    elif filename.endswith(".csv"):
        records = _parse_csv(content)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type: use .json or .csv"
        )

    processed = 0
    errors: List[str] = []
    job_id = uuid.uuid4()

    for idx, raw in enumerate(records):
        try:
            payload = _build_observations(raw)
            for obs in payload:
                db.add(obs)
                db.flush()  # get the id before next record
            processed += len(payload)
        except Exception as exc:
            errors.append(f"Row {idx}: {exc}")

    db.commit()

    return {
        "job_id": job_id,
        "status": "completed",
        "total_records": len(records),
        "processed": processed,
        "errors": errors,
    }


def _build_observations(raw: dict) -> List[Observation]:
    """Turn a parsed row (dict) into one or more Observation ORM objects."""
    if isinstance(raw, list):
        return [_build_one(raw[i]) for i in range(len(raw))]
    return [_build_one(raw)]


def _build_one(raw: dict) -> Observation:
    """Validate and build a single Observation from a raw dict."""

    def _float(field: str):
        val = raw.get(field)
        if val is None:
            return None
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    ts = raw.get("timestamp")
    if ts is not None:
        ts = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))

    # Must have at least location_wkt and frequencies
    loc_wkt = raw.get("location_wkt")
    if not loc_wkt:
        raise ValueError(f"Missing required field 'location_wkt'")

    # Normalize the WKT input - strip POINT() if already wrapped
    loc_raw = loc_wkt.strip()
    if loc_raw.upper().startswith("POINT("):
        # Input is already POINT(lng lat) format
        coords = loc_raw[6:-1].split()
        loc = WKTElement(f"POINT({coords[0]} {coords[1]})", srid=4326)
    else:
        # Input is just coordinates like "-77.0 38.9"
        coords = loc_raw.split()
        loc = WKTElement(f"POINT({coords[0]} {coords[1]})", srid=4326)

    freq_start_str = raw.get("frequency_start")
    freq_end_str = raw.get("frequency_end")
    if freq_start_str is not None and freq_end_str is not None:
        frequency_start = _float("frequency_start")
        frequency_end = _float("frequency_end")
    else:
        raise ValueError(f"Missing required field 'frequency_start' or 'frequency_end'")

    mod_str = raw.get("modulation_type")

    # Normalize classification_status — accept common synonyms and map to valid DB values
    raw_class = raw.get("classification_status", None)
    if raw_class is None:
        classification = "UNCERTAIN"
    else:
        cls = str(raw_class).strip().upper()
        # Allow both backend-expected values and common synonyms
        classification_map = {
            "UNCLASSIFIED": "UNCLASSIFIED",
            "CONFIDENTIAL": "CONFIDENTIAL",
            "CLASSIFIED": "CLASSIFIED",
            "UNCERTAIN": "UNCERTAIN",
            "VERIFIED": "VERIFIED",
            "DISCARDED": "DISCARDED",
        }
        classification = classification_map.get(cls, str(raw_class))

    # Convert is_current: CSV/JSON may send string "true"/"false"
    raw_current = raw.get("is_current", None)
    if raw_current is None:
        is_current = True
    elif isinstance(raw_current, bool):
        is_current = raw_current
    else:
        is_current = str(raw_current).strip().lower() in ("true", "1", "yes")

    return Observation(
        observation_uuid=uuid.uuid4(),
        version=1,
        timestamp=ts or datetime.utcnow(),
        frequency_start=frequency_start or 0.0,
        frequency_end=frequency_end or 0.0,
        bandwidth=_float("bandwidth"),
        modulation_type=str(mod_str) if mod_str else None,
        signal_strength=_float("signal_strength"),
        classification_status=classification,
        notes=str(raw.get("notes", "")) if raw.get("notes") is not None else None,
        equipment_id=_parse_id(raw.get("equipment_id")),
        technician_id=_parse_id(raw.get("technician_id")),
        location=loc,
        is_current=is_current,
    )


def _parse_id(val: Any):
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return None


def _parse_json(content: bytes) -> List[dict]:
    """Parse JSON array content."""
    import json
    data = json.loads(content)
    return data if isinstance(data, list) else [data]


def _parse_csv(content: bytes) -> List[dict]:
    """Parse CSV content."""
    import csv
    text_content = content.decode("utf-8")
    reader = csv.DictReader(StringIO(text_content))
    return list(reader)


# --- JSON/CSV ingestion endpoints for frontend ---

@router.post("/json", tags=["ingestion"])
def ingest_json(payload: JSONIngestionPayload, db: Session = Depends(get_db)) -> dict:
    """Bulk ingest observations from a JSON array payload."""
    processed = 0
    errors: List[str] = []
    job_id = uuid.uuid4()

    for idx, raw in enumerate(payload.data):
        try:
            obs_list = _build_one(raw)
            if isinstance(obs_list, list):
                for obs in obs_list:
                    db.add(obs)
                    db.flush()
                processed += len(obs_list)
            else:
                db.add(obs_list)
                db.flush()
                processed += 1
        except Exception as exc:
            errors.append(f"Row {idx}: {exc}")

    db.commit()

    return {
        "job_id": job_id,
        "status": "completed",
        "total_records": len(payload.data),
        "processed": processed,
        "errors": errors,
    }


@router.post("/csv", tags=["ingestion"])
def ingest_csv(payload: JSONIngestionPayload, db: Session = Depends(get_db)) -> dict:
    """Bulk ingest observations treating the JSON array like CSV rows."""
    return ingest_json(payload, db)
