import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../i18n';
import { comparePassword } from '../utils/authHash';
import { enviarCorreoResetPassword } from '../utils/emailService';

type View = 'login' | 'forgot' | 'forgot-sent';

const Login = ({ onLogin, onNavigateToRegister }: { onLogin: () => void; onNavigateToRegister: () => void }) => {
  const [view, setView] = useState<View>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const { login } = useUser();
  const { t } = useLanguage();

  // ── Login ────────────────────────────────────────────────────────────────────

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
      const passwordValida = await comparePassword(password, user.password_hash);

      if (passwordValida) {
        const sessionToken = crypto.randomUUID();
        try {
          await sql`
            INSERT INTO user_sessions (user_id, session_token, updated_at)
            VALUES (${user.id}, ${sessionToken}, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET session_token = ${sessionToken}, updated_at = NOW()
          `;
        } catch (err) {
          console.warn('[Login] Error guardando session token:', err);
        }
        try { localStorage.setItem('therapeye_session_token', sessionToken); } catch {}

        try {
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

        const userData = {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          foto_perfil: user.foto_perfil ?? null,
          fecha_nacimiento: user.fecha_nacimiento ?? null,
        };
        login(userData);
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

  // ── Forgot password ───────────────────────────────────────────────────────────

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Crear tabla si no existe
      await sql`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id         SERIAL PRIMARY KEY,
          user_id    TEXT        NOT NULL,
          token      TEXT        NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      // Buscar usuario — siempre mostramos el mismo mensaje (seguridad)
      const rows = await sql`
        SELECT id, nombre FROM users WHERE email = ${forgotEmail} LIMIT 1
      `;

      if (rows.length > 0) {
        const user = rows[0];
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

        // Borrar tokens previos del usuario
        await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;

        await sql`
          INSERT INTO password_reset_tokens (user_id, token, expires_at)
          VALUES (${user.id}, ${token}, ${expiresAt})
        `;

        const resetUrl = `${window.location.origin}/#reset-password?token=${token}`;
        await enviarCorreoResetPassword(forgotEmail, user.nombre, resetUrl);
      }

      // Siempre mostramos éxito para no revelar si el correo existe
      setView('forgot-sent');
    } catch (err) {
      console.error('[ForgotPassword]', err);
      setError('Ocurrió un error. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-indigo-600 rounded-full mb-4">
            <Eye className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {view === 'login' ? t('login', 'title') : view === 'forgot' ? '¿Olvidaste tu contraseña?' : 'Revisa tu correo'}
          </h1>
          <p className="text-gray-600">
            {view === 'login'
              ? t('login', 'subtitle')
              : view === 'forgot'
              ? 'Te enviaremos un enlace para crear una nueva contraseña.'
              : ''}
          </p>
        </div>

        {/* ── Login form ── */}
        {view === 'login' && (
          <>
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
              <div className="text-right mt-1.5">
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError(''); setForgotEmail(email); }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  ¿Olvidaste tu contraseña?
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
          </>
        )}

        {/* ── Forgot password form ── */}
        {view === 'forgot' && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleForgot} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo electrónico de tu cuenta
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="tu@correo.com"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-5">
              <button
                onClick={() => { setView('login'); setError(''); }}
                className="text-indigo-600 font-semibold hover:text-indigo-700"
              >
                ← Volver al inicio de sesión
              </button>
            </p>
          </>
        )}

        {/* ── Sent confirmation ── */}
        {view === 'forgot-sent' && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">📬</div>
            <p className="text-gray-700 font-semibold mb-2">Enlace enviado</p>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              Si ese correo está registrado en Therapheye, recibirás un enlace para restablecer tu contraseña en los próximos minutos. Revisa también la carpeta de spam.
            </p>
            <button
              onClick={() => { setView('login'); setError(''); }}
              className="text-indigo-600 font-semibold hover:text-indigo-700 text-sm"
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-400 mt-6">
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition">
            Política de Privacidad
          </a>{' '}· © {new Date().getFullYear()} Therapheye
        </p>
      </div>
    </div>
  );
};

export default Login;
