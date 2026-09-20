import React, { useMemo, useState } from "react";
import { article93MaxDeduction, eidPay, holidayPay, lineComponents, OT_RATE } from "@/lib/payrollDerivations";
import { eosGratuity, serviceYears } from "@/lib/offboardingDerivations";
import { derivePayrollMonthAttendance } from "@/lib/payrollMonthAttendance";
import { MUTED, NAVY, field, ui, CARD, BORDER } from "@/lib/platformStyles";

function money(n) {
  return `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} SAR`;
}

export default function PayrollSlipBoard({
  monthLabel,
  month,
  items = [],
  employeeForItem,
  data,
  ar,
  onExport,
}) {
  const [empId, setEmpId] = useState(items[0]?.employeeId || "");
  const item = useMemo(
    () => items.find((row) => row.employeeId === empId) || items[0] || null,
    [items, empId],
  );
  const employee = item ? employeeForItem?.(item) : null;

  if (!item) {
    return <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا بند في هذا النطاق." : "No line in this scope."}</p>;
  }

  const att = derivePayrollMonthAttendance(item.employeeId, month, data);
  const hol = holidayPay(item.base, att.holidayHours);
  const eid = eidPay(item.base, att.eidHours);
  const hire = employee?.profile?.hireDate || employee?.hireDate || "";
  const eos = hire ? eosGratuity(serviceYears(hire), (Number(item.base) || 0) + (Number(item.allowances) || 0)) : 0;
  // Every figure below comes off the line itself, through the same net the Mudad row and
  // the run board read. A settled line reports what it was settled with, so the slip of a
  // paid month keeps showing the amount that actually left the account.
  const { settled, overtimeHours: otHours, overtimePay: otPay, gosiEmployee, net } = lineComponents(item);

  const kv = [
    [ar ? "الراتب الأساسي" : "Base salary", money(item.base)],
    [ar ? "البدلات" : "Allowances", money(item.allowances)],
    [ar ? "المكافآت" : "Bonus", money(item.bonus)],
    [ar ? "أيام الحضور" : "Present days", `${att.present} / ${att.shift}`],
    otHours
      ? [
          ar
            ? `أجر الساعات الإضافية المعتمدة (${otHours} × ${OT_RATE} — المادة 107)`
            : `Approved overtime (${otHours}h × ${OT_RATE} — Art. 107)`,
          money(otPay),
        ]
      : null,
    att.holidayHours ? [ar ? "أجر العطلة × 1.5" : "Rest-day pay × 1.5", money(hol)] : null,
    att.eidHours ? [ar ? "أجر العيد × 2" : "Eid pay × 2", money(eid)] : null,
    [ar ? "الخصومات" : "Deductions", `− ${money(item.deductions)}`],
    [ar ? "سقف الخصم (المادة 93)" : "Deduction cap (Art. 93)", money(article93MaxDeduction(item))],
    [
      ar ? "التأمينات — حصة الموظف (استقطاع نظامي خارج سقف المادة 93)" : "GOSI — employee share (statutory, outside the Art. 93 cap)",
      `− ${money(gosiEmployee)}`,
    ],
    [ar ? "الصافي المحوَّل" : "Net transferred", money(Math.max(0, net))],
    [ar ? "مستحقّ نهاية الخدمة حتى اليوم" : "End-of-service to date", money(eos)],
    [ar ? "حالة الدفع" : "Payment status", item.paid ? (ar ? "مدفوع" : "Paid") : (ar ? "غير مدفوع" : "Unpaid")],
  ].filter(Boolean);
  const netLabel = ar ? "الصافي المحوَّل" : "Net transferred";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, minWidth: 220 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الموظف" : "Employee"}</span>
          <select value={item.employeeId} onChange={(event) => setEmpId(event.target.value)} style={field}>
            {items.map((row) => (
              <option key={row.employeeId} value={row.employeeId}>
                {employeeForItem?.(row)?.name || row.employeeName}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => onExport?.(item)} style={ui.btnPrimary}>
          {ar ? "نزّل قسيمة PDF" : "Download PDF slip"}
        </button>
      </div>
      <div className="nv-paper" style={{ border: `1px solid ${BORDER}`, background: CARD }}>
        {kv.map(([k, v], index) => (
          <div
            key={k}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(140px,34%) minmax(0,1fr)",
              gap: 12,
              padding: "10px 16px",
              borderTop: index ? "1px solid #F1F5F9" : "none",
              background: k === netLabel ? "#f2faf6" : "transparent",
            }}
          >
            <span style={{ fontSize: 12, color: MUTED, fontWeight: k === netLabel ? 700 : 400 }}>{k}</span>
            <span dir="ltr" style={{ fontSize: 13, color: NAVY, textAlign: "end", fontWeight: k === netLabel ? 700 : 500 }}>{v}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
        {monthLabel}
        {" · "}
        {ar
          ? "إشعار راتب منظَّم من المسير. «الصافي المحوَّل» هو نفسه الرقم في سطر حماية الأجور — الأجر الإضافي المعتمد داخله، وحصة التأمينات مستقطعة منه."
          : "A structured payslip from the run. \"Net transferred\" is the same figure as the wage-protection row — approved overtime inside it, the GOSI employee share withheld from it."}
        {settled
          ? (item.paid
            ? (ar ? " هذه أرقام ما صُرف فعلاً، مجمَّدة عند الصرف." : " These are the figures actually paid, frozen at settlement.")
            : (ar ? " أرقام مجمَّدة عند اعتماد المسير — لا تتغيّر بعده." : " Figures frozen when the run was approved — they do not move after that."))
          : ""}
        {" "}
        {ar
          ? "ليس فاتورة اشتراك منصة، وليس مشهد راتب للبنك — مشهد البنك من «طلباتي»."
          : "Not a platform invoice, and not a bank salary certificate — request that from My Requests."}
      </p>
    </div>
  );
}
