import React from "react";
import { annualDayBreakdown, WEEKDAY_NAMES_AR, WEEKDAY_NAMES_EN } from "@/lib/leaveEidOverlap.js";

/**
 * «كيف يُحسب رصيدك» — the annual-leave span day by day, so the worker sees that his weekly rest
 * (one or two days, as set on his file or by the establishment), his roster's rest cells and official
 * holidays are not taken from the 21 (Art. 109), and a shift published on a rest day is.
 */
const KIND = {
  charge: { ar: "يُخصم", en: "Taken", bg: "#E6EFE9", ink: "#0B3D27", line: "#CFE0D5" },
  dutyOnRest: { ar: "وردية — يُخصم", en: "Shift — taken", bg: "#E6EFE9", ink: "#0B3D27", line: "#CFE0D5" },
  law: { ar: "راحة نظامية", en: "Statutory rest", bg: "#F3F4F6", ink: "#4B5567", line: "#E3E6EA" },
  company: { ar: "راحة الشركة", en: "Company rest", bg: "#F3F4F6", ink: "#4B5567", line: "#E3E6EA" },
  cycle: { ar: "راحة دورتك", en: "Cycle rest", bg: "#F3F4F6", ink: "#4B5567", line: "#E3E6EA" },
  holiday: { ar: "عطلة رسمية", en: "Official holiday", bg: "#FBF3E1", ink: "#8A5A12", line: "#EBD3A2" },
};

function daysAr(n) {
  if (n === 1) return "يوماً واحداً";
  if (n === 2) return "يومين";
  return n >= 3 && n <= 10 ? `${n} أيام` : `${n} يوماً`;
}

export default function AnnualLeaveBreakdown({ from, to, calendar, company, employee, ar = true, own = true }) {
  const result = annualDayBreakdown(from, to, calendar, company, employee);
  if (!result.calendarDays) return null;
  const names = ar ? WEEKDAY_NAMES_AR : WEEKDAY_NAMES_EN;
  const c = result.counts;
  const rest = (c.law || 0) + (c.company || 0) + (c.cycle || 0);
  const tooLong = result.calendarDays > 62;
  return (
    <section data-annual-breakdown="1" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-card)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "كيف يُحسب من رصيدك" : "How this is taken from your balance"}</strong>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>
          {ar ? "المادة 109 — الرصيد بأيام العمل لا بأيام التقويم" : "Art. 109 — the balance is in work days, not calendar days"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "var(--nv-ink2)" }}>
        <span>{ar ? <>المدة <strong>{daysAr(result.calendarDays)}</strong> في التقويم</> : <>Span <strong>{result.calendarDays}</strong> calendar days</>}</span>
        <span style={{ color: "#0B3D27", fontWeight: 700 }}>{ar ? <>يُخصم من الرصيد <strong>{daysAr(result.charged)}</strong></> : <>Taken from the balance <strong>{result.charged}</strong></>}</span>
        {rest ? <span>{ar ? "راحة أسبوعية لا تُخصم" : "Weekly rest, not taken"} <strong dir="ltr">{rest}</strong></span> : null}
        {c.holiday ? <span>{ar ? "عطلة رسمية — تُمدَّد بها الإجازة" : "Official holiday — leave extended"} <strong dir="ltr">{c.holiday}</strong></span> : null}
      </div>
      {!tooLong ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))", gap: 6 }}>
          {result.days.map((day) => {
            const meta = KIND[day.kind];
            return (
              <span key={day.key} data-day-kind={day.kind} title={day.holiday ? (ar ? day.holiday.labelAr || day.holiday.ar || "" : day.holiday.labelEn || day.holiday.en || "") : ""} style={{ display: "flex", flexDirection: "column", gap: 1, padding: "6px 8px", borderRadius: 8, background: meta.bg, border: `1px solid ${meta.line}` }}>
                <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{names[day.dow]}</span>
                <span dir="ltr" style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink)", textAlign: "end" }}>{day.key.slice(5).split("-").reverse().join("/")}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.ink }}>{ar ? meta.ar : meta.en}</span>
              </span>
            );
          })}
        </div>
      ) : null}
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.8 }}>
        {ar
          ? `${own ? "راحتك" : "راحته"} الأسبوعية وراحة دورة الجدول والعطل الرسمية لا تأكل من الرصيد. إن نُشرت ${own ? "لك" : "له"} وردية يوم راحة فذلك اليوم يوم عمل ويُخصم.`
          : "Weekly rest, roster-cycle rest and official holidays are not taken from the balance. A shift published on a rest day is a work day and is taken."}
      </p>
    </section>
  );
}
