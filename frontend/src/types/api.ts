/**
 * TypeScript types for the RF-SOR backend API.
 */

// --- Observation types ---
export interface Observation {
  id: number;
  observation_uuid: string;
  version: number;
  timestamp: string;
  frequency_start: number;
  frequency_end: number;
  bandwidth: number | null;
  modulation_type: string | null;
  signal_strength: number | null;
  classification_status: string;
  notes: string | null;
  equipment_id: string | null;
  technician_id: string | null;
  location_wkt: string | null;
  location: { lat: number; lng: number };
  is_current: boolean;
  created_at: string;
}

export interface ObservationCreatePayload {
  timestamp: string;
  frequency_start: number;
  frequency_end: number;
  bandwidth?: number | null;
  modulation_type?: string | null;
  signal_strength?: number | null;
  classification_status?: string;
  notes?: string | null;
  equipment_id?: string | null;
  technician_id?: string | null;
  location_wkt: string;
}

export interface ObservationUpdatePayload {
  timestamp?: string;
  frequency_start?: number;
  frequency_end?: number;
  bandwidth?: number | null;
  modulation_type?: string | null;
  signal_strength?: number | null;
  classification_status?: string;
  notes?: string | null;
  equipment_id?: string | null;
  location_wkt?: string;
}

export interface ObservationListResponse {
  data: Observation[];
  total: number;
  page: number;
  page_size: number;
}

export interface ObservationQueryParams {
  page_size?: number;
  page_num?: number;
  classification?: string | null;
  technician_id?: string | null;
  freq_min?: number | null;
  freq_max?: number | null;
  lat?: number | null;
  lng?: number | null;
  km_radius_km?: number | null;
  equipment_id?: string | null;
}

// --- User types ---
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
}

export interface UserCreatePayload {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

// --- Equipment types ---
export interface Equipment {
  id: number;
  model: string;
  serial_number: string;
  firmware_version: string | null;
  created_at: string;
}

export interface EquipmentCreatePayload {
  model: string;
  serial_number: string;
  firmware_version?: string | null;
}

// --- Region types ---
export interface Region {
  id: number;
  name: string;
  description: string | null;
  geometry_wkt: string | null;
  created_at: string;
}

export interface RegionCreatePayload {
  name: string;
  description?: string | null;
  geometry_wkt?: string | null;
}

// --- Sync types ---
export interface SyncStatus {
  last_sync_at: string | null;
  pending_uploads: number;
  pending_downloads: number;
  last_sync_status: string;
  nodes: SyncNode[];
}

export interface SyncNode {
  node_id: string;
  last_seen: string;
  status: string;
  pending_uploads: number;
  pending_downloads: number;
}

// --- Ingestion types ---
export interface IngestionResult {
  total: number;
  created: number;
  updated: number;
  errors: IngestionError[];
}

export interface IngestionError {
  row: number;
  field: string;
  error: string;
}

// --- Settings types ---
export interface AppSettings {
  api_endpoint: string;
  keycloak_url: string;
  keycloak_realm: string;
  client_id: string;
}

// --- Auth types ---
export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthConfig {
  keycloak_url: string;
  realm: string;
  client_id: string;
}
