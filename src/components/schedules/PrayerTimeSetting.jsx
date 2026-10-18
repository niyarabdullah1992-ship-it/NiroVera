import React, { useState } from "react";
import { updateCompany } from "@/lib/store";
import { hoursPolicyOf } from "@/lib/laborHoursPolicy";
import { mono } from "@/components/schedules/scheduleChrome";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { SW } from "@/lib/shiftWeek";

/**
 * «وقت الصلاة من ساعات العمل» — the establishment's own policy, not a statute. The law puts prayer inside
 * the rest (Arts. 101–102); a company may give more: a prayer allowance (default 20 minutes) counted as work
 * and never deducted, beside the rest. Stored on hoursPolicy (hoursPolicyOf → prayerPaid · prayerMinutes).
 */
export default function PrayerTimeSetting({ ar = true, data, companyId, canEdit = false, refresh }) {
  const policy = hoursPolicyOf(data);
  const on = policy.prayerPaid === true;
  const [minutes, setMinutes] = useState(String(policy.prayerMinutes || 20));

  const save = (next, mins = minutes) => {
    if (!companyId) return;
    const m = Math.min(45, Math.max(5, Number(mins) || 20));
    updateCompany(companyId, (d) => {
      d.hoursPolicy = { ...(d.hoursPolicy || {}), prayerCountsAsWork: next, prayerMinutes: m, prayerPolicyAt: new Date().toISOString() };
    });
    setMinutes(String(m));
    refresh?.();
  };

  if (!canEdit && !on) return null;

  return (
    <div data-prayer-policy={on ? "on" : "off"} style={{ padding: "11px 18px", borderBottom: `1px solid ${SW.hair}`, display: "flex", flexDirection: "column", gap: 7 }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: SW.ink, cursor: canEdit ? "pointer" : "default", lineHeight: 1.7 }}>
        <input type="checkbox" checked={on} disabled={!canEdit} onChange={(e) => save(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          <strong style={{ fontWeight: 600 }}>{ar ? "وقت الصلاة من ساعات العمل — سياسة المنشأة" : "Prayer time counted as work — company policy"}</strong>
          <span style={{ display: "block", fontSize: 11, color: SW.mid }}>
            {on
              ? (ar ? `مفعّل — لكل صلاة في الدوام ${policy.prayerMinutes} دقيقة تُحسب من العمل ولا تُستقطع، غير الراحة.` : `On — each prayer in the duty has ${policy.prayerMinutes} min counted as work, beside the rest.`)
              : (ar ? "غير مفعّل — الصلاة داخل فترة الراحة كما في النظام، ولا يُضاف لها وقت مستقل." : "Off — prayer sits inside the rest as the law has it; no separate time.")}
          </span>
        </span>
      </label>
      {canEdit ? (
        <label style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: SW.muted }}>{ar ? "مدة كل صلاة" : "Per prayer"}</span>
          <input
            type="number"
            min={5}
            max={45}
            dir="ltr"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            onBlur={() => { if (on) save(true, minutes); }}
            style={{ ...mono, width: 64, fontSize: 11.5, padding: "5px 7px", border: `1px solid ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, background: SW.card, color: SW.ink, outline: "none" }}
          />
          <span style={{ fontSize: 11, color: SW.muted }}>{ar ? "دقيقة" : "min"}</span>
        </label>
      ) : null}
    </div>
  );
}
