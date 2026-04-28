// =========================================
// RECORDATORIOS PERSONALIZABLES — Therapheye
// Modal para configurar horas de recordatorio
// Usa Notification API con timers en memoria
// =========================================

import { useState, useEffect, useCallback } from 'react';
import { X, Bell, Plus, Trash2, BellRing } from 'lucide-react';

const STORAGE_KEY = 'therapheye_reminders';

interface Reminder {
  id: string;
  hour: number;
  minute: number;
  label: string;
  enabled: boolean;
}

const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'r1', hour: 10, minute: 0, label: 'Pausa visual matutina', enabled: true },
  { id: 'r2', hour: 14, minute: 0, label: 'Ejercicio de mediodía', enabled: true },
  { id: 'r3', hour: 18, minute: 0, label: 'Descanso de pantalla', enabled: true },
];

function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_REMINDERS;
}

function saveReminders(r: Reminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

function fmtTime(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Schedule notifications using setTimeout
const activeTimers: number[] = [];

export function scheduleReminders() {
  // Clear existing
  activeTimers.forEach(t => clearTimeout(t));
  activeTimers.length = 0;

  if (Notification.permission !== 'granted') return;

  const reminders = loadReminders().filter(r => r.enabled);
  const now = new Date();

  reminders.forEach(r => {
    const target = new Date(now);
    target.setHours(r.hour, r.minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const ms = target.getTime() - now.getTime();
    if (ms > 0 && ms < 24 * 60 * 60 * 1000) {
      const timer = window.setTimeout(() => {
        new Notification('Therapheye', {
          body: r.label,
          icon: '/icons/icon-192x192.png',
          tag: r.id,
        });
        // Re-schedule for next day
        scheduleReminders();
      }, ms);
      activeTimers.push(timer);
    }
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ReminderConfig({ open, onClose }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders);
  const [permStatus, setPermStatus] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  const persist = useCallback((updated: Reminder[]) => {
    setReminders(updated);
    saveReminders(updated);
    scheduleReminders();
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setPermStatus(perm);
    if (perm === 'granted') scheduleReminders();
  };

  const toggleReminder = (id: string) => {
    persist(reminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const removeReminder = (id: string) => {
    persist(reminders.filter(r => r.id !== id));
  };

  const addReminder = () => {
    const newR: Reminder = {
      id: `r_${Date.now()}`,
      hour: 12,
      minute: 0,
      label: 'Recordatorio visual',
      enabled: true,
    };
    persist([...reminders, newR]);
  };

  const updateTime = (id: string, timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    persist(reminders.map(r => r.id === id ? { ...r, hour: h, minute: m } : r));
  };

  const updateLabel = (id: string, label: string) => {
    persist(reminders.map(r => r.id === id ? { ...r, label } : r));
  };

  // Schedule on mount
  useEffect(() => {
    if (permStatus === 'granted') scheduleReminders();
  }, [permStatus]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-800">Recordatorios</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Permission banner */}
        {permStatus !== 'granted' && (
          <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-800 mb-2">Necesitas activar las notificaciones para recibir recordatorios.</p>
            <button
              onClick={requestPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition"
            >
              <BellRing className="w-3.5 h-3.5" /> Activar notificaciones
            </button>
          </div>
        )}

        {/* Reminders list */}
        <div className="px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
          {reminders.map(r => (
            <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${r.enabled ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
              <button onClick={() => toggleReminder(r.id)} className="flex-shrink-0">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${r.enabled ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                  {r.enabled && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={r.label}
                  onChange={e => updateLabel(r.id, e.target.value)}
                  className="w-full text-sm font-semibold text-gray-800 bg-transparent outline-none"
                />
                <input
                  type="time"
                  value={fmtTime(r.hour, r.minute)}
                  onChange={e => updateTime(r.id, e.target.value)}
                  className="text-xs text-indigo-600 font-mono bg-transparent outline-none mt-0.5"
                />
              </div>
              <button onClick={() => removeReminder(r.id)} className="p-1 text-gray-300 hover:text-red-500 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add button */}
        <div className="px-5 pb-4">
          <button
            onClick={addReminder}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition"
          >
            <Plus className="w-4 h-4" /> Agregar recordatorio
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            Los recordatorios funcionan mientras la app esté abierta en el navegador. Para recordatorios persistentes, instala la PWA.
          </p>
        </div>
      </div>
    </div>
  );
}
