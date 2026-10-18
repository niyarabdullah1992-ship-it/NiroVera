import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sun, Users } from "lucide-react";
import {
  employeeShiftOnDay,
  employeeWeekHours,
  findStationById,
  leaveOnDayView,
  stationDisplayName,
  SW,
  weekDays,
  weekdayLabel,
  weekPublishState,
  weekRelativeLabel,
  weekRosterEmployees,
  weekStartDate,
} from "@/lib/shiftWeek";
import useStationScope from "@/hooks/useStationScope";
import { isStationScopeManual } from "@/lib/stationScopeStore";
import { formatShiftHm, shiftHoursLine } from "@/lib/shiftDerivations";
import { statusBannerQuiet } from "@/lib/platformStyles";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { WEEK_HINT_EMP_AR } from "@/lib/packageMinistryCatalog";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import StatutoryItem from "@/components/labor/StatutoryItem";
import AttendanceSectionFrame from "@/components/attendance/AttendanceSectionFrame";
import ScheduleHowItWorks from "@/components/schedules/ScheduleHowItWorks";
import { chip, Collapsible, mono, quietAction, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MyPlannedOvertime from "@/components/schedules/MyPlannedOvertime";
import MyWeekDays, { useMyDayRows } from "@/components/schedules/MyWeekDays";
import DateNav from "@/components/schedules/DateNav";
import MinistryPersonalPanel from "@/components/schedules/MinistryPersonalPanel";
import BranchRosterReadOnly from "@/components/schedules/BranchRosterReadOnly";
import { DutyBoard, DutyHeadline, DutyTile, DutyTiles } from "@/components/schedules/DutyTiles";
import DutySide, { dutyHeatCopy } from "@/components/schedules/DutySide";
import { findNextShift, inLabel } from "@/components/schedules/myDutyWeek";
import { dutyEdge } from "@/components/schedules/dutyStatus";
import RightHint from "@/components/shared/RightHint";
import { attRightHint } from "@/lib/rightHints.att.js";
import { weekHoursCap } from "@/lib/laborHoursPolicy";
import { ruleValue } from "@/lib/laborRules";

/** Week nav inside «أيامي»; tiles and the board use the shared duty layout (index.css). */
const LAYOUT_CSS = `
@media (max-width: 640px) {
  .nv-my-week-nav { padding: 12px 14px 0 !important; }
}
`;

/**
 * «جدولي» — the employee lane of جدول الدوام.
 * The viewer's own week, own alerts and ministry checks, plus a read-only view of the branch
 * week (names and shift cells only). No editing, no branch stats, no other person's hours or alerts.
 */
export default function MyScheduleView({
  ar = true,
  lang = "ar",
  timeFormat,
  stationName = "",
  schedule,
  types = [],
  me,
  roster = [],
  currentUser,
  weekStart,
  setWeekStart,
  moveWeek,
  pub,
  gates,
  laborCalendar,
  station,
  data,
  nightGlow,
  history,
  manageLink,
  focusDay = "",
}) {
  // «جدول الفرع — للاطلاع» follows the branch picked in the header, like الإدارة — for someone who
  // manages that branch. My own week above stays on my work branch.
  const headerScope = useStationScope();
  const branchView = useMemo(() => {
    const scoped = headerScope && headerScope !== "all" && isStationScopeManual() ? String(headerScope) : "";
    if (!scoped || String(scoped) === String(station?.id || "")) return null;
    const managesIt = Boolean(
      currentUser && (
        currentUser.platformOwner
        || String(data?.ownerId || "") === String(currentUser.id)
        || ["director", "ops_manager"].includes(currentUser.role)
        || (currentUser.managedStations || []).map(String).includes(scoped)
      ),
    );
    if (!managesIt) return null;
    const other = findStationById(data?.stations || [], scoped);
    if (!other) return null;
    const sch = (data?.schedules || []).find((row) => String(row.stationId) === scoped) || { stationId: scoped, shiftTypes: [], assignments: {} };
    const keys = weekDays(weekStart).map((day) => day.key);
    const state = weekPublishState(sch, weekStart);
    return {
      schedule: sch,
      types: sch.shiftTypes || [],
      roster: weekRosterEmployees(sch, data?.employees || [], scoped, keys, { homeOnly: false }),
      published: state.kind === "published" || state.kind === "implicit",
      stationName: stationDisplayName(other),
    };
  }, [headerScope, station, currentUser, data, weekStart]);

  const now = new Date();
  const todayKey = calendarDateKey(now);
  const published = pub?.kind === "published" || pub?.kind === "implicit";
  const meId = me?.id;

  const dayRows = useMyDayRows({ employee: me, schedule, gates, weekStart, laborCalendar, ar });

  /** 3337 — the same seasonal notice for every employee; a personal line only when marked field. */
  const heatCopy = dutyHeatCopy({ weekStart, dayRows, ar, now });
  /** Top banner only when this employee is personally marked «مكشوف» on an in-window day. */
  const heatNotice = heatCopy?.personal ? (
    <div
      data-heat-season-notice="employee"
      role="note"
      style={{ ...statusBannerQuiet.bad, display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, lineHeight: 1.8, textAlign: "start" }}
    >
      <Sun aria-hidden style={{ width: 16, height: 16, flex: "none", marginTop: 4 }} strokeWidth={2} />
      <strong data-heat-personal="1" style={{ flex: 1, minWidth: 0 }}>{heatCopy.personal}</strong>
    </div>
  ) : null;

  const hours = meId ? employeeWeekHours(schedule, meId, weekStart, me, laborCalendar) : 0;
  // The week's cap from the rule catalog for this person and these days: 48 (Art. 98), 36 in Ramadan,
  // the Art. 108 category or a juvenile's — never a literal.
  const weekCap = weekHoursCap(me, data, weekDays(weekStart).map((day) => day.key), laborCalendar);
  const WEEK_LIMIT = Number.isFinite(weekCap.hours) ? weekCap.hours : ruleValue("hours.week.ordinaryMaxHours", weekDays(weekStart)[0]?.key);
  const capArt = weekCap.article ? (ar ? ` (المادة ${weekCap.article})` : ` (Art. ${weekCap.article})`) : "";
  const workDays = dayRows.filter((row) => row.shift).length;
  const restDays = dayRows.filter((row) => !row.shift && !row.leave).length;
  const leaveDays = dayRows.filter((row) => row.leave).length;
  const hoursTone = hours > WEEK_LIMIT ? "bad" : hours > WEEK_LIMIT - 4 ? "warn" : "ok";
  void hoursTone; void Users; void DutyHeadline; void DutyTile; void DutyTiles; void dutyEdge;

  /** Next (or current) shift — from yesterday's night forward, two weeks out, by the clock. */
  const next = useMemo(
    () => findNextShift({ me, schedule, ar, laborCalendar, now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me, schedule, ar, laborCalendar, todayKey],
  );

  const coworkers = useMemo(() => {
    if (!meId) return [];
    const map = new Map();
    dayRows.forEach(({ day, shift }) => {
      if (!shift) return;
      roster.forEach((person) => {
        if (!person?.id || String(person.id) === String(meId)) return;
        if (leaveOnDayView(person, day.key, ar, laborCalendar)) return;
        const theirs = employeeShiftOnDay(schedule, person.id, day.key);
        if (!theirs || theirs.id !== shift.id) return;
        const entry = map.get(person.id) || { id: person.id, name: person.name, days: [] };
        entry.days.push({ wd: day.wd, label: shift.label });
        map.set(person.id, entry);
      });
    });
    return [...map.values()].sort((a, b) => b.days.length - a.days.length);
  }, [dayRows, roster, meId, schedule, ar, laborCalendar]);

  /** His own file's duty tab — every ministry check that applies to him, with its status. */
  const fileHref = meId ? `/app/employees/${encodeURIComponent(meId)}?tab=duty` : "";

  const myHistory = (history?.rows || []).find((row) => String(row.employee?.id) === String(meId)) || null;

  const thisWeekKey = calendarDateKey(weekStartDate(now));
  const selectedKey = calendarDateKey(weekStartDate(weekStart));
  const relative = weekRelativeLabel(weekStart, now, ar);

  const pubChip = pub?.kind === "published" || pub?.kind === "implicit"
    ? { tone: "ok", label: ar ? "منشور" : "Published" }
    : pub?.kind === "edited"
      ? { tone: "warn", label: ar ? "قيد التعديل" : "Being edited" }
      : { tone: "mute", label: ar ? "لم يُنشر بعد" : "Not published yet" };

  const clock = (hm) => formatShiftHm(hm, timeFormat, lang);
  const nextLine = next ? (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
      <strong style={{ fontWeight: 700 }}>{next.shift.label}</strong>
      <span>·</span>
      <span>{next.live ? (ar ? "تنتهي" : "ends") : next.key === todayKey ? (ar ? "اليوم" : "today") : weekdayLabel(next.date.getDay(), ar)}</span>
      <span dir="ltr" style={{ ...mono, fontWeight: 700 }}>{next.live ? clock(next.shift.end) : clock(next.shift.start)}</span>
    </span>
  ) : null;

  return (
    <AttendanceSectionFrame
      ar={ar}
      lane="mine"
      title={ar ? "جدولي — الأسبوع" : "My roster — the week"}
      hint={(
        <>
          {ar ? "ورديّاتي وحقوقي من الجدول المنشور" : "My shifts and my rights from the published roster"}
          {fileHref ? (
            <>
              {" · "}
              <Link to={fileHref} data-my-file-duty-link="hero" style={{ color: "#fff", fontWeight: 700 }}>
                {ar ? "ملفي — الدوام وأنظمة الوزارة" : "My file — duty and ministry rules"}
              </Link>
            </>
          ) : null}
        </>
      )}
      meta={(
        <>
          <StatutoryItem decisionId="18632" ar={ar} entitlement glow={nightGlow} compact />
          <span style={chip(pubChip.tone)}>{pubChip.label}</span>
        </>
      )}
    >
      <style>{LAYOUT_CSS}</style>


      {heatNotice}

      <DutyBoard
        main={(
          <div className="nv-sched nv-my-sched" data-lane="mine" style={{ display: "contents" }}>
            {/* 1 · My seven days */}
            <section data-my-week="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
              <SectionHead
                title={ar ? `أيامي — ${relative}` : `My days — ${relative}`}
                trailing={<RightHint ar={ar} hint={attRightHint("roster", { weekStart: selectedKey, published, publishedAt: published ? (pub?.snap?.at || "") : "", changedAfterPublish: pub?.kind === "edited" }, { view: "employee", ar })} />}
                note={published
                  ? (ar ? "من الجدول المنشور. الإجازة والعطل الرسمية مقفلة." : "From the published roster. Leave and official holidays are locked.")
                  : (ar ? "هذا الأسبوع لم يُنشر بعد — قد يتغيّر، و«حضر» يبقى مغلقاً حتى النشر." : "This week is not published yet — it may change, and check-in stays closed until it is.")}
              />
              <div className="nv-my-week-nav" style={{ padding: "12px 18px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                <DateNav
                  mode="week"
                  ar={ar}
                  value={weekStart}
                  onPrev={() => moveWeek(-1)}
                  onNext={() => moveWeek(1)}
                  onToday={() => setWeekStart(weekStartDate(now))}
                  isCurrent={selectedKey === thisWeekKey}
                  onPick={(picked) => setWeekStart(weekStartDate(picked))}
                />
              </div>
              <MyWeekDays dayRows={dayRows} types={types} published={published} ar={ar} lang={lang} timeFormat={timeFormat} focusKey={focusDay} />
              <div style={{ padding: "8px 18px 14px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--nv-line2)", marginTop: 10 }}>
                <span style={{ fontSize: 11.5, color: SW.muted, lineHeight: 1.7, flex: "1 1 260px" }}>
                  {ar ? WEEK_HINT_EMP_AR : "This is your published roster. Ask for a shift change or leave from My Requests. Leave days stay locked."}
                </span>
              </div>
            </section>

            {/* Overtime the published roster plans for me this week — information; decided in طلباتي once worked. */}
            <MyPlannedOvertime data={data} me={me} weekStart={weekStart} ar={ar} />

            {/* 2 · The whole branch week — read only, folded; management stays in the manage lane */}
            <BranchRosterReadOnly
              roster={branchView ? branchView.roster : roster}
              schedule={branchView ? branchView.schedule : schedule}
              types={branchView ? branchView.types : types}
              weekStart={weekStart}
              laborCalendar={laborCalendar}
              currentUser={currentUser}
              published={branchView ? branchView.published : published}
              stationName={branchView ? branchView.stationName : stationName}
              ar={ar}
              lang={lang}
              timeFormat={timeFormat}
              defaultOpen={false}
            />

            {/* 3 · What the ministry rules say about my week — opens on what needs follow-up */}
            <MinistryPersonalPanel
              employee={me}
              schedule={schedule}
              weekStart={weekStart}
              station={station}
              company={data}
              laborCalendar={laborCalendar}
              ar={ar}
              own
              alertsLabel={ar ? "تنبيهاتي" : "My alerts"}
              fileHref={fileHref}
              showAllDefault={false}
            />

            {/* My own recent published workdays — never anyone else's */}
            <section style={{ ...slab, overflow: "hidden" }}>
              <Collapsible
                dataAttr="my-history"
                title={ar ? "آخر أيام العمل — من النسخة المنشورة" : "Recent workdays — from the published copy"}
                note={myHistory
                  ? (ar ? `${myHistory.summary || ""}${myHistory.summary ? " · " : ""}${myHistory.hours} ساعة من النسخة المنشورة` : `${myHistory.summary || ""}${myHistory.summary ? " · " : ""}${myHistory.hours} h from the published copy`)
                  : (ar ? "لا أيام منشورة في المدى بعد" : "No published days in range yet")}
              >
                {myHistory && history?.days?.length ? (
                  <div style={{ padding: "4px 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${history.days.length},minmax(0,1fr))`, gap: 3 }}>
                      {history.days.map((day, index) => {
                        const cell = myHistory.cells[index] || {};
                        return (
                          <span key={day.key} title={cell.tip} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0 }}>
                            <span dir="ltr" style={{ ...mono, fontSize: 10, color: "var(--nv-ink3)" }}>{day.day}</span>
                            <span style={{ width: "100%", height: 26, boxSizing: "border-box", background: cell.bg, border: `1px solid ${cell.border}`, borderRadius: DS_CONTROL_RADIUS, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: cell.color, overflow: "hidden" }}>
                              {cell.mark}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </Collapsible>
            </section>
          </div>
        )}
        side={(
          <DutySide
            ar={ar}
            lang={lang}
            employee={me}
            schedule={schedule}
            weekStart={weekStart}
            currentUser={currentUser}
            laborCalendar={laborCalendar}
            gates={gates}
            station={station}
            data={data}
            heatCopy={heatCopy}
            alerts={false}
            awareness="heat"
          >
            {/* «أسبوعي» — the same dark slab as «رصيد إجازاتي»: next shift, hours against the limit, who shares my shifts. */}
            <section data-my-week-card="1" data-my-coworkers="1" style={{ borderRadius: 12, overflow: "hidden", background: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)", color: "#fff" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{ar ? "أسبوعي" : "My week"}</span>
              </div>
              <div data-next-shift="1" style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13, color: "#fff" }}>{next?.live ? (ar ? "أنت على ورديتك الآن" : "On shift now") : (ar ? "ورديتك القادمة" : "Your next shift")}</strong>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{nextLine || "—"}</span>
                </span>
                <span style={{ fontSize: 11.5, color: "#C5DBCD", lineHeight: 1.7 }}>
                  {next
                    ? (next.live
                      ? `${ar ? "بدأت" : "Started"} ${weekdayLabel(next.date.getDay(), ar)} · ${inLabel(next.end.getTime() - now.getTime(), ar).replace(ar ? "بعد" : "in", ar ? "تبقّى" : "")}`
                      : `${inLabel(next.start.getTime() - now.getTime(), ar)} · ${shiftHoursLine(next.shift, lang, timeFormat) || ""}`)
                    : (ar ? "لا وردية منشورة في الأسبوعين القادمين" : "No published shift in the next two weeks")}
                </span>
              </div>
              <div data-my-hours="1" style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13, color: "#fff" }}>{ar ? "ساعاتي هذا الأسبوع" : "My hours this week"}</strong>
                  <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{Number.isInteger(hours) ? hours : hours.toFixed(1)}</span> {ar ? `من ${WEEK_LIMIT} ساعة` : `of ${WEEK_LIMIT} h`}
                  </span>
                </span>
                <span aria-hidden style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "hidden", display: "block" }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.min(100, (hours / WEEK_LIMIT) * 100)}%`, background: hours > WEEK_LIMIT ? "#E07A7A" : "#C8A45A", borderRadius: 999 }} />
                </span>
                <span style={{ fontSize: 11, color: hours > WEEK_LIMIT ? "#F3C9C9" : "#A9CDB8" }}>
                  {hours > WEEK_LIMIT
                    ? (ar ? `فوق حد ${WEEK_LIMIT} ساعة — الإدارة تعالجه قبل النشر` : `Over the ${WEEK_LIMIT} h limit — management fixes it before publish`)
                    : (ar ? `الحد النظامي ${WEEK_LIMIT} ساعة أسبوعياً${capArt}` : `Statutory limit ${WEEK_LIMIT} h a week${capArt}`)}
                </span>
              </div>
              <div style={{ padding: "12px 18px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13, color: "#fff" }}>{ar ? "زملائي في نفس الوردية" : "On my shifts with me"}</strong>
                <span style={{ fontSize: 11, color: "#A9CDB8" }}>{ar ? "الأسماء فقط" : "Names only"}</span>
              </div>
              {coworkers.length ? coworkers.map((person) => (
                <div key={person.id} style={{ padding: "8px 18px", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span aria-hidden style={{ width: 28, height: 28, borderRadius: 999, background: "#C8A45A", color: "#0B3D27", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>
                    {String(person.name || "؟").trim().charAt(0)}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</span>
                    <span style={{ fontSize: 11, color: "#C5DBCD", lineHeight: 1.6 }}>
                      {person.days.map((d) => `${weekdayLabel(d.wd, ar)} (${d.label})`).join(ar ? "، " : ", ")}
                    </span>
                  </span>
                </div>
              )) : (
                <span style={{ display: "block", padding: "6px 18px", fontSize: 12, color: "#C5DBCD", lineHeight: 1.7 }}>
                  {workDays
                    ? (ar ? "لا أحد يشاركك ورديّاتك هذا الأسبوع." : "Nobody shares your shifts this week.")
                    : (ar ? "لا ورديات لك هذا الأسبوع." : "You have no shifts this week.")}
                </span>
              )}
              <div style={{ padding: "10px 18px", marginTop: 6, borderTop: "1px solid rgba(255,255,255,.1)", fontSize: 10.5, color: "#A9CDB8" }}>
                {ar ? "من الجدول المنشور. تغيير الوردية يُطلب من «طلباتي ← طلبات الدوام»." : "From the published roster. Ask for a shift change in My requests → Duty requests."}
              </div>
            </section>

            {manageLink ? (
              <section style={{ ...slab, padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6, borderInlineStart: manageLink.emphasize ? "3px solid var(--nv-warn-fill)" : slab.border }}>
                <span style={{ fontSize: 12, color: manageLink.emphasize ? SW.gold : SW.mid, lineHeight: 1.7 }}>
                  {ar ? "تدير جدول الفرع؟ التحرير والنشر والامتثال في عرض الإدارة." : "Managing the branch roster? Editing, publishing and compliance are in the manage view."}
                </span>
                <Link to="/app/shifts?lane=manage" style={{ ...quietAction({ fontSize: 12, color: "var(--nv-ok-ink)" }), alignSelf: "flex-start" }}>
                  {ar ? "افتح جدول الفرع — الإدارة" : "Open the branch roster — manage"}
                </Link>
              </section>
            ) : null}
          </DutySide>
        )}
      />

      <ScheduleHowItWorks ar={ar} sections={["performance"]} />
    </AttendanceSectionFrame>
  );
}
