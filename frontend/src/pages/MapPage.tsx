/**
 * Map View Page - Leaflet map with observation markers, spatial filtering, and region drawing.
 * Features:
 * - Live observation markers from backend
 * - Lat/Lng coordinate entry with search
 * - Spatial filtering by lat/lng + radius or polygon
 * - Polygon drawing mode for region-based filtering
 * - Click-to-add coordinates
 * - CLICKABLE MARKERS: click any marker to fly-map to its observation
 * - CLICKABLE LIST: click any list item to fly-map to its observation
 * - ACTIVE HIGHLIGHT: glowing border on the active (flying-to) observation
 * - IMPROVED POPUP: "View on Map" button, frequency range bar, classification color bar
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { apiObservations, apiRegions } from '../lib/api-client';
import type { Observation, Region, ObservationQueryParams } from '../types/api';
import { Search, Locate, Filter, MapPin, X, Square, Pencil, Navigation2 } from 'lucide-react';

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

// Frequency color gradient (red = high freq, blue = low freq)
function freqColor(start: number, end: number): string {
  const mid = (start + end) / 2;
  const t = Math.max(0, Math.min(1, (mid - 50) / 950));
  const r = Math.round(6 + t * 180);
  const g = Math.round(182 - t * 120);
  const b = Math.round(229 - t * 140);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// WKT parsing utility - extracts [lat, lng] from POINT WKT strings
const parseWKT = (wkt: string | null | undefined): [number, number] | null => {
  if (!wkt) return null;
  const pointMatch = wkt.match(/POINT\s*\(([^\\s]+)\s+([^\)]+)\)/);
  if (pointMatch) {
    const parts = pointMatch[1].trim().split(/\s+/);
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lat, lng];
      }
    }
  }
  // Fallback: find any two adjacent numbers
  const nums = wkt.match(/-?[0-9]+\.?[0-9]*/g);
  if (nums && nums.length >= 2) {
    const a = parseFloat(nums[0]);
    const b = parseFloat(nums[1]);
    if (!isNaN(a) && !isNaN(b)) {
      return [Math.abs(b), Math.abs(a)];
    }
  }
  return null;
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

  // ACTIVE OBSERVATION (fly-to highlight)
  const [activeObservationId, setActiveObservationId] = useState<string | null>(null);
  const clearActiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map ref for center
  const mapRef = useRef<L.Map | null>(null);

  // Locate state
  const [locateSearch, setLocateSearch] = useState('');
  const [locateResults, setLocateResults] = useState<Observation[]>([]);
  const [showLocateResults, setShowLocateResults] = useState(false);

  // Load observations
  const loadObservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiObservations.list(queryParams);
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

  // Locate observations: search and zoom to observation
  const handleLocateObservation = async () => {
    if (!locateSearch.trim()) {
      setLocateResults([]);
      setShowLocateResults(false);
      return;
    }

    try {
      const allObs = await apiObservations.list({ page_size: 100 });
      const results: Observation[] = Array.isArray(allObs)
        ? allObs
        : (allObs?.data ?? []);

      const search = locateSearch.toLowerCase().trim();
      const filtered = results.filter(o =>
        o.id.toString().toLowerCase().includes(search) ||
        o.frequency_start.toFixed(3).includes(search) ||
        o.frequency_end.toFixed(3).includes(search) ||
        o.classification_status.toLowerCase().includes(search) ||
        (o.signal_strength != null && o.signal_strength.toFixed(0).includes(search))
      );

      setLocateResults(filtered);
      setShowLocateResults(true);

      if (filtered.length > 0 && mapRef.current) {
        const coords = parseWKT(filtered[0].location_wkt);
        if (coords) mapRef.current.flyTo(coords, 15);
      }
    } catch {
      setLocateResults([]);
      setShowLocateResults(false);
    }
  };

  // Fly-to observation: clear previous active, set new active, fly map
  const flyToObservation = useCallback((obs: Observation) => {
    if (clearActiveTimer.current) clearTimeout(clearActiveTimer.current);
    setActiveObservationId(obs.id);
    setLocateSearch(obs.id);
    setFilterMode('none');

    const coords = parseWKT(obs.location_wkt);
    if (coords && mapRef.current) {
      mapRef.current.flyTo(coords, 15);
    }

    clearActiveTimer.current = setTimeout(() => {
      setActiveObservationId(null);
    }, 8000);
  }, []);

  // Clear active observation when map is dragged/zoomed
  const handleMapDragEnd = useCallback(() => {
    if (clearActiveTimer.current) clearTimeout(clearActiveTimer.current);
    setActiveObservationId(null);
  }, []);

  // Add clicked point to polygon
  const handleMapClick = (lat: number, lng: number) => {
    if (filterMode !== 'polygon') return;
    const newCoords = coordsInput ? coordsInput + ', ' + lat + ', ' + lng : lat + ', ' + lng;
    setCoordsInput(newCoords);

    // Add marker
    const coords = coordsInput
      ? coordsInput.split(',').map((s: string) => s.trim().split(/\s+/)).flat().map(Number)
      : [lat, lng];

    // For now, add to the drawn polygon
    let latlngs: any[];
    if (coordsInput) {
      latlngs = coordsInput.split('\n').map((s: string) => {
        const parts = s.trim().split(',').map(Number);
        if (!isNaN(parts[0]) && !isNaN(parts[1])) {
          return [parts[0], parts[1]] as [number, number];
        }
        return null;
      }).filter((c: any) => c != null);
    } else {
      latlngs = [[lat, lng]];
    }
    const polygon = L.polygon(
      latlngs,
      { color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.15, dashArray: '4 4' }
    );
    setDrawnPaths(prev => [...prev, polygon]);
  };

  // Render polygon overlay from GeoJSON
  const renderPolygonOverlay = () => {
    if (!polygonGeoJSON) return null;
    try {
      const geojson = JSON.parse(polygonGeoJSON);
      const layer = L.geoJSON(geojson, {
        style: { color: '#3b82f6', weight: 2, fillOpacity: 0.1 },
      });
      return layer;
    } catch {
      return null;
    }
  };

  const handlePolygonApply = () => {
    if (!coordsInput.trim()) return;
    const coords = coordsInput.trim().split('\n').map((s: string) => {
      const parts = s.trim().split(',').map(Number);
      if (parts.length === 2) {
        return [parts[0], parts[1]] as [number, number];
      }
      return null;
    }).filter((c: any) => c != null);

    if (coords.length >= 3) {
      const geojson = {
        type: 'Polygon' as const,
        coordinates: [coords.concat([coords[0]]).map((c: [number, number]) => [c[1], c[0]])],
      };
      setPolygonGeoJSON(JSON.stringify(geojson));
      setFilterMode('none');
      setDrawnPaths([]);
    }
  };

  // Hook component to get map instance in react-leaflet v4
  const MapRefGetter = ({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) => {
    const map = useMap();
    useEffect(() => {
      (mapRef as any).current = map;
    }, [map, mapRef]);
    return null;
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex gap-4">
      {/* Map area */}
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
          <div className="absolute top-4 right-4 z-[1000] space-y-3 w-72">
            {/* Filter mode buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterMode('none')}
                className={
                  filterMode === 'none'
                    ? 'flex-1 py-2 text-xs font-medium rounded transition-colors bg-cyan-600 text-white'
                    : 'flex-1 py-2 text-xs font-medium rounded transition-colors bg-slate-800/90 text-slate-300 hover:bg-slate-700/90'
                }
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('latlng')}
                className={
                  filterMode === 'latlng'
                    ? 'flex-1 py-2 text-xs font-medium rounded transition-colors bg-cyan-600 text-white'
                    : 'flex-1 py-2 text-xs font-medium rounded transition-colors bg-slate-800/90 text-slate-300 hover:bg-slate-700/90'
                }
              >
                Lat/Lng
              </button>
              <button
                onClick={togglePolygonDraw}
                className={
                  filterMode === 'polygon'
                    ? 'flex-1 py-2 text-xs font-medium rounded transition-colors bg-cyan-600 text-white'
                    : 'flex-1 py-2 text-xs font-medium rounded transition-colors bg-slate-800/90 text-slate-300 hover:bg-slate-700/90'
                }
              >
                <Pencil className="w-3 h-3 mx-auto" />
              </button>
            </div>

            {/* Lat/lng filter form */}
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
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
              </div>
            )}

            {/* Polygon drawing form */}
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
                    onClick={handlePolygonApply}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-medium"
                  >
                    <Filter className="w-3 h-3" />
                    Apply Polygon
                  </button>
                  <button
                    onClick={() => {
                      setPolygonGeoJSON(null);
                      setCoordsInput('');
                      setFilterMode('none');
                      setDrawnPaths([]);
                    }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map itself */}
        <div className="h-full w-full rounded-lg overflow-hidden border border-slate-700">
          <MapContainer
            center={[parseFloat(latInput), parseFloat(lngInput)]}
            zoom={13}
            className="h-full w-full"
            onClick={e => handleMapClick(e.latlng.lat, e.latlng.lng)}
            onDragEnd={handleMapDragEnd}
            onZoomEnd={handleMapDragEnd}
          >
            <TileLayer
              attribution=''
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Map ref getter component */}
            <MapRefGetter mapRef={mapRef} />

            {/* Region overlays */}
            {regions && regions.length > 0 && regions.map(region => {
              let geoLayer;
              try {
                if (region.geometry_wkt) {
                  const geojson = {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [parseFloat(region.geometry_wkt.match(/[0-9.-]+\s+([0-9.-]+)/)?.[1] || '0'), parseFloat(region.geometry_wkt.match(/([0-9.-]+)\s+[0-9.-]+$/)?.[1] || '0')] },
                    properties: { name: region.name, description: region.description }
                  };
                  const layer = L.geoJSON(geojson, {
                    pane: 'overlayPane',
                    pointToLayer: (feature, latlng) =>
                      L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: '#3b82f6',
                        color: '#ffffff',
                        weight: 2,
                        fillOpacity: 1
                      }).bindPopup('<strong>' + (feature.properties?.name || '') + '</strong><br/>' + (feature.properties?.description || ''))
                  });
                  geoLayer = layer;
                }
              } catch { /* ignore invalid geometry */ }
              return geoLayer || null;
            })}

            {/* Drawn polygon */}
            {drawnPaths && drawnPaths.length > 0 && drawnPaths.map((poly, idx) => (
              <Circle
                key={'drawn-' + idx}
                pathOptions={{
                  color: '#06b6d4',
                  fillColor: '#06b6d4',
                  fillOpacity: 0.15,
                  dashArray: '4 4'
                }}
                center={poly.getBounds().getCenter()}
                radius={poly.getBounds().getSouthWest().distanceTo(poly.getBounds().getNorthEast()) / 2}
              />
            ))}

            {/* Spatial filter circle */}
            {filterMode === 'latlng' && parseFloat(latInput) && parseFloat(lngInput) && (
              <Circle
                center={[parseFloat(latInput), parseFloat(lngInput)]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#8b5cf6',
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.1,
                  dashArray: '4 4'
                }}
              />
            )}

            {/* Observation markers - CLICKABLE */}
            {observations && observations.length > 0 && observations.map(obs => {
              if (!obs.location_wkt) {
                return null;
              }
              const coords = parseWKT(obs.location_wkt);
              if (!coords) {
                return null;
              }
              const [lng, lat] = coords;
              const color = CLASSIFICATION_COLORS[obs.classification_status] || '#94a3b8';
              const isActive = activeObservationId === obs.id;
              const freqGrad = freqColor(obs.frequency_start, obs.frequency_end);

              const activeLabel = 'Active Marker';
              const normalLabel = 'Normal Marker';

              const activeHtml = '<div style="position: relative; width: 24px; height: 24px;">' +
                '<div style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid ' + color + '; animation: pulse 1.5s ease-in-out infinite; opacity: 0.6;"></div>' +
                '<div style="position: absolute; inset: 0; border-radius: 50%; background: ' + color + '; box-shadow: 0 0 8px ' + color + ', 0 0 16px ' + color + '40;"></div>' +
                '<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; border-radius: 50%; background: white;"></div></div>' +
                '</div><style>@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.5); opacity: 0; } }</style>';

              const normalHtml = '<div style="position: relative; width: 20px; height: 30px;">' +
                '<div style="position: absolute; top: 0; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: ' + color + '; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>' +
                '<div style="position: absolute; top: 14px; left: 2px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 12px solid ' + color + '; opacity: 0.7;"></div>' +
                '</div>';

              const activeIcon = new L.DivIcon({
                className: '',
                html: isActive ? activeHtml : normalHtml,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              });

              const onClickHandler = function() {
                flyToObservation(obs);
              };

              return (
                <Marker
                  key={obs.id}
                  position={coords}
                  icon={activeIcon}
                  eventHandlers={{ click: onClickHandler }}
                >
                  <Popup className="max-w-xs">
                    <div className="p-2">
                      {/* Classification color bar */}
                      <div
                        className="h-1.5 w-full rounded mb-2"
                        style={{ background: color }}
                      />

                      {/* Observation ID badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-slate-500">#{obs.id.toString().slice(0, 8)}</span>
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded"
                          style={{
                            backgroundColor: color + '20',
                            color: color
                          }}
                        >
                          {obs.classification_status}
                        </span>
                      </div>

                      {/* Frequency range with visual bar */}
                      <div className="mb-2">
                        <div className="text-xs text-slate-400 mb-0.5">Frequency</div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-cyan-400 font-mono">
                            {obs.frequency_start.toFixed(1)}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 relative overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: '100%',
                                background: 'linear-gradient(to right, ' + color + ', ' + color + '80)',
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold text-cyan-400 font-mono">
                            {obs.frequency_end.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-500">MHz</span>
                        </div>
                      </div>

                      {/* Signal strength bar */}
                      {obs.signal_strength != null && (
                        <div className="mb-2">
                          <div className="text-xs text-slate-400 mb-0.5">Strength</div>
                          <div
                            className="h-1.5 w-24 rounded-full overflow-hidden bg-slate-200"
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: (Math.min(100, Math.max(0, (obs.signal_strength + 100) / 100 * 100)) / 100 * 100) + '%',
                                background: obs.signal_strength > -50 ? '#10b981' : obs.signal_strength > -70 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{obs.signal_strength} dBm</span>
                        </div>
                      )}

                      {/* Modulation & Timestamp */}
                      <div className="flex gap-3 mb-3 text-xs text-slate-600">
                        <span>Mod: {obs.modulation_type || 'N/A'}</span>
                      </div>
                      <div className="text-xs text-slate-500 mb-3">
                        {obs.timestamp ? new Date(obs.timestamp).toLocaleString() : 'N/A'}
                      </div>

                      {/* Lat/Lng + Fly-to button */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {lat.toFixed(4)}, {lng.toFixed(4)}
                        </span>
                        {
                          (() => {
                            const btn = (
                              <button
                                onClick={() => flyToObservation(obs)}
                                className="ml-auto flex items-center gap-1 px-2 py-1 bg-cyan-500 hover:bg-cyan-600 text-white text-[10px] font-medium rounded transition-colors"
                              >
                                <Navigation2 className="w-3 h-3" />
                                Fly to
                              </button>
                            );
                            return btn;
                          })()
                        }
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Right panel - Observations list */}
      <div className="w-80 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-800">
          <h4 className="text-sm font-semibold text-white mb-2">Locate Observations</h4>
          <div className="flex gap-1">
            <input
              type="text"
              value={locateSearch}
              onChange={e => setLocateSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLocateObservation()}
              placeholder="ID, freq, class, strength..."
              className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm"
            />
            <button
              onClick={handleLocateObservation}
              className="px-2 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded"
            >
              {locateSearch.trim() ? <Search className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            </button>
          </div>
          {showLocateResults && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {locateResults.length > 0 ? (
                locateResults.map(obs => (
                  <button
                    key={obs.id}
                    className={'w-full text-left p-2 rounded text-sm transition-colors ' + (
                      activeObservationId === obs.id
                        ? 'bg-cyan-600/30 border border-cyan-500/40'
                        : 'bg-slate-800 hover:bg-slate-700'
                    )}
                    onClick={() => flyToObservation(obs)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: CLASSIFICATION_COLORS[obs.classification_status] || '#94a3b8' }} />
                      <span className="text-white text-xs truncate">#{obs.id.toString().slice(0, 8)}..</span>
                    </div>
                    <div className="text-xs text-cyan-400 mt-1">
                      {obs.frequency_start.toFixed(1)}-{obs.frequency_end.toFixed(1)} MHz
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-500">No observations found</p>
              )}
            </div>
          )}
        </div>
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">
            Map Observations
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {loading ? 'Loading...' : observations.length + ' observations on map'}
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
          {!loading && observations.map(obs => {
            const isActive = activeObservationId === obs.id;
            const color = CLASSIFICATION_COLORS[obs.classification_status] || '#94a3b8';
            const locCoords = parseWKT(obs.location_wkt);

            return (
              <div
                key={obs.id}
                className={'p-3 border-b border-slate-800 transition-all cursor-pointer ' + (
                  isActive
                    ? 'bg-cyan-600/20 border-l-4 border-l-cyan-500'
                    : 'hover:bg-slate-800/50'
                )}
                onClick={() => flyToObservation(obs)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">#{obs.id.toString().slice(0, 8)}</span>
                      <span
                        className="px-1 py-0.5 text-[9px] font-bold uppercase rounded"
                        style={{
                          backgroundColor: color + '20',
                          color: color
                        }}
                      >
                        {obs.classification_status}
                      </span>
                    </div>
                    <div className="text-xs text-cyan-400">
                      {obs.frequency_start.toFixed(1)}&ndash;{obs.frequency_end.toFixed(1)} MHz
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {obs.modulation_type || 'N/A'} &middot; {obs.signal_strength != null ? obs.signal_strength.toFixed(0) : 'N/A'} dBm
                    </div>
                    {locCoords && (
                      <div className="text-xs text-slate-600 mt-1 font-mono">
                        {locCoords[0].toFixed(4)}, {locCoords[1].toFixed(4)}
                        {
                          (() => {
                            const link = (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  flyToObservation(obs);
                                }}
                                className="ml-1 text-cyan-400 hover:text-cyan-300"
                              >
                                &nearr;
                              </button>
                            );
                            return link;
                          })()
                        }
                      </div>
                    )}
                    {!locCoords && (
                      <div className="text-xs text-slate-600 mt-1">
                        No location
                      </div>
                    )}
                  </div>
                </div>
                {/* Classification color bar on list item */}
                <div
                  className="h-0.5 w-full mt-2 rounded"
                  style={{ background: color }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * MapRefGetter: react-leaflet v4 component to capture the map instance
 * via useMap() hook inside <MapContainer>.
 */
function MapRefGetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    (mapRef as any).current = map;
  }, [map, mapRef]);
  return null;
}