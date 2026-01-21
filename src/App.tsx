import { useState } from 'react'
import { UserProvider } from './context/UserContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Questionnaire from './pages/Questionnaire'
import Exercises from './pages/Exercises'
import ExerciseSession from './pages/ExerciseSession'
import History from './pages/History'

type Page = 'login' | 'register' | 'dashboard' | 'questionnaire' | 'exercises' | 'exercise-session' | 'history';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login')
  const [currentExerciseId, setCurrentExerciseId] = useState<string>('palming')

  const handleNavigate = (page: Page) => {
    setCurrentPage(page)
  }

  const handleStartExercise = (exerciseId: string) => {
    setCurrentExerciseId(exerciseId)
    setCurrentPage('exercise-session')
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
            onRegister={() => handleNavigate('dashboard')}
          />
        )
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
    </UserProvider>
  )
}

export default App