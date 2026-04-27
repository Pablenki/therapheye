// =========================================
// ESTADÍSTICAS AVANZADAS — Therapheye
// Dashboard analítico completo: tendencias,
// correlaciones, predicciones y comparativas
// =========================================

import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Activity, Eye, Monitor, Puzzle, ExternalLink, Share2 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

interface DayStat {
  fecha: string;
  ejercicios: number;
  puntaje: number | null;
}

interface HourlyPattern {
  hora: number;
  count: number;
}

interface CorrelationPoint {
  ejercicios: number;
  puntaje: number;
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function EstadisticasAvanzadas({ onBack }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'resumen' | 'tendencias' | 'patrones'>('resumen');

  // Data
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [hourlyPattern, setHourlyPattern] = useState<HourlyPattern[]>([]);
  const [totalEjercicios, setTotalEjercicios] = useState(0);
  const [totalEvaluaciones, setTotalEvaluaciones] = useState(0);
  const [mejorRacha, setMejorRacha] = useState(0);
  const [promedioScore, setPromedioScore] = useState<number | null>(null);
  const [correlation, setCorrelation] = useState<CorrelationPoint[]>([]);
  const [mejorDiaSemana, setMejorDiaSemana] = useState<string | null>(null);

  // Extension screen time
  interface ExtDayData { totalMs: number; sessions: number; sites: Record<string, number> }
  const [extData, setExtData] = useState<Record<string, ExtDayData> | null>(null);
  const [extInstalled, setExtInstalled] = useState(false);

  // IA Correlation
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadExtData = () => {
    const installed = localStorage.getItem('therapheye_ext_installed') === '1';
    setExtInstalled(installed);
    if (!installed) return;
    try {
      const raw = localStorage.getItem('therapheye_ext_screentime');
      if (raw) setExtData(JSON.parse(raw));
    } catch {}
  };

  useEffect(() => {
    loadExtData();
    const handler = () => loadExtData();
    window.addEventListener('therapheye-ext-sync', handler);
    return () => window.removeEventListener('therapheye-ext-sync', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [sesiones, evaluaciones] = await Promise.all([
          sql`
            SELECT DATE(created_at) as fecha, COUNT(*) as cnt,
                   EXTRACT(HOUR FROM created_at) as hora
            FROM sesiones_ejercicio
            WHERE user_id = ${user.id} AND created_at > NOW() - INTERVAL '180 days'
            GROUP BY fecha, hora
            ORDER BY fecha ASC
          `.catch(() => []),
          sql`
            SELECT DATE(created_at) as fecha, AVG(puntaje) as avg_score
            FROM respuestas_cuestionario
            WHERE user_id = ${user.id} AND created_at > NOW() - INTERVAL '180 days'
            GROUP BY fecha
            ORDER BY fecha ASC
          `.catch(() => []),
        ]);

        // Total counts
        const totSesiones = await sql`SELECT COUNT(*) as cnt FROM sesiones_ejercicio WHERE user_id = ${user.id}`.catch(() => [{ cnt: 0 }]);
        const totEval = await sql`SELECT COUNT(*) as cnt FROM respuestas_cuestionario WHERE user_id = ${user.id}`.catch(() => [{ cnt: 0 }]);
        const avgScore = await sql`SELECT AVG(puntaje) as avg FROM respuestas_cuestionario WHERE user_id = ${user.id}`.catch(() => [{ avg: null }]);

        setTotalEjercicios(Number((totSesiones as any[])[0]?.cnt ?? 0));
        setTotalEvaluaciones(Number((totEval as any[])[0]?.cnt ?? 0));
        setPromedioScore((avgScore as any[])[0]?.avg != null ? Math.round(Number((avgScore as any[])[0].avg)) : null);

        // Day stats (merge exercises and scores by date)
        const scoreByDate = new Map<string, number>();
        for (const e of evaluaciones as any[]) {
          scoreByDate.set(e.fecha, Math.round(Number(e.avg_score)));
        }
        const exByDate = new Map<string, number>();
        for (const s of sesiones as any[]) {
          const d = s.fecha;
          exByDate.set(d, (exByDate.get(d) ?? 0) + Number(s.cnt));
        }

        const allDates = new Set([...scoreByDate.keys(), ...exByDate.keys()]);
        const days: DayStat[] = Array.from(allDates).sort().map(d => ({
          fecha: d,
          ejercicios: exByDate.get(d) ?? 0,
          puntaje: scoreByDate.get(d) ?? null,
        }));
        setDayStats(days);

        // Hourly pattern
        const hourCounts = new Array(24).fill(0);
        for (const s of sesiones as any[]) {
          const h = Number(s.hora);
          hourCounts[h] += Number(s.cnt);
        }
        setHourlyPattern(hourCounts.map((count, hora) => ({ hora, count })));

        // Best day of week
        const dowCounts = new Array(7).fill(0);
        for (const s of sesiones as any[]) {
          const dow = new Date(s.fecha).getDay();
          dowCounts[dow] += Number(s.cnt);
        }
        const bestDow = dowCounts.indexOf(Math.max(...dowCounts));
        setMejorDiaSemana(DIAS_SEMANA[bestDow]);

        // Correlation: exercises per week vs avg score
        const corrData: CorrelationPoint[] = [];
        for (const d of days) {
          if (d.puntaje !== null) {
            corrData.push({ ejercicios: d.ejercicios, puntaje: d.puntaje });
          }
        }
        setCorrelation(corrData.slice(-60));

        // Best streak
        let streak = 0;
        let maxStreak = 0;
        let prevDate: Date | null = null;
        for (const d of days) {
          const dt = new Date(d.fecha);
          if (d.ejercicios > 0) {
            if (prevDate && (dt.getTime() - prevDate.getTime()) === 86400000) {
              streak++;
            } else {
              streak = 1;
            }
            maxStreak = Math.max(maxStreak, streak);
            prevDate = dt;
          } else {
            streak = 0;
            prevDate = null;
          }
        }
        setMejorRacha(maxStreak);

      } catch {}
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const analyzeWithAI = async () => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) { setAiError('Falta VITE_ANTHROPIC_API_KEY en .env'); return; }
    if (dayStats.length < 3) { setAiError('Necesitas más datos (mínimo 3 días de actividad) para el análisis.'); return; }

    setAiLoading(true);
    setAiError(null);
    setAiInsight(null);

    try {
      // Preparar resumen de datos
      const screenSummary = extData
        ? Object.entries(extData).slice(-14).map(([d, v]) =>
            `${d}: ${Math.round(v.totalMs / 60000)}min pantalla`
          ).join(', ')
        : 'Sin datos de extensión';

      const exerciseSummary = dayStats.slice(-14).map(d =>
        `${d.fecha}: ${d.ejercicios} ejercicios${d.puntaje !== null ? `, score ${d.puntaje}` : ''}`
      ).join('; ');

      const prompt = `Eres un especialista en salud visual. Analiza estos datos de un usuario de Therapheye y da 3 insights concretos y personalizados en español (sin markdown, párrafo directo, máximo 120 palabras):

Ejercicios y scores (últimos 14 días): ${exerciseSummary}
Tiempo de pantalla (últimos 14 días): ${screenSummary}
Total ejercicios: ${totalEjercicios}, Total evaluaciones: ${totalEvaluaciones}
Mejor racha: ${mejorRacha} días, Puntaje promedio: ${promedioScore ?? 'N/A'}
Día más activo: ${mejorDiaSemana ?? 'desconocido'}, Hora pico: ${peakHour !== null ? `${peakHour}:00` : 'desconocida'}

Identifica correlaciones entre pantalla y síntomas, patrones de fatiga, y da una recomendación accionable para esta semana.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data?.content?.[0]?.text ?? '';
      if (!text) throw new Error('Sin respuesta');
      setAiInsight(text);
    } catch {
      setAiError('Error al contactar la IA. Intenta de nuevo.');
    } finally {
      setAiLoading(false);
    }
  };

  const last30 = dayStats.slice(-30);
  const maxEx = Math.max(...dayStats.map(d => d.ejercicios), 1);

  const recentTrend = (() => {
    if (dayStats.length < 10) return null;
    const half = Math.floor(dayStats.length / 2);
    const first = dayStats.slice(0, half).reduce((a, d) => a + d.ejercicios, 0) / half;
    const second = dayStats.slice(half).reduce((a, d) => a + d.ejercicios, 0) / (dayStats.length - half);
    if (second > first * 1.1) return 'up';
    if (second < first * 0.9) return 'down';
    return 'stable';
  })();

  const activeHours = hourlyPattern.filter(h => h.count > 0);
  const peakHour = activeHours.length > 0
    ? activeHours.reduce((a, b) => a.count > b.count ? a : b).hora
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-indigo-900 px-4 pt-10 pb-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition">
            <ArrowLeft className="w-4 h-4"/> Volver
          </button>
          <button
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              const todayScreenMin = extData?.[today] ? Math.round((extData[today].totalMs) / 60000) : null;
              const text = [
                '👁 Mis estadísticas en Therapheye',
                `📊 ${totalEjercicios} ejercicios visuales completados`,
                `🏆 Mejor racha: ${mejorRacha} días seguidos`,
                promedioScore !== null ? `⭐ Puntaje promedio: ${promedioScore}/100` : null,
                todayScreenMin !== null ? `🖥 Pantalla hoy: ${todayScreenMin}min` : null,
                '',
                '🔗 therapheye.netlify.app',
              ].filter(Boolean).join('\n');

              if (navigator.share) {
                navigator.share({ title: 'Mis stats Therapheye', text });
              } else {
                navigator.clipboard.writeText(text).then(() => alert('¡Copiado al portapapeles!'));
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition"
          >
            <Share2 className="w-3.5 h-3.5"/> Compartir
          </button>
        </div>
        <h1 className="text-2xl font-black">Estadísticas Avanzadas</h1>
        <p className="text-indigo-300 text-sm mt-0.5">Análisis de los últimos 6 meses</p>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 flex">
        {([['resumen', 'Resumen'], ['tendencias', 'Tendencias'], ['patrones', 'Patrones']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
              tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {l}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl skeleton"/>)}</div>}

        {/* ── RESUMEN ── */}
        {!loading && tab === 'resumen' && (
          <div className="space-y-4 animate-[fadeInUp_0.3s_ease]">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Ejercicios totales', value: totalEjercicios, icon: Activity, color: 'indigo' },
                { label: 'Evaluaciones', value: totalEvaluaciones, icon: ClipboardList, color: 'blue' },
                { label: 'Mejor racha', value: `${mejorRacha}d`, icon: TrendingUp, color: 'emerald' },
                { label: 'Puntaje promedio', value: promedioScore !== null ? `${promedioScore}/100` : 'N/A', icon: Eye, color: 'violet' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className={`w-8 h-8 rounded-xl bg-${color}-100 flex items-center justify-center mb-2`}>
                    <Icon className={`w-4 h-4 text-${color}-600`}/>
                  </div>
                  <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* ── Extension screen time ── */}
            {extInstalled && extData ? (() => {
              const today = new Date().toISOString().slice(0, 10);
              const todayMs = extData[today]?.totalMs ?? 0;
              const weekDays = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (6 - i));
                const key = d.toISOString().slice(0, 10);
                return { key, ms: extData[key]?.totalMs ?? 0, label: ['D','L','M','Mi','J','V','S'][d.getDay()] };
              });
              const maxMs = Math.max(...weekDays.map(d => d.ms), 1);
              const fmt = (ms: number) => {
                const h = Math.floor(ms / 3_600_000);
                const m = Math.floor((ms % 3_600_000) / 60_000);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
              };
              const topSites = Object.entries(extData[today]?.sites ?? {})
                .sort((a: any, b: any) => b[1] - a[1]).slice(0, 3);
              return (
                <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-white" />
                    <span className="text-white font-bold text-sm">Tiempo de pantalla</span>
                    <span className="ml-auto text-indigo-200 text-xs flex items-center gap-1">
                      <Puzzle className="w-3 h-3" /> Screen Guard
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-3xl font-black text-gray-900">{fmt(todayMs)}</span>
                      <span className="text-sm text-gray-500">hoy</span>
                      {todayMs >= 8 * 3_600_000 && (
                        <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Mucho tiempo</span>
                      )}
                    </div>
                    {/* Weekly bars */}
                    <div className="flex items-end gap-1 h-12 mb-1">
                      {weekDays.map(d => (
                        <div key={d.key} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="w-full rounded-t-sm transition-all"
                            style={{
                              height: `${Math.max((d.ms / maxMs) * 100, d.ms > 0 ? 8 : 0)}%`,
                              background: d.key === today
                                ? 'linear-gradient(180deg,#4f46e5,#7c3aed)'
                                : d.ms >= 8 * 3_600_000
                                ? '#ef4444'
                                : d.ms > 0 ? '#a5b4fc' : '#f3f4f6',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 mb-3">
                      {weekDays.map(d => (
                        <div key={d.key} className={`flex-1 text-center text-[9px] font-semibold ${d.key === today ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {d.label}
                        </div>
                      ))}
                    </div>
                    {/* Top sites */}
                    {topSites.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1.5">Top sitios hoy</p>
                        <div className="space-y-1.5">
                          {topSites.map(([host, ms]: [string, any]) => {
                            const pct = Math.round((ms / (extData[today]?.totalMs ?? 1)) * 100);
                            return (
                              <div key={host} className="flex items-center gap-2">
                                <span className="text-xs text-gray-700 w-28 truncate">{host.replace('www.', '')}</span>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 w-10 text-right">{fmt(ms)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : !extInstalled ? (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Puzzle className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-indigo-800 text-sm">Instala Therapheye Screen Guard</p>
                  <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">
                    La extensión de Chrome trackea tu tiempo de pantalla y muestra las estadísticas aquí.
                  </p>
                  <a
                    href="https://github.com/Pablenki/therapheye/tree/main/extension"
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition"
                  >
                    Ver instrucciones <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : null}

            {/* Trend indicator */}
            {recentTrend && (
              <div className={`rounded-2xl p-4 flex items-center gap-3 ${
                recentTrend === 'up' ? 'bg-emerald-50 border border-emerald-200' :
                recentTrend === 'down' ? 'bg-red-50 border border-red-200' :
                'bg-gray-50 border border-gray-200'
              }`}>
                {recentTrend === 'up' ? <TrendingUp className="w-5 h-5 text-emerald-600 flex-shrink-0"/>
                  : recentTrend === 'down' ? <TrendingDown className="w-5 h-5 text-red-500 flex-shrink-0"/>
                  : <Minus className="w-5 h-5 text-gray-500 flex-shrink-0"/>}
                <div>
                  <p className={`font-bold text-sm ${recentTrend === 'up' ? 'text-emerald-700' : recentTrend === 'down' ? 'text-red-700' : 'text-gray-700'}`}>
                    {recentTrend === 'up' ? 'Tendencia positiva' : recentTrend === 'down' ? 'Actividad en descenso' : 'Actividad estable'}
                  </p>
                  <p className={`text-xs ${recentTrend === 'up' ? 'text-emerald-600' : recentTrend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
                    {recentTrend === 'up' ? 'Hiciste más ejercicios en la segunda mitad del período.'
                      : recentTrend === 'down' ? 'La actividad bajó. Retoma tu rutina hoy.'
                      : 'La actividad se mantiene constante.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── Panel IA Correlación ── */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-indigo-900 text-sm">Análisis con IA</p>
                  <p className="text-xs text-indigo-500 mt-0.5">Correlaciones + recomendación personalizada</p>
                </div>
                <button
                  onClick={analyzeWithAI}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition active:scale-95"
                >
                  {aiLoading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      Analizando…
                    </span>
                  ) : '✨ Analizar'}
                </button>
              </div>
              {aiError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{aiError}</p>}
              {aiInsight && (
                <div className="bg-white rounded-xl p-3 border border-indigo-100">
                  <p className="text-sm text-gray-800 leading-relaxed">{aiInsight}</p>
                  <button
                    onClick={() => setAiInsight(null)}
                    className="mt-2 text-xs text-indigo-400 hover:text-indigo-600 transition"
                  >
                    Cerrar
                  </button>
                </div>
              )}
              {!aiInsight && !aiError && !aiLoading && (
                <p className="text-xs text-indigo-400">Toca "Analizar" para ver insights sobre tus hábitos visuales.</p>
              )}
            </div>

            {/* Peak day/hour */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="font-bold text-gray-900 mb-3 text-sm">Tus mejores momentos</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-black text-indigo-600">{mejorDiaSemana ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-1">Día más activo</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black text-violet-600">
                    {peakHour !== null ? `${peakHour}:00` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Hora pico</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TENDENCIAS ── */}
        {!loading && tab === 'tendencias' && (
          <div className="space-y-4 animate-[fadeInUp_0.3s_ease]">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="font-bold text-gray-900 mb-3 text-sm">Ejercicios diarios — últimos 30 días</p>
              <div className="flex items-end gap-0.5 h-20">
                {last30.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${Math.round((d.ejercicios / maxEx) * 100)}%`,
                        minHeight: d.ejercicios > 0 ? '4px' : '0',
                        background: d.ejercicios === 0 ? '#f3f4f6'
                          : d.ejercicios >= 3 ? '#6366f1'
                          : d.ejercicios >= 2 ? '#818cf8'
                          : '#a5b4fc',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>30d atrás</span><span>Hoy</span>
              </div>
            </div>

            {/* Scores chart */}
            {dayStats.some(d => d.puntaje !== null) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="font-bold text-gray-900 mb-3 text-sm">Puntaje de evaluaciones — últimos 30 días</p>
                <div className="flex items-end gap-0.5 h-20">
                  {last30.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      {d.puntaje !== null ? (
                        <div
                          className="w-full rounded-t-sm"
                          style={{
                            height: `${d.puntaje}%`,
                            minHeight: '4px',
                            background: d.puntaje >= 70 ? '#10b981' : d.puntaje >= 40 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      ) : <div className="w-full" style={{ height: '2px', background: '#f3f4f6' }}/>}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0</span><span>50</span><span>100</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PATRONES ── */}
        {!loading && tab === 'patrones' && (
          <div className="space-y-4 animate-[fadeInUp_0.3s_ease]">
            {/* Hourly heatmap */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="font-bold text-gray-900 mb-3 text-sm">Patrón horario de ejercicio</p>
              <div className="grid grid-cols-12 gap-0.5">
                {hourlyPattern.slice(6, 23).map(h => {
                  const maxH = Math.max(...hourlyPattern.map(x => x.count), 1);
                  const intensity = h.count / maxH;
                  return (
                    <div key={h.hora} className="flex flex-col items-center gap-0.5">
                      <div
                        className="w-full h-8 rounded-sm"
                        style={{
                          background: intensity === 0 ? '#f3f4f6'
                            : `rgba(99, 102, 241, ${0.15 + intensity * 0.85})`,
                        }}
                        title={`${h.hora}:00 — ${h.count} sesiones`}
                      />
                      <span className="text-[8px] text-gray-400">{h.hora}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">6:00 a 22:00 · más oscuro = más activo</p>
            </div>

            {/* Correlation: exercises vs score */}
            {correlation.length >= 5 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="font-bold text-gray-900 mb-1 text-sm">Ejercicios vs. Puntaje</p>
                <p className="text-xs text-gray-500 mb-3">¿Más ejercicios → mejor puntaje?</p>
                <div className="relative h-32 border-l border-b border-gray-200">
                  {correlation.map((pt, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-indigo-500 opacity-60"
                      style={{
                        left: `${Math.min((pt.ejercicios / 5) * 100, 95)}%`,
                        bottom: `${pt.puntaje}%`,
                        transform: 'translate(-50%, 50%)',
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>← 0 ejercicios</span><span>5+ ejercicios →</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ClipboardList({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  );
}
