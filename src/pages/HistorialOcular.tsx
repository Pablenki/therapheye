// =========================================
// HISTORIAL OCULAR COMPLETO — Therapheye
// Timeline visual de toda la actividad del usuario
// Tests, ejercicios, diario, todo en una línea de tiempo
// =========================================

import { useState, useEffect } from 'react';
import { ArrowLeft, Activity, Eye, ClipboardList, BookOpen, Crosshair, Zap, Filter } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

interface Evento {
  fecha: string;      // ISO
  tipo: string;
  titulo: string;
  subtitulo: string;
  icon: React.ElementType;
  color: string;
  valor?: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ejercicio:    { label: 'Ejercicio',      icon: Activity,      color: 'emerald' },
  evaluacion:   { label: 'Evaluación',     icon: ClipboardList, color: 'blue' },
  campo_visual: { label: 'Campo Visual',   icon: Crosshair,     color: 'indigo' },
  contraste:    { label: 'Test Contraste', icon: Eye,           color: 'violet' },
  diario:       { label: 'Diario Visual',  icon: BookOpen,      color: 'amber' },
  pomodoro:     { label: 'Pomodoro',       icon: Zap,           color: 'orange' },
};

const TIPOS_FILTER = ['todos', ...Object.keys(TYPE_META)];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const d = Math.floor(hr / 24);
  if (d > 0) return `hace ${d} día${d > 1 ? 's' : ''}`;
  if (hr > 0) return `hace ${hr}h`;
  if (min > 0) return `hace ${min}min`;
  return 'hace un momento';
}

function groupByDate(eventos: Evento[]) {
  const groups: Record<string, Evento[]> = {};
  for (const e of eventos) {
    const key = new Date(e.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

export default function HistorialOcular({ onBack }: Props) {
  const { user } = useUser();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [ejercicios, evaluaciones, campoVisual, contraste, diario, pomodoro] = await Promise.all([
          sql`SELECT created_at, ejercicio_id FROM sesiones_ejercicio WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 100`.catch(() => []),
          sql`SELECT created_at, puntaje, sintoma_dominante FROM respuestas_cuestionario WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 100`.catch(() => []),
          sql`SELECT created_at, tasa_deteccion FROM campo_visual_tests WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50`.catch(() => []),
          sql`SELECT created_at, nivel_final FROM contrast_tests WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50`.catch(() => []),
          sql`SELECT created_at, clasificacion FROM diario_visual WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50`.catch(() => []),
          sql`SELECT created_at, tipo, duracion_min FROM pomodoro_sessions WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50`.catch(() => []),
        ]);

        const evs: Evento[] = [];

        for (const r of ejercicios as any[]) {
          evs.push({
            fecha: r.created_at, tipo: 'ejercicio',
            titulo: `Ejercicio: ${r.ejercicio_id ?? 'Visual'}`,
            subtitulo: timeAgo(r.created_at),
            icon: Activity, color: 'emerald',
          });
        }
        for (const r of evaluaciones as any[]) {
          evs.push({
            fecha: r.created_at, tipo: 'evaluacion',
            titulo: 'Cuestionario completado',
            subtitulo: timeAgo(r.created_at),
            icon: ClipboardList, color: 'blue',
            valor: r.puntaje !== null ? `${Math.round(r.puntaje)}/100` : undefined,
          });
        }
        for (const r of campoVisual as any[]) {
          evs.push({
            fecha: r.created_at, tipo: 'campo_visual',
            titulo: 'Test de Campo Visual',
            subtitulo: timeAgo(r.created_at),
            icon: Crosshair, color: 'indigo',
            valor: r.tasa_deteccion !== null ? `${Math.round(r.tasa_deteccion * 100)}%` : undefined,
          });
        }
        for (const r of contraste as any[]) {
          evs.push({
            fecha: r.created_at, tipo: 'contraste',
            titulo: 'Test de Contraste',
            subtitulo: timeAgo(r.created_at),
            icon: Eye, color: 'violet',
            valor: r.nivel_final !== null ? `Nivel ${r.nivel_final + 1}` : undefined,
          });
        }
        for (const r of diario as any[]) {
          evs.push({
            fecha: r.created_at, tipo: 'diario',
            titulo: 'Entrada de diario',
            subtitulo: timeAgo(r.created_at),
            icon: BookOpen, color: 'amber',
            valor: r.clasificacion ?? undefined,
          });
        }
        for (const r of pomodoro as any[]) {
          evs.push({
            fecha: r.created_at, tipo: 'pomodoro',
            titulo: `Pomodoro ${r.tipo ?? ''}`,
            subtitulo: timeAgo(r.created_at),
            icon: Zap, color: 'orange',
            valor: r.duracion_min ? `${r.duracion_min}min` : undefined,
          });
        }

        evs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        setEventos(evs);
      } catch {}
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const filtrados = filtro === 'todos' ? eventos : eventos.filter(e => e.tipo === filtro);
  const groups = groupByDate(filtrados);

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
    indigo: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
    violet: 'bg-violet-100 text-violet-700 ring-violet-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    orange: 'bg-orange-100 text-orange-700 ring-orange-200',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-slate-900 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <h1 className="text-2xl font-black">Historial Completo</h1>
        <p className="text-gray-400 text-sm mt-1">{eventos.length} eventos registrados</p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0"/>
          {TIPOS_FILTER.map(t => (
            <button key={t} onClick={() => setFiltro(t)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filtro === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {t === 'todos' ? 'Todos' : TYPE_META[t]?.label ?? t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {loading && (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-2xl skeleton"/>)}
          </div>
        )}

        {!loading && filtrados.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-500 font-medium">Sin eventos</p>
            <p className="text-gray-400 text-sm mt-1">Completa ejercicios y tests para ver tu historial</p>
          </div>
        )}

        {!loading && Object.entries(groups).map(([fecha, evs]) => (
          <div key={fecha} className="mb-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 capitalize">{fecha}</p>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-4 bottom-4 w-px bg-gray-200"/>

              <div className="space-y-2">
                {evs.map((ev, i) => {
                  const Icon = ev.icon;
                  const cmap = colorMap[ev.color] ?? 'bg-gray-100 text-gray-600';
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white ${cmap}`}>
                        <Icon className="w-4 h-4"/>
                      </div>
                      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-gray-900 text-sm truncate">{ev.titulo}</p>
                          {ev.valor && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cmap}`}>
                              {ev.valor}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {new Date(ev.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {ev.subtitulo}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
