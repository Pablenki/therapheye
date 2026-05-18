import { useState, useEffect } from 'react';
import { Eye, EyeOff, KeyRound, CheckCircle, XCircle } from 'lucide-react';
import { sql } from '../neonCliente';
import { hashPassword } from '../utils/authHash';

interface Props {
  token: string;
  onDone: () => void; // navigate to login
}

type Status = 'validating' | 'valid' | 'invalid' | 'expired' | 'saving' | 'success';

export default function ResetPassword({ token, onDone }: Props) {
  const [status, setStatus] = useState<Status>('validating');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  // Validate token on mount
  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    (async () => {
      try {
        const rows = await sql`
          SELECT t.user_id, t.expires_at
          FROM password_reset_tokens t
          WHERE t.token = ${token}
          LIMIT 1
        `;
        if (!rows.length) { setStatus('invalid'); return; }
        const row = rows[0];
        if (new Date(row.expires_at) < new Date()) { setStatus('expired'); return; }
        setUserId(row.user_id);
        setStatus('valid');
      } catch {
        setStatus('invalid');
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }

    setStatus('saving');
    try {
      const hash = await hashPassword(password);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
      await sql`DELETE FROM password_reset_tokens WHERE token = ${token}`;
      setStatus('success');
    } catch {
      setError('Error al guardar la contraseña. Intenta de nuevo.');
      setStatus('valid');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-indigo-600 rounded-full mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Nueva contraseña</h1>
          <p className="text-gray-500 text-sm">Therapheye</p>
        </div>

        {/* Validating */}
        {status === 'validating' && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Verificando enlace...</p>
          </div>
        )}

        {/* Invalid / Expired */}
        {(status === 'invalid' || status === 'expired') && (
          <div className="text-center py-4">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-gray-800 font-semibold mb-1">
              {status === 'expired' ? 'Enlace expirado' : 'Enlace inválido'}
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {status === 'expired'
                ? 'Este enlace ya no es válido. Solicita uno nuevo desde la pantalla de inicio de sesión.'
                : 'El enlace de recuperación no es válido o ya fue usado.'}
            </p>
            <button
              onClick={onDone}
              className="text-indigo-600 font-semibold hover:text-indigo-700 text-sm"
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        )}

        {/* Form */}
        {(status === 'valid' || status === 'saving') && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-11"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="Repite la contraseña"
                required
              />
            </div>

            <button
              type="submit"
              disabled={status === 'saving'}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg disabled:opacity-50"
            >
              {status === 'saving' ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="text-center py-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-800 font-semibold mb-1">¡Contraseña actualizada!</p>
            <p className="text-gray-500 text-sm mb-6">
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <button
              onClick={onDone}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg"
            >
              Ir al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
