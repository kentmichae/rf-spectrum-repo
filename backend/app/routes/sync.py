"""Sync router - incremental sync between field nodes and core."""
import uuid
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import SyncRequest, SyncResponse
from ..models import Observation, AuditTrail

router = APIRouter()


@router.post("", tags=["sync"])
def sync(payload: SyncRequest, db: Session = Depends(get_db)):
    """Process incremental sync from a field node or to core.

    Accepts a list of deltas and applies them to the central database.
    Returns counts of accepted / rejected records.
    """
    accepted = 0
    rejected = 0
    missing_ids: List[uuid.UUID] = []

    for delta in payload.deltas:
        # Check if record exists at expected version
        existing = db.query(Observation).filter(
            Observation.observation_uuid == delta.observation_uuid,
            Observation.version >= delta.version,
        ).first()

        if existing:
            # Merge update fields onto a new version
            new_version = existing.version + 1
            new_obs = Observation(
                observation_uuid=existing.observation_uuid,
                version=new_version,
                timestamp=delta.changes.get("timestamp", existing.timestamp),
                frequency_start=delta.changes.get(
                    "frequency_start", existing.frequency_start
                ),
                frequency_end=delta.changes.get(
                    "frequency_end", existing.frequency_end
                ),
                bandwidth=delta.changes.get("bandwidth", existing.bandwidth),
                modulation_type=delta.changes.get(
                    "modulation_type", existing.modulation_type
                ),
                signal_strength=delta.changes.get(
                    "signal_strength", existing.signal_strength
                ),
                classification_status=delta.changes.get(
                    "classification_status", existing.classification_status
                ),
                notes=delta.changes.get("notes", existing.notes),
                equipment_id=existing.equipment_id,
                technician_id=existing.technician_id,
                location=existing.location,
                is_current=True,
            )
            existing.is_current = False
            db.add(new_obs)

            # Audit log
            audit = AuditTrail(
                observation_id=new_obs.id,
                changed_by=delta.changed_by or payload.client_id,
                change_timestamp=delta.timestamp or None,
                old_value=None,
                new_value=delta.changes,
            )
            db.add(audit)
            accepted += 1
        else:
            # Server has older data — send missing deltas back
            missing_ids.append(delta.observation_uuid)
            rejected += 1

    db.commit()

    return SyncResponse(
        status="completed",
        accepted_count=accepted,
        rejected_count=rejected,
        missing_deltas=missing_ids,
    )


@router.get("", tags=["sync"])
def get_sync_state(client_id: str, db: Session = Depends(get_db)):
    """Get most recent sync state for a client."""
    last = db.query(AuditTrail).filter(
        AuditTrail.changed_by == client_id
    ).order_by(AuditTrail.change_timestamp.desc()).first()

    return {
        "client_id": client_id,
        "last_sync_epoch": int(time.time()) if last else 0,
        "last_timestamp": last.change_timestamp.isoformat() if last else None,
    }
