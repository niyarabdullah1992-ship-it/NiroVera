import React, { useMemo } from "react";
import { formatGosiPercent, gosiLine } from "@/lib/payrollDerivations";
import { registrationForPayroll } from "@/lib/facts";
import { payrollSaudiFlag } from "@/lib/payrollWageSync";
import { MUTED, NAVY, OK, WARN, tableShell, SURFACE } from "@/lib/platformStyles";
import KpiStrip from "@/components/shared/KpiStrip";

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function basisParts(row, ar) {
  if (row.unknown) return { text: ar ? "لا حسم قبل ثبوت الجنسية" : "No share until nationality is known" };
  if (!row.saudi) return { text: ar ? "2٪ أخطار مهنية" : "2% occupational" };
  if (row.gosi.blocked) return { text: ar ? row.gosi.reason : row.gosi.reasonEn };
  const rates = `${formatGosiPercent(row.gosi.employeeRate, ar)} + ${formatGosiPercent(row.gosi.employerRate, ar)}`;
  const klass = row.gosi.subscriberClass === "old"
    ? (ar ? "قديم" : "Old")
    : row.gosi.subscriberClass === "new"
      ? (ar ? "جديد" : "New")
      : "";
  return { klass, rates };
}

export default function PayrollGosiBoard({ items = [], employeeForItem, ar, month }) {
  const rows = useMemo(() => items.map((item) => {
    const employee = employeeForItem?.(item);
    const flag = item?.isSaudi === true || item?.isSaudi === false ? item.isSaudi : payrollSaudiFlag(employee);
    const saudi = flag === true;
    const unknown = flag == null;
    const registeredAt = registrationForPayroll(employee, item);
    const gosi = unknown
      ? { ...gosiLine(item, { saudi: false }), employeeShare: 0, employerShare: 0, total: 0, blocked: false, reason: "", reasonEn: "", subscriberClass: "" }
      : gosiLine(item, { saudi, onDate: month || item?.gosiAsOf, registeredAt });
    return { item, employee, gosi, saudi, unknown };
  }), [items, employeeForItem, month]);

  const tEmp = rows.reduce((sum, row) => sum + row.gosi.employeeShare, 0);
  const tCo = rows.reduce((sum, row) => sum + row.gosi.employerShare, 0);
  const saudis = rows.filter((row) => row.saudi).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <KpiStrip stats={[
        { label: ar ? "حصة الموظفين" : "Employee share", value: money(tEmp), suffix: "SAR", tone: "danger" },
        { label: ar ? "حصة الشركة" : "Company share", value: money(tCo), suffix: "SAR" },
        { label: ar ? "الإجمالي المسدَّد" : "Total remitted", value: money(tEmp + tCo), suffix: "SAR" },
        { label: ar ? "سعوديون" : "Saudi", value: saudis, tone: "ok" },
      ]} />
      <div style={tableShell}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(150px,1.3fr) 90px minmax(100px,1fr) minmax(100px,1fr) minmax(100px,1fr) minmax(120px,auto)",
          gap: 10,
          padding: "10px 16px",
          background: SURFACE,
          fontSize: 10,
          fontWeight: 600,
          color: MUTED,
        }}>
          {(ar
            ? ["الموظف", "الجنسية", "الأجر الخاضع", "حصة الموظف", "حصة الشركة", "الأساس"]
            : ["Employee", "Nationality", "Contributory", "Employee", "Company", "Basis"]
          ).map((label) => <span key={label}>{label}</span>)}
        </div>
        {rows.map((row) => {
          const basis = basisParts(row, ar);
          return (
          <div
            key={row.item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(150px,1.3fr) 90px minmax(100px,1fr) minmax(100px,1fr) minmax(100px,1fr) minmax(120px,auto)",
              gap: 10,
              padding: "12px 16px",
              borderTop: "1px solid var(--nv-line)",
              alignItems: "center",
              color: NAVY,
            }}
          >
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>{row.employee?.name || row.item.employeeName}</span>
              <span style={{ fontSize: 10, color: MUTED }}>{row.employee?.position || ""}</span>
            </span>
            <span style={row.unknown ? undefined : (row.saudi ? OK : WARN)}>{row.unknown ? (ar ? "غير محددة" : "Unknown") : row.saudi ? (ar ? "سعودي" : "Saudi") : (ar ? "وافد" : "Expat")}</span>
            <span dir="ltr">{money(row.gosi.base)}</span>
            <span dir="ltr" style={{ color: row.gosi.employeeShare ? "var(--nv-bad-ink)" : MUTED }}>{money(row.gosi.employeeShare)}</span>
            <span dir="ltr">{money(row.gosi.employerShare)}</span>
            <span style={{ fontSize: 11, color: MUTED }}>
              {basis.rates ? (
                <>
                  {basis.klass ? `${basis.klass} · ` : null}
                  <span dir="ltr">{basis.rates}</span>
                </>
              ) : basis.text}
            </span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
