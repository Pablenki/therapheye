// =========================================
// COACH VISUAL SEMANAL — Therapheye
// Analiza los últimos 7 días con Claude Haiku
// y devuelve un análisis personalizado de salud visual
// =========================================

import { useState, useEffect, useCallback } from 'react';
import { Brain, RefreshCw, Sparkles, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { callClaude } from '../utils/claudeApi';

interface Props {
  onNavigate?: (page: string) => void;
}

interface CoachAnalysis {
  saludo: string;
  mejoro: string;
  empeoro: string;
  patron: string;
  recomendaciones: string[];
  generadoEn: number; // timestamp ms
}

const CACHE_KEY = 'therapheye_coach_semanal_v2';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

function loadCache(userId: string): CoachAnalysis | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY + '_' + userId);
    if (!raw) return null;
    const data = JSON.parse(raw) as CoachAnalysis;
    if (Date.now() - data.generadoEn > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveCache(userId: string, data: CoachAnalysis) {
  try {
    localStorage.setItem(CACHE_KEY + '_' + userId, JSON.stringify(data));
  } catch { /* ignore */ }
}

function clearCache(userId: string) {
  try { localStorage.removeItem(CACHE_KEY + '_' + userId); } catch { /* ignore */ }
}

const readIsDark = () => {
  try { const s = localStorage.getItem('therapeye_accessibility_settings'); return s ? JSON.parse(s).theme === 'oscuro' : false; }
  catch { return false; }
};

export default function CoachVisualSemanal({ onNavigate: _onNavigate }: Props) {
  const { user } = useUser();
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isDark, setIsDark] = useState(readIsDark);
  useEffect(() => {
    const h = () => setIsDark(readIsDark());
    window.addEventListener('therapheye-theme-changed', h);
    return () => window.removeEventListener('therapheye-theme-changed', h);
  }, []);

  const fetchAnalysis = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    if (!forceRefresh) {
      const cached = loadCache(user.id);
      if (cached) { setAnalysis(cached); setIsFromCache(true); return; }
    } else {
      clearCache(user.id);
    }

    setLoading(true);
    setError('');
    setIsFromCache(false);

    try {
      // Consultar BD: últimos 7 días
      const [cuestionarios, ejercicios, parpadeos, lecturas] = await Promise.all([
        sql`SELECT puntaje_fatiga, sintoma_dominante, created_at
            FROM respuestas_cuestionario
            WHERE user_id = ${user.id} AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC`.catch(() => []),

        sql`SELECT tipo_ejercicio, duracion, status, created_at
            FROM historial_ejercicios
            WHERE user_id = ${user.id} AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC`.catch(() => []),

        sql`SELECT blinks_per_minute, duration_seconds, created_at
            FROM sesiones_parpadeo
            WHERE user_id = ${user.id} AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC`.catch(() => []),

        sql`SELECT score, words_per_minute, created_at
            FROM historial_lectura_visual
            WHERE user_id = ${user.id} AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC`.catch(() => []),
      ]);

      const resumen = `
DATOS DE SALUD VISUAL — ÚLTIMOS 7 DÍAS
Usuario: ${user.nombre}
Fecha de análisis: ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

=== CUESTIONARIOS DE FATIGA (${(cuestionarios as any[]).length} registros) ===
${(cuestionarios as any[]).length === 0 ? 'Sin evaluaciones esta semana.' :
  (cuestionarios as any[]).map(r => {
    const d = new Date(r.created_at);
    const dia = d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
    return `• ${dia}: Fatiga ${r.puntaje_fatiga}% — Síntoma: ${r.sintoma_dominante ?? 'no especificado'}`;
  }).join('\n')}

=== EJERCICIOS OCULARES (${(ejercicios as any[]).length} registros) ===
${(ejercicios as any[]).length === 0 ? 'Sin ejercicios esta semana.' :
  (ejercicios as any[]).map(r => {
    const d = new Date(r.created_at);
    const dia = d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
    const dur = Math.round(Number(r.duracion) / 1000);
    return `• ${dia}: ${r.tipo_ejercicio} — ${dur}s — ${r.status}`;
  }).join('\n')}

=== DETECCIÓN DE PARPADEO (${(parpadeos as any[]).length} sesiones) ===
${(parpadeos as any[]).length === 0 ? 'Sin sesiones de parpadeo esta semana.' :
  (parpadeos as any[]).map(r => {
    const d = new Date(r.created_at);
    const dia = d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
    return `• ${dia}: ${r.blinks_per_minute} parpadeos/min — ${r.duration_seconds}s de sesión`;
  }).join('\n')}

=== PRUEBA DE LECTURA VISUAL (${(lecturas as any[]).length} registros) ===
${(lecturas as any[]).length === 0 ? 'Sin pruebas de lectura esta semana.' :
  (lecturas as any[]).map(r => {
    const d = new Date(r.created_at);
    const dia = d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
    return `• ${dia}: Score ${r.score} — ${r.words_per_minute ?? '?'} palabras/min`;
  }).join('\n')}
`.trim();

      const prompt = `Eres el Coach Visual de Therapheye, un experto en salud ocular y bienestar visual. Analiza los datos de la semana del usuario y devuelve un JSON con este formato exacto:

{
  "saludo": "Mensaje de saludo personalizado y motivador de 1-2 oraciones",
  "mejoro": "Qué mejoró esta semana (si no hay datos suficientes, di algo alentador sobre comenzar el seguimiento)",
  "empeoro": "Qué empeoró o requiere atención (sé específico pero amable)",
  "patron": "Patrón detectado (ejemplo: fatiga alta los miércoles, pocos ejercicios en fin de semana, etc. Si no hay patrón claro, sugiere uno a vigilar)",
  "recomendaciones": ["Recomendación concreta 1", "Recomendación concreta 2", "Recomendación concreta 3"]
}

REGLAS:
- Responde SOLO con el JSON, sin markdown ni explicaciones extra
- Usa tono cálido, empático y motivador
- Las recomendaciones deben ser acciones concretas y realizables esta semana
- Si hay pocos datos, enfócate en crear hábitos y animar al usuario a registrar más
- Responde en español

DATOS:
${resumen}`;

      const data = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = data.content?.[0]?.text ?? '{}';

      // Parse JSON — puede venir con ```json ... ``` o solo el objeto
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Respuesta no válida de IA');
      const parsed = JSON.parse(jsonMatch[0]) as Omit<CoachAnalysis, 'generadoEn'>;

      const result: CoachAnalysis = { ...parsed, generadoEn: Date.now() };
      setAnalysis(result);
      saveCache(user.id, result);
    } catch (e) {
      console.error('[CoachVisual]', e);
      setError('No se pudo generar el análisis. Intenta de nuevo.');
    }
    setLoading(false);
  }, [user?.id, user?.nombre]);

  // Solo carga caché al montar — la API se llama únicamente cuando el usuario hace clic en "Regenerar"
  useEffect(() => {
    if (!user?.id) return;
    const cached = loadCache(user.id);
    if (cached) { setAnalysis(cached); setIsFromCache(true); }
  }, [user?.id]);

  if (!user?.id) return null;

  const timeAgo = analysis ? (() => {
    const diff = Date.now() - analysis.generadoEn;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `hace ${h}h ${m}m` : `hace ${m} min`;
  })() : '';

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-sm leading-tight">Coach Visual Semanal</p>
              <span className="flex items-center gap-1 bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            </div>
            {analysis && (
              <p className="text-white/60 text-[10px] mt-0.5">
                {isFromCache ? `Análisis guardado · ${timeAgo}` : `Generado ${timeAgo}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAnalysis(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
            title="Regenerar análisis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analizando...' : 'Regenerar'}
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition text-white"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className={`border-x border-b ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-purple-100'}`}>
          {loading && !analysis && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-10 h-10 rounded-full border-3 border-purple-200 border-t-purple-600 animate-spin" style={{ borderWidth: 3 }} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Analizando tu semana...</p>
            </div>
          )}

          {!loading && !error && !analysis && (
            <div className="flex flex-col items-center gap-3 py-8 px-5 text-center">
              <Sparkles className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-400'}`} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Haz clic en <strong className="text-purple-500">Regenerar</strong> para generar tu análisis semanal con IA
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-3 p-5">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>No se pudo generar el análisis</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{error}</p>
              </div>
            </div>
          )}

          {analysis && (
            <div className="p-5 space-y-4">
              {/* Saludo */}
              <p className={`text-sm leading-relaxed font-medium border-l-4 border-purple-400 pl-3 italic ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {analysis.saludo}
              </p>

              {/* Mejoras / Empeoró */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`rounded-xl p-3 border ${isDark ? 'bg-emerald-950/40 border-emerald-800' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    <span className="text-base">📈</span> Lo que mejoró
                  </p>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>{analysis.mejoro}</p>
                </div>
                <div className={`rounded-xl p-3 border ${isDark ? 'bg-orange-950/40 border-orange-800' : 'bg-orange-50 border-orange-100'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1.5 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
                    <span className="text-base">📉</span> A mejorar
                  </p>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>{analysis.empeoro}</p>
                </div>
              </div>

              {/* Patrón detectado */}
              <div className={`rounded-xl p-3 border ${isDark ? 'bg-indigo-950/40 border-indigo-800' : 'bg-indigo-50 border-indigo-100'}`}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1.5 ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>
                  <span className="text-base">🔍</span> Patrón detectado
                </p>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>{analysis.patron}</p>
              </div>

              {/* Recomendaciones */}
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="text-base">🎯</span> Recomendaciones para esta semana
                </p>
                <div className="space-y-2">
                  {(analysis.recomendaciones ?? []).map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${isDark ? 'bg-purple-900/60 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                        {i + 1}
                      </span>
                      <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!analysis && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-6">
              <Brain className="w-10 h-10 text-purple-200" />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Tu coach analizará los últimos 7 días de datos para darte recomendaciones personalizadas.
              </p>
              <button
                onClick={() => fetchAnalysis(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition"
              >
                Generar análisis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
