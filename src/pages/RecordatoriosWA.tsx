// =========================================
// RECORDATORIOS POR WHATSAPP — Therapheye
// Genera mensajes de WhatsApp para recordatorios de ejercicios oculares
// =========================================

import { useState, useEffect } from 'react';
import {
  ArrowLeft, MessageCircle, Bell, CheckCircle, Clock,
  Send, Trash2, Plus,
  AlarmClock, Share2, ChevronRight,
} from 'lucide-react';

interface Props { onBack: () => void; }

interface Recordatorio {
  id: string;
  ejercicio: string;
  emoji: string;
  hora: string;
  activo: boolean;
  mensaje: string;
}

const EJERCICIOS_PRESET = [
  {
    id: 'palming',
    ejercicio: 'Palming',
    emoji: '🤲',
    descripcion: 'Relaja tus ojos con las palmas de las manos',
    mensaje: '👁 Recordatorio Therapheye\n\nEs hora de tu ejercicio de *Palming*.\n\n🤲 Cubre tus ojos con las palmas calientes por 2 minutos.\n\n¡Tus ojos te lo agradecerán!',
  },
  {
    id: '20-20-20',
    ejercicio: 'Regla 20-20-20',
    emoji: '⏱',
    descripcion: 'Cada 20 min, mira 6m por 20 segundos',
    mensaje: '👁 Recordatorio Therapheye\n\n⏱ Regla 20-20-20:\n\nAhora mismo mira un objeto a *6 metros de distancia* durante *20 segundos*.\n\n¡Reduce la fatiga visual al instante!',
  },
  {
    id: 'parpadeo',
    ejercicio: 'Ejercicio de parpadeo',
    emoji: '😌',
    descripcion: 'Parpadea conscientemente para hidratar',
    mensaje: '👁 Recordatorio Therapheye\n\n😌 Es hora de *parpadear conscientemente*.\n\nParpadea lentamente 10 veces seguidas.\nMantén cada parpadeo 1 segundo.\n\n¡Hidratas tus ojos de forma natural!',
  },
  {
    id: 'enfoque',
    ejercicio: 'Cambio de enfoque',
    emoji: '🎯',
    descripcion: 'Alterna entre cerca y lejos',
    mensaje: '👁 Recordatorio Therapheye\n\n🎯 Ejercicio de *cambio de enfoque*:\n\n1. Mira tu dedo a 30cm (5 seg)\n2. Mira un objeto lejano (5 seg)\n3. Repite 5 veces\n\n¡Ejercita tus músculos oculares!',
  },
  {
    id: 'rotacion',
    ejercicio: 'Rotación ocular',
    emoji: '🔄',
    descripcion: 'Rota los ojos en círculos suaves',
    mensaje: '👁 Recordatorio Therapheye\n\n🔄 Es hora de la *rotación ocular*:\n\nMueve tus ojos lentamente en círculos:\n• 5 veces en sentido horario\n• 5 veces en sentido antihorario\n\n¡Mejora la movilidad ocular!',
  },
  {
    id: 'hidratacion',
    ejercicio: 'Recordatorio de agua',
    emoji: '💧',
    descripcion: 'Bebe agua para hidratarte',
    mensaje: '👁 Recordatorio Therapheye\n\n💧 *¡Hidratación ocular!*\n\nBebe un vaso de agua ahora.\nLa deshidratación es causa #1 de ojo seco.\n\n¡Cuida tus ojos desde adentro!',
  },
];

const STORAGE_KEY = 'therapheye_recordatorios_wa';

function loadRecordatorios(): Recordatorio[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function saveRecordatorios(recs: Recordatorio[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recs)); } catch {}
}

export default function RecordatoriosWA({ onBack }: Props) {
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>(loadRecordatorios);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [hora, setHora] = useState('09:00');
  const [enviado, setEnviado] = useState<string | null>(null);

  useEffect(() => {
    saveRecordatorios(recordatorios);
  }, [recordatorios]);

  const agregarRecordatorio = () => {
    const preset = EJERCICIOS_PRESET.find(p => p.id === selectedPreset);
    if (!preset || !hora) return;

    const nuevo: Recordatorio = {
      id: `${preset.id}-${Date.now()}`,
      ejercicio: preset.ejercicio,
      emoji: preset.emoji,
      hora,
      activo: true,
      mensaje: preset.mensaje,
    };

    setRecordatorios(prev => [...prev, nuevo]);
    setShowAdd(false);
    setSelectedPreset(null);
    setHora('09:00');
  };

  const toggleActivo = (id: string) => {
    setRecordatorios(prev => prev.map(r => r.id === id ? { ...r, activo: !r.activo } : r));
  };

  const eliminar = (id: string) => {
    setRecordatorios(prev => prev.filter(r => r.id !== id));
  };

  const enviarWA = (rec: Recordatorio) => {
    const msg = encodeURIComponent(rec.mensaje);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
    setEnviado(rec.id);
    setTimeout(() => setEnviado(null), 3000);
  };

  const enviarResumenDiario = () => {
    const activos = recordatorios.filter(r => r.activo);
    const lista = activos.map(r => `  ${r.emoji} ${r.ejercicio} — ${r.hora}`).join('\n');
    const msg = encodeURIComponent(
      `👁 Therapheye — Mis ejercicios de hoy\n\n${lista || 'Sin ejercicios programados'}\n\n¡Cuidando mi salud visual un día a la vez!`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-sm">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-800 text-base leading-tight">Recordatorios WhatsApp</h1>
            <p className="text-xs text-gray-500">Mensajes pre-escritos para tus ejercicios</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 transition shadow-sm"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* How it works */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-green-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-base mb-1">Sin apps extra, sin configuración</p>
              <p className="text-green-100 text-sm leading-relaxed">
                Crea recordatorios y envíalos directamente por WhatsApp — a ti mismo, a tu médico, o a un familiar que te recuerde hacer los ejercicios.
              </p>
            </div>
          </div>
        </div>

        {/* Resumen diario */}
        <button
          onClick={enviarResumenDiario}
          className="w-full flex items-center gap-3 bg-white border border-green-200 rounded-2xl p-4 hover:bg-green-50 transition group shadow-sm"
        >
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition">
            <Share2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold text-gray-800 text-sm">Compartir mi rutina de hoy</p>
            <p className="text-xs text-gray-500">Manda todos tus ejercicios activos por WhatsApp</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition" />
        </button>

        {/* Lista de recordatorios */}
        {recordatorios.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-green-400" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">Sin recordatorios aún</p>
            <p className="text-sm text-gray-400 mb-4">Crea tu primer recordatorio de ejercicio ocular</p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> Crear recordatorio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
              Mis recordatorios ({recordatorios.length})
            </p>
            {recordatorios.map(rec => (
              <div
                key={rec.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${rec.activo ? 'border-green-200' : 'border-gray-200 opacity-60'}`}
              >
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => toggleActivo(rec.id)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl transition ${rec.activo ? 'bg-green-100 hover:bg-green-200' : 'bg-gray-100 hover:bg-gray-200'}`}
                  >
                    {rec.emoji}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{rec.ejercicio}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <AlarmClock className="w-3 h-3" /> {rec.hora}
                      {rec.activo
                        ? <span className="ml-1 text-green-500 font-medium">· Activo</span>
                        : <span className="ml-1 text-gray-400">· Pausado</span>
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => enviarWA(rec)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        enviado === rec.id
                          ? 'bg-green-100 text-green-700'
                          : 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
                      }`}
                    >
                      {enviado === rec.id
                        ? <><CheckCircle className="w-3.5 h-3.5" /> ¡Enviado!</>
                        : <><Send className="w-3.5 h-3.5" /> Enviar</>
                      }
                    </button>
                    <button
                      onClick={() => eliminar(rec.id)}
                      className="w-7 h-7 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick send presets */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-3">
            Envío rápido — sin guardar
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {EJERCICIOS_PRESET.map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  const msg = encodeURIComponent(preset.mensaje);
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}
                className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl p-3 hover:border-green-200 hover:bg-green-50 transition text-left shadow-sm group"
              >
                <span className="text-xl flex-shrink-0">{preset.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{preset.ejercicio}</p>
                  <p className="text-[10px] text-gray-400 truncate">{preset.descripcion}</p>
                </div>
                <MessageCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal agregar recordatorio */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <Bell className="w-5 h-5 text-green-500" /> Nuevo recordatorio
              </h2>
            </div>

            <div className="p-5 space-y-4">
              {/* Ejercicio */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Ejercicio</label>
                <div className="space-y-2">
                  {EJERCICIOS_PRESET.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPreset(p.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${
                        selectedPreset === p.id
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-200 hover:border-green-200 hover:bg-green-50/50'
                      }`}
                    >
                      <span className="text-lg">{p.emoji}</span>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-gray-800">{p.ejercicio}</p>
                        <p className="text-xs text-gray-500">{p.descripcion}</p>
                      </div>
                      {selectedPreset === p.id && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hora */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Hora del recordatorio
                </label>
                <input
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>

            <div className="flex gap-2.5 p-5 border-t border-gray-100">
              <button
                onClick={() => { setShowAdd(false); setSelectedPreset(null); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={agregarRecordatorio}
                disabled={!selectedPreset || !hora}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-green-600 transition shadow-sm"
              >
                Crear recordatorio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
