import { Activity, ClipboardList, History, LogOut, Eye, Camera } from 'lucide-react';
import { useUser } from '../context/UserContext';

type Page = 'login' | 'register' | 'dashboard' | 'questionnaire' | 'exercises' | 'exercise-session' | 'history' | 'image-capture';

const Dashboard = ({ onNavigate }: { onNavigate: (page: Page) => void }) => {
  const { user } = useUser();
  const modules = [
    {
      icon: ClipboardList,
      title: 'Cuestionario Inicial',
      description: 'Evalúa tus síntomas de fatiga visual',
      color: 'bg-blue-500',
      action: () => onNavigate('questionnaire')
    },
    {
      icon: Activity,
      title: 'Ejercicios Visuales',
      description: 'Realiza ejercicios para reducir la fatiga',
      color: 'bg-green-500',
      action: () => onNavigate('exercises')
    },
    {
      icon: History,
      title: 'Historial',
      description: 'Revisa tus evaluaciones anteriores',
      color: 'bg-purple-500',
      action: () => onNavigate('history')
    },
    {
      icon: Camera,
      title: 'Captura de imagen',
      description: 'Toma una imagen para análisis visual',
      color: 'bg-red-500',
      action: () => onNavigate('image-capture')
    }
  ];

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
            onClick={() => onNavigate('login')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            ¡Bienvenido de nuevo, {user?.nombre?.split(' ').slice(0, 3).join(' ')}!
          </h2>
          <p className="text-gray-600">
            Selecciona un módulo para comenzar tu evaluación
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <button
              key={index}
              onClick={module.action}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
            >
              <div className={`${module.color} w-14 h-14 rounded-lg flex items-center justify-center mb-4`}>
                <module.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {module.title}
              </h3>
              <p className="text-gray-600">
                {module.description}
              </p>
            </button>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Resumen de tu progreso
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">0</p>
              <p className="text-gray-600 mt-1">Evaluaciones realizadas</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">0</p>
              <p className="text-gray-600 mt-1">Ejercicios completados</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">0 días</p>
              <p className="text-gray-600 mt-1">Racha actual</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;