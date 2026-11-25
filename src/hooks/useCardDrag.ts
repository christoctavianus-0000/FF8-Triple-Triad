import { useCallback, useEffect, useRef, useState } from 'react';

export interface DragState {
  active: boolean;
  handIndex: number | null;
  cardId: string | null;
  x: number;
  y: number;
  hoveredCellIndex: number | null;
}

const INITIAL_DRAG: DragState = {
  active: false,
  handIndex: null,
  cardId: null,
  x: 0,
  y: 0,
  hoveredCellIndex: null,
};

export function useCardDrag(
  enabled: boolean,
  onDropCell: (handIndex: number, cellIndex: number) => void,
) {
  const [drag, setDrag] = useState<DragState>(INITIAL_DRAG);
  const activePointerId = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const pendingMeta = useRef<{ handIndex: number; cardId: string } | null>(null);
  const dragActiveRef = useRef(false);

  const findHoveredCell = (clientX: number, clientY: number): number | null => {
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      const cellAttr = (el as HTMLElement).dataset?.cellIndex;
      if (cellAttr !== undefined) {
        const parsed = Number.parseInt(cellAttr, 10);
        if (Number.isInteger(parsed) && parsed >= 0 && parsed < 9) {
          return parsed;
        }
      }
    }
    return null;
  };

  const reset = useCallback(() => {
    activePointerId.current = null;
    startPos.current = null;
    pendingMeta.current = null;
    dragActiveRef.current = false;
    setDrag(INITIAL_DRAG);
  }, []);

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }

    const handleMove = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId || !startPos.current || !pendingMeta.current) {
        return;
      }
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (!dragActiveRef.current && Math.hypot(dx, dy) < 8) {
        return;
      }
      dragActiveRef.current = true;
      const hoveredCellIndex = findHoveredCell(e.clientX, e.clientY);
      setDrag({
        active: true,
        handIndex: pendingMeta.current.handIndex,
        cardId: pendingMeta.current.cardId,
        x: e.clientX,
        y: e.clientY,
        hoveredCellIndex,
      });
    };

    const handleUp = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      const wasActive = dragActiveRef.current;
      const meta = pendingMeta.current;
      const targetCell = wasActive ? findHoveredCell(e.clientX, e.clientY) : null;
      reset();
      if (wasActive && meta && targetCell !== null) {
        onDropCell(meta.handIndex, targetCell);
      }
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [enabled, onDropCell, reset]);

  const beginDrag = useCallback(
    (handIndex: number, cardId: string, e: React.PointerEvent) => {
      if (!enabled) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Ignore secondary simultaneous touches
      if (activePointerId.current !== null) return;
      activePointerId.current = e.pointerId;
      startPos.current = { x: e.clientX, y: e.clientY };
      pendingMeta.current = { handIndex, cardId };
    },
    [enabled],
  );

  return { drag, beginDrag };
}
