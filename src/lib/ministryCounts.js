/**
 * The four counts every «أنظمة الوزارة» panel shows, from the rows it lists:
 *   block — blocked / violation (مانع) · alert — alert / waiting / coming (تنبيه)
 *   met   — settled (مستوفى)        · info  — void: for reference or not applicable (للعلم)
 * One function, so a panel's counters and the «الامتثال الوزاري» index never read the same rows twice
 * in two ways. Pure (node-testable).
 */

export const MINISTRY_BLOCK = new Set(["blocked", "violation"]);
export const MINISTRY_ALERT = new Set(["alert", "waiting", "coming"]);

export function ministryCounts(rows = []) {
  const list = (rows || []).filter(Boolean);
  return {
    block: list.filter((row) => MINISTRY_BLOCK.has(row.status)).length,
    alert: list.filter((row) => MINISTRY_ALERT.has(row.status)).length,
    met: list.filter((row) => row.status === "settled").length,
    info: list.filter((row) => row.status === "void").length,
  };
}

/**
 * A per-person panel (العقد، نهاية الخدمة، طلباتي، أدائي) summed over the people in scope: blocks,
 * alerts and met rows add up person by person; a reference rule counts once — it is the same rule
 * for everyone, not one per file. `rowSets` is one panel's rows per person.
 */
export function ministryCountsAcross(rowSets = []) {
  const total = { block: 0, alert: 0, met: 0, info: 0 };
  const reference = new Set();
  for (const rows of rowSets || []) {
    const counts = ministryCounts(rows);
    total.block += counts.block;
    total.alert += counts.alert;
    total.met += counts.met;
    (rows || []).filter((row) => row?.status === "void").forEach((row) => reference.add(String(row.key)));
  }
  total.info = reference.size;
  return total;
}

/** A section's tone on the index — the worst open state, else met, else reference only. */
export function ministryCountsTone(counts = {}) {
  if (counts.block) return "bad";
  if (counts.alert) return "warn";
  if (counts.met) return "ok";
  return "mute";
}
