// =========================================
// OCR RECETA MÉDICA — Therapheye
// Claude Vision (sonnet-4-6) extrae medicamentos de fotos de recetas
// =========================================

import { useState, useRef } from 'react';
import { callClaude } from '../utils/claudeApi';
import {
  ArrowLeft, Camera, Upload, Loader2, Pill, Clock,
  AlertCircle, CheckCircle, RotateCcw, Save, Sparkles,
  ChevronDown, ChevronUp, FileText,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

interface Medicamento {
  nombre: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  indicaciones: string;
}

interface ResultadoOCR {
  medicamentos: Medicamento[];
  notas_adicionales: string;
  medico: string;
  fecha_receta: string;
}

export default function OCRReceta({ onBack }: Props) {
  const { user } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoOCR | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [expandedMed, setExpandedMed] = useState<number | null>(0);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Solo se aceptan imágenes.'); return; }
    if (file.size > 6 * 1024 * 1024) { setError('La imagen es muy grande. Máximo 6MB.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      setPreview(e.target?.result as string);
      setResultado(null);
      setError('');
      setGuardado(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const analizarReceta = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    setResultado(null);
    setExpandedMed(0);

    const [meta, base64] = preview.split(',');
    const mediaType = (meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg') as
      'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    try {
      const data = await callClaude({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: `Analiza esta receta médica y extrae toda la información de medicamentos.
Devuelve un JSON con esta estructura exacta (sin markdown, solo el JSON):
{
  "medicamentos": [
    {
      "nombre": "nombre del medicamento",
      "dosis": "dosis ej: 500mg, 1 gota",
      "frecuencia": "cada cuánto ej: cada 8h, 3 veces al día",
      "duracion": "tiempo ej: 7 días, 1 mes",
      "indicaciones": "notas especiales ej: tomar con alimentos, no conducir"
    }
  ],
  "notas_adicionales": "instrucciones generales de la receta",
  "medico": "nombre del médico si aparece, si no cadena vacía",
  "fecha_receta": "fecha de la receta si aparece, si no cadena vacía"
}
Si no puedes leer un campo, usa cadena vacía. Si no hay medicamentos visibles, devuelve array vacío.`,
              },
            ],
          }],
      });
      const text = (data.content?.[0]?.text ?? '{}').trim();
      // Strip markdown code blocks if present
      const clean = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
      const parsed: ResultadoOCR = JSON.parse(clean);
      setResultado(parsed);
    } catch {
      setError('No se pudo analizar la imagen. Asegúrate de que la foto sea clara y legible.');
    }
    setLoading(false);
  };

  const guardarEnNotas = async () => {
    if (!resultado || !user?.id) return;
    setGuardando(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      for (const med of resultado.medicamentos) {
        if (!med.nombre) continue;
        const contenido = [
          med.dosis && `Dosis: ${med.dosis}`,
          med.frecuencia && `Frecuencia: ${med.frecuencia}`,
          med.duracion && `Duración: ${med.duracion}`,
          med.indicaciones && `Indicaciones: ${med.indicaciones}`,
          resultado.medico && `Médico: ${resultado.medico}`,
        ].filter(Boolean).join('\n');

        await sql`
          INSERT INTO notas_medicas (user_id, tipo, titulo, contenido, fecha)
          VALUES (${user.id}, 'medicamento', ${med.nombre}, ${contenido}, ${today})
        `;
      }
      setGuardado(true);
    } catch {
      setError('Error guardando notas. Intenta de nuevo.');
    }
    setGuardando(false);
  };

  const reset = () => {
    setPreview(null);
    setResultado(null);
    setError('');
    setGuardado(false);
  };

  const hasMeds = resultado && resultado.medicamentos.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-sm">
            <Pill className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-base leading-tight">OCR Receta Médica</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-400" /> Claude Vision · Sonnet 4.6
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Tip banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Camera className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-800">Cómo obtener mejores resultados</p>
            <p className="text-xs text-blue-600 mt-0.5">Asegúrate de que la receta esté bien iluminada, sin sombras y con el texto completamente legible.</p>
          </div>
        </div>

        {/* Upload / Preview */}
        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-blue-200 rounded-2xl p-10 text-center bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
            onClick={() => fileRef.current?.click()}
          >
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
              <FileText className="w-10 h-10 text-blue-500" />
            </div>
            <p className="text-gray-700 font-bold text-lg mb-1">Sube tu receta médica</p>
            <p className="text-gray-400 text-sm mb-5">Arrastra y suelta o toca para seleccionar</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200"
              >
                <Upload className="w-4 h-4" /> Subir foto
              </button>
              <button
                onClick={e => { e.stopPropagation(); cameraRef.current?.click(); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-blue-200 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50 transition"
              >
                <Camera className="w-4 h-4" /> Tomar foto
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4">JPG, PNG, HEIC · máx. 6 MB</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="relative">
              <img src={preview} alt="Receta" className="w-full max-h-72 object-contain bg-gray-50 block" />
              <button
                onClick={reset}
                className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            {!resultado && (
              <div className="p-4">
                <button
                  onClick={analizarReceta}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 transition shadow-lg shadow-blue-200/60 text-sm"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analizando con Claude Vision...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Extraer medicamentos con IA</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3.5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Resultados */}
        {resultado && (
          <div className="space-y-4">
            {/* Stats bar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-semibold text-green-700">
                  {hasMeds ? `${resultado.medicamentos.length} medicamento${resultado.medicamentos.length !== 1 ? 's' : ''} encontrado${resultado.medicamentos.length !== 1 ? 's' : ''}` : 'No se encontraron medicamentos'}
                </span>
              </div>
              {(resultado.medico || resultado.fecha_receta) && (
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
                  {[resultado.medico, resultado.fecha_receta].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>

            {hasMeds ? resultado.medicamentos.map((med, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedMed(expandedMed === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Pill className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-800 text-sm">{med.nombre}</p>
                      {med.dosis && <p className="text-xs text-gray-500">{med.dosis}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {med.frecuencia && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium hidden sm:block">
                        {med.frecuencia}
                      </span>
                    )}
                    {expandedMed === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {expandedMed === i && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-50">
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {med.frecuencia && (
                        <div className="bg-blue-50 rounded-xl p-3">
                          <p className="text-xs text-blue-500 font-medium mb-0.5">Frecuencia</p>
                          <p className="text-sm font-semibold text-blue-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {med.frecuencia}
                          </p>
                        </div>
                      )}
                      {med.duracion && (
                        <div className="bg-violet-50 rounded-xl p-3">
                          <p className="text-xs text-violet-500 font-medium mb-0.5">Duración</p>
                          <p className="text-sm font-semibold text-violet-800">{med.duracion}</p>
                        </div>
                      )}
                      {med.indicaciones && (
                        <div className="col-span-2 bg-amber-50 rounded-xl p-3">
                          <p className="text-xs text-amber-600 font-medium mb-0.5">Indicaciones especiales</p>
                          <p className="text-sm text-amber-800">{med.indicaciones}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm text-amber-700">No se detectaron medicamentos en la imagen. Intenta con una foto más clara.</p>
              </div>
            )}

            {resultado.notas_adicionales && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notas del médico</p>
                <p className="text-sm text-gray-700 leading-relaxed">{resultado.notas_adicionales}</p>
              </div>
            )}

            {/* Save CTA */}
            {hasMeds && (
              guardado ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-700 text-sm">¡Guardado en Notas Médicas!</p>
                    <p className="text-xs text-green-600 mt-0.5">Los medicamentos ya aparecen en tu sección de notas.</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={guardarEnNotas}
                  disabled={guardando}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-2xl font-semibold hover:opacity-90 disabled:opacity-60 transition shadow-xl shadow-blue-200/60 text-sm"
                >
                  {guardando
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : <><Save className="w-4 h-4" /> Guardar en Notas Médicas</>
                  }
                </button>
              )
            )}

            {/* New scan button */}
            <button
              onClick={reset}
              className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-500 rounded-2xl text-sm font-medium hover:border-blue-300 hover:text-blue-500 transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Escanear otra receta
            </button>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}
