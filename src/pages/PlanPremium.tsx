// =========================================
// PLAN PREMIUM — Therapheye
// Página de suscripción con Stripe (próximamente)
// =========================================

import { useState } from 'react';
import {
  ArrowLeft, Crown, Sparkles, Check, X, Zap, Brain,
  BarChart2, QrCode, Pill, MessageCircle, Calendar,
  Download, Infinity, Star, ChevronRight, Lock,
} from 'lucide-react';

// Feature flag: módulo Premium desactivado temporalmente en la UI
const PREMIUM_ENABLED = false;

interface Props { onBack: () => void; }

interface Feature {
  icon: React.ElementType;
  label: string;
  free: boolean | string;
  premium: boolean | string;
  highlight?: boolean;
}

const FEATURES: Feature[] = [
  { icon: MessageCircle, label: 'Chat con IA (síntomas)',      free: '5/día',     premium: 'Ilimitado', highlight: true },
  { icon: Brain,         label: 'Análisis IA avanzado',        free: '3/semana',  premium: 'Ilimitado', highlight: true },
  { icon: BarChart2,     label: 'Estadísticas y tendencias',   free: '7 días',    premium: '1 año'      },
  { icon: Download,      label: 'Exportar PDF SOAP',           free: false,       premium: true,        highlight: true },
  { icon: QrCode,        label: 'QR informe médico',           free: false,       premium: true         },
  { icon: Pill,          label: 'OCR receta médica',           free: '2/mes',     premium: 'Ilimitado', highlight: true },
  { icon: Calendar,      label: 'Agendar citas Google Cal',    free: true,        premium: true         },
  { icon: MessageCircle, label: 'Recordatorios WhatsApp',      free: true,        premium: true         },
  { icon: Infinity,      label: 'Historial completo',          free: '30 días',   premium: 'Para siempre' },
  { icon: Zap,           label: 'Sin publicidad',              free: false,       premium: true         },
  { icon: Star,          label: 'Soporte prioritario',         free: false,       premium: true         },
];

const PLAN_ANUAL_PRECIO = 79;
const PLAN_MENSUAL_PRECIO = 9.99;

// Componente stub cuando Premium está desactivado
function PremiumDisabled({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <Crown className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Premium próximamente</h2>
        <p className="text-gray-500 text-sm mb-6">El plan Premium estará disponible en una próxima versión.</p>
        <button onClick={onBack} className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
      </div>
    </div>
  );
}

export default function PlanPremium({ onBack }: Props) {
  // Feature flag: si está desactivado, mostrar placeholder
  if (!PREMIUM_ENABLED) return <PremiumDisabled onBack={onBack} />;

  const [billing, setBilling] = useState<'anual' | 'mensual'>('anual');
  const [hovered, setHovered] = useState<string | null>(null);

  const precio = billing === 'anual' ? PLAN_ANUAL_PRECIO : PLAN_MENSUAL_PRECIO;
  const periodoLabel = billing === 'anual' ? '/año' : '/mes';
  const precioMensual = billing === 'anual' ? (PLAN_ANUAL_PRECIO / 12).toFixed(0) : PLAN_MENSUAL_PRECIO.toFixed(2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Therapheye Premium</h1>
            <p className="text-xs text-white/60">Cuida tu visión sin límites</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 text-amber-300 rounded-full px-4 py-1.5 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Próximamente · Únete a la lista de espera
          </div>
          <h2 className="text-4xl font-black text-white leading-tight">
            Visión al<br />
            <span className="bg-gradient-to-r from-amber-300 to-yellow-400 bg-clip-text text-transparent">máximo nivel</span>
          </h2>
          <p className="text-white/60 text-base leading-relaxed max-w-xs mx-auto">
            IA ilimitada, exportación de informes, OCR de recetas y mucho más en un solo plan.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-1 flex gap-1 border border-white/10">
            {(['mensual', 'anual'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setBilling(opt)}
                className={`relative px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  billing === opt
                    ? 'bg-white text-indigo-900 shadow-lg'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {opt === 'mensual' ? 'Mensual' : 'Anual'}
                {opt === 'anual' && (
                  <span className="absolute -top-2 -right-2 bg-green-400 text-green-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    -34%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Price card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 border border-white/20 shadow-2xl shadow-purple-900/50">
          {/* Glow effects */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

          <div className="relative">
            <div className="flex items-end gap-1 mb-1">
              <span className="text-5xl font-black text-white">${precio}</span>
              <span className="text-white/60 text-base pb-1.5">{periodoLabel}</span>
            </div>
            {billing === 'anual' && (
              <p className="text-amber-300 text-sm font-medium mb-4">
                Solo ${precioMensual}/mes · Ahorra ${((PLAN_MENSUAL_PRECIO * 12) - PLAN_ANUAL_PRECIO).toFixed(0)} al año
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 mb-6">
              {['IA ilimitada', 'Exportar PDFs', 'Historial completo', 'Sin anuncios'].map(f => (
                <div key={f} className="flex items-center gap-1.5 text-white/90 text-xs">
                  <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            <button
              disabled
              className="w-full py-4 bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 rounded-2xl font-bold text-base hover:opacity-90 transition shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              <Lock className="w-4 h-4" />
              Próximamente con Stripe
            </button>
            <p className="text-white/40 text-xs text-center mt-3">
              Pago seguro · Cancela cuando quieras · Sin compromisos
            </p>
          </div>
        </div>

        {/* Feature comparison */}
        <div className="space-y-2">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider px-1 mb-3">Comparación de planes</p>

          {/* Header row */}
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 pb-1">
            <div />
            <p className="text-xs font-semibold text-white/50 text-center">Gratis</p>
            <p className="text-xs font-semibold text-amber-400 text-center">Premium</p>
          </div>

          {FEATURES.map(({ icon: Icon, label, free, premium, highlight }) => (
            <div
              key={label}
              onMouseEnter={() => setHovered(label)}
              onMouseLeave={() => setHovered(null)}
              className={`grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-3 rounded-2xl items-center transition-all ${
                highlight
                  ? 'bg-white/10 border border-white/10'
                  : hovered === label
                  ? 'bg-white/5'
                  : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${highlight ? 'bg-amber-400/20' : 'bg-white/10'}`}>
                  <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-amber-300' : 'text-white/60'}`} />
                </div>
                <span className={`text-sm ${highlight ? 'text-white font-medium' : 'text-white/70'}`}>{label}</span>
              </div>

              {/* Free cell */}
              <div className="text-center">
                {free === false
                  ? <X className="w-4 h-4 text-white/20 mx-auto" />
                  : free === true
                  ? <Check className="w-4 h-4 text-green-400 mx-auto" />
                  : <span className="text-xs text-white/50 font-medium">{free}</span>
                }
              </div>

              {/* Premium cell */}
              <div className="text-center">
                {premium === false
                  ? <X className="w-4 h-4 text-white/20 mx-auto" />
                  : premium === true
                  ? <Check className="w-4 h-4 text-amber-400 mx-auto" />
                  : <span className="text-xs text-amber-300 font-semibold">{premium}</span>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Waitlist CTA */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
            <Star className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">¿Quieres ser el primero?</p>
            <p className="text-white/60 text-sm mt-1">Únete a la lista de espera y recibe un mes gratis al lanzar.</p>
          </div>
          <a
            href="mailto:therapheye@gmail.com?subject=Lista de espera Premium"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 rounded-2xl font-bold text-sm hover:opacity-90 transition shadow-lg shadow-amber-400/30"
          >
            Unirme a la lista de espera <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        <p className="text-white/30 text-xs text-center pb-8">
          Therapheye Premium · Precio en USD · Sujeto a cambios antes del lanzamiento
        </p>
      </div>
    </div>
  );
}
