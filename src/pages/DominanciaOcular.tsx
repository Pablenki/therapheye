// =========================================
// TEST DE DOMINANCIA OCULAR — Therapheye
// Determina cuál es el ojo dominante del usuario
// =========================================

import { useState } from 'react';
import { ArrowLeft, ChevronRight, Eye, RotateCcw } from 'lucide-react';

interface Props { onBack: () => void }

type Step = 'intro' | 'test1' | 'test2' | 'test3' | 'result';

interface Answers {
  t1: 'right' | 'left' | null; // Hole-in-card
  t2: 'right' | 'left' | null; // Pointing test
  t3: 'right' | 'left' | null; // Preferred eye
}

const calcDominant = (a: Answers): 'right' | 'left' | 'equal' => {
  const votes = [a.t1, a.t2, a.t3];
  const right = votes.filter(v => v === 'right').length;
  const left  = votes.filter(v => v === 'left').length;
  if (right > left) return 'right';
  if (left > right) return 'left';
  return 'equal';
};

export default function DominanciaOcular({ onBack }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<Answers>({ t1: null, t2: null, t3: null });

  const dominant = calcDominant(answers);

  const setAnswer = (key: keyof Answers, val: 'right' | 'left') => {
    setAnswers(a => ({ ...a, [key]: val }));
  };

  const EyeButton = ({ eye, selected, onClick }: { eye: 'right' | 'left'; selected: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`flex-1 py-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition border-2 ${
        selected
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
          : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      <Eye className="w-6 h-6"/>
      Ojo {eye === 'right' ? 'Derecho' : 'Izquierdo'}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Dominancia Ocular</h1>
          <p className="text-gray-400 text-xs">3 tests simples · ~2 minutos</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {step === 'intro' && (
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white text-center">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-90"/>
              <h2 className="text-xl font-black mb-2">¿Cuál es tu ojo dominante?</h2>
              <p className="text-white/80 text-sm leading-relaxed">
                El ojo dominante es el que el cerebro prefiere para enfocar. Importante para deportes, fotografía y corrección visual.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-800">¿Qué haremos?</h3>
              {[
                { n: '1', t: 'Test del triángulo', d: 'Alinea un objeto usando tus manos' },
                { n: '2', t: 'Test de puntería',   d: 'Apunta con el dedo y cierra ojos alternativamente' },
                { n: '3', t: 'Test de preferencia', d: 'Responde cuál ojo ves mejor al mirar' },
              ].map(({ n, t, d }) => (
                <div key={n} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center flex-shrink-0">{n}</div>
                  <div>
                    <p className="text-gray-800 font-semibold text-sm">{t}</p>
                    <p className="text-gray-400 text-xs">{d}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('test1')}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              Empezar <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        )}

        {step === 'test1' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">1</div>
                <h2 className="font-bold text-gray-800">Test del triángulo</h2>
              </div>

              <div className="bg-indigo-50 rounded-2xl p-4 mb-4">
                <ol className="space-y-2 text-gray-700 text-sm">
                  <li>1. Forma un pequeño triángulo con ambas manos uniendo los pulgares e índices.</li>
                  <li>2. Con ambos ojos abiertos, elige un punto lejano (una esquina, un interruptor) y céntralo dentro del triángulo.</li>
                  <li>3. Ahora cierra el ojo <strong>derecho</strong>. ¿El objeto se desplazó mucho del triángulo?</li>
                  <li>4. Abre el derecho y cierra el <strong>izquierdo</strong>. ¿Ahora se desplazó?</li>
                </ol>
              </div>

              {/* Visual illustration */}
              <div className="flex justify-center mb-4">
                <div className="text-5xl">🤲🔺👁️</div>
              </div>

              <p className="text-gray-700 font-semibold text-sm mb-3">Al cerrar ¿cuál ojo mantuvo el objeto <em>dentro</em> del triángulo?</p>
              <p className="text-gray-400 text-xs mb-4">El ojo que al cerrarlo hace que el objeto se salga = tu ojo dominante</p>

              <div className="flex gap-3">
                <EyeButton eye="right" selected={answers.t1 === 'right'} onClick={() => setAnswer('t1', 'right')}/>
                <EyeButton eye="left"  selected={answers.t1 === 'left'}  onClick={() => setAnswer('t1', 'left')} />
              </div>
            </div>

            <button
              disabled={!answers.t1}
              onClick={() => setStep('test2')}
              className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Siguiente <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        )}

        {step === 'test2' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">2</div>
                <h2 className="font-bold text-gray-800">Test de puntería</h2>
              </div>

              <div className="bg-indigo-50 rounded-2xl p-4 mb-4">
                <ol className="space-y-2 text-gray-700 text-sm">
                  <li>1. Extiende el brazo y apunta con el dedo índice a un objeto pequeño (botón, picaporte).</li>
                  <li>2. Con ambos ojos abiertos, alinea el dedo perfectamente con el objeto.</li>
                  <li>3. Cierra el ojo <strong>derecho</strong>. ¿El dedo sigue apuntando al objeto?</li>
                  <li>4. Abre y cierra el <strong>izquierdo</strong>. ¿El dedo apunta?</li>
                </ol>
              </div>

              <div className="flex justify-center mb-4">
                <div className="text-5xl">👆🎯</div>
              </div>

              <p className="text-gray-700 font-semibold text-sm mb-3">¿Con cuál ojo abierto el dedo siguió apuntando al objeto?</p>

              <div className="flex gap-3">
                <EyeButton eye="right" selected={answers.t2 === 'right'} onClick={() => setAnswer('t2', 'right')}/>
                <EyeButton eye="left"  selected={answers.t2 === 'left'}  onClick={() => setAnswer('t2', 'left')} />
              </div>
            </div>

            <button
              disabled={!answers.t2}
              onClick={() => setStep('test3')}
              className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Siguiente <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        )}

        {step === 'test3' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">3</div>
                <h2 className="font-bold text-gray-800">Test de preferencia</h2>
              </div>

              <div className="bg-indigo-50 rounded-2xl p-4 mb-4">
                <ol className="space-y-2 text-gray-700 text-sm">
                  <li>1. Mira un objeto pequeño a distancia media (3-5 metros).</li>
                  <li>2. Cierra el ojo <strong>derecho</strong> y observa con el izquierdo. ¿Ves el objeto con claridad?</li>
                  <li>3. Ahora cierra el <strong>izquierdo</strong> y mira con el derecho. ¿Cuál se ve mejor?</li>
                </ol>
              </div>

              <div className="flex justify-center mb-4">
                <div className="text-5xl">👀✨</div>
              </div>

              <p className="text-gray-700 font-semibold text-sm mb-3">¿Con cuál ojo ves el objeto con más claridad o naturalidad?</p>

              <div className="flex gap-3">
                <EyeButton eye="right" selected={answers.t3 === 'right'} onClick={() => setAnswer('t3', 'right')}/>
                <EyeButton eye="left"  selected={answers.t3 === 'left'}  onClick={() => setAnswer('t3', 'left')} />
              </div>
            </div>

            <button
              disabled={!answers.t3}
              onClick={() => setStep('result')}
              className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Ver resultado <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-5">
            <div className={`rounded-3xl p-6 text-center ${dominant === 'equal' ? 'bg-indigo-50' : 'bg-gradient-to-br from-indigo-600 to-violet-700'}`}>
              <div className="text-4xl mb-3">
                {dominant === 'right' ? '👁️➡️' : dominant === 'left' ? '⬅️👁️' : '👁️👁️'}
              </div>
              <h2 className={`text-xl font-black mb-2 ${dominant === 'equal' ? 'text-indigo-800' : 'text-white'}`}>
                {dominant === 'right' ? 'Tu ojo dominante es el DERECHO'
                 : dominant === 'left' ? 'Tu ojo dominante es el IZQUIERDO'
                 : 'Ambos ojos son igualmente dominantes'}
              </h2>
              <p className={`text-sm leading-relaxed ${dominant === 'equal' ? 'text-indigo-600' : 'text-white/80'}`}>
                {dominant === 'right' || dominant === 'left'
                  ? `El ojo ${dominant === 'right' ? 'derecho' : 'izquierdo'} lidera la visión binocular. El cerebro lo usa como referencia principal.`
                  : 'Tienes dominancia mixta o ambidestreza ocular, algo poco común y muy interesante.'}
              </p>
            </div>

            {/* Vote breakdown */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3">Detalle de tests</h3>
              {[
                { label: 'Test del triángulo', val: answers.t1 },
                { label: 'Test de puntería',   val: answers.t2 },
                { label: 'Test de preferencia',val: answers.t3 },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600 text-sm">{label}</span>
                  <span className={`text-sm font-bold ${val === 'right' ? 'text-indigo-600' : 'text-violet-600'}`}>
                    Ojo {val === 'right' ? 'Derecho' : 'Izquierdo'}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-blue-800 text-sm font-semibold mb-1">¿Para qué sirve saberlo?</p>
              <p className="text-blue-600 text-xs leading-relaxed">
                La dominancia ocular es clave para deportes de puntería, fotografía, y para optimizar tu corrección visual si usas lentes. Compártelo con tu oftalmólogo.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('intro'); setAnswers({ t1: null, t2: null, t3: null }); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
              >
                <RotateCcw className="w-4 h-4"/> Repetir
              </button>
              <button onClick={onBack} className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition">
                Terminar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
