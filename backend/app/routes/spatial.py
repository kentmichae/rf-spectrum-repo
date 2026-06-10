"""Spatial query router - spatial filtering, regions, and maps."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement, shape

from ..database import get_db
from ..schemas import RegionCreate, RegionUpdate, RegionRead
from ..models import Region, Observation

router = APIRouter()


@router.get("/spatial/observations/by_region", tags=["spatial"])
def get_observations_by_region(
    region_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> List[dict]:
    """Get all observations within a defined polygon region."""
    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    # Use ST_Intersects to find observations within the polygon
    wkt_region = WKTElement(region.boundary.wkt, srid=4326)
    observations = db.query(Observation).filter(
        Observation.location.ST_Intersects(wkt_region)
    ).all()

    return [
        {
            "id": str(o.id),
            "observation_uuid": str(o.observation_uuid),
            "frequency_start": o.frequency_start,
            "frequency_end": o.frequency_end,
            "signal_strength": o.signal_strength,
            "classification": o.classification_status,
            "location": {"lat": o.location.y, "lng": o.location.x} if o.location else None,
        }
        for o in observations
    ]


@router.get("/spatial/observations/by_distance", tags=["spatial"])
def get_observations_by_distance(
    lat: float = Query(..., gt=-90, lt=90),
    lng: float = Query(..., gt=-180, lt=180),
    radius_km: float = Query(50, gt=0),
    db: Session = Depends(get_db),
) -> List[dict]:
    """Get observations within a radius (km) of a point."""
    point_wkt = f"POINT({lng} {lat})"
    point_geom = WKTElement(point_wkt, srid=4326)
    radius_m = radius_km * 1000

    observations = db.query(Observation).filter(
        Observation.location.ST_DWithin(point_geom, radius_m)
    ).all()

    return [
        {
            "id": str(o.id),
            "observation_uuid": str(o.observation_uuid),
            "frequency_start": o.frequency_start,
            "frequency_end": o.frequency_end,
            "signal_strength": o.signal_strength,
            "classification": o.classification_status,
            "distance_km": round(o.location.ST_Distance(point_geom) * 0.001, 2),
        }
        for o in observations
    ]


@router.get("/spatial/regions", tags=["spatial"])
def list_regions(db: Session = Depends(get_db)) -> List[RegionRead]:
    """List all defined regions."""
    return db.query(Region).all()  # type: ignore[return-value]


@router.post("/spatial/regions", tags=["spatial"])
def create_region(
    payload: RegionCreate,
    db: Session = Depends(get_db),
) -> RegionRead:
    """Register a new geofence region."""
    boundary = WKTElement(payload.boundary, srid=4326)
    region = Region(
        name=payload.name,
        boundary=boundary,
    )
    db.add(region)
    db.commit()
    db.refresh(region)
    return region  # type: ignore[return-value]


@router.get("/spatial/regions/{region_id}", tags=["spatial"])
def get_region(
    region_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> RegionRead:
    """Get a specific region by ID."""
    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return region  # type: ignore[return-value]


@router.get("/spatial/observations/by_bbox", tags=["spatial"])
def get_observations_by_bbox(
    lng_min: float = Query(..., gt=-180, lt=180),
    lat_min: float = Query(..., gt=-90, lt=90),
    lng_max: float = Query(..., gt=-180, lt=180),
    lat_max: float = Query(..., gt=-90, lt=90),
    db: Session = Depends(get_db),
) -> List[dict]:
    """Get observations within a bounding box."""
    wkt_bbox = (
        f"POLYGON(({lng_min} {lat_min}, {lng_max} {lat_min}, "
        f"{lng_max} {lat_max}, {lng_min} {lat_max}, {lng_min} {lat_min}))"
    )
    bbox_geom = WKTElement(wkt_bbox, srid=4326)

    observations = db.query(Observation).filter(
        Observation.location.ST_Intersects(bbox_geom)
    ).all()

    return [
        {
            "id": str(o.id),
            "observation_uuid": str(o.observation_uuid),
            "frequency_start": o.frequency_start,
            "frequency_end": o.frequency_end,
            "signal_strength": o.signal_strength,
            "classification": o.classification_status,
            "location": {"lat": o.location.y, "lng": o.location.x} if o.location else None,
        }
        for o in observations
    ]
