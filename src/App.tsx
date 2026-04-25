import { useState, useEffect } from 'react'
import { UserProvider, useUser } from './context/UserContext'
import { LanguageProvider } from './i18n'
import { AccessibilityMenu } from './components/AccessibilityMenu'
import GlobalTimerWidget from './components/GlobalTimerWidget'
import SessionGuard from './components/SessionGuard'
import AppShell from './layouts/AppShell'
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
import Profile from './pages/Profile'
import DiagnosticoCompleto from './pages/DiagnosticoCompleto'
import Learn from './pages/Learn'
import BlinkDetector from './pages/BlinkDetector'
import LecturaVisual from './pages/LecturaVisual'
import ChatSintomas from './pages/ChatSintomas'
import MapaOftalmologos from './pages/MapaOftalmologos'

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
  | 'visual-health'
  | 'profile'
  | 'diagnostico-completo'
  | 'learn'
  | 'blink-detector'
  | 'reading-test'
  | 'chat-sintomas'
  | 'mapa-oftalmologos';

interface PendingUser {
  name: string;
  email: string;
  passwordHash: string;
  codigo: string;
}

// ─── Inner app (has access to UserContext) ────────────────────────────────────

function AppContent() {
  const { isAuthenticated, isRestoringSession } = useUser()
  const [currentPage, setCurrentPage] = useState<Page>('login')
  const [currentExerciseId, setCurrentExerciseId] = useState<string>('palming')
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null)
  const [exerciseQueue, setExerciseQueue] = useState<string[]>([])

  // Cuando se restaura la sesión, ir al dashboard
  useEffect(() => {
    if (!isRestoringSession && isAuthenticated && currentPage === 'login') {
      setCurrentPage('dashboard')
    }
  }, [isRestoringSession, isAuthenticated, currentPage])

  const handleNavigate = (page: Page) => {
    setCurrentPage(page)
  }

  const handleStartExercise = (exerciseId: string) => {
    setExerciseQueue([])
    setCurrentExerciseId(exerciseId)
    setCurrentPage('exercise-session')
  }

  const handleStartRoutine = (ids: string[]) => {
    if (ids.length === 0) return
    const [first, ...rest] = ids
    setExerciseQueue(rest)
    setCurrentExerciseId(first)
    setCurrentPage('exercise-session')
  }

  const handleExerciseComplete = () => {
    if (exerciseQueue.length === 0) {
      setCurrentPage('dashboard')
    } else {
      const [next, ...rest] = exerciseQueue
      setExerciseQueue(rest)
      setCurrentExerciseId(next)
      setCurrentPage('exercise-session')
    }
  }

  const handleVerify = (data: PendingUser) => {
    setPendingUser(data)
    setCurrentPage('verify-email')
  }

  // Mientras restaura sesión, mostrar loading sencillo
  if (isRestoringSession) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#eef2ff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👁</div>
          <div style={{ color: '#4f46e5', fontWeight: 600, fontSize: '16px' }}>Therapheye</div>
          <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>Cargando sesión...</div>
        </div>
      </div>
    )
  }

  // Pages that don't need the sidebar shell
  const isPublicPage = currentPage === 'login' || currentPage === 'register' || currentPage === 'verify-email';

  const renderPageContent = () => {
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
      case 'profile':
        return <Profile onBack={() => handleNavigate('dashboard')} onLogout={() => { handleNavigate('login') }} />
      case 'diagnostico-completo':
        return <DiagnosticoCompleto onBack={() => handleNavigate('dashboard')} />
      case 'learn':
        return <Learn onBack={() => handleNavigate('dashboard')} />
      case 'blink-detector':
        return <BlinkDetector onBack={() => handleNavigate('dashboard')} />
      case 'reading-test':
        return <LecturaVisual onBack={() => handleNavigate('dashboard')} />
      case 'chat-sintomas':
        return <ChatSintomas onBack={() => handleNavigate('dashboard')} />
      case 'mapa-oftalmologos':
        return <MapaOftalmologos onBack={() => handleNavigate('dashboard')} />
      default:
        return (
          <Login
            onLogin={() => handleNavigate('dashboard')}
            onNavigateToRegister={() => handleNavigate('register')}
          />
        )
    }
  }

  if (isPublicPage) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">{renderPageContent()}</div>
        <footer className="w-full py-4 text-center text-xs text-gray-400 bg-transparent">
          <span>&copy; {new Date().getFullYear()} Therapheye</span>
          <span className="mx-2">·</span>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 underline underline-offset-2 transition-colors">
            Política de Privacidad
          </a>
        </footer>
        <GlobalTimerWidget currentPage={currentPage} onNavigate={handleNavigate} />
        <SessionGuard currentPage={currentPage} onForceLogout={() => setCurrentPage('login')} />
        <AccessibilityMenu />
      </div>
    )
  }

  return (
    <>
      <AppShell
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={() => setCurrentPage('login')}
      >
        {renderPageContent()}
      </AppShell>
      <GlobalTimerWidget currentPage={currentPage} onNavigate={handleNavigate} />
      <SessionGuard currentPage={currentPage} onForceLogout={() => setCurrentPage('login')} />
      <AccessibilityMenu />
    </>
  )
}

// ─── Root App (provides context) ─────────────────────────────────────────────

function App() {
  return (
    <UserProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </UserProvider>
  )
}

export default App
