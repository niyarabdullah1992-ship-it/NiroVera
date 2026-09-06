import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { BRAND, CARD, INK, MUTED, NAVY } from "@/lib/platformStyles";

/**
 * Shared create-card chrome — same identity as «مهمة جديدة».
 */
export default function ComposerModalShell({
  ar,
  title,
  hint,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  busy,
  children,
}) {
  const enabled = !submitDisabled && !busy;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const node = (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "color-mix(in oklab, var(--nv-navy, #14284B) 42%, transparent)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "calc(100vh - 32px)",
          background: CARD,
          borderRadius: 22,
          border: "1px solid var(--nv-glass-line, var(--nv-line, #E2E8F0))",
          boxShadow: "var(--nv-glass-shadow, 0 24px 60px rgba(20,40,75,.22))",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--nv-line, #E2E8F0)",
            background: "linear-gradient(180deg, color-mix(in oklab, var(--nv-accent, #1E9E63) 7%, var(--nv-card, #fff)) 0%, var(--nv-card, #fff) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em", color: INK || NAVY, lineHeight: 1.3 }}>
                {title}
              </div>
              {hint ? (
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>
                  {hint}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={ar ? "إغلاق" : "Close"}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid var(--nv-line, #E2E8F0)",
                background: CARD,
                color: MUTED,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {children}
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "16px 24px 20px",
            borderTop: "1px solid var(--nv-line, #E2E8F0)",
            display: "flex",
            gap: 10,
            background: CARD,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 44,
              padding: "0 18px",
              borderRadius: 12,
              background: CARD,
              border: "1px solid var(--nv-line, #E2E8F0)",
              color: MUTED,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={!enabled}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              background: enabled ? BRAND : "var(--nv-soft, #E2E8F0)",
              color: enabled ? "#fff" : MUTED,
              border: "none",
              fontSize: 14,
              fontWeight: 650,
              cursor: enabled ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
