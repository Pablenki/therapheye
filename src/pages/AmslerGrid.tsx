// =========================================
// REJILLA DE AMSLER — Therapheye
// Test clínico para detectar problemas maculares
// =========================================

import { useState } from 'react';
import { ArrowLeft, ChevronRight, Eye, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';

interface Props { onBack: () => void }

type Eye = 'right' | 'left';
type EyeResult = { distortions: boolean; missing: boolean; blurry: boolean; uneven: boolean };
type Step = 'intro' | 'right' | 'left' | 'result';

const GRID_SIZE = 20;
const CELL = 16;

const emptyResult = (): EyeResult => ({ distortions: false, missing: false, blurry: false, uneven: false });

function getScore(r: EyeResult): number {
  return [r.distortions, r.missing, r.blurry, r.uneven].filter(Boolean).length;
}

function getLevel(score: number) {
  if (score === 0) return { label: 'Normal', color: '#10b981', bg: '#d1fae5', icon: '✅' };
  if (score === 1) return { label: 'Leve alteración', color: '#f59e0b', bg: '#fef3c7', icon: '⚠️' };
  if (score === 2) return { label: 'Moderada', color: '#f97316', bg: '#ffedd5', icon: '⚠️' };
  return { label: 'Consulta recomendada', color: '#ef4444', bg: '#fee2e2', icon: '🚨' };
}

function AmslerTestStep({
  eyeLabel,
  coverLabel,
  result,
  onChange,
  onNext,
}: {
  eyeLabel: string;
  coverLabel: string;
  result: EyeResult;
  onChange: (key: keyof EyeResult, val: boolean) => void;
  onNext: () => void;
}) {
  const [markedCells, setMarkedCells] = useState<Set<number>>(new Set());

  const toggleCell = (idx: number) => {
    setMarkedCells(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const center = Math.floor(GRID_SIZE / 2);

  return (
    <div className="flex flex-col gap-4">
      {/* Instruction banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
        <p className="text-indigo-900 font-bold text-sm">
          Cubre tu ojo <span className="underline">{coverLabel}</span>
        </p>
        <p className="text-indigo-600 text-xs mt-1">
          Con el ojo <strong>{eyeLabel}</strong>, mira fijamente el punto rojo central.
          Toca las celdas donde notes distorsiones.
        </p>
      </div>

      {/* Grid */}
      <div className="flex justify-center">
        <div className="relative bg-white border-2 border-gray-300 rounded-lg overflow-hidden shadow-inner"
          style={{ width: GRID_SIZE * CELL, height: GRID_SIZE * CELL }}>
          {/* Grid lines */}
          <svg className="absolute inset-0 pointer-events-none" width={GRID_SIZE * CELL} height={GRID_SIZE * CELL}>
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
              <g key={i}>
                <line x1={i * CELL} y1={0} x2={i * CELL} y2={GRID_SIZE * CELL} stroke="#d1d5db" strokeWidth={0.5}/>
                <line x1={0} y1={i * CELL} x2={GRID_SIZE * CELL} y2={i * CELL} stroke="#d1d5db" strokeWidth={0.5}/>
              </g>
            ))}
          </svg>

          {/* Clickable cells */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
            const row = Math.floor(idx / GRID_SIZE);
            const col = idx % GRID_SIZE;
            const isCenter = row === center && col === center;
            return (
              <div
                key={idx}
                onClick={() => !isCenter && toggleCell(idx)}
                style={{
                  position: 'absolute',
                  top: row * CELL, left: col * CELL,
                  width: CELL, height: CELL,
                  background: isCenter ? 'transparent' : markedCells.has(idx) ? 'rgba(239,68,68,0.3)' : 'transparent',
                  cursor: isCenter ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isCenter && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 4px #ef4444' }}/>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Questions */}
      <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
        <p className="text-gray-700 font-semibold text-sm mb-2">Con ese ojo, ¿notas algo de esto?</p>
        {[
          { key: 'distortions' as const, label: 'Las líneas se ven onduladas o torcidas' },
          { key: 'missing'     as const, label: 'Hay zonas oscuras o con puntos ciegos' },
          { key: 'blurry'      as const, label: 'Alguna área se ve borrosa' },
          { key: 'uneven'      as const, label: 'Las cuadrículas tienen tamaños distintos' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => onChange(key, !result[key])}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                result[key] ? 'bg-red-500 border-red-500' : 'border-gray-300 group-hover:border-red-300'
              }`}
            >
              {result[key] && <CheckCircle2 className="w-3 h-3 text-white"/>}
            </div>
            <span className="text-gray-700 text-sm">{label}</span>
          </label>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition"
      >
        Continuar <ChevronRight className="w-4 h-4"/>
      </button>
    </div>
  );
}

export default function AmslerGrid({ onBack }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [rightResult, setRightResult] = useState<EyeResult>(emptyResult());
  const [leftResult,  setLeftResult]  = useState<EyeResult>(emptyResult());

  const updateRight = (key: keyof EyeResult, val: boolean) =>
    setRightResult(r => ({ ...r, [key]: val }));
  const updateLeft  = (key: keyof EyeResult, val: boolean) =>
    setLeftResult(r => ({ ...r, [key]: val }));

  const rightScore = getScore(rightResult);
  const leftScore  = getScore(leftResult);
  const rightLevel = getLevel(rightScore);
  const leftLevel  = getLevel(leftScore);
  const maxScore   = Math.max(rightScore, leftScore);
  const overall    = getLevel(maxScore);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Rejilla de Amsler</h1>
          <p className="text-gray-400 text-xs">Test macular · Detección de alteraciones</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {step === 'intro' && (
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 text-white text-center">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-90"/>
              <h2 className="text-xl font-black mb-2">Test de Amsler</h2>
              <p className="text-white/80 text-sm leading-relaxed">
                Detecta alteraciones en la visión central y problemas maculares. Tarda menos de 2 minutos.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
              <h3 className="font-bold text-gray-800">Antes de empezar</h3>
              {[
                '👓 Si usas gafas o lentes, ponlos ahora',
                '💡 Asegúrate de tener buena iluminación',
                '📱 Sostén el dispositivo a unos 30-40 cm',
                '👀 Testearás cada ojo por separado',
              ].map(t => <p key={t} className="text-gray-600 text-sm">{t}</p>)}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0"/>
                <p className="text-amber-800 text-xs leading-relaxed">
                  Este test es orientativo, no reemplaza un examen médico. Si notas alteraciones, consulta a tu oftalmólogo.
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep('right')}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              Comenzar test <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        )}

        {step === 'right' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">1</div>
              <span className="font-bold text-gray-800">Ojo Derecho</span>
            </div>
            <AmslerTestStep
              eyeLabel="DERECHO"
              coverLabel="izquierdo"
              result={rightResult}
              onChange={updateRight}
              onNext={() => setStep('left')}
            />
          </div>
        )}

        {step === 'left' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">2</div>
              <span className="font-bold text-gray-800">Ojo Izquierdo</span>
            </div>
            <AmslerTestStep
              eyeLabel="IZQUIERDO"
              coverLabel="derecho"
              result={leftResult}
              onChange={updateLeft}
              onNext={() => setStep('result')}
            />
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4">
            <div className="rounded-3xl p-6 text-center" style={{ background: overall.bg }}>
              <div className="text-4xl mb-2">{overall.icon}</div>
              <h2 className="font-black text-xl mb-1" style={{ color: overall.color }}>
                {overall.label}
              </h2>
              <p className="text-gray-600 text-sm">
                {maxScore === 0
                  ? 'No se detectaron alteraciones en ningún ojo. ¡Estupendo!'
                  : maxScore <= 1
                  ? 'Se detectó una ligera alteración. Monitorea con regularidad.'
                  : 'Se detectaron varias alteraciones. Consulta a un oftalmólogo pronto.'}
              </p>
            </div>

            {/* Per-eye results */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Ojo Derecho', level: rightLevel, score: rightScore },
                { label: 'Ojo Izquierdo', level: leftLevel, score: leftScore },
              ].map(({ label, level, score }) => (
                <div key={label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
                  <p className="text-gray-500 text-xs mb-1">{label}</p>
                  <div className="text-2xl mb-1">{level.icon}</div>
                  <p className="font-bold text-sm" style={{ color: level.color }}>{level.label}</p>
                  <p className="text-gray-400 text-xs">{score} / 4 indicadores</p>
                </div>
              ))}
            </div>

            {maxScore >= 2 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"/>
                <div>
                  <p className="text-red-800 font-semibold text-sm">Recomendación importante</p>
                  <p className="text-red-600 text-xs mt-1 leading-relaxed">
                    Las alteraciones detectadas pueden indicar cambios en la mácula. Agenda una cita con tu oftalmólogo para una evaluación completa.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('intro'); setRightResult(emptyResult()); setLeftResult(emptyResult()); }}
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
