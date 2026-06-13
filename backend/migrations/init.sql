-- Initialize PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create Enums
CREATE TYPE user_role AS ENUM ('VIEWER', 'TECHNICIAN', 'LEAD', 'ADMIN');
CREATE TYPE classification_status AS ENUM ('UNCERTAIN', 'VERIFIED', 'DISCARDED');

-- 1. Regions
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role user_role NOT NULL DEFAULT 'VIEWER',
    region_id UUID REFERENCES regions(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Equipment
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model TEXT NOT NULL,
    serial_number TEXT UNIQUE NOT NULL,
    firmware_version TEXT,
    status TEXT DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Observations
CREATE TABLE observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_uuid UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    timestamp TIMESTAMPTZ NOT NULL,
    frequency_start DOUBLE PRECISION NOT NULL,
    frequency_end DOUBLE PRECISION NOT NULL,
    bandwidth DOUBLE PRECISION,
    modulation_type TEXT,
    signal_strength DOUBLE PRECISION,
    classification_status classification_status DEFAULT 'UNCERTAIN',
    notes TEXT,
    equipment_id UUID REFERENCES equipment(id),
    technician_id UUID REFERENCES users(id),
    location GEOMETRY(Point, 4326) NOT NULL,
    is_current BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit Trail
CREATE TABLE audit_trail (
    id BIGSERIAL PRIMARY KEY,
    observation_id UUID NOT NULL,
    changed_by UUID REFERENCES users(id),
    change_timestamp TIMESTAMPTZ DEFAULT NOW(),
    old_value JSONB,
    new_value JSONB
);

-- Spatial Indices
CREATE INDEX idx_observations_location ON observations USING GIST (location);
CREATE INDEX idx_regions_boundary ON regions USING GIST (boundary);
CREATE INDEX idx_observations_uuid ON observations (observation_uuid);
