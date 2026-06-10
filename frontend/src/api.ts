/**
 * API client for the RF-SOR backend.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function fetchWith(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  if (res.ok) return res.json();
  const body = await res.text().catch(() => '');
  throw new Error(`${res.status}: ${body}`);
}

// --- Observations ---
export async function getObservations(page = 1, pageSize = 20) {
  return fetchWith(`${API_BASE}/api/observations?page_size=${pageSize}&page_num=${page}`);
}

export async function createObservation(payload: any) {
  return fetchWith(`${API_BASE}/api/observations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getObservation(id: string) {
  return fetchWith(`${API_BASE}/api/observations/${id}`);
}

export async function updateObservation(id: string, payload: any) {
  return fetchWith(`${API_BASE}/api/observations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteObservation(id: string) {
  return fetchWith(`${API_BASE}/api/observations/${id}`, {
    method: 'DELETE',
  });
}

// --- Users ---
export async function getUsers(page = 1, pageSize = 20) {
  return fetchWith(`${API_BASE}/api/users?page_size=${pageSize}&page=${page}`);
}

export async function createUser(payload: any) {
  return fetchWith(`${API_BASE}/api/users`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: string, payload: any) {
  return fetchWith(`${API_BASE}/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// --- Auth ---
export async function login(credentials: { username: string; password: string }) {
  return fetchWith(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function getRoles() {
  return fetchWith(`${API_BASE}/api/auth/roles`);
}

// --- Health ---
export async function getHealth() {
  return fetchWith(`${API_BASE}/health`);
}

export async function getDBStatus() {
  return fetchWith(`${API_BASE}/db-check`);
}

// --- Spatial ---
export async function getRegions() {
  return fetchWith(`${API_BASE}/api/observations/spatial/regions`);
}

export async function getObservationsByRegion(regionId: string) {
  return fetchWith(`${API_BASE}/api/observations/spatial/observations/by_region?region_id=${regionId}`);
}

// --- Sync ---
export async function getSyncState(clientId: string) {
  return fetchWith(`${API_BASE}/api/sync?client_id=${clientId}`);
}

// --- Ingestion ---
export async function uploadObservations(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return fetchWith(`${API_BASE}/api/ingestion/upload`, {
    method: 'POST',
    body: formData,
  });
}
