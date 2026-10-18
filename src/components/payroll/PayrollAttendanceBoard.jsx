import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { derivePayrollMonthAttendance } from "@/lib/payrollMonthAttendance";
import { overtimePay, holidayPay, lineUnpaidLeaveCut } from "@/lib/payrollDerivations";
import { MUTED, NAVY, OK, WARN, BAD, tableShell, SURFACE } from "@/lib/platformStyles";
import FigureRow from "@/components/shared/FigureRow";
import RightHint from "@/components/shared/RightHint";
import { payHintFor } from "@/lib/rightHints.pay";

const head = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.2fr) 66px 60px 60px 76px 60px 66px minmax(150px,auto)",
  gap: 10,
  padding: "10px 16px",
  background: SURFACE,
  borderBottom: "1px solid var(--nv-line)",
  fontSize: 10,
  fontWeight: 600,
  color: MUTED,
};

const row = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.2fr) 66px 60px 60px 76px 60px 66px minmax(150px,auto)",
  gap: 10,
  padding: "12px 16px",
  borderBottom: "1px solid var(--nv-line)",
  alignItems: "center",
};

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function PayrollAttendanceBoard({
  month,
  items = [],
  employeeForItem,
  data,
  ar,
  onOpenDeductions,
}) {
  const lines = useMemo(() => items.map((item) => {
    const employee = employeeForItem?.(item);
    const att = derivePayrollMonthAttendance(item.employeeId, month, data);
    // Art. 107: the overtime hour is the actual hourly wage (base + allowances) + 50% of the basic
    // hourly. Art. 107(3): holiday and Eid hours are overtime at the same formula — no ×2.
    const otPay = overtimePay(item.base, att.otHours, item.allowances);
    const holidayHours = Number(item.holidayOvertimeHours) || 0;
    const hol = holidayPay(item.base, holidayHours, item.allowances);
    const day = Math.round((Number(item.base) || 0) / 30);
    const cut = att.absent * day;
    // Art. 116: unpaid leave is wage not due — it lowers the gross, it is not a deduction line.
    const notDue = lineUnpaidLeaveCut(item);
    return { item, employee, att, otPay, hol, holidayHours, cut, notDue };
  }), [items, month, data, employeeForItem]);

  const tot = lines.reduce((acc, line) => ({
    p: acc.p + line.att.present,
    o: acc.o + line.att.otHours,
    a: acc.a + line.att.absent,
    u: acc.u + line.att.unpaidLeave,
  }), { p: 0, o: 0, a: 0, u: 0 });
  const sourced = lines.some((line) => line.att.source === "calendar");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: sourced ? MUTED : "var(--nv-bad-ink)", lineHeight: 1.75 }}>
        {sourced
          ? (ar ? "مقروء من التقويم التشغيلي ولا يُحرَّر هنا — الإضافي والغياب والإجازة بلا أجر تُشتقّ منه." : "Read from the operational calendar, not edited here — overtime, absence and unpaid leave derive from it.")
          : (ar ? "لا حضور مقروء لهذه الدورة — لا اعتماد يغيّر رقماً غير مقروء." : "No attendance read for this cycle — approval cannot invent unread figures.")}
        {" "}
        <Link to="/app/attendance" style={{ fontWeight: 600, color: "var(--nv-ok-ink)", textDecoration: "none" }}>
          {ar ? "التقويم التشغيلي ‹" : "Operational calendar ›"}
        </Link>
      </p>

      <FigureRow ar={ar} figures={[
        { key: "present", label: ar ? "أيام حضور" : "Present days", value: tot.p },
        { key: "ot", label: ar ? "ساعات إضافية" : "Overtime hours", value: tot.o },
        { key: "absent", label: ar ? "أيام غياب" : "Absent days", value: tot.a, tone: tot.a ? "danger" : null, flag: tot.a ? (ar ? "يُخصم من الأجر" : "Deducted from pay") : "" },
        { key: "unpaid", label: ar ? "إجازة بلا أجر" : "Unpaid leave", value: tot.u, tone: tot.u ? "warn" : null },
      ]} />

      <div style={tableShell}>
        <div style={head}>
          {(ar
            ? ["الموظف", "الوردية", "حضر", "إضافي", "عطل وأعياد", "غياب", "بلا أجر", "أثره في المسير"]
            : ["Employee", "Shift", "Present", "OT", "Holidays/Eid", "Absent", "Unpaid", "Run effect"]
          ).map((label) => <span key={label}>{label}</span>)}
        </div>
        {lines.length === 0 ? (
          <p style={{ margin: 0, padding: 16, fontSize: 12, color: MUTED }}>
            {ar ? "لا موظفين في هذا النطاق." : "No employees in this scope."}
          </p>
        ) : lines.map((line) => {
          const effect = [
            (line.otPay + line.hol) ? `+${money(line.otPay + line.hol)}` : "",
            line.cut ? `− ${money(line.cut)}` : "",
            line.notDue ? (ar ? `غير مستحق ${money(line.notDue)}` : `not due ${money(line.notDue)}`) : "",
          ].filter(Boolean).join(" · ") || (ar ? "لا أثر" : "No effect");
          // «التزامك» — unpaid leave is wage not due (116); overtime is the 107 formula.
          const hintCtx = { view: "manager", ar, name: line.employee?.name || line.item.employeeName || "", employeeId: line.item.employeeId };
          const hint = line.notDue
            ? payHintFor("unpaidLeave", { ...hintCtx, days: line.att.unpaidLeave || line.item.unpaidLeaveDays, amount: line.notDue })
            : (line.att.otHours || line.holidayHours)
              ? payHintFor("overtime", { ...hintCtx, hours: (Number(line.att.otHours) || 0) + (Number(line.holidayHours) || 0), amount: line.otPay + line.hol, base: line.item.base, allowances: line.item.allowances })
              : null;
          return (
            <div
              key={line.item.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDeductions?.(line.item)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDeductions?.(line.item); } }}
              style={{ ...row, width: "100%", background: "transparent", textAlign: "start", cursor: "pointer", fontFamily: "inherit", color: NAVY }}
            >
              <span>
                <span style={{ display: "block", fontWeight: 600 }}>{line.employee?.name || line.item.employeeName}</span>
                <span style={{ fontSize: 10, color: MUTED }}>{line.employee?.position || line.item.employeePosition || ""}</span>
              </span>
              <span dir="ltr">{line.att.shift}</span>
              <span dir="ltr">{line.att.present}</span>
              <span dir="ltr" style={{ color: line.att.otHours ? NAVY : MUTED }}>{line.att.otHours}</span>
              <span dir="ltr">{line.holidayHours}</span>
              <span dir="ltr" style={{ color: line.att.absent ? NAVY : MUTED }}>{line.att.absent}</span>
              <span dir="ltr" style={{ color: line.att.unpaidLeave ? NAVY : MUTED }}>{line.att.unpaidLeave}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{
                  ...(line.att.attGap ? BAD : (line.att.absent || line.att.unpaidLeave ? WARN : OK)),
                  fontSize: 10,
                }}>
                  {line.att.attGap ? (ar ? "أيام غير مفسَّرة" : "Unexplained days") : effect}
                </span>
                {hint ? (
                  <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <RightHint ar={ar} hint={hint} />
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
