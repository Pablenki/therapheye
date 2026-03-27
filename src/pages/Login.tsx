import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import bcrypt from 'bcryptjs';

const Login = ({ onLogin, onNavigateToRegister }: { onLogin: () => void; onNavigateToRegister: () => void }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useUser();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await sql`
        SELECT * FROM users 
        WHERE email = ${email}
        LIMIT 1
      `;

      if (result.length === 0) {
        setError(t('login', 'error'));
        setLoading(false);
        return;
      }

      const user = result[0];

      // Comparar contraseña con bcrypt
      const passwordValida = await bcrypt.compare(password, user.password_hash);

      if (passwordValida) {
        // Generar token de sesión único para control de sesión única
        const sessionToken = crypto.randomUUID();
        // Guardar token en BD (sobrescribe el anterior → invalida otros navegadores)
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS user_sessions (
              user_id TEXT PRIMARY KEY,
              session_token TEXT NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          `;
          await sql`
            INSERT INTO user_sessions (user_id, session_token, updated_at)
            VALUES (${user.id}, ${sessionToken}, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET session_token = ${sessionToken}, updated_at = NOW()
          `;
        } catch (err) {
          console.warn('[Login] Error guardando session token:', err);
        }
        // Guardar token en localStorage para que SessionGuard lo compare
        try { localStorage.setItem('therapeye_session_token', sessionToken); } catch {}

        // Cargar preferencias del usuario desde BD → guardarlas en localStorage
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS user_preferences (
              user_id TEXT PRIMARY KEY,
              notify_on_login BOOLEAN NOT NULL DEFAULT false,
              onboarding_completed BOOLEAN NOT NULL DEFAULT false,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          `;
          const prefRows = await sql`
            SELECT notify_on_login, onboarding_completed
            FROM user_preferences
            WHERE user_id = ${user.id}
            LIMIT 1
          `;
          if (prefRows.length > 0) {
            const p = prefRows[0];
            localStorage.setItem('therapeye_timer_prefs', JSON.stringify({
              notifyOnLogin: Boolean(p.notify_on_login),
              onboardingCompleted: Boolean(p.onboarding_completed),
            }));
          }
        } catch (err) {
          console.warn('[Login] Error cargando preferencias:', err);
        }

        const userData = { id: user.id, email: user.email, nombre: user.nombre };
        login(userData); // UserContext guarda en localStorage automáticamente
        onLogin();
      } else {
        setError(t('login', 'error'));
      }

    } catch (err) {
      setError(t('login', 'errorGeneral'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-indigo-600 rounded-full mb-4">
            <Eye className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('login', 'title')}</h1>
          <p className="text-gray-600">{t('login', 'subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              {t('login', 'emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder={t('login', 'emailPlaceholder')}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              {t('login', 'passwordLabel')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-12"
                placeholder={t('login', 'passwordPlaceholder')}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {loading ? t('login', 'submitting') : t('login', 'submit')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          {t('login', 'noAccount')}{' '}
          <button onClick={onNavigateToRegister} className="text-indigo-600 font-semibold hover:text-indigo-700">
            {t('login', 'registerHere')}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;