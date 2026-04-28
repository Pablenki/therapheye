// =========================================
// ANALIZADOR DE SÍNTOMAS AVANZADO — Therapheye
// Claude Haiku analiza síntomas específicos
// y genera diagnóstico diferencial + plan de acción
// Con sistema de triaje visual de urgencia
// =========================================

import { useState } from 'react';
import { ArrowLeft, AlertTriangle, Send, ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { callClaude } from '../utils/claudeApi';

interface Props { onBack: () => void; }

interface Sintoma {
  id: string;
  label: string;
  icon: string;
  urgencia?: 'alta'; // si está solo ya amerita alerta
}

const SINTOMAS: Sintoma[] = [
  { id: 'vision_borrosa', label: 'Visión borrosa', icon: '🌫️' },
  { id: 'vision_doble', label: 'Visión doble (diplopia)', icon: '👁️👁️', urgencia: 'alta' },
  { id: 'dolor_ocular', label: 'Dolor ocular intenso', icon: '😣', urgencia: 'alta' },
  { id: 'destellos', label: 'Destellos o luces', icon: '⚡', urgencia: 'alta' },
  { id: 'moscas_flotantes', label: 'Moscas volantes nuevas', icon: '🪰', urgencia: 'alta' },
  { id: 'perdida_campo', label: 'Pérdida de campo visual', icon: '⬛', urgencia: 'alta' },
  { id: 'ojo_rojo', label: 'Ojo rojo', icon: '🔴' },
  { id: 'picazon', label: 'Picazón / ardor', icon: '🔥' },
  { id: 'lagrimeo', label: 'Lagrimeo excesivo', icon: '💧' },
  { id: 'sensibilidad_luz', label: 'Sensibilidad a la luz', icon: '☀️' },
  { id: 'cefalea', label: 'Dolor de cabeza', icon: '🤕' },
  { id: 'cansancio_ocular', label: 'Cansancio ocular', icon: '😴' },
  { id: 'ojo_seco', label: 'Ojo seco / arenilla', icon: '🏜️' },
  { id: 'vision_nocturna', label: 'Dificultad visión nocturna', icon: '🌙' },
  { id: 'halos', label: 'Halos alrededor de luces', icon: '💫' },
  { id: 'parpados', label: 'Irritación de párpados', icon: '👁' },
];

interface AnalysisResult {
  urgencia: 'inmediata' | 'pronto' | 'rutina' | 'seguimiento';
  diagnosticos_posibles: string[];
  plan_de_accion: string[];
  señales_de_alarma: string[];
  cuando_ir_urgencias: string;
  recomendaciones_therapheye: string[];
}

const URGENCY_CONFIG = {
  inmediata: {
    label: '🚨 URGENCIA INMEDIATA',
    desc: 'Busca atención médica AHORA. Puede ser una emergencia ocular.',
    color: 'red',
    bg: 'bg-red-50 border-red-300',
    text: 'text-red-700',
  },
  pronto: {
    label: '⚠️ Consulta pronto',
    desc: 'Ve al oftalmólogo en las próximas 24-48 horas.',
    color: 'orange',
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-700',
  },
  rutina: {
    label: '📅 Consulta rutinaria',
    desc: 'Agenda una cita con tu oftalmólogo en los próximos días.',
    color: 'amber',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
  seguimiento: {
    label: '✅ Seguimiento',
    desc: 'Monitorea tus síntomas. Puedes usar Therapheye para seguimiento.',
    color: 'emerald',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
};

export default function AnalizadorSintomas({ onBack }: Props) {
  const [selectedSintomas, setSelectedSintomas] = useState<Set<string>>(new Set());
  const [duracion, setDuracion] = useState('');
  const [contexto, setContexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('diagnosticos');
  const [apiError, setApiError] = useState<string | null>(null);

  const toggleSintoma = (id: string) => {
    setSelectedSintomas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const highUrgency = SINTOMAS.filter(s => s.urgencia === 'alta' && selectedSintomas.has(s.id));

  const analizar = async () => {
    if (selectedSintomas.size === 0) return;
    setLoading(true);
    setApiError(null);
    setResult(null);

    const sintomasSeleccionados = SINTOMAS.filter(s => selectedSintomas.has(s.id)).map(s => s.label);

    const prompt = `Eres un asistente de triage oftalmológico. Analiza estos síntomas visuales y devuelve SOLO JSON válido.

Síntomas: ${sintomasSeleccionados.join(', ')}
Duración: ${duracion || 'No especificada'}
Contexto adicional: ${contexto || 'Ninguno'}

Responde en este formato JSON exacto:
{
  "urgencia": "inmediata|pronto|rutina|seguimiento",
  "diagnosticos_posibles": ["diagnóstico 1 con breve explicación", "diagnóstico 2", "diagnóstico 3"],
  "plan_de_accion": ["paso 1", "paso 2", "paso 3"],
  "señales_de_alarma": ["señal 1 que amerita ir de urgencias", "señal 2"],
  "cuando_ir_urgencias": "descripción clara de cuándo ir a urgencias",
  "recomendaciones_therapheye": ["qué hacer en la app", "ejercicio o test recomendado"]
}

Usa "inmediata" solo si hay riesgo real de pérdida de visión. Sé conservador pero útil.`;

    try {
      const data = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      });
      const text: string = data.content[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed: AnalysisResult = JSON.parse(jsonMatch[0]);
      setResult(parsed);
    } catch (e) {
      setApiError('Error al analizar. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const urg = result ? URGENCY_CONFIG[result.urgencia] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-rose-800 px-4 pt-10 pb-8 text-white">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-200"/>
          <div>
            <h1 className="text-2xl font-black">Analizador de Síntomas</h1>
            <p className="text-red-200 text-sm">Triage visual con IA · No reemplaza al médico</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Emergency banner */}
        {highUrgency.length > 0 && (
          <div className="bg-red-600 text-white rounded-2xl p-4 mb-4 animate-[bounceIn_0.3s_ease]">
            <p className="font-black text-base mb-1">🚨 Síntoma de alarma detectado</p>
            <p className="text-sm text-red-100 mb-2">
              <strong>{highUrgency.map(s => s.label).join(', ')}</strong> puede indicar una emergencia ocular.
            </p>
            <a href="tel:112" className="flex items-center gap-2 bg-white text-red-700 font-bold text-sm px-4 py-2 rounded-xl w-fit">
              <Phone className="w-4 h-4"/> Llamar emergencias
            </a>
          </div>
        )}

        {!result && (
          <>
            {/* Symptom selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <p className="font-bold text-gray-900 mb-3">¿Qué síntomas tienes?</p>
              <div className="grid grid-cols-2 gap-2">
                {SINTOMAS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleSintoma(s.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm transition ${
                      selectedSintomas.has(s.id)
                        ? s.urgencia === 'alta'
                          ? 'border-red-400 bg-red-50 text-red-800'
                          : 'border-indigo-400 bg-indigo-50 text-indigo-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-base flex-shrink-0">{s.icon}</span>
                    <span className="text-xs font-medium leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration & context */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">¿Cuánto tiempo llevas con estos síntomas?</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  placeholder="ej. 2 días, 3 horas, desde esta mañana..."
                  value={duracion}
                  onChange={e => setDuracion(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Contexto adicional (opcional)</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  placeholder="ej. uso lentes de contacto, golpe reciente, antecedentes..."
                  rows={2}
                  value={contexto}
                  onChange={e => setContexto(e.target.value)}
                />
              </div>
            </div>

            {apiError && <p className="text-red-600 text-sm mb-3">{apiError}</p>}

            <button
              onClick={analizar}
              disabled={selectedSintomas.size === 0 || loading}
              className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold text-base hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"/> Analizando...</>
              ) : (
                <><Send className="w-5 h-5"/> Analizar {selectedSintomas.size > 0 ? `(${selectedSintomas.size} síntoma${selectedSintomas.size > 1 ? 's' : ''})` : ''}</>
              )}
            </button>

            <p className="text-center text-xs text-gray-400 mt-3">
              Este análisis es orientativo. Siempre consulta a un profesional de salud.
            </p>
          </>
        )}

        {/* Results */}
        {result && urg && (
          <div className="animate-[fadeInUp_0.4s_ease] space-y-3">
            {/* Urgency card */}
            <div className={`rounded-2xl border-2 p-5 ${urg.bg}`}>
              <p className={`font-black text-lg mb-1 ${urg.text}`}>{urg.label}</p>
              <p className={`text-sm ${urg.text}`}>{urg.desc}</p>
            </div>

            {/* Collapsible sections */}
            {[
              { id: 'diagnosticos', title: '🔍 Posibles causas', items: result.diagnosticos_posibles },
              { id: 'plan', title: '📋 Plan de acción', items: result.plan_de_accion },
              { id: 'alarma', title: '🚨 Señales de alarma', items: result.señales_de_alarma },
              { id: 'therapheye', title: '👁 En Therapheye', items: result.recomendaciones_therapheye },
            ].map(sec => (
              <div key={sec.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === sec.id ? null : sec.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <p className="font-bold text-gray-900 text-sm">{sec.title}</p>
                  {expandedSection === sec.id ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                </button>
                {expandedSection === sec.id && (
                  <div className="px-4 pb-4 space-y-2">
                    {sec.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"/>
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-700">
              <strong>¿Cuándo ir a urgencias?</strong> {result.cuando_ir_urgencias}
            </div>

            <button
              onClick={() => { setResult(null); setSelectedSintomas(new Set()); }}
              className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Nuevo análisis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
