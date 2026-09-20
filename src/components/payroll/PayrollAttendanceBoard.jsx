import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { derivePayrollMonthAttendance } from "@/lib/payrollMonthAttendance";
import { overtimePay, holidayPay, eidPay } from "@/lib/payrollDerivations";
import { MUTED, NAVY, OK, WARN, BAD, tableShell, SURFACE, INK } from "@/lib/platformStyles";
import KpiStrip from "@/components/shared/KpiStrip";
import { ChromeBox } from "@/components/shared/IdentityCard";

const head = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.2fr) 66px 60px 60px 60px 56px 60px 66px minmax(140px,auto)",
  gap: 10,
  padding: "10px 16px",
  background: SURFACE,
  borderBottom: "1px solid #E2E8F0",
  fontSize: 10,
  fontWeight: 600,
  color: MUTED,
};

const row = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.2fr) 66px 60px 60px 60px 56px 60px 66px minmax(140px,auto)",
  gap: 10,
  padding: "12px 16px",
  borderBottom: "1px solid #F1F5F9",
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
    const otPay = overtimePay(item.base, att.otHours);
    const hol = holidayPay(item.base, att.holidayHours);
    const eid = eidPay(item.base, att.eidHours);
    const day = Math.round((Number(item.base) || 0) / 30);
    const cut = (att.absent + att.unpaidLeave) * day;
    return { item, employee, att, otPay, hol, eid, cut };
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
      <ChromeBox style={{ padding: 14 }}>
        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
          {ar
            ? "يُقرأ من التقويم التشغيلي وجدول الدوام ولا يُحرَّر هنا. الإضافي المعتمد يغذّي المسير — تصحيح الغياب من الحضور ثم يُعاد القراءة."
            : "Read from the operational calendar and rota — not edited here. Approved overtime feeds the run. Correct absence on Attendance, then re-read."}
          {" "}
          <Link to="/app/attendance" style={{ fontWeight: 600, color: INK }}>
            {ar ? "التقويم التشغيلي" : "Operational calendar"}
          </Link>
        </p>
      </ChromeBox>

      <div style={{
        padding: "10px 13px",
        border: `1px solid ${sourced ? "#bfe6d2" : "#e9c4c9"}`,
        background: sourced ? "#f2faf6" : "#fbf1f2",
        fontSize: 12,
        color: sourced ? "#137a49" : "#8a1c2b",
        lineHeight: 1.7,
      }}>
        <strong>{sourced ? (ar ? "مقروء من الحضور" : "Read from attendance") : (ar ? "لا حضور مقروء لهذه الدورة" : "No attendance read for this cycle")}</strong>
        {" · "}
        {sourced
          ? (ar ? "الإضافي والغياب والإجازة بلا أجر تُشتقّ منه." : "Overtime, absence, and unpaid leave are derived from it.")
          : (ar ? "راجع التقويم التشغيلي — لا اعتماد يغيّر رقمًا غير مقروء." : "Open the operational calendar — approval cannot invent unread figures.")}
      </div>

      <KpiStrip stats={[
        { label: ar ? "أيام حضور" : "Present days", value: tot.p, tone: "ok" },
        { label: ar ? "ساعات إضافية" : "Overtime hours", value: tot.o },
        { label: ar ? "أيام غياب" : "Absent days", value: tot.a, tone: tot.a ? "danger" : "ok" },
        { label: ar ? "إجازة بلا أجر" : "Unpaid leave", value: tot.u, tone: tot.u ? "warn" : "ok" },
      ]} />

      <div style={tableShell}>
        <div style={head}>
          {(ar
            ? ["الموظف", "الوردية", "حضر", "إضافي", "عطلة", "عيد", "غياب", "بلا أجر", "أثره في المسير"]
            : ["Employee", "Shift", "Present", "OT", "Rest", "Eid", "Absent", "Unpaid", "Run effect"]
          ).map((label) => <span key={label}>{label}</span>)}
        </div>
        {lines.length === 0 ? (
          <p style={{ margin: 0, padding: 16, fontSize: 12, color: MUTED }}>
            {ar ? "لا موظفين في هذا النطاق." : "No employees in this scope."}
          </p>
        ) : lines.map((line) => {
          const effect = [
            (line.otPay + line.hol + line.eid) ? `+${money(line.otPay + line.hol + line.eid)}` : "",
            line.cut ? `− ${money(line.cut)}` : "",
          ].filter(Boolean).join(" · ") || (ar ? "لا أثر" : "No effect");
          return (
            <button
              key={line.item.id}
              type="button"
              onClick={() => onOpenDeductions?.(line.item)}
              style={{ ...row, width: "100%", background: "transparent", borderInline: "none", borderTop: "none", textAlign: "start", cursor: "pointer", fontFamily: "inherit", color: NAVY }}
            >
              <span>
                <span style={{ display: "block", fontWeight: 600 }}>{line.employee?.name || line.item.employeeName}</span>
                <span style={{ fontSize: 10, color: MUTED }}>{line.employee?.position || line.item.employeePosition || ""}</span>
              </span>
              <span dir="ltr">{line.att.shift}</span>
              <span dir="ltr">{line.att.present}</span>
              <span dir="ltr" style={{ color: line.att.otHours ? "#137a49" : MUTED }}>{line.att.otHours}</span>
              <span dir="ltr">{line.att.holidayHours || 0}</span>
              <span dir="ltr">{line.att.eidHours || 0}</span>
              <span dir="ltr" style={{ color: line.att.absent ? "#8a1c2b" : MUTED }}>{line.att.absent}</span>
              <span dir="ltr" style={{ color: line.att.unpaidLeave ? "#8a6516" : MUTED }}>{line.att.unpaidLeave}</span>
              <span style={{
                ...(line.att.attGap ? BAD : (line.att.absent || line.att.unpaidLeave ? WARN : OK)),
                fontSize: 10,
              }}>
                {line.att.attGap ? (ar ? "أيام غير مفسَّرة" : "Unexplained days") : effect}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
