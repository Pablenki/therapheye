// =========================================
// NOTAS MÉDICAS — Therapheye
// El usuario escribe notas sobre su condición,
// diagnósticos, medicamentos, próximas citas
// Claude las organiza automáticamente
// =========================================

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Pill, Calendar, FileText, Stethoscope } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

interface Nota {
  id: number;
  tipo: 'diagnostico' | 'medicamento' | 'cita' | 'observacion';
  titulo: string;
  contenido: string;
  fecha: string;
  created_at: string;
}

const TIPOS: { key: Nota['tipo']; label: string; color: string; icon: React.ElementType }[] = [
  { key: 'diagnostico',  label: 'Diagnóstico',    color: 'red',    icon: Stethoscope },
  { key: 'medicamento',  label: 'Medicamento',     color: 'blue',   icon: Pill },
  { key: 'cita',         label: 'Próxima cita',    color: 'violet', icon: Calendar },
  { key: 'observacion',  label: 'Observación',     color: 'amber',  icon: FileText },
];

const COLOR_MAP: Record<string, string> = {
  red:    'bg-red-50 border-red-200 text-red-700',
  blue:   'bg-blue-50 border-blue-200 text-blue-700',
  violet: 'bg-violet-50 border-violet-200 text-violet-700',
  amber:  'bg-amber-50 border-amber-200 text-amber-700',
};
const BADGE_MAP: Record<string, string> = {
  red:    'bg-red-100 text-red-700',
  blue:   'bg-blue-100 text-blue-700',
  violet: 'bg-violet-100 text-violet-700',
  amber:  'bg-amber-100 text-amber-700',
};

export default function NotasMedicas({ onBack }: Props) {
  const { user } = useUser();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterTipo, setFilterTipo] = useState<Nota['tipo'] | 'todas'>('todas');

  // Form state
  const [tipo, setTipo] = useState<Nota['tipo']>('observacion');
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const initDB = async () => {
    if (!user?.id) return;
    await sql`CREATE TABLE IF NOT EXISTS notas_medicas (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      fecha TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  };

  const loadNotas = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await initDB();
      const rows = await sql`
        SELECT * FROM notas_medicas WHERE user_id = ${user.id}
        ORDER BY fecha DESC, created_at DESC
      `;
      setNotas((rows as unknown) as Nota[]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadNotas(); }, [user?.id]);

  const guardar = async () => {
    if (!user?.id || !titulo.trim() || !contenido.trim()) return;
    setSaving(true);
    try {
      await sql`INSERT INTO notas_medicas (user_id, tipo, titulo, contenido, fecha, created_at)
                VALUES (${user.id}, ${tipo}, ${titulo.trim()}, ${contenido.trim()}, ${fecha}, NOW())`;
      await loadNotas();
      setShowForm(false);
      setTitulo(''); setContenido(''); setTipo('observacion');
      setFecha(new Date().toISOString().slice(0, 10));
    } catch {}
    setSaving(false);
  };

  const eliminar = async (id: number) => {
    try {
      await sql`DELETE FROM notas_medicas WHERE id = ${id} AND user_id = ${user!.id}`;
      setNotas(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const filtradas = filterTipo === 'todas' ? notas : notas.filter(n => n.tipo === filterTipo);

  const tipoMeta = (t: Nota['tipo']) => TIPOS.find(x => x.key === t)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-indigo-900 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Notas Médicas</h1>
            <p className="text-indigo-200 text-sm mt-0.5">Diagnósticos, medicamentos y citas</p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
          >
            <Plus className="w-5 h-5 text-white"/>
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mx-4 -mt-3 bg-white rounded-2xl shadow-lg border border-gray-100 p-5 animate-[slideUp_0.3s_ease]">
          <h2 className="font-bold text-gray-900 mb-4">Nueva nota</h2>

          {/* Tipo selector */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {TIPOS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTipo(t.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                    tipo === t.key ? COLOR_MAP[t.color] + ' border-2' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0"/> {t.label}
                </button>
              );
            })}
          </div>

          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Título (ej. Miopía -2.5D OD)"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
          />

          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            placeholder="Detalles..."
            rows={3}
            value={contenido}
            onChange={e => setContenido(e.target.value)}
          />

          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-gray-500">Fecha:</label>
            <input
              type="date"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={saving || !titulo.trim() || !contenido.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar nota'}
            </button>
          </div>
        </div>
      )}

      <div className="p-4 max-w-lg mx-auto">
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          <button
            onClick={() => setFilterTipo('todas')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filterTipo === 'todas' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            Todas ({notas.length})
          </button>
          {TIPOS.map(t => (
            <button
              key={t.key}
              onClick={() => setFilterTipo(t.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filterTipo === t.key ? BADGE_MAP[t.color] : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {t.label} ({notas.filter(n => n.tipo === t.key).length})
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl skeleton"/>)}
          </div>
        )}

        {!loading && filtradas.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 font-medium">Sin notas aún</p>
            <p className="text-gray-400 text-sm mt-1">Toca <strong>+</strong> para agregar tu primera nota</p>
          </div>
        )}

        <div className="space-y-3">
          {filtradas.map(nota => {
            const meta = tipoMeta(nota.tipo);
            const Icon = meta.icon;
            const isExpanded = expandedId === nota.id;
            return (
              <div key={nota.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : nota.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${BADGE_MAP[meta.color]}`}>
                    <Icon className="w-4 h-4"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{nota.titulo}</p>
                    <p className="text-gray-400 text-xs">{nota.fecha} · {meta.label}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0"/> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0"/>}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 animate-[fadeInUp_0.2s_ease]">
                    <div className={`rounded-xl p-3 text-sm leading-relaxed mb-3 border ${COLOR_MAP[meta.color]}`}>
                      {nota.contenido}
                    </div>
                    <button
                      onClick={() => eliminar(nota.id)}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5"/> Eliminar nota
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!loading && notas.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Puedes exportar estas notas desde Perfil → Exportar datos
          </p>
        )}
      </div>
    </div>
  );
}
