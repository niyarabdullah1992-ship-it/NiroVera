import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { toWesternDigits } from "@/lib/dateFormat";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { attRightHint } from "@/lib/rightHints.att.js";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import RightHint from "@/components/shared/RightHint";
import { ManualPunchRequestBox } from "@/components/attendance/CheckInOutCard";
import { isoDay, monthTotals, myDutyDay, rowsByDateKey, useMyAttendanceRange } from "@/components/attendance/myDutyDays";
import useDutyCareer from "@/components/attendance/dutyCareer";
import { dutyLabel } from "@/components/schedules/dutyStatus";
import { fileDutyHref } from "@/components/schedules/dutyLinks";

const MONO = { fontFamily: "'IBM Plex Mono', monospace" };

/**
 * The viewer's own days for the month the operational calendar shows — the same derivation the old
 * «سجلي» page used (useMyAttendanceRange → myDutyDay → monthTotals). No new rule: the calendar only reads.
 */
export function useMyMonthDays({ employee, company, data, year, month, ar = true }) {
  const todayKey = toRiyadhDateKey();
  const calendar = useMemo(() => laborCalendarOf(data), [data]);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDate = isoDay(new Date(year, month, 1));
  const endDate = isoDay(new Date(year, month, daysInMonth));
  const { rows } = useMyAttendanceRange({ employee, company, data, startDate, endDate });
  const byDate = useMemo(() => rowsByDateKey(rows), [rows]);
  const days = useMemo(() => {
    if (!employee?.id) return [];
    return Array.from({ length: daysInMonth }, (_, index) => {
      const key = isoDay(new Date(year, month, index + 1));
      return myDutyDay({ employee, data, row: byDate[key], key, todayKey, calendar, ar });
    });
  }, [employee, data, byDate, daysInMonth, year, month, todayKey, calendar, ar]);
  const byKey = useMemo(() => Object.fromEntries(days.map((day) => [day.key, day])), [days]);
  const totals = useMemo(() => monthTotals(days.filter((day) => day.key <= todayKey)), [days, todayKey]);
  return { days, byKey, totals, todayKey };
}

/** A day of mine the calendar cell marks: only problems (absent, late) — nothing on a clean day. */
export function myCellMark(day, ar = true) {
  if (!day) return null;
  if (day.status === "absent") return { kind: "absent", text: ar ? "غبت" : "Absent" };
  if (day.lateMinutes > 0 && day.inAt) return { kind: "late", text: ar ? `تأخرت ${day.lateMinutes} د` : `Late ${day.lateMinutes}m` };
  return null;
}

function dayWordAr(n) {
  const value = Number(n) || 0;
  if (value === 1) return "يوم";
  if (value === 2) return "يومين";
  if (value >= 3 && value <= 10) return "أيام";
  return "يوماً";
}

function flagChip(tone) {
  const map = {
    bad: { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)" },
    warn: { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)", border: "1px solid var(--nv-warn-line)" },
  };
  return { ...map[tone], fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999, whiteSpace: "nowrap" };
}

/**
 * «شهري» on the operational calendar — what the old «سجلي» held that the calendar did not:
 * my attendance days against the schedule, my absences, my lateness (minutes and days), leave and
 * manual approvals for the month in view, the ⚖ rights on absence (Art. 80) and lateness (Annex 1),
 * and, for the picked day, my own punches with «اطلب تصحيح». One calm line; chips only for problems.
 */
export default function MyMonthLine({ me, company, data, year, month, selectedDay = 0, monthName = "", mine, ar = true }) {
  const { format: timeFormat } = useTimeFormat();
  const career = useDutyCareer({ employee: me, data, company, ar });
  const [fixKey, setFixKey] = useState("");
  const { totals, byKey, days, todayKey } = mine;
  const contractYear = career.years("contract").find((row) => row.covered && row.current) || null;
  const art80 = contractYear?.art80 || null;
  const selectedKey = selectedDay > 0 ? isoDay(new Date(year, month, selectedDay)) : "";
  const myDay = selectedKey ? byKey[selectedKey] || null : null;
  const lastLate = days.filter((day) => day.key <= todayKey && day.lateMinutes > 0 && day.inAt).pop() || null;
  const lateFor = myDay && myDay.lateMinutes > 0 && myDay.inAt ? myDay : lastLate;
  const below = totals.scheduled > 0 && totals.attended < totals.scheduled;
  const timeOf = (iso) => (iso ? toWesternDigits(formatTime(iso, timeFormat, "en-GB")) : "—");
  const canFix = (day) => !!day && day.key <= todayKey && !["leave", "holiday", "upcoming"].includes(day.status)
    && (!!day.shift || !!day.inAt || ["absent", "pending", "open"].includes(day.status));
  const fixOpen = !!myDay && fixKey === myDay.key && canFix(myDay);

  const n = (value) => <strong dir="ltr" style={{ ...MONO, fontSize: 13.5, color: "var(--nv-ink)", fontWeight: 600 }}>{value}</strong>;
  const sep = <span aria-hidden style={{ color: "var(--nv-muted)" }}>·</span>;

  return (
    <section data-my-month-line="1" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.9, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? `شهري — ${monthName}` : `My month — ${monthName}`}</span>
        {sep}
        <span>{ar ? "حضور " : "Attended "}{n(totals.attended)}{ar ? ` من ${totals.scheduled}` : ` of ${totals.scheduled}`}</span>
        {below ? <span data-flag="below" style={flagChip("warn")}>{ar ? "أقل من المجدول" : "Below schedule"}</span> : null}
        {sep}
        <span>{ar ? "غياب " : "Absent "}{n(totals.absent)}{ar ? ` ${dayWordAr(totals.absent)}` : " days"}</span>
        {sep}
        <span>
          {ar ? "تأخير " : "Late "}{n(totals.lateMinutes)}{ar ? " دقيقة" : " min"}
          {totals.lateDays ? (ar ? <> في {n(totals.lateDays)} {dayWordAr(totals.lateDays)}</> : <> on {n(totals.lateDays)} days</>) : null}
        </span>
        {totals.lateMinutes ? <span data-flag="late" style={flagChip("warn")}>{ar ? "تأخير مسجّل" : "Lateness on file"}</span> : null}
        {totals.leave ? <>{sep}<span>{ar ? "إجازة " : "Leave "}{n(totals.leave)}</span></> : null}
        {totals.manual ? <>{sep}<span>{ar ? "اعتماد يدوي " : "Manual "}{n(totals.manual)}</span></> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
        <span>{ar ? "الأرقام نفسها التي يقرؤها المسير — التأخير من بداية الوردية المنشورة، والإجازة خارج الحساب." : "The figures payroll reads — lateness from the published shift start; leave is outside the count."}</span>
        {art80 ? (
          <RightHint ar={ar} hint={attRightHint("absence", { days: art80.intermittent.value, streak: art80.consecutive.value }, { view: "employee", ar, today: todayKey, employee: me })} />
        ) : null}
        {lateFor ? (
          <RightHint ar={ar} hint={attRightHint("lateness", { date: lateFor.key, minutes: lateFor.lateMinutes }, { view: "employee", ar, today: todayKey, employee: me })} />
        ) : null}
        {me?.id ? (
          <Link to={fileDutyHref(me.id, { focus: "career" })} style={{ color: "var(--nv-ok-ink)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
            {ar ? "سنتي ومسيرتي في ملفي ›" : "My year and career on my file ›"}
          </Link>
        ) : null}
      </div>
      {myDay && myDay.status !== "upcoming" ? (
        <div data-my-day={myDay.key} style={{ borderTop: "1px solid var(--nv-line2, #EEF2F7)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
            <span style={{ fontWeight: 600, color: "var(--nv-ink)" }}>{ar ? `يومي ${selectedDay}` : `My day ${selectedDay}`}</span>
            {["absent", "late", "open"].includes(myDay.status)
              ? <span style={flagChip(myDay.status === "absent" ? "bad" : "warn")}>{dutyLabel(myDay.status, ar)}</span>
              : <span>{dutyLabel(myDay.status, ar)}</span>}
            {sep}
            <span>{ar ? "حضور " : "In "}<span dir="ltr" style={MONO}>{timeOf(myDay.inAt)}</span></span>
            {sep}
            <span>{ar ? "انصراف " : "Out "}<span dir="ltr" style={MONO}>{timeOf(myDay.outAt)}</span></span>
            {myDay.note ? <>{sep}<span>{myDay.note}</span></> : null}
            {canFix(myDay) ? (
              <button
                type="button"
                data-fix-day={myDay.key}
                aria-expanded={fixOpen}
                onClick={() => setFixKey(fixOpen ? "" : myDay.key)}
                style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 30, padding: "0 14px", border: "none", borderRadius: DS_CONTROL_RADIUS, background: fixOpen ? "var(--nv-navy)" : "var(--nv-accent)", color: "var(--nv-btn-ink, #fff)", cursor: "pointer", whiteSpace: "nowrap", marginInlineStart: "auto" }}
              >
                {fixOpen ? (ar ? "إغلاق الطلب" : "Close request") : (ar ? "اطلب تصحيح" : "Ask for a correction")}
              </button>
            ) : null}
          </div>
          {fixOpen ? (
            <ManualPunchRequestBox
              key={myDay.key}
              ar={ar}
              date={myDay.key}
              attendance={myDay.row}
              companyId={company?.id}
              employee={me}
              onLeave={myDay.status === "leave" || myDay.status === "holiday"}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
