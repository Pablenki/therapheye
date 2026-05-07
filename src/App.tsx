import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { UserProvider, useUser } from './context/UserContext'
import { LanguageProvider } from './i18n'
import { AccessibilityMenu } from './components/AccessibilityMenu'
import GlobalTimerWidget from './components/GlobalTimerWidget'
import SessionGuard from './components/SessionGuard'
import ErrorBoundary from './components/ErrorBoundary'
import AppShell from './layouts/AppShell'
import Onboarding, { isOnboardingDone } from './components/Onboarding'
import OnboardingPreference, { isPreferenceDone } from './components/OnboardingPreference'
import TourGuide from './components/TourGuide'
import FeatureShowcase, { isShowcaseDone } from './components/FeatureShowcase'
import PresenceDetector from './components/PresenceDetector'
import BuenosDias, { shouldShowBuenosDias } from './components/BuenosDias'
import { useReporteSemanal } from './hooks/useReporteSemanal'
import { runMigrations } from './utils/migrations'

// ── Eager (shell crítico) ────────────────────────────────────────────────────
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Dashboard from './pages/Dashboard'

// ── Lazy (se cargan al navegar) ──────────────────────────────────────────────
const Questionnaire      = lazy(() => import('./pages/Questionnaire'))
const Exercises          = lazy(() => import('./pages/Exercises'))
const ExerciseSession    = lazy(() => import('./pages/ExerciseSession'))
const History            = lazy(() => import('./pages/History'))
const ImageCapture       = lazy(() => import('./pages/ImageCapture'))
const VisionTest         = lazy(() => import('./pages/VisionTest'))
const VisualHealth       = lazy(() => import('./pages/VisualHealth'))
const Profile            = lazy(() => import('./pages/Profile'))
const DiagnosticoCompleto= lazy(() => import('./pages/DiagnosticoCompleto'))
const Learn              = lazy(() => import('./pages/Learn'))
const BlinkDetector      = lazy(() => import('./pages/BlinkDetector'))
const LecturaVisual      = lazy(() => import('./pages/LecturaVisual'))
const ChatSintomas       = lazy(() => import('./pages/ChatSintomas'))
const MapaOftalmologos   = lazy(() => import('./pages/MapaOftalmologos'))
const JuegosVisuales     = lazy(() => import('./pages/JuegosVisuales'))
const RutinasIA          = lazy(() => import('./pages/RutinasIA'))
const DiarioVisual       = lazy(() => import('./pages/DiarioVisual'))
const CampoVisual        = lazy(() => import('./pages/CampoVisual'))
const ModoZen            = lazy(() => import('./pages/ModoZen'))
const ContrastTest       = lazy(() => import('./pages/ContrastTest'))
const ReaccionVisual     = lazy(() => import('./pages/ReaccionVisual'))
const VergenciaTraining  = lazy(() => import('./pages/VergenciaTraining'))
const CargaVisual        = lazy(() => import('./pages/CargaVisual'))
const NotasMedicas       = lazy(() => import('./pages/NotasMedicas'))
const SimuladorCondiciones= lazy(() => import('./pages/SimuladorCondiciones'))
const TestCromatico      = lazy(() => import('./pages/TestCromatico'))
const TestAcomodacion    = lazy(() => import('./pages/TestAcomodacion'))
const EjerciciosAvanzados= lazy(() => import('./pages/EjerciciosAvanzados'))
const HistorialOcular    = lazy(() => import('./pages/HistorialOcular'))
const AnalizadorSintomas = lazy(() => import('./pages/AnalizadorSintomas'))
const GaleriaCaptures    = lazy(() => import('./pages/GaleriaCaptures'))
const EntrenamientoMental= lazy(() => import('./pages/EntrenamientoMental'))
const EstadisticasAvanzadas= lazy(() => import('./pages/EstadisticasAvanzadas'))
const OCRReceta           = lazy(() => import('./pages/OCRReceta'))
const QRInforme           = lazy(() => import('./pages/QRInforme'))
const RecordatoriosWA     = lazy(() => import('./pages/RecordatoriosWA'))
const PlanPremium         = lazy(() => import('./pages/PlanPremium'))
const AmslerGrid          = lazy(() => import('./pages/AmslerGrid'))
const DominanciaOcular    = lazy(() => import('./pages/DominanciaOcular'))
const Respiracion478      = lazy(() => import('./pages/Respiracion478'))
const EvolucionTests      = lazy(() => import('./pages/EvolucionTests'))

// ── Skeleton de carga entre páginas ─────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" style={{ borderWidth: 3 }}/>
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    </div>
  )
}

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
  | 'mapa-oftalmologos'
  | 'juegos-visuales'
  | 'rutinas-ia'
  | 'diario-visual'
  | 'campo-visual'
  | 'modo-zen'
  | 'contrast-test'
  | 'reaccion-visual'
  | 'vergencia'
  | 'carga-visual'
  | 'notas-medicas'
  | 'simulador'
  | 'test-cromatico'
  | 'test-acomodacion'
  | 'ejercicios-avanzados'
  | 'historial-ocular'
  | 'analizador-sintomas'
  | 'galeria-captures'
  | 'entrenamiento-mental'
  | 'estadisticas-avanzadas'
  | 'ocr-receta'
  | 'qr-informe'
  | 'recordatorios-wa'
  | 'plan-premium'
  | 'amsler-grid'
  | 'dominancia-ocular'
  | 'respiracion-478'
  | 'evolucion-tests';

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
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPreference, setShowPreference] = useState(false)
  const [showBuenosDias, setShowBuenosDias] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [showShowcase, setShowShowcase] = useState(false)
  const [pageKey, setPageKey] = useState(0) // for transition animation
  const isPopstateRef = useRef(false)
  useReporteSemanal()

  // ── Browser Back Button support via History API ──────────────────────────────
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      const page = e.state?.page as Page | undefined
      if (page) {
        isPopstateRef.current = true
        setCurrentPage(page)
        setPageKey(k => k + 1)
      }
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // Ejecutar migraciones al autenticar
  useEffect(() => {
    if (isAuthenticated) runMigrations();
  }, [isAuthenticated])

  // Cuando se restaura la sesión, ir al dashboard
  useEffect(() => {
    if (!isRestoringSession && isAuthenticated && currentPage === 'login') {
      setCurrentPage('dashboard')
      if (!isOnboardingDone()) setShowOnboarding(true)
      else if (!isShowcaseDone()) setTimeout(() => setShowShowcase(true), 800)
      else if (shouldShowBuenosDias()) setShowBuenosDias(true)
    }
  }, [isRestoringSession, isAuthenticated, currentPage])

  // Al hacer login también mostrar onboarding/showcase si aplica
  const handleNavigate = useCallback((page: Page) => {
    setCurrentPage(prev => {
      // Push state only if it's a real navigation (not popstate)
      if (!isPopstateRef.current && prev !== page) {
        window.history.pushState({ page }, '', `#${page}`)
      }
      isPopstateRef.current = false
      return page
    })
    setPageKey(k => k + 1)
    if (page === 'dashboard' && !isOnboardingDone()) setShowOnboarding(true)
    else if (page === 'dashboard' && !isShowcaseDone()) setTimeout(() => setShowShowcase(true), 800)
  }, [])

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
        return <DiagnosticoCompleto onBack={() => handleNavigate('dashboard')} onNavigate={(p) => handleNavigate(p as any)} />
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
      case 'juegos-visuales':
        return <JuegosVisuales onBack={() => handleNavigate('dashboard')} />
      case 'rutinas-ia':
        return <RutinasIA onBack={() => handleNavigate('dashboard')} onStartExercise={handleStartExercise} />
      case 'diario-visual':
        return <DiarioVisual onBack={() => handleNavigate('dashboard')} />
      case 'campo-visual':
        return <CampoVisual onBack={() => handleNavigate('dashboard')} />
      case 'modo-zen':
        return <ModoZen onBack={() => handleNavigate('dashboard')} />
      case 'contrast-test':
        return <ContrastTest onBack={() => handleNavigate('dashboard')} />
      case 'reaccion-visual':
        return <ReaccionVisual onBack={() => handleNavigate('dashboard')} />
      case 'vergencia':
        return <VergenciaTraining onBack={() => handleNavigate('dashboard')} />
      case 'carga-visual':
        return <CargaVisual onBack={() => handleNavigate('dashboard')} />
      case 'notas-medicas':
        return <NotasMedicas onBack={() => handleNavigate('dashboard')} onNavigate={(p) => handleNavigate(p as Page)} />
      case 'simulador':
        return <SimuladorCondiciones onBack={() => handleNavigate('dashboard')} />
      case 'test-cromatico':
        return <TestCromatico onBack={() => handleNavigate('dashboard')} />
      case 'test-acomodacion':
        return <TestAcomodacion onBack={() => handleNavigate('dashboard')} />
      case 'ejercicios-avanzados':
        return <EjerciciosAvanzados onBack={() => handleNavigate('dashboard')} onStartExercise={handleStartExercise} />
      case 'historial-ocular':
        return <HistorialOcular onBack={() => handleNavigate('dashboard')} />
      case 'analizador-sintomas':
        return <AnalizadorSintomas onBack={() => handleNavigate('dashboard')} />
      case 'galeria-captures':
        return <GaleriaCaptures onBack={() => handleNavigate('dashboard')} onNavigate={(p) => handleNavigate(p as Page)} />
      case 'entrenamiento-mental':
        return <EntrenamientoMental onBack={() => handleNavigate('dashboard')} />
      case 'estadisticas-avanzadas':
        return <EstadisticasAvanzadas onBack={() => handleNavigate('dashboard')} />
      case 'ocr-receta':
        return <OCRReceta onBack={() => handleNavigate('dashboard')} />
      case 'qr-informe':
        return <QRInforme onBack={() => handleNavigate('dashboard')} />
      case 'recordatorios-wa':
        return <RecordatoriosWA onBack={() => handleNavigate('dashboard')} />
      case 'plan-premium':
        return <PlanPremium onBack={() => handleNavigate('dashboard')} />
      case 'amsler-grid':
        return <AmslerGrid onBack={() => handleNavigate('dashboard')} />
      case 'dominancia-ocular':
        return <DominanciaOcular onBack={() => handleNavigate('dashboard')} />
      case 'respiracion-478':
        return <Respiracion478 onBack={() => handleNavigate('dashboard')} />
      case 'evolucion-tests':
        return <EvolucionTests onBack={() => handleNavigate('dashboard')} />
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
        <div className="flex-1">
          <ErrorBoundary onReset={() => handleNavigate('login')}>
            <Suspense fallback={<PageLoader/>}>
              <div key={pageKey} className="animate-[fadeIn_0.15s_ease]">{renderPageContent()}</div>
            </Suspense>
          </ErrorBoundary>
        </div>
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
        onStartTour={() => setShowShowcase(true)}
      >
        <ErrorBoundary onReset={() => handleNavigate('dashboard')}>
          <Suspense fallback={<PageLoader/>}>
            <div key={pageKey} className="animate-[fadeIn_0.15s_ease]">{renderPageContent()}</div>
          </Suspense>
        </ErrorBoundary>
      </AppShell>
      <GlobalTimerWidget currentPage={currentPage} onNavigate={handleNavigate} />
      <SessionGuard currentPage={currentPage} onForceLogout={() => setCurrentPage('login')} />
      <AccessibilityMenu />
      <PresenceDetector />
      {showOnboarding && (
        <Onboarding
          onDone={() => {
            setShowOnboarding(false);
            if (!isPreferenceDone()) setTimeout(() => setShowPreference(true), 400);
            else if (!isShowcaseDone()) setTimeout(() => setShowShowcase(true), 500);
          }}
        />
      )}
      {showPreference && (
        <OnboardingPreference
          onDone={() => {
            setShowPreference(false);
            if (!isShowcaseDone()) setTimeout(() => setShowShowcase(true), 400);
          }}
        />
      )}
      <FeatureShowcase
        active={showShowcase}
        onClose={() => setShowShowcase(false)}
      />
      <TourGuide
        active={showTour}
        onClose={() => setShowTour(false)}
      />
      {showBuenosDias && !showOnboarding && (
        <BuenosDias
          onStartExercise={(id) => { setShowBuenosDias(false); handleStartExercise(id); }}
          onNavigate={(page) => { setShowBuenosDias(false); handleNavigate(page as Page); }}
        />
      )}
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
