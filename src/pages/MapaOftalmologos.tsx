import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

interface Props { onBack: () => void }

type Status = 'idle' | 'locating' | 'done' | 'error';

function buildMapUrl(lat: number, lon: number, zoom = 14): string {
  return `https://maps.google.com/maps?q=oftalmologos+opticas+oculistas&ll=${lat},${lon}&z=${zoom}&output=embed&hl=es`;
}

export default function MapaOftalmologos({ onBack }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [mapUrl, setMapUrl] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const locate = () => {
    setStatus('locating');
    setErrMsg('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        setMapUrl(buildMapUrl(lat, lon));
        setStatus('done');
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

  useEffect(() => { locate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 transition">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-bold text-gray-800 text-base leading-tight">Oftalmólogos Cercanos</h1>
          <p className="text-xs text-gray-500">Google Maps</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={locate}
            disabled={status === 'locating'}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <MapPin className="w-3.5 h-3.5"/>
            {status === 'locating' ? 'Buscando…' : 'Mi ubicación'}
          </button>
          {coords && (
            <a
              href={`https://www.google.com/maps/search/oftalmologos/@${coords.lat},${coords.lon},14z`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
            >
              <ExternalLink className="w-3.5 h-3.5"/>
              Abrir en Maps
            </a>
          )}
        </div>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="mx-4 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex-shrink-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
          <span>{errMsg}</span>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative bg-gray-100">
        {mapUrl ? (
          <iframe
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

        {status === 'locating' && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <div className="bg-white rounded-2xl shadow-xl px-6 py-5 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin"/>
              <p className="text-sm font-medium text-gray-700">Detectando tu ubicación…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
