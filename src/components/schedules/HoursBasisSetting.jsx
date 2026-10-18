import React from "react";
import { updateCompany } from "@/lib/store";
import { hoursPolicyOf } from "@/lib/laborHoursPolicy";
import { citeRule } from "@/lib/laborRules";
import { SW } from "@/lib/shiftWeek";

/**
 * «معيار ساعات العمل» — Art. 98 gives the employer one of two criteria: eight hours a day, or forty-eight a
 * week. The choice decides what is overtime (Art. 107): on the daily criterion every minute past eight in a
 * day; on the weekly, only what passes the published roster. Stored on hoursPolicy.hoursBasis (company level;
 * an employee's file or a station may still set its own). Empty reads as daily.
 */
export default function HoursBasisSetting({ ar = true, data, companyId, canEdit = false, onDate, refresh }) {
  const basis = hoursPolicyOf(data).hoursBasis || "daily";
  const day = citeRule("hours.shift.ordinaryHours", onDate);
  const week = citeRule("hours.week.ordinaryMaxHours", onDate);
  const save = (next) => {
    if (!canEdit || !companyId || next === basis) return;
    updateCompany(companyId, (d) => {
      d.hoursPolicy = { ...(d.hoursPolicy || {}), hoursBasis: next, hoursBasisAt: new Date().toISOString() };
    });
    refresh?.();
  };
  const options = [
    ["daily", ar ? `يومي — ${day?.value || 8} ساعات في اليوم` : `Daily — ${day?.value || 8} h a day`],
    ["weekly", ar ? `أسبوعي — ${week?.value || 48} ساعة في الأسبوع` : `Weekly — ${week?.value || 48} h a week`],
  ];
  return (
    <div data-hours-basis={basis} style={{ padding: "11px 18px", borderBottom: `1px solid ${SW.hair}`, display: "flex", flexDirection: "column", gap: 7 }}>
      <strong style={{ fontSize: 12, fontWeight: 600, color: SW.ink }}>{ar ? `معيار ساعات العمل (${day?.labelAr || "المادة 98"})` : `Working-hours criterion (${day?.labelEn || "Art. 98"})`}</strong>
      <div role="radiogroup" aria-label={ar ? "معيار ساعات العمل" : "Working-hours criterion"} style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {options.map(([value, text]) => (
          <label key={value} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: SW.ink, cursor: canEdit ? "pointer" : "default" }}>
            <input type="radio" name="hours-basis" value={value} data-hours-basis-option={value} checked={basis === value} disabled={!canEdit} onChange={() => save(value)} />
            {text}
          </label>
        ))}
      </div>
      <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.7 }}>
        {basis === "weekly"
          ? (ar ? `العمل الإضافي ما زاد على الوردية المنشورة، والأسبوع لا يتجاوز ${week?.value || 48} ساعة.` : `Overtime is what passes the published shift; the week stays within ${week?.value || 48} hours.`)
          : (ar ? `العمل الإضافي كل ما زاد على ${day?.value || 8} ساعات عمل فعلي في اليوم (المادة 107).` : `Overtime is everything past ${day?.value || 8} hours of actual work in a day (Art. 107).`)}
      </span>
    </div>
  );
}
