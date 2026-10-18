import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dutyDayOf } from "@/lib/attendanceDerivations";
import { dutyAlertRailCard, lateReturnAlertOf } from "@/lib/dutyAlerts";
import { isStatutoryOffDay } from "@/lib/leaveTypes";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { toWesternDigits } from "@/lib/dateFormat";
import { weekStartDate, weekdayLabel } from "@/lib/shiftWeek";
import { formatShiftHm } from "@/lib/shiftDerivations";
import CheckInOutCard, { breakBand, workedClock } from "@/components/attendance/CheckInOutCard";
import { resolveDayBreaks } from "@/lib/actualDuty";
import { AttendanceProofChain, punchChainFromAttendance } from "@/components/attendance/AttendanceTrustChrome";
import { DutyBoard, DutyHeadline, DutyNumber, DutyTile, DutyTiles } from "@/components/schedules/DutyTiles";
import DutySide, { dutyHeatCopy } from "@/components/schedules/DutySide";
import useMyDutyWeek, { findNextShift, inLabel } from "@/components/schedules/myDutyWeek";
import { mono, quietAction, slab } from "@/components/schedules/scheduleChrome";
import { dutyLabel, dutyTone } from "@/components/schedules/dutyStatus";
import AttendanceMinistryPanel from "@/components/attendance/AttendanceMinistryPanel";

/**
 * «بصمتي — اليوم»: what do I do now?
 * Tiles: today's shift · my status · my hours today. Main: the punch card and the next shift.
 * Side: تنبيهاتي → توعية → سلسلة البصمة (compact).
 */
export default function MyPunchPage({ me, currentUser, company, data, t, lang = "ar" }) {
  const ar = lang === "ar";
  const { format: timeFormat } = useTimeFormat();
  const [punchAtt, setPunchAtt] = useState(null);
  const [manualAsk, setManualAsk] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const now = new Date(tick);
  const todayKey = toRiyadhDateKey();
  const [weekStart] = useState(() => weekStartDate(new Date()));
  const person = me || currentUser;
  const week = useMyDutyWeek({ employee: person, data, weekStart, ar });
  const heatCopy = dutyHeatCopy({ weekStart, dayRows: week.dayRows, ar, now });

  // The card's duty day: today, last night's overnight shift after midnight, or — just after its
  // checkout — that closed night (never the next day's «لا وردية» as a broken chain).
  const dutyRows = punchAtt ? [{ employeeId: currentUser?.id, ...punchAtt }, ...(data?.personalAttendance || [])] : null;
  const duty = dutyDayOf(data, currentUser, now, dutyRows, { includeClosed: true });
  const shift = duty.shift;
  const dutyKey = duty.dateKey || todayKey;
  const onLeave = !!isStatutoryOffDay(currentUser, dutyKey, week.laborCalendar);
  const chain = punchChainFromAttendance(punchAtt, { scheduled: !!shift, onLeave });
  // «تنبيهاتي»: a late return from a flex break — the manager queue's reading, a warn, not a breach.
  const liveCards = useMemo(() => {
    const row = lateReturnAlertOf({ employee: person, row: punchAtt, data, now: new Date(tick) });
    return row ? [dutyAlertRailCard(row, { employee: person, ar })] : [];
  }, [person, punchAtt, data, tick, ar]);
  const clock = (hm) => formatShiftHm(hm, timeFormat, lang);

  const inAt = punchAtt?.check_in_at || punchAtt?.checkInAt || null;
  const outAt = punchAtt?.check_out_at || punchAtt?.checkOutAt || null;
  const lateMinutes = Number(punchAtt?.late_minutes || punchAtt?.lateMinutes || 0);
  const isLate = punchAtt?.status === "late" || lateMinutes > 0;
  const status = onLeave && !inAt
    ? "leave"
    : !shift && !inAt
      ? "rest"
      : !inAt
        ? "notStarted"
        : outAt
          ? "out"
          : isLate ? "late" : "present";
  const statusTone = { leave: "leave", rest: "rest", notStarted: "mute", late: "warn" }[status] || "ok";
  const timeOf = (iso) => (iso ? toWesternDigits(formatTime(iso, timeFormat, "en-GB")) : "—");
  const statusNote = status === "leave"
    ? (ar ? "إجازة معتمدة — لا بصمة ولا يُحتسب غياب." : "Approved leave — no punch, no absence.")
    : status === "rest"
      ? (ar ? "لا وردية منشورة لك اليوم." : "No published shift for you today.")
      : status === "notStarted"
        ? (ar ? "سجّل حضورك من الزر عند بدء ورديتك." : "Punch in with the button when your shift starts.")
        : (
          <>
            {ar ? "حضور " : "In "}
            <span dir="ltr" style={mono}>{timeOf(inAt)}</span>
            {outAt ? (
              <>
                {ar ? " · انصراف " : " · out "}
                <span dir="ltr" style={mono}>{timeOf(outAt)}</span>
              </>
            ) : null}
            {isLate ? (
              <>
                {" · "}
                <span dir="ltr" style={mono}>{lateMinutes}</span>
                {ar ? " دقيقة تأخير" : " min late"}
              </>
            ) : null}
          </>
        );

  const band = breakBand(shift);
  // A flex shift subtracts the break as punched (or assumed) — the same reading as the card.
  const flexDay = resolveDayBreaks({ shift, breaks: punchAtt?.breaks, checkIn: inAt, checkOut: outAt, now: new Date(tick), onDate: dutyKey, company: data, employee: person });
  const worked = workedClock(inAt, outAt, tick, band, flexDay.flex ? flexDay : null);
  const targetLabel = band?.targetLabel || "8:00";
  const targetMin = band?.targetMin || 480;
  const workedPct = Math.min(100, Math.round((worked.minutes / targetMin) * 100));
  const hoursTone = !inAt ? "mute" : outAt ? "ok" : "warn";

  const next = findNextShift({ me: person, schedule: week.schedule, ar, laborCalendar: week.laborCalendar, now, afterKey: todayKey });
  /** Calendar days, not hours: tomorrow's night shift reads «غداً». */
  const nextDays = next ? Math.round((new Date(next.date.getFullYear(), next.date.getMonth(), next.date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000) : 0;
  const nextWhen = !next
    ? ""
    : nextDays <= 0
      ? inLabel(next.start.getTime() - now.getTime(), ar)
      : nextDays === 1
        ? (ar ? "غداً" : "tomorrow")
        : nextDays === 2
          ? (ar ? "بعد يومين" : "in 2 days")
          : (ar ? `بعد ${nextDays} أيام` : `in ${nextDays} days`);

  return (
    <>

      <DutyBoard
        main={(
          <>
            <CheckInOutCard currentUser={currentUser} company={company} t={t} onStatusChange={setPunchAtt} manualAsk={manualAsk} dockOnPhone />
            <section data-next-shift="1" style={{ ...slab, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "var(--nv-muted)", whiteSpace: "nowrap" }}>{ar ? "ورديتك القادمة:" : "Your next shift:"}</span>
              {next ? (
                <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: 6, fontSize: 13.5, color: "var(--nv-ink)" }}>
                  <strong style={{ fontWeight: 700 }}>{next.shift.label}</strong>
                  <span>·</span>
                  <span>{weekdayLabel(next.date.getDay(), ar)}</span>
                  <span dir="ltr" style={{ ...mono, fontWeight: 700 }}>{clock(next.shift.start)} – {clock(next.shift.end)}</span>
                  <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>· {nextWhen}</span>
                </span>
              ) : (
                <span style={{ fontSize: 13, color: "var(--nv-muted)" }}>{ar ? "لا وردية منشورة في الأسبوعين القادمين" : "No published shift in the next two weeks"}</span>
              )}
              <Link to="/app/requests?kind=permission" style={quietAction({ marginInlineStart: "auto", color: "var(--nv-ok-ink)" })}>{ar ? "استئذان ›" : "Permission ›"}</Link>
              <Link to="/app/shifts" style={quietAction({ color: "var(--nv-ok-ink)" })}>{ar ? "جدولي ›" : "My roster ›"}</Link>
            </section>
          </>
        )}
        side={(
          <DutySide
            ar={ar}
            lang={lang}
            employee={person}
            schedule={week.schedule}
            weekStart={weekStart}
            currentUser={currentUser}
            laborCalendar={week.laborCalendar}
            gates={week.gates}
            station={week.station}
            data={data}
            heatCopy={heatCopy}
            awareness={false}
            railProps={{ liveCards }}
          >
            <AttendanceProofChain ar={ar} {...chain} compact onManual={() => setManualAsk((n) => n + 1)} />
            {/* «وقت راحتك» lands here from the punch card (CheckInOutCard portals into this slot). */}
          </DutySide>
        )}
      />
      <div style={{ marginTop: 14 }}>
        <AttendanceMinistryPanel data={data} employee={person} lane="employee" ar={ar} />
      </div>
      <div className="nv-punch-dock-spacer" aria-hidden />
    </>
  );
}
