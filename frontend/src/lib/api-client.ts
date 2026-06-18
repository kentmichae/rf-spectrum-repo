/**
 * API client utility for RF-SOR backend.
 * All requests go through the Nginx reverse proxy at the configured base URL.
 */
import type {
  Observation,
  ObservationCreatePayload,
  ObservationUpdatePayload,
  ObservationListResponse,
  ObservationQueryParams,
  User,
  UserCreatePayload,
  Equipment,
  EquipmentCreatePayload,
  Region,
  RegionCreatePayload,
  IngestionResult,
  AppSettings,
  AuthToken,
  AuthConfig,
  SyncStatus,
} from '../types/api';

// --- Base URL ---
const BASE_URL = '/api';

// --- Token management ---
function getToken(): string | null {
  try {
    return localStorage.getItem('rf-sor-token') || null;
  } catch {
    return null;
  }
}

function setToken(token: string): void {
  try {
    localStorage.setItem('rf-sor-token', token);
  } catch {
    // storage unavailable
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem('rf-sor-token');
  } catch {
    // ignore
  }
}

// --- Fetch wrapper ---
async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  
  // Don't set Content-Type if the body is FormData — the browser must set it with the multipart boundary
  const bodyHasFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!bodyHasFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API ${response.status}: ${response.statusText}${body ? ` - ${body}` : ''}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// --- Observations ---
export const apiObservations = {
  list: (params?: ObservationQueryParams): Promise<ObservationListResponse> => {
    const qs = new URLSearchParams();
    if (params?.page_size) qs.set('page_size', String(params.page_size));
    if (params?.page_num) qs.set('page_num', String(params.page_num));
    if (params?.classification) qs.set('classification', params.classification);
    if (params?.technician_id) qs.set('technician_id', params.technician_id);
    if (params?.freq_min != null) qs.set('freq_min', String(params.freq_min));
    if (params?.freq_max != null) qs.set('freq_max', String(params.freq_max));
    if (params?.lat != null) qs.set('lat', String(params.lat));
    if (params?.lng != null) qs.set('lng', String(params.lng));
    if (params?.km_radius_km != null) qs.set('km_radius_km', String(params.km_radius_km));
    if (params?.equipment_id) qs.set('equipment_id', params.equipment_id);
    const q = qs.toString();
    return fetchApi<ObservationListResponse>(`/observations${q ? `?${q}` : ''}`);
  },

  create: (payload: ObservationCreatePayload): Promise<Observation> => {
    return fetchApi<Observation>('/observations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  get: (id: string): Promise<Observation> => {
    return fetchApi<Observation>(`/observations/${id}`);
  },

  update: (id: string, payload: ObservationUpdatePayload): Promise<Observation> => {
    return fetchApi<Observation>(`/observations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  delete: (id: string): Promise<void> => {
    return fetchApi<void>(`/observations/${id}`, {
      method: 'DELETE',
    });
  },
};

// --- Users ---
export const apiUsers = {
  list: (): Promise<User[]> => {
    return fetchApi<User[]>('/users');
  },

  create: (payload: UserCreatePayload): Promise<User> => {
    return fetchApi<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update: (id: string, payload: Partial<UserCreatePayload>): Promise<User> => {
    return fetchApi<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  delete: (id: string): Promise<void> => {
    return fetchApi<void>(`/users/${id}`, { method: 'DELETE' });
  },
};

// --- Equipment ---
export const apiEquipment = {
  list: (): Promise<Equipment[]> => {
    return fetchApi<Equipment[]>('/equipment');
  },

  create: (payload: EquipmentCreatePayload): Promise<Equipment> => {
    return fetchApi<Equipment>('/equipment', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// --- Regions ---
export const apiRegions = {
  list: (withGeometry: boolean = false): Promise<Region[]> => {
    const qs = withGeometry ? '?geometry=true' : '';
    return fetchApi<Region[]>(`/spatial/regions${qs}`);
  },

  create: (payload: RegionCreatePayload): Promise<Region> => {
    return fetchApi<Region>('/spatial/regions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  delete: (id: string): Promise<void> => {
    return fetchApi<void>(`/spatial/regions/${id}`, { method: 'DELETE' });
  },
};

// --- Ingestion ---
export const apiIngestion = {
  postCsv: (file: File): Promise<IngestionResult> => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchApi<IngestionResult>('/ingestion/upload', {
      method: 'POST',
      headers,
      body: formData,
    });
  },

  postJson: (file: File): Promise<IngestionResult> => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchApi<IngestionResult>('/ingestion/upload', {
      method: 'POST',
      headers,
      body: formData,
    });
  },

  getHistory: (limit = 10): Promise<any[]> => {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchApi<any[]>('/ingestion/history', {
      method: 'GET',
      headers,
    });
  },
};

// --- Sync ---
export const apiSync = {
  getStatus: (): Promise<SyncStatus> => {
    return fetchApi<SyncStatus>('/sync/status');
  },

  triggerSync: (direction?: string): Promise<{ status: string }> => {
    return fetchApi<{ status: string }>('/sync/trigger', {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
  },
};

// --- Settings ---
export const apiSettings = {
  get: (): Promise<AppSettings> => {
    // Settings are persisted client-side; just return the current stored config.
    return Promise.resolve(apiSettings.getPersisted());
  },

  update: (settings: Partial<AppSettings>): Promise<AppSettings> => {
    try {
      const current = apiSettings.getPersisted();
      const updated = { ...current, ...settings };
      localStorage.setItem('rf-sor-settings', JSON.stringify(updated));
      return Promise.resolve(updated);
    } catch {
      return Promise.reject('Settings storage unavailable');
    }
  },

  getPersisted: (): AppSettings => {
    try {
      const stored = localStorage.getItem('rf-sor-settings');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { api_endpoint: '/api', keycloak_url: '', keycloak_realm: 'rf-sor' };
  },
};

// --- Auth ---
export const apiAuth = {
  loginKeycloak: async (username: string, password: string): Promise<AuthToken> => {
    const stored = apiSettings.getPersisted();
    
    // If Keycloak is not configured, fall back to local JWT auth
    if (!stored.keycloak_url || !stored.keycloak_realm) {
      const tokenUrl = '/api/auth/login';
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Local/auth failed: ${response.status} - ${body}`);
      }
      
      const token = await response.json();
      setToken(token.access_token);
      return token;
    }
    
    // Keycloak OIDC Password Grant
    const url = `${stored.keycloak_url}/realms/${stored.keycloak_realm}/protocol/openid-connect/token`;
    const formData = new URLSearchParams();
    formData.append('grant_type', 'password');
    formData.append('client_id', stored.client_id || 'rf-sor-client');
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Keycloak auth failed: ${response.status}`);
    }

    const token = await response.json();
    setToken(token.access_token);
    return token;
  },

  logout: (): void => {
    clearToken();
  },

  isAuthenticated: (): boolean => {
    return getToken() !== null;
  },
};

// --- Health ---
export const apiHealth = {
  check: (): Promise<{ status: string; version: string }> => {
    return fetchApi<{ status: string; version: string }>('/health');
  },
};
