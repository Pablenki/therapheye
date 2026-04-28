// =========================================
// PREDICTOR DE FATIGA OCULAR — Therapheye
// Analiza 30 días de cuestionarios con Claude Haiku
// y predice la probabilidad de fatiga para hoy
// =========================================

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { callClaude } from '../utils/claudeApi';

interface PredictorResult {
  probabilidad: number;   // 0–100
  mensaje: string;
  hora_pico: string;
  consejo: string;
  generadoEn: number;     // timestamp ms
}

const CACHE_KEY = 'therapheye_fatiga_predictor_v1';
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

function loadCache(userId: string): PredictorResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY + '_' + userId);
    if (!raw) return null;
    const d = JSON.parse(raw) as PredictorResult;
    if (Date.now() - d.generadoEn > CACHE_TTL) return null;
    return d;
  } catch { return null; }
}

function saveCache(userId: string, d: PredictorResult) {
  try { localStorage.setItem(CACHE_KEY + '_' + userId, JSON.stringify(d)); } catch { /* ignore */ }
}

function probColor(p: number) {
  if (p < 35) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Bajo' };
  if (p < 65) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Moderado' };
  return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'Alto' };
}

const HORA_LABEL: Record<string, string> = {
  mañana: 'Mañana (6–12h)', tarde: 'Tarde (12–18h)', noche: 'Noche (18–24h)', variable: 'Variable'
};

export default function FatigaPredictor() {
  const { user } = useUser();
  const [result, setResult] = useState<PredictorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runPredictor = useCallback(async (force = false) => {
    if (!user?.id) return;
    if (!force) {
      const cached = loadCache(user.id);
      if (cached) { setResult(cached); return; }
    }

    setLoading(true);
    setError('');

    try {
      const rows = await sql`
        SELECT puntaje_fatiga, created_at
        FROM respuestas_cuestionario
        WHERE user_id = ${user.id}
          AND created_at >= NOW() - INTERVAL '30 days'
        ORDER BY created_at
      `.catch(() => []) as any[];

      if (rows.length === 0) {
        // Sin datos suficientes, dar respuesta genérica
        const fallback: PredictorResult = {
          probabilidad: 30,
          mensaje: 'Aún no hay suficientes datos para predecir. Completa más cuestionarios.',
          hora_pico: 'variable',
          consejo: 'Registra tu fatiga diariamente para obtener predicciones personalizadas.',
          generadoEn: Date.now(),
        };
        setResult(fallback);
        saveCache(user.id, fallback);
        setLoading(false);
        return;
      }

      // Agrupar por franja horaria y día de semana
      const grupos: Record<string, number[]> = { mañana: [], tarde: [], noche: [] };
      const diasSemana: Record<number, number[]> = { 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] };

      rows.forEach((r: any) => {
        const d = new Date(r.created_at);
        const h = d.getHours();
        const fatiga = Number(r.puntaje_fatiga);
        const franja = h < 12 ? 'mañana' : h < 18 ? 'tarde' : 'noche';
        grupos[franja].push(fatiga);
        diasSemana[d.getDay()].push(fatiga);
      });

      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

      const now = new Date();
      const horaActual = now.getHours();
      const franjaActual = horaActual < 12 ? 'mañana' : horaActual < 18 ? 'tarde' : 'noche';
      const diaActual = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][now.getDay()];

      const resumen = `
Historial de fatiga ocular (últimos 30 días, ${rows.length} registros):

Promedio por franja horaria:
- Mañana (6-12h): ${avg(grupos.mañana) ?? 'sin datos'}%
- Tarde (12-18h): ${avg(grupos.tarde) ?? 'sin datos'}%
- Noche (18-24h): ${avg(grupos.noche) ?? 'sin datos'}%

Promedio por día de semana:
- Lunes: ${avg(diasSemana[1]) ?? 'sin datos'}%
- Martes: ${avg(diasSemana[2]) ?? 'sin datos'}%
- Miércoles: ${avg(diasSemana[3]) ?? 'sin datos'}%
- Jueves: ${avg(diasSemana[4]) ?? 'sin datos'}%
- Viernes: ${avg(diasSemana[5]) ?? 'sin datos'}%
- Sábado: ${avg(diasSemana[6]) ?? 'sin datos'}%
- Domingo: ${avg(diasSemana[0]) ?? 'sin datos'}%

Momento actual: ${diaActual}, franja ${franjaActual} (${horaActual}h)
`.trim();

      const prompt = `Eres un predictor de fatiga ocular. Analiza el historial y la hora actual, y responde SOLO con un JSON con este formato exacto:

{
  "probabilidad": <número 0-100>,
  "mensaje": "<frase corta sobre el nivel de riesgo de fatiga hoy>",
  "hora_pico": "<mañana|tarde|noche|variable>",
  "consejo": "<consejo concreto de 1 oración para reducir la fatiga hoy>"
}

Sin markdown, sin texto extra. Solo el JSON.

${resumen}`;

      const data = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = data.content?.[0]?.text ?? '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON inválido');
      const parsed = JSON.parse(jsonMatch[0]);
      const r: PredictorResult = { ...parsed, generadoEn: Date.now() };
      setResult(r);
      saveCache(user.id, r);
    } catch (e) {
      console.error('[FatigaPredictor]', e);
      setError('Error al predecir. Intenta de nuevo.');
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { runPredictor(false); }, [runPredictor]);

  if (!user?.id) return null;

  const colors = result ? probColor(result.probabilidad) : null;

  return (
    <div className={`rounded-2xl border p-4 ${colors ? `${colors.bg} ${colors.border}` : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${colors ? colors.text : 'text-gray-400'}`} />
          <p className="text-sm font-bold text-gray-800">Predicción de hoy</p>
        </div>
        <button
          onClick={() => runPredictor(true)}
          disabled={loading}
          className="text-gray-400 hover:text-gray-600 transition disabled:opacity-40"
          title="Actualizar predicción"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !result && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
          <p className="text-xs text-gray-500">Calculando predicción...</p>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && colors && (
        <div className="space-y-2.5">
          {/* Barra de probabilidad */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold ${colors.text}`}>
                Fatiga {colors.label} · {result.probabilidad}%
              </span>
              <span className="text-xs text-gray-500">{HORA_LABEL[result.hora_pico] ?? result.hora_pico}</span>
            </div>
            <div className="h-2 bg-white/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bar} rounded-full transition-all duration-700`}
                style={{ width: `${result.probabilidad}%` }}
              />
            </div>
          </div>

          <p className={`text-xs leading-relaxed ${colors.text} font-medium`}>{result.mensaje}</p>
          <p className="text-xs text-gray-600 leading-relaxed">💡 {result.consejo}</p>
        </div>
      )}
    </div>
  );
}
