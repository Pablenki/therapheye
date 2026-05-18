import { ArrowLeft, Camera, X, CheckCircle, Loader2, Upload, AlertCircle, Sparkles, Brain, Sun, Zap } from 'lucide-react'
import { Eye } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLanguage } from '../i18n'
import { speak as speakProxy, stopSpeech } from '../utils/tts'
import { sql } from '../neonCliente'
import { callClaude } from '../utils/claudeApi'

// ── Análisis de calidad de frame ──────────────────────────────────────────────
type FrameQuality = 'poor' | 'fair' | 'good';
interface QualityInfo { quality: FrameQuality; brightness: number; sharpness: number; reason: string }

function analyzeFrameQuality(video: HTMLVideoElement): QualityInfo {
  const w = 160, h = 120;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { quality: 'poor', brightness: 0, sharpness: 0, reason: 'Sin contexto de canvas' };
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let totalBrightness = 0;
  let sharpness = 0;
  const total = w * h;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const i = (row * w + col) * 4;
      const luma = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      totalBrightness += luma;
      if (col < w - 1 && row < h - 1) {
        const right = (row * w + col + 1) * 4;
        const down  = ((row + 1) * w + col) * 4;
        sharpness += Math.abs(data[i] - data[right]) + Math.abs(data[i] - data[down]);
      }
    }
  }

  const avgBrightness = totalBrightness / total;
  const avgSharpness  = sharpness / total;

  const brightOk   = avgBrightness >= 55 && avgBrightness <= 210;
  const sharpOk    = avgSharpness >= 12;

  // Detect "too close": sample the four edge strips. If ALL edges are bright (skin-toned),
  // the face/eye fills the entire frame and no surrounding context is captured.
  const edgeSize = Math.floor(h * 0.12); // top+bottom edge height = 12% of frame
  let edgeBrightSum = 0, edgePixels = 0;
  for (let row = 0; row < edgeSize; row++) {
    for (let col = 0; col < w; col++) {
      const i = (row * w + col) * 4;
      edgeBrightSum += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      edgePixels++;
    }
  }
  for (let row = h - edgeSize; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const i = (row * w + col) * 4;
      edgeBrightSum += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      edgePixels++;
    }
  }
  const avgEdgeBrightness = edgePixels > 0 ? edgeBrightSum / edgePixels : 0;
  // Too close: edges are bright (>90) meaning face skin fills the full frame
  const tooClose = avgEdgeBrightness > 90 && avgBrightness > 80 && avgBrightness <= 210;

  let reason = '';
  if (tooClose) reason = 'Aleja el ojo — necesitamos ver el ojo completo';
  else if (!brightOk) reason = avgBrightness < 55 ? 'Poca iluminación — enciende más luz' : 'Demasiada luz — evita la luz directa';
  else if (!sharpOk) reason = 'Imagen borrosa — acerca el ojo a la cámara';
  else reason = '¡Perfecto! Mantén la posición';

  const quality: FrameQuality = (brightOk && sharpOk && !tooClose) ? 'good' : (brightOk || sharpOk) ? 'fair' : 'poor';
  return { quality, brightness: Math.round(avgBrightness), sharpness: Math.round(avgSharpness), reason };
}

// ── Voz guía ─────────────────────────────────────────────────────────────────
function speak(text: string) {
  speakProxy(text, 'es');
}

interface ClaudeVisionResult {
  analisis: string;
  signos: string[];
  nivel_confianza: 'alto' | 'medio' | 'bajo';
  recomendacion: string;
}

const CLAUDE_VISION_PROMPT = `Eres un asistente de análisis de salud visual. Analiza esta imagen del ojo de un usuario.

Identifica ÚNICAMENTE signos visibles en la imagen. Responde en JSON:
{
  "analisis": "descripción concisa de lo que observas en el ojo (1-2 oraciones)",
  "signos": ["signo1", "signo2"],
  "nivel_confianza": "alto|medio|bajo",
  "recomendacion": "recomendación concreta de 1 oración"
}

Signos posibles: enrojecimiento leve, enrojecimiento moderado, enrojecimiento severo, párpado caído, ojo seco aparente, conjuntiva irritada, lagrimeo, imagen borrosa, mala iluminación.
Si la imagen no muestra claramente un ojo, indica "imagen no adecuada" en analisis y usa nivel_confianza "bajo".
NUNCA diagnostiques enfermedades. Solo describe lo visible.`;

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

const SINTOMA_SEVERITY: Record<string, number> = {
  ojo_sano: 0, enro_leve: 25, piel_enro: 35,
  enro_moderado: 50, parpado_caido: 70, enro_grave: 90,
}

const getMostSevere = (sintomas: string[]): string => {
  if (sintomas.length === 0) return 'ojo_sano'
  return sintomas.reduce((prev, curr) =>
    (SINTOMA_SEVERITY[curr] ?? 0) > (SINTOMA_SEVERITY[prev] ?? 0) ? curr : prev
  )
}

type Props = {
  onBack: () => void
}

interface DiagnosticoResult {
  sintomas: string[]
  mensaje: string
}

const ImageCapture = ({ onBack }: Props) => {
  const { user } = useUser()
  const { t } = useLanguage()
  const [mostrarCheckCamara, setMostrarCheckCamara] = useState(false)
  const [mostrarCamara, setMostrarCamara] = useState(false)
  const [imagenCapturada, setImagenCapturada] = useState<string | null>(null)
  const [diagnosticoCompletado, setDiagnosticoCompletado] = useState(false)
  const [resultado, setResultado] = useState<DiagnosticoResult | null>(null)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [errorDiagnostico, setErrorDiagnostico] = useState<string | null>(null)
  const [claudeResult, setClaudeResult] = useState<ClaudeVisionResult | null>(null)
  const [isClaudeAnalyzing, setIsClaudeAnalyzing] = useState(false)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const [cargandoCamara, setCargandoCamara] = useState(false)
  // Smart capture states
  const [qualityInfo, setQualityInfo] = useState<QualityInfo | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goodSinceRef = useRef<number | null>(null)
  const lastVoiceQualityRef = useRef<FrameQuality | null>(null)
  const autoCapturedRef = useRef(false)

  // Iniciar cámara cuando se abre el modal
  useEffect(() => {
    if (mostrarCamara) {
      autoCapturedRef.current = false;
      goodSinceRef.current = null;
      lastVoiceQualityRef.current = null;
      setQualityInfo(null);
      setCountdown(null);
      iniciarCamara()
    } else {
      stopQualityAnalysis()
      detenerCamara()
    }
    return () => { stopQualityAnalysis(); detenerCamara() }
  }, [mostrarCamara])

  // Enter para capturar foto
  useEffect(() => {
    if (!mostrarCamara) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') capturarImagen()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [mostrarCamara])

  const stopQualityAnalysis = useCallback(() => {
    if (qualityIntervalRef.current) { clearInterval(qualityIntervalRef.current); qualityIntervalRef.current = null; }
    if (countdownRef.current) { clearTimeout(countdownRef.current); countdownRef.current = null; }
    setCountdown(null);
  }, [])

  const startQualityAnalysis = useCallback(() => {
    if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current);
    speak('Centra tu ojo en el óvalo. Asegúrate de tener buena iluminación.')

    qualityIntervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      const info = analyzeFrameQuality(videoRef.current);
      setQualityInfo(info);

      // Guía de voz solo cuando cambia el estado
      if (info.quality !== lastVoiceQualityRef.current) {
        lastVoiceQualityRef.current = info.quality;
        if (info.quality === 'good') speak('Perfecto. Capturando automáticamente en 3 segundos.');
        else if (info.quality === 'poor') speak(info.reason.includes('Aleja') ? 'Aleja el ojo de la cámara.' : info.reason);
      }

      // Auto-captura: si la calidad es buena por 1.5s → countdown 3-2-1
      if (info.quality === 'good') {
        if (goodSinceRef.current === null) goodSinceRef.current = Date.now();
        const elapsed = Date.now() - goodSinceRef.current;
        if (elapsed >= 1500 && !autoCapturedRef.current) {
          autoCapturedRef.current = true;
          setCountdown(3);
          const step = (n: number) => {
            setCountdown(n);
            if (n > 1) { countdownRef.current = setTimeout(() => step(n - 1), 1000); }
            else { countdownRef.current = setTimeout(() => { capturarImagen(); setCountdown(null); }, 1000); }
          };
          step(3);
        }
      } else {
        goodSinceRef.current = null;
        // Cancelar countdown si la posición se pierde
        if (autoCapturedRef.current) {
          autoCapturedRef.current = false;
          if (countdownRef.current) { clearTimeout(countdownRef.current); countdownRef.current = null; }
          setCountdown(null);
        }
      }
    }, 600);
  }, [])  // capturarImagen se referencia por closure — se define después pero funciona por hoisting de useCallback

  const iniciarCamara = async () => {
    setErrorCamara(null)
    setCargandoCamara(true)
    try {
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: 'camera' as PermissionName })
        if (perm.state === 'denied') {
          setErrorCamara('El permiso de cámara está bloqueado. Ve a configuración del sitio en tu navegador y actívalo.')
          setMostrarCamara(false)
          setCargandoCamara(false)
          return
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        videoRef.current.onloadeddata = () => startQualityAnalysis()
      }
    } catch (error) {
      console.error('Error al acceder a la cámara:', error)
      const err = error as DOMException
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorCamara('Permiso de cámara denegado. Haz clic en el candado de la barra de URL y activa la cámara.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorCamara('La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.')
      } else if (err.name === 'NotFoundError') {
        setErrorCamara('No se encontró ninguna cámara en este dispositivo.')
      } else {
        setErrorCamara(`No se pudo acceder a la cámara (${err.name}). Intenta recargar la página.`)
      }
      setMostrarCamara(false)
    } finally {
      setCargandoCamara(false)
    }
  }

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.onloadeddata = null; }
  }

  const capturarImagen = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const contexto = canvas.getContext('2d')
      if (contexto) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        contexto.drawImage(video, 0, 0)
        setImagenCapturada(canvas.toDataURL('image/png'))
        stopQualityAnalysis()
        detenerCamara()
        setMostrarCamara(false)
        speak('Imagen capturada. Ahora puedes analizarla.')
      }
    }
  }, [stopQualityAnalysis])

  const cerrarCamara = () => {
    stopQualityAnalysis()
    detenerCamara()
    setMostrarCamara(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagenCapturada(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  const analizarConClaude = async (imagenBase64: string) => {
    setIsClaudeAnalyzing(true)
    try {
      // Extraer solo la parte base64 (sin el prefijo data:image/...;base64,)
      const base64Data = imagenBase64.split(',')[1] ?? imagenBase64
      const mediaType = imagenBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      const data = await callClaude({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: CLAUDE_VISION_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: 'Analiza esta imagen del ojo.' }
          ]
        }],
      })
      const text = data.content[0].text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ClaudeVisionResult
        setClaudeResult(parsed)
      }
    } catch (e) {
      console.warn('[Claude Vision] Error:', e)
    } finally {
      setIsClaudeAnalyzing(false)
    }
  }

  const realizarDiagnostico = async () => {
    if (!imagenCapturada) return
    setIsDiagnosing(true)
    setErrorDiagnostico(null)
    setClaudeResult(null)
    // Lanzar análisis de Claude Vision en paralelo
    analizarConClaude(imagenCapturada)
    try {
      const res = await fetch(`${API_BASE}/diagnostico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen_base64: imagenCapturada }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Error en el diagnóstico')
      }
      const data: DiagnosticoResult = await res.json()
      setResultado(data)
      setDiagnosticoCompletado(true)
      // Guardar síntoma más grave en historial
      if (user?.id) {
        // Filter 'ojo sano' before determining most severe symptom
        const sintomasParaDB = data.sintomas.filter(
          s => !['ojo sano', 'ojo_sano', 'healthy eye', 'sano'].includes(s.toLowerCase().trim())
        );
        const sintomaGuardar = getMostSevere(sintomasParaDB);
        await sql`
          INSERT INTO image_capture_history (user_id, sintoma)
          VALUES (${user.id}, ${sintomaGuardar})
        `.catch(err => console.warn('[ImageCapture] Error guardando historial:', err))
      }
    } catch (e) {
      setErrorDiagnostico(e instanceof Error ? e.message : 'No se pudo conectar con el servidor.')
    } finally {
      setIsDiagnosing(false)
    }
  }

  if (diagnosticoCompletado && resultado) {
    // Filter out 'ojo sano' / 'ojo_sano' — it's a "no symptom" indicator, not a real symptom.
    // If backend returns it alongside other symptoms, the real symptoms should take priority.
    const sintomasFiltrados = resultado.sintomas.filter(
      s => !['ojo sano', 'ojo_sano', 'healthy eye', 'sano'].includes(s.toLowerCase().trim())
    );
    const tieneSintomas = sintomasFiltrados.length > 0;
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{t('imageCapture', 'title')}</h2>
            <p className="text-gray-600 mb-6">{resultado.mensaje}</p>
            <div className={`rounded-xl p-6 mb-6 ${tieneSintomas ? 'bg-amber-50' : 'bg-green-50'}`}>
              <p className="text-sm text-gray-600 mb-2">Signos detectados en la imagen:</p>
              {tieneSintomas ? (
                <ul className="text-left space-y-2">
                  {sintomasFiltrados.map((s, i) => (
                    <li key={i} className="font-medium text-amber-700">• {s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-lg font-semibold text-green-700">Ningún signo de fatiga visual detectado.</p>
              )}
            </div>
            {/* Análisis Claude Vision */}
            {(isClaudeAnalyzing || claudeResult) && (
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-indigo-100 rounded-xl p-5 mb-5 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-indigo-800">Análisis IA — Claude Vision</h3>
                  {isClaudeAnalyzing && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 ml-auto" />}
                </div>
                {claudeResult ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{claudeResult.analisis}</p>
                    {claudeResult.signos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {claudeResult.signos.map(s => (
                          <span key={s} className="text-xs bg-white border border-indigo-200 text-indigo-700 rounded-full px-2.5 py-0.5">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-500">Confianza del análisis</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        claudeResult.nivel_confianza === 'alto' ? 'bg-emerald-100 text-emerald-700' :
                        claudeResult.nivel_confianza === 'medio' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {claudeResult.nivel_confianza === 'alto' ? '● Alta' : claudeResult.nivel_confianza === 'medio' ? '● Media' : '● Baja'}
                      </span>
                    </div>
                    {claudeResult.recomendacion && (
                      <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 flex items-start gap-1.5">
                        <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {claudeResult.recomendacion}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 leading-tight">* Análisis generado por IA. No reemplaza diagnóstico médico profesional.</p>
                  </div>
                ) : (
                  <p className="text-sm text-indigo-600 animate-pulse">Procesando imagen con IA...</p>
                )}
              </div>
            )}

            <div className="bg-blue-50 rounded-xl p-6 mb-6 text-left">
              <h3 className="font-semibold text-gray-800 mb-3">Recomendaciones:</h3>
              <ul className="space-y-2 text-gray-700">
                <li>✓ Realiza ejercicios visuales regularmente</li>
                <li>✓ Toma descansos cada 20 minutos</li>
                <li>✓ Ajusta la iluminación de tu pantalla</li>
                <li>✓ Mantén una distancia adecuada del monitor</li>
              </ul>
            </div>
            <button onClick={onBack} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
              {t('common', 'backToDashboard')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Therapheye</h1>
          </div>
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
            <span>{t('common', 'backToDashboard')}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-500 rounded-lg">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{t('imageCapture', 'title')}</h2>
              <p className="text-gray-600">
                {user
                  ? `${t('imageCapture', 'subtitle').toLowerCase()} ${user.nombre?.split(' ').slice(0, 3).join(' ')}`
                  : t('imageCapture', 'subtitle')}
              </p>
            </div>
          </div>

          {/* Ejemplo de posición */}
          {!imagenCapturada && (
            <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-indigo-700 mb-3 text-center">¿Cómo tomar la foto?</p>
              <div className="flex items-center gap-4 justify-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-28 h-28 rounded-lg overflow-hidden border-2 border-red-400 relative bg-gray-900 flex items-center justify-center">
                    {/* SVG simulando un ojo de cerca */}
                    <svg viewBox="0 0 100 60" className="w-full h-full">
                      <rect width="100" height="60" fill="#1a1a2e"/>
                      <ellipse cx="50" cy="30" rx="40" ry="22" fill="#c8a97a"/>
                      <ellipse cx="50" cy="30" rx="22" ry="20" fill="#7bb3d0"/>
                      <ellipse cx="50" cy="30" rx="14" ry="14" fill="#2e4a7a"/>
                      <ellipse cx="50" cy="30" rx="8" ry="8" fill="#0a0a0a"/>
                      <ellipse cx="46" cy="26" rx="3" ry="3" fill="white" opacity="0.8"/>
                      <ellipse cx="40" cy="10" rx="38" ry="8" fill="#1a1a1a" opacity="0.6"/>
                      <ellipse cx="40" cy="50" rx="38" ry="8" fill="#1a1a1a" opacity="0.4"/>
                    </svg>
                    <div className="absolute inset-0 border-2 border-dashed border-yellow-400 rounded-lg opacity-70" />
                  </div>
                  <span className="text-xs text-green-600 font-medium">✓ Correcto</span>
                  <span className="text-xs text-gray-500">Ojo centrado y cerca</span>
                </div>
                <div className="text-gray-400 text-2xl">vs</div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-28 h-28 rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <rect width="100" height="100" fill="#f0f0f0"/>
                      <ellipse cx="50" cy="45" rx="12" ry="7" fill="#c8a97a"/>
                      <ellipse cx="50" cy="45" rx="6" ry="5" fill="#7bb3d0"/>
                      <ellipse cx="50" cy="45" rx="3" ry="3" fill="#0a0a0a"/>
                      <rect x="0" y="0" width="100" height="30" fill="#3a3a3a" opacity="0.5"/>
                      <rect x="0" y="75" width="100" height="25" fill="#4a4a4a" opacity="0.3"/>
                    </svg>
                  </div>
                  <span className="text-xs text-red-500 font-medium">✗ Incorrecto</span>
                  <span className="text-xs text-gray-500">Muy lejos o tapado</span>
                </div>
              </div>
              <p className="text-xs text-indigo-600 text-center mt-3">
                Acerca tu ojo a la cámara · Buena iluminación · Sin lentes
              </p>
            </div>
          )}

          {/* Zona de imagen / botones */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            {imagenCapturada ? (
              <div className="space-y-4">
                <img
                  src={imagenCapturada}
                  alt={t('imageCapture', 'title')}
                  className="mx-auto max-w-full h-auto rounded-lg shadow-md"
                />
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <button
                    onClick={() => { setImagenCapturada(null); setMostrarCheckCamara(true) }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
                  >
                    <Camera className="w-5 h-5" />
                    <span>{t('imageCapture', 'retake')}</span>
                  </button>
                  <button
                    onClick={realizarDiagnostico}
                    disabled={isDiagnosing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDiagnosing ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /><span>{t('imageCapture', 'analyzing')}</span></>
                    ) : (
                      <span>{t('imageCapture', 'analyze')}</span>
                    )}
                  </button>
                </div>
                {errorDiagnostico && (
                  <p className="text-center text-red-600 text-sm mt-2">{errorDiagnostico}</p>
                )}
              </div>
            ) : (
              <>
                <p className="text-gray-500 mb-4">{t('imageCapture', 'subtitle')}</p>
                {errorCamara && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {errorCamara}
                  </div>
                )}
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button
                    onClick={() => { setErrorCamara(null); setMostrarCheckCamara(true) }}
                    disabled={cargandoCamara}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-5 h-5" />
                    <span>{cargandoCamara ? 'Iniciando...' : t('imageCapture', 'capture')}</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 transition"
                  >
                    <Upload className="w-5 h-5" />
                    <span>Subir imagen</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </>
            )}
          </div>

          {/* Modal de cámara — flujo inteligente */}
          {mostrarCamara && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-800">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-indigo-400" />
                    <span className="text-white text-sm font-semibold">Captura inteligente</span>
                  </div>
                  <button onClick={cerrarCamara} className="text-gray-400 hover:text-white transition p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Video con overlay */}
                <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Óvalo guía — color según calidad */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="rounded-full transition-all duration-500"
                      style={{
                        width: '52%', height: '55%',
                        border: `4px ${countdown !== null ? 'solid' : 'dashed'} ${
                          !qualityInfo ? '#facc15' :
                          qualityInfo.quality === 'good' ? '#22c55e' :
                          qualityInfo.quality === 'fair' ? '#f59e0b' : '#ef4444'
                        }`,
                        opacity: 0.85,
                        boxShadow: qualityInfo?.quality === 'good' ? '0 0 20px rgba(34,197,94,0.4)' : 'none',
                      }}
                    />
                  </div>

                  {/* Countdown overlay */}
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-20 h-20 rounded-full bg-green-500/80 flex items-center justify-center">
                        <span className="text-white text-4xl font-black">{countdown}</span>
                      </div>
                    </div>
                  )}

                  {/* Estado de calidad inferior */}
                  <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/80 to-transparent">
                    {qualityInfo ? (
                      <p className={`text-xs font-semibold text-center ${
                        qualityInfo.quality === 'good' ? 'text-green-400' :
                        qualityInfo.quality === 'fair' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {countdown !== null ? `Capturando en ${countdown}…` : qualityInfo.reason}
                      </p>
                    ) : (
                      <p className="text-yellow-300 text-xs text-center">Centra tu ojo en el óvalo</p>
                    )}
                  </div>
                </div>

                {/* Indicadores de calidad */}
                {qualityInfo && (
                  <div className="flex items-center justify-center gap-6 px-5 py-2 bg-gray-800">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-gray-400">Iluminación</span>
                      <span className={`font-bold ${qualityInfo.brightness >= 55 && qualityInfo.brightness <= 210 ? 'text-green-400' : 'text-red-400'}`}>
                        {qualityInfo.brightness >= 55 && qualityInfo.brightness <= 210 ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Zap className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-gray-400">Nitidez</span>
                      <span className={`font-bold ${qualityInfo.sharpness >= 12 ? 'text-green-400' : 'text-red-400'}`}>
                        {qualityInfo.sharpness >= 12 ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-gray-400">Calidad</span>
                      <span className={`font-bold capitalize ${
                        qualityInfo.quality === 'good' ? 'text-green-400' :
                        qualityInfo.quality === 'fair' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {qualityInfo.quality === 'good' ? 'Óptima' : qualityInfo.quality === 'fair' ? 'Regular' : 'Baja'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-3 px-5 py-4 bg-gray-900">
                  <button
                    onClick={cerrarCamara}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition text-sm font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" /> Cancelar
                  </button>
                  <button
                    onClick={capturarImagen}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition text-sm font-semibold shadow-lg"
                  >
                    <Camera className="w-4 h-4" />
                    Capturar ahora (Enter)
                  </button>
                </div>

                {/* Tip */}
                <p className="text-center text-[11px] text-gray-500 pb-3 px-4">
                  La captura automática se activa cuando la imagen es óptima · Habla despacio si activas el asistente de voz
                </p>
              </div>
            </div>
          )}

          {/* Modal de verificación de cámara */}
          {mostrarCheckCamara && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 shadow-2xl max-w-md w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Antes de continuar</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">Verifica lo siguiente para que la cámara funcione correctamente:</p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Mi cámara está físicamente encendida',
                    'Ninguna otra app está usando la cámara (Zoom, Teams, etc.)',
                    'El permiso de cámara está habilitado en el navegador',
                    'No tengo lentes puestos para la captura',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMostrarCheckCamara(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { setMostrarCheckCamara(false); setMostrarCamara(true) }}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition text-sm font-medium"
                  >
                    Sí, continuar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ImageCapture
