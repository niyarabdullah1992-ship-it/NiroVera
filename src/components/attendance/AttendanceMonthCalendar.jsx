import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { calendarCellMatches, calendarDateKey, monthGridDays, taskStationId } from "@/lib/attendanceCalendar";
import { canCreateTasks } from "@/lib/permissions";
import { listLocalRangeAttendance, mergeAttendanceRangeRows } from "@/lib/localAttendanceFallback";
import {
  employeeWorkStationId,
  findStationById,
  rosterBranchPhrase,
  shiftTypeStyle,
  stationDisplayName,
} from "@/lib/shiftWeek";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import { FileSelfBadge } from "@/components/employees/ProfileHero";
import PlatformDateField from "@/components/shared/PlatformDateField";
import DateNav from "@/components/schedules/DateNav";
import { dateFromKey } from "@/components/schedules/dutyLinks";
import MyMonthLine, { myCellMark, useMyMonthDays } from "@/components/attendance/MyMonthLine";
import {
  BROKE,
  CHAIN,
  CMP_KEYS,
  OC,
  dayHeadPhrase,
  deriveDayRecord,
  empStats,
  eventGroups,
  filedLeaveBanner,
  filedLeaveInMonth,
  isoFromParts,
  jumpDayFromQuery,
  monthsOf,
  pct,
  rosterFor,
  shadeRate,
  sumRecs,
  visibleOpsTasks,
  weekdaysOf,
} from "@/lib/operationalCalendar";
import NvIcon from "@/components/shared/NvIcon";
import { minutesPhrase } from "@/lib/calendarDayFlags";
import StatusFilterPills, { statusPillStyle } from "@/components/shared/StatusFilterPills";
import { KindIcon, NameLetter, shiftKindOf } from "@/components/schedules/rosterTile";
import { getShiftOnDate } from "@/lib/attendanceDerivations";
import { approvedLeaveOnDay } from "@/lib/leaveTypes";

/** «1:15» for overtime minutes in a narrow column. */
function minutesShort(total) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  return n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}` : String(n);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";
const LINK = { color: OC.ink, fontWeight: 600, textDecoration: "none" };

function KickerLine({ kicker }) {
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  return (
    <span style={{ fontSize: 11, letterSpacing: ".14em", color: OC.muted, display: "flex", gap: 7, alignItems: "center" }}>
      {parts[0] ? <span dir={/[\u0600-\u06FF]/.test(parts[0]) ? undefined : "ltr"} style={{ fontFamily: /[\u0600-\u06FF]/.test(parts[0]) ? "inherit" : "'IBM Plex Mono', monospace"}}>{parts[0]}</span> : null}
      {parts[1] ? <span>·</span> : null}
      <span>{parts.slice(1).join(" · ") || (!parts[0] ? kicker : "")}</span>
    </span>
  );
}

function pill(on) {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    padding: "9px 15px",
    border: `1px solid ${on ? "var(--nv-btn-fill)" : OC.line}`,
    background: on ? "var(--nv-btn-fill)" : "var(--nv-card)",
    color: on ? "var(--nv-btn-ink)" : OC.mid,
    fontWeight: on ? 600 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "6px 11px",
    border: `1px solid ${on ? "var(--nv-btn-fill)" : OC.line}`,
    background: on ? "var(--nv-btn-fill)" : "var(--nv-card)",
    color: on ? "var(--nv-btn-ink)" : OC.mid,
    fontWeight: on ? 600 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

function fmtArDate(iso, months) {
  const parts = String(iso || "").split("-");
  if (parts.length !== 3) return iso || "";
  return `${Number(parts[2])} ${months[Number(parts[1]) - 1]} ${parts[0]}`;
}

export default function AttendanceMonthCalendar({ employees = [], currentUser, me = null, company, data, kicker, lane, canManage = false, framed = false }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const months = monthsOf(ar);
  const weekdays = weekdaysOf(ar);
  const now = new Date();
  const todayKey = calendarDateKey(now);
  // «?day=yyyy-mm-dd» (old «سجلي» links, search hits) opens that month with the day picked.
  const [searchParams] = useSearchParams();
  const askedDay = searchParams.get("day") || "";
  const askedDate = dateFromKey(askedDay);
  const [year, setYear] = useState(askedDate ? askedDate.getFullYear() : now.getFullYear());
  const [month, setMonth] = useState(askedDate ? askedDate.getMonth() : now.getMonth());
  const [selected, setSelected] = useState(askedDate ? askedDate.getDate() : now.getDate());
  useEffect(() => {
    const date = dateFromKey(askedDay);
    if (!date) return;
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setSelected(date.getDate());
  }, [askedDay]);
  const forcedView = lane ? "team" : null;
  const [view, setView] = useState(forcedView || "team");
  useEffect(() => {
    if (forcedView) setView(forcedView);
  }, [forcedView]);
  const [layout, setLayout] = useState("grid");
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState("");
  const [filter, setFilter] = useState("all");
  const [quietOpen, setQuietOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [cmpQuery, setCmpQuery] = useState("");
  const [range, setRange] = useState(null);
  const [cmp, setCmp] = useState("late");
  // «الكل» · «بين موظفين» (pick two or more) · «موظف مقابل الآخرين» (one against the scope's average).
  const [cmpMode, setCmpMode] = useState("all");
  const [cmpPicked, setCmpPicked] = useState([]);
  const [cmpFocus, setCmpFocus] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const headerScope = useStationScope();
  const stationList = data?.stations || [];
  const workStationId = employeeWorkStationId(currentUser);
  const mineLane = lane === "mine";
  const myself = mineLane ? (me || currentUser) : null;
  // My own month (what «سجلي» counted): absences, lateness, attendance against the schedule.
  const mine = useMyMonthDays({ employee: myself, company, data, year, month, ar });
  const workStation = findStationById(stationList, workStationId);
  const workStationName = stationDisplayName(workStation);
  const workBranch = rosterBranchPhrase(workStationName, ar);

  const roster = employees.length ? employees : (currentUser ? [currentUser] : []);
  const monthStart = isoFromParts(year, month, 1);
  const monthEnd = isoFromParts(year, month, new Date(year, month + 1, 0).getDate());
  const rangeFrom = range?.from || "";
  const rangeTo = range?.to || "";
  const startDate = rangeFrom && rangeTo ? (rangeFrom < rangeTo ? rangeFrom : rangeTo) : monthStart;
  const endDate = rangeFrom && rangeTo ? (rangeFrom > rangeTo ? rangeFrom : rangeTo) : monthEnd;
  const gpsRequired = company?.attendanceSettings?.gps_enabled === true;
  const isOpsManager = canCreateTasks(currentUser, data);
  const inLaneStation = (stationId) => (
    mineLane
      ? !!(workStationId && String(stationId || "") === String(workStationId))
      : matchesStationScope(stationId, headerScope, stationList)
  );
  const scopedSchedules = useMemo(
    () => (data?.schedules || []).filter((row) => inLaneStation(row.stationId)),
    [data?.schedules, headerScope, stationList, mineLane, workStationId],
  );
  const scopedProofs = useMemo(
    () => (data?.workProofs || []).filter((row) => inLaneStation(row.stationId)),
    [data?.workProofs, headerScope, stationList, mineLane, workStationId],
  );
  const scopedVisitors = useMemo(
    () => (data?.visitorProofs || []).filter((row) => inLaneStation(row.stationId)),
    [data?.visitorProofs, headerScope, stationList, mineLane, workStationId],
  );
  const scopedSafety = useMemo(
    () => (data?.safety || []).filter((row) => inLaneStation(row.stationId)),
    [data?.safety, headerScope, stationList, mineLane, workStationId],
  );
  const tasks = useMemo(
    () => visibleOpsTasks(data?.tasks, currentUser, isOpsManager)
      .filter((task) => inLaneStation(taskStationId(task, data))),
    [data, currentUser, isOpsManager, headerScope, stationList, mineLane, workStationId],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    const localRows = listLocalRangeAttendance(company?.id, startDate, endDate, data);
    Promise.all(
      roster.map((employee) =>
        base44.functions
          .invoke("supabaseAttendance", { action: "listRange", employeeId: employee.id, startDate, endDate })
          .then((res) => res?.data?.rows || [])
          .catch(() => []),
      ),
    )
      .then((sets) => {
        if (!active) return;
        setRows(mergeAttendanceRangeRows(sets.flat(), localRows));
      })
      .catch(() => {
        if (active) setRows(localRows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [startDate, endDate, roster.map((e) => e.id).join(","), company?.id]);

  useEffect(() => {
    const main = document.querySelector("main.platform-main-scroll");
    if (main) main.scrollTop = 0;
  }, []);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rowsByDate = useMemo(() => {
    const map = {};
    for (const row of rows) {
      const key = String(row?.date || row?.dateKey || "").slice(0, 10);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(row);
    }
    return map;
  }, [rows]);

  const recordOf = (date) => deriveDayRecord({
    date,
    employees: roster,
    rows: rowsByDate[calendarDateKey(date)] || [],
    schedules: scopedSchedules,
    todayKey,
    gpsRequired,
    tasks,
    currentUser,
    workProofs: scopedProofs,
    visitorProofs: scopedVisitors,
    data,
    safety: scopedSafety,
    view,
    flagsFor: mineLane ? "self" : "all",
  });

  // Who works which kind of shift that day — the «أيامي» symbols: ☀ صباحي · ◐ مسائي · ☾ ليلي.
  // Employee lane: my own shift. Management lane: how many of the scope on each kind.
  const dutyOfDay = (key) => {
    if (mineLane) {
      if (!myself || approvedLeaveOnDay(myself, key)) return null;
      const shift = getShiftOnDate(data, myself, key);
      return shift ? { mine: shift, kind: shiftKindOf(shift) } : null;
    }
    const counts = { morning: 0, evening: 0, night: 0 };
    for (const employee of roster) {
      if (approvedLeaveOnDay(employee, key)) continue;
      const shift = getShiftOnDate(data, employee, key);
      if (!shift) continue;
      const kind = shiftKindOf(shift);
      if (counts[kind] != null) counts[kind] += 1;
    }
    return counts.morning + counts.evening + counts.night ? { counts } : null;
  };
  const days = monthGridDays(year, month);
  const cells = days.map((date) => {
    if (!date) return { blank: true };
    const key = calendarDateKey(date);
    return {
      blank: false,
      d: date.getDate(),
      wd: date.getDay(),
      weekend: date.getDay() === 5 || date.getDay() === 6,
      today: key === todayKey,
      future: key > todayKey,
      rec: recordOf(date),
      date,
      key,
      duty: dutyOfDay(key),
    };
  });

  const matchCell = (cell) => calendarCellMatches({
    cell,
    query,
    quick,
    year,
    month,
    todayKey,
    monthNames: months,
  });

  const filtering = !!query.trim() || !!quick;
  const matched = cells.filter((cell) => !cell.blank && matchCell(cell));
  const real = cells.filter((cell) => cell.rec);
  const scheduled = cells.filter((cell) => !cell.blank && !cell.weekend).length;
  const totals = real.reduce((acc, cell) => ({
    on: acc.on + cell.rec.on,
    late: acc.late + cell.rec.late,
    abs: acc.abs + cell.rec.abs,
  }), { on: 0, late: 0, abs: 0 });
  const punchTotal = totals.on + totals.late + totals.abs || 1;
  const broken = real.filter((cell) => cell.rec.broke);
  const taskDays = real.filter((cell) => cell.rec.tasksMine + cell.rec.tasksTeam > 0).length;
  const tasksTotal = real.reduce((acc, cell) => acc + cell.rec.tasksMine + cell.rec.tasksTeam, 0);
  const hseDays = real.filter((cell) => cell.rec.hse).length;
  const monthSum = sumRecs(real.map((cell) => ({ rec: cell.rec })));
  const sel = cells.find((cell) => cell.d === selected);
  const selRec = sel?.rec || null;
  const rangeOn = !!(rangeFrom && rangeTo);

  const rangeDays = useMemo(() => {
    if (!rangeOn) return [];
    const from = new Date(`${startDate}T00:00:00`);
    const to = new Date(`${endDate}T00:00:00`);
    const out = [];
    const cur = new Date(from);
    let guard = 0;
    while (cur <= to && guard++ < 500) {
      const rec = recordOf(cur);
      if (rec) out.push({ y: cur.getFullYear(), m: cur.getMonth(), d: cur.getDate(), wd: cur.getDay(), rec });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [rangeOn, startDate, endDate, rowsByDate, view, year, month, headerScope, scopedSchedules, tasks, scopedProofs, scopedVisitors, scopedSafety, roster]);

  const agg = rangeOn ? sumRecs(rangeDays) : null;
  // The picked day's week — a quiet line above the grid, read from the same day records.
  const selIdx = cells.findIndex((cell) => !cell.blank && cell.d === selected);
  const weekCells = selIdx >= 0 ? cells.slice(selIdx - (selIdx % 7), selIdx - (selIdx % 7) + 7).filter((cell) => !cell.blank) : [];
  const weekSum = sumRecs(weekCells.map((cell) => ({ rec: cell.rec })));
  const weekFrom = weekCells[0]?.key || "";
  const weekTo = weekCells[weekCells.length - 1]?.key || "";
  const src = rangeOn ? agg : selRec;
  const pickDay = (day, openSheet = false) => {
    setSelected(day);
    if (openSheet) setSheet(true);
    setRange(null);
  };
  const goMonth = (nextYear, nextMonth, day = 0) => {
    setYear(nextYear);
    setMonth(nextMonth);
    setSelected(day);
  };

  const applyQueryJump = (text) => {
    const jump = jumpDayFromQuery(text, months);
    if (!jump) return;
    if (jump.month != null || jump.year != null || jump.day) {
      goMonth(jump.year ?? year, jump.month ?? month, jump.day || 0);
    }
  };

  const rosterPack = rosterFor(rangeOn ? null : selRec, { view, filter, nameQuery, ar });
  const events = rangeOn ? [] : eventGroups(selRec, ar, currentUser, { manage: !mineLane });
  const noEvents = !rangeOn && !!(selRec && !selRec.tasksMine && !selRec.tasksTeam && !selRec.proofWork && !selRec.proofVisit && !selRec.hse && !selRec.leave && !selRec.leaveClash && !selRec.filed && !selRec.flagged?.length);
  const filedPack = useMemo(
    () => filedLeaveInMonth(roster, year, month, ar, data),
    [roster, year, month, ar, data],
  );
  const filedBanner = filedLeaveBanner(filedPack, months[month], ar);
  const dayTitle = rangeOn
    ? (ar ? `من ${fmtArDate(startDate, months)} إلى ${fmtArDate(endDate, months)}` : `${fmtArDate(startDate, months)} → ${fmtArDate(endDate, months)}`)
    : (sel && !sel.blank ? `${weekdays[sel.wd]} ${sel.d} ${months[month]} ${year}` : (ar ? "لم تختر يوماً" : "No day selected"));
  const daySub = rangeOn
    ? (agg?.days
      ? (ar
        ? `${agg.days} يوم مسجّل · ${agg.head} يوم-موظف · ${agg.tDone + agg.tProg + agg.tOver} مهمة · ${agg.hse ? `${agg.hse} بلاغ سلامة` : "لا بلاغات سلامة"}`
        : `${agg.days} recorded days · ${agg.head} person-days · ${agg.tDone + agg.tProg + agg.tOver} tasks`)
      : (ar ? "لا يوم مسجّل في هذا المدى — جرّب شهراً سابقاً." : "No recorded day in this range."))
    : selRec
      ? [
        view === "team" ? dayHeadPhrase(selRec.head, ar) : (ar ? "سجلّك الشخصي" : "Your record"),
        selRec.leave ? (ar ? `${selRec.leave} في إجازة خارج حساب الحضور${selRec.filed ? ` (منها ${selRec.filed} من طلباتي)` : ""}` : `${selRec.leave} on leave${selRec.filed ? ` (${selRec.filed} from My Requests)` : ""}`) : null,
        (selRec.tasksMine + selRec.tasksTeam) ? (ar ? `${selRec.tasksMine + selRec.tasksTeam} مهمة · ${selRec.tDone} منجزة` : `${selRec.tasksMine + selRec.tasksTeam} tasks · ${selRec.tDone} done`) : (ar ? "لا مهام" : "No tasks"),
        selRec.hse ? (ar ? `${selRec.hse} بلاغ سلامة مفتوح` : `${selRec.hse} open HSE`) : (ar ? "لا بلاغات سلامة" : "No HSE"),
        selRec.leaveClash ? (ar ? "إجازة معتمدة على وردية منشورة — يحتاج بديلاً" : "Approved leave on a published shift — needs a substitute") : null,
      ].filter(Boolean).join(" · ")
      : (!sel ? (ar ? "اضغط أي يوم في الشبكة" : "Tap a day on the grid") : (sel.weekend ? (ar ? "عطلة نهاية الأسبوع" : "Weekend") : (ar ? "لا سجل بعد" : "No record yet")));

  // «يوم واحد» compares the people of the scope on the picked day; a range compares that range.
  const cmpDays = rangeOn ? rangeDays : (selRec ? [{ rec: selRec }] : []);
  const stats = view === "team" ? empStats(cmpDays, roster) : [];
  const cmpQ = String(cmpQuery || "").trim();
  const cmpSorted = stats
    .filter((row) => roster.some((employee) => String(employee.id) === String(row.id)))
    .filter((row) => !cmpQ || String(row.name || "").includes(cmpQ))
    .sort((a, b) => ((Number(b[cmp]) || 0) - (Number(a[cmp]) || 0)) || String(a.name).localeCompare(String(b.name), ar ? "ar" : "en"));
  const focusId = cmpFocus || (mineLane && currentUser?.id ? String(currentUser.id) : String(cmpSorted[0]?.id || ""));
  const focusRow = cmpSorted.find((row) => String(row.id) === focusId) || null;
  const othersRows = cmpSorted.filter((row) => String(row.id) !== focusId);
  // The scope's average without the focused person — one decimal, from the same rows.
  const othersAvg = othersRows.length ? {
    id: "__others",
    synthetic: true,
    name: ar ? `متوسط الآخرين · ${othersRows.length}` : `Others' average · ${othersRows.length}`,
    ...Object.fromEntries(["on", "late", "abs", "leave", "viol", "ot", "wait", "done", "prog", "over", "hse"].map((key) => [
      key,
      Math.round((othersRows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) / othersRows.length) * 10) / 10,
    ])),
  } : null;
  const pickedSet = new Set(cmpPicked.map(String));
  const cmpRows = cmpMode === "pick"
    ? cmpSorted.filter((row) => pickedSet.has(String(row.id)))
    : cmpMode === "versus"
      ? [focusRow, othersAvg].filter(Boolean)
      : cmpSorted;
  const pickChoices = (Array.isArray(stats) ? stats : [])
    .filter((row) => roster.some((employee) => String(employee.id) === String(row.id)))
    .filter((row) => !cmpQ || String(row.name || "").includes(cmpQ))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), ar ? "ar" : "en"));
  const top = cmpSorted[0];
  const topScore = top ? (Number(top[cmp]) || 0) : 0;
  const zero = cmpSorted.filter((row) => (Number(row[cmp]) || 0) === 0).length;
  const recordedPeople = cmpSorted.filter((row) => (row.on + row.late + row.abs + row.leave) > 0).length;
  const cmpLabels = {
    on: [ar ? "حضر في الوقت" : "On time", OC.greenText, ar ? "حضر" : "On"],
    late: [ar ? "متأخر" : "Late", OC.goldText, ar ? "متأخر" : "Late"],
    abs: [ar ? "غاب" : "Absent", OC.abs, ar ? "غاب" : "Abs"],
    leave: [ar ? "إجازة" : "Leave", OC.leave, ar ? "إجازة" : "Leave"],
    viol: [ar ? "مخالفات الدوام" : "Duty breaches", OC.goldText, ar ? "مخالفة" : "Breach"],
    ot: [ar ? "إضافي (دقيقة)" : "Overtime (min)", OC.mid, ar ? "إضافي" : "OT"],
    wait: [ar ? "معلّق" : "Pending", OC.abs, ar ? "معلّق" : "Pend."],
    done: [ar ? "مهام منجزة" : "Done tasks", OC.greenText, ar ? "منجزة" : "Done"],
    prog: [ar ? "قيد التنفيذ" : "In progress", OC.goldText, ar ? "جارية" : "Open"],
    over: [ar ? "مهام متأخرة" : "Overdue tasks", OC.abs, ar ? "متأخرة" : "Over"],
    hse: [ar ? "بلاغات سلامة" : "HSE", OC.abs, ar ? "سلامة" : "HSE"],
  };
  const CMP_GROUPS = [
    { id: "att", label: ar ? "الحضور" : "Attendance", keys: ["on", "late", "abs", "leave"] },
    { id: "duty", label: ar ? "الدوام" : "Duty", keys: ["viol", "ot", "wait"] },
    { id: "work", label: ar ? "المهام والسلامة" : "Tasks & safety", keys: ["done", "prog", "over", "hse"] },
  ];
  const CMP_ORDER = CMP_GROUPS.flatMap((group) => group.keys);
  // Each sort pill carries the scope's total for that key — read from the same rows the table shows.
  const cmpTotals = Object.fromEntries(CMP_ORDER.map((key) => {
    const sum = cmpSorted.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
    return [key, key === "ot" ? minutesShort(sum) : sum];
  }));
  const cmpGrid = "minmax(170px,1.6fr) minmax(80px,1fr) repeat(11,minmax(44px,52px))";
  const cmpColor = (key, value) => {
    if (!value) return OC.muted;
    if (key === "on" || key === "done") return OC.greenText;
    if (key === "late" || key === "prog" || key === "viol") return OC.goldText;
    if (key === "abs" || key === "over" || key === "hse" || key === "wait") return OC.abs;
    if (key === "leave") return OC.leave;
    return OC.mid;
  };
  const scopedStation = stationList.find((station) => String(station.id) === String(headerScope));
  const scopeLine = mineLane
    ? (workBranch
      ? (ar ? `جدول ${workBranch} كاملاً · ${roster.length} موظفاً` : `Full ${workStationName} roster · ${roster.length} people`)
      : (ar ? `${roster.length} موظفاً على فرعك` : `${roster.length} people on your branch`))
    : (!headerScope || headerScope === "all"
      ? (ar ? `كل نطاقك · ${roster.length} موظفاً` : `Your whole scope · ${roster.length} people`)
      : `${scopedStation?.name || headerScope} · ${roster.length}`);
  const cmpTitle = cmpLabels[cmp][0];
  const versusLine = cmpMode === "versus" && focusRow && othersAvg
    ? ["abs", "late", "viol", "wait", "over"]
      .filter((key) => (Number(focusRow[key]) || 0) !== (Number(othersAvg[key]) || 0))
      .map((key) => (ar
        ? `${cmpLabels[key][0]}: ${key === "ot" ? minutesShort(focusRow[key]) : focusRow[key]} مقابل ${othersAvg[key]}`
        : `${cmpLabels[key][0]}: ${focusRow[key]} vs ${othersAvg[key]}`))
      .join(" · ")
    : "";

  const todayIso = isoFromParts(now.getFullYear(), now.getMonth(), now.getDate());
  const back7 = (() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return isoFromParts(d.getFullYear(), d.getMonth(), d.getDate());
  })();
  const rangePresets = [
    { id: "day", label: ar ? "يوم واحد" : "One day", run: () => setRange(null) },
    { id: "w", label: ar ? "آخر 7 أيام" : "Last 7 days", run: () => setRange({ from: back7, to: todayIso }) },
    { id: "m", label: ar ? "هذا الشهر" : "This month", run: () => setRange({ from: monthStart, to: monthEnd }) },
  ];
  const rangePreset = !rangeOn
    ? "day"
    : (rangeFrom === back7 && rangeTo === todayIso ? "w" : (rangeFrom === monthStart && rangeTo === monthEnd ? "m" : ""));

  const monthInsight = !real.length
    ? (ar ? "لا سجل بعد لهذا الشهر. الأرقام تُشتق من أول يوم يُسجَّل فيه حضور." : "No record yet this month. Figures appear after the first punch.")
    : (broken.length
      ? (ar ? `${broken.length} يوماً انكسرت فيه حلقة.` : `${broken.length} days had a broken ring.`)
      : (ar ? "لم تنكسر أي حلقة في الأيام المسجّلة حتى الآن." : "No ring broke on the recorded days."));

  const legend = [
    { label: ar ? "حضر في الوقت" : "On time", color: OC.green, border: OC.green },
    { label: ar ? "متأخر" : "Late", color: OC.gold, border: OC.gold },
    { label: ar ? "غاب" : "Absent", color: OC.abs, border: OC.abs },
    { label: ar ? "عطلة أو مجدول" : "Off or scheduled", color: OC.wash, border: OC.line },
    { label: ar ? "إثبات عمل" : "Work proof", color: OC.greenBg, border: OC.greenBd },
    { label: ar ? "إثبات زائر" : "Visitor proof", color: OC.goldBg, border: OC.goldBd },
    { label: ar ? "بلاغ سلامة" : "HSE", color: OC.absBg, border: OC.absBd },
    { label: ar ? "إجازة معتمدة" : "Approved leave", color: OC.leaveBg, border: OC.leaveBd },
    ...(myself ? [{ label: ar ? "«أنا:» يومك أنت — غبت أو تأخرت" : "“Me:” your own day — absent or late", color: OC.abs, border: OC.abs }] : []),
  ];

  const mkStat = (id, label, value, color) => {
    const act = filter === id;
    return {
      id, label, value: String(value ?? 0), color,
      cursor: rangeOn ? "default" : "pointer",
      bg: act && !rangeOn ? "var(--nv-hover)" : "var(--nv-card)",
      border: act && !rangeOn ? "var(--nv-line)" : OC.soft,
      weight: act && !rangeOn ? 700 : 500,
      select: () => {
        if (rangeOn) return;
        if (id === "tasks" || id === "hse" || id === "flags") setSheet(true);
        else setFilter(act && id !== "all" ? "all" : id);
        if (id !== "tasks" && id !== "hse" && id !== "flags") setSheet(true);
      },
    };
  };

  const statGroups = src ? [
    {
      title: ar ? "الحضور" : "Attendance",
      items: [
        mkStat("all", ar ? "الكل" : "All", src.head, OC.ink),
        mkStat("on", ar ? "حضر في الوقت" : "On time", src.on, OC.greenText),
        mkStat("late", ar ? "متأخر" : "Late", src.late, OC.goldText),
        mkStat("abs", ar ? "غاب" : "Absent", src.abs, OC.abs),
        { ...mkStat("leave", ar ? "إجازة معتمدة" : "Approved leave", src.leave, OC.leave), sub: ar ? "خارج حساب الحضور — لا تُحاسب" : "Outside attendance — not charged" },
      ],
    },
    {
      title: ar ? "الدوام" : "Duty",
      items: [
        mkStat("flags", ar ? "عودة متأخرة من الراحة" : "Late return from break", src.lateReturn || 0, OC.goldText),
        mkStat("flags", ar ? "انصراف مبكر" : "Early leave", src.early || 0, OC.goldText),
        { ...mkStat("flags", ar ? "إضافي مسجّل" : "Overtime recorded", src.ot || 0, OC.mid), sub: src.otMinutes ? minutesPhrase(src.otMinutes, ar) : null },
        mkStat("flags", ar ? "بصمات بانتظار القرار" : "Punches awaiting a decision", src.awaiting || 0, OC.abs),
        mkStat("flags", ar ? "طلبات معلّقة" : "Pending requests", src.pending || 0, OC.goldText),
      ],
    },
    {
      title: ar ? "المهام" : "Tasks",
      items: [
        mkStat("tasks", ar ? "منجزة" : "Done", src.tDone, OC.greenText),
        mkStat("tasks", ar ? "قيد التنفيذ" : "In progress", src.tProg, OC.goldText),
        mkStat("tasks", ar ? "متأخرة" : "Overdue", src.tOver, OC.abs),
      ],
    },
    {
      title: ar ? "السلامة" : "Safety",
      items: [mkStat("hse", ar ? "بلاغات مفتوحة" : "Open reports", src.hse, OC.abs)],
    },
  ] : [];

  const cellItems = (rec) => (rec ? [
    rec.tasksMine && { label: ar ? "مهامي" : "Mine", count: rec.tasksMine, color: OC.ink, bg: "var(--nv-mute-soft)", border: OC.line },
    rec.tasksTeam && { label: ar ? "الفريق" : "Team", count: rec.tasksTeam, color: OC.mid, bg: "var(--nv-card)", border: OC.line },
    rec.proofWork && { label: ar ? "إثبات" : "Proof", count: rec.proofWork, color: OC.greenText, bg: OC.greenBg, border: OC.greenBd },
    rec.proofVisit && { label: ar ? "زائر" : "Visit", count: rec.proofVisit, color: OC.goldText, bg: OC.goldBg, border: OC.goldBd },
    rec.hse && { label: ar ? "سلامة" : "HSE", count: rec.hse, color: OC.abs, bg: OC.absBg, border: OC.absBd },
    rec.leave && { label: ar ? "إجازة" : "Leave", count: rec.leave, color: OC.leave, bg: OC.leaveBg, border: OC.leaveBd },
    (rec.lateReturn + rec.early) && { label: ar ? "مخالفة" : "Breach", count: rec.lateReturn + rec.early, color: OC.goldText, bg: OC.goldBg, border: OC.goldBd },
    (rec.awaiting + rec.pending) && { label: ar ? "معلّق" : "Pending", count: rec.awaiting + rec.pending, color: OC.abs, bg: OC.absBg, border: OC.absBd },
  ].filter(Boolean) : []);

  const shell = { background: "var(--nv-card)", border: `1px solid ${OC.line}`, borderRadius: 14, boxShadow: "var(--nv-paper)" };

  const leaveDays = real.filter((cell) => cell.rec.leave).length;
  const clashDays = real.filter((cell) => cell.rec.leaveClash).length;
  const leaveNote = filedPack.types.length
    ? (ar ? `منها ${filedPack.list.length} من طلباتي (${filedPack.types.join("، ")})` : `${filedPack.list.length} from My Requests (${filedPack.types.join(", ")})`)
    : (ar ? "لا إجازة معتمدة من طلباتي هذا الشهر" : "No approved leave from My Requests this month");

  return (
    <div className="nv-ops-cal" dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 16, color: OC.ink, fontSize: 13, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <section className="nv-ops-cal-head" style={{ ...shell, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          {framed ? null : <KickerLine kicker={kicker} />}
          {framed ? null : <h1 style={{ margin: 0, fontFamily: NASKH, fontSize: 24, fontWeight: 600, lineHeight: 1.35 }}>{ar ? "التقويم التشغيلي" : "Operational calendar"}</h1>}
          {framed ? null : <span style={{ fontSize: 12, color: OC.mid, lineHeight: 1.85 }}>
            {ar ? (
              <>
                <Link to="/app/shifts" style={LINK}>جدول الدوام</Link>
                {mineLane && workBranch
                  ? ` يقرّر · الحضور يلتقط · التقويم يثبت جدول ${workBranch} كاملاً. البصمة الجارية في `
                  : " يقرّر · الحضور يلتقط · التقويم يثبت. هذه الشاشة للأيام المسجّلة؛ البصمة والقرارات الجارية في "}
                <Link to="/app/attendance" style={LINK}>الحضور</Link>
                {"، والإجازات تبدأ من "}
                <Link to="/app/requests" style={LINK}>طلباتي</Link>
                .
              </>
            ) : (
              <>
                <Link to="/app/shifts" style={LINK}>The duty roster</Link>
                {mineLane && workStationName
                  ? ` decides · attendance captures · the calendar confirms the full ${workStationName} week. Live punches stay on `
                  : " decides · attendance captures · the calendar confirms. This screen is for recorded days; live punches stay on "}
                <Link to="/app/attendance" style={LINK}>Attendance</Link>
                {", and leave starts from "}
                <Link to="/app/requests" style={LINK}>My Requests</Link>
                .
              </>
            )}
          </span>}
          {filedBanner ? (
            <span style={{ fontSize: 11, color: OC.leave, background: OC.leaveBg, border: `1px solid ${OC.leaveBd}`, padding: "8px 11px", lineHeight: 1.85 }}>
              {filedBanner}{" "}
              <Link to="/app/requests" style={{ color: OC.leave, fontWeight: 600 }}>{ar ? "طلباتي ←" : "My Requests →"}</Link>
            </span>
          ) : null}
          <span style={{ fontSize: framed ? 12 : 13, color: OC.mid, lineHeight: 1.8 }}>
            {ar ? "كل يوم يحمل توزيعه: حضر، تأخّر، غاب — واليوم الذي انكسرت فيه حلقة يُعلَّم بحدّ ذهبي." : "Each day carries its split: on time, late, absent — a broken ring is marked in gold."}
          </span>
        </div>
        <div className="nv-ops-cal-head-tools" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <DateNav
            mode={selected > 0 ? "day" : "month"}
            step="month"
            ar={ar}
            value={new Date(year, month, selected > 0 ? selected : 1)}
            onPrev={() => goMonth(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1)}
            onNext={() => goMonth(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1)}
            onToday={() => { goMonth(now.getFullYear(), now.getMonth(), now.getDate()); setQuery(""); setQuick(""); }}
            isCurrent={year === now.getFullYear() && month === now.getMonth() && selected === now.getDate()}
            currentLabel={ar ? "اليوم" : "Today"}
            max={new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())}
            onPick={(picked) => goMonth(picked.getFullYear(), picked.getMonth(), selected > 0 ? picked.getDate() : 0)}
          />
          {!lane ? (
            <div style={{ display: "flex", gap: 3 }}>
              {[["team", ar ? "الفريق" : "Team"], ["me", ar ? "سجلّي" : "Mine"]].map(([id, label]) => (
                <button key={id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setView(id)} style={pill(view === id)}>{label}</button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {myself ? (
        <MyMonthLine
          me={myself}
          company={company}
          data={data}
          year={year}
          month={month}
          selectedDay={selected}
          monthName={`${months[month]} ${year}`}
          mine={mine}
          ar={ar}
        />
      ) : null}

      {/* No «ملفك يرى فرع … فقط» notice here — the employee file stays on its own branch without saying so. */}

      <section style={{ ...shell, padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {framed ? null : <div style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${OC.line}`, padding: "8px 12px", minWidth: "min(300px,100%)", flex: 1, maxWidth: 420 }}>
          <span style={{ width: 15, height: 15, color: OC.muted, flex: "none" }}><SearchIcon /></span>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setQuick(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") applyQueryJump(query); }}
            placeholder={ar ? "اقفز لتاريخ: 10 · 10/9 · سبتمبر — أو اكتب: غياب، تأخير، انكسار" : "Jump: 10 · 10/9 · Sep — or type absent, late, break"}
            style={{ fontFamily: "inherit", fontSize: 12, border: "none", outline: "none", background: "none", color: OC.ink, width: "100%", minWidth: 0 }}
          />
          {(query || quick) ? (
            <button type="button" onClick={() => { setQuery(""); setQuick(""); }} style={{ fontFamily: "inherit", border: "none", background: "none", color: OC.muted, cursor: "pointer", fontSize: 14, padding: 0, flex: "none" }}>×</button>
          ) : null}
        </div>}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[["", ar ? "الكل" : "All"], ["week", ar ? "آخر أسبوع" : "Last week"], ["abs", ar ? "أيام الغياب" : "Absent days"], ["late", ar ? "أيام التأخير" : "Late days"], ["broken", ar ? "انكسار السلسلة" : "Broken ring"]].map(([id, label]) => (
            <button key={id || "all"} type="button" onClick={() => { setQuick(id); setQuery(""); }} style={chip(quick === id && !query)}>{label}</button>
          ))}
      </div>
        <span style={{ marginInlineStart: "auto", fontSize: 11, color: OC.muted, whiteSpace: "nowrap" }}>
          {filtering ? (ar ? `${matched.length} يوم مطابق من ${cells.filter((c) => !c.blank).length}` : `${matched.length} matching of ${cells.filter((c) => !c.blank).length}`) : (ar ? `${cells.filter((c) => !c.blank).length} يوم في الشهر` : `${cells.filter((c) => !c.blank).length} days in month`)}
        </span>
      </section>

      {sheet && selRec && !rangeOn && (
        <div onClick={() => setSheet(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(20,33,61,.42)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflow: "auto" }}>
          <div dir={ar ? "rtl" : "ltr"} onClick={(e) => e.stopPropagation()} style={{ width: "min(720px,100%)", background: "var(--nv-card)", border: `1px solid ${OC.line}`, display: "flex", flexDirection: "column" }}>
            <DayPanel
              ar={ar}
              dayTitle={dayTitle}
              daySub={daySub}
              statGroups={statGroups}
              rosterPack={rosterPack}
              nameQuery={nameQuery}
              setNameQuery={setNameQuery}
              quietOpen={quietOpen}
              setQuietOpen={setQuietOpen}
              events={events}
              noEvents={noEvents}
              rec={selRec}
              modal
              onClose={() => setSheet(false)}
              currentUserId={currentUser?.id}
            />
          </div>
        </div>
      )}

      <div className="nv-ops-cal-board">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {!loading && weekCells.length ? (
            <button
              type="button"
              data-week-line
              onClick={() => setRange({ from: weekFrom, to: weekTo })}
              title={ar ? "اعرض الأسبوع في المقارنة" : "Show the week in the comparison"}
              style={{ fontFamily: "inherit", textAlign: "start", border: `1px solid ${OC.line}`, background: rangeFrom === weekFrom && rangeTo === weekTo ? OC.greenBg : "var(--nv-card)", borderRadius: 12, padding: "10px 16px", cursor: "pointer", display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap", color: OC.mid, fontSize: 12, lineHeight: 1.8 }}
            >
              <span style={{ fontWeight: 700, color: OC.ink }}>
                {ar ? `أسبوع ${Number(weekFrom.slice(8))}–${Number(weekTo.slice(8))} ${months[month]}` : `Week ${Number(weekFrom.slice(8))}–${Number(weekTo.slice(8))} ${months[month]}`}
              </span>
              {[
                [ar ? "حضر" : "On time", weekSum.on, OC.greenText],
                [ar ? "تأخّر" : "Late", weekSum.late, OC.goldText],
                [ar ? "غاب" : "Absent", weekSum.abs, OC.abs],
                [ar ? "إجازة" : "Leave", weekSum.leave, OC.leave],
                [ar ? "مخالفات" : "Breaches", weekSum.lateReturn + weekSum.early, OC.goldText],
                [ar ? "إضافي" : "Overtime", weekSum.otMinutes ? minutesPhrase(weekSum.otMinutes, ar) : 0, OC.mid],
                [ar ? "بانتظار قرار" : "Awaiting", weekSum.awaiting, OC.abs],
                [ar ? "طلبات معلّقة" : "Pending", weekSum.pending, OC.goldText],
              ].map(([label, value, color]) => (
                <span key={label} style={{ display: "inline-flex", gap: 5, alignItems: "baseline", whiteSpace: "nowrap" }}>
                  {label}
                  <span dir={typeof value === "number" ? "ltr" : undefined} style={{ fontFamily: typeof value === "number" ? "'IBM Plex Mono', monospace" : "inherit", fontSize: 13, color: value ? color : OC.muted, fontWeight: value ? 600 : 400 }}>{value}</span>
                </span>
              ))}
            </button>
          ) : null}
          {loading ? (
            <section style={{ ...shell, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 style={{ width: 18, height: 18, color: OC.green, animation: "spin 1s linear infinite" }} />
            </section>
          ) : layout === "grid" ? (
            <section data-cal-grid style={{ ...shell, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6, padding: "10px 10px 0" }}>
                {weekdays.map((label, i) => (
                  <span key={label} style={{ padding: "4px 0", textAlign: "center", fontSize: 11.5, fontWeight: 600, color: (i === 5 || i === 6) ? OC.muted : OC.mid }}>{label}</span>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6, padding: 10 }}>
                {cells.map((cell, index) => {
                  if (cell.blank) {
                    return <div key={`b${index}`} aria-hidden style={{ minHeight: 108 }} />;
                  }
                  const on = selected === cell.d;
                  const hit = !filtering || matchCell(cell);
                  const rec = cell.rec;
                  const items = cellItems(rec);
                  const myMark = myself ? myCellMark(mine.byKey[cell.key], ar) : null;
                  const counts = rec ? [
                    ["on", ar ? "حضر" : "On", rec.on, OC.greenText, OC.greenBg],
                    ["late", ar ? "تأخّر" : "Late", rec.late, OC.goldText, OC.goldBg],
                    ["abs", ar ? "غاب" : "Abs", rec.abs, OC.abs, OC.absBg],
                    ["leave", ar ? "إجازة" : "Leave", rec.leave, OC.leave, OC.leaveBg],
                  ].filter((row) => row[2] > 0) : [];
                  const surface = !hit
                    ? "var(--nv-soft)"
                    : cell.today
                      ? OC.greenBg
                      : (cell.weekend && !rec ? "var(--nv-soft)" : "var(--nv-card)");
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      data-cal-day={cell.key}
                      className="nv-cal-tile"
                      onClick={() => pickDay(cell.d, !!rec)}
                      style={{
                        fontFamily: "inherit",
                        textAlign: "start",
                        position: "relative",
                        minWidth: 0,
                        minHeight: 108,
                        padding: "9px 10px",
                        borderRadius: 10,
                        border: on ? "2px solid var(--nv-btn-fill, #0B3D27)" : `1px solid ${cell.today ? OC.greenBd : "var(--nv-line2)"}`,
                        background: surface,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 7,
                        opacity: hit ? 1 : 0.5,
                        boxSizing: "border-box",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: cell.today || on ? 700 : 500, color: cell.weekend && !rec ? OC.muted : (cell.future ? OC.mid : OC.ink) }}>{cell.d}</span>
                        {cell.today ? <span className="nv-cal-today-chip" style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--nv-btn-fill, #0B3D27)", borderRadius: 999, padding: "1px 8px" }}>{ar ? "اليوم" : "Today"}</span> : null}
                        {rec?.broke ? <span title={ar ? BROKE[rec.broke]?.ar : BROKE[rec.broke]?.en} dir="ltr" style={{ marginInlineStart: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, color: OC.goldText, background: OC.goldBg, border: `1px solid ${OC.goldBd}`, borderRadius: 999, padding: "0 6px" }}>{rec.broke}</span> : null}
                      </div>
                      {cell.duty?.mine ? (
                        <span data-cal-shift={cell.duty.kind} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: shiftTypeStyle(cell.duty.mine).fg, minWidth: 0 }}>
                          <KindIcon kind={cell.duty.kind} size={13} />
                          <span className="nv-cal-pill-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.duty.mine.label}</span>
                        </span>
                      ) : cell.duty?.counts ? (
                        <span data-cal-shifts style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11, color: OC.mid }}>
                          {["morning", "evening", "night"].filter((kind) => cell.duty.counts[kind]).map((kind) => (
                            <span key={kind} title={ar ? `${{ morning: "صباحي", evening: "مسائي", night: "ليلي" }[kind]}: ${cell.duty.counts[kind]}` : kind} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <KindIcon kind={kind} size={12} style={{ color: kind === "night" ? "var(--nv-ink)" : kind === "evening" ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)" }} />
                              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{cell.duty.counts[kind]}</span>
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {rec && rec.head ? (
                        <div style={{ display: "flex", height: 5, borderRadius: 999, background: OC.soft, overflow: "hidden", width: "100%" }}>
                          <div style={{ width: pct(rec.on, rec.head), background: OC.green }} />
                          <div style={{ width: pct(rec.late, rec.head), background: OC.gold }} />
                          <div style={{ width: pct(rec.abs, rec.head), background: OC.abs }} />
                          <div style={{ width: pct(rec.leave, rec.head), background: OC.leave }} />
                        </div>
                      ) : null}
                      {counts.length ? (
                        <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {counts.map(([id, label, n, color, bg]) => (
                            <span key={id} data-cal-count={id} className="nv-cal-pill" style={{ display: "inline-flex", alignItems: "baseline", gap: 3, fontSize: 10.5, fontWeight: 600, color, background: bg, borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>
                              <span className="nv-cal-pill-label">{label}</span><span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{n}</span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="nv-cal-quiet" style={{ fontSize: 11, color: OC.muted }}>
                          {rec ? (cell.future ? (ar ? "مجدول" : "Scheduled") : (ar ? "لا حالة حضور" : "No attendance state")) : (cell.weekend ? (ar ? "عطلة" : "Off") : (cell.future ? (ar ? "مجدول" : "Scheduled") : ""))}
                        </span>
                      )}
                      {myMark ? (
                        // My own day — its own small line under the branch counters, never mistaken for them.
                        <span data-my-mark={myMark.kind} className="nv-cal-mine" title={myMark.text} style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", fontSize: 10, fontWeight: 600, color: myMark.kind === "absent" ? OC.abs : OC.goldText, borderTop: `1px dashed ${OC.soft}`, paddingTop: 4, minWidth: 0 }}>
                          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, flex: "none", background: myMark.kind === "absent" ? OC.abs : OC.gold }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{ar ? "أنا: " : "Me: "}{myMark.text}</span>
                        </span>
                      ) : null}
                      {items.length ? (
                        <span className="nv-cal-items" style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "auto" }}>
                          {items.map((item) => (
                            <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: item.color, background: item.bg, border: `1px solid ${item.border}`, borderRadius: 999, padding: "0 7px", whiteSpace: "nowrap" }}>
                              {item.label}<span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{item.count}</span>
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div data-cal-legend style={{ padding: "10px 14px 14px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${OC.soft}` }}>
                {legend.map((item) => (
                  <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: OC.mid, border: "1px solid var(--nv-pill-line, #D5DCD8)", background: "var(--nv-card)", borderRadius: 999, padding: "3px 10px 3px 8px" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, border: `1px solid ${item.border}` }} />
                    {item.label}
                  </span>
                ))}
              </div>
            </section>
          ) : layout === "matrix" ? (
            <MatrixView ar={ar} cells={cells} weekdays={weekdays} selected={selected} pickDay={pickDay} />
          ) : layout === "strip" ? (
            <StripView ar={ar} cells={cells} selected={selected} pickDay={pickDay} filtering={filtering} matchCell={matchCell} legend={legend} />
          ) : (
            <section style={{ ...shell, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0,2.4fr) 54px 54px 54px 54px 74px", gap: 14, padding: "10px 18px", fontSize: 11, color: OC.muted, background: OC.wash, borderBottom: `1px solid ${OC.line}` }}>
                <span>{ar ? "اليوم" : "Day"}</span><span>{ar ? "التوزيع" : "Split"}</span><span>{ar ? "حضر" : "On"}</span><span>{ar ? "متأخر" : "Late"}</span><span>{ar ? "غاب" : "Abs"}</span><span>{ar ? "إجازة" : "Leave"}</span><span>{ar ? "السلسلة" : "Chain"}</span>
              </div>
              {matched.map((cell) => {
                const rec = cell.rec;
                const on = selected === cell.d;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => pickDay(cell.d, !!rec)}
                    style={{ fontFamily: "inherit", textAlign: "start", display: "grid", gridTemplateColumns: "120px minmax(0,2.4fr) 54px 54px 54px 54px 74px", gap: 14, padding: "11px 18px", alignItems: "center", border: "none", borderBottom: "1px solid var(--nv-line2)", background: rec?.leave ? OC.leaveBg : (on ? OC.greenBg : "var(--nv-card)"), cursor: "pointer", outline: on ? `2px solid ${OC.green}` : "none", outlineOffset: -2, width: "100%", boxSizing: "border-box" }}
                  >
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: cell.today ? 700 : 500, color: cell.weekend || cell.future ? OC.muted : OC.ink }}>{cell.d}</span>
                      <span style={{ fontSize: 11, color: OC.muted, whiteSpace: "nowrap" }}>{weekdays[cell.wd]}</span>
                    </span>
                    <div style={{ display: "flex", height: 9, background: OC.soft, overflow: "hidden" }}>
                      <div style={{ width: rec ? pct(rec.on, rec.head) : "0%", background: OC.green }} />
                      <div style={{ width: rec ? pct(rec.late, rec.head) : "0%", background: OC.gold }} />
                      <div style={{ width: rec ? pct(rec.abs, rec.head) : "0%", background: OC.abs }} />
                      <div style={{ width: rec ? pct(rec.leave, rec.head) : "0%", background: OC.leave }} />
                    </div>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: OC.greenText }}>{rec ? rec.on : "—"}</span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: rec?.late ? OC.goldText : OC.muted }}>{rec ? rec.late : "—"}</span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: rec?.abs ? OC.abs : OC.muted }}>{rec ? rec.abs : "—"}</span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: rec?.leave ? OC.leave : OC.muted, fontWeight: rec?.leave ? 700 : 400 }}>{rec ? rec.leave : "—"}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: rec ? (rec.broke ? OC.abs : OC.greenText) : OC.muted, whiteSpace: "nowrap" }}>
                      {rec ? (rec.broke ? (ar ? `انكسرت ${rec.broke}` : `Broke ${rec.broke}`) : (ar ? "سليمة" : "Intact")) : (cell.weekend ? (ar ? "عطلة" : "Off") : (ar ? "مجدول" : "Set"))}
                    </span>
                  </button>
                );
              })}
              {!matched.length && (
                <div style={{ padding: 20 }}><span style={{ fontSize: 12, color: OC.muted }}>{ar ? `لا يوم يطابق البحث في ${months[month]} ${year}.` : `No day matches in ${months[month]} ${year}.`}</span></div>
              )}
            </section>
          )}

          <section data-cmp style={{ ...shell, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${OC.soft}`, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 260px" }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{mineLane ? (ar ? "مقارنة الموظفين" : "People comparison") : (ar ? "مقارنة موظفي النطاق" : "People in scope")}</span>
                  <span style={{ fontSize: 12, color: OC.muted, lineHeight: 1.7 }}>
                    {view !== "team"
                      ? (ar ? "المقارنة متاحة في عرض «الفريق» فقط" : "Comparison is available in Team view")
                      : [
                        scopeLine,
                        rangeOn
                          ? (rangeDays.length ? (ar ? `${rangeDays.length} يوم مسجّل` : `${rangeDays.length} days`) : (ar ? "لا يوم مسجّل بين التاريخين" : "No recorded day in range"))
                          : (sel && !sel.blank ? (ar ? `يوم ${weekdays[sel.wd]} ${sel.d} ${months[month]}` : `${weekdays[sel.wd]} ${sel.d} ${months[month]}`) : (ar ? "اختر يوماً" : "Pick a day")),
                      ].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {view === "team" ? (
                  <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 220px", maxWidth: 320 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: OC.mid }}>{ar ? "ابحث بالاسم" : "Search by name"}</span>
                    <input
                      value={cmpQuery}
                      onChange={(e) => setCmpQuery(e.target.value)}
                      placeholder={ar ? "اسم موظف في النطاق" : "A name in scope"}
                      style={{ fontFamily: "inherit", fontSize: 12.5, height: 36, padding: "0 12px", border: `1px solid ${OC.line}`, borderRadius: 10, outline: "none", background: "var(--nv-card)", color: OC.ink, width: "100%", boxSizing: "border-box" }}
                    />
                  </label>
                ) : null}
              </div>

              {view === "team" ? (
                <div data-cmp-mode style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: OC.mid }}>{ar ? "المقارنة" : "Compare"}</span>
                  <StatusFilterPills
                    bare
                    dataKey="cmp-mode"
                    value={cmpMode}
                    onChange={setCmpMode}
                    items={[
                      { id: "all", label: ar ? "كل النطاق" : "Whole scope" },
                      { id: "pick", label: ar ? "بين موظفين" : "Between people", n: cmpMode === "pick" ? cmpPicked.length : undefined },
                      { id: "versus", label: ar ? "موظف مقابل الآخرين" : "One vs the rest" },
                    ]}
                  />
                  {cmpMode !== "all" ? (
                    <div data-cmp-pick style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 10.5, color: OC.muted }}>
                        {cmpMode === "pick"
                          ? (ar ? "اختر موظفين أو أكثر — الضغط مرة ثانية يزيل الاسم" : "Pick two or more — press again to remove")
                          : (ar ? "اختر الموظف — يُقارن بمتوسط بقية النطاق" : "Pick the person — compared with the rest of the scope")}
                      </span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 132, overflowY: "auto" }}>
                        {pickChoices.map((row) => {
                          const on = cmpMode === "pick" ? pickedSet.has(String(row.id)) : String(row.id) === focusId;
                          return (
                            <button
                              key={row.id}
                              type="button"
                              data-cmp-person={row.id}
                              aria-pressed={on}
                              onClick={() => {
                                if (cmpMode === "versus") { setCmpFocus(String(row.id)); return; }
                                setCmpPicked((list) => (list.map(String).includes(String(row.id)) ? list.filter((id) => String(id) !== String(row.id)) : [...list, String(row.id)]));
                              }}
                              style={{ ...statusPillStyle(on, "sm"), gap: 6, paddingInlineStart: 4 }}
                            >
                              <NameLetter name={row.name} mine={on} />
                              {row.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div data-cmp-range style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: OC.mid }}>{ar ? "المدى" : "Range"}</span>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <StatusFilterPills
                    bare
                    dataKey="cmp-range"
                    value={rangePreset}
                    onChange={(id) => rangePresets.find((p) => p.id === id)?.run()}
                    items={rangePresets.map((p) => ({ id: p.id, label: p.label }))}
                  />
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, width: 168 }}>
                    <span style={{ fontSize: 10.5, color: OC.muted }}>{ar ? "من" : "From"}</span>
                    <PlatformDateField compact ar={ar} value={rangeFrom} onChange={(next) => setRange({ ...(range || {}), from: next })} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, width: 168 }}>
                    <span style={{ fontSize: 10.5, color: OC.muted }}>{ar ? "إلى" : "To"}</span>
                    <PlatformDateField compact ar={ar} value={rangeTo} min={rangeFrom} onChange={(next) => setRange({ ...(range || {}), to: next })} />
                  </label>
                </div>
              </div>

              <div data-cmp-sort style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: OC.mid }}>{ar ? "رتّب حسب" : "Sort by"}</span>
                {CMP_GROUPS.map((group) => (
                  <div key={group.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: OC.muted, minWidth: 54 }}>{group.label}</span>
                    <StatusFilterPills
                      bare
                      size="sm"
                      dataKey={`cmp-sort-${group.id}`}
                      value={cmp}
                      onChange={setCmp}
                      items={group.keys.map((key) => ({ id: key, label: cmpLabels[key][0], n: cmpTotals[key] }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            {cmpSorted.length ? (
              <div data-cmp-scroll className="nv-cmp-scroll" style={{ overflowX: "auto", maxWidth: "100%" }}>
                <div role="table" style={{ minWidth: 820 }}>
                  <div role="row" style={{ display: "grid", gridTemplateColumns: cmpGrid, gap: 6, padding: "8px 20px 0", fontSize: 10.5, color: OC.muted }}>
                    <span />
                    <span />
                    {CMP_GROUPS.map((group) => (
                      <span key={group.id} style={{ gridColumn: `span ${group.keys.length}`, textAlign: "center", fontWeight: 700, borderBottom: `2px solid ${OC.soft}`, paddingBottom: 4 }}>{group.label}</span>
                    ))}
                  </div>
                  <div role="row" style={{ display: "grid", gridTemplateColumns: cmpGrid, gap: 6, padding: "8px 20px", fontSize: 11, color: OC.muted, borderBottom: `1px solid ${OC.soft}` }}>
                    <span role="columnheader">{ar ? "الموظف" : "Name"}</span>
                    <span role="columnheader">{ar ? "توزيع الأيام" : "Split"}</span>
                    {CMP_ORDER.map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="columnheader"
                        aria-sort={cmp === key ? "descending" : "none"}
                        onClick={() => setCmp(key)}
                        style={{ fontFamily: "inherit", fontSize: 11, border: "none", background: cmp === key ? "var(--nv-ok-soft)" : "transparent", color: cmp === key ? OC.greenText : OC.muted, fontWeight: cmp === key ? 700 : 500, borderRadius: 999, padding: "2px 0", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {cmpLabels[key][2]}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px 12px" }}>
                    {cmpMode === "pick" && cmpRows.length < 2 ? (
                      <span style={{ fontSize: 12, color: OC.muted, padding: "6px 8px" }}>{ar ? "اختر موظفين اثنين على الأقل من الأسماء أعلاه." : "Pick at least two people above."}</span>
                    ) : null}
                    {cmpRows.map((row) => {
                      const tot = Math.max(1, row.on + row.late + row.abs + row.leave);
                      const self = !row.synthetic && isViewerOwnFile(row, currentUser);
                      return (
                        <div key={row.id} role="row" data-cmp-row={row.id} style={{ display: "grid", gridTemplateColumns: cmpGrid, gap: 6, padding: "9px 8px", alignItems: "center", borderRadius: 10, border: row.synthetic ? `1px dashed ${OC.line}` : `1px solid ${self ? OC.greenBd : "var(--nv-line2)"}`, background: row.synthetic ? "var(--nv-soft)" : (self ? OC.greenBg : "var(--nv-card)") }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            {row.synthetic
                              ? <span aria-hidden style={{ width: 26, height: 26, flex: "none", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: "var(--nv-card)", color: OC.mid, border: `1px solid ${OC.line}` }}>≈</span>
                              : <NameLetter name={row.name} mine={self} />}
                            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{row.name}</span>
                            {self ? <FileSelfBadge ar={ar} /> : null}
                          </span>
                          <div style={{ display: "flex", height: 6, borderRadius: 999, background: OC.soft, overflow: "hidden" }}>
                            <div title={ar ? `حضر ${row.on}` : `On ${row.on}`} style={{ width: pct(row.on, tot), background: OC.green }} />
                            <div title={ar ? `تأخّر ${row.late}` : `Late ${row.late}`} style={{ width: pct(row.late, tot), background: OC.gold }} />
                            <div title={ar ? `غاب ${row.abs}` : `Absent ${row.abs}`} style={{ width: pct(row.abs, tot), background: OC.abs }} />
                            <div title={ar ? `إجازة ${row.leave}` : `Leave ${row.leave}`} style={{ width: pct(row.leave, tot), background: OC.leave }} />
                          </div>
                          {CMP_ORDER.map((key) => {
                            const value = Number(row[key]) || 0;
                            return (
                              <span key={key} role="cell" style={{ textAlign: "center", padding: "3px 0" }}>
                                {value ? (
                                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, fontWeight: 600, color: cmpColor(key, value) }}>
                                    {key === "ot" ? minutesShort(value) : value}
                                  </span>
                                ) : (
                                  <span aria-label="0" style={{ color: "var(--nv-line)", fontSize: 12 }}>—</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${OC.soft}` }}>
              <span style={{ fontSize: 12, color: OC.mid, lineHeight: 1.85 }}>
                {view !== "team"
                  ? (ar ? "بدّل إلى «الفريق» أعلى الصفحة لمقارنة الموظفين." : "Switch to Team to compare people.")
                  : cmpMode === "versus" && focusRow
                    ? (versusLine
                      ? (ar ? `${focusRow.name} مقابل متوسط الآخرين — ${versusLine}.` : `${focusRow.name} vs the others — ${versusLine}.`)
                      : (ar ? `${focusRow.name} مثل متوسط الآخرين في الغياب والتأخير والمخالفات والمعلّق.` : `${focusRow.name} matches the others' average.`))
                  : (top && topScore > 0
                    ? (ar ? `الأعلى في «${cmpTitle}»: ${top.name} بـ${cmp === "ot" ? minutesPhrase(topScore, true) : topScore}، و${zero} بلا شيء منه.` : `Highest ${cmpTitle}: ${top.name} at ${topScore}; ${zero} with none.`)
                    : (ar ? `لا أحد سجّل «${cmpTitle}» في هذا المدى.` : `Nobody recorded ${cmpTitle} in this range.`))}
              </span>
            </div>
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section style={{ ...shell, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${OC.soft}`, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{dayTitle}</span>
              <span style={{ fontSize: 12, color: OC.muted, lineHeight: 1.7 }}>{daySub}</span>
              {sel?.today && !rangeOn ? (
                <Link to="/app/attendance" style={{ fontSize: 11, fontWeight: 600, color: OC.greenText, textDecoration: "none" }}>
                  {ar ? "اليوم لم يُغلق بعد — اعرضه في شاشة الحضور ←" : "Today is still open — view it on Attendance →"}
                </Link>
              ) : null}
              {rangeOn ? (
                <button type="button" onClick={() => setRange(null)} style={{ alignSelf: "flex-start", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: OC.greenText, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                  {ar ? "عودة إلى يوم واحد" : "Back to one day"}
                </button>
              ) : null}
            </div>
            {rangeOn && (
              <div style={{ borderBottom: `1px solid ${OC.soft}`, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "11px 18px 7px" }}><span style={{ fontSize: 12, fontWeight: 700 }}>{rangeDays.length ? (ar ? `أيام المدى · ${rangeDays.length}` : `Range days · ${rangeDays.length}`) : (ar ? "لا يوم مسجّل في هذا المدى" : "No recorded day")}</span></div>
                {rangeDays.map((day) => (
                  <button key={`${day.y}-${day.m}-${day.d}`} type="button" onClick={() => { goMonth(day.y, day.m, day.d); setRange(null); setSheet(true); }} style={{ fontFamily: "inherit", textAlign: "start", padding: "8px 18px", border: "none", borderTop: "1px solid var(--nv-hover)", background: "var(--nv-card)", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto auto", gap: 9, alignItems: "baseline", width: "100%", boxSizing: "border-box" }}>
                    <span style={{ fontSize: 11, color: OC.ink, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{weekdays[day.wd]} {day.d} {months[day.m]}</span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: OC.greenText }}>{day.rec.on}</span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: day.rec.late ? OC.goldText : OC.muted }}>{day.rec.late}</span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: day.rec.abs ? OC.abs : OC.muted }}>{day.rec.abs}</span>
                  </button>
                ))}
              </div>
            )}
            {src ? (
              <DayPanel
                ar={ar}
                dayTitle={null}
                daySub={null}
                statGroups={statGroups}
                rosterPack={rosterPack}
                nameQuery={nameQuery}
                setNameQuery={setNameQuery}
                quietOpen={quietOpen}
                setQuietOpen={setQuietOpen}
                events={events}
                noEvents={noEvents}
                rec={rangeOn ? null : selRec}
                hideRoster={rangeOn}
                currentUserId={currentUser?.id}
              />
            ) : (
              <div style={{ padding: 18 }}>
                <span style={{ fontSize: 12, color: OC.muted, lineHeight: 1.85 }}>
                  {rangeOn
                    ? (ar ? "لا يوم مسجّل في هذا المدى." : "No recorded day in this range.")
                    : !sel
                      ? (ar ? "اختر يوماً لترى توزيعه وحلقاته الخمس." : "Pick a day to see its split and five rings.")
                      : (sel.weekend ? (ar ? "لا وردية مجدولة، فلا غياب يُحسب." : "No scheduled shift, so no absence is counted.") : (ar ? "يوم مجدول لم يبدأ بعد. الأرقام تظهر بعد أول تسجيل." : "A scheduled day that has not started. Figures appear after the first punch."))}
                </span>
              </div>
            )}
          </section>

          <section style={{ ...shell, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${OC.soft}` }}><span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "حصيلة الشهر" : "Month total"}</span></div>
            {(!real.length ? [
              { label: ar ? "أيام مجدولة" : "Scheduled days", value: String(scheduled), note: ar ? "الجمعة والسبت خارج الحساب" : "Friday and Saturday excluded", color: OC.ink },
              { label: ar ? "أيام مسجّلة" : "Recorded days", value: "0", note: ar ? "لم يبدأ الشهر بعد" : "Month has not started", color: OC.muted },
            ] : [
              { label: ar ? "أيام مجدولة" : "Scheduled days", value: String(scheduled), note: ar ? "الجمعة والسبت خارج الحساب" : "Friday and Saturday excluded", color: OC.ink },
              { label: ar ? "أيام مسجّلة" : "Recorded days", value: String(real.length), note: real.length >= scheduled ? (ar ? "الشهر مكتمل" : "Month complete") : (ar ? "الباقي لم يأتِ بعد" : "The rest has not come"), color: OC.ink },
              { label: ar ? "الحضور في الوقت" : "On time", value: pct(totals.on, punchTotal), note: ar ? `${totals.on} من ${punchTotal} يوم-موظف مسجّل` : `${totals.on} of ${punchTotal} person-days`, color: totals.on / punchTotal >= 0.9 ? OC.greenText : OC.goldText },
              { label: ar ? "أيام التأخير" : "Late days", value: String(totals.late), note: ar ? "تأخير أقل من ساعة لا يُحتسب غياباً" : "Late under an hour is not absence", color: OC.goldText },
              { label: ar ? "الغياب" : "Absence", value: String(totals.abs), note: ar ? "بلا تسجيل ولا إجازة معتمدة" : "No punch and no approved leave", color: totals.abs ? OC.abs : OC.greenText },
              { label: ar ? "أيام فيها مهام" : "Days with tasks", value: String(taskDays), note: ar ? `${tasksTotal} مهمة في الشهر` : `${tasksTotal} tasks this month`, color: OC.ink },
              { label: ar ? "أيام إجازة معتمدة" : "Approved leave days", value: String(leaveDays), note: leaveNote, color: OC.leave },
              { label: ar ? "إجازة على وردية منشورة" : "Leave on a published shift", value: String(clashDays), note: clashDays ? (ar ? "تحتاج بديلاً في جدول الدوام — الجدول والملف يتناقضان في هذه الأيام" : "Needs a substitute on the duty roster — the roster and the file disagree") : (ar ? "لا تناقض بين الجدول والملف" : "No clash between the roster and the file"), color: clashDays ? OC.goldText : OC.greenText },
              { label: ar ? "مخالفات الدوام" : "Duty breaches", value: String(monthSum.lateReturn + monthSum.early), note: ar ? `${monthSum.lateReturn} عودة متأخرة من الراحة · ${monthSum.early} انصراف مبكر${monthSum.otMinutes ? ` · إضافي ${minutesPhrase(monthSum.otMinutes, true)}` : ""}` : `${monthSum.lateReturn} late returns · ${monthSum.early} early leaves`, color: (monthSum.lateReturn + monthSum.early) ? OC.goldText : OC.greenText },
              { label: ar ? "بانتظار قرار أو طلب" : "Awaiting a decision or request", value: String(monthSum.awaiting + monthSum.pending), note: ar ? `${monthSum.awaiting} بصمة بانتظار القرار · ${monthSum.pending} طلب معلّق` : `${monthSum.awaiting} punches awaiting · ${monthSum.pending} pending requests`, color: (monthSum.awaiting + monthSum.pending) ? OC.abs : OC.greenText },
              { label: ar ? "أيام فيها بلاغ سلامة" : "Days with HSE", value: String(hseDays), note: hseDays ? (ar ? "كل بلاغ يراه موظفو الفرع" : "Each report is visible to the branch") : (ar ? "لا بلاغات هذا الشهر" : "No reports this month"), color: hseDays ? OC.abs : OC.greenText },
            ]).map((item) => (
              <div key={item.label} style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "baseline" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: OC.muted, lineHeight: 1.7 }}>{item.note}</span>
                </span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, color: OC.ink }}>{item.value}</span>
              </div>
            ))}
            <div style={{ padding: "13px 18px" }}><span style={{ fontSize: 11, color: OC.mid, lineHeight: 1.85 }}>{monthInsight}</span></div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MatrixView({ ar, cells, weekdays, selected, pickDay }) {
  const weeks = [];
  let cur = [];
  cells.forEach((cell) => {
    cur.push(cell);
    if (cur.length === 7) {
      weeks.push(cur);
      cur = [];
    }
  });
  if (cur.length) {
    while (cur.length < 7) cur.push({ blank: true });
    weeks.push(cur);
  }
  const byWd = weekdays.map((_, i) => {
    const days = cells.filter((cell) => cell.rec && cell.wd === i);
    const on = days.reduce((acc, cell) => acc + cell.rec.on, 0);
    const head = days.reduce((acc, cell) => acc + cell.rec.head, 0);
    return head ? on / head : null;
  });
  const worstIdx = byWd.reduce((best, value, i) => (value != null && (best < 0 || value < byWd[best]) ? i : best), -1);
  const scale = [
    { label: "98%+", color: "var(--nv-ok-ink)" },
    { label: "92%", color: "#5cb98a" },
    { label: "85%", color: "#a8dcc2" },
    { label: "75%", color: "#f0d79a" },
    { label: ar ? "أقل" : "Low", color: "#e2a3a3" },
  ];
  return (
    <section style={{ background: "var(--nv-card)", border: `1px solid ${OC.line}`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "نمط الأسبوع" : "Week pattern"}</span>
        <span style={{ fontSize: 12, color: OC.muted }}>{ar ? "أيام الأسبوع في الأعمدة، أسابيع الشهر في الصفوف. التكرار يظهر عموداً، لا صدفة." : "Weekdays in columns, month weeks in rows. A weak column is a cause, not chance."}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7,minmax(0,1fr)) 66px", gap: 5 }}>
        <span style={{ textAlign: "center", fontSize: 11, color: OC.muted, paddingBottom: 2 }}>{ar ? "الأسبوع" : "Week"}</span>
        {weekdays.map((label, i) => (
          <span key={label} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: (i === 5 || i === 6) ? OC.muted : OC.mid, paddingBottom: 2 }}>{label}</span>
        ))}
        <span style={{ textAlign: "center", fontSize: 11, color: OC.muted }}>{ar ? "المعدّل" : "Avg"}</span>
        {weeks.map((week, wi) => {
          const wr = week.filter((cell) => cell.rec);
          const on = wr.reduce((acc, cell) => acc + cell.rec.on, 0);
          const head = wr.reduce((acc, cell) => acc + cell.rec.head, 0);
          return (
            <React.Fragment key={wi}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", height: 46, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: OC.mid }}>{wi + 1}</span>
              {week.map((cell, ci) => {
                if (cell.blank) return <span key={`b${ci}`} style={{ height: 46 }} />;
                const rec = cell.rec;
                const rate = rec ? rec.on / Math.max(1, rec.head) : null;
                const sh = shadeRate(rate);
                return (
                  <button
                    key={cell.key || `c${ci}`}
                    type="button"
                    title={rec ? `${cell.d} — ${ar ? "حضر" : "on"} ${rec.on} / ${rec.head}` : String(cell.d)}
                    onClick={() => pickDay(cell.d, !!rec)}
                    style={{ fontFamily: "'IBM Plex Mono', monospace", border: `1px solid ${OC.line}`, background: rec?.leave ? OC.leaveBg : (rec ? sh.bg : (cell.weekend ? "var(--nv-line2)" : OC.wash)), color: rec?.leave ? OC.leave : (rec ? sh.fg : OC.muted), cursor: "pointer", padding: 0, height: 46, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, fontSize: 12, fontWeight: rec ? 600 : 400, outline: selected === cell.d ? `2px solid ${OC.ink}` : "none", outlineOffset: -2 }}
                  >
                    <span>{cell.d}</span>
                    {rec ? <span dir="ltr" style={{ fontSize: 9, opacity: 0.85 }}>{Math.round(rate * 100)}%</span> : null}
                  </button>
                );
              })}
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", height: 46, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: head && on / head >= 0.9 ? OC.greenText : OC.goldText, border: `1px solid ${OC.soft}` }}>{head ? `${Math.round(on / head * 100)}%` : "—"}</span>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7,minmax(0,1fr)) 66px", gap: 5, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: OC.muted, textAlign: "center" }}>{ar ? "المعدّل" : "Avg"}</span>
        {byWd.map((value, i) => (
          <span key={weekdays[i]} dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", textAlign: "center", fontSize: 12, fontWeight: 600, color: value == null ? OC.muted : (value >= 0.9 ? OC.greenText : OC.goldText), borderTop: `2px solid ${value == null ? OC.line : (value >= 0.9 ? OC.greenText : OC.goldText)}`, paddingTop: 5 }}>{value == null ? "—" : `${Math.round(value * 100)}%`}</span>
        ))}
        <span />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${OC.soft}`, paddingTop: 12 }}>
        <span style={{ fontSize: 11, color: OC.mid }}>{ar ? "نسبة الحضور في الوقت" : "On-time rate"}</span>
        {scale.map((item) => (
          <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: OC.mid }}><span style={{ width: 18, height: 12, background: item.color, border: `1px solid ${OC.line}` }} />{item.label}</span>
        ))}
      </div>
      <span style={{ fontSize: 12, color: OC.mid, lineHeight: 1.85, borderTop: `1px solid ${OC.soft}`, paddingTop: 12 }}>
        {worstIdx >= 0
          ? (ar ? `أضعف أيام الأسبوع: ${weekdays[worstIdx]} بمعدّل ${Math.round(byWd[worstIdx] * 100)}%. تكرار الضعف في عمود واحد يعني سبباً ثابتاً — وردية أو مواصلات — لا انضباطاً فردياً.` : `Weakest weekday: ${weekdays[worstIdx]} at ${Math.round(byWd[worstIdx] * 100)}%. A weak column is a fixed cause, not one person.`)
          : (ar ? "لا سجل كافٍ بعد لاستخراج نمط أسبوعي." : "Not enough record yet for a weekly pattern.")}
      </span>
    </section>
  );
}

function StripView({ ar, cells, selected, pickDay, filtering, matchCell, legend }) {
  const days = cells.filter((cell) => !cell.blank);
  return (
    <section style={{ background: "var(--nv-card)", border: `1px solid ${OC.line}`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "شريط الشهر" : "Month strip"}</span>
        <span style={{ fontSize: 12, color: OC.muted }}>{ar ? "عمود لكل يوم، بارتفاع نسبته من الفريق. النمط يُقرأ قبل الأرقام." : "One column per day, height by team share. Read the pattern before the numbers."}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, minHeight: 150 }}>
        {days.map((cell) => {
          const rec = cell.rec;
          const on = selected === cell.d;
          const hit = !filtering || matchCell(cell);
          const h = (value) => (rec ? Math.round(value / Math.max(1, rec.head) * 120) : 0);
          return (
            <button
              key={cell.key}
              type="button"
              title={rec ? `${cell.d} — ${rec.on}/${rec.late}/${rec.abs}` : String(cell.d)}
              onClick={() => pickDay(cell.d, !!rec)}
              style={{ fontFamily: "inherit", flex: 1, minWidth: 0, border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", gap: 5, alignItems: "stretch", opacity: hit ? 1 : 0.48 }}
            >
              <div style={{ height: 120, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: cell.weekend ? "var(--nv-line2)" : OC.soft, outline: on ? `2px solid ${OC.green}` : "none", outlineOffset: 1 }}>
                <div style={{ height: h(rec?.abs || 0), background: OC.abs }} />
                <div style={{ height: h(rec?.late || 0), background: OC.gold }} />
                <div style={{ height: h(rec?.on || 0), background: OC.green }} />
                <div style={{ height: h(rec?.leave || 0), background: OC.leave }} />
              </div>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: cell.today ? OC.greenText : (cell.weekend || cell.future ? OC.muted : OC.ink), textAlign: "center" }}>{cell.d}</span>
              <span style={{ height: 3, background: rec?.broke ? OC.gold : "transparent" }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${OC.soft}`, paddingTop: 12 }}>
        {legend.slice(0, 4).map((item) => (
          <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: OC.mid }}>
            <span style={{ width: 10, height: 10, background: item.color, border: `1px solid ${item.border}` }} />
            {item.label}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: OC.mid }}><span style={{ width: 10, height: 3, background: OC.gold }} />{ar ? "انكسرت حلقة" : "Broken ring"}</span>
      </div>
    </section>
  );
}

function DayPanel({
  ar, dayTitle, daySub, statGroups, rosterPack, nameQuery, setNameQuery, quietOpen, setQuietOpen, events, noEvents, rec, modal, onClose, hideRoster, currentUserId,
}) {
  return (
    <>
      {(dayTitle || modal) && (
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${OC.soft}`, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            {dayTitle ? <span style={{ fontSize: 18, fontWeight: 700 }}>{dayTitle}</span> : null}
            {daySub ? <span style={{ fontSize: 12, color: OC.muted }}>{daySub}</span> : null}
          </div>
          {modal ? (
            <button type="button" onClick={onClose} style={{ marginInlineStart: "auto", fontFamily: "inherit", fontSize: 12, border: `1px solid ${OC.line}`, background: "var(--nv-card)", color: OC.ink, cursor: "pointer", padding: "7px 13px" }}>{ar ? "إغلاق" : "Close"}</button>
          ) : null}
        </div>
      )}
      {statGroups.length ? (
        <div style={{ padding: modal ? "14px 20px" : "12px 18px", display: "flex", flexDirection: "column", gap: modal ? 13 : 12, borderBottom: `1px solid ${OC.soft}` }}>
          {statGroups.map((group) => (
            <div key={group.title} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: OC.muted }}>{group.title}</span>
              {modal ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,130px),1fr))", gap: 8 }}>
                  {group.items.map((item) => (
                    <button key={item.label} type="button" onClick={item.select} style={{ fontFamily: "inherit", textAlign: "start", border: `1px solid ${item.border}`, background: item.bg, cursor: item.cursor, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: item.weight, color: OC.mid }}><span style={{ width: 8, height: 8, background: item.color }} />{item.label}</span>
                      <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, color: OC.ink, textAlign: "right" }}>{item.value}</span>
                      {item.sub ? <span style={{ fontSize: 9, color: OC.muted, lineHeight: 1.6 }}>{item.sub}</span> : null}
                    </button>
                  ))}
                </div>
              ) : group.items.map((item) => (
                <button key={item.label} type="button" onClick={item.select} style={{ fontFamily: "inherit", textAlign: "start", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center", border: `1px solid ${item.border}`, background: item.bg, cursor: item.cursor, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: item.weight, color: OC.ink }}><span style={{ width: 9, height: 9, background: item.color }} />{item.label}</span>
                    {item.sub ? <span style={{ fontSize: 9, color: OC.muted, lineHeight: 1.6 }}>{item.sub}</span> : null}
                  </span>
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: OC.ink }}>{item.value}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {!hideRoster && rec ? (
        <>
          <div style={{ borderBottom: `1px solid ${OC.soft}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: modal ? "14px 20px 0" : "11px 18px 8px", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: modal ? 13 : 12, fontWeight: 700 }}>{rosterPack.rosterTitle}</span>
              <span style={{ fontSize: 11, color: OC.muted }}>{rosterPack.rosterHint}</span>
            </div>
            {rosterPack.roster.map((person) => (
              <div key={person.id} style={{ padding: modal ? "0 20px 7px" : "8px 18px", borderTop: modal ? "none" : "1px solid var(--nv-hover)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 9, alignItems: "baseline" }}>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                  {person.name}{currentUserId && String(person.id) === String(currentUserId) ? <>{" "}<FileSelfBadge ar={ar} /></> : null}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: person.color, whiteSpace: "nowrap" }}>{person.note}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: OC.mid, whiteSpace: "nowrap" }}>{person.time}</span>
              </div>
            ))}
            {rosterPack.hasQuiet ? (
              <div style={{ padding: "10px 18px", borderTop: "1px solid var(--nv-hover)", display: "flex", flexDirection: "column", gap: 8, background: OC.wash }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: OC.mid }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: OC.green }} />{rosterPack.quietLine}</span>
                  <button type="button" onClick={() => setQuietOpen((v) => !v)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, border: `1px solid ${OC.line}`, background: "var(--nv-card)", color: OC.ink, cursor: "pointer", padding: "4px 10px" }}>{quietOpen ? (ar ? "إخفاء" : "Hide") : (ar ? "عرض الأسماء" : "Show names")}</button>
                </div>
                {quietOpen ? (
                  <>
                    <input value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} placeholder={ar ? "ابحث بالاسم" : "Search by name"} style={{ fontFamily: "inherit", fontSize: 11, padding: "6px 9px", border: `1px solid ${OC.line}`, outline: "none", background: "var(--nv-card)", color: OC.ink, width: "100%", boxSizing: "border-box" }} />
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {rosterPack.quiet.map((person) => (
                        <span key={person.id} title={person.time} style={{ fontSize: 11, color: OC.ink, background: "var(--nv-card)", border: "1px solid var(--nv-mute-line)", padding: "3px 8px", whiteSpace: "nowrap" }}>{person.name}</span>
                      ))}
                    </span>
                    {rosterPack.noQuietMatch ? <span style={{ fontSize: 11, color: OC.muted }}>{ar ? "لا اسم يطابق البحث." : "No name matches."}</span> : null}
                  </>
                ) : null}
              </div>
            ) : null}
            {rosterPack.rosterEmpty ? <div style={{ padding: "12px 18px" }}><span style={{ fontSize: 11, color: OC.muted, lineHeight: 1.8 }}>{rosterPack.rosterEmptyNote}</span></div> : null}
          </div>
          <div style={{ padding: modal ? "14px 20px" : "13px 18px", display: "flex", flexDirection: "column", gap: 9, borderBottom: `1px solid ${OC.soft}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{ar ? "أحداث اليوم" : "Day events"}</span>
              <span style={{ fontSize: 10, color: OC.muted }}>{ar ? "من يراها مكتوب بجانبها" : "Who can see them is written beside"}</span>
            </div>
            {events.map((group) => (
              <div key={group.title} style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--nv-line2)", padding: "9px 10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: group.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 0 }}>{group.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: group.scopeColor, background: group.scopeBg, border: `1px solid ${group.scopeBorder}`, padding: "2px 7px", whiteSpace: "nowrap" }}>{group.scope}</span>
                </div>
                {group.rows.map((row) => (
                  <div key={`${row.text}-${row.time}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 9, alignItems: "baseline", paddingInlineStart: 17 }}>
                    {row.to
                      ? <Link to={row.to} style={{ fontSize: 11, color: OC.ink, lineHeight: 1.6, minWidth: 0, textDecoration: "none" }}>{row.text}</Link>
                      : <span style={{ fontSize: 11, color: OC.ink, lineHeight: 1.6, minWidth: 0 }}>{row.text}</span>}
                    <span style={{ fontSize: 10, fontWeight: 600, color: row.stColor, whiteSpace: "nowrap", ...(row.stBg ? { background: row.stBg, border: `1px solid ${row.stBorder || row.stColor}`, padding: "0 5px" } : null) }}>{row.state}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: OC.muted, whiteSpace: "nowrap" }}>{row.time}</span>
                  </div>
                ))}
              </div>
            ))}
            {noEvents ? <span style={{ fontSize: 11, color: OC.muted }}>{ar ? "لا مهام ولا إثباتات في هذا اليوم." : "No tasks or proofs on this day."}</span> : null}
          </div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{ar ? "حلقات ذلك اليوم" : "That day's rings"}</span>
            {CHAIN.map(([tag, labelAr, labelEn]) => {
              const bad = rec.broke === tag;
              return (
                <div key={tag} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: OC.muted }}>{tag}</span>
                  <span style={{ fontSize: 12, color: OC.mid, minWidth: 0 }}>{ar ? labelAr : labelEn}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: bad ? OC.abs : OC.greenText }}>{bad ? <NvIcon name="cross" size={12} strokeWidth={2} inline={false} /> : <NvIcon name="check" size={12} strokeWidth={2} inline={false} />}</span>
                </div>
              );
            })}
            <span style={{ fontSize: 11, color: OC.mid, lineHeight: 1.8, borderTop: "1px solid var(--nv-line2)", paddingTop: 9 }}>
              {rec.broke
                ? `${ar ? BROKE[rec.broke]?.ar : BROKE[rec.broke]?.en} — ${ar ? "راجعها في الحضور." : "Review it on Attendance."}`
                : (ar ? "كل الحلقات سليمة. السجل مختوم ودخل كشف الراتب." : "Every ring is intact. The record is sealed into payroll.")}
            </span>
          </div>
        </>
      ) : null}
    </>
  );
}