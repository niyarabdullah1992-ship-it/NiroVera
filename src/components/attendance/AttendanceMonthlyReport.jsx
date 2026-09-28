import React, { useState, useEffect, useMemo } from "react";
import moment from "moment";
import { base44 } from "@/api/base44Client";
import ComparisonExportButtons from "@/components/reports/ComparisonExportButtons";
import KpiStrip from "@/components/shared/KpiStrip";
import { useI18n } from "@/lib/i18n";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { MUTED, NAVY, field, CARD } from "@/lib/platformStyles";

const RANGES = [
  { val: "monthly", amount: 1, unit: "months" },
  { val: "3months", amount: 3, unit: "months" },
  { val: "6months", amount: 6, unit: "months" },
  { val: "yearly", amount: 1, unit: "years" },
  { val: "custom" },
];

const PILL = {
  present: { bg: "var(--nv-accent-soft)", fg: "var(--nv-ok-ink)", bd: "var(--nv-ok-line)" },
  late: { bg: "var(--nv-warn-soft)", fg: "var(--nv-warn-ink)", bd: "var(--nv-warn-line)" },
  absent: { bg: "var(--nv-bad-soft)", fg: "var(--nv-bad-ink)", bd: "var(--nv-bad-line)" },
  excused: { bg: "var(--nv-soft)", fg: "var(--nv-ink)", bd: "var(--nv-line)" },
};

const statusPill = (kind) => ({
  display: "inline-flex",
  padding: "1px 7px",
  borderRadius: 20,
  fontSize: 10,
  fontWeight: 600,
  background: PILL[kind].bg,
  color: PILL[kind].fg,
  border: `1px solid ${PILL[kind].bd}`,
});

export default function AttendanceMonthlyReport({ employees, defaultEmployeeId, t }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { format } = useTimeFormat();
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || employees[0]?.id || "");
  const [range, setRange] = useState("monthly");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const rangeLabel = (val) => ({
    monthly: t("rangeMonthly"),
    "3months": t("range3Months"),
    "6months": t("preset6Months"),
    yearly: t("rangeYearly"),
    custom: t("rangeCustom"),
  }[val] || val);

  const dateWindow = useMemo(() => {
    let start;
    let end = moment();
    if (range === "custom") {
      start = customStart ? moment(customStart) : moment().subtract(1, "months");
      end = customEnd ? moment(customEnd) : moment();
    } else {
      const cfg = RANGES.find((r) => r.val === range);
      start = moment().subtract(cfg.amount, cfg.unit);
    }
    return { startDate: start.format("YYYY-MM-DD"), endDate: end.format("YYYY-MM-DD") };
  }, [range, customStart, customEnd]);

  useEffect(() => {
    if (!employeeId) return;
    const selectedEmployees = employeeId === "all" ? employees : employees.filter((e) => e.id === employeeId);
    setLoading(true);
    Promise.all(
      selectedEmployees.map((employee) =>
        base44.functions
          .invoke("supabaseAttendance", { action: "listRange", employeeId: employee.id, ...dateWindow })
          .then((res) => (res?.data?.rows || []).map((row) => ({ ...row, employeeId: employee.id, employeeName: employee.name })))
      )
    )
      .then((results) => setRows(results.flat()))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [employeeId, dateWindow.startDate, dateWindow.endDate, employees.map((e) => e.id).join(",")]);

  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === "present") acc.present += 1;
      else if (r.status === "late") acc.late += 1;
      else if (r.status === "absent" && r.excused) acc.excusedAbsent += 1;
      else if (r.status === "absent") acc.absent += 1;
      acc.hours += Number(r.work_hours) || 0;
      return acc;
    },
    { present: 0, late: 0, absent: 0, excusedAbsent: 0, hours: 0 }
  );

  const statusLabel = (r) =>
    t(`attendanceStatus${r.status.charAt(0).toUpperCase()}${r.status.slice(1).replace(/_([a-z])/, (_, c) => c.toUpperCase())}`);

  const statusKind = (r) => {
    if (r.status === "present") return "present";
    if (r.status === "late") return "late";
    if (r.status === "absent" && r.excused) return "excused";
    if (r.status === "absent") return "absent";
    return null;
  };

  const allEmployeesSelected = employeeId === "all";
  const allEmployeesLabel = ar ? "كل الموظفين" : "All employees";
  const exportHeaders = [
    ...(allEmployeesSelected ? [t("employeeName")] : []),
    t("date"),
    t("status"),
    t("checkIn"),
    t("checkOut"),
    t("workHoursLabel"),
    t("lateMinutesLabel"),
    ar ? "تحضير يدوي" : "Manual",
  ];
  const exportRows = rows.map((r) => [
    ...(allEmployeesSelected ? [r.employeeName || "—"] : []),
    r.date,
    statusLabel(r) + (r.excused ? ` (${t("excused")})` : ""),
    r.check_in_at ? formatTime(r.check_in_at, format, lang) : "—",
    r.check_out_at ? formatTime(r.check_out_at, format, lang) : "—",
    r.work_hours ?? "—",
    r.status === "late" ? (r.late_minutes ?? "—") : "—",
    r.manual_override || r.location_status === "manual"
      ? `${ar ? "يدوي" : "Manual"} — ${r.override_by || r.excused_by_name || "—"}`
      : "—",
  ]);

  const kpiItems = [
    { label: t("totalPresent"), value: String(totals.present), tone: totals.present > 0 ? "ok" : null },
    { label: t("totalLate"), value: String(totals.late), tone: totals.late > 0 ? "warn" : null },
    { label: t("totalAbsent"), value: String(totals.absent), tone: totals.absent > 0 ? "danger" : null },
    { label: `${t("totalAbsent")} (${t("excused")})`, value: String(totals.excusedAbsent) },
    { label: t("totalWorkHours"), value: totals.hours.toFixed(1), suffix: ar ? "س" : "h" },
  ];

  const employeeName = allEmployeesSelected
    ? allEmployeesLabel
    : employees.find((e) => e.id === employeeId)?.name || "";

  return (
    <div
      style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden" }}
      dir={ar ? "rtl" : "ltr"}
    >
      <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{t("monthlyAttendanceReport")}</div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
            {dateWindow.startDate} → {dateWindow.endDate}
          </div>
        </div>
        <ComparisonExportButtons
          title={`${t("monthlyAttendanceReport")} — ${employeeName}`}
          headers={exportHeaders}
          rows={exportRows}
          compact
        />
      </div>

      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ ...field, minWidth: 160, maxWidth: 240 }}>
          <option value="all">{allEmployeesLabel}</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {RANGES.map((r) => {
            const on = range === r.val;
            return (
              <button
                key={r.val}
                type="button"
                onClick={() => setRange(r.val)}
                style={{
                  padding: "4px 11px",
                  borderRadius: 20,
                  border: `1px solid ${on ? "var(--nv-ok-line)" : "var(--nv-line)"}`,
                  background: on ? "var(--nv-accent-soft)" : CARD,
                  color: on ? NAVY : MUTED,
                  fontSize: 11,
                  fontWeight: on ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {rangeLabel(r.val)}
              </button>
            );
          })}
        </div>
        {range === "custom" && (
          <>
            <PlatformDateField compact ar={ar} value={customStart} onChange={setCustomStart} />
            <PlatformDateField compact ar={ar} value={customEnd} min={customStart} onChange={setCustomEnd} />
          </>
        )}
      </div>

      <div style={{ padding: "12px 14px 0" }}>
        <KpiStrip stats={kpiItems} />
      </div>

      <div style={{ padding: "0 14px 14px" }}>
        {loading ? (
          <p style={{ padding: "16px 0", fontSize: 12, color: MUTED, textAlign: "center" }}>{ar ? "جاري التحميل…" : "Loading…"}</p>
        ) : rows.length === 0 ? (
          <p style={{ padding: "24px 0", fontSize: 12, color: MUTED, textAlign: "center" }}>{t("noAttendanceRecords")}</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--nv-line)", fontSize: 9, letterSpacing: "0.05em", color: MUTED, fontWeight: 600 }}>
                  {allEmployeesSelected && <th style={{ padding: "7px 8px", textAlign: "start" }}>{t("employeeName")}</th>}
                  <th style={{ padding: "7px 8px", textAlign: "start" }}>{t("date")}</th>
                  <th style={{ padding: "7px 8px", textAlign: "start" }}>{t("status")}</th>
                  <th style={{ padding: "7px 8px", textAlign: "start" }}>{t("checkIn")}</th>
                  <th style={{ padding: "7px 8px", textAlign: "start" }}>{t("checkOut")}</th>
                  <th style={{ padding: "7px 8px", textAlign: "start" }}>{t("workHoursLabel")}</th>
                  <th style={{ padding: "7px 8px", textAlign: "start" }}>{t("lateMinutesLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const kind = statusKind(r);
                  return (
                    <tr key={`${r.employeeId || employeeId}-${r.id}`} style={{ borderBottom: "1px solid var(--nv-line)" }}>
                      {allEmployeesSelected && (
                        <td style={{ padding: "7px 8px", fontWeight: 500, color: NAVY }}>{r.employeeName || "—"}</td>
                      )}
                      <td style={{ padding: "7px 8px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>{r.date}</td>
                      <td style={{ padding: "7px 8px" }}>
                        {kind ? <span style={statusPill(kind)}>{statusLabel(r)}</span> : statusLabel(r)}
                      </td>
                      <td style={{ padding: "7px 8px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                        {r.check_in_at ? formatTime(r.check_in_at, format, lang) : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                        {r.check_out_at ? formatTime(r.check_out_at, format, lang) : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", color: NAVY, fontWeight: 500, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                        {r.work_hours ?? "—"}
                      </td>
                      <td style={{ padding: "7px 8px", color: r.status === "late" ? "var(--nv-warn-ink)" : MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                        {r.status === "late" ? (r.late_minutes ?? "—") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
