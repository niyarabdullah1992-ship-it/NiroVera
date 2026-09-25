import { updateCompany } from "@/lib/store";
import { gradeRank, gradesForTitle, jobTitleKey } from "@/lib/jobGradeTitles";
import { appendOrgStructureEvent } from "@/lib/orgStructureLog";

export {
  attachSharedGradesToTitles,
  catalogMatchKey,
  dedupeCatalogTitles,
  ensureProductLadder,
  gradeRank,
  gradesAscending,
  ladderBands,
  gradesForCatalogTitle,
  gradesForTitle,
  isCatalogManagerTitle,
  jobTitleKey,
  orderJobTitleCatalog,
  PRODUCT_LADDER,
  sortCatalogTitles,
} from "@/lib/jobGradeTitles";

export const DEFAULT_LADDER = [
  { ar: "مبتدئ", en: "Junior" },
  { ar: "متوسط", en: "Mid" },
  { ar: "أول", en: "Senior" },
  { ar: "مشرف", en: "Supervisor" },
  { ar: "مدير", en: "Manager" },
];

const LIST_PREFIX = {
  الفنيين: "TC",
  فني: "TC",
  الفني: "TC",
  "موظف ميداني": "TC",
  field: "TC",
  المهندسين: "EN",
  مهندس: "EN",
  المهندس: "EN",
  القيادة: "LD",
  "الموارد البشرية": "HR",
  "مسؤول موارد بشرية": "HR",
  hr_officer: "HR",
  السلامة: "HS",
  "مسؤول سلامة": "HS",
  safety_officer: "HS",
  المالية: "FN",
  "مسؤول مالية": "FN",
  finance_officer: "FN",
  IT: "IT",
  "مدير فرع": "BM",
  station_manager: "BM",
};

export function orderedJobGrades(data) {
  return [...(data?.jobGrades || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function gradesForList(data, listId) {
  if (!listId) return [];
  return orderedJobGrades(data).filter((grade) => (
    grade.listId === listId && !String(grade.titleKey || "").trim() && !String(grade.jobTitle || "").trim()
  ));
}

function gradeNorm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/الدرجة|درجه/g, "")
    .replace(/[·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gradeParts(label) {
  const raw = String(label || "").trim();
  const split = raw.split(/\s*[·•\-–]\s*/).map((part) => part.trim()).filter(Boolean);
  if (split.length >= 2) return { gradeNumber: split[0], title: split.slice(1).join(" · ") };
  return { gradeNumber: "", title: raw };
}

export function findListGrade(data, listId, label) {
  const key = String(label || "").trim();
  if (!key) return null;
  const needle = gradeNorm(key);
  const parts = gradeParts(key);
  return gradesForList(data, listId).find((grade) => {
    const full = jobGradeLabel(grade);
    const title = String(grade.title || "").trim();
    const number = String(grade.gradeNumber || "").trim();
    return full === key
      || title === key
      || number === key
      || gradeNorm(full) === needle
      || gradeNorm(title) === needle
      || gradeNorm(number) === needle
      || (parts.title && gradeNorm(title) === gradeNorm(parts.title))
      || (parts.gradeNumber && gradeNorm(number) === gradeNorm(parts.gradeNumber));
  }) || null;
}

export function ensureListGrade(companyId, listId, label, listName = "") {
  const key = String(label || "").trim();
  if (!companyId || !listId || !key) return { ok: false };
  let id = "";
  updateCompany(companyId, (data) => {
    data.jobGrades = data.jobGrades || [];
    const hit = findListGrade(data, listId, key);
    if (hit) {
      id = hit.id;
      return;
    }
    const parsed = gradeParts(key);
    const title = parsed.title || key;
    let gradeNumber = parsed.gradeNumber;
    if (!gradeNumber || gradesForList(data, listId).some((grade) => String(grade.gradeNumber || "").trim() === gradeNumber)) {
      gradeNumber = nextGradeNumber(data, listId, listName);
    }
    id = `grade_${listId}_${uid()}`;
    data.jobGrades.push({
      id,
      listId,
      gradeNumber,
      title,
      order: nextOrder(data.jobGrades),
      minSalary: null,
      maxSalary: null,
      requiredCerts: [],
    });
  });
  return { ok: Boolean(id), id };
}

export function employeeJobGrade(employee, data) {
  return orderedJobGrades(data).find((grade) => grade.id === employee?.profile?.gradeId) || null;
}

export function jobGradeLabel(grade) {
  return grade ? [grade.gradeNumber, grade.title].filter(Boolean).join(" · ") : "";
}

export function gradeSalaryRange(grade) {
  const min = Number(grade?.minSalary);
  const max = Number(grade?.maxSalary);
  return {
    min: Number.isFinite(min) && min > 0 ? min : null,
    max: Number.isFinite(max) && max > 0 ? max : null,
  };
}

export function gradeHasSalaryRange(grade) {
  const { min, max } = gradeSalaryRange(grade);
  return min != null && max != null && max >= min;
}

export function listGradePrefix(name) {
  const key = String(name || "").trim();
  if (LIST_PREFIX[key]) return LIST_PREFIX[key];
  const stripped = key.replace(/^ال/, "");
  if (LIST_PREFIX[stripped]) return LIST_PREFIX[stripped];
  const ascii = key.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (ascii.length >= 2) return ascii.slice(0, 2);
  if (ascii.length === 1) return `${ascii}L`;
  return "GR";
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function nextOrder(list) {
  return list.reduce((max, grade) => Math.max(max, Number(grade.order) || 0), -1) + 1;
}

function nextGradeNumber(data, listId, listName = "") {
  const used = new Set(gradesForList(data, listId).map((grade) => String(grade.gradeNumber || "").trim()));
  const prefix = listGradePrefix(listName);
  let index = gradesForList(data, listId).length + 1;
  let gradeNumber = `${prefix}${index}`;
  while (used.has(gradeNumber)) {
    index += 1;
    gradeNumber = `${prefix}${index}`;
  }
  return gradeNumber;
}

export function seedDefaultLadder(companyId, listId, listName = "", ar = true) {
  if (!companyId || !listId) return { ok: false, added: 0 };
  let added = 0;
  updateCompany(companyId, (data) => {
    data.jobGrades = data.jobGrades || [];
    DEFAULT_LADDER.forEach((row) => {
      const title = ar ? row.ar : row.en;
      if (findListGrade(data, listId, title)) return;
      data.jobGrades.push({
        id: `grade_${listId}_${uid()}`,
        listId,
        gradeNumber: nextGradeNumber(data, listId, listName),
        title,
        titleEn: row.en,
        order: nextOrder(data.jobGrades),
        minSalary: null,
        maxSalary: null,
        requiredCerts: [],
      });
      added += 1;
    });
  });
  return { ok: added > 0, added };
}

export function patchJobGrade(companyId, gradeId, patch = {}) {
  const id = String(gradeId || "").trim();
  if (!companyId || !id) return { ok: false };
  let ok = false;
  updateCompany(companyId, (data) => {
    const grade = (data.jobGrades || []).find((item) => item.id === id);
    if (!grade) return;
    if (patch.title != null) grade.title = String(patch.title);
    if ("titleEn" in patch) grade.titleEn = String(patch.titleEn || "");
    if ("gradeNumber" in patch) grade.gradeNumber = String(patch.gradeNumber || "");
    if ("experience" in patch) grade.experience = String(patch.experience || "");
    if ("requirement" in patch) grade.requirement = String(patch.requirement || "");
    if ("minSalary" in patch) grade.minSalary = patch.minSalary;
    if ("maxSalary" in patch) grade.maxSalary = patch.maxSalary;
    if ("annualLeaveDays" in patch) grade.annualLeaveDays = patch.annualLeaveDays;
    ok = true;
  });
  return { ok };
}

/** Keep a title's prefix (OP, TC, م) and replace the number the admin typed. */
export function rewriteGradeNumber(current, rank) {
  const n = Math.max(1, Math.floor(Number(rank) || 0));
  if (!n) return String(current || "");
  const raw = String(current || "");
  if (/\d+/.test(raw)) return raw.replace(/\d+/, String(n));
  return `م${n}`;
}

function logGrade(data, text) {
  appendOrgStructureEvent(data, { type: "grade", to: text, toName: text });
}

/** Move one rank up or down inside its own title. Other titles stay untouched. */
export function moveTitleGrade(companyId, gradeId, direction) {
  const id = String(gradeId || "").trim();
  const step = direction < 0 ? -1 : 1;
  if (!companyId || !id) return { ok: false };
  let ok = false;
  updateCompany(companyId, (data) => {
    const grade = (data.jobGrades || []).find((item) => item.id === id);
    if (!grade) return;
    const owned = gradesForTitle(data, grade.jobTitle || grade.titleKey);
    const index = owned.findIndex((item) => item.id === id);
    const next = index + step;
    if (index < 0 || next < 0 || next >= owned.length) return;
    const order = owned.slice();
    const [row] = order.splice(index, 1);
    order.splice(next, 0, row);
    order.forEach((item, position) => { item.order = position; });
    logGrade(data, `${grade.jobTitle || ""} · رُفعت مرتبة «${row.title || row.gradeNumber || ""}»`);
    ok = true;
  });
  return { ok };
}

export function setTitleGradeRank(companyId, gradeId, rank) {
  const id = String(gradeId || "").trim();
  const n = Math.floor(Number(rank) || 0);
  if (!companyId || !id || n < 1) return { ok: false };
  let ok = false;
  updateCompany(companyId, (data) => {
    const grade = (data.jobGrades || []).find((item) => item.id === id);
    if (!grade) return;
    const next = rewriteGradeNumber(grade.gradeNumber, n);
    if (next === String(grade.gradeNumber || "")) return;
    const previous = grade.gradeNumber;
    grade.gradeNumber = next;
    logGrade(data, `${grade.jobTitle || ""} · ${grade.title || "مرتبة"} ← ${next} (كانت ${previous || "—"})`);
    ok = true;
  });
  return { ok };
}

/** Grade belongs to the seat; the holder takes it. Empty id is refused. */
export function assignHolderGrade(companyId, { employeeId = "", seatId = "", gradeId = "" } = {}) {
  const next = String(gradeId || "").trim();
  if (!companyId || !next) return { ok: false };
  let ok = false;
  updateCompany(companyId, (data) => {
    const grade = (data.jobGrades || []).find((item) => item.id === next);
    if (!grade) return;
    const employee = employeeId
      ? (data.employees || []).find((item) => String(item.id) === String(employeeId))
      : null;
    let changed = false;
    if (employee) {
      if (String(employee.profile?.gradeId || "") !== next) {
        employee.profile = { ...(employee.profile || {}), gradeId: next };
        changed = true;
      }
      ok = true;
    }
    (data.orgSeats || []).forEach((seat) => {
      const hit = (seatId && String(seat.id) === String(seatId))
        || (!seatId && employeeId && String(seat.employeeId) === String(employeeId));
      if (!hit) return;
      if (String(seat.gradeId || "") !== next) {
        seat.gradeId = next;
        changed = true;
      }
      ok = true;
    });
    if (changed) {
      const label = [grade.gradeNumber, grade.title].filter(Boolean).join(" · ") || next;
      logGrade(data, employee?.name ? `درجة ${employee.name}: ${label}` : `درجة الوظيفة: ${label}`);
    }
  });
  return { ok };
}

export function removeListGrade(companyId, gradeId) {
  const id = String(gradeId || "").trim();
  if (!companyId || !id) return { ok: false };
  updateCompany(companyId, (data) => {
    data.jobGrades = (data.jobGrades || []).filter((grade) => grade.id !== id);
    (data.employees || []).forEach((employee) => {
      if (employee.profile?.gradeId === id) employee.profile.gradeId = null;
    });
    (data.orgSeats || []).forEach((seat) => {
      if (seat.gradeId === id) seat.gradeId = "";
    });
  });
  return { ok: true };
}

const PRESET_TITLES = new Set(DEFAULT_LADDER.map((row) => row.ar));

export function isPresetLadderGrade(grade) {
  if (!grade) return false;
  if (/^grade_tc[1-5]$/i.test(String(grade.id || ""))) return true;
  const title = String(grade.title || "").trim();
  const code = String(grade.gradeNumber || "").trim();
  return PRESET_TITLES.has(title) && /^(TC|EN|HR|HS|FN|BM|LD|GR)\d+$/i.test(code);
}

export function purgePresetLadders(data) {
  if (!data) return false;
  const removed = new Set();
  const next = (data.jobGrades || []).filter((grade) => {
    if (!isPresetLadderGrade(grade)) return true;
    removed.add(grade.id);
    return false;
  });
  if (!removed.size) return false;
  data.jobGrades = next;
  (data.orgSeats || []).forEach((seat) => {
    if (removed.has(seat.gradeId)) seat.gradeId = "";
  });
  (data.employees || []).forEach((employee) => {
    if (employee?.profile && removed.has(employee.profile.gradeId)) employee.profile.gradeId = null;
  });
  return true;
}

export function copyListLadder(companyId, fromListId, toListId, toListName) {
  if (!companyId || !fromListId || !toListId || fromListId === toListId) return { ok: false };
  let copied = 0;
  updateCompany(companyId, (data) => {
    data.jobGrades = data.jobGrades || [];
    const source = gradesForList(data, fromListId);
    if (!source.length) return;
    const used = new Set([
      ...(data.employees || []).map((employee) => employee.profile?.gradeId),
      ...(data.orgSeats || []).map((seat) => seat.gradeId),
    ].filter(Boolean));
    data.jobGrades = data.jobGrades.filter((grade) => grade.listId !== toListId || used.has(grade.id));
    const prefix = listGradePrefix(toListName);
    const start = nextOrder(data.jobGrades);
    source.forEach((grade, index) => {
      data.jobGrades.push({
        id: `grade_${toListId}_${index + 1}_${uid()}`,
        listId: toListId,
        gradeNumber: `${prefix}${index + 1}`,
        title: grade.title,
        titleEn: grade.titleEn || "",
        order: start + index,
        minSalary: grade.minSalary ?? null,
        maxSalary: grade.maxSalary ?? null,
      });
      copied += 1;
    });
  });
  return { ok: copied > 0, copied };
}

function gradeCodePrefix(gradeNumber, fallback = "") {
  const raw = String(gradeNumber || "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const match = raw.match(/^(.*?)(\d+)\s*$/);
  if (match && match[1]) return match[1];
  return fallback;
}

function nextTitleGradeNumber(owned, listName = "") {
  const prefix = owned.map((grade) => gradeCodePrefix(grade.gradeNumber)).find(Boolean) || listGradePrefix(listName);
  const used = new Set(owned.map((grade) => String(grade.gradeNumber || "").trim()));
  let index = owned.length + 1;
  let gradeNumber = `${prefix}${index}`;
  while (used.has(gradeNumber)) {
    index += 1;
    gradeNumber = `${prefix}${index}`;
  }
  return gradeNumber;
}

/** A higher step on one job title's ladder. Salary stays empty until someone types it. */
export function createTitleGrade(companyId, input) {
  const jobTitle = String(input?.jobTitle || "").trim();
  const level = String(input?.title || "").trim();
  if (!companyId || !jobTitle || !level) return { ok: false, error: "FIELDS" };
  let id = "";
  updateCompany(companyId, (data) => {
    data.jobGrades = data.jobGrades || [];
    const owned = gradesForTitle(data, jobTitle);
    if (owned.some((grade) => String(grade.title || "").trim() === level)) return;
    const listId = String(input?.listId || owned.find((grade) => grade.listId)?.listId || "").trim();
    id = `grade_${uid()}`;
    const gradeNumber = nextTitleGradeNumber(owned, input?.listName || "");
    data.jobGrades.push({
      id,
      listId,
      jobTitle,
      titleKey: jobTitleKey(jobTitle),
      gradeNumber,
      title: level,
      order: nextOrder(owned),
      experience: String(input?.experience || ""),
      requirement: String(input?.requirement || ""),
      minSalary: null,
      maxSalary: null,
      annualLeaveDays: null,
      requiredCerts: [],
    });
    logGrade(data, `أُضيفت مرتبة «${level}» إلى مسار ${jobTitle}`);
  });
  return { ok: Boolean(id), id };
}

export function createListGrade(companyId, input) {
  const listId = String(input?.listId || "").trim();
  const title = String(input?.title || input?.gradeNumber || "").trim();
  if (!companyId || !listId || !title) return { ok: false, error: "FIELDS" };
  const min = Number(input.minSalary);
  const max = Number(input.maxSalary);
  let id = "";
  updateCompany(companyId, (data) => {
    data.jobGrades = data.jobGrades || [];
    if (findListGrade(data, listId, title)) return;
    const pack = (data.permissionTemplates || []).find((item) => item.id === listId);
    const listName = pack?.ar || pack?.en || "";
    const requested = String(input?.gradeNumber || "").trim();
    const gradeNumber = requested && !gradesForList(data, listId).some((grade) => String(grade.gradeNumber || "").trim() === requested)
      ? requested
      : nextGradeNumber(data, listId, listName);
    id = `grade_${listId}_${uid()}`;
    data.jobGrades.push({
      id,
      listId,
      gradeNumber,
      title,
      order: nextOrder(data.jobGrades),
      minSalary: Number.isFinite(min) && min > 0 ? min : null,
      maxSalary: Number.isFinite(max) && max > 0 ? max : null,
      requiredCerts: Array.isArray(input.requiredCerts) ? input.requiredCerts : [],
    });
  });
  return { ok: Boolean(id), id };
}

/** Next grade number above the stored ladder. Pay stays empty until someone types it. */
export function addHigherLadderGrade(companyId) {
  if (!companyId) return { ok: false, error: "FIELDS" };
  let id = "";
  updateCompany(companyId, (data) => {
    data.jobGrades = data.jobGrades || [];
    const grades = data.jobGrades;
    const ranks = grades.map((grade) => gradeRank(grade)).filter((rank) => rank != null);
    const nextRank = (ranks.length ? Math.max(...ranks) : 0) + 1;
    const already = grades.some((grade) => (
      !String(grade.jobTitle || "").trim()
      && !String(grade.titleKey || "").trim()
      && gradeRank(grade) === nextRank
    ));
    if (already) return;
    const sample = grades.find((grade) => grade.ladderBand && gradeRank(grade) != null)
      || grades.find((grade) => gradeRank(grade) != null)
      || null;
    const listId = String(sample?.ladderBand ? (sample.listId || "ladder") : "ladder").trim();
    const gradeNumber = sample?.ladderBand || /^م\d+$/.test(String(sample?.gradeNumber || ""))
      ? rewriteGradeNumber(sample.gradeNumber, nextRank)
      : `م${nextRank}`;
    id = `grade_ladder_${uid()}`;
    data.jobGrades.push({
      id,
      listId,
      ladderBand: true,
      gradeNumber,
      title: "",
      order: nextOrder(data.jobGrades),
      minSalary: null,
      maxSalary: null,
      annualLeaveDays: null,
      requiredCerts: [],
    });
    logGrade(data, `درجة أعلى ${gradeNumber}`);
  });
  return { ok: Boolean(id), id };
}

export function structurePublishIssues() {
  return [];
}

export function publishOrgStructure(companyId, data, ar = true) {
  const issues = structurePublishIssues(data, ar);
  if (issues.length) return { ok: false, issues };
  updateCompany(companyId, (company) => {
    company.settings = { ...(company.settings || {}), orgPublishedAt: new Date().toISOString() };
  });
  return { ok: true };
}
