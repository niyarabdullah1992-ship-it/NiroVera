import React, { useState } from "react";
import { checkRestPlanGate, flexBreakOf, restPlanChoices } from "@/lib/shiftDerivations";
import { minutesAr } from "@/lib/dutyAlerts";
import TimeField from "@/components/shared/TimeField";

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" };
const label = { fontSize: 11, color: "var(--nv-muted)" };
const toMin = (hm) => {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** Arabic count of hours: 3–10 «ساعات», 11 and up «ساعة», 1 «ساعة», 2 «ساعتان». */
const hoursAr = (n) => (n === 1 ? "ساعة واحدة" : n === 2 ? "ساعتان" : n >= 3 && n <= 10 ? `${n} ساعات` : `${n} ساعة`);
const hmOf = (mins) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Card frame — the same as «سلسلة البصمة» beside it. */
export function RestCard({ ar = true, children, note }) {
  return (
    <section data-rest-plan-card="1" className="nv-att-card" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: "var(--nv-radius, 12px)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <strong style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "وقت راحتك" : "Your break time"}</strong>
        {note ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>{note}</span> : null}
      </span>
      {children}
    </section>
  );
}

/**
 * «وقت راحتك» — on a shift past 8 hours the worker writes his own break time, anywhere inside his duty
 * hours. The time is open; it is checked as he types (Art. 101 — no more than five hours of work in a row,
 * named), and a prayer or nursing hour it covers is said, not hidden.
 */
export default function RestPlanPicker({ ar = true, shift, onDate, continuous103 = false, saved = null, locked = false, onSave, avoid = [], avoidNames = [] }) {
  const flex = flexBreakOf(shift, onDate);
  const savedParts = saved?.parts || null;
  const [editing, setEditing] = useState(!savedParts);
  // A long day where one block cannot keep every stretch within five hours opens on «جزءان».
  const [split, setSplit] = useState(() => (savedParts ? savedParts.length > 1 : (flex?.splitEffective && !restPlanChoices({ shift, onDate, continuous103 }).single.length)));
  const [first, setFirst] = useState(savedParts?.[0]?.start || "");
  const [second, setSecond] = useState(savedParts?.[1]?.start || "");
  if (!flex) return null;

  const half = Math.floor(flex.minutes / 2);
  const parts = split
    ? [first && { start: first, minutes: half }, second && { start: second, minutes: flex.minutes - half }].filter(Boolean)
    : (first ? [{ start: first, minutes: flex.minutes }] : []);
  const complete = split ? parts.length === 2 : parts.length === 1;
  const gate = complete ? checkRestPlanGate({ shift, onDate, parts, continuous103 }) : null;
  // A prayer or nursing hour inside the chosen time is said — the choice stays his.
  const lift = (m) => (m + 720 < flex.shiftStart ? m + 1440 : m);
  const clashes = gate?.ok
    ? avoid.map((row, i) => ({ ...row, name: avoidNames[i] })).filter((row) => gate.rows.some((r) => {
      const from = lift(Number(row.from));
      const to = Math.max(from + 1, lift(Number(row.to ?? row.from)));
      return from < r.endMin && to > r.startMin;
    })).map((row) => row.name).filter(Boolean)
    : [];
  const savedGate = savedParts ? checkRestPlanGate({ shift, onDate, parts: savedParts, continuous103 }) : null;
  const minClock = hmOf(flex.shiftStart);
  const maxClock = hmOf(flex.shiftStart + flex.span);
  const note = ar
    ? `قرار تشغيلي من المنشأة: ${hoursAr(Math.round((flex.span - flex.minutes) / 60))} عمل و${minutesAr(flex.minutes)} راحة، فدوامك ${hoursAr(Math.round(flex.span / 60))}. تكتب وقت راحتك بنفسك بين ${minClock} و${maxClock}.`
    : `An operational decision of the company: ${Math.round((flex.span - flex.minutes) / 60)} hours of work and ${flex.minutes} min of rest, so your duty is ${Math.round(flex.span / 60)} hours. Write your break time yourself between ${minClock} and ${maxClock}.`;

  if (savedGate?.ok && !editing) {
    return (
      <RestCard ar={ar} note={ar ? "اضغط «بدأت راحتي» عند بدايتها — وإن نسيت تُحتسب في هذا الوقت." : "Tap “I started my break” when it starts — if you forget, it is counted at this time."}>
        <div data-rest-plan="saved" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", border: "1px solid var(--nv-ok-line)", background: "var(--nv-ok-soft)", borderRadius: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink)" }}>{ar ? "راحتك المخطّطة" : "Planned"}</span>
          <span dir="ltr" style={{ ...MONO, fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{savedGate.rows.map((row) => `${row.start}–${row.end}`).join("  ·  ")}</span>
          {!locked ? (
            <button type="button" onClick={() => setEditing(true)} style={{ marginInlineStart: "auto", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {ar ? "غيّر" : "Change"}
            </button>
          ) : null}
        </div>
      </RestCard>
    );
  }
  if (locked) return null;

  const ready = !!gate?.ok;
  const endOf = (start, minutes) => (toMin(start) == null ? "" : hmOf(toMin(start) + minutes));
  return (
    <RestCard ar={ar} note={note}>
      <div data-rest-plan="edit" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flex.splitEffective ? (
          <span style={{ display: "inline-flex", gap: 6 }}>
            {[[false, ar ? "مرة واحدة" : "One block"], [true, ar ? "جزءان" : "Two parts"]].map(([value, text]) => (
              <button key={String(value)} type="button" onClick={() => { setSplit(value); setSecond(""); }} style={{ fontFamily: "inherit", height: 26, padding: "0 10px", borderRadius: 999, border: split === value ? "none" : "1px solid var(--nv-line)", background: split === value ? "#0B3D27" : "var(--nv-card)", color: split === value ? "#fff" : "var(--nv-ink)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                {text}
              </button>
            ))}
          </span>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>{split ? (ar ? `الجزء الأول · ${minutesAr(half)}` : `Part 1 · ${half} min`) : (ar ? `من · ${minutesAr(flex.minutes)}` : `From · ${flex.minutes} min`)}</span>
            <TimeField ar={ar} dataKey="rest-first" value={first} min={minClock} max={maxClock} step={5} onChange={setFirst} />
          </label>
          {split ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>{ar ? `الجزء الثاني · ${minutesAr(flex.minutes - half)}` : `Part 2 · ${flex.minutes - half} min`}</span>
              <TimeField ar={ar} dataKey="rest-second" value={second} min={minClock} max={maxClock} step={5} onChange={setSecond} />
            </label>
          ) : null}
          <button type="button" data-rest-plan-save disabled={!ready} onClick={() => { onSave?.(parts); setEditing(false); }} style={{ fontFamily: "inherit", height: 32, padding: "0 14px", borderRadius: 8, border: "none", background: ready ? "#0B3D27" : "var(--nv-line)", color: ready ? "#fff" : "var(--nv-muted)", fontSize: 12, fontWeight: 700, cursor: ready ? "pointer" : "default" }}>
            {ar ? "احفظ" : "Save"}
          </button>
          {savedGate?.ok ? (
            <button type="button" onClick={() => setEditing(false)} style={{ fontFamily: "inherit", fontSize: 12, color: "var(--nv-muted)", background: "none", border: "none", cursor: "pointer" }}>{ar ? "إلغاء" : "Cancel"}</button>
          ) : null}
        </div>
        {complete && gate && !gate.ok ? (
          <span role="alert" data-rest-plan-reason={gate.error} style={{ fontSize: 11.5, color: "var(--nv-bad-ink)", lineHeight: 1.6 }}>{ar ? gate.reason : gate.reasonEn}</span>
        ) : gate?.ok ? (
          <span data-rest-plan-preview style={{ fontSize: 11.5, color: "var(--nv-ok-ink)", lineHeight: 1.6 }}>
            {ar ? "راحتك: " : "Your break: "}
            <span dir="ltr" style={MONO}>{parts.map((row) => `${row.start}–${endOf(row.start, row.minutes)}`).join("  ·  ")}</span>
            {clashes.length ? <span style={{ color: "var(--nv-warn-ink)" }}>{ar ? ` — يقع فيها وقت ${clashes.join(" و")}` : ` — covers ${clashes.join(" and ")}`}</span> : null}
          </span>
        ) : null}
      </div>
    </RestCard>
  );
}
