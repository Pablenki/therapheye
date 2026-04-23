// =========================================
// SISTEMA DE TEMAS VISUALES - Therapheye
// =========================================

export type Theme = 'colorido' | 'profesional' | 'oscuro' | 'naturaleza';

export interface ThemeConfig {
  labelEs: string;
  labelEn: string;
  emoji: string;
  previewColors: [string, string, string, string]; // swatches para el picker
  sidebarColor: string;
  dashBg: string;               // clases Tailwind para el fondo del dashboard
  headerBg: string;             // clases del header
  headerText: string;
  headerSubtext: string;
  sectionLabel: string;         // color del label "Acciones rápidas" etc.
  quickActions: [string, string, string, string];
  racha: string;
  recomendacion: string;
  progreso: string;
  diagnosticos: string;
  timer: string;
}

export const THEMES: Record<Theme, ThemeConfig> = {

  // ── 🌈 Colorido ─────────────────────────────────────────────────────────────
  colorido: {
    labelEs: 'Colorido', labelEn: 'Colorful', emoji: '🌈',
    previewColors: ['#8b5cf6', '#f43f5e', '#14b8a6', '#f59e0b'],
    sidebarColor: '#0e1f47',
    dashBg: 'from-blue-100 via-indigo-50 to-violet-100',
    headerBg: 'bg-white/80 backdrop-blur-md border-b border-blue-200 shadow-md',
    headerText: 'text-gray-800',
    headerSubtext: 'text-gray-400',
    sectionLabel: 'text-gray-700',
    quickActions: [
      'from-violet-500 to-purple-600',
      'from-rose-500 to-pink-600',
      'from-teal-500 to-cyan-600',
      'from-amber-500 to-orange-500',
    ],
    racha:         'from-orange-500 to-amber-600',
    recomendacion: 'from-indigo-500 to-violet-600',
    progreso:      'from-blue-500 to-indigo-600',
    diagnosticos:  'from-violet-500 to-fuchsia-600',
    timer:         'from-teal-500 to-cyan-600',
  },

  // ── 💼 Profesional ──────────────────────────────────────────────────────────
  profesional: {
    labelEs: 'Profesional', labelEn: 'Professional', emoji: '💼',
    previewColors: ['#1e3a5f', '#334155', '#1e40af', '#0f4c75'],
    sidebarColor: '#0f2337',
    dashBg: 'from-slate-100 via-blue-50 to-slate-50',
    headerBg: 'bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-md',
    headerText: 'text-gray-900',
    headerSubtext: 'text-slate-400',
    sectionLabel: 'text-slate-600',
    quickActions: [
      'from-blue-900 to-slate-900',
      'from-slate-700 to-slate-900',
      'from-sky-800 to-blue-950',
      'from-blue-800 to-indigo-950',
    ],
    racha:         'from-blue-900 to-blue-950',
    recomendacion: 'from-indigo-900 to-blue-950',
    progreso:      'from-sky-800 to-blue-900',
    diagnosticos:  'from-slate-700 to-blue-950',
    timer:         'from-blue-800 to-sky-900',
  },

  // ── 🌙 Oscuro ────────────────────────────────────────────────────────────────
  oscuro: {
    labelEs: 'Oscuro', labelEn: 'Dark', emoji: '🌙',
    previewColors: ['#312e81', '#7c3aed', '#1e1b4b', '#4c1d95'],
    sidebarColor: '#0d1117',
    dashBg: 'from-zinc-900 via-gray-900 to-zinc-900',
    headerBg: 'bg-zinc-900/95 border-b border-zinc-700 shadow-lg',
    headerText: 'text-gray-100',
    headerSubtext: 'text-gray-500',
    sectionLabel: 'text-gray-400',
    quickActions: [
      'from-zinc-800 to-violet-950',
      'from-zinc-800 to-rose-950',
      'from-zinc-800 to-teal-950',
      'from-zinc-800 to-amber-950',
    ],
    racha:         'from-zinc-800 to-orange-950',
    recomendacion: 'from-zinc-800 to-indigo-950',
    progreso:      'from-zinc-800 to-blue-950',
    diagnosticos:  'from-zinc-800 to-purple-950',
    timer:         'from-zinc-800 to-teal-950',
  },

  // ── 🌿 Naturaleza ────────────────────────────────────────────────────────────
  naturaleza: {
    labelEs: 'Naturaleza', labelEn: 'Nature', emoji: '🌿',
    previewColors: ['#059669', '#0d9488', '#16a34a', '#84cc16'],
    sidebarColor: '#1a3a2a',
    dashBg: 'from-emerald-100 via-green-50 to-teal-50',
    headerBg: 'bg-white/80 backdrop-blur-md border-b border-emerald-200 shadow-md',
    headerText: 'text-gray-800',
    headerSubtext: 'text-gray-500',
    sectionLabel: 'text-gray-700',
    quickActions: [
      'from-emerald-600 to-green-800',
      'from-teal-500 to-emerald-700',
      'from-cyan-600 to-teal-800',
      'from-lime-600 to-green-700',
    ],
    racha:         'from-amber-600 to-yellow-700',
    recomendacion: 'from-emerald-600 to-teal-700',
    progreso:      'from-teal-600 to-green-700',
    diagnosticos:  'from-emerald-700 to-green-900',
    timer:         'from-teal-500 to-cyan-700',
  },
};

export const DEFAULT_THEME: Theme = 'colorido';
