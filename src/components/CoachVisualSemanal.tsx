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
import { useLanguage } from '../i18n';

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
  const { lang } = useLanguage();
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

        sql`SELECT avg_blinks_per_min, duration_sec, created_at
            FROM sesiones_parpadeo
            WHERE user_id = ${user.id} AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC`.catch(() => []),

        sql`SELECT score, words_per_minute, created_at
            FROM historial_lectura_visual
            WHERE user_id = ${user.id} AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC`.catch(() => []),
      ]);

      const locale = lang === 'en' ? 'en-US' : 'es-MX';
      const resumen = `
${lang === 'en' ? 'VISUAL HEALTH DATA — LAST 7 DAYS' : 'DATOS DE SALUD VISUAL — ÚLTIMOS 7 DÍAS'}
${lang === 'en' ? 'User' : 'Usuario'}: ${user.nombre}
${lang === 'en' ? 'Analysis date' : 'Fecha de análisis'}: ${new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

=== ${lang === 'en' ? `FATIGUE QUESTIONNAIRES (${(cuestionarios as any[]).length} records)` : `CUESTIONARIOS DE FATIGA (${(cuestionarios as any[]).length} registros)`} ===
${(cuestionarios as any[]).length === 0 ? (lang === 'en' ? 'No evaluations this week.' : 'Sin evaluaciones esta semana.') :
  (cuestionarios as any[]).map(r => {
    const d = new Date(r.created_at);
    const dia = d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
    return lang === 'en'
      ? `• ${dia}: Fatigue ${r.puntaje_fatiga}% — Symptom: ${r.sintoma_dominante ?? 'not specified'}`
      : `• ${dia}: Fatiga ${r.puntaje_fatiga}% — Síntoma: ${r.sintoma_dominante ?? 'no especificado'}`;
  }).join('\n')}

=== ${lang === 'en' ? `EYE EXERCISES (${(ejercicios as any[]).length} records)` : `EJERCICIOS OCULARES (${(ejercicios as any[]).length} registros)`} ===
${(ejercicios as any[]).length === 0 ? (lang === 'en' ? 'No exercises this week.' : 'Sin ejercicios esta semana.') :
  (ejercicios as any[]).map(r => {
    const d = new Date(r.created_at);
    const dia = d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
    const dur = Math.round(Number(r.duracion) / 1000);
    return `• ${dia}: ${r.tipo_ejercicio} — ${dur}s — ${r.status}`;
  }).join('\n')}

=== ${lang === 'en' ? `BLINK DETECTION (${(parpadeos as any[]).length} sessions)` : `DETECCIÓN DE PARPADEO (${(parpadeos as any[]).length} sesiones)`} ===
${(parpadeos as any[]).length === 0 ? (lang === 'en' ? 'No blink sessions this week.' : 'Sin sesiones de parpadeo esta semana.') :
  (parpadeos as any[]).map(r => {
    const d = new Date(r.created_at);
    const dia = d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
    return lang === 'en'
      ? `• ${dia}: ${r.avg_blinks_per_min} blinks/min — ${r.duration_sec}s session`
      : `• ${dia}: ${r.avg_blinks_per_min} parpadeos/min — ${r.duration_sec}s de sesión`;
  }).join('\n')}

=== ${lang === 'en' ? `VISUAL READING TEST (${(lecturas as any[]).length} records)` : `PRUEBA DE LECTURA VISUAL (${(lecturas as any[]).length} registros)`} ===
${(lecturas as any[]).length === 0 ? (lang === 'en' ? 'No reading tests this week.' : 'Sin pruebas de lectura esta semana.') :
  (lecturas as any[]).map(r => {
    const d = new Date(r.created_at);
    const dia = d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
    return lang === 'en'
      ? `• ${dia}: Score ${r.score} — ${r.words_per_minute ?? '?'} words/min`
      : `• ${dia}: Score ${r.score} — ${r.words_per_minute ?? '?'} palabras/min`;
  }).join('\n')}
`.trim();

      const prompt = lang === 'en'
        ? `You are the Visual Coach of Therapheye, an expert in ocular health and visual wellness. Analyze the user's week data and return a JSON with this exact format:

{
  "saludo": "Personalized motivating greeting of 1-2 sentences",
  "mejoro": "What improved this week (if not enough data, say something encouraging about starting to track)",
  "empeoro": "What worsened or needs attention (be specific but kind)",
  "patron": "Detected pattern (e.g.: high fatigue on Wednesdays, few exercises on weekends, etc. If no clear pattern, suggest one to watch)",
  "recomendaciones": ["Concrete recommendation 1", "Concrete recommendation 2", "Concrete recommendation 3"]
}

RULES:
- Respond ONLY with the JSON, no markdown or extra explanations
- Use a warm, empathetic and motivating tone
- Recommendations must be concrete actions achievable this week
- If there is little data, focus on building habits and encouraging the user to log more
- Respond in English

DATA:
${resumen}`
        : `Eres el Coach Visual de Therapheye, un experto en salud ocular y bienestar visual. Analiza los datos de la semana del usuario y devuelve un JSON con este formato exacto:

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
      setError(lang === 'en' ? 'Could not generate analysis. Please try again.' : 'No se pudo generar el análisis. Intenta de nuevo.');
    }
    setLoading(false);
  }, [user?.id, user?.nombre, lang]);

  // Carga caché al montar; si no hay caché, genera automáticamente
  useEffect(() => {
    if (!user?.id) return;
    const cached = loadCache(user.id);
    if (cached) { setAnalysis(cached); setIsFromCache(true); }
    else { fetchAnalysis(false); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user?.id) return null;

  const timeAgo = analysis ? (() => {
    const diff = Date.now() - analysis.generadoEn;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (lang === 'en') return h > 0 ? `${h}h ${m}m ago` : `${m} min ago`;
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
              <p className="text-white font-bold text-sm leading-tight">{lang === 'en' ? 'Weekly Visual Coach' : 'Coach Visual Semanal'}</p>
              <span className="flex items-center gap-1 bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            </div>
            {analysis && (
              <p className="text-white/60 text-[10px] mt-0.5">
                {isFromCache
                  ? (lang === 'en' ? `Saved analysis · ${timeAgo}` : `Análisis guardado · ${timeAgo}`)
                  : (lang === 'en' ? `Generated ${timeAgo}` : `Generado ${timeAgo}`)}
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
            {loading ? (lang === 'en' ? 'Analyzing...' : 'Analizando...') : (lang === 'en' ? 'Regenerate' : 'Regenerar')}
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
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{lang === 'en' ? 'Analyzing your week...' : 'Analizando tu semana...'}</p>
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
                <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{lang === 'en' ? 'Could not generate analysis' : 'No se pudo generar el análisis'}</p>
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
                    <span className="text-base">📈</span> {lang === 'en' ? 'What improved' : 'Lo que mejoró'}
                  </p>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>{analysis.mejoro}</p>
                </div>
                <div className={`rounded-xl p-3 border ${isDark ? 'bg-orange-950/40 border-orange-800' : 'bg-orange-50 border-orange-100'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1.5 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
                    <span className="text-base">📉</span> {lang === 'en' ? 'To improve' : 'A mejorar'}
                  </p>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>{analysis.empeoro}</p>
                </div>
              </div>

              {/* Patrón detectado */}
              <div className={`rounded-xl p-3 border ${isDark ? 'bg-indigo-950/40 border-indigo-800' : 'bg-indigo-50 border-indigo-100'}`}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1.5 ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>
                  <span className="text-base">🔍</span> {lang === 'en' ? 'Detected pattern' : 'Patrón detectado'}
                </p>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>{analysis.patron}</p>
              </div>

              {/* Recomendaciones */}
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="text-base">🎯</span> {lang === 'en' ? 'Recommendations for this week' : 'Recomendaciones para esta semana'}
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
                {lang === 'en'
                  ? 'Your coach will analyze the last 7 days of data to give you personalized recommendations.'
                  : 'Tu coach analizará los últimos 7 días de datos para darte recomendaciones personalizadas.'}
              </p>
              <button
                onClick={() => fetchAnalysis(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition"
              >
                {lang === 'en' ? 'Generate analysis' : 'Generar análisis'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
