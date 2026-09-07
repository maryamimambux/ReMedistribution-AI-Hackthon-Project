import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { MapPin, Clock, Phone, Filter } from 'lucide-react';

// Fix Leaflet default icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CITY_OPTIONS = ['All', 'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Peshawar', 'Faisalabad', 'Multan'];
const TYPE_COLORS = { HOSPITAL: '#dc2626', PHARMACY: '#2563eb', NGO: '#059669' };

export default function CollectionCenters() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('All');
  const [selectedCenter, setSelectedCenter] = useState(null);

  useEffect(() => {
    api.get('/centers?limit=100')
      .then((res) => setCenters(res.data.data || res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = cityFilter === 'All'
    ? centers
    : centers.filter((c) => c.city.toLowerCase() === cityFilter.toLowerCase());

  // Center map on Pakistan
  const mapCenter = [30.3753, 69.3451];
  const mapZoom = 5;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collection Centers</h1>
          <p className="text-gray-500">Find medicine drop-off and pickup locations near you</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="input-field text-sm py-2"
          >
            {CITY_OPTIONS.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 mb-8" style={{ height: '400px' }}>
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filtered.map((center) => (
            <Marker
              key={center.id}
              position={[center.lat, center.lng]}
              eventHandlers={{ click: () => setSelectedCenter(center) }}
            >
              <Popup>
                <div className="text-center">
                  <p className="font-bold text-sm">{center.name}</p>
                  <p className="text-xs text-gray-600">{center.address}</p>
                  <p className="text-xs text-gray-500 mt-1">{center.city}</p>
                  {center.phone && <p className="text-xs text-blue-600 mt-1">{center.phone}</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Center list */}
      <h2 className="section-title">{filtered.length} Centers</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((center) => (
          <div
            key={center.id}
            className={`card cursor-pointer transition-all hover:shadow-md ${
              selectedCenter?.id === center.id ? 'ring-2 ring-emerald-500' : ''
            }`}
            onClick={() => setSelectedCenter(center)}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: (TYPE_COLORS[center.type] || '#6b7280') + '20' }}
              >
                <MapPin
                  className="w-5 h-5"
                  style={{ color: TYPE_COLORS[center.type] || '#6b7280' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm">{center.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{center.address}, {center.city}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {center.openTime || '8:00'} - {center.closeTime || '20:00'}
                  </span>
                  {center.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {center.phone}
                    </span>
                  )}
                </div>
                <span
                  className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: (TYPE_COLORS[center.type] || '#6b7280') + '20',
                    color: TYPE_COLORS[center.type] || '#6b7280',
                  }}
                >
                  {center.type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
