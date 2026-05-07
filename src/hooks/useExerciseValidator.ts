// =========================================
// Hook: useExerciseValidator
// Valida ejercicios oculares con MediaPipe FaceLandmarker
// =========================================

import { useRef, useState, useCallback, useEffect } from 'react';

export interface ValidatorState {
  active: boolean;
  loading: boolean;
  error: string | null;
  faceDetected: boolean;
  distanceCm: number | null;
  distanceStatus: 'too_close' | 'ideal' | 'too_far' | null;
  eyesCovered: boolean;     // palming: ojos cubiertos con palmas
  eyesCoveredPct: number;   // 0-100, nivel de cobertura suavizado
  irisMoving: boolean;      // circles: iris en movimiento circular
  headStable: boolean;      // circles: cabeza quieta
  blinkScore: number;       // raw avg blink (0-1)
}

// Constante de distancia basada en IPD promedio adulto ~63mm y FOV ~70°
// distance_cm = FOCAL_CONST / normalized_IPD
const FOCAL_CONST = 5.0;

const EYES_COVERED_THRESHOLD = 0.72;  // avg blink score para considerar ojos cubiertos
const IRIS_MOVE_THRESHOLD = 0.016;    // rango de movimiento de iris (coords normalizadas)
const HEAD_STABLE_THRESHOLD = 0.013;  // rango de movimiento de nariz para "cabeza quieta"

const IRIS_HIST_SIZE = 90;   // ventana de frames para detectar movimiento de iris (~3s a 30fps)
const NOSE_HIST_SIZE = 30;   // ventana de frames para estabilidad de cabeza (~1s a 30fps)
const BLINK_HIST_SIZE = 10;  // ventana de suavizado para cobertura de ojos

export function useExerciseValidator() {
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef   = useRef<number>(0);

  // Historial para cálculos de ventana deslizante
  const irisHistRef  = useRef<Array<{ lx: number; ly: number; rx: number; ry: number }>>([]);
  const noseHistRef  = useRef<Array<{ x: number; y: number }>>([]);
  const blinkHistRef = useRef<number[]>([]);

  const [state, setState] = useState<ValidatorState>({
    active: false,
    loading: false,
    error: null,
    faceDetected: false,
    distanceCm: null,
    distanceStatus: null,
    eyesCovered: false,
    eyesCoveredPct: 0,
    irisMoving: false,
    headStable: true,
    blinkScore: 0,
  });

  const stop = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (landmarkerRef.current) {
      try { landmarkerRef.current.close(); } catch { /* noop */ }
      landmarkerRef.current = null;
    }
    irisHistRef.current = [];
    noseHistRef.current = [];
    blinkHistRef.current = [];
    setState({
      active: false, loading: false, error: null, faceDetected: false,
      distanceCm: null, distanceStatus: null,
      eyesCovered: false, eyesCoveredPct: 0,
      irisMoving: false, headStable: true, blinkScore: 0,
    });
  }, []);

  const start = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      // 1. Cámara
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>(res => {
          videoRef.current!.onloadeddata = () => res();
        });
        videoRef.current.play();
      }

      // 2. MediaPipe FaceLandmarker (mismo modelo que BlinkDetector)
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const resolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      const landmarker = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      landmarkerRef.current = landmarker;
      setState(s => ({ ...s, active: true, loading: false }));

      // 3. Loop de detección
      let lastVideoTime = -1;
      const loop = () => {
        const video = videoRef.current;
        if (!video || !landmarkerRef.current) return;

        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const results = landmarkerRef.current.detectForVideo(video, performance.now());
          const landmarks = results?.faceLandmarks?.[0] ?? null;
          const shapes   = results?.faceBlendshapes?.[0]?.categories ?? [];

          if (!landmarks || landmarks.length === 0) {
            setState(s => ({ ...s, active: true, faceDetected: false }));
          } else {
            // ── Blink blendshapes ──────────────────────────────────────────
            const blinkL = shapes.find((c: any) => c.categoryName === 'eyeBlinkLeft')?.score  ?? 0;
            const blinkR = shapes.find((c: any) => c.categoryName === 'eyeBlinkRight')?.score ?? 0;
            const avgBlink = (blinkL + blinkR) / 2;

            blinkHistRef.current.push(avgBlink);
            if (blinkHistRef.current.length > BLINK_HIST_SIZE) blinkHistRef.current.shift();
            const smoothedBlink = blinkHistRef.current.reduce((a, b) => a + b, 0) / blinkHistRef.current.length;
            const eyesCovered = smoothedBlink > EYES_COVERED_THRESHOLD;

            // ── Distancia via distancia interpupilar (landmarks 33 y 263) ──
            const lm33  = landmarks[33];   // esquina exterior ojo derecho (vista usuario: izquierdo)
            const lm263 = landmarks[263];  // esquina exterior ojo izquierdo (vista usuario: derecho)
            const normalizedIPD = Math.abs(lm33.x - lm263.x);
            const rawDist = normalizedIPD > 0.002 ? FOCAL_CONST / normalizedIPD : null;
            const distanceCm = rawDist !== null ? Math.min(200, Math.max(10, Math.round(rawDist))) : null;
            const distanceStatus = distanceCm === null ? null
              : distanceCm < 30 ? 'too_close'
              : distanceCm > 80 ? 'too_far'
              : 'ideal';

            // ── Estabilidad de cabeza (nariz, landmark 1) ─────────────────
            const nose = landmarks[1];
            noseHistRef.current.push({ x: nose.x, y: nose.y });
            if (noseHistRef.current.length > NOSE_HIST_SIZE) noseHistRef.current.shift();
            const noseXArr = noseHistRef.current.map(p => p.x);
            const noseXRange = noseHistRef.current.length > 5
              ? Math.max(...noseXArr) - Math.min(...noseXArr)
              : 0;
            const headStable = noseXRange < HEAD_STABLE_THRESHOLD;

            // ── Movimiento de iris (landmarks 468=iris izq, 473=iris der) ──
            // Posición relativa al ojo (elimina movimiento de cabeza)
            let irisMoving = false;
            if (landmarks.length >= 478) {
              const irisL = landmarks[468];
              const irisR = landmarks[473];
              // Iris relativo a esquina del ojo para cancelar movimiento de cabeza
              const lRelX = irisL.x - lm33.x;
              const lRelY = irisL.y - lm33.y;
              const rRelX = irisR.x - lm263.x;
              const rRelY = irisR.y - lm263.y;
              irisHistRef.current.push({ lx: lRelX, ly: lRelY, rx: rRelX, ry: rRelY });
              if (irisHistRef.current.length > IRIS_HIST_SIZE) irisHistRef.current.shift();
              if (irisHistRef.current.length >= 20) {
                const lxArr = irisHistRef.current.map(p => p.lx);
                const lyArr = irisHistRef.current.map(p => p.ly);
                const lxRange = Math.max(...lxArr) - Math.min(...lxArr);
                const lyRange = Math.max(...lyArr) - Math.min(...lyArr);
                irisMoving = lxRange > IRIS_MOVE_THRESHOLD || lyRange > IRIS_MOVE_THRESHOLD;
              }
            }

            setState({
              active: true, loading: false, error: null, faceDetected: true,
              distanceCm, distanceStatus,
              eyesCovered,
              eyesCoveredPct: Math.round(smoothedBlink * 100),
              irisMoving, headStable,
              blinkScore: avgBlink,
            });
          }
        }
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);

    } catch (e: any) {
      console.error('[useExerciseValidator]', e);
      const errMsg = (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')
        ? 'Cámara no permitida'
        : 'Error al iniciar cámara';
      setState(s => ({ ...s, loading: false, active: false, error: errMsg }));
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
  }, []);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (landmarkerRef.current) { try { landmarkerRef.current.close(); } catch { /* noop */ } }
    };
  }, []);

  return { state, start, stop, videoRef, canvasRef };
}
