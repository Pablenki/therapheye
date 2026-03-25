import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';

const SESSION_TOKEN_KEY = 'therapeye_session_token';
const POLL_INTERVAL_MS  = 10_000; // Verificar cada 10 segundos

// Páginas donde NO se debe hacer polling (no hay sesión activa)
const AUTH_PAGES = ['login', 'register', 'verify-email'];

type Props = {
  currentPage: string;
  onForceLogout: () => void;
};

const SessionGuard = ({ currentPage, onForceLogout }: Props) => {
  const { user, logout } = useUser();
  const { t } = useLanguage();
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // No hacer polling en páginas de auth o sin usuario
    if (!user?.id || AUTH_PAGES.includes(currentPage)) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkSession = async () => {
      try {
        const localToken = localStorage.getItem(SESSION_TOKEN_KEY);
        if (!localToken) return; // Sin token local → no verificar

        const rows = await sql`
          SELECT session_token
          FROM user_sessions
          WHERE user_id = ${user.id}
          LIMIT 1
        `;

        if (rows.length === 0) return; // No hay registro en BD → skip

        const dbToken = String(rows[0].session_token);
        if (dbToken !== localToken) {
          // Otro navegador hizo login → sesión inválida aquí
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setShowExpiredModal(true);
        }
      } catch (err) {
        console.warn('[SessionGuard] Error verificando sesión:', err);
      }
    };

    // Primera verificación inmediata
    checkSession();
    // Luego cada 10 segundos
    intervalRef.current = setInterval(checkSession, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user?.id, currentPage]);

  const handleDismiss = () => {
    setShowExpiredModal(false);
    try { localStorage.removeItem(SESSION_TOKEN_KEY); } catch {}
    logout();
    onForceLogout();
  };

  if (!showExpiredModal) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <LogOut className="w-5 h-5 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">{t('common', 'sessionExpiredTitle')}</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{t('common', 'sessionExpiredMsg')}</p>
        <div className="flex justify-end mt-1">
          <button
            onClick={handleDismiss}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow"
          >
            {t('common', 'sessionExpiredOk')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionGuard;
