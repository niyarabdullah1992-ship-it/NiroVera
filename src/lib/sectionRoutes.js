/**
 * The fixed rule: anything that belongs to a section opens in that section — for management on the
 * management side, for the employee on the employee side — never in the employee file.
 *
 *   overtime (Art. 107) · night consent / rotation · night fitness → طلباتي (إدارة الطلبات | طلباتي)
 *   night first aid · emergency transfer · food (18632 III)         → السلامة ← التفتيش والجاهزية
 *
 * Everything the roster itself fixes (hours, rest, heat…) stays on «في الجدول ›»: no extra link.
 */

export const REQUESTS_MANAGE = "/app/requests/manage";
export const REQUESTS_MINE = "/app/requests";
export const SAFETY_NIGHT_DUTIES = "/app/safety?lane=manage&tab=inspect&focus=night";

const REQUEST_GATES = new Set(["overtime_107", "night_rotate", "night_medical", "ot_cap_consent"]);
const SAFETY_GATES = new Set(["night_facilities"]);

/** One gate → its owning section for that audience, or null when the roster itself is the place. */
export function sectionRouteFor(gateId, { audience = "manager" } = {}) {
  const id = String(gateId || "");
  const employee = audience === "employee";
  if (REQUEST_GATES.has(id)) {
    return {
      section: "requests",
      href: employee ? REQUESTS_MINE : REQUESTS_MANAGE,
      ar: employee ? "في طلباتي ›" : "في إدارة الطلبات ›",
      en: employee ? "In My requests ›" : "In Requests — manage ›",
    };
  }
  // The employer's night-site duties are proven by management in السلامة; the worker has nothing to do.
  if (SAFETY_GATES.has(id)) {
    if (employee) return null;
    return { section: "safety", href: SAFETY_NIGHT_DUTIES, ar: "في السلامة ›", en: "In Safety ›" };
  }
  return null;
}

/** Every distinct owning section a card (and its grouped items) points to — one link per section. */
export function sectionRoutesForCard(card) {
  if (!card) return [];
  const audience = card.audience === "employee" ? "employee" : "manager";
  const gates = [card.gateId, ...(Array.isArray(card.items) ? card.items.map((row) => row?.gateId) : [])].filter(Boolean);
  const out = [];
  for (const gate of gates) {
    const route = sectionRouteFor(gate, { audience });
    if (route && !out.some((row) => row.href === route.href)) out.push({ ...route, gateId: gate });
  }
  return out;
}
