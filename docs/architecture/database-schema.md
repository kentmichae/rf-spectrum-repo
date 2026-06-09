# Database Schema Design: RF-SOR

## 1. Design Goals
- Support millions of RF records with fast geospatial retrieval.
- Maintain full audit history.
- Normalized structure to avoid redundancy.

## 2. Logical Schema

### 2.1 `users`
- `id`: UUID (PK)
- `username`: String (Unique)
- `email`: String
- `role`: Enum (VIEWER, TECHNICIAN, LEAD, ADMIN)
- `region_id`: UUID (FK to `regions`)

### 2.2 `regions`
- `id`: UUID (PK)
- `name`: String
- `boundary`: Geometry(Polygon, 4326)

### 2.3 `equipment`
- `id`: UUID (PK)
- `model`: String
- `serial_number`: String (Unique)
- `firmware_version`: String

### 2.4 `observations` (Core Table)
- `id`: UUID (PK)
- `observation_uuid`: UUID (Grouping ID for versions)
- `version`: Integer
- `timestamp`: Timestamptz
- `frequency_start`: Double
- `frequency_end`: Double
- `bandwidth`: Double
- `modulation_type`: String
- `signal_strength`: Double (dBm)
- `classification_status`: Enum (UNCERTAIN, VERIFIED, DISCARDED)
- `notes`: Text
- `equipment_id`: UUID (FK to `equipment`)
- `technician_id`: UUID (FK to `users`)
- `location`: Geometry(Point, 4326)
- `is_current`: Boolean (For fast lookup of latest version)

### 2.5 `audit_trail`
- `id`: BigInt (PK)
- `observation_id`: UUID (FK)
- `changed_by`: UUID (FK to `users`)
- `change_timestamp`: Timestamptz
- `old_value`: JSONB
- `new_value`: JSONB

## 3. Geospatial Optimizations
- **Indexing:** GIST index on `observations.location` and `regions.boundary`.
- **Query Strategy:** Use `ST_Contains` and `ST_DWithin` for regional filtering and proximity searches.
- **Partitioning:** Table partitioning by `timestamp` (monthly) to maintain performance over millions of records.
