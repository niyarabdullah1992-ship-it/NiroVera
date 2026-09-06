/** Client mirror of base44/shared/hcmDerivations.ts
 *  Org units · jobs · positions · employment actions · job-weighted objectives · review cycles.
 *  Performance credit is earned only by approved task weight — mirrored rule, mirrored reasons.
 */

import { taskPoints } from "./opsDerivations.js";
import { blendHseTerm } from "./perfDerivations.js";

/* ───────────────────────────── effective dating ───────────────────────────── */

export function dayKey(value) {
  const raw = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isEffectiveOn(row, onDay) {
  const from = dayKey(row?.effectiveFrom);
  const to = dayKey(row?.effectiveTo);
  if (from && onDay < from) return false;
  if (to && onDay > to) return false;
  return true;
}

export function activeAsOf(rows, onDay) {
  return (Array.isArray(rows) ? rows : []).filter((r) => isEffectiveOn(r, onDay));
}

/* ───────────────────────────────── org units ──────────────────────────────── */

export const ORG_UNIT_TYPES = ["company", "division", "department", "section", "station"];

export const ORG_UNIT_LABELS = {
  company: { ar: "الشركة", en: "Company" },
  division: { ar: "قطاع", en: "Division" },
  department: { ar: "إدارة", en: "Department" },
  section: { ar: "قسم", en: "Section" },
  station: { ar: "فرع", en: "Station" },
};

export function unitWouldCycle(units, unitId, parentId) {
  if (!parentId) return false;
  if (parentId === unitId) return true;
  const byId = new Map(units.map((u) => [u.id, u]));
  const seen = new Set();
  let cursor = byId.get(parentId);
  while (cursor) {
    if (cursor.id === unitId) return true;
    if (seen.has(cursor.id)) return true;
    seen.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return false;
}

export function checkEstablishmentNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true, value: null };
  if (!/^\d{6,12}$/.test(raw)) {
    return {
      ok: false,
      error: "ESTABLISHMENT_NUMBER_INVALID",
      reason: "رقم المنشأة في وزارة الموارد البشرية يجب أن يكون من 6 إلى 12 رقمًا — لا يوجد تحقق حكومي مباشر، الصيغة فقط.",
      reasonEn: "The MHRSD establishment number must be 6–12 digits — format only, no live government check.",
    };
  }
  return { ok: true, value: raw };
}

export function checkCreateOrgUnitGate(input) {
  const units = Array.isArray(input.units) ? input.units : [];
  const name = String(input.name || "").trim();
  if (!name) {
    return { ok: false, error: "ORG_UNIT_NAME_REQUIRED", reason: "اسم الوحدة التنظيمية مطلوب.", reasonEn: "Organization unit name is required." };
  }
  const type = String(input.type || "");
  if (!ORG_UNIT_TYPES.includes(type)) {
    return { ok: false, error: "ORG_UNIT_TYPE_INVALID", reason: "نوع الوحدة غير معروف — اختر قطاعًا أو إدارة أو قسمًا أو فرع.", reasonEn: "Unknown unit type — pick division, department, section or station." };
  }
  const parentId = input.parentId ? String(input.parentId) : null;
  if (parentId && !units.some((u) => u.id === parentId)) {
    return { ok: false, error: "ORG_UNIT_PARENT_NOT_FOUND", reason: "الوحدة الأعلى غير موجودة.", reasonEn: "Parent unit not found." };
  }
  if (input.id && unitWouldCycle(units, String(input.id), parentId)) {
    return { ok: false, error: "ORG_UNIT_CYCLE_FORBIDDEN", reason: "لا يمكن جعل الوحدة تابعة لنفسها أو لفرعٍ منها.", reasonEn: "A unit cannot be placed under itself or one of its descendants." };
  }
  const effectiveFrom = dayKey(input.effectiveFrom);
  if (!effectiveFrom) {
    return { ok: false, error: "EFFECTIVE_DATE_REQUIRED", reason: "تاريخ السريان مطلوب — كل سجل تنظيمي مؤرَّخ.", reasonEn: "An effective date is required — every organization record is date-tracked." };
  }
  const est = checkEstablishmentNumber(input.establishmentNumber);
  if (!est.ok) {
    return { ok: false, error: est.error, reason: est.reason, reasonEn: est.reasonEn };
  }
  return {
    ok: true,
    name,
    type,
    parentId,
    effectiveFrom,
    costCenter: String(input.costCenter || "").trim() || null,
    establishmentNumber: est.value,
  };
}

export function deriveUnitPath(units, unitId) {
  if (!unitId) return [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const path = [];
  const seen = new Set();
  let cursor = byId.get(unitId);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return path;
}

export function deriveCostCenter(units, unitId) {
  const path = deriveUnitPath(units, unitId);
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (path[i].costCenter) return { costCenter: path[i].costCenter, fromUnitId: path[i].id, inherited: i !== path.length - 1 };
  }
  return { costCenter: null, fromUnitId: null, inherited: false };
}

export function deriveEstablishment(units, unitId) {
  const path = deriveUnitPath(units, unitId);
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (path[i].establishmentNumber) return { establishmentNumber: path[i].establishmentNumber, fromUnitId: path[i].id };
  }
  return { establishmentNumber: null, fromUnitId: null };
}

export function descendantUnitIds(units, unitId) {
  const out = new Set([unitId]);
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

export const JOB_FAMILIES = ["operations", "maintenance", "hse", "engineering", "admin", "finance", "hr", "commercial"];

export const JOB_FAMILY_LABELS = {
  operations: { ar: "التشغيل", en: "Operations" },
  maintenance: { ar: "الصيانة", en: "Maintenance" },
  hse: { ar: "السلامة", en: "HSE" },
  engineering: { ar: "الهندسة", en: "Engineering" },
  admin: { ar: "الإدارة", en: "Administration" },
  finance: { ar: "المالية", en: "Finance" },
  hr: { ar: "الموارد البشرية", en: "Human resources" },
  commercial: { ar: "التجاري", en: "Commercial" },
};

export function checkCreateJobGate(input) {
  const jobs = Array.isArray(input.jobs) ? input.jobs : [];
  const code = String(input.code || "").trim().toUpperCase();
  if (!code) {
    return { ok: false, error: "JOB_CODE_REQUIRED", reason: "رمز الوظيفة مطلوب — هو المفتاح الذي تُبنى عليه المناصب والأهداف.", reasonEn: "A job code is required — positions and objectives are keyed to it." };
  }
  if (jobs.some((j) => String(j.code || "").toUpperCase() === code)) {
    return { ok: false, error: "JOB_CODE_DUPLICATE", reason: `رمز الوظيفة «${code}» مستخدم بالفعل.`, reasonEn: `Job code «${code}» is already in use.` };
  }
  const title = String(input.title || "").trim();
  if (!title) {
    return { ok: false, error: "JOB_TITLE_REQUIRED", reason: "المسمى الوظيفي مطلوب.", reasonEn: "Job title is required." };
  }
  const family = String(input.family || "");
  if (!JOB_FAMILIES.includes(family)) {
    return { ok: false, error: "JOB_FAMILY_INVALID", reason: "عائلة الوظيفة غير معروفة.", reasonEn: "Unknown job family." };
  }
  const gradeMin = input.gradeMin == null || input.gradeMin === "" ? null : Number(input.gradeMin);
  const gradeMax = input.gradeMax == null || input.gradeMax === "" ? null : Number(input.gradeMax);
  if ((gradeMin != null && !Number.isFinite(gradeMin)) || (gradeMax != null && !Number.isFinite(gradeMax))) {
    return { ok: false, error: "JOB_GRADE_BAND_INVALID", reason: "نطاق الدرجة يجب أن يكون رقمًا.", reasonEn: "The grade band must be numeric." };
  }
  if (gradeMin != null && gradeMax != null && gradeMin > gradeMax) {
    return { ok: false, error: "JOB_GRADE_BAND_INVALID", reason: "أدنى درجة أكبر من أعلى درجة.", reasonEn: "Minimum grade is above maximum grade." };
  }
  return { ok: true, code, title, family, gradeMin, gradeMax };
}

/* ──────────────────────────── position management ─────────────────────────── */

export function clampFte(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0.1, Math.round(n * 100) / 100));
}

export function checkCreatePositionGate(input) {
  const jobs = Array.isArray(input.jobs) ? input.jobs : [];
  const units = Array.isArray(input.units) ? input.units : [];
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const jobId = String(input.jobId || "");
  if (!jobId || !jobs.some((j) => j.id === jobId)) {
    return { ok: false, error: "POSITION_JOB_NOT_FOUND", reason: "المنصب يحتاج وظيفة من الكتالوج — أنشئ الوظيفة أولًا.", reasonEn: "A position needs a job from the catalogue — create the job first." };
  }
  const orgUnitId = String(input.orgUnitId || "");
  if (!orgUnitId || !units.some((u) => u.id === orgUnitId)) {
    return { ok: false, error: "POSITION_ORG_UNIT_NOT_FOUND", reason: "المنصب يحتاج وحدة تنظيمية قائمة.", reasonEn: "A position needs an existing organization unit." };
  }
  const rawFte = input.fte == null || input.fte === "" ? 1 : Number(input.fte);
  if (!Number.isFinite(rawFte) || rawFte < 0.1 || rawFte > 1) {
    return { ok: false, error: "POSITION_FTE_INVALID", reason: "نسبة الدوام يجب أن تكون بين 0.1 و 1.", reasonEn: "FTE must be between 0.1 and 1." };
  }
  const effectiveFrom = dayKey(input.effectiveFrom);
  if (!effectiveFrom) {
    return { ok: false, error: "EFFECTIVE_DATE_REQUIRED", reason: "تاريخ سريان المنصب مطلوب.", reasonEn: "The position effective date is required." };
  }
  const reportsToPositionId = input.reportsToPositionId ? String(input.reportsToPositionId) : null;
  if (reportsToPositionId && !positions.some((p) => p.id === reportsToPositionId)) {
    return { ok: false, error: "POSITION_PARENT_NOT_FOUND", reason: "المنصب الأعلى غير موجود.", reasonEn: "The reporting position was not found." };
  }
  return { ok: true, jobId, orgUnitId, fte: clampFte(rawFte), effectiveFrom, reportsToPositionId };
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
];

export const ACTION_LABELS = {
  hire: { ar: "تعيين", en: "Hire" },
  transfer: { ar: "نقل", en: "Transfer" },
  promotion: { ar: "ترقية", en: "Promotion" },
  demotion: { ar: "خفض درجة", en: "Demotion" },
  reclassification: { ar: "إعادة تصنيف", en: "Reclassification" },
  suspension: { ar: "إيقاف", en: "Suspension" },
  reinstatement: { ar: "إعادة إلى العمل", en: "Reinstatement" },
  termination: { ar: "إنهاء خدمة", en: "Termination" },
};

export const ACTION_REASONS = {
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

export const POSITION_REQUIRED_ACTIONS = ["hire", "transfer", "promotion", "demotion", "reclassification", "reinstatement"];

function liveActions(history) {
  return (Array.isArray(history) ? history : []).filter((a) => a && !a.voidedAt);
}

export function sortedActions(history) {
  return liveActions(history).slice().sort((a, b) => {
    const d = String(a.effectiveDate).localeCompare(String(b.effectiveDate));
    if (d !== 0) return d;
    return String(a.recordedAt || "").localeCompare(String(b.recordedAt || ""));
  });
}

export function replayEmployeeActions(history, employeeId, onDay) {
  const mine = sortedActions(history).filter((a) => a.employeeId === employeeId && String(a.effectiveDate) <= onDay);
  let positionId = null;
  let status = "not_hired";
  let hireDate = null;
  let lastAction = null;
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

export function positionHolderOn(history, positionId, onDay, employeeIds) {
  for (const employeeId of employeeIds) {
    const state = replayEmployeeActions(history, employeeId, onDay);
    if (state.positionId === positionId && (state.status === "active" || state.status === "suspended")) {
      return { employeeId, status: state.status };
    }
  }
  return null;
}

export function checkEmploymentActionGate(input) {
  const history = liveActions(input.history || []);
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const type = String(input.type || "");
  if (!ACTION_TYPES.includes(type)) {
    return { ok: false, error: "ACTION_TYPE_INVALID", reason: "نوع الإجراء الوظيفي غير معروف.", reasonEn: "Unknown employment action type." };
  }
  const employeeId = String(input.employeeId || "").trim();
  if (!employeeId) {
    return { ok: false, error: "ACTION_EMPLOYEE_REQUIRED", reason: "الموظف المعني مطلوب.", reasonEn: "The subject employee is required." };
  }
  if (input.actorId && String(input.actorId) === employeeId) {
    return {
      ok: false,
      error: "SELF_ACTION_FORBIDDEN",
      reason: "فصل المهام: لا يجوز تسجيل إجراء وظيفي على نفسك — يسجّله مسؤول آخر.",
      reasonEn: "Segregation of duties: you cannot record an employment action on yourself — another approver must record it.",
    };
  }
  const effectiveDate = dayKey(input.effectiveDate);
  if (!effectiveDate) {
    return { ok: false, error: "EFFECTIVE_DATE_REQUIRED", reason: "تاريخ سريان الإجراء مطلوب.", reasonEn: "The action effective date is required." };
  }
  const reasonCode = String(input.reasonCode || "").trim();
  const allowed = ACTION_REASONS[type] || [];
  if (!reasonCode) {
    return { ok: false, error: "ACTION_REASON_REQUIRED", reason: "سبب الإجراء مطلوب — الإجراء بلا سبب مُرمَّز لا يصلح للتدقيق.", reasonEn: "An action reason is required — an action without a coded reason is not auditable." };
  }
  if (!allowed.some((r) => r.id === reasonCode)) {
    return { ok: false, error: "ACTION_REASON_INVALID", reason: "سبب الإجراء لا ينتمي لهذا النوع.", reasonEn: "That reason code does not belong to this action type." };
  }

  const state = replayEmployeeActions(history, employeeId, "9999-12-31");
  if (type === "hire" && state.status !== "not_hired") {
    return { ok: false, error: "ALREADY_HIRED", reason: "للموظف سجل تعيين قائم — استخدم النقل أو إعادة التعيين بدل التعيين.", reasonEn: "This employee already has a hire record — use transfer or reinstatement instead." };
  }
  if (type !== "hire" && state.status === "not_hired") {
    return { ok: false, error: "HIRE_ACTION_MISSING", reason: "سجّل التعيين أولًا — لا إجراء قبل تاريخ المباشرة.", reasonEn: "Record the hire first — no action may precede the start date." };
  }
  if (state.hireDate && effectiveDate < state.hireDate) {
    return { ok: false, error: "ACTION_BEFORE_HIRE", reason: `تاريخ السريان قبل تاريخ المباشرة (${state.hireDate}).`, reasonEn: `The effective date precedes the hire date (${state.hireDate}).` };
  }
  if (state.status === "terminated" && type !== "reinstatement" && type !== "hire") {
    return { ok: false, error: "EMPLOYMENT_ENDED", reason: "الخدمة منتهية — أعد الموظف إلى العمل قبل أي إجراء آخر.", reasonEn: "Employment has ended — reinstate the employee before any other action." };
  }
  if (type === "termination" && state.status === "terminated") {
    return { ok: false, error: "ALREADY_TERMINATED", reason: "الخدمة منتهية بالفعل.", reasonEn: "Employment is already terminated." };
  }

  const positionId = input.positionId ? String(input.positionId) : null;
  if (POSITION_REQUIRED_ACTIONS.includes(type)) {
    if (!positionId) {
      return { ok: false, error: "ACTION_POSITION_REQUIRED", reason: "هذا الإجراء يحتاج منصبًا — الشخص يشغل منصبًا، لا مسمى حرًّا.", reasonEn: "This action needs a position — a person fills a position, not a free-text title." };
    }
    const position = positions.find((p) => p.id === positionId);
    if (!position) {
      return { ok: false, error: "ACTION_POSITION_NOT_FOUND", reason: "المنصب غير موجود.", reasonEn: "Position not found." };
    }
    if (position.closedAt) {
      return { ok: false, error: "POSITION_CLOSED", reason: "المنصب مغلق — أعد فتحه أو اختر منصبًا آخر.", reasonEn: "The position is closed — reopen it or pick another." };
    }
    if (!isEffectiveOn(position, effectiveDate)) {
      return { ok: false, error: "POSITION_NOT_EFFECTIVE", reason: `المنصب غير سارٍ في ${effectiveDate}.`, reasonEn: `The position is not effective on ${effectiveDate}.` };
    }
    const others = (input.employeeIds || []).filter((id) => id !== employeeId);
    const holder = positionHolderOn(history, positionId, effectiveDate, others);
    if (holder) {
      return {
        ok: false,
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
    return { ok: false, error: "ACTION_DUPLICATE", reason: "يوجد إجراء مطابق بالنوع والتاريخ نفسه.", reasonEn: "An identical action already exists on that date." };
  }

  return { ok: true, type, employeeId, positionId, effectiveDate, reasonCode, note: String(input.note || "").trim() || null };
}

export function deriveEmployeeAssignment({ employee, actions, positions, jobs, units, onDay }) {
  const day = onDay || todayKey();
  const employeeId = String(employee?.employeeId || employee?.id || "");
  const state = replayEmployeeActions(actions || [], employeeId, day);
  const position = state.positionId ? (positions || []).find((p) => p.id === state.positionId) || null : null;
  const job = position ? (jobs || []).find((j) => j.id === position.jobId) || null : null;
  const unit = position
    ? (units || []).find((u) => u.id === position.orgUnitId) || null
    : (units || []).find((u) => u.stationId && u.stationId === employee?.stationId) || null;
  const cc = deriveCostCenter(units || [], unit?.id);
  const est = deriveEstablishment(units || [], unit?.id);
  const source = position ? "action" : "derived";
  return {
    employeeId,
    source,
    positionId: position?.id || null,
    positionRef: position?.ref || null,
    jobId: job?.id || null,
    jobCode: job?.code || null,
    jobTitle: job?.title || employee?.profile?.position || employee?.position || null,
    jobFamily: job?.family || null,
    orgUnitId: unit?.id || null,
    orgUnitName: unit?.name || null,
    orgUnitPath: deriveUnitPath(units || [], unit?.id).map((u) => u.name),
    costCenter: cc.costCenter,
    costCenterInherited: cc.inherited,
    establishmentNumber: est.establishmentNumber,
    stationId: position?.stationId || employee?.stationId || null,
    fte: position ? clampFte(position.fte) : 1,
    employmentStatus: state.status === "not_hired" ? (source === "derived" ? "active_underived" : "not_hired") : state.status,
    hireDate: state.hireDate,
    lastAction: state.lastAction,
    actionCount: state.count,
    gap: position
      ? null
      : {
        error: "NO_POSITION_ASSIGNMENT",
        reason: "لا منصب مُسند — العرض مشتق من الدور والفرع. سجّل إجراء تعيين لإكمال الملف.",
        reasonEn: "No assigned position — this view is derived from role and station. Record a hire action to complete the file.",
      },
  };
}

export function derivePositionBoard({ positions, jobs, units, actions, employees, onDay }) {
  const day = onDay || todayKey();
  const employeeIds = (employees || []).map((e) => String(e.employeeId || e.id || "")).filter(Boolean);
  const nameById = new Map((employees || []).map((e) => [String(e.employeeId || e.id || ""), e.name || ""]));
  return (positions || []).map((p) => {
    const job = (jobs || []).find((j) => j.id === p.jobId) || null;
    const unit = (units || []).find((u) => u.id === p.orgUnitId) || null;
    const holder = positionHolderOn(actions || [], p.id, day, employeeIds);
    const cc = deriveCostCenter(units || [], p.orgUnitId);
    return {
      ...p,
      fte: clampFte(p.fte),
      jobCode: job?.code || null,
      jobTitle: job?.title || null,
      jobFamily: job?.family || null,
      orgUnitName: unit?.name || null,
      orgUnitPath: deriveUnitPath(units || [], p.orgUnitId).map((u) => u.name),
      costCenter: cc.costCenter,
      holderId: holder?.employeeId || null,
      holderName: holder ? nameById.get(holder.employeeId) || holder.employeeId : null,
      holderStatus: holder?.status || null,
      vacant: !holder && !p.closedAt,
      closed: !!p.closedAt,
      effective: isEffectiveOn(p, day),
    };
  });
}

export function deriveOrgUnitRollup({ units, positions, actions, employees, onDay }) {
  const board = derivePositionBoard({ units, positions, actions, employees, onDay, jobs: [] });
  return (units || []).map((u) => {
    const family = descendantUnitIds(units || [], u.id);
    const rows = board.filter((p) => family.has(p.orgUnitId) && !p.closed);
    const filled = rows.filter((p) => p.holderId).length;
    const budgetedFte = rows.reduce((n, p) => n + clampFte(p.fte), 0);
    const cc = deriveCostCenter(units || [], u.id);
    return {
      id: u.id,
      name: u.name,
      type: u.type,
      parentId: u.parentId || null,
      depth: Math.max(0, deriveUnitPath(units || [], u.id).length - 1),
      costCenter: cc.costCenter,
      establishmentNumber: deriveEstablishment(units || [], u.id).establishmentNumber,
      positions: rows.length,
      filled,
      vacant: rows.length - filled,
      budgetedFte: Math.round(budgetedFte * 100) / 100,
      fillPct: rows.length ? Math.round((filled / rows.length) * 100) : 0,
    };
  });
}

/* ─────────────────────── performance — objectives from task weight ────────── */

export const OBJECTIVE_SOURCES = ["task", "ontime", "hse", "cover"];

export const OBJECTIVE_SOURCE_LABELS = {
  task: { ar: "وزن المهام المعتمدة", en: "Approved task weight" },
  ontime: { ar: "الالتزام بالموعد", en: "On-time delivery" },
  hse: { ar: "السلامة", en: "Safety" },
  cover: { ar: "تغطية الورديات", en: "Shift coverage" },
};

export const WORK_KINDS = ["gn", "ad", "of", "tr", "pm", "cm", "em", "pr", "cp"];

export const WORK_KIND_LABELS = {
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

export const DEFAULT_OBJECTIVES = [
  { id: "obj_task", title: "وزن المهام المعتمدة", titleEn: "Approved task weight", source: "task", weight: 50, workKinds: [] },
  { id: "obj_ontime", title: "الالتزام بالموعد", titleEn: "On-time delivery", source: "ontime", weight: 25 },
  { id: "obj_hse", title: "السلامة", titleEn: "Safety", source: "hse", weight: 15 },
  { id: "obj_cover", title: "تغطية الورديات", titleEn: "Shift coverage", source: "cover", weight: 10 },
];

export function objectiveWeightTotal(objectives) {
  return (Array.isArray(objectives) ? objectives : []).reduce((n, o) => n + (Number(o.weight) || 0), 0);
}

export function checkGoalPlanGate(input) {
  const jobId = String(input.jobId || "");
  if (!jobId || (Array.isArray(input.jobs) && input.jobs.length && !input.jobs.some((j) => j.id === jobId))) {
    return { ok: false, error: "GOAL_PLAN_JOB_NOT_FOUND", reason: "خطة الأهداف تُربط بوظيفة من الكتالوج.", reasonEn: "A goal plan is attached to a job from the catalogue." };
  }
  const objectives = Array.isArray(input.objectives) ? input.objectives : [];
  if (!objectives.length) {
    return { ok: false, error: "GOAL_PLAN_EMPTY", reason: "أضف هدفًا واحدًا على الأقل.", reasonEn: "Add at least one objective." };
  }
  for (const o of objectives) {
    if (!String(o.title || "").trim()) {
      return { ok: false, error: "OBJECTIVE_TITLE_REQUIRED", reason: "كل هدف يحتاج عنوانًا.", reasonEn: "Every objective needs a title." };
    }
    if (!OBJECTIVE_SOURCES.includes(String(o.source))) {
      return { ok: false, error: "OBJECTIVE_SOURCE_INVALID", reason: "مصدر الهدف غير معروف — المصادر المسموحة: وزن المهام، الالتزام بالموعد، السلامة، التغطية.", reasonEn: "Unknown objective source — allowed: task weight, on-time, safety, coverage." };
    }
    const weight = Number(o.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
      return { ok: false, error: "OBJECTIVE_WEIGHT_INVALID", reason: "وزن الهدف يجب أن يكون بين 1 و 100.", reasonEn: "Objective weight must be between 1 and 100." };
    }
    if (String(o.source) === "task" && Array.isArray(o.workKinds) && o.workKinds.some((k) => !WORK_KINDS.includes(String(k)))) {
      return { ok: false, error: "OBJECTIVE_WORK_KIND_INVALID", reason: "نوع عمل غير معروف في الهدف.", reasonEn: "Unknown work kind on the objective." };
    }
    if (o.targetPoints != null && o.targetPoints !== "" && (!Number.isFinite(Number(o.targetPoints)) || Number(o.targetPoints) < 0)) {
      return { ok: false, error: "OBJECTIVE_TARGET_INVALID", reason: "هدف النقاط يجب أن يكون رقمًا موجبًا.", reasonEn: "The points target must be a positive number." };
    }
  }
  const taskWeight = objectives
    .filter((o) => String(o.source) === "task")
    .reduce((n, o) => n + (Number(o.weight) || 0), 0);
  if (taskWeight < 40) {
    return {
      ok: false,
      error: "TASK_WEIGHT_FLOOR",
      reason: `وزن المهام المعتمدة لا يقل عن 40% من الخطة — وهو جوهر المنصة (الحالي ${taskWeight}%).`,
      reasonEn: `Approved task weight may not fall below 40% of a plan — it is the core of the platform (currently ${taskWeight}%).`,
    };
  }
  const total = objectiveWeightTotal(objectives);
  if (total !== 100) {
    return {
      ok: false,
      error: "OBJECTIVE_WEIGHTS_MUST_TOTAL_100",
      reason: `مجموع أوزان الأهداف يجب أن يساوي 100% — المجموع الحالي ${total}%.`,
      reasonEn: `Objective weights must total 100% — current total is ${total}%.`,
    };
  }
  return { ok: true, jobId, objectives, total };
}

export function taskBelongsTo(task, employeeId, stationId) {
  if (!task) return false;
  if (task.ownerId && task.ownerId === employeeId) return true;
  if (Array.isArray(task.memberIds) && task.memberIds.includes(employeeId)) return true;
  if (task.assignMode === "all" && (!task.stationId || task.stationId === stationId)) return true;
  return false;
}

export function taskIsProven(task) {
  return !!task.approvedAt || task.status === "completed";
}

export function provenTaskWeight(task) {
  const stored = Number(task.pointsAwarded);
  return Number.isFinite(stored) && stored > 0 ? stored : taskPoints(task.priority, task.effortWeight);
}

export function taskMatchesObjective(task, objective) {
  const kinds = Array.isArray(objective.workKinds) ? objective.workKinds.filter(Boolean) : [];
  if (!kinds.length) return true;
  return kinds.includes(String(task.workKind || ""));
}

export function withinPeriod(task, period) {
  if (!period) return true;
  const day = dayKey(task.approvedAt) || dayKey(task.dueAt);
  if (!day) return true;
  if (period.from && day < String(period.from)) return false;
  if (period.to && day > String(period.to)) return false;
  return true;
}

export function deriveEmployeeTaskFacts({ tasks, employeeId, stationId, period }) {
  const mine = (Array.isArray(tasks) ? tasks : []).filter(
    (t) => taskBelongsTo(t, employeeId, stationId) && withinPeriod(t, period),
  );
  const proven = mine.filter(taskIsProven);
  const points = proven.reduce((n, t) => n + provenTaskWeight(t), 0);
  const byKind = {};
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

export function objectiveEarnedPoints(objective, facts) {
  return facts.provenTasks
    .filter((t) => taskMatchesObjective(t, objective))
    .reduce((n, t) => n + provenTaskWeight(t), 0);
}

export function deriveObjectiveAttainment({ objective, facts, peerBenchmark, ontimePct, hsePct, coverPct }) {
  const source = String(objective.source);
  if (source === "task") {
    const earned = objectiveEarnedPoints(objective, facts);
    const explicit = objective.targetPoints != null && objective.targetPoints !== "" ? Number(objective.targetPoints) : null;
    const target = Math.max(1, explicit != null && explicit > 0 ? explicit : Number(peerBenchmark) || 1);
    const attainmentPct = Math.min(100, Math.round((earned / target) * 100));
    return {
      objectiveId: objective.id,
      source,
      weight: Number(objective.weight) || 0,
      earned,
      target,
      targetKind: explicit != null && explicit > 0 ? "absolute" : "peer",
      attainmentPct,
      contribution: Math.round(attainmentPct * ((Number(objective.weight) || 0) / 100)),
      provenCount: facts.provenTasks.filter((t) => taskMatchesObjective(t, objective)).length,
    };
  }
  const raw = source === "ontime"
    ? Number(ontimePct ?? facts.ontimePct) || 0
    : source === "hse"
      ? Number(hsePct) || 0
      : Number(coverPct) || 0;
  const attainmentPct = Math.min(100, Math.max(0, Math.round(raw)));
  return {
    objectiveId: objective.id,
    source,
    weight: Number(objective.weight) || 0,
    earned: attainmentPct,
    target: 100,
    targetKind: "rate",
    attainmentPct,
    contribution: Math.round(attainmentPct * ((Number(objective.weight) || 0) / 100)),
    provenCount: 0,
  };
}

export function deriveGoalAttainment({ objectives, facts, peerBenchmark, hsePct, coverPct }) {
  const list = Array.isArray(objectives) && objectives.length ? objectives : DEFAULT_OBJECTIVES;
  const rows = list.map((o) => deriveObjectiveAttainment({ objective: o, facts, peerBenchmark, hsePct, coverPct }));
  const total = objectiveWeightTotal(list) || 100;
  const weighted = rows.reduce((n, r) => n + r.attainmentPct * (r.weight / total), 0);
  return { rows, score: Math.round(weighted), weightTotal: total };
}

export function deriveObjectiveBoard({ employees, tasks, planFor, period }) {
  const people = Array.isArray(employees) ? employees : [];
  const factsById = new Map();
  for (const e of people) {
    const id = String(e.employeeId || e.id || "");
    factsById.set(id, deriveEmployeeTaskFacts({ tasks, employeeId: id, stationId: e.stationId, period }));
  }
  const peerBenchmark = Math.max(1, ...[...factsById.values()].map((f) => f.points), 1);
  const rows = people.map((e) => {
    const id = String(e.employeeId || e.id || "");
    const facts = factsById.get(id);
    const plan = planFor(e);
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

export function hseObjectivePct(closurePct, reportPct) {
  return blendHseTerm(closurePct, reportPct);
}

/* ───────────────────────────── review cycles ──────────────────────────────── */

export const CYCLE_STATUSES = ["draft", "open", "manager_review", "calibration", "closed"];

export const CYCLE_STATUS_LABELS = {
  draft: { ar: "مسودة", en: "Draft" },
  open: { ar: "مفتوحة", en: "Open" },
  manager_review: { ar: "مراجعة المدير", en: "Manager review" },
  calibration: { ar: "معايرة", en: "Calibration" },
  closed: { ar: "مقفلة", en: "Closed" },
};

export const CYCLE_FLOW = {
  draft: ["open"],
  open: ["manager_review"],
  manager_review: ["calibration", "closed"],
  calibration: ["closed"],
  closed: [],
};

export const CALIBRATION_BAND = 10;
export const RATING_JUSTIFICATION_MIN = 20;

export function checkCreateCycleGate(input) {
  const period = String(input.period || "").trim();
  if (!/^\d{4}-(Q[1-4]|H[12]|\d{2})$/.test(period)) {
    return { ok: false, error: "CYCLE_PERIOD_INVALID", reason: "صيغة الدورة مثل 2026-Q3 أو 2026-08.", reasonEn: "Use a period such as 2026-Q3 or 2026-08." };
  }
  const from = dayKey(input.from);
  const to = dayKey(input.to);
  if (!from || !to) {
    return { ok: false, error: "CYCLE_RANGE_REQUIRED", reason: "بداية ونهاية الدورة مطلوبتان.", reasonEn: "Cycle start and end dates are required." };
  }
  if (from > to) {
    return { ok: false, error: "CYCLE_RANGE_INVALID", reason: "بداية الدورة بعد نهايتها.", reasonEn: "The cycle starts after it ends." };
  }
  const cycles = Array.isArray(input.cycles) ? input.cycles : [];
  if (cycles.some((c) => c.period === period)) {
    return { ok: false, error: "CYCLE_DUPLICATE", reason: `دورة ${period} موجودة بالفعل.`, reasonEn: `Cycle ${period} already exists.` };
  }
  const overlap = cycles.find((c) => String(c.status) !== "closed" && from <= String(c.to) && to >= String(c.from));
  if (overlap) {
    return { ok: false, error: "CYCLE_OVERLAP", reason: `تتداخل مع دورة ${overlap.period} المفتوحة — أقفلها أولًا.`, reasonEn: `Overlaps the open ${overlap.period} cycle — close it first.` };
  }
  return { ok: true, period, from, to };
}

export function checkCycleTransitionGate(current, next) {
  const from = String(current);
  const to = String(next);
  if (!CYCLE_STATUSES.includes(to)) {
    return { ok: false, error: "CYCLE_STATUS_INVALID", reason: "حالة الدورة غير معروفة.", reasonEn: "Unknown cycle status." };
  }
  if (!(CYCLE_FLOW[from] || []).includes(to)) {
    return {
      ok: false,
      error: "CYCLE_TRANSITION_FORBIDDEN",
      reason: `لا يمكن الانتقال من «${CYCLE_STATUS_LABELS[from]?.ar || from}» إلى «${CYCLE_STATUS_LABELS[to]?.ar || to}».`,
      reasonEn: `Cannot move from "${CYCLE_STATUS_LABELS[from]?.en || from}" to "${CYCLE_STATUS_LABELS[to]?.en || to}".`,
    };
  }
  return { ok: true, status: to };
}

export function checkManagerRatingGate(input) {
  const cycle = input.cycle;
  if (!cycle) {
    return { ok: false, error: "CYCLE_NOT_FOUND", reason: "لا دورة تقييم مفتوحة.", reasonEn: "No review cycle found." };
  }
  if (!["manager_review", "calibration"].includes(String(cycle.status))) {
    return {
      ok: false,
      error: "CYCLE_NOT_IN_REVIEW",
      reason: "الدورة ليست في مرحلة مراجعة المدير أو المعايرة.",
      reasonEn: "The cycle is not in manager review or calibration.",
    };
  }
  if (input.actorId && input.employeeId && String(input.actorId) === String(input.employeeId)) {
    return {
      ok: false,
      error: "SELF_RATING_FORBIDDEN",
      reason: "فصل المهام: لا يُقيّم أحد نفسه.",
      reasonEn: "Segregation of duties: nobody rates themselves.",
    };
  }
  const derived = Number(input.derivedScore);
  if (!Number.isFinite(derived)) {
    return { ok: false, error: "DERIVED_SCORE_MISSING", reason: "الدرجة المشتقة غير متاحة — لا تقييم بلا إثبات.", reasonEn: "The derived score is unavailable — no rating without evidence." };
  }
  const rating = Number(input.rating);
  if (!Number.isFinite(rating) || rating < 0 || rating > 100) {
    return { ok: false, error: "RATING_INVALID", reason: "التقييم يجب أن يكون بين 0 و 100.", reasonEn: "A rating must be between 0 and 100." };
  }
  const band = Number.isFinite(Number(input.band)) ? Number(input.band) : CALIBRATION_BAND;
  const low = Math.max(0, derived - band);
  const high = Math.min(100, derived + band);
  if (rating < low || rating > high) {
    return {
      ok: false,
      error: "RATING_OUT_OF_BAND",
      reason: `التقييم خارج نطاق المعايرة — المسموح ${low}–${high} حول الدرجة المشتقة ${derived}.`,
      reasonEn: `Rating is outside the calibration band — allowed ${low}–${high} around the derived score ${derived}.`,
      band: { low, high, derived },
    };
  }
  const justification = String(input.justification || "").trim();
  if (rating !== Math.round(derived) && justification.length < RATING_JUSTIFICATION_MIN) {
    return {
      ok: false,
      error: "RATING_JUSTIFICATION_REQUIRED",
      reason: `تعديل الدرجة المشتقة يحتاج مبررًا مكتوبًا لا يقل عن ${RATING_JUSTIFICATION_MIN} حرفًا.`,
      reasonEn: `Adjusting the derived score needs a written justification of at least ${RATING_JUSTIFICATION_MIN} characters.`,
    };
  }
  return { ok: true, rating: Math.round(rating), derived: Math.round(derived), justification: justification || null, band: { low, high } };
}

export function deriveCycleProgress({ cycle, board, ratings }) {
  const cycleId = cycle?.id || null;
  const rated = new Set((ratings || []).filter((r) => !cycleId || r.cycleId === cycleId).map((r) => r.employeeId));
  const total = (board || []).length;
  const done = (board || []).filter((r) => rated.has(r.employeeId)).length;
  return {
    total,
    rated: done,
    pending: Math.max(0, total - done),
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}
