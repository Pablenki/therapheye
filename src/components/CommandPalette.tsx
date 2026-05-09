// =========================================
// COMMAND PALETTE — Therapheye
// Búsqueda global Cmd+K / Ctrl+K
// 35+ herramientas accesibles en segundos
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, Home, Activity, Camera, Glasses, History, HeartPulse,
  ScanEye, ClipboardList, BookOpen, ScanFace, BookOpenCheck,
  MessageCircleHeart, MapPin, Gamepad2, Sparkles, BookMarked,
  Crosshair, EarOff, Contrast, Timer, Orbit, BarChart2, ClipboardCheck,
  Palette, FlaskConical, Focus, Microscope, ScrollText, TriangleAlert,
  ImageIcon, BrainCircuit, AreaChart, Crown,
  Wind, Dot, LineChart,
} from 'lucide-react';

type Page = string;

interface NavItem {
  icon: React.ElementType;
  label: string;
  page: Page;
  desc: string;
}

const ALL_ITEMS: NavItem[] = [
  { icon: Home,              label: 'Inicio',             page: 'dashboard',            desc: 'Dashboard principal con tu estado de fatiga' },
  { icon: Activity,          label: 'Ejercicios',         page: 'exercises',            desc: 'Rutinas terapéuticas para reducir fatiga digital' },
  { icon: Camera,            label: 'Captura de imagen',  page: 'image-capture',        desc: 'IA analiza una foto de tu ojo al instante' },
  { icon: Glasses,           label: 'Prueba de visión',   page: 'vision-test',          desc: 'Test de agudeza visual tipo Snellen' },
  { icon: History,           label: 'Historial',          page: 'history',              desc: 'Revisa evaluaciones, ejercicios y tests anteriores' },
  { icon: HeartPulse,        label: 'Salud Visual',       page: 'visual-health',        desc: 'Tiempo en pantalla y hábitos de salud ocular' },
  { icon: ScanEye,           label: 'Diagnóstico',        page: 'diagnostico-completo', desc: 'Suite completa de tests clínicos visuales' },
  { icon: ClipboardList,     label: 'Cuestionario',       page: 'questionnaire',        desc: 'Evalúa síntomas y genera tu rutina personalizada' },
  { icon: BookOpen,          label: 'Aprende',            page: 'learn',                desc: 'Artículos y guías de salud visual' },
  { icon: ScanFace,          label: 'Parpadeo',           page: 'blink-detector',       desc: 'Mide tu frecuencia de parpadeo en tiempo real' },
  { icon: BookOpenCheck,     label: 'Lectura Visual',     page: 'reading-test',         desc: 'Entrenamiento de lectura y seguimiento visual' },
  { icon: MessageCircleHeart,label: 'Chat Visual',        page: 'chat-sintomas',        desc: 'Consulta tus molestias oculares con Claude AI' },
  { icon: MapPin,            label: 'Oftalmólogos',       page: 'mapa-oftalmologos',    desc: 'Encuentra especialistas cercanos en el mapa' },
  { icon: Gamepad2,          label: 'Juegos Visuales',    page: 'juegos-visuales',      desc: 'Entrena tu visión jugando mini-juegos' },
  { icon: Sparkles,          label: 'Rutinas con IA',     page: 'rutinas-ia',           desc: 'Rutinas semanales generadas por inteligencia artificial' },
  { icon: BookMarked,        label: 'Diario Visual',      page: 'diario-visual',        desc: 'Registra tus molestias y mejoras diarias' },
  { icon: Crosshair,         label: 'Campo Visual',       page: 'campo-visual',         desc: 'Mapeo completo de tu campo de visión' },
  { icon: EarOff,            label: 'Modo Zen',           page: 'modo-zen',             desc: 'Relajación y meditación para tus ojos' },
  { icon: Contrast,          label: 'Test Contraste',     page: 'contrast-test',        desc: 'Sensibilidad al contraste luminoso' },
  { icon: Timer,             label: 'Reacción Visual',    page: 'reaccion-visual',      desc: 'Mide tu tiempo de respuesta ocular' },
  { icon: Orbit,             label: 'Vergencia',          page: 'vergencia',            desc: 'Entrenamiento binocular y convergencia' },
  { icon: BarChart2,         label: 'Carga Visual',       page: 'carga-visual',         desc: 'Mide la fatiga visual acumulada en el día' },
  { icon: ClipboardCheck,    label: 'Notas Médicas',      page: 'notas-medicas',        desc: 'Guarda consultas, recetas y seguimientos médicos' },
  { icon: Palette,           label: 'Simulador Visual',   page: 'simulador',            desc: 'Simula condiciones oculares reales' },
  { icon: FlaskConical,      label: 'Test Cromático',     page: 'test-cromatico',       desc: 'Detección de daltonismo y alteraciones del color' },
  { icon: Focus,             label: 'Test Acomodación',   page: 'test-acomodacion',     desc: 'Flexibilidad y rango de enfoque del cristalino' },
  { icon: Microscope,        label: 'Ejerc. Avanzados',   page: 'ejercicios-avanzados', desc: 'Entrenamiento ocular intensivo y progresivo' },
  { icon: ScrollText,        label: 'Historial Ocular',   page: 'historial-ocular',     desc: 'Historial médico ocular completo' },
  { icon: TriangleAlert,     label: 'Analizador Síntomas',page: 'analizador-sintomas',  desc: 'Evaluación inteligente de molestias oculares' },
  { icon: ImageIcon,         label: 'Galería Capturas',   page: 'galeria-captures',     desc: 'Historial de fotos analizadas por IA' },
  { icon: BrainCircuit,      label: 'Entrena. Mental',    page: 'entrenamiento-mental', desc: 'Coordinación ojo-mente y memoria visual' },
  { icon: AreaChart,         label: 'Stats Avanzadas',    page: 'estadisticas-avanzadas',desc:'Gráficas, correlaciones y tendencias de tu salud' },
  { icon: Crown,             label: 'Premium',            page: 'plan-premium',         desc: 'Desbloquea todas las funciones avanzadas' },
  { icon: Dot,               label: 'Dominancia Ocular',  page: 'dominancia-ocular',    desc: 'Determina cuál es tu ojo dominante' },
  { icon: Wind,              label: 'Respiración 4-7-8',  page: 'respiracion-478',      desc: 'Técnica de relajación ocular animada' },
  { icon: LineChart,         label: 'Evolución Tests',    page: 'evolucion-tests',      desc: 'Progresión temporal de tus pruebas clínicas' },
];

function fuzzy(text: string, query: string): boolean {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
}

export default function CommandPalette({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = query
    ? ALL_ITEMS.filter(item => fuzzy(item.label + ' ' + item.desc, query))
    : ALL_ITEMS;

  const go = useCallback((page: Page) => {
    onNavigate(page);
    onClose();
    setQuery('');
  }, [onNavigate, onClose]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && results[selected]) { go(results[selected].page); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selected, go, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[99995] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar herramienta…"
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 transition">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-80">
          {results.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Sin resultados para "{query}"</div>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.page}
                  onClick={() => go(item.page)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                    i === selected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    i === selected ? 'bg-indigo-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-4 h-4 ${i === selected ? 'text-indigo-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${i === selected ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                  </div>
                  {i === selected && (
                    <kbd className="ml-auto text-[10px] text-indigo-400 border border-indigo-200 rounded px-1.5 py-0.5 font-mono flex-shrink-0">↵</kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400">
          <span><kbd className="font-mono border border-gray-200 rounded px-1">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono border border-gray-200 rounded px-1">↵</kbd> abrir</span>
          <span><kbd className="font-mono border border-gray-200 rounded px-1">ESC</kbd> cerrar</span>
          <span className="ml-auto">{results.length} herramientas</span>
        </div>
      </div>
    </div>
  );
}
