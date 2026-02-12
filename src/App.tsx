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

type Page = 'login' | 'register' | 'verify-email' | 'dashboard' | 'questionnaire' | 'exercises' | 'exercise-session' | 'history' | 'image-capture';

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

  const handleNavigate = (page: Page) => {
    setCurrentPage(page)
  }

  const handleStartExercise = (exerciseId: string) => {
    setCurrentExerciseId(exerciseId)
    setCurrentPage('exercise-session')
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
        return <Questionnaire onBack={() => handleNavigate('dashboard')} />
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
            exerciseId={currentExerciseId}
            onBack={() => handleNavigate('exercises')}
          />
        )
      case 'history':
        return <History onBack={() => handleNavigate('dashboard')} />
      case 'image-capture':
        return <ImageCapture onBack={() => handleNavigate('dashboard')} />
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