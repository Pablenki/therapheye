// =========================================
// DETECTOR DE PARPADEO — Therapheye v3
// Modos distracción: Lectura (scroll) / Juego mental
// La cámara corre en segundo plano, oculta.
// BPM: indicador pequeño en modos distracción
// Prompt de finalización a los 60 s
// =========================================

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft, Eye, EyeOff, AlertTriangle, CheckCircle2,
  Camera, CameraOff, Save, Clock, BookOpen, Zap,
} from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

interface Props { onBack: () => void; }

type Status = 'idle' | 'loading' | 'running' | 'error' | 'no-camera';
type Mode = 'lectura' | 'juego' | 'camara';

interface BlinkSession {
  id: number;
  started_at: string;
  duration_sec: number;
  total_blinks: number;
  avg_blinks_per_min: number;
}

interface GameQuestion {
  a: number;
  b: number;
  op: '+' | '-';
  correct: number;
  options: number[];
}

const BLINK_THRESHOLD = 0.45;
const WINDOW_SEC     = 60;
const LOW_BLINK_ALERT  = 8;
const NORMAL_BLINK_MIN = 12;

// ── Datos curiosos de salud visual ──────────────────────────────────────────
const READING_FACTS = [
  { tag: 'Pantallas y parpadeo',       text: 'Frente a una pantalla, la tasa de parpadeo puede caer hasta 5–7 veces por minuto — apenas un tercio de lo normal. Esto reduce significativamente la lubricación de la córnea.' },
  { tag: 'Regla 20-20-20',             text: 'Cada 20 minutos de pantalla, enfoca algo a 6 metros de distancia durante 20 segundos. Este ejercicio simple reduce la fatiga del músculo ciliar hasta en un 40%.' },
  { tag: 'El parpadeo completo',        text: 'Un parpadeo parcial no distribuye bien la película lagrimal. Practicar parpadeos lentos y completos —cerrando los ojos del todo— mejora notablemente la hidratación ocular.' },
  { tag: 'Síndrome visual digital',     text: 'El síndrome de visión por computadora afecta al 50–90% de los trabajadores de oficina. Sus síntomas: ardor, visión borrosa, dolor de cabeza y sensación de arenilla.' },
  { tag: 'Posición de pantalla',        text: 'La pantalla debería estar entre 20 y 30 cm por debajo del nivel de los ojos. Esa posición reduce la apertura del párpado y disminuye la evaporación lagrimal hasta un 30%.' },
  { tag: 'Omega-3 y lágrimas',          text: 'Los ácidos grasos omega-3 (salmón, nueces, semillas de chía) mejoran la capa lipídica de la lágrima, reduciendo su evaporación. Son un apoyo nutricional comprobado contra el ojo seco.' },
  { tag: 'Luz azul: mito y realidad',   text: 'La luz azul de pantallas no daña la retina en dosis normales de uso diario. Sin embargo, usarla de noche sí altera el ritmo circadiano y puede perjudicar la calidad del sueño.' },
  { tag: 'Humedad ambiental',           text: 'El aire acondicionado y la calefacción reducen la humedad del ambiente, acelerando la evaporación lagrimal. Un humidificador doméstico puede marcar una diferencia notable en el confort ocular.' },
  { tag: 'Músculos ciliares',           text: 'El músculo ciliar se fatiga mirando pantallas de cerca por horas. Los ejercicios de enfoque alternado (lejos → cerca → lejos) lo relajan y protegen la agudeza visual a largo plazo.' },
  { tag: 'Señales de alarma',           text: 'Visión borrosa al despertar, ojos rojos frecuentes o sensación de cuerpo extraño son señales de ojo seco crónico. Un oftalmólogo puede confirmarlo con una prueba sencilla.' },
  { tag: 'Parpadear es entrenable',     text: 'La conciencia del parpadeo se puede entrenar. Programar un recordatorio cada 20 minutos para hacer 10 parpadeos completos y lentos es una estrategia clínica reconocida.' },
  { tag: 'Lágrimas artificiales',       text: 'Las gotas oftalmológicas sin conservantes son seguras para uso frecuente. Aplicarlas antes de los síntomas, como medida preventiva, es más efectivo que hacerlo después.' },
];

// ── Generador de preguntas ───────────────────────────────────────────────────
function generateQuestion(): GameQuestion {
  const a  = Math.floor(Math.random() * 40) + 11;
  const b  = Math.floor(Math.random() * 30) + 5;
  const op = (Math.random() > 0.4 ? '+' : '-') as '+' | '-';
  const correct = op === '+' ? a + b : a - b;
  const opts = new Set([correct]);
  while (opts.size < 3) {
    const d = (Math.floor(Math.random() * 8) + 1) * (Math.random() > 0.5 ? 1 : -1);
    const c = correct + d;
    if (c > 0) opts.add(c);
  }
  return { a, b, op, correct, options: [...opts].sort(() => Math.random() - 0.5) };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function rateColor(bpm: number): string {
  if (bpm === 0)               return '#9ca3af';
  if (bpm < LOW_BLINK_ALERT)  return '#dc2626';
  if (bpm < NORMAL_BLINK_MIN) return '#d97706';
  return '#16a34a';
}

function rateLabel(bpm: number): { text: string; emoji: string } {
  if (bpm === 0)               return { text: 'Midiendo...', emoji: '⏳' };
  if (bpm < LOW_BLINK_ALERT)  return { text: 'Muy bajo — recuerda parpadear', emoji: '⚠️' };
  if (bpm < NORMAL_BLINK_MIN) return { text: 'Un poco bajo', emoji: '🟡' };
  return { text: '¡Excelente tasa!', emoji: '🟢' };
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BlinkDetector({ onBack }: Props) {
  const { user } = useUser();

  // Processing video (always hidden — used by MediaPipe)
  const videoRef          = useRef<HTMLVideoElement>(null);
  // Display video (only for camera mode — visible)
  const cameraDisplayRef  = useRef<HTMLVideoElement>(null);
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const animRef           = useRef<number>(0);
  const landmarkerRef     = useRef<any>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const blinkTimestampsRef = useRef<number[]>([]);
  const wasBlinkingRef    = useRef(false);
  const sessionStartRef   = useRef<Date | null>(null);
  const totalBlinksRef    = useRef(0);

  // Core state
  const [status,       setStatus]       = useState<Status>('idle');
  const [errorMsg,     setErrorMsg]     = useState('');
  const [blinksPerMin, setBlinksPerMin] = useState(0);
  const [totalBlinks,  setTotalBlinks]  = useState(0);
  const [elapsed,      setElapsed]      = useState(0);
  const [saved,        setSaved]        = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [savedBpm,     setSavedBpm]     = useState(0);
  const [todaySessions, setTodaySessions] = useState<BlinkSession[]>([]);

  // Distraction state
  const [selectedMode,   setSelectedMode]   = useState<Mode | null>(null);
  const [gameQ,          setGameQ]          = useState<GameQuestion>(generateQuestion);
  const [gameScore,      setGameScore]      = useState(0);
  const [gameAnswered,   setGameAnswered]   = useState(false);
  const [gameWasCorrect, setGameWasCorrect] = useState(false);
  const [hasEnoughData,  setHasEnoughData]  = useState(false);
  const [finishPromptDismissed, setFinishPromptDismissed] = useState(false);

  // ── Load history ────────────────────────────────────────────────────────────
  const loadTodaySessions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rows = await sql`
        SELECT id, started_at, duration_sec, total_blinks, avg_blinks_per_min
        FROM sesiones_parpadeo
        WHERE user_id = ${user.id}
          AND started_at::date = ${today}::date
        ORDER BY started_at DESC
      `;
      setTodaySessions(rows as BlinkSession[]);
    } catch (e) {
      console.error('Error cargando historial parpadeo:', e);
    }
  }, [user]);

  useEffect(() => { loadTodaySessions(); }, [loadTodaySessions]);

  // ── Elapsed timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // ── "Enough data" flag after 60 s ───────────────────────────────────────────
  useEffect(() => {
    if (status === 'running' && elapsed >= 60 && !hasEnoughData) setHasEnoughData(true);
  }, [elapsed, status, hasEnoughData]);

  // ── Sync stream to camera display video when running in camera mode ──────────
  useEffect(() => {
    if (status === 'running' && selectedMode === 'camara' && cameraDisplayRef.current && streamRef.current) {
      cameraDisplayRef.current.srcObject = streamRef.current;
      cameraDisplayRef.current.play().catch(() => {});
    }
  }, [status, selectedMode]);

  // ── Game answer ──────────────────────────────────────────────────────────────
  const handleAnswer = useCallback((answer: number) => {
    if (gameAnswered) return;
    const correct = answer === gameQ.correct;
    setGameWasCorrect(correct);
    setGameAnswered(true);
    if (correct) setGameScore(s => s + 1);
    setTimeout(() => {
      setGameQ(generateQuestion());
      setGameAnswered(false);
    }, 750);
  }, [gameAnswered, gameQ.correct]);

  // ── Stop session ─────────────────────────────────────────────────────────────
  const stopSession = useCallback(async (save = false) => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setStatus('idle');

    if (save && user?.id && sessionStartRef.current && totalBlinksRef.current > 0) {
      setSaving(true);
      try {
        const endedAt = new Date();
        const durSec  = Math.round((endedAt.getTime() - sessionStartRef.current.getTime()) / 1000);
        const avgBpm  = durSec > 0 ? Math.round((totalBlinksRef.current / durSec) * 60 * 10) / 10 : 0;
        await sql`
          INSERT INTO sesiones_parpadeo (user_id, started_at, ended_at, duration_sec, total_blinks, avg_blinks_per_min)
          VALUES (${user.id}, ${sessionStartRef.current.toISOString()}, ${endedAt.toISOString()}, ${durSec}, ${totalBlinksRef.current}, ${avgBpm})
        `;
        setSaved(true);
        setSavedBpm(Math.round(avgBpm));
        await loadTodaySessions();
      } catch (e) {
        console.error('Error guardando sesión de parpadeo:', e);
      }
      setSaving(false);
    }
  }, [user, loadTodaySessions]);

  // ── Start session ────────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    setSaved(false);
    setElapsed(0);
    setBlinksPerMin(0);
    setTotalBlinks(0);
    setHasEnoughData(false);
    setFinishPromptDismissed(false);
    setGameQ(generateQuestion());
    setGameScore(0);
    setGameAnswered(false);
    blinkTimestampsRef.current  = [];
    wasBlinkingRef.current      = false;
    totalBlinksRef.current      = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;

      // Attach to processing video (always hidden, always mounted)
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>(res => { videoRef.current!.onloadeddata = () => res(); });
        videoRef.current.play();
      }

      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      landmarkerRef.current     = faceLandmarker;
      sessionStartRef.current   = new Date();
      setStatus('running');

      let lastVideoTime = -1;
      const loop = () => {
        const video = videoRef.current;
        if (!video || !landmarkerRef.current) return;

        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const results = landmarkerRef.current.detectForVideo(video, performance.now());
          const shapes  = results?.faceBlendshapes?.[0]?.categories ?? [];
          const blinkL  = shapes.find((c: any) => c.categoryName === 'eyeBlinkLeft')?.score  ?? 0;
          const blinkR  = shapes.find((c: any) => c.categoryName === 'eyeBlinkRight')?.score ?? 0;
          const avg     = (blinkL + blinkR) / 2;

          if (avg > BLINK_THRESHOLD && !wasBlinkingRef.current) {
            blinkTimestampsRef.current.push(Date.now());
            totalBlinksRef.current += 1;
            setTotalBlinks(totalBlinksRef.current);
          }
          wasBlinkingRef.current = avg > BLINK_THRESHOLD;

          const now = Date.now();
          blinkTimestampsRef.current = blinkTimestampsRef.current.filter(t => now - t < WINDOW_SEC * 1000);
          setBlinksPerMin(blinkTimestampsRef.current.length);

          // Draw on canvas only in camera mode
          const canvas = canvasRef.current;
          if (canvas && shapes.length > 0) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width  = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = avg > BLINK_THRESHOLD ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)';
              ctx.font = `bold ${Math.round(canvas.height * 0.08)}px Arial`;
              ctx.textAlign = 'center';
              ctx.fillText(avg > BLINK_THRESHOLD ? '😌' : '👁', canvas.width / 2, canvas.height * 0.12);
            }
          }
        }
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);

    } catch (e: any) {
      console.error(e);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setStatus('no-camera');
      } else {
        setStatus('error');
        setErrorMsg(e.message ?? 'Error desconocido');
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  const color = rateColor(blinksPerMin);
  const label = rateLabel(blinksPerMin);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 pb-24">

      {/* Processing video — ALWAYS hidden, always mounted so ref is available */}
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <video ref={videoRef} muted playsInline style={{ width: 160, height: 120 }} />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">

        {/* Header */}
        <button
          onClick={() => { stopSession(false); onBack(); }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" /> Volver al Dashboard
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Eye className="w-8 h-8 text-indigo-600" />
            Detector de Parpadeo
          </h1>
          <p className="text-gray-500 mt-1">Monitorea tu tasa de parpadeo en tiempo real para prevenir ojo seco</p>
        </div>

        {/* ── IDLE: selector de modo ──────────────────────────────────────────── */}
        {status === 'idle' && (
          <div className="space-y-6">

            {/* Result after saving */}
            {saved && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Sesión guardada correctamente en tu historial
                </div>
                <div className={`rounded-xl border px-4 py-3 ${
                  savedBpm < LOW_BLINK_ALERT  ? 'bg-red-50 border-red-200' :
                  savedBpm < NORMAL_BLINK_MIN ? 'bg-amber-50 border-amber-200' :
                                                'bg-emerald-50 border-emerald-200'
                }`}>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                    savedBpm < LOW_BLINK_ALERT  ? 'text-red-600' :
                    savedBpm < NORMAL_BLINK_MIN ? 'text-amber-600' : 'text-emerald-700'
                  }`}>
                    {savedBpm < LOW_BLINK_ALERT  ? '⚠️ Tasa muy baja' :
                     savedBpm < NORMAL_BLINK_MIN ? '🟡 Tasa baja' : '🟢 Tasa normal'}
                    {savedBpm > 0 && ` · ${savedBpm} parp/min`}
                  </p>
                  <p className="text-xs leading-relaxed text-gray-700">
                    {savedBpm < LOW_BLINK_ALERT
                      ? 'Menos de 8 parpadeos/min indica riesgo alto de ojo seco. Se recomienda descansar de la pantalla, usar lágrimas artificiales y hacer pausas frecuentes.'
                      : savedBpm < NORMAL_BLINK_MIN
                      ? 'Entre 8–12 parp/min es bajo-normal. Intenta parpadear conscientemente frente a pantallas. La regla 20-20-20 puede ayudarte.'
                      : 'Entre 12–20 parp/min es una tasa saludable. Tus ojos reciben buena lubricación. Sigue con tus buenos hábitos.'}
                  </p>
                </div>
              </div>
            )}

            {/* Mode cards */}
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-3">
                {saved ? 'Hacer otra medición — elige modo:' : 'Elige cómo quieres pasar el minuto de medición:'}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">

                {/* Lectura */}
                <button
                  onClick={() => setSelectedMode('lectura')}
                  className={`relative rounded-2xl border-2 p-5 text-left transition-all ${
                    selectedMode === 'lectura'
                      ? 'border-indigo-500 bg-indigo-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  {selectedMode === 'lectura' && (
                    <span className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold">✓</span>
                  )}
                  <BookOpen className={`w-8 h-8 mb-3 ${selectedMode === 'lectura' ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <p className="font-bold text-gray-800 text-base">Modo Lectura</p>
                  <p className="text-sm text-gray-500 mt-1">Lee datos curiosos sobre salud visual mientras tu parpadeo es medido naturalmente.</p>
                  <p className="text-xs text-indigo-500 mt-2 font-medium">Recomendado · más natural</p>
                </button>

                {/* Juego */}
                <button
                  onClick={() => setSelectedMode('juego')}
                  className={`relative rounded-2xl border-2 p-5 text-left transition-all ${
                    selectedMode === 'juego'
                      ? 'border-violet-500 bg-violet-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-violet-300'
                  }`}
                >
                  {selectedMode === 'juego' && (
                    <span className="absolute top-3 right-3 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold">✓</span>
                  )}
                  <Zap className={`w-8 h-8 mb-3 ${selectedMode === 'juego' ? 'text-violet-600' : 'text-gray-400'}`} />
                  <p className="font-bold text-gray-800 text-base">Modo Juego</p>
                  <p className="text-sm text-gray-500 mt-1">Resuelve sumas mentales mientras la cámara detecta tus parpadeos en segundo plano.</p>
                  <p className="text-xs text-violet-500 mt-2 font-medium">Más entretenido</p>
                </button>

                {/* Cámara */}
                <button
                  onClick={() => setSelectedMode('camara')}
                  className={`relative rounded-2xl border-2 p-5 text-left transition-all sm:col-span-2 ${
                    selectedMode === 'camara'
                      ? 'border-slate-500 bg-slate-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {selectedMode === 'camara' && (
                    <span className="absolute top-3 right-3 w-5 h-5 bg-slate-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold">✓</span>
                  )}
                  <Camera className={`w-8 h-8 mb-3 ${selectedMode === 'camara' ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className="font-bold text-gray-800 text-base">Modo Cámara <span className="text-xs font-normal text-slate-400 ml-1">(vista original)</span></p>
                  <p className="text-sm text-gray-500 mt-1">Muestra el feed de cámara en tiempo real con el indicador de parpadeo superpuesto. Ideal para verificar la precisión del sistema.</p>
                </button>
              </div>
            </div>

            {selectedMode ? (
              <button
                onClick={startSession}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition shadow-lg"
              >
                <Camera className="w-6 h-6" />
                Iniciar · Modo {selectedMode === 'lectura' ? 'Lectura' : selectedMode === 'juego' ? 'Juego' : 'Cámara'}
              </button>
            ) : (
              <p className="text-center text-sm text-gray-400">Selecciona un modo para continuar</p>
            )}
          </div>
        )}

        {/* ── LOADING ─────────────────────────────────────────────────────────── */}
        {status === 'loading' && (
          <div className="bg-white rounded-2xl shadow-md p-10 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">Cargando modelo de IA...</p>
            <p className="text-xs text-gray-400">La primera vez puede tardar ~10 segundos</p>
          </div>
        )}

        {/* ── ERROR / NO-CAMERA ────────────────────────────────────────────────── */}
        {(status === 'no-camera' || status === 'error') && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
            <CameraOff className="w-12 h-12 text-red-400" />
            <p className="text-red-700 font-medium">
              {status === 'no-camera'
                ? 'Permiso de cámara denegado. Permite el acceso en tu navegador.'
                : errorMsg || 'Error al iniciar la cámara'}
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ── RUNNING · MODO CÁMARA ───────────────────────────────────────────── */}
        {status === 'running' && selectedMode === 'camara' && (
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Feed de cámara — 3/5 */}
            <div className="lg:col-span-3">
              <div className="bg-black rounded-2xl overflow-hidden shadow-xl relative aspect-video flex items-center justify-center">
                <video
                  ref={cameraDisplayRef}
                  muted playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Analizando · {fmtTime(elapsed)}
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => stopSession(true)} disabled={saving}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow">
                  <Save className="w-5 h-5" />{saving ? 'Guardando...' : 'Guardar y Terminar'}
                </button>
                <button onClick={() => stopSession(false)}
                  className="py-3 px-5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                  <CameraOff className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats — 2/5 */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Parpadeos por minuto</p>
                <div className="text-7xl font-bold transition-all duration-500" style={{ color }}>
                  {blinksPerMin}
                </div>
                <div className="mt-3 flex items-start gap-2 text-sm" style={{ color }}>
                  <span className="text-lg flex-shrink-0">{label.emoji}</span>
                  <span className="text-left leading-tight">{label.text}</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-4">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>0</span><span>Bajo</span><span>Normal</span><span>20+</span>
                </div>
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min((blinksPerMin / 20) * 100, 100)}%`, backgroundColor: color }} />
                  <div className="absolute left-[40%] top-0 h-full w-px bg-amber-400" />
                  <div className="absolute left-[60%] top-0 h-full w-px bg-green-500" />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span className="text-red-400">⚠ &lt;8</span>
                  <span className="text-amber-400">🟡 8-12</span>
                  <span className="text-green-500">🟢 12-20</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-4 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{totalBlinks}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total parpadeos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{fmtTime(elapsed)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Tiempo sesión</p>
                </div>
              </div>
              {blinksPerMin > 0 && blinksPerMin < LOW_BLINK_ALERT && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Tasa muy baja</p>
                    <p className="text-xs text-red-600 mt-0.5">Haz varios parpadeos completos y lentos.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RUNNING · MODOS LECTURA / JUEGO ─────────────────────────────────── */}
        {status === 'running' && selectedMode !== 'camara' && (
          <div className="space-y-4">

            {/* ── Panel de distracción (contenido principal) ── */}
            {selectedMode === 'lectura' ? (
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl overflow-hidden">
                <div className="px-5 pt-4 pb-2 flex items-center gap-2 border-b border-indigo-100">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Salud visual · Datos curiosos</span>
                </div>
                {/* Scrollable list of all facts */}
                <div className="overflow-y-auto max-h-96 px-5 py-3 space-y-4">
                  {READING_FACTS.map((fact, i) => (
                    <div key={i} className="pb-4 border-b border-indigo-100 last:border-0 last:pb-0">
                      <p className="text-xs font-bold text-indigo-600 mb-1">{fact.tag}</p>
                      <p className="text-gray-800 text-sm leading-relaxed">{fact.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-violet-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Suma mental
                  </span>
                  <span className="text-xs font-bold text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full">
                    {gameScore} correctas
                  </span>
                </div>
                <p className="text-4xl font-black text-gray-800 text-center my-2 tracking-tight">
                  {gameQ.a} {gameQ.op} {gameQ.b} = ?
                </p>
                <div className="grid grid-cols-3 gap-3 mt-5">
                  {gameQ.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleAnswer(opt)}
                      disabled={gameAnswered}
                      className={`py-3 rounded-xl font-bold text-lg transition-all ${
                        gameAnswered
                          ? opt === gameQ.correct
                            ? 'bg-green-500 text-white scale-105'
                            : 'bg-gray-100 text-gray-400'
                          : 'bg-white border-2 border-violet-200 hover:border-violet-500 hover:bg-violet-50 text-gray-800 active:scale-95'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {gameAnswered && (
                  <p className={`text-center text-sm font-bold mt-3 ${gameWasCorrect ? 'text-green-600' : 'text-red-500'}`}>
                    {gameWasCorrect ? '¡Correcto! 🎉' : `Era ${gameQ.correct}`}
                  </p>
                )}
              </div>
            )}

            {/* ── Prompt de finalización a los 60 s ── */}
            {hasEnoughData && !finishPromptDismissed && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-green-700 font-medium">
                  ✓ Ya tienes suficientes datos · ¿Deseas finalizar?
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setFinishPromptDismissed(true)}
                    className="text-xs text-green-600 hover:text-green-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-green-100 transition border border-green-200"
                  >
                    Continuar midiendo
                  </button>
                  <button
                    onClick={() => stopSession(true)}
                    disabled={saving}
                    className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    {saving ? 'Guardando...' : 'Guardar y terminar'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Alerta tasa baja ── */}
            {blinksPerMin > 0 && blinksPerMin < LOW_BLINK_ALERT && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Tasa muy baja</p>
                  <p className="text-xs text-red-600 mt-0.5">Haz varios parpadeos completos y lentos ahora.</p>
                </div>
              </div>
            )}

            {/* ── Indicador BPM pequeño + controles ── */}
            <div className="flex items-center justify-between gap-3">
              {/* Mini BPM badge */}
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">{fmtTime(elapsed)}</span>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full text-white shadow-sm ml-1"
                  style={{ backgroundColor: color }}
                >
                  {blinksPerMin} parp/min {label.emoji}
                </span>
              </div>
              {/* Controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => stopSession(true)}
                  disabled={saving}
                  className="py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-semibold flex items-center gap-2 text-sm transition shadow"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => stopSession(false)}
                  className="py-2.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center transition"
                  title="Detener sin guardar"
                >
                  <CameraOff className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ─────────────────────────────────────────────────────────── */}
        {todaySessions.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Sesiones de hoy
            </h2>
            <div className="space-y-2">
              {todaySessions.map(s => {
                const hora   = new Date(s.started_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                const durMin = Math.floor(s.duration_sec / 60);
                const durSec = s.duration_sec % 60;
                const bpm    = Math.round(s.avg_blinks_per_min);
                const clr    = bpm < LOW_BLINK_ALERT  ? 'text-red-600 bg-red-50 border-red-200'
                             : bpm < NORMAL_BLINK_MIN  ? 'text-amber-600 bg-amber-50 border-amber-200'
                             :                           'text-green-700 bg-green-50 border-green-200';
                const emj    = bpm < LOW_BLINK_ALERT  ? '⚠️' : bpm < NORMAL_BLINK_MIN ? '🟡' : '🟢';
                return (
                  <div key={s.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${clr}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{emj}</span>
                      <div>
                        <p className="text-sm font-semibold">{hora} · {durMin > 0 ? `${durMin}m ` : ''}{durSec}s</p>
                        <p className="text-xs opacity-80">{s.total_blinks} parpadeos totales</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{bpm}</p>
                      <p className="text-xs opacity-70">parp/min</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-indigo-500" />
            ¿Cómo funciona?
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-gray-700">1. Detección facial</span>
              <span>MediaPipe analiza tu rostro con 468 puntos usando IA en tiempo real, completamente local.</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-gray-700">2. Blend shapes</span>
              <span>Mide el score de "ojo cerrado" (0–1) en cada ojo. Un score {'>'} 0.45 indica parpadeo.</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-gray-700">3. BPM en ventana</span>
              <span>Cuenta los parpadeos en los últimos 60 segundos para calcular tu tasa actual.</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            🔒 Todo el procesamiento es local — la cámara nunca sale de tu dispositivo.
          </p>
        </div>

      </div>
    </div>
  );
}
