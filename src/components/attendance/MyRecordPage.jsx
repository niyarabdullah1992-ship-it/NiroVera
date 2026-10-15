import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { toWesternDigits } from "@/lib/dateFormat";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { weekStartDate, weekdayLabel } from "@/lib/shiftWeek";
import { formatShiftHm } from "@/lib/shiftDerivations";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { ManualPunchRequestBox } from "@/components/attendance/CheckInOutCard";
import { isoDay, monthTotals, myDutyDay, rowsByDateKey, useMyAttendanceRange } from "@/components/attendance/myDutyDays";
import { DutyBoard, DutyNumber, DutyTile, DutyTiles } from "@/components/schedules/DutyTiles";
import DutySide, { dutyHeatCopy } from "@/components/schedules/DutySide";
import useMyDutyWeek from "@/components/schedules/myDutyWeek";
import { Collapsible, mono, quietAction, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { DUTY_LEGEND, dutyChip, dutyLabel, dutyStatus, dutyTone } from "@/components/schedules/dutyStatus";
import { dateFromKey, myRecordHref, revealNode } from "@/components/schedules/dutyLinks";
import DateNav from "@/components/schedules/DateNav";
import useDutyCareer from "@/components/attendance/dutyCareer";
import { DutyCareerSection, DutyYearBar } from "@/components/attendance/DutyCareer";
import { windowOf } from "@/lib/dutyYears";

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const RECORD_CSS = `
.nv-rec-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; padding: 12px 18px 6px; }
.nv-rec-wd { font-size: 11px; font-weight: 600; color: var(--nv-muted); text-align: center; padding: 2px 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nv-rec-cell { min-height: 78px; }
@media (max-width: 640px) {
  .nv-rec-grid { gap: 4px; padding: 10px 10px 4px; }
  .nv-rec-cell { min-height: 50px; padding: 6px 4px !important; align-items: center !important; }
  .nv-rec-cell .nv-rec-word, .nv-rec-cell .nv-rec-late { display: none !important; }
  .nv-rec-cell .nv-rec-dot { display: block !important; }
  .nv-rec-wd { font-size: 10px; }
  .nv-rec-facts { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
`;

/** Quiet surfaces (rest, scheduled, no roster) stay white with a hairline; statuses take their soft fill. */
function cellSurface(status) {
  if (["upcoming", "unscheduled"].includes(status)) {
    return { background: "var(--nv-card)", border: `1px ${status === "upcoming" ? "dashed" : "solid"} var(--nv-line)`, color: "var(--nv-muted)" };
  }
  const tone = dutyTone(status);
  return { background: tone.soft, border: `1px solid ${tone.line}`, color: tone.ink };
}

/**
 * «سجلي — الشهر»: what happened in my duty this month?
 * Tiles: attendance days · late minutes · absence / leave. Main: my month — each day coloured by
 * its status; a day opens its punches, shift and note, with «اطلب تصحيح» (the punch card's own
 * manual-record / checkout-fix request, dated to that day). Folded below: the month register.
 */
export default function MyRecordPage({ me, currentUser, company, data, lang = "ar" }) {
  const ar = lang === "ar";
  const { format: timeFormat } = useTimeFormat();
  const person = me || currentUser;
  const todayKey = toRiyadhDateKey();
  const now = new Date();
  const [searchParams] = useSearchParams();
  const askedDay = searchParams.get("day") || "";
  const focus = searchParams.get("focus") || "";
  const askedDate = dateFromKey(askedDay);
  const [year, setYear] = useState(askedDate ? askedDate.getFullYear() : now.getFullYear());
  const [month, setMonth] = useState(askedDate ? askedDate.getMonth() : now.getMonth());
  const [selectedKey, setSelectedKey] = useState(askedDate ? askedDay : todayKey);
  const [yearMode, setYearMode] = useState("contract");
  const [yearId, setYearId] = useState("");
  const [fixOpen, setFixOpen] = useState(false);
  const [weekStart] = useState(() => weekStartDate(new Date()));
  const week = useMyDutyWeek({ employee: person, data, weekStart, ar });
  const career = useDutyCareer({ employee: person, data, company, ar });
  const years = career.years(yearMode);
  // Jump popover floor: the earlier of the contract anchor and the first duty record on the platform.
  const recordFloor = [career.anchor.key, career.coverage].filter(Boolean).sort()[0] || undefined;
  const coveredYears = years.filter((row) => row.covered);
  const selectedYear = coveredYears.find((row) => row.id === yearId) || coveredYears.find((row) => row.current) || coveredYears[0] || null;
  const yearTotals = selectedYear?.tally || null;
  const yearWord = selectedYear
    ? (yearMode === "calendar" ? (ar ? `سنة ${selectedYear.year}` : `${selectedYear.year}`) : selectedYear.current ? (ar ? "السنة العقدية الحالية" : "this contract year") : (ar ? `السنة العقدية ${selectedYear.index + 1}` : `contract year ${selectedYear.index + 1}`))
    : "";
  const askedYearId = askedDate ? (windowOf(years, askedDay)?.id || "") : "";

  // A search result or a career row opened «?day=…»: that month, that day open.
  useEffect(() => {
    const date = dateFromKey(askedDay);
    if (!date) return;
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setSelectedKey(askedDay);
    setFixOpen(false);
    window.requestAnimationFrame?.(() => revealNode(document.querySelector(`[data-day-detail="${askedDay}"]`) || document.querySelector("[data-my-month]")));
  }, [askedDay]);
  useEffect(() => {
    if (focus !== "career") return;
    const timer = window.setTimeout(() => revealNode(document.getElementById("duty-career"), { block: "start" }), 120);
    return () => window.clearTimeout(timer);
  }, [focus]);
  const changeYearMode = (mode) => {
    setYearMode(mode);
    setYearId("");
  };
  const heatCopy = dutyHeatCopy({ weekStart, dayRows: week.dayRows, ar, now });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDate = isoDay(new Date(year, month, 1));
  const endDate = isoDay(new Date(year, month, daysInMonth));
  const { rows } = useMyAttendanceRange({ employee: person, company, data, startDate, endDate });
  const byDate = useMemo(() => rowsByDateKey(rows), [rows]);

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const key = isoDay(date);
    return { ...myDutyDay({ employee: person, data, row: byDate[key], key, todayKey, calendar: week.laborCalendar, ar }), date };
  }), [daysInMonth, year, month, person, data, byDate, todayKey, week.laborCalendar, ar]);
  const totals = monthTotals(days.filter((day) => day.key <= todayKey));
  const lead = new Date(year, month, 1).getDay();
  const thisMonth = year === now.getFullYear() && month === now.getMonth();
  const monthName = `${(ar ? MONTHS_AR : MONTHS_EN)[month]} ${year}`;
  const monthWord = thisMonth ? (ar ? "هذا الشهر" : "This month") : monthName;
  const selected = days.find((day) => day.key === selectedKey) || null;

  const goMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth() ? todayKey : isoDay(next));
    setFixOpen(false);
  };
  const timeOf = (iso) => (iso ? toWesternDigits(formatTime(iso, timeFormat, "en-GB")) : "—");
  const clock = (hm) => formatShiftHm(hm, timeFormat, lang);
  const dayTitle = (day) => `${weekdayLabel(day.date.getDay(), ar)} ${day.date.getDate()} ${(ar ? MONTHS_AR : MONTHS_EN)[day.date.getMonth()]}`;
  const canFix = (day) => !!day && day.key <= todayKey && !["leave", "holiday", "upcoming"].includes(day.status)
    && (!!day.shift || !!day.inAt || ["absent", "pending", "open"].includes(day.status));

  const absBase = yearTotals || totals;
  const absTone = absBase.absent ? "bad" : absBase.leave ? "leave" : "ok";
  const past = days.filter((day) => day.key <= todayKey).slice().reverse();

  return (
    <>
      <style>{RECORD_CSS}</style>
      <DutyYearBar
        ar={ar}
        title={ar ? "سنتي — الغياب والتأخير" : "My year — absence and lateness"}
        years={years}
        selected={selectedYear}
        onSelect={setYearId}
        mode={yearMode}
        onMode={changeYearMode}
        anchor={career.anchor}
      />
      <DutyTiles>
        <DutyTile
          dataKey="attended"
          tone={yearTotals ? (yearTotals.scheduled && yearTotals.attended < yearTotals.scheduled ? "warn" : "ok") : (totals.scheduled && totals.attended < totals.scheduled ? "warn" : "ok")}
          label={ar ? `أيام الحضور — ${yearWord || monthWord}` : `Days attended — ${yearWord || monthWord}`}
          note={ar
            ? <>من <span dir="ltr" style={mono}>{yearTotals ? yearTotals.scheduled : totals.scheduled}</span> {dayWordAr(yearTotals ? yearTotals.scheduled : totals.scheduled, true)} حتى اليوم · {monthWord}: <span dir="ltr" style={mono}>{totals.attended}</span> · إجازة معتمدة: <span dir="ltr" style={mono}>{(yearTotals || totals).leave + (yearTotals ? yearTotals.holiday : 0)}</span> {"(خارج حساب الحضور)"}</>
            : <>of <span style={mono}>{yearTotals ? yearTotals.scheduled : totals.scheduled}</span> scheduled days so far · {monthWord}: <span style={mono}>{totals.attended}</span></>}
        >
          <DutyNumber value={yearTotals ? yearTotals.attended : totals.attended} unit={ar ? dayWordAr(yearTotals ? yearTotals.attended : totals.attended) : "days"} />
        </DutyTile>
        <DutyTile
          dataKey="late"
          tone={(yearTotals || totals).lateMinutes ? "warn" : "ok"}
          label={ar ? `التأخير — ${yearWord || monthWord}` : `Lateness — ${yearWord || monthWord}`}
          note={(yearTotals || totals).lateDays
            ? (ar ? <>في <span dir="ltr" style={mono}>{(yearTotals || totals).lateDays}</span> {dayWordAr((yearTotals || totals).lateDays)} — من بداية الوردية المنشورة · {monthWord}: <span dir="ltr" style={mono}>{totals.lateMinutes}</span> د</> : `on ${(yearTotals || totals).lateDays} days · ${monthWord}: ${totals.lateMinutes} min`)
            : (ar ? <>لا تأخير مسجّل — تُحسب من جديد كل سنة</> : "No lateness on file — restarts every year")}
        >
          <DutyNumber value={(yearTotals || totals).lateMinutes} unit={ar ? "دقيقة" : "min"} />
        </DutyTile>
      </DutyTiles>

      <DutyBoard
        main={(
          <>
            <section data-my-month="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
              <SectionHead
                title={ar ? "شهري" : "My month"}
                note={ar ? "كل يوم بلون حالته. اضغط يوماً لترى بصماته وورديته." : "Each day in its status colour. Tap a day for its punches and shift."}
                trailing={(
                  <DateNav
                    mode="month"
                    ar={ar}
                    value={new Date(year, month, 1)}
                    onPrev={() => goMonth(-1)}
                    onNext={() => goMonth(1)}
                    onToday={() => goMonth((now.getFullYear() - year) * 12 + (now.getMonth() - month))}
                    isCurrent={thisMonth}
                    min={recordFloor}
                    max={todayKey}
                    anchor={career.anchor.key || undefined}
                    onPick={(picked) => {
                      const delta = (picked.getFullYear() - year) * 12 + (picked.getMonth() - month);
                      if (delta) goMonth(delta);
                    }}
                  />
                )}
              />
              <div className="nv-rec-grid" role="grid" aria-label={monthName}>
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
                  <span key={`wd${wd}`} className="nv-rec-wd" role="columnheader">{weekdayLabel(wd, ar)}</span>
                ))}
                {Array.from({ length: lead }, (_, index) => <span key={`lead${index}`} aria-hidden />)}
                {days.map((day) => {
                  const on = day.key === selectedKey;
                  const today = day.key === todayKey;
                  const surface = cellSurface(day.status);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      className="nv-rec-cell"
                      data-day={day.key}
                      data-status={day.status}
                      aria-pressed={on}
                      title={`${dayLabel(day, ar)}${day.note ? ` — ${day.note}` : ""}`}
                      onClick={() => { setSelectedKey(day.key); setFixOpen(false); }}
                      style={{
                        fontFamily: "inherit",
                        textAlign: "start",
                        cursor: "pointer",
                        borderRadius: DS_CONTROL_RADIUS,
                        padding: "8px 8px 7px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 4,
                        minWidth: 0,
                        boxSizing: "border-box",
                        ...surface,
                        outline: on ? "2px solid var(--nv-navy)" : "none",
                        outlineOffset: 1,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 5, width: "100%" }}>
                        <span dir="ltr" style={{ ...mono, fontSize: 14, fontWeight: today ? 800 : 600, color: day.status === "upcoming" || day.status === "unscheduled" ? "var(--nv-muted)" : "var(--nv-ink)", textDecoration: today ? "underline" : "none", textUnderlineOffset: 3 }}>{day.date.getDate()}</span>
                        <span className="nv-rec-dot" aria-hidden style={{ display: "none", width: 6, height: 6, borderRadius: 999, background: dutyTone(day.status).fill, marginInlineStart: "auto" }} />
                      </span>
                      <span className="nv-rec-word" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                        {dayLabel(day, ar)}
                      </span>
                      {day.lateMinutes > 0 && day.inAt ? (
                        <span className="nv-rec-late" style={{ fontSize: 10.5, color: "var(--nv-warn-ink)", whiteSpace: "nowrap" }}>
                          <span dir="ltr" style={mono}>+{day.lateMinutes}</span> {ar ? "د" : "min"}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: "8px 18px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {DUTY_LEGEND.map((key) => (
                  <span key={key} style={dutyChip(key, { height: 22, fontSize: 10.5 })}>{dutyLabel(key, ar)}</span>
                ))}
                <span style={{ ...dutyChip("rest", { height: 22, fontSize: 10.5, background: "var(--nv-card)", border: "1px dashed var(--nv-line)", color: "var(--nv-muted)" }) }}>{dutyLabel("upcoming", ar)}</span>
              </div>

              {selected ? (
                <div data-day-detail={selected.key} style={{ borderTop: "1px solid var(--nv-line2, #EEF2F7)", padding: "14px 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{dayTitle(selected)}</strong>
                    <span style={dutyChip(selected.status)}>{dayLabel(selected, ar)}</span>
                    {selected.key === todayKey ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "اليوم" : "Today"}</span> : null}
                  </div>
                  <div className="nv-rec-facts" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                    {[
                      [ar ? "الوردية" : "Shift", selected.shift ? (
                        <>
                          {selected.shift.label}{" "}
                          <span dir="ltr" style={mono}>{clock(selected.shift.start)} – {clock(selected.shift.end)}</span>
                        </>
                      ) : (selected.off ? (ar ? selected.off.labelAr || "إجازة" : selected.off.labelEn || "Leave") : "—")],
                      [ar ? "الحضور" : "In", <span key="in" dir="ltr" style={mono}>{timeOf(selected.inAt)}</span>],
                      [ar ? "الانصراف" : "Out", <span key="out" dir="ltr" style={mono}>{timeOf(selected.outAt)}</span>],
                      [ar ? "التأخير" : "Late", selected.lateMinutes && selected.inAt ? <><span dir="ltr" style={mono}>{selected.lateMinutes}</span> {ar ? "دقيقة" : "min"}</> : "—"],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: "var(--nv-soft, #F7F8FA)", border: "1px solid var(--nv-line2, #EEF2F7)", borderRadius: DS_CONTROL_RADIUS, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  {selected.note ? <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{ar ? "ملاحظة: " : "Note: "}{selected.note}</span> : null}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {canFix(selected) ? (
                      <button
                        type="button"
                        data-fix-day={selected.key}
                        onClick={() => setFixOpen((open) => !open)}
                        aria-expanded={fixOpen}
                        style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, height: 34, padding: "0 16px", border: "none", borderRadius: DS_CONTROL_RADIUS, background: fixOpen ? "var(--nv-navy)" : "var(--nv-accent)", color: "var(--nv-btn-ink, #fff)", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {fixOpen ? (ar ? "إغلاق الطلب" : "Close request") : (ar ? "اطلب تصحيح" : "Ask for a correction")}
                      </button>
                    ) : null}
                    <Link to="/app/requests" style={quietAction({ color: "var(--nv-muted)", fontSize: 12 })}>{ar ? "طلباتي" : "My requests"}</Link>
                  </div>
                  {fixOpen && canFix(selected) ? (
                    <ManualPunchRequestBox
                      key={selected.key}
                      ar={ar}
                      date={selected.key}
                      attendance={selected.row}
                      companyId={company?.id}
                      employee={person}
                      onLeave={selected.status === "leave" || selected.status === "holiday"}
                    />
                  ) : null}
                </div>
              ) : null}
            </section>

            <section style={{ ...slab, overflow: "hidden" }}>
              <Collapsible
                dataAttr="month-register"
                title={ar ? "كشف الشهر — كما يقرؤه المسير" : "Month register — as payroll reads it"}
                note={ar
                  ? `${totals.lateDays} تأخير · ${totals.manual} اعتماد يدوي · ${totals.absent} غياب — التأخير يُقاس من بداية الوردية المنشورة.`
                  : `${totals.lateDays} late · ${totals.manual} manual · ${totals.absent} absent — lateness from the published shift start.`}
              >
                <div className="nv-att-mine-grid" style={{ padding: "8px 18px", fontSize: 11, color: "var(--nv-muted)", background: "var(--nv-soft, #F7F8FA)", borderBottom: "1px solid var(--nv-line2)" }}>
                  <span>{ar ? "اليوم" : "Day"}</span>
                  <span>{ar ? "الوردية" : "Shift"}</span>
                  <span>{ar ? "حضور" : "In"}</span>
                  <span>{ar ? "انصراف" : "Out"}</span>
                  <span>{ar ? "الحالة" : "Status"}</span>
                </div>
                {past.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    className="nv-att-mine-grid"
                    onClick={() => { setSelectedKey(day.key); setFixOpen(false); }}
                    title={day.note || undefined}
                    style={{ fontFamily: "inherit", textAlign: "start", width: "100%", border: "none", background: day.key === selectedKey ? "var(--nv-hover, #F2F5F3)" : "transparent", cursor: "pointer", padding: "9px 18px", alignItems: "center", borderBottom: "1px solid var(--nv-line2)" }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink)", whiteSpace: "nowrap" }}>
                      {weekdayLabel(day.date.getDay(), ar)} <span dir="ltr" style={mono}>{day.date.getDate()}</span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--nv-ink)" }}>{day.shift?.label || "—"}</span>
                    <span dir="ltr" style={{ ...mono, fontSize: 12, color: "var(--nv-ink)", textAlign: "end" }}>{timeOf(day.inAt)}</span>
                    <span dir="ltr" style={{ ...mono, fontSize: 12, color: "var(--nv-ink)", textAlign: "end" }}>{timeOf(day.outAt)}</span>
                    <span style={dutyChip(day.status, { height: 22, fontSize: 10.5, width: "fit-content" })}>{dayLabel(day, ar)}</span>
                  </button>
                ))}
              </Collapsible>
            </section>

            <DutyCareerSection
              ar={ar}
              title={ar ? "مسيرتي — الغياب والتأخير عبر السنوات" : "My career — absence and lateness by year"}
              years={years}
              mode={yearMode}
              onMode={changeYearMode}
              openId={askedYearId || (focus === "career" ? (selectedYear?.id || "") : "")}
              focusDay={askedDay}
              dayHref={(day) => myRecordHref({ day: day.key })}
            />
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
            alerts={false}
            awareness="rights"
          />
        )}
      />
    </>
  );
}

/** Arabic counted noun after a digit: 1 يوم · 2 يومان · 3–10 أيام · 11+ يوماً. */
function dayWordAr(n, scheduled = false) {
  const value = Number(n) || 0;
  if (value === 1) return scheduled ? "يوم مجدول" : "يوم";
  if (value === 2) return scheduled ? "يومين مجدولين" : "يومان";
  if (value >= 3 && value <= 10) return scheduled ? "أيام مجدولة" : "أيام";
  return scheduled ? "يوماً مجدولاً" : (value === 0 ? "يوم" : "يوماً");
}

function dayLabel(day, ar) {
  if (day.status === "holiday" && day.off) return ar ? (day.off.labelAr || dutyStatus("holiday").ar) : (day.off.labelEn || dutyStatus("holiday").en);
  return dutyLabel(day.status, ar);
}
