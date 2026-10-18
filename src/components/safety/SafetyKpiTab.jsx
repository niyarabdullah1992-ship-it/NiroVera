import React, { useState } from "react";
import { safetyKpis } from "@/lib/safetyStandards";
import DailyHoursTable from "@/components/safety/DailyHoursTable";
import SafetyLtiEntries from "@/components/safety/SafetyLtiEntries";
import SafetyMonthPicker from "@/components/safety/SafetyMonthPicker";
import IdentityCard from "@/components/shared/IdentityCard";
import { num } from "@/lib/platformStyles";

function KpiBar({ label, value, target, inverse = true }) {
  const ratio = target ? Math.min(100, (value / target) * 100) : 0;
  const good = inverse ? value <= target : value >= target;
  return <div className="space-y-2 rounded-lg border border-border p-3"><div className="flex justify-between text-xs"><span>{label}</span><strong>{value.toFixed(2)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${good ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${ratio}%` }} /></div><p className="text-[10px] text-muted-foreground">Target: {target}</p></div>;
}

const currentMonth = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };

export default function SafetyKpiTab({ rec, canEdit, lang, onUpdate }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const ar = lang === "ar";
  const L = (a, e) => ar ? a : e;
  const kpi = safetyKpis(rec, selectedMonth);
  return <div className="space-y-4">
    <IdentityCard kicker={L("سلامة", "Safety")} title={L("أيام بدون حوادث", "Days without incidents")} dir={ar ? "rtl" : "ltr"}>
      <p style={{ margin: 0, ...num("var(--nv-ink)"), fontSize: 40, textAlign: "center" }}>{kpi.days}</p>
    </IdentityCard>
    <SafetyMonthPicker value={selectedMonth} dailyHours={rec?.dailyHours} ltiEntries={rec?.ltiEntries} lang={lang} onChange={setSelectedMonth} />
    <DailyHoursTable selectedMonth={selectedMonth} dailyHours={rec?.dailyHours || []} totalHours={kpi.hours} canEdit={canEdit} lang={lang} onChange={(dailyHours) => onUpdate({ dailyHours })} />
    <SafetyLtiEntries selectedMonth={selectedMonth} entries={rec?.ltiEntries || []} canEdit={canEdit} lang={lang} onChange={(ltiEntries) => onUpdate({ ltiEntries })} />
    {!kpi.hours && <p className="text-[11px] text-amber-600">{L("أدخل ساعات العمل اليومية لتفعيل الحسابات.", "Enter daily work hours to activate calculations.")}</p>}
    <KpiBar label="TRIR" value={kpi.trir} target={3} /><KpiBar label="LTIFR" value={kpi.ltifr} target={1} />
    <p className="text-[10px] text-muted-foreground">TRIR = ({kpi.incidents} × 200,000) ÷ {kpi.hours} · LTIFR = ({kpi.lti} × 1,000,000) ÷ {kpi.hours}</p>
    <p className="text-[10px] text-muted-foreground">{L("تُحتسب إصابات الوقت الضائع LTI ضمن حوادث TRIR القابلة للتسجيل.", "Lost-time injuries (LTI) are included in TRIR recordable incidents.")}</p>
  </div>;
}