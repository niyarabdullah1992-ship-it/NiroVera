import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

/** «⋯» — the order's less frequent actions, so the card keeps one clear button. */
export default function OpsMoreMenu({ ar = true, items = [], placement = "up", dark = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const list = items.filter(Boolean);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!list.length) return null;
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        data-more="1"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ar ? "إجراءات أخرى" : "More actions"}
        onClick={() => setOpen((v) => !v)}
        style={dark
          ? { width: 32, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,.28)", background: open ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.06)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }
          : { width: 34, height: 32, borderRadius: 8, border: "1px solid var(--nv-line)", background: open ? "var(--nv-soft)" : "var(--nv-card)", color: "var(--nv-ink2)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <MoreHorizontal size={16} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <span
          role="menu"
          data-more-menu="1"
          style={{ position: "absolute", ...(placement === "down" ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 6px)" }), insetInlineEnd: 0, zIndex: 40, minWidth: 190, padding: 6, borderRadius: 12, background: "var(--nv-card)", border: "1px solid var(--nv-line)", boxShadow: "0 12px 28px rgba(12,20,16,.16)", display: "flex", flexDirection: "column", gap: 2 }}
        >
          {list.map((item, i) => (
            item.divider ? (
              <span key={`d${i}`} aria-hidden style={{ height: 1, background: "var(--nv-line2, #EEF1EF)", margin: "4px 2px" }} />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                data-more-item={item.key || item.label}
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick?.(); }}
                style={{ fontFamily: "inherit", textAlign: "start", fontSize: 12.5, fontWeight: 600, padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", color: item.danger ? "var(--nv-bad-ink)" : "var(--nv-ink)", cursor: item.disabled ? "not-allowed" : "pointer", opacity: item.disabled ? 0.5 : 1, display: "flex", flexDirection: "column", gap: 1 }}
              >
                {item.label}
                {item.hint ? <span style={{ fontSize: 11, fontWeight: 400, color: "var(--nv-muted)" }}>{item.hint}</span> : null}
              </button>
            )
          ))}
        </span>
      ) : null}
    </span>
  );
}
