// =========================================
// MONITOR DE DISTANCIA EN TIEMPO REAL — Therapheye
// Estima distancia pantalla-usuario via MediaPipe FaceLandmarker
// Widget flotante esquina inferior derecha
// =========================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronUp, X } from 'lucide-react';

declare global {
  interface Window { FaceLandmarker: any; FilesetResolver: any; }
}

// Ancho interpupilar real promedio: 63mm
const IPD_MM = 63;
// Distancia focal estimada del modelo de cámara (empírico)
const FOCAL_PX = 650;

// Estado de distancia
type DistState = 'ok' | 'warn' | 'danger' | 'no-face';

function getDistState(cm: number | null): DistState {
  if (cm === null) return 'no-face';
  if (cm >= 50) return 'ok';
  if (cm >= 35) return 'warn';
  return 'danger';
}

const STATE_CFG = {
  ok:       { color: '#16a34a', bg: 'bg-emerald-500', label: 'OK', textColor: 'text-emerald-700', ringColor: 'ring-emerald-400' },
  warn:     { color: '#d97706', bg: 'bg-amber-500',   label: '¡Acércate menos!', textColor: 'text-amber-700', ringColor: 'ring-amber-400' },
  danger:   { color: '#dc2626', bg: 'bg-red-500',     label: '¡Muy cerca!', textColor: 'text-red-700', ringColor: 'ring-red-400' },
  'no-face':{ color: '#9ca3af', bg: 'bg-gray-400',    label: 'Sin cara detectada', textColor: 'text-gray-500', ringColor: 'ring-gray-300' },
};

interface Props {
  active: boolean;
  onClose: () => void;
}

// Hook para cargar MediaPipe
function useMediaPipeFace(active: boolean, onDistance: (cm: number | null) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current = null; }
    setReady(false);
    onDistance(null);
  }, [onDistance]);

  useEffect(() => {
    if (!active) { stop(); return; }

    let cancelled = false;

    const init = async () => {
      try {
        // Cargar MediaPipe desde CDN si no está ya disponible
        if (!window.FaceLandmarker || !window.FilesetResolver) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm/vision_bundle.js';
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('CDN no disponible'));
            document.head.appendChild(script);
          });
        }

        // Usar la importación de npm
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        videoRef.current = video;

        await video.play();
        if (cancelled) return;
        setReady(true);

        let lastTs = -1;
        const loop = () => {
          if (!landmarkerRef.current || !videoRef.current) return;
          const now = performance.now();
          if (now === lastTs) { animRef.current = requestAnimationFrame(loop); return; }
          lastTs = now;

          try {
            const results = landmarkerRef.current.detectForVideo(videoRef.current, now);
            if (results?.faceLandmarks?.length > 0) {
              const landmarks = results.faceLandmarks[0];
              // Pupils: left eye center ≈ idx 468, right eye center ≈ idx 473
              // Fallback: outer corners: left 33, right 263
              const L = landmarks[468] ?? landmarks[33];
              const R = landmarks[473] ?? landmarks[263];
              if (L && R) {
                const dx = (R.x - L.x) * 320; // pixel width at 320px
                const dy = (R.y - L.y) * 240;
                const ipdPx = Math.sqrt(dx * dx + dy * dy);
                if (ipdPx > 5) {
                  const distCm = Math.round((IPD_MM * FOCAL_PX) / (ipdPx * 10));
                  onDistance(Math.min(distCm, 200));
                } else {
                  onDistance(null);
                }
              } else {
                onDistance(null);
              }
            } else {
              onDistance(null);
            }
          } catch { onDistance(null); }

          animRef.current = requestAnimationFrame(loop);
        };
        animRef.current = requestAnimationFrame(loop);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error de cámara');
      }
    };

    init();
    return () => { cancelled = true; stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { ready, error };
}

export default function DistanceMonitor({ active, onClose }: Props) {
  const [distanceCm, setDistanceCm] = useState<number | null>(null);
  const [minimized, setMinimized] = useState(false);
  const dangerStartRef = useRef<number | null>(null);
  const alertedRef = useRef(false);

  const handleDistance = useCallback((cm: number | null) => {
    setDistanceCm(cm);
  }, []);

  const { ready, error } = useMediaPipeFace(active, handleDistance);

  // Alerta si en rojo > 10 segundos
  useEffect(() => {
    if (!active) return;
    const state = getDistState(distanceCm);
    if (state === 'danger') {
      if (dangerStartRef.current === null) dangerStartRef.current = Date.now();
      const elapsed = Date.now() - dangerStartRef.current;
      if (elapsed >= 10_000 && !alertedRef.current) {
        alertedRef.current = true;
        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
      }
    } else {
      dangerStartRef.current = null;
      alertedRef.current = false;
    }
  }, [distanceCm, active]);

  if (!active) return null;

  const state = getDistState(distanceCm);
  const cfg = STATE_CFG[state];
  const showFace = state !== 'no-face';

  return (
    <div className="fixed bottom-24 right-5 z-[9998] flex flex-col items-end gap-2">
      <div className={`bg-white rounded-2xl shadow-2xl border-2 transition-all overflow-hidden ${cfg.ringColor} ring-2`}
           style={{ minWidth: minimized ? 48 : 180 }}>

        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-2 ${cfg.bg}`}>
          <div className="flex items-center gap-1.5">
            {showFace
              ? <Eye className="w-3.5 h-3.5 text-white" />
              : <EyeOff className="w-3.5 h-3.5 text-white" />}
            {!minimized && (
              <span className="text-white text-xs font-semibold">Distancia</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(v => !v)}
              className="text-white/80 hover:text-white transition"
            >
              {minimized
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white transition ml-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {!minimized && (
          <div className="px-3 py-3 text-center">
            {error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : !ready ? (
              <p className="text-xs text-gray-400">Iniciando cámara...</p>
            ) : (
              <>
                <p className={`text-2xl font-black ${cfg.textColor}`}>
                  {distanceCm !== null ? `${distanceCm} cm` : '—'}
                </p>
                <p className={`text-[10px] font-semibold mt-0.5 ${cfg.textColor}`}>{cfg.label}</p>
                <p className="text-[9px] text-gray-400 mt-1">
                  {distanceCm !== null
                    ? distanceCm >= 50 ? 'Distancia adecuada'
                      : distanceCm >= 35 ? 'Acércate menos a la pantalla'
                      : '¡Aleja la pantalla!'
                    : 'Posiciónate frente a la cámara'}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
