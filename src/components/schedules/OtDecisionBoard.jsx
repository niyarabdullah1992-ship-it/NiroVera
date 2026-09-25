import React, { useMemo, useState } from "react";
import { setOtDecision } from "@/lib/store";
import { approvedOvertimeHoursForYear } from "@/lib/attendanceDerivations";
import { formatOtPremiumLabel } from "@/lib/laborHoursPolicy.js";
import { weekNamedOvertime } from "@/lib/shiftWeek";
import { formatRuleFigure, ruleValue } from "@/lib/laborRules.js";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import LawGateAlertRow from "@/components/shared/LawGateAlertRow";
import { toast } from "@/components/ui/use-toast";
import { SW } from "@/lib/shiftWeek";

/**
 * Live Art. 107 overtime decision — hours derived from the published rota
 * versus 98/99/Ramadan/164, plus rest-day and Eid hours. Default is pay.
 */
export default function OtDecisionBoard({
  schedule,
  employees = [],
  weekStart,
  company,
  companyId,
  laborCalendar,
  otDecisions = {},
  currentUser,
  canEdit = false,
  mode = "manage",
  ar = true,
  onSaved,
}) {
  const [consent, setConsent] = useState({});
  const [capConsent, setCapConsent] = useState({});
  const [enjoyDate, setEnjoyDate] = useState({});
  const [windowAgreed, setWindowAgreed] = useState({});
  const [busy, setBusy] = useState("");
  const cap = ruleValue("hours.ot.annualMaxHours", weekStart);
  const premium = formatOtPremiumLabel(weekStart, ar);
  const rows = useMemo(() => {
    return (employees || []).map((employee) => {
      const pack = weekNamedOvertime(schedule, employee, weekStart, company, laborCalendar, ar);
      const ytd = approvedOvertimeHoursForYear(otDecisions, employee.id, weekStart);
      const pending = pack.rows.filter((row) => !otDecisions[`${employee.id}:${row.dateKey}`]);
      const decided = pack.rows.map((row) => ({
        ...row,
        decision: otDecisions[`${employee.id}:${row.dateKey}`] || null,
      }));
      return { employee, pack, ytd, pending, decided };
    }).filter((row) => row.pack.totalHours > 0);
  }, [employees, schedule, weekStart, company, laborCalendar, otDecisions, ar]);

  const mine = mode === "mine";
  const visible = mine
    ? rows.filter((row) => String(row.employee.id) === String(currentUser?.id))
    : rows;

  if (!visible.length) {
    return (
      <section style={{ background: SW.card, border: `1px solid ${SW.line}`, padding: "14px 16px" }}>
        <LawGateAlertRow
          ar={ar}
          article="107"
          status="void"
          pillLabel={ar ? "بلا أثر" : "No effect"}
          summary={ar ? "قرار الإضافي — المادة 107" : "Overtime decision — Art. 107"}
        />
        <div style={{ marginTop: 8 }}>
          <LaborArticleCite ruleId="hours.ot.premium" ar={ar} />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>
          {ar
            ? "لا ساعات إضافية مشتقّة من الجدول المنشور في هذا الأسبوع — فوق العادي أو في الراحة الأسبوعية أو العيد."
            : "No overtime derived from the published rota this week — above ordinary hours, or on weekly rest or an Eid."}
        </p>
      </section>
    );
  }

  const decide = (employeeId, dateKey, decision, overtimeMinutes, kinds) => {
    if (!canEdit || !companyId) return;
    const key = `${employeeId}:${dateKey}`;
    setBusy(key);
    const result = setOtDecision(companyId, employeeId, dateKey, {
      decision,
      overtimeMinutes,
      workerConsent: consent[key] === true,
      annualCapConsent: capConsent[key] === true,
      enjoyDate: enjoyDate[key],
      windowAgreed: windowAgreed[key] === true,
      kinds,
      by: currentUser?.name,
    });
    setBusy("");
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({
      description: result.decision === "comp_leave"
        ? (ar ? "سُجّلت إجازة تعويضية بموافقة العامل." : "Compensatory leave recorded with the worker's consent.")
        : (ar ? "سُجّل صرف الإضافي." : "Overtime pay recorded."),
    });
    onSaved?.();
  };

  return (
    <section style={{ background: SW.card, border: `1px solid ${SW.line}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${SW.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <LawGateAlertRow
          ar={ar}
          article="107"
          status="waiting"
          pillLabel={ar ? "ينتظر" : "Waiting"}
          summary={ar ? "قرار الإضافي — أجر الساعة + 50% أو إجازة تعويضية بموافقة العامل" : "Overtime decision — hourly + 50% or compensatory leave with consent"}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <LaborArticleCite ruleId="hours.ot.premium" ar={ar} />
          <LaborArticleCite ruleId="hours.ot.compLeave.cite" ar={ar} />
        </div>
        <LaborArticleCite ruleId="hours.ot.premium" ar={ar} showText showChip={false} />
        <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.75 }}>
          {ar
            ? `الساعات مشتقّة من الجدول المنشور مقابل سقف 98/99/رمضان. العطل والأعياد كلها إضافي. الافتراضي ${premium}. الإجازة التعويضية تحتاج موافقة مسجّلة. سقف السنة ${formatRuleFigure(cap, "hours", ar)} (اللائحة 22).`
            : `Hours are derived from the published rota against the 98/99/Ramadan cap. Rest-day and Eid hours are all overtime. Default is ${premium}. Compensatory leave needs recorded consent. Annual cap ${formatRuleFigure(cap, "hours", false)} (regs Art. 22).`}
        </span>
      </div>
      {visible.map((row) => (
        <div key={row.employee.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${SW.row}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {!mine ? (
            <span style={{ fontSize: 13, fontWeight: 600 }}>{row.employee.name}</span>
          ) : null}
          <span style={{ fontSize: 11, color: SW.muted }}>
            {ar
              ? `${row.pack.totalHours} ساعة إضافية هذا الأسبوع · السنوي المعتمد ${row.ytd} / ${cap}`
              : `${row.pack.totalHours} OT hours this week · approved YTD ${row.ytd} / ${cap}`}
          </span>
          {row.decided.map((item) => {
            const key = `${row.employee.id}:${item.dateKey}`;
            const saved = item.decision;
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderTop: `1px solid ${SW.hair}` }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{item.dateKey} · {item.overtimeHours} {ar ? "ساعة" : "h"}</span>
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.7 }}>{item.label}</span>
                {item.ruleId && item.ruleId !== "hours.ot.premium" ? <LaborArticleCite ruleId={item.ruleId} ar={ar} /> : null}
                {saved ? (
                  <span style={{ fontSize: 11, color: SW.green }}>
                    {saved.decision === "comp_leave"
                      ? (ar ? "إجازة تعويضية بموافقة مسجّلة" : "Compensatory leave with recorded consent")
                      : saved.decision === "reject"
                        ? (ar ? "رُفض الصرف — الساعات مسجّلة" : "Pay rejected — hours stay recorded")
                        : (ar ? `${premium} — معتمد للمسير` : `${premium} — approved for payroll`)}
                  </span>
                ) : mine ? (
                  <span style={{ fontSize: 11, color: SW.gold }}>{ar ? "بانتظار قرار المسؤول" : "Awaiting the manager's decision"}</span>
                ) : canEdit ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={consent[key] === true}
                        onChange={(e) => setConsent((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {ar ? "موافقة العامل مسجّلة (للإجازة التعويضية)" : "Worker's consent on file (for compensatory leave)"}
                    </label>
                    {row.ytd + item.overtimeHours > cap ? (
                      <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={capConsent[key] === true}
                          onChange={(e) => setCapConsent((prev) => ({ ...prev, [key]: e.target.checked }))}
                        />
                        {ar
                          ? `موافقة العامل على تجاوز سقف السنة ${formatRuleFigure(cap, "hours", ar)}`
                          : `Worker consents to exceed the annual ${formatRuleFigure(cap, "hours", false)} cap`}
                      </label>
                    ) : null}
                    <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {ar ? "موعد التمتع" : "Take-by date"}
                      <input
                        type="date"
                        value={enjoyDate[key] || ""}
                        onChange={(e) => setEnjoyDate((prev) => ({ ...prev, [key]: e.target.value }))}
                        style={{ fontFamily: "inherit", fontSize: 11, padding: "4px 6px", border: `1px solid ${SW.line}`, background: SW.card }}
                      />
                    </label>
                    <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={windowAgreed[key] === true}
                        onChange={(e) => setWindowAgreed((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {ar ? "اتُفق على موعد أبعد من 60 يوماً" : "A later date than 60 days was agreed"}
                    </label>
                    <button
                      type="button"
                      disabled={busy === key}
                      onClick={() => decide(row.employee.id, item.dateKey, "approve", item.overtimeMinutes, [item.kind])}
                      style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 10px", border: "1px solid var(--nv-btn-fill)", background: "var(--nv-btn-fill)", color: "var(--nv-btn-ink)", cursor: "pointer", borderRadius: 10 }}
                    >
                      {premium}
                    </button>
                    <button
                      type="button"
                      disabled={busy === key}
                      onClick={() => decide(row.employee.id, item.dateKey, "comp_leave", item.overtimeMinutes, [item.kind])}
                      style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 10px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, cursor: "pointer" }}
                    >
                      {ar ? "إجازة تعويضية" : "Compensatory leave"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
