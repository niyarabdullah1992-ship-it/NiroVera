import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ORG_LEVEL_LABELS, SEAT_STATE_LABELS } from "@/lib/orgDesign";
import { chip, chipButton, ghostButton, mono, quietAction, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { ui } from "@/lib/platformStyles";
import RightHint from "@/components/shared/RightHint";
import "./orgDesign.css";

/**
 * Org-section primitives — thin wrappers over the platform chrome (scheduleChrome · platformStyles),
 * so the structure reads like طلباتي / الجزاءات: one slab per job, a 15/700 head with a muted note,
 * rows below, ink numbers, status only as a small chip for a real problem.
 */

/** Primary action (green fill), secondary (outline), row action (quiet underline), filter chip. */
export const btnPrimary = (disabled = false) => ({ ...ui.btnCreate, ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : null) });
export const btnGhost = (extra = {}) => ghostButton({ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", fontSize: 12, boxSizing: "border-box", ...extra });
export const btnQuiet = (extra = {}) => quietAction(extra);
export const filterChip = (on = false, extra = {}) => chipButton(on, extra);
export const NUM = { ...mono, color: "var(--nv-ink)" };

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.slice(0, 1)).join("") || "—";
}

/**
 * One slab: platform SectionHead (title · note · trailing actions) and the rows below it.
 * `body` pads the children as a slab body; otherwise children are rows that carry their own padding.
 */
export function Slab({ title, note, trailing, children, label, body = false, id, slabRef, style, headStyle }) {
  return (
    <section
      id={id}
      ref={slabRef}
      aria-label={label || (typeof title === "string" ? title : undefined)}
      style={{ ...slab, display: "flex", flexDirection: "column", ...style }}
    >
      {title ? <SectionHead title={title} note={note} trailing={trailing} style={headStyle} /> : null}
      {body ? <SlabBody>{children}</SlabBody> : children}
    </section>
  );
}

export function SlabBody({ children, style }) {
  return <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0, ...style }}>{children}</div>;
}

/** A filter / tools strip inside a slab — hairline below, wraps on a phone. */
export function SlabBar({ children, style, label }) {
  return (
    <div role={label ? "group" : undefined} aria-label={label} style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", minWidth: 0, ...style }}>
      {children}
    </div>
  );
}

/** A person on a seat — initials + name; a vacant seat is drawn dashed. */
export function Face({ name, vacant = false, sub = "", ar = true }) {
  return (
    <span className="nv-od-face">
      <span className="nv-od-initials" data-vacant={vacant ? "1" : "0"} aria-hidden>{vacant ? "—" : initialsOf(name)}</span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <b>{vacant ? (ar ? "شاغر" : "Vacant") : name}</b>
        {sub ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{sub}</span> : null}
      </span>
    </span>
  );
}

/** Seat state — a quiet mute chip: filled / vacant / frozen / planned are facts, not problems. */
export function StateChip({ state, ar = true }) {
  const label = SEAT_STATE_LABELS[state] || SEAT_STATE_LABELS.vacant;
  return <span style={chip("mute", state === "vacant" ? { borderStyle: "dashed" } : {})}>{ar ? label.ar : label.en}</span>;
}

/** Status chip — colour only for warn / bad; anything else stays mute. */
export function ToneChip({ tone, children }) {
  const t = tone === "bad" || tone === "warn" ? tone : "mute";
  return <span style={chip(t)}>{children}</span>;
}

export function levelLabel(level, ar = true) {
  const row = ORG_LEVEL_LABELS[level] || ORG_LEVEL_LABELS.unit;
  return ar ? row.ar : row.en;
}

/**
 * A gate's named refusal, in the reader's language — a bad chip that wraps. When the hold is
 * statutory (gate.article), «⚖ التزامك» sits beside it and opens the article's official text.
 */
export function GateLine({ gate, ar = true }) {
  if (!gate || gate.ok) return null;
  const reason = ar ? (gate.reason || gate.error) : (gate.reasonEn || gate.reason || gate.error);
  const article = gate.article ? String(gate.article) : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", alignSelf: "flex-start", maxWidth: "100%" }}>
      <p role="alert" style={chip("bad", { margin: 0, height: "auto", minHeight: 24, whiteSpace: "normal", lineHeight: 1.7, padding: "4px 10px", fontSize: 12, fontWeight: 500 })}>
        {reason}
      </p>
      {article ? (
        <RightHint
          ar={ar}
          hint={{
            view: "manager",
            right: reason,
            ifNot: ar ? "يبقى القرار موقوفاً حتى يُستوفى الشرط — المنصة لا تنشره قبله." : "The decision stays held until the condition is met — the platform will not publish it before.",
            law: { article, label: ar ? `المادة ${article}` : `Art. ${article}` },
          }}
        />
      ) : null}
    </div>
  );
}

export function OkLine({ children }) {
  return <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: "var(--nv-ok-ink)" }}>{children}</p>;
}

export function Note({ children, style }) {
  return <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: "var(--nv-muted)", ...style }}>{children}</p>;
}

/** Sub-heading inside a slab body (13/700 + a mono count). */
export function SubHead({ children, count }) {
  return (
    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>
      {children}
      {count != null ? <span dir="ltr" style={{ ...mono, fontSize: 11.5, fontWeight: 600, color: "var(--nv-muted)", marginInline: 6 }}>{count}</span> : null}
    </p>
  );
}

/**
 * One calm summary line instead of a stat row: numbers in ink, joined into a single sentence.
 * parts: [{ key, value, label }] — the label reads after the number («٤ شاغرة»).
 */
export function SummaryLine({ parts = [], label, style }) {
  const shown = parts.filter((p) => p && p.value !== undefined && p.value !== null && p.value !== "");
  if (!shown.length) return null;
  return (
    <p className="nv-od-summary" aria-label={label} style={style}>
      {shown.map((p) => (
        <span key={p.key}>{p.before ? `${p.before} ` : ""}<b dir="ltr">{p.value}</b>{p.label ? ` ${p.label}` : ""}</span>
      ))}
    </p>
  );
}

/** Empty state that invites the next action — a row, not a box. */
export function EmptyInvite({ text, action }) {
  return (
    <div style={{ padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <Note style={{ maxWidth: "62ch", color: "var(--nv-ink2)" }}>{text}</Note>
      {action || null}
    </div>
  );
}

/**
 * Side drawer — scrim + a card-coloured sheet on the inline-end edge (full width on a phone).
 * Escape and the scrim close it; focus returns to where it was.
 */
export function OrgDrawer({ open = true, label, onClose, children, width = 440 }) {
  const sheet = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    sheet.current?.focus?.();
    const onKey = (event) => { if (event.key === "Escape") close.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="nv-od-scrim" dir={document.documentElement.dir || "rtl"} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <aside ref={sheet} tabIndex={-1} className="nv-od-drawer" role="dialog" aria-modal="true" aria-label={label} style={{ width: `min(${width}px, 100%)` }}>
        {children}
      </aside>
    </div>,
    document.body,
  );
}

/** Drawer head — avatar slot, title + muted sub, a quiet close. */
export function DrawerHead({ lead, title, sub, onClose, ar = true, closeRef }) {
  return (
    <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", gap: 12, alignItems: "flex-start" }}>
      {lead || null}
      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.4 }}>{title}</span>
        {sub ? <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.65 }}>{sub}</span> : null}
      </div>
      <button ref={closeRef} type="button" onClick={onClose} style={btnGhost({ height: 30, padding: "0 10px" })}>{ar ? "إغلاق" : "Close"}</button>
    </header>
  );
}

export function seatOptionLabel(row, ar = true) {
  const who = row.holderName || (row.actingName ? `${row.actingName} ${ar ? "(تكليف)" : "(acting)"}` : (ar ? "شاغر" : "vacant"));
  return `${row.code} · ${row.title} — ${who}`;
}

export function fmtDay(day, ar = true) {
  const s = String(day || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
  try {
    return new Date(`${s}T12:00:00`).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}
