import React, { useEffect, useRef } from "react";
import { Nv7Band } from "@/components/shared/Nv7SectionHead";

/**
 * The platform dialog — the same identity as a section: the green band (kicker · title · one-line
 * hint) over a white body. One decision per dialog; the body is a short form from DisciplineFormKit
 * (FieldLabel, GateLine, SendButton) and a quiet «تراجع». Escape and the backdrop close it unless busy.
 */
export default function Nv7Dialog({ open, onClose, kicker, num = "", title, hint, busy = false, width = 460, children, dataKey = "" }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape" && !busy) onClose?.(); };
    window.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector("textarea, input, select, button:not([data-dialog-close])");
    first?.focus?.();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);
  if (!open) return null;
  return (
    <div
      role="presentation"
      data-nv7-dialog={dataKey || "1"}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose?.(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(11,30,20,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 90 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose?.(); } }}
        style={{ width: `min(${width}px, 100%)`, maxHeight: "calc(100dvh - 32px)", overflow: "auto", background: "var(--nv-card, #fff)", border: "1px solid var(--nv-line)", borderRadius: 14, boxShadow: "0 24px 60px rgba(6,30,20,.28)", padding: 6, display: "flex", flexDirection: "column", gap: 0 }}
      >
        <Nv7Band kicker={kicker} num={num} title={title} hint={hint} />
        <div style={{ padding: "16px 14px 12px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}

/** The quiet second action under the main button — «تراجع». */
export function DialogBackButton({ onClick, children, disabled = false }) {
  return (
    <button type="button" data-dialog-close="1" disabled={disabled} onClick={onClick} style={{ fontFamily: "inherit", height: 36, width: "100%", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink2)", fontSize: 12.5, fontWeight: 600, cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}
