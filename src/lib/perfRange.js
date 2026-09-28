/** Performance as a judgment of approved proof between two dates. */

import { formatDayMonthYear, formatMonthYear } from "./dateFormat.js";
import { employeeScheduledOn, hasPublishedScheduleOn } from "./attendanceCalendar.js";
import { countPersonalHseDuty, deriveFairHseRates, PERF_WEIGHTS } from "./perfDerivations.js";
import { taskBelongsTo, taskIsProven } from "./hcmDerivations.js";

export const MIN_PROOF = 5;

export const PERF_DRIVERS = [
  { id: "done", w: Math.round(PERF_WEIGHTS.pts * 100), color: "var(--nv-ink)", nameAr: "الإنجاز", nameEn: "Done", srcAr: "المهام المثبتة المعتمدة من إثبات العمل، نسبةً إلى المسنَدة", srcEn: "Approved proven tasks from work proof, as a share of those assigned" },
  { id: "time", w: Math.round(PERF_WEIGHTS.ontime * 100), color: "var(--nv-ok-fill)", nameAr: "الموعد", nameEn: "On time", srcAr: "ما أُغلق قبل موعده أو فيه، والتأخير بعذر مسجّل لا يُخصم", srcEn: "Closed on or before the due date; excused delay is not deducted" },
  { id: "safe", w: Math.round(PERF_WEIGHTS.hse * 100), color: "var(--nv-warn-fill)", nameAr: "السلامة", nameEn: "Safety", srcAr: "بلاغات السلامة المغلقة مقابل المخالفات المسجّلة", srcEn: "Closed safety reports versus recorded breaches" },
  { id: "cover", w: Math.round(PERF_WEIGHTS.cover * 100), color: "var(--nv-ink3)", nameAr: "التغطية", nameEn: "Coverage", srcAr: "الحضور المطابق للجدول المنشور، والإجازة المعتمدة لا تخفضها", srcEn: "Attendance matching the published roster; approved leave does not lower it" },
];

export const TEAM_IDS = ["supervision", "field", "customers"];

export function isoDay(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthsInRange(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export function rangePresets(today = isoDay()) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const quarter = Math.floor((month - 1) / 3);
  const qStartMonth = quarter * 3 + 1;
  const prevQ = quarter === 0 ? 3 : quarter - 1;
  const prevYear = quarter === 0 ? year - 1 : year;
  const prevStart = prevQ * 3 + 1;
  const prevEndMonth = prevStart + 2;
  const prevEndDay = new Date(prevYear, prevEndMonth, 0).getDate();
  const half = new Date(`${today}T12:00:00`);
  half.setMonth(half.getMonth() - 5);
  half.setDate(1);
  return [
    { id: "q", from: `${year}-${String(qStartMonth).padStart(2, "0")}-01`, to: today, labelAr: "الربع الحالي", labelEn: "This quarter" },
    { id: "pq", from: `${prevYear}-${String(prevStart).padStart(2, "0")}-01`, to: `${prevYear}-${String(prevEndMonth).padStart(2, "0")}-${String(prevEndDay).padStart(2, "0")}`, labelAr: "الربع الماضي", labelEn: "Last quarter" },
    { id: "m", from: `${year}-${String(month).padStart(2, "0")}-01`, to: today, labelAr: "هذا الشهر", labelEn: "This month" },
    { id: "h", from: isoDay(half), to: today, labelAr: "نصف سنة", labelEn: "Half year" },
  ];
}

export function countAr(n, one, two, few, many, zero) {
  if (n === 0) return zero || "لا شيء";
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function bandOf(score, ar = true) {
  if (score >= 85) return ar ? "جيد جداً" : "Very good";
  if (score >= 70) return ar ? "جيد" : "Good";
  if (score >= 55) return ar ? "مقبول" : "Fair";
  return ar ? "يحتاج متابعة" : "Needs follow-up";
}

export function accentOf(score) {
  if (score >= 70) return "#1d9a5b";
  if (score >= 55) return "#8a6516";
  return "#8a1c2b";
}

export function textOf(score) {
  if (score >= 70) return "#137a49";
  if (score >= 55) return "#8a6516";
  return "#8a1c2b";
}

export function scoreOf(agg) {
  if (!agg) return 0;
  return Math.round(PERF_DRIVERS.reduce((sum, driver) => sum + ((Number(agg[driver.id]) || 0) / 100) * driver.w, 0));
}

export function segsOf(agg) {
  return PERF_DRIVERS.map((driver) => {
    const part = Math.round(((Number(agg[driver.id]) || 0) / 100) * driver.w);
    return {
      id: driver.id,
      w: `${part}%`,
      color: driver.color,
      tip: `${driver.nameAr} ${agg[driver.id]}% × ${driver.w} = ${part}`,
    };
  });
}

export function jobOf(employee) {
  return String(
    employee?.jobTitle
    || employee?.job
    || employee?.position
    || employee?.profile?.jobTitle
    || employee?.profile?.title
    || "",
  ).trim();
}

export function teamOf(employee) {
  const blob = `${jobOf(employee)} ${employee?.role || ""} ${employee?.department || ""}`;
  if (/مشرف|مدير|director|manager|pgm|admin|owner|hr_/i.test(blob)) return "supervision";
  if (/عميل|عملاء|customer|client|sales|خدمة/i.test(blob)) return "customers";
  return "field";
}

export function teamLabel(id, ar = true) {
  if (id === "supervision") return ar ? "الإشراف" : "Supervision";
  if (id === "customers") return ar ? "العملاء" : "Customers";
  return ar ? "الميدان" : "Field";
}

function dayInRange(day, from, to) {
  return !!day && day >= from && day <= to;
}

function taskDay(task) {
  return isoDay(task?.approvedAt || task?.completedAt || task?.dueAt || task?.createdAt);
}

function proofDay(proof) {
  return isoDay(proof?.approvedAt || proof?.endedAt || proof?.sealedAt || proof?.createdAt);
}

function punchDay(row) {
  return isoDay(row?.date || row?.day || row?.check_in_at || row?.checkInAt || row?.createdAt);
}

function leaveCovers(request, day) {
  const status = String(request?.status || "").toLowerCase();
  if (status && status !== "approved" && status !== "accepted") return false;
  const from = isoDay(request.startDate || request.from || request.start);
  const to = isoDay(request.endDate || request.to || request.end || from);
  return from && to && day >= from && day <= to;
}

function punchedOn(employee, day, data) {
  const rows = [
    ...(Array.isArray(data?.attendance) ? data.attendance : []),
    ...(Array.isArray(data?.attendanceRows) ? data.attendanceRows : []),
    ...(Array.isArray(employee?.attendance) ? employee.attendance : []),
  ];
  const id = String(employee?.id || "");
  return rows.some((row) => {
    const who = String(row.employee_id || row.employeeId || row.id || "");
    if (who && who !== id) return false;
    if (punchDay(row) !== day) return false;
    return Boolean(row.check_in_at || row.checkInAt || row.status === "present" || row.status === "late");
  });
}

function onLeaveOn(employee, day) {
  const leaves = [
    ...(Array.isArray(employee?.leaveRequests) ? employee.leaveRequests : []),
    ...(Array.isArray(employee?.leaves) ? employee.leaves : []),
  ];
  return leaves.some((row) => leaveCovers(row, day));
}

function daysOfMonth(monthKey, from, to) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const last = new Date(year, month, 0).getDate();
  const out = [];
  for (let day = 1; day <= last; day += 1) {
    const key = `${monthKey}-${String(day).padStart(2, "0")}`;
    if (dayInRange(key, from, to)) out.push(key);
  }
  return out;
}

function attendanceRowsOf(data) {
  return [
    ...(Array.isArray(data?.attendance) ? data.attendance : []),
    ...(Array.isArray(data?.attendanceRows) ? data.attendanceRows : []),
    ...(Array.isArray(data?.employees) ? data.employees.flatMap((person) => Array.isArray(person.attendance) ? person.attendance : []) : []),
  ];
}

function punchesInRange(data, from, to) {
  return attendanceRowsOf(data).some((row) => {
    const day = punchDay(row);
    if (!day || day < from || day > to) return false;
    return Boolean(row.check_in_at || row.checkInAt || row.status === "present" || row.status === "late");
  });
}

export function coverPctFor(employee, from, to, data) {
  const months = monthsInRange(from, to);
  let scheduled = 0;
  let covered = 0;
  for (const month of months) {
    for (const day of daysOfMonth(month, from, to)) {
      if (!hasPublishedScheduleOn(data?.schedules, day)) continue;
      if (!employeeScheduledOn(data?.schedules, employee.id, day)) continue;
      scheduled += 1;
      if (punchedOn(employee, day, data) || onLeaveOn(employee, day)) covered += 1;
    }
  }
  const pts = Number(employee?.coverPoints) || 0;
  const max = Math.max(1, ...(data?.employees || []).map((row) => Number(row.coverPoints) || 0), 1);
  const fromPoints = pts > 0 ? Math.min(100, Math.round((pts / max) * 100)) : 100;
  if (scheduled > 0 && punchesInRange(data, from, to)) return Math.round((covered / scheduled) * 100);
  return fromPoints;
}

function safePctFor(employee, data) {
  const duty = countPersonalHseDuty(data?.safety || data?.safetyRecords || [], employee.id, employee.name);
  return deriveFairHseRates({
    hazardClosed: duty.assignedClosed,
    hazardTotal: duty.assignedTotal,
    assignedOpen: duty.assignedOpen,
    personalNotes: duty.personalNotes,
  }).hsePct;
}

function workProofsOf(employee, data) {
  return (data?.workProofs || []).filter((proof) => {
    const who = String(proof.raiserId || proof.employeeId || proof.ownerId || "");
    return who === String(employee.id);
  });
}

export function personFacts(employee, from, to, data) {
  const tasks = (data?.tasks || []).filter((task) => taskBelongsTo(task, employee.id, employee.stationId));
  const inRange = tasks.filter((task) => dayInRange(taskDay(task), from, to));
  const proven = inRange.filter(taskIsProven);
  const proofs = workProofsOf(employee, data).filter((proof) => {
    const sealed = proof.status === "sealed" || proof.sealId || proof.approvedAt;
    return sealed && dayInRange(proofDay(proof), from, to);
  });
  const assigned = inRange.length;
  const proof = proven.length + proofs.length;
  const done = assigned > 0 ? Math.round((proven.length / assigned) * 100) : (proof ? 100 : 0);
  const ontime = proven.length
    ? Math.round((proven.filter((task) => {
      if (!task.dueAt || !task.approvedAt) return true;
      return String(task.approvedAt).slice(0, 10) <= String(task.dueAt).slice(0, 10);
    }).length / proven.length) * 100)
    : (proof ? 100 : 0);
  return {
    done,
    time: ontime,
    safe: safePctFor(employee, data),
    cover: coverPctFor(employee, from, to, data),
    proof,
    assigned,
    proven: proven.length,
  };
}

export function personMonthMap(employee, from, to, data) {
  const map = {};
  for (const month of monthsInRange(from, to)) {
    const start = month > from.slice(0, 7) ? `${month}-01` : from;
    const endDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const end = month < to.slice(0, 7) ? `${month}-${String(endDay).padStart(2, "0")}` : to;
    const facts = personFacts(employee, start, end, data);
    if (!facts.assigned && !facts.proof && facts.safe === 100 && facts.cover === 100) continue;
    map[month] = facts;
  }
  return map;
}

/** Approved tasks and sealed proofs that fed a person's score. Empty fields stay blank for the UI to show —. */
export function personProofEntries(employee, from, to, data) {
  if (!employee?.id || !from || !to || from > to) return [];
  const tasks = (data?.tasks || []).filter((task) => (
    taskBelongsTo(task, employee.id, employee.stationId)
    && dayInRange(taskDay(task), from, to)
    && taskIsProven(task)
  ));
  const proofs = workProofsOf(employee, data).filter((proof) => {
    const sealed = proof.status === "sealed" || proof.sealId || proof.approvedAt;
    return sealed && dayInRange(proofDay(proof), from, to);
  });
  return [
    ...tasks.map((task) => ({
      id: `task_${task.id || taskDay(task)}`,
      at: taskDay(task),
      title: String(task.title || task.name || "").trim(),
      href: "/app/tasks",
    })),
    ...proofs.map((proof) => ({
      id: `proof_${proof.id || proofDay(proof)}`,
      at: proofDay(proof),
      title: String(proof.title || proof.summary || "").trim(),
      href: "/app/work-proof",
    })),
  ].filter((row) => row.at).sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function meanKeys(rows, key) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + (Number(row.a[key]) || 0), 0) / rows.length);
}

export function derivePerformanceRange({
  employees = [],
  stations = [],
  data = {},
  from,
  to,
  selB = [],
  selT = [],
  selP = [],
  ar = true,
} = {}) {
  const valid = Boolean(from && to && from <= to);
  const months = valid ? monthsInRange(from, to) : [];
  const people = (employees || []).map((employee) => ({
    ...employee,
    job: jobOf(employee) || (ar
      ? (employee.role === "director" ? "مدير تشغيل" : employee.role === "station_manager" ? "مشرف تشغيل" : employee.role === "safety_officer" ? "ضابط سلامة" : "فنّي ميداني")
      : (employee.role === "director" ? "Operations director" : employee.role === "station_manager" ? "Station supervisor" : employee.role === "safety_officer" ? "Safety officer" : "Field technician")),
    team: teamOf(employee),
    branch: stations.find((station) => station.id === employee.stationId)?.name || employee.stationName || (ar ? "بدون فرع" : "No branch"),
    branchId: employee.stationId || "",
  }));
  const anyPick = selB.length || selT.length || selP.length;
  const inPick = (person) => !anyPick
    || selP.includes(person.id)
    || selB.includes(person.branchId)
    || selT.includes(person.team);
  const pool = people.filter(inPick);
  const rowsAll = pool.map((person) => {
    const a = personFacts(person, from, to, data);
    return { ...person, a, score: scoreOf(a), ok: a.proof >= MIN_PROOF, months: personMonthMap(person, from, to, data) };
  }).filter((row) => row.a.assigned > 0 || row.a.proof > 0 || months.length);
  const ranked = rowsAll.slice().sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "ar"));
  const eligible = ranked.filter((row) => row.ok);
  const avg = eligible.length ? Math.round(eligible.reduce((sum, row) => sum + row.score, 0) / eligible.length) : 0;
  const branches = stations.length
    ? stations.map((station) => ({ id: station.id, name: station.name || station.id }))
    : [...new Map(people.map((person) => [person.branchId || person.branch, { id: person.branchId || person.branch, name: person.branch }])).values()];
  const shownBranches = selB.length
    ? branches.filter((branch) => selB.includes(branch.id))
    : (anyPick ? branches.filter((branch) => pool.some((person) => person.branchId === branch.id)) : branches);

  const branchData = shownBranches.map((branch) => {
    const ps = people.filter((person) => person.branchId === branch.id).map((person) => {
      const a = personFacts(person, from, to, data);
      return { ...person, a, score: scoreOf(a), ok: a.proof >= MIN_PROOF };
    });
    const el = ps.filter((row) => row.ok);
    const a = { done: meanKeys(el, "done"), time: meanKeys(el, "time"), safe: meanKeys(el, "safe"), cover: meanKeys(el, "cover") };
    return { ...branch, ps, el, a, score: el.length ? scoreOf(a) : 0 };
  }).sort((left, right) => right.score - left.score);

  const top = eligible[0] || null;
  const low = eligible[eligible.length - 1] || null;
  const first = months[0];
  const last = months[months.length - 1];
  const monthScore = (person, key) => {
    const facts = person.months?.[key];
    return facts ? scoreOf(facts) : null;
  };
  const climbers = rowsAll.map((person) => {
    if (!first || !last || first === last) return { p: person, d: null };
    const start = monthScore(person, first);
    const end = monthScore(person, last);
    if (start == null || end == null) return { p: person, d: null };
    return { p: person, d: end - start };
  }).filter((row) => row.d != null).sort((left, right) => right.d - left.d);

  const fmt = (day) => formatDayMonthYear(`${day}T12:00:00`, ar ? "ar" : "en");
  const monthName = (key) => formatMonthYear(`${key}-01T12:00:00`, ar ? "ar" : "en");

  const groups = [
    ...selB.map((id) => {
      const branch = branches.find((row) => row.id === id);
      const ps = people.filter((person) => person.branchId === id);
      return packGroup(ar ? "فرع" : "Branch", branch?.name || id, ps, from, to, data);
    }),
    ...selT.map((id) => packGroup(ar ? "فريق" : "Team", teamLabel(id, ar), people.filter((person) => person.team === id), from, to, data)),
    ...(selP.length >= 2 ? [packGroup(ar ? "مجموعة" : "Set", countAr(selP.length, "", ar ? "موظفان مختاران" : "two people", ar ? "موظفين مختارين" : "people", ar ? "موظفاً مختاراً" : "people"), people.filter((person) => selP.includes(person.id)), from, to, data)] : []),
  ].sort((left, right) => right.score - left.score);

  return {
    valid,
    from,
    to,
    months,
    people,
    pool,
    rowsAll,
    ranked,
    eligible,
    avg,
    top,
    low,
    climbers,
    branches,
    shownBranches,
    branchData,
    anyPick,
    groups,
    hasGroups: groups.length >= 2,
    minProof: MIN_PROOF,
    fmtFrom: fmt(from),
    fmtTo: fmt(to),
    monthName,
    rangeNote: !valid
      ? (ar ? "تاريخ البداية بعد النهاية — صحّح المدى ليُحسب شيء." : "The start is after the end — correct the range so a score can be derived.")
      : (months.length
        ? `${fmt(from)} → ${fmt(to)} · ${ar ? countAr(months.length, "شهر واحد", "شهران", "أشهر", "شهراً") : `${months.length} mo`} · ${ar ? countAr(rowsAll.length, "موظف واحد", "موظفان", "موظفين", "موظفاً", "لا بيانات") : `${rowsAll.length} people`} ${ar ? "في المدى" : "in range"}`
        : (ar ? "لا بيانات في هذا المدى." : "No data in this range.")),
  };
}

function packGroup(kind, name, people, from, to, data) {
  const rows = people.map((person) => {
    const a = personFacts(person, from, to, data);
    return { ...person, a, score: scoreOf(a), ok: a.proof >= MIN_PROOF };
  });
  const el = rows.filter((row) => row.ok);
  const a = { done: meanKeys(el, "done"), time: meanKeys(el, "time"), safe: meanKeys(el, "safe"), cover: meanKeys(el, "cover") };
  return { kind, name, rows, el, a, score: el.length ? scoreOf(a) : 0 };
}

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildPerformanceReportHtml(view, { companyName = "NiroVera", ar = true } = {}) {
  const drivers = PERF_DRIVERS;
  const drvHead = drivers.map((driver) => `<th>${esc(ar ? driver.nameAr : driver.nameEn)} (${driver.w})</th>`).join("");
  const peopleRows = (view.ranked || []).map((row, index) => `<tr${row.ok ? "" : " class=\"off\""}><td class="n">${index + 1}</td><td><b>${esc(row.name)}</b><br><s>${esc(`${row.job} · ${row.branch}`)}</s></td>${drivers.map((driver) => `<td class="n">${row.a[driver.id]}%</td>`).join("")}<td class="n"><b>${row.score}</b></td><td>${esc(bandOf(row.score, ar))}</td><td>${row.ok ? (ar ? "مكتمل" : "Enough proof") : (ar ? `إثبات ${row.a.proof} من ${MIN_PROOF}` : `Proof ${row.a.proof} of ${MIN_PROOF}`)}</td></tr>`).join("");
  const branchRows = (view.branchData || []).map((branch) => `<tr><td><b>${esc(branch.name)}</b><br><s>${ar ? `${branch.ps.length} موظف · ${branch.el.length} بإثبات كافٍ` : `${branch.ps.length} people · ${branch.el.length} with enough proof`}</s></td>${drivers.map((driver) => `<td class="n">${branch.el.length ? `${branch.a[driver.id]}%` : "—"}</td>`).join("")}<td class="n"><b>${branch.el.length ? branch.score : "—"}</b></td><td>${branch.el.length ? esc(bandOf(branch.score, ar)) : (ar ? "بلا إثبات" : "No proof")}</td></tr>`).join("");
  const trendPeople = (view.ranked || []).slice(0, 4);
  const monthRows = (view.months || []).map((key) => `<tr><td>${esc(view.monthName?.(key) || key)}</td>${trendPeople.map((person) => {
    const facts = person.months?.[key];
    return `<td class="n">${facts ? scoreOf(facts) : "—"}</td>`;
  }).join("")}</tr>`).join("");
  const scope = view.anyPick
    ? [...(view.selBNames || []), ...(view.selTNames || []), ...(view.selPNames || [])].join(" · ")
    : (ar ? "كل الفروع" : "All branches");
  const title = ar ? "تقرير الأداء" : "Performance report";
  return `<!DOCTYPE html><html dir="${ar ? "rtl" : "ltr"}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8"><title>${esc(title)} — ${esc(view.fmtFrom)} → ${esc(view.fmtTo)}</title>
<style>@page{size:A4 landscape;margin:16mm 14mm}
body{margin:0;font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;color:#111418;font-size:10pt;line-height:1.7}
header{border-bottom:2px solid #0B3D27;padding-bottom:8pt;margin-bottom:14pt;display:flex;justify-content:space-between;align-items:flex-end;gap:14pt}
h1{font-size:17pt;margin:0;color:#0B3D27}h2{font-size:11.5pt;margin:16pt 0 7pt;color:#0B3D27}
.org{font-size:9pt;color:#555C66;text-align:${ar ? "left" : "right"}}
table{width:100%;border-collapse:collapse;margin-bottom:6pt}
th{background:#F4F7F5;text-align:start;font-size:8.5pt;color:#555C66;padding:5pt 6pt;border-bottom:1px solid #E4E9E6;white-space:nowrap}
td{padding:5pt 6pt;border-bottom:1px solid #E4E9E6;vertical-align:top}
.n{font-variant-numeric:tabular-nums;text-align:end;white-space:nowrap}s{font-size:8pt;color:#555C66;text-decoration:none}
tr.off td{color:#555C66;background:#F4F7F5}
.kv{display:flex;gap:16pt;flex-wrap:wrap;font-size:9.5pt;color:#111418}
.kv b{font-size:13pt;color:#3C7D50}.note{background:#F4F7F5;border:1px solid #E4E9E6;padding:8pt 10pt;font-size:9pt;color:#111418}
footer{margin-top:14pt;font-size:8.5pt;color:#555C66;border-top:1px solid #E4E9E6;padding-top:7pt}
@media print{body{padding:0}}
</style></head><body>
<header><h1>${esc(title)}</h1><span class="org">${esc(companyName)} · PowerCare<br>${esc(view.fmtFrom)} → ${esc(view.fmtTo)} · ${view.months?.length || 0} ${ar ? "أشهر" : "months"}</span></header>
<div class="kv"><span>${ar ? "النطاق" : "Scope"}: ${esc(scope)}</span>
<span>${ar ? "متوسط الدرجة" : "Average"}: <b>${view.eligible?.length ? view.avg : "—"}</b></span>
<span>${ar ? "الأعلى" : "Highest"}: <b>${view.top ? `${esc(view.top.name)} ${view.top.score}` : "—"}</b></span>
<span>${ar ? "بلا إثبات كافٍ" : "Short of proof"}: <b>${(view.rowsAll?.length || 0) - (view.eligible?.length || 0)}</b></span></div>
<h2>${ar ? "مقارنة الموظفين" : "People comparison"}</h2>
<table><thead><tr><th>#</th><th>${ar ? "الموظف" : "Employee"}</th>${drvHead}<th>${ar ? "الدرجة" : "Score"}</th><th>${ar ? "التقييم" : "Band"}</th><th>${ar ? "الإثبات" : "Proof"}</th></tr></thead><tbody>${peopleRows}</tbody></table>
<h2>${ar ? "مقارنة الفروع" : "Branch comparison"}</h2>
<table><thead><tr><th>${ar ? "الفرع" : "Branch"}</th>${drvHead}<th>${ar ? "الدرجة" : "Score"}</th><th>${ar ? "التقييم" : "Band"}</th></tr></thead><tbody>${branchRows}</tbody></table>
<h2>${ar ? `مسار الدرجة شهراً بشهر — أعلى ${trendPeople.length}` : `Month-by-month — top ${trendPeople.length}`}</h2>
<table><thead><tr><th>${ar ? "الشهر" : "Month"}</th>${trendPeople.map((person) => `<th>${esc(person.name)}</th>`).join("")}</tr></thead><tbody>${monthRows}</tbody></table>
<p class="note">${ar
    ? `الدرجة = مجموع (نسبة المحرّك × وزنه): الإنجاز ${PERF_DRIVERS[0].w} · الموعد ${PERF_DRIVERS[1].w} · السلامة ${PERF_DRIVERS[2].w} · التغطية ${PERF_DRIVERS[3].w}. ومن لم يبلغ ${MIN_PROOF} مهام مثبتة معتمدة في المدى تُعرض درجته ولا تدخل المتوسط — نقص إثبات لا سوء أداء.`
    : `Score = sum of (driver % × weight): Done ${PERF_DRIVERS[0].w} · On time ${PERF_DRIVERS[1].w} · Safety ${PERF_DRIVERS[2].w} · Coverage ${PERF_DRIVERS[3].w}. Anyone short of ${MIN_PROOF} approved proofs in the range is shown but kept out of the average — missing proof is not poor performance.`}</p>
<footer>${ar
    ? "تقرير مشتقّ من الإثبات المعتمد في المدى المذكور. لا يُعدَّل يدوياً. احفظه PDF من نافذة الطباعة."
    : "Derived from approved proof in the stated range. It is not edited by hand. Save it as PDF from the print dialog."}</footer>
</body></html>`;
}

export function printPerformanceReport(view, opts = {}) {
  const html = buildPerformanceReportHtml(view, opts);
  const filename = opts.ar
    ? `تقرير الأداء — ${view.from} إلى ${view.to}.pdf`
    : `performance-${view.from}-to-${view.to}.pdf`;
  const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (win) {
    win.document.write(html);
    win.document.close();
    win.document.title = filename.replace(/\.pdf$/i, "");
    setTimeout(() => {
      try { win.print(); } catch { /* print blocked */ }
    }, 350);
    return true;
  }
  if (typeof document === "undefined") return false;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename.replace(/\.pdf$/i, ".html");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return false;
}
