import React from "react";
import NvIcon from "@/components/shared/NvIcon";
import { mono } from "@/components/schedules/scheduleChrome";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { checkShiftBreakModeGate, flexBreakOf, minutesBetween, shiftBreakMode } from "@/lib/shiftDerivations";
import { citeRule, ruleValue } from "@/lib/laborRules";

const hmOf = (mins) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const clockOf = (hm) => {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * A lawful starting window for a new flex break: every start inside it keeps the work before and after
 * within the consecutive-hours limit (Art. 101). A shift within the limit takes its whole span.
 */
export function defaultFlexBreak(shift, onDate) {
  const minRest = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
  const maxMin = (ruleValue("hours.rest.maxConsecutiveHours", onDate) || 5) * 60;
  const start = clockOf(shift?.start) ?? 0;
  const span = minutesBetween(shift?.start || "00:00", shift?.end || "00:00") || 1440;
  const minutes = Math.max(minRest, Number(shift?.flexBreak?.minutes) || Number(shift?.restMinutes) || 60);
  // An hour or more is split by default: two parts of at least the statutory minimum, so the worker can
  // rest early and again later without five hours in a row on either side (Art. 101). A split break gets a
  // wide window — from the first minimum part after the start to the last one before the end.
  const split = minutes >= minRest * 2;
  if (split && span > minRest * 2) {
    return { minutes, from: hmOf(start + minRest), to: hmOf(start + span - minRest), split: true, earlyEnd: false };
  }
  const fromOff = span > maxMin ? Math.max(0, span - minutes - maxMin) : 0;
  const toOff = span > maxMin ? Math.min(span, maxMin + minutes) : span;
  return { minutes, from: hmOf(start + fromOff), to: hmOf(start + toOff), split: false, earlyEnd: false };
}

/**
 * «الراحة» for one shift type in «أنواع الورديات»: راحة ثابتة · راحة مرنة ببصمة · عمل متواصل (المادة 103).
 * Art. 103 continuous work is not offered (removed by the owner) — every shift keeps its rest (Art. 101). The flex fields are
 * validated with named reasons (checkShiftBreakModeGate, the same gate the server twin runs).
 */
export default function ShiftBreakMode({ ar = true, shift, canEdit = false, continuous103 = false, onDate, onChange }) {
  const mode = shiftBreakMode(shift, { continuous103 });
  const gate = checkShiftBreakModeGate({ shift, onDate, continuous103 });
  const flex = flexBreakOf(shift, onDate);
  const minRest = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
  const art103 = citeRule("hours.art103.cite", onDate)?.labelAr || "المادة 103";
  const field = { ...mono, fontSize: 11, padding: "4px 6px", border: "1px solid var(--nv-line)", borderRadius: DS_CONTROL_RADIUS, background: "var(--nv-card)", color: "var(--nv-ink)", outline: "none", boxSizing: "border-box", minWidth: 0 };
  // The window is the whole duty — the worker picks his own start inside it (RestPlanPicker).
  const setFlex = (patch) => onChange?.({ breakMode: "flex", flexBreak: { ...defaultFlexBreak(shift, onDate), ...(shift?.flexBreak || {}), from: shift.start, to: shift.end, ...patch } });

  if (!canEdit) {
    const line = mode === "continuous"
      ? (ar ? `عمل متواصل (${art103}) — بلا توقف` : "Continuous work (Art. 103) — no stop")
      : mode === "flex" && flex
        ? (ar ? `الراحة ${flex.minutes} د من ساعات الوردية — يختار الموظف وقتها في «بصمتي» بلا بصمة` : `${flex.minutes}m rest from the shift's hours — the worker picks its time in «My punch», no punch`)
        : (ar ? "لا راحة — الوردية خمس ساعات أو أقل" : "No rest — the shift is five hours or less");
    return (
      <span data-break-mode={mode} style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.7 }}>
        {line}
        {mode === "flex" && flex?.splitEffective ? (ar ? "، ويجوز أن يقسمها جزأين" : ", in up to two parts") : null}
      </span>
    );
  }

  return (
    <div data-break-mode={mode} style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
      {mode === "flex" && flex ? (
        <div data-flex-break={shift.id} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--nv-muted)", minWidth: 0 }}>
            {ar ? `مدة الراحة (د) — لا تقل عن ${minRest}` : `Break minutes — at least ${minRest}`}
            <input
              type="number"
              dir="ltr"
              min={minRest}
              step={5}
              value={flex.minutes}
              data-flex-minutes
              onChange={(e) => setFlex({ minutes: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              style={{ ...field, width: 90 }}
            />
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.6, paddingBottom: 4 }}>
            <input type="checkbox" checked={flex.split} data-flex-split onChange={(e) => setFlex({ split: e.target.checked })} />
            <span>{ar ? `يجوز تقسيمها — لا يقل الجزء عن ${minRest} دقيقة` : `May be split — each part at least ${minRest} minutes`}</span>
          </label>
        </div>
      ) : (
        <span style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.7 }}>
          {ar ? "يحدّد الجدول وقت الراحة ومدتها، ولا تُحسب من ساعات العمل." : "The roster sets the break's time and length; it is not counted as work."}
        </span>
      )}
      {mode === "flex" ? (
        gate.ok ? (
          <span data-flex-gate="ok" style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.7 }}>
            {ar
              ? "يختار الموظف متى تبدأ راحته داخل دوامه من «بصمتي»، ونخبره حين تبدأ بلا بصمة. ولا تقبل المنصة وقتاً يترك أكثر من خمس ساعات عمل متصلة (المادة 101)."
              : "The worker chooses when the break starts inside the duty, in «My punch»; we tell him when it starts, no punch. No time leaving more than five hours of work in a row is accepted (Art. 101)."}
            {gate.noteAr ? ` ${ar ? gate.noteAr : gate.noteEn}` : ""}
          </span>
        ) : (
          <span data-flex-gate={gate.error} role="alert" style={{ fontSize: 11, color: "var(--nv-warn-ink)", lineHeight: 1.7, display: "flex", gap: 5, alignItems: "baseline" }}>
            <NvIcon name="warning" size={12} />
            <span>{ar ? gate.reason : gate.reasonEn}</span>
          </span>
        )
      ) : null}
    </div>
  );
}
