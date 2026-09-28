import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { CARD, MUTED } from "@/lib/platformStyles";

/**
 * Shared create-card chrome — same identity as «مهمة جديدة».
 * Pass `footer` to replace the cancel/submit row (e.g. a live task composer).
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
  back = null,
  footer = null,
  zIndex = 100,
  asForm = true,
  dataNv,
}) {
  const enabled = !submitDisabled && !busy;
  const customFooter = footer != null;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cardStyle = {
    width: "100%",
    maxWidth: 680,
    maxHeight: "calc(100vh - 32px)",
    background: "var(--nv-card)",
    borderRadius: 8,
    border: "1px solid var(--nv-line)",
    boxShadow: "0 1px 2px rgba(12,20,16,.04), 0 4px 14px rgba(12,20,16,.05)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const inner = (
    <>
      <div
        data-nv-composer-header
        style={{
          flexShrink: 0,
          padding: "14px 16px",
          borderBottom: "1px solid var(--nv-line)",
          background: "var(--nv-card)",
        }}
      >
        {back ? <div style={{ marginBottom: 10 }}>{back}</div> : null}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              data-nv-composer-title
              style={{ fontFamily: "var(--font-heading, 'Readex Pro', sans-serif)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--nv-ink)", lineHeight: 1.4 }}
            >
              {title}
            </div>
            {hint ? (
              <div style={{ fontSize: 12, color: "var(--nv-muted)", marginTop: 2, lineHeight: 1.7 }}>
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
        data-nv-composer-body
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
        data-nv-composer-footer
        style={{
          flexShrink: 0,
          padding: customFooter ? "10px 16px" : "10px 16px",
          borderTop: "1px solid var(--nv-line)",
          display: "flex",
          flexDirection: customFooter ? "column" : "row",
          gap: 10,
          background: "var(--nv-soft)",
        }}
      >
        {customFooter ? footer : (
          <>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 8,
                background: "var(--nv-card)",
                border: "1px solid var(--nv-line)",
                color: "var(--nv-ink2)",
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
                height: 34,
                borderRadius: 8,
                background: enabled ? "var(--nv-btn-fill)" : "var(--nv-line)",
                color: enabled ? "#fff" : "var(--nv-muted)",
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
          </>
        )}
      </div>
    </>
  );

  const node = (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: "rgba(12,20,16,.42)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
      role="presentation"
    >
      {asForm ? (
        <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} style={cardStyle}>
          {inner}
        </form>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          data-nv-task-card={dataNv || undefined}
          onClick={(e) => e.stopPropagation()}
          style={cardStyle}
        >
          {inner}
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
