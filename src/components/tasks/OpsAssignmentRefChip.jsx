import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { taskDelegationMeta, taskTransferMeta } from "@/lib/opsDerivations";
import { MUTED, NAVY } from "@/lib/platformStyles";

function Field({ label, value, mono = false }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: MUTED }}>{label}</div>
      <div
        style={{
          marginTop: "3px",
          fontSize: "12px",
          fontWeight: 650,
          color: NAVY,
          fontFamily: mono ? "'IBM Plex Mono',monospace" : "inherit",
          lineHeight: 1.45,
          wordBreak: "break-word",
          unicodeBidi: mono ? "isolate" : undefined,
          textAlign: "start",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

/**
 * Compact transfer / delegation chip — click to reveal date, reason, parties.
 * Stops row click so the board can stay closed while reading the reference.
 */
export default function OpsAssignmentRefChip({ task, ar = true, kind, compact = false }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const transfer = kind === "transfer" ? taskTransferMeta(task) : null;
  const delegation = kind === "delegation" ? taskDelegationMeta(task) : null;
  const meta = transfer || delegation;
  const isTransfer = kind === "transfer";
  const panelBd = isTransfer ? "#FECACA" : "#FDBA74";
  const panelBg = isTransfer ? "#FFF7F7" : "#FFFBF5";
  const titleFg = isTransfer ? "#991B1B" : "#9A3412";

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuStyle(null);
      return undefined;
    }
    const place = () => {
      const rect = rootRef.current.getBoundingClientRect();
      const width = Math.min(300, Math.max(240, window.innerWidth * 0.78));
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 240;
      const left = ar
        ? Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
        : Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      setMenuStyle({
        position: "fixed",
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        left,
        zIndex: 120,
        width,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, ar, kind]);

  if (!meta) return null;

  const chipBg = isTransfer ? "#FEF2F2" : (meta.active ? "#FFF7ED" : "#F8FAFC");
  const chipFg = isTransfer ? "#991B1B" : (meta.active ? "#9A3412" : "#64748B");
  const chipBd = isTransfer ? "#FECACA" : (meta.active ? "#FDBA74" : "#E2E8F0");

  let label = "";
  if (isTransfer) {
    label = ar ? "نُقلت" : "Transferred";
  } else if (compact) {
    label = meta.active
      ? (ar ? "وُكِّل" : "Delegated")
      : (meta.endedAt
        ? (ar ? `أُنهيت · ${meta.endedAt}` : `Ended · ${meta.endedAt}`)
        : (ar ? "وكالة" : "Delegation"));
  } else {
    label = meta.active
      ? (meta.start && meta.end
        ? (ar ? `وُكِّل · ${meta.start} → ${meta.end}` : `Delegated · ${meta.start} → ${meta.end}`)
        : (ar ? "وُكِّل" : "Delegated"))
      : (meta.endedAt
        ? (ar ? `أُنهيت · ${meta.endedAt}` : `Ended · ${meta.endedAt}`)
        : (meta.start && meta.end
          ? (ar ? `وكالة · ${meta.start} → ${meta.end}` : `Delegation · ${meta.start} → ${meta.end}`)
          : (ar ? "وكالة سابقة" : "Prior delegation")));
  }

  const panel = open && menuStyle && typeof document !== "undefined"
    ? createPortal(
      <div
        ref={panelRef}
        role="dialog"
        data-nv-ref-panel={kind}
        style={{
          ...menuStyle,
          borderRadius: "12px",
          border: `1px solid ${panelBd}`,
          background: panelBg,
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.18)",
          padding: "12px 13px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "12px", fontWeight: 750, color: titleFg }}>
          {isTransfer
            ? (ar ? "مرجع النقل (نهائي)" : "Transfer reference (final)")
            : (ar
              ? `مرجع التوكيل · ${meta.active ? "نشطة" : "منتهية"}`
              : `Delegation reference · ${meta.active ? "Active" : "Ended"}`)}
        </div>

        {meta.reason ? (
          <div style={{
            borderRadius: "10px",
            border: `1px solid ${panelBd}`,
            background: "#FFFFFF",
            padding: "8px 10px",
          }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: titleFg }}>
              {isTransfer
                ? (ar ? "سبب النقل" : "Transfer reason")
                : (ar ? "سبب الوكالة" : "Delegation reason")}
            </div>
            <div style={{
              marginTop: "4px",
              fontSize: "13px",
              fontWeight: 650,
              color: NAVY,
              lineHeight: 1.55,
              textWrap: "pretty",
            }}
            >
              {meta.reason}
            </div>
          </div>
        ) : null}

        {isTransfer ? (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px 10px",
            }}
            >
              <Field label={ar ? "من" : "From"} value={meta.fromName} />
              <Field label={ar ? "إلى" : "To"} value={meta.toName} />
              <Field label={ar ? "نقل المسؤولية" : "Moved by"} value={meta.byName} />
            </div>
            <div data-nv-ref-dates style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "8px",
              marginTop: "auto",
              paddingTop: "10px",
              borderTop: `1px solid ${panelBd}`,
            }}
            >
              <Field label={ar ? "تاريخ النقل" : "Transferred on"} value={meta.at} mono />
            </div>
          </>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px 10px",
            }}
            >
              <Field label={ar ? "الموكِّل" : "Delegator"} value={meta.byName} />
              <Field label={ar ? "الموكَّل إليه" : "Delegatee"} value={meta.toName} />
            </div>
            <div data-nv-ref-dates style={{
              display: "grid",
              gridTemplateColumns: meta.endedAt ? "1fr 1fr 1fr" : "1fr 1fr",
              gap: "8px",
              marginTop: "auto",
              paddingTop: "10px",
              borderTop: `1px solid ${panelBd}`,
            }}
            >
              <Field label={ar ? "بداية التوكيل" : "Starts"} value={meta.start} mono />
              <Field label={ar ? "نهاية التوكيل" : "Ends"} value={meta.end} mono />
              {meta.endedAt
                ? <Field label={ar ? "أُنهيت فعليًا" : "Actually ended"} value={meta.endedAt} mono />
                : null}
            </div>
          </>
        )}
      </div>,
      document.body,
    )
    : null;

  return (
    <span
      ref={rootRef}
      style={{ position: "relative", display: "inline-flex", maxWidth: "100%" }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        title={ar ? "اضغط لعرض المرجع" : "Click to show reference"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          maxWidth: "100%",
          padding: compact ? "2px 7px" : "2px 8px",
          borderRadius: "8px",
          border: `1px solid ${chipBd}`,
          background: chipBg,
          color: chipFg,
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.01em",
          cursor: "pointer",
          fontFamily: "inherit",
          lineHeight: 1.4,
          textAlign: "start",
        }}
      >
        <span style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: compact ? "140px" : "220px",
        }}
        >
          {label}
        </span>
        <span aria-hidden style={{ fontSize: "9px", opacity: 0.75 }}>{open ? "▴" : "▾"}</span>
      </button>
      {panel}
    </span>
  );
}
