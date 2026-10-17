import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { visibleEmployees, visibleStations } from "@/lib/permissions";
import { canManageSurface } from "@/lib/financeRights";
import { monthKey } from "@/lib/payroll";
import { payrollManageLines } from "@/lib/payrollManageScope";
import { disciplineManageCases } from "@/lib/disciplineManageScope";
import { voiceMinistryInputs } from "@/lib/voiceMinistryRows";
import { scheduleMinistryCounts } from "@/lib/ministryCounts";
import { ministryIndexSections, ministryIndexTotals } from "@/lib/ministryIndex";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { useManageDutyWeek } from "@/components/schedules/ManageDutySide";
import { useComplianceSummary } from "@/components/schedules/ScheduleCompliancePanel";
import { openLinkStyle } from "@/components/schedules/dutyLinks";
import { chip, mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

const INDEX_CSS = `
.nv-mi-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; align-items: center; padding: 12px 18px; border-bottom: 1px solid var(--nv-line2, #EEF2F7); min-width: 0; }
.nv-mi-side { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: flex-end; min-width: 0; }
.nv-mi-counts { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
@media (max-width: 640px) {
  .nv-mi-row { grid-template-columns: minmax(0, 1fr); }
  .nv-mi-side { justify-content: flex-start; }
}
`;

/** A count in ink — the status colour lives on the chip only. */
function Count({ value, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
      <strong dir="ltr" style={{ ...mono, fontSize: 14, fontWeight: 700, color: value ? "var(--nv-ink)" : "var(--nv-ink3, var(--nv-muted))" }}>{value}</strong>
      <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{label}</span>
    </span>
  );
}

function statusChip(section, ar) {
  if (section.restricted) return { tone: "mute", text: ar ? "مقيّد" : "Restricted" };
  if (section.tone === "bad") return { tone: "bad", text: ar ? "مانع قائم" : "Blocker open" };
  if (section.tone === "warn") return { tone: "warn", text: ar ? "تنبيه قائم" : "Alert open" };
  if (section.tone === "ok") return { tone: "ok", text: ar ? "مستوفٍ" : "Met" };
  return { tone: "mute", text: ar ? "للعلم" : "Reference" };
}

/**
 * «الامتثال الوزاري» — the management index: one line per section, its counts read from the same row
 * builders as that section's «أنظمة الوزارة» panel (lib/ministryIndex), and a link that opens the panel.
 * Scope: the viewer's permissions and the header branch. صوت الموظف counts show to HR receivers only.
 */
export default function MinistryComplianceIndex({ ar = true }) {
  const { data, currentUser } = useAuth();
  const scope = useStationScope();
  const today = todayIso();
  const week = useManageDutyWeek({ ar });
  const summary = useComplianceSummary({
    gates: week.gates,
    company: data,
    onDate: week.weekStart ? calendarDateKey(week.weekStart) : undefined,
    weekStart: week.weekStart,
    employees: week.employees,
    ar,
  });

  const scheduleCounts = week.gates ? scheduleMinistryCounts(summary) : null;
  const scheduleKey = scheduleCounts ? `${scheduleCounts.block}/${scheduleCounts.alert}/${scheduleCounts.met}` : "";

  const sections = useMemo(() => {
    if (!data || !currentUser) return [];
    const inScope = (stationId) => matchesStationScope(stationId, scope, data.stations || []);
    const employees = visibleEmployees(currentUser, data).filter((person) => inScope(person.stationId));
    const stations = visibleStations(currentUser, data).filter((station) => inScope(station.id));
    const month = monthKey();
    const payroll = canManageSurface("payroll", currentUser, data)
      ? { month, ...payrollManageLines(data, currentUser, { month, stationIds: scope === "all" ? [] : [scope], ar }) }
      : null;
    return ministryIndexSections({
      data,
      employees,
      stations,
      schedule: scheduleCounts,
      scheduleStation: week.gates ? week.stationName : "",
      payroll,
      disciplineCases: disciplineManageCases(data, currentUser, { inScope }),
      voice: voiceMinistryInputs(data, currentUser, { inScope }),
      today,
      ar,
    });
  }, [data, currentUser, scope, week.gates, week.stationName, scheduleKey, today, ar]);

  if (!sections.length) return null;
  const total = ministryIndexTotals(sections);

  return (
    <section id="nv-ministry-index" data-ministry-index="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <style>{INDEX_CSS}</style>
      <SectionHead
        title={ar ? "الامتثال الوزاري — فهرس الأقسام" : "Ministry compliance — section index"}
        note={ar
          ? "كل سطر يعدّ قواعد «أنظمة الوزارة» في قسمه من الصفوف نفسها التي تعرضها لوحته — ويفتحها. النطاق: صلاحياتك والفرع المختار أعلاه."
          : "Each line counts its section's «ministry rules» from the very rows its panel lists — and opens it. Scope: your permissions and the branch picked above."}
        trailing={(
          <div className="nv-mi-counts">
            <Count value={total.alert} label={ar ? "تنبيه" : "alert"} />
            <Count value={total.met} label={ar ? "مستوفٍ" : "met"} />
            <Count value={total.info} label={ar ? "للعلم" : "reference"} />
          </div>
        )}
      />
      <div role="list" style={{ display: "flex", flexDirection: "column" }}>
        {sections.map((section) => {
          const status = statusChip(section, ar);
          return (
            <div key={section.key} role="listitem" className="nv-mi-row" data-ministry-index-row={section.key} data-tone={section.tone}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5 }}>{section.title}</span>
                <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.65, overflowWrap: "anywhere" }}>{section.scope}</span>
              </span>
              <span className="nv-mi-side">
                {section.counts ? (
                  <span className="nv-mi-counts">
                    <Count value={section.counts.alert} label={ar ? "تنبيه" : "alert"} />
                    <Count value={section.counts.met} label={ar ? "مستوفٍ" : "met"} />
                    <Count value={section.counts.info} label={ar ? "للعلم" : "reference"} />
                  </span>
                ) : null}
                <span style={chip(status.tone, { fontWeight: 600, flex: "none" })}>{status.text}</span>
                <Link to={section.href} style={openLinkStyle()} data-ministry-index-open={section.key}>
                  {ar ? "افتح ›" : "Open ›"}
                </Link>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
