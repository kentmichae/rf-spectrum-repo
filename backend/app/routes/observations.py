"""Observations CRUD router."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement, shape
import shapely.wkt

from ..database import get_db
from ..schemas import (
    ObservationCreate,
    ObservationUpdate,
    ObservationRead,
    ObservationBulkCreate,
)
from ..models import Observation


def _obs_to_dict(obs: Observation) -> dict:
    """Convert an Observation model to a dict suitable for ObservationRead."""
    loc_wkt = "POINT(0 0)"
    if obs.location is not None:
        try:
            geom = shape.to_shape(obs.location)
            loc_wkt = shapely.wkt.dumps(geom)
        except Exception:
            loc_wkt = str(obs.location)
    
    return {
        "id": obs.id,
        "observation_uuid": obs.observation_uuid,
        "version": obs.version,
        "timestamp": obs.timestamp,
        "frequency_start": obs.frequency_start,
        "frequency_end": obs.frequency_end,
        "bandwidth": obs.bandwidth,
        "modulation_type": obs.modulation_type,
        "signal_strength": obs.signal_strength,
        "classification_status": obs.classification_status,
        "notes": obs.notes,
        "equipment_id": obs.equipment_id,
        "technician_id": obs.technician_id,
        "location_wkt": loc_wkt,
        "is_current": obs.is_current,
        "created_at": obs.created_at,
    }


router = APIRouter()


@router.get("", response_model=List[ObservationRead], tags=["observations"])
def list_observations(
    page_size: int = Query(20, ge=1, le=200),
    page_num: int = Query(1, ge=1),
    classification: Optional[str] = None,
    technician_id: Optional[uuid.UUID] = None,
    freq_min: Optional[float] = None,
    freq_max: Optional[float] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    km_radius_km: Optional[float] = None,
    equipment_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
):
    """List observations with optional filters.

    Supports frequency range filters and spatial point search via lat/lng + radius.
    """
    query = db.query(Observation)

    if classification:
        query = query.filter(Observation.classification_status == classification)
    if technician_id:
        query = query.filter(Observation.technician_id == technician_id)
    if freq_min is not None and freq_max is not None:
        query = query.filter(
            Observation.frequency_end >= freq_min,
            Observation.frequency_start <= freq_max,
        )
    if equipment_id:
        query = query.filter(Observation.equipment_id == equipment_id)

    # Spatial filter
    if lat is not None and lng is not None:
        point_wkt = f"POINT({lng} {lat})"
        point_geom = WKTElement(point_wkt, srid=4326)
        radius_m = (km_radius_km * 1000) if km_radius_km else 5000
        query = query.filter(
            Observation.location.ST_DWithin(point_geom, radius_m)
        )

    total = query.count()
    results = query.order_by(Observation.timestamp.desc())
    results = results.offset((page_num - 1) * page_size).limit(page_size).all()
    return [_obs_to_dict(o) for o in results]  # type: ignore[return-value]


@router.post("", response_model=ObservationRead, tags=["observations"])
def create_observation(
    payload: ObservationCreate,
    db: Session = Depends(get_db),
):
    """Create a new observation record."""
    loc = WKTElement(
        payload.location_wkt,
        srid=4326,
    )

    obs = Observation(
        observation_uuid=uuid.uuid4(),
        version=1,
        timestamp=payload.timestamp,
        frequency_start=payload.frequency_start,
        frequency_end=payload.frequency_end,
        bandwidth=payload.bandwidth,
        modulation_type=payload.modulation_type,
        signal_strength=payload.signal_strength,
        classification_status=payload.classification_status,
        notes=payload.notes,
        equipment_id=payload.equipment_id,
        technician_id=payload.technician_id,
        location=loc,
        is_current=True,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return _obs_to_dict(obs)  # type: ignore[return-value]


@router.get("/{obs_id}", response_model=ObservationRead, tags=["observations"])
def get_observation(
    obs_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Get single observation by UUID."""
    obs = db.query(Observation).filter(Observation.id == obs_id).first()
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    return _obs_to_dict(obs)  # type: ignore[return-value]


@router.put("/{obs_id}", response_model=ObservationRead, tags=["observations"])
def update_observation(
    obs_id: uuid.UUID,
    payload: ObservationUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing observation (creates version bump)."""
    obs = db.query(Observation).filter(Observation.id == obs_id).first()
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")

    # Create a versioned copy
    new_version = obs.version + 1
    update_data = payload.model_dump(exclude_unset=True)

    new_obs = Observation(
        observation_uuid=obs.observation_uuid,
        version=new_version,
        timestamp=update_data.get("timestamp", obs.timestamp),
        frequency_start=update_data.get("frequency_start", obs.frequency_start),
        frequency_end=update_data.get("frequency_end", obs.frequency_end),
        bandwidth=update_data.get("bandwidth", obs.bandwidth),
        modulation_type=update_data.get("modulation_type", obs.modulation_type),
        signal_strength=update_data.get("signal_strength", obs.signal_strength),
        classification_status=update_data.get(
            "classification_status", obs.classification_status
        ),
        notes=update_data.get("notes", obs.notes),
        equipment_id=update_data.get("equipment_id", obs.equipment_id),
        technician_id=obs.technician_id,
        location=obs.location,
        is_current=True,
    )

    if "location_wkt" in update_data:
        new_obs.location = WKTElement(
            update_data['location_wkt'],
            srid=4326,
        )

    # Mark previous as not current
    obs.is_current = False

    db.add(new_obs)
    db.commit()
    db.refresh(new_obs)
    return new_obs


@router.delete("/{obs_id}", tags=["observations"])
def delete_observation(
    obs_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Soft-delete an observation by marking is_current=False."""
    obs = db.query(Observation).filter(Observation.id == obs_id).first()
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    obs.is_current = False
    db.commit()
    return {"status": "deleted", "message": "Observation soft-deleted"}
