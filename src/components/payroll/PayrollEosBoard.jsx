import React, { useMemo } from "react";
import { eosGratuity, serviceYears } from "@/lib/offboardingDerivations";
import { MUTED, NAVY, tableShell, SURFACE } from "@/lib/platformStyles";
import KpiStrip from "@/components/shared/KpiStrip";

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function hireOf(employee) {
  return employee?.profile?.hireDate || employee?.hireDate || employee?.startDate || "";
}

export default function PayrollEosBoard({ items = [], employeeForItem, ar }) {
  const rows = useMemo(() => items.map((item) => {
    const employee = employeeForItem?.(item);
    const hire = hireOf(employee);
    const years = hire ? serviceYears(hire) : 0;
    const wage = (Number(item.base) || 0) + (Number(item.allowances) || 0);
    const first = Math.round(Math.min(years, 5) * wage * 0.5);
    const rest = Math.round(Math.max(0, years - 5) * wage);
    const amt = hire ? eosGratuity(years, wage) : 0;
    return { item, employee, hire, years, wage, first, rest, amt };
  }), [items, employeeForItem]);

  const tot = rows.reduce((sum, row) => sum + row.amt, 0);
  const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.years, 0) / rows.length * 10) / 10 : 0;
  const overFive = rows.filter((row) => row.years > 5).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <KpiStrip stats={[
        { label: ar ? "الالتزام القائم" : "Standing liability", value: money(tot), suffix: "SAR" },
        { label: ar ? "متوسط الخدمة" : "Average service", value: avg, suffix: ar ? "سنة" : "yrs" },
        { label: ar ? "فوق خمس سنوات" : "Over five years", value: overFive, tone: "ok" },
      ]} />
      <div style={tableShell}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(150px,1.3fr) 90px minmax(100px,1fr) minmax(110px,1fr) minmax(110px,1fr) minmax(110px,1fr)",
          gap: 10,
          padding: "10px 16px",
          background: SURFACE,
          fontSize: 10,
          fontWeight: 600,
          color: MUTED,
        }}>
          {(ar
            ? ["الموظف", "الخدمة", "الأجر الشهري", "الخمس الأولى", "ما بعدها", "المستحقّ"]
            : ["Employee", "Service", "Monthly wage", "First five", "Thereafter", "Due"]
          ).map((label) => <span key={label}>{label}</span>)}
        </div>
        {rows.map((row) => (
          <div
            key={row.item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(150px,1.3fr) 90px minmax(100px,1fr) minmax(110px,1fr) minmax(110px,1fr) minmax(110px,1fr)",
              gap: 10,
              padding: "12px 16px",
              borderTop: "1px solid #F1F5F9",
              alignItems: "center",
              color: NAVY,
            }}
          >
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>{row.employee?.name || row.item.employeeName}</span>
              <span style={{ fontSize: 10, color: MUTED }}>{row.hire ? `${ar ? "تعيينه" : "Hired"} ${row.hire}` : (ar ? "بلا تاريخ تعيين" : "No hire date")}</span>
            </span>
            <span style={{ color: MUTED }}>{Math.round(row.years * 10) / 10} {ar ? "سنة" : "yrs"}</span>
            <span dir="ltr">{money(row.wage)}</span>
            <span dir="ltr">{money(row.first)}</span>
            <span dir="ltr" style={{ color: row.rest ? NAVY : "#c7ccd6" }}>{money(row.rest)}</span>
            <span dir="ltr" style={{ fontWeight: 600, color: "#137a49" }}>{money(row.amt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
