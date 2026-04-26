// =========================================
// DETECTOR DE CONDICIONES AMBIENTALES — Therapheye
// Usa cámara para calcular brillo promedio del ambiente
// Badge pequeño en el header del Dashboard
// =========================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sun, SunDim, AlertTriangle, X } from 'lucide-react';

type LightState = 'optima' | 'oscura' | 'excesiva' | 'sin-camara';

interface LightInfo {
  state: LightState;
  brillo: number;       // 0–255
  hasDirectLight: boolean;
}

const UPDATE_INTERVAL_MS = 30_000; // 30 segundos

function analyzeFrame(video: HTMLVideoElement): LightInfo {
  const canvas = document.createElement('canvas');
  canvas.width = 80; canvas.height = 60; // pequeño para rendimiento
  const ctx = canvas.getContext('2d');
  if (!ctx) return { state: 'sin-camara', brillo: 0, hasDirectLight: false };

  ctx.drawImage(video, 0, 0, 80, 60);
  const { data } = ctx.getImageData(0, 0, 80, 60);

  let totalBrillo = 0;
  let pixelCount = 0;
  let centerBrightPixels = 0;

  // Centro del frame (zona 30x20 en el centro)
  const cx1 = 25, cx2 = 55, cy1 = 20, cy2 = 40;

  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 80; x++) {
      const i = (y * 80 + x) * 4;
      const brightnessPixel = (data[i] + data[i + 1] + data[i + 2]) / 3;
      totalBrillo += brightnessPixel;
      pixelCount++;
      if (x >= cx1 && x <= cx2 && y >= cy1 && y <= cy2) {
        if (brightnessPixel > 240) centerBrightPixels++;
      }
    }
  }

  const avgBrillo = totalBrillo / pixelCount;
  const centerArea = (cx2 - cx1) * (cy2 - cy1);
  const hasDirectLight = (centerBrightPixels / centerArea) > 0.15;

  let state: LightState;
  if (avgBrillo < 60) state = 'oscura';
  else if (avgBrillo > 180 || hasDirectLight) state = 'excesiva';
  else state = 'optima';

  return { state, brillo: Math.round(avgBrillo), hasDirectLight };
}

const STATE_CONFIG = {
  optima: {
    label: 'Iluminación óptima',
    icon: Sun,
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    tooltip: 'La iluminación de tu entorno es adecuada para el trabajo con pantalla.',
    consejos: ['Mantén la pantalla a nivel de los ojos', 'Aplica la regla 20-20-20'],
  },
  oscura: {
    label: 'Ambiente muy oscuro',
    icon: SunDim,
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    tooltip: 'Poca luz puede causar fatiga visual y dolores de cabeza.',
    consejos: ['Enciende una lámpara lateral', 'Reduce el brillo de la pantalla', 'Evita trabajar en la oscuridad'],
  },
  excesiva: {
    label: 'Luz excesiva o directa',
    icon: AlertTriangle,
    dot: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    tooltip: 'Hay demasiada luz o una fuente directa que puede causar deslumbramiento.',
    consejos: ['Cierra persianas o cortinas', 'Usa un filtro anti-reflejos', 'Reposiciona tu pantalla'],
  },
  'sin-camara': {
    label: 'Cámara no disponible',
    icon: AlertTriangle,
    dot: 'bg-gray-400',
    text: 'text-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    tooltip: 'No se pudo acceder a la cámara para medir la iluminación.',
    consejos: [],
  },
};

export default function AmbientLightDetector() {
  const [lightInfo, setLightInfo] = useState<LightInfo | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const measure = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    const info = analyzeFrame(videoRef.current);
    setLightInfo(info);
  }, []);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 80, height: 60 } });
      streamRef.current = stream;
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      videoRef.current = video;
      video.addEventListener('loadeddata', () => {
        video.play().then(() => {
          measure();
          timerRef.current = setInterval(measure, UPDATE_INTERVAL_MS);
        }).catch(() => setLightInfo({ state: 'sin-camara', brillo: 0, hasDirectLight: false }));
      });
    } catch {
      setLightInfo({ state: 'sin-camara', brillo: 0, hasDirectLight: false });
    }
  }, [measure]);

  useEffect(() => {
    initCamera();
    return () => stopCamera();
  }, [initCamera, stopCamera]);

  // Cerrar tooltip al click fuera
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setShowTooltip(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (dismissed || !lightInfo) return null;

  const cfg = STATE_CONFIG[lightInfo.state];
  const Icon = cfg.icon;

  return (
    <div className="relative" ref={tooltipRef}>
      {/* Badge */}
      <button
        onClick={() => setShowTooltip(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition hover:shadow-sm ${cfg.bg} ${cfg.border} ${cfg.text}`}
        title="Condiciones de iluminación"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="hidden sm:inline">{cfg.label}</span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</p>
            <button onClick={() => setDismissed(true)} className="text-gray-300 hover:text-gray-500 transition">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-3 leading-relaxed">{cfg.tooltip}</p>
          {cfg.consejos.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Consejos:</p>
              <ul className="space-y-1">
                {cfg.consejos.map((c, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-indigo-400 mt-0.5">•</span> {c}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-[10px] text-gray-400 mt-3 border-t border-gray-100 pt-2">
            Brillo promedio: {lightInfo.brillo}/255 · Actualiza cada 30s
          </p>
        </div>
      )}
    </div>
  );
}
