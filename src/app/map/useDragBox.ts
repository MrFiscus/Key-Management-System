import { useRef } from "react";
import type { MapBoxRect } from "../../lib/types";

/**
 * Free-form drag for a single map box, in stage percentages.
 *
 * Deltas are divided by the live stage rect from getBoundingClientRect(), which
 * already reflects the current zoom scale — so a box tracks the cursor 1:1 at
 * any zoom without the hook needing to know the zoom factor. `disabled` (the map
 * lock) gates pointerdown, so a locked layout can't be nudged.
 *
 * No dependency: a pointer-capture drag on window is all this needs, and it
 * keeps full control of the %-coordinate model we persist.
 */
export function useDragBox(opts: {
  disabled: boolean;
  rect: MapBoxRect;
  getStageRect: () => DOMRect | null;
  onMove: (next: MapBoxRect) => void;
  onEnd: (next: MapBoxRect) => void;
}) {
  // Keep the latest opts in a ref so the window listeners always see fresh
  // values without re-binding on every render.
  const ref = useRef(opts);
  ref.current = opts;

  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    const { disabled, rect, getStageRect } = ref.current;
    if (disabled || e.button !== 0) return;
    const stage = getStageRect();
    if (!stage) return;

    // Don't let the click also start a canvas pan / open the drawer.
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...rect };
    let latest = start;
    let moved = false;

    const move = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / stage.width) * 100;
      const dyPct = ((ev.clientY - startY) / stage.height) * 100;
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 3) moved = true;
      latest = {
        ...start,
        x: clamp(start.x + dxPct, 0, 100 - start.width),
        y: clamp(start.y + dyPct, 0, 100 - start.height),
      };
      ref.current.onMove(latest);
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragging.current = false;
      if (moved) ref.current.onEnd(latest);
    };

    dragging.current = true;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return { onPointerDown, isDragging: () => dragging.current };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), Math.max(min, max));
}
