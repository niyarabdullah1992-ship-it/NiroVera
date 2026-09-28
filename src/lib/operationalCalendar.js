import {
  calendarDateKey,
  dayAttendanceStatus,
  employeeScheduledOn,
  hasPublishedScheduleOn,
} from "./attendanceCalendar.js";
import { liveCalendarProofs } from "./calendarProofs.js";
import {
  visitorProofClockSource,
  visitorProofRowText,
  visitorProofScopeLabel,
  visitorProofsOnly,
} from "./visitorProof.js";
import { hydrateEmployeesLeave } from "./leaveDerivations.js";
import { approvedLeaveOnDay, isStatutoryOffDay, leaveTypeLabel, weekendLeavePeople } from "./leaveTypes.js";
import { citeLeaveType } from "./laborRules.js";
import { LEAVE_CITE_STYLE, LEAVE_STYLE } from "./shiftWeek.js";
import {
  canSeeOpsTask,
  isOpsTaskAssignee,
  isOpsTaskDeleted,
  isoDayKey,
} from "./opsDerivations.js";

export const OC = {
  ink: "var(--nv-ink)",
  muted: "var(--nv-muted)",
  mid: "var(--nv-ink2)",
  line: "var(--nv-line)",
  soft: "var(--nv-line3)",
  wash: "var(--nv-soft)",
  card: "var(--nv-card)",
  green: "var(--nv-ok-fill)",
  greenText: "var(--nv-ok-ink)",
  greenBg: "var(--nv-ok-soft)",
  greenBd: "var(--nv-ok-line)",
  gold: "var(--nv-warn-fill)",
  goldText: "var(--nv-warn-ink)",
  goldBg: "var(--nv-warn-soft)",
  goldBd: "var(--nv-warn-line)",
  abs: "var(--nv-bad-ink)",
  absBg: "var(--nv-bad-soft)",
  absBd: "var(--nv-bad-line)",
  leave: LEAVE_STYLE.fg,
  leaveBg: LEAVE_STYLE.bg,
  leaveBd: LEAVE_STYLE.color,
};

export const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WD_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const WD_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MINI_HEAD = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];
export const CHAIN = [
  ["01", "الموقع GPS", "GPS"],
  ["02", "المرساة NFC/QR", "PLACE"],
  ["03", "الجهاز", "DEVICE"],
  ["04", "الخادم", "SERVER"],
  ["05", "السجل", "RECORD"],
];
export const BROKE = {
  "01": { ar: "انكسرت الحلقة 01 — موقع مشبوه", en: "Ring 01 broke — location suspect" },
  "02": { ar: "انكسرت الحلقة 02 — مرساة لم تستجب", en: "Ring 02 broke — anchor did not answer" },
  "05": { ar: "الحلقة 05 — سجل لم يُغلق", en: "Ring 05 — record not closed" },
};

export function monthsOf(ar) {
  return ar ? MONTHS_AR : MONTHS_EN;
}

export function weekdaysOf(ar) {
  return ar ? WD_AR : WD_EN;
}

export function isoFromParts(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function clockOf(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function pct(part, whole) {
  const total = Number(whole) || 0;
  if (total <= 0) return "0%";
  return `${Math.round((Number(part) || 0) / total * 100)}%`;
}

export function parseMonthDraft(raw, fallbackYear, fallbackMonth, monthNames) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const nums = (text.match(/\d+/g) || []).map(Number);
  const year = nums.find((n) => n >= 1900);
  let month = null;
  const named = monthNames.findIndex((name) => text.includes(name));
  if (named >= 0) month = named;
  else {
    const small = nums.find((n) => n >= 1 && n <= 12);
    if (small !== undefined) month = small - 1;
  }
  if (month === null && year === undefined) return null;
  return {
    month: month === null ? fallbackMonth : month,
    year: year === undefined ? fallbackYear : year,
  };
}

export function jumpDayFromQuery(query, monthNames) {
  const text = String(query || "").trim();
  if (!text) return null;
  const slash = text.match(/^(\d{1,2})\s*[/\-]\s*(\d{1,2})(?:\s*[/\-]\s*(\d{2,4}))?$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    const yearRaw = slash[3];
    const year = yearRaw ? (Number(yearRaw) < 100 ? 2000 + Number(yearRaw) : Number(yearRaw)) : null;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) return { day, month, year };
  }
  const only = text.match(/^(\d{1,2})$/);
  if (only) {
    const day = Number(only[1]);
    if (day >= 1 && day <= 31) return { day, month: null, year: null };
  }
  const named = monthNames.findIndex((name) => text.includes(name));
  if (named >= 0) return { day: null, month: named, year: null };
  return null;
}

function isDone(task) {
  return task?.status === "completed" || task?.status === "approved" || !!task?.approvedAt;
}

function taskDayKey(task) {
  return isoDayKey(task?.dueAt || task?.due_date || task?.end_date || task?.endDate || task?.createdAt);
}

function taskBucket(task, todayKey) {
  if (isDone(task)) return "done";
  const due = isoDayKey(task?.dueAt || task?.due_date || task?.end_date || task?.endDate);
  if (due && due < todayKey) return "over";
  return "prog";
}

export function visibleOpsTasks(tasks, currentUser, isManager) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => (
    !isOpsTaskDeleted(task) && canSeeOpsTask(task, currentUser, { isManager })
  ));
}

export function tasksOnDay(tasks, dateKey, currentUser, todayKey) {
  const mine = [];
  const team = [];
  for (const task of tasks || []) {
    if (taskDayKey(task) !== dateKey) continue;
    const row = {
      task,
      bucket: taskBucket(task, todayKey),
      title: task.title || task.ref || "—",
      time: clockOf(task.dueAt || task.createdAt),
    };
    if (currentUser && isOpsTaskAssignee(task, currentUser)) mine.push(row);
    else team.push(row);
  }
  return { mine, team };
}

function openHazardsOnDay(safety, dateKey) {
  const out = [];
  for (const rec of Array.isArray(safety) ? safety : []) {
    for (const hazard of rec?.hazards || []) {
      if (hazard?.closedAt || hazard?.resolvedAt) continue;
      const day = isoDayKey(hazard.createdAt || hazard.date || hazard.at || rec.createdAt);
      if (day === dateKey) out.push({ ...hazard, stationId: rec.stationId });
    }
  }
  return out;
}

export function chainBreakFor(rows, { gpsRequired, dateKey, todayKey }) {
  const punched = (rows || []).filter((row) => row?.check_in_at || row?.checkInAt);
  if (!punched.length) return null;
  if (gpsRequired) {
    const badGeo = punched.some((row) => {
      const loc = String(row.location_status || row.locationStatus || "").toLowerCase();
      return loc === "outside" || loc === "failed" || loc === "far" || loc === "denied";
    });
    if (badGeo) return "01";
  }
  if (dateKey < todayKey && punched.some((row) => !(row.check_out_at || row.checkOutAt))) return "05";
  return null;
}

function personState(status) {
  if (status === "late") return "late";
  if (status === "absent") return "abs";
  if (status === "on_leave") return "leave";
  if (status === "present") return "on";
  return null;
}

export function deriveDayRecord({
  date,
  employees = [],
  rows = [],
  schedules = [],
  todayKey,
  gpsRequired = false,
  tasks = [],
  currentUser,
  workProofs = [],
  visitorProofs = [],
  data,
  safety = [],
  view = "team",
}) {
  if (!date) return null;
  const dateKey = calendarDateKey(date);
  const weekend = date.getDay() === 5 || date.getDay() === 6;
  const hydrated = hydrateEmployeesLeave(employees, data);
  const roster = view === "me" && currentUser
    ? hydrated.filter((employee) => String(employee.id) === String(currentUser.id))
    : hydrated;
  const weekendHits = weekend ? weekendLeavePeople(roster, dateKey) : null;
  if (weekend && (!weekendHits || !weekendHits.length)) return null;

  const byEmployee = Object.fromEntries(
    (rows || []).map((row) => [String(row.employee_id ?? row.employeeId), row]),
  );
  const people = [];
  if (weekendHits) {
    for (const hit of weekendHits) {
      people.push({
        id: hit.id,
        name: hit.name,
        state: "leave",
        time: "—",
        lateMinutes: 0,
        filed: hit.request || null,
        clash: employeeScheduledOn(schedules, hit.id, dateKey),
      });
    }
  } else {
    for (const employee of roster) {
      const request = approvedLeaveOnDay(employee, dateKey);
      const off = isStatutoryOffDay(employee, dateKey);
      const onLeave = !!off;
      const status = dayAttendanceStatus({
        employee,
        row: byEmployee[String(employee.id)],
        dateKey,
        schedules,
        todayKey,
        onLeave,
      });
      const state = personState(status);
      if (!state) continue;
      const row = byEmployee[String(employee.id)];
      const lateMinutes = Number(row?.late_minutes ?? row?.lateMinutes ?? 0) || 0;
      const clash = state === "leave" && off?.kind !== "official" && employeeScheduledOn(schedules, employee.id, dateKey);
      people.push({
        id: employee.id,
        name: employee.name || employee.id,
        state,
        time: (state === "abs" || state === "leave") ? "—" : clockOf(row?.check_in_at || row?.checkInAt),
        lateMinutes,
        filed: request || null,
        clash,
      });
    }
  }

  const published = hasPublishedScheduleOn(schedules, dateKey);
  const rosterPeople = (!published && !rows.length)
    ? people.filter((person) => person.state === "leave")
    : people;

  const on = rosterPeople.filter((p) => p.state === "on").length;
  const late = rosterPeople.filter((p) => p.state === "late").length;
  const abs = rosterPeople.filter((p) => p.state === "abs").length;
  const leave = rosterPeople.filter((p) => p.state === "leave").length;
  // People who already have an attendance/leave state — not published-shift headcount.
  const head = rosterPeople.length;

  const { mine, team } = tasksOnDay(tasks, dateKey, currentUser, todayKey);
  const proofs = liveCalendarProofs({ workProofs, visitorProofs, user: currentUser, data, dateKey });
  const proofWork = proofs.filter((item) => item.kind !== "visitor").length;
  const proofVisit = proofs.filter((item) => item.kind === "visitor").length;
  const hazards = openHazardsOnDay(safety, dateKey);
  const allTasks = mine.concat(team);
  const broke = chainBreakFor(rows, { gpsRequired, dateKey, todayKey });
  const hasSignal = head || mine.length || team.length || proofs.length || hazards.length;
  if (!hasSignal && dateKey !== todayKey) return null;

  return {
    dateKey,
    head,
    on,
    late,
    abs,
    leave,
    people: rosterPeople,
    broke,
    tasksMine: mine.length,
    tasksTeam: team.length,
    mineTasks: mine,
    teamTasks: team,
    tDone: allTasks.filter((item) => item.bucket === "done").length,
    tProg: allTasks.filter((item) => item.bucket === "prog").length,
    tOver: allTasks.filter((item) => item.bucket === "over").length,
    proofWork,
    proofVisit,
    proofs,
    hse: hazards.length,
    hazards,
    leaveClash: rosterPeople.filter((person) => person.clash).length,
    filed: rosterPeople.filter((person) => person.filed).length,
  };
}

export function countAr(n, one, two, few, many) {
  const value = Number(n) || 0;
  if (value === 1) return one;
  if (value === 2) return two;
  if (value <= 10) return `${value} ${few}`;
  return `${value} ${many}`;
}

/** `head` is who already has a day state — not who has a published shift. */
export function dayHeadPhrase(head, ar = true) {
  const n = Number(head) || 0;
  return ar ? `${n} من ظهرت لهم حالة` : `${n} with a recorded status`;
}

/** Approved طلباتي leave overlapping this month — no invented rows. */
export function filedLeaveInMonth(employees = [], year, month, ar = true, data) {
  const roster = hydrateEmployeesLeave(employees, data);
  const len = new Date(year, month + 1, 0).getDate();
  const reqs = new Map();
  const days = new Set();
  for (let day = 1; day <= len; day += 1) {
    const dateKey = isoFromParts(year, month, day);
    for (const employee of roster) {
      const request = approvedLeaveOnDay(employee, dateKey);
      if (!request) continue;
      days.add(dateKey);
      const id = `${employee.id}|${request.id || request.startDate || ""}|${request.type || ""}`;
      if (reqs.has(id)) continue;
      reqs.set(id, {
        name: employee.name || employee.id,
        type: leaveTypeLabel(request.type, ar, undefined, dateKey),
        art: citeLeaveType(request.type, dateKey)?.article || "",
      });
    }
  }
  const list = [...reqs.values()];
  return { list, dayCount: days.size, types: [...new Set(list.map((row) => row.type))] };
}

export function filedLeaveBanner(pack, monthName, ar = true) {
  if (!pack?.list?.length) return "";
  const types = pack.types.join(ar ? "، " : ", ");
  if (!ar) {
    return `${pack.list.length} approved leave request${pack.list.length === 1 ? "" : "s"} from My Requests in ${monthName} (${types}) · ${pack.dayCount} day${pack.dayCount === 1 ? "" : "s"} this month — marked on the grid and outside attendance.`;
  }
  return `${countAr(pack.list.length, "إجازة واحدة معتمدة", "إجازتان معتمدتان", "إجازات معتمدة", "إجازة معتمدة")} من «طلباتي» في ${monthName} (${types}) · ${countAr(pack.dayCount, "يوم واحد في هذا الشهر", "يومان في هذا الشهر", "أيام في هذا الشهر", "يوماً في هذا الشهر")} — مُعلَّمة في الشبكة وخارج حساب الحضور.`;
}

export function eventGroups(rec, ar, currentUser) {
  if (!rec) return [];
  const st = {
    done: [ar ? "منجزة" : "Done", OC.greenText],
    prog: [ar ? "قيد التنفيذ" : "In progress", OC.goldText],
    over: [ar ? "متأخرة" : "Overdue", OC.abs],
  };
  const out = [];
  const taskRow = (item) => ({
    text: item.title,
    state: st[item.bucket][0],
    stColor: st[item.bucket][1],
    time: item.time,
  });
  if (rec.mineTasks?.length) {
    out.push({
      title: ar ? "مهام تخصّك" : "Your tasks",
      color: OC.ink,
      scope: ar ? "أنت ومديرك" : "You and your manager",
      scopeColor: OC.mid,
      scopeBg: "#f5f6f8",
      scopeBorder: OC.line,
      rows: rec.mineTasks.map(taskRow),
    });
  }
  if (rec.teamTasks?.length) {
    out.push({
      title: ar ? "مهام الفريق" : "Team tasks",
      color: OC.muted,
      scope: ar ? "الفريق" : "Team",
      scopeColor: OC.mid,
      scopeBg: "#f5f6f8",
      scopeBorder: OC.line,
      rows: rec.teamTasks.map((item) => ({
        ...taskRow(item),
        text: `${item.title}${currentUser ? "" : ""}`,
      })),
    });
  }
  if (rec.hse) {
    out.push({
      title: ar ? "بلاغ سلامة" : "Safety report",
      color: OC.abs,
      scope: ar ? "كل الموظفين" : "All staff",
      scopeColor: OC.abs,
      scopeBg: OC.absBg,
      scopeBorder: OC.absBd,
      rows: rec.hazards.map((hazard) => ({
        text: hazard.title || hazard.text || hazard.name || (ar ? "بلاغ مفتوح" : "Open report"),
        state: ar ? "مفتوح" : "Open",
        stColor: OC.abs,
        time: clockOf(hazard.createdAt || hazard.at),
      })),
    });
  }
  if (rec.proofWork) {
    out.push({
      title: ar ? "إثبات عمل" : "Work proof",
      color: OC.green,
      scope: ar ? "كل الموظفين" : "All staff",
      scopeColor: OC.greenText,
      scopeBg: OC.greenBg,
      scopeBorder: OC.greenBd,
      rows: rec.proofs.filter((item) => item.kind !== "visitor").map((item) => ({
        text: item.title || item.ref || (ar ? "إثبات" : "Proof"),
        state: ar ? "موثّق" : "Recorded",
        stColor: OC.greenText,
        time: clockOf(item.startedAt || item.createdAt),
      })),
    });
  }
  const clashPeople = (rec.people || []).filter((person) => person.clash);
  if (clashPeople.length) {
    out.push({
      title: ar ? "إجازة على وردية منشورة" : "Leave on a published shift",
      color: OC.goldText,
      scope: ar ? "يحتاج بديلاً" : "Needs a substitute",
      scopeColor: OC.goldText,
      scopeBg: OC.goldBg,
      scopeBorder: OC.goldBd,
      rows: clashPeople.map((person) => ({
        text: ar
          ? `${person.name} — إجازة معتمدة على يوم له وردية منشورة. الجدول يقول «مجدول» والملف يقول «إجازة».`
          : `${person.name} — approved leave on a published shift day.`,
        state: ar ? "أسند بديلاً" : "Assign a substitute",
        stColor: OC.goldText,
        time: "—",
      })),
    });
  }
  const filedPeople = (rec.people || []).filter((person) => person.filed);
  if (filedPeople.length) {
    out.push({
      title: ar ? "إجازة من طلباتي" : "Leave from My Requests",
      color: OC.leave,
      scope: ar ? "اعتُمدت في طلباتي" : "Approved in My Requests",
      scopeColor: OC.leave,
      scopeBg: OC.leaveBg,
      scopeBorder: OC.leaveBd,
      rows: filedPeople.map((person) => {
        const type = leaveTypeLabel(person.filed.type, ar, undefined, rec.dateKey);
        const art = citeLeaveType(person.filed.type, rec.dateKey)?.article;
        return {
          text: `${person.name} — ${type}`,
          state: art ? (ar ? `المادة ${art}` : `Art. ${art}`) : (ar ? "معتمدة" : "Approved"),
          stColor: LEAVE_CITE_STYLE.fg,
          stBg: LEAVE_CITE_STYLE.bg,
          stBorder: LEAVE_CITE_STYLE.color,
          time: "—",
        };
      }),
    });
  }
  const otherLeave = (rec.people || []).filter((person) => person.state === "leave" && !person.filed);
  if (otherLeave.length) {
    out.push({
      title: ar ? "إجازة معتمدة" : "Approved leave",
      color: OC.leave,
      scope: ar ? "من ملف الموظف" : "From the employee file",
      scopeColor: OC.leave,
      scopeBg: OC.leaveBg,
      scopeBorder: OC.leaveBd,
      rows: otherLeave.map((person) => ({
        text: person.name,
        state: ar ? "لا تُحسب غياباً" : "Not counted absent",
        stColor: OC.leave,
        time: "—",
      })),
    });
  }
  if (rec.proofVisit) {
    const visits = visitorProofsOnly(rec.proofs);
    out.push({
      title: ar ? "إثبات زائر" : "Visitor proof",
      color: OC.gold,
      scope: visitorProofScopeLabel(ar),
      scopeColor: OC.goldText,
      scopeBg: OC.goldBg,
      scopeBorder: OC.goldBd,
      rows: visits.map((item) => ({
        text: visitorProofRowText(item, ar),
        state: ar ? "دخول وخروج" : "In / out",
        stColor: OC.goldText,
        time: clockOf(visitorProofClockSource(item)),
      })),
    });
  }
  return out;
}

export function rosterFor(rec, { view, filter, nameQuery, ar }) {
  if (!rec) {
    return {
      roster: [],
      quiet: [],
      hasQuiet: false,
      rosterEmpty: false,
      rosterTitle: "",
      rosterHint: "",
      rosterEmptyNote: "",
    };
  }
  const noteOf = (person) => {
    if (person.state === "leave") {
      if (person.clash) return ar ? "إجازة على وردية منشورة — يحتاج بديلاً" : "Leave on a published shift — needs a substitute";
      return ar ? "إجازة معتمدة — خارج حساب الحضور" : "Approved leave — outside attendance";
    }
    if (person.state === "abs") return ar ? "بلا تسجيل ولا إجازة" : "No punch and no leave";
    if (person.state === "late") return ar ? `تأخّر ${person.lateMinutes || 0} دقيقة` : `${person.lateMinutes || 0} min late`;
    return ar ? "السلسلة سليمة" : "Chain intact";
  };
  const colorOf = (state) => (
    state === "late" ? OC.goldText : state === "abs" ? OC.abs : state === "leave" ? OC.leave : OC.greenText
  );
  const list = (rec.people || []).map((person) => ({
    ...person,
    color: colorOf(person.state),
    note: noteOf(person),
  })).filter((person) => filter === "all" || person.state === filter);

  const solo = view !== "team";
  const showAll = filter !== "all";
  const rows = (solo ? list : (showAll ? list : list.filter((p) => p.state !== "on")))
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), ar ? "ar" : "en"));
  const quiet = (!solo && !showAll) ? list.filter((p) => p.state === "on") : [];
  const q = String(nameQuery || "").trim();
  const quietShown = quiet
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), ar ? "ar" : "en"))
    .filter((p) => !q || String(p.name).includes(q));
  const titles = {
    all: ar ? "يحتاج نظرة" : "Needs a look",
    on: ar ? "الحاضرون في الوقت" : "On time",
    late: ar ? "المتأخرون" : "Late",
    abs: ar ? "الغائبون" : "Absent",
  };
  return {
    roster: rows,
    quiet: quietShown,
    hasQuiet: quiet.length > 0,
    noQuietMatch: quiet.length > 0 && !!q && !quiet.some((p) => String(p.name).includes(q)),
    rosterEmpty: rows.length === 0 && quiet.length === 0,
    rosterTitle: solo
      ? (ar ? "سجلّك" : "Your record")
      : `${titles[filter] || titles.all} · ${rows.length}`,
    rosterHint: (!solo && !showAll)
      ? (ar ? "الاستثناءات أولاً — الباقي مطوي" : "Exceptions first — the rest is folded")
      : (solo ? "" : (ar ? "اضغط «الكل» للعودة" : "Press All to reset")),
    rosterEmptyNote: solo
      ? (ar ? "لم تكن في هذه الحالة في هذا اليوم." : "You were not in this state on this day.")
      : (filter === "all"
        ? (ar ? "لا أحد خارج المألوف — الجميع حضروا في الوقت." : "Nobody unusual — everyone was on time.")
        : (ar ? "لا أحد في هذه الحالة." : "Nobody in this state.")),
    quietLine: ar ? `${quiet.length} حضروا في الوقت بلا ملاحظة` : `${quiet.length} on time with no note`,
  };
}

export function shadeRate(rate) {
  if (rate == null) return { bg: "var(--nv-soft)", fg: "var(--nv-muted)" };
  if (rate >= 0.98) return { bg: "#137a49", fg: "#fff" };
  if (rate >= 0.92) return { bg: "#5cb98a", fg: "#0d2e1e" };
  if (rate >= 0.85) return { bg: "#a8dcc2", fg: "#0d2e1e" };
  if (rate >= 0.75) return { bg: "#f0d79a", fg: "#4a3708" };
  return { bg: "#e2a3a3", fg: "#4a1015" };
}

export function empStats(days, directory = []) {
  const acc = {};
  const nameOf = (id, fallback) => {
    const hit = (directory || []).find((row) => String(row.id) === String(id));
    return hit?.name || fallback || id;
  };
  const touch = (id, name) => acc[id] || (acc[id] = {
    id, name: nameOf(id, name), on: 0, late: 0, abs: 0, leave: 0, done: 0, prog: 0, over: 0, hse: 0, days: 0,
  });
  for (const employee of directory || []) {
    if (employee?.id == null) continue;
    touch(employee.id, employee.name);
  }
  for (const { rec } of days || []) {
    if (!rec) continue;
    for (const person of rec.people || []) {
      const row = touch(person.id, person.name);
      row.days += 1;
      row[person.state] += 1;
    }
    for (const item of (rec.mineTasks || []).concat(rec.teamTasks || [])) {
      const ids = item.task ? [item.task.ownerId || item.task.employee_id || item.task.assignedTo].filter(Boolean) : [];
      for (const id of ids) {
        const row = acc[id] || touch(id, nameOf(id));
        row[item.bucket] += 1;
      }
    }
    if (rec.hse) {
      const first = rec.people?.[0];
      if (first) touch(first.id, first.name).hse += rec.hse;
    }
  }
  return Object.values(acc);
}

export const CMP_KEYS = ["on", "late", "abs", "leave", "done", "prog", "over", "hse"];

export function toggleCmpKeys(current, key) {
  const list = (Array.isArray(current) ? current : [current]).filter((item) => CMP_KEYS.includes(item));
  if (!CMP_KEYS.includes(key)) return list.length ? list : ["late"];
  if (list.includes(key)) return list.length === 1 ? list : list.filter((item) => item !== key);
  return CMP_KEYS.filter((item) => item === key || list.includes(item));
}

export function cmpScore(row, keys) {
  return (Array.isArray(keys) && keys.length ? keys : ["late"]).reduce((sum, key) => sum + (Number(row?.[key]) || 0), 0);
}

export function emptyRec() {
  return { head: 0, on: 0, late: 0, abs: 0, leave: 0, tDone: 0, tProg: 0, tOver: 0, hse: 0 };
}

export function sumRecs(days) {
  return (days || []).reduce((acc, { rec }) => {
    if (!rec) return acc;
    return {
      head: acc.head + rec.head,
      on: acc.on + rec.on,
      late: acc.late + rec.late,
      abs: acc.abs + rec.abs,
      leave: acc.leave + rec.leave,
      tDone: acc.tDone + rec.tDone,
      tProg: acc.tProg + rec.tProg,
      tOver: acc.tOver + rec.tOver,
      hse: acc.hse + rec.hse,
      days: acc.days + 1,
    };
  }, { ...emptyRec(), days: 0 });
}
