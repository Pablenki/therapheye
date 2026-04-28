// =========================================
// QR INFORME MÉDICO — Therapheye
// Genera QR con resumen de salud visual para compartir con especialista
// =========================================

import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, QrCode, Download, RefreshCw, Share2,
  CheckCircle, Loader2, Eye, Pill, Calendar, FileText,
  Stethoscope, AlertCircle,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';
import QRCode from 'qrcode';

interface Props { onBack: () => void; }

interface Nota {
  id: number;
  tipo: string;
  titulo: string;
  contenido: string;
  fecha: string;
}

const TIPO_ICON: Record<string, React.ElementType> = {
  diagnostico: Stethoscope,
  medicamento: Pill,
  cita: Calendar,
  observacion: FileText,
};

const TIPO_LABEL: Record<string, string> = {
  diagnostico: 'Diagnóstico',
  medicamento: 'Medicamento',
  cita: 'Próxima cita',
  observacion: 'Observación',
};

const TIPO_COLOR: Record<string, string> = {
  diagnostico: 'text-red-600 bg-red-50',
  medicamento: 'text-blue-600 bg-blue-50',
  cita: 'text-violet-600 bg-violet-50',
  observacion: 'text-amber-600 bg-amber-50',
};

export default function QRInforme({ onBack }: Props) {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [notas, setNotas] = useState<Nota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const rows = await sql`
          SELECT id, tipo, titulo, contenido, fecha FROM notas_medicas
          WHERE user_id = ${user.id}
          ORDER BY fecha DESC, id DESC
          LIMIT 20
        `;
        setNotas((rows as unknown) as Nota[]);
      } catch {
        setErrorMsg('Error cargando notas médicas.');
      }
      setLoadingNotas(false);
    };
    load();
  }, [user?.id]);

  const buildInformeText = () => {
    const lines: string[] = [
      `=== INFORME THERAPHEYE ===`,
      `Paciente: ${user?.nombre ?? 'No especificado'}`,
      `Email: ${user?.email ?? ''}`,
      `Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}`,
      ``,
    ];

    const grupos: Record<string, Nota[]> = {};
    for (const n of notas) {
      (grupos[n.tipo] ??= []).push(n);
    }

    for (const tipo of ['diagnostico', 'medicamento', 'cita', 'observacion']) {
      const lista = grupos[tipo];
      if (!lista?.length) continue;
      lines.push(`--- ${TIPO_LABEL[tipo]?.toUpperCase() ?? tipo.toUpperCase()} ---`);
      for (const n of lista) {
        lines.push(`• ${n.titulo} (${n.fecha})`);
        if (n.contenido) lines.push(`  ${n.contenido.slice(0, 80)}${n.contenido.length > 80 ? '...' : ''}`);
      }
      lines.push('');
    }

    lines.push('Therapheye — App de salud visual');
    return lines.join('\n');
  };

  const generarQR = async () => {
    setGenerando(true);
    setErrorMsg('');
    try {
      const texto = buildInformeText();
      const dataUrl = await QRCode.toDataURL(texto, {
        width: 320,
        margin: 2,
        color: { dark: '#0e1f47', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(dataUrl);
    } catch {
      setErrorMsg('Error generando el QR. El informe puede ser muy largo, intenta con menos notas.');
    }
    setGenerando(false);
  };

  const descargarQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `informe-therapheye-${user?.nombre?.replace(/\s+/g, '-') ?? 'paciente'}.png`;
    a.click();
  };

  const compartirWA = () => {
    const texto = buildInformeText();
    const msg = encodeURIComponent(texto);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(buildInformeText());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* noop */ }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-sm">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-base leading-tight">QR Informe Médico</h1>
            <p className="text-xs text-gray-500">Comparte tu historial con tu especialista</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* How it works */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { step: '1', label: 'Se carga tu historial de Notas Médicas', color: 'bg-indigo-50 text-indigo-600' },
            { step: '2', label: 'Se genera un QR con el resumen', color: 'bg-blue-50 text-blue-600' },
            { step: '3', label: 'El doctor lo escanea y lee tus datos', color: 'bg-violet-50 text-violet-600' },
          ].map(({ step, label, color }) => (
            <div key={step} className={`${color} rounded-2xl p-4 text-center`}>
              <div className="w-8 h-8 bg-white/70 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-sm">
                {step}
              </div>
              <p className="text-xs leading-snug font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Notas summary */}
        {loadingNotas ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando notas médicas...
          </div>
        ) : notas.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="font-semibold text-amber-700 text-sm">No tienes notas médicas guardadas</p>
            <p className="text-xs text-amber-600 mt-1">Agrega diagnósticos, medicamentos y citas en la sección de Notas Médicas primero.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-500" /> Vista previa del informe
                <span className="ml-auto text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{notas.length} nota{notas.length !== 1 ? 's' : ''}</span>
              </p>
            </div>
            <div className="p-4 space-y-2 max-h-52 overflow-y-auto">
              {notas.slice(0, 12).map(nota => {
                const Icon = TIPO_ICON[nota.tipo] ?? FileText;
                const cls = TIPO_COLOR[nota.tipo] ?? 'text-gray-600 bg-gray-50';
                return (
                  <div key={nota.id} className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{nota.titulo}</p>
                      <p className="text-xs text-gray-400">{TIPO_LABEL[nota.tipo]} · {nota.fecha}</p>
                    </div>
                  </div>
                );
              })}
              {notas.length > 12 && (
                <p className="text-xs text-center text-gray-400 pt-1">+{notas.length - 12} notas más</p>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3.5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* QR Display */}
        {qrDataUrl && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-lg p-6 text-center space-y-4">
            <p className="text-sm font-semibold text-gray-700">Muestra este QR a tu especialista</p>
            <div className="flex justify-center">
              <div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border-2 border-indigo-100 shadow-inner">
                <img src={qrDataUrl} alt="QR Informe" className="w-56 h-56 rounded-lg" />
              </div>
            </div>
            <p className="text-xs text-gray-400">El QR contiene tu nombre, historial de notas y medicamentos</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {notas.length > 0 && (
            <button
              onClick={generarQR}
              disabled={generando}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-semibold hover:opacity-90 disabled:opacity-60 transition shadow-xl shadow-indigo-200/60 text-sm"
            >
              {generando
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando QR...</>
                : qrDataUrl
                ? <><RefreshCw className="w-4 h-4" /> Regenerar QR</>
                : <><QrCode className="w-4 h-4" /> Generar QR del informe</>
              }
            </button>
          )}

          {qrDataUrl && (
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={descargarQR}
                className="flex flex-col items-center justify-center gap-1.5 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600 hover:text-indigo-600 hover:border-indigo-200"
              >
                <Download className="w-5 h-5" />
                <span className="text-xs font-medium">Descargar</span>
              </button>
              <button
                onClick={compartirWA}
                className="flex flex-col items-center justify-center gap-1.5 py-3 bg-white border border-gray-200 rounded-xl hover:bg-green-50 transition text-gray-600 hover:text-green-600 hover:border-green-200"
              >
                <Share2 className="w-5 h-5" />
                <span className="text-xs font-medium">WhatsApp</span>
              </button>
              <button
                onClick={copiarTexto}
                className="flex flex-col items-center justify-center gap-1.5 py-3 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 transition text-gray-600 hover:text-blue-600 hover:border-blue-200"
              >
                {copiado
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : <FileText className="w-5 h-5" />
                }
                <span className="text-xs font-medium">{copiado ? '¡Copiado!' : 'Copiar texto'}</span>
              </button>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
