import React, { useState } from "react";
import { checkRestPlanGate, flexBreakOf, restPlanChoices } from "@/lib/shiftDerivations";
import { minutesAr } from "@/lib/dutyAlerts";
import TimeField from "@/components/shared/TimeField";
import { citeRule } from "@/lib/laborRules";

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" };
const label = { fontSize: 11, color: "var(--nv-muted)" };
const toMin = (hm) => {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** Arabic count of hours: 3–10 «ساعات», 11 and up «ساعة», 1 «ساعة», 2 «ساعتان». */
const hoursAr = (n) => (n === 1 ? "ساعة واحدة" : n === 2 ? "ساعتان" : n >= 3 && n <= 10 ? `${n} ساعات` : `${n} ساعة`);
/** Hours and minutes in words — 510 → «8 ساعات و30 دقيقة», never a rounded hour. */
const spanAr = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h ? `${hoursAr(h)} و` : ""}${m} دقيقة` : hoursAr(h);
};
const spanEn = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};
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

/** A source tag: the statute is quiet green, the company's own decision is a warm neutral — the two never blur. */
function SourceTag({ kind, children }) {
  const law = kind === "law";
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.5, padding: "1px 8px", borderRadius: 999, whiteSpace: "nowrap", border: `1px solid ${law ? "var(--nv-ok-line)" : "#E2D3AE"}`, background: law ? "var(--nv-ok-soft)" : "#FBF6EA", color: law ? "var(--nv-ok-ink)" : "#6B5418" }}>
      {children}
    </span>
  );
}

/**
 * «تركيب دوامك» — the day read as its parts, each with where it comes from: actual work from the Labour Law
 * (Art. 98), the rest from the Labour Law too (Arts. 101–102: owed, not counted as work), the duty as their sum. Derived from the shift.
 */
export function DutyComposition({ ar = true, flex, onDate, minClock, maxClock }) {
  const work = flex.span - flex.minutes;
  const daily = citeRule("hours.shift.ordinaryHours", onDate);
  const weekly = citeRule("hours.week.ordinaryMaxHours", onDate);
  const dailyMax = Number(daily?.value || 8) * 60;
  const restLaw = citeRule("hours.rest.duringShiftMinutes", onDate);
  const notWorkLaw = citeRule("hours.rest.notWorkingHours.cite", onDate);
  const twelve = flex.span === 720;
  const workSource = twelve
    ? (ar ? `نظام العمل · ${weekly?.labelAr || "المادة 98"} · أسبوعي` : `Labour Law · ${weekly?.labelEn || "Art. 98"} · weekly`)
    : work <= dailyMax
      ? (ar ? `نظام العمل · ${daily?.labelAr || "المادة 98"}` : `Labour Law · ${daily?.labelEn || "Art. 98"}`)
      : (ar ? `فوق ${daily?.value || 8} ساعات — عمل إضافي` : `Past ${daily?.value || 8} h — overtime`);
  const rows = [
    { key: "work", label: ar ? "العمل الفعلي" : "Actual work", value: ar ? spanAr(work) : spanEn(work), tag: <SourceTag kind="law">{workSource}</SourceTag> },
    { key: "rest", label: ar ? "الراحة" : "Rest", value: minutesAr(flex.minutes), tag: <SourceTag kind="law">{ar ? `نظام العمل · المادتان ${restLaw?.article || "101"} و${notWorkLaw?.article || "102"}` : `Labour Law · Arts. ${restLaw?.article || "101"} & ${notWorkLaw?.article || "102"}`}</SourceTag> },
  ];
  const cell = { padding: "7px 10px", fontSize: 12, borderTop: "1px solid var(--nv-line)" };
  return (
    <div data-duty-composition="1" style={{ border: "1px solid var(--nv-line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "var(--nv-muted)", background: "var(--nv-soft, #F7F9F8)" }}>{ar ? "تركيب دوامك" : "Your duty, in parts"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto minmax(0, 1fr)", alignItems: "center" }}>
        {rows.map((row) => (
          <React.Fragment key={row.key}>
            <span style={{ ...cell, color: "var(--nv-ink2)", whiteSpace: "nowrap" }}>{row.label}</span>
            <span style={{ ...cell, fontWeight: 700, color: "var(--nv-ink)", whiteSpace: "nowrap" }}>{row.value}</span>
            <span style={{ ...cell, display: "flex", justifyContent: "flex-end", minWidth: 0 }}>{row.tag}</span>
          </React.Fragment>
        ))}
        <span style={{ ...cell, borderTop: "1.5px solid var(--nv-ink2)", fontWeight: 700, color: "var(--nv-ink)", whiteSpace: "nowrap" }}>{ar ? "الدوام" : "Duty"}</span>
        <span style={{ ...cell, borderTop: "1.5px solid var(--nv-ink2)", fontWeight: 700, color: "var(--nv-ink)", whiteSpace: "nowrap" }}>{ar ? spanAr(flex.span) : spanEn(flex.span)}</span>
        <span dir="ltr" style={{ ...cell, borderTop: "1.5px solid var(--nv-ink2)", ...MONO, fontSize: 11.5, color: "var(--nv-muted)", textAlign: "left" }}>{minClock}–{maxClock}</span>
      </div>
      <div data-rest-length-source="1" style={{ padding: "6px 10px", borderTop: "1px solid var(--nv-line)", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6 }}>
        {flex.minutes > Number(restLaw?.value || 30)
          ? (ar
            ? `الحد النظامي للراحة ${restLaw?.value || 30} دقيقة في المرة الواحدة، تجمع الراحة والصلاة والطعام. ومدة ${minutesAr(flex.minutes)} حددتها إدارتك في جدول الورديات.`
            : `The statutory minimum is ${restLaw?.value || 30} min at a time, for rest, prayer and food together. ${flex.minutes} min was set by your management on the roster.`)
          : (ar
            ? `راحتك هي الحد النظامي: ${restLaw?.value || 30} دقيقة في المرة الواحدة، تجمع الراحة والصلاة والطعام.`
            : `Your break is the statutory minimum: ${restLaw?.value || 30} min at a time, for rest, prayer and food together.`)}
      </div>
    </div>
  );
}

/** The statutory bounds on where the rest may fall — each line names its article from the catalog. */
function RestRules({ ar = true, onDate, prayerLine }) {
  const consec = citeRule("hours.rest.maxConsecutiveHours", onDate);
  const minRest = citeRule("hours.rest.duringShiftMinutes", onDate);
  const notWork = citeRule("hours.rest.notWorkingHours.cite", onDate);
  const lines = [
    [ar ? `لا تعمل أكثر من ${consec?.value || 5} ساعات متصلة دون راحة.` : `No more than ${consec?.value || 5} hours of work in a row.`, ar ? consec?.labelAr : consec?.labelEn],
    [ar ? `لا تقل الراحة عن ${minRest?.value || 30} دقيقة في المرة الواحدة.` : `Rest is at least ${minRest?.value || 30} min at a time.`, ar ? minRest?.labelAr : minRest?.labelEn],
    [ar ? "الراحة والصلاة والطعام فيها ليست من ساعات العمل الفعلية." : "Rest, prayer and meals in it are not actual work.", ar ? notWork?.labelAr : notWork?.labelEn],
    [ar ? "وقت راحتك لك: لست فيه تحت سلطة صاحب العمل، ولا يُلزمك بالبقاء في مكان العمل." : "Your rest is yours: you are not under the employer's authority and may not be required to stay at the workplace.", ar ? notWork?.labelAr : notWork?.labelEn],
    [prayerLine, null],
  ];
  return (
    <div data-rest-rule="1" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-muted)" }}>{ar ? "الضوابط النظامية" : "Statutory bounds"}</span>
      {lines.map(([text, art], i) => (
        <span key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
          <span aria-hidden style={{ width: 4, height: 4, borderRadius: 999, background: "var(--nv-muted)", flex: "none", transform: "translateY(-2px)" }} />
          <span style={{ flex: 1 }}>{text}</span>
          {art ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nv-ok-ink)", whiteSpace: "nowrap" }}>{art}</span> : null}
        </span>
      ))}
    </div>
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
    ? `تحدد وقت راحتك بنفسك بين ${minClock} و${maxClock}، مرة واحدة أو على جزأين.`
    : `You set your own break between ${minClock} and ${maxClock}, in one block or two.`;
  const composition = <DutyComposition ar={ar} flex={flex} onDate={onDate} minClock={minClock} maxClock={maxClock} />;

  if (savedGate?.ok && !editing) {
    return (
      <RestCard ar={ar} note={ar ? "نخبرك حين تبدأ — لا تحتاج بصمة، وتُحتسب راحتك في هذا الوقت." : "We tell you when it starts — no punch needed; your break counts at this time."}>
        <div data-rest-plan="saved" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", border: "1px solid var(--nv-ok-line)", background: "var(--nv-ok-soft)", borderRadius: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink)" }}>{ar ? "راحتك المخطّطة" : "Planned"}</span>
          <span dir="ltr" style={{ ...MONO, fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{savedGate.rows.map((row) => `${row.start}–${row.end}`).join("  ·  ")}</span>
          {!locked ? (
            <button type="button" onClick={() => setEditing(true)} style={{ marginInlineStart: "auto", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {ar ? "غيّر" : "Change"}
            </button>
          ) : null}
        </div>
        {composition}
      </RestCard>
    );
  }
  if (locked) return null;

  const ready = !!gate?.ok;
  const endOf = (start, minutes) => (toMin(start) == null ? "" : hmOf(toMin(start) + minutes));
  return (
    <RestCard ar={ar} note={note}>
      <div data-rest-plan="edit" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {composition}
        {flex.span === 720 ? (
          <span data-rest-twelve="1" style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
            {ar
              ? "نظام 4 أيام عمل و4 أيام راحة: يُقاس العمل فيه أسبوعياً لا يومياً — 11 ساعة × 4 أيام = 44 ساعة، ضمن حد 48 ساعة في الأسبوع."
              : "Four days on, four off: work is measured weekly, not daily — 11 h × 4 days = 44 h a week, within the cap."}
          </span>
        ) : null}
        <RestRules ar={ar} onDate={onDate} prayerLine={ar ? "صلاتك أثناء العمل خارج الراحة لا تُستقطع ولا تطيل دوامك." : "A prayer during work, outside the rest, is not deducted and does not lengthen your day."} />
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
            <span style={label}>{split ? (ar ? `الجزء الأول · ${minutesAr(half)}` : `Part 1 · ${half} min`) : (ar ? `تبدأ راحتك · ${minutesAr(flex.minutes)}` : `Your break starts · ${flex.minutes} min`)}</span>
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
