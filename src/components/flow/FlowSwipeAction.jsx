
import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { ACCENT, MUTED, NAVY_FILL, CARD } from "@/lib/platformStyles";

export default function FlowSwipeAction({
  label,
  onAction,
  onUndo,
  sensitive = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  undoLabel = "Undo",
  className = "",
}) {
  const trackRef = useRef(null);
  const startX = useRef(null);
  const [offset, setOffset] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 5000);
    return () => clearTimeout(timer);
  }, [done]);

  const run = async () => {
    setConfirming(false);
    setBusy(true);
    await onAction();
    setBusy(false);
    setDone(!!onUndo);
    setOffset(0);
  };

  const finish = () => {
    const width = trackRef.current?.offsetWidth || 1;
    if (Math.abs(offset) > width * 0.45) {
      if (sensitive) setConfirming(true);
      else run();
    }
    setOffset(0);
    startX.current = null;
  };

  if (done) {
    return (
      <button
        type="button"
        onClick={() => {
          onUndo();
          setDone(false);
        }}
        className={className}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 10,
          border: "1px solid #BBF7D0",
          background: "#ECFDF3",
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          color: "#15803D",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <RotateCcw style={{ width: 14, height: 14 }} strokeWidth={1.75} />
        {undoLabel}
      </button>
    );
  }

  if (confirming) {
    return (
      <div className={className} style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={run}
          style={{
            flex: 1,
            borderRadius: 10,
            border: "none",
            background: NAVY_FILL,
            padding: "9px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          style={{
            borderRadius: 10,
            border: "1px solid #E2E8F0",
            background: CARD,
            padding: "9px 12px",
            fontSize: 12,
            fontWeight: 500,
            color: MUTED,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {cancelLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      className={className}
      style={{
        position: "relative",
        height: 40,
        overflow: "hidden",
        borderRadius: 11,
        border: "1px solid #BBF7D0",
        background: "linear-gradient(180deg, #ECFDF3 0%, #F0FDF4 100%)",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 44px",
          textAlign: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "#15803D",
          letterSpacing: 0.01,
        }}
      >
        {busy ? "…" : label}
      </div>
      <button
        type="button"
        disabled={busy}
        aria-label={label}
        onPointerDown={(e) => {
          startX.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (startX.current !== null) setOffset(e.clientX - startX.current);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          insetInlineStart: 4,
          width: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          border: "none",
          background: ACCENT,
          color: "#fff",
          boxShadow: "0 2px 6px rgba(30,158,99,.35)",
          transform: `translateX(${offset}px)`,
          transition: startX.current === null ? "transform .15s ease" : "none",
          cursor: busy ? "not-allowed" : "grab",
          opacity: busy ? 0.5 : 1,
          padding: 0,
        }}
      >
        <ArrowRight style={{ width: 15, height: 15 }} className="rtl:rotate-180" strokeWidth={2} />
      </button>
      <Check
        style={{
          pointerEvents: "none",
          position: "absolute",
          insetInlineEnd: 12,
          top: "50%",
          marginTop: -8,
          width: 16,
          height: 16,
          color: "rgba(30,158,99,.45)",
        }}
        strokeWidth={1.75}
      />
    </div>
  );
}
