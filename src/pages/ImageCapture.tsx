import { ArrowLeft, Camera, X, CheckCircle, Loader2 } from 'lucide-react'
import { Eye } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../i18n'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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
  const [mostrarCamara, setMostrarCamara] = useState(false)
  const [imagenCapturada, setImagenCapturada] = useState<string | null>(null)
  const [diagnosticoCompletado, setDiagnosticoCompletado] = useState(false)
  const [resultado, setResultado] = useState<DiagnosticoResult | null>(null)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [errorDiagnostico, setErrorDiagnostico] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Iniciar cámara cuando se abre el modal
  useEffect(() => {
    if (mostrarCamara) {
      iniciarCamara()
    } else {
      detenerCamara()
    }

    return () => {
      detenerCamara()
    }
  }, [mostrarCamara])

  const iniciarCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
    } catch (error) {
      console.error('Error al acceder a la cámara:', error)
      alert('No se pudo acceder a la cámara. Por favor, verifica los permisos.')
      setMostrarCamara(false)
    }
  }

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
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

        const imagenData = canvas.toDataURL('image/png')
        setImagenCapturada(imagenData)
        detenerCamara()
        setMostrarCamara(false)
      }
    }
  }

  const cerrarCamara = () => {
    detenerCamara()
    setMostrarCamara(false)
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
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {t('imageCapture', 'title')}
            </h2>
            <p className="text-gray-600 mb-6">
              {resultado.mensaje}
            </p>

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

            <button
              onClick={onBack}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
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
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('common', 'backToDashboard')}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
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

          {/* Componente de cámara */}
          <div className="mt-6 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            {imagenCapturada ? (
              <div className="space-y-4">
                <img
                  src={imagenCapturada}
                  alt={t('imageCapture', 'title')}
                  className="mx-auto max-w-full h-auto rounded-lg shadow-md"
                />
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => {
                      setImagenCapturada(null)
                      setMostrarCamara(true)
                    }}
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
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('imageCapture', 'analyzing')}</span>
                      </>
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
                <p className="text-gray-500 mb-4">
                  {t('imageCapture', 'subtitle')}
                </p>
                <button
                  onClick={() => setMostrarCamara(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
                >
                  <Camera className="w-5 h-5" />
                  <span>{t('imageCapture', 'capture')}</span>
                </button>
              </>
            )}
          </div>

          {/* Modal de cámara */}
          {mostrarCamara && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 shadow-2xl max-w-2xl w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">{t('imageCapture', 'title')}</h3>
                  <button
                    onClick={cerrarCamara}
                    className="text-gray-500 hover:text-gray-700 transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="flex justify-center mb-4">
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ width: '500px', height: '400px' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
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
                    <span>{t('imageCapture', 'capture')}</span>
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

