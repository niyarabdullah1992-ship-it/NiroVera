/**
 * «شجرة الإدارة» — the action panel a card opens: every structure edit the old people tree's
 * drawers offered (before the SAP chart replaced it), grouped so it is easy to find:
 *   إضافة · تكليف · نقل · تعديل · إزالة
 * Each action names the EXISTING function it runs (see `fn`) and is blocked with a named reason
 * when its gate says no. Nothing here writes data: the panel component calls the functions.
 */

import { canEditOrgDesign, checkOrgChangeGate, seatState, todayKey } from "./orgDesign.js";
import {
  isCompanyRootStation,
  isHrUnit,
  isManagerUnit,
  stationParentId,
  stationSubtreeIds,
} from "./stationTree.js";
import { buildBranchTree } from "./orgBranches.js";
import { orderKeys } from "./orgFocus.js";
import { EDIT_BLOCK, HIRE_BLOCK, ledStation } from "./orgChartActions.js";

const str = (value) => String(value ?? "").trim();

/** The old tree's write set (OrgTemplateBoard): the owner, director, admin, pgm, HR manager. */
export const STRUCTURE_ROLES = Object.freeze(["owner", "director", "admin", "pgm", "hr_manager"]);

export const NO_STRUCTURE_RIGHT = {
  ar: "إدارة الهيكل للمالك والموارد البشرية — لديك اطلاع فقط.",
  en: "Structure management is for the owner and HR — you can view only.",
};

/**
 * Who may manage the structure: the old tree's roles, or the org-design right (HR levels with
 * manage_employees). `canEditSeats` is the narrower seat-design right patchSeatDesign checks.
 */
export function structureRights(user, data) {
  if (!user || !data) return { canManage: false, canEditSeats: false, reason: NO_STRUCTURE_RIGHT };
  const seats = canEditOrgDesign(user, data);
  const manage = seats || str(user.id) === str(data.ownerId) || STRUCTURE_ROLES.includes(user.role);
  return { canManage: manage, canEditSeats: seats, reason: manage ? null : NO_STRUCTURE_RIGHT };
}

export const PANEL_GROUPS = [
  { id: "add", ar: "إضافة", en: "Add" },
  { id: "assign", ar: "تكليف", en: "Assign" },
  { id: "move", ar: "نقل", en: "Move" },
  { id: "edit", ar: "تعديل", en: "Edit" },
  { id: "remove", ar: "إزالة", en: "Remove" },
];

const ROOT_FIXED = { ar: "المقر الرئيسي ثابت — لا يُنقل ولا يُزال.", en: "The head office is fixed — it is not moved or removed." };
const HR_FIXED = { ar: "وحدة الموارد البشرية ثابتة.", en: "The HR unit is fixed." };
const NO_SEAT = { ar: "لا منصب لهذه البطاقة في الهيكل.", en: "This card has no seat on the chart." };
const FILLED_FREEZE = { ar: "المنصب مشغول — لا يُجمَّد قبل إخلائه.", en: "Filled — it cannot be frozen before it is vacated." };

/** Old messages, kept word for word where the old drawers had them. */
export const ACTING_REASONS = {
  FIELDS: { ar: "حدّد الموظف وتاريخ النهاية — التكليف ينتهي تلقائياً في تاريخه.", en: "Pick the person and an end date — the acting role ends by itself." },
  HOME: { ar: "التكليف على وحدة أخرى غير وحدة الموظف الأصلية — في وحدته يُنقل أو يُعيَّن.", en: "Acting is for another unit — within their own unit, assign or transfer instead." },
  MISSING: { ar: "الموظف أو الوحدة غير موجودة.", en: "Person or unit not found." },
};
export const BRANCH_PARENT_REASONS = {
  CYCLE_FORBIDDEN: { ar: "لا يمكن نقل الفرع تحت فرع يتبعه", en: "A branch cannot move under a branch that reports to it." },
  COMPANY_ROOT: { ar: "المنشأة هي الفرع الرئيسي ولا تتبع فرعاً آخر.", en: "The company apex cannot hang under another branch." },
  FIXED_HR: { ar: "وحدة الموارد البشرية ثابتة ولا تُنقل.", en: "The HR unit is fixed and cannot be moved." },
  HR_NOT_PARENT: { ar: "الفروع لا تتبع وحدة الموارد البشرية.", en: "Branches do not report to the HR unit." },
  PARENT_NOT_FOUND: { ar: "الجهة الأعلى غير موجودة.", en: "That parent is not on the tree." },
};
export function reasonOf(map, code, fallback) {
  return map[code] || fallback || { ar: "تعذّر تنفيذ الإجراء.", en: "Could not complete the action." };
}

/**
 * The grouped actions of one card.
 * @param {object} node a person / open seat card (focus tree) or a branch card (branch tree)
 * @param {{ data, user }} ctx
 * @returns {Array<{ id, ar, en, items: Array<{ id, ar, en, fn, blocked: null | { ar, en }, form?: string, destructive?: boolean, stationId?: string }> }>}
 */
export function panelActions(node, { data, user } = {}) {
  if (!node || node.kind === "people") return [];
  const rights = structureRights(user, data);
  const deny = rights.reason;
  const seatDeny = deny || (rights.canEditSeats ? null : EDIT_BLOCK);
  const stations = data?.stations || [];
  const station = stations.find((s) => str(s.id) === str(node.stationId)) || null;
  const groups = Object.fromEntries(PANEL_GROUPS.map((g) => [g.id, []]));
  const add = (group, item) => groups[group].push({ blocked: null, ...item });

  if (node.kind === "branch") {
    const root = station && isCompanyRootStation(station);
    const hr = station && isHrUnit(station);
    const fixed = root ? ROOT_FIXED : hr ? HR_FIXED : null;
    add("add", { id: "addUnit", ar: "وحدة / فرع فرعي", en: "Sub-unit / branch", fn: "createOrgBranch", form: "addUnit", blocked: deny || (hr ? HR_FIXED : null) });
    add("add", { id: "hireHere", ar: "منصب وموظف في الفرع", en: "Seat and person here", fn: "onHire (createOrgSeat · hireFromSeat)", stationId: str(node.stationId), blocked: deny || (station && isManagerUnit(station) ? HIRE_BLOCK : null) });
    add("assign", { id: "branchManagers", ar: "مدير الفرع ومدير الموارد البشرية", en: "Branch manager and HR manager", fn: "setStationManager · assignBranchHrManager", form: "branchDrawer", blocked: deny || (hr ? HR_FIXED : null) });
    if (node.managerVacant && node.level !== "hq") {
      add("assign", { id: "hireManager", ar: "تعيين مدير على المنصب الشاغر", en: "Hire into the open manager seat", fn: "onHire", blocked: deny || (station && isManagerUnit(station) ? HIRE_BLOCK : null) });
    }
    add("move", { id: "moveParent", ar: "تحت فرع آخر", en: "Under another branch", fn: "setOrgBranchParent", form: "pickParent", blocked: deny || fixed });
    add("edit", { id: "rename", ar: "الاسم", en: "Name", fn: root ? "renameCompany" : "renameOrgBranch", form: "rename", blocked: deny || (hr ? HR_FIXED : null) });
    add("edit", { id: "unitKind", ar: "النوع: فرع أو إدارة منطقة", en: "Kind: branch or region", fn: "setOrgUnitKind", form: "unitKind", blocked: deny || fixed });
    add("remove", { id: "closeUnit", ar: "إغلاق الوحدة بقرار", en: "Close the unit by decision", fn: "«التغييرات» closeUnit", form: "confirmClose", destructive: true, blocked: deny || fixed });
    add("remove", { id: "deleteBranch", ar: "إزالة الفرع ونقل ما فيه للأعلى", en: "Remove the branch, its content moves up", fn: "deleteStationWithData (transfer)", form: "confirmDelete", destructive: true, blocked: deny || fixed });
  } else {
    const hasSeat = Boolean(node.seatId);
    const filled = !node.vacant;
    const led = ledStation(data, node);
    const homeUnit = led || station;
    if (filled) {
      add("add", { id: "addSeatUnder", ar: "منصب شاغر تحته", en: "Open seat under", fn: "createVacantSeatsUnderManager", form: "addSeat", blocked: deny || (hasSeat ? null : NO_SEAT) });
      add("add", { id: "hireHere", ar: "موظف جديد في وحدته", en: "New person in their unit", fn: "onHire (createOrgSeat · hireFromSeat)", stationId: str(homeUnit?.id), blocked: deny || (homeUnit && isManagerUnit(homeUnit) ? HIRE_BLOCK : null) });
      add("add", { id: "addUnit", ar: "وحدة / فرع فرعي", en: "Sub-unit / branch", fn: "createOrgBranch", form: "addUnit", stationId: str(homeUnit?.id), blocked: deny || (homeUnit && isHrUnit(homeUnit) ? HR_FIXED : null) });
    } else {
      add("add", { id: "hire", ar: "تعيين موظف على المنصب", en: "Hire into this seat", fn: "onHire", blocked: deny || (node.state !== "vacant" ? { ar: "المنصب مجمّد أو مخطط — لا يُعيَّن عليه الآن.", en: "Frozen or planned — no hiring now." } : null) });
      add("add", { id: "hireHere", ar: "منصب آخر في الوحدة", en: "Another seat in the unit", fn: "onHire (createOrgSeat)", stationId: str(station?.id), blocked: deny || (station && isManagerUnit(station) ? HIRE_BLOCK : null) });
    }
    add("assign", { id: "acting", ar: "إنابة (تكليف بالمنصب)", en: "Acting cover", fn: "setActingAssignment", form: "acting", blocked: deny || (hasSeat ? null : NO_SEAT) });
    add("assign", { id: "deputy", ar: "النائب والخط المنقّط", en: "Deputy and dotted line", fn: "patchSeatDesign", form: "deputy", blocked: hasSeat ? seatDeny : NO_SEAT });
    add("move", { id: "moveManager", ar: "إلى مدير آخر", en: "To another manager", fn: "«التغييرات» moveSeat (المادة 58)", form: "moveSheet", blocked: hasSeat ? seatDeny : NO_SEAT });
    if (filled) {
      add("move", { id: "moveBranch", ar: "إلى فرع آخر", en: "To another branch", fn: "transferEmployeeBetweenStations", form: "transfer", blocked: deny });
      add("move", { id: "changeHolder", ar: "تغيير الشاغل", en: "Change the holder", fn: "placeExistingEmployee", form: "file", blocked: deny });
    } else {
      add("move", { id: "moveBranch", ar: "إلى فرع آخر", en: "To another branch", fn: "«التغييرات» moveSeat", form: "seatToBranch", blocked: hasSeat ? seatDeny : NO_SEAT });
    }
    add("edit", { id: "seatEdit", ar: "الرمز والمسمى في قوى والحالة", en: "Code, Qiwa title, state", fn: "patchSeatDesign", form: "seatEdit", blocked: hasSeat ? seatDeny : NO_SEAT });
    if (filled) add("edit", { id: "grade", ar: "الدرجة وصلاحيات المقعد وموقع العمل", en: "Grade, seat access, work site", fn: "assignHolderGrade · cycleSeatAccess · setActualWorkSite", form: "file", blocked: deny });
    if (filled) add("remove", { id: "vacate", ar: "إخلاء المنصب", en: "Vacate the seat", fn: "endSeatTenure", form: "confirmVacate", destructive: true, blocked: deny || (hasSeat ? null : NO_SEAT) });
    const frozen = node.state === "frozen";
    add("remove", {
      id: "freeze",
      ar: frozen ? "فك التجميد" : "تجميد المنصب",
      en: frozen ? "Unfreeze" : "Freeze the seat",
      fn: "patchSeatDesign",
      form: "confirmFreeze",
      destructive: !frozen,
      blocked: !hasSeat ? NO_SEAT : (seatDeny || (filled ? FILLED_FREEZE : null)),
    });
    add("remove", { id: "freezeDecision", ar: "إغلاق المنصب بقرار (تجميد)", en: "Close the seat by decision (freeze)", fn: "«التغييرات» freezeSeat", form: "decision", destructive: true, blocked: !hasSeat ? NO_SEAT : (seatDeny || (filled ? FILLED_FREEZE : null)) });
  }
  return PANEL_GROUPS.map((g) => ({ ...g, items: groups[g.id] })).filter((g) => g.items.length);
}

/**
 * The branches hierarchy as an indented pick list (HQ → region → branch → site), each row with
 * whether it can be picked for `purpose`, and why not.
 *   purpose "transfer" — an employee's new workplace (regions and the HR unit are not workplaces)
 *   purpose "seat"     — a seat's new unit (same rule, through «التغييرات»)
 *   purpose "parent"   — a branch's new parent (not itself or anything under it, not the HR unit)
 */
export function branchPickList(data, { purpose = "transfer", current = "", moving = "" } = {}) {
  const tree = buildBranchTree(data, { scope: "all" });
  const stations = data?.stations || [];
  const below = moving ? new Set(stationSubtreeIds(stations, moving).map(String)) : new Set();
  const rows = [];
  const walk = (key, depth) => {
    const node = tree.nodes.get(key);
    if (!node || node.kind !== "branch") return;
    const s = stations.find((x) => str(x.id) === str(node.stationId));
    let blocked = null;
    if (str(node.stationId) === str(current)) blocked = { ar: "الحالي", en: "Current" };
    else if (purpose === "parent") {
      if (below.has(str(node.stationId))) blocked = { ar: "يتبعه — حلقة تبعية", en: "Under it — a loop" };
      else if (s && isHrUnit(s)) blocked = { ar: "لا تتبع الفروع وحدة الموارد", en: "Not under the HR unit" };
    } else if (s && (isManagerUnit(s) || isHrUnit(s))) {
      blocked = isManagerUnit(s) ? { ar: "منطقة — ليست مكان عمل", en: "Region — not a workplace" } : { ar: "وحدة ثابتة", en: "Fixed unit" };
    }
    rows.push({ id: str(node.stationId), name: node.name, level: node.level, depth, blocked });
    orderKeys(tree, node.childKeys.filter((k) => tree.nodes.get(k)?.kind === "branch")).forEach((k) => walk(k, depth + 1));
  };
  tree.roots.forEach((k) => walk(k, 0));
  return rows;
}

/** What «إزالة الفرع» would do (the old drawer's deleteStationWithData, transfer mode), or why not. */
export function branchRemovalImpact(data, stationId) {
  const stations = data?.stations || [];
  const station = stations.find((s) => str(s.id) === str(stationId));
  if (!station) return { blocked: { ar: "الفرع غير موجود.", en: "Branch not found." } };
  if (isCompanyRootStation(station)) return { blocked: ROOT_FIXED };
  if (isHrUnit(station)) return { blocked: HR_FIXED };
  const parentId = str(stationParentId(station)) || str(stations.find((s) => isCompanyRootStation(s))?.id);
  const parent = stations.find((s) => str(s.id) === parentId);
  if (!parent || parentId === str(stationId)) return { blocked: { ar: "لا جهة تستقبل الوظائف المشغولة.", en: "There is no parent to receive the occupied seats." } };
  const people = (data?.employees || []).filter((e) => e?.active !== false && str(e.stationId) === str(stationId)).length;
  const seats = (data?.orgSeats || []).filter((s) => str(s.stationId) === str(stationId)).length;
  const children = stations.filter((s) => !s.closedAt && str(stationParentId(s)) === str(stationId)).length;
  return { blocked: null, targetId: parentId, targetName: str(parent.name), people, seats, children };
}

/** «إغلاق الوحدة بقرار»: the closeUnit step through the existing change gate (it names people / children left). */
export function closeUnitPlan(data, stationId, { today = todayKey() } = {}) {
  const op = { type: "closeUnit", stationId: str(stationId) };
  const gate = checkOrgChangeGate(data, { title: "—", reason: "—", effectiveDate: today, ops: [op] }, { today });
  return gate.ok ? { ok: true, op } : { ok: false, op, reason: { ar: gate.reason, en: gate.reasonEn || gate.reason } };
}

/** «تجميد المنصب» on an open seat — the patch the seat card would save (or why not). */
export function freezePatch(data, seatId, day = todayKey()) {
  const seat = (data?.orgSeats || []).find((s) => str(s.id) === str(seatId));
  if (!seat) return { ok: false, reason: NO_SEAT };
  const state = seatState(seat, data, day);
  if (state === "filled") return { ok: false, reason: FILLED_FREEZE };
  return { ok: true, patch: { state: state === "frozen" ? "" : "frozen" } };
}
