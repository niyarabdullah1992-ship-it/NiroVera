/**
 * What HR can do from a card on the org chart — and where each action lands.
 *
 * Nothing here changes data. Every action routes to the screen that already owns it, with its own
 * gate: the seat card (OrgSeatRegister: seat state, deputy, dotted line, acting cover), a dated
 * change request (OrgChangesBoard: move / freeze / dotted line by decision, Art. 58 checks), the
 * authority matrix (OrgDoaBoard), the health findings (OrgHealthBoard), the branch drawer and the
 * hire drawer. A blocked action stays listed with the reason it is blocked.
 */

import { canEditOrgDesign, deriveOrgHealth, orgDesignOf } from "./orgDesign.js";
import { isHrUnit } from "./stationTree.js";

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

const EDIT_BLOCK = {
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

  if (card.employeeId && !card.vacant) add("file", "ملف الموظف", "Employee file", "open");
  if (card.seatId) add("seat", "بطاقة المنصب", "Seat card", "open");
  if (card.vacant && card.state === "vacant") add("hire", "تعيين على المنصب", "Hire into this seat", "seat");
  if (card.vacant && card.seatId) {
    add("acting", "تكليف بالإنابة", "Acting cover", "seat", { blocked });
    add("freeze", "تجميد المنصب بقرار", "Freeze by decision", "decide", { blocked });
  }
  if (card.seatId) {
    add("move", "نقل المنصب أو تغيير التبعية بقرار", "Move / change reporting by decision", "decide", { blocked });
    add("dotted", "خط منقّط بقرار", "Dotted line by decision", "decide", { blocked });
  }
  const station = (data?.stations || []).find((s) => str(s.id) === str(card.stationId));
  if (station && !station.closedAt && !isHrUnit(station)) add("branch", "الفرع والوحدة", "Branch / unit", "open");
  if (card.seatId) add("authority", "الصلاحيات", "Authority", "look", { count: seatAuthorityCount(data, card.seatId) });
  add("health", "صحة الهيكل", "Structure health", "look", { count: Number(health?.findings || 0) });
  return out;
}

/**
 * Where an action opens on /app/org (the admin panes read these parameters once and drop them).
 * Returns "" for actions the chart handles itself (file, hire).
 */
export function orgAdminHref(actionId, card) {
  const seat = encodeURIComponent(str(card?.seatId));
  switch (actionId) {
    case "seat":
    case "acting":
      return `/app/org?view=admin&pane=seats&seat=${seat}`;
    case "move":
      return `/app/org?view=admin&pane=changes&op=moveSeat&seat=${seat}`;
    case "freeze":
      return `/app/org?view=admin&pane=changes&op=freezeSeat&seat=${seat}`;
    case "dotted":
      return `/app/org?view=admin&pane=changes&op=setDotted&seat=${seat}`;
    case "authority":
      return "/app/org?view=admin&pane=authority";
    case "health":
      return "/app/org?view=admin&pane=health";
    case "branch":
      return `/app/org?view=admin&chart=full&branch=${encodeURIComponent(str(card?.stationId))}`;
    default:
      return "";
  }
}

/** The change-request seed an /app/org?pane=changes&op=…&seat=… link asks for, or null. */
export function changeSeedFromParams(params) {
  const op = str(params?.get?.("op"));
  const seatId = str(params?.get?.("seat"));
  if (!seatId || !["moveSeat", "freezeSeat", "setDotted"].includes(op)) return null;
  return op === "freezeSeat" ? { type: op, seatId, frozen: true } : { type: op, seatId };
}
