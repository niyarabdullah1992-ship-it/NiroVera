import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  addShiftType,
  copyScheduleMonth,
  publishWeek,
  removeShiftType,
  setEmployeeDayShift,
  setScheduleNightCompensation,
  decideNightRemedy,
  withdrawNightRemedy,
  setNightFacilityFlag,
  submitOtherRequest,
  openDueNightRotateCycles,
  updateShiftType,
} from "@/lib/store";
import { nextDistinctShift, repairedShiftWindow, STANDARD_SHIFT_WINDOWS, formatShiftHm, shiftHoursLine, shiftWindowKey } from "@/lib/shiftDerivations";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import {
  buildHistory,
  checkShiftChangeApplyGate,
  checkWeekPublishGates,
  copyMonthReuseNote,
  cycleShiftId,
  defaultWeekStartForMonth,
  employeeNeedsNightRotateChoice,
  formatMonthLabel,
  ordinaryShiftId,
  weekNightDateKeys,
  employeeShiftOnDay,
  employeeWeekHours,
  formatWeekLabel,
  historyColumnLabel,
  LEAVE_STYLE,
  leaveOnDayView,
  monthCursorOf,
  monthHasDatedAssignments,
  nextMonthCursor,
  previousMonthCursor,
  REST_STYLE,
  shiftHours,
  shiftMonthCursor,
  shiftTypeStyle,
  SW,
  weekDateKeys,
  weekDays,
  weekKeyFromDate,
  weekPublishState,
  weekRelativeLabel,
  weekRosterEmployees,
  rosterBranchPhrase,
  weekStartDate,
  weekStartsInMonth,
  weekIntersectsMonth,
  weekdayLabel,
  weekCellAlert,
  weekCellAlertTone,
  activeNightRemedy,
  nightAllowancePayLabel,
  nightCutHoursLabel,
  withdrawableNightRemedyEmployees,
} from "@/lib/shiftWeek";
import { checkSubmitOtherRequestGate } from "@/lib/otherRequestDerivations";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { toast } from "@/components/ui/use-toast";
import StatutoryItem from "@/components/labor/StatutoryItem";
import { canEditOwnerBoard } from "@/lib/ownerBoard";
import LaborCalendarCard from "@/components/hr/LaborCalendarCard";
import { NIGHT_FACILITY_FLAGS } from "@/lib/decision18632";
import { rosterNightRowMark, statutoryGlowState } from "@/lib/statutoryItem";
import { isRamadanDay, ruleValue } from "@/lib/laborRules";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import FileHoursAlertsRail from "@/components/employees/FileHoursAlertsRail";
import ManagerDutyAlertsRail from "@/components/employees/ManagerDutyAlertsRail";
import { FileSelfBadge } from "@/components/employees/ProfileHero";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { BAD, WARN, statusBannerQuiet } from "@/lib/platformStyles";
import LawGatesPanels from "@/components/shared/LawGatesPanels";
import PublishedWeekMinistryStrip from "@/components/schedules/PublishedWeekMinistryStrip";
import { publishedWeekMinistryFacts } from "@/lib/rosterMinistrySurface";
import LawGateAlertRow from "@/components/shared/LawGateAlertRow";
import LawGateStatusPill, { LawGateArticleBadge } from "@/components/shared/LawGateStatusPill";
import { DS_CONTROL_RADIUS, DS_PILL_RADIUS, DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";
import { WEEK_HINT_ADMIN_AR, WEEK_HINT_EMP_AR } from "@/lib/packageMinistryCatalog";

const HEADING = "var(--font-heading)";
const LINK = { color: SW.ink, fontWeight: 600, textDecoration: "none" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const clockMono = { ...mono, fontVariantNumeric: "tabular-nums" };
const slab = {
  background: "var(--nv-card, #fff)",
  border: "1px solid var(--nv-line, #E2E8F0)",
  borderRadius: DS_RADIUS,
  boxShadow: DS_SHADOW,
};

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Compact week chip label — readable range without year clutter. */
function formatWeekTabLabel(weekStart, ar = true) {
  const days = weekDays(weekStart);
  const a = days[0];
  const b = days[6];
  if (a.month === b.month) return `${a.day} → ${b.day}`;
  if (ar) return `${a.day} ${MONTHS_AR[a.month]} → ${b.day} ${MONTHS_AR[b.month]}`;
  return `${a.day} ${MONTHS_EN[a.month]} → ${b.day} ${MONTHS_EN[b.month]}`;
}

function publishActionBtn({ published, locked }) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 18px",
    border: published || !locked ? "none" : "1px solid var(--nv-line, #E2E8F0)",
    background: published
      ? "var(--nv-navy)"
      : locked
        ? "var(--nv-soft, #F7F8FA)"
        : "var(--nv-accent)",
    color: published || !locked
      ? "var(--nv-btn-ink, #fff)"
      : "var(--nv-ink3, var(--nv-muted))",
    cursor: locked ? "default" : "pointer",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    borderRadius: DS_CONTROL_RADIUS,
  };
}

/** Soft DS v2 meaning chips — count (warn) + named blockers (bad). */
function publishGateChip(tone = "warn") {
  const base = tone === "bad" ? BAD : WARN;
  return {
    ...base,
    display: "inline-flex",
    alignItems: "center",
    fontWeight: 600,
    fontSize: 11,
    lineHeight: 1.45,
    maxWidth: "100%",
  };
}

/** Quiet RTL strip under planning chrome: count chip + named publish blockers. */
function PublishGateAlertStrip({ blockers = [], countLabel, ar = true }) {
  const list = Array.isArray(blockers) ? blockers.filter((row) => String(row?.title || "").trim()) : [];
  if (!list.length) return null;
  return (
    <div
      role="alert"
      data-publish-gate-strip=""
      dir={ar ? "rtl" : "ltr"}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        width: "100%",
      }}
    >
      <span style={publishGateChip("warn")}>{countLabel}</span>
      {list.map((row) => (
        <span
          key={row.id || row.title}
          title={String(row.note || row.title || "").trim() || undefined}
          style={publishGateChip("bad")}
        >
          {row.title}
        </span>
      ))}
    </div>
  );
}

/** Quiet toggle row — LawGateAlertRow slab: card fill, control radius 10, status only on 999 chip. */
function nightSettingRowStyle() {
  return {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    boxSizing: "border-box",
    margin: 0,
    padding: "9px 11px",
    border: "1px solid var(--nv-line, #E2E8F0)",
    borderRadius: DS_CONTROL_RADIUS,
    background: "var(--nv-card, #fff)",
    fontFamily: "inherit",
    fontSize: 11.5,
    lineHeight: 1.8,
    color: "var(--nv-ink2, #334155)",
    cursor: "pointer",
    textAlign: "inherit",
  };
}

function nightSettingGhostBtn() {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 600,
    padding: "5px 10px",
    border: "1px solid var(--nv-line, #E2E8F0)",
    borderRadius: DS_CONTROL_RADIUS,
    background: "var(--nv-card, #fff)",
    color: "var(--nv-ink, #14284B)",
    cursor: "pointer",
  };
}

/** Literary duty window with LTR mono clocks — follows header 12/24. */
function ShiftHoursLabel({ shift, lang, format }) {
  const start = formatShiftHm(shift?.start, format, lang);
  const end = formatShiftHm(shift?.end, format, lang);
  if (!start && !end) return null;
  const clock = (label) => <span dir="ltr" style={clockMono}>{label}</span>;
  if (lang === "ar") {
    if (start && end) return <>من {clock(start)} إلى {clock(end)}</>;
    return clock(start || end);
  }
  if (start && end) return <>{clock(start)}–{clock(end)}</>;
  return clock(start || end);
}

function KickerLine({ kicker }) {
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  return (
    <span style={{ fontSize: 11, letterSpacing: ".14em", color: "#A9CDB8", display: "flex", gap: 7, alignItems: "center" }}>
      {parts[0] ? <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{parts[0]}</span> : null}
      {parts[1] ? <span>·</span> : null}
      <span>{parts.slice(1).join(" · ") || (!parts[0] ? kicker : "")}</span>
    </span>
  );
}

function countAr(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

function chipBtn(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "6px 12px",
    border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line, #E2E8F0)"}`,
    background: on ? "var(--nv-navy)" : "var(--nv-card, #fff)",
    color: on ? "var(--nv-btn-ink, #fff)" : "var(--nv-ink2, #334155)",
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: DS_PILL_RADIUS,
  };
}

function fieldStyle() {
  return {
    ...mono,
    fontSize: 11,
    padding: "5px 8px",
    border: `1px solid ${SW.line}`,
    background: SW.card,
    color: SW.ink,
    outline: "none",
    borderRadius: 10,
  };
}

export default function ShiftWeekBoard({
  schedule,
  employees = [],
  stationId,
  stationName = "",
  companyId,
  currentUser,
  canEdit = false,
  mode = "manage",
  lang = "ar",
  kicker,
  pageTitle,
  gridTitle,
  gridLead,
}) {
  const ar = lang === "ar";
  const { format: timeFormat } = useTimeFormat();
  const { refresh, data } = useAuth();
  const laborCalendar = laborCalendarOf(data);
  const station = (data?.stations || []).find((row) => String(row.id) === String(stationId));
  const manageMonth = mode === "manage";
  const [monthCursor, setMonthCursor] = useState(() => monthCursorOf(new Date()));
  const [weekStart, setWeekStart] = useState(() => (
    manageMonth
      ? defaultWeekStartForMonth(new Date().getFullYear(), new Date().getMonth())
      : weekStartDate(new Date())
  ));
  const [brush, setBrush] = useState(null);
  const [restJumpNote, setRestJumpNote] = useState("");
  const [histFrom, setHistFrom] = useState(() => calendarDateKey(new Date(Date.now() - 18 * 86400000)));
  const [histTo, setHistTo] = useState(() => calendarDateKey(new Date()));
  const [histMode, setHistMode] = useState("emp");
  const [histQuery, setHistQuery] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState({ date: calendarDateKey(new Date()), shiftTypeId: "", reason: "" });

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const weekKeys = useMemo(() => days.map((day) => day.key), [days]);
  const [draft, setDraft] = useState({});
  const roster = useMemo(() => {
    const rows = weekRosterEmployees(schedule, employees, stationId, weekKeys, { homeOnly: mode === "mine" });
    if (mode !== "mine" || !currentUser?.id) return rows;
    const self = rows.find((row) => row.id === currentUser.id);
    if (self) return [self, ...rows.filter((row) => row.id !== currentUser.id)];
    const fallback = employees.find((row) => row.id === currentUser.id) || currentUser;
    return fallback ? [fallback, ...rows] : rows;
  }, [schedule, employees, stationId, weekKeys, mode, currentUser]);
  const types = schedule?.shiftTypes || [];

  useEffect(() => {
    if (!canEdit || !companyId || !stationId) return;
    let changed = false;
    types.forEach((shift) => {
      const repaired = repairedShiftWindow(shift);
      if (repaired) {
        updateShiftType(companyId, stationId, shift.id, repaired);
        changed = true;
      }
    });
    const restoreKey = `nv.shift-windows.restored:${stationId}`;
    const alreadyRestored = typeof localStorage !== "undefined" && localStorage.getItem(restoreKey);
    if (!alreadyRestored) {
      STANDARD_SHIFT_WINDOWS.forEach((slot) => {
        const exists = types.some((shift) => (
          shiftWindowKey(shift.start, shift.end) === shiftWindowKey(slot.start, slot.end)
          || shift.label === slot.ar
          || shift.label === slot.en
        ));
        if (exists) return;
        addShiftType(companyId, stationId, {
          label: ar ? slot.ar : slot.en,
          start: slot.start,
          end: slot.end,
          restMinutes: slot.restMinutes ?? 30,
        });
        changed = true;
      });
      try { localStorage.setItem(restoreKey, "1"); } catch { /* ignore */ }
    }
    if (changed) refresh?.();
  }, [canEdit, companyId, stationId]);

  useEffect(() => {
    if (!companyId) return;
    const result = openDueNightRotateCycles(companyId);
    if (result.opened?.length) refresh?.();
  }, [companyId]);

  useEffect(() => {
    setDraft((prev) => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      const next = { ...prev };
      let dirty = false;
      for (const key of keys) {
        const split = key.indexOf(":");
        const empId = key.slice(0, split);
        const dateKey = key.slice(split + 1);
        const liveId = employeeShiftOnDay(schedule, empId, dateKey)?.id || null;
        if (liveId === (next[key] || null)) {
          delete next[key];
          dirty = true;
        }
      }
      return dirty ? next : prev;
    });
  }, [schedule]);

  const gates = useMemo(
    () => checkWeekPublishGates({
      schedule,
      employees,
      weekStart,
      stationId,
      station,
      settings: data?.settings,
      company: data,
      ar,
      laborCalendar,
    }),
    [schedule, employees, weekStart, stationId, station, data, ar, laborCalendar],
  );
  const ministryFacts = useMemo(() => {
    const viewer = mode === "mine"
      ? (roster.find((row) => isViewerOwnFile(row, currentUser)) || currentUser)
      : null;
    const viewerHours = viewer?.id
      ? employeeWeekHours(schedule, viewer.id, weekStart, viewer, laborCalendar)
      : undefined;
    return publishedWeekMinistryFacts(gates, {
      ar,
      viewerName: viewer?.name || "",
      viewerHours,
    });
  }, [mode, roster, currentUser, schedule, weekStart, laborCalendar, gates, ar]);
  const pub = weekPublishState(schedule, weekStart);
  const history = useMemo(
    () => buildHistory({ schedule, employees, stationId, fromKey: histFrom, toKey: histTo, query: histQuery, mode: histMode, ar, laborCalendar }),
    [schedule, employees, stationId, histFrom, histTo, histQuery, histMode, ar, laborCalendar],
  );

  const published = pub.kind === "published" || pub.kind === "implicit";
  const blockers = gates.blockers.length;
  const publishBlockerLabel = blockers
    ? (ar
      ? `${countAr(blockers, "مانع واحد", "مانعان", "موانع", "مانعاً")} قبل النشر`
      : `${blockers} blockers before publish`)
    : "";
  const publishLabel = published && pub.kind === "published"
    ? (ar ? "منشور — التقويم يقرأ منه" : "Published — calendar reads this")
    : pub.kind === "edited"
      ? (ar ? "انشر التعديل" : "Publish the edit")
      : pub.kind === "implicit"
        ? (ar ? "أسبوع ماضٍ — منشور تلقائياً" : "Past week — auto-published")
        : (ar ? "انشر الجدول" : "Publish the roster");
  const publishLocked = !!blockers || pub.kind === "implicit" || (published && pub.kind === "published");
  const thisWeek = weekRelativeLabel(weekStart, new Date(), ar);
  const thisWeekNow = thisWeek === (ar ? "الأسبوع الجاري" : "This week");
  const monthLabel = formatMonthLabel(monthCursor.year, monthCursor.monthIndex, ar);
  const monthWeeks = useMemo(
    () => weekStartsInMonth(monthCursor.year, monthCursor.monthIndex),
    [monthCursor.year, monthCursor.monthIndex],
  );
  const prevMonth = previousMonthCursor(monthCursor);
  const nextMonth = nextMonthCursor(monthCursor);
  const sourcePrevHas = monthHasDatedAssignments(schedule?.assignments, prevMonth.year, prevMonth.monthIndex);
  const sourceCurrentHas = monthHasDatedAssignments(schedule?.assignments, monthCursor.year, monthCursor.monthIndex);

  const countsNote = ar
    ? `${countAr(gates.assigned, "تعيين واحد", "تعيينان", "تعيينات", "تعييناً")} · ${countAr(gates.totalHours, "ساعة واحدة", "ساعتان", "ساعات", "ساعة")} · ${countAr(roster.length, "موظف واحد", "موظفان", "موظفين", "موظفاً")}`
    : `${gates.assigned} assignments · ${gates.totalHours} h · ${roster.length} people`;
  const gridNote = [gridLead, countsNote].filter(Boolean).join(" · ");
  const boardTitle = pageTitle || (ar ? "جدول الدوام" : "Duty roster");
  const nightGlow = statutoryGlowState({
    kind: "18632",
    employees: roster,
    schedule,
    weekStart,
    laborCalendar,
  });
  const assignmentsTitle = gridTitle || (stationName
    ? (ar ? `جدول ${rosterBranchPhrase(stationName, ar)}` : `${stationName} roster`)
    : (ar ? "التعيينات" : "Assignments"));

  const histScope = history.workDays
    ? (ar
      ? `${countAr(history.workDays, "يوم عمل منشور واحد", "يومَا عمل منشوران", "أيام عمل منشورة", "يوم عمل منشور")} بين التاريخين${history.skipped ? ` · ${countAr(history.skipped, "يوم واحد", "يومان", "أيام", "يوماً")} بلا جدول منشور، غير محتسب` : ""}`
      : `${history.workDays} published workdays in range${history.skipped ? ` · ${history.skipped} unpublished, not counted` : ""}`)
    : (history.skipped
      ? (ar
        ? `${countAr(history.skipped, "يوم عمل واحد", "يومَا عمل", "أيام عمل", "يوم عمل")} بلا جدول منشور — لا شيء يُحتسب`
        : `${history.skipped} unpublished workdays — nothing is counted`)
      : (ar ? "لا يوم عمل بين التاريخين" : "No workday in range"));

  const histNote = !history.workDays
    ? (history.skipped
      ? (ar ? "أيام المدى تقع في أسابيع لم تُنشر بعد — انشر الجدول لتدخل الحساب." : "The range sits in unpublished weeks — publish so they count.")
      : (ar ? "وسّع المدى — الجمعة والسبت خارج الجدول." : "Widen the range — Friday and Saturday sit outside the roster."))
    : (histQuery.trim()
      ? (ar ? `مصفّى على «${histQuery.trim()}» · ${history.rows.length} موظف` : `Filtered to “${histQuery.trim()}” · ${history.rows.length} people`)
      : (ar
        ? `الورديات الليلية في المدى: ${history.nightMarks}. الأرقام من النسخة المنشورة وقت كل أسبوع — تعديلات المسودة لا تدخل هنا حتى تُنشر.`
        : `Night marks in range: ${history.nightMarks}. Figures come from the published copy — draft edits stay out until you publish.`));

  useEffect(() => {
    if (!manageMonth) return;
    if (weekIntersectsMonth(weekStart, monthCursor.year, monthCursor.monthIndex)) return;
    setMonthCursor(monthCursorOf(weekStart));
  }, [manageMonth, weekStart, monthCursor.year, monthCursor.monthIndex]);

  const moveWeek = (delta) => setWeekStart((cur) => weekStartDate(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + delta * 7)));

  const moveMonth = (delta) => {
    const next = shiftMonthCursor(monthCursor, delta);
    setMonthCursor(next);
    setWeekStart(defaultWeekStartForMonth(next.year, next.monthIndex));
  };

  const jumpToThisMonth = () => {
    const now = new Date();
    const next = monthCursorOf(now);
    setMonthCursor(next);
    setWeekStart(defaultWeekStartForMonth(next.year, next.monthIndex, now));
  };

  const doReuseMonth = (kind) => {
    if (!canEdit || !companyId || !stationId) return;
    const source = kind === "prev" ? prevMonth : monthCursor;
    const target = kind === "prev" ? monthCursor : nextMonth;
    const result = copyScheduleMonth(companyId, stationId, {
      sourceYear: source.year,
      sourceMonthIndex: source.monthIndex,
      targetYear: target.year,
      targetMonthIndex: target.monthIndex,
      ar,
    });
    if (!result.ok) {
      toast({
        description: result.reason || (ar ? "تعذّر إعادة الجدول." : "Could not reuse the roster."),
        variant: "destructive",
      });
      return;
    }
    setMonthCursor(target);
    setWeekStart(defaultWeekStartForMonth(target.year, target.monthIndex));
    refresh?.();
    toast({ description: copyMonthReuseNote(result, ar) });
  };
  const shiftOn = (employee, day) => {
    const key = `${employee.id}:${day.key}`;
    if (Object.prototype.hasOwnProperty.call(draft, key)) {
      const id = draft[key];
      return id ? types.find((row) => row.id === id) || null : null;
    }
    return employeeShiftOnDay(schedule, employee.id, day.key);
  };

  const cycleCell = (employee, day) => {
    if (!canEdit || !companyId || !stationId) return;
    const current = shiftOn(employee, day);
    const ordinaryOnly = employeeNeedsNightRotateChoice(employee, schedule, day.key);
    const nextId = cycleShiftId(types, current?.id || null, brush, {
      onDate: day.key,
      ordinaryOnly,
    });
    // Store enforces Decision 18632 auto-jump (or named refuse) on every paint/brush write.
    const result = setEmployeeDayShift(companyId, stationId, day.key, employee.id, nextId, {
      weekStart,
      ordinaryOnly,
    });
    if (!result.ok) {
      setRestJumpNote("");
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    const placeKey = result.dateKey;
    const placeId = result.shiftTypeId;
    const draftKey = `${employee.id}:${placeKey}`;
    setDraft((prev) => {
      const next = { ...prev, [draftKey]: placeId };
      if (result.clearedSource) next[`${employee.id}:${day.key}`] = null;
      return next;
    });
    if (result.jumped) {
      const note = ar ? result.reason : result.reasonEn;
      setRestJumpNote(note);
      toast({ description: note });
    } else {
      setRestJumpNote("");
    }
  };

  const applyOrdinaryHours = (employee, kind, dateKey) => {
    if (!canEdit || !companyId || !stationId || !employee?.id) return { ok: false };
    const dates = dateKey
      ? [dateKey]
      : weekNightDateKeys(schedule, employee.id, weekStart);
    if (!dates.length) {
      toast({
        description: ar ? "لا يوم لتحويله إلى ساعات عادية." : "No day to convert to ordinary hours.",
        variant: "destructive",
      });
      return { ok: false };
    }
    let jumpNote = "";
    for (const key of dates) {
      const nextId = ordinaryShiftId(types, kind, key);
      if (!nextId) {
        toast({
          description: ar ? "لا وردية صباحية أو مسائية على هذا الجدول." : "No morning or evening shift on this roster.",
          variant: "destructive",
        });
        return { ok: false };
      }
      const result = setEmployeeDayShift(companyId, stationId, key, employee.id, nextId, {
        weekStart,
        ordinaryOnly: true,
      });
      if (!result.ok) {
        setRestJumpNote("");
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return result;
      }
      if (result.jumped) jumpNote = ar ? result.reason : result.reasonEn;
    }
    decideNightRemedy(companyId, employee.id, "rotate", {
      actorId: currentUser?.id,
      ordinaryKind: kind,
      applyRoster: false,
    });
    if (jumpNote) {
      setRestJumpNote(jumpNote);
      toast({ description: jumpNote });
    } else {
      setRestJumpNote("");
      toast({
        description: kind === "evening"
          ? (ar ? "دُوِّر هذا الموظف إلى مسائي لتجاوز ثلاثة أشهر دون موافقة. وردية الليل بقيت على الجدول." : "This person was rotated to evening after three months without consent. The night shift stayed on the roster.")
          : (ar ? "دُوِّر هذا الموظف إلى صباحي لتجاوز ثلاثة أشهر دون موافقة. وردية الليل بقيت على الجدول." : "This person was rotated to morning after three months without consent. The night shift stayed on the roster."),
      });
    }
    refresh?.();
    return { ok: true };
  };

  const applyNightRemedy = (employee, kind, extra = {}) => {
    if (!canEdit || !companyId || !employee?.id) return { ok: false };
    if (kind === "morning" || kind === "evening") {
      const result = decideNightRemedy(companyId, employee.id, "rotate", {
        actorId: currentUser?.id,
        ordinaryKind: kind,
      });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return result;
      }
      toast({
        description: kind === "evening"
          ? (ar ? "غُيّر العمل الليلي إلى مسائي." : "Night work was changed to evening.")
          : (ar ? "غُيّر العمل الليلي إلى صباحي." : "Night work was changed to morning."),
      });
      refresh?.();
      return result;
    }
    if (kind === "withdraw") {
      const result = withdrawNightRemedy(companyId, employee.id, { actorId: currentUser?.id });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return result;
      }
      toast({
        description: ar
          ? "سُحب القرار. اختَر من جديد: تقليص أو بدل أو تغيير العمل الليلي."
          : "The choice was withdrawn. Choose again: reduce hours, an allowance, or a change of night work.",
      });
      refresh?.();
      return result;
    }
    const result = decideNightRemedy(companyId, employee.id, kind, {
      actorId: currentUser?.id,
      cutHours: extra.cutHours,
      amount: extra.amount,
      allowanceKind: extra.allowanceKind,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return result;
    }
    const cutLabel = nightCutHoursLabel(result.cutHours || extra.cutHours, ar);
    const payLabel = nightAllowancePayLabel(result.amount || extra.amount, result.allowanceKind || extra.allowanceKind, ar);
    toast({
      description: kind === "reduce"
        ? (ar ? `سُجّل تقليص ${cutLabel}. يمكن سحبه والبدء من جديد.` : `A cut of ${cutLabel} was recorded. You may withdraw and start over.`)
        : (ar ? `سُجّل ${payLabel}. يُصرف مع الراتب. يمكن سحبه والبدء من جديد.` : `${payLabel} recorded. It pays with salary. You may withdraw and start over.`),
    });
    refresh?.();
    return result;
  };

  const doPublish = () => {
    if (!canEdit || blockers || !companyId || !stationId) return;
    if (pub.kind === "implicit") return;
    const result = publishWeek(companyId, stationId, weekKeyFromDate(weekStart), {
      by: currentUser?.name,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({ description: ar ? "نُشر الجدول — التقويم التشغيلي يقرأ منه." : "Roster published — the operational calendar reads it." });
    refresh?.();
  };

  const submitShiftRequest = () => {
    if (!companyId || !currentUser?.id) return;
    const gate = checkSubmitOtherRequestGate({ type: "shift_change", reason: reqForm.reason, date: reqForm.date });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    const applyGate = checkShiftChangeApplyGate({
      schedule,
      employee: employees.find((row) => row.id === currentUser.id) || currentUser,
      dateKey: reqForm.date,
      shiftTypeId: reqForm.shiftTypeId || null,
      laborCalendar,
    });
    if (!applyGate.ok) {
      toast({ description: ar ? applyGate.reason : applyGate.reasonEn, variant: "destructive" });
      return;
    }
    submitOtherRequest(companyId, currentUser.id, {
      type: "shift_change",
      reason: reqForm.reason,
      date: reqForm.date,
      shiftTypeId: reqForm.shiftTypeId || undefined,
      stationId,
    });
    toast({ description: ar ? "سُجّل طلب تغيير الوردية — بانتظار الاعتماد." : "Shift-change request recorded — awaiting approval." });
    setReqOpen(false);
    refresh?.();
  };

  const askNightConsent = () => {
    if (!companyId) return;
    const result = openDueNightRotateCycles(companyId);
    toast({
      description: result.opened?.length
        ? (ar ? "فُتح طلب الموافقة للموظف — بانتظار قراره." : "Consent request opened — awaiting the worker's decision.")
        : (ar ? "الطلب مفتوح أو أُجيب هذا الشهر." : "A request is already open or answered this month."),
    });
    if (result.opened?.length) refresh?.();
  };

  const brushLabel = brush === ""
    ? (ar ? "راحة" : "Rest")
    : (types.find((row) => row.id === brush)?.label || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ ...slab, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Identity — one job: name the board */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0, background: "linear-gradient(135deg,#0B3D27,#0F5535)", color: "#fff" }}>
          <KickerLine kicker={kicker} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 className="nv-h" style={{ margin: 0, fontFamily: HEADING, fontSize: 20, fontWeight: 700, lineHeight: 1.35, color: "#fff" }}>{boardTitle}</h1>
            <StatutoryItem decisionId="18632" ar={ar} entitlement glow={nightGlow} compact />
          </div>
          <span style={{ fontSize: 12.5, color: "#C5DBCD", lineHeight: 1.7 }}>
            {ar ? (
              <>
                {canEdit ? "جدول الفرع الذي تديره" : "جدول فرعك فقط — الجداول الأخرى من الإدارة"}
                {" · "}
                <Link to="/app/attendance" style={{ color: "#fff", fontWeight: 700 }}>الحضور</Link>
                {" يلتقط · "}
                <Link to="/app/calendar" style={{ color: "#fff", fontWeight: 700 }}>التقويم التشغيلي</Link>
                {" يثبت."}
              </>
            ) : (
              <>
                {canEdit ? "The branch you manage" : "Your branch only — other rosters stay with management"}
                {" · "}
                <Link to="/app/attendance" style={{ color: "#fff", fontWeight: 700 }}>Attendance</Link>
                {" captures · "}
                <Link to="/app/calendar" style={{ color: "#fff", fontWeight: 700 }}>the operational calendar</Link>
                {" confirms."}
              </>
            )}
          </span>
        </div>

        {/* Planning chrome — month → week → publish */}
        <div
          style={{
            padding: "14px 22px 16px",
            borderTop: "1px solid var(--nv-line2, #EEF2F7)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 0,
          }}
        >
          {manageMonth ? (
            <>
              {/* 1. Pick month */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "stretch",
                    border: "1px solid var(--nv-line, #E2E8F0)",
                    borderRadius: DS_CONTROL_RADIUS,
                    overflow: "hidden",
                    background: "var(--nv-card, #fff)",
                    flex: "0 1 auto",
                    maxWidth: "100%",
                  }}
                >
                  <button type="button" onClick={() => moveMonth(-1)} style={{ fontFamily: "inherit", padding: "10px 12px", border: "none", background: "transparent", color: "var(--nv-ink2)", cursor: "pointer" }} aria-label={ar ? "الشهر السابق" : "Previous month"}>{ar ? "›" : "‹"}</button>
                  <button
                    type="button"
                    onClick={jumpToThisMonth}
                    title={ar ? "ارجع للشهر الجاري" : "Back to this month"}
                    style={{
                      fontFamily: "inherit",
                      padding: "8px 14px",
                      border: "none",
                      borderInline: "1px solid var(--nv-line, #E2E8F0)",
                      background: "transparent",
                      cursor: "pointer",
                      color: "var(--nv-ink)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      alignItems: "center",
                      whiteSpace: "nowrap",
                      minWidth: 132,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{monthLabel}</span>
                    <span style={{ fontSize: 10, color: "var(--nv-ink3, var(--nv-muted))" }}>{ar ? "نطاق التخطيط الشهري" : "Monthly planning scope"}</span>
                  </button>
                  <button type="button" onClick={() => moveMonth(1)} style={{ fontFamily: "inherit", padding: "10px 12px", border: "none", background: "transparent", color: "var(--nv-ink2)", cursor: "pointer" }} aria-label={ar ? "الشهر التالي" : "Next month"}>{ar ? "‹" : "›"}</button>
                </div>
              </div>

              {/* 2. Pick week */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--nv-ink3, var(--nv-muted))", letterSpacing: ".02em" }}>
                  {ar ? "أسبوع داخل الشهر" : "Week in month"}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flex: "1 1 auto",
                      minWidth: 0,
                      flexWrap: "wrap",
                      overflowX: "auto",
                      scrollbarWidth: "thin",
                      WebkitOverflowScrolling: "touch",
                      paddingBottom: 1,
                    }}
                  >
                    {monthWeeks.map((start) => {
                      const key = weekKeyFromDate(start);
                      const on = weekKeyFromDate(weekStart) === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setWeekStart(weekStartDate(start))}
                          style={chipBtn(on)}
                          title={formatWeekLabel(start, ar)}
                        >
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatWeekTabLabel(start, ar)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "inline-flex", gap: 4, flex: "0 0 auto" }}>
                    <button type="button" onClick={() => moveWeek(-1)} style={{ ...chipBtn(false), padding: "6px 10px" }} aria-label={ar ? "الأسبوع السابق" : "Previous week"}>{ar ? "›" : "‹"}</button>
                    <button type="button" onClick={() => moveWeek(1)} style={{ ...chipBtn(false), padding: "6px 10px" }} aria-label={ar ? "الأسبوع التالي" : "Next week"}>{ar ? "‹" : "›"}</button>
                  </div>
                </div>
              </div>

              {/* 3. Publish — month reuse lives under سريان الجدول */}
              {(canEdit) ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    paddingTop: 10,
                    borderTop: "1px solid var(--nv-line2, #EEF2F7)",
                    marginTop: 2,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={doPublish}
                      disabled={publishLocked}
                      style={publishActionBtn({
                        published: published && pub.kind === "published",
                        locked: publishLocked,
                      })}
                    >
                      {publishLabel}
                    </button>
                  </div>
                  {blockers ? (
                    <PublishGateAlertStrip
                      blockers={gates.blockers}
                      countLabel={publishBlockerLabel}
                      ar={ar}
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "stretch",
                  border: "1px solid var(--nv-line, #E2E8F0)",
                  borderRadius: DS_CONTROL_RADIUS,
                  overflow: "hidden",
                  background: "var(--nv-card, #fff)",
                  maxWidth: "100%",
                }}
              >
                <button type="button" onClick={() => moveWeek(-1)} style={{ fontFamily: "inherit", padding: "10px 12px", border: "none", background: "transparent", color: "var(--nv-ink2)", cursor: "pointer" }}>{ar ? "›" : "‹"}</button>
                <button type="button" onClick={() => setWeekStart(weekStartDate(new Date()))} title={ar ? "ارجع للأسبوع الجاري" : "Back to this week"} style={{ fontFamily: "inherit", padding: "8px 14px", border: "none", borderInline: "1px solid var(--nv-line, #E2E8F0)", background: "transparent", cursor: "pointer", color: "var(--nv-ink)", display: "flex", flexDirection: "column", gap: 1, alignItems: "center", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: thisWeekNow ? "var(--nv-ink)" : "var(--nv-ink2)" }}>{thisWeek}</span>
                  <span style={{ fontSize: 10, color: "var(--nv-ink3, var(--nv-muted))" }}>{formatWeekLabel(weekStart, ar)}</span>
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderInlineEnd: "1px solid var(--nv-line, #E2E8F0)", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 10, color: "var(--nv-ink3, var(--nv-muted))" }}>{ar ? "اقفز" : "Jump"}</span>
                  <div style={{ width: 168 }}>
                    <PlatformDateField
                      compact
                      ar={ar}
                      allowClear={false}
                      value={weekDateKeys(weekStart)[0]}
                      onChange={(next) => {
                        if (!next) return;
                        setWeekStart(weekStartDate(next));
                      }}
                    />
                  </div>
                </label>
                <button type="button" onClick={() => moveWeek(1)} style={{ fontFamily: "inherit", padding: "10px 12px", border: "none", background: "transparent", color: "var(--nv-ink2)", cursor: "pointer" }}>{ar ? "‹" : "›"}</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="nv-ops-cal-board">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${SW.soft}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{assignmentsTitle}</span>
                <span style={{ fontSize: 12, color: SW.muted }}>{gridNote}</span>
              </div>
              {canEdit ? (
              <div style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setBrush(null)} style={chipBtn(brush === null)}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--nv-mute-fill)" }} />
                  {ar ? "تبديل بالترتيب" : "Cycle in order"}
                </button>
                {types.map((shift, index) => {
                  const style = shiftTypeStyle(shift, index);
                  return (
                    <button key={shift.id} type="button" onClick={() => setBrush(shift.id)} style={chipBtn(brush === shift.id)}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: style.fg }} />
                      {shift.label}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setBrush("")} style={chipBtn(brush === "")}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: REST_STYLE.fg }} />
                  {ar ? "راحة" : "Rest"}
                </button>
              </div>
              ) : null}
            </div>
            <div style={{ padding: "12px 16px 4px" }}>
              <PublishedWeekMinistryStrip facts={ministryFacts} ar={ar} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "128px repeat(7,minmax(70px,1fr))", background: "var(--nv-card)", borderBottom: `1px solid ${SW.line}`, minWidth: 620 }}>
                <span style={{ background: "var(--nv-soft)", padding: "8px 14px", fontSize: 11, color: SW.muted, borderTop: `1px solid ${SW.line}` }}>{ar ? "الموظف" : "Employee"}</span>
                {days.map((day) => {
                  const holiday = !!isOfficialHoliday(day.key, laborCalendar);
                  return (
                    <span key={day.key} style={{ background: holiday ? "var(--nv-shift-head-holiday)" : "var(--nv-soft)", padding: "8px 4px", textAlign: "center", display: "flex", flexDirection: "column", gap: 1, alignItems: "center", borderTop: `1px solid ${SW.line}`, borderBottom: `1px solid ${SW.line}`, borderInlineStart: `1px solid var(--nv-line2)` }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: holiday ? "var(--nv-shift-holiday-ink)" : (day.weekend ? SW.muted : SW.mid) }}>{weekdayLabel(day.wd, ar)}</span>
                      <span dir="ltr" style={{ ...mono, fontSize: 10, color: SW.muted }}>{day.day}</span>
                    </span>
                  );
                })}
              </div>
              {roster.length === 0 && (
                <div style={{ padding: "18px 20px", background: SW.card, fontSize: 13, color: SW.mid, lineHeight: 1.8 }}>
                  {stationName
                    ? (ar ? `لا موظفون على جدول فرع ${stationName} هذا الأسبوع.` : `Nobody is on the ${stationName} roster this week.`)
                    : (ar ? "لا موظفون على هذا الجدول." : "Nobody is on this roster.")}
                </div>
              )}
              {roster.map((employee) => {
                const hours = employeeWeekHours(schedule, employee.id, weekStart, employee, laborCalendar);
                const mineRow = isViewerOwnFile(employee, currentUser);
                const nightMark = rosterNightRowMark({ employee, schedule, weekStart, laborCalendar });
                return (
                  <div key={employee.id} style={{ display: "grid", gridTemplateColumns: "128px repeat(7,minmax(70px,1fr))", background: "var(--nv-card)", borderBottom: "1px solid var(--nv-line2)", minWidth: 620 }}>
                    <span
                      className="nv-roster-person"
                      data-glow={nightMark.nameGlow ? "due" : "off"}
                      title={nightMark.nameGlow
                        ? (ar ? "تنبيه: يحتاج متابعة قبل العمل الليلي" : "Alert: needs attention before night work")
                        : undefined}
                      style={{
                        background: nightMark.nameGlow
                          ? "var(--nv-bad-soft)"
                          : SW.card,
                        padding: nightMark.nameGlow ? "5px 10px 8px" : "8px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        minWidth: 0,
                        boxShadow: "none",
                      }}
                    >
                      <span
                        className="nv-roster-name"
                        style={{ fontSize: 12, fontWeight: 600, color: SW.ink, display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, maxWidth: "100%", overflow: "visible" }}
                      >
                        {nightMark.nameGlow ? <span className="nv-roster-alert-dot" aria-hidden /> : null}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "1 1 auto" }}>{employee.name}</span>
                        {mineRow ? <FileSelfBadge ar={ar} /> : null}
                      </span>
                      <span dir="ltr" style={{ ...mono, fontSize: 10, color: hours > 48 ? "var(--nv-bad-ink)" : SW.muted }}>{hours} {ar ? "س" : "h"}{hours > 48 ? (ar ? " · تجاوز 48" : " · over 48") : ""}</span>
                    </span>
                    {days.map((day) => {
                      const leave = leaveOnDayView(employee, day.key, ar, laborCalendar);
                      const shift = leave ? null : shiftOn(employee, day);
                      const style = leave ? leave.style : (shift ? shiftTypeStyle(shift, types.findIndex((row) => row.id === shift.id)) : REST_STYLE);
                      const locked = !!leave;
                      const cellAlert = weekCellAlert(gates, employee.id, day.key);
                      const cellTone = weekCellAlertTone(cellAlert);
                      const cellReason = cellAlert?.hint
                        || (cellAlert
                          ? (gates.checks.find((row) => row.id === cellAlert.id)?.title || "")
                          : "");
                      const leaveLockNote = leave?.source === "official_holiday"
                        ? (ar ? `${leave.type} · مقفلة` : `${leave.type} · locked`)
                        : (ar ? "اعتُمدت في طلباتي · مقفلة" : "approved in My Requests · locked");
                      const unpublishedCell = !published && !canEdit && !shift && !leave;
                      const restLabel = unpublishedCell ? (ar ? "بلا جدول" : "No roster") : (ar ? "راحة" : "Rest");
                      const baseTitle = locked
                        ? `${employee.name} — ${day.key} — ${leave.type}${leave.article ? ` · ${leave.article}` : ""} · ${leaveLockNote}`
                        : `${employee.name} — ${day.key} — ${shift ? `${shift.label} ${shiftHoursLine(shift, lang, timeFormat)}` : restLabel}`;
                      return (
                        <button
                          key={`${employee.id}-${day.key}`}
                          type="button"
                          disabled={!canEdit || locked}
                          onClick={() => { if (!locked) cycleCell(employee, day); }}
                          title={cellReason ? `${baseTitle} · ${cellReason}` : baseTitle}
                          style={{
                            fontFamily: "inherit",
                            border: leave?.source === "official_holiday"
                              ? "1.5px solid var(--nv-shift-holiday-ink, #6B5320)"
                              : leave
                                ? "1.5px dashed var(--nv-shift-leave-line, #B99656)"
                                : cellTone
                                  ? `1px solid ${cellTone.line || SW.line}`
                                  : "none",
                            borderInlineStart: leave || cellTone ? undefined : "1px solid var(--nv-line2)",
                            borderRadius: leave ? 8 : 0,
                            margin: leave ? 3 : 0,
                            background: leave?.source === "official_holiday"
                              ? "var(--nv-shift-holiday)"
                              : leave
                                ? "var(--nv-shift-leave)"
                                : (cellTone ? cellTone.soft : style.bg),
                            color: leave?.source === "official_holiday"
                              ? "var(--nv-shift-holiday-ink)"
                              : (cellTone ? cellTone.ink : style.fg),
                            cursor: canEdit && !locked ? "pointer" : locked ? "not-allowed" : "default",
                            padding: "6px 4px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 3,
                            minHeight: 60,
                            justifyContent: "center",
                            position: "relative",
                            boxShadow: "none",
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{leave ? leave.type : (shift ? shift.label : restLabel)}</span>
                          {leave?.articleId ? (
                            <StatutoryItem article={leave.articleId} ar={ar} entitlement compact surface="leave" />
                          ) : (
                            <span style={{ fontSize: 9, opacity: 0.85, lineHeight: 1.45, fontWeight: 500 }} dir={ar ? "rtl" : "ltr"}>
                              {shift ? <ShiftHoursLabel shift={shift} lang={lang} format={timeFormat} /> : ""}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "12px 20px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              {types.map((shift, index) => {
                const style = shiftTypeStyle(shift, index);
                return (
                  <span key={shift.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--nv-ink3)" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: style.bg, border: `1px solid ${style.color}`, boxSizing: "border-box" }} />
                    {shift.label}
                  </span>
                );
              })}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--nv-ink3)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: REST_STYLE.bg, border: `1px solid ${REST_STYLE.color}`, boxSizing: "border-box" }} />
                {ar ? "راحة" : "Rest"}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--nv-ink3)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: LEAVE_STYLE.bg, border: `1px solid ${LEAVE_STYLE.color}`, boxSizing: "border-box" }} />
                {ar ? "إجازة معتمدة (طلباتي)" : "Approved leave (My Requests)"}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--nv-ink3)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: LEAVE_STYLE.bg, border: `1px solid ${LEAVE_STYLE.color}`, boxSizing: "border-box" }} />
                {ar ? "إجازة اليوم الوطني · يوم التأسيس · العيد" : "National Day · Founding Day · Eid leave"}
              </span>
              <Link
                to="/app/requests"
                style={{
                  fontFamily: "inherit",
                  fontSize: 11,
                  padding: "6px 11px",
                  border: `1px dashed ${LEAVE_STYLE.color}`,
                  background: LEAVE_STYLE.bg,
                  color: LEAVE_STYLE.fg,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {ar ? "الإجازات المعتمدة من طلباتي" : "Approved leave from My Requests"}
              </Link>
              <span style={{ marginInlineStart: "auto", fontSize: 11, color: SW.muted, lineHeight: 1.7 }}>
                {canEdit
                  ? (brush != null
                    ? (ar ? `اضغط أي خلية لتعيين «${brushLabel}». ${WEEK_HINT_ADMIN_AR}` : `Click a cell to assign “${brushLabel}”. Leave and holiday cells stay locked. The week does not publish over 48 hours or a morning shift straight after a night.`)
                    : (ar ? WEEK_HINT_ADMIN_AR : "Click a cell to cycle rest, morning, evening, night. Holiday and leave cells stay locked. The week does not publish over 48 hours or a morning shift straight after a night."))
                  : (published
                    ? (ar ? WEEK_HINT_EMP_AR : "This is your published roster. Ask for a shift change or leave from My Requests. Leave cells stay locked.")
                    : (ar ? "هذا الأسبوع لم يُنشر بعد — لا وردية منشورة اليوم، و«حضر» يبقى مغلقاً. الإجازة من «طلباتي»." : "This week is not published yet — no published shift today, and check-in stays closed. Leave is requested from My Requests."))}
              </span>
            </div>
            {restJumpNote ? (
              <div role="status" style={{ ...statusBannerQuiet.warn, margin: "0 20px 12px", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
                <span style={{ flex: 1, textAlign: "start" }}>{restJumpNote}</span>
                <button
                  type="button"
                  onClick={() => setRestJumpNote("")}
                  style={{ fontFamily: "inherit", border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  {ar ? "إخفاء" : "Dismiss"}
                </button>
              </div>
            ) : null}
            <div style={{ padding: "0 20px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setReqOpen((v) => !v)} style={chipBtn(reqOpen)}>
                {ar ? "اطلب تغيير وردية" : "Request a shift change"}
              </button>
              <Link to="/app/requests" style={{ fontSize: 11, color: SW.ink, fontWeight: 600, alignSelf: "center" }}>
                {ar ? "طلباتي" : "My requests"}
              </Link>
            </div>
            {reqOpen && (
              <div style={{ margin: "0 20px 16px", padding: 14, background: SW.wash, border: `1px solid ${SW.line}`, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "اليوم" : "Day"}</span>
                  <PlatformDateField ar={ar} value={reqForm.date} onChange={(next) => setReqForm((f) => ({ ...f, date: next }))} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "الوردية المطلوبة" : "Requested shift"}</span>
                  <select value={reqForm.shiftTypeId} onChange={(e) => setReqForm((f) => ({ ...f, shiftTypeId: e.target.value }))} style={{ fontFamily: "inherit", fontSize: 12, padding: 8, border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink }}>
                    <option value="">{ar ? "راحة" : "Rest"}</option>
                    {types.map((shift) => <option key={shift.id} value={shift.id}>{shift.label} · {shiftHoursLine(shift, lang, timeFormat)}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "السبب" : "Reason"}</span>
                  <input value={reqForm.reason} onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))} placeholder={ar ? "لماذا هذا التغيير؟" : "Why this change?"} style={{ fontFamily: "inherit", fontSize: 12, padding: 8, border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink }} />
                </label>
                <button type="button" onClick={submitShiftRequest} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "none", borderRadius: 10, background: "var(--nv-ok-fill)", color: "var(--nv-btn-ink)", cursor: "pointer" }}>
                  {ar ? "أرسل للاعتماد" : "Submit for approval"}
                </button>
              </div>
            )}
          </section>

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${SW.soft}`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "من كان على الوردية؟" : "Who was on shift?"}</span>
                <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>{histScope}</span>
              </div>
              <div style={{ marginInlineStart: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 168 }}>
                  <PlatformDateField compact ar={ar} value={histFrom} onChange={setHistFrom} />
                </div>
                <span style={{ fontSize: 11, color: SW.muted }}>→</span>
                <div style={{ width: 168 }}>
                  <PlatformDateField compact ar={ar} value={histTo} min={histFrom} onChange={setHistTo} />
                </div>
                <button type="button" onClick={() => setHistMode("emp")} style={chipBtn(histMode === "emp")}>{ar ? "حسب الموظف" : "By person"}</button>
                <button type="button" onClick={() => setHistMode("day")} style={chipBtn(histMode === "day")}>{ar ? "حسب اليوم" : "By day"}</button>
                <input value={histQuery} onChange={(e) => setHistQuery(e.target.value)} placeholder={ar ? "ابحث بالاسم" : "Search a name"} style={{ fontFamily: "inherit", fontSize: 11, padding: "6px 9px", border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", outline: "none", width: 120, borderRadius: DS_CONTROL_RADIUS }} />
              </div>
            </div>
            {histMode === "emp" && history.workDays > 0 && history.rows.length > 0 ? (
              <div style={{ padding: "12px 20px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(92px,1.2fr) minmax(0,4fr) 50px", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{ar ? "الموظف" : "Employee"}</span>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${history.days.length},minmax(0,1fr))`, gap: 3 }}>
                    {history.days.map((day) => (
                      <span
                        key={`h-head-${day.key}`}
                        title={historyColumnLabel(day, ar)}
                        style={{
                          textAlign: "center",
                          color: "var(--nv-ink3)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: 1,
                          minHeight: 28,
                          minWidth: 0,
                          lineHeight: 1.2,
                        }}
                      >
                        <span dir="ltr" style={{ fontSize: 10, fontWeight: 600 }}>{day.day}</span>
                        <span style={{ fontSize: 9, fontWeight: 500, whiteSpace: "nowrap" }}>{weekdayLabel(day.wd, ar)}</span>
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--nv-ink3)", textAlign: "left" }}>{ar ? "ساعات" : "Hours"}</span>
                </div>
                {history.rows.map((row) => (
                  <div key={row.employee.id} style={{ display: "grid", gridTemplateColumns: "minmax(92px,1.2fr) minmax(0,4fr) 50px", gap: 10, alignItems: "center" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
                      <span style={{ fontSize: 10, color: "var(--nv-ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.summary}</span>
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${history.days.length},minmax(0,1fr))`, gap: 3 }}>
                      {row.cells.map((cell, index) => (
                        <span
                          key={`${row.employee.id}-h-${index}`}
                          title={cell.tip}
                          style={{
                            height: 28,
                            background: cell.bg,
                            border: `1px solid ${cell.border}`,
                            borderRadius: DS_CONTROL_RADIUS,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 600,
                            color: cell.color,
                          }}
                        >
                          {cell.mark}
                        </span>
                      ))}
                    </div>
                    <span dir="ltr" style={{ ...mono, fontSize: 12, color: "var(--nv-ink)", textAlign: "left" }}>{row.hours}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 8 }}>
                  {types.map((shift, index) => {
                    const style = shiftTypeStyle(shift, index);
                    return (
                      <span key={`hist-leg-${shift.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--nv-ink3)" }}>
                        <span style={{ width: 12, height: 12, borderRadius: 4, background: style.bg, border: `1px solid ${style.color}`, boxSizing: "border-box" }} />
                        {shift.label}
                      </span>
                    );
                  })}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--nv-ink3)" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: LEAVE_STYLE.bg, border: `1px solid ${LEAVE_STYLE.color}`, boxSizing: "border-box" }} />
                    {ar ? "إجازة" : "Leave"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--nv-ink3)" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: REST_STYLE.bg, border: `1px solid ${REST_STYLE.color}`, boxSizing: "border-box" }} />
                    {ar ? "راحة" : "Rest"}
                  </span>
                </div>
              </div>
            ) : null}
            {histMode === "day" && history.workDays > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {history.dayRows.map((day) => (
                  <div key={day.label} style={{ padding: "11px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "minmax(84px,auto) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink)", whiteSpace: "nowrap" }}>{day.label}</span>
                      <span style={{ fontSize: 10, color: "var(--nv-ink3)" }}>{day.count} {ar ? "على وردية" : "on shift"}</span>
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                      {day.empty && <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{ar ? "لا أحد على وردية" : "Nobody on shift"}</span>}
                      {day.groups.map((group) => (
                        <div key={group.name} style={{ display: "grid", gridTemplateColumns: "78px minmax(0,1fr)", gap: 9, alignItems: "start" }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: group.fg, background: group.bg, border: `1px solid ${group.color}`, borderRadius: DS_PILL_RADIUS, padding: "2px 9px", textAlign: "center", whiteSpace: "nowrap" }}>{group.name}</span>
                          <span style={{ fontSize: 11, color: "var(--nv-ink)", lineHeight: 1.8 }}>{group.names}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ padding: "12px 20px" }}>
              <span style={{ fontSize: 10, color: "var(--nv-ink3)", lineHeight: 1.85 }}>{histNote}</span>
            </div>
          </section>

          <LawGatesPanels
            gates={gates}
            company={data}
            onDate={days[0]?.key || weekStart}
            ar={ar}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {days.some((day) => isRamadanDay(day.key, laborCalendar)) ? (
            <LaborCalendarCard
              companyId={companyId}
              laborCalendar={laborCalendar}
              year={Number(String(days[0]?.key || "").slice(0, 4))}
              canEdit={canEditOwnerBoard(currentUser, data)}
              ar={ar}
              onSaved={() => refresh?.()}
            />
          ) : null}
          {mode === "mine" ? (
            <FileHoursAlertsRail
              employee={employees.find((row) => isViewerOwnFile(row, currentUser)) || currentUser}
              schedule={schedule}
              weekStart={weekStart}
              currentUser={currentUser}
              lang={lang}
              laborCalendar={laborCalendar}
              gates={gates}
              station={station}
              settings={data?.settings}
              company={data}
              canApplyOrdinary={canEdit}
              onApplyOrdinary={(employee, kind, dateKey) => applyOrdinaryHours(employee, kind, dateKey)}
              quietEdge
            />
          ) : (
            <ManagerDutyAlertsRail
              weekStart={weekStart}
              lang={lang}
              gates={gates}
              employees={roster}
              canApplyOrdinary={canEdit}
              onApplyOrdinary={(employee, kind, dateKey) => applyOrdinaryHours(employee, kind, dateKey)}
              onNightRemedy={(employee, kind, extra) => applyNightRemedy(employee, kind, extra)}
            />
          )}

          {mode !== "mine" ? (
          <>
          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "مصدر الوقت" : "Clock source"}</span>
            </div>
            {[
              [ar ? "مصدر الساعة" : "The clock", ar ? "الجدول المنشور — لا ساعة شركة افتراضية." : "The published roster — no company default hour."],
              [ar ? "شرط الوردية" : "Shift required", ar ? "إلزامي للفروع الثابتة، اختياري للمواقع الميدانية المتنقلة." : "Required at fixed stations; optional at mobile field sites."],
              [ar ? "التأخير" : "Lateness", ar ? "من أول دقيقة بعد بداية الوردية المنشورة. لا حدّ سماح." : "From the first minute after the published shift start. No grace."],
              [ar ? "الغياب" : "Absence", ar ? "وردية منشورة بلا تسجيل ولا إجازة معتمدة ولا إجازة اليوم الوطني أو يوم التأسيس أو العيد." : "A published shift with no punch, no approved leave, and no National Day / Founding Day / Eid leave."],
              [ar ? "العمل الليلي" : "Night work", ar ? "التنبيه عند الاستحقاق في الشريط وطلباتي — لا يُرسم على صف الجدول." : "Due alerts live on the rail and in My Requests — not on roster rows."],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "12px 18px", borderBottom: `1px solid ${SW.row}`, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{value}</span>
              </div>
            ))}
            <div style={{ padding: "12px 18px" }}>
              <span style={{ fontSize: 11, color: SW.gold, lineHeight: 1.85 }}>
                {ar ? "الحضور بلا وردية منشورة لا يُحسب تأخيراً ولا غياباً — يُسجَّل بعلامة «بلا جدول» ويذهب للمدير." : "A punch without a published shift is neither late nor absent — it is flagged as unscheduled and sent to the manager."}
              </span>
            </div>
          </section>

          <section data-night-settings="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--nv-line, #E2E8F0)" }}>
              <strong style={{ fontSize: 14, fontWeight: 700, color: "var(--nv-ink, #14284B)" }}>
                {ar ? "إعداد الليل" : "Night settings"}
              </strong>
            </div>
            {canEdit ? (
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line, #E2E8F0)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink, #14284B)" }}>
                  {ar ? "تعويض ليلي لهذا الجدول" : "Night compensation on this roster"}
                </span>
                <p style={{ margin: 0, fontSize: 12, color: "var(--nv-ink2, #334155)", lineHeight: 1.7 }}>
                  {ar
                    ? "للإدارة اختيار تقليص ساعة أو ساعتين أو ثلاث من وردية الموظف، أو بدل أجر أو نقل بمبلغ يُصرف مع الراتب، أو تغيير العمل الليلي. التقليص والبدل يُسحبان للبدء من جديد. زر الجدول أدناه يسجّل سياسة الفرع فقط. بعد ثلاثة أشهر يبقى التدوير أو موافقة الموظف الخطية."
                    : "Management chooses a cut of one, two, or three hours from this person's shift, a pay or transport allowance that pays with salary, or a change of night work. A reduction or allowance can be withdrawn to start over. The roster button below only records the station policy. After three months, rotation or the worker's written consent still applies."}
                </p>
                <button
                  type="button"
                  dir={ar ? "rtl" : "ltr"}
                  onClick={() => {
                    setScheduleNightCompensation(companyId, stationId, !schedule?.nightCompensation);
                    refresh?.();
                  }}
                  style={nightSettingRowStyle()}
                >
                  <LawGateStatusPill
                    status={schedule?.nightCompensation ? "settled" : "void"}
                    label={schedule?.nightCompensation ? (ar ? "مسجّل" : "On file") : (ar ? "بلا أثر" : "No effect")}
                    ar={ar}
                  />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.7, color: "var(--nv-ink2, #334155)", textAlign: ar ? "right" : "left" }}>
                    {schedule?.nightCompensation
                      ? (ar ? "تعويض ليلي مسجّل — اضغط للإلغاء" : "Night compensation on file — click to clear")
                      : (ar ? "سجّل تعويضاً ليلياً لهذا الجدول" : "Record night compensation on this roster")}
                  </span>
                  <LawGateArticleBadge article="18632" />
                </button>
                {withdrawableNightRemedyEmployees(roster).map((emp) => {
                  const remedy = activeNightRemedy(emp);
                  const remedySummary = remedy?.kind === "reduce"
                    ? (ar
                      ? `تقليص ${nightCutHoursLabel(remedy.cutHours, true) || "ساعات"}`
                      : `${nightCutHoursLabel(remedy.cutHours, false) || "hours"} reduced`)
                    : (ar
                      ? nightAllowancePayLabel(remedy.amount, remedy.allowanceKind, true)
                      : nightAllowancePayLabel(remedy.amount, remedy.allowanceKind, false));
                  return (
                    <LawGateAlertRow
                      key={emp.id}
                      slab
                      ar={ar}
                      status="settled"
                      pillLabel={ar ? "مسجّل" : "On file"}
                      summary={(
                        <span>
                          <strong style={{ color: "var(--nv-ink, #14284B)" }}>{emp.name}</strong>
                          {" — "}
                          {remedySummary}
                        </span>
                      )}
                    >
                      <button type="button" onClick={() => applyNightRemedy(emp, "withdraw")} style={{ ...nightSettingGhostBtn(), alignSelf: "start" }}>
                        {ar ? "سحب والبدء من جديد" : "Withdraw and start over"}
                      </button>
                    </LawGateAlertRow>
                  );
                })}
              </div>
            ) : schedule?.nightCompensation ? (
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line, #E2E8F0)" }}>
                <LawGateAlertRow
                  slab
                  ar={ar}
                  status="settled"
                  pillLabel={ar ? "مسجّل" : "On file"}
                  article="18632"
                  summary={ar ? "تعويض ليلي مسجّل على هذا الجدول." : "Night compensation is on file for this roster."}
                />
              </div>
            ) : null}
            {canEdit ? (
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink, #14284B)" }}>
                  {ar ? "التزامات المنشأة لليل" : "Night workplace duties"}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {NIGHT_FACILITY_FLAGS.map((flag) => {
                    const on = !!(schedule?.[flag.key] || data?.nightFacilities?.[flag.key]);
                    return (
                      <button
                        key={flag.key}
                        type="button"
                        dir={ar ? "rtl" : "ltr"}
                        onClick={() => {
                          setNightFacilityFlag(companyId, { stationId, key: flag.key, on: !schedule?.[flag.key] });
                          refresh?.();
                        }}
                        style={nightSettingRowStyle()}
                      >
                        <LawGateStatusPill
                          status={on ? "settled" : "void"}
                          label={on ? (ar ? "مسجّل" : "On file") : (ar ? "بلا أثر" : "No effect")}
                          ar={ar}
                        />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.7, color: "var(--nv-ink2, #334155)", textAlign: ar ? "right" : "left" }}>
                          {ar ? flag.ar : flag.en}
                        </span>
                        <LawGateArticleBadge article="18632" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "أنواع الورديات" : "Shift types"}</span>
            </div>
            {types.map((shift, index) => {
              const style = shiftTypeStyle(shift, index);
              return (
                <div key={shift.id} style={{ padding: "11px 18px", borderBottom: `1px solid ${SW.row}`, display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto auto", gap: 8, alignItems: "center" }}>
                    <span style={{ width: 9, height: 9, background: style.color, flex: "none" }} />
                    <input
                      value={shift.label}
                      disabled={!canEdit}
                      onChange={(e) => { updateShiftType(companyId, stationId, shift.id, { label: e.target.value }); refresh?.(); }}
                      style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: SW.ink, border: "1px solid transparent", background: "none", outline: "none", padding: "3px 4px", minWidth: 0, width: "100%" }}
                    />
                    <span style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
                      <span style={{ ...mono, fontSize: 11, color: SW.mid }}>{shiftHours(shift)} {ar ? "س" : "h"}</span>
                      {canEdit ? (
                        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: SW.mid }}>
                          <span>{ar ? "راحة" : "rest"}</span>
                          <input
                            type="number"
                            min={0}
                            step={15}
                            value={shift.restMinutes ?? 30}
                            aria-label={ar ? `راحة ${shift.label || "الوردية"} بالدقيقة` : `${shift.label || "Shift"} rest minutes`}
                            onChange={(e) => {
                              updateShiftType(companyId, stationId, shift.id, { restMinutes: Math.max(0, Number(e.target.value) || 0) });
                              refresh?.();
                            }}
                            style={{ ...mono, width: 52, fontSize: 11, padding: "2px 4px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none" }}
                          />
                          <span>{ar ? "د" : "m"}</span>
                        </label>
                      ) : (
                        <span style={{ fontSize: 10, color: SW.mid, background: "var(--nv-mute-soft)", border: "1px solid var(--nv-mute-line)", borderRadius: 999, padding: "1px 7px" }}>
                          {ar ? `راحة ${shift.restMinutes ?? 30} د` : `${shift.restMinutes ?? 30}m rest`}
                        </span>
                      )}
                    </span>
                    {canEdit && (
                      <ConfirmDeleteDialog
                        title={ar ? "حذف نوع الوردية؟" : "Delete this shift type?"}
                        description={ar
                          ? `سيُحذف «${shift.label || "الوردية"}» ${shiftHoursLine(shift, lang, timeFormat) || "—"}، وتُرفع تعييناتها من الجدول.`
                          : `“${shift.label || "Shift"}” ${shiftHoursLine(shift, lang, timeFormat) || "—"} will be removed, and its assignments cleared.`}
                        confirmLabel={ar ? "تأكيد الحذف" : "Confirm delete"}
                        trigger={(
                          <button type="button" title={ar ? "حذف النوع" : "Delete type"} aria-label={ar ? "حذف نوع الوردية" : "Delete shift type"} style={{ fontFamily: "inherit", fontSize: 12, border: `1px solid ${SW.line}`, background: SW.card, color: SW.abs, cursor: "pointer", width: 24, height: 24, padding: 0, flex: "none" }}>×</button>
                        )}
                        onConfirm={() => { removeShiftType(companyId, stationId, shift.id); refresh?.(); }}
                      />
                    )}
                  </div>
                  {canEdit && (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 5 }}>
                      <label style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 6, alignItems: "center", minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "من" : "From"}</span>
                        <input type="time" value={shift.start || ""} onChange={(e) => {
                          if (!e.target.value) return;
                          updateShiftType(companyId, stationId, shift.id, { start: e.target.value });
                          refresh?.();
                        }} style={{ ...mono, fontSize: 11, padding: "5px 6px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }} />
                      </label>
                      <label style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 6, alignItems: "center", minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "إلى" : "To"}</span>
                        <input type="time" value={shift.end || ""} onChange={(e) => {
                          if (!e.target.value) return;
                          updateShiftType(companyId, stationId, shift.id, { end: e.target.value });
                          refresh?.();
                        }} style={{ ...mono, fontSize: 11, padding: "5px 6px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }} />
                      </label>
                      <label style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 6, alignItems: "center", minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "مكان" : "Place"}</span>
                        <select
                          value={shift.outdoor === true ? "outdoor" : shift.outdoor === false ? "indoor" : ""}
                          onChange={(e) => {
                            const next = e.target.value === "outdoor" ? true : e.target.value === "indoor" ? false : null;
                            updateShiftType(companyId, stationId, shift.id, { outdoor: next });
                            refresh?.();
                          }}
                          aria-label={ar ? "مكان العمل: داخلي أو ميدان مكشوف" : "Work place: indoor or open-air"}
                          style={{ fontFamily: "inherit", fontSize: 11, padding: "5px 6px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }}
                        >
                          <option value="">{ar ? "غير محدد — حظر الشمس يحتاج وسمًا" : "Unset — sun ban needs a mark"}</option>
                          <option value="indoor">{ar ? "داخلي — لا حظر شمس" : "Indoor — sun ban does not apply"}</option>
                          <option value="outdoor">{ar ? "ميدان مكشوف — قرار 3337" : "Open-air — decision 3337"}</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <div style={{ padding: "11px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = nextDistinctShift(types, ar);
                    if (!next) return;
                    addShiftType(companyId, stationId, { ...next, restMinutes: next.restMinutes ?? ruleValue("hours.rest.duringShiftMinutes") });
                    refresh?.();
                  }}
                  style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 12px", border: "1px dashed var(--nv-line)", background: SW.card, color: SW.ink, cursor: "pointer" }}
                >
                  {ar ? "+ أضف نوع وردية" : "+ Add a shift type"}
                </button>
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{ar ? "تغيير الوقت يعيد حساب الساعات ويعيد الجدول إلى مسودة — الوردية المنشورة لا تتغيّر بأثر رجعي." : "Changing the time recalculates hours and returns the week to draft — a published shift never changes retroactively."}</span>
              </div>
            )}
            {canEdit && (
              <div style={{ padding: "14px 18px", borderTop: `1px solid ${SW.soft}`, display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "سريان الجدول" : "Roster validity"}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: DS_PILL_RADIUS,
                      border: `1px solid ${SW.greenBd}`,
                      background: SW.greenBg,
                      color: SW.ink,
                    }}
                  >
                    {ar ? "شهري" : "Monthly"}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.7 }}>
                  {ar
                    ? "نمط الشهر المعروض هو مصدر السريان. انسخه أو أعد الشهر السابق — نشر الأسابيع وقرار 18632 لا يتغيّران."
                    : "This month's pattern is the validity source. Copy it or reuse the previous month — weekly publish and Decision 18632 stay the same."}
                </span>
                {[
                  {
                    id: "prev",
                    ready: sourcePrevHas,
                    label: ar ? "أعد الشهر السابق" : "Reuse previous month",
                    note: ar
                      ? `ينسخ تعيينات ${formatMonthLabel(prevMonth.year, prevMonth.monthIndex, true)} إلى ${monthLabel}`
                      : `Copies ${formatMonthLabel(prevMonth.year, prevMonth.monthIndex, false)} into ${monthLabel}`,
                    empty: ar
                      ? `لا تعيينات مؤرخة في ${formatMonthLabel(prevMonth.year, prevMonth.monthIndex, true)}`
                      : `No dated assignments in ${formatMonthLabel(prevMonth.year, prevMonth.monthIndex, false)}`,
                    onClick: () => doReuseMonth("prev"),
                  },
                  {
                    id: "repeat",
                    ready: sourceCurrentHas,
                    label: ar ? "كرر هذا الشهر" : "Repeat this month",
                    note: ar
                      ? `ينسخ ${monthLabel} إلى ${formatMonthLabel(nextMonth.year, nextMonth.monthIndex, true)}`
                      : `Copies ${monthLabel} into ${formatMonthLabel(nextMonth.year, nextMonth.monthIndex, false)}`,
                    empty: ar
                      ? `لا تعيينات مؤرخة في ${monthLabel}`
                      : `No dated assignments in ${monthLabel}`,
                    onClick: () => doReuseMonth("repeat"),
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={option.onClick}
                    title={option.ready ? option.note : option.empty}
                    style={{
                      fontFamily: "inherit",
                      textAlign: "start",
                      fontSize: 12,
                      padding: "10px 12px",
                      border: `1px solid ${option.ready ? SW.greenBd : SW.soft}`,
                      background: option.ready ? SW.greenBg : SW.card,
                      color: SW.ink,
                      cursor: "pointer",
                      borderRadius: DS_RADIUS,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <span style={{ fontWeight: option.ready ? 700 : 600 }}>{option.label}</span>
                    <span style={{ fontSize: 10, color: SW.muted, lineHeight: 1.6 }}>
                      {option.ready ? option.note : option.empty}
                    </span>
                  </button>
                ))}
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>
                  {ar
                    ? "تغيير الوقت يعيد حساب الساعات ويعيد الجدول إلى مسودة — الوردية المنشورة لا تتغيّر بأثر رجعي."
                    : "Changing the time recalculates hours and returns the roster to draft — a published shift never changes retroactively."}
                </span>
              </div>
            )}
          </section>

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "حصيلة الأسبوع" : "Week total"}</span>
            </div>
            {[
              [ar ? "ساعات مجدولة" : "Scheduled hours", String(gates.totalHours), ar ? "مجموع الأسبوع" : "Week sum", SW.ink],
              [ar ? "تعيينات" : "Assignments", String(gates.assigned), ar ? "خلية غير «راحة»" : "Non-rest cells", SW.ink],
              [ar ? "تجاوز السقف" : "Over the cap", String(gates.overCap.length), ar ? "أكثر من 48 ساعة" : "Over 48 hours", gates.overCap.length ? SW.abs : SW.green],
              (() => {
                const approved = gates.approvedLeaveDays || 0;
                const holiday = gates.officialHolidayLeaveDays || 0;
                const total = gates.leaveDays || 0;
                if (!total) {
                  return [ar ? "أيام إجازة خارج الساعات" : "Leave days outside hours", "0", ar ? "لا إجازات هذا الأسبوع" : "No leave this week", SW.green];
                }
                const note = [
                  approved ? (ar ? `${approved} معتمدة من طلباتي` : `${approved} approved from My Requests`) : "",
                  holiday
                    ? (ar
                      ? `${holiday} ${(gates.holidayLeaveNames || []).join(" · ") || "إجازة اليوم الوطني / يوم التأسيس / العيد"} (م112)`
                      : `${holiday} ${(gates.holidayLeaveNames || []).join(" · ") || "National Day / Founding Day / Eid leave"} (Art. 112)`)
                    : "",
                ].filter(Boolean).join(ar ? " · " : " · ")
                  || (ar ? "خارج حساب الساعات" : "Outside hours");
                return [ar ? "أيام إجازة خارج الساعات" : "Leave days outside hours", String(total), note, "#6b5730"];
              })(),
            ].map(([label, value, note, color]) => (
              <div key={label} style={{ padding: "12px 18px", borderBottom: `1px solid ${SW.row}`, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "baseline" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 10, color: SW.muted, lineHeight: 1.7 }}>{note}</span>
                </span>
                <span dir="ltr" style={{ ...mono, fontSize: 17, color }}>{value}</span>
              </div>
            ))}
            <div style={{ padding: "12px 18px" }}>
              <div role="status" style={blockers ? statusBannerQuiet.warn : published ? statusBannerQuiet.ok : statusBannerQuiet.warn}>
                {blockers
                  ? (ar ? "النشر متوقّف — الموانع ظاهرة في شريط التخطيط أعلاه." : "Publish is stopped — blockers sit in the planning strip above.")
                  : published
                    ? (ar ? "الجدول منشور — التقويم التشغيلي يحسب التأخير والغياب منه." : "Published — the operational calendar measures lateness and absence from it.")
                    : (ar ? "لا موانع. انشر ليصبح هذا الجدول مصدر الوقت للأسبوع." : "No blockers. Publish to make this week the clock.")}
              </div>
            </div>
          </section>
          </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
