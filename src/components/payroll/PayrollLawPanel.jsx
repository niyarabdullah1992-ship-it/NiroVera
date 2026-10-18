import React, { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { BORDER, CARD, MUTED, NAVY, DANGER, field, ui, cardShell } from "@/lib/platformStyles";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { isWeeklyRestDay } from "@/lib/laborHoursPolicy";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import {
  checkMinimumWageGate,
  checkWeeklyCycleGate,
  companyPayday,
  pendingAnnualAdvances,
  payPeriodOf,
  wageOverdue,
  wageSheetCsv,
} from "@/lib/payrollLaw";
import {
  payAnnualLeaveInAdvance,
  payWeeklyInstalments,
  setCompanyMinimumWage,
  setPayrollPayday,
} from "@/lib/payrollLawStore";
import { payrollDenyReason } from "@/lib/payrollRights";

const money = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

function Row({ title, cite, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 0", borderTop: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{title}</span>
        {cite}
      </div>
      {children}
    </div>
  );
}

/**
 * Wage-protection duties around the month's run, on the run surface itself: payday and the overdue
 * flag (Art. 90, model regulation Art. 17), weekly pay for non-monthly wages (Art. 90(1)), annual
 * leave paid in advance (Art. 109), the company minimum (Art. 89) and the combined wage sheet
 * (implementing regulations Art. 5(2)).
 */
export default function PayrollLawPanel({ companyId, data, month, items = [], employeeForItem, canManage, ar }) {
  const [payday, setPayday] = useState(data?.settings?.payrollPayday ?? "");
  const [minimum, setMinimum] = useState(data?.settings?.minimumWage ?? "");
  const today = todayIso();
  const calendar = useMemo(() => laborCalendarOf(data), [data]);
  const isOff = (day) => isWeeklyRestDay(day, data) || isOfficialHoliday(day, calendar);

  const pay = companyPayday(data?.settings, month, isOff);
  const overdue = wageOverdue({ settings: data?.settings, month, items, today, isOff, employeeOf: employeeForItem });
  const weekly = items
    .map((item) => ({ item, employee: employeeForItem?.(item) }))
    .filter((row) => payPeriodOf(row.employee) === "weekly")
    .map((row) => ({ ...row, gate: checkWeeklyCycleGate({ employee: row.employee, line: row.item, month, today, isOff }) }));
  const weeklyLate = weekly.filter((row) => !row.gate.ok);
  const advances = pendingAnnualAdvances(data?.employees || [], today, 14);
  const belowMin = items.filter((item) => !checkMinimumWageGate({ line: item, minimum: data?.settings?.minimumWage }).ok);

  const refuse = (code, reason, reasonEn) => toast({ description: ar ? (reason || payrollDenyReason(code, ar) || code) : (reasonEn || payrollDenyReason(code, ar) || code), variant: "destructive" });

  const savePayday = () => {
    const code = setPayrollPayday(companyId, payday);
    if (code) refuse(code);
    else toast({ description: ar ? "حُفظ يوم صرف الأجور." : "Payday saved." });
  };
  const saveMinimum = () => {
    const code = setCompanyMinimumWage(companyId, minimum);
    if (code) refuse(code);
    else toast({ description: ar ? "حُفظ الحد الأدنى الداخلي." : "Internal minimum saved." });
  };
  const runWeekly = () => {
    const res = payWeeklyInstalments(companyId, month, { isOff, today });
    if (res?.error) return refuse(res.error);
    toast({ description: ar ? `صُرفت ${res.paid} دفعة أسبوعية.` : `${res.paid} weekly instalment(s) paid.` });
  };
  const advance = (row) => {
    const res = payAnnualLeaveInAdvance(companyId, row.employee.id, row.leave.id);
    if (res?.error) return refuse(res.error, res.reason, res.reasonEn);
    toast({ description: ar ? `صُرف أجر الإجازة مقدّماً: ${money(res.amount)} ر.س` : `Leave pay advanced: ${money(res.amount)} SAR` });
  };
  const exportSheet = () => {
    const csv = wageSheetCsv(items, { month, nameOf: (line) => employeeForItem?.(line)?.name, ar });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wage-sheet-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div style={{ ...cardShell, background: CARD, padding: "16px 18px" }} data-payroll-law="1">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{ar ? "مواعيد الأجر وحمايته" : "Wage timing and protection"}</span>
        <button type="button" onClick={exportSheet} style={{ ...ui.btnSecondary, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Download style={{ width: 14, height: 14 }} /> {ar ? "كشف الأجور الموحّد (CSV)" : "Combined wage sheet (CSV)"}
        </button>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
        {ar
          ? "الكشف يجمع لكل عامل أجره وإضافيه وخصومات المادة 92 وحصة التأمينات والأجر غير المستحق نظاماً وما صُرف مقدّماً — اللائحة التنفيذية م5(2)."
          : "The sheet lists, per worker, wage, overtime, Art. 92 deductions, the GOSI share, wage not due by law and what was paid ahead — implementing regulations Art. 5(2)."}
      </p>

      <Row title={ar ? "يوم صرف الأجور" : "Payday"} cite={<LaborArticleCite ruleId="payroll.payday.restShift.cite" ar={ar} />}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="number" min={1} max={31} dir="ltr" value={payday} onChange={(e) => setPayday(e.target.value)} disabled={!canManage} style={{ ...field, width: 90 }} aria-label={ar ? "اليوم من الشهر" : "Day of month"} />
          {canManage ? <button type="button" onClick={savePayday} style={ui.btnSecondary}>{ar ? "حفظ" : "Save"}</button> : null}
          <span style={{ fontSize: 12, color: MUTED }}>
            {pay
              ? (ar ? `يُصرف هذا الشهر في ${pay.due}${pay.shifted ? ` — قُدّم من ${pay.scheduled} لأنه راحة أو عطلة رسمية` : ""}` : `Paid this month on ${pay.due}${pay.shifted ? ` — moved from ${pay.scheduled} (rest day or holiday)` : ""}`)
              : (ar ? "لم يُحدَّد — تبقى مهلة حماية الأجور وحدها." : "Not set — only the wage-protection window applies.")}
          </span>
        </div>
        {overdue.overdue ? (
          <p data-wage-overdue="1" style={{ margin: 0, fontSize: 12, color: DANGER, lineHeight: 1.7 }}>{ar ? overdue.reason : overdue.reasonEn}</p>
        ) : null}
      </Row>

      <Row title={ar ? `الأجر الأسبوعي — ${weekly.length} عاملاً بأجر غير شهري` : `Weekly pay — ${weekly.length} non-monthly worker(s)`} cite={<LaborArticleCite ruleId="payroll.weeklyCycle.days" ar={ar} />}>
        <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
          {ar
            ? "اليومي والأسبوعي والقطعة والساعة يُصرف مرة كل أسبوع على الأقل. الدفعة تُقيَّد على بند الشهر، والتحويل في آخره يحمل الباقي."
            : "Daily, weekly, piece and hourly wages are paid at least weekly. Each instalment is recorded on the month's line; the month-end transfer carries the rest."}
        </span>
        {weeklyLate.map((row) => (
          <span key={row.item.id} style={{ fontSize: 12, color: DANGER }}>{row.employee?.name || row.item.employeeName}: {ar ? row.gate.reason : row.gate.reasonEn}</span>
        ))}
        {canManage && weekly.length ? (
          <button type="button" onClick={runWeekly} style={{ ...ui.btnPrimary, alignSelf: "flex-start" }}>{ar ? "صرف الأسابيع المنتهية" : "Pay the weeks that ended"}</button>
        ) : null}
      </Row>

      <Row title={ar ? "أجر الإجازة السنوية مقدّماً" : "Annual leave paid in advance"} cite={<LaborArticleCite ruleId="leave.annual.advancePay.cite" ar={ar} />}>
        {advances.length === 0 ? (
          <span style={{ fontSize: 12, color: MUTED }}>{ar ? "لا إجازة سنوية معتمدة قريبة بلا صرف مقدّم." : "No approved annual leave nearby without its advance."}</span>
        ) : advances.map((row) => (
          <div key={row.leave.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
            <span style={{ color: row.gate.started ? DANGER : NAVY }}>{row.employee.name} — {ar ? row.gate.reason : row.gate.reasonEn}</span>
            {canManage ? <button type="button" onClick={() => advance(row)} style={ui.btnSecondary}>{ar ? `صرف ${row.days} يوماً مقدّماً` : `Advance ${row.days} days`}</button> : null}
          </div>
        ))}
      </Row>

      <Row title={ar ? "حد أدنى داخلي للأجر" : "Internal minimum wage"} cite={<LaborArticleCite ruleId="payroll.minimumWage.cite" ar={ar} />}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="number" min={0} dir="ltr" value={minimum} onChange={(e) => setMinimum(e.target.value)} disabled={!canManage} style={{ ...field, width: 130 }} aria-label={ar ? "الحد الأدنى" : "Minimum"} />
          {canManage ? <button type="button" onClick={saveMinimum} style={ui.btnSecondary}>{ar ? "حفظ" : "Save"}</button> : null}
          <span style={{ fontSize: 12, color: MUTED }}>
            {ar
              ? "المادة 89: الحد الملزم بقرار من مجلس الوزراء فقط — هذا تنبيه داخلي. حد نطاقات للسعودي (4,000 ر.س) يبقى في لوحة التوطين."
              : "Art. 89: a binding floor comes only from the Council of Ministers — this is an internal warning. The Saudi Nitaqat figure (4,000 SAR) stays on the Saudization board."}
          </span>
        </div>
        {belowMin.length ? (
          <span style={{ fontSize: 12, color: DANGER }}>
            {ar ? `${belowMin.length} بنداً دون الحد المسجّل: ` : `${belowMin.length} line(s) below the recorded floor: `}
            {belowMin.slice(0, 6).map((item) => employeeForItem?.(item)?.name || item.employeeName).join("، ")}
          </span>
        ) : null}
      </Row>
    </div>
  );
}
