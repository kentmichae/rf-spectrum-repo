"""SQLAlchemy models for RF-SOR database."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column, Text, DateTime, Boolean, BigInteger, Float,
    ForeignKey, Integer, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry

from .database import Base


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    boundary: Mapped[Geometry] = mapped_column(Geometry("POLYGON", srid=4326), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    observations = relationship("Observation", back_populates="region")

    def __repr__(self):
        return f"<Region(id={self.id}, name='{self.name}')>"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    username: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(Text, nullable=False, default="VIEWER")
    region_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("regions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    region = relationship("Region", back_populates="users")
    observations = relationship("Observation", back_populates="technician", foreign_keys="Observation.technician_id")
    audit_entries = relationship("AuditTrail", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}')>"


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    serial_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    firmware_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    observations = relationship("Observation", back_populates="equipment")

    def __repr__(self):
        return f"<Equipment(id={self.id}, model='{self.model}')>"


class Observation(Base):
    """Core observation record with version tracking."""
    __tablename__ = "observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    observation_uuid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    frequency_start: Mapped[float] = mapped_column(Float, nullable=False)
    frequency_end: Mapped[float] = mapped_column(Float, nullable=False)
    bandwidth: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    modulation_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    signal_strength: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    classification_status: Mapped[str] = mapped_column(Text, nullable=False, default="UNCERTAIN")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    equipment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("equipment.id"), nullable=True)
    technician_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    location: Mapped[Geometry] = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    equipment = relationship("Equipment", back_populates="observations")
    technician = relationship("User", back_populates="observations", foreign_keys=[technician_id])
    audit_trail = relationship("AuditTrail", back_populates="observation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Observation(id={self.id}, ver={self.version}, freq={self.frequency_start}-{self.frequency_end}MHz)>"


class AuditTrail(Base):
    __tablename__ = "audit_trail"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    observation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("observations.id"), nullable=False)
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    change_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    old_value: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    observation = relationship("Observation", back_populates="audit_trail")
    user = relationship("User", back_populates="audit_entries")

    def __repr__(self):
        return f"<Audit(id={self.id}, obs={self.observation_id}, ts={self.change_timestamp})>"
