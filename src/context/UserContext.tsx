import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { sql } from '../neonCliente';

interface User {
  id: string;
  email: string;
  nombre: string;
}

interface UserContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isRestoringSession: boolean;  // true mientras valida sesión guardada
  wasManualLogin: boolean;      // true solo cuando el usuario hizo click en "Iniciar sesión"
  clearManualLogin: () => void; // limpiar la flag después de consumirla
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_KEY = 'therapeye_user';
const TOKEN_KEY = 'therapeye_session_token';

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true); // arranca validando
  const [wasManualLogin, setWasManualLogin] = useState(false);

  // Al montar, intentar restaurar sesión desde localStorage
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedUser = localStorage.getItem(USER_KEY);
        const savedToken = localStorage.getItem(TOKEN_KEY);

        if (!savedUser || !savedToken) {
          setIsRestoringSession(false);
          return;
        }

        const userData: User = JSON.parse(savedUser);
        if (!userData.id || !userData.email) {
          setIsRestoringSession(false);
          return;
        }

        // Validar que el token siga siendo válido en la BD
        const rows = await sql`
          SELECT session_token FROM user_sessions
          WHERE user_id = ${userData.id} LIMIT 1
        `;

        if (rows.length > 0 && String(rows[0].session_token) === savedToken) {
          // Sesión válida → restaurar usuario
          setUser(userData);
        } else {
          // Token inválido (otra sesión lo reemplazó) → limpiar
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch (err) {
        console.warn('[UserContext] Error restaurando sesión:', err);
        // Si falla la BD pero hay datos locales, restaurar de todas formas
        // (mejor UX que forzar login por un error de red momentáneo)
        try {
          const savedUser = localStorage.getItem(USER_KEY);
          if (savedUser) {
            const userData: User = JSON.parse(savedUser);
            if (userData.id && userData.email) {
              setUser(userData);
            }
          }
        } catch { /* noop */ }
      } finally {
        setIsRestoringSession(false);
      }
    };

    restoreSession();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    setWasManualLogin(true); // login activo por click del usuario
    // Guardar en localStorage para persistir y para la extensión
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch {}
  };

  const clearManualLogin = () => setWasManualLogin(false);

  const logout = () => {
    setUser(null);
    // Limpiar datos de usuario y sesión de localStorage para que la extensión lo detecte
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {};
  };

  const isAuthenticated = user !== null;

  return (
    <UserContext.Provider value={{ user, login, logout, isAuthenticated, isRestoringSession, wasManualLogin, clearManualLogin }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser debe ser usado dentro de UserProvider');
  }
  return context;
};
