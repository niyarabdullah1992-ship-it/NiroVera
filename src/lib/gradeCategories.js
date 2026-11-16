import { updateCompany } from "@/lib/store";
import { appendOrgStructureEvent } from "@/lib/orgStructureLog";

/**
 * «سلّم الدرجات الوظيفية» kept simple: job categories (الفنيون، المهندسون، الموارد البشرية، الإداريون…),
 * each with its levels from the lowest up. No pay and no leave here — a person is placed on one level.
 */
const DEFAULTS = [
  { name: "الفنيون", levels: ["فني مساعد", "فني", "فني أول", "فني رئيسي"] },
  { name: "المهندسون", levels: ["مهندس مبتدئ", "مهندس", "مهندس أول", "مهندس رئيسي"] },
  { name: "الموارد البشرية", levels: ["أخصائي موارد بشرية", "أخصائي أول", "مشرف موارد بشرية", "مدير موارد بشرية"] },
  { name: "الإداريون", levels: ["موظف إداري", "إداري أول", "مشرف إداري", "مدير إداري"] },
];

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

function seed() {
  return DEFAULTS.map((cat) => ({ id: uid("gc"), name: cat.name, levels: cat.levels.map((name) => ({ id: uid("gl"), name })) }));
}

export function gradeCategories(data) {
  return Array.isArray(data?.gradeCategories) && data.gradeCategories.length ? data.gradeCategories : DEFAULT_VIEW;
}
const DEFAULT_VIEW = seed();

function edit(companyId, data, fn) {
  updateCompany(companyId, (d) => {
    if (!Array.isArray(d.gradeCategories) || !d.gradeCategories.length) d.gradeCategories = JSON.parse(JSON.stringify(gradeCategories(data)));
    fn(d.gradeCategories, d);
  });
}

export function addCategory(companyId, data, name) {
  const clean = String(name || "").trim();
  if (!clean) return;
  edit(companyId, data, (cats) => { cats.push({ id: uid("gc"), name: clean, levels: [{ id: uid("gl"), name: `${clean} — المستوى 1` }] }); });
}
export function renameCategory(companyId, data, catId, name) {
  const clean = String(name || "").trim();
  if (!clean) return;
  edit(companyId, data, (cats) => { const c = cats.find((x) => x.id === catId); if (c) c.name = clean; });
}
export function removeCategory(companyId, data, catId) {
  edit(companyId, data, (cats) => { const i = cats.findIndex((x) => x.id === catId); if (i >= 0) cats.splice(i, 1); });
}
export function addLevel(companyId, data, catId, name) {
  const clean = String(name || "").trim();
  if (!clean) return;
  edit(companyId, data, (cats) => { const c = cats.find((x) => x.id === catId); if (c) c.levels.push({ id: uid("gl"), name: clean }); });
}
export function renameLevel(companyId, data, catId, levelId, name) {
  const clean = String(name || "").trim();
  if (!clean) return;
  edit(companyId, data, (cats) => { const l = cats.find((x) => x.id === catId)?.levels.find((y) => y.id === levelId); if (l) l.name = clean; });
}
export function removeLevel(companyId, data, catId, levelId) {
  edit(companyId, data, (cats) => { const c = cats.find((x) => x.id === catId); if (c) c.levels = c.levels.filter((y) => y.id !== levelId); });
}
export function moveLevel(companyId, data, catId, levelId, step) {
  edit(companyId, data, (cats) => {
    const c = cats.find((x) => x.id === catId);
    if (!c) return;
    const i = c.levels.findIndex((y) => y.id === levelId);
    const j = i + step;
    if (i < 0 || j < 0 || j >= c.levels.length) return;
    [c.levels[i], c.levels[j]] = [c.levels[j], c.levels[i]];
  });
}

/** Where a person sits: { category, level, index } or null. */
export function personLevel(data, employee) {
  const p = employee?.profile || {};
  if (!p.gradeCategoryId || !p.gradeLevelId) return null;
  const category = gradeCategories(data).find((c) => c.id === p.gradeCategoryId);
  const index = category ? category.levels.findIndex((l) => l.id === p.gradeLevelId) : -1;
  return category && index >= 0 ? { category, level: category.levels[index], index } : null;
}

export function peopleOnLevel(data, catId, levelId) {
  return (data?.employees || []).filter((e) => e?.profile?.gradeCategoryId === catId && e?.profile?.gradeLevelId === levelId && e.status !== "terminated").length;
}

/** Place a person on a level; the event log names who did it. */
export function setPersonLevel(companyId, data, employeeId, catId, levelId) {
  edit(companyId, data, (cats, d) => {
    const e = (d.employees || []).find((x) => String(x.id) === String(employeeId));
    if (!e) return;
    const c = cats.find((x) => x.id === catId);
    const l = c?.levels.find((y) => y.id === levelId);
    e.profile = { ...(e.profile || {}), gradeCategoryId: c ? catId : "", gradeLevelId: l ? levelId : "" };
    appendOrgStructureEvent(d, {
      type: "grade",
      employeeId: e.id,
      to: l ? `${e.name}: ${c.name} — ${l.name}` : `${e.name}: أُزيل من سلّم الدرجات`,
    });
  });
}
