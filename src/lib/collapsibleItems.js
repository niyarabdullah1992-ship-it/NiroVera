/**
 * Which list items are open. Every item card is folded to one summary row by default; the person
 * opens what they want to read. Two cases open on their own: a list of exactly one item, and the
 * item a deep link points at (?id / ?request). A person's own open/close always wins over both,
 * and the choice survives filtering — the state is keyed by item id, not by position.
 *
 * state = { open: string[], closed: string[] } — plain arrays so it serialises and compares simply.
 */

export const EMPTY_EXPANDED = Object.freeze({ open: [], closed: [] });

const key = (id) => (id == null ? "" : String(id));

/** Is this item open, given the ids visible now and the deep-linked id (if any)? */
export function isItemExpanded(state, id, { visibleIds = [], focusId = "" } = {}) {
  const k = key(id);
  if (!k) return false;
  const s = state || EMPTY_EXPANDED;
  if (s.open.includes(k)) return true;
  if (s.closed.includes(k)) return false;
  if (focusId && key(focusId) === k) return true;
  return visibleIds.length === 1 && key(visibleIds[0]) === k;
}

/** The state after the person flips one item; `wasOpen` is what the card showed before the click. */
export function toggleExpanded(state, id, wasOpen) {
  const k = key(id);
  const s = state || EMPTY_EXPANDED;
  if (!k) return s;
  const open = s.open.filter((x) => x !== k);
  const closed = s.closed.filter((x) => x !== k);
  return wasOpen ? { open, closed: [...closed, k] } : { open: [...open, k], closed };
}
