import React from "react";
import { FileText, CheckCircle2, Circle, ListChecks } from "lucide-react";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { netOf } from "@/lib/payroll";
import { checkArticle90Gate, article90MaxDeduction } from "@/lib/payrollDerivations";
import { buildWpsFileRows, wpsRowBlockers } from "@/lib/complianceDerivations";
import { deductionLines, sourceLabel } from "@/lib/payrollDeductions";
import { normalizeLocalizedNumber } from "@/lib/localizedNumber";
import { BAD, OK, CARD, SURFACE } from "@/lib/platformStyles";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

const NAVY = "#14284B";
const MUTED = "#5A6B85";
const BORDER = "#E2E8F0";
const GREEN = "#1E9E63";

// Money keeps Western digits on every payroll surface so a run reads the same
// way in the table, the totals, and the exported WPS file.
const money = (value) => Number(value || 0).toLocaleString("en-US");

function mudadFileStatus(item, employee, ar) {
  const profile = employee?.profile || {};
  const base = Number(item.base) || 0;
  const allowances = Number(item.allowances) || 0;
  const [row] = buildWpsFileRows([{
    employeeId: item.employeeId,
    employeeName: employee?.name || "",
    nationalId: profile.nationalId || employee?.nationalId || "",
    iban: profile.iban || "",
    netPay: netOf(item),
    base,
    allowances,
    qiwaWage: item.qiwaWage != null ? item.qiwaWage : base + allowances,
  }]);
  const blocker = wpsRowBlockers(row, ar)[0];
  return blocker || (ar ? "ملف مدى جاهز" : "Mudad file ready");
}

function attendanceChip(item, ar) {
  const att = deductionLines(item).find((line) => line.source === "attendance");
  if (att) {
    const ref = att.sourceRefId ? ` · ${att.sourceRefId}` : "";
    return `${sourceLabel("attendance", ar)}${ref}`;
  }
  if (Number(item.deductions) > 0) return ar ? "خصم موثّق" : "Documented deduction";
  return ar ? "بلا خصم حضور" : "No attendance deduction";
}

export default function PayrollRow({ item, employee, ar, onChange, onTogglePaid, onPayslip, onDeductions }) {
  const num = (v) => Number(v) || 0;
  const baseMissing = !item.isOwner && num(item.base) <= 0;
  const attLabel = attendanceChip(item, ar);
  const mudadLabel = mudadFileStatus(item, employee, ar);
  const mudadReady = mudadLabel === (ar ? "ملف مدى جاهز" : "Mudad file ready");
  const cell = (field, editable = true) => {
    const invalid = field === "base" && baseMissing;
    return (
      <input
        type="text"
        inputMode="decimal"
        value={item[field] ?? 0}
        disabled={!editable || item.paid}
        onChange={(e) => onChange(field, Number(normalizeLocalizedNumber(e.target.value)) || 0)}
        aria-invalid={invalid}
        title={["base", "allowances"].includes(field) ? (ar ? "يُحفظ التعديل تلقائيًا في ملف الموظف" : "Changes are saved automatically to the employee profile") : undefined}
        style={{
          height: "32px",
          width: "100%",
          maxWidth: "96px",
          borderRadius: "8px",
          border: `1px solid ${invalid ? "#FCA5A5" : BORDER}`,
          background: item.paid ? "#F7F8FA" : CARD,
          color: NAVY,
          padding: "0 8px",
          textAlign: "center",
          fontSize: "12.5px",
          fontFamily: "inherit",
          opacity: !editable || item.paid ? 0.7 : 1,
        }}
        dir="ltr"
      />
    );
  };
  const a90 = checkArticle90Gate(item);
  const a90Max = article90MaxDeduction(item);
  const cellStyle = { padding: "12px 8px", textAlign: "center", borderBottom: `1px solid ${BORDER}` };
  const chainChip = {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 7px",
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 600,
    background: SURFACE,
    color: MUTED,
    border: `1px solid ${BORDER}`,
    lineHeight: 1.4,
    maxWidth: 160,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  return (
    <tr style={{ opacity: item.paid ? 0.72 : 1 }}>
      <td data-label={ar ? "الموظف" : "Employee"} style={{ ...cellStyle, textAlign: "start" }}>
        <EmployeeIdentityRow
          employee={employee}
          employeeId={employee?.role ? item.employeeId : null}
          name={employee?.name || "—"}
          subtitle={employee?.position || employee?.role || ""}
          showId={false}
          compact
          link={!!employee?.role}
        />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 6 }}>
          <span style={chainChip} title={attLabel}>{attLabel}</span>
          <span style={{ fontSize: 10, color: MUTED }} aria-hidden>→</span>
          <span style={chainChip} dir="ltr">{ar ? "صافٍ" : "Net"} {money(netOf(item))}</span>
          <span style={{ fontSize: 10, color: MUTED }} aria-hidden>→</span>
          <span style={mudadReady ? OK : BAD} title={mudadLabel}>{mudadLabel}</span>
        </div>
      </td>
      <td data-label={ar ? "الأساسي" : "Base"} style={cellStyle}>{cell("base")}</td>
      <td data-label={ar ? "البدلات" : "Allowances"} style={cellStyle}>{cell("allowances")}</td>
      <td data-label={ar ? "مكافآت" : "Bonus"} style={cellStyle}>{cell("bonus")}</td>
      {/* Deductions are never typed freely — the total is the sum of documented lines. */}
      <td data-label={ar ? "خصومات" : "Deductions"} style={cellStyle}>
        <button
          type="button"
          onClick={onDeductions}
          title={ar ? "عرض بنود الخصم الموثّقة" : "View documented deduction lines"}
          style={{
            height: "32px",
            width: "100%",
            maxWidth: "96px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            borderRadius: "8px",
            border: `1px solid ${BORDER}`,
            background: CARD,
            color: NAVY,
            fontSize: "12.5px",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span dir="ltr">{money(item.deductions)}</span>
          <ListChecks style={{ width: 13, height: 13, color: GREEN }} />
        </button>
      </td>
      <td data-label={ar ? "سقف الحسم" : "Deduction cap"} style={cellStyle}>
        <span
          style={{ ...(a90.ok ? OK : BAD), display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}
          title={ar
            ? `${a90.cite?.labelAr || "المادة 93"}: الخصم ${money(item.deductions)} من سقف ${money(a90Max)}`
            : `${a90.cite?.labelEn || "Art. 93"}: deducted ${money(item.deductions)} of ${money(a90Max)} cap`}
        >
          <LaborArticleCite cite={a90.cite} ar={ar} />
          {a90.ok
            ? (ar ? `${money(item.deductions)} / ${money(a90Max)}` : `${money(item.deductions)} / ${money(a90Max)}`)
            : (ar ? "تجاوز نصف الأجر" : "Over half the wage")}
        </span>
      </td>
      <td data-label={ar ? "الصافي" : "Net"} style={cellStyle}>
        <span dir="ltr" style={{ fontSize: "12.5px", fontWeight: 600, color: NAVY }}>
          {money(netOf(item))} {item.currency}
        </span>
      </td>
      <td data-label={ar ? "الحالة" : "Status"} style={cellStyle}>
        <button
          onClick={() => onTogglePaid(!item.paid)}
          disabled={baseMissing && !item.paid}
          title={baseMissing && !item.paid ? (ar ? "حدّد الراتب الأساسي أولاً" : "Set the base salary first") : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 11px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: 500,
            fontFamily: "inherit",
            border: `1px solid ${item.paid ? "#BBF7D0" : BORDER}`,
            background: item.paid ? "#ECFDF3" : "#F7F8FA",
            color: item.paid ? "#15803D" : MUTED,
            cursor: baseMissing && !item.paid ? "not-allowed" : "pointer",
            opacity: baseMissing && !item.paid ? 0.45 : 1,
          }}
        >
          {item.paid ? <CheckCircle2 style={{ width: 13, height: 13 }} /> : <Circle style={{ width: 13, height: 13 }} />}
          {item.paid ? (ar ? "مدفوع" : "Paid") : (ar ? "غير مدفوع" : "Unpaid")}
        </button>
      </td>
      <td data-label={ar ? "قسيمة" : "Payslip"} style={cellStyle}>
        <button
          onClick={onPayslip}
          disabled={num(item.base) + num(item.allowances) === 0}
          title={ar ? "قسيمة الراتب PDF" : "Payslip PDF"}
          style={{
            padding: "7px",
            borderRadius: "8px",
            border: `1px solid ${BORDER}`,
            background: CARD,
            color: MUTED,
            cursor: num(item.base) + num(item.allowances) === 0 ? "not-allowed" : "pointer",
            opacity: num(item.base) + num(item.allowances) === 0 ? 0.4 : 1,
          }}
        >
          <FileText style={{ width: 15, height: 15 }} strokeWidth={1.75} />
        </button>
      </td>
    </tr>
  );
}
