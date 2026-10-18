import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Sun } from "lucide-react";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  addShiftType,
  copyScheduleMonth,
  publishWeek,
  removeShiftType,
  setEmployeeDayShift,
  decideNightRemedy,
  withdrawNightRemedy,
  submitOtherRequest,
  openDueNightRotateCycles,
  setSunExposure,
  updateShiftType,
  confirmHolidayWork,
} from "@/lib/store";
import PrayerTimeSetting from "@/components/schedules/PrayerTimeSetting";
import WorkPostingSetting from "@/components/schedules/WorkPostingSetting";
import HoursBasisSetting from "@/components/schedules/HoursBasisSetting";
import { HOLIDAY_WORK_LABEL_AR, HOLIDAY_WORK_LABEL_EN, holidayWorkOn, prayerBreakHint } from "@/lib/shiftWeek";
import { stationPrayerTimes } from "@/lib/prayerTimes";
import NvIcon from "@/components/shared/NvIcon";
import { hoursPolicyOf, isJuvenile as isJuvenileOn, weekHoursCap } from "@/lib/laborHoursPolicy.js";
import ShiftBreakMode from "@/components/schedules/ShiftBreakMode";
import { nextDistinctShift, repairedShiftWindow, STANDARD_SHIFT_WINDOWS, formatShiftHm, shiftHoursLine, shiftWindowKey } from "@/lib/shiftDerivations";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import {
  buildHistory,
  checkShiftChangeApplyGate,
  checkWeekPublishGates,
  copyMonthReuseNote,
  cycleShiftId,
  ordinaryShiftTypes,
  resolveNightRestAssignTarget,
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
  heatSeasonNoticeCopy,
  nextSunExposureMark,
  sunExposureCellState,
  SUN_FIELD,
  SUN_OFFICE,
  shiftTouchesHeatWindow,
  weekSunExposureCounts,
  publishedViewSchedule,
} from "@/lib/shiftWeek";
import { checkSubmitOtherRequestGate } from "@/lib/otherRequestDerivations";
import { heatBanWindow, isHeatBanDate } from "@/lib/contractLawDerivations";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { toast } from "@/components/ui/use-toast";
import StatutoryItem from "@/components/labor/StatutoryItem";
import { canEditOwnerBoard } from "@/lib/ownerBoard";
import LaborCalendarCard from "@/components/hr/LaborCalendarCard";
import { rosterNightRowMark, statutoryGlowState } from "@/lib/statutoryItem";
import { citeRule, isRamadanDay, ruleValue } from "@/lib/laborRules";
import { restCountMismatch } from "@/lib/leaveEidOverlap.js";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import FileHoursAlertsRail from "@/components/employees/FileHoursAlertsRail";
import { NameLetter, RosterLegend, rosterTileStyle, shiftKindOf, TileBody, TILE_GAP } from "@/components/schedules/rosterTile";
import { FileSelfBadge } from "@/components/employees/ProfileHero";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { statusBannerQuiet } from "@/lib/platformStyles";
import { publishedWeekMinistryFacts } from "@/lib/rosterMinistrySurface";
import LawGateAlertRow from "@/components/shared/LawGateAlertRow";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { WEEK_HINT_ADMIN_AR, WEEK_HINT_EMP_AR } from "@/lib/packageMinistryCatalog";
import ScheduleCompliancePanel, { useComplianceSummary } from "@/components/schedules/ScheduleCompliancePanel";
import AttendanceSectionFrame from "@/components/attendance/AttendanceSectionFrame";
import { DutyHeadline, DutyNumber, DutyTile, DutyTiles } from "@/components/schedules/DutyTiles";
import { dutyTone } from "@/components/schedules/dutyStatus";
import ManageDutySide, { attendanceQueueCount, PendingDutyRequestsCard, pendingRequestCount, useManagedDutyPeople } from "@/components/schedules/ManageDutySide";
import { dateFromKey, revealNode } from "@/components/schedules/dutyLinks";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";
import ScheduleHowItWorks from "@/components/schedules/ScheduleHowItWorks";
import MyScheduleView from "@/components/schedules/MyScheduleView";
import DateNav, { DateNavChips, WeekRangeText } from "@/components/schedules/DateNav";
import {
  chip,
  chipButton,
  Collapsible,
  ghostButton,
  mono,
  prefersReducedMotion,
  quietAction,
  SectionHead,
  slab,
  sourceBadge,
} from "@/components/schedules/scheduleChrome";

const clockMono = { ...mono, fontVariantNumeric: "tabular-nums" };
/** Chip geometry shared with the compliance panel — 24px, control radius. */


/** «11 – 17» — en dash, digits isolated; the RTL row puts the start day on the right. */
function WeekTabLabel({ weekStart, ar = true }) {
  return <WeekRangeText weekStart={weekStart} ar={ar} />;
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

/** Quiet toggle row — LawGateAlertRow slab: card fill, control radius 10, status only on 999 chip. */

function countAr(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export default function ShiftWeekBoard({
  schedule: liveSchedule,
  employees = [],
  stationId,
  stationName = "",
  companyId,
  currentUser,
  canEdit = false,
  mode = "manage",
  lang = "ar",
  kicker,
  gridTitle,
  gridLead,
  manageLink = null,
  scopeNote = null,
}) {
  const ar = lang === "ar";
  // Deep links: ?week= opens that week, ?emp= that person's row, ?src= the filtered compliance panel, ?day= (جدولي) that day.
  const [searchParams] = useSearchParams();
  const linkWeek = dateFromKey(searchParams.get("week"));
  const linkEmp = searchParams.get("emp") || "";
  const linkSrc = searchParams.get("src") || "";
  const linkDay = searchParams.get("day") || "";
  const { format: timeFormat } = useTimeFormat();
  const { refresh, data } = useAuth();
  const laborCalendar = laborCalendarOf(data);
  const station = (data?.stations || []).find((row) => String(row.id) === String(stationId));
  const manageMonth = mode === "manage";
  /** «empId:dayKey» of the cell that just entered the sun-ban window and is asking مكشوف / مظلّل. */
  const [sunPrompt, setSunPrompt] = useState(null);
  // Art. 107(3): «عمل في العطلة» is armed on the first click and confirmed on the second.
  const [holidayArm, setHolidayArm] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => monthCursorOf(new Date()));
  const [weekStart, setWeekStart] = useState(() => (
    linkWeek
      ? weekStartDate(linkWeek)
      : manageMonth
      ? defaultWeekStartForMonth(new Date().getFullYear(), new Date().getMonth())
      : weekStartDate(new Date())
  ));
  // The employee lane reads the PUBLISHED copy of a week: a manager's unpublished edit stays his draft
  // until he publishes it (the snapshot is taken at publish). The management lane edits the live roster.
  const schedule = useMemo(
    () => (mode === "mine" ? publishedViewSchedule(liveSchedule, weekStart) : liveSchedule),
    [mode, liveSchedule, weekStart],
  );
  const [brush, setBrush] = useState(null);
  const [restJumpNote, setRestJumpNote] = useState("");
  const [histFrom, setHistFrom] = useState(() => calendarDateKey(new Date(Date.now() - 18 * 86400000)));
  const [histTo, setHistTo] = useState(() => calendarDateKey(new Date()));
  const [histMode, setHistMode] = useState("emp");
  const [histQuery, setHistQuery] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState({ date: calendarDateKey(new Date()), shiftTypeId: "", reason: "" });
  const complianceRef = useRef(null);
  const [complianceFlash, setComplianceFlash] = useState(false);
  const [complianceSource, setComplianceSource] = useState(() => (["18632", "3337", "labour", "all"].includes(linkSrc) ? linkSrc : "all"));
  const [focusEmp, setFocusEmp] = useState(linkEmp);
  const gridRef = useRef(null);

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

  const published = pub.kind === "published" || pub.kind === "implicit" || (mode === "mine" && !!pub.snap?.assignments);
  // Counted per person per rule (two night workers missing 18632 = two), not per rule — read from
  // the same cell marks the grid paints; a rule with no cell (a station gate) still counts once.
  const blockerPairs = new Set(
    Object.entries(gates?.cellMarks || {})
      .filter(([, mark]) => mark?.level === "block")
      .map(([cellKey, mark]) => `${String(cellKey).split(":")[0]}|${mark.id}`),
  );
  const blockedIds = new Set([...blockerPairs].map((pair) => pair.split("|")[1]));
  const blockers = blockerPairs.size + gates.blockers.filter((row) => !blockedIds.has(row.id)).length;
  // A published week that now fails a gate is not «before publish» — it is live and breaks a rule.
  const publishBlockerLabel = blockers
    ? (published
      ? (ar
        ? `يخالف الآن: ${countAr(blockers, "مانع واحد", "مانعان", "موانع", "مانعاً")}`
        : `Now breaks: ${blockers}`)
      : (ar
        ? `${countAr(blockers, "مانع واحد", "مانعان", "موانع", "مانعاً")} قبل النشر`
        : `${blockers} blockers before publish`))
    : "";
  const publishLabel = published && pub.kind === "published"
    ? (ar ? "منشور — الحضور يقرأ منه" : "Published — attendance reads this")
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
  // The week totals sit in «أسبوع الفرع»; the grid head keeps only its lead line.
  void countsNote;
  const gridNote = [gridLead].filter(Boolean).join(" · ");
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

  const todayCellKey = calendarDateKey(new Date());
  const cycleCell = (employee, day) => {
    if (!canEdit || !companyId || !stationId) return;
    // A day that has passed is history — attendance, payroll and the 18632 count already read it.
    if (day.key < todayCellKey) {
      toast({ description: ar ? "يوم مضى — لا يُعدَّل جدوله. التصحيح يكون بطلب بصمة يدوية أو قرار في حضور الفريق." : "A past day — its roster is not edited. Correct it with a manual punch request or a decision on Team attendance.", variant: "destructive" });
      return;
    }
    const current = shiftOn(employee, day);
    const ordinaryOnly = employeeNeedsNightRotateChoice(employee, schedule, day.key);
    let nextId = cycleShiftId(types, current?.id || null, brush, {
      onDate: day.key,
      ordinaryOnly,
    });
    // Cycle mode: step to the next option that fits THIS cell as-is (rest always fits). A type the
    // 18632 resolver would move to another day or swap is skipped, so the click never lands elsewhere
    // and «راحة» stays reachable.
    let skippedNote = "";
    if (brush == null) {
      const pool = ordinaryOnly ? ordinaryShiftTypes(types, day.key) : types;
      const order = [...pool.map((row) => row.id), null];
      const start = Math.max(0, order.indexOf(nextId));
      for (let step = 0; step < order.length; step += 1) {
        const candidate = order[(start + step) % order.length];
        if (candidate == null) { nextId = null; break; }
        const probe = resolveNightRestAssignTarget({ schedule, employee, dateKey: day.key, shiftTypeId: candidate, laborCalendar, weekStart, ordinaryOnly });
        if (probe.ok && !probe.jumped) { nextId = candidate; break; }
        if (!skippedNote) {
          const label = types.find((row) => row.id === candidate)?.label || "";
          skippedNote = ar
            ? `«${label}» لا يناسب هذه الخانة (راحة 12 ساعة بين الورديات — القرار 18632)، فانتقلنا للخيار التالي.`
            : `“${label}” does not fit this cell (12-hour rest — Decision 18632); moved to the next option.`;
        }
      }
    }
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
    // 3337 — the moment a cell enters the midday ban window in season, the cell itself asks مكشوف / مظلّل.
    const placedShift = placeId ? types.find((row) => row.id === placeId) : null;
    const placedDay = schedule?.sunExposure?.[placeKey];
    const alreadyPicked = !!placedDay && Object.prototype.hasOwnProperty.call(placedDay, String(employee.id)) && !!placedDay[String(employee.id)];
    setSunPrompt(placedShift && shiftTouchesHeatWindow(placedShift) && isHeatBanDate(placeKey) && !alreadyPicked
      ? `${employee.id}:${placeKey}`
      : null);
    const draftKey = `${employee.id}:${placeKey}`;
    setDraft((prev) => {
      const next = { ...prev, [draftKey]: placeId };
      if (result.clearedSource) next[`${employee.id}:${day.key}`] = null;
      return next;
    });
    if (skippedNote && !result.jumped) toast({ description: skippedNote });
    if (result.jumped) {
      const note = ar ? result.reason : result.reasonEn;
      setRestJumpNote(note);
      toast({ description: note });
    } else {
      setRestJumpNote("");
    }
  };

  const confirmHolidayCell = (employee, day) => {
    if (!canEdit || !companyId || !stationId) return;
    const key = `${employee.id}:${day.key}`;
    if (holidayArm !== key) {
      setHolidayArm(key);
      return;
    }
    setHolidayArm("");
    const shiftId = (brush && types.some((row) => row.id === brush)) ? brush : (ordinaryShiftId(types, "morning", day.key) || types[0]?.id || null);
    const result = confirmHolidayWork(companyId, stationId, day.key, employee.id, shiftId, { by: currentUser?.name, weekStart });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({ description: ar ? `${employee.name} — ${HOLIDAY_WORK_LABEL_AR}. تُسجَّل عند النشر بانتظار قرار الصرف.` : `${employee.name} — ${HOLIDAY_WORK_LABEL_EN}. Recorded on publish awaiting the pay decision.` });
    refresh?.();
  };

  const applyOrdinaryHours = (employee, kind, dateKey) => {
    if (!canEdit || !companyId || !stationId || !employee?.id) return { ok: false };
    // Only days not yet begun: a past night is history, and tonight's night is not turned into a
    // morning that already started.
    const dates = (dateKey ? [dateKey] : weekNightDateKeys(schedule, employee.id, weekStart))
      .filter((key) => key > todayCellKey);
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
      weekStart,
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
          ? (ar ? "دُوِّر هذا الموظف إلى مسائي لتجاوز ثلاثة أشهر دون موافقة. وردية الليل بقيت على الجدول." : "This person's nights this week were moved to evening.")
          : (ar ? "دُوِّر هذا الموظف إلى صباحي لتجاوز ثلاثة أشهر دون موافقة. وردية الليل بقيت على الجدول." : "This person's nights this week were moved to morning."),
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
        weekStart,
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
      const result = withdrawNightRemedy(companyId, employee.id, { actorId: currentUser?.id, weekStart });
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
      weekStart,
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
    toast({ description: ar ? "نُشر الجدول — الحضور يلتقط منه." : "Roster published — attendance captures from it." });
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

  const scrollToCompliance = () => {
    const node = complianceRef.current;
    if (!node) return;
    try {
      node.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    } catch {
      node.scrollIntoView();
    }
    setComplianceFlash(true);
    window.setTimeout(() => setComplianceFlash(false), 1600);
  };
  /** Side column / tiles / ?src= — filter the panel and bring it into view. */
  const pickSource = (next) => {
    setComplianceSource(next || "all");
    scrollToCompliance();
  };
  /** «في الجدول ›» on a compliance card — that person's row, on the week the card is about. */
  const focusPerson = (employeeId, onDate) => {
    const target = dateFromKey(onDate);
    if (target && !weekKeys.includes(calendarDateKey(target))) setWeekStart(weekStartDate(target));
    setFocusEmp(String(employeeId || ""));
  };
  useEffect(() => {
    if (!linkSrc || mode === "mine") return undefined;
    if (["18632", "3337", "labour", "all"].includes(linkSrc)) setComplianceSource(linkSrc);
    const id = window.setTimeout(scrollToCompliance, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkSrc, mode]);
  useEffect(() => {
    if (!focusEmp || mode === "mine") return undefined;
    const id = window.setTimeout(() => {
      const node = gridRef.current?.querySelector(`[data-roster-row="${CSS.escape(String(focusEmp))}"]`);
      revealNode(node);
    }, 250);
    return () => window.clearTimeout(id);
  }, [focusEmp, weekStart, mode]);

  // A second «افتح ›» while already on this page (same instance): follow the new ?week= / ?emp=.
  const linkWeekKey = searchParams.get("week") || "";
  useEffect(() => {
    const target = dateFromKey(linkWeekKey);
    if (target) setWeekStart(weekStartDate(target));
  }, [linkWeekKey]);
  useEffect(() => {
    if (linkEmp) setFocusEmp(linkEmp);
  }, [linkEmp]);

  const complianceSummary = useComplianceSummary({
    gates,
    company: data,
    onDate: days[0]?.key || weekStart,
    weekStart,
    employees: roster,
    ar,
  });
  const managedPeople = useManagedDutyPeople();
  const sideQueue = useMemo(
    () => (mode === "mine" ? 0 : attendanceQueueCount(managedPeople, listLocalTodayAttendance(companyId, data), data)),
    [mode, managedPeople, companyId, data],
  );
  const sideRequests = mode === "mine" ? 0 : pendingRequestCount(managedPeople);

  const pubState = pub.kind === "published"
    ? { tone: "ok", label: ar ? "منشور" : "Published" }
    : pub.kind === "edited"
      ? { tone: "warn", label: ar ? "تعديل غير منشور" : "Unpublished edit" }
      : pub.kind === "implicit"
        ? { tone: "mute", label: ar ? "أسبوع ماضٍ" : "Past week" }
        : { tone: "mute", label: ar ? "مسودة" : "Draft" };

  const nowForNav = new Date();
  const onCurrentMonth = monthCursor.year === nowForNav.getFullYear() && monthCursor.monthIndex === nowForNav.getMonth();
  const monthNav = (
    <DateNav
      mode="month"
      ar={ar}
      value={new Date(monthCursor.year, monthCursor.monthIndex, 1)}
      onPrev={() => moveMonth(-1)}
      onNext={() => moveMonth(1)}
      onToday={jumpToThisMonth}
      isCurrent={onCurrentMonth && thisWeekNow}
      onPick={(picked) => {
        const delta = (picked.getFullYear() - monthCursor.year) * 12 + (picked.getMonth() - monthCursor.monthIndex);
        if (delta) moveMonth(delta);
      }}
    />
  );

  const weekChips = (
    <DateNavChips
      ar={ar}
      items={monthWeeks.map((start) => {
        const key = weekKeyFromDate(start);
        return {
          key,
          on: weekKeyFromDate(weekStart) === key,
          onClick: () => setWeekStart(weekStartDate(start)),
          title: formatWeekLabel(start, ar),
          label: <WeekTabLabel weekStart={start} ar={ar} />,
        };
      })}
    />
  );

  // Prayer times for the branch's city on the day the editor reads (today when in the shown week).
  const hintDay = (() => {
    const today = calendarDateKey(new Date());
    const keys = weekDays(weekStart).map((day) => day.key);
    return keys.includes(today) ? today : keys[0];
  })();
  const hintPrayers = station ? stationPrayerTimes(station, hintDay, { ramadan: isRamadanDay(hintDay, laborCalendar) }) : null;
  const continuous103 = hoursPolicyOf(data).continuousWork103 === true;
  const shiftTypesEditor = (
    <>
      {mode !== "mine" ? <HoursBasisSetting ar={ar} data={data} companyId={companyId} canEdit={canEdit} onDate={hintDay} refresh={refresh} /> : null}
      <PrayerTimeSetting ar={ar} data={data} companyId={companyId} canEdit={canEdit} refresh={refresh} />
      {mode !== "mine" ? <WorkPostingSetting ar={ar} onDate={hintDay} /> : null}
      {types.map((shift, index) => {
        const style = shiftTypeStyle(shift, index);
        const breakHint = prayerBreakHint({ shift, onDate: hintDay, prayers: hintPrayers, company: data, published });
        return (
          <div key={shift.id} style={{ padding: "10px 18px", borderBottom: `1px solid ${SW.hair}`, display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto auto", gap: 8, alignItems: "center" }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: style.color, flex: "none" }} />
              <input
                value={shift.label}
                disabled={!canEdit}
                onChange={(e) => { updateShiftType(companyId, stationId, shift.id, { label: e.target.value }); refresh?.(); }}
                style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: SW.ink, border: "1px solid transparent", background: "none", outline: "none", padding: "3px 4px", minWidth: 0, width: "100%", textAlign: "start" }}
              />
              <span style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 11, color: SW.mid }}><span style={mono}>{shiftHours(shift)}</span> {ar ? "س" : "h"}</span>
                {shift.breakMode === "flex" ? (
                  <span style={chip("mute", { fontSize: 10, fontWeight: 500 })}>
                    {ar ? `راحة ${shift.flexBreak?.minutes ?? "—"} د · المادة 101` : `${shift.flexBreak?.minutes ?? "—"}m rest · Art. 101`}
                  </span>
                ) : null}
              </span>
              {canEdit && (
                <ConfirmDeleteDialog
                  title={ar ? "حذف نوع الوردية؟" : "Delete this shift type?"}
                  description={ar
                    ? `سيُحذف «${shift.label || "الوردية"}» ${shiftHoursLine(shift, lang, timeFormat) || "—"}، وتُرفع تعييناتها من الجدول.`
                    : `“${shift.label || "Shift"}” ${shiftHoursLine(shift, lang, timeFormat) || "—"} will be removed, and its assignments cleared.`}
                  confirmLabel={ar ? "تأكيد الحذف" : "Confirm delete"}
                  trigger={(
                    <button type="button" title={ar ? "حذف النوع" : "Delete type"} aria-label={ar ? "حذف نوع الوردية" : "Delete shift type"} style={{ fontFamily: "inherit", fontSize: 12, border: `1px solid ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, background: SW.card, color: SW.abs, cursor: "pointer", width: 24, height: 24, padding: 0, flex: "none" }}>×</button>
                  )}
                  onConfirm={() => { removeShiftType(companyId, stationId, shift.id); refresh?.(); }}
                />
              )}
            </div>
            {canEdit && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 5 }}>
                <label style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 6, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "من" : "From"}</span>
                  <input type="time" dir="ltr" value={shift.start || ""} onChange={(e) => {
                    if (!e.target.value) return;
                    updateShiftType(companyId, stationId, shift.id, { start: e.target.value });
                    refresh?.();
                  }} style={{ ...mono, fontSize: 11, padding: "5px 6px", border: `1px solid ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, background: SW.card, color: SW.ink, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }} />
                </label>
                <label style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 6, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "إلى" : "To"}</span>
                  <input type="time" dir="ltr" value={shift.end || ""} onChange={(e) => {
                    if (!e.target.value) return;
                    updateShiftType(companyId, stationId, shift.id, { end: e.target.value });
                    refresh?.();
                  }} style={{ ...mono, fontSize: 11, padding: "5px 6px", border: `1px solid ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, background: SW.card, color: SW.ink, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }} />
                </label>
              </div>
            )}
            <ShiftBreakMode
              ar={ar}
              shift={shift}
              canEdit={false}
              continuous103={continuous103}
              onDate={hintDay}
              onChange={(updates) => { updateShiftType(companyId, stationId, shift.id, updates); refresh?.(); }}
            />
            {breakHint ? (
              <span data-roster-break-hint={shift.id} style={{ fontSize: 10.5, color: SW.mid, lineHeight: 1.7, display: "flex", gap: 5, alignItems: "baseline" }}>
                <NvIcon name="prayer" size={11} />
                <span>{ar ? breakHint.textAr : breakHint.textEn}{" "}<span style={{ color: SW.muted }}>{ar ? "(اقتراح غير ملزم)" : "(a suggestion, not binding)"}</span></span>
              </span>
            ) : null}
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
            style={{ ...ghostButton(), border: "1px dashed var(--nv-line)", padding: "8px 12px", fontSize: 12 }}
          >
            {ar ? "+ أضف نوع وردية" : "+ Add a shift type"}
          </button>
          <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{ar ? "تغيير الوقت يعيد حساب الساعات ويعيد الجدول إلى مسودة — الوردية المنشورة لا تتغيّر بأثر رجعي." : "Changing the time recalculates hours and returns the week to draft — a published shift never changes retroactively."}</span>
        </div>
      )}
    </>
  );

  const nightSettings = (
    <>
      {canEdit ? (
        <div style={{ padding: "10px 18px 12px", borderBottom: `1px solid ${SW.hair}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink, #14284B)" }}>
            {ar ? "تعويض ليلي لهذا الجدول" : "Night compensation on this roster"}
          </span>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
            {ar
              ? "للإدارة اختيار تقليص ساعة أو ساعتين أو ثلاث من وردية الموظف، أو بدل أجر أو نقل بمبلغ يُصرف مع الراتب، أو تغيير العمل الليلي. التقليص والبدل يُسحبان للبدء من جديد. يُسجَّل التعويض لكل موظف من «طلباتي ← طلبات العمل الليلي». بعد ثلاثة أشهر يبقى التدوير أو موافقة الموظف الخطية."
              : "Management chooses a cut of one, two, or three hours from this person's shift, a pay or transport allowance that pays with salary, or a change of night work. A reduction or allowance can be withdrawn to start over. Compensation is recorded per person from My requests → Night-work requests. After three months, rotation or the worker's written consent still applies."}
          </p>
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
                <button type="button" onClick={() => applyNightRemedy(emp, "withdraw")} style={{ ...ghostButton(), alignSelf: "start" }}>
                  {ar ? "سحب والبدء من جديد" : "Withdraw and start over"}
                </button>
              </LawGateAlertRow>
            );
          })}
        </div>
      ) : schedule?.nightCompensation ? (
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${SW.hair}` }}>
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
    </>
  );

  const heatWin = heatBanWindow(days[0]?.key || weekStart);
  const heatInSeason = days.some((d) => isHeatBanDate(d.key));
  const heatSeasonCopy = heatSeasonNoticeCopy(days[0]?.key || weekStart, { ar });
  const sunCounts = weekSunExposureCounts(schedule, roster, weekStart, { laborCalendar, shiftOf: (employee, day) => shiftOn(employee, day) });

  /** One cell toggle — writes the cell mark and remembers it as this person's default. */
  const cycleSunMark = (employee, day, current) => {
    if (!canEdit || !companyId || !stationId) return;
    setSunExposure(companyId, stationId, { employeeId: employee.id, dateKeys: [day.key], mark: nextSunExposureMark(current) });
    refresh?.();
  };
  /** Explicit pick from the cell: pressing the active side again clears it. */
  const pickSunMark = (employee, day, current, mark) => {
    if (!canEdit || !companyId || !stationId) return;
    setSunExposure(companyId, stationId, { employeeId: employee.id, dateKeys: [day.key], mark: current === mark ? "" : mark });
    refresh?.();
  };
  const answerSunPrompt = (employee, day, mark) => {
    if (canEdit && companyId && stationId) {
      setSunExposure(companyId, stationId, { employeeId: employee.id, dateKeys: [day.key], mark });
      refresh?.();
    }
    setSunPrompt(null);
  };
  /** Row action — pin one mark on every in-window, in-season cell of this person's week. */
  const applySunMarkToWeek = (employee, mark, keys) => {
    if (!canEdit || !companyId || !stationId || !keys.length) return;
    setSunExposure(companyId, stationId, { employeeId: employee.id, dateKeys: keys, mark });
    refresh?.();
    toast({
      description: ar
        ? `طُبّق «${mark === SUN_FIELD ? "مكشوف" : "مظلّل"}» على ${keys.length === 1 ? "يوم واحد" : keys.length === 2 ? "يومين" : `${keys.length} أيام`} لـ${employee.name} هذا الأسبوع.`
        : `Applied “${mark === SUN_FIELD ? "field" : "office"}” to ${keys.length} day(s) for ${employee.name} this week.`,
    });
  };
  const sunToggleSkin = (mark) => {
    const tone = mark === SUN_FIELD ? "bad" : mark === SUN_OFFICE ? "ok" : "warn";
    return chip(tone, {
      fontFamily: "inherit",
      cursor: canEdit ? "pointer" : "default",
      height: 20,
      padding: "0 6px",
      gap: 3,
      fontSize: 10,
      fontWeight: 700,
      justifyContent: "center",
      borderStyle: mark ? "solid" : "dashed",
    });
  };
  const sunMarkLabel = (mark) => (mark === SUN_FIELD
    ? (ar ? "مكشوف" : "Exposed")
    : mark === SUN_OFFICE ? (ar ? "مظلّل" : "Shaded") : (ar ? "غير محدد" : "Unset"));

  const heatWindowShiftsThisWeek = !heatInSeason && types.some((row) => shiftTouchesHeatWindow(row));
  const heatOffSeasonHint = heatWindowShiftsThisWeek && canEdit ? (
    <div data-heat-offseason="1" role="note" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: SW.muted, lineHeight: 1.7, padding: "6px 12px", border: `1px dashed ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, background: "var(--nv-card)" }}>
      <Sun aria-hidden style={{ width: 14, height: 14, flex: "none" }} strokeWidth={2} />
      <span>
        {ar
          ? `حظر العمل المكشوف (3337) غير ساري هذا الأسبوع — لا سؤال ولا منع. في الموسم (${heatWin.seasonAr.replace(/^من /u, "")}) تسأل كل خلية تمسّ ${heatWin.startLabel}–${heatWin.endLabel} «مكشوف أم مظلّل؟»، ولا يُنشر الأسبوع وفيه خلية بلا تحديد، ويصل تنبيه للإدارة وللموظف المكشوف.`
          : `The open-sun ban (3337) is not in force this week — no question, no block. In season every cell touching ${heatWin.startLabel}–${heatWin.endLabel} asks exposed or shaded, and the week does not publish with a cell left unset.`}
      </span>
    </div>
  ) : null;
  const heatNotice = heatInSeason ? (
    <div
      data-heat-season-notice="admin"
      role="note"
      style={{ ...statusBannerQuiet.warn, display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, lineHeight: 1.8, textAlign: "start" }}
    >
      <Sun aria-hidden style={{ width: 16, height: 16, flex: "none", marginTop: 3 }} strokeWidth={2} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>{heatSeasonCopy.headline}</strong>
        {" — "}
        {heatSeasonCopy.body}
        {" "}
        {ar ? "حدِّد «مكشوف» أو «مظلّل» من خلية كل موظف في الجدول." : "Mark each person exposed or shaded on their roster cell."}
      </span>
    </div>
  ) : null;

  const heatPlaces = (
    <div data-heat-explainer="1" style={{ padding: "10px 18px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 11.5, color: SW.muted, lineHeight: 1.75 }}>
        {ar ? (
          <>
            الموسم {heatWin.seasonAr.replace(/^من /u, "").replace(" إلى ", "–")} · النافذة <span dir="ltr" style={mono}>{heatWin.startLabel}–{heatWin.endLabel}</span>
          </>
        ) : (
          <>
            Season {heatWin.seasonEn.replace(/^from /u, "").replace(" to ", "–")} · window <span dir="ltr" style={mono}>{heatWin.startLabel}–{heatWin.endLabel}</span>
          </>
        )}
        {" "}
        <span style={chip(heatInSeason ? "warn" : "mute", { fontSize: 10 })}>
          {heatInSeason ? (ar ? "سارٍ هذا الأسبوع" : "In force this week") : (ar ? "خارج الموسم هذا الأسبوع" : "Out of season this week")}
        </span>
      </span>
      <div style={{ fontSize: 11.5, color: SW.mid, lineHeight: 1.8, background: SW.soft || "var(--nv-soft)", border: `1px solid ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, padding: "8px 10px" }}>
        {ar ? (
          <>
            <strong style={{ color: SW.ink }}>مكشوف</strong>: عمل تحت أشعة الشمس المباشرة في ساحة أو موقع غير مظلّل — يسري عليه الحظر.{" "}
            <strong style={{ color: SW.ink }}>مظلّل</strong>: عمل داخل مبنى أو تحت مظلّة تحجب الشمس — لا يسري عليه الحظر.
            <br />
            <strong style={{ color: SW.ink }}>التحديد من خانة الجدول نفسها:</strong> عندما تضع للموظف وردية تدخل ساعات الحظر في يوم داخل الموسم، تسألك الخانة تلقائيًا «مكشوف أم مظلّل؟». ولتغييره لاحقًا يبقى في أسفل الخانة زرّا «مكشوف» و«مظلّل». المسائي والليلي والأيام خارج الموسم لا يُسأل عنها.
          </>
        ) : (
          <>
            <strong style={{ color: SW.ink }}>The mark is set on the person&apos;s roster cell:</strong> one shift can hold field and office staff, so each person is marked per day. The toggle shows only on in-season cells that touch the window; evening and night are never asked. A person&apos;s last choice pre-fills their next days.
          </>
        )}
      </div>
      {heatInSeason ? (
        <div data-heat-counts="1" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: SW.muted }}>{ar ? "هذا الأسبوع:" : "This week:"}</span>
          <span style={chip("bad", { fontSize: 10.5 })}>{ar ? "مكشوف" : "Exposed"} <span dir="ltr" style={mono}>{sunCounts.field}</span></span>
          <span style={chip("ok", { fontSize: 10.5 })}>{ar ? "مظلّل" : "Shaded"} <span dir="ltr" style={mono}>{sunCounts.office}</span></span>
          <span style={chip(sunCounts.unset ? "warn" : "mute", { fontSize: 10.5 })}>{ar ? "بلا تحديد" : "Unset"} <span dir="ltr" style={mono}>{sunCounts.unset}</span></span>
        </div>
      ) : null}
    </div>
  );

  const rosterValidity = canEdit ? (
    <div style={{ padding: "10px 18px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
      <span style={{ fontSize: 11.5, color: SW.muted, lineHeight: 1.7 }}>
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
            padding: "9px 12px",
            border: "1px solid var(--nv-line)",
            background: SW.card,
            color: option.ready ? SW.ink : SW.muted,
            cursor: "pointer",
            borderRadius: DS_CONTROL_RADIUS,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span style={{ fontWeight: 600 }}>{option.label}</span>
          <span style={{ fontSize: 10.5, color: SW.muted, lineHeight: 1.6 }}>
            {option.ready ? option.note : option.empty}
          </span>
        </button>
      ))}
      <span style={{ fontSize: 11, color: SW.muted, lineHeight: 1.8 }}>
        {ar
          ? "تغيير الوقت يعيد حساب الساعات ويعيد الجدول إلى مسودة — الوردية المنشورة لا تتغيّر بأثر رجعي."
          : "Changing the time recalculates hours and returns the roster to draft — a published shift never changes retroactively."}
      </span>
    </div>
  ) : null;

  if (mode === "mine") {
    const me = roster.find((row) => isViewerOwnFile(row, currentUser))
      || employees.find((row) => isViewerOwnFile(row, currentUser))
      || currentUser;
    return (
      <MyScheduleView
        ar={ar}
        lang={lang}
        timeFormat={timeFormat}
        kicker={kicker}
        stationName={stationName}
        schedule={schedule}
        types={types}
        me={me}
        roster={roster}
        currentUser={currentUser}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        moveWeek={moveWeek}
        pub={pub}
        gates={gates}
        laborCalendar={laborCalendar}
        station={station}
        data={data}
        nightGlow={statutoryGlowState({ kind: "18632", employees: me ? [me] : [], schedule, weekStart, laborCalendar })}
        history={history}
        reqOpen={reqOpen}
        setReqOpen={setReqOpen}
        reqForm={reqForm}
        setReqForm={setReqForm}
        submitShiftRequest={submitShiftRequest}
        manageLink={manageLink}
        focusDay={linkDay}
      />
    );
  }

  return (
    <AttendanceSectionFrame
      ar={ar}
      lane="manage"
      title={ar ? "جدول الدوام — الأسبوع" : "Duty roster — the week"}
    >
    <div className="nv-sched" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {scopeNote}
      <section data-schedule-head="1" style={{ ...slab, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* One control bar — month → week on the start side, publish state on the end side */}
        <div
          data-schedule-controls="1"
          style={{
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          {manageMonth ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0, flex: "1 1 420px" }}>
                {monthNav}
                {weekChips}
              </div>
              {canEdit ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginInlineStart: "auto", minWidth: 0 }}>
                  <span data-publish-state={pub.kind} style={chip(pubState.tone)}>{pubState.label}</span>
                  {blockers ? (
                    <button
                      type="button"
                      data-publish-blockers={blockers}
                      onClick={scrollToCompliance}
                      title={ar ? "اذهب إلى أنظمة الوزارة — ما يخص الدوام" : "Go to ministry systems and alerts"}
                      style={chip("bad", { fontFamily: "inherit", cursor: "pointer" })}
                    >
                      {publishBlockerLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={doPublish}
                    disabled={publishLocked}
                    style={{
                      ...publishActionBtn({
                        published: published && pub.kind === "published",
                        locked: publishLocked,
                      }),
                      height: 32,
                      padding: "0 16px",
                    }}
                  >
                    {publishLabel}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <DateNav
              mode="week"
              ar={ar}
              value={weekStart}
              onPrev={() => moveWeek(-1)}
              onNext={() => moveWeek(1)}
              onToday={() => setWeekStart(weekStartDate(new Date()))}
              isCurrent={thisWeekNow}
              onPick={(picked) => setWeekStart(weekStartDate(picked))}
              note={thisWeekNow ? null : thisWeek}
            />
          )}
        </div>
      </section>

      {/* No tile row here: week status sits on the week bar, hours on the roster head, the rules in their panel. */}

      {heatNotice}

      <div className="nv-duty-board" data-duty-board="1">
        <div className="nv-duty-col" data-duty-main="1">
          <section ref={gridRef} data-roster-grid="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <SectionHead
              title={assignmentsTitle}
              note={gridNote}
              trailing={canEdit ? (
                <>
                  <button type="button" onClick={() => setBrush(null)} style={chipButton(brush === null)}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--nv-mute-fill)" }} />
                    {ar ? "تبديل بالترتيب" : "Cycle in order"}
                  </button>
                  {types.map((shift, index) => {
                    const style = shiftTypeStyle(shift, index);
                    return (
                      <button key={shift.id} type="button" onClick={() => setBrush(shift.id)} style={chipButton(brush === shift.id)}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: style.fg }} />
                        {shift.label}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setBrush("")} style={chipButton(brush === "")}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: REST_STYLE.fg }} />
                    {ar ? "راحة" : "Rest"}
                  </button>
                </>
              ) : null}
            />
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "150px repeat(7,minmax(74px,1fr))", background: "var(--nv-card)", borderBottom: `1px solid ${SW.line}`, minWidth: 700 }}>
                <span style={{ background: "var(--nv-soft)", padding: "8px 14px", fontSize: 11, color: SW.muted }}>{ar ? "الموظف" : "Employee"}</span>
                {days.map((day) => {
                  const holiday = !!isOfficialHoliday(day.key, laborCalendar);
                  return (
                    <span key={day.key} style={{ background: holiday ? "var(--nv-shift-head-holiday)" : "var(--nv-soft)", padding: "8px 4px", textAlign: "center", display: "flex", flexDirection: "column", gap: 1, alignItems: "center", borderInlineStart: `1px solid var(--nv-line2)` }}>
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
                const sunRow = days
                  .map((day) => {
                    if (leaveOnDayView(employee, day.key, ar, laborCalendar)) return null;
                    const daily = shiftOn(employee, day);
                    const state = daily ? sunExposureCellState(schedule, employee.id, day.key, { shift: daily }) : null;
                    return state?.asks ? { key: day.key, ...state } : null;
                  })
                  .filter(Boolean);
                const sunPick = schedule?.sunExposureDefault?.[employee.id]
                  || sunRow.find((row) => row.source === "cell" && row.mark)?.mark
                  || null;
                const sunWeekAction = canEdit && sunPick && sunRow.length > 1
                  && sunRow.some((row) => row.source !== "cell" || row.mark !== sunPick);
                const focused = focusEmp && String(focusEmp) === String(employee.id);
                return (
                  <div
                    key={employee.id}
                    data-roster-row={employee.id}
                    data-focus={focused ? "1" : undefined}
                    style={{ display: "grid", gridTemplateColumns: "150px repeat(7,minmax(74px,1fr))", background: "var(--nv-card)", borderBottom: "1px solid var(--nv-line2)", minWidth: 700, boxShadow: focused ? "inset 0 0 0 2px var(--nv-warn-fill)" : "none", scrollMarginTop: 96 }}
                  >
                    <span
                      className="nv-roster-person"
                      data-glow={nightMark.nameGlow ? "due" : "off"}
                      title={nightMark.nameGlow
                        ? (ar ? "تنبيه: يحتاج متابعة قبل العمل الليلي" : "Alert: needs attention before night work")
                        : undefined}
                      style={{
                        background: mineRow ? "var(--nv-ok-soft)" : SW.card,
                        padding: "8px 10px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        minWidth: 0,
                        boxShadow: "none",
                        borderInlineStart: nightMark.nameGlow ? "3px solid var(--nv-bad-fill)" : (mineRow ? "3px solid var(--nv-ok-fill)" : "3px solid transparent"),
                      }}
                    >
                      <NameLetter name={employee.name} mine={mineRow} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: "1 1 auto", alignSelf: "center" }}>
                      <span
                        className="nv-roster-name"
                        style={{ fontSize: 12, fontWeight: 600, color: SW.ink, display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, maxWidth: "100%", overflow: "visible" }}
                      >
                        <Link
                          to={`/app/employees/${encodeURIComponent(employee.id)}?tab=duty`}
                          title={ar ? `ملف الدوام — ${employee.name}` : `Duty file — ${employee.name}`}
                          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "1 1 auto", color: "inherit", textDecoration: "none" }}
                        >
                          {employee.name}
                        </Link>
                        {mineRow ? <FileSelfBadge ar={ar} /> : null}
                      </span>
                      {(() => {
                        const cap = weekHoursCap(employee, data, days.map((day) => day.key), laborCalendar).hours;
                        const over = Number.isFinite(cap) && Number(hours) > cap;
                        return <span style={{ fontSize: 10.5, color: over ? "var(--nv-bad-ink)" : SW.muted, textAlign: "start" }}><span dir="ltr" style={mono}>{hours}</span> {ar ? "س" : "h"}{over ? (ar ? <> · تجاوز <span dir="ltr" style={mono}>{cap}</span></> : <> · over <span dir="ltr" style={mono}>{cap}</span></>) : ""}</span>;
                      })()}
                      {(() => {
                        // The file sets how many rest days he has; a roster that leaves fewer is flagged here.
                        const workedDays = days.filter((day) => !leaveOnDayView(employee, day.key, ar, laborCalendar) && shiftOn(employee, day)).length;
                        const rc = restCountMismatch(data, employee, workedDays);
                        if (!rc.mismatch) return null;
                        const art = citeRule("hours.ot.premium", days[0]?.key)?.article || "";
                        const restWord = (n) => (n === 0 ? "بلا راحة" : n === 1 ? "يوم راحة" : "يوما راحة");
                        return (
                          <span
                            data-rest-mismatch={rc.extra}
                            title={ar
                              ? `ملف ${employee.name} يقرر ${rc.fileRest === 1 ? "يوم راحة واحداً" : "يومي راحة"} في الأسبوع، والجدول يعطيه ${rc.rosterRest === 0 ? "صفراً" : rc.rosterRest === 1 ? "يوماً واحداً" : `${rc.rosterRest}`}. ${rc.extra === 1 ? "يوم واحد" : `${rc.extra} أيام`} من أيام عمله عمل في يوم راحة — كل ساعاته إضافي${art ? ` (المادة ${art})` : ""}. غيّر الجدول أو ملف الموظف إن لم يكن مقصوداً.`
                              : `${employee.name}'s file sets ${rc.fileRest} rest day(s) a week; the roster leaves ${rc.rosterRest}. ${rc.extra} worked day(s) are rest days worked — all overtime${art ? ` (Art. ${art})` : ""}.`}
                            style={{ fontSize: 10, lineHeight: 1.45, color: "var(--nv-warn-ink, #7A4E0B)", textAlign: "start" }}
                          >
                            {ar
                              ? <>الملف: {restWord(rc.fileRest)} · الجدول: {restWord(rc.rosterRest)} — {rc.extra === 1 ? "يوم واحد" : rc.extra === 2 ? "يومان" : <><span dir="ltr" style={mono}>{rc.extra}</span> أيام</>} إضافي{art ? <span style={{ whiteSpace: "nowrap" }}> (م <span dir="ltr" style={mono}>{art}</span>)</span> : null}</>
                              : <>File: {rc.fileRest} rest · roster: {rc.rosterRest} — <span dir="ltr" style={mono}>{rc.extra}</span> day(s) OT{art ? ` (Art. ${art})` : ""}</>}
                          </span>
                        );
                      })()}
                      {sunWeekAction ? (
                        <button
                          type="button"
                          data-sun-week={sunPick}
                          onClick={() => applySunMarkToWeek(employee, sunPick, sunRow.map((row) => row.key))}
                          title={ar
                            ? `طبّق «${sunMarkLabel(sunPick)}» على كل أيام ${employee.name} التي تلمس نافذة الحظر هذا الأسبوع`
                            : `Apply “${sunMarkLabel(sunPick)}” to every in-window day for ${employee.name} this week`}
                          style={quietAction({ fontSize: 10, color: "var(--nv-ink2)", alignSelf: "flex-start", marginTop: 2, display: "inline-flex", alignItems: "center", gap: 3, textAlign: "start", whiteSpace: "normal", maxWidth: "100%" })}
                        >
                          <Sun aria-hidden style={{ width: 10, height: 10, flex: "none" }} strokeWidth={2.2} />
                          {ar ? `طبّق «${sunMarkLabel(sunPick)}» على الأسبوع` : `Apply “${sunMarkLabel(sunPick)}” to week`}
                        </button>
                      ) : null}
                      </span>
                    </span>
                    {days.map((day) => {
                      const leave = leaveOnDayView(employee, day.key, ar, laborCalendar);
                      const shift = leave ? null : shiftOn(employee, day);
                      const style = leave ? leave.style : (shift ? shiftTypeStyle(shift, types.findIndex((row) => row.id === shift.id)) : REST_STYLE);
                      const pastDay = day.key < todayCellKey;
                      const locked = !!leave || pastDay;
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
                      const baseTitle = leave
                        ? `${employee.name} — ${day.key} — ${leave.type}${leave.article ? ` · ${leave.article}` : ""} · ${leaveLockNote}`
                        : pastDay
                        ? `${employee.name} — ${day.key} — ${shift ? shift.label : restLabel} · ${ar ? "يوم مضى — مقفل" : "past day — locked"}`
                        : `${employee.name} — ${day.key} — ${shift ? `${shift.label} ${shiftHoursLine(shift, lang, timeFormat)}` : restLabel}`;
                      const sun = !leave && shift ? sunExposureCellState(schedule, employee.id, day.key, { shift }) : null;
                      const sunAsk = !!sun?.asks;
                      // «مكشوف / مظلّل» lives in the cell itself, all year, for any shift touching 12:00–15:00:
                      // required in the Decision 3337 season (asks), optional outside it.
                      const sunShow = !!sun?.touches;
                      return (
                        <div key={`${employee.id}-${day.key}`} style={{ position: "relative", display: "flex", minWidth: 0, padding: TILE_GAP, borderInlineStart: "1px solid var(--nv-line2)" }}>
                        <button
                          type="button"
                          disabled={!canEdit || locked}
                          onClick={() => { if (!locked) cycleCell(employee, day); }}
                          title={cellReason ? `${baseTitle} · ${cellReason}` : baseTitle}
                          data-roster-cell={leave?.source === "official_holiday" ? "holiday" : leave ? "leave" : shift ? "shift" : "rest"}
                          style={rosterTileStyle({
                            kind: leave?.source === "official_holiday" ? "holiday" : leave ? "leave" : shift ? "shift" : (unpublishedCell ? "empty" : "rest"),
                            style,
                            tone: !leave && cellTone ? cellTone : null,
                            mine: mineRow,
                            interactive: canEdit && !locked,
                            extra: {
                              cursor: canEdit && !locked ? "pointer" : locked ? "not-allowed" : "default",
                              paddingBottom: sunShow ? 32 : 7,
                            },
                          })}
                        >
                          <TileBody
                            kind={leave?.source === "official_holiday" ? "holiday" : leave ? "leave" : shift ? "shift" : (unpublishedCell ? "empty" : "rest")}
                            shiftKind={shiftKindOf(shift)}
                            label={leave ? leave.type : (shift ? shift.label : restLabel)}
                            shift={shift}
                            style={style}
                            lang={lang}
                            timeFormat={timeFormat}
                            compact
                          >
                            {leave?.articleId ? <StatutoryItem article={leave.articleId} ar={ar} entitlement compact surface="leave" /> : null}
                          </TileBody>
                        </button>
                        {leave?.source === "official_holiday" && canEdit && !pastDay && !isJuvenileOn(employee, day.key) ? (
                          <button
                            type="button"
                            data-holiday-work={holidayArm === `${employee.id}:${day.key}` ? "armed" : "1"}
                            onClick={(e) => { e.stopPropagation(); confirmHolidayCell(employee, day); }}
                            title={ar ? `${HOLIDAY_WORK_LABEL_AR} — العطلة إجازة بأجر كامل (المادة 112)؛ العمل فيها بتأكيد، وكل ساعاته إضافية.` : `${HOLIDAY_WORK_LABEL_EN} — the holiday is full-pay leave (Art. 112); working it needs confirmation and every hour is overtime.`}
                            style={{ position: "absolute", insetInline: 6, bottom: 5, zIndex: 2, fontFamily: "inherit", fontSize: 9, fontWeight: 600, lineHeight: 1.3, padding: "2px 4px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--nv-shift-holiday-ink, #6B5320)", background: holidayArm === `${employee.id}:${day.key}` ? "var(--nv-shift-holiday-ink, #6B5320)" : "var(--nv-card)", color: holidayArm === `${employee.id}:${day.key}` ? "#fff" : "var(--nv-shift-holiday-ink, #6B5320)" }}
                          >
                            {holidayArm === `${employee.id}:${day.key}` ? (ar ? "تأكيد: ساعاته إضافي" : "Confirm: all OT") : (ar ? "عمل في العطلة" : "Holiday work")}
                          </button>
                        ) : null}
                        {!leave && shift && holidayWorkOn(employee, day.key) ? (
                          <span data-holiday-work-on="1" title={ar ? HOLIDAY_WORK_LABEL_AR : HOLIDAY_WORK_LABEL_EN} style={{ position: "absolute", insetInlineStart: 4, top: 3, fontSize: 8.5, fontWeight: 700, color: "var(--nv-shift-holiday-ink, #6B5320)", pointerEvents: "none" }}>
                            {ar ? "عطلة · إضافي" : "Holiday · OT"}
                          </span>
                        ) : null}
                        {sunShow ? (
                          <span
                            role="radiogroup"
                            data-sun-toggle="1"
                            data-sun-mark={sun.mark || "unset"}
                            data-sun-source={sun.source || "none"}
                            data-sun-required={sunAsk ? "1" : "0"}
                            aria-label={ar ? `حظر الشمس لـ${employee.name} — ${sunMarkLabel(sun.mark)}` : `Sun ban for ${employee.name} — ${sunMarkLabel(sun.mark)}`}
                            title={sunAsk
                              ? (ar ? "موسم القرار 3337: حدّد مكشوف أم مظلّل — المكشوف لا يعمل 12:00–15:00" : "Decision 3337 season: set exposed or shaded — exposed work stops 12:00–15:00")
                              : (ar ? "خارج موسم القرار 3337 — التحديد اختياري ويُحفظ لموسمه" : "Outside the Decision 3337 season — optional, kept for the season")}
                            style={{
                              position: "absolute",
                              insetInlineStart: 12,
                              bottom: 11,
                              height: 22,
                              display: "grid",
                              gridTemplateColumns: sun.mark ? "auto" : "1fr 1fr",
                              insetInlineEnd: sun.mark ? "auto" : 12,
                              gap: 2,
                              padding: 1,
                              borderRadius: 999,
                              border: sunAsk && !sun.mark ? "1px dashed var(--nv-warn, #B7791F)" : (sun.mark === SUN_FIELD ? "1px solid var(--nv-bad-line)" : sun.mark === SUN_OFFICE ? "1px solid var(--nv-ok-line)" : "1px solid var(--nv-line2, #E3E8E5)"),
                              background: sunAsk && !sun.mark ? "var(--nv-warn-soft, #FBF3E2)" : "var(--nv-card, #fff)",
                            }}
                          >
                            {/* Once chosen, only the choice stays in the cell; pressing it again clears it and both return. */}
                            {(sun.mark ? [sun.mark] : [SUN_FIELD, SUN_OFFICE]).map((opt) => {
                              const on = sun.mark === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  title={on ? (ar ? "اضغط للإلغاء وإعادة الخيارين" : "Click to clear and show both") : undefined}
                                  data-sun-answer={opt}
                                  disabled={!canEdit || pastDay}
                                  onClick={(e) => { e.stopPropagation(); setSunPrompt(null); pickSunMark(employee, day, sun.mark, opt); }}
                                  style={{
                                    fontFamily: "inherit",
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    border: "none",
                                    borderRadius: 999,
                                    minWidth: 0,
                                    padding: on ? "0 7px" : "0 2px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 2,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    cursor: canEdit ? "pointer" : "default",
                                    // The chosen mark reads as the «أيامي» chip: soft fill, toned ink.
                                    background: on ? (opt === SUN_FIELD ? "var(--nv-bad-soft)" : "var(--nv-ok-soft)") : "transparent",
                                    color: on ? (opt === SUN_FIELD ? "var(--nv-bad-ink)" : "var(--nv-ok-ink)") : (sunAsk && !sun.mark ? "var(--nv-warn-ink, #7A4E0B)" : "var(--nv-ink3, #6B7280)"),
                                    opacity: on && sun.source !== "cell" ? 0.88 : 1,
                                  }}
                                >
                                  {opt === SUN_FIELD ? <Sun aria-hidden style={{ width: 10, height: 10, flex: "none" }} strokeWidth={2.4} /> : null}
                                  {opt === SUN_FIELD ? (ar ? "مكشوف" : "Exposed") : (ar ? "مظلّل" : "Shaded")}
                                </button>
                              );
                            })}
                          </span>
                        ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <RosterLegend
              types={types}
              ar={ar}
              sun
              leaveLabel={ar ? "إجازة معتمدة (طلباتي)" : "Approved leave (My Requests)"}
              holidayLabel={ar ? "إجازة اليوم الوطني · يوم التأسيس · العيد" : "National Day · Founding Day · Eid leave"}
              trailing={(
                <Link to="/app/requests" style={quietAction({ color: "var(--nv-muted)", fontSize: 11 })}>
                  {ar ? "الإجازات المعتمدة من طلباتي" : "Approved leave from My Requests"}
                </Link>
              )}
            />
            <div style={{ padding: "0 18px 12px", fontSize: 11, color: SW.muted, lineHeight: 1.7 }}>
              {canEdit
                ? (brush != null
                  ? (ar ? `اضغط أي خلية لتعيين «${brushLabel}». ${WEEK_HINT_ADMIN_AR}` : `Click a cell to assign “${brushLabel}”. Leave and holiday cells stay locked. The week does not publish over the weekly cap or a morning shift straight after a night.`)
                  : (ar ? WEEK_HINT_ADMIN_AR : "Click a cell to cycle rest, morning, evening, night. Holiday and leave cells stay locked. The week does not publish over the weekly cap or a morning shift straight after a night."))
                : (published
                  ? (ar ? WEEK_HINT_EMP_AR : "This is your published roster. Ask for a shift change or leave from My Requests. Leave cells stay locked.")
                  : (ar ? "هذا الأسبوع لم يُنشر بعد — لا وردية منشورة اليوم، و«حضر» يبقى مغلقاً. الإجازة من «طلباتي»." : "This week is not published yet — no published shift today, and check-in stays closed. Leave is requested from My Requests."))}
            </div>
            {restJumpNote ? (
              <div role="status" style={{ ...statusBannerQuiet.warn, margin: "0 18px 12px", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
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
            <div style={{ padding: "0 18px 14px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={() => setReqOpen((v) => !v)} style={chipButton(reqOpen)}>
                {ar ? "اطلب تغيير وردية" : "Request a shift change"}
              </button>
              <Link to="/app/requests" style={quietAction({ color: "var(--nv-muted)", fontSize: 11 })}>
                {ar ? "طلباتي" : "My requests"}
              </Link>
            </div>
            {reqOpen && (
              <div style={{ margin: "0 18px 16px", padding: 14, background: SW.wash, border: `1px solid ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "اليوم" : "Day"}</span>
                  <PlatformDateField ar={ar} value={reqForm.date} onChange={(next) => setReqForm((f) => ({ ...f, date: next }))} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "الوردية المطلوبة" : "Requested shift"}</span>
                  <select value={reqForm.shiftTypeId} onChange={(e) => setReqForm((f) => ({ ...f, shiftTypeId: e.target.value }))} style={{ fontFamily: "inherit", fontSize: 12, padding: 8, border: `1px solid ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, background: SW.card, color: SW.ink, textAlign: "start" }}>
                    <option value="">{ar ? "راحة" : "Rest"}</option>
                    {types.map((shift) => <option key={shift.id} value={shift.id}>{shift.label} · {shiftHoursLine(shift, lang, timeFormat)}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "السبب" : "Reason"}</span>
                  <input value={reqForm.reason} onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))} placeholder={ar ? "لماذا هذا التغيير؟" : "Why this change?"} style={{ fontFamily: "inherit", fontSize: 12, padding: 8, border: `1px solid ${SW.line}`, borderRadius: DS_CONTROL_RADIUS, background: SW.card, color: SW.ink, textAlign: "start" }} />
                </label>
                <button type="button" onClick={submitShiftRequest} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "none", borderRadius: DS_CONTROL_RADIUS, background: "var(--nv-ok-fill)", color: "var(--nv-btn-ink)", cursor: "pointer" }}>
                  {ar ? "أرسل للاعتماد" : "Submit for approval"}
                </button>
              </div>
            )}
          </section>

          {mode !== "mine" ? (
            <ScheduleCompliancePanel
              ref={complianceRef}
              gates={gates}
              company={data}
              onDate={days[0]?.key || weekStart}
              weekStart={weekStart}
              employees={roster}
              ar={ar}
              canApplyOrdinary={canEdit}
              onApplyOrdinary={(employee, kind, dateKey) => applyOrdinaryHours(employee, kind, dateKey)}
              onNightRemedy={(employee, kind, extra) => applyNightRemedy(employee, kind, extra)}
              highlighted={complianceFlash}
              source={complianceSource}
              onSource={setComplianceSource}
              onFocusPerson={focusPerson}
              summary={complianceSummary}
              hideSourceCards
              prove={canEdit ? { canProve: true, companyId, stationId, employees, actor: currentUser, onSaved: () => refresh?.() } : null}
            />
          ) : null}

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <SectionHead
              title={ar ? "من كان على الوردية؟" : "Who was on shift?"}
              note={histScope}
              trailing={(
                <>
                  <div style={{ width: 150 }}>
                    <PlatformDateField compact ar={ar} value={histFrom} onChange={setHistFrom} />
                  </div>
                  <span style={{ fontSize: 11, color: SW.muted }}>→</span>
                  <div style={{ width: 150 }}>
                    <PlatformDateField compact ar={ar} value={histTo} min={histFrom} onChange={setHistTo} />
                  </div>
                  <button type="button" onClick={() => setHistMode("emp")} style={chipButton(histMode === "emp")}>{ar ? "حسب الموظف" : "By person"}</button>
                  <button type="button" onClick={() => setHistMode("day")} style={chipButton(histMode === "day")}>{ar ? "حسب اليوم" : "By day"}</button>
                  <input value={histQuery} onChange={(e) => setHistQuery(e.target.value)} placeholder={ar ? "ابحث بالاسم" : "Search a name"} style={{ fontFamily: "inherit", fontSize: 11, height: 24, boxSizing: "border-box", padding: "0 9px", border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", outline: "none", width: 120, borderRadius: DS_CONTROL_RADIUS, textAlign: "start" }} />
                </>
              )}
            />
            {histMode === "emp" && history.workDays > 0 && history.rows.length > 0 ? (
              <div style={{ padding: "12px 18px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
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
                  <span style={{ fontSize: 11, color: "var(--nv-ink3)", textAlign: "end" }}>{ar ? "ساعات" : "Hours"}</span>
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
                    <span style={{ ...mono, fontSize: 12, color: "var(--nv-ink)", textAlign: "end" }}>{row.hours}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 8 }}>
                  {types.map((shift, index) => {
                    const style = shiftTypeStyle(shift, index);
                    return (
                      <span key={`hist-leg-${shift.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--nv-ink3)" }}>
                        <span style={{ width: 11, height: 11, borderRadius: 3, background: style.bg, border: `1px solid ${style.color}`, boxSizing: "border-box" }} />
                        {shift.label}
                      </span>
                    );
                  })}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--nv-ink3)" }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: LEAVE_STYLE.bg, border: `1px solid ${LEAVE_STYLE.color}`, boxSizing: "border-box" }} />
                    {ar ? "إجازة" : "Leave"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--nv-ink3)" }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: REST_STYLE.bg, border: `1px solid ${REST_STYLE.color}`, boxSizing: "border-box" }} />
                    {ar ? "راحة" : "Rest"}
                  </span>
                </div>
              </div>
            ) : null}
            {histMode === "day" && history.workDays > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {history.dayRows.map((day) => (
                  <div key={day.label} style={{ padding: "11px 18px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "minmax(84px,auto) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink)", whiteSpace: "nowrap" }}>{day.label}</span>
                      <span style={{ fontSize: 10, color: "var(--nv-ink3)" }}>{day.count} {ar ? "على وردية" : "on shift"}</span>
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                      {day.empty && <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{ar ? "لا أحد على وردية" : "Nobody on shift"}</span>}
                      {day.groups.map((group) => (
                        <div key={group.name} style={{ display: "grid", gridTemplateColumns: "78px minmax(0,1fr)", gap: 9, alignItems: "start" }}>
                          <span style={chip("mute", { fontSize: 10, color: group.fg, background: group.bg, border: `1px solid ${group.color}`, justifyContent: "center" })}>{group.name}</span>
                          <span style={{ fontSize: 11, color: "var(--nv-ink)", lineHeight: 1.8 }}>{group.names}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ padding: "12px 18px" }}>
              <span style={{ fontSize: 10.5, color: "var(--nv-ink3)", lineHeight: 1.85 }}>{histNote}</span>
            </div>
          </section>
        </div>

        <aside className="nv-duty-col nv-duty-side" data-duty-side="1">
          {mode !== "mine" ? (() => {
            // «أسبوع الفرع» — the same dark slab as «رصيد إجازاتي» / «بانتظار القرار»: publish state, the week's
            // totals, and each person's hours against their own week cap (catalog: 48, 36 in Ramadan, Art. 108).
            const dayKeys = days.map((day) => day.key);
            const people = roster.map((emp) => {
              const cap = weekHoursCap(emp, data, dayKeys, laborCalendar);
              return { id: emp.id, name: emp.name, h: Number(employeeWeekHours(schedule, emp.id, weekStart, emp, laborCalendar)) || 0, cap: cap.hours, art: cap.article };
            }).sort((x, y) => y.h - x.h);
            const branchCap = weekHoursCap(null, data, dayKeys, laborCalendar);
            const limit = branchCap.hours;
            const nearOf = (row) => (Number.isFinite(row.cap) ? row.h >= row.cap - 8 : false);
            const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(1));
            return (
              <section data-branch-week-card="1" style={{ borderRadius: 12, overflow: "hidden", background: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)", color: "#fff" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.12)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{ar ? `أسبوع ${stationName ? rosterBranchPhrase(stationName, ar) : "الفرع"}` : "Branch week"}</span>
                  <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>
                    {pub.kind === "published"
                      ? (blockers
                        ? (ar ? `منشور — يخالف الآن: ${countAr(blockers, "مانع واحد", "مانعان", "موانع", "مانعاً")}` : `Published — now breaks: ${blockers}`)
                        : (ar ? "منشور — الحضور يقرأ منه" : "Published — attendance reads it"))
                      : pub.kind === "edited"
                        ? (ar ? "تعديل غير منشور" : "Unpublished edit")
                        : pub.kind === "implicit"
                          ? (ar ? "أسبوع ماضٍ — منشور تلقائياً" : "Past week — auto-published")
                          : (ar ? "لم يُنشر بعد" : "Not published yet")}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
                  {[
                    [gates.assigned, ar ? "تعيين" : "shifts"],
                    [fmt(Number(gates.totalHours) || 0), ar ? "ساعة" : "hours"],
                    [roster.length, ar ? "موظف" : "people"],
                  ].map(([n, label], i) => (
                    <span key={label} style={{ padding: "10px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, borderInlineStart: i ? "1px solid rgba(255,255,255,.1)" : "none" }}>
                      <strong style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</strong>
                      <span style={{ fontSize: 11, color: "#C5DBCD" }}>{label}</span>
                    </span>
                  ))}
                </div>
                <div style={{ padding: "12px 18px 4px", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{ar ? "قريبون من الحد" : "Near the limit"}</strong>
                  <span style={{ fontSize: 11, color: "#A9CDB8" }}>{ar ? `على بعد 8 ساعات من حدّه · الباقي بجانب الاسم في الجدول` : `Within 8 h of their cap · the rest beside each name in the grid`}</span>
                </div>
                {people.filter(nearOf).length === 0 ? (
                  <span style={{ display: "block", padding: "6px 18px", fontSize: 12, color: "#C5DBCD" }}>{ar ? "لا أحد قريب من حدّه الأسبوعي هذا الأسبوع." : "Nobody is near their weekly cap this week."}</span>
                ) : null}
                {people.filter(nearOf).map((row) => (
                  <div key={row.id} data-branch-week-person={row.id} style={{ padding: "7px 18px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                      <span style={{ color: row.h > row.cap ? "#F3C9C9" : "#C5DBCD", whiteSpace: "nowrap" }}><span dir="ltr" style={mono}>{fmt(row.h)}</span> {ar ? "من" : "of"} <span dir="ltr" style={mono}>{row.cap}</span></span>
                    </span>
                    <span aria-hidden style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "hidden", display: "block" }}>
                      <span style={{ display: "block", height: "100%", width: `${Math.min(100, (row.h / row.cap) * 100)}%`, background: row.h > row.cap ? "#E07A7A" : "#C8A45A", borderRadius: 999 }} />
                    </span>
                  </div>
                ))}
                <div style={{ padding: "10px 18px", marginTop: 6, borderTop: "1px solid rgba(255,255,255,.1)", fontSize: 10.5, color: "#A9CDB8" }}>
                  {ar ? `الحد النظامي ${limit} ساعة أسبوعياً${branchCap.article ? ` (المادة ${branchCap.article})` : ""}. الأرقام من الجدول المعروض.` : `Statutory limit ${limit} h a week${branchCap.article ? ` (Art. ${branchCap.article})` : ""}. Figures from the roster shown.`}
                </div>
              </section>
            );
          })() : null}
          {mode !== "mine" ? <PendingDutyRequestsCard ar={ar} people={roster} /> : null}
          {heatOffSeasonHint}
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
            <section data-schedule-settings="1" style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <SectionHead
                title={ar ? "إعدادات الجدول" : "Roster settings"}
                note={ar ? "أنواع الورديات · إعداد الليل · سريان الجدول" : "Shift types · night settings · roster validity"}
              />
              <Collapsible
                dataAttr="shift-types"
                title={ar ? "أنواع الورديات" : "Shift types"}
                note={ar ? `${types.length} ${types.length === 1 ? "نوع" : types.length === 2 ? "نوعان" : "أنواع"} · الاسم والوقت والراحة` : `${types.length} types · name, time, rest`}
              >
                {shiftTypesEditor}
              </Collapsible>
              <Collapsible
                dataAttr="night"
                title={ar ? "إعداد الليل" : "Night settings"}
                note={ar ? "تعويض ليلي لهذا الجدول" : "Night compensation on this roster"}
                trailing={<span style={sourceBadge()}>18632</span>}
              >
                <div data-night-settings="1">{nightSettings}</div>
              </Collapsible>
              <Collapsible
                dataAttr="heat-places"
                title={ar ? "حظر العمل المكشوف (3337) — مكشوف / مظلّل" : "Open-sun ban (3337) — exposed / shaded"}
                note={heatInSeason
                  ? (ar
                    ? `مكشوف ${sunCounts.field} · مظلّل ${sunCounts.office} · بلا تحديد ${sunCounts.unset} — من خلية الموظف`
                    : `Field ${sunCounts.field} · office ${sunCounts.office} · unset ${sunCounts.unset} — on the person's cell`)
                  : (ar ? "خارج الموسم هذا الأسبوع — التحديد من خلية الموظف" : "Out of season this week — marked on the person's cell")}
                trailing={<span style={sourceBadge()}>3337</span>}
              >
                {heatPlaces}
              </Collapsible>
              <Collapsible
                dataAttr="validity"
                title={ar ? "سريان الجدول" : "Roster validity"}
                note={ar ? "شهري — انسخ الشهر أو أعد السابق" : "Monthly — copy the month or reuse the previous one"}
                trailing={<span style={chip("mute")}>{ar ? "شهري" : "Monthly"}</span>}
              >
                {rosterValidity}
              </Collapsible>
            </section>
          )}
        </aside>
      </div>

      <ScheduleHowItWorks ar={ar} sections={mode === "mine" ? ["performance"] : ["judgment", "clock", "facility", "performance"]} />
    </div>
    </AttendanceSectionFrame>
  );
}
