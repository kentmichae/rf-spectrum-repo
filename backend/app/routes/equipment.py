"""Equipment router - equipment CRUD endpoints."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import EquipmentCreate, EquipmentUpdate, EquipmentRead
from ..models import Equipment as EquipmentModel

router = APIRouter()


@router.get("", response_model=List[EquipmentRead], tags=["equipment"])
def list_equipment(
    search: Optional[str] = None,
    page_size: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    """List all equipment with optional search."""
    query = db.query(EquipmentModel)
    if search:
        query = query.filter(
            EquipmentModel.model.ilike(f"%{search}%") |
            EquipmentModel.serial_number.ilike(f"%{search}%")
        )
    equipment = query.offset((page - 1) * page_size).limit(page_size).all()
    return equipment  # type: ignore[return-value]


@router.get("/{equip_id}", response_model=EquipmentRead, tags=["equipment"])
def get_equipment(
    equip_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Get a single equipment by ID."""
    equip = db.query(EquipmentModel).filter(EquipmentModel.id == equip_id).first()
    if not equip:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equip  # type: ignore[return-value]


@router.post("", response_model=EquipmentRead, tags=["equipment"], status_code=201)
def create_equipment(
    payload: EquipmentCreate,
    db: Session = Depends(get_db),
):
    """Create a new equipment record."""
    equip = EquipmentModel(
        model=payload.model,
        serial_number=payload.serial_number,
        firmware_version=payload.firmware_version or "",
        status="ACTIVE",
    )
    db.add(equip)
    db.commit()
    db.refresh(equip)
    return equip  # type: ignore[return-value]


@router.put("/{equip_id}", response_model=EquipmentRead, tags=["equipment"])
def update_equipment(
    equip_id: uuid.UUID,
    payload: EquipmentUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing equipment record."""
    equip = db.query(EquipmentModel).filter(EquipmentModel.id == equip_id).first()
    if not equip:
        raise HTTPException(status_code=404, detail="Equipment not found")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(equip, key, value)
    db.add(equip)
    db.commit()
    db.refresh(equip)
    return equip  # type: ignore[return-value]


@router.delete("/{equip_id}", status_code=204, tags=["equipment"])
def delete_equipment(
    equip_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Delete an equipment record."""
    equip = db.query(EquipmentModel).filter(EquipmentModel.id == equip_id).first()
    if not equip:
        raise HTTPException(status_code=404, detail="Equipment not found")
    db.delete(equip)
    db.commit()
