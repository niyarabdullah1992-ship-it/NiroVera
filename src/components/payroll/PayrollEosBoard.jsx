import React, { useMemo } from "react";
import { deriveEos } from "@/lib/offboardingDerivations";
import { averageActualWage, isAverageWageBasis } from "@/lib/payrollLaw";
import { MUTED, NAVY, tableShell, SURFACE } from "@/lib/platformStyles";
import KpiStrip from "@/components/shared/KpiStrip";

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function hireOf(employee) {
  return employee?.profile?.hireDate || employee?.hireDate || employee?.startDate || "";
}

/**
 * Standing Art. 84 liability per worker, through the same deriveEos the exit file uses: service to
 * the exit date when one is set (Art. 84), less contract-suspended unpaid leave (Art. 116),
 * commissions inside the wage unless excluded by agreement (Arts. 2/86), and the last year's
 * average for piece and commission-only wages (Art. 96).
 */
export default function PayrollEosBoard({ items = [], employeeForItem, ar, payrollRuns = [] }) {
  const rows = useMemo(() => items.map((item) => {
    const employee = employeeForItem?.(item);
    const hire = hireOf(employee);
    const commission = Number(item.commissionAmount) || 0;
    const exit = employee?.profile?.contractExit;
    const average = isAverageWageBasis(employee) ? averageActualWage(payrollRuns, item.employeeId, String(exit?.effectiveDate || "").slice(0, 7) || undefined) : null;
    const eos = hire ? deriveEos({
      hireDate: hire,
      base: Number(item.base) || 0,
      // The line's allowances already carry the commission; pass it apart so Art. 86 can exclude it.
      allowances: Math.max(0, (Number(item.allowances) || 0) - commission),
      commissionAmount: commission,
      profile: employee?.profile || {},
      leaveRequests: employee?.leaveRequests || [],
      contractExit: exit,
      averageWage: average?.average,
      averageWageBasis: Boolean(average?.months),
    }) : null;
    const years = eos?.years || 0;
    const wage = eos ? eos.wage : (Number(item.base) || 0) + (Number(item.allowances) || 0);
    const first = eos ? eos.firstFive : 0;
    const rest = eos ? eos.beyondFive : 0;
    const amt = eos ? eos.article84Full : 0;
    return { item, employee, hire, years, wage, first, rest, amt, eos };
  }), [items, employeeForItem, payrollRuns]);

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
              borderTop: "1px solid var(--nv-line)",
              alignItems: "center",
              color: NAVY,
            }}
          >
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>{row.employee?.name || row.item.employeeName}</span>
              <span style={{ fontSize: 10, color: MUTED }}>{row.hire ? `${ar ? "تعيينه" : "Hired"} ${row.hire}` : (ar ? "بلا تاريخ تعيين" : "No hire date")}</span>
              {row.eos?.suspendedDays ? <span style={{ display: "block", fontSize: 10, color: MUTED }}>{ar ? `${row.eos.suspendedDays} يوماً موقوفة (بلا أجر فوق 20 — م116)` : `${row.eos.suspendedDays} suspended days (unpaid over 20 — Art. 116)`}</span> : null}
              {row.eos?.averageBasis ? <span style={{ display: "block", fontSize: 10, color: MUTED }}>{ar ? "متوسط أجر السنة الأخيرة — م96" : "Last year's average wage — Art. 96"}</span> : null}
            </span>
            <span style={{ color: MUTED }}>{Math.round(row.years * 10) / 10} {ar ? "سنة" : "yrs"}</span>
            <span dir="ltr">{money(row.wage)}</span>
            <span dir="ltr">{money(row.first)}</span>
            <span dir="ltr" style={{ color: row.rest ? NAVY : "#c7ccd6" }}>{money(row.rest)}</span>
            <span dir="ltr" style={{ fontWeight: 600, color: "var(--nv-ok-ink)" }}>{money(row.amt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
