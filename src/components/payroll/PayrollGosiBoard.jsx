import React, { useMemo } from "react";
import { gosiLine } from "@/lib/payrollDerivations";
import { nationalityIsSaudi } from "@/lib/complianceDerivations";
import { MUTED, NAVY, OK, WARN, tableShell, SURFACE } from "@/lib/platformStyles";
import KpiStrip from "@/components/shared/KpiStrip";

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function PayrollGosiBoard({ items = [], employeeForItem, ar }) {
  const rows = useMemo(() => items.map((item) => {
    const employee = employeeForItem?.(item);
    const saudi = nationalityIsSaudi(employee?.profile?.nationality || employee?.nationality) !== false;
    return { item, employee, gosi: gosiLine(item, { saudi }), saudi };
  }), [items, employeeForItem]);

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
        {rows.map((row) => (
          <div
            key={row.item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(150px,1.3fr) 90px minmax(100px,1fr) minmax(100px,1fr) minmax(100px,1fr) minmax(120px,auto)",
              gap: 10,
              padding: "12px 16px",
              borderTop: "1px solid #F1F5F9",
              alignItems: "center",
              color: NAVY,
            }}
          >
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>{row.employee?.name || row.item.employeeName}</span>
              <span style={{ fontSize: 10, color: MUTED }}>{row.employee?.position || ""}</span>
            </span>
            <span style={row.saudi ? OK : WARN}>{row.saudi ? (ar ? "سعودي" : "Saudi") : (ar ? "وافد" : "Expat")}</span>
            <span dir="ltr">{money(row.gosi.base)}</span>
            <span dir="ltr" style={{ color: row.gosi.employeeShare ? "#8a1c2b" : MUTED }}>{money(row.gosi.employeeShare)}</span>
            <span dir="ltr">{money(row.gosi.employerShare)}</span>
            <span style={{ fontSize: 11, color: MUTED }}>
              {row.saudi ? "9.75٪ + 11.75٪" : (ar ? "2٪ أخطار مهنية" : "2% occupational")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
