/**
 * The org chart layout — one tree for /app/org/chart and the people tree in «الفروع والدليل».
 *
 * SAP SuccessFactors-style: the manager chain to the focus as a vertical stack, every other team
 * as a dense grid block under one drop; the viewer opens any number of cards, and opening one
 * never closes another.
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
 * shows its team under it (see layoutOrgTree), and the blocks reflow so no two overlap.
 * Geometry is logical (x from the inline start), so RTL and LTR share it.
 */

/**
 * Opened by default (SAP): `key`'s manager — so `key` stands among its peers — and `key` itself
 * when it leads people. The chain above reads as a vertical stack through the focus path.
 */
export function defaultExpanded(tree, key) {
  const out = new Set();
  if (!key || !tree?.nodes?.has(key)) {
    (tree?.roots || []).forEach((root) => { if (tree.nodes.get(root)?.childKeys.length) out.add(root); });
    return out;
  }
  const parent = tree.nodes.get(key).parentKey;
  if (parent && tree.nodes.has(parent)) out.add(parent);
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
export const EXPAND_GEOMETRY = Object.freeze({ cardH: 100, compactCardH: 74, rowGap: 40, indent: 40 });

/** Card height for the chosen card options (fixed so the layout is exact). */
export function cardHeight(options = {}, compact = false) {
  let h = compact ? EXPAND_GEOMETRY.compactCardH : EXPAND_GEOMETRY.cardH;
  if (options.unit) h += 18;
  if (options.seatCode) h += 18;
  return h;
}

/** Grid columns for a block of n cards: about √n, 2…cap (one card → one column). */
export function gridCols(n, cap = TREE_GEOMETRY.maxCols) {
  const max = Math.max(1, Math.floor(cap) || 1);
  if (n <= 1 || max === 1) return 1;
  return Math.max(2, Math.min(max, Math.ceil(Math.sqrt(n))));
}

/**
 * SAP-style layout of every visible card.
 *
 * Under an opened card, its reports split in two: those that are themselves opened, or on the
 * path to the focus, stand as their own columns (their teams below them); all the others are
 * packed into ONE grid block of equal cards (≈√n columns; the focus's own team: `focusCols`),
 * reached by a single drop from the bus — no line per card. A card on the focus path that is
 * not opened shows only the next card of the path, so the manager chain reads as a straight
 * vertical stack. The parent is centred over its groups; the root sits centred at the top.
 * `stack` (phones): the groups go one under another, each joined to a trunk on the start side.
 *
 * @param {object} tree from buildOrgFocusTree / buildBranchTree
 * @param {Set<string>} expanded opened cards
 * @param {object} opts geometry; focusKey; childLimit — cards per grid before «+n»
 *   (showAll — cards whose whole team the viewer asked for); addSlot(key) — true where the
 *   management tree offers «+ إضافة بطاقة هنا» (`${key}::add`, a cell with `add: true`)
 * @returns {{ cards: Array<{ key, x, y, depth, parentKey, expanded, kids, inGrid?, more?, less? }>,
 *   lines: Array<{ id, x, y, w, h }>, width: number, height: number, index: Map<string, object> }}
 *   x/y are the card's top inline-start corner; lines are 0-width (vertical) or 0-height (horizontal).
 */
export function layoutOrgTree(tree, expanded = new Set(), {
  cardW = TREE_GEOMETRY.cardW,
  cardH = EXPAND_GEOMETRY.cardH,
  gap = TREE_GEOMETRY.gap,
  rowGap = EXPAND_GEOMETRY.rowGap,
  groupGap = 40,
  indent = EXPAND_GEOMETRY.indent,
  maxCols = TREE_GEOMETRY.maxCols,
  focusCols = 4,
  focusKey = "",
  stack = false,
  childLimit = Infinity,
  showAll = new Set(),
  addSlot = null,
} = {}) {
  const onPath = new Set(focusKey && tree?.nodes?.has(focusKey) ? pathTo(tree, focusKey) : []);
  const seen = new Set();
  const hasKids = (k) => (tree.nodes.get(k)?.childKeys || []).some((c) => tree.nodes.has(c));
  const card = (key, depth, parentKey, extra = {}) => ({ key, x: 0, y: 0, depth, parentKey, expanded: false, kids: 0, ...extra });

  /** A grid block of cards (and «+n» / «طيّ») at 0,0. */
  const gridBlock = (keys, depth, parentKey, cols) => {
    const cells = keys.map((k) => {
      seen.add(k);
      return card(k, depth, parentKey, { inGrid: true, kids: (tree.nodes.get(k)?.childKeys || []).length });
    });
    const c = Math.max(1, Math.min(cols, cells.length));
    const rows = Math.ceil(cells.length / c);
    cells.forEach((cell, i) => { cell.x = (i % c) * (cardW + gap); cell.y = Math.floor(i / c) * (cardH + gap); });
    return { w: c * cardW + (c - 1) * gap, h: rows * cardH + (rows - 1) * gap, cards: cells, lines: [], px: null };
  };

  /** One subtree in its own coordinates. `px` is the x of its own card inside the box. */
  const box = (key, depth, parentKey) => {
    seen.add(key);
    const node = tree.nodes.get(key);
    const kids = orderKeys(tree, node.childKeys.filter((k) => tree.nodes.has(k) && !seen.has(k)));
    const open = expanded.has(key) && kids.length > 0;
    const self = card(key, depth, parentKey, { expanded: open, kids: kids.length });
    const pathKid = onPath.has(key) && key !== focusKey ? kids.find((k) => onPath.has(k)) : "";
    // «+ إضافة بطاقة هنا» (management tree): the last cell of an opened team, or alone under a focused leaf
    const plus = typeof addSlot === "function" && addSlot(key) && (open || (key === focusKey && !kids.length));
    if (!open && !pathKid && !plus) return { w: cardW, h: cardH, cards: [self], lines: [], px: 0 };

    const asColumn = open ? kids.filter((k) => onPath.has(k) || (expanded.has(k) && hasKids(k))) : (pathKid ? [pathKid] : []);
    const inGrid = open ? kids.filter((k) => !asColumn.includes(k)) : [];
    const groups = [];
    if (!inGrid.length && plus) {
      groups.push({ w: cardW, h: cardH, cards: [card(`${key}::add`, depth + 1, key, { inGrid: true, add: true })], lines: [], px: 0, kind: "grid", dropAt: cardW / 2 });
    }
    if (inGrid.length) {
      const limit = showAll.has(key) ? Infinity : Math.max(1, childLimit);
      const shown = inGrid.slice(0, limit);
      const g = gridBlock(shown, depth + 1, key, key === focusKey ? Math.min(focusCols, maxCols) : gridCols(shown.length, maxCols));
      const hidden = inGrid.length - shown.length;
      const extra = hidden > 0 ? { key: `${key}::more`, more: hidden } : (Number.isFinite(childLimit) && inGrid.length > childLimit ? { key: `${key}::less`, less: true } : null);
      if (extra) {
        // the fold card takes the next cell of the block
        const c = Math.max(1, Math.round((g.w + gap) / (cardW + gap)));
        const i = g.cards.length;
        const cell = card(extra.key, depth + 1, key, { inGrid: true, ...extra, x: (i % c) * (cardW + gap), y: Math.floor(i / c) * (cardH + gap) });
        g.cards.push(cell);
        g.h = Math.max(g.h, cell.y + cardH);
      }
      if (plus) {
        const c = Math.max(1, Math.round((g.w + gap) / (cardW + gap)));
        const i = g.cards.length;
        const cell = card(`${key}::add`, depth + 1, key, { inGrid: true, add: true, x: (i % c) * (cardW + gap), y: Math.floor(i / c) * (cardH + gap) });
        g.cards.push(cell);
        g.h = Math.max(g.h, cell.y + cardH);
      }
      groups.push({ ...g, kind: "grid", dropAt: g.w / 2 });
    }
    asColumn.forEach((k) => { const sub = box(k, depth + 1, key); groups.push({ ...sub, kind: "column", dropAt: sub.px + cardW / 2 }); });

    const cards = [self];
    const lines = [];
    const top = cardH + rowGap;
    const place = (g, gx, gy) => {
      g.cards.forEach((c) => cards.push({ ...c, x: c.x + gx, y: c.y + gy }));
      g.lines.forEach((l) => lines.push({ ...l, x: l.x + gx, y: l.y + gy }));
    };

    if (stack) {
      // phones: groups one under another, a trunk on the start side, a tick into each group
      const trunkX = Math.round(indent / 2);
      let y = top;
      let width = cardW;
      let lastTick = cardH;
      groups.forEach((g, i) => {
        place(g, indent, y);
        const tickY = y + cardH / 2;
        lines.push({ id: `${key}:tick${i}`, x: trunkX, y: tickY, w: indent - trunkX, h: 0 });
        lastTick = tickY;
        width = Math.max(width, indent + g.w);
        y += g.h + rowGap;
      });
      lines.unshift({ id: `${key}:trunk`, x: trunkX, y: cardH, w: 0, h: lastTick - cardH });
      return { w: width, h: y - rowGap, cards, lines, px: 0 };
    }

    // side by side under one bus; the parent centred over the groups' drops
    let x = 0;
    groups.forEach((g) => { g.gx = x; x += g.w + groupGap; });
    const drops = groups.map((g) => g.gx + g.dropAt);
    let pc = (Math.min(...drops) + Math.max(...drops)) / 2;
    let shift = 0;
    if (pc - cardW / 2 < 0) { shift = cardW / 2 - pc; pc += shift; }
    const busY = cardH + rowGap / 2;
    let bottom = cardH;
    groups.forEach((g, i) => {
      place(g, g.gx + shift, top);
      lines.push({ id: `${key}:drop${i}`, x: drops[i] + shift, y: busY, w: 0, h: top - busY });
      bottom = Math.max(bottom, top + g.h);
    });
    const lo = Math.min(pc, ...drops.map((d) => d + shift));
    const hi = Math.max(pc, ...drops.map((d) => d + shift));
    lines.unshift({ id: `${key}:stem`, x: pc, y: cardH, w: 0, h: busY - cardH });
    if (hi - lo >= 1) lines.push({ id: `${key}:bus`, x: lo, y: busY, w: hi - lo, h: 0 });
    self.x = pc - cardW / 2;
    const width = Math.max(self.x + cardW, x - groupGap + shift);
    return { w: width, h: bottom, cards, lines, px: self.x };
  };

  const roots = orderKeys(tree, (tree?.roots || []).filter((k) => tree.nodes.has(k)));
  const cards = [];
  const lines = [];
  let x = 0;
  let height = 0;
  roots.forEach((k) => {
    const b = box(k, 0, "");
    b.cards.forEach((c) => cards.push({ ...c, x: c.x + x }));
    b.lines.forEach((l) => lines.push({ ...l, x: l.x + x }));
    x += b.w + groupGap;
    height = Math.max(height, b.h);
  });
  return { cards, lines, width: Math.max(0, x - groupGap), height, index: new Map(cards.map((c) => [c.key, c])) };
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
