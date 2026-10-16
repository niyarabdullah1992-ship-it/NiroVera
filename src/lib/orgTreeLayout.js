/**
 * The whole tree with one focus — the layout behind the full-screen org chart (/app/org/chart).
 *
 * Reading order, top to bottom:
 *   • the chain: every manager from the top of the structure down to the focused card, one card
 *     per level, joined by a line;
 *   • beside each chain card: the other people under the same manager (its siblings), as a grid;
 *   • under the focused card: its direct reports, as a grid joined by a line.
 *
 * Counts on every card are derived from the same tree the viewer receives (an employee's pruned
 * tree counts only what they may see): direct = filled seats directly under the card,
 * total = filled seats anywhere under it, matrix = seats with a dotted line to it.
 * Nothing here touches the DOM; geometry is plain numbers so the screen and the tests agree.
 */

import { focusCard, orderKeys } from "./orgFocus.js";

/** One card width, gaps and the chain column — px at 100% zoom. */
export const TREE_GEOMETRY = Object.freeze({
  cardW: 248,
  compactCardW: 212,
  gap: 12,
  chainW: 264,
  colGap: 40,
  maxCols: 4,
});

/**
 * direct / total / matrix for every key, in one pass from the leaves up.
 * @returns {Map<string, { direct: number, total: number, matrix: number, open: number }>}
 */
export function treeCounts(tree) {
  const counts = new Map();
  const nodes = tree?.nodes || new Map();
  nodes.forEach((node, key) => counts.set(key, { direct: 0, total: 0, matrix: 0, open: 0 }));
  // post-order without recursion (deep trees stay safe)
  const order = [];
  const seen = new Set();
  const stack = [...(tree?.roots || [])];
  nodes.forEach((node, key) => { if (!node.parentKey || !nodes.has(node.parentKey)) stack.push(key); });
  while (stack.length) {
    const key = stack.pop();
    if (seen.has(key) || !nodes.has(key)) continue;
    seen.add(key);
    order.push(key);
    stack.push(...nodes.get(key).childKeys);
  }
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const key = order[i];
    const node = nodes.get(key);
    const row = counts.get(key);
    node.childKeys.forEach((child) => {
      const kid = nodes.get(child);
      if (!kid) return;
      const sub = counts.get(child);
      if (kid.vacant) row.open += 1;
      else { row.direct += 1; row.total += 1; }
      row.total += sub.total;
    });
  }
  nodes.forEach((node) => {
    const to = String(node.dottedToKey || "");
    if (to && to !== node.key && counts.has(to) && !node.vacant) counts.get(to).matrix += 1;
  });
  return counts;
}

/** Columns a grid of n cards takes (1…maxCols). */
export function columnsFor(n, maxCols = TREE_GEOMETRY.maxCols) {
  return Math.max(1, Math.min(Math.max(1, Math.floor(maxCols) || 1), n || 1));
}

/** Width in px of a grid of `cols` columns. */
export function gridWidth(cols, { cardW = TREE_GEOMETRY.cardW, gap = TREE_GEOMETRY.gap } = {}) {
  return cols * cardW + Math.max(0, cols - 1) * gap;
}

function cardOf(tree, counts, key) {
  const card = focusCard(tree, key);
  if (!card) return null;
  const c = counts.get(key) || { direct: 0, total: 0, matrix: 0, open: 0 };
  return { ...card, direct: c.direct, total: c.total, matrix: c.matrix, open: c.open };
}

/** The keys from the top of the structure down to `key` (inclusive). */
export function pathTo(tree, key) {
  const out = [];
  const seen = new Set();
  let cursor = key;
  while (cursor && tree.nodes.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    out.unshift(cursor);
    cursor = tree.nodes.get(cursor).parentKey || "";
  }
  return out;
}

/**
 * The full tree around one focus.
 * @param {object} tree from buildOrgFocusTree
 * @param {string} focusKey
 * @param {{ counts?: Map, siblingLimit?: number, openLevels?: Set<string>, maxCols?: number }} opts
 *   siblingLimit — siblings shown per chain level before «+n» (Infinity shows all);
 *   openLevels — chain keys whose sibling grid the viewer opened in full.
 * @returns {null | {
 *   levels: Array<{ key, card, siblings, hidden, cols, depth }>,
 *   focus, reports, reportCols, path: string[], rendered: number
 * }}
 */
export function deriveTreeView(tree, focusKey, {
  counts = null,
  siblingLimit = 8,
  openLevels = new Set(),
  maxCols = TREE_GEOMETRY.maxCols,
} = {}) {
  if (!tree?.nodes?.has(focusKey)) return null;
  const tally = counts || treeCounts(tree);
  const path = pathTo(tree, focusKey);
  let rendered = 0;
  const levels = path.map((key, depth) => {
    const node = tree.nodes.get(key);
    const rowKeys = node.parentKey && tree.nodes.has(node.parentKey) ? tree.nodes.get(node.parentKey).childKeys : tree.roots;
    const siblingKeys = orderKeys(tree, rowKeys.filter((k) => k !== key && tree.nodes.has(k)));
    const limit = openLevels.has(key) ? Infinity : siblingLimit;
    const shown = siblingKeys.slice(0, Number.isFinite(limit) ? Math.max(0, limit) : undefined);
    const siblings = shown.map((k) => cardOf(tree, tally, k));
    rendered += 1 + siblings.length;
    return {
      key,
      depth,
      card: cardOf(tree, tally, key),
      siblings,
      hidden: siblingKeys.length - siblings.length,
      cols: siblings.length ? columnsFor(siblings.length, maxCols) : 0,
    };
  });
  const focus = levels[levels.length - 1].card;
  const reports = orderKeys(tree, tree.nodes.get(focusKey).childKeys.filter((k) => tree.nodes.has(k))).map((k) => cardOf(tree, tally, k));
  rendered += reports.length;
  return {
    levels,
    focus,
    reports,
    reportCols: reports.length ? columnsFor(reports.length, maxCols) : 0,
    path,
    rendered,
  };
}

/** «٤٤ / ٥٥٩٧» — direct / total, digits in the reader's script. */
export function countLine({ direct = 0, total = 0 } = {}, ar = true) {
  if (!direct && !total) return "";
  const fmt = (n) => (ar ? Number(n).toLocaleString("ar-SA") : String(n));
  return `${fmt(direct)} / ${fmt(total)}`;
}

/** Zoom steps the toolbar walks through (fractions of 1). */
export const ZOOM_STEPS = Object.freeze([0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.5]);

export function stepZoom(current, dir) {
  const z = Number(current) || 1;
  if (dir > 0) return ZOOM_STEPS.find((s) => s > z + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((s) => s < z - 1e-6) ?? ZOOM_STEPS[0];
}

export function clampZoom(value) {
  const z = Number(value);
  if (!Number.isFinite(z)) return 1;
  return Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], Math.round(z * 100) / 100));
}

/**
 * Card display options (the settings gear). Unknown or missing keys fall back to defaults so a
 * stored blob from an older version never breaks the page.
 */
export const TREE_OPTION_DEFAULTS = Object.freeze({ seatCode: false, counts: true, unit: false, density: "comfortable" });

export function readTreeOptions(raw) {
  let value = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { value = null; }
  }
  const out = { ...TREE_OPTION_DEFAULTS };
  if (value && typeof value === "object") {
    ["seatCode", "counts", "unit"].forEach((k) => { if (typeof value[k] === "boolean") out[k] = value[k]; });
    if (value.density === "compact" || value.density === "comfortable") out.density = value.density;
  }
  return out;
}
