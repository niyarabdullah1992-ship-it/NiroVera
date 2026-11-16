/**
 * What HR can do from a card on the org chart — and where each action lands.
 *
 * Nothing here changes data. Every action routes to the screen that already owns it, with its own
 * gate: the seat card (OrgSeatRegister: seat state, deputy, dotted line, acting cover), a dated
 * change request (OrgChangesBoard: move / freeze / dotted line by decision, Art. 58 checks), the
 * authority matrix (OrgDoaBoard), the health findings (OrgHealthBoard), the branch drawer and the
 * hire drawer. A blocked action stays listed with the reason it is blocked.
 */

import { canEditOrgDesign, checkOrgChangeGate, deriveChangeImpact, deriveOrgHealth, orgDesignOf, todayKey } from "./orgDesign.js";
import { isCompanyRootStation, isHrUnit, isManagerUnit } from "./stationTree.js";

const str = (value) => String(value ?? "").trim();

/** Findings that are real problems on a card: a seat open past the alert, an acting role past the limit. */
const FLAG_KINDS = new Set(["VACANT", "ACTING_OVER_LIMIT"]);

/**
 * Per-card problem flags and finding counts, from the health findings.
 * @returns {Map<string, { flag: null | { kind, ar, en, days }, findings: number }>} by card key
 */
export function cardHealthIndex(tree, data, { day } = {}) {
  const out = new Map();
  if (!tree?.nodes?.size || !data) return out;
  const health = deriveOrgHealth(data, day ? { day } : {});
  const bySeat = new Map();
  const byPerson = new Map();
  tree.nodes.forEach((node) => {
    if (node.seatId) bySeat.set(node.seatId, node.key);
    if (node.employeeId) byPerson.set(node.employeeId, node.key);
  });
  health.items.forEach((item) => {
    const key = (item.seatId && bySeat.get(str(item.seatId))) || (item.employeeId && byPerson.get(str(item.employeeId))) || "";
    if (!key) return;
    const row = out.get(key) || { flag: null, findings: 0 };
    if (item.tone === "bad" || item.tone === "warn") row.findings += 1;
    if (!row.flag && FLAG_KINDS.has(item.kind) && (item.tone === "bad" || item.tone === "warn")) {
      row.flag = item.kind === "VACANT"
        ? { kind: item.kind, days: item.days, ar: `شاغر ${Number(item.days)} يوماً`, en: `Vacant ${item.days} days` }
        : { kind: item.kind, days: item.days, ar: "تكليف فوق الحد", en: "Acting over limit" };
    }
    out.set(key, row);
  });
  return out;
}

/** Authority rows a seat approves or receives escalations for. */
export function seatAuthorityCount(data, seatId) {
  const id = str(seatId);
  if (!id) return 0;
  return orgDesignOf(data).doa.filter((row) => str(row.approverSeatId) === id || str(row.escalateToSeatId) === id).length;
}

/**
 * The head seat of a fixed unit — the head office (HQ) or HR: never removed, ended or moved; only its
 * holder changes (or someone is assigned acting). Returns the unit, or null.
 */
export function fixedUnitHead(data, card) {
  const id = str(card?.employeeId);
  const stations = (data?.stations || []).filter((s) => !s.closedAt);
  const fixed = (s) => isCompanyRootStation(s) || isHrUnit(s);
  if (id && !card?.vacant) return stations.find((s) => fixed(s) && str(s.managerId) === id) || null;
  const st = stations.find((s) => str(s.id) === str(card?.stationId));
  return st && fixed(st) && !st.managerId ? st : null;
}
export const FIXED_UNIT = { ar: "وحدة ثابتة (المقر الرئيسي أو الموارد البشرية) — لا تُحذف ولا تُنهى ولا تُنقل؛ يتغيّر الشاغل فقط.", en: "A fixed unit (HQ or HR) — not removed, ended or moved; only the holder changes." };

/** The unit a person leads (a new seat there reports to them), or null. */
export function ledStation(data, card) {
  const id = str(card?.employeeId);
  if (!id || card?.vacant) return null;
  const led = (data?.stations || []).filter((s) => !s.closedAt && str(s.managerId) === id);
  return led.find((s) => str(s.id) === str(card.stationId)) || led[0] || null;
}

export const HIRE_BLOCK = {
  ar: "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه.",
  en: "A manager is not a hire workplace. Convert it to a branch, then hire there.",
};

export const EDIT_BLOCK = {
  ar: "التعديل على المناصب للمالك والموارد البشرية.",
  en: "Seat changes are made by the owner and HR.",
};

/**
 * The action menu of one card.
 * @param {object} card a focus-tree card (key, seatId, employeeId, stationId, vacant, state)
 * @param {{ data, user, canWrite, health?: { findings: number } }} ctx
 * @returns {Array<{ id, ar, en, group: "open"|"seat"|"decide"|"look", blocked: null | { ar, en }, count?: number }>}
 *   empty for viewers without HR rights — their card stays read-only.
 */
export function orgCardActions(card, { data, user, canWrite = false, health = null } = {}) {
  if (!card || !canWrite) return [];
  const canEdit = Boolean(user && data && canEditOrgDesign(user, data));
  const blocked = canEdit ? null : EDIT_BLOCK;
  const out = [];
  const add = (id, ar, en, group, extra = {}) => out.push({ id, ar, en, group, blocked: null, ...extra });

  // one card, one set of actions: file · move (branch to branch) · edit · acting (branch heads only) ·
  // access; hire when vacant; create a seat under a head; end the seat
  const led = ledStation(data, card);
  const filled = Boolean(card.employeeId && !card.vacant);
  const fixedHead = fixedUnitHead(data, card);
  if (filled) add("file", "ملف الموظف", "Employee file", "open");
  if (card.vacant && card.state === "vacant") add("hire", "تعيين على المنصب", "Hire into this seat", "seat");
  if (filled && !fixedHead) add("transfer", "نقل إلى فرع آخر", "Move to another branch", "seat", { blocked });
  if (card.seatId) add("seatEdit", "تعديل", "Edit", "seat", { blocked });
  if (led && card.seatId) add("acting", "تكليف بإدارة الفرع", "Acting branch head", "seat", { blocked });
  if (filled) add("perms", "الصلاحيات", "Access", "seat");
  if (led) add("addSeat", "إنشاء منصب تحته", "Create a seat under", "decide", { stationId: str(led.id), blocked: isManagerUnit(led) ? HIRE_BLOCK : null });
  if (card.seatId && filled && !fixedHead) add("vacate", "إنهاء التعيين في المنصب", "End the assignment", "decide", { blocked });
  if (card.seatId && card.vacant && !fixedHead) add("freeze", card.state === "frozen" ? "إعادة فتح المنصب" : "إنهاء المنصب", card.state === "frozen" ? "Reopen the seat" : "End the seat", "decide", { blocked });
  return out;
}

/**
 * Where an action opens in «الموارد البشرية › الهيكل» (/app/hr?tab=org — the admin panes read these
 * parameters once and drop them; a branch opens in «الفروع والمحطات»).
 * Returns "" for actions the chart handles itself (file, hire).
 */
export function orgAdminHref(actionId, card) {
  const seat = encodeURIComponent(str(card?.seatId));
  switch (actionId) {
    case "seat":
    case "acting":
      return `/app/hr?tab=org&pane=seats&seat=${seat}`;
    case "move":
      return `/app/hr?tab=org&pane=changes&op=moveSeat&seat=${seat}`;
    case "freeze":
      return `/app/hr?tab=org&pane=changes&op=freezeSeat&seat=${seat}`;
    case "dotted":
      return `/app/hr?tab=org&pane=changes&op=setDotted&seat=${seat}`;
    case "authority":
      return "/app/hr?tab=org&pane=authority";
    case "health":
      return "/app/hr?tab=org&pane=health";
    case "branch":
      return `/app/hr?tab=branches&branch=${encodeURIComponent(str(card?.stationId))}`;
    default:
      return "";
  }
}

/**
 * The change-request seed an /app/hr?tab=org&pane=changes&op=…&seat=…(&to=…),
 * ?op=reparentUnit&unit=…&to=… or ?op=closeUnit&unit=… link asks for, or null.
 */
export function changeSeedFromParams(params) {
  const op = str(params?.get?.("op"));
  const to = str(params?.get?.("to"));
  if (op === "reparentUnit" || op === "closeUnit") {
    const stationId = str(params?.get?.("unit"));
    if (!stationId) return null;
    return op === "reparentUnit" ? { type: op, stationId, ...(to ? { toParentId: to } : {}) } : { type: op, stationId };
  }
  const seatId = str(params?.get?.("seat"));
  if (!seatId || !["moveSeat", "freezeSeat", "setDotted"].includes(op)) return null;
  if (op === "freezeSeat") return { type: op, seatId, frozen: true };
  if (op === "moveSeat" && to) return { type: op, seatId, toStationId: to };
  return { type: op, seatId };
}

/** «الهيكل › التغييرات» link with one step pre-filled (never applies anything). */
export function changeRequestHref(op) {
  const q = new URLSearchParams({ tab: "org", pane: "changes", op: op.type });
  if (op.type === "reparentUnit" || op.type === "closeUnit") {
    q.set("unit", op.stationId);
    if (op.toParentId) q.set("to", op.toParentId);
  } else {
    q.set("seat", op.seatId);
    if (op.toStationId) q.set("to", op.toStationId);
  }
  return `/app/hr?${q.toString()}`;
}

/** Seats and units named in a change still awaiting approval or its effective date. */
export function pendingChangeIndex(data) {
  const seats = new Set();
  const stations = new Set();
  orgDesignOf(data).changes
    .filter((c) => c.status === "pending" || c.status === "approved")
    .forEach((c) => (c.ops || []).forEach((op) => {
      if (op.seatId) seats.add(str(op.seatId));
      if (op.toSeatId) seats.add(str(op.toSeatId));
      if (op.stationId) stations.add(str(op.stationId));
    }));
  return { seats, stations };
}

const blockedMove = (ar, en) => ({ ok: false, op: null, reason: { ar, en }, managerChanges: [] });

/**
 * «تغيير»: what moving `source` under `target` would request — the change step, whether the
 * existing gate lets it through (the Art. 58 residence question is answered in the request form),
 * and who changes manager. Nothing is applied: the step only pre-fills «التغييرات».
 * @param {object} source a person or branch card
 * @param {object} target a person or branch card
 * @param {{ data, user, isUnder?: (a: string, b: string) => boolean, today?: string }} ctx
 *   isUnder(a, b) — true when card `a` sits anywhere under card `b` on the chart
 */
export function planMove(source, target, { data, user, isUnder = () => false, today = todayKey() } = {}) {
  if (!source || !target) return blockedMove("اختر البطاقة الوجهة.", "Pick the target card.");
  if (!user || !data || !canEditOrgDesign(user, data)) return blockedMove(EDIT_BLOCK.ar, EDIT_BLOCK.en);
  if (source.key === target.key) return blockedMove("لا يُنقل منصب تحت نفسه.", "A card cannot move under itself.");
  if (isUnder(target.key, source.key)) return blockedMove("لا يُنقل تحت أحد من يتبعونه — حلقة تبعية.", "Not under someone who reports to it — circular reporting.");
  const stations = data?.stations || [];
  const byId = (id) => stations.find((s) => str(s.id) === str(id)) || null;
  // the unit the target leads (a person) or is (a branch)
  const targetUnit = target.kind === "branch" ? byId(target.stationId) : ledStation(data, target);
  let op;
  let note = null;
  if (source.kind === "branch") {
    if (!targetUnit) return blockedMove("الوجهة لا تقود وحدة — اختر فرعاً أو مديره.", "The target leads no unit — pick a branch or its manager.");
    op = { type: "reparentUnit", stationId: str(source.stationId), toParentId: str(targetUnit.id) };
  } else {
    if (!source.seatId) return blockedMove("لا منصب لهذه البطاقة في الهيكل — اربطها بمنصب أولاً.", "This card has no seat — link it to a seat first.");
    let unit = targetUnit;
    if (!unit) {
      unit = byId(target.stationId);
      if (unit) note = { ar: `«${target.name || target.title}» لا يقود وحدة؛ سيتبع المنصب مدير «${unit.name}».`, en: `${target.name || target.title} leads no unit; the seat will report to ${unit.name}'s manager.` };
    }
    if (!unit) return blockedMove("وحدة الوجهة غير معروفة.", "The target's unit is unknown.");
    op = { type: "moveSeat", seatId: str(source.seatId), toStationId: str(unit.id) };
  }
  const draft = { title: "—", reason: "—", effectiveDate: today, ops: [{ ...op, residence: "same" }] };
  const gate = checkOrgChangeGate(data, draft, { today });
  if (!gate.ok) return { ok: false, op, reason: { ar: gate.reason, en: gate.reasonEn || gate.reason }, managerChanges: [] };
  let managerChanges = [];
  try { managerChanges = deriveChangeImpact(data, draft, { day: today }).managerChanges; } catch { managerChanges = []; }
  const unitName = (op.type === "reparentUnit" ? byId(op.toParentId) : byId(op.toStationId))?.name || "";
  return { ok: true, op, unitName, note, managerChanges, art58: op.type === "moveSeat" };
}
