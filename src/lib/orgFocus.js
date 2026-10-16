/**
 * Focused org chart — "my card first". One person (or seat) is the focus; around it sit the
 * manager chain above (a breadcrumb up to the top), the direct reports below, and the peers
 * under the same manager. Everything here is derived from the live seat chart; nothing is stored.
 *
 * Visibility is enforced in the data, not only on screen: a viewer outside HR/owner ("mine")
 * receives a pruned tree — their manager chain, themselves, their peers and their own subtree —
 * and every node is reduced to names, titles, units, seat codes and seat state.
 */

import { buildWorkforceSeatChart } from "./workforceSeatChart.js";
import { seatCode, seatState, todayKey } from "./orgDesign.js";
import { stationParentId } from "./stationTree.js";

const str = (value) => String(value ?? "").trim();

/** Keep only what a card shows. File data (employee numbers, hire dates, grades) never travels. */
const CARD_FIELDS = ["key", "id", "seatId", "employeeId", "stationId", "name", "title", "unit", "seatCode", "state", "vacant", "isMe", "avatarUrl", "dottedToKey"];

export const FOCUS_STATE_LABELS = {
  vacant: { ar: "شاغر", en: "Vacant" },
  acting: { ar: "مكلَّف", en: "Acting" },
  frozen: { ar: "مجمّد", en: "Frozen" },
  planned: { ar: "مخطط", en: "Planned" },
};

/** The state chip appears only when it means something: a filled seat says nothing. */
export function focusStateLabel(state, ar = true) {
  const row = FOCUS_STATE_LABELS[state];
  if (!row) return "";
  return ar ? row.ar : row.en;
}

function unitNameOf(data, stationId) {
  const station = (data?.stations || []).find((row) => str(row.id) === str(stationId));
  return str(station?.name);
}

/**
 * The tree every focus view reads.
 * @param {object} data company data
 * @param {{ viewerId?: string, scope?: "all"|"mine", ar?: boolean, day?: string }} opts
 * @returns {{ nodes: Map<string, object>, roots: string[], viewerKey: string, scope: string }}
 */
export function buildOrgFocusTree(data, { viewerId = "", scope = "mine", ar = true, day = todayKey() } = {}) {
  const chart = buildWorkforceSeatChart(data, { ar, meId: viewerId });
  const seats = new Map((data?.orgSeats || []).map((seat) => [str(seat.id), seat]));
  const people = new Map((data?.employees || []).map((row) => [str(row.id), row]));
  const nodes = new Map();
  const roots = [];

  const toFocus = (raw, parentKey) => {
    const seat = raw.seatId ? seats.get(str(raw.seatId)) : null;
    const key = str(raw.seatId) || str(raw.id);
    const person = raw.employeeId ? people.get(str(raw.employeeId)) : null;
    // The unit a card names is where the seat sits (else the person's home), not the unit they lead.
    const homeStationId = str(seat?.stationId || person?.stationId || person?.profile?.stationId || raw.stationId);
    if (nodes.has(key)) return null;
    let state = "filled";
    if (raw.vacant) state = seat ? seatState(seat, data, day) : "vacant";
    else if (raw.acting) state = "acting";
    const node = {
      key,
      id: str(raw.id),
      seatId: str(raw.seatId),
      employeeId: str(raw.employeeId),
      stationId: homeStationId,
      name: raw.vacant ? "" : str(raw.name),
      title: str(raw.title),
      unit: unitNameOf(data, homeStationId),
      seatCode: seat ? seatCode(seat, data) : "",
      state,
      vacant: Boolean(raw.vacant),
      isMe: Boolean(viewerId) && str(raw.employeeId) === str(viewerId),
      avatarUrl: raw.vacant ? "" : str(raw.avatarUrl),
      // a dotted (matrix) line to another seat — counted on that seat's card as «مصفوفة»
      dottedToKey: str(seat?.dottedToSeatId),
      parentKey: parentKey || "",
      childKeys: [],
    };
    nodes.set(key, node);
    (raw.children || []).forEach((child) => {
      const made = toFocus(child, key);
      if (made) node.childKeys.push(made.key);
    });
    return node;
  };
  (chart.roots || []).forEach((raw) => {
    const made = toFocus(raw, "");
    if (made) roots.push(made.key);
  });

  const viewerKey = viewerId
    ? ([...nodes.values()].find((node) => node.employeeId && node.employeeId === str(viewerId))?.key || "")
    : "";

  if (scope === "all") return { nodes, roots, viewerKey, scope };
  return pruneToViewer({ nodes, roots, viewerKey }, scope);
}

/** Ancestors of a key, nearest first. */
function ancestorsOf(nodes, key) {
  const out = [];
  const seen = new Set([key]);
  let cursor = nodes.get(key)?.parentKey || "";
  while (cursor && !seen.has(cursor) && nodes.has(cursor)) {
    seen.add(cursor);
    out.push(cursor);
    cursor = nodes.get(cursor).parentKey || "";
  }
  return out;
}

function descendantsOf(nodes, key) {
  const out = [];
  const stack = [...(nodes.get(key)?.childKeys || [])];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur) || !nodes.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...nodes.get(cur).childKeys);
  }
  return out;
}

/**
 * What an employee may see: the chain above them, themselves, the people beside them under the
 * same manager, and everything under them (open seats included). Nothing else leaves this function.
 */
export function visibleKeysFor(tree, viewerKey) {
  const { nodes } = tree;
  if (!viewerKey || !nodes.has(viewerKey)) return new Set();
  const me = nodes.get(viewerKey);
  const keep = new Set([viewerKey, ...ancestorsOf(nodes, viewerKey), ...descendantsOf(nodes, viewerKey)]);
  const siblings = me.parentKey ? nodes.get(me.parentKey)?.childKeys || [] : [];
  siblings.forEach((key) => {
    const peer = nodes.get(key);
    if (peer && !peer.vacant) keep.add(key);
  });
  return keep;
}

function pruneToViewer(tree, scope) {
  const keep = visibleKeysFor(tree, tree.viewerKey);
  const nodes = new Map();
  keep.forEach((key) => {
    const src = tree.nodes.get(key);
    const node = {};
    CARD_FIELDS.forEach((field) => { node[field] = src[field]; });
    if (!keep.has(node.dottedToKey)) node.dottedToKey = ""; // a line into a hidden branch says nothing
    node.parentKey = keep.has(src.parentKey) ? src.parentKey : "";
    node.childKeys = src.childKeys.filter((child) => keep.has(child));
    nodes.set(key, node);
  });
  const roots = [...nodes.values()].filter((node) => !node.parentKey).map((node) => node.key);
  return { nodes, roots, viewerKey: tree.viewerKey, scope };
}

/** A focus asked for by seat id, node id or employee id — or the viewer, or the first root. */
export function resolveFocusKey(tree, wanted) {
  const want = str(wanted);
  if (want) {
    if (tree.nodes.has(want)) return want;
    for (const node of tree.nodes.values()) {
      if (node.id === want || node.employeeId === want || node.seatId === want || `seat:${node.seatId}` === want) return node.key;
    }
  }
  if (tree.viewerKey && tree.nodes.has(tree.viewerKey)) return tree.viewerKey;
  return tree.roots[0] || "";
}

/** A card as the screen needs it: the node plus how many report to it. */
export function focusCard(tree, key) {
  const node = tree.nodes.get(key);
  if (!node) return null;
  const reports = node.childKeys.length;
  return { ...node, reports, people: node.childKeys.filter((k) => !tree.nodes.get(k)?.vacant).length };
}

/**
 * People before open seats; then by name/title so the order is stable. A node may carry an
 * `order` rank (the branches view: regions, then branches, then the branch's people) — it wins.
 */
export function orderKeys(tree, keys) {
  return [...keys].sort((a, b) => {
    const x = tree.nodes.get(a);
    const y = tree.nodes.get(b);
    if ((x.order || 0) !== (y.order || 0)) return (x.order || 0) - (y.order || 0);
    if (x.vacant !== y.vacant) return x.vacant ? 1 : -1;
    return (x.name || x.title).localeCompare(y.name || y.title, "ar");
  });
}

/**
 * The neighbourhood around one card.
 * @returns {{ focus, manager, chain: object[], reports: object[], peers: object[] } | null}
 *   chain runs from the top down to the manager (the breadcrumb); peers exclude the focus.
 */
export function deriveFocusNeighborhood(tree, key) {
  const focus = focusCard(tree, key);
  if (!focus) return null;
  const chain = ancestorsOf(tree.nodes, key).reverse().map((k) => focusCard(tree, k));
  const manager = chain.length ? chain[chain.length - 1] : null;
  const reports = orderKeys(tree, focus.childKeys).map((k) => focusCard(tree, k));
  const siblingKeys = manager ? manager.childKeys : tree.roots;
  const peers = orderKeys(tree, siblingKeys.filter((k) => k !== key)).map((k) => focusCard(tree, k));
  return { focus, manager, chain, reports, peers };
}

/**
 * Keyboard moves: "up" = manager, "down" = first report, "prev"/"next" = the peer before/after
 * in the row (the focus sits in its sibling order). Returns the next key or "" when there is none.
 */
export function focusMove(tree, key, dir) {
  const node = tree.nodes.get(key);
  if (!node) return "";
  if (dir === "up") return node.parentKey || "";
  if (dir === "down") return orderKeys(tree, node.childKeys)[0] || "";
  if (dir === "prev" || dir === "next") {
    const row = orderKeys(tree, node.parentKey ? tree.nodes.get(node.parentKey).childKeys : tree.roots);
    const at = row.indexOf(key);
    if (at < 0 || row.length < 2) return "";
    const next = dir === "next" ? at + 1 : at - 1;
    return row[next] || "";
  }
  return "";
}

/** Arabic-tolerant fold: no diacritics/tatweel, one alef, ى→ي, ة→ه, Latin lower-case. */
export function foldSearch(value) {
  return str(value)
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

/** Search name, title, seat code and unit. Exact-start matches first. Only visible nodes are searched. */
export function searchFocusTree(tree, query, limit = 8) {
  const needle = foldSearch(query);
  if (!needle) return [];
  const hits = [];
  tree.nodes.forEach((node) => {
    const fields = [node.name, node.title, node.seatCode, node.unit].map(foldSearch);
    const at = fields.findIndex((field) => field.includes(needle));
    if (at < 0) return;
    const starts = fields.some((field) => field.startsWith(needle));
    hits.push({ node, rank: (starts ? 0 : 10) + at + (node.vacant ? 5 : 0) });
  });
  return hits
    .sort((a, b) => a.rank - b.rank || (a.node.name || a.node.title).localeCompare(b.node.name || b.node.title, "ar"))
    .slice(0, limit)
    .map((hit) => focusCard(tree, hit.node.key));
}

/**
 * A viewer who is not on the chart (no seat, released from the chart): their unit and the person
 * who manages that unit, so the page can still say where they belong.
 */
export function unseatedPlace(data, viewerId) {
  const id = str(viewerId);
  const me = (data?.employees || []).find((row) => str(row.id) === id);
  if (!me) return null;
  const stations = data?.stations || [];
  const stationId = str(me.stationId || me.profile?.stationId);
  const station = stations.find((row) => str(row.id) === stationId) || null;
  let managerId = str(me.profile?.directManagerId || me.directManagerId);
  if (!managerId || managerId === id) {
    let cursor = station;
    const seen = new Set();
    while (cursor && !seen.has(str(cursor.id))) {
      seen.add(str(cursor.id));
      const mid = str(cursor.managerId);
      if (mid && mid !== id) { managerId = mid; break; }
      const parentId = str(stationParentId(cursor));
      cursor = parentId ? stations.find((row) => str(row.id) === parentId) : null;
    }
  }
  const manager = managerId ? (data?.employees || []).find((row) => str(row.id) === managerId) : null;
  return {
    name: str(me.name),
    title: str(me.profile?.position || me.jobTitle || me.position),
    unit: str(station?.name),
    managerName: str(manager?.name),
    managerId: manager ? str(manager.id) : "",
  };
}
