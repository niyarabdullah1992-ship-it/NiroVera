/**
 * «الموارد البشرية» — one management section (/app/hr) that merged «الهيكل والفروع» (/app/hr) and
 * «المحطات التي أديرها» (/app/org admin). Five panes, each behind the gate that guarded its
 * content before the merge:
 *
 *   overview   «نظرة عامة»        — HR decision glance (route gate of /app/hr)
 *   people     «الموظفون»          — directory, files, onboarding, grades (route gate of /app/hr)
 *   org        «الهيكل»            — chart, seats, health, authority, changes (edit = org write gate;
 *                                   read-only for HR readers and station leads)
 *   branches   «الفروع والمحطات»   — branches by country → city (all for org writers; a station
 *                                   lead sees only the stations they run)
 *   compliance «الامتثال»          — MHRSD centre + one «أنظمة الوزارة — ما يخص الموارد البشرية»
 *
 * The employee keeps «مكاني في الهيكل» on /app/org?view=employee — no HR pane is exposed there.
 * Pure: no React, relative imports only (node tests import it).
 */
import { buildMinistrySection, ministryTotals, MINISTRY_SOURCE_ORDER, totalsTone } from "./ministrySections.js";
import { foldOrgLookup } from "./orgLookup.js";
import { stationPlace, countryOf } from "./geoPlaces.js";
import { isCompanyRootStation, isHrUnit, isManagerUnit, scopedStationIdsForUser } from "./stationTree.js";
import { activePeople, seatState, todayKey } from "./orgDesign.js";

export const HR_PANES = ["overview", "people", "org", "branches", "compliance"];

export const HR_PANE_LABELS = {
  overview: { ar: "نظرة عامة", en: "Overview" },
  people: { ar: "الموظفون", en: "People" },
  org: { ar: "الهيكل", en: "Structure" },
  branches: { ar: "الفروع والمحطات", en: "Branches & stations" },
  compliance: { ar: "الامتثال", en: "Compliance" },
};

/** «الهيكل» sub-panes — the five panes /app/org carried, same `pane` parameter. */
export const HR_ORG_PANES = ["chart", "seats", "health", "authority", "changes"];

/** Roles that run stations: they reach «الفروع والمحطات» (their stations) and a read-only «الهيكل». */
export const HR_STATION_LEAD_ROLES = ["station_manager", "pgm"];

const str = (v) => String(v ?? "").trim();

function isOwner(user, data) {
  return Boolean(user && (user.isOwner || user.role === "owner" || (data?.ownerId && str(user.id) === str(data.ownerId))));
}

/** Same write gate as the old /app/org admin view (OrgStructure canWrite). */
export function canWriteOrgStructure(user, data) {
  return Boolean(user && (
    str(user.id) === str(data?.ownerId)
    || ["owner", "director", "admin", "pgm", "hr_manager", "ops_manager"].includes(user.role)
  ));
}

/** A smart position that hides the HR department closes the whole section, as it closed /app/hr and /app/org. */
function smartHidesHr(user, data) {
  if (!user || isOwner(user, data)) return false;
  const smart = (data?.smartPositions || []).find((row) => str(row.employeeId) === str(user.id));
  const perms = smart?.permissions || {};
  const granted = Object.values(perms).some((access) => access && access !== "hidden");
  if (!smart || !granted) return false;
  return !perms.hr || perms.hr === "hidden";
}

/** A station lead with stations to show (role-based, never wider than their scope). */
export function isHrStationLead(user, data) {
  if (!user || !HR_STATION_LEAD_ROLES.includes(user.role)) return false;
  if (smartHidesHr(user, data)) return false;
  return true;
}

/**
 * Which panes this person opens.
 * @param {object} user
 * @param {object} data
 * @param {{ routeAllowed?: boolean }} opts routeAllowed — allowedNavFor(...).has("/app/hr") (the
 *        pre-merge route gate, plan gate included). Station leads reach the section without it.
 * @returns {{ panes: string[], full: boolean, orgWrite: boolean, stationLead: boolean, scopeIds: string[]|null }}
 */
export function hrSectionAccess(user, data, { routeAllowed = false, planAllowed = true } = {}) {
  const none = { panes: [], full: false, orgWrite: false, stationLead: false, scopeIds: [] };
  if (!user || !planAllowed) return none;
  const full = Boolean(routeAllowed);
  const orgWrite = full && canWriteOrgStructure(user, data);
  const stationLead = !full && isHrStationLead(user, data);
  const panes = [];
  if (full) panes.push("overview", "people");
  if (full || stationLead) panes.push("org");
  if (orgWrite || stationLead || full) panes.push("branches");
  if (full) panes.push("compliance");
  const scopeIds = full ? null : scopedStationIdsForUser(user, data).map(String);
  return { panes, full, orgWrite, stationLead, scopeIds };
}

/** The pane on screen: the asked one when allowed, else the first allowed (station leads open on their stations). */
export function resolveHrPane(requested, access) {
  const panes = access?.panes || [];
  if (requested && panes.includes(requested)) return requested;
  if (access?.stationLead && panes.includes("branches")) return "branches";
  return panes[0] || "";
}

/**
 * Old /app/org admin links → the matching pane of /app/hr, keeping their parameters.
 * Returns "" when the link is the employee's own view (it stays on /app/org).
 *   /app/org                         → /app/hr?tab=org
 *   /app/org?view=admin&pane=seats   → /app/hr?tab=org&pane=seats
 *   /app/org?view=admin&hire=1       → /app/hr?tab=org&hire=1
 *   /app/org?chart=full&branch=b1    → /app/hr?tab=branches&branch=b1
 *   /app/org?tab=escalation          → /app/hr?tab=org&pane=authority&open=esc
 *   /app/org?focus=s1                → /app/org/chart?focus=s1
 */
export function orgRedirectTarget(search = "", hash = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const view = params.get("view");
  const oldTab = params.get("tab") || "";
  if (view === "employee" || oldTab === "people") return "";
  // the org ministry rules now sit in the one panel of «الامتثال»
  if (String(hash || "").replace(/^#/, "") === "nv-ministry-org") return "/app/hr?tab=compliance#nv-ministry-compliance";
  const out = new URLSearchParams();
  let tab = "org";
  let pane = params.get("pane") || "";
  let open = "";
  if (oldTab === "escalation") { pane = "authority"; open = "esc"; }
  else if (oldTab === "lists") { pane = "authority"; open = "perm"; }
  else if (HR_ORG_PANES.includes(oldTab)) pane = oldTab;
  else if (oldTab === "branches" || oldTab === "template") tab = "branches";
  if (params.get("chart") === "full") tab = "branches";
  const focus = params.get("focus") || "";
  if (focus && tab !== "branches") {
    return `/app/org/chart?focus=${encodeURIComponent(focus)}`;
  }
  out.set("tab", tab);
  if (tab === "org" && pane && pane !== "chart" && HR_ORG_PANES.includes(pane)) out.set("pane", pane);
  if (open) out.set("open", open);
  for (const key of ["hire", "station", "seat", "list", "op", "to", "unit", "branch", "focus"]) {
    const value = params.get(key);
    if (value != null && value !== "") out.set(key, value);
  }
  const tail = String(hash || "");
  return `/app/hr?${out.toString()}${tail && tail !== "#" ? (tail.startsWith("#") ? tail : `#${tail}`) : ""}`;
}

/** Deep link into a pane of the section. */
export function hrHref(tab, extra = {}) {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  for (const [key, value] of Object.entries(extra || {})) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  const q = params.toString();
  return q ? `/app/hr?${q}` : "/app/hr";
}

/**
 * One ministry panel for the section: «أنظمة الوزارة — ما يخص الموارد البشرية» = the establishment's
 * registers (records) and its organisation rules (org), merged by source. Rows are the sections' own.
 */
export function hrMinistrySection(data, { ar = true, today } = {}) {
  const parts = ["records", "org"].map((key) => buildMinistrySection(key, { lane: "manage", ar, today, data: data || {} }));
  const rows = parts.flatMap((part) => part.rows);
  const cards = MINISTRY_SOURCE_ORDER
    .filter((source) => rows.some((row) => row.source === source))
    .map((source) => {
      const mine = parts.map((part) => part.cards.find((card) => card.key === source)).filter(Boolean);
      const counts = ministryTotals(rows.filter((row) => row.source === source));
      const first = mine[0];
      return {
        ...first,
        scope: mine.map((card) => card.scope).filter(Boolean).join(" · "),
        counts,
        tone: totalsTone(counts),
      };
    });
  return {
    key: "hr",
    lane: "manage",
    title: ar ? "أنظمة الوزارة — ما يخص الموارد البشرية" : "Ministry rules — human resources",
    anchor: "nv-ministry-compliance",
    cards,
    rows,
    totals: ministryTotals(rows),
  };
}

function inScope(stationId, scopeIds) {
  if (!scopeIds) return true;
  return scopeIds.includes(str(stationId));
}

/** Workplaces shown in «الفروع والمحطات» (no HQ root, no HR unit, nothing closed). */
export function hrBranchStations(data, scopeIds = null) {
  return (data?.stations || []).filter((s) => (
    s?.id
    && !s.closedAt
    && !isCompanyRootStation(s)
    && !isHrUnit(s)
    && !isManagerUnit(s)
    && inScope(s.id, scopeIds)
  ));
}

/**
 * «الفروع والمحطات» rows: one per branch, grouped country → city (country only when the company
 * spans countries; «بلا مدينة محددة» last). `readinessOf(station)` is passed in (stationReadiness).
 */
export function hrBranchRows(data, { scopeIds = null, ar = true, day = todayKey(), readinessOf = null } = {}) {
  const stations = hrBranchStations(data, scopeIds);
  const people = activePeople(data);
  const byId = new Map((data?.employees || []).map((e) => [str(e.id), e]));
  const rows = stations.map((s) => {
    const id = str(s.id);
    const place = stationPlace(s);
    const manager = byId.get(str(s.managerId));
    const headcount = people.filter((e) => str(e.stationId || e.profile?.stationId) === id).length;
    const seats = (data?.orgSeats || []).filter((seat) => str(seat.stationId) === id && !seat.closedAt);
    const vacant = seats.filter((seat) => seatState(seat, data, day) === "vacant").length;
    const readiness = typeof readinessOf === "function" ? readinessOf(s) : null;
    return {
      id,
      name: str(s.name) || (ar ? "فرع" : "Branch"),
      countryCode: place.city ? (place.countryCode || "SA") : "",
      city: place.city ? (ar ? place.city : (place.cityEn || place.city)) : "",
      region: ar ? place.regionAr : place.regionEn,
      managerName: manager?.name || "",
      noManager: !manager,
      headcount,
      seats: seats.length,
      vacant,
      readiness: readiness ? { level: readiness.level, score: readiness.score, top: readiness.blockers?.[0] || null } : null,
    };
  });
  const countries = new Set(rows.map((r) => r.countryCode).filter(Boolean));
  const multiCountry = countries.size > 1;
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.city ? `${row.countryCode}|${row.city}` : "none";
    if (!groups.has(key)) {
      const country = row.countryCode ? countryOf(row.countryCode) : null;
      groups.set(key, {
        key,
        city: row.city || (ar ? "بلا مدينة محددة" : "No city set"),
        noCity: !row.city,
        region: row.region || "",
        country: multiCountry && country ? (ar ? country.ar : country.en) : "",
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  });
  const list = [...groups.values()].sort((a, b) => {
    if (a.noCity !== b.noCity) return a.noCity ? 1 : -1;
    if (a.country !== b.country) return a.country.localeCompare(b.country, "ar");
    return a.city.localeCompare(b.city, "ar");
  });
  list.forEach((g) => g.rows.sort((a, b) => a.name.localeCompare(b.name, "ar")));
  return { groups: list, rows, multiCountry };
}

/** Status pills of «الفروع والمحطات». */
export const HR_BRANCH_FILTERS = ["all", "attention", "no_manager", "no_city"];

export function hrBranchMatches(row, filter) {
  if (filter === "no_manager") return row.noManager;
  if (filter === "no_city") return !row.city;
  if (filter === "attention") return Boolean(row.readiness && row.readiness.level !== "ready") || row.noManager;
  return true;
}

/**
 * Search across people, seats and branches at the top of the section. A hit opens the pane that
 * fixes it: a person → their file (HR) or their card on the chart; a seat → «المناصب» (editors) or
 * the chart; a branch → «الفروع والمحطات».
 */
export function hrSectionSearch(data, query, { access, ar = true, limit = 8 } = {}) {
  const folded = foldOrgLookup(query);
  if (!folded || folded.length < 2) return [];
  const tokens = folded.split(" ").filter(Boolean);
  const hit = (text) => {
    const hay = foldOrgLookup(text);
    return tokens.every((t) => hay.includes(t));
  };
  const scopeIds = access?.scopeIds ?? null;
  const stationName = new Map((data?.stations || []).map((s) => [str(s.id), str(s.name)]));
  const out = [];

  activePeople(data).forEach((e) => {
    const sid = str(e.stationId || e.profile?.stationId);
    if (!inScope(sid, scopeIds)) return;
    const title = str(e.profile?.position || e.position || e.jobTitle);
    const number = str(e.employeeNo || e.profile?.employeeNo);
    if (!hit(`${e.name} ${title} ${number} ${stationName.get(sid) || ""}`)) return;
    out.push({
      kind: "person",
      id: str(e.id),
      label: str(e.name) || "—",
      sub: [title, stationName.get(sid)].filter(Boolean).join(" · "),
      to: access?.full ? `/app/employees/${encodeURIComponent(e.id)}` : `/app/org/chart?focus=${encodeURIComponent(e.id)}`,
    });
  });

  (data?.orgSeats || []).forEach((seat) => {
    if (seat.closedAt || !inScope(seat.stationId, scopeIds)) return;
    const title = str(seat.title);
    if (!title || !hit(`${title} ${str(seat.code)} ${stationName.get(str(seat.stationId)) || ""}`)) return;
    const holder = seat.employeeId ? str(seat.employeeId) : "";
    out.push({
      kind: "seat",
      id: str(seat.id),
      label: title,
      sub: [str(seat.code), stationName.get(str(seat.stationId))].filter(Boolean).join(" · "),
      to: access?.orgWrite
        ? hrHref("org", { pane: "seats", seat: seat.id })
        : `/app/org/chart?focus=${encodeURIComponent(holder || seat.id)}`,
    });
  });

  hrBranchStations(data, scopeIds).forEach((s) => {
    const place = stationPlace(s);
    if (!hit(`${s.name} ${place.city} ${place.cityEn} ${place.regionAr}`)) return;
    out.push({
      kind: "branch",
      id: str(s.id),
      label: str(s.name),
      sub: [ar ? place.city : place.cityEn, ar ? place.regionAr : place.regionEn].filter(Boolean).join(" · "),
      to: hrHref("branches", access?.orgWrite ? { branch: s.id } : { q: s.name }),
    });
  });

  // every kind gets a place in the list (a branch name inside many people's lines never hides the branch)
  const byKind = (kind) => out.filter((h) => h.kind === kind);
  const quota = { person: Math.ceil(limit / 2), seat: Math.floor(limit / 4), branch: Math.floor(limit / 4) };
  const picked = ["person", "seat", "branch"].flatMap((kind) => byKind(kind).slice(0, quota[kind]));
  const rest = out.filter((h) => !picked.includes(h));
  const order = { person: 0, seat: 1, branch: 2 };
  return [...picked, ...rest].slice(0, limit).sort((a, b) => order[a.kind] - order[b.kind]);
}
