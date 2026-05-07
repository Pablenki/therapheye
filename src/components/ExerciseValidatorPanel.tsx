// =========================================
// Panel de Validación de Ejercicios — Therapheye
// Overlay compacto con cámara + métricas en tiempo real
// =========================================

import { type RefObject } from 'react';
import { Camera, CameraOff, Loader2, X } from 'lucide-react';
import type { ValidatorState } from '../hooks/useExerciseValidator';

interface Props {
  exerciseId: string;
  state: ValidatorState;
  videoRef: RefObject<HTMLVideoElement | null>;
  onStop: () => void;
}

// Qué puede validarse por ejercicio:
// palming   → ojos cubiertos con palmas (eyesCovered)
// circles   → iris en movimiento + cabeza quieta (irisMoving + headStable)
// todos     → distancia pantalla
// focus / 20-20-20 / near-far → presencia de cara + distancia

function DistanceBadge({ distanceCm, distanceStatus }: Pick<ValidatorState, 'distanceCm' | 'distanceStatus'>) {
  if (!distanceCm || !distanceStatus) return null;
  const color = distanceStatus === 'ideal' ? 'text-green-600' : 'text-amber-600';
  const label = distanceStatus === 'too_close'
    ? `${distanceCm}cm · muy cerca`
    : distanceStatus === 'too_far'
    ? `${distanceCm}cm · muy lejos`
    : `${distanceCm}cm · ideal ✓`;
  return (
    <div className={`flex items-center gap-1 text-[10px] font-medium ${color}`}>
      <span>📏</span>
      <span>{label}</span>
    </div>
  );
}

function ExerciseFeedback({ exerciseId, state }: { exerciseId: string; state: ValidatorState }) {
  const { faceDetected, eyesCovered, eyesCoveredPct, irisMoving, headStable } = state;
  if (!faceDetected) return null;

  if (exerciseId === 'palming') {
    return (
      <div className="space-y-1">
        <div className={`flex items-center gap-1 text-[10px] font-medium ${eyesCovered ? 'text-green-600' : 'text-amber-600'}`}>
          <span>{eyesCovered ? '✓' : '○'}</span>
          <span>{eyesCovered ? 'Palmas sobre ojos' : 'Cubre ojos con palmas'}</span>
        </div>
        {/* Barra de cobertura */}
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${eyesCovered ? 'bg-green-500' : eyesCoveredPct > 40 ? 'bg-amber-400' : 'bg-gray-300'}`}
            style={{ width: `${eyesCoveredPct}%` }}
          />
        </div>
      </div>
    );
  }

  if (exerciseId === 'circles') {
    return (
      <div className="space-y-0.5">
        <div className={`flex items-center gap-1 text-[10px] font-medium ${irisMoving ? 'text-green-600' : 'text-amber-600'}`}>
          <span>{irisMoving ? '✓' : '○'}</span>
          <span>{irisMoving ? 'Iris en movimiento' : 'Mueve los ojos'}</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-medium ${headStable ? 'text-green-600' : 'text-amber-600'}`}>
          <span>{headStable ? '✓' : '⚠'}</span>
          <span>{headStable ? 'Cabeza quieta' : 'Quieta la cabeza'}</span>
        </div>
      </div>
    );
  }

  // Para los demás: presencia de cara es suficiente feedback
  return (
    <div className="flex items-center gap-1 text-[10px] font-medium text-green-600">
      <span>✓</span>
      <span>Cara detectada</span>
    </div>
  );
}

export default function ExerciseValidatorPanel({ exerciseId, state, videoRef, onStop }: Props) {
  const { active, loading, error, faceDetected } = state;

  return (
    <div className="fixed bottom-24 right-4 z-40 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-52 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-600">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-white" />
          <span className="text-white text-[11px] font-semibold">Validación en vivo</span>
        </div>
        <button
          onClick={onStop}
          className="text-white/70 hover:text-white transition p-0.5 rounded"
          title="Cerrar validación"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Video preview */}
      <div className="relative bg-gray-900" style={{ height: '80px' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
        {!active && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
            <CameraOff className="w-5 h-5 text-gray-500" />
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-1.5">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
            <span className="text-white text-[9px]">Cargando IA...</span>
          </div>
        )}
        {active && !faceDetected && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-white text-[10px] text-center px-3 leading-relaxed">
              Cara no detectada
            </p>
          </div>
        )}
        {/* Indicador de cara detectada */}
        {active && faceDetected && (
          <div className="absolute top-1.5 left-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          </div>
        )}
      </div>

      {/* Métricas */}
      <div className="px-3 py-2.5 space-y-1.5">
        {error && (
          <p className="text-[10px] text-red-500 font-medium">{error}</p>
        )}

        {active && (
          <>
            <DistanceBadge distanceCm={state.distanceCm} distanceStatus={state.distanceStatus} />
            <ExerciseFeedback exerciseId={exerciseId} state={state} />
          </>
        )}

        {!active && !loading && !error && (
          <p className="text-[10px] text-gray-400 text-center py-1">
            Cámara apagada
          </p>
        )}
      </div>
    </div>
  );
}
