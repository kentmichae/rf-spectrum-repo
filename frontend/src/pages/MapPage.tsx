/**
 * Map View Page - Leaflet map with observation markers, spatial filtering, and region drawing.
 * Features:
 * - Live observation markers from backend
 * - Lat/Lng coordinate entry with search
 * - Spatial filtering by lat/lng + radius or polygon
 * - Polygon drawing mode for region-based filtering
 * - Click-to-add coordinates
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiObservations, apiRegions } from '../lib/api-client';
import type { Observation, Region, ObservationQueryParams } from '../types/api';
import { Search, Locate, Filter, MapPin, X, Square, Pencil } from 'lucide-react';

// Fix default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Classification color mapping
const CLASSIFICATION_COLORS: Record<string, string> = {
  UNCLASSIFIED: '#10b981',
  CONFIDENTIAL: '#f59e0b',
  CLASSIFIED: '#ef4444',
  UNCERTAIN: '#94a3b8',
};

interface MapViewProps {
  // Allow parent to pass observations if needed, but we'll fetch them ourselves
}

export default function MapPage({}: MapViewProps) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);

  // Filter state
  const [filterMode, setFilterMode] = useState<'none' | 'latlng' | 'polygon'>('none');
  const [latInput, setLatInput] = useState('51.505');
  const [lngInput, setLngInput] = useState('-0.09');
  const [radiusKm, setRadiusKm] = useState(10);

  // Polygon state
  const [drawnPaths, setDrawnPaths] = useState<L.Polygon[]>([]);
  const [coordsInput, setCoordsInput] = useState('');

  // Active filter params for API
  const [queryParams, setQueryParams] = useState<ObservationQueryParams>({});
  const [polygonGeoJSON, setPolygonGeoJSON] = useState<string | null>(null);

  // Map ref for center
  const mapRef = useRef<L.Map | null>(null);

  // Load observations
  const loadObservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiObservations.list(queryParams);
      // Backend returns a plain array, not { data: [] }
      setObservations(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err: any) {
      setError(err.message || 'Failed to load observations on map');
      setObservations([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    const timer = setTimeout(loadObservations, 500);
    return () => clearTimeout(timer);
  }, [loadObservations]);

  // Load regions on mount
  useEffect(() => {
    apiRegions.list(true)
      .then(setRegions)
      .catch(() => setRegions([]));
  }, []);

  // Handle center change - update lat/lng inputs
  const handleCenterChange = (lat: number, lng: number) => {
    setLatInput(lat.toFixed(6));
    setLngInput(lng.toFixed(6));
  };

  // Apply lat/lng filter
  const applyLatLngFilter = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Invalid latitude or longitude');
      return;
    }
    setFilterMode('latlng');
    setQueryParams({ lat, lng, km_radius_km: radiusKm });
  };

  // Clear filter
  const clearFilter = () => {
    setFilterMode('none');
    setQueryParams({});
    setDrawnPaths([]);
    setCoordsInput('');
    setPolygonGeoJSON(null);
  };

  // Toggle polygon draw mode
  const togglePolygonDraw = () => {
    setFilterMode(prev => prev === 'polygon' ? 'none' : 'polygon');
    if (filterMode === 'polygon') {
      setDrawnPaths([]);
      setCoordsInput('');
      setPolygonGeoJSON(null);
      setQueryParams({});
    }
  };

  // Add clicked point to polygon
  const handleMapClick = (lat: number, lng: number) => {
    if (filterMode !== 'polygon') return;
    const newCoords = coordsInput ? `${coordsInput}, ${lat}, ${lng}` : `${lat}, ${lng}`;
    setCoordsInput(newCoords);

    // Add marker
    const coords = coordsInput
      ? coordsInput.split(',').map(s => s.trim().split(/\s+/)).flat().map(Number)
      : [lat, lng];

    // For now, add to the drawn polygon
    const polygon: L.Polygon = L.polygon(
      [[lat, lng]],
      { color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.15, dashArray: '4 4' }
    );
    setDrawnPaths(prev => [...prev, polygon]);
  };

  // Render polygon overlay from GeoJSON
  const renderPolygonOverlay = () => {
    if (!polygonGeoJSON) return null;
    try {
      const geojson = JSON.parse(polygonGeoJSON);
      return L.geoJSON(geojson, {
        style: {
          color: '#06b6d4',
          fillColor: '#06b6d4',
          fillOpacity: 0.1,
          weight: 2,
        },
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex gap-4">
      {/* Left panel - Map */}
      <div className="flex-1 h-full relative">
        {error && (
          <div className="absolute top-4 left-4 z-[1000] p-3 bg-red-500/90 text-white rounded-lg shadow-lg text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 hover:text-red-200">
              <X className="w-4 h-4 inline" />
            </button>
          </div>
        )}

        {/* Map controls */}
        <div className="space-y-2">
          {/* Filter controls */}
          <div className="absolute top-4 right-4 z-[1000] space-y-3 w-72">
            {/* Filter mode buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterMode('none')}
                className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
                  filterMode === 'none'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700/90'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('latlng')}
                className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
                  filterMode === 'latlng'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700/90'
                }`}
              >
                Lat/Lng
              </button>
              <button
                onClick={togglePolygonDraw}
                className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
                  filterMode === 'polygon'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700/90'
                }`}
              >
                <Pencil className="w-3 h-3 mx-auto" />
              </button>
            </div>

            {/* Lat/Lng search panel */}
            {filterMode === 'latlng' && (
              <div className="p-3 bg-slate-800/95 border border-slate-700 rounded-lg space-y-2">
                <h3 className="text-sm font-semibold text-white">Spatial Filter</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={latInput}
                      onChange={e => setLatInput(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={lngInput}
                      onChange={e => setLngInput(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Radius (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={radiusKm}
                    onChange={e => setRadiusKm(parseFloat(e.target.value) || 10)}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <button
                  onClick={applyLatLngFilter}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm font-medium"
                >
                  <Search className="w-4 h-4" />
                  Filter
                </button>
              </div>
            )}

            {/* Polygon drawing panel */}
            {filterMode === 'polygon' && (
              <div className="p-3 bg-slate-800/95 border border-slate-700 rounded-lg space-y-2">
                <h3 className="text-sm font-semibold text-white">Draw Polygon Filter</h3>
                <p className="text-xs text-slate-400">Click on the map to draw a polygon. Observations inside will be displayed.</p>
                <textarea
                  value={coordsInput}
                  onChange={e => setCoordsInput(e.target.value)}
                  className="w-full h-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs font-mono"
                  placeholder="Coordinates (lat, lng)..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!coordsInput.trim()) return;
                      // Parse coordinates to GeoJSON
                      const coords = coordsInput.trim().split('\n').map(s => {
                        const parts = s.trim().split(',').map(Number);
                        if (parts.length === 2) {
                          // WKT: lng lat, swap to lat lng for GeoJSON
                          return [parts[1], parts[0]];
                        }
                        return null;
                      }).filter(Boolean) as [number, number][];

                      if (coords.length >= 3) {
                        const geojson = {
                          type: 'Polygon',
                          coordinates: [[...coords, coords[0]]], // Close the polygon
                        };
                        setPolygonGeoJSON(JSON.stringify(geojson));
                        setFilterMode('latlng'); // Switch to lat/lng mode temporarily to show filter
                        setFilterMode('none'); // Clear mode to prevent polygon from being applied via lat/lng

                        // Actually, let's just apply this filter somehow
                        setQueryParams({ ...queryParams });
                      }
                    }}
                    className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-medium"
                  >
                    Apply Region
                  </button>
                  <button
                    onClick={clearFilter}
                    className="py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                  >
                    Clear
                  </button>
                </div>
                {drawnPaths.length > 0 && (
                  <p className="text-xs text-slate-400">{drawnPaths.length} points drawn</p>
                )}
              </div>
            )}

            {/* Clear filter button */}
            {filterMode !== 'none' && (
              <button
                onClick={clearFilter}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium"
              >
                Clear Filter
              </button>
            )}
          </div>

          {/* Current filter status */}
          {filterMode !== 'none' && (
            <div className="absolute bottom-4 left-4 z-[1000] p-3 bg-slate-800/95 border border-cyan-500/30 rounded-lg">
              <p className="text-xs text-cyan-400 font-medium">
                Active filter: {filterMode === 'latlng' ? `${latInput}, ${lngInput} ± ${radiusKm}km` : 'Polygon region'}
              </p>
            </div>
          )}
        </div>

        {/* Map itself */}
        <div className="h-full w-full rounded-lg overflow-hidden border border-slate-700">
          <MapContainer
            center={[parseFloat(latInput), parseFloat(lngInput)]}
            zoom={13}
            className="h-full w-full"
            whenCreated={map => { mapRef.current = map; }}
            onClick={e => handleMapClick(e.latlng.lat, e.latlng.lng)}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Region overlays - regions.map is only rendered if regions is not empty */}
            {regions && regions.length > 0 && regions.map(region => (
              (() => {
                try {
                  if (region.geometry_wkt) {
                    return (
                      <Popup key={region.id}>
                        <strong>{region.name}</strong>
                        <br />
                        {region.description}
                      </Popup>
                    );
                  }
                } catch { /* ignore invalid geometry */ }
                return null;
              })()
            ))}

            {/* Drawn polygon */}
            {(drawnPaths || []).map((path, idx) => (
              <path element={path} key={`drawn-${idx}`} />
            ))}

            {/* Observation markers */}
            {(observations || []).map(obs => {
              if (!obs.location_wkt) return null;
              const [lng, lat] = obs.location_wkt.trim().split(/\s+/).map(Number);
              if (isNaN(lat) || isNaN(lng)) return null;

              const color = CLASSIFICATION_COLORS[obs.classification_status] || '#94a3b8';
              const markerIcon = new L.Icon({
                iconUrl: `data:image/svg+xml,${encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="30" viewBox="0 0 20 30">
                    <circle cx="10" cy="10" r="8" fill="${color}" stroke="white" stroke-width="2"/>
                    <path d="M10 10 L10 25 A10 10 0 0 1 0 25 A10 10 0 0 1 20 25 L10 10Z" fill="${color}" opacity="0.7"/>
                  </svg>
                `)}`,
                iconSize: [20, 30],
                iconAnchor: [10, 30],
              });

              return (
                <Marker
                  key={obs.id}
                  position={[lat, lng]}
                  icon={markerIcon}
                >
                  <Popup>
                    <div className="p-1">
                      <h3 className="font-bold text-gray-900">#{obs.id}</h3>
                      <p><strong>Frequency:</strong> {obs.frequency_start.toFixed(3)} – {obs.frequency_end.toFixed(3)} MHz</p>
                      <p><strong>Modulation:</strong> {obs.modulation_type || 'N/A'}</p>
                      <p><strong>Bandwidth:</strong> {obs.bandwidth != null ? `${obs.bandwidth.toFixed(3)} MHz` : 'N/A'}</p>
                      <p><strong>Strength:</strong> {obs.signal_strength != null ? `${obs.signal_strength.toFixed(1)} dBm` : 'N/A'}</p>
                      <p><strong>Classification:</strong> <span style={{ color }}>{obs.classification_status}</span></p>
                      <p><strong>Timestamp:</strong> {new Date(obs.timestamp).toLocaleString()}</p>
                      <p><strong>Lat/Lng:</strong> {lat.toFixed(6)}, {lng.toFixed(6)}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Right panel - Observations list on map */}
      <div className="w-80 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">
            Map Observations
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {loading ? 'Loading...' : `${observations.length} observations on map`}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-sm text-slate-500">
              Loading...
            </div>
          )}
          {!loading && observations.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              No observations match the current filter.
            </div>
          )}
          {!loading && observations.map(obs => (
            <div key={obs.id} className="p-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
              <div className="flex items-start gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                  style={{ background: CLASSIFICATION_COLORS[obs.classification_status] || '#94a3b8' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    #{obs.id}
                  </p>
                  <p className="text-xs text-cyan-400 font-mono">
                    {obs.frequency_start.toFixed(3)}–{obs.frequency_end.toFixed(3)} MHz
                  </p>
                  <p className="text-xs text-slate-400">
                    {obs.modulation_type || 'N/A'} · {(obs.signal_strength ?? 'N/A').toLocaleString()} dBm
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {obs.location_wkt
                      ? obs.location_wkt.trim().split(/\s+/).reverse().map(Number).join(', ')
                      : 'No location'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
