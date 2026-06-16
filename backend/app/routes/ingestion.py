"""Ingestion router - bulk import from JSON/CSV."""
import uuid
from datetime import datetime, timezone
from io import StringIO
from typing import List, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from geoalchemy2 import WKTElement
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ObservationCreate
from ..models import Observation
from ..routes.auth import get_current_user_from_request

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
    _auth = Depends(get_current_user_from_request),
) -> dict:
    """Import observations from JSON or CSV file."""
    content = file.file.read()
    filename = file.filename or ""

    if not content or content == b'':
        raise HTTPException(
            status_code=400,
            detail="Empty file received. Content was not forwarded."
        )

    if filename.endswith(".json") and len(content) > 5:
        try:
            records = _parse_json(content)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    elif filename.endswith(".csv") and len(content) > 5:
        records = _parse_csv(content)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported or empty file: use valid .json or .csv"
        )

    processed = 0
    errors: List[dict] = []
    job_id = uuid.uuid4()

    for idx, raw in enumerate(records):
        try:
            payload = _build_observations(raw)
            for obs in payload:
                db.add(obs)
                db.flush()  # get the id before next record
            processed += len(payload)
        except Exception as exc:
            # Parse error description to get field name if available
            error_msg = str(exc)
            field = "unknown"
            if "Missing required field" in error_msg:
                import re
                match = re.search(r"'([^']+)'", error_msg)
                if match:
                    field = match.group(1)
            errors.append({
                "row": idx,
                "field": field,
                "error": error_msg,
            })

    db.commit()

    return {
        "total": len(records),
        "created": processed,
        "updated": 0,
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

    # Build location from WKT or lat/lon fallback
    loc_wkt = raw.get("location_wkt")
    loc_lat_str = raw.get("location_lat")
    loc_lon_str = raw.get("location_lon")

    if loc_wkt:
        # Normalize the WKT input - strip POINT() if already wrapped
        loc_raw = loc_wkt.strip()
        if loc_raw.upper().startswith("POINT("):
            coords = loc_raw[6:-1].split()
            loc = WKTElement(f"POINT({coords[0]} {coords[1]})", srid=4326)
        else:
            coords = loc_raw.split()
            loc = WKTElement(f"POINT({coords[0]} {coords[1]})", srid=4326)
    elif loc_lat_str is not None and loc_lon_str is not None:
        # Fallback: accept location_lat/location_lon columns (frontend auto-detects these)
        try:
            lat = float(loc_lat_str)
            lon = float(loc_lon_str)
            loc = WKTElement(f"POINT({lon} {lat})", srid=4326)
        except (TypeError, ValueError):
            raise ValueError("location_lat/location_lat values must be numeric")
    else:
        raise ValueError("Missing required field 'location_wkt' or 'location_lat' + 'location_lon'")

    freq_start_str = raw.get("frequency_start")
    freq_end_str = raw.get("frequency_end")
    if freq_start_str is not None and freq_end_str is not None:
        frequency_start = _float("frequency_start")
        frequency_end = _float("frequency_end")
        if frequency_start is not None and frequency_end is not None and frequency_start >= frequency_end:
            raise ValueError(f"frequency_start ({frequency_start}) must be less than frequency_end ({frequency_end})")
    else:
        raise ValueError(f"Missing required field 'frequency_start' or 'frequency_end'")

    mod_str = raw.get("modulation_type")

    # Normalize classification_status — accept common synonyms and map to valid DB values
    raw_class = raw.get("classification_status", None)
    if raw_class is None:
        classification = "UNCERTAIN"
    else:
        cls = str(raw_class).strip().upper()
        # Map user-facing classification labels to valid enum values
        # Maps: input → enum value (defaults to UNCERTAIN if unrecognized)
        classification_map = {
            "UNCERTAIN": "UNCERTAIN",
            "UNCLEARIFIED": "UNCERTAIN",
            "UNVERIFIED": "UNCERTAIN",
            "VERIFIED": "VERIFIED",
            "CONFIRMED": "VERIFIED",
            "DISCARDED": "DISCARDED",
            "REJECTED": "DISCARDED",
            "FALSE_POSITIVE": "DISCARDED",
            "FP": "DISCARDED",
        }
        classification = classification_map.get(cls, "UNCERTAIN")

    # Convert is_current: CSV/JSON may send string "true"/"false"
    raw_current = raw.get("is_current", None)
    if raw_current is None:
        is_current = True
    elif isinstance(raw_current, bool):
        is_current = raw_current
    else:
        is_current = str(raw_current).strip().lower() in ("true", "1", "yes")

    ts_final = ts or datetime.now(timezone.utc)

    return Observation(
        observation_uuid=uuid.uuid4(),
        version=1,
        timestamp=ts_final,
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
    """Parse JSON array content, tolerating leading # comment lines (JSONC)."""
    import json
    stripped = content.strip()
    if not stripped:
        raise ValueError("Empty JSON content — the uploaded file appears to be empty or whitespace-only")
    # Strip leading comment lines and blank lines so that JSONC files with
    # header comments (e.g. "# Sample data") parse cleanly as standard JSON.
    text = stripped.decode("utf-8", errors="replace")
    lines = (line for line in text.splitlines() if line.strip() and not line.strip().startswith("#"))
    clean_text = "\n".join(lines)
    if not clean_text.strip():
        raise ValueError("Empty JSON content after stripping comments — the file contains only comments or blank lines")
    try:
        data = json.loads(clean_text.encode("utf-8").strip())
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}") from None
    return data if isinstance(data, list) else [data]


def _parse_csv(content: bytes) -> List[dict]:
    """Parse CSV content."""
    import csv
    text_content = content.decode("utf-8")
    reader = csv.DictReader(StringIO(text_content))
    return list(reader)


# --- JSON/CSV ingestion endpoints for frontend ---

@router.post("/json", tags=["ingestion"])
def ingest_json(
    payload: JSONIngestionPayload,
    db: Session = Depends(get_db),
    _auth = Depends(get_current_user_from_request),
) -> dict:
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
def ingest_csv(
    payload: JSONIngestionPayload,
    db: Session = Depends(get_db),
    _auth = Depends(get_current_user_from_request),
) -> dict:
    """Bulk ingest observations treating the JSON array like CSV rows."""
    return ingest_json(payload, db)


@router.get("/history", tags=["ingestion"])
def get_ingestion_history(
    limit: int = 10,
    db: Session = Depends(get_db),
    _auth = Depends(get_current_user_from_request),
) -> list:
    """Return recent import results from the Observations model."""
    import datetime
    
    results = []
    # Get recent observations created by import
    # Query all observations and sort by newest first
    obs_list = db.query(Observation).order_by(
        Observation.created_at.desc()
    ).limit(limit).all()
    
    for obs in obs_list:
        results.append({
            "id": str(obs.id),
            "frequency_start": obs.frequency_start,
            "frequency_end": obs.frequency_end,
            "bandwidth": obs.bandwidth,
            "modulation_type": obs.modulation_type,
            "signal_strength": obs.signal_strength,
            "classification_status": obs.classification_status,
            "timestamp": obs.timestamp.isoformat() if obs.timestamp else None,
            "created_at": obs.created_at.isoformat() if obs.created_at else None,
            "imported": True,
        })
    
    return results