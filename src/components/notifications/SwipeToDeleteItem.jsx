import React, { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { DANGER } from "@/lib/platformStyles";

// Wraps a notification row with swipe-left/right-to-delete support (touch + mouse drag).
export default function SwipeToDeleteItem({ onDelete, children }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const THRESHOLD = 80;

  const onPointerDown = (e) => {
    startX.current = e.clientX;
    setDragging(true);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dragX) > THRESHOLD) {
      onDelete();
    } else {
      setDragX(0);
    }
  };

  const opacity = Math.max(1 - Math.abs(dragX) / (THRESHOLD * 2.5), 0.3);

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 12 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--nv-bad-soft)",
          color: DANGER,
          borderRadius: 12,
          opacity: dragX ? 1 : 0,
        }}
      >
        <Trash2 style={{ width: 16, height: 16 }} strokeWidth={1.75} />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{
          position: "relative",
          background: "transparent",
          cursor: "grab",
          transform: `translateX(${dragX}px)`,
          opacity,
          transition: dragging ? "none" : "transform 0.2s ease, opacity 0.2s ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
