import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  employeeWeekHours,
  weekPublishState,
  weekRelativeLabel,
  weekDateKeys,
  weekRosterEmployees,
  weekStartDate,
} from "@/lib/shiftWeek";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { isViewerOwnFile, employeeFileVoice } from "@/lib/employeeFileView";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { chip, mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import DateNav from "@/components/schedules/DateNav";
import useMyDutyWeek from "@/components/schedules/myDutyWeek";
import MinistryPersonalPanel from "@/components/schedules/MinistryPersonalPanel";
import HoursOnFile from "@/components/employees/HoursOnFile";
import { dateFromKey, myRecordHref, myRosterDayHref, openLinkStyle, revealNode, rosterPersonHref } from "@/components/schedules/dutyLinks";
import useDutyCareer from "@/components/attendance/dutyCareer";
import { DutyCareerSection, DutyYearBar } from "@/components/attendance/DutyCareer";
import { windowOf } from "@/lib/dutyYears";

const FILE_DUTY_CSS = `
@media (max-width: 640px) {
  .nv-file-duty-nav { padding: 12px 14px 0 !important; }
}
`;

/**
 * «الدوام وأنظمة الوزارة» — the duty tab of the employee file.
 * The same week cards and the same personal ministry panel as «جدولي», for the person whose
 * file is open. Read-only: editing and publishing stay on جدول الدوام (manage lane).
 * Gates run on this employee alone, so no coworker's hours or alerts reach the file. On one's own
 * file a folded, read-only branch week (names and shift cells only) sits under the panel.
 */
export default function EmployeeFileDutyBoard({ employee, data, currentUser, lang = "ar" }) {
  const ar = lang === "ar";
  const { format: timeFormat } = useTimeFormat();
  const own = isViewerOwnFile(employee, currentUser);
  const voice = employeeFileVoice({ employee, currentUser, ar });
  const now = new Date();
  const { company } = useAuth() || {};
  const [searchParams] = useSearchParams();
  const askedDay = searchParams.get("day") || "";
  const focus = searchParams.get("focus") || "";
  const [weekStart, setWeekStart] = useState(() => weekStartDate(dateFromKey(askedDay) || new Date()));
  const [yearMode, setYearMode] = useState("contract");
  const [yearId, setYearId] = useState("");
  const career = useDutyCareer({ employee, data, company, ar });
  const years = career.years(yearMode);
  // Jump popover floor: the earlier of the contract anchor and the first duty record on the platform.
  const recordFloor = [career.anchor.key, career.coverage].filter(Boolean).sort()[0] || undefined;
  const coveredYears = years.filter((row) => row.covered);
  const askedYearId = dateFromKey(askedDay) ? (windowOf(years, askedDay)?.id || "") : "";
  const selectedYear = coveredYears.find((row) => row.id === (yearId || askedYearId)) || coveredYears.find((row) => row.current) || coveredYears[0] || null;
  const changeYearMode = (mode) => {
    setYearMode(mode);
    setYearId("");
  };
  // «?day=…» (search, alerts): that day's week on the cards and its year open in the record.
  useEffect(() => {
    const date = dateFromKey(askedDay);
    if (date) setWeekStart(weekStartDate(date));
    if (!date && focus !== "career") return undefined;
    const timer = window.setTimeout(() => revealNode(document.querySelector(`[data-career-day="${askedDay}"]`) || document.getElementById("duty-career"), { block: "center" }), 160);
    return () => window.clearTimeout(timer);
  }, [askedDay, focus]);
  const { laborCalendar, stationId, schedule, station, stationName, types, gates, dayRows } = useMyDutyWeek({ employee, data, weekStart, ar });
  /** Own file only: the branch week, read only — the same scope as «جدولي» (home branch). */
  const branchRoster = useMemo(() => {
    if (!own) return [];
    const sid = schedule?.stationId || stationId;
    const rows = weekRosterEmployees(schedule, hydrateEmployeesLeave(data?.employees || [], data), sid, weekDateKeys(weekStart), { homeOnly: true });
    const self = rows.find((row) => String(row.id) === String(employee?.id));
    return self ? [self, ...rows.filter((row) => row !== self)] : rows;
  }, [own, schedule, stationId, data, weekStart, employee?.id]);
  const pub = weekPublishState(schedule, weekStart);
  const published = pub.kind === "published" || pub.kind === "implicit";
  const hours = employee?.id ? employeeWeekHours(schedule, employee.id, weekStart, employee, laborCalendar) : 0;
  const shifts = dayRows.filter((row) => row.shift).length;

  const selectedKey = calendarDateKey(weekStartDate(weekStart));
  const shiftWeek = (delta) => setWeekStart(weekStartDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta * 7)));
  const move = (step) => setWeekStart((prev) => weekStartDate(new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + step * 7)));
  const pubChip = published
    ? { tone: "ok", label: ar ? "منشور" : "Published" }
    : pub.kind === "edited"
      ? { tone: "warn", label: ar ? "قيد التعديل" : "Being edited" }
      : { tone: "mute", label: ar ? "لم يُنشر بعد" : "Not published yet" };
  // Opens the same week on the roster: his own جدولي, or this person's row on جدول الدوام (الإدارة).
  const shiftsHref = own ? `/app/shifts?week=${selectedKey}` : rosterPersonHref(employee?.id, selectedKey);
  /** تنبيهات on the file → the day on جدولي (own) or the person's row on the roster week (manager). */
  const alertLinks = (card) => {
    const day = card?.onDate || card?.items?.find((row) => row?.onDate)?.onDate || "";
    const to = own ? (day ? myRosterDayHref(String(day)) : "") : rosterPersonHref(employee?.id, selectedKey);
    if (!to) return null;
    return (
      <Link to={to} style={openLinkStyle()}>
        {own ? (ar ? "افتح اليوم في جدولي ›" : "Open the day on My roster ›") : (ar ? "افتح في جدول الدوام ›" : "Open on the roster ›")}
      </Link>
    );
  };
  const firstName = String(employee?.name || "").trim().split(/\s+/)[0] || "";
  const hoursValue = Number.isInteger(hours) ? hours : Number(hours.toFixed(1));

  return (
    <div className="nv-file-duty" data-file-duty="1" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{FILE_DUTY_CSS}</style>
      <div className="nv-duty-board">
        <div className="nv-duty-col">
          <section data-file-week="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <SectionHead
              title={own ? (ar ? "أسبوعي في الجدول" : "My week on the roster") : (ar ? `أسبوع ${firstName} في الجدول` : `${firstName}'s week on the roster`)}
              note={(
                <>
                  {stationName ? `${stationName} · ` : ""}
                  <span dir="ltr" style={mono}>{hoursValue}</span>
                  {ar ? ` ساعة · ` : " h · "}
                  <span dir="ltr" style={mono}>{shifts}</span>
                  {ar ? " ورديات — الأيام في الجدول؛ هنا الأسبوع الذي تُفحص عليه الأنظمة أدناه." : " shifts — the days are on the roster; here is the week the rules below are checked on."}
                </>
              )}
              trailing={(
                <>
                  <span style={chip(pubChip.tone)}>{pubChip.label}</span>
                  <Link to={shiftsHref} data-file-roster-link="1" style={openLinkStyle()}>
                    {own ? (ar ? "افتح في جدولي ›" : "Open on My roster ›") : (ar ? "افتح في جدول الدوام ›" : "Open on the roster ›")}
                  </Link>
                </>
              )}
            />
            <div className="nv-file-duty-nav" style={{ padding: "12px 18px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
              <DateNav
                mode="week"
                ar={ar}
                value={weekStart}
                onPrev={() => move(-1)}
                onNext={() => move(1)}
                onToday={() => shiftWeek(0)}
                isCurrent={selectedKey === calendarDateKey(weekStartDate(now))}
                onPick={(picked) => setWeekStart(weekStartDate(picked))}
                min={recordFloor}
                max={career.todayKey}
                anchor={career.anchor.key || undefined}
                note={selectedKey === calendarDateKey(weekStartDate(now)) ? null : weekRelativeLabel(weekStart, now, ar)}
              />
            </div>
            {/* The day cards live in جدولي / جدول الدوام — the file keeps only the week picker that drives its ministry checks. */}
            <div style={{ height: 12 }} />
          </section>

          <MinistryPersonalPanel
            employee={employee}
            schedule={schedule}
            weekStart={weekStart}
            station={station}
            company={data}
            laborCalendar={laborCalendar}
            ar={ar}
            own={own}
            alertsLabel={voice.warnings}
          />

          <DutyYearBar
            ar={ar}
            title={own ? (ar ? "سنتي — الغياب والتأخير" : "My year — absence and lateness") : (ar ? `سنة ${firstName} — الغياب والتأخير` : `${firstName}'s year — absence and lateness`)}
            years={years}
            selected={selectedYear}
            onSelect={setYearId}
            mode={yearMode}
            onMode={changeYearMode}
            anchor={career.anchor}
            view={own ? "employee" : "manager"}
          />

          <DutyCareerSection
            ar={ar}
            title={own ? (ar ? "مسيرتي — الغياب والتأخير عبر السنوات" : "My career — absence and lateness by year") : (ar ? `مسيرة ${firstName} — الغياب والتأخير عبر السنوات` : `${firstName}'s career — absence and lateness by year`)}
            years={years}
            mode={yearMode}
            onMode={changeYearMode}
            openId={askedYearId || (focus === "career" ? (selectedYear?.id || "") : "")}
            focusDay={askedDay}
            view={own ? "employee" : "manager"}
            dayHref={own ? (day) => myRecordHref({ day: day.key }) : null}
            onDay={own ? null : (day) => {
              const date = dateFromKey(day.key);
              if (date) setWeekStart(weekStartDate(date));
              window.requestAnimationFrame?.(() => revealNode(document.querySelector("[data-file-week]"), { block: "start" }));
            }}
          />

        </div>

        <aside className="nv-duty-col nv-duty-side">
          {/* Open week checks are listed once — in «أنظمة الوزارة» beside the week; no second alerts rail. */}
          <HoursOnFile employee={employee} data={data} lang={lang} embedded />
        </aside>
      </div>
    </div>
  );
}
