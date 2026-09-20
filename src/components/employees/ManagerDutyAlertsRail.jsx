import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  attachNightDueStripCards,
  dutyStripPeopleSummary,
  groupDutyStripByPerson,
  SW,
  weekDutyStripAlerts,
  weekDutyStripEmptyCopy,
  weekStationDutyNotes,
} from "@/lib/shiftWeek";
import { managerDutyAlertGroups } from "@/lib/suiteBadges";
import DutyStripAlertCard from "@/components/employees/DutyStripAlertCard";
import { PLATFORM_JUDGE_LEDE_AR, PLATFORM_JUDGE_LEDE_EN, PLATFORM_JUDGE_TITLE_AR, PLATFORM_JUDGE_TITLE_EN } from "@/lib/platformJudgment";
import { docFrame } from "@/lib/designSystem";

/**
 * إدارة on جدول الدوام: platform judgment about each in-scope worker.
 * Title is حكم المنصة. Each card names the worker once.
 */
export default function ManagerDutyAlertsRail({
  weekStart,
  lang = "ar",
  gates,
  employees = [],
  canApplyOrdinary = false,
  onApplyOrdinary,
  onNightRemedy,
}) {
  const ar = lang === "ar";
  const { currentUser, data } = useAuth();
  const groups = useMemo(
    () => managerDutyAlertGroups(currentUser, data, weekStart, ar),
    [currentUser, data, weekStart, ar],
  );
  const pack = useMemo(
    () => attachNightDueStripCards(
      weekDutyStripAlerts(gates, { employees, ar, audience: "manager" }),
      groups,
      { ar, audience: "manager" },
    ),
    [gates, employees, groups, ar],
  );
  const grouped = useMemo(
    () => groupDutyStripByPerson(pack, { ar, audience: "manager" }),
    [pack, ar],
  );
  const stationNotes = useMemo(() => weekStationDutyNotes(gates), [gates]);
  const due = grouped.anyDue;
  const summary = dutyStripPeopleSummary(grouped, ar);
  const hasNightConsent = pack.cards.some((row) => row.gateId === "night_rotate");

  return (
    <section
      data-audience="manager"
      style={{
        ...docFrame(due ? "blocked" : "settled"),
        ...(due ? { background: "var(--nv-bad-soft)" } : {}),
        padding: "14px 14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0, color: SW.ink }}>{ar ? PLATFORM_JUDGE_TITLE_AR : PLATFORM_JUDGE_TITLE_EN}</span>
        <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.65, letterSpacing: 0 }}>{ar ? PLATFORM_JUDGE_LEDE_AR : PLATFORM_JUDGE_LEDE_EN}</span>
        {due && summary ? (
          <span style={{ fontSize: 12, color: SW.muted, letterSpacing: 0 }}>{summary}</span>
        ) : null}
      </span>
      {!due && !stationNotes.length ? (
        <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>
          {weekDutyStripEmptyCopy(ar)}
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: `1px solid ${SW.line}`, marginTop: 4 }}>
          {grouped.people.map((person) => (
            <DutyStripAlertCard
              key={person.id}
              card={person}
              ar={ar}
              onApplyOrdinary={canApplyOrdinary && onApplyOrdinary
                ? (kind) => {
                  const emp = employees.find((row) => String(row.id) === String(person.employeeId));
                  const rotate = [person.gateId, ...(person.items || []).map((row) => row.gateId)]
                    .some((id) => id === "night_rotate");
                  return onApplyOrdinary(emp, kind, rotate ? undefined : person.onDate);
                }
                : undefined}
              onNightRemedy={canApplyOrdinary && onNightRemedy
                ? (kind, extra) => {
                  const emp = employees.find((row) => String(row.id) === String(person.employeeId));
                  return onNightRemedy(emp, kind, extra);
                }
                : undefined}
            />
          ))}
          {stationNotes.length ? (
            <div
              data-station-notes="1"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                paddingTop: 12,
                borderTop: `1px solid ${SW.line}`,
                letterSpacing: 0,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: SW.ink, letterSpacing: 0 }}>
                {ar ? "مانع المحطة" : "Station block"}
              </span>
              {stationNotes.map((note) => (
                <span key={note.id} style={{ fontSize: 13, fontWeight: 600, color: SW.ink, lineHeight: 1.55, letterSpacing: 0 }}>
                  {note.title}
                </span>
              ))}
              <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.55, letterSpacing: 0 }}>
                {ar ? "يبقى على زر النشر — ليس واجباً على شخص." : "Stays on the publish control — not a duty on a person."}
              </span>
            </div>
          ) : null}
          {hasNightConsent ? (
            <Link to="/app/requests/manage" style={{ fontSize: 11, fontWeight: 600, color: SW.ink, textDecoration: "underline", textUnderlineOffset: 3 }}>
              {ar ? "افتح القرار في إدارة طلباتي" : "Open the decision in Requests"}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
