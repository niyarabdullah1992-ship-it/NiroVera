import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { SW } from "@/lib/shiftWeek";
import { managerHoursAlerts } from "@/lib/employeeFileView";
import StatutoryItem from "@/components/labor/StatutoryItem";

/**
 * إدارة الجدول — تنبيهات مشتقة عند الاستحقاق فقط.
 * الموظف لا يرسل إشعاراً. صفر أشهر ≠ تنبيه. أحمر مضيء = حان وقت الموافقة/التدوير.
 */
export default function ManagerHoursAlertsRail({
  employees = [],
  schedule,
  weekStart,
  lang = "ar",
  laborCalendar,
  canEdit,
  onOpenConsent,
}) {
  const ar = lang === "ar";
  const alerts = useMemo(
    () => managerHoursAlerts({ employees, schedule, weekStart, ar, laborCalendar }),
    [employees, schedule, weekStart, ar, laborCalendar],
  );
  const stripDue = alerts.anyDue;

  return (
    <section
      className="nv-night-strip"
      data-glow={stripDue ? "due" : "off"}
      style={{
        background: stripDue ? SW.absBg : SW.card,
        border: `1px solid ${stripDue ? SW.absBd : SW.line}`,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "تنبيهات الإدارة" : "Manager alerts"}</span>
      {alerts.empty ? (
        <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>
          {ar ? "لا تنبيه مستحق — النظام يُنبّه عند 3 أشهر كعامل ليلي أو موافقة معلّقة." : "No alert due — the system notifies at 3 months as a night worker or an open consent."}
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.chips.map((chip) => (
            <div key={chip.id} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "start" }}>
              <Link to={chip.href || "/app/requests/manage"} style={{ textDecoration: "none" }}>
                <span
                  className="nv-night-strip"
                  data-glow="due"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    fontSize: 12,
                    fontWeight: 600,
                    color: SW.abs,
                    background: SW.absBg,
                    border: `1px solid ${SW.absBd}`,
                    padding: "6px 10px",
                  }}
                >
                  {chip.label}
                  <StatutoryItem decisionId="18632" ar={ar} entitlement glow="due" compact />
                </span>
              </Link>
              {canEdit && onOpenConsent ? (
                <button
                  type="button"
                  onClick={onOpenConsent}
                  style={{
                    fontFamily: "inherit",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 10px",
                    border: `1px solid ${SW.line}`,
                    background: SW.card,
                    color: SW.ink,
                    cursor: "pointer",
                  }}
                >
                  {ar ? "افتح طلب الموافقة في طلباتي" : "Open the consent request in My Requests"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
