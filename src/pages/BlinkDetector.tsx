// =========================================
// DETECTOR DE PARPADEO — Therapheye
// Usa MediaPipe FaceLandmarker + blendshapes para contar
// parpadeos en tiempo real y calcular parpadeos/minuto
// =========================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Eye, EyeOff, AlertTriangle, CheckCircle2, Info, Camera, CameraOff, Save, Clock } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';

interface Props {
  onBack: () => void;
}

type Status = 'idle' | 'loading' | 'running' | 'error' | 'no-camera';

interface BlinkSession {
  id: number;
  started_at: string;
  duration_sec: number;
  total_blinks: number;
  avg_blinks_per_min: number;
}

const BLINK_THRESHOLD = 0.45;       // Blend shape score que indica ojo cerrado
const WINDOW_SEC = 60;              // Ventana de cálculo de BPM
const LOW_BLINK_ALERT = 8;          // Parpadeos/min bajo este umbral → alerta
const NORMAL_BLINK_MIN = 12;        // Parpadeos/min mínimo para "normal"

function rateColor(bpm: number): string {
  if (bpm === 0) return '#9ca3af';
  if (bpm < LOW_BLINK_ALERT) return '#dc2626';
  if (bpm < NORMAL_BLINK_MIN) return '#d97706';
  return '#16a34a';
}

function rateLabel(bpm: number): { text: string; emoji: string } {
  if (bpm === 0) return { text: 'Iniciando medición...', emoji: '⏳' };
  if (bpm < LOW_BLINK_ALERT) return { text: 'Muy bajo — recuerda parpadear conscientemente', emoji: '⚠️' };
  if (bpm < NORMAL_BLINK_MIN) return { text: 'Un poco bajo — intenta relajar los ojos', emoji: '🟡' };
  return { text: '¡Excelente! Tu tasa de parpadeo es normal', emoji: '🟢' };
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function BlinkDetector({ onBack }: Props) {
  const { user } = useUser();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const landmarkerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blinkTimestampsRef = useRef<number[]>([]);
  const wasBlinkingRef = useRef(false);
  const sessionStartRef = useRef<Date | null>(null);
  const totalBlinksRef = useRef(0);

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [blinksPerMin, setBlinksPerMin] = useState(0);
  const [totalBlinks, setTotalBlinks] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedBpm, setSavedBpm] = useState(0);
  const [todaySessions, setTodaySessions] = useState<BlinkSession[]>([]);

  // Cargar historial de hoy
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

  // Timer for elapsed seconds
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const stopSession = useCallback(async (save = false) => {
    // Stop animation loop
    cancelAnimationFrame(animRef.current);
    // Stop camera
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    // Dispose landmarker
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setStatus('idle');

    if (save && user?.id && sessionStartRef.current && totalBlinksRef.current > 0) {
      setSaving(true);
      try {
        const endedAt = new Date();
        const durSec = Math.round((endedAt.getTime() - sessionStartRef.current.getTime()) / 1000);
        const avgBpm = durSec > 0 ? Math.round((totalBlinksRef.current / durSec) * 60 * 10) / 10 : 0;
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

  const startSession = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    setSaved(false);
    setElapsed(0);
    setBlinksPerMin(0);
    setTotalBlinks(0);
    blinkTimestampsRef.current = [];
    wasBlinkingRef.current = false;
    totalBlinksRef.current = 0;

    try {
      // 1. Request camera
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

      // 2. Load MediaPipe FaceLandmarker
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
      landmarkerRef.current = faceLandmarker;
      sessionStartRef.current = new Date();
      setStatus('running');

      // 3. Animation loop
      let lastVideoTime = -1;
      const loop = () => {
        const video = videoRef.current;
        if (!video || !landmarkerRef.current) return;

        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const results = landmarkerRef.current.detectForVideo(video, performance.now());
          const shapes = results?.faceBlendshapes?.[0]?.categories ?? [];
          const blinkL = shapes.find((c: any) => c.categoryName === 'eyeBlinkLeft')?.score ?? 0;
          const blinkR = shapes.find((c: any) => c.categoryName === 'eyeBlinkRight')?.score ?? 0;
          const avgBlink = (blinkL + blinkR) / 2;
          const isBlinking = avgBlink > BLINK_THRESHOLD;

          // Detect rising edge (not blinking → blinking)
          if (isBlinking && !wasBlinkingRef.current) {
            const now = Date.now();
            blinkTimestampsRef.current.push(now);
            totalBlinksRef.current += 1;
            setTotalBlinks(totalBlinksRef.current);
          }
          wasBlinkingRef.current = isBlinking;

          // Rolling BPM
          const now = Date.now();
          blinkTimestampsRef.current = blinkTimestampsRef.current.filter(t => now - t < WINDOW_SEC * 1000);
          setBlinksPerMin(blinkTimestampsRef.current.length);

          // Draw eye indicators on canvas
          const canvas = canvasRef.current;
          if (canvas && shapes.length > 0) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              // Draw subtle eye blink indicators
              const blink = avgBlink;
              ctx.fillStyle = blink > BLINK_THRESHOLD ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)';
              ctx.font = `bold ${Math.round(canvas.height * 0.08)}px Arial`;
              ctx.textAlign = 'center';
              ctx.fillText(blink > BLINK_THRESHOLD ? '😌' : '👁', canvas.width / 2, canvas.height * 0.12);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  const color = rateColor(blinksPerMin);
  const label = rateLabel(blinksPerMin);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-8">
        {/* Header */}
        <button onClick={() => { stopSession(false); onBack(); }} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-5 h-5" /> Volver al Dashboard
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Eye className="w-8 h-8 text-indigo-600" />
            Detector de Parpadeo
          </h1>
          <p className="text-gray-500 mt-1">Monitorea tu tasa de parpadeo en tiempo real para prevenir ojo seco</p>
        </div>

        {/* Main layout */}
        <div className="grid lg:grid-cols-5 gap-6">

          {/* Video feed — 3/5 */}
          <div className="lg:col-span-3">
            <div className="bg-black rounded-2xl overflow-hidden shadow-xl relative aspect-video flex items-center justify-center">
              {status === 'idle' && (
                <div className="flex flex-col items-center gap-4 text-gray-400">
                  <Camera className="w-16 h-16" />
                  <p className="text-sm">Presiona "Iniciar" para activar la cámara</p>
                </div>
              )}
              {status === 'loading' && (
                <div className="flex flex-col items-center gap-4 text-gray-400">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Cargando modelo de IA...</p>
                  <p className="text-xs text-gray-500">Primera vez puede tardar ~10s</p>
                </div>
              )}
              {status === 'no-camera' && (
                <div className="flex flex-col items-center gap-4 text-red-400 px-6 text-center">
                  <CameraOff className="w-12 h-12" />
                  <p className="text-sm">Permiso de cámara denegado. Permite el acceso en tu navegador.</p>
                </div>
              )}
              {status === 'error' && (
                <div className="flex flex-col items-center gap-4 text-red-400 px-6 text-center">
                  <AlertTriangle className="w-12 h-12" />
                  <p className="text-sm">{errorMsg || 'Error al iniciar la cámara'}</p>
                </div>
              )}
              <video
                ref={videoRef}
                muted playsInline
                className={`w-full h-full object-cover ${status === 'running' ? 'block' : 'hidden'}`}
                style={{ transform: 'scaleX(-1)' }}
              />
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${status === 'running' ? 'block' : 'hidden'}`}
                style={{ transform: 'scaleX(-1)' }}
              />
              {status === 'running' && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Analizando · {fmtTime(elapsed)}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-3 mt-4">
              {status !== 'running' ? (
                <button
                  onClick={startSession}
                  disabled={status === 'loading'}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow"
                >
                  <Camera className="w-5 h-5" />
                  {status === 'loading' ? 'Cargando...' : 'Iniciar Detección'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => stopSession(true)}
                    disabled={saving}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Guardando...' : 'Guardar y Terminar'}
                  </button>
                  <button
                    onClick={() => stopSession(false)}
                    className="py-3 px-5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <CameraOff className="w-5 h-5" />
                    Detener
                  </button>
                </>
              )}
            </div>
            {saved && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Sesión guardada correctamente en tu historial
                </div>
                {/* Explicación del resultado */}
                <div className={`rounded-xl border px-4 py-3 ${
                  savedBpm === 0 ? 'bg-gray-50 border-gray-200' :
                  savedBpm < LOW_BLINK_ALERT ? 'bg-red-50 border-red-200' :
                  savedBpm < NORMAL_BLINK_MIN ? 'bg-amber-50 border-amber-200' :
                  'bg-emerald-50 border-emerald-200'
                }`}>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                    savedBpm < LOW_BLINK_ALERT ? 'text-red-600' :
                    savedBpm < NORMAL_BLINK_MIN ? 'text-amber-600' :
                    'text-emerald-700'
                  }`}>
                    {savedBpm < LOW_BLINK_ALERT ? '⚠️ Tasa de parpadeo muy baja' :
                     savedBpm < NORMAL_BLINK_MIN ? '🟡 Tasa de parpadeo baja' :
                     '🟢 Tasa de parpadeo normal'}
                    {savedBpm > 0 && ` · ${savedBpm} parp/min`}
                  </p>
                  <p className="text-xs leading-relaxed text-gray-700">
                    {savedBpm < LOW_BLINK_ALERT
                      ? 'Una tasa menor a 8 parpadeos/min indica riesgo alto de ojo seco. Tu córnea no recibe lubricación suficiente. Se recomienda descansar de la pantalla, usar lágrimas artificiales y hacer pausas frecuentes.'
                      : savedBpm < NORMAL_BLINK_MIN
                      ? 'Entre 8-12 parpadeos/min es un rango bajo-normal. Intenta parpadear conscientemente, especialmente frente a pantallas. La regla 20-20-20 puede ayudarte a mantener una tasa saludable.'
                      : 'Entre 12-20 parpadeos/min es una tasa saludable. Tus ojos reciben lubricación adecuada. Sigue practicando buenos hábitos: tomar descansos regulares y parpadear conscientemente durante pantallas.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stats — 2/5 */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* BPM principal */}
            <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Parpadeos por minuto</p>
              <div
                className="text-7xl font-bold transition-all duration-500"
                style={{ color }}
              >
                {status === 'running' ? blinksPerMin : '—'}
              </div>
              {status === 'running' && (
                <div className="mt-3 flex items-start gap-2 text-sm" style={{ color }}>
                  <span className="text-lg flex-shrink-0">{label.emoji}</span>
                  <span className="text-left leading-tight">{label.text}</span>
                </div>
              )}
              {status !== 'running' && (
                <p className="text-xs text-gray-400 mt-2">Inicia la detección para ver tu tasa</p>
              )}
            </div>

            {/* Barra de progreso */}
            {status === 'running' && (
              <div className="bg-white rounded-2xl shadow-md p-4">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>0</span><span>Bajo</span><span>Normal</span><span>20+</span>
                </div>
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min((blinksPerMin / 20) * 100, 100)}%`, backgroundColor: color }}
                  />
                  <div className="absolute left-[40%] top-0 h-full w-px bg-amber-400" />
                  <div className="absolute left-[60%] top-0 h-full w-px bg-green-500" />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span className="text-red-400">⚠ &lt;8</span>
                  <span className="text-amber-400">🟡 8-12</span>
                  <span className="text-green-500">🟢 12-20</span>
                </div>
              </div>
            )}

            {/* Stats de sesión */}
            <div className="bg-white rounded-2xl shadow-md p-4 grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{status === 'running' ? totalBlinks : '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total parpadeos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{status === 'running' ? fmtTime(elapsed) : '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Tiempo sesión</p>
              </div>
            </div>

            {/* Info científica */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-indigo-700 flex items-center gap-1.5 mb-2">
                <Info className="w-3.5 h-3.5" /> Dato científico
              </p>
              <ul className="text-xs text-indigo-700 space-y-1.5 list-none">
                <li>• En reposo parpadeamos <strong>15–20 veces/min</strong></li>
                <li>• Frente a pantallas bajamos a <strong>5–7 veces/min</strong></li>
                <li>• Esto causa 60% menos lubricación ocular</li>
                <li>• La regla 20-20-20 ayuda a normalizarlo</li>
              </ul>
              <p className="text-[10px] text-indigo-400 mt-2">
                Fuente: American Academy of Ophthalmology, 2023
              </p>
            </div>

            {/* Tip */}
            {status === 'running' && blinksPerMin < LOW_BLINK_ALERT && blinksPerMin > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700 mb-1">Tasa de parpadeo baja</p>
                  <p className="text-xs text-red-600">Parpadea conscientemente varias veces ahora para lubricar tus ojos y reducir el riesgo de ojo seco.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Historial de hoy */}
        {todaySessions.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Sesiones de hoy
            </h2>
            <div className="space-y-2">
              {todaySessions.map(s => {
                const hora = new Date(s.started_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                const durMin = Math.floor(s.duration_sec / 60);
                const durSec = s.duration_sec % 60;
                const bpm = Math.round(s.avg_blinks_per_min);
                const color = bpm < LOW_BLINK_ALERT ? 'text-red-600 bg-red-50 border-red-200'
                  : bpm < NORMAL_BLINK_MIN ? 'text-amber-600 bg-amber-50 border-amber-200'
                  : 'text-green-700 bg-green-50 border-green-200';
                const emoji = bpm < LOW_BLINK_ALERT ? '⚠️' : bpm < NORMAL_BLINK_MIN ? '🟡' : '🟢';
                return (
                  <div key={s.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${color}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{emoji}</span>
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

        {/* How it works */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-indigo-500" />
            ¿Cómo funciona?
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-gray-700">1. Detección facial</span>
              <span>MediaPipe analiza tu rostro con 468 puntos de referencia usando IA en tiempo real.</span>
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
