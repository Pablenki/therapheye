// =========================================
// WIZARD IA — Configuración inteligente de accesibilidad
// Llama a Claude Haiku para sugerir settings óptimos
// =========================================

import { useState } from 'react';
import { Sparkles, X, ChevronRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AccessibilitySettings } from './accessibility.types';

interface Props {
  onApply: (partial: Partial<AccessibilitySettings>) => void;
  onClose: () => void;
  lang: 'es' | 'en';
}

type Step = 0 | 1 | 2 | 3;

const CONDITIONS = [
  { id: 'miopia',        label: 'Miopía'                },
  { id: 'hipermetropia', label: 'Hipermetropía'         },
  { id: 'astigmatismo',  label: 'Astigmatismo'          },
  { id: 'ojo_seco',      label: 'Ojo seco'              },
  { id: 'daltonismo',    label: 'Daltonismo'            },
  { id: 'luz',           label: 'Sensibilidad a la luz' },
  { id: 'dislexia',      label: 'Dislexia'             },
];

const DIFFICULTIES = [
  { id: 'letra_pequena',  label: 'Letras muy pequeñas'       },
  { id: 'colores',        label: 'Distinguir colores'         },
  { id: 'brillo',         label: 'Pantalla muy brillante'     },
  { id: 'contraste',      label: 'Poco contraste'             },
  { id: 'lectura_larga',  label: 'Leer por mucho tiempo'      },
  { id: 'cursor',         label: 'Ver el cursor del ratón'    },
];

const USAGE_OPTIONS = [
  { id: 'dia',   emoji: '☀️', label: 'Durante el día' },
  { id: 'noche', emoji: '🌙', label: 'De noche'       },
  { id: 'ambos', emoji: '🔄', label: 'Ambos'          },
];

export default function AIConfigWizard({ onApply, onClose, lang }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [age, setAge] = useState(30);
  const [conditions, setConditions] = useState<string[]>([]);
  const [usage, setUsage] = useState('ambos');
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ settings: Partial<AccessibilitySettings>; reason: string } | null>(null);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);

  const toggle = (arr: string[], setArr: (v: string[]) => void, id: string) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  const analyze = async () => {
    setLoading(true);
    setError('');
    setStep(3);

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setError('Agrega VITE_ANTHROPIC_API_KEY al archivo .env para usar la IA.');
      setLoading(false);
      return;
    }

    const condLabel = conditions.length ? conditions.join(', ') : 'ninguna';
    const diffLabel = difficulty.length ? difficulty.join(', ') : 'ninguna';
    const usageLabel = USAGE_OPTIONS.find(u => u.id === usage)?.label ?? usage;

    const prompt = `Eres experto en accesibilidad web para una app de salud visual (Therapheye, React/Tailwind).
Sugiere la configuración óptima de accesibilidad basada en el perfil del usuario.

Perfil:
- Edad: ${age} años
- Condiciones visuales: ${condLabel}
- Uso principal: ${usageLabel}
- Dificultades reportadas: ${diffLabel}

Temas disponibles:
- limpio: cards blancas, minimalista, profesional
- colorido: gradientes vivos, vibrante
- cristal: glassmorphism oscuro sobre fondo violeta
- oscuro: dark mode nativo zinc/slate
- naturaleza: verdes y esmeraldas

Modos daltonismo: none, protanopia, deuteranopia, tritanopia, achromatopsia
Fuentes: "default", "Arial, sans-serif", "Georgia, serif", "Courier New, monospace", "OpenDyslexic, sans-serif"
fontSize: 80-180 (100 = normal, 120 = grande)
zoom: 80-150 (100 = normal)

Responde ÚNICAMENTE con JSON válido, sin texto extra:
{
  "theme": "limpio" | "colorido" | "cristal" | "oscuro" | "naturaleza",
  "fontSize": número,
  "zoom": número,
  "highContrast": true | false,
  "invertColors": true | false,
  "colorBlindMode": "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia",
  "fontFamily": string,
  "bigCursor": true | false,
  "highlightLinks": true | false,
  "readAloud": true | false,
  "reason": "explicación en 1-2 oraciones en español"
}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const text = (data.content?.[0]?.text ?? '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Sin JSON en respuesta');
      const { reason, ...settings } = JSON.parse(jsonMatch[0]);
      setResult({ settings, reason });
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : 'Intenta de nuevo'}`);
    }
    setLoading(false);
  };

  const handleApply = () => {
    if (result) {
      onApply(result.settings);
      setApplied(true);
      setTimeout(onClose, 1200);
    }
  };

  const steps = [
    { label: lang === 'es' ? 'Edad' : 'Age' },
    { label: lang === 'es' ? 'Condiciones' : 'Conditions' },
    { label: lang === 'es' ? 'Uso' : 'Usage' },
    { label: lang === 'es' ? 'Resultado' : 'Result' },
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1B396B] to-[#4f46e5] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="text-white font-bold text-base">
              {lang === 'es' ? 'Configuración inteligente' : 'Smart Configuration'}
            </span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-0 px-5 pt-4 pb-2">
          {steps.map((s, i) => (
            <div key={i} className="flex-1 flex items-center">
              <div className={`flex items-center gap-1 ${i < steps.length - 1 ? 'flex-1' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all
                  ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-[#1B396B] text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ml-1 ${i === step ? 'text-[#1B396B] font-semibold' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 pb-5 pt-3 min-h-[200px]">

          {/* Step 0: Age */}
          {step === 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-4">
                {lang === 'es' ? '¿Cuántos años tienes?' : 'How old are you?'}
              </p>
              <div className="flex items-center gap-4 mb-2">
                <input
                  type="range" min={5} max={90} step={1} value={age}
                  onChange={e => setAge(Number(e.target.value))}
                  className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, #1B396B ${((age - 5) / 85) * 100}%, #e5e7eb ${((age - 5) / 85) * 100}%)` }}
                />
                <span className="w-12 text-center text-2xl font-bold text-[#1B396B]">{age}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mb-5">
                <span>5</span><span>30</span><span>60</span><span>90</span>
              </div>
              <button
                onClick={() => setStep(1)}
                className="w-full py-2.5 bg-[#1B396B] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#0d2347] transition"
              >
                {lang === 'es' ? 'Siguiente' : 'Next'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Conditions */}
          {step === 1 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">
                {lang === 'es' ? '¿Tienes alguna de estas condiciones? (opcional)' : 'Do you have any of these conditions? (optional)'}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {CONDITIONS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggle(conditions, setConditions, c.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      conditions.includes(c.id)
                        ? 'bg-[#1B396B] text-white border-[#1B396B]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#1B396B]'
                    }`}
                  >
                    {conditions.includes(c.id) ? '✓ ' : ''}{c.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(0)} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:border-gray-300 transition text-sm">
                  ← {lang === 'es' ? 'Atrás' : 'Back'}
                </button>
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 bg-[#1B396B] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#0d2347] transition text-sm">
                  {lang === 'es' ? 'Siguiente' : 'Next'} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Usage + Difficulties */}
          {step === 2 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {lang === 'es' ? '¿Cuándo usas más la app?' : 'When do you use the app most?'}
              </p>
              <div className="flex gap-2 mb-4">
                {USAGE_OPTIONS.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setUsage(u.id)}
                    className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all text-center ${
                      usage === u.id ? 'border-[#1B396B] bg-[#1B396B]/5 text-[#1B396B]' : 'border-gray-200 text-gray-500 hover:border-[#1B396B]/40'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{u.emoji}</div>
                    {u.label}
                  </button>
                ))}
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {lang === 'es' ? '¿Qué te resulta difícil? (opcional)' : 'What do you find difficult? (optional)'}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.id}
                    onClick={() => toggle(difficulty, setDifficulty, d.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      difficulty.includes(d.id)
                        ? 'bg-[#1B396B] text-white border-[#1B396B]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#1B396B]'
                    }`}
                  >
                    {difficulty.includes(d.id) ? '✓ ' : ''}{d.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:border-gray-300 transition text-sm">
                  ← {lang === 'es' ? 'Atrás' : 'Back'}
                </button>
                <button
                  onClick={analyze}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#1B396B] to-[#4f46e5] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  {lang === 'es' ? 'Analizar' : 'Analyze'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === 3 && (
            <div className="flex flex-col items-center py-2">
              {loading && (
                <>
                  <Loader2 className="w-10 h-10 text-[#1B396B] animate-spin mb-3 mt-2" />
                  <p className="text-sm text-gray-600 text-center">
                    {lang === 'es' ? 'La IA está analizando tu perfil...' : 'AI is analyzing your profile...'}
                  </p>
                </>
              )}

              {!loading && error && (
                <div className="w-full">
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                  <button onClick={() => setStep(2)} className="w-full py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:border-gray-300 transition">
                    ← {lang === 'es' ? 'Volver' : 'Back'}
                  </button>
                </div>
              )}

              {!loading && !error && result && (
                <div className="w-full">
                  {applied ? (
                    <div className="flex flex-col items-center py-4 gap-3">
                      <CheckCircle2 className="w-12 h-12 text-green-500" />
                      <p className="text-sm font-semibold text-green-700">
                        {lang === 'es' ? '¡Configuración aplicada!' : 'Configuration applied!'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-3">
                        <p className="text-xs font-semibold text-indigo-700 mb-1 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          {lang === 'es' ? 'Recomendación de la IA' : 'AI Recommendation'}
                        </p>
                        <p className="text-xs text-indigo-600">{result.reason}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mb-4 text-xs">
                        {[
                          ['Tema', result.settings.theme ?? '—'],
                          ['Fuente', (result.settings.fontFamily ?? 'default').split(',')[0]],
                          ['Tamaño', `${result.settings.fontSize ?? 100}%`],
                          ['Zoom', `${result.settings.zoom ?? 100}%`],
                          ['Contraste', result.settings.highContrast ? '✓ Activo' : '—'],
                          ['Daltonismo', result.settings.colorBlindMode === 'none' ? '—' : result.settings.colorBlindMode ?? '—'],
                        ].map(([k, v]) => (
                          <div key={k} className="bg-gray-50 rounded-lg px-2 py-1.5 flex justify-between">
                            <span className="text-gray-500">{k}</span>
                            <span className="font-semibold text-gray-700 capitalize">{v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setStep(2)} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:border-gray-300 transition">
                          ← {lang === 'es' ? 'Rehacer' : 'Redo'}
                        </button>
                        <button
                          onClick={handleApply}
                          className="flex-1 py-2.5 bg-gradient-to-r from-[#1B396B] to-[#4f46e5] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {lang === 'es' ? 'Aplicar' : 'Apply'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
