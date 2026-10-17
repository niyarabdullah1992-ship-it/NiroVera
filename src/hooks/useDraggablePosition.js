import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "powercare_music_button_position";
/** Fallback when the app header is not mounted yet: its slab ends above this line. */
const HEADER_FALLBACK_BOTTOM = 160;
const EDGE = 8;

/**
 * The lowest point of the /app header (data-topbar) in its resting place, plus a gap.
 * The header scrolls with the page, so we add the scroller offset back.
 */
function headerSafeTop() {
  if (typeof document === "undefined") return EDGE;
  const bar = document.querySelector('[data-topbar="1"]');
  if (!bar) return HEADER_FALLBACK_BOTTOM;
  const scroller = bar.closest(".platform-main-scroll");
  const bottom = bar.getBoundingClientRect().bottom + (scroller?.scrollTop || 0);
  return Math.max(EDGE, Math.round(bottom + EDGE));
}

/**
 * Keep a dragged spot on screen and out of the header band.
 * `dropInBand`: a saved spot that sits on the header falls back to the default corner (null).
 */
export function clampMusicPosition(position, { width = 66, height = 38, safeTop = EDGE, dropInBand = false } = {}) {
  if (!position || typeof window === "undefined") return position;
  if (dropInBand && safeTop > EDGE && (Number(position.y) || 0) < safeTop) return null;
  const maxX = Math.max(EDGE, window.innerWidth - width - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - height - EDGE);
  const minY = Math.min(safeTop, maxY);
  const x = Math.max(EDGE, Math.min(maxX, Number(position.x) || 0));
  const y = Math.max(minY, Math.min(maxY, Number(position.y) || 0));
  return x === position.x && y === position.y ? position : { x, y };
}

/**
 * Drag-to-move for the floating music button. Default spot is CSS (bottom, inline-end);
 * a dragged spot is saved, and is always clamped below the app header when `avoidHeader`.
 */
export default function useDraggablePosition({ avoidHeader = false } = {}) {
  const safeTop = () => (avoidHeader ? headerSafeTop() : EDGE);
  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
      return saved ? clampMusicPosition(saved, { safeTop: avoidHeader ? HEADER_FALLBACK_BOTTOM : EDGE, dropInBand: true }) : null;
    } catch {
      return null;
    }
  });
  const drag = useRef(null);
  const lastPosition = useRef(position);

  const hasPosition = Boolean(position);
  // Re-clamp once the header is in the page, and whenever the window resizes.
  useEffect(() => {
    if (!hasPosition) return undefined;
    const settle = () => setPosition((current) => clampMusicPosition(current, { safeTop: avoidHeader ? headerSafeTop() : EDGE, dropInBand: true }));
    settle();
    window.addEventListener("resize", settle);
    return () => window.removeEventListener("resize", settle);
  }, [avoidHeader, hasPosition]);

  const onPointerDown = (event) => {
    const rect = event.currentTarget.parentElement?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, moved: false, safeTop: safeTop() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    const next = clampMusicPosition(
      { x: drag.current.left + dx, y: drag.current.top + dy },
      { width: drag.current.width, height: drag.current.height, safeTop: drag.current.safeTop },
    );
    lastPosition.current = next;
    setPosition(next);
  };
  const onPointerUp = (event) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    if (drag.current.moved) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lastPosition.current));
      } catch {
        /* private mode */
      }
    }
    drag.current = null;
  };

  return { position, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}
