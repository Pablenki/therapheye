import { ArrowLeft, Eye, Focus, Maximize2, RotateCw, ZoomIn } from 'lucide-react';
import { useLanguage } from '../i18n';

interface Exercise {
  id: string;
  title: string;
  description: string;
  duration: string;
  icon: typeof Eye;
  color: string;
}

const Exercises = ({ onBack, onStartExercise }: { onBack: () => void; onStartExercise: (id: string) => void }) => {
  const { t } = useLanguage();

  const exercises: Exercise[] = [
    {
      id: 'palming',
      title: t('exercises', 'palming'),
      description: t('exercises', 'palmingDesc'),
      duration: '1-5 min',
      icon: Eye,
      color: 'bg-blue-500'
    },
    {
      id: 'focus',
      title: t('exercises', 'focus'),
      description: t('exercises', 'focusDesc'),
      duration: '1-5 min',
      icon: Focus,
      color: 'bg-green-500'
    },
    {
      id: '20-20-20',
      title: t('exercises', 'rule202020'),
      description: t('exercises', 'rule202020Desc'),
      duration: '20 seg',
      icon: Maximize2,
      color: 'bg-purple-500'
    },
    {
      id: 'circles',
      title: t('exercises', 'circles'),
      description: t('exercises', 'circlesDesc'),
      duration: '1-5 min',
      icon: RotateCw,
      color: 'bg-orange-500'
    },
    {
      id: 'near-far',
      title: t('exercises', 'nearFar'),
      description: t('exercises', 'nearFarDesc'),
      duration: '1-5 min',
      icon: ZoomIn,
      color: 'bg-teal-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('common', 'backToDashboard')}
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {t('exercises', 'title')}
          </h1>
          <p className="text-gray-600">
            {t('exercises', 'subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`${exercise.color} w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <exercise.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">
                    {exercise.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">
                    Duración: {exercise.duration}
                  </p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                {exercise.description}
              </p>

              <button
                onClick={() => onStartExercise(exercise.id)}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                {t('exercises', 'startExercise')}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            {t('exercises', 'tipsTitle')}
          </h3>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span>{t('exercises', 'tip1')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span>{t('exercises', 'tip2')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span>{t('exercises', 'tip3')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span>{t('exercises', 'tip4')}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Exercises;