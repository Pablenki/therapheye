import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { sql } from '../neonCliente';
import { useLanguage } from '../i18n';
import { hashPassword } from '../utils/authHash';
import { generarCodigo, enviarCorreoVerificacion } from '../utils/emailService';

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface PasswordRequirement {
  label: string;
  valid: boolean;
}

const Register = ({ onBack, onVerify }: { onBack: () => void; onVerify: (data: { name: string; email: string; passwordHash: string; codigo: string }) => void }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { t } = useLanguage();

  // Validaciones de contraseña en tiempo real
  const passwordRequirements: PasswordRequirement[] = [
    { label: t('register', 'pwdReqMin'), valid: formData.password.length >= 8 },
    { label: t('register', 'pwdReqUpper'), valid: /[A-Z]/.test(formData.password) },
    { label: t('register', 'pwdReqLower'), valid: /[a-z]/.test(formData.password) },
    { label: t('register', 'pwdReqNumber'), valid: /[0-9]/.test(formData.password) },
  ];

  const passwordValida = passwordRequirements.every(r => r.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (!passwordValida) {
      setError(t('register', 'errorPwdReq'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('register', 'errorPwdMatch'));
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t('register', 'errorEmailFormat'));
      return;
    }

    setLoading(true);

    try {
      // Verificar si el email ya existe en BD
      const existingUser = await sql`
        SELECT email FROM users
        WHERE email = ${formData.email}
        LIMIT 1
      `;

      if (existingUser.length > 0) {
        setError(t('register', 'errorEmailExists'));
        setLoading(false);
        return;
      }

      // Hashear contraseña
      const passwordHash = await hashPassword(formData.password);

      // Generar código de verificación
      const codigo = generarCodigo();

      // Enviar correo de verificación
      await enviarCorreoVerificacion(formData.email, formData.name, codigo);

      // Pasar datos temporales a la pantalla de verificación (NO se guarda en BD todavía)
      onVerify({
        name: formData.name,
        email: formData.email,
        passwordHash,
        codigo,
      });

    } catch (err) {
      console.error('Error:', err);
      setError(t('register', 'errorGeneral'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('common', 'back')}
        </button>

        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-indigo-600 rounded-full mb-4">
            <Eye className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('register', 'title')}</h1>
          <p className="text-gray-600">{t('register', 'subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nombre */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              {t('register', 'nameLabel')}
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder={t('register', 'namePlaceholder')}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              {t('register', 'emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder={t('register', 'emailPlaceholder')}
              required
            />
          </div>

          {/* Contraseña */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              {t('register', 'passwordLabel')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-12"
                placeholder="••••••••"
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

            {/* Requisitos de contraseña */}
            {formData.password.length > 0 && (
              <div className="mt-2 space-y-1">
                {passwordRequirements.map((req, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {req.valid
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-red-400" />
                    }
                    <span className={`text-xs ${req.valid ? 'text-green-600' : 'text-red-400'}`}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              {t('register', 'confirmPasswordLabel')}
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-12
                  ${formData.confirmPassword.length > 0
                    ? formData.password === formData.confirmPassword
                      ? 'border-green-400'
                      : 'border-red-400'
                    : 'border-gray-300'
                  }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-400 mt-1">{t('register', 'errorPwdMatch')}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !passwordValida}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('register', 'submitting') : t('register', 'submit')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          {t('register', 'hasAccount')}{' '}
          <button onClick={onBack} className="text-indigo-600 font-semibold hover:text-indigo-700">
            {t('register', 'signIn')}
          </button>
        </p>
        <p className="text-center text-[10px] text-gray-400 mt-4">
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition">
            Política de Privacidad
          </a>{' '}· © {new Date().getFullYear()} Therapheye
        </p>
      </div>
    </div>
  );
};

export default Register;