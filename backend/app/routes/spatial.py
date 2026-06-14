"""Spatial query router - spatial filtering, regions, and maps."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement, WKBElement
from geoalchemy2.shape import to_shape
import shapely.wkt

from ..database import get_db
from ..routes.auth import get_current_user_from_request
from ..schemas import RegionCreate, RegionUpdate, RegionRead
from ..models import Region, Observation

router = APIRouter()


def _wkt_to_latlng(wkt: str) -> dict:
    """Parse a WKT POINT string into {'lat': float, 'lng': float}."""
    if not wkt:
        return {"lat": 0.0, "lng": 0.0}
    try:
        wkt = wkt.strip()
        # Handle "POINT(lng lat)" format from ST_AsText
        if wkt.upper().startswith("POINT("):
            coords = wkt[6:-1].split()
            return {"lng": float(coords[0]), "lat": float(coords[1])}
        if wkt.upper().startswith("MULTIPOINT("):
            inner = wkt[wkt.index("(")+1:wkt.rindex(")")]
            first = inner.split()[0]
            inner_coords = first.strip("()").split()
            return {"lng": float(inner_coords[0]), "lat": float(inner_coords[1])}
    except (ValueError, IndexError):
        pass
    return {"lat": 0.0, "lng": 0.0}


@router.get("/observations/by_region", tags=["spatial"])
def get_observations_by_region(
    region_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> List[dict]:
    """Get all observations within a defined polygon region."""
    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    # Convert boundary to WKT safely (handles WKBElement and raw WKT)
    boundary = region.boundary
    if isinstance(boundary, WKBElement):
        shape_obj = to_shape(boundary)
        boundary_str = shapely.wkt.dumps(shape_obj)
    elif hasattr(boundary, "wkt"):
        boundary_str = boundary.wkt
    else:
        boundary_str = str(boundary)
    wkt_region = WKTElement(boundary_str, srid=4326)
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
            "location": _wkt_to_latlng(str(o.location) if o.location else ""),
        }
        for o in observations
    ]


@router.get("/observations/by_distance", tags=["spatial"])
def get_observations_by_distance(
    lat: float = Query(..., gt=-90, lt=90),
    lng: float = Query(..., gt=-180, lt=180),
    radius_km: float = Query(50, gt=0),
    db: Session = Depends(get_db),
) -> List[dict]:
    """Get observations within a radius (km) of a point."""
    point_wkt = f"POINT({lng} {lat})"
    radius_m = radius_km * 1000

    results = db.execute(
        text("""SELECT id, observation_uuid, frequency_start, frequency_end,
                    signal_strength, classification_status,
                    ST_AsText(location) AS location_wkt,
                    ST_Distance(location, ST_GeomFromText(:point_wkt, 4326)) / 1000.0 AS distance_km
              FROM observations
              WHERE ST_DWithin(location, ST_GeomFromText(:point_wkt, 4326), :radius_m)
              ORDER BY distance_km"""),
        {"point_wkt": point_wkt, "radius_m": radius_m}
    ).mappings().all()

    return [
        {**r, "location": _wkt_to_latlng(r["location_wkt"])}
        for r in results
    ]


@router.get("/regions", tags=["spatial"])
def list_regions(db: Session = Depends(get_db)) -> List[RegionRead]:
    """List all defined regions."""
    return db.query(Region).all()  # type: ignore[return-value]


@router.post("/regions", tags=["spatial"])
def create_region(
    payload: RegionCreate,
    db: Session = Depends(get_db),
    _auth = Depends(get_current_user_from_request),
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


@router.get("/regions/{region_id}", tags=["spatial"])
def get_region(
    region_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> RegionRead:
    """Get a specific region by ID."""
    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return region  # type: ignore[return-value]


@router.get("/observations/by_bbox", tags=["spatial"])
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
            "location": str(o.location) if o.location else None,
        }
        for o in observations
    ]
