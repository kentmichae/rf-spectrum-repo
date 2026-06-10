/**
 * Map View Page - Leaflet map with observation markers.
 */
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Observation {
  id: string;
  frequency_start: number;
  frequency_end: number;
  location?: { lat: number; lng: number };
}

interface MapPageProps {
  observations?: Observation[];
}

export default function MapPage({ observations = [] }: MapPageProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Map View</h1>
      </div>

      <div className="h-96 bg-slate-800 rounded-lg">
        <MapContainer
          center={[51.505, -0.09]}
          zoom={13}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {observations.map(obs => (
            obs.location && (
              <Marker key={obs.id} position={[obs.location.lat, obs.location.lng]}>
                <Popup>
                  <strong>ID:</strong> {obs.id}<br />
                  <strong>Frequency:</strong> {obs.frequency_start} - {obs.frequency_end} MHz
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
