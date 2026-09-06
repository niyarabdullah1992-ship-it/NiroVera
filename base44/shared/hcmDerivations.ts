/** Enterprise HCM foundation — org units · jobs · positions · employment actions ·
 *  job-weighted objectives · review cycles.
 *
 *  Rule that never bends: performance credit is earned only by approved task weight.
 *  Positions, jobs and objectives shape *how* that weight is counted — they never
 *  become a second, typed source of score. Every gate names its blocking reason.
 */

import { taskPoints } from "./opsDerivations.ts";
import { blendHseTerm } from "./perfDerivations.ts";

/* ───────────────────────────── effective dating ───────────────────────────── */

/** Date-tracked records compare as YYYY-MM-DD strings — no timezone drift. */
export function dayKey(value: unknown): string | null {
  const raw = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function todayKey(now: Date = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export type Dated = { effectiveFrom?: string | null; effectiveTo?: string | null };

export function isEffectiveOn(row: Dated, onDay: string) {
  const from = dayKey(row?.effectiveFrom);
  const to = dayKey(row?.effectiveTo);
  if (from && onDay < from) return false;
  if (to && onDay > to) return false;
  return true;
}

export function activeAsOf<T extends Dated>(rows: T[], onDay: string) {
  return (Array.isArray(rows) ? rows : []).filter((r) => isEffectiveOn(r, onDay));
}

/* ───────────────────────────────── org units ──────────────────────────────── */

export const ORG_UNIT_TYPES = ["company", "division", "department", "section", "station"] as const;
export type OrgUnitType = (typeof ORG_UNIT_TYPES)[number];

export const ORG_UNIT_LABELS: Record<OrgUnitType, { ar: string; en: string }> = {
  company: { ar: "الشركة", en: "Company" },
  division: { ar: "قطاع", en: "Division" },
  department: { ar: "إدارة", en: "Department" },
  section: { ar: "قسم", en: "Section" },
  station: { ar: "فرع", en: "Station" },
};

export type OrgUnitLike = Dated & {
  id: string;
  name: string;
  type: OrgUnitType | string;
  parentId?: string | null;
  costCenter?: string | null;
  establishmentNumber?: string | null;
  stationId?: string | null;
};

export function unitWouldCycle(units: OrgUnitLike[], unitId: string, parentId: string | null | undefined) {
  if (!parentId) return false;
  if (parentId === unitId) return true;
  const byId = new Map(units.map((u) => [u.id, u]));
  const seen = new Set<string>();
  let cursor = byId.get(parentId);
  while (cursor) {
    if (cursor.id === unitId) return true;
    if (seen.has(cursor.id)) return true;
    seen.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return false;
}

/** MHRSD establishment number — format only. No live government lookup exists here. */
export function checkEstablishmentNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true as const, value: null };
  if (!/^\d{6,12}$/.test(raw)) {
    return {
      ok: false as const,
      error: "ESTABLISHMENT_NUMBER_INVALID",
      reason: "رقم المنشأة في وزارة الموارد البشرية يجب أن يكون من 6 إلى 12 رقمًا — لا يوجد تحقق حكومي مباشر، الصيغة فقط.",
      reasonEn: "The MHRSD establishment number must be 6–12 digits — format only, no live government check.",
    };
  }
  return { ok: true as const, value: raw };
}

export function checkCreateOrgUnitGate(input: {
  id?: string;
  name?: string | null;
  type?: string | null;
  parentId?: string | null;
  costCenter?: string | null;
  establishmentNumber?: string | null;
  effectiveFrom?: string | null;
  units?: OrgUnitLike[];
}) {
  const units = Array.isArray(input.units) ? input.units : [];
  const name = String(input.name || "").trim();
  if (!name) {
    return { ok: false as const, error: "ORG_UNIT_NAME_REQUIRED", reason: "اسم الوحدة التنظيمية مطلوب.", reasonEn: "Organization unit name is required." };
  }
  const type = String(input.type || "");
  if (!(ORG_UNIT_TYPES as readonly string[]).includes(type)) {
    return { ok: false as const, error: "ORG_UNIT_TYPE_INVALID", reason: "نوع الوحدة غير معروف — اختر قطاعًا أو إدارة أو قسمًا أو فرع.", reasonEn: "Unknown unit type — pick division, department, section or station." };
  }
  const parentId = input.parentId ? String(input.parentId) : null;
  if (parentId && !units.some((u) => u.id === parentId)) {
    return { ok: false as const, error: "ORG_UNIT_PARENT_NOT_FOUND", reason: "الوحدة الأعلى غير موجودة.", reasonEn: "Parent unit not found." };
  }
  if (input.id && unitWouldCycle(units, String(input.id), parentId)) {
    return { ok: false as const, error: "ORG_UNIT_CYCLE_FORBIDDEN", reason: "لا يمكن جعل الوحدة تابعة لنفسها أو لفرعٍ منها.", reasonEn: "A unit cannot be placed under itself or one of its descendants." };
  }
  const effectiveFrom = dayKey(input.effectiveFrom);
  if (!effectiveFrom) {
    return { ok: false as const, error: "EFFECTIVE_DATE_REQUIRED", reason: "تاريخ السريان مطلوب — كل سجل تنظيمي مؤرَّخ.", reasonEn: "An effective date is required — every organization record is date-tracked." };
  }
  const est = checkEstablishmentNumber(input.establishmentNumber);
  if (!est.ok) {
    return { ok: false as const, error: est.error, reason: est.reason, reasonEn: est.reasonEn };
  }
  return {
    ok: true as const,
    name,
    type: type as OrgUnitType,
    parentId,
    effectiveFrom,
    costCenter: String(input.costCenter || "").trim() || null,
    establishmentNumber: est.value,
  };
}

export function deriveUnitPath(units: OrgUnitLike[], unitId: string | null | undefined): OrgUnitLike[] {
  if (!unitId) return [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const path: OrgUnitLike[] = [];
  const seen = new Set<string>();
  let cursor = byId.get(unitId);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return path;
}

/** Cost center is inherited from the nearest ancestor that declares one. */
export function deriveCostCenter(units: OrgUnitLike[], unitId: string | null | undefined) {
  const path = deriveUnitPath(units, unitId);
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (path[i].costCenter) return { costCenter: path[i].costCenter as string, fromUnitId: path[i].id, inherited: i !== path.length - 1 };
  }
  return { costCenter: null, fromUnitId: null, inherited: false };
}

export function deriveEstablishment(units: OrgUnitLike[], unitId: string | null | undefined) {
  const path = deriveUnitPath(units, unitId);
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (path[i].establishmentNumber) return { establishmentNumber: path[i].establishmentNumber as string, fromUnitId: path[i].id };
  }
  return { establishmentNumber: null, fromUnitId: null };
}

export function descendantUnitIds(units: OrgUnitLike[], unitId: string) {
  const out = new Set<string>([unitId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of units) {
      if (u.parentId && out.has(u.parentId) && !out.has(u.id)) {
        out.add(u.id);
        grew = true;
      }
    }
  }
  return out;
}

/* ────────────────────────────── job catalogue ─────────────────────────────── */

export const JOB_FAMILIES = ["operations", "maintenance", "hse", "engineering", "admin", "finance", "hr", "commercial"] as const;
export type JobFamily = (typeof JOB_FAMILIES)[number];

export const JOB_FAMILY_LABELS: Record<JobFamily, { ar: string; en: string }> = {
  operations: { ar: "التشغيل", en: "Operations" },
  maintenance: { ar: "الصيانة", en: "Maintenance" },
  hse: { ar: "السلامة", en: "HSE" },
  engineering: { ar: "الهندسة", en: "Engineering" },
  admin: { ar: "الإدارة", en: "Administration" },
  finance: { ar: "المالية", en: "Finance" },
  hr: { ar: "الموارد البشرية", en: "Human resources" },
  commercial: { ar: "التجاري", en: "Commercial" },
};

export type JobLike = Dated & {
  id: string;
  code: string;
  title: string;
  family: JobFamily | string;
  gradeMin?: number | null;
  gradeMax?: number | null;
};

export function checkCreateJobGate(input: {
  code?: string | null;
  title?: string | null;
  family?: string | null;
  gradeMin?: unknown;
  gradeMax?: unknown;
  jobs?: JobLike[];
}) {
  const jobs = Array.isArray(input.jobs) ? input.jobs : [];
  const code = String(input.code || "").trim().toUpperCase();
  if (!code) {
    return { ok: false as const, error: "JOB_CODE_REQUIRED", reason: "رمز الوظيفة مطلوب — هو المفتاح الذي تُبنى عليه المناصب والأهداف.", reasonEn: "A job code is required — positions and objectives are keyed to it." };
  }
  if (jobs.some((j) => String(j.code || "").toUpperCase() === code)) {
    return { ok: false as const, error: "JOB_CODE_DUPLICATE", reason: `رمز الوظيفة «${code}» مستخدم بالفعل.`, reasonEn: `Job code «${code}» is already in use.` };
  }
  const title = String(input.title || "").trim();
  if (!title) {
    return { ok: false as const, error: "JOB_TITLE_REQUIRED", reason: "المسمى الوظيفي مطلوب.", reasonEn: "Job title is required." };
  }
  const family = String(input.family || "");
  if (!(JOB_FAMILIES as readonly string[]).includes(family)) {
    return { ok: false as const, error: "JOB_FAMILY_INVALID", reason: "عائلة الوظيفة غير معروفة.", reasonEn: "Unknown job family." };
  }
  const gradeMin = input.gradeMin == null || input.gradeMin === "" ? null : Number(input.gradeMin);
  const gradeMax = input.gradeMax == null || input.gradeMax === "" ? null : Number(input.gradeMax);
  if ((gradeMin != null && !Number.isFinite(gradeMin)) || (gradeMax != null && !Number.isFinite(gradeMax))) {
    return { ok: false as const, error: "JOB_GRADE_BAND_INVALID", reason: "نطاق الدرجة يجب أن يكون رقمًا.", reasonEn: "The grade band must be numeric." };
  }
  if (gradeMin != null && gradeMax != null && gradeMin > gradeMax) {
    return { ok: false as const, error: "JOB_GRADE_BAND_INVALID", reason: "أدنى درجة أكبر من أعلى درجة.", reasonEn: "Minimum grade is above maximum grade." };
  }
  return { ok: true as const, code, title, family: family as JobFamily, gradeMin, gradeMax };
}

/* ──────────────────────────── position management ─────────────────────────── */

export type PositionLike = Dated & {
  id: string;
  ref?: string;
  jobId: string;
  orgUnitId: string;
  stationId?: string | null;
  fte?: number | null;
  scheduleId?: string | null;
  reportsToPositionId?: string | null;
  closedAt?: string | null;
};

export function clampFte(raw: unknown) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0.1, Math.round(n * 100) / 100));
}

export function checkCreatePositionGate(input: {
  jobId?: string | null;
  orgUnitId?: string | null;
  fte?: unknown;
  effectiveFrom?: string | null;
  reportsToPositionId?: string | null;
  jobs?: JobLike[];
  units?: OrgUnitLike[];
  positions?: PositionLike[];
}) {
  const jobs = Array.isArray(input.jobs) ? input.jobs : [];
  const units = Array.isArray(input.units) ? input.units : [];
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const jobId = String(input.jobId || "");
  if (!jobId || !jobs.some((j) => j.id === jobId)) {
    return { ok: false as const, error: "POSITION_JOB_NOT_FOUND", reason: "المنصب يحتاج وظيفة من الكتالوج — أنشئ الوظيفة أولًا.", reasonEn: "A position needs a job from the catalogue — create the job first." };
  }
  const orgUnitId = String(input.orgUnitId || "");
  if (!orgUnitId || !units.some((u) => u.id === orgUnitId)) {
    return { ok: false as const, error: "POSITION_ORG_UNIT_NOT_FOUND", reason: "المنصب يحتاج وحدة تنظيمية قائمة.", reasonEn: "A position needs an existing organization unit." };
  }
  const rawFte = input.fte == null || input.fte === "" ? 1 : Number(input.fte);
  if (!Number.isFinite(rawFte) || rawFte < 0.1 || rawFte > 1) {
    return { ok: false as const, error: "POSITION_FTE_INVALID", reason: "نسبة الدوام يجب أن تكون بين 0.1 و 1.", reasonEn: "FTE must be between 0.1 and 1." };
  }
  const effectiveFrom = dayKey(input.effectiveFrom);
  if (!effectiveFrom) {
    return { ok: false as const, error: "EFFECTIVE_DATE_REQUIRED", reason: "تاريخ سريان المنصب مطلوب.", reasonEn: "The position effective date is required." };
  }
  const reportsToPositionId = input.reportsToPositionId ? String(input.reportsToPositionId) : null;
  if (reportsToPositionId && !positions.some((p) => p.id === reportsToPositionId)) {
    return { ok: false as const, error: "POSITION_PARENT_NOT_FOUND", reason: "المنصب الأعلى غير موجود.", reasonEn: "The reporting position was not found." };
  }
  return { ok: true as const, jobId, orgUnitId, fte: clampFte(rawFte), effectiveFrom, reportsToPositionId };
}

/* ─────────────────────────── employment actions ───────────────────────────── */

export const ACTION_TYPES = [
  "hire",
  "transfer",
  "promotion",
  "demotion",
  "reclassification",
  "suspension",
  "reinstatement",
  "termination",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, { ar: string; en: string }> = {
  hire: { ar: "تعيين", en: "Hire" },
  transfer: { ar: "نقل", en: "Transfer" },
  promotion: { ar: "ترقية", en: "Promotion" },
  demotion: { ar: "خفض درجة", en: "Demotion" },
  reclassification: { ar: "إعادة تصنيف", en: "Reclassification" },
  suspension: { ar: "إيقاف", en: "Suspension" },
  reinstatement: { ar: "إعادة إلى العمل", en: "Reinstatement" },
  termination: { ar: "إنهاء خدمة", en: "Termination" },
};

/** Reason codes are mandatory — an action without a coded reason is not auditable. */
export const ACTION_REASONS: Record<ActionType, Array<{ id: string; ar: string; en: string }>> = {
  hire: [
    { id: "new_position", ar: "منصب جديد", en: "New position" },
    { id: "replacement", ar: "إحلال", en: "Replacement" },
    { id: "seasonal", ar: "احتياج موسمي", en: "Seasonal need" },
    { id: "saudization", ar: "التزام التوطين", en: "Saudization commitment" },
  ],
  transfer: [
    { id: "operational_need", ar: "حاجة تشغيلية", en: "Operational need" },
    { id: "employee_request", ar: "طلب الموظف", en: "Employee request" },
    { id: "station_opening", ar: "افتتاح فرع", en: "Station opening" },
    { id: "restructure", ar: "إعادة هيكلة", en: "Restructure" },
  ],
  promotion: [
    { id: "performance", ar: "أداء مُثبت", en: "Proven performance" },
    { id: "succession", ar: "إحلال قيادي", en: "Succession" },
    { id: "qualification", ar: "مؤهل أو شهادة جديدة", en: "New qualification" },
  ],
  demotion: [
    { id: "performance_gap", ar: "قصور أداء موثق", en: "Documented performance gap" },
    { id: "restructure", ar: "إعادة هيكلة", en: "Restructure" },
    { id: "employee_request", ar: "طلب الموظف", en: "Employee request" },
  ],
  reclassification: [
    { id: "job_change", ar: "تغيّر محتوى الوظيفة", en: "Job content changed" },
    { id: "grade_review", ar: "مراجعة الدرجات", en: "Grade review" },
  ],
  suspension: [
    { id: "investigation", ar: "تحقيق جارٍ", en: "Investigation in progress" },
    { id: "safety", ar: "إيقاف لدواعي السلامة", en: "Safety stand-down" },
  ],
  reinstatement: [
    { id: "investigation_closed", ar: "انتهاء التحقيق", en: "Investigation closed" },
    { id: "return_from_leave", ar: "عودة من إجازة طويلة", en: "Return from long leave" },
  ],
  termination: [
    { id: "resignation", ar: "استقالة", en: "Resignation" },
    { id: "contract_end", ar: "انتهاء العقد", en: "Contract end" },
    { id: "mutual", ar: "إنهاء بالتراضي", en: "Mutual agreement" },
    { id: "article_80", ar: "المادة 80", en: "Article 80" },
    { id: "article_81", ar: "المادة 81 — ترك مع حفظ الحقوق", en: "Article 81 — leaving with rights" },
    { id: "redundancy", ar: "إلغاء المنصب", en: "Position redundancy" },
    { id: "retirement", ar: "تقاعد", en: "Retirement" },
  ],
};

export const POSITION_REQUIRED_ACTIONS: ActionType[] = ["hire", "transfer", "promotion", "demotion", "reclassification", "reinstatement"];

export type ActionLike = {
  id: string;
  employeeId: string;
  type: ActionType | string;
  positionId?: string | null;
  effectiveDate: string;
  reasonCode: string;
  note?: string | null;
  recordedBy?: string | null;
  recordedByName?: string | null;
  recordedAt?: string | null;
  voidedAt?: string | null;
};

function liveActions(history: ActionLike[]) {
  return (Array.isArray(history) ? history : []).filter((a) => a && !a.voidedAt);
}

export function sortedActions(history: ActionLike[]) {
  return liveActions(history).slice().sort((a, b) => {
    const d = String(a.effectiveDate).localeCompare(String(b.effectiveDate));
    if (d !== 0) return d;
    return String(a.recordedAt || "").localeCompare(String(b.recordedAt || ""));
  });
}

/** The employee's action state on a day — pure replay of the register. */
export function replayEmployeeActions(history: ActionLike[], employeeId: string, onDay: string) {
  const mine = sortedActions(history).filter((a) => a.employeeId === employeeId && String(a.effectiveDate) <= onDay);
  let positionId: string | null = null;
  let status: "not_hired" | "active" | "suspended" | "terminated" = "not_hired";
  let hireDate: string | null = null;
  let lastAction: ActionLike | null = null;
  for (const a of mine) {
    lastAction = a;
    switch (a.type) {
      case "hire":
        status = "active";
        hireDate = hireDate || String(a.effectiveDate);
        positionId = a.positionId || positionId;
        break;
      case "transfer":
      case "promotion":
      case "demotion":
      case "reclassification":
        positionId = a.positionId || positionId;
        if (status === "not_hired") status = "active";
        break;
      case "suspension":
        status = "suspended";
        break;
      case "reinstatement":
        status = "active";
        positionId = a.positionId || positionId;
        break;
      case "termination":
        status = "terminated";
        positionId = null;
        break;
      default:
        break;
    }
  }
  return { positionId, status, hireDate, lastAction, count: mine.length };
}

/** Who holds a position on a day — derived from the register, never stored twice. */
export function positionHolderOn(history: ActionLike[], positionId: string, onDay: string, employeeIds: string[]) {
  for (const employeeId of employeeIds) {
    const state = replayEmployeeActions(history, employeeId, onDay);
    if (state.positionId === positionId && (state.status === "active" || state.status === "suspended")) {
      return { employeeId, status: state.status };
    }
  }
  return null;
}

export function checkEmploymentActionGate(input: {
  type?: string | null;
  employeeId?: string | null;
  positionId?: string | null;
  effectiveDate?: string | null;
  reasonCode?: string | null;
  note?: string | null;
  actorId?: string | null;
  history?: ActionLike[];
  positions?: PositionLike[];
  employeeIds?: string[];
}) {
  const history = liveActions(input.history || []);
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const type = String(input.type || "") as ActionType;
  if (!(ACTION_TYPES as readonly string[]).includes(type)) {
    return { ok: false as const, error: "ACTION_TYPE_INVALID", reason: "نوع الإجراء الوظيفي غير معروف.", reasonEn: "Unknown employment action type." };
  }
  const employeeId = String(input.employeeId || "").trim();
  if (!employeeId) {
    return { ok: false as const, error: "ACTION_EMPLOYEE_REQUIRED", reason: "الموظف المعني مطلوب.", reasonEn: "The subject employee is required." };
  }
  if (input.actorId && String(input.actorId) === employeeId) {
    return {
      ok: false as const,
      error: "SELF_ACTION_FORBIDDEN",
      reason: "فصل المهام: لا يجوز تسجيل إجراء وظيفي على نفسك — يسجّله مسؤول آخر.",
      reasonEn: "Segregation of duties: you cannot record an employment action on yourself — another approver must record it.",
    };
  }
  const effectiveDate = dayKey(input.effectiveDate);
  if (!effectiveDate) {
    return { ok: false as const, error: "EFFECTIVE_DATE_REQUIRED", reason: "تاريخ سريان الإجراء مطلوب.", reasonEn: "The action effective date is required." };
  }
  const reasonCode = String(input.reasonCode || "").trim();
  const allowed = ACTION_REASONS[type] || [];
  if (!reasonCode) {
    return { ok: false as const, error: "ACTION_REASON_REQUIRED", reason: "سبب الإجراء مطلوب — الإجراء بلا سبب مُرمَّز لا يصلح للتدقيق.", reasonEn: "An action reason is required — an action without a coded reason is not auditable." };
  }
  if (!allowed.some((r) => r.id === reasonCode)) {
    return { ok: false as const, error: "ACTION_REASON_INVALID", reason: "سبب الإجراء لا ينتمي لهذا النوع.", reasonEn: "That reason code does not belong to this action type." };
  }

  const state = replayEmployeeActions(history, employeeId, "9999-12-31");
  if (type === "hire" && state.status !== "not_hired") {
    return { ok: false as const, error: "ALREADY_HIRED", reason: "للموظف سجل تعيين قائم — استخدم النقل أو إعادة التعيين بدل التعيين.", reasonEn: "This employee already has a hire record — use transfer or reinstatement instead." };
  }
  if (type !== "hire" && state.status === "not_hired") {
    return { ok: false as const, error: "HIRE_ACTION_MISSING", reason: "سجّل التعيين أولًا — لا إجراء قبل تاريخ المباشرة.", reasonEn: "Record the hire first — no action may precede the start date." };
  }
  if (state.hireDate && effectiveDate < state.hireDate) {
    return { ok: false as const, error: "ACTION_BEFORE_HIRE", reason: `تاريخ السريان قبل تاريخ المباشرة (${state.hireDate}).`, reasonEn: `The effective date precedes the hire date (${state.hireDate}).` };
  }
  if (state.status === "terminated" && type !== "reinstatement" && type !== "hire") {
    return { ok: false as const, error: "EMPLOYMENT_ENDED", reason: "الخدمة منتهية — أعد الموظف إلى العمل قبل أي إجراء آخر.", reasonEn: "Employment has ended — reinstate the employee before any other action." };
  }
  if (type === "termination" && state.status === "terminated") {
    return { ok: false as const, error: "ALREADY_TERMINATED", reason: "الخدمة منتهية بالفعل.", reasonEn: "Employment is already terminated." };
  }

  const positionId = input.positionId ? String(input.positionId) : null;
  if (POSITION_REQUIRED_ACTIONS.includes(type)) {
    if (!positionId) {
      return { ok: false as const, error: "ACTION_POSITION_REQUIRED", reason: "هذا الإجراء يحتاج منصبًا — الشخص يشغل منصبًا، لا مسمى حرًّا.", reasonEn: "This action needs a position — a person fills a position, not a free-text title." };
    }
    const position = positions.find((p) => p.id === positionId);
    if (!position) {
      return { ok: false as const, error: "ACTION_POSITION_NOT_FOUND", reason: "المنصب غير موجود.", reasonEn: "Position not found." };
    }
    if (position.closedAt) {
      return { ok: false as const, error: "POSITION_CLOSED", reason: "المنصب مغلق — أعد فتحه أو اختر منصبًا آخر.", reasonEn: "The position is closed — reopen it or pick another." };
    }
    if (!isEffectiveOn(position, effectiveDate)) {
      return { ok: false as const, error: "POSITION_NOT_EFFECTIVE", reason: `المنصب غير سارٍ في ${effectiveDate}.`, reasonEn: `The position is not effective on ${effectiveDate}.` };
    }
    const others = (input.employeeIds || []).filter((id) => id !== employeeId);
    const holder = positionHolderOn(history, positionId, effectiveDate, others);
    if (holder) {
      return {
        ok: false as const,
        error: "POSITION_ALREADY_FILLED",
        reason: "المنصب مشغول في هذا التاريخ — انقل شاغله أولًا أو أنشئ منصبًا إضافيًا.",
        reasonEn: "The position is filled on that date — move its holder first or create another position.",
      };
    }
  }

  const duplicate = history.some(
    (a) => a.employeeId === employeeId && a.type === type && dayKey(a.effectiveDate) === effectiveDate,
  );
  if (duplicate) {
    return { ok: false as const, error: "ACTION_DUPLICATE", reason: "يوجد إجراء مطابق بالنوع والتاريخ نفسه.", reasonEn: "An identical action already exists on that date." };
  }

  return { ok: true as const, type, employeeId, positionId, effectiveDate, reasonCode, note: String(input.note || "").trim() || null };
}

export type EmployeeLike = {
  employeeId?: string;
  id?: string;
  name?: string;
  role?: string;
  stationId?: string | null;
  position?: string | null;
  profile?: { gradeId?: string | null; position?: string | null } | null;
};

/**
 * Current assignment for one employee. When the register is empty (existing data),
 * a *derived* assignment is produced from role + station so no screen goes blank —
 * it is labelled `derived` and never silently becomes an audited action.
 */
export function deriveEmployeeAssignment(input: {
  employee: EmployeeLike;
  actions: ActionLike[];
  positions: PositionLike[];
  jobs: JobLike[];
  units: OrgUnitLike[];
  onDay?: string;
}) {
  const onDay = input.onDay || todayKey();
  const employeeId = String(input.employee?.employeeId || input.employee?.id || "");
  const state = replayEmployeeActions(input.actions || [], employeeId, onDay);
  const position = state.positionId ? (input.positions || []).find((p) => p.id === state.positionId) || null : null;
  const job = position ? (input.jobs || []).find((j) => j.id === position.jobId) || null : null;
  const unit = position
    ? (input.units || []).find((u) => u.id === position.orgUnitId) || null
    : (input.units || []).find((u) => u.stationId && u.stationId === input.employee?.stationId) || null;
  const cc = deriveCostCenter(input.units || [], unit?.id);
  const est = deriveEstablishment(input.units || [], unit?.id);
  const source = position ? "action" : "derived";
  return {
    employeeId,
    source,
    positionId: position?.id || null,
    positionRef: position?.ref || null,
    jobId: job?.id || null,
    jobCode: job?.code || null,
    jobTitle: job?.title
      || input.employee?.profile?.position
      || input.employee?.position
      || null,
    jobFamily: job?.family || null,
    orgUnitId: unit?.id || null,
    orgUnitName: unit?.name || null,
    orgUnitPath: deriveUnitPath(input.units || [], unit?.id).map((u) => u.name),
    costCenter: cc.costCenter,
    costCenterInherited: cc.inherited,
    establishmentNumber: est.establishmentNumber,
    stationId: position?.stationId || input.employee?.stationId || null,
    fte: position ? clampFte(position.fte) : 1,
    employmentStatus: state.status === "not_hired" ? (source === "derived" ? "active_underived" : "not_hired") : state.status,
    hireDate: state.hireDate,
    lastAction: state.lastAction,
    actionCount: state.count,
    /** Named reason a screen can print instead of pretending the record is complete. */
    gap: position
      ? null
      : {
        error: "NO_POSITION_ASSIGNMENT",
        reason: "لا منصب مُسند — العرض مشتق من الدور والفرع. سجّل إجراء تعيين لإكمال الملف.",
        reasonEn: "No assigned position — this view is derived from role and station. Record a hire action to complete the file.",
      },
  };
}

export function derivePositionBoard(input: {
  positions: PositionLike[];
  jobs: JobLike[];
  units: OrgUnitLike[];
  actions: ActionLike[];
  employees: EmployeeLike[];
  onDay?: string;
}) {
  const onDay = input.onDay || todayKey();
  const employeeIds = (input.employees || []).map((e) => String(e.employeeId || e.id || "")).filter(Boolean);
  const nameById = new Map(
    (input.employees || []).map((e) => [String(e.employeeId || e.id || ""), e.name || ""]),
  );
  return (input.positions || []).map((p) => {
    const job = (input.jobs || []).find((j) => j.id === p.jobId) || null;
    const unit = (input.units || []).find((u) => u.id === p.orgUnitId) || null;
    const holder = positionHolderOn(input.actions || [], p.id, onDay, employeeIds);
    const cc = deriveCostCenter(input.units || [], p.orgUnitId);
    return {
      ...p,
      fte: clampFte(p.fte),
      jobCode: job?.code || null,
      jobTitle: job?.title || null,
      jobFamily: job?.family || null,
      orgUnitName: unit?.name || null,
      orgUnitPath: deriveUnitPath(input.units || [], p.orgUnitId).map((u) => u.name),
      costCenter: cc.costCenter,
      holderId: holder?.employeeId || null,
      holderName: holder ? nameById.get(holder.employeeId) || holder.employeeId : null,
      holderStatus: holder?.status || null,
      vacant: !holder && !p.closedAt,
      closed: !!p.closedAt,
      effective: isEffectiveOn(p, onDay),
    };
  });
}

export function deriveOrgUnitRollup(input: {
  units: OrgUnitLike[];
  positions: PositionLike[];
  actions: ActionLike[];
  employees: EmployeeLike[];
  onDay?: string;
}) {
  const board = derivePositionBoard({ ...input, jobs: [] });
  return (input.units || []).map((u) => {
    const family = descendantUnitIds(input.units || [], u.id);
    const rows = board.filter((p) => family.has(p.orgUnitId) && !p.closed);
    const filled = rows.filter((p) => p.holderId).length;
    const budgetedFte = rows.reduce((n, p) => n + clampFte(p.fte), 0);
    const cc = deriveCostCenter(input.units || [], u.id);
    return {
      id: u.id,
      name: u.name,
      type: u.type,
      parentId: u.parentId || null,
      depth: Math.max(0, deriveUnitPath(input.units || [], u.id).length - 1),
      costCenter: cc.costCenter,
      establishmentNumber: deriveEstablishment(input.units || [], u.id).establishmentNumber,
      positions: rows.length,
      filled,
      vacant: rows.length - filled,
      budgetedFte: Math.round(budgetedFte * 100) / 100,
      fillPct: rows.length ? Math.round((filled / rows.length) * 100) : 0,
    };
  });
}

/* ─────────────────────── performance — objectives from task weight ────────── */

export const OBJECTIVE_SOURCES = ["task", "ontime", "hse", "cover"] as const;
export type ObjectiveSource = (typeof OBJECTIVE_SOURCES)[number];

export const WORK_KINDS = ["gn", "ad", "of", "tr", "pm", "cm", "em", "pr", "cp"] as const;

export const WORK_KIND_LABELS: Record<string, { ar: string; en: string }> = {
  gn: { ar: "عام", en: "General" },
  ad: { ar: "إداري", en: "Administrative" },
  of: { ar: "مكتبي / تنسيقي", en: "Office / coordination" },
  tr: { ar: "تدريب / تطوير", en: "Training / development" },
  pm: { ar: "صيانة وقائية", en: "Preventive maintenance" },
  cm: { ar: "صيانة تصحيحية", en: "Corrective maintenance" },
  em: { ar: "طارئ", en: "Emergency" },
  pr: { ar: "مشروع", en: "Project" },
  cp: { ar: "امتثال", en: "Compliance" },
};

export type ObjectiveLike = {
  id: string;
  title: string;
  titleEn?: string | null;
  source: ObjectiveSource | string;
  weight: number;
  /** Only for source `task` — empty means every work kind counts. */
  workKinds?: string[];
  /** Optional absolute target in task points; when absent the peer benchmark is used.
   *  Accepts the empty string a form field produces before it is cleaned server-side. */
  targetPoints?: number | string | null;
};

/**
 * Default plan — identical in weight to the company formula, so a job with no
 * custom plan scores the same way it does today. Customising a plan redistributes
 * the same 100 points; it never adds a new way to earn credit.
 */
export const DEFAULT_OBJECTIVES: ObjectiveLike[] = [
  { id: "obj_task", title: "وزن المهام المعتمدة", titleEn: "Approved task weight", source: "task", weight: 50, workKinds: [] },
  { id: "obj_ontime", title: "الالتزام بالموعد", titleEn: "On-time delivery", source: "ontime", weight: 25 },
  { id: "obj_hse", title: "السلامة", titleEn: "Safety", source: "hse", weight: 15 },
  { id: "obj_cover", title: "تغطية الورديات", titleEn: "Shift coverage", source: "cover", weight: 10 },
];

export function objectiveWeightTotal(objectives: ObjectiveLike[]) {
  return (Array.isArray(objectives) ? objectives : []).reduce((n, o) => n + (Number(o.weight) || 0), 0);
}

export function checkGoalPlanGate(input: { jobId?: string | null; objectives?: ObjectiveLike[]; jobs?: JobLike[] }) {
  const jobId = String(input.jobId || "");
  if (!jobId || (Array.isArray(input.jobs) && input.jobs.length && !input.jobs.some((j) => j.id === jobId))) {
    return { ok: false as const, error: "GOAL_PLAN_JOB_NOT_FOUND", reason: "خطة الأهداف تُربط بوظيفة من الكتالوج.", reasonEn: "A goal plan is attached to a job from the catalogue." };
  }
  const objectives = Array.isArray(input.objectives) ? input.objectives : [];
  if (!objectives.length) {
    return { ok: false as const, error: "GOAL_PLAN_EMPTY", reason: "أضف هدفًا واحدًا على الأقل.", reasonEn: "Add at least one objective." };
  }
  for (const o of objectives) {
    if (!String(o.title || "").trim()) {
      return { ok: false as const, error: "OBJECTIVE_TITLE_REQUIRED", reason: "كل هدف يحتاج عنوانًا.", reasonEn: "Every objective needs a title." };
    }
    if (!(OBJECTIVE_SOURCES as readonly string[]).includes(String(o.source))) {
      return { ok: false as const, error: "OBJECTIVE_SOURCE_INVALID", reason: "مصدر الهدف غير معروف — المصادر المسموحة: وزن المهام، الالتزام بالموعد، السلامة، التغطية.", reasonEn: "Unknown objective source — allowed: task weight, on-time, safety, coverage." };
    }
    const weight = Number(o.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
      return { ok: false as const, error: "OBJECTIVE_WEIGHT_INVALID", reason: "وزن الهدف يجب أن يكون بين 1 و 100.", reasonEn: "Objective weight must be between 1 and 100." };
    }
    if (String(o.source) === "task" && Array.isArray(o.workKinds) && o.workKinds.some((k) => !(WORK_KINDS as readonly string[]).includes(String(k)))) {
      return { ok: false as const, error: "OBJECTIVE_WORK_KIND_INVALID", reason: "نوع عمل غير معروف في الهدف.", reasonEn: "Unknown work kind on the objective." };
    }
    if (o.targetPoints != null && o.targetPoints !== "" && (!Number.isFinite(Number(o.targetPoints)) || Number(o.targetPoints) < 0)) {
      return { ok: false as const, error: "OBJECTIVE_TARGET_INVALID", reason: "هدف النقاط يجب أن يكون رقمًا موجبًا.", reasonEn: "The points target must be a positive number." };
    }
  }
  const taskWeight = objectives
    .filter((o) => String(o.source) === "task")
    .reduce((n, o) => n + (Number(o.weight) || 0), 0);
  if (taskWeight < 40) {
    return {
      ok: false as const,
      error: "TASK_WEIGHT_FLOOR",
      reason: `وزن المهام المعتمدة لا يقل عن 40% من الخطة — وهو جوهر المنصة (الحالي ${taskWeight}%).`,
      reasonEn: `Approved task weight may not fall below 40% of a plan — it is the core of the platform (currently ${taskWeight}%).`,
    };
  }
  const total = objectiveWeightTotal(objectives);
  if (total !== 100) {
    return {
      ok: false as const,
      error: "OBJECTIVE_WEIGHTS_MUST_TOTAL_100",
      reason: `مجموع أوزان الأهداف يجب أن يساوي 100% — المجموع الحالي ${total}%.`,
      reasonEn: `Objective weights must total 100% — current total is ${total}%.`,
    };
  }
  return { ok: true as const, jobId, objectives, total };
}

export type TaskLike = {
  id?: string;
  ref?: string;
  title?: string;
  ownerId?: string | null;
  memberIds?: string[];
  assignMode?: string;
  stationId?: string | null;
  workKind?: string;
  priority?: string;
  effortWeight?: number;
  dueAt?: string | null;
  status?: string;
  approvedAt?: string | null;
  pointsAwarded?: number | null;
};

export function taskBelongsTo(task: TaskLike, employeeId: string, stationId?: string | null) {
  if (!task) return false;
  if (task.ownerId && task.ownerId === employeeId) return true;
  if (Array.isArray(task.memberIds) && task.memberIds.includes(employeeId)) return true;
  if (task.assignMode === "all" && (!task.stationId || task.stationId === stationId)) return true;
  return false;
}

export function taskIsProven(task: TaskLike) {
  return !!task.approvedAt || task.status === "completed";
}

/** Weight of one proven task — priority × effort, exactly as operations awards it. */
export function provenTaskWeight(task: TaskLike) {
  const stored = Number(task.pointsAwarded);
  return Number.isFinite(stored) && stored > 0 ? stored : taskPoints(task.priority, task.effortWeight);
}

export function taskMatchesObjective(task: TaskLike, objective: ObjectiveLike) {
  const kinds = Array.isArray(objective.workKinds) ? objective.workKinds.filter(Boolean) : [];
  if (!kinds.length) return true;
  return kinds.includes(String(task.workKind || ""));
}

export function withinPeriod(task: TaskLike, period?: { from?: string | null; to?: string | null } | null) {
  if (!period) return true;
  const day = dayKey(task.approvedAt) || dayKey(task.dueAt);
  if (!day) return true;
  if (period.from && day < String(period.from)) return false;
  if (period.to && day > String(period.to)) return false;
  return true;
}

/** Facts about one employee's proven work — the only ledger objectives may read. */
export function deriveEmployeeTaskFacts(input: {
  tasks: TaskLike[];
  employeeId: string;
  stationId?: string | null;
  period?: { from?: string | null; to?: string | null } | null;
}) {
  const mine = (Array.isArray(input.tasks) ? input.tasks : []).filter(
    (t) => taskBelongsTo(t, input.employeeId, input.stationId) && withinPeriod(t, input.period),
  );
  const proven = mine.filter(taskIsProven);
  const points = proven.reduce((n, t) => n + provenTaskWeight(t), 0);
  const byKind: Record<string, number> = {};
  for (const t of proven) {
    const kind = String(t.workKind || "gn");
    byKind[kind] = (byKind[kind] || 0) + provenTaskWeight(t);
  }
  const ontimePct = proven.length
    ? Math.round(
      (proven.filter((t) => {
        if (!t.dueAt || !t.approvedAt) return true;
        return String(t.approvedAt).slice(0, 10) <= String(t.dueAt).slice(0, 10);
      }).length / proven.length) * 100,
    )
    : 0;
  return { assigned: mine.length, proven: proven.length, points, byKind, ontimePct, provenTasks: proven };
}

export function objectiveEarnedPoints(objective: ObjectiveLike, facts: { provenTasks: TaskLike[] }) {
  return facts.provenTasks
    .filter((t) => taskMatchesObjective(t, objective))
    .reduce((n, t) => n + provenTaskWeight(t), 0);
}

/**
 * Attainment of one objective — 0–100.
 * `task` objectives divide proven weight by the objective target; when no absolute
 * target is set the peer benchmark (highest proven weight among peers) is the
 * denominator, which is exactly how the existing board ranks people today.
 */
export function deriveObjectiveAttainment(input: {
  objective: ObjectiveLike;
  facts: { provenTasks: TaskLike[]; points: number; ontimePct: number };
  peerBenchmark?: number;
  ontimePct?: number;
  hsePct?: number;
  coverPct?: number;
}) {
  const o = input.objective;
  const source = String(o.source);
  if (source === "task") {
    const earned = objectiveEarnedPoints(o, input.facts);
    const explicit = o.targetPoints != null && o.targetPoints !== "" ? Number(o.targetPoints) : null;
    const target = Math.max(1, explicit != null && explicit > 0 ? explicit : Number(input.peerBenchmark) || 1);
    const attainmentPct = Math.min(100, Math.round((earned / target) * 100));
    return {
      objectiveId: o.id,
      source,
      weight: Number(o.weight) || 0,
      earned,
      target,
      targetKind: explicit != null && explicit > 0 ? ("absolute" as const) : ("peer" as const),
      attainmentPct,
      contribution: Math.round(attainmentPct * ((Number(o.weight) || 0) / 100)),
      provenCount: input.facts.provenTasks.filter((t) => taskMatchesObjective(t, o)).length,
    };
  }
  const raw = source === "ontime"
    ? Number(input.ontimePct ?? input.facts.ontimePct) || 0
    : source === "hse"
      ? Number(input.hsePct) || 0
      : Number(input.coverPct) || 0;
  const attainmentPct = Math.min(100, Math.max(0, Math.round(raw)));
  return {
    objectiveId: o.id,
    source,
    weight: Number(o.weight) || 0,
    earned: attainmentPct,
    target: 100,
    targetKind: "rate" as const,
    attainmentPct,
    contribution: Math.round(attainmentPct * ((Number(o.weight) || 0) / 100)),
    provenCount: 0,
  };
}

export function deriveGoalAttainment(input: {
  objectives: ObjectiveLike[];
  facts: { provenTasks: TaskLike[]; points: number; ontimePct: number };
  peerBenchmark?: number;
  hsePct?: number;
  coverPct?: number;
}) {
  const objectives = Array.isArray(input.objectives) && input.objectives.length ? input.objectives : DEFAULT_OBJECTIVES;
  const rows = objectives.map((o) =>
    deriveObjectiveAttainment({
      objective: o,
      facts: input.facts,
      peerBenchmark: input.peerBenchmark,
      hsePct: input.hsePct,
      coverPct: input.coverPct,
    }),
  );
  const total = objectiveWeightTotal(objectives) || 100;
  const weighted = rows.reduce((n, r) => n + r.attainmentPct * (r.weight / total), 0);
  return { rows, score: Math.round(weighted), weightTotal: total };
}

/** Board across peers — the peer benchmark is the same denominator for everyone. */
export function deriveObjectiveBoard(input: {
  employees: Array<EmployeeLike & { hsePct?: number; coverPct?: number }>;
  tasks: TaskLike[];
  planFor: (employee: EmployeeLike) => { jobId: string | null; objectives: ObjectiveLike[]; custom: boolean };
  period?: { from?: string | null; to?: string | null } | null;
}) {
  const people = Array.isArray(input.employees) ? input.employees : [];
  const factsById = new Map<string, ReturnType<typeof deriveEmployeeTaskFacts>>();
  for (const e of people) {
    const id = String(e.employeeId || e.id || "");
    factsById.set(id, deriveEmployeeTaskFacts({ tasks: input.tasks, employeeId: id, stationId: e.stationId, period: input.period }));
  }
  const peerBenchmark = Math.max(1, ...[...factsById.values()].map((f) => f.points), 1);
  const rows = people.map((e) => {
    const id = String(e.employeeId || e.id || "");
    const facts = factsById.get(id)!;
    const plan = input.planFor(e);
    const attainment = deriveGoalAttainment({
      objectives: plan.objectives,
      facts,
      peerBenchmark,
      hsePct: Number(e.hsePct) || 0,
      coverPct: Number(e.coverPct) || 0,
    });
    return {
      employeeId: id,
      name: e.name || id,
      stationId: e.stationId || null,
      jobId: plan.jobId,
      planCustom: plan.custom,
      points: facts.points,
      provenTasks: facts.proven,
      assignedTasks: facts.assigned,
      ontimePct: facts.ontimePct,
      objectives: attainment.rows,
      score: attainment.score,
      peerBenchmark,
    };
  });
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Blend used for the `hse` objective — same 70/30 rule as the company formula. */
export function hseObjectivePct(closurePct: number, reportPct: number) {
  return blendHseTerm(closurePct, reportPct);
}

/* ───────────────────────────── review cycles ──────────────────────────────── */

export const CYCLE_STATUSES = ["draft", "open", "manager_review", "calibration", "closed"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const CYCLE_STATUS_LABELS: Record<CycleStatus, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  open: { ar: "مفتوحة", en: "Open" },
  manager_review: { ar: "مراجعة المدير", en: "Manager review" },
  calibration: { ar: "معايرة", en: "Calibration" },
  closed: { ar: "مقفلة", en: "Closed" },
};

export const CYCLE_FLOW: Record<CycleStatus, CycleStatus[]> = {
  draft: ["open"],
  open: ["manager_review"],
  manager_review: ["calibration", "closed"],
  calibration: ["closed"],
  closed: [],
};

/** Manager judgement may move the derived score only inside this band. */
export const CALIBRATION_BAND = 10;
export const RATING_JUSTIFICATION_MIN = 20;

export type CycleLike = {
  id: string;
  period: string;
  from: string;
  to: string;
  status: CycleStatus | string;
  openedBy?: string | null;
  closedAt?: string | null;
};

export function checkCreateCycleGate(input: { period?: string | null; from?: string | null; to?: string | null; cycles?: CycleLike[] }) {
  const period = String(input.period || "").trim();
  if (!/^\d{4}-(Q[1-4]|H[12]|\d{2})$/.test(period)) {
    return { ok: false as const, error: "CYCLE_PERIOD_INVALID", reason: "صيغة الدورة مثل 2026-Q3 أو 2026-08.", reasonEn: "Use a period such as 2026-Q3 or 2026-08." };
  }
  const from = dayKey(input.from);
  const to = dayKey(input.to);
  if (!from || !to) {
    return { ok: false as const, error: "CYCLE_RANGE_REQUIRED", reason: "بداية ونهاية الدورة مطلوبتان.", reasonEn: "Cycle start and end dates are required." };
  }
  if (from > to) {
    return { ok: false as const, error: "CYCLE_RANGE_INVALID", reason: "بداية الدورة بعد نهايتها.", reasonEn: "The cycle starts after it ends." };
  }
  const cycles = Array.isArray(input.cycles) ? input.cycles : [];
  if (cycles.some((c) => c.period === period)) {
    return { ok: false as const, error: "CYCLE_DUPLICATE", reason: `دورة ${period} موجودة بالفعل.`, reasonEn: `Cycle ${period} already exists.` };
  }
  const overlap = cycles.find((c) => String(c.status) !== "closed" && from <= String(c.to) && to >= String(c.from));
  if (overlap) {
    return { ok: false as const, error: "CYCLE_OVERLAP", reason: `تتداخل مع دورة ${overlap.period} المفتوحة — أقفلها أولًا.`, reasonEn: `Overlaps the open ${overlap.period} cycle — close it first.` };
  }
  return { ok: true as const, period, from, to };
}

export function checkCycleTransitionGate(current: string, next: string) {
  const from = String(current) as CycleStatus;
  const to = String(next) as CycleStatus;
  if (!(CYCLE_STATUSES as readonly string[]).includes(to)) {
    return { ok: false as const, error: "CYCLE_STATUS_INVALID", reason: "حالة الدورة غير معروفة.", reasonEn: "Unknown cycle status." };
  }
  if (!(CYCLE_FLOW[from] || []).includes(to)) {
    return {
      ok: false as const,
      error: "CYCLE_TRANSITION_FORBIDDEN",
      reason: `لا يمكن الانتقال من «${CYCLE_STATUS_LABELS[from]?.ar || from}» إلى «${CYCLE_STATUS_LABELS[to]?.ar || to}».`,
      reasonEn: `Cannot move from "${CYCLE_STATUS_LABELS[from]?.en || from}" to "${CYCLE_STATUS_LABELS[to]?.en || to}".`,
    };
  }
  return { ok: true as const, status: to };
}

/**
 * A manager rating is a *calibration* of the derived score, never a replacement:
 * it must stay inside the band and carry a written justification.
 */
export function checkManagerRatingGate(input: {
  cycle?: CycleLike | null;
  derivedScore?: unknown;
  rating?: unknown;
  justification?: string | null;
  actorId?: string | null;
  employeeId?: string | null;
  band?: number;
}) {
  const cycle = input.cycle;
  if (!cycle) {
    return { ok: false as const, error: "CYCLE_NOT_FOUND", reason: "لا دورة تقييم مفتوحة.", reasonEn: "No review cycle found." };
  }
  if (!["manager_review", "calibration"].includes(String(cycle.status))) {
    return {
      ok: false as const,
      error: "CYCLE_NOT_IN_REVIEW",
      reason: "الدورة ليست في مرحلة مراجعة المدير أو المعايرة.",
      reasonEn: "The cycle is not in manager review or calibration.",
    };
  }
  if (input.actorId && input.employeeId && String(input.actorId) === String(input.employeeId)) {
    return {
      ok: false as const,
      error: "SELF_RATING_FORBIDDEN",
      reason: "فصل المهام: لا يُقيّم أحد نفسه.",
      reasonEn: "Segregation of duties: nobody rates themselves.",
    };
  }
  const derived = Number(input.derivedScore);
  if (!Number.isFinite(derived)) {
    return { ok: false as const, error: "DERIVED_SCORE_MISSING", reason: "الدرجة المشتقة غير متاحة — لا تقييم بلا إثبات.", reasonEn: "The derived score is unavailable — no rating without evidence." };
  }
  const rating = Number(input.rating);
  if (!Number.isFinite(rating) || rating < 0 || rating > 100) {
    return { ok: false as const, error: "RATING_INVALID", reason: "التقييم يجب أن يكون بين 0 و 100.", reasonEn: "A rating must be between 0 and 100." };
  }
  const band = Number.isFinite(Number(input.band)) ? Number(input.band) : CALIBRATION_BAND;
  const low = Math.max(0, derived - band);
  const high = Math.min(100, derived + band);
  if (rating < low || rating > high) {
    return {
      ok: false as const,
      error: "RATING_OUT_OF_BAND",
      reason: `التقييم خارج نطاق المعايرة — المسموح ${low}–${high} حول الدرجة المشتقة ${derived}.`,
      reasonEn: `Rating is outside the calibration band — allowed ${low}–${high} around the derived score ${derived}.`,
      band: { low, high, derived },
    };
  }
  const justification = String(input.justification || "").trim();
  if (rating !== Math.round(derived) && justification.length < RATING_JUSTIFICATION_MIN) {
    return {
      ok: false as const,
      error: "RATING_JUSTIFICATION_REQUIRED",
      reason: `تعديل الدرجة المشتقة يحتاج مبررًا مكتوبًا لا يقل عن ${RATING_JUSTIFICATION_MIN} حرفًا.`,
      reasonEn: `Adjusting the derived score needs a written justification of at least ${RATING_JUSTIFICATION_MIN} characters.`,
    };
  }
  return { ok: true as const, rating: Math.round(rating), derived: Math.round(derived), justification: justification || null, band: { low, high } };
}

export function deriveCycleProgress(input: { cycle?: CycleLike | null; board: Array<{ employeeId: string }>; ratings: Array<{ employeeId: string; cycleId: string }> }) {
  const cycleId = input.cycle?.id || null;
  const rated = new Set(
    (input.ratings || []).filter((r) => !cycleId || r.cycleId === cycleId).map((r) => r.employeeId),
  );
  const total = (input.board || []).length;
  const done = (input.board || []).filter((r) => rated.has(r.employeeId)).length;
  return {
    total,
    rated: done,
    pending: Math.max(0, total - done),
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}
