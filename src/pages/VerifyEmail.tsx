import { useState, useRef } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { sql } from '../neonCliente';
import { useUser } from '../context/UserContext';
import { enviarCorreoBienvenida } from '../utils/emailService';

interface VerifyEmailProps {
  name: string;
  email: string;
  passwordHash: string;
  codigo: string;
  onBack: () => void;
  onVerified: () => void;
}

const VerifyEmail = ({ name, email, passwordHash, codigo, onBack, onVerified }: VerifyEmailProps) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { login } = useUser();

  // Manejo de inputs del código
  const handleDigitChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Auto-avanzar al siguiente input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Retroceder al input anterior al borrar
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const codigoIngresado = digits.join('');

    if (codigoIngresado.length < 6) {
      setError('Ingresa el código completo de 6 dígitos');
      return;
    }

    if (codigoIngresado !== codigo) {
      setError('Código incorrecto. Verifica tu correo e intenta de nuevo.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Código correcto - AHORA SÍ guardar en BD
      const result = await sql`
        INSERT INTO users (email, password_hash, nombre, created_at)
        VALUES (${email}, ${passwordHash}, ${name}, NOW())
        RETURNING *
      `;

      // Enviar correo de bienvenida
      await enviarCorreoBienvenida(email, name);

      // Iniciar sesión automáticamente
      login({
        id: result[0].id,
        email: result[0].email,
        nombre: result[0].nombre,
      });

      onVerified();

    } catch (err) {
      console.error('Error:', err);
      setError('Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendSuccess(false);
    setError('');

    try {
      const { generarCodigo, enviarCorreoVerificacion } = await import('../utils/emailService');
      const nuevoCodigo = generarCodigo();
      await enviarCorreoVerificacion(email, name, nuevoCodigo);
      setResendSuccess(true);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError('Error al reenviar el correo. Intenta de nuevo.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-indigo-100 rounded-full mb-4">
            <Mail className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Verifica tu correo</h1>
          <p className="text-gray-600 text-sm">
            Enviamos un código de 6 dígitos a
          </p>
          <p className="text-indigo-600 font-semibold text-sm mt-1">{email}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Éxito reenvío */}
        {resendSuccess && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
            ✅ Código reenviado. Revisa tu correo.
          </div>
        )}

        {/* Inputs del código */}
        <div className="flex gap-3 justify-center mb-8" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 transition
                         ${digit ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}`}
            />
          ))}
        </div>

        {/* Botón verificar */}
        <button
          onClick={handleVerify}
          disabled={loading || digits.join('').length < 6}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold 
                     hover:bg-indigo-700 transition duration-200 shadow-lg hover:shadow-xl 
                     disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loading ? 'Verificando...' : 'Verificar cuenta'}
        </button>

        {/* Reenviar código */}
        <p className="text-center text-sm text-gray-600">
          ¿No recibiste el código?{' '}
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-indigo-600 font-semibold hover:text-indigo-700 disabled:opacity-50"
          >
            {resending ? 'Reenviando...' : 'Reenviar'}
          </button>
        </p>

      </div>
    </div>
  );
};

export default VerifyEmail;