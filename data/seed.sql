-- Seed data for RF-Spectrum-Repo testing
INSERT INTO regions (id, name, boundary) VALUES
('a0000000-0000-0000-0000-000000000001', 'San Francisco', 'POLYGON(( -122.5 37.7, -122.3 37.7, -122.3 37.85, -122.5 37.85, -122.5 37.7 ) )')
ON CONFLICT DO NOTHING;

INSERT INTO observations (id, observation_uuid, version, timestamp, frequency_start, frequency_end, bandwidth, modulation_type, signal_strength, classification_status, notes, equipment_id, technician_id, location, is_current)
VALUES
('b0000000-0000-0000-0000-000000000001', gen_random_uuid(), 1, '2026-06-13T10:00:00+00:00', 144.0, 148.0, 4.0, 'FM', -65.2, 'VERIFIED', 'FM broadcast band', NULL, NULL, ST_GeomFromText('POINT(-122.4194 37.7749)', 4326), true),
('b0000000-0000-0000-0000-000000000002', gen_random_uuid(), 1, '2026-06-13T10:15:00+00:00', 90.0, 108.0, 18.0, 'FM', -42.1, 'VERIFIED', 'Strong FM signal', NULL, NULL, ST_GeomFromText('POINT(-122.4094 37.7849)', 4326), true),
('b0000000-0000-0000-0000-000000000003', gen_random_uuid(), 1, '2026-06-13T10:30:00+00:00', 433.0, 434.0, 1.0, 'FSK', -55.0, 'UNCERTAIN', 'ISF band FSK', NULL, NULL, ST_GeomFromText('POINT(-122.3994 37.7949)', 4326), true),
('b0000000-0000-0000-0000-000000000004', gen_random_uuid(), 1, '2026-06-13T11:00:00+00:00', 2240.0, 2300.0, 60.0, 'CW', -38.0, 'CONFIDENTIAL', 'CW carrier', NULL, NULL, ST_GeomFromText('POINT(-122.38 37.76)', 4326), true),
('b0000000-0000-0000-0000-000000000005', gen_random_uuid(), 1, '2026-06-13T11:15:00+00:00', 240.0, 248.0, 8.0, 'AM', -72.0, 'UNCERTAIN', 'Air-to-ground anomaly', NULL, NULL, ST_GeomFromText('POINT(-122.45 37.75)', 4326), true);
