import { useRef } from 'react';

/**
 * Detects horizontal swipe gestures via pointer events.
 * - onSwipeLeft  → dedo de derecha a izquierda (avanzar)
 * - onSwipeRight → dedo de izquierda a derecha (retroceder)
 * Ignores gestures where vertical movement dominates (scroll normal).
 */
export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50,
) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    startX.current = null;
    startY.current = null;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) onSwipeLeft();
    else onSwipeRight();
  };

  const onPointerCancel = () => {
    startX.current = null;
    startY.current = null;
  };

  return { onPointerDown, onPointerUp, onPointerCancel };
}
