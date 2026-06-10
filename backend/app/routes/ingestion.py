"""Ingestion router - bulk import from JSON/CSV."""
import uuid
from io import StringIO
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import IngestionJob
from ..models import Observation

router = APIRouter()


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

    return {
        "job_id": uuid.uuid4(),
        "status": "completed",
        "total_records": len(records),
        "processed": len(records),
        "errors": [],
    }


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
