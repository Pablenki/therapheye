import { useState } from 'react'
import { UserProvider } from './context/UserContext'
import { AccessibilityMenu } from './components/AccessibilityMenu'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Dashboard from './pages/Dashboard'
import Questionnaire from './pages/Questionnaire'
import Exercises from './pages/Exercises'
import ExerciseSession from './pages/ExerciseSession'
import History from './pages/History'
import ImageCapture from './pages/ImageCapture'
import VisionTest from './pages/VisionTest'
import VisualHealth from './pages/VisualHealth'

type Page =
  | 'login'
  | 'register'
  | 'verify-email'
  | 'dashboard'
  | 'questionnaire'
  | 'exercises'
  | 'exercise-session'
  | 'history'
  | 'image-capture'
  | 'vision-test'
  | 'visual-health';

interface PendingUser {
  name: string;
  email: string;
  passwordHash: string;
  codigo: string;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login')
  const [currentExerciseId, setCurrentExerciseId] = useState<string>('palming')
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null)
  const [exerciseQueue, setExerciseQueue] = useState<string[]>([])

  const handleNavigate = (page: Page) => {
    setCurrentPage(page)
  }

  const handleStartExercise = (exerciseId: string) => {
    setExerciseQueue([])
    setCurrentExerciseId(exerciseId)
    setCurrentPage('exercise-session')
  }

  // Inicia una rutina secuencial de ejercicios
  const handleStartRoutine = (ids: string[]) => {
    if (ids.length === 0) return
    const [first, ...rest] = ids
    setExerciseQueue(rest)
    setCurrentExerciseId(first)
    setCurrentPage('exercise-session')
  }

  // Llamado cuando un ejercicio de la cola termina
  const handleExerciseComplete = () => {
    if (exerciseQueue.length === 0) {
      setCurrentPage('dashboard')
    } else {
      const [next, ...rest] = exerciseQueue
      setExerciseQueue(rest)
      setCurrentExerciseId(next)
      // Forzar re-mount de ExerciseSession cambiando la key implícita vía el estado
      setCurrentPage('exercise-session')
    }
  }

  const handleVerify = (data: PendingUser) => {
    setPendingUser(data)
    setCurrentPage('verify-email')
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return (
          <Login
            onLogin={() => handleNavigate('dashboard')}
            onNavigateToRegister={() => handleNavigate('register')}
          />
        )
      case 'register':
        return (
          <Register
            onBack={() => handleNavigate('login')}
            onVerify={handleVerify}
          />
        )
      case 'verify-email':
        return pendingUser ? (
          <VerifyEmail
            name={pendingUser.name}
            email={pendingUser.email}
            passwordHash={pendingUser.passwordHash}
            codigo={pendingUser.codigo}
            onBack={() => handleNavigate('register')}
            onVerified={() => {
              setPendingUser(null)
              handleNavigate('dashboard')
            }}
          />
        ) : null
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />
      case 'questionnaire':
        return <Questionnaire onBack={() => handleNavigate('dashboard')} onStartRoutine={handleStartRoutine} />
      case 'exercises':
        return (
          <Exercises
            onBack={() => handleNavigate('dashboard')}
            onStartExercise={handleStartExercise}
          />
        )
      case 'exercise-session':
        return (
          <ExerciseSession
            key={currentExerciseId + exerciseQueue.join(',')}
            exerciseId={currentExerciseId}
            onBack={() => exerciseQueue.length > 0 ? handleNavigate('dashboard') : handleNavigate('exercises')}
            onComplete={handleExerciseComplete}
            queueRemaining={exerciseQueue.length}
          />
        )
      case 'history':
        return <History onBack={() => handleNavigate('dashboard')} onStartExercise={handleStartExercise} />
      case 'image-capture':
        return <ImageCapture onBack={() => handleNavigate('dashboard')} />
      case 'vision-test':
        return <VisionTest onBack={() => handleNavigate('dashboard')} />
      case 'visual-health':
        return <VisualHealth onBack={() => handleNavigate('dashboard')} />
      default:
        return (
          <Login
            onLogin={() => handleNavigate('dashboard')}
            onNavigateToRegister={() => handleNavigate('register')}
          />
        )
    }
  }

  return (
    <UserProvider>
      {renderPage()}
      <AccessibilityMenu />
    </UserProvider>
  )
}

export default App