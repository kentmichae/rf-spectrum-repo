
-- Migration: Add ingestion_uploads table
-- This table stores upload history entries for the frontend Upload History panel.

CREATE TABLE IF NOT EXISTS ingestion_uploads (
    id BIGSERIAL PRIMARY KEY,
    source_name TEXT NOT NULL DEFAULT 'unknown',
    total_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    errors JSONB,
    classification TEXT,
    frequency_start DOUBLE PRECISION,
    frequency_end DOUBLE PRECISION,
    modulation_type TEXT,
    signal_strength DOUBLE PRECISION,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingestion_uploads_recorded_at ON ingestion_uploads (recorded_at DESC);
