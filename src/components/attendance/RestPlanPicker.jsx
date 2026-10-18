import React, { useMemo, useState } from "react";
import { checkRestPlanGate, restPlanChoices } from "@/lib/shiftDerivations";
import { minutesAr } from "@/lib/dutyAlerts";

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" };
const field = {
  fontFamily: "inherit",
  height: 36,
  padding: "0 10px",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  fontSize: 13,
  minWidth: 0,
};
const label = { fontSize: 11, color: "var(--nv-muted)" };

/**
 * «وقت راحتك» — on a flex shift the worker places his own break ahead of time, in a place he finds right.
 * Only lawful times are offered (checkRestPlanGate · Art. 101), so nothing he can pick breaks the five-hour
 * limit. The plan drives the day path and, when he forgets to punch, where the break is assumed.
 */
export default function RestPlanPicker({ ar = true, shift, onDate, continuous103 = false, saved = null, locked = false, onSave }) {
  const choices = useMemo(() => restPlanChoices({ shift, onDate, continuous103 }), [shift, onDate, continuous103]);
  const flex = choices.flex;
  const savedParts = saved?.parts || null;
  const [editing, setEditing] = useState(!savedParts);
  const [split, setSplit] = useState(savedParts ? savedParts.length > 1 : false);
  const [first, setFirst] = useState(savedParts?.[0]?.start || "");
  const [second, setSecond] = useState(savedParts?.[1]?.start || "");
  const [error, setError] = useState("");
  if (!flex || (!choices.single.length && !choices.pairs.length)) return null;

  const savedGate = savedParts ? checkRestPlanGate({ shift, onDate, parts: savedParts, continuous103 }) : null;
  const pair = choices.pairs.find((row) => row.first === first) || null;

  if (savedGate?.ok && !editing) {
    return (
      <div data-rest-plan="saved" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", border: "1px solid var(--nv-ok-line)", background: "var(--nv-ok-soft)", borderRadius: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ok-ink)" }}>{ar ? "راحتك المخطّطة" : "Your planned break"}</span>
        <span dir="ltr" style={{ ...MONO, fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>
          {savedGate.rows.map((row) => `${row.start}–${row.end}`).join("  ·  ")}
        </span>
        <span style={{ fontSize: 11, color: "var(--nv-muted)", flex: "1 1 160px" }}>
          {ar ? "اضغط «بدأت راحتي» عند بدايتها — وإن نسيت تُحتسب في هذا الوقت." : "Tap “I started my break” when it starts — if you forget, it is counted at this time."}
        </span>
        {!locked ? (
          <button type="button" onClick={() => setEditing(true)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {ar ? "غيّر" : "Change"}
          </button>
        ) : null}
      </div>
    );
  }
  if (locked) return null;

  const save = () => {
    const parts = split && pair
      ? [{ start: first, minutes: pair.firstMinutes }, { start: second, minutes: pair.secondMinutes }]
      : [{ start: first, minutes: flex.minutes }];
    const gate = checkRestPlanGate({ shift, onDate, parts, continuous103 });
    if (!gate.ok) { setError(ar ? gate.reason : gate.reasonEn); return; }
    setError("");
    onSave?.(parts);
    setEditing(false);
  };
  const firstOptions = split ? choices.pairs.map((row) => row.first) : choices.single;
  const ready = split ? !!(first && second && pair?.seconds.includes(second)) : !!(first && choices.single.includes(first));

  return (
    <div data-rest-plan="edit" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 12px", border: "1px solid var(--nv-line)", background: "var(--nv-soft, #F7F9F8)", borderRadius: 10 }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "حدّد وقت راحتك" : "Set your break time"}</strong>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
          {ar
            ? `${minutesAr(flex.minutes)} تختار مكانها بما يناسبك — تظهر هنا الأوقات التي لا تتجاوز فيها 5 ساعات عمل متواصلة (المادة 101).`
            : `${flex.minutes} min placed where it suits you — only times that keep you within 5 hours of work in a row are listed (Art. 101).`}
        </span>
      </span>
      {choices.pairs.length && choices.single.length ? (
        <span style={{ display: "inline-flex", gap: 6 }}>
          {[[false, ar ? "مرة واحدة" : "One block"], [true, ar ? "جزءان" : "Two parts"]].map(([value, text]) => (
            <button key={String(value)} type="button" onClick={() => { setSplit(value); setFirst(""); setSecond(""); setError(""); }} style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 999, border: split === value ? "none" : "1px solid var(--nv-line)", background: split === value ? "#0B3D27" : "var(--nv-card)", color: split === value ? "#fff" : "var(--nv-ink)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {text}
            </button>
          ))}
        </span>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={label}>{split ? (ar ? `الجزء الأول · ${minutesAr(pair?.firstMinutes || Math.floor(flex.minutes / 2))}` : "First part") : (ar ? `تبدأ راحتك · ${minutesAr(flex.minutes)}` : "Your break starts")}</span>
          <select data-rest-plan-first value={first} onChange={(event) => { setFirst(event.target.value); setSecond(""); setError(""); }} dir="ltr" style={{ ...field, ...MONO }}>
            <option value="">—</option>
            {firstOptions.map((start) => <option key={start} value={start}>{start}</option>)}
          </select>
        </label>
        {split ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>{ar ? `الجزء الثاني · ${minutesAr(pair?.secondMinutes || Math.ceil(flex.minutes / 2))}` : "Second part"}</span>
            <select data-rest-plan-second value={second} disabled={!pair} onChange={(event) => { setSecond(event.target.value); setError(""); }} dir="ltr" style={{ ...field, ...MONO }}>
              <option value="">—</option>
              {(pair?.seconds || []).map((start) => <option key={start} value={start}>{start}</option>)}
            </select>
          </label>
        ) : null}
        <button type="button" data-rest-plan-save disabled={!ready} onClick={save} style={{ fontFamily: "inherit", height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: ready ? "#0B3D27" : "var(--nv-line)", color: ready ? "#fff" : "var(--nv-muted)", fontSize: 12.5, fontWeight: 700, cursor: ready ? "pointer" : "default" }}>
          {ar ? "احفظ وقت راحتي" : "Save my break time"}
        </button>
        {savedGate?.ok ? (
          <button type="button" onClick={() => setEditing(false)} style={{ fontFamily: "inherit", fontSize: 12, color: "var(--nv-muted)", background: "none", border: "none", cursor: "pointer" }}>{ar ? "إلغاء" : "Cancel"}</button>
        ) : null}
      </div>
      {error ? <span role="alert" style={{ fontSize: 11.5, color: "var(--nv-bad-ink)" }}>{error}</span> : null}
    </div>
  );
}
