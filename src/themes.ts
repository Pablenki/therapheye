// =========================================
// SISTEMA DE TEMAS VISUALES — Therapheye
// =========================================

export type Theme = 'limpio' | 'colorido' | 'cristal' | 'oscuro' | 'naturaleza';

// Estilo estructural de las cards (no solo color)
export type CardVariant = 'flat' | 'gradient' | 'glass' | 'dark';

export interface QuickActionIcon {
  iconBg: string;   // bg del contenedor del ícono
  iconColor: string; // color del ícono
}

export interface ThemeConfig {
  labelEs: string;
  labelEn: string;
  emoji: string;
  previewColors: [string, string, string, string];

  // ── Estilo estructural ───────────────────────────────────────────────────────
  cardVariant: CardVariant;
  cardText: string;         // color del texto principal dentro de las cards
  cardSubtext: string;      // color del texto secundario
  cardBtnBg: string;        // bg del botón "Ir ahora" dentro de las cards
  cardBtnText: string;      // color del texto del botón

  // ── Layout global ────────────────────────────────────────────────────────────
  sidebarColor: string;
  dashBg: string;
  headerBg: string;
  headerText: string;
  headerSubtext: string;
  sectionLabel: string;

  // ── Cards con gradiente (variant: gradient | dark) ───────────────────────────
  quickActionGrads: [string, string, string, string];
  racha: string;
  recomendacion: string;
  progreso: string;
  diagnosticos: string;
  timer: string;

  // ── Cards planas (variant: flat) — borde izquierdo de color ──────────────────
  flatBorders: {
    qa: [string, string, string, string];
    racha: string;
    rec: string;
    prog: string;
    diag: string;
    timer: string;
  };

  // ── Íconos en quick-actions (cambian entre flat/gradient/glass) ───────────────
  qaIcons: [QuickActionIcon, QuickActionIcon, QuickActionIcon, QuickActionIcon];
}

// ─────────────────────────────────────────────────────────────────────────────
export const THEMES: Record<Theme, ThemeConfig> = {

  // ══════════════════════════════════════════════════════════════════════════
  // 🤍 LIMPIO — Cards blancas, bordes de color, look médico/profesional
  // ══════════════════════════════════════════════════════════════════════════
  limpio: {
    labelEs: 'Limpio', labelEn: 'Clean', emoji: '🤍',
    previewColors: ['#6366f1', '#f43f5e', '#0d9488', '#f59e0b'],
    cardVariant: 'flat',
    cardText: 'text-gray-800',
    cardSubtext: 'text-gray-500',
    cardBtnBg: 'bg-indigo-50 hover:bg-indigo-100',
    cardBtnText: 'text-indigo-700',
    sidebarColor: '#1e3a5f',
    dashBg: 'from-slate-50 via-white to-blue-50',
    headerBg: 'bg-white border-b border-gray-200 shadow-sm',
    headerText: 'text-gray-900',
    headerSubtext: 'text-gray-400',
    sectionLabel: 'text-gray-600',
    // Gradients (no usados en flat, pero requeridos por el tipo)
    quickActionGrads: ['from-indigo-500 to-violet-600', 'from-rose-500 to-pink-600', 'from-teal-500 to-cyan-600', 'from-amber-500 to-orange-500'],
    racha: 'from-orange-400 to-amber-500',
    recomendacion: 'from-indigo-500 to-violet-600',
    progreso: 'from-blue-500 to-indigo-600',
    diagnosticos: 'from-violet-500 to-fuchsia-600',
    timer: 'from-teal-500 to-cyan-600',
    // Flat borders
    flatBorders: {
      qa:    ['border-l-4 border-violet-500', 'border-l-4 border-rose-500', 'border-l-4 border-teal-500', 'border-l-4 border-amber-500'],
      racha: 'border-l-4 border-orange-400',
      rec:   'border-l-4 border-indigo-500',
      prog:  'border-l-4 border-blue-500',
      diag:  'border-l-4 border-violet-500',
      timer: 'border-l-4 border-teal-500',
    },
    qaIcons: [
      { iconBg: 'bg-violet-100', iconColor: 'text-violet-600' },
      { iconBg: 'bg-rose-100',   iconColor: 'text-rose-600'   },
      { iconBg: 'bg-teal-100',   iconColor: 'text-teal-600'   },
      { iconBg: 'bg-amber-100',  iconColor: 'text-amber-600'  },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 🌈 COLORIDO — Gradientes rainbow, vibrante (default)
  // ══════════════════════════════════════════════════════════════════════════
  colorido: {
    labelEs: 'Colorido', labelEn: 'Colorful', emoji: '🌈',
    previewColors: ['#8b5cf6', '#f43f5e', '#14b8a6', '#f59e0b'],
    cardVariant: 'gradient',
    cardText: 'text-white',
    cardSubtext: 'text-white/70',
    cardBtnBg: 'bg-white/20 hover:bg-white/30',
    cardBtnText: 'text-white',
    sidebarColor: '#0e1f47',
    dashBg: 'from-blue-100 via-indigo-50 to-violet-100',
    headerBg: 'bg-white/80 backdrop-blur-md border-b border-blue-200 shadow-md',
    headerText: 'text-gray-800',
    headerSubtext: 'text-gray-400',
    sectionLabel: 'text-gray-700',
    quickActionGrads: ['from-violet-500 to-purple-600', 'from-rose-500 to-pink-600', 'from-teal-500 to-cyan-600', 'from-amber-500 to-orange-500'],
    racha: 'from-orange-500 to-amber-600',
    recomendacion: 'from-indigo-500 to-violet-600',
    progreso: 'from-blue-500 to-indigo-600',
    diagnosticos: 'from-violet-500 to-fuchsia-600',
    timer: 'from-teal-500 to-cyan-600',
    flatBorders: { qa: ['','','',''], racha: '', rec: '', prog: '', diag: '', timer: '' },
    qaIcons: [
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 💎 CRISTAL — Glassmorphism sobre fondo violeta/índigo vibrante
  // ══════════════════════════════════════════════════════════════════════════
  cristal: {
    labelEs: 'Cristal', labelEn: 'Crystal', emoji: '💎',
    previewColors: ['#7c3aed', '#4f46e5', '#a855f7', '#6366f1'],
    cardVariant: 'glass',
    cardText: 'text-white',
    cardSubtext: 'text-white/70',
    cardBtnBg: 'bg-white/20 hover:bg-white/30',
    cardBtnText: 'text-white',
    sidebarColor: '#2d1b69',
    dashBg: 'from-violet-700 via-indigo-700 to-purple-800',
    headerBg: 'bg-white/10 backdrop-blur-md border-b border-white/20 shadow-lg',
    headerText: 'text-white',
    headerSubtext: 'text-white/60',
    sectionLabel: 'text-white/80',
    quickActionGrads: ['from-violet-400/30 to-purple-500/30', 'from-rose-400/30 to-pink-500/30', 'from-teal-400/30 to-cyan-500/30', 'from-amber-400/30 to-orange-500/30'],
    racha: 'from-orange-400/30 to-amber-500/30',
    recomendacion: 'from-indigo-400/30 to-violet-500/30',
    progreso: 'from-blue-400/30 to-indigo-500/30',
    diagnosticos: 'from-purple-400/30 to-fuchsia-500/30',
    timer: 'from-teal-400/30 to-cyan-500/30',
    flatBorders: { qa: ['','','',''], racha: '', rec: '', prog: '', diag: '', timer: '' },
    qaIcons: [
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 🌙 OSCURO — Dark native, tonos zinc/slate con destellos de color
  // ══════════════════════════════════════════════════════════════════════════
  oscuro: {
    labelEs: 'Oscuro', labelEn: 'Dark', emoji: '🌙',
    previewColors: ['#1e1b4b', '#312e81', '#4c1d95', '#1f2937'],
    cardVariant: 'dark',
    cardText: 'text-gray-100',
    cardSubtext: 'text-gray-400',
    cardBtnBg: 'bg-white/10 hover:bg-white/20',
    cardBtnText: 'text-gray-200',
    sidebarColor: '#0d1117',
    dashBg: 'from-zinc-950 via-gray-900 to-zinc-950',
    headerBg: 'bg-zinc-900/95 border-b border-zinc-800 shadow-lg',
    headerText: 'text-gray-100',
    headerSubtext: 'text-gray-500',
    sectionLabel: 'text-gray-400',
    quickActionGrads: ['from-zinc-800 to-violet-950', 'from-zinc-800 to-rose-950', 'from-zinc-800 to-teal-950', 'from-zinc-800 to-amber-950'],
    racha: 'from-zinc-800 to-orange-950',
    recomendacion: 'from-zinc-800 to-indigo-950',
    progreso: 'from-zinc-800 to-blue-950',
    diagnosticos: 'from-zinc-800 to-purple-950',
    timer: 'from-zinc-800 to-teal-950',
    flatBorders: { qa: ['','','',''], racha: '', rec: '', prog: '', diag: '', timer: '' },
    qaIcons: [
      { iconBg: 'bg-violet-500/20', iconColor: 'text-violet-400' },
      { iconBg: 'bg-rose-500/20',   iconColor: 'text-rose-400'   },
      { iconBg: 'bg-teal-500/20',   iconColor: 'text-teal-400'   },
      { iconBg: 'bg-amber-500/20',  iconColor: 'text-amber-400'  },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 🌿 NATURALEZA — Verdes, esmeraldas y tierra
  // ══════════════════════════════════════════════════════════════════════════
  naturaleza: {
    labelEs: 'Naturaleza', labelEn: 'Nature', emoji: '🌿',
    previewColors: ['#059669', '#0d9488', '#16a34a', '#84cc16'],
    cardVariant: 'gradient',
    cardText: 'text-white',
    cardSubtext: 'text-white/70',
    cardBtnBg: 'bg-white/20 hover:bg-white/30',
    cardBtnText: 'text-white',
    sidebarColor: '#1a3a2a',
    dashBg: 'from-emerald-100 via-green-50 to-teal-50',
    headerBg: 'bg-white/80 backdrop-blur-md border-b border-emerald-200 shadow-md',
    headerText: 'text-gray-800',
    headerSubtext: 'text-gray-500',
    sectionLabel: 'text-gray-700',
    quickActionGrads: ['from-emerald-600 to-green-800', 'from-teal-500 to-emerald-700', 'from-cyan-600 to-teal-800', 'from-lime-600 to-green-700'],
    racha: 'from-amber-600 to-yellow-700',
    recomendacion: 'from-emerald-600 to-teal-700',
    progreso: 'from-teal-600 to-green-700',
    diagnosticos: 'from-emerald-700 to-green-900',
    timer: 'from-teal-500 to-cyan-700',
    flatBorders: { qa: ['','','',''], racha: '', rec: '', prog: '', diag: '', timer: '' },
    qaIcons: [
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
      { iconBg: 'bg-white/20', iconColor: 'text-white' },
    ],
  },
};

export const DEFAULT_THEME: Theme = 'colorido';
