// =========================================
// GALERÍA DE CAPTURAS — Therapheye
// Historial de todas las fotos tomadas del ojo
// con diagnósticos, comparativa antes/después
// =========================================

import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, Trash2, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; onNavigate: (page: string) => void; }

interface Captura {
  id: number;
  imagen_base64: string;
  diagnostico: string | null;
  confianza: string | null;
  signos: string[] | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 30) return `hace ${Math.floor(d / 30)} mes${Math.floor(d / 30) > 1 ? 'es' : ''}`;
  if (d > 0) return `hace ${d} día${d > 1 ? 's' : ''}`;
  const hr = Math.floor(diff / 3600000);
  if (hr > 0) return `hace ${hr}h`;
  return 'hace un momento';
}

export default function GaleriaCaptures({ onBack, onNavigate }: Props) {
  const { user } = useUser();
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null); // index
  const [compareMode, setCompareMode] = useState(false);
  const [compareIdx, setCompareIdx] = useState<[number, number]>([0, 1]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        // Try to load from image_diagnostics table (from ImageCapture)
        const rows = await sql`
          SELECT id, imagen_base64, diagnostico_texto as diagnostico, nivel_confianza as confianza,
                 signos_detectados as signos, created_at
          FROM diagnosticos_imagen
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT 50
        `.catch(() => []);
        setCapturas((rows as unknown) as Captura[]);
      } catch {}
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const eliminar = async (id: number) => {
    try {
      await sql`DELETE FROM diagnosticos_imagen WHERE id = ${id} AND user_id = ${user!.id}`;
      setCapturas(prev => prev.filter(c => c.id !== id));
      if (lightbox !== null) setLightbox(null);
    } catch {}
  };

  const lb = lightbox !== null ? capturas[lightbox] : null;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 px-4 pt-10 pb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-xl">Galería de Capturas</h1>
            <p className="text-gray-400 text-sm">{capturas.length} imagen{capturas.length !== 1 ? 'es' : ''}</p>
          </div>
          <div className="flex gap-2">
            {capturas.length >= 2 && (
              <button
                onClick={() => { setCompareMode(v => !v); setCompareIdx([0, 1]); }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  compareMode ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Comparar
              </button>
            )}
            <button
              onClick={() => onNavigate('image-capture')}
              className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition"
            >
              <Camera className="w-4 h-4 text-white"/>
            </button>
          </div>
        </div>
      </div>

      {/* Compare mode */}
      {compareMode && capturas.length >= 2 && (
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <p className="text-gray-400 text-xs mb-3">Modo comparación — antes / después</p>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map(slot => (
              <div key={slot} className="space-y-2">
                <p className="text-gray-500 text-xs">{slot === 0 ? 'Imagen A' : 'Imagen B'}</p>
                <img
                  src={capturas[compareIdx[slot]]?.imagen_base64}
                  className="w-full aspect-square object-cover rounded-xl"
                  alt={`Captura ${slot + 1}`}
                />
                <select
                  value={compareIdx[slot]}
                  onChange={e => {
                    const newIdx = [...compareIdx] as [number, number];
                    newIdx[slot] = Number(e.target.value);
                    setCompareIdx(newIdx);
                  }}
                  className="w-full bg-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                >
                  {capturas.map((c, i) => (
                    <option key={i} value={i}>
                      {new Date(c.created_at).toLocaleDateString('es-ES')} — {timeAgo(c.created_at)}
                    </option>
                  ))}
                </select>
                {capturas[compareIdx[slot]]?.diagnostico && (
                  <p className="text-gray-400 text-xs leading-snug">{capturas[compareIdx[slot]].diagnostico?.slice(0, 80)}...</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="p-4">
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="aspect-square rounded-2xl skeleton"/>)}
          </div>
        )}

        {!loading && capturas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Camera className="w-12 h-12 text-gray-700 mb-4"/>
            <p className="text-gray-400 font-medium">Sin capturas aún</p>
            <p className="text-gray-600 text-sm mt-1 mb-6">Toma tu primera foto del ojo para empezar el seguimiento</p>
            <button
              onClick={() => onNavigate('image-capture')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition"
            >
              Ir a Captura de Imagen
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {capturas.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setLightbox(i)}
              className="relative aspect-square rounded-2xl overflow-hidden group"
            >
              <img src={c.imagen_base64} className="w-full h-full object-cover" alt={`Captura ${i + 1}`}/>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-end p-2">
                <div className="opacity-0 group-hover:opacity-100 transition">
                  <p className="text-white text-xs font-semibold">{timeAgo(c.created_at)}</p>
                  {c.confianza && (
                    <p className="text-white/70 text-[10px]">Confianza: {c.confianza}</p>
                  )}
                </div>
              </div>
              {c.confianza === 'alto' && (
                <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-emerald-400"/>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lb && lightbox !== null && (
        <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col">
          <div className="flex items-center justify-between p-4 flex-shrink-0">
            <div>
              <p className="text-white font-semibold text-sm">{new Date(lb.created_at).toLocaleString('es-ES')}</p>
              <p className="text-gray-400 text-xs">{timeAgo(lb.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => eliminar(lb.id)}
                className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center hover:bg-red-500/40 transition"
              >
                <Trash2 className="w-4 h-4 text-red-400"/>
              </button>
              <button
                onClick={() => setLightbox(null)}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
              >
                <X className="w-4 h-4 text-white"/>
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center relative px-4">
            <button
              onClick={() => setLightbox(i => i !== null && i > 0 ? i - 1 : i)}
              className="absolute left-2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition z-10"
              disabled={lightbox === 0}
            >
              <ChevronLeft className="w-5 h-5 text-white"/>
            </button>

            <img
              src={lb.imagen_base64}
              className="max-h-[50vh] max-w-full rounded-2xl object-contain"
              alt="Captura del ojo"
            />

            <button
              onClick={() => setLightbox(i => i !== null && i < capturas.length - 1 ? i + 1 : i)}
              className="absolute right-2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition z-10"
              disabled={lightbox === capturas.length - 1}
            >
              <ChevronRight className="w-5 h-5 text-white"/>
            </button>
          </div>

          {/* Diagnosis */}
          {lb.diagnostico && (
            <div className="p-4 flex-shrink-0 max-h-[40vh] overflow-y-auto">
              <div className="bg-gray-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-indigo-400"/>
                  <p className="text-white font-bold text-sm">Análisis IA</p>
                  {lb.confianza && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      lb.confianza === 'alto' ? 'bg-emerald-900 text-emerald-300'
                      : lb.confianza === 'medio' ? 'bg-amber-900 text-amber-300'
                      : 'bg-gray-700 text-gray-400'
                    }`}>
                      {lb.confianza}
                    </span>
                  )}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{lb.diagnostico}</p>
                {lb.signos && Array.isArray(lb.signos) && lb.signos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {lb.signos.map((s, i) => (
                      <span key={i} className="text-xs bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-gray-600 mt-3">
                {lightbox + 1} de {capturas.length}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
