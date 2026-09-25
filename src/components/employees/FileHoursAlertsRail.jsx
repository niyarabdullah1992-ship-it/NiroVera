import React, { useMemo } from "react";
import { checkWeekPublishGates, groupDutyStripByPerson, SW, weekDutyStripAlerts } from "@/lib/shiftWeek";
import { employeeFileHoursAlerts, employeeFileVoice, isViewerOwnFile } from "@/lib/employeeFileView";
import DutyStripAlertCard from "@/components/employees/DutyStripAlertCard";
import { hoursPolicyOf, checkWorkPostingGate } from "@/lib/laborHoursPolicy.js";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { docFrame } from "@/lib/designSystem";
import { statusBanner, statusBannerQuiet } from "@/lib/platformStyles";

/**
 * Employee presenter of the same week-check rows as حكم المنصة.
 * Section title is تنبيهاتي. Cards never name a coworker.
 * Default chrome matches platform تنبيهات (statusBanner + 3px top edge).
 * Pass quietEdge for جدول — soft fill + 1px line only.
 */
export default function FileHoursAlertsRail({
  employee,
  schedule,
  weekStart,
  currentUser,
  lang = "ar",
  laborCalendar,
  gates,
  station,
  settings,
  company,
  canApplyOrdinary = false,
  onApplyOrdinary,
  quietEdge = false,
}) {
  const ar = lang === "ar";
  const own = isViewerOwnFile(employee, currentUser);
  const audience = own ? "employee" : "manager";
  const voice = employeeFileVoice({ employee, currentUser, ar });
  const weekGates = useMemo(
    () => gates || checkWeekPublishGates({
      schedule: schedule || { shiftTypes: [], assignments: {} },
      employees: employee ? [employee] : [],
      weekStart,
      stationId: employee?.stationId,
      station,
      settings,
      company,
      laborCalendar,
      ar,
    }),
    [gates, schedule, employee, weekStart, station, settings, company, laborCalendar, ar],
  );
  const weekPack = useMemo(
    () => weekDutyStripAlerts(weekGates, {
      employees: employee ? [employee] : [],
      ar,
      audience,
      employeeId: employee?.id,
    }),
    [weekGates, employee, ar, audience],
  );
  const fileAlerts = useMemo(
    () => employeeFileHoursAlerts({
      employee,
      schedule,
      weekStart,
      ar,
      laborCalendar,
    }),
    [employee, schedule, weekStart, ar, laborCalendar],
  );
  const grouped = useMemo(() => {
    const extraCards = fileAlerts.chips
      .filter((chip) => {
        if (!chip.due) return false;
        if (chip.id === "18632") return !weekPack.cards.some((row) => row.decisionId === "18632");
        return true;
      })
      .map((chip) => {
        const who = String(employee?.name || "").trim();
        const protection = chip.decisionId === "18632" || chip.id === "18632";
        return {
          id: chip.id,
          employeeId: employee?.id,
          name: who,
          href: chip.href || "",
          classification: protection
            ? (ar ? "إنذار حماية" : "Protection alert")
            : (ar ? "تنبيه إداري" : "Administrative notice"),
          instrument: chip.decisionId ? (ar ? `قرار ${chip.decisionId}` : `Decision ${chip.decisionId}`) : "",
          headline: chip.label,
          subject: audience === "manager" && who ? (ar ? `بشأن: ${who}` : `Re: ${who}`) : "",
          body: "",
          footer: "",
          level: "warn",
          glow: "due",
          audience,
          decisionId: chip.decisionId || null,
        };
      });
    return groupDutyStripByPerson(
      { cards: [...weekPack.cards, ...extraCards] },
      { ar, audience },
    );
  }, [weekPack, fileAlerts, employee, ar, audience]);
  const due = grouped.anyDue;
  const posting = checkWorkPostingGate({ company, station, settings });
  const table = hoursPolicyOf(company).workPosting || {};
  const banner = quietEdge ? statusBannerQuiet : statusBanner;
  const settledSkin = quietEdge
    ? { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, boxShadow: "var(--nv-paper)", padding: "12px 14px" }
    : { ...docFrame("settled"), padding: "12px 14px" };
  const railSkin = due
    ? (grouped.anyBlock ? banner.bad : banner.warn)
    : settledSkin;

  return (
    <section
      data-audience={audience}
      style={{
        ...railSkin,
        ...(due ? {} : { padding: "12px 14px" }),
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0, color: SW.ink }}>{voice.warnings}</span>
      {!due ? (
        <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>{voice.emptyAlert}</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
          {grouped.people.map((person) => (
            <DutyStripAlertCard
              key={person.id}
              card={person}
              ar={ar}
              hideJudgment
              onApplyOrdinary={canApplyOrdinary && onApplyOrdinary
                ? (kind) => {
                  const rotate = [person.gateId, ...(person.items || []).map((row) => row.gateId)]
                    .some((id) => id === "night_rotate");
                  return onApplyOrdinary(employee, kind, rotate ? undefined : person.onDate);
                }
                : undefined}
            />
          ))}
        </div>
      )}
      <div style={{ paddingTop: 8, borderTop: `1px solid ${SW.hair}`, display: "flex", flexDirection: "column", gap: 6 }}>
        <LaborArticleCite ruleId="hours.posting.cite" ar={ar} />
        {posting.ok ? (
          <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.75 }}>
            {[table.hoursTable, table.restPeriods, table.weeklyRest, table.shiftTimes].filter(Boolean).join(" · ")
              || (ar ? `معلَن في موقع العمل${table.postedAt ? ` في ${table.postedAt}` : ""}` : `Posted at the workplace${table.postedAt ? ` on ${table.postedAt}` : ""}`)}
          </span>
        ) : (
          own
            ? <span style={{ fontSize: 11, color: SW.muted, lineHeight: 1.7 }}>{ar ? "جدول العمل المعلن لم يُرفع بعد — اسأل الإدارة." : "The posted work table is not on file yet — ask management."}</span>
            : <span style={{ fontSize: 11, color: SW.gold, lineHeight: 1.7 }}>{posting.reason}</span>
        )}
      </div>
    </section>
  );
}
