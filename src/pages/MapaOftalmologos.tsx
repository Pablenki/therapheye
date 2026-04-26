// =========================================
// Mapa de Oftalmólogos Cercanos
// Usa Leaflet (OSM) + Overpass API — 100% gratuito
// =========================================

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MapPin, Phone, Clock, AlertCircle, Loader2, Navigation, CalendarPlus } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons (Vite no copia los assets de leaflet automáticamente)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface Props { onBack: () => void }

interface Place {
  id: number;
  lat: number;
  lon: number;
  name: string;
  address?: string;
  phone?: string;
  hours?: string;
  type: string;
}

type Status = 'idle' | 'locating' | 'loading' | 'done' | 'error';

const USER_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#4f46e5;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(79,70,229,.6)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const PLACE_ICON = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#0e7490;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.3);font-size:14px">👁</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function buildOverpassQuery(lat: number, lon: number, radius: number) {
  return `
[out:json][timeout:20];
(
  node["amenity"="doctors"]["healthcare:speciality"="ophthalmology"](around:${radius},${lat},${lon});
  node["amenity"="doctors"]["healthcare:speciality"="optometry"](around:${radius},${lat},${lon});
  node["healthcare"="doctor"]["speciality"="ophthalmology"](around:${radius},${lat},${lon});
  node["healthcare"="doctor"]["speciality"="optometry"](around:${radius},${lat},${lon});
  node["amenity"="clinic"]["healthcare:speciality"="ophthalmology"](around:${radius},${lat},${lon});
  node["amenity"="hospital"]["healthcare:speciality"="ophthalmology"](around:${radius},${lat},${lon});
  node["shop"="optician"](around:${radius},${lat},${lon});
  node["amenity"="doctors"]["name"~"oftalm|optica|óptica|vision|visión|ojos",i](around:${radius},${lat},${lon});
);
out body;
  `.trim();
}

function parsePlaces(elements: any[]): Place[] {
  return elements
    .filter(e => e.lat && e.lon)
    .map(e => {
      const t = e.tags ?? {};
      const street = t['addr:street'] ?? '';
      const num    = t['addr:housenumber'] ?? '';
      const city   = t['addr:city'] ?? '';
      const addr   = [street && `${street} ${num}`.trim(), city].filter(Boolean).join(', ');
      return {
        id:      e.id,
        lat:     e.lat,
        lon:     e.lon,
        name:    t.name ?? t['name:es'] ?? 'Especialista visual',
        address: addr || undefined,
        phone:   t.phone ?? t['contact:phone'] ?? undefined,
        hours:   t.opening_hours ?? undefined,
        type:    t.shop === 'optician' ? 'Óptica' : t.healthcare ?? t.amenity ?? 'Clínica',
      };
    });
}

export default function MapaOftalmologos({ onBack }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const [status, setStatus]   = useState<Status>('idle');
  const [places, setPlaces]   = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [radius, setRadius]   = useState(10000); // 10 km
  const [coords, setCoords]   = useState<{ lat: number; lon: number } | null>(null);
  const [errMsg, setErrMsg]   = useState('');

  const initMap = (lat: number, lon: number) => {
    if (leafletRef.current) return;
    const map = L.map(mapRef.current!, { zoomControl: true }).setView([lat, lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.marker([lat, lon], { icon: USER_ICON })
      .addTo(map)
      .bindTooltip('Tu ubicación', { permanent: false });
    leafletRef.current = map;
  };

  const addMarkers = (ps: Place[]) => {
    const map = leafletRef.current;
    if (!map) return;
    // Clear old markers (keep user marker)
    map.eachLayer(l => { if ((l as any)._isPlace) map.removeLayer(l); });
    ps.forEach(p => {
      const m = L.marker([p.lat, p.lon], { icon: PLACE_ICON }).addTo(map);
      (m as any)._isPlace = true;
      m.on('click', () => setSelected(p));
      m.bindTooltip(p.name, { direction: 'top', offset: [0, -10] });
    });
  };

  const search = async (lat: number, lon: number, r: number) => {
    setStatus('loading');
    setSelected(null);
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(buildOverpassQuery(lat, lon, r)),
      });
      const json = await res.json();
      const ps = parsePlaces(json.elements ?? []);
      setPlaces(ps);
      addMarkers(ps);
      if (ps.length > 0 && leafletRef.current) {
        const group = L.featureGroup(ps.map(p => L.marker([p.lat, p.lon])));
        leafletRef.current.fitBounds(group.getBounds().pad(0.15));
      }
      setStatus('done');
    } catch {
      setErrMsg('No se pudo consultar el directorio. Intenta de nuevo.');
      setStatus('error');
    }
  };

  const locate = () => {
    setStatus('locating');
    setErrMsg('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        initMap(lat, lon);
        search(lat, lon, radius);
      },
      err => {
        setErrMsg(
          err.code === 1
            ? 'Permiso de ubicación denegado. Actívalo en la configuración del navegador.'
            : 'No se pudo obtener tu ubicación.'
        );
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Auto-locate on mount
  useEffect(() => { locate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-search when radius changes
  useEffect(() => {
    if (coords && status === 'done') search(coords.lat, coords.lon, radius);
  }, [radius]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup map on unmount
  useEffect(() => () => { leafletRef.current?.remove(); leafletRef.current = null; }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 transition">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-bold text-gray-800 text-base leading-tight">Oftalmólogos Cercanos</h1>
          <p className="text-xs text-gray-500">Directorio gratuito vía OpenStreetMap</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
          >
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={20000}>20 km</option>
            <option value={50000}>50 km</option>
          </select>
          <button
            onClick={() => coords && search(coords.lat, coords.lon, radius)}
            disabled={status === 'loading' || status === 'locating' || !coords}
            className="flex items-center gap-1.5 bg-cyan-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-cyan-800 transition disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5"/>
            Buscar
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 bg-white border-r flex flex-col overflow-hidden">
          {/* Status */}
          <div className="px-4 py-3 border-b bg-gray-50">
            {status === 'locating' && (
              <div className="flex items-center gap-2 text-indigo-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin"/> Obteniendo ubicación…
              </div>
            )}
            {status === 'loading' && (
              <div className="flex items-center gap-2 text-cyan-700 text-sm">
                <Loader2 className="w-4 h-4 animate-spin"/> Buscando especialistas…
              </div>
            )}
            {status === 'done' && (
              <p className="text-sm text-gray-600">
                <span className="font-bold text-cyan-700">{places.length}</span> resultado{places.length !== 1 ? 's' : ''} en {radius / 1000} km
              </p>
            )}
            {status === 'error' && (
              <div className="flex items-start gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                <span>{errMsg}</span>
              </div>
            )}
            {status === 'idle' && (
              <p className="text-sm text-gray-500">Activa la ubicación para comenzar.</p>
            )}
          </div>

          {/* Places list */}
          <div className="flex-1 overflow-y-auto">
            {places.length === 0 && status === 'done' && (
              <div className="p-6 text-center">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-sm text-gray-500">No se encontraron resultados en este radio.</p>
                <p className="text-xs text-gray-400 mt-1">Prueba aumentando la distancia.</p>
              </div>
            )}
            {places.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setSelected(p);
                  leafletRef.current?.setView([p.lat, p.lon], 16);
                }}
                className={`w-full text-left px-4 py-3 border-b hover:bg-cyan-50 transition ${selected?.id === p.id ? 'bg-cyan-50 border-l-4 border-l-cyan-600' : ''}`}
              >
                <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                <p className="text-xs text-cyan-700 mt-0.5">{p.type}</p>
                {p.address && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0"/> {p.address}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Map container */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full"/>

          {/* Selected place card */}
          {selected && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-2xl shadow-2xl border border-cyan-100 p-4 max-w-sm w-full mx-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm">{selected.name}</p>
                  <span className="inline-block text-xs bg-cyan-100 text-cyan-800 rounded-full px-2 py-0.5 mt-1">{selected.type}</span>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-0.5">×</button>
              </div>
              <div className="mt-2 space-y-1.5">
                {selected.address && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0"/>
                    {selected.address}
                  </p>
                )}
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="text-xs text-cyan-700 flex items-center gap-1.5 hover:underline">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0"/>
                    {selected.phone}
                  </a>
                )}
                {selected.hours && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0"/>
                    {selected.hours}
                  </p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={`https://www.openstreetmap.org/directions?from=&to=${selected.lat},${selected.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-cyan-700 text-white text-xs font-semibold rounded-xl py-2 hover:bg-cyan-800 transition"
                >
                  Cómo llegar →
                </a>
                <a
                  href={(() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(10, 0, 0, 0);
                    const end = new Date(tomorrow.getTime() + 60 * 60 * 1000);
                    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15);
                    const params = new URLSearchParams({
                      action: 'TEMPLATE',
                      text: `Cita — ${selected.name}`,
                      details: `Cita con especialista visual agendada desde Therapheye.\n${selected.address ?? ''}`,
                      location: selected.address ?? selected.name,
                      dates: `${fmt(tomorrow)}/${fmt(end)}`,
                    });
                    return `https://calendar.google.com/calendar/render?${params.toString()}`;
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl px-3 py-2 hover:bg-indigo-700 transition flex-shrink-0"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Agendar
                </a>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {(status === 'locating' || status === 'loading') && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-[999]">
              <div className="bg-white rounded-2xl shadow-xl px-6 py-5 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-cyan-700 animate-spin"/>
                <p className="text-sm font-medium text-gray-700">
                  {status === 'locating' ? 'Detectando tu ubicación…' : 'Buscando especialistas…'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <div className="bg-white border-t px-4 py-2 text-center text-xs text-gray-400 flex-shrink-0">
        Datos de <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">OpenStreetMap</a>.
        La disponibilidad depende de los datos colaborativos del mapa. Verifica antes de asistir.
      </div>
    </div>
  );
}
