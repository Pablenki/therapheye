import { ArrowLeft, Camera, X, CheckCircle, Loader2, Upload, AlertCircle } from 'lucide-react'
import { Eye } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../i18n'
import { sql } from '../neonCliente'

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
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const [cargandoCamara, setCargandoCamara] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Iniciar cámara cuando se abre el modal
  useEffect(() => {
    if (mostrarCamara) {
      iniciarCamara()
    } else {
      detenerCamara()
    }
    return () => { detenerCamara() }
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
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const capturarImagen = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const contexto = canvas.getContext('2d')
      if (contexto) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        contexto.drawImage(video, 0, 0)
        setImagenCapturada(canvas.toDataURL('image/png'))
        detenerCamara()
        setMostrarCamara(false)
      }
    }
  }

  const cerrarCamara = () => {
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

  const realizarDiagnostico = async () => {
    if (!imagenCapturada) return
    setIsDiagnosing(true)
    setErrorDiagnostico(null)
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
        const sintomaGuardar = getMostSevere(data.sintomas)
        await sql`
          CREATE TABLE IF NOT EXISTS image_capture_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            sintoma VARCHAR(100) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `.catch(() => {})
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
    const tieneSintomas = resultado.sintomas.length > 0
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{t('imageCapture', 'title')}</h2>
            <p className="text-gray-600 mb-6">{resultado.mensaje}</p>
            <div className={`rounded-xl p-6 mb-6 ${tieneSintomas ? 'bg-amber-50' : 'bg-green-50'}`}>
              <p className="text-sm text-gray-600 mb-2">Signos detectados en la imagen:</p>
              {tieneSintomas ? (
                <ul className="text-left space-y-2">
                  {resultado.sintomas.map((s, i) => (
                    <li key={i} className="font-medium text-amber-700">• {s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-lg font-semibold text-green-700">Ningún signo de fatiga visual detectado.</p>
              )}
            </div>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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

          {/* Modal de cámara */}
          {mostrarCamara && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 shadow-2xl max-w-2xl w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">{t('imageCapture', 'title')}</h3>
                  <button onClick={cerrarCamara} className="text-gray-500 hover:text-gray-700 transition">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex justify-center mb-2">
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ width: '500px', height: '400px' }}>
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Guía de posición: óvalo central */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div
                        className="border-4 border-yellow-400 border-dashed rounded-full opacity-70"
                        style={{ width: '220px', height: '160px' }}
                      />
                    </div>
                    <p className="absolute bottom-3 left-0 right-0 text-center text-yellow-300 text-xs font-medium">
                      Centra tu ojo dentro del óvalo · Presiona Enter o el botón para capturar
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 justify-center mt-4">
                  <button
                    onClick={cerrarCamara}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-500 text-white hover:bg-gray-600 transition"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span>{t('common', 'back')}</span>
                  </button>
                  <button
                    onClick={capturarImagen}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
                  >
                    <Camera className="w-5 h-5" />
                    <span>{t('imageCapture', 'capture')} (Enter)</span>
                  </button>
                </div>
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
