/**
 * The wage run read as a cycle with a review in it — pure derivations the run board draws.
 *
 *   payrollStages     the cycle in order (attendance → lines → deductions → GOSI → review → approve
 *                     → wage protection → Mudad), each ready / to do / waiting, with its count.
 *   monthVariance     every person against last month: the difference, its reasons, and what
 *                     must be looked at before approval (> 10%, new, left, zero).
 *   allowanceMatrix   every allowance kind, per branch.
 *   wpsPrecheck       the wage-protection checks run before approval, not after.
 *   employerCost      the full monthly cost: gross + employer GOSI + end-of-service accrual (Art. 84).
 */

import { lineComponents, lineNet, wpsDeadline } from "./payrollDerivations.js";
import { wpsRowBlockers } from "./complianceDerivations.js";

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;

export function previousMonth(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The named parts of a line that can move the net from one month to the next. */
function partsOf(line) {
  const c = lineComponents(line);
  return {
    base: c.base,
    housing: n(line.housingAllowance),
    transport: n(line.transportAllowance),
    remote: n(line.remoteAreaAllowance),
    medical: n(line.medicalDistanceAllowance),
    meals: n(line.mealAllowance),
    hazard: n(line.hazardAllowance),
    night: n(line.nightAllowance),
    commission: n(line.commissionAmount),
    allowances: c.allowances,
    bonus: c.bonus,
    overtime: c.overtimePay,
    deductions: c.deductions,
    gosi: c.gosiEmployee,
    injury: c.injuryCut,
    sick: c.sickCut || 0,
  };
}

const PART_LABEL = {
  base: ["الأساسي", "Base"],
  housing: ["بدل السكن", "Housing"],
  transport: ["بدل النقل", "Transport"],
  remote: ["بدل منطقة نائية", "Remote area"],
  medical: ["بدل بُعد الخدمات الطبية", "Distance from care"],
  meals: ["بدل إعاشة", "Meals"],
  hazard: ["بدل طبيعة عمل", "Hazard"],
  night: ["الأجر الليلي", "Night pay"],
  commission: ["العمولة", "Commission"],
  bonus: ["مكافأة", "Bonus"],
  overtime: ["الإضافي", "Overtime"],
  deductions: ["خصومات بسند", "Deductions"],
  gosi: ["التأمينات", "GOSI"],
  injury: ["إصابة عمل", "Work injury"],
  sick: ["إجازة مرضية", "Sick leave"],
};
// Parts that reduce the net when they grow.
const MINUS = new Set(["deductions", "gosi", "injury", "sick"]);
// Named allowances are inside «allowances»; compare them, not the lump, when present.
const NAMED = ["housing", "transport", "remote", "medical", "meals", "hazard", "night", "commission"];

/**
 * Person by person against last month. A line is flagged for review when its net moved more
 * than `threshold` (10%), when the person is new or left, or when the net is zero.
 */
export function monthVariance(items = [], prevItems = [], { ar = true, threshold = 0.1 } = {}) {
  const prev = new Map(prevItems.map((l) => [String(l.employeeId), l]));
  const now = new Map(items.map((l) => [String(l.employeeId), l]));
  const rows = [];
  for (const line of items) {
    const id = String(line.employeeId);
    const before = prev.get(id);
    const net = lineNet(line);
    if (!before) {
      rows.push({ employeeId: id, name: line.employeeName || "", net, prevNet: null, delta: net, pct: null, flag: "new", reasons: [ar ? "أول شهر في المسير" : "First month on the run"] });
      continue;
    }
    const prevNet = lineNet(before);
    const delta = r2(net - prevNet);
    const pct = prevNet > 0 ? delta / prevNet : null;
    const a = partsOf(line);
    const b = partsOf(before);
    const namedNow = NAMED.reduce((s, k) => s + a[k], 0);
    const namedThen = NAMED.reduce((s, k) => s + b[k], 0);
    const keys = ["base", ...NAMED, "bonus", "overtime", "deductions", "gosi", "injury", "sick"];
    const reasons = [];
    for (const k of keys) {
      const d = r2(a[k] - b[k]);
      if (Math.abs(d) < 1) continue;
      const effect = MINUS.has(k) ? -d : d;
      reasons.push(`${effect > 0 ? "+" : "−"}${Math.abs(Math.round(d)).toLocaleString("en-US")} ${ar ? PART_LABEL[k][0] : PART_LABEL[k][1]}`);
    }
    // An allowance change with no named split shows as the lump.
    const lumpDelta = r2((a.allowances - namedNow) - (b.allowances - namedThen));
    if (Math.abs(lumpDelta) >= 1) reasons.push(`${lumpDelta > 0 ? "+" : "−"}${Math.abs(Math.round(lumpDelta)).toLocaleString("en-US")} ${ar ? "بدلات أخرى" : "Other allowances"}`);
    const flag = net <= 0 ? "zero" : pct != null && Math.abs(pct) > threshold ? "big" : "";
    rows.push({ employeeId: id, name: line.employeeName || "", net, prevNet, delta, pct, flag, reasons });
  }
  for (const before of prevItems) {
    const id = String(before.employeeId);
    if (now.has(id)) continue;
    rows.push({ employeeId: id, name: before.employeeName || "", net: 0, prevNet: lineNet(before), delta: -lineNet(before), pct: -1, flag: "left", reasons: [ar ? "لم يعد في المسير — تحقّق من المخالصة" : "No longer on the run — check the clearance"] });
  }
  const order = { zero: 0, big: 1, new: 2, left: 3, "": 4 };
  rows.sort((x, y) => order[x.flag] - order[y.flag] || Math.abs(y.delta) - Math.abs(x.delta));
  return {
    rows,
    flagged: rows.filter((r) => r.flag).length,
    hasPrev: prevItems.length > 0,
    total: r2(items.reduce((s, l) => s + lineNet(l), 0)),
    prevTotal: r2(prevItems.reduce((s, l) => s + lineNet(l), 0)),
  };
}

export const MATRIX_KINDS = [
  { id: "housing", ar: "سكن", en: "Housing", read: (l) => n(l.housingAllowance) },
  { id: "transport", ar: "نقل", en: "Transport", read: (l) => n(l.transportAllowance) },
  { id: "hazard", ar: "طبيعة عمل", en: "Hazard", read: (l) => n(l.hazardAllowance) },
  { id: "remote", ar: "منطقة نائية", en: "Remote", read: (l) => n(l.remoteAreaAllowance) },
  { id: "medical", ar: "بُعد طبي", en: "Care distance", read: (l) => n(l.medicalDistanceAllowance) },
  { id: "meals", ar: "إعاشة", en: "Meals", read: (l) => n(l.mealAllowance) },
  { id: "night", ar: "ليلي", en: "Night", read: (l) => n(l.nightAllowance) },
  { id: "commission", ar: "عمولة", en: "Commission", read: (l) => n(l.commissionAmount) },
];

/** Every allowance kind per branch; kinds nobody is paid are dropped from the columns. */
export function allowanceMatrix(items = [], stationOf = (l) => l.stationId || "") {
  const by = new Map();
  for (const line of items) {
    const sid = stationOf(line) || "__unassigned__";
    const row = by.get(sid) || { stationId: sid, heads: 0, cells: Object.fromEntries(MATRIX_KINDS.map((k) => [k.id, 0])), other: 0, total: 0 };
    row.heads += 1;
    let named = 0;
    for (const k of MATRIX_KINDS) {
      const v = k.read(line);
      row.cells[k.id] += v;
      if (k.id !== "commission") named += v;
    }
    const lump = Math.max(0, n(line.allowances) - named);
    row.other += lump;
    row.total += named + lump + n(line.commissionAmount);
    by.set(sid, row);
  }
  const rows = [...by.values()];
  const kinds = MATRIX_KINDS.filter((k) => rows.some((r) => r.cells[k.id] > 0));
  const totals = Object.fromEntries(MATRIX_KINDS.map((k) => [k.id, rows.reduce((s, r) => s + r.cells[k.id], 0)]));
  return { rows, kinds, totals, other: rows.reduce((s, r) => s + r.other, 0) };
}

/**
 * Wage-protection checks before approval: the same ID / IBAN / Qiwa-wage rules the Mudad file
 * applies, plus a bank name, and a Saudi wage under 4,000 flagged for Nitaqat (a note, not a block).
 */
export function wpsPrecheck(items = [], employeeFor = () => null, { ar = true, month, now = new Date() } = {}) {
  const rows = [];
  for (const line of items) {
    const e = employeeFor(line) || {};
    const p = e.profile || {};
    const base = n(line.base);
    const allowances = n(line.allowances);
    const row = {
      employeeId: line.employeeId,
      employeeName: e.name || line.employeeName || "",
      nationalId: String(p.nationalId || e.nationalId || "").trim(),
      iban: String(p.iban || "").replace(/\s+/g, "").toUpperCase(),
      qiwaMatch: line.qiwaWage == null ? false : Math.abs(n(line.qiwaWage) - (base + allowances)) < 1,
    };
    const blockers = wpsRowBlockers(row, ar);
    if (!String(p.bankName || p.bank || "").trim()) blockers.push(ar ? "اسم البنك فارغ" : "Bank name empty");
    const notes = [];
    if (line.isSaudi === true && base + allowances < 4000) notes.push(ar ? "أجر سعودي دون 4,000 — راجع احتسابه في نطاقات" : "Saudi wage under 4,000 — check how Nitaqat counts it");
    rows.push({ ...row, paid: !!line.paid, blockers, notes });
  }
  const due = wpsDeadline(month);
  let daysLeft = null;
  if (due) {
    const [y, m, d] = due.split("-").map(Number);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    daysLeft = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
  }
  return {
    rows,
    blocked: rows.filter((r) => r.blockers.length).length,
    noted: rows.filter((r) => r.notes.length).length,
    unpaid: rows.filter((r) => !r.paid).length,
    deadline: due,
    daysLeft,
  };
}

/**
 * What a person costs the establishment in the month: gross + employer GOSI (on the line's own
 * rate) + end-of-service accrual — half a month's wage a year for the first five years, a full
 * month after (Art. 84), spread over twelve months on the actual wage (base + allowances).
 */
export function employerCost(line = {}, { serviceYears = 0 } = {}) {
  const c = lineComponents(line);
  const gross = c.base + c.allowances + c.bonus + c.overtimePay;
  const wage = c.base + c.allowances;
  const employerRate = line.gosiEmployerRate != null ? n(line.gosiEmployerRate) : (line.isSaudi === true ? 0.1175 : line.isSaudi === false ? 0.02 : 0);
  const contributory = Math.min(45000, Math.max(line.isSaudi === false ? 400 : 1500, c.base + n(line.housingAllowance) + n(line.commissionAmount)));
  const gosiEmployer = wage > 0 ? r2(contributory * employerRate) : 0;
  const eosAccrual = r2(wage * (serviceYears >= 5 ? 1 : 0.5) / 12);
  return { gross: r2(gross), gosiEmployer, eosAccrual, total: r2(gross + gosiEmployer + eosAccrual), net: c.net };
}

/**
 * The cycle in order. `ctx`: { run, items, attGaps, deductionGaps, gosiOpen, variance, wps }.
 * state: done · todo (needs action) · wait (blocked by an earlier stage) · note (look, not a block)
 */
export function payrollStages(ctx = {}, ar = true) {
  const { run, items = [], attGaps = 0, issueCount = 0, deductionGaps = 0, gosiOpen = 0, variance = { flagged: 0 }, wps = { blocked: 0, daysLeft: null } } = ctx;
  const status = run?.status || "";
  const approved = status === "approved" || status === "sent";
  const sent = status === "sent";
  const hasRun = !!run && items.length > 0;
  const before = [
    { id: "att", tab: "att", ar: "إقفال الحضور", en: "Lock attendance", count: attGaps, noteAr: attGaps ? `${attGaps} بلا حضور مكتمل` : "مكتمل", noteEn: attGaps ? `${attGaps} with gaps` : "Complete" },
    { id: "lines", tab: "lines", ar: "مراجعة البنود", en: "Review lines", count: issueCount, noteAr: issueCount ? `${issueCount} بنداً فيه خلل` : "سليمة", noteEn: issueCount ? `${issueCount} with issues` : "Clean" },
    { id: "deduct", tab: "deduct", ar: "الخصومات بسند", en: "Deductions with an instrument", count: deductionGaps, noteAr: deductionGaps ? `${deductionGaps} بلا سند` : "كلها بسند", noteEn: deductionGaps ? `${deductionGaps} without an instrument` : "All documented" },
    { id: "gosi", tab: "gosi", ar: "التأمينات", en: "GOSI", count: gosiOpen, noteAr: gosiOpen ? `${gosiOpen} بلا جنسية أو نسبة مثبتة` : "محسوبة", noteEn: gosiOpen ? `${gosiOpen} without nationality or rate` : "Computed" },
    { id: "wpscheck", tab: "run", ar: "فحص حماية الأجور", en: "Wage-protection check", count: wps.blocked, noteAr: wps.blocked ? `${wps.blocked} صفاً لن يقبله الملف` : "جاهز", noteEn: wps.blocked ? `${wps.blocked} rows the file will refuse` : "Ready" },
    { id: "review", tab: "run", ar: "مقارنة بالشهر الماضي", en: "Against last month", count: variance.flagged, soft: true, noteAr: variance.flagged ? `${variance.flagged} يحتاج نظرة` : "لا فروق لافتة", noteEn: variance.flagged ? `${variance.flagged} to look at` : "No notable change" },
  ];
  const blocking = before.filter((s) => !s.soft && s.count > 0).length;
  const stages = before.map((s) => ({ ...s, state: !hasRun ? "wait" : s.count > 0 ? (s.soft ? "note" : "todo") : "done" }));
  stages.push({
    id: "approve", tab: "run", ar: "الاعتماد", en: "Approval",
    state: approved ? "done" : !hasRun || blocking ? "wait" : "todo",
    count: 0,
    noteAr: approved ? "معتمد" : blocking ? `بعد ${blocking} مرحلة` : "جاهز للاعتماد",
    noteEn: approved ? "Approved" : blocking ? `After ${blocking} stage(s)` : "Ready to approve",
  });
  stages.push({
    id: "wps", tab: "wps", ar: "ملف حماية الأجور · مدد", en: "WPS file · Mudad",
    state: sent ? "done" : approved ? "todo" : "wait",
    count: 0,
    noteAr: sent ? "أُرسل" : wps.daysLeft == null ? "بعد الاعتماد" : wps.daysLeft < 0 ? `متأخر ${-wps.daysLeft} يوماً` : `باقٍ ${wps.daysLeft} يوماً`,
    noteEn: sent ? "Sent" : wps.daysLeft == null ? "After approval" : wps.daysLeft < 0 ? `${-wps.daysLeft} days late` : `${wps.daysLeft} days left`,
    late: !sent && wps.daysLeft != null && wps.daysLeft < 0,
  });
  const current = stages.find((s) => s.state === "todo") || stages.find((s) => s.state === "note") || null;
  return { stages, currentId: current?.id || "", blocking };
}
