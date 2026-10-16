import React from "react";
import { ORG_LEVEL_LABELS, SEAT_STATE_LABELS } from "@/lib/orgDesign";
import "./orgDesign.css";

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.slice(0, 1)).join("") || "—";
}

/** A person on a seat — initials + name; a vacant seat is drawn dashed. */
export function Face({ name, vacant = false, sub = "", ar = true }) {
  return (
    <span className="nv-od-face">
      <span className="nv-od-initials" data-vacant={vacant ? "1" : "0"} aria-hidden>{vacant ? "—" : initialsOf(name)}</span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <b>{vacant ? (ar ? "شاغر" : "Vacant") : name}</b>
        {sub ? <span className="nv-od-muted" style={{ fontSize: 11.5 }}>{sub}</span> : null}
      </span>
    </span>
  );
}

const STATE_TONE = { filled: "ok", vacant: "vacant", frozen: "", planned: "" };

export function StateChip({ state, ar = true }) {
  const label = SEAT_STATE_LABELS[state] || SEAT_STATE_LABELS.vacant;
  return <span className="nv-od-state" data-tone={STATE_TONE[state] || ""}>{ar ? label.ar : label.en}</span>;
}

export function ToneChip({ tone, children }) {
  return <span className="nv-od-state" data-tone={tone || ""}>{children}</span>;
}

export function levelLabel(level, ar = true) {
  const row = ORG_LEVEL_LABELS[level] || ORG_LEVEL_LABELS.unit;
  return ar ? row.ar : row.en;
}

/** A gate's named refusal, in the reader's language. */
export function GateLine({ gate, ar = true }) {
  if (!gate || gate.ok) return null;
  return <p className="nv-od-gate" role="alert">{ar ? (gate.reason || gate.error) : (gate.reasonEn || gate.reason || gate.error)}</p>;
}

export function SectionHead({ title, hint, children }) {
  return (
    <div className="nv-od-head">
      <div style={{ minWidth: 0 }}>
        <h2>{title}</h2>
        {hint ? <p>{hint}</p> : null}
      </div>
      {children ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div> : null}
    </div>
  );
}

/**
 * One calm summary line instead of a stat row: numbers in ink, joined into a single sentence.
 * parts: [{ key, value, label }] — the label reads after the number («٤ شاغرة»).
 */
export function SummaryLine({ parts = [], label }) {
  const shown = parts.filter((p) => p && p.value !== undefined && p.value !== null && p.value !== "");
  if (!shown.length) return null;
  return (
    <p className="nv-od-summary" aria-label={label}>
      {shown.map((p) => (
        <span key={p.key}>{p.before ? `${p.before} ` : ""}<b>{p.value}</b>{p.label ? ` ${p.label}` : ""}</span>
      ))}
    </p>
  );
}

/** Empty state that invites the next action. */
export function EmptyInvite({ text, action }) {
  return (
    <div className="nv-od-paper" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <p className="nv-od-note" style={{ maxWidth: "60ch" }}>{text}</p>
      {action || null}
    </div>
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
