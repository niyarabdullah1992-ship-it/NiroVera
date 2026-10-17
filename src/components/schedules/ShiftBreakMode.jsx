import React from "react";
import NvIcon from "@/components/shared/NvIcon";
import { chipButton, mono } from "@/components/schedules/scheduleChrome";
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
  const fromOff = span > maxMin ? Math.max(0, span - minutes - maxMin) : 0;
  const toOff = span > maxMin ? Math.min(span, maxMin + minutes) : span;
  return { minutes, from: hmOf(start + fromOff), to: hmOf(start + toOff), split: false, earlyEnd: false };
}

/**
 * «الراحة» for one shift type in «أنواع الورديات»: راحة ثابتة · راحة مرنة ببصمة · عمل متواصل (المادة 103).
 * Continuous is the hours policy's Art. 103 flag (ContinuousWork103Setting above the shift types) — shown, never stored here. The flex fields are
 * validated with named reasons (checkShiftBreakModeGate, the same gate the server twin runs).
 */
export default function ShiftBreakMode({ ar = true, shift, canEdit = false, continuous103 = false, onDate, onChange }) {
  const mode = shiftBreakMode(shift, { continuous103 });
  const gate = checkShiftBreakModeGate({ shift, onDate, continuous103 });
  const flex = flexBreakOf(shift, onDate);
  const minRest = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
  const art103 = citeRule("hours.art103.cite", onDate)?.labelAr || "المادة 103";
  const field = { ...mono, fontSize: 11, padding: "4px 6px", border: "1px solid var(--nv-line)", borderRadius: DS_CONTROL_RADIUS, background: "var(--nv-card)", color: "var(--nv-ink)", outline: "none", boxSizing: "border-box", minWidth: 0 };
  const setFlex = (patch) => onChange?.({ breakMode: "flex", flexBreak: { ...defaultFlexBreak(shift, onDate), ...(shift?.flexBreak || {}), ...patch } });
  const options = [
    { id: "fixed", ar: "راحة ثابتة", en: "Fixed break" },
    { id: "flex", ar: "راحة مرنة ببصمة", en: "Flex break by punch" },
    { id: "continuous", ar: `عمل متواصل (${art103})`, en: "Continuous work (Art. 103)" },
  ];
  const lockedReason = continuous103
    ? (ar ? `عمل متواصل بقرار الوزير — مفعّل في «لدي قرار الوزير للعمل المتواصل» أعلى أنواع الورديات (${art103}).` : "Continuous work by the Minister's decision — set in «We hold the Minister's decision» above the shift types (Art. 103).")
    : (ar ? `يتطلب قرار الوزير — فعّله من «لدي قرار الوزير للعمل المتواصل» أعلى أنواع الورديات (${art103}).` : "Needs the Minister's decision — turn it on in «We hold the Minister's decision» above the shift types (Art. 103).");

  if (!canEdit) {
    const line = mode === "continuous"
      ? (ar ? `عمل متواصل (${art103}) — بلا توقف` : "Continuous work (Art. 103) — no stop")
      : mode === "flex" && flex
        ? (ar ? `راحة مرنة ${flex.minutes} د ببصمة · ` : `Flex break ${flex.minutes}m by punch · `)
        : (ar ? "راحة ثابتة في الجدول" : "Fixed break on the roster");
    return (
      <span data-break-mode={mode} style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.7 }}>
        {line}
        {mode === "flex" && flex ? <span dir="ltr" style={mono}>{flex.from}–{flex.to}</span> : null}
        {mode === "flex" && flex?.splitEffective ? (ar ? " · تُقسَّم" : " · may split") : null}
      </span>
    );
  }

  return (
    <div data-break-mode={mode} style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
      <div role="radiogroup" aria-label={ar ? "نوع الراحة" : "Break mode"} style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
        <span style={{ fontSize: 10.5, color: "var(--nv-muted)", marginInlineEnd: 2 }}>{ar ? "الراحة" : "Break"}</span>
        {options.map((option) => {
          const on = mode === option.id;
          const disabled = continuous103 ? option.id !== "continuous" : option.id === "continuous";
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={on}
              data-break-option={option.id}
              disabled={disabled}
              title={disabled ? lockedReason : undefined}
              onClick={() => {
                if (disabled || on) return;
                if (option.id === "flex") setFlex({});
                else onChange?.({ breakMode: "fixed" });
              }}
              style={chipButton(on, { height: 26, fontSize: 11, opacity: disabled && !on ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" })}
            >
              {ar ? option.ar : option.en}
            </button>
          );
        })}
      </div>
      {mode === "continuous" || (!continuous103 && mode === "fixed") ? (
        <span style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.7 }}>
          {mode === "continuous"
            ? lockedReason
            : (ar ? "يحدّد الجدول وقت الراحة، ولا يضغط الموظف شيئاً — تُخصم من ساعاته." : "The roster sets the break; the worker presses nothing — it is deducted.")}
        </span>
      ) : null}
      {mode === "flex" && flex ? (
        <div data-flex-break={shift.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 6, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--nv-muted)", minWidth: 0 }}>
            {ar ? "مدة الراحة (د)" : "Break minutes"}
            <input
              type="number"
              dir="ltr"
              min={minRest}
              step={5}
              value={flex.minutes}
              data-flex-minutes
              onChange={(e) => setFlex({ minutes: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              style={{ ...field, width: "100%" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--nv-muted)", minWidth: 0 }}>
            {ar ? "النافذة من" : "Window from"}
            <input type="time" dir="ltr" value={flex.from} data-flex-from onChange={(e) => e.target.value && setFlex({ from: e.target.value })} style={{ ...field, width: "100%" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--nv-muted)", minWidth: 0 }}>
            {ar ? "إلى" : "To"}
            <input type="time" dir="ltr" value={flex.to} data-flex-to onChange={(e) => e.target.value && setFlex({ to: e.target.value })} style={{ ...field, width: "100%" }} />
          </label>
        </div>
      ) : null}
      {mode === "flex" && flex ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
            <input type="checkbox" checked={flex.split} data-flex-split onChange={(e) => setFlex({ split: e.target.checked })} />
            <span>{ar ? `يجوز تقسيمها — لا يقل الجزء عن ${minRest} دقيقة` : `May be split — each part at least ${minRest} minutes`}</span>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
            <input type="checkbox" checked={flex.earlyEnd} data-flex-early onChange={(e) => setFlex({ earlyEnd: e.target.checked })} />
            <span>{ar ? `يجوز إنهاؤها قبل ${minRest} دقيقة — تُسجَّل راحة قصيرة` : `May end before ${minRest} minutes — recorded as a short break`}</span>
          </label>
        </div>
      ) : null}
      {mode === "flex" ? (
        gate.ok ? (
          <span data-flex-gate="ok" style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.7 }}>
            {ar
              ? "يبدأ الموظف راحته وينهيها ببصمة داخل النافذة؛ إن لم يبصم بدأت تلقائياً عند أقرب صلاة فيها (لا بعد خمس ساعات عمل) وأُبلغ بذلك، وتُخصم — دون مخالفة."
              : "The worker punches the break's start and end inside the window; if not, it starts automatically at the nearest prayer (never past five hours of work), the worker is told, and it is deducted — no breach."}
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
