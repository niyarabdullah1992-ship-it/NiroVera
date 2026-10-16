/**
 * Organisation design — the derived layer over the live structure.
 *
 * Units are the existing `stations` (company → branch → department → unit), positions are the
 * existing `orgSeats` (separate from people), people are `employees`. The solid reporting line is
 * the workplace chain the platform already derives (peopleTreeGraph.buildPeopleTree) — a person
 * reports to the manager of their unit, a unit manager to the manager of the parent unit. This
 * module never stores a figure: span, layers, health, headcount, Saudization, approval paths and
 * the as-of chart are all derived on read.
 *
 * Stored inputs it reads:
 *   seat.{code, qiwaTitle, state: "frozen"|"planned", plannedFrom, dottedToSeatId, deputySeatId, saudiOnly}
 *   station.{orgLevel, headcountBudget, closedAt}
 *   data.orgDesign = { settings, doa: [], changes: [] }   (object blob, senior-only)
 *
 * Pure: relative imports only, so scripts/test-org-design-*.mjs import it directly.
 * Server twin: base44/shared/orgDesignDerivations.ts (permissions, DoA, my place, write merge).
 */

import { buildPeopleTree, flattenPeopleTree, reportsToId } from "./peopleTreeGraph.js";
import { deriveSaudiStatus } from "./complianceDerivations.js";
import {
  isCompanyRootStation,
  isHrUnit,
  isManagerUnit,
  stationParentId,
  stationSubtreeIds,
  wouldCreateStationCycle,
} from "./stationTree.js";
import { checkConsentGate, checkNecessityGate } from "./consentEffects.js";

/* ───────────────────────── basics ───────────────────────── */

const str = (v) => String(v ?? "").trim();

export function todayKey(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dayOf = (v) => {
  const s = str(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

export function daysBetween(from, to) {
  const a = dayOf(from);
  const b = dayOf(to);
  if (!a || !b) return 0;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (const ch of String(text || "")) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash >>> 0;
}

function normTitle(value) {
  return str(value)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ْ]/g, "")
    .replace(/\s+/g, " ");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

/* ───────────────────────── settings & stored design ───────────────────────── */

export const ORG_DESIGN_DEFAULTS = Object.freeze({
  spanMin: 2,
  spanMax: 8,
  maxLayers: 6,
  actingMaxDays: 90,
  actingRemindDays: 7,
  vacantAlertDays: 60,
});

const SETTING_BOUNDS = {
  spanMin: [1, 20],
  spanMax: [2, 60],
  maxLayers: [2, 15],
  actingMaxDays: [7, 365],
  actingRemindDays: [1, 60],
  vacantAlertDays: [7, 365],
};

export function orgDesignOf(data) {
  const raw = data?.orgDesign && typeof data.orgDesign === "object" && !Array.isArray(data.orgDesign) ? data.orgDesign : {};
  return {
    settings: { ...ORG_DESIGN_DEFAULTS, ...(raw.settings || {}) },
    doa: Array.isArray(raw.doa) ? raw.doa : [],
    changes: Array.isArray(raw.changes) ? raw.changes : [],
  };
}

/** Thresholds are company settings — a gate names what is wrong with a proposed value. */
export function checkOrgSettingsGate(input = {}) {
  const next = { ...ORG_DESIGN_DEFAULTS };
  for (const [key, [min, max]] of Object.entries(SETTING_BOUNDS)) {
    const raw = input[key] ?? ORG_DESIGN_DEFAULTS[key];
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      return {
        ok: false,
        error: "ORG_SETTING_RANGE",
        field: key,
        reason: `القيمة خارج المدى المسموح (${min}–${max}).`,
        reasonEn: `Value outside the allowed range (${min}–${max}).`,
      };
    }
    next[key] = n;
  }
  if (next.spanMin >= next.spanMax) {
    return {
      ok: false,
      error: "ORG_SPAN_ORDER",
      field: "spanMin",
      reason: "الحد الأدنى للنطاق يجب أن يكون أصغر من الحد الأعلى.",
      reasonEn: "The minimum span must be below the maximum span.",
    };
  }
  if (next.actingRemindDays >= next.actingMaxDays) {
    return {
      ok: false,
      error: "ORG_ACTING_ORDER",
      field: "actingRemindDays",
      reason: "التذكير قبل انتهاء التكليف يجب أن يكون أقصر من حدّ التكليف.",
      reasonEn: "The acting reminder must be shorter than the acting limit.",
    };
  }
  return { ok: true, settings: next };
}

/* ───────────────────────── people, units, seats ───────────────────────── */

export function activePeople(data) {
  return (data?.employees || []).filter((e) => (
    e?.id
    && e.role !== "system"
    && e.active !== false
    && e.profile?.employmentStatus !== "terminated"
  ));
}

const byIdMap = (rows) => new Map((rows || []).map((row) => [str(row?.id), row]));

export function seatsOf(data) {
  return Array.isArray(data?.orgSeats) ? data.orgSeats : [];
}

function homeStationId(employee, data) {
  const seat = seatsOf(data).find((s) => str(s.employeeId) === str(employee?.id));
  return str(employee?.stationId || employee?.profile?.stationId || seat?.stationId);
}

export const ORG_LEVELS = ["company", "branch", "region", "department", "unit"];
export const ORG_LEVEL_LABELS = {
  company: { ar: "المنشأة", en: "Company" },
  branch: { ar: "فرع", en: "Branch" },
  region: { ar: "إدارة إقليمية", en: "Region" },
  department: { ar: "إدارة", en: "Department" },
  unit: { ar: "وحدة", en: "Unit" },
  hr: { ar: "الموارد البشرية", en: "HR unit" },
};

/** Stored orgLevel wins; otherwise the tree position names the level. */
export function unitLevel(station, stations = []) {
  if (!station) return "unit";
  if (isCompanyRootStation(station)) return "company";
  if (isHrUnit(station)) return "hr";
  const stored = str(station.orgLevel);
  if (ORG_LEVELS.includes(stored)) return stored;
  if (isManagerUnit(station)) return "region";
  const parentId = stationParentId(station);
  const parent = parentId ? (stations || []).find((s) => str(s.id) === parentId) : null;
  if (!parent || isCompanyRootStation(parent) || isManagerUnit(parent)) return "branch";
  const parentLevel = unitLevel(parent, stations);
  return parentLevel === "department" || parentLevel === "unit" ? "unit" : "department";
}

export function isUnitClosed(station) {
  return Boolean(str(station?.closedAt));
}

/** Path from the top unit down to this unit (names), for "where am I" lines. */
export function unitPath(data, stationId) {
  const byId = byIdMap(data?.stations);
  const out = [];
  const seen = new Set();
  let cursor = byId.get(str(stationId));
  while (cursor && !seen.has(str(cursor.id))) {
    seen.add(str(cursor.id));
    out.unshift(cursor);
    const parent = stationParentId(cursor);
    cursor = parent ? byId.get(parent) : null;
  }
  return out;
}

export function seatHolder(data, seat) {
  const id = str(seat?.employeeId);
  if (!id) return null;
  return activePeople(data).find((e) => str(e.id) === id) || null;
}

function activeActing(employee, day) {
  return (employee?.actingAssignments || []).filter((item) => {
    if (!item || item.endedAt) return false;
    const from = dayOf(item.from || item.createdAt);
    const until = dayOf(item.until);
    if (from && from > day) return false;
    return !until || until >= day;
  });
}

/** Acting occupant of a seat on a day: an active acting assignment that names this seat. */
export function actingOnSeat(data, seat, day = todayKey()) {
  const sid = str(seat?.id);
  if (!sid) return null;
  for (const employee of activePeople(data)) {
    const assignment = activeActing(employee, day).find((item) => str(item.seatId) === sid);
    if (assignment) return { employee, assignment };
  }
  return null;
}

export const SEAT_STATES = ["filled", "vacant", "frozen", "planned"];
export const SEAT_STATE_LABELS = {
  filled: { ar: "مشغول", en: "Filled" },
  vacant: { ar: "شاغر", en: "Vacant" },
  frozen: { ar: "مجمّد", en: "Frozen" },
  planned: { ar: "مخطط", en: "Planned" },
};

/** Seat state is derived: frozen/planned are stored intents; filled/vacant come from the holder. */
export function seatState(seat, data, day = todayKey()) {
  if (!seat) return "vacant";
  if (seatHolder(data, seat)) return "filled";
  if (str(seat.state) === "frozen") return "frozen";
  if (str(seat.state) === "planned") {
    const from = dayOf(seat.plannedFrom);
    if (!from || from > day) return "planned";
  }
  return "vacant";
}

/** Seat code: stored code wins; else a stable code from the unit and creation order. */
export function seatCode(seat, data) {
  const stored = str(seat?.code);
  if (stored) return stored;
  const stations = data?.stations || [];
  const station = stations.find((s) => str(s.id) === str(seat?.stationId));
  const unitCode = (() => {
    const code = str(station?.code);
    if (code && !/preview/i.test(code)) return code.toUpperCase().slice(0, 6);
    if (isCompanyRootStation(station)) return "HQ";
    if (isHrUnit(station)) return "HR";
    const index = stations.findIndex((s) => str(s.id) === str(station?.id));
    return index >= 0 ? `U${String(index + 1).padStart(2, "0")}` : "U00";
  })();
  const siblings = seatsOf(data)
    .filter((s) => str(s.stationId) === str(seat?.stationId))
    .sort((a, b) => str(a.createdAt).localeCompare(str(b.createdAt)) || str(a.id).localeCompare(str(b.id)));
  const n = siblings.findIndex((s) => str(s.id) === str(seat?.id)) + 1;
  return `${unitCode}-${String(Math.max(1, n)).padStart(3, "0")}`;
}

export function daysVacant(seat, day = todayKey()) {
  const since = dayOf(seat?.vacatedAt) || dayOf(seat?.createdAt);
  if (!since) return 0;
  return Math.max(0, daysBetween(since, day));
}

export function qiwaTitleOf(employee) {
  return str(employee?.profile?.qiwaTitle || employee?.qiwaTitle);
}

/** The Qiwa occupation a seat needs: an explicit seat field, else its title. */
export function seatQiwaTitle(seat) {
  return str(seat?.qiwaTitle || seat?.title);
}

export function nationalityBucket(employee) {
  if (!employee) return "none";
  const s = deriveSaudiStatus(employee);
  if (!s.countable) return "unknown";
  return s.saudi ? "saudi" : "non_saudi";
}

/* ───────────────────────── seat register ───────────────────────── */

/**
 * One row per seat for the «المناصب» table: who holds it, its state, its unit and grade, who it
 * reports to (solid) and dotted, its deputy, how long it waited, and whether its holder matches
 * the Qiwa title and the Saudi-only flag.
 */
export function deriveSeatRegister(data, day = todayKey()) {
  const stations = data?.stations || [];
  const stationById = byIdMap(stations);
  const grades = byIdMap(data?.jobGrades);
  const seats = seatsOf(data);
  const seatById = byIdMap(seats);
  const graph = reportingGraph(data);
  const people = byIdMap(activePeople(data));
  return seats.map((seat) => {
    const holder = seatHolder(data, seat);
    const state = seatState(seat, data, day);
    const acting = actingOnSeat(data, seat, day);
    const station = stationById.get(str(seat.stationId));
    const grade = grades.get(str(seat.gradeId));
    const reportsToId = holder ? (graph.managerOf.get(str(holder.id)) || "") : seatParentEmployeeId(seat, data);
    const deputy = seat.deputySeatId ? seatById.get(str(seat.deputySeatId)) : null;
    const dotted = seat.dottedToSeatId ? seatById.get(str(seat.dottedToSeatId)) : null;
    const qiwa = holder ? qiwaTitleOf(holder) : "";
    return {
      seatId: str(seat.id),
      code: seatCode(seat, data),
      title: str(seat.title),
      qiwaTitle: str(seat.qiwaTitle),
      stationId: str(seat.stationId),
      unitName: station?.name || "",
      unitLevel: station ? unitLevel(station, stations) : "unit",
      gradeId: str(seat.gradeId),
      gradeLabel: grade ? [grade.gradeNumber, grade.title].filter(Boolean).join(" · ") : "",
      state,
      holderId: holder ? str(holder.id) : "",
      holderName: holder?.name || "",
      actingId: acting ? str(acting.employee.id) : "",
      actingName: acting?.employee?.name || "",
      actingUntil: acting ? dayOf(acting.assignment.until) : "",
      nationality: holder ? nationalityBucket(holder) : "none",
      reportsToId,
      reportsToName: people.get(reportsToId)?.name || "",
      deputySeatId: deputy ? str(deputy.id) : "",
      deputyTitle: deputy?.title || "",
      deputyName: deputy ? (seatHolder(data, deputy)?.name || "") : "",
      dottedToSeatId: dotted ? str(dotted.id) : "",
      dottedTitle: dotted?.title || "",
      daysVacant: state === "vacant" ? daysVacant(seat, day) : 0,
      saudiOnly: Boolean(seat.saudiOnly),
      plannedFrom: dayOf(seat.plannedFrom),
      qiwaMismatch: Boolean(qiwa && seatQiwaTitle(seat) && normTitle(qiwa) !== normTitle(seatQiwaTitle(seat))),
    };
  }).sort((a, b) => a.unitName.localeCompare(b.unitName, "ar") || a.code.localeCompare(b.code));
}

/* ───────────────────────── reporting graph ───────────────────────── */

/** Solid line = the live workplace chain (the chart the company already sees). */
export function reportingGraph(data) {
  const tree = buildPeopleTree(data);
  const flat = flattenPeopleTree(tree.roots);
  const managerOf = new Map();
  const children = new Map();
  const depth = new Map();
  const walk = (node, d, parent) => {
    if (!node || depth.has(node.id)) return;
    depth.set(node.id, d);
    if (parent) {
      managerOf.set(node.id, parent.id);
      const list = children.get(parent.id) || [];
      list.push(node.id);
      children.set(parent.id, list);
    }
    (node.children || []).forEach((child) => walk(child, d + 1, node));
  };
  tree.roots.forEach((root) => walk(root, 0, null));
  return { roots: tree.roots.map((r) => r.id), managerOf, children, depth, people: flat };
}

export function descendantsInGraph(graph, id) {
  const out = [];
  const stack = [...(graph.children.get(str(id)) || [])];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    (graph.children.get(cur) || []).forEach((c) => stack.push(c));
  }
  return out;
}

/** Vacant/frozen/planned seats count against the manager they would report to. */
function seatParentEmployeeId(seat, data) {
  const explicit = str(seat?.reportsToEmployeeId);
  if (explicit) return explicit;
  // nearest unit up the tree that has a manager
  const path = unitPath(data, seat?.stationId);
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const managerId = str(path[i].managerId);
    if (managerId) return managerId;
  }
  return "";
}

/**
 * Raw reporting links (seat.reportsToEmployeeId / profile.directManagerId) can be edited outside
 * the derived chain. The chart hides a loop; the health board names it.
 */
export function reportingCycles(data) {
  const people = activePeople(data);
  const byId = byIdMap(people);
  const cycles = [];
  const reported = new Set();
  for (const person of people) {
    const seen = [];
    let cursor = person;
    while (cursor) {
      const id = str(cursor.id);
      const at = seen.indexOf(id);
      if (at >= 0) {
        const loop = seen.slice(at);
        const key = [...loop].sort().join(">");
        if (!reported.has(key)) {
          reported.add(key);
          cycles.push(loop);
        }
        break;
      }
      seen.push(id);
      const next = reportsToId(cursor, data);
      cursor = next ? byId.get(str(next)) : null;
    }
  }
  return cycles;
}

export function stationCycles(stations = []) {
  const out = [];
  const reported = new Set();
  const byId = byIdMap(stations);
  for (const station of stations) {
    const seen = [];
    let cursor = station;
    while (cursor) {
      const id = str(cursor.id);
      const at = seen.indexOf(id);
      if (at >= 0) {
        const loop = seen.slice(at);
        const key = [...loop].sort().join(">");
        if (!reported.has(key)) {
          reported.add(key);
          out.push(loop);
        }
        break;
      }
      seen.push(id);
      const parent = stationParentId(cursor);
      cursor = parent ? byId.get(parent) : null;
    }
  }
  return out;
}

/* ───────────────────────── span of control & layers ───────────────────────── */

/**
 * One row per person who leads anyone (people or open seats). Verdict against company thresholds:
 *   wide   — more direct reports than spanMax
 *   narrow — a manager with fewer than spanMin (a one-to-one layer)
 *   deep   — sits on a layer beyond maxLayers
 */
export function deriveSpanLayers(data, settings = orgDesignOf(data).settings, day = todayKey()) {
  const graph = reportingGraph(data);
  const people = byIdMap(activePeople(data));
  const openSeats = new Map();
  seatsOf(data).forEach((seat) => {
    const state = seatState(seat, data, day);
    if (state !== "vacant") return;
    const parent = seatParentEmployeeId(seat, data);
    if (!parent) return;
    openSeats.set(parent, (openSeats.get(parent) || 0) + 1);
  });
  const layersBelow = (id, guard = 0) => {
    const kids = graph.children.get(id) || [];
    if (!kids.length || guard > 40) return 0;
    return 1 + Math.max(...kids.map((k) => layersBelow(k, guard + 1)));
  };
  const rows = [];
  const ids = new Set([...graph.children.keys(), ...openSeats.keys()]);
  for (const id of ids) {
    const person = people.get(id);
    if (!person) continue;
    const directPeople = (graph.children.get(id) || []).length;
    const directOpen = openSeats.get(id) || 0;
    const direct = directPeople + directOpen;
    if (!direct) continue;
    const level = (graph.depth.get(id) ?? 0) + 1;
    let verdict = "ok";
    if (direct > settings.spanMax) verdict = "wide";
    else if (level > settings.maxLayers) verdict = "deep";
    else if (direct < settings.spanMin) verdict = "narrow";
    rows.push({
      employeeId: id,
      name: person.name || "",
      level,
      directPeople,
      directOpen,
      direct,
      total: descendantsInGraph(graph, id).length,
      layersBelow: layersBelow(id),
      verdict,
    });
  }
  rows.sort((a, b) => a.level - b.level || b.direct - a.direct || a.name.localeCompare(b.name, "ar"));
  const depths = [...graph.depth.values()];
  const layers = depths.length ? Math.max(...depths) + 1 : 0;
  const spans = rows.map((r) => r.direct).sort((a, b) => a - b);
  const median = spans.length ? (spans.length % 2 ? spans[(spans.length - 1) / 2] : (spans[spans.length / 2 - 1] + spans[spans.length / 2]) / 2) : 0;
  return {
    rows,
    layers,
    managers: rows.length,
    medianSpan: median,
    wide: rows.filter((r) => r.verdict === "wide").length,
    narrow: rows.filter((r) => r.verdict === "narrow").length,
    deep: rows.filter((r) => r.verdict === "deep").length,
    tooDeep: layers > settings.maxLayers,
  };
}

/* ───────────────────────── headcount plan vs actual ───────────────────────── */

export function deriveHeadcountPlan(data, day = todayKey()) {
  const stations = data?.stations || [];
  const people = activePeople(data);
  return stations
    .filter((s) => s?.id && !isUnitClosed(s))
    .map((station) => {
      const sid = str(station.id);
      const seats = seatsOf(data).filter((seat) => str(seat.stationId) === sid);
      const states = { filled: 0, vacant: 0, frozen: 0, planned: 0 };
      seats.forEach((seat) => { states[seatState(seat, data, day)] += 1; });
      const members = people.filter((e) => homeStationId(e, data) === sid);
      const mix = { saudi: 0, non_saudi: 0, unknown: 0 };
      members.forEach((e) => { mix[nationalityBucket(e) === "none" ? "unknown" : nationalityBucket(e)] += 1; });
      const countable = mix.saudi + mix.non_saudi;
      const budget = Number.isFinite(Number(station.headcountBudget)) && str(station.headcountBudget) !== ""
        ? Math.max(0, Math.round(Number(station.headcountBudget)))
        : null;
      return {
        stationId: sid,
        name: station.name || "",
        level: unitLevel(station, stations),
        depth: unitPath(data, sid).length - 1,
        budget,
        actual: members.length,
        variance: budget == null ? null : members.length - budget,
        seats: seats.length,
        ...states,
        saudi: mix.saudi,
        nonSaudi: mix.non_saudi,
        unknown: mix.unknown,
        saudiPct: countable ? Math.round((mix.saudi / countable) * 100) : null,
      };
    })
    .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name, "ar"));
}

/* ───────────────────────── org health board ───────────────────────── */

function holderIsManager(data, graph, employeeId) {
  const id = str(employeeId);
  if (!id) return false;
  if ((graph.children.get(id) || []).length) return true;
  return (data?.stations || []).some((s) => str(s.managerId) === id && !isUnitClosed(s));
}

/**
 * One list — each finding names what is wrong, where, and since when.
 * tone: "bad" (breaks a rule) · "warn" (needs a decision) · "info" (worth knowing).
 */
export function deriveOrgHealth(data, { day = todayKey(), settings } = {}) {
  const cfg = settings || orgDesignOf(data).settings;
  const graph = reportingGraph(data);
  const people = activePeople(data);
  const stations = data?.stations || [];
  const stationById = byIdMap(stations);
  const items = [];
  const push = (row) => items.push(row);
  const ownerId = str(data?.ownerId);

  // vacant seats and how long they have waited
  seatsOf(data).forEach((seat) => {
    if (seatState(seat, data, day) !== "vacant") return;
    const days = daysVacant(seat, day);
    const acting = actingOnSeat(data, seat, day);
    push({
      id: `vacant:${seat.id}`,
      kind: "VACANT",
      tone: days >= cfg.vacantAlertDays ? "warn" : "info",
      seatId: str(seat.id),
      stationId: str(seat.stationId),
      days,
      ar: `«${seat.title || "منصب"}» شاغر ${days ? `منذ ${days} يوماً` : "منذ اليوم"}${acting ? ` — يغطيه ${acting.employee.name} بالتكليف` : ""}`,
      en: `“${seat.title || "Seat"}” vacant ${days ? `for ${days} days` : "since today"}${acting ? ` — covered by ${acting.employee.name} (acting)` : ""}`,
    });
  });

  // acting assignments over the limit, or ending soon
  people.forEach((employee) => {
    activeActing(employee, day).forEach((assignment) => {
      const from = dayOf(assignment.from || assignment.createdAt);
      const age = from ? daysBetween(from, day) : 0;
      const until = dayOf(assignment.until);
      const left = until ? daysBetween(day, until) : null;
      const where = stationById.get(str(assignment.stationId))?.name || "";
      if (age > cfg.actingMaxDays) {
        push({
          id: `acting_over:${employee.id}:${assignment.id || assignment.stationId}`,
          kind: "ACTING_OVER_LIMIT",
          tone: "bad",
          employeeId: str(employee.id),
          stationId: str(assignment.stationId),
          days: age,
          ar: `تكليف ${employee.name} في ${where || "وحدة"} مستمر ${age} يوماً — فوق حدّ الشركة ${cfg.actingMaxDays} يوماً. ثبّت أو أنهِ التكليف.`,
          en: `${employee.name}'s acting role at ${where || "a unit"} has run ${age} days — over the ${cfg.actingMaxDays}-day limit.`,
        });
      } else if (left != null && left <= cfg.actingRemindDays) {
        push({
          id: `acting_end:${employee.id}:${assignment.id || assignment.stationId}`,
          kind: "ACTING_ENDING",
          tone: "info",
          employeeId: str(employee.id),
          stationId: str(assignment.stationId),
          days: left,
          ar: `تكليف ${employee.name} في ${where || "وحدة"} ينتهي تلقائياً ${left <= 0 ? "اليوم" : `بعد ${left} يوماً`} (${until}).`,
          en: `${employee.name}'s acting role at ${where || "a unit"} ends automatically ${left <= 0 ? "today" : `in ${left} days`} (${until}).`,
        });
      }
    });
  });

  // managers without a deputy (succession)
  const seatOfPerson = new Map(seatsOf(data).filter((s) => str(s.employeeId)).map((s) => [str(s.employeeId), s]));
  people.forEach((employee) => {
    if (!holderIsManager(data, graph, employee.id)) return;
    const seat = seatOfPerson.get(str(employee.id));
    const deputy = seat?.deputySeatId ? seatsOf(data).find((s) => str(s.id) === str(seat.deputySeatId)) : null;
    if (deputy && seatHolder(data, deputy)) return;
    push({
      id: `deputy:${employee.id}`,
      kind: "NO_DEPUTY",
      tone: "warn",
      employeeId: str(employee.id),
      seatId: str(seat?.id),
      ar: seat
        ? `${employee.name} يقود فريقاً بلا نائب مشغول — حدّد منصب النائب للتعاقب.`
        : `${employee.name} يقود فريقاً بلا منصب في الهيكل — لا يمكن تحديد نائب له.`,
      en: seat
        ? `${employee.name} leads a team without a filled deputy seat — name a deputy for succession.`
        : `${employee.name} leads a team without a seat — no deputy can be named.`,
    });
  });

  // people without a seat / without a manager
  people.forEach((employee) => {
    const id = str(employee.id);
    if (!seatOfPerson.has(id) && id !== ownerId) {
      push({
        id: `noseat:${id}`,
        kind: "NO_SEAT",
        tone: "warn",
        employeeId: id,
        ar: `${employee.name} بلا منصب معتمد في الهيكل.`,
        en: `${employee.name} has no approved seat.`,
      });
    }
    if (!graph.managerOf.has(id) && !graph.roots.slice(0, 1).includes(id) && id !== ownerId) {
      push({
        id: `nomgr:${id}`,
        kind: "NO_MANAGER",
        tone: "bad",
        employeeId: id,
        ar: `${employee.name} بلا مدير مباشر — وحدته بلا مدير ولا يعلوها مدير.`,
        en: `${employee.name} has no direct manager — the unit and its parents have none.`,
      });
    }
  });

  // job title vs Qiwa, Saudi-only seats
  seatsOf(data).forEach((seat) => {
    const holder = seatHolder(data, seat);
    if (!holder) return;
    const qiwa = qiwaTitleOf(holder);
    const need = seatQiwaTitle(seat);
    if (qiwa && need && normTitle(qiwa) !== normTitle(need)) {
      push({
        id: `qiwa:${seat.id}`,
        kind: "QIWA_MISMATCH",
        tone: "warn",
        seatId: str(seat.id),
        employeeId: str(holder.id),
        ar: `مسمى ${holder.name} في قوى «${qiwa}» لا يطابق مسمى المنصب «${need}».`,
        en: `${holder.name}'s Qiwa title “${qiwa}” does not match the seat title “${need}”.`,
      });
    }
    if (seat.saudiOnly && nationalityBucket(holder) === "non_saudi") {
      push({
        id: `saudi:${seat.id}`,
        kind: "SAUDI_ONLY_BREACH",
        tone: "bad",
        seatId: str(seat.id),
        employeeId: str(holder.id),
        ar: `«${seat.title}» منصب مقصور على السعوديين ويشغله ${holder.name} (غير سعودي).`,
        en: `“${seat.title}” is a Saudi-only seat held by ${holder.name} (non-Saudi).`,
      });
    }
  });

  // headcount budget and single-person units
  deriveHeadcountPlan(data, day).forEach((row) => {
    const station = stationById.get(row.stationId);
    if (row.budget != null && row.variance > 0) {
      push({
        id: `over:${row.stationId}`,
        kind: "OVER_BUDGET",
        tone: "bad",
        stationId: row.stationId,
        ar: `${row.name}: ${row.actual} موظفاً مقابل ميزانية ${row.budget} — زيادة ${row.variance}.`,
        en: `${row.name}: ${row.actual} people against a budget of ${row.budget} — ${row.variance} over.`,
      });
    } else if (row.budget != null && row.variance < 0) {
      push({
        id: `under:${row.stationId}`,
        kind: "UNDER_BUDGET",
        tone: "info",
        stationId: row.stationId,
        ar: `${row.name}: ${row.actual} من ${row.budget} في الميزانية — ${-row.variance} لم يُعيَّنوا.`,
        en: `${row.name}: ${row.actual} of ${row.budget} budgeted — ${-row.variance} not yet hired.`,
      });
    }
    const hasChildUnits = stations.some((s) => stationParentId(s) === row.stationId && !isUnitClosed(s));
    if (row.actual === 1 && !hasChildUnits && station && !isCompanyRootStation(station) && !isHrUnit(station) && !isManagerUnit(station)) {
      push({
        id: `single:${row.stationId}`,
        kind: "SINGLE_PERSON_UNIT",
        tone: "info",
        stationId: row.stationId,
        ar: `${row.name} وحدة من شخص واحد — ادمجها أو أكمل فريقها.`,
        en: `${row.name} is a one-person unit — merge it or complete the team.`,
      });
    }
  });

  // circular reporting guard
  const names = byIdMap(people);
  reportingCycles(data).forEach((loop) => {
    push({
      id: `cycle:${loop.join(">")}`,
      kind: "REPORTING_CYCLE",
      tone: "bad",
      employeeId: loop[0],
      ar: `حلقة تبعية: ${loop.map((id) => names.get(id)?.name || id).join(" ← ")} ← … — يتبع كل منهم الآخر.`,
      en: `Reporting loop: ${loop.map((id) => names.get(id)?.name || id).join(" → ")} → …`,
    });
  });
  stationCycles(stations).forEach((loop) => {
    push({
      id: `unitcycle:${loop.join(">")}`,
      kind: "UNIT_CYCLE",
      tone: "bad",
      stationId: loop[0],
      ar: `حلقة في الوحدات: ${loop.map((id) => stationById.get(id)?.name || id).join(" ← ")}.`,
      en: `Unit loop: ${loop.map((id) => stationById.get(id)?.name || id).join(" → ")}.`,
    });
  });

  // span & layers summary findings
  const span = deriveSpanLayers(data, cfg, day);
  span.rows.filter((r) => r.verdict === "wide").forEach((r) => push({
    id: `wide:${r.employeeId}`,
    kind: "SPAN_WIDE",
    tone: "warn",
    employeeId: r.employeeId,
    ar: `${r.name} يقود ${r.direct} مباشرين — فوق حدّ الشركة ${cfg.spanMax}.`,
    en: `${r.name} leads ${r.direct} direct reports — above the limit of ${cfg.spanMax}.`,
  }));
  if (span.tooDeep) {
    push({
      id: "layers",
      kind: "LAYERS_DEEP",
      tone: "warn",
      ar: `الهيكل ${span.layers} طبقات — فوق حدّ الشركة ${cfg.maxLayers}.`,
      en: `The structure is ${span.layers} layers deep — above the limit of ${cfg.maxLayers}.`,
    });
  }

  const rank = { bad: 0, warn: 1, info: 2 };
  items.sort((a, b) => rank[a.tone] - rank[b.tone] || String(a.kind).localeCompare(String(b.kind)) || (b.days || 0) - (a.days || 0));
  return {
    items,
    bad: items.filter((i) => i.tone === "bad").length,
    warn: items.filter((i) => i.tone === "warn").length,
    info: items.filter((i) => i.tone === "info").length,
  };
}

/** Acting roles that end soon or ran over — the reminder list a notice is sent from. */
export function actingReminders(data, day = todayKey(), settings = orgDesignOf(data).settings) {
  return deriveOrgHealth(data, { day, settings }).items
    .filter((i) => i.kind === "ACTING_ENDING" || i.kind === "ACTING_OVER_LIMIT")
    .map((i) => ({ key: `org_acting:${i.id}:${day.slice(0, 7)}`, employeeId: i.employeeId, ar: i.ar, en: i.en, kind: i.kind }));
}

/* ───────────────────────── delegation of authority ───────────────────────── */

export const DOA_KINDS = ["leave", "overtime", "sanction", "payroll", "task_approval", "offboarding"];
export const DOA_KIND_LABELS = {
  leave: { ar: "الإجازات", en: "Leave", unit: "days", unitAr: "يوم", unitEn: "days" },
  overtime: { ar: "العمل الإضافي", en: "Overtime", unit: "hours", unitAr: "ساعة", unitEn: "hours" },
  sanction: { ar: "الجزاءات", en: "Sanctions", unit: "days", unitAr: "يوم حسم", unitEn: "deduction days" },
  payroll: { ar: "مسير الرواتب", en: "Payroll", unit: "amount", unitAr: "ريال", unitEn: "SAR" },
  task_approval: { ar: "اعتماد المهام", en: "Task approval", unit: "", unitAr: "", unitEn: "" },
  offboarding: { ar: "إنهاء الخدمة", en: "Offboarding", unit: "", unitAr: "", unitEn: "" },
};
/** Voice never routes to a manager — Model regulation Art. 56; the complaints chain is its own. */
export const DOA_FORBIDDEN_KINDS = ["complaint", "complaints", "voice", "anonymous", "abuse", "grievance"];

const DOA_VOICE_REASON = {
  error: "DOA_VOICE_NEVER_MANAGER",
  reason: "صوت الموظف والشكاوى لا تمر بمصفوفة الصلاحيات ولا تُوجَّه للمدير — لها سلسلة معالجتها الخاصة.",
  reasonEn: "Employee voice and complaints never route through the authority matrix or to a manager — they keep their own handling chain.",
};

export function checkDoaRowGate(row = {}, data = {}) {
  const kind = str(row.kind);
  if (DOA_FORBIDDEN_KINDS.includes(kind)) return { ok: false, ...DOA_VOICE_REASON };
  if (!DOA_KINDS.includes(kind)) {
    return { ok: false, error: "DOA_KIND", reason: "نوع القرار غير معروف.", reasonEn: "Unknown decision type." };
  }
  const seats = byIdMap(seatsOf(data));
  const approver = seats.get(str(row.approverSeatId));
  if (!approver) {
    return { ok: false, error: "DOA_APPROVER_SEAT", reason: "اختر منصب المعتمِد — الصلاحية تتبع المنصب لا الشخص.", reasonEn: "Pick the approving seat — authority follows the seat, not the person." };
  }
  if (str(approver.state) === "frozen") {
    return { ok: false, error: "DOA_SEAT_FROZEN", reason: "منصب المعتمِد مجمّد — لا تُسند إليه صلاحية.", reasonEn: "The approving seat is frozen." };
  }
  const unitId = str(row.unitId);
  if (unitId && !(data.stations || []).some((s) => str(s.id) === unitId)) {
    return { ok: false, error: "DOA_UNIT", reason: "الوحدة غير موجودة.", reasonEn: "Unit not found." };
  }
  const limitRaw = row.limit;
  if (limitRaw !== undefined && limitRaw !== null && str(limitRaw) !== "") {
    const n = Number(limitRaw);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "DOA_LIMIT", reason: "الحد يجب أن يكون رقماً موجباً.", reasonEn: "The limit must be a positive number." };
    }
  }
  const esc = str(row.escalateToSeatId);
  if (esc) {
    if (esc === str(row.approverSeatId)) {
      return { ok: false, error: "DOA_ESCALATE_SELF", reason: "التصعيد لا يكون إلى المنصب نفسه.", reasonEn: "Escalation cannot point to the same seat." };
    }
    if (!seats.has(esc)) {
      return { ok: false, error: "DOA_ESCALATE_SEAT", reason: "منصب التصعيد غير موجود.", reasonEn: "Escalation seat not found." };
    }
  }
  const dup = (orgDesignOf(data).doa || []).find((r) => (
    str(r.id) !== str(row.id)
    && str(r.kind) === kind
    && str(r.unitId) === unitId
    && str(r.limit) === str(limitRaw ?? "")
    && !r.disabled
  ));
  if (dup) {
    return { ok: false, error: "DOA_DUPLICATE", reason: "يوجد سطر بنفس النوع والوحدة والحد.", reasonEn: "A row with the same type, unit and limit exists." };
  }
  return { ok: true };
}

/** Who sits on a seat today: the holder, else the acting occupant, else the deputy's holder. */
export function seatOccupant(data, seatId, day = todayKey()) {
  const seat = seatsOf(data).find((s) => str(s.id) === str(seatId));
  if (!seat) return null;
  const holder = seatHolder(data, seat);
  if (holder) return { employeeId: str(holder.id), name: holder.name || "", via: "holder", seatId: str(seat.id), title: seat.title || "" };
  const acting = actingOnSeat(data, seat, day);
  if (acting) return { employeeId: str(acting.employee.id), name: acting.employee.name || "", via: "acting", seatId: str(seat.id), title: seat.title || "" };
  const deputy = seat.deputySeatId ? seatsOf(data).find((s) => str(s.id) === str(seat.deputySeatId)) : null;
  const deputyHolder = deputy ? seatHolder(data, deputy) : null;
  if (deputyHolder) return { employeeId: str(deputyHolder.id), name: deputyHolder.name || "", via: "deputy", seatId: str(seat.id), title: seat.title || "" };
  return null;
}

/**
 * Resolve the approving seat for a decision about one employee.
 *   1. rows of that kind whose unit is the employee's unit or an ancestor (company-wide last);
 *   2. the most specific row whose limit covers the amount, else follow its escalation seat;
 *   3. the seat's occupant (holder → acting → deputy); the subject never approves himself.
 * No row → source "default": the caller keeps the current manager-chain behaviour.
 */
export function resolveDoa(data, { kind, employeeId, amount = null, day = todayKey() } = {}) {
  const k = str(kind);
  if (DOA_FORBIDDEN_KINDS.includes(k)) return { source: "refused", approvers: [], path: [], ...DOA_VOICE_REASON };
  const rows = orgDesignOf(data).doa.filter((r) => str(r.kind) === k && !r.disabled);
  if (!rows.length) return { source: "default", approvers: [], path: [] };
  const employee = activePeople(data).find((e) => str(e.id) === str(employeeId));
  if (!employee) return { source: "default", approvers: [], path: [] };
  const ancestry = unitPath(data, homeStationId(employee, data)).map((s) => str(s.id)).reverse();
  const rank = (row) => {
    const unit = str(row.unitId);
    if (!unit) return ancestry.length;
    const at = ancestry.indexOf(unit);
    return at < 0 ? -1 : at;
  };
  const candidates = rows
    .map((row) => ({ row, rank: rank(row) }))
    .filter((c) => c.rank >= 0)
    .sort((a, b) => a.rank - b.rank || (Number(a.row.limit ?? Infinity) - Number(b.row.limit ?? Infinity)));
  if (!candidates.length) return { source: "default", approvers: [], path: [] };
  const amt = amount == null || str(amount) === "" ? null : Number(amount);
  const covers = (row) => {
    if (row.limit == null || str(row.limit) === "" || amt == null) return true;
    return amt <= Number(row.limit);
  };
  const path = [];
  const tried = new Set();
  const subject = str(employee.id);
  const trySeat = (seatId, why, row) => {
    const sid = str(seatId);
    if (!sid || tried.has(sid)) return null;
    tried.add(sid);
    const occ = seatOccupant(data, sid, day);
    const seat = seatsOf(data).find((s) => str(s.id) === sid);
    if (!occ) {
      path.push({ seatId: sid, title: seat?.title || "", why: "vacant", rowId: str(row?.id) });
      return null;
    }
    if (occ.employeeId === subject) {
      path.push({ seatId: sid, title: occ.title, employeeId: occ.employeeId, name: occ.name, why: "self", rowId: str(row?.id) });
      return null;
    }
    path.push({ seatId: sid, title: occ.title, employeeId: occ.employeeId, name: occ.name, via: occ.via, why, rowId: str(row?.id) });
    return occ;
  };
  for (const { row } of candidates) {
    let hit = null;
    if (covers(row)) hit = trySeat(row.approverSeatId, "row", row);
    else path.push({ seatId: str(row.approverSeatId), why: "over_limit", limit: Number(row.limit), rowId: str(row.id) });
    if (!hit && row.escalateToSeatId) hit = trySeat(row.escalateToSeatId, "escalated", row);
    if (hit) {
      return { source: "doa", rowId: str(row.id), approvers: [hit], path };
    }
  }
  return { source: "default", approvers: [], path, unresolved: true };
}

export function doaApproverIds(data, employee, kind, amount = null, day = todayKey()) {
  const res = resolveDoa(data, { kind, employeeId: employee?.id, amount, day });
  return res.source === "doa" ? res.approvers.map((a) => a.employeeId) : [];
}

/** People whose decisions of this kind resolve to the viewer (the DoA inbox). */
const doaInboxCache = new WeakMap();

export function doaSubjectsFor(data, viewerId, kind, day = todayKey()) {
  const me = str(viewerId);
  if (!me || !data || !orgDesignOf(data).doa.some((r) => str(r.kind) === str(kind) && !r.disabled)) return [];
  // one resolution per data snapshot and kind — badges and inbox ask often
  let byKind = doaInboxCache.get(data);
  if (!byKind) {
    byKind = new Map();
    doaInboxCache.set(data, byKind);
  }
  // the store mutates data in place, so the key carries what the resolution reads
  const cacheKey = [
    kind,
    day,
    JSON.stringify(orgDesignOf(data).doa),
    seatsOf(data).map((s) => `${s.id}:${s.employeeId || ""}:${s.deputySeatId || ""}:${s.stationId || ""}`).join(","),
    (data.employees || []).map((e) => `${e.id}:${e.stationId || ""}:${e.active === false ? 0 : 1}:${JSON.stringify(e.actingAssignments || [])}`).join(","),
    (data.stations || []).map((s) => `${s.id}:${stationParentId(s) || ""}`).join(","),
  ].join("|");
  if (!byKind.has(cacheKey)) {
    if (byKind.size > 12) byKind.clear();
    const map = new Map();
    activePeople(data).forEach((e) => {
      doaApproverIds(data, e, kind, null, day).forEach((approver) => {
        const list = map.get(approver) || [];
        list.push(e);
        map.set(approver, list);
      });
    });
    byKind.set(cacheKey, map);
  }
  return (byKind.get(cacheKey).get(me) || []).filter((e) => str(e.id) !== me);
}

/* ───────────────────────── permissions ───────────────────────── */

function activeHrLevel(user, data) {
  if (!user?.hrLevelId) return null;
  return (data?.hrLevels || []).find((l) => l.id === user.hrLevelId && l.active !== false) || null;
}

export function isOrgOwner(user, data) {
  if (!user) return false;
  return Boolean(user.role === "owner" || user.isOwner || (str(data?.ownerId) && str(user.id) === str(data.ownerId)));
}

/** Owner and HR design the structure; the director/admin keep it as account administrators. */
export function canEditOrgDesign(user, data) {
  if (!user) return false;
  if (isOrgOwner(user, data)) return true;
  if (["director", "admin", "hr_manager"].includes(user.role)) return true;
  const level = activeHrLevel(user, data);
  return Boolean(level && (level.permissions || []).includes("manage_employees"));
}

/** "edit" · "subtree" (leads people) · "self" (مكاني في الهيكل only). */
export function orgViewScope(user, data) {
  if (!user) return "self";
  if (canEditOrgDesign(user, data)) return "edit";
  const graph = reportingGraph(data);
  if ((graph.children.get(str(user.id)) || []).length) return "subtree";
  if ((data?.stations || []).some((s) => str(s.managerId) === str(user.id))) return "subtree";
  return "self";
}

export function checkOrgViewGate(user, data, targetEmployeeId) {
  const target = str(targetEmployeeId);
  const scope = orgViewScope(user, data);
  if (!user) return { ok: false, error: "ORG_VIEW_SIGNED_OUT", reason: "سجّل الدخول.", reasonEn: "Sign in." };
  if (!target || target === str(user.id) || scope === "edit") return { ok: true, scope };
  if (scope === "subtree") {
    const ids = descendantsInGraph(reportingGraph(data), user.id);
    if (ids.includes(target)) return { ok: true, scope };
    return {
      ok: false,
      error: "ORG_VIEW_OUTSIDE_SUBTREE",
      reason: "هذا الموظف خارج فريقك — يرى المدير فرعه من الهيكل فقط.",
      reasonEn: "This person is outside your team — a manager sees only their own subtree.",
    };
  }
  return {
    ok: false,
    error: "ORG_VIEW_SELF_ONLY",
    reason: "يرى الموظف مكانه في الهيكل فقط.",
    reasonEn: "An employee sees only their own place in the structure.",
  };
}

/* ───────────────────────── my place in the structure ───────────────────────── */

/**
 * Read-only "where am I": my seat, my unit path, my manager (with acting cover), my dotted lines,
 * my peers (same manager) and my direct team. Names and titles only — no file data.
 */
export function deriveMyPlace(data, employeeId, day = todayKey()) {
  const id = str(employeeId);
  const people = activePeople(data);
  const byPerson = byIdMap(people);
  const me = byPerson.get(id);
  if (!me) return null;
  const graph = reportingGraph(data);
  const seat = seatsOf(data).find((s) => str(s.employeeId) === id) || null;
  const titleOf = (person) => {
    const s = seatsOf(data).find((row) => str(row.employeeId) === str(person?.id));
    return str(s?.title || person?.profile?.position || person?.jobTitle || person?.position);
  };
  const face = (person, extra = {}) => (person ? { employeeId: str(person.id), name: person.name || "", title: titleOf(person), ...extra } : null);
  const managerId = graph.managerOf.get(id) || "";
  const manager = managerId ? byPerson.get(managerId) : null;
  const homeId = homeStationId(me, data);
  const path = unitPath(data, homeId);
  const stations = data?.stations || [];
  const home = path[path.length - 1] || null;
  const actingCover = (() => {
    const managerSeat = manager ? seatsOf(data).find((s) => str(s.employeeId) === str(manager.id)) : null;
    if (!managerSeat) return null;
    const acting = actingOnSeat(data, managerSeat, day);
    return acting ? face(acting.employee, { until: dayOf(acting.assignment.until) }) : null;
  })();
  const dotted = [];
  if (seat?.dottedToSeatId) {
    const occ = seatOccupant(data, seat.dottedToSeatId, day);
    const target = seatsOf(data).find((s) => str(s.id) === str(seat.dottedToSeatId));
    dotted.push({ seatId: str(seat.dottedToSeatId), title: target?.title || "", name: occ?.name || "", employeeId: occ?.employeeId || "" });
  }
  const dottedFrom = seatsOf(data)
    .filter((s) => seat && str(s.dottedToSeatId) === str(seat.id) && seatHolder(data, s))
    .map((s) => face(seatHolder(data, s)));
  const peers = managerId
    ? (graph.children.get(managerId) || []).filter((pid) => pid !== id).map((pid) => face(byPerson.get(pid))).filter(Boolean)
    : [];
  const team = (graph.children.get(id) || []).map((pid) => face(byPerson.get(pid))).filter(Boolean);
  const openSeats = seatsOf(data).filter((s) => seatState(s, data, day) === "vacant" && seatParentEmployeeId(s, data) === id).length;
  const deputyOf = seatsOf(data)
    .filter((s) => seat && str(s.deputySeatId) === str(seat.id))
    .map((s) => ({ seatId: str(s.id), title: s.title || "", name: seatHolder(data, s)?.name || "" }));
  const myDeputy = seat?.deputySeatId ? seatOccupant(data, seat.deputySeatId, day) : null;
  const acting = activeActing(me, day).map((a) => ({
    stationId: str(a.stationId),
    stationName: stations.find((s) => str(s.id) === str(a.stationId))?.name || "",
    title: str(a.title),
    until: dayOf(a.until),
  }));
  return {
    me: { employeeId: id, name: me.name || "", title: titleOf(me), seatCode: seat ? seatCode(seat, data) : "" },
    unit: home ? { stationId: str(home.id), name: home.name || "", level: unitLevel(home, stations) } : null,
    path: path.map((s) => ({ stationId: str(s.id), name: s.name || "", level: unitLevel(s, stations) })),
    manager: face(manager),
    actingCover,
    dotted,
    dottedFrom,
    peers,
    team,
    openSeats,
    deputyOf,
    deputy: myDeputy ? { name: myDeputy.name, title: myDeputy.title } : null,
    acting,
    layer: (graph.depth.get(id) ?? 0) + 1,
  };
}

/** A manager's subtree — names, titles, units and seat state only. */
export function deriveSubtree(data, managerId, day = todayKey()) {
  const graph = reportingGraph(data);
  const people = byIdMap(activePeople(data));
  const stations = byIdMap(data?.stations);
  const build = (id, guard = 0) => {
    const person = people.get(id);
    if (!person || guard > 40) return null;
    const seat = seatsOf(data).find((s) => str(s.employeeId) === id);
    const open = seatsOf(data)
      .filter((s) => seatState(s, data, day) === "vacant" && seatParentEmployeeId(s, data) === id)
      .map((s) => ({ seatId: str(s.id), title: s.title || "", days: daysVacant(s, day) }));
    return {
      employeeId: id,
      name: person.name || "",
      title: str(seat?.title || person.profile?.position || person.jobTitle),
      unit: stations.get(homeStationId(person, data))?.name || "",
      open,
      children: (graph.children.get(id) || []).map((c) => build(c, guard + 1)).filter(Boolean),
    };
  };
  return build(str(managerId));
}

/* ───────────────────────── org change requests ───────────────────────── */

export const CHANGE_OPS = ["moveSeat", "reparentUnit", "createUnit", "closeUnit", "setBudget", "freezeSeat", "setDotted"];
export const CHANGE_OP_LABELS = {
  moveSeat: { ar: "نقل منصب إلى وحدة", en: "Move a seat to a unit" },
  reparentUnit: { ar: "تغيير تبعية وحدة", en: "Change a unit's parent" },
  createUnit: { ar: "إنشاء وحدة", en: "Create a unit" },
  closeUnit: { ar: "إغلاق وحدة", en: "Close a unit" },
  setBudget: { ar: "ميزانية عدد الموظفين", en: "Headcount budget" },
  freezeSeat: { ar: "تجميد / فك تجميد منصب", en: "Freeze / unfreeze a seat" },
  setDotted: { ar: "خط منقّط (تبعية فنية)", en: "Dotted line" },
};
export const CHANGE_STATUSES = ["draft", "pending", "approved", "published", "rejected", "cancelled"];
export const CHANGE_STATUS_LABELS = {
  draft: { ar: "مسودة", en: "Draft" },
  pending: { ar: "بانتظار الاعتماد", en: "Awaiting approval" },
  approved: { ar: "معتمد — ينتظر تاريخ السريان", en: "Approved — awaiting effective date" },
  published: { ar: "منشور", en: "Published" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
};

const fail = (error, reason, reasonEn, extra = {}) => ({ ok: false, error, reason, reasonEn, ...extra });

function findStation(data, id) {
  return (data?.stations || []).find((s) => str(s.id) === str(id)) || null;
}

function findSeat(data, id) {
  return seatsOf(data).find((s) => str(s.id) === str(id)) || null;
}

/** Validate one op against the data as it stands at that point of the change. */
function checkOp(data, op, { effectiveDate } = {}) {
  const type = str(op?.type);
  if (!CHANGE_OPS.includes(type)) return fail("ORG_OP_UNKNOWN", "إجراء غير معروف.", "Unknown change step.");
  if (type === "moveSeat") {
    const seat = findSeat(data, op.seatId);
    if (!seat) return fail("ORG_SEAT_NOT_FOUND", "المنصب غير موجود.", "Seat not found.");
    const to = findStation(data, op.toStationId);
    if (!to) return fail("ORG_UNIT_NOT_FOUND", "الوحدة الوجهة غير موجودة.", "Target unit not found.");
    if (isUnitClosed(to)) return fail("ORG_UNIT_CLOSED", "الوحدة الوجهة مغلقة.", "The target unit is closed.");
    if (isManagerUnit(to) || isHrUnit(to)) {
      return fail("ORG_UNIT_NOT_WORKPLACE", "الوجهة ليست مكان عمل (إدارة إقليمية أو وحدة الموارد الثابتة).", "The target is not a workplace (region node or the fixed HR unit).");
    }
    if (str(seat.stationId) === str(to.id)) return fail("ORG_SAME_UNIT", "المنصب في هذه الوحدة بالفعل.", "The seat is already in that unit.");
    const holder = seatHolder(data, seat);
    if (holder) {
      // Labour Law Art. 58 — moving the holder's workplace: residence question first.
      const residence = str(op.residence);
      if (!["same", "change", "necessity"].includes(residence)) {
        return fail(
          "ORG_ART58_RESIDENCE",
          `المنصب يشغله ${holder.name}: حدّد هل يقتضي النقل تغيير محل إقامته (المادة 58).`,
          `The seat is held by ${holder.name}: say whether the move changes their residence (Art. 58).`,
          { article: "58" },
        );
      }
      if (residence === "change") {
        const consent = checkConsentGate(holder, "site");
        if (!consent.ok) return { ...consent, article: "58" };
      }
      if (residence === "necessity") {
        const need = checkNecessityGate(holder, "site", { from: effectiveDate, until: op.necessityUntil });
        if (!need.ok) return { ...need, article: "58" };
      }
    }
    return { ok: true };
  }
  if (type === "reparentUnit") {
    const station = findStation(data, op.stationId);
    if (!station) return fail("ORG_UNIT_NOT_FOUND", "الوحدة غير موجودة.", "Unit not found.");
    if (isCompanyRootStation(station)) return fail("ORG_COMPANY_ROOT", "المنشأة رأس الهيكل ولا تتبع وحدة.", "The company is the apex and has no parent.");
    if (isHrUnit(station)) return fail("ORG_FIXED_HR", "وحدة الموارد البشرية ثابتة.", "The HR unit is fixed.");
    const parent = findStation(data, op.toParentId);
    if (!parent) return fail("ORG_PARENT_NOT_FOUND", "الوحدة الأم غير موجودة.", "Parent unit not found.");
    if (isHrUnit(parent)) return fail("ORG_HR_NOT_PARENT", "لا تتبع الوحدات وحدة الموارد البشرية.", "Units do not report to the HR unit.");
    if (isUnitClosed(parent)) return fail("ORG_UNIT_CLOSED", "الوحدة الأم مغلقة.", "The parent unit is closed.");
    if (wouldCreateStationCycle(data.stations || [], station.id, parent.id)) {
      return fail("ORG_CYCLE", "لا تتبع الوحدة نفسها أو إحدى وحداتها — حلقة تبعية.", "A unit cannot hang under itself or its own descendants — circular reporting.");
    }
    return { ok: true };
  }
  if (type === "createUnit") {
    if (!str(op.name)) return fail("ORG_UNIT_NAME", "اسم الوحدة مطلوب.", "Unit name is required.");
    const parent = findStation(data, op.parentId);
    if (!parent) return fail("ORG_PARENT_NOT_FOUND", "الوحدة الأم غير موجودة.", "Parent unit not found.");
    if (isHrUnit(parent) || isUnitClosed(parent)) return fail("ORG_PARENT_INVALID", "لا يمكن الإنشاء تحت هذه الوحدة.", "Cannot create under this unit.");
    if (op.orgLevel && !ORG_LEVELS.includes(str(op.orgLevel))) return fail("ORG_LEVEL", "مستوى الوحدة غير معروف.", "Unknown unit level.");
    const clash = (data.stations || []).some((s) => !isUnitClosed(s) && normTitle(s.name) === normTitle(op.name));
    if (clash) return fail("ORG_UNIT_NAME_TAKEN", "يوجد وحدة بالاسم نفسه.", "A unit with this name exists.");
    return { ok: true };
  }
  if (type === "closeUnit") {
    const station = findStation(data, op.stationId);
    if (!station) return fail("ORG_UNIT_NOT_FOUND", "الوحدة غير موجودة.", "Unit not found.");
    if (isCompanyRootStation(station) || isHrUnit(station)) return fail("ORG_UNIT_FIXED", "هذه الوحدة ثابتة ولا تُغلق.", "This unit is fixed.");
    const sid = str(station.id);
    const kids = (data.stations || []).filter((s) => stationParentId(s) === sid && !isUnitClosed(s));
    if (kids.length) return fail("ORG_UNIT_HAS_CHILDREN", `تتبعها ${kids.length} وحدة — انقلها أولاً.`, `${kids.length} units still hang under it — move them first.`);
    const people = activePeople(data).filter((e) => homeStationId(e, data) === sid);
    if (people.length) return fail("ORG_UNIT_HAS_PEOPLE", `فيها ${people.length} موظف — انقل مناصبهم أولاً.`, `${people.length} people still work there — move their seats first.`);
    return { ok: true };
  }
  if (type === "setBudget") {
    if (!findStation(data, op.stationId)) return fail("ORG_UNIT_NOT_FOUND", "الوحدة غير موجودة.", "Unit not found.");
    const n = Number(op.budget);
    if (str(op.budget) !== "" && (!Number.isInteger(n) || n < 0 || n > 100000)) {
      return fail("ORG_BUDGET", "الميزانية عدد صحيح موجب.", "The budget must be a whole positive number.");
    }
    return { ok: true };
  }
  if (type === "freezeSeat") {
    const seat = findSeat(data, op.seatId);
    if (!seat) return fail("ORG_SEAT_NOT_FOUND", "المنصب غير موجود.", "Seat not found.");
    if (op.frozen !== false && seatHolder(data, seat)) {
      return fail("ORG_SEAT_FILLED", "لا يُجمَّد منصب مشغول — أخلِه أولاً.", "A filled seat cannot be frozen — vacate it first.");
    }
    return { ok: true };
  }
  if (type === "setDotted") {
    const seat = findSeat(data, op.seatId);
    if (!seat) return fail("ORG_SEAT_NOT_FOUND", "المنصب غير موجود.", "Seat not found.");
    const to = str(op.toSeatId);
    if (to) {
      if (to === str(seat.id)) return fail("ORG_DOTTED_SELF", "لا يتبع المنصب نفسه.", "A seat cannot dot-line to itself.");
      if (!findSeat(data, to)) return fail("ORG_SEAT_NOT_FOUND", "المنصب المرجع غير موجود.", "Reference seat not found.");
      // dotted loops are a cycle too
      const seen = new Set([str(seat.id)]);
      let cursor = findSeat(data, to);
      while (cursor) {
        if (seen.has(str(cursor.id))) return fail("ORG_CYCLE", "الخط المنقّط يصنع حلقة تبعية.", "The dotted line makes a loop.");
        seen.add(str(cursor.id));
        cursor = cursor.dottedToSeatId ? findSeat(data, cursor.dottedToSeatId) : null;
      }
    }
    return { ok: true };
  }
  return { ok: true };
}

/**
 * Apply ops to a data draft. Returns the inverse snapshot so the change can be undone for an
 * as-of view. Creates ids deterministically from the change id so a replay matches.
 */
export function applyOrgChange(data, change) {
  const inverse = [];
  const snapStation = (s, fields) => inverse.push({ entity: "station", id: str(s.id), before: Object.fromEntries(fields.map((f) => [f, s[f] ?? null])) });
  const snapSeat = (s, fields) => inverse.push({ entity: "seat", id: str(s.id), before: Object.fromEntries(fields.map((f) => [f, s[f] ?? null])) });
  const snapPerson = (e, fields) => inverse.push({ entity: "employee", id: str(e.id), before: Object.fromEntries(fields.map((f) => [f, f === "profile.stationId" ? (e.profile?.stationId ?? null) : (e[f] ?? null)])) });
  data.stations = Array.isArray(data.stations) ? data.stations : [];
  (change?.ops || []).forEach((op, index) => {
    const type = str(op.type);
    if (type === "moveSeat") {
      const seat = findSeat(data, op.seatId);
      if (!seat) return;
      snapSeat(seat, ["stationId"]);
      seat.stationId = str(op.toStationId);
      const holder = seatHolder(data, seat);
      if (holder) {
        snapPerson(holder, ["stationId", "profile.stationId"]);
        holder.stationId = str(op.toStationId);
        if (holder.profile && str(holder.profile.stationId)) holder.profile.stationId = str(op.toStationId);
      }
    } else if (type === "reparentUnit") {
      const station = findStation(data, op.stationId);
      if (!station) return;
      snapStation(station, ["parentStationId"]);
      station.parentStationId = str(op.toParentId) || null;
    } else if (type === "createUnit") {
      const id = str(op.unitId) || `st_org_${str(change.id).replace(/[^a-z0-9]/gi, "").slice(-8)}_${index}`;
      if (findStation(data, id)) return;
      data.stations.push({
        id,
        name: str(op.name),
        parentStationId: str(op.parentId) || null,
        orgLevel: ORG_LEVELS.includes(str(op.orgLevel)) ? str(op.orgLevel) : undefined,
        headcountBudget: str(op.budget) === "" || op.budget == null ? undefined : Number(op.budget),
        createdAt: change.effectiveDate ? `${change.effectiveDate}T00:00:00.000Z` : new Date().toISOString(),
        createdByChange: str(change.id),
      });
      inverse.push({ entity: "station", id, created: true });
    } else if (type === "closeUnit") {
      const station = findStation(data, op.stationId);
      if (!station) return;
      snapStation(station, ["closedAt"]);
      station.closedAt = change.effectiveDate || todayKey();
    } else if (type === "setBudget") {
      const station = findStation(data, op.stationId);
      if (!station) return;
      snapStation(station, ["headcountBudget"]);
      station.headcountBudget = str(op.budget) === "" ? null : Number(op.budget);
    } else if (type === "freezeSeat") {
      const seat = findSeat(data, op.seatId);
      if (!seat) return;
      snapSeat(seat, ["state"]);
      seat.state = op.frozen === false ? null : "frozen";
    } else if (type === "setDotted") {
      const seat = findSeat(data, op.seatId);
      if (!seat) return;
      snapSeat(seat, ["dottedToSeatId"]);
      seat.dottedToSeatId = str(op.toSeatId) || null;
    }
  });
  return inverse;
}

export function undoOrgChange(data, inverse = []) {
  [...inverse].reverse().forEach((row) => {
    if (row.entity === "station" && row.created) {
      data.stations = (data.stations || []).filter((s) => str(s.id) !== str(row.id));
      return;
    }
    const list = row.entity === "station" ? data.stations : row.entity === "seat" ? data.orgSeats : data.employees;
    const target = (list || []).find((r) => str(r.id) === str(row.id));
    if (!target) return;
    Object.entries(row.before || {}).forEach(([field, value]) => {
      if (field === "profile.stationId") {
        if (target.profile) target.profile.stationId = value;
        return;
      }
      if (value === null || value === undefined) delete target[field];
      else target[field] = value;
    });
  });
  return data;
}

/** Validate the whole change: header, each step in order, and the result has no loop. */
export function checkOrgChangeGate(data, change = {}, { today = todayKey() } = {}) {
  if (!str(change.title)) return fail("ORG_CHANGE_TITLE", "عنوان التغيير مطلوب.", "A title is required.");
  if (!str(change.reason)) return fail("ORG_CHANGE_REASON", "سبب التغيير مطلوب للتدقيق.", "A reason is required for the audit trail.");
  const effective = dayOf(change.effectiveDate);
  if (!effective) return fail("ORG_CHANGE_DATE", "تاريخ السريان مطلوب.", "An effective date is required.");
  const ops = Array.isArray(change.ops) ? change.ops : [];
  if (!ops.length) return fail("ORG_CHANGE_EMPTY", "أضف خطوة تغيير واحدة على الأقل.", "Add at least one change step.");
  const draft = clone(data);
  for (let i = 0; i < ops.length; i += 1) {
    const gate = checkOp(draft, ops[i], { effectiveDate: effective });
    if (!gate.ok) return { ...gate, step: i };
    applyOrgChange(draft, { ...change, ops: [ops[i]] });
  }
  if (stationCycles(draft.stations || []).length) {
    return fail("ORG_CYCLE", "النتيجة تصنع حلقة تبعية بين الوحدات.", "The result makes a loop between units.");
  }
  return { ok: true, effectiveDate: effective, future: effective > today };
}

/**
 * Impact preview: who changes manager, whose approval path moves, which units cross their
 * budget, and which moves touch Art. 58.
 */
export function deriveChangeImpact(data, change, { day = todayKey() } = {}) {
  const after = clone(data);
  applyOrgChange(after, change);
  const before = reportingGraph(data);
  const next = reportingGraph(after);
  const people = activePeople(data);
  const name = (id) => people.find((e) => str(e.id) === str(id))?.name || "";
  const managerChanges = people
    .map((e) => {
      const id = str(e.id);
      const from = before.managerOf.get(id) || "";
      const to = next.managerOf.get(id) || "";
      return from === to ? null : { employeeId: id, name: e.name || "", from, fromName: name(from), to, toName: name(to) };
    })
    .filter(Boolean);
  const kinds = [...new Set(orgDesignOf(data).doa.filter((r) => !r.disabled).map((r) => str(r.kind)))];
  const approvalChanges = [];
  kinds.forEach((kind) => {
    people.forEach((e) => {
      const a = resolveDoa(data, { kind, employeeId: e.id, day });
      const b = resolveDoa(after, { kind, employeeId: e.id, day });
      const fa = a.approvers[0]?.employeeId || "";
      const fb = b.approvers[0]?.employeeId || "";
      if (fa !== fb) approvalChanges.push({ kind, employeeId: str(e.id), name: e.name || "", from: fa, fromName: name(fa), to: fb, toName: name(fb) });
    });
  });
  const planBefore = new Map(deriveHeadcountPlan(data, day).map((r) => [r.stationId, r]));
  const budget = deriveHeadcountPlan(after, day)
    .map((r) => {
      const b = planBefore.get(r.stationId);
      if (b && b.actual === r.actual && b.budget === r.budget) return null;
      return { stationId: r.stationId, name: r.name, before: b ? b.actual : 0, after: r.actual, budget: r.budget, over: r.budget != null && r.actual > r.budget };
    })
    .filter(Boolean);
  const ministry = (change?.ops || [])
    .filter((op) => str(op.type) === "moveSeat")
    .map((op) => {
      const seat = findSeat(data, op.seatId);
      const holder = seat ? seatHolder(data, seat) : null;
      if (!holder) return null;
      const residence = str(op.residence);
      return {
        article: "58",
        employeeId: str(holder.id),
        name: holder.name || "",
        residence,
        ar: residence === "change"
          ? `نقل ${holder.name} يغيّر محل إقامته — بموافقته الكتابية (المادة 58)، ويُحدَّث مكان العمل في العقد (اللائحة م20).`
          : residence === "necessity"
            ? `نقل ${holder.name} لضرورة عارضة مؤقتة حتى ${dayOf(op.necessityUntil) || "—"} — بحد 30 يوماً في السنة وعلى نفقة المنشأة (المادة 58).`
            : `نقل ${holder.name} لا يغيّر محل إقامته — يُحدَّث مكان العمل في العقد (اللائحة م20).`,
        en: residence === "change"
          ? `${holder.name}'s move changes residence — needs their written consent (Art. 58); the contract workplace is updated (Regs Art. 20).`
          : residence === "necessity"
            ? `${holder.name} moves for temporary necessity until ${dayOf(op.necessityUntil) || "—"} — up to 30 days a year at the employer's cost (Art. 58).`
            : `${holder.name}'s move keeps the residence — the contract workplace is updated (Regs Art. 20).`,
      };
    })
    .filter(Boolean);
  const cycles = stationCycles(after.stations || []).length + reportingCycles(after).length;
  return { managerChanges, approvalChanges, budget, ministry, cycles };
}

/* ───────────────────────── workflow ───────────────────────── */

export function checkChangeTransitionGate(change, next, { actor, data, today = todayKey(), note = "" } = {}) {
  const status = str(change?.status) || "draft";
  if (!canEditOrgDesign(actor, data)) {
    return fail("ORG_EDIT_HR_ONLY", "تصميم الهيكل للمالك والموارد البشرية.", "Structure design is for the owner and HR.");
  }
  const flows = {
    draft: ["pending", "cancelled"],
    pending: ["approved", "rejected", "draft", "cancelled"],
    approved: ["published", "cancelled"],
    published: [],
    rejected: ["draft"],
    cancelled: [],
  };
  if (!(flows[status] || []).includes(next)) {
    return fail("ORG_CHANGE_FLOW", `لا ينتقل التغيير من «${CHANGE_STATUS_LABELS[status]?.ar || status}» إلى «${CHANGE_STATUS_LABELS[next]?.ar || next}».`, `A change cannot move from ${status} to ${next}.`);
  }
  if (next === "approved" || next === "rejected") {
    if (str(change.createdById) && str(change.createdById) === str(actor?.id) && !isOrgOwner(actor, data)) {
      return fail("ORG_CHANGE_SELF_APPROVE", "فصل المهام: من أعدّ التغيير لا يعتمده — يعتمده مسؤول آخر أو المالك.", "Segregation of duties: the author cannot approve their own change — another HR member or the owner does.");
    }
  }
  if (next === "rejected" && !str(note)) {
    return fail("ORG_CHANGE_REJECT_REASON", "سبب الرفض مكتوب مطلوب.", "A written rejection reason is required.");
  }
  if (next === "pending" || next === "approved" || next === "published") {
    const gate = checkOrgChangeGate(data, change, { today });
    if (!gate.ok) return gate;
  }
  if (next === "published" && dayOf(change.effectiveDate) > today) {
    return fail("ORG_CHANGE_NOT_DUE", `يسري التغيير في ${dayOf(change.effectiveDate)} — يُنشر تلقائياً في ذلك اليوم.`, `Effective ${dayOf(change.effectiveDate)} — it publishes itself that day.`);
  }
  return { ok: true };
}

export function dueChanges(data, today = todayKey()) {
  return orgDesignOf(data).changes
    .filter((c) => str(c.status) === "approved" && dayOf(c.effectiveDate) && dayOf(c.effectiveDate) <= today)
    .sort((a, b) => dayOf(a.effectiveDate).localeCompare(dayOf(b.effectiveDate)));
}

/** Signed org decision — content hash over the change as published, plus a short seal. */
export function sealOrgDecision(change, { companyId = "", by = "", byId = "", at = new Date().toISOString() } = {}) {
  const canonical = JSON.stringify({
    companyId,
    id: str(change?.id),
    title: str(change?.title),
    reason: str(change?.reason),
    effectiveDate: dayOf(change?.effectiveDate),
    ops: (change?.ops || []).map((op) => Object.fromEntries(Object.entries(op).sort(([a], [b]) => a.localeCompare(b)))),
    approvedById: str(change?.approvedById),
  });
  const h1 = fnv1a(canonical);
  const h2 = fnv1a(`${canonical}|${h1}`);
  const hash = `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`.toUpperCase();
  const refDigits = str(change?.id).replace(/\D/g, "").slice(-4).padStart(4, "0");
  const tail = (h1 % 1679616).toString(36).toUpperCase().padStart(4, "0");
  return { seal: `NV-ORG-${refDigits}-${tail}`, hash, by, byId, at };
}

/* ───────────────────────── time travel ───────────────────────── */

/**
 * The structure as of a day. Published changes effective after that day are undone (newest
 * first); approved changes due by that day are applied — so a future day previews the plan.
 */
export function orgAsOf(data, day, { today = todayKey() } = {}) {
  const target = dayOf(day) || today;
  const snapshot = clone(data);
  const changes = orgDesignOf(data).changes;
  const published = changes
    .filter((c) => str(c.status) === "published" && Array.isArray(c.inverse))
    .sort((a, b) => dayOf(b.effectiveDate).localeCompare(dayOf(a.effectiveDate)) || str(b.publishedAt).localeCompare(str(a.publishedAt)));
  published.forEach((c) => {
    if (dayOf(c.effectiveDate) > target) undoOrgChange(snapshot, c.inverse);
  });
  if (target > today) {
    changes
      .filter((c) => str(c.status) === "approved" && dayOf(c.effectiveDate) <= target)
      .sort((a, b) => dayOf(a.effectiveDate).localeCompare(dayOf(b.effectiveDate)))
      .forEach((c) => {
        if (checkOrgChangeGate(snapshot, c, { today: target }).ok) applyOrgChange(snapshot, c);
      });
  }
  (snapshot.stations || []).forEach((s) => {
    const created = dayOf(s.createdAt);
    if (created && created > target && !s.createdByChange) s.__notYet = true;
  });
  snapshot.stations = (snapshot.stations || []).filter((s) => !s.__notYet && !(isUnitClosed(s) && dayOf(s.closedAt) <= target));
  return snapshot;
}

/** Unit tree with seats for a data snapshot — the as-of chart and the print sheet. */
export function unitSeatTree(data, day = todayKey()) {
  const stations = (data?.stations || []).filter((s) => !isUnitClosed(s) || dayOf(s.closedAt) > day);
  const ids = new Set(stations.map((s) => str(s.id)));
  const build = (station, guard = 0) => {
    const sid = str(station.id);
    const seats = seatsOf(data)
      .filter((s) => str(s.stationId) === sid)
      .map((s) => {
        const holder = seatHolder(data, s);
        return { seatId: str(s.id), code: seatCode(s, data), title: s.title || "", state: seatState(s, data, day), holder: holder?.name || "", acting: actingOnSeat(data, s, day)?.employee?.name || "" };
      });
    const kids = guard > 30 ? [] : stations.filter((s) => stationParentId(s) === sid).map((s) => build(s, guard + 1));
    return { stationId: sid, name: station.name || "", level: unitLevel(station, stations), seats, children: kids };
  };
  return stations.filter((s) => !stationParentId(s) || !ids.has(stationParentId(s))).map((s) => build(s));
}

export { stationSubtreeIds };
