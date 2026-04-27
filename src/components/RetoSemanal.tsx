// =========================================
// RETO SEMANAL — Therapheye
// 3 retos clínicos por semana, rotación automática
// Progreso trackeado en localStorage + DB queries
// =========================================

import { useState, useEffect } from 'react';
import { Trophy, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

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
    id: 'amsler',
    emoji: '🔲',
    titulo: 'Test de Amsler',
    desc: 'Haz la rejilla de Amsler dos veces esta semana',
    meta: 2, unidad: 'tests',
    getProgress: async () => {
      try {
        const key = `therapheye_amsler_week_${getWeekKey()}`;
        return Number(localStorage.getItem(key) ?? 0);
      } catch { return 0; }
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

export default function RetoSemanal({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { user } = useUser();
  const [retos, setRetos] = useState<RetoState[]>([]);
  const [loading, setLoading] = useState(true);
  const weekKey = getWeekKey();
  const { start, end } = getWeekBounds();

  useEffect(() => {
    if (!user?.id) return;
    const selected = pickRetos(weekKey);
    Promise.all(
      selected.map(async r => {
        const progress = await r.getProgress(user.id!, start, end);
        return { reto: r, progress: Math.min(progress, r.meta), done: progress >= r.meta };
      })
    ).then(states => { setRetos(states); setLoading(false); });
  }, [user?.id, weekKey, start, end]);

  const completed = retos.filter(r => r.done).length;
  const allDone = completed === 3;

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-sm">Reto semanal</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full border-2 border-white/60 transition-all ${i < completed ? 'bg-white' : 'bg-white/20'}`} />
          ))}
          <span className="text-white/80 text-xs ml-1">{completed}/3</span>
        </div>
      </div>

      {allDone && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2">
          <span className="text-lg">🎉</span>
          <p className="text-amber-800 text-xs font-semibold">¡Semana perfecta! Completaste todos los retos</p>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {retos.map(({ reto, progress, done }) => (
          <div key={reto.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl flex-shrink-0">{reto.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-sm font-semibold truncate ${done ? 'text-green-700' : 'text-gray-800'}`}>{reto.titulo}</p>
                {done && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-gray-400 truncate">{reto.desc}</p>
              {/* Progress bar */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(progress / reto.meta) * 100}%`,
                      background: done ? '#10b981' : '#f59e0b',
                    }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{progress}/{reto.meta}</span>
              </div>
            </div>
            {!done && onNavigate && (
              <button
                onClick={() => {
                  const pageMap: Record<string, string> = {
                    ejercicios: 'exercises', cuestionario: 'questionnaire',
                    vision: 'vision-test', diagnostico: 'diagnostico-completo',
                    respiracion: 'respiracion-478', racha: 'exercises',
                    amsler: 'amsler-grid', chat: 'chat-sintomas',
                  };
                  onNavigate(pageMap[reto.id] ?? 'dashboard');
                }}
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 hover:bg-amber-200 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {done && <Circle className="w-5 h-5 text-green-200 flex-shrink-0" />}
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-gray-50">
        <p className="text-[10px] text-gray-400 text-center">Semana {weekKey} · Nuevos retos cada lunes</p>
      </div>
    </div>
  );
}
