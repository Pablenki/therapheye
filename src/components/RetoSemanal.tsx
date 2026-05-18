// =========================================
// RETO SEMANAL — Therapheye
// 3 retos clínicos por semana, rotación automática
// Progreso trackeado en localStorage + DB queries
// =========================================

import { useState, useEffect, useCallback } from 'react';
import { Trophy, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';

interface Reto {
  id: string;
  emoji: string;
  titulo: string;
  desc: string;
  meta: number;
  unidad: string;
  getProgress: (userId: string, weekStart: string, weekEnd: string) => Promise<number>;
}

const POOL: Reto[] = [
  {
    id: 'ejercicios',
    emoji: '💪',
    titulo: 'Semana activa',
    desc: 'Completa 5 ejercicios terapéuticos esta semana',
    meta: 5, unidad: 'ejercicios',
    getProgress: async (uid, ws, we) => {
      const r = await sql`SELECT COUNT(*) as cnt FROM historial_ejercicios WHERE user_id=${uid} AND status='completed' AND created_at >= ${ws} AND created_at < ${we}`.catch(() => [{ cnt: 0 }]);
      return Number((r as any[])[0]?.cnt ?? 0);
    },
  },
  {
    id: 'cuestionario',
    emoji: '📋',
    titulo: 'Check diario',
    desc: 'Responde el cuestionario 4 días esta semana',
    meta: 4, unidad: 'días',
    getProgress: async (uid, ws, we) => {
      const r = await sql`SELECT COUNT(DISTINCT DATE(created_at)) as cnt FROM respuestas_cuestionario WHERE user_id=${uid} AND created_at >= ${ws} AND created_at < ${we}`.catch(() => [{ cnt: 0 }]);
      return Number((r as any[])[0]?.cnt ?? 0);
    },
  },
  {
    id: 'vision',
    emoji: '👓',
    titulo: 'Test visual',
    desc: 'Realiza la prueba de visión esta semana',
    meta: 1, unidad: 'test',
    getProgress: async (uid, ws, we) => {
      const r = await sql`SELECT COUNT(*) as cnt FROM historial_vision_test WHERE user_id=${uid} AND created_at >= ${ws} AND created_at < ${we}`.catch(() => [{ cnt: 0 }]);
      return Number((r as any[])[0]?.cnt ?? 0);
    },
  },
  {
    id: 'diagnostico',
    emoji: '🔬',
    titulo: 'Diagnóstico completo',
    desc: 'Completa el diagnóstico clínico esta semana',
    meta: 1, unidad: 'diagnóstico',
    getProgress: async (uid, ws, we) => {
      const r = await sql`SELECT COUNT(*) as cnt FROM diagnostico_completo WHERE user_id=${uid} AND created_at >= ${ws} AND created_at < ${we}`.catch(() => [{ cnt: 0 }]);
      return Number((r as any[])[0]?.cnt ?? 0);
    },
  },
  {
    id: 'respiracion',
    emoji: '💨',
    titulo: 'Respira bien',
    desc: 'Practica la respiración 4-7-8 tres veces',
    meta: 3, unidad: 'sesiones',
    getProgress: async () => {
      try {
        const key = `therapheye_respiracion_week_${getWeekKey()}`;
        return Number(localStorage.getItem(key) ?? 0);
      } catch { return 0; }
    },
  },
  {
    id: 'racha',
    emoji: '🔥',
    titulo: 'Racha semanal',
    desc: 'Activa la app 6 días seguidos esta semana',
    meta: 6, unidad: 'días',
    getProgress: async (uid, ws, we) => {
      const r = await sql`
        SELECT COUNT(DISTINCT DATE(created_at)) as cnt
        FROM (
          SELECT created_at FROM historial_ejercicios WHERE user_id=${uid} AND created_at >= ${ws} AND created_at < ${we}
          UNION ALL
          SELECT created_at FROM respuestas_cuestionario WHERE user_id=${uid} AND created_at >= ${ws} AND created_at < ${we}
        ) t
      `.catch(() => [{ cnt: 0 }]);
      return Number((r as any[])[0]?.cnt ?? 0);
    },
  },
  {
    id: 'chat',
    emoji: '💬',
    titulo: 'Consulta a la IA',
    desc: 'Usa el Chat Visual para consultar síntomas',
    meta: 1, unidad: 'consulta',
    getProgress: async () => {
      try {
        const key = `therapheye_chat_week_${getWeekKey()}`;
        return Number(localStorage.getItem(key) ?? 0);
      } catch { return 0; }
    },
  },
];

const POOL_EN: Record<string, { titulo: string; desc: string }> = {
  ejercicios:  { titulo: 'Active week',         desc: 'Complete 5 therapeutic exercises this week' },
  cuestionario:{ titulo: 'Daily check',          desc: 'Fill in the questionnaire 4 days this week' },
  vision:      { titulo: 'Vision test',          desc: 'Take the vision test this week' },
  diagnostico: { titulo: 'Full diagnosis',       desc: 'Complete the clinical diagnosis this week' },
  respiracion: { titulo: 'Breathe well',         desc: 'Practice 4-7-8 breathing three times' },
  racha:       { titulo: 'Weekly streak',        desc: 'Open the app 6 consecutive days this week' },
  chat:        { titulo: 'Ask the AI',           desc: 'Use the Visual Chat to consult your symptoms' },
};

function getWeekKey(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 7);
  return {
    start: mon.toISOString(),
    end:   sun.toISOString(),
  };
}

function pickRetos(weekKey: string): Reto[] {
  // Seed by week to always pick same 3 for the whole week
  const hash = weekKey.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const indices: number[] = [];
  let seed = hash;
  while (indices.length < 3) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const idx = Math.abs(seed) % POOL.length;
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices.map(i => POOL[i]);
}

interface RetoState { reto: Reto; progress: number; done: boolean }

const readIsDark = () => {
  try { const s = localStorage.getItem('therapeye_accessibility_settings'); return s ? JSON.parse(s).theme === 'oscuro' : false; }
  catch { return false; }
};

export default function RetoSemanal({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { user } = useUser();
  const { lang } = useLanguage();
  const es = lang === 'es';
  const [retos, setRetos] = useState<RetoState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(readIsDark);
  useEffect(() => {
    const h = () => setIsDark(readIsDark());
    window.addEventListener('therapheye-theme-changed', h);
    return () => window.removeEventListener('therapheye-theme-changed', h);
  }, []);
  const weekKey = getWeekKey();
  const { start, end } = getWeekBounds();

  const fetchProgress = useCallback(() => {
    if (!user?.id) return;
    const selected = pickRetos(weekKey);
    Promise.all(
      selected.map(async r => {
        const progress = await r.getProgress(user.id!, start, end);
        return { reto: r, progress: Math.min(progress, r.meta), done: progress >= r.meta };
      })
    ).then(states => { setRetos(states); setLoading(false); });
  }, [user?.id, weekKey, start, end]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) fetchProgress(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchProgress]);

  const completed = retos.filter(r => r.done).length;
  const allDone = completed === 3;

  if (loading) return null;

  return (
    <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-amber-100'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-sm">{es ? 'Reto semanal' : 'Weekly challenge'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full border-2 border-white/60 transition-all ${i < completed ? 'bg-white' : 'bg-white/20'}`} />
          ))}
          <span className="text-white/80 text-xs ml-1">{completed}/3</span>
        </div>
      </div>

      {allDone && (
        <div className={`border-b px-4 py-2 flex items-center gap-2 ${isDark ? 'bg-amber-950/40 border-amber-800' : 'bg-amber-50 border-amber-100'}`}>
          <span className="text-lg">🎉</span>
          <p className={`text-xs font-semibold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
            {es ? '¡Semana perfecta! Completaste todos los retos' : 'Perfect week! You completed all challenges'}
          </p>
        </div>
      )}

      <div className={`divide-y ${isDark ? 'divide-zinc-700' : 'divide-gray-50'}`}>
        {retos.map(({ reto, progress, done }) => (
          <div key={reto.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl flex-shrink-0">{reto.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-sm font-semibold truncate ${done ? (isDark ? 'text-green-400' : 'text-green-700') : (isDark ? 'text-gray-200' : 'text-gray-800')}`}>
                  {es ? reto.titulo : (POOL_EN[reto.id]?.titulo ?? reto.titulo)}
                </p>
                {done && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
              </div>
              <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {es ? reto.desc : (POOL_EN[reto.id]?.desc ?? reto.desc)}
              </p>
              {/* Progress bar */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-700' : 'bg-gray-100'}`}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(progress / reto.meta) * 100}%`,
                      background: done ? '#10b981' : '#f59e0b',
                    }}
                  />
                </div>
                <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{progress}/{reto.meta}</span>
              </div>
            </div>
            {!done && onNavigate && (
              <button
                onClick={() => {
                  const pageMap: Record<string, string> = {
                    ejercicios: 'exercises', cuestionario: 'questionnaire',
                    vision: 'vision-test', diagnostico: 'diagnostico-completo',
                    respiracion: 'respiracion-478', racha: 'exercises',
                    chat: 'chat-sintomas',
                  };
                  onNavigate(pageMap[reto.id] ?? 'dashboard');
                }}
                className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition ${isDark ? 'bg-amber-900/40 text-amber-400 hover:bg-amber-900/60' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {done && <Circle className="w-5 h-5 text-green-200 flex-shrink-0" />}
          </div>
        ))}
      </div>

      <div className={`px-4 py-2 border-t ${isDark ? 'border-zinc-700' : 'border-gray-50'}`}>
        <p className={`text-[10px] text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          {es ? `Semana ${weekKey} · Nuevos retos cada lunes` : `Week ${weekKey} · New challenges every Monday`}
        </p>
      </div>
    </div>
  );
}
