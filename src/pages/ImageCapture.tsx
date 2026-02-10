import { ArrowLeft, Camera } from 'lucide-react'
import { Eye } from 'lucide-react'
import { useUser } from '../context/UserContext'

type Props = {
  onBack: () => void
}

const ImageCapture = ({ onBack }: Props) => {
  const { user } = useUser()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Therapeye</h1>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al dashboard</span>
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
              <h2 className="text-2xl font-bold text-gray-800">Captura de imagen</h2>
              <p className="text-gray-600">
                {user
                  ? `Hola ${user.nombre?.split(' ').slice(0, 3).join(' ')}, aquí podrás capturar una imagen para su análisis.`
                  : 'Aquí podrás capturar una imagen para su análisis.'}
              </p>
            </div>
          </div>

          {/* Placeholder de funcionalidad futura */}
          <div className="mt-6 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <p className="text-gray-500 mb-4">
              Aquí irá el componente de cámara / carga de imagen.
            </p>
            <button
              disabled
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white opacity-60 cursor-not-allowed"
            >
              <Camera className="w-5 h-5" />
              <span>Capturar imagen (próximamente)</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ImageCapture

