/**
 * The org chart layout — one tree for /app/org/chart and the people tree in «الفروع والدليل».
 *
 * The viewer opens any number of cards; each opened card lays its direct reports out under it in
 * neat rows joined by a trunk and a bus line (SAP-style), and opening one never closes another.
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

/* ───────────────────── many branches open at once ─────────────────────
 * The chart keeps a Set of opened cards. Opening one never closes another: every opened card
 * shows its direct reports under it as neat rows (up to maxCols per row), and the rows reflow so
 * no two subtrees overlap. Geometry is logical (x from the inline start), so RTL and LTR share it.
 */

/** Opened by default: the chain from the top down to `key`, and `key` itself when it leads people. */
export function defaultExpanded(tree, key) {
  const out = new Set();
  if (!key || !tree?.nodes?.has(key)) {
    (tree?.roots || []).forEach((root) => { if (tree.nodes.get(root)?.childKeys.length) out.add(root); });
    return out;
  }
  const path = pathTo(tree, key);
  path.slice(0, -1).forEach((k) => out.add(k));
  if (tree.nodes.get(key).childKeys.length) out.add(key);
  return out;
}

/** The same set plus every manager above `key`, so the card is on screen. Nothing is closed. */
export function revealPath(expanded, tree, key) {
  const next = new Set(expanded || []);
  if (!tree?.nodes?.has(key)) return next;
  pathTo(tree, key).slice(0, -1).forEach((k) => next.add(k));
  return next;
}

/** Open or close one card; every other opened card stays as it is. */
export function toggleExpanded(expanded, key) {
  const next = new Set(expanded || []);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * «توسيع الكل» — opens level by level (top first) while the cards on screen stay under `limit`,
 * so a company of thousands does not freeze the page. `capped` says a level was left closed.
 */
export function expandAllKeys(tree, limit = 600) {
  const out = new Set();
  let shown = (tree?.roots || []).length;
  let level = [...(tree?.roots || [])];
  let capped = false;
  while (level.length && !capped) {
    const next = [];
    for (const key of level) {
      const kids = tree.nodes.get(key)?.childKeys || [];
      if (!kids.length) continue;
      if (shown + kids.length > limit) { capped = true; break; }
      out.add(key);
      shown += kids.length;
      next.push(...kids);
    }
    level = next;
  }
  return { expanded: out, capped, shown };
}

/** A stored set (sessionStorage) back to keys that still exist and lead someone. */
export function readExpanded(raw, tree) {
  let list = raw;
  if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { list = null; }
  }
  if (!Array.isArray(list)) return null;
  return new Set(list.filter((k) => typeof k === "string" && tree?.nodes?.get(k)?.childKeys.length));
}

/** Layout spacing at 100% zoom (px). */
export const EXPAND_GEOMETRY = Object.freeze({ cardH: 92, compactCardH: 70, rowGap: 32, indent: 40 });

/** Card height for the chosen card options (fixed so the layout is exact). */
export function cardHeight(options = {}, compact = false) {
  let h = compact ? EXPAND_GEOMETRY.compactCardH : EXPAND_GEOMETRY.cardH;
  if (options.unit) h += 18;
  if (options.seatCode) h += 18;
  return h;
}

/**
 * Lay out every visible card.
 * @param {object} tree from buildOrgFocusTree
 * @param {Set<string>} expanded opened cards
 * @param {object} opts geometry; childLimit — reports shown per opened card before «+n»
 *   (showAll — cards whose whole team the viewer asked for)
 * @returns {{ cards: Array<{ key, x, y, depth, parentKey, expanded, kids }>, lines: Array<{ x, y, w, h }>,
 *   width: number, height: number, index: Map<string, object> }}
 *   x/y are the card's top inline-start corner; lines are 0-width (vertical) or 0-height (horizontal).
 */
export function layoutOrgTree(tree, expanded = new Set(), {
  cardW = TREE_GEOMETRY.cardW,
  cardH = EXPAND_GEOMETRY.cardH,
  gap = TREE_GEOMETRY.gap,
  rowGap = EXPAND_GEOMETRY.rowGap,
  indent = EXPAND_GEOMETRY.indent,
  maxCols = TREE_GEOMETRY.maxCols,
  childLimit = Infinity,
  showAll = new Set(),
} = {}) {
  const rowMax = gridWidth(Math.max(1, maxCols), { cardW, gap });
  const trunkX = Math.round(indent / 2);
  const seen = new Set();

  /** Pack boxes into rows: in order, a box that no longer fits starts the next row. */
  const pack = (boxes, x0, y0) => {
    const rows = [];
    let row = [];
    let used = 0;
    boxes.forEach((box) => {
      const need = row.length ? used + gap + box.w : box.w;
      if (row.length && need > rowMax) { rows.push(row); row = []; used = 0; }
      used = row.length ? used + gap + box.w : box.w;
      row.push(box);
    });
    if (row.length) rows.push(row);
    let y = y0;
    let width = 0;
    const placed = rows.map((items) => {
      let x = x0;
      const top = y;
      let h = 0;
      items.forEach((box) => { box.dx = x; box.dy = top; x += box.w + gap; h = Math.max(h, box.h); });
      width = Math.max(width, x - gap - x0);
      y = top + h + rowGap;
      return { items, top, h };
    });
    return { rows: placed, width, bottom: y - rowGap };
  };

  const pseudo = (key, extra, depth, parentKey) => ({
    w: cardW, h: cardH, cards: [{ key, x: 0, y: 0, depth, parentKey, expanded: false, kids: 0, ...extra }], lines: [],
  });

  /** One subtree in its own coordinates (card at 0,0). */
  const box = (key, depth, parentKey) => {
    seen.add(key);
    const node = tree.nodes.get(key);
    const kids = orderKeys(tree, node.childKeys.filter((k) => tree.nodes.has(k) && !seen.has(k)));
    const open = expanded.has(key) && kids.length > 0;
    const self = { key, x: 0, y: 0, depth, parentKey, expanded: open, kids: kids.length };
    if (!open) return { w: cardW, h: cardH, cards: [self], lines: [] };
    const limit = showAll.has(key) ? Infinity : Math.max(1, childLimit);
    const subs = kids.slice(0, limit).map((k) => box(k, depth + 1, key));
    const hidden = kids.length - subs.length;
    // a long team folds into «+n»; once shown in full it ends with «طيّ» (both are buttons, not people)
    if (hidden > 0) subs.push(pseudo(`${key}::more`, { more: hidden }, depth + 1, key));
    else if (Number.isFinite(childLimit) && kids.length > childLimit) subs.push(pseudo(`${key}::less`, { less: true }, depth + 1, key));
    const { rows, width, bottom } = pack(subs, indent, cardH + rowGap);
    const cards = [self];
    const lines = [];
    let lastBus = cardH;
    rows.forEach(({ items, top }, r) => {
      const bus = top - rowGap / 2;
      const lastMid = items[items.length - 1].dx + cardW / 2;
      lines.push({ id: `${key}:bus${r}`, x: trunkX, y: bus, w: lastMid - trunkX, h: 0 });
      items.forEach((sub) => {
        lines.push({ id: `${sub.cards[0].key}:tick`, x: sub.dx + cardW / 2, y: bus, w: 0, h: top - bus });
        sub.cards.forEach((c) => cards.push({ ...c, x: c.x + sub.dx, y: c.y + sub.dy }));
        sub.lines.forEach((l) => lines.push({ ...l, x: l.x + sub.dx, y: l.y + sub.dy }));
      });
      lastBus = bus;
    });
    lines.unshift({ id: `${key}:trunk`, x: trunkX, y: cardH, w: 0, h: lastBus - cardH });
    return { w: Math.max(cardW, indent + width), h: bottom, cards, lines };
  };

  const roots = orderKeys(tree, (tree?.roots || []).filter((k) => tree.nodes.has(k)));
  const tops = roots.map((k) => box(k, 0, ""));
  const { width, bottom } = tops.length ? pack(tops, 0, 0) : { width: 0, bottom: 0 };
  const cards = [];
  const lines = [];
  tops.forEach((top) => {
    top.cards.forEach((c) => cards.push({ ...c, x: c.x + top.dx, y: c.y + top.dy }));
    top.lines.forEach((l) => lines.push({ ...l, x: l.x + top.dx, y: l.y + top.dy }));
  });
  return { cards, lines, width, height: Math.max(0, bottom), index: new Map(cards.map((c) => [c.key, c])) };
}

/** A card with its counts, ready for the screen. */
export function chartCard(tree, counts, key) {
  return cardOf(tree, counts, key);
}

/** «44 / 5597» — direct / total. Figures read as the platform's: Latin digits (mono, dir=ltr) in either language. */
export function countLine({ direct = 0, total = 0 } = {}, ar = true) {
  if (!direct && !total) return "";
  return `${Number(direct)} / ${Number(total)}`;
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
