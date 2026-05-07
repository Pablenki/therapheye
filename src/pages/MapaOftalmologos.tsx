// =========================================
// Mapa de Oftalmólogos Cercanos
// Google Maps (iframe embed, sin API key) + Overpass API para lista
// =========================================

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MapPin, Phone, Clock, AlertCircle, Loader2, Navigation, CalendarPlus, ExternalLink } from 'lucide-react';

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

/** Construye la URL del iframe de Google Maps */
function buildMapUrl(lat: number, lon: number, selected?: Place | null, zoom = 14): string {
  if (selected) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(selected.name)}&ll=${selected.lat},${selected.lon}&z=16&output=embed&hl=es`;
  }
  return `https://maps.google.com/maps?q=oftalmologos+opticas+oculistas&ll=${lat},${lon}&z=${zoom}&output=embed&hl=es`;
}

export default function MapaOftalmologos({ onBack }: Props) {
  const [status, setStatus]     = useState<Status>('idle');
  const [places, setPlaces]     = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [radius, setRadius]     = useState(10000);
  const [coords, setCoords]     = useState<{ lat: number; lon: number } | null>(null);
  const [errMsg, setErrMsg]     = useState('');
  const [mapUrl, setMapUrl]     = useState('');
  const iframeRef               = useRef<HTMLIFrameElement>(null);

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
      setMapUrl(buildMapUrl(lat, lon));
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
        setMapUrl(buildMapUrl(lat, lon));
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

  const handleSelectPlace = (p: Place) => {
    setSelected(p);
    if (coords) setMapUrl(buildMapUrl(coords.lat, coords.lon, p));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 transition">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-bold text-gray-800 text-base leading-tight">Oftalmólogos Cercanos</h1>
          <p className="text-xs text-gray-500">Google Maps · Lista vía OpenStreetMap</p>
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
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5"/>
            Buscar
          </button>
          {coords && (
            <a
              href={`https://www.google.com/maps/search/oftalmologos/@${coords.lat},${coords.lon},14z`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
              title="Abrir en Google Maps"
            >
              <ExternalLink className="w-3.5 h-3.5"/>
              Abrir en Maps
            </a>
          )}
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
              <div className="flex items-center gap-2 text-indigo-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin"/> Buscando especialistas…
              </div>
            )}
            {status === 'done' && (
              <p className="text-sm text-gray-600">
                <span className="font-bold text-indigo-600">{places.length}</span> resultado{places.length !== 1 ? 's' : ''} en {radius / 1000} km
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
                onClick={() => handleSelectPlace(p)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-indigo-50 transition ${selected?.id === p.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
              >
                <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                <p className="text-xs text-indigo-600 mt-0.5">{p.type}</p>
                {p.address && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0"/> {p.address}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Selected place detail */}
          {selected && (
            <div className="border-t bg-white p-4 flex-shrink-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-bold text-gray-800 text-sm leading-tight">{selected.name}</p>
                <button onClick={() => { setSelected(null); if (coords) setMapUrl(buildMapUrl(coords.lat, coords.lon)); }}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0">×</button>
              </div>
              <span className="inline-block text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 mb-2">{selected.type}</span>
              <div className="space-y-1.5 mb-3">
                {selected.address && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0"/>
                    {selected.address}
                  </p>
                )}
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="text-xs text-indigo-600 flex items-center gap-1.5 hover:underline">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0"/>
                    {selected.phone}
                  </a>
                )}
                {selected.hours && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0"/>
                    {selected.hours}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-indigo-600 text-white text-xs font-semibold rounded-xl py-2 hover:bg-indigo-700 transition"
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
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl px-3 py-2 hover:bg-gray-200 transition flex-shrink-0"
                >
                  <CalendarPlus className="w-3.5 h-3.5"/> Agendar
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Google Maps iframe */}
        <div className="flex-1 relative bg-gray-100">
          {mapUrl ? (
            <iframe
              ref={iframeRef}
              src={mapUrl}
              className="w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa de oftalmólogos"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                <p className="text-sm">Activa la ubicación para ver el mapa</p>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {(status === 'locating' || status === 'loading') && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
              <div className="bg-white rounded-2xl shadow-xl px-6 py-5 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin"/>
                <p className="text-sm font-medium text-gray-700">
                  {status === 'locating' ? 'Detectando tu ubicación…' : 'Buscando especialistas…'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
