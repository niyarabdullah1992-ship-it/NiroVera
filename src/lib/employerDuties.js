/**
 * Employer duties the Labour Law and its Implementing Regulations put on file — pure, node-testable:
 *
 *   Training (Law Arts. 42–48 · Regs Arts. 5(5), 15–16 · model regulation Arts. 13–14)
 *     - each employee's training records (course, kind, dates, hours, provider, cost, assessment), documented
 *       within 30 days of the training (Regs Art. 16 أولاً/4);
 *     - a training plan per job (Regs Art. 15(4));
 *     - a bond to keep working after training may not exceed the training's length (indefinite contract)
 *       or the contract's remainder (fixed) — Regs Art. 15(6), model Art. 14 أولاً;
 *     - the worker bears the training costs only in the cases Regs Art. 16 ثانياً / model Art. 14 ثانياً
 *       list, and a trainee who refuses the post-training period pays the cost or its remaining share
 *       (Law Art. 48).
 *   Periodic medical exams (Law Art. 143 · Regs Art. 5(6)) — workers exposed to an occupational disease
 *     are examined at least once a year; the result goes in the register and in the worker's file.
 *   Passport / iqama / medical-insurance card (Regs Art. 6) — the employer may not keep a non-Saudi
 *     worker's passport, iqama or medical-insurance card.
 *   Non-discrimination (Law Art. 61(4), amended 1446H) — no exclusion, distinction or preference by race,
 *     colour, sex, age, disability, marital status or any other form: a pay-equity review flags gaps.
 *   Minimum age (Law Art. 162) — no one under fifteen is employed.
 *   Service certificate (Law Art. 64(1)) — states the joining date, end date, profession and last wage.
 */

import { ruleValue } from "./laborRules.js";

const DAY = 86400000;

function dateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function daysBetween(a, b) {
  const x = dateOnly(a);
  const y = dateOnly(b);
  if (!x || !y) return null;
  return Math.round((Date.parse(`${y}T00:00:00Z`) - Date.parse(`${x}T00:00:00Z`)) / DAY);
}

function addDays(iso, n) {
  const d = dateOnly(iso);
  if (!d) return "";
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + Number(n));
  return t.toISOString().slice(0, 10);
}

function addYears(iso, n) {
  const d = dateOnly(iso);
  if (!d) return "";
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCFullYear(t.getUTCFullYear() + Number(n));
  return t.toISOString().slice(0, 10);
}

const today0 = () => new Date().toISOString().slice(0, 10);
const fail = (error, reason, reasonEn, extra = {}) => ({ ok: false, error, reason, reasonEn, ...extra });

function isSaudi(emp) {
  const n = String(emp?.nationality || emp?.profile?.nationality || "").trim().toLowerCase();
  if (!n) return null;
  return /سعود|saudi|^sa$|^ksa$/.test(n);
}

function activeEmployees(employees = []) {
  return (employees || []).filter((e) => e && e.id && !e.archived && !e.terminatedAt && e.status !== "terminated");
}

/* ------------------------------------------- training ------------------------------------------- */

export const TRAINING_KINDS = [
  { id: "theory", ar: "نظري", en: "Theory" },
  { id: "practical", ar: "عملي", en: "Practical" },
  { id: "mixed", ar: "نظري وعملي", en: "Theory and practice" },
  { id: "safety", ar: "سلامة وصحة مهنية", en: "Safety and health" },
];

export const TRAINING_DOCUMENT_DAYS = 30; // Regs Art. 16 أولاً/4

export function trainingDays(record) {
  const d = daysBetween(record?.from, record?.to);
  return d == null ? 0 : d + 1;
}

/** A training record (Law Art. 44 · Regs Art. 16 أولاً/4): the program, its kind, dates, hours, provider and cost. */
export function checkTrainingRecordGate(record = {}) {
  if (!record.employeeId) return fail("TRAINING_EMPLOYEE", "سجل التدريب مربوط بموظف.", "A training record is tied to an employee.");
  if (String(record.course || "").trim().length < 3) return fail("TRAINING_COURSE", "اكتب اسم البرنامج التدريبي (اللائحة م16/أولاً/4).", "Name the training program (Regs Art. 16).");
  if (!TRAINING_KINDS.some((k) => k.id === record.kind)) return fail("TRAINING_KIND", "اختر نوع التدريب: نظري أو عملي (المادة 44).", "Pick the training kind (Art. 44).");
  if (!dateOnly(record.from) || !dateOnly(record.to) || record.to < record.from) return fail("TRAINING_DATES", "تاريخ البداية قبل تاريخ النهاية.", "The start comes before the end.");
  if (!(Number(record.hours) > 0)) return fail("TRAINING_HOURS", "اكتب عدد ساعات التدريب (المادة 44).", "Enter the training hours (Art. 44).");
  if (!String(record.provider || "").trim()) return fail("TRAINING_PROVIDER", "اكتب الجهة المقدمة للتدريب (اللائحة م16/أولاً/4).", "Enter the training provider (Regs Art. 16).");
  if (Number(record.cost) < 0 || record.cost === "" || record.cost == null || Number.isNaN(Number(record.cost))) return fail("TRAINING_COST", "اكتب تكلفة التدريب التي تحملتها المنشأة (صفر إن لم توجد).", "Enter the cost borne (zero if none).");
  if (record.bond) {
    const bond = checkTrainingBondGate({ record, contractType: record.bond.contractType, contractEndDate: record.bond.contractEndDate, bondDays: record.bond.days });
    if (!bond.ok) return bond;
  }
  return { ok: true, days: trainingDays(record) };
}

/**
 * A condition to keep working after the training (Regs Art. 15(6) · model Art. 14 أولاً): no longer than the
 * training program for an indefinite contract, or the remainder of a fixed contract if that is shorter.
 */
export function checkTrainingBondGate({ record, contractType = "indefinite", contractEndDate = "", bondDays = 0 } = {}) {
  const len = trainingDays(record);
  const days = Number(bondDays) || 0;
  if (days <= 0) return fail("TRAINING_BOND_DAYS", "اكتب مدة الالتزام بالعمل بعد التدريب بالأيام.", "Enter the post-training service period in days.");
  let max = len;
  if (contractType === "fixed" && dateOnly(contractEndDate) && dateOnly(record?.to)) {
    const remainder = Math.max(0, daysBetween(record.to, contractEndDate) || 0);
    max = Math.min(len, remainder);
  }
  if (days > max) {
    return fail(
      "TRAINING_BOND_OVER",
      `مدة الالتزام بالعمل بعد التدريب لا تتجاوز ${max} يوماً — مدة البرنامج${contractType === "fixed" ? " أو باقي مدة العقد المحدد" : ""} (اللائحة م15/6 · النموذج الموحد م14).`,
      `The post-training period may not exceed ${max} days — the program's length${contractType === "fixed" ? " or the fixed contract's remainder" : ""} (Regs Art. 15(6)).`,
      { max },
    );
  }
  return { ok: true, max };
}

/** Why the training costs fall on the worker, if they do (Regs Art. 16 ثانياً · model Art. 14 ثانياً · Law Art. 48). */
export const TRAINING_REPAY_CASES = [
  { id: "quit_training", ar: "أنهى التدريب قبل موعده دون عذر مشروع", en: "Quit the training early without a legitimate excuse", during: true },
  { id: "art80", ar: "فُسخ عقده أثناء التدريب وفق المادة 80 (عدا الفقرة 6)", en: "Contract terminated during training under Art. 80 (except para 6)", during: true },
  { id: "resigned", ar: "استقال أو ترك العمل أثناء التدريب لغير حالات المادة 81", en: "Resigned or left during training other than under Art. 81", during: true },
  { id: "refused_bond", ar: "رفض العمل المدة المشروطة بعد التدريب أو بعضها", en: "Refused to work the agreed post-training period, or part of it", during: false },
];

/**
 * The amount the worker repays, if any. `exit` = { case, date, art80Para }. During training the cost
 * spent is due; after it, the share of the remaining bond period (Law Art. 48 — «أو بنسبة المدة الباقية»).
 */
export function trainingRepayment(record = {}, exit = {}) {
  const row = TRAINING_REPAY_CASES.find((c) => c.id === exit.case);
  const cost = Math.max(0, Number(record.cost) || 0);
  if (!row || !cost) return { due: 0, reason: "" };
  if (row.id === "art80" && Number(exit.art80Para) === 6) return { due: 0, reason: "art80_6" };
  const date = dateOnly(exit.date);
  if (row.during) {
    if (!date || date < dateOnly(record.from) || date > dateOnly(record.to)) return { due: 0, reason: "not_during" };
    return { due: cost, reason: row.id };
  }
  const bondDays = Number(record.bond?.days) || 0;
  if (!bondDays || !date) return { due: 0, reason: "no_bond" };
  const served = Math.max(0, daysBetween(record.to, date) || 0);
  const left = Math.max(0, bondDays - served);
  return { due: Math.round((cost * left) / bondDays * 100) / 100, reason: row.id, left };
}

/** Records not yet documented on the ministry platform within 30 days of the training (Regs Art. 16 أولاً/4). */
export function trainingDocumentationDue(record, today = today0()) {
  if (dateOnly(record?.documentedAt)) return null;
  const end = dateOnly(record?.to);
  if (!end) return null;
  const due = addDays(end, TRAINING_DOCUMENT_DAYS);
  const left = daysBetween(today, due);
  return { due, left, over: left < 0 };
}

/**
 * Regs Art. 5(5) — سجل تدريب السعوديين: the program, its kind, length, year, the number and names trained,
 * and their share of the workforce. Plus the KPIs Safety and the inspection pack read.
 */
export function deriveTrainingRegister({ employees = [], today = today0(), year } = {}) {
  const staff = activeEmployees(employees);
  const y = String(year || String(today).slice(0, 4));
  const programs = new Map();
  const trainedIds = new Set();
  const trainedSaudiIds = new Set();
  let hours = 0;
  let cost = 0;
  let safetyTrained = 0;
  const undocumented = [];
  for (const emp of staff) {
    let safety = false;
    for (const rec of emp.trainings || []) {
      if (String(rec.from || "").slice(0, 4) !== y && String(rec.to || "").slice(0, 4) !== y) continue;
      const key = `${String(rec.course || "").trim()}|${rec.kind || ""}`;
      const p = programs.get(key) || { course: rec.course, kind: rec.kind, days: trainingDays(rec), hours: Number(rec.hours) || 0, provider: rec.provider || "", names: [] };
      p.names.push(emp.name || emp.id);
      programs.set(key, p);
      trainedIds.add(emp.id);
      if (isSaudi(emp)) trainedSaudiIds.add(emp.id);
      hours += Number(rec.hours) || 0;
      cost += Number(rec.cost) || 0;
      if (rec.kind === "safety") safety = true;
      const doc = trainingDocumentationDue(rec, today);
      if (doc?.over) undocumented.push({ employeeId: emp.id, name: emp.name, course: rec.course, due: doc.due });
    }
    if (safety) safetyTrained += 1;
  }
  const saudis = staff.filter((e) => isSaudi(e) === true).length;
  return {
    year: y,
    programs: [...programs.values()].map((p) => ({ ...p, count: p.names.length })),
    trained: trainedIds.size,
    trainedSaudi: trainedSaudiIds.size,
    saudiShare: saudis ? trainedSaudiIds.size / saudis : 0,
    share: staff.length ? trainedIds.size / staff.length : 0,
    safetyShare: staff.length ? safetyTrained / staff.length : 0,
    hours,
    cost,
    undocumented,
    headcount: staff.length,
  };
}

/** Training plan rows (Regs Art. 15(4)) that no employee in the role has attended this year. */
export function trainingPlanGaps({ plan = [], employees = [], today = today0() } = {}) {
  const y = String(today).slice(0, 4);
  const staff = activeEmployees(employees);
  return (plan || []).filter((row) => String(row.year || y) === y).map((row) => {
    const inRole = staff.filter((e) => !row.role || String(e.position || e.profile?.jobTitle || "").trim() === String(row.role).trim());
    const done = inRole.filter((e) => (e.trainings || []).some((t) => String(t.course || "").trim() === String(row.course || "").trim()));
    return { ...row, target: inRole.length, done: done.length, missing: inRole.filter((e) => !done.includes(e)).map((e) => e.name || e.id) };
  });
}

/* --------------------------------------- periodic medical exams --------------------------------------- */

export const MEDICAL_EXAM_YEARS = 1; // Law Art. 143 «مرة كل سنة على الأقل»
export const MEDICAL_EXAM_SOON_DAYS = 30;

/** Is the worker exposed to a listed occupational disease (flag on the file, or a hazardous-hours policy)? */
export function isOccupationallyExposed(emp) {
  const p = emp?.profile || {};
  return p.occupationalExposure === true || p.occupationalExposure === "yes" || Boolean(String(p.exposureHazard || "").trim());
}

export function medicalExamStatus(emp, today = today0()) {
  if (!isOccupationallyExposed(emp)) return { required: false };
  const exams = [...(emp.medicalExams || [])].filter((x) => dateOnly(x.at)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const last = exams[0] || null;
  const hired = dateOnly(emp.profile?.hireDate || emp.hireDate);
  const due = last ? addYears(last.at, MEDICAL_EXAM_YEARS) : (hired || today);
  const left = daysBetween(today, due);
  return { required: true, last, due, left, over: left < 0, soon: left >= 0 && left <= MEDICAL_EXAM_SOON_DAYS, unfit: last ? last.fit === false : false };
}

export function checkMedicalExamGate(exam = {}) {
  if (!dateOnly(exam.at)) return fail("MEDICAL_EXAM_DATE", "اكتب تاريخ الفحص.", "Enter the exam date.");
  if (exam.at > today0()) return fail("MEDICAL_EXAM_FUTURE", "تاريخ الفحص لا يكون بعد اليوم.", "The exam date cannot be after today.");
  if (!String(exam.doctor || "").trim()) return fail("MEDICAL_EXAM_DOCTOR", "اكتب الطبيب أو الجهة التي أجرت الفحص (المادة 143).", "Enter the doctor or provider (Art. 143).");
  if (!String(exam.result || "").trim()) return fail("MEDICAL_EXAM_RESULT", "أثبت نتيجة الفحص في السجل (المادة 143 · اللائحة م5/6).", "Record the result (Art. 143 · Regs Art. 5(6)).");
  return { ok: true };
}

/** Regs Art. 5(6) — the medical-exam register: names examined, the date and the results. */
export function deriveMedicalRegister({ employees = [], today = today0() } = {}) {
  const rows = activeEmployees(employees).map((emp) => ({ employee: emp, status: medicalExamStatus(emp, today) })).filter((r) => r.status.required);
  return {
    rows,
    exposed: rows.length,
    overdue: rows.filter((r) => r.status.over).length,
    soon: rows.filter((r) => r.status.soon).length,
    examined: rows.filter((r) => r.status.last).length,
  };
}

/* ------------------------------- documents the employer may not hold ------------------------------- */

export const HELD_DOCUMENT_KINDS = [
  { id: "passport", ar: "جواز السفر", en: "Passport", nonSaudiBan: true },
  { id: "iqama", ar: "الإقامة", en: "Iqama", nonSaudiBan: true },
  { id: "insurance_card", ar: "بطاقة التأمين الطبي", en: "Medical-insurance card", nonSaudiBan: true },
  { id: "certificate", ar: "شهادة أو وثيقة أودعها العامل", en: "A certificate or document deposited", nonSaudiBan: false },
];

/** Regs Art. 6: holding a non-Saudi worker's passport, iqama or insurance card is a violation — return it. */
export function heldDocumentViolations(emp) {
  if (isSaudi(emp) === true) return [];
  return (emp?.profile?.heldDocuments || [])
    .filter((d) => !dateOnly(d.returnedAt))
    .filter((d) => HELD_DOCUMENT_KINDS.find((k) => k.id === d.kind)?.nonSaudiBan)
    .map((d) => ({
      employeeId: emp.id,
      name: emp.name,
      kind: d.kind,
      since: dateOnly(d.heldSince),
      reason: `مخالفة — لا يحتفظ صاحب العمل بـ${HELD_DOCUMENT_KINDS.find((k) => k.id === d.kind).ar} للعامل غير السعودي؛ أعدها إليه وسجّل تاريخ الإعادة (اللائحة التنفيذية م6).`,
      reasonEn: `Violation — the employer may not keep a non-Saudi worker's ${HELD_DOCUMENT_KINDS.find((k) => k.id === d.kind).en.toLowerCase()}; return it and record the date (Regs Art. 6).`,
    }));
}

export function deriveHeldDocumentViolations(employees = []) {
  return activeEmployees(employees).flatMap(heldDocumentViolations);
}

/* ---------------------------------------- pay-equity review ---------------------------------------- */

export const PAY_EQUITY_THRESHOLD = 0.1;

function ageBand(emp, today) {
  const b = dateOnly(emp?.profile?.birthDate || emp?.birthDate);
  if (!b) return "";
  const years = (daysBetween(b, today) || 0) / 365.25;
  return years < 30 ? "<30" : years < 50 ? "30–49" : "50+";
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const PAY_EQUITY_DIMENSIONS = [
  { id: "gender", ar: "الجنس", en: "Sex", of: (e) => String(e.profile?.gender || e.gender || "").trim() },
  { id: "nationality", ar: "الجنسية", en: "Nationality", of: (e) => (isSaudi(e) == null ? "" : isSaudi(e) ? "saudi" : "non_saudi") },
  { id: "age", ar: "السن", en: "Age", of: (e, today) => ageBand(e, today) },
  { id: "disability", ar: "الإعاقة", en: "Disability", of: (e) => (e.profile?.disability === true || e.profile?.disability === "yes" ? "yes" : e.profile?.disability === false || e.profile?.disability === "no" ? "no" : "") },
];

/**
 * Law Art. 61(4): within the same job title and grade, compare the median wage of each group of a dimension.
 * A gap above the threshold is a review item — never a block (a legitimate reason may explain it).
 */
export function payEquityReview({ employees = [], wageOf = (e) => (Number(e.profile?.baseSalary) || 0) + (Number(e.profile?.allowances) || 0), threshold = PAY_EQUITY_THRESHOLD, today = today0() } = {}) {
  const staff = activeEmployees(employees).filter((e) => wageOf(e) > 0);
  const cohorts = new Map();
  for (const e of staff) {
    const title = String(e.position || e.profile?.jobTitle || "").trim();
    if (!title) continue;
    const key = `${title}|${String(e.profile?.grade || e.gradeId || e.profile?.gradeId || "").trim()}`;
    if (!cohorts.has(key)) cohorts.set(key, { title, grade: key.split("|")[1], people: [] });
    cohorts.get(key).people.push(e);
  }
  const items = [];
  for (const c of cohorts.values()) {
    if (c.people.length < 2) continue;
    for (const dim of PAY_EQUITY_DIMENSIONS) {
      const groups = new Map();
      for (const e of c.people) {
        const g = dim.of(e, today);
        if (!g) continue;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(wageOf(e));
      }
      if (groups.size < 2) continue;
      const meds = [...groups.entries()].map(([g, ws]) => ({ group: g, median: median(ws), count: ws.length }));
      const hi = meds.reduce((a, b) => (b.median > a.median ? b : a));
      const lo = meds.reduce((a, b) => (b.median < a.median ? b : a));
      const gap = hi.median ? (hi.median - lo.median) / hi.median : 0;
      if (gap > threshold) {
        items.push({
          title: c.title,
          grade: c.grade,
          dimension: dim.id,
          high: hi,
          low: lo,
          gap,
          reason: `مراجعة — في وظيفة «${c.title}»${c.grade ? ` (الدرجة ${c.grade})` : ""} يقل الوسيط لفئة «${lo.group}» عن فئة «${hi.group}» بنسبة ${Math.round(gap * 100)}% حسب ${dim.ar}. تحقق أن الفرق لسبب مشروع لا تمييز (المادة 61/4).`,
          reasonEn: `Review — in “${c.title}” the ${dim.en.toLowerCase()} group “${lo.group}” earns ${Math.round(gap * 100)}% less than “${hi.group}”. Confirm a legitimate reason, not discrimination (Art. 61(4)).`,
        });
      }
    }
  }
  return { items, cohorts: cohorts.size, threshold };
}

/* ------------------------------------------- hiring age ------------------------------------------- */

/** Law Art. 162: no one under fifteen is employed. 15–18 is a juvenile (hours rules apply). No birth date → no block. */
export function checkHiringAgeGate({ birthDate, hireDate } = {}) {
  const b = dateOnly(birthDate);
  const h = dateOnly(hireDate) || today0();
  if (!b) return { ok: true, juvenile: false, unknown: true };
  const years = (daysBetween(b, h) || 0) / 365.25;
  const min = ruleValue("hours.juvenile.minAgeYears", h);
  const max = ruleValue("hours.juvenile.maxAgeYears", h);
  if (years < min) {
    return fail("HIRE_UNDER_MIN_AGE", `موقوف — لا يجوز تشغيل من لم يتم ${min} سنة من عمره (المادة 162).`, `Blocked — no one under ${min} may be employed (Article 162).`);
  }
  return { ok: true, juvenile: years < max, years };
}

/* -------------------------------------- service certificate -------------------------------------- */

/** Law Art. 64(1): the certificate states the joining date, end date, profession and last wage. */
export function checkServiceCertificateGate(employee, { endDate = "" } = {}) {
  const p = employee?.profile || {};
  const join = dateOnly(p.hireDate || p.joinDate || employee?.hireDate);
  const end = dateOnly(endDate || p.contractExit?.effectiveDate || p.contractExit?.lastDay || employee?.terminatedAt);
  const job = String(employee?.position || p.jobTitle || p.profession || "").trim();
  const wage = Number(p.lastWage) || (Number(p.baseSalary) || 0) + (Number(p.allowances) || 0);
  const missing = [];
  if (!join) missing.push({ ar: "تاريخ الالتحاق", en: "joining date" });
  const exited = Boolean(p.contractExit || employee?.terminatedAt || employee?.status === "terminated" || employee?.archived);
  // Still in service: the certificate reads «ولا يزال على رأس العمل»; after an exit, the end date is required.
  if (!end && exited) missing.push({ ar: "تاريخ انتهاء العلاقة", en: "end date" });
  if (!job) missing.push({ ar: "المهنة", en: "profession" });
  if (!(wage > 0)) missing.push({ ar: "مقدار الأجر الأخير", en: "last wage" });
  if (missing.length) {
    return fail(
      "SERVICE_CERT_FIELDS",
      `أكمل في ملف العامل قبل إصدار شهادة الخدمة: ${missing.map((m) => m.ar).join("، ")} (المادة 64/1).`,
      `Complete on the file before issuing the service certificate: ${missing.map((m) => m.en).join(", ")} (Art. 64(1)).`,
      { missing },
    );
  }
  return { ok: true, join, end, job, wage, current: !end };
}
