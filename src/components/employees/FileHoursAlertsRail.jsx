import React, { useMemo } from "react";
import { checkWeekPublishGates, groupDutyStripByPerson, SW, weekDutyStripAlerts } from "@/lib/shiftWeek";
import { employeeFileHoursAlerts, employeeFileVoice, isViewerOwnFile } from "@/lib/employeeFileView";
import DutyStripAlertCard from "@/components/employees/DutyStripAlertCard";
import { docFrame } from "@/lib/designSystem";
import { statusBanner } from "@/lib/platformStyles";
import { chip, SectionHead, slab } from "@/components/schedules/scheduleChrome";

const NO_CARDS = [];

/**
 * Employee presenter of the same week-check rows as حكم المنصة.
 * Section title is تنبيهاتي. Cards never name a coworker.
 * Default chrome matches platform تنبيهات (statusBanner — soft fill, no coloured top edge).
 * Pass quietEdge for جدول — soft fill + 1px line only; night_rotate / 18632 stay there.
 * Without quietEdge (employee file): omit night consent — it lives in طلباتي or الجدول only.
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
  leadNotice = null,
  /** File tab with جدول chrome: keep the file rule (night consent lives in طلباتي / الجدول). */
  omitNightConsent,
  /** (card) => node — the «افتح ›» link under each card (the day on جدولي, the row on جدول الدوام). */
  cardLinks,
  /** Today's live duty cards (dutyAlerts.dutyAlertRailCard — e.g. a late return from a flex break). */
  liveCards = NO_CARDS,
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
  /** File تنبيهاتي: 18632 / night_rotate lives in طلباتي or الجدول only — no repeat here. */
  const omitNightConsentRepeat = typeof omitNightConsent === "boolean" ? omitNightConsent : !quietEdge;
  const grouped = useMemo(() => {
    const weekCards = omitNightConsentRepeat
      ? weekPack.cards.filter((row) => row.gateId !== "night_rotate" && row.decisionId !== "18632")
      : weekPack.cards;
    const extraCards = fileAlerts.chips
      .filter((chip) => {
        if (!chip.due) return false;
        if (chip.id === "18632" || chip.decisionId === "18632") {
          if (omitNightConsentRepeat) return false;
          return !weekCards.some((row) => row.decisionId === "18632" || row.gateId === "night_rotate");
        }
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
      { cards: [...(liveCards || []).filter(Boolean), ...weekCards, ...extraCards] },
      { ar, audience },
    );
  }, [weekPack, fileAlerts, employee, ar, audience, omitNightConsentRepeat, liveCards]);
  const due = grouped.anyDue;
  /** quietEdge (جدول): one slab, hairline rows — same chrome as «التنبيهات والامتثال». */
  const railSkin = quietEdge
    ? slab
    : (due
      ? (grouped.anyBlock ? statusBanner.bad : statusBanner.warn)
      : { ...docFrame("settled"), padding: "12px 14px" });
  const count = (grouped.cards || []).length;
  const countChip = due
    ? (
      <span style={chip(grouped.anyBlock ? "bad" : "warn")}>
        {ar ? (count === 1 ? "تنبيه واحد" : count === 2 ? "تنبيهان" : `${count} تنبيهات`) : `${count} alert${count === 1 ? "" : "s"}`}
      </span>
    )
    : <span style={chip("ok")}>{ar ? "مستوفى" : "Settled"}</span>;

  return (
    <section
      data-audience={audience}
      style={{
        ...railSkin,
        ...(quietEdge ? {} : (due ? {} : { padding: "12px 14px" })),
        display: "flex",
        flexDirection: "column",
        gap: quietEdge ? 0 : 10,
      }}
    >
      {quietEdge ? (
        <SectionHead title={voice.warnings} note={due || leadNotice ? "" : voice.emptyAlert} trailing={countChip} />
      ) : (
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0, color: SW.ink }}>{voice.warnings}</span>
      )}
      {leadNotice}
      {!due ? (
        quietEdge || leadNotice ? null : <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>{voice.emptyAlert}</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: quietEdge ? 0 : 8, marginTop: quietEdge ? 0 : 2 }}>
          {grouped.people.map((person) => (
            <DutyStripAlertCard
              key={person.id}
              card={person}
              ar={ar}
              hideJudgment
              row={quietEdge}
              onApplyOrdinary={canApplyOrdinary && onApplyOrdinary
                ? (kind) => {
                  const rotate = [person.gateId, ...(person.items || []).map((row) => row.gateId)]
                    .some((id) => id === "night_rotate");
                  return onApplyOrdinary(employee, kind, rotate ? undefined : person.onDate);
                }
                : undefined}
            >
              {cardLinks ? cardLinks(person) : null}
            </DutyStripAlertCard>
          ))}
        </div>
      )}
    </section>
  );
}
