/**
 * «الفروع» — the company's branches as a hierarchy: HQ (المقر الرئيسي) → المنطقة → فرع → موقع.
 *
 * Derived from the stations as stored, never hard-coded: the parent-station field decides the
 * shape; a branch without a known parent but with a region name (legacy `region` / `group`) hangs
 * under the region station of that name; anything else hangs under HQ. Regions are the
 * region-manager units (unitKind "manager").
 *
 * The result has the same shape as the people tree (nodes / roots / viewerKey), so the same
 * layout, keyboard, search and expand rules apply. An opened branch shows its child branches and
 * a «أشخاص الفرع» card; opening that card shows the people sub-tree of the branch's manager (the
 * people who head a child branch are on that branch's card, not repeated).
 *
 * scope "mine" (employees) keeps only the viewer's chain HQ → region → their branch, with no
 * headcounts, flags or other branches.
 */

import { buildOrgFocusTree } from "./orgFocus.js";
import { countryOf, stationPlace } from "./geoPlaces.js";
import { activePeople, canEditOrgDesign, deriveOrgHealth, seatState, todayKey } from "./orgDesign.js";
import {
  companyRootStation,
  isCompanyRootStation,
  isHrUnit,
  isManagerUnit,
  isNestedWorkplace,
  nearestHeaderBranch,
  stationParentId,
} from "./stationTree.js";

const str = (value) => String(value ?? "").trim();

export const BRANCH_LEVEL_LABELS = {
  hq: { ar: "المقر الرئيسي", en: "Headquarters" },
  region: { ar: "منطقة", en: "Region" },
  branch: { ar: "فرع", en: "Branch" },
  site: { ar: "موقع", en: "Site" },
  unit: { ar: "وحدة", en: "Unit" },
};
const LEVEL_ORDER = { hq: 0, region: 1, branch: 2, site: 3, unit: 4 };
// group cards sit beside the branches: countries, then cities, the «no city» bucket last
const COUNTRY_ORDER = 1.5;
const CITY_ORDER = 2;
const NO_CITY_ORDER = 2.9;
export const NO_CITY = { ar: "بلا مدينة محددة", en: "No city set" };
const PEOPLE_ORDER = 9;

export const branchKey = (stationId) => `b:${stationId}`;
export const isGroupKind = (kind) => kind === "city" || kind === "country";
export const branchPeopleKey = (stationId) => `bp:${stationId}`;
export const isBranchKey = (key) => String(key || "").startsWith("b:");

/** hq · region · branch · site · unit */
export function branchLevel(station, stations) {
  if (isCompanyRootStation(station)) return "hq";
  if (isHrUnit(station)) return "unit";
  if (isManagerUnit(station)) return "region";
  if (isNestedWorkplace(station, stations)) return "site";
  return "branch";
}

/** Parent station id for the hierarchy (see the module note), or "" for the top. */
function resolveParents(stations) {
  const byId = new Map(stations.map((s) => [str(s.id), s]));
  const root = companyRootStation(stations) || null;
  const rootId = root ? str(root.id) : "";
  const regionByName = new Map(stations.filter((s) => isManagerUnit(s)).map((s) => [str(s.name), str(s.id)]));
  const parent = new Map();
  stations.forEach((s) => {
    const id = str(s.id);
    if (id === rootId) { parent.set(id, ""); return; }
    const p = str(stationParentId(s));
    if (p && p !== id && byId.has(p)) { parent.set(id, p); return; }
    const regionName = str(s.region || s.group || s.orgGroup);
    const viaRegion = regionName ? regionByName.get(regionName) : "";
    parent.set(id, viaRegion && viaRegion !== id ? viaRegion : rootId);
  });
  // a cycle in stored data never hangs the page: a station that reaches itself goes under HQ
  parent.forEach((_, id) => {
    const seen = new Set([id]);
    let cursor = parent.get(id);
    while (cursor) {
      if (seen.has(cursor)) { parent.set(id, id === rootId ? "" : rootId); break; }
      seen.add(cursor);
      cursor = parent.get(cursor) || "";
    }
  });
  return { parent, rootId };
}

/**
 * @param {object} data company data
 * @param {{ viewerId?: string, scope?: "all"|"mine", ar?: boolean, day?: string, health?: boolean }} opts
 *   health — attach problem flags and finding counts (HR only)
 * @returns {{ nodes: Map<string, object>, roots: string[], viewerKey: string, scope: string, kind: "branches" }}
 */
export function buildBranchTree(data, { viewerId = "", scope = "mine", ar = true, day = todayKey(), health = false } = {}) {
  const stations = (data?.stations || []).filter((s) => s?.id && !s.closedAt);
  const nodes = new Map();
  if (!stations.length) return { nodes, roots: [], viewerKey: "", scope, kind: "branches" };
  const byId = new Map(stations.map((s) => [str(s.id), s]));
  const { parent } = resolveParents(stations);
  const kids = new Map();
  parent.forEach((p, id) => {
    if (!p) return;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(id);
  });
  const subtree = (id) => {
    const out = [];
    const stack = [id];
    const seen = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      out.push(cur);
      stack.push(...(kids.get(cur) || []));
    }
    return out;
  };

  /* the viewer's branch (a site belongs to its branch) */
  const viewer = viewerId ? (data?.employees || []).find((e) => str(e.id) === str(viewerId)) : null;
  const viewerStation = viewer ? byId.get(str(viewer.stationId || viewer.profile?.stationId)) : null;
  const viewerBranch = viewerStation ? (nearestHeaderBranch(viewerStation, stations) || viewerStation) : null;
  const viewerBranchId = viewerBranch && byId.has(str(viewerBranch.id)) ? str(viewerBranch.id) : "";

  /* which stations are on screen */
  let keep = new Set(stations.map((s) => str(s.id)));
  if (scope !== "all") {
    keep = new Set();
    let cursor = viewerBranchId;
    while (cursor && !keep.has(cursor)) { keep.add(cursor); cursor = parent.get(cursor) || ""; }
  }

  /* people: the same tree the people view reads (pruned for employees) */
  const people = buildOrgFocusTree(data, { viewerId, scope: scope === "all" ? "all" : "mine", ar, day });
  const personByEmployee = new Map();
  people.nodes.forEach((n) => { if (n.employeeId && !n.vacant) personByEmployee.set(n.employeeId, n.key); });
  const managerOf = new Map();
  stations.forEach((s) => {
    const id = str(s.id);
    const mid = str(s.managerId);
    const filled = mid ? personByEmployee.get(mid) : "";
    if (filled) { managerOf.set(id, { key: filled, vacant: false, name: people.nodes.get(filled).name, seatId: people.nodes.get(filled).seatId }); return; }
    // an open manager seat on the chart: a vacant seat titled «مدير …», or the station's own placeholder
    let open = "";
    people.nodes.forEach((n) => {
      if (open || !n.vacant || str(n.stationId) !== id) return;
      if (n.key === `vacant-station:${id}` || /مدير|manager/i.test(n.title || "")) open = n.key;
    });
    managerOf.set(id, open ? { key: open, vacant: true, name: "", seatId: people.nodes.get(open).seatId } : { key: "", vacant: !isCompanyRootStation(s), name: "", seatId: "" });
  });
  // people who head a branch on screen are that branch's card — never repeated as a person card
  const heads = new Set();
  keep.forEach((id) => { const m = managerOf.get(id); if (m?.key) heads.add(m.key); });

  /* counts: active people and seats in the branch and everything under it */
  const counted = scope === "all";
  const staffAt = new Map();
  if (counted) {
    activePeople(data).forEach((e) => {
      const sid = str(e.stationId || e.profile?.stationId);
      if (sid) staffAt.set(sid, (staffAt.get(sid) || 0) + 1);
    });
  }
  const seatsAt = new Map();
  if (counted) {
    (data?.orgSeats || []).forEach((seat) => {
      const sid = str(seat.stationId);
      if (!sid || seat.closedAt) return;
      const row = seatsAt.get(sid) || { seats: 0, vacant: 0 };
      row.seats += 1;
      if (seatState(seat, data, day) === "vacant") row.vacant += 1;
      seatsAt.set(sid, row);
    });
  }
  const findingsAt = new Map();
  if (counted && health) {
    deriveOrgHealth(data, { day }).items.forEach((item) => {
      if (item.tone !== "bad" && item.tone !== "warn") return;
      const sid = str(item.stationId);
      if (sid) findingsAt.set(sid, (findingsAt.get(sid) || 0) + 1);
    });
  }

  /* person cards inside the branch view: copies, with branch heads left out */
  const placed = new Set();
  const addPerson = (key, parentKey) => {
    if (placed.has(key) || heads.has(key) || !people.nodes.has(key)) return "";
    placed.add(key);
    const src = people.nodes.get(key);
    const node = { ...src, kind: "person", parentKey, childKeys: [] };
    nodes.set(key, node);
    src.childKeys.forEach((k) => { const made = addPerson(k, key); if (made) node.childKeys.push(made); });
    return key;
  };

  /* where each station is: stored country / city, else derived from its name (display only) */
  const placeOf = new Map(stations.map((s) => [str(s.id), stationPlace(s)]));
  const cityKeyOf = (sid) => {
    const p = placeOf.get(sid);
    return p?.city ? `${p.countryCode || "SA"}|${p.city}` : "";
  };
  const countries = new Set([...keep].map((sid) => placeOf.get(sid)?.city ? (placeOf.get(sid).countryCode || "SA") : "").filter(Boolean));
  const multiCountry = countries.size > 1;

  const regionNameOf = (id) => {
    let cursor = parent.get(id) || "";
    while (cursor) {
      const s = byId.get(cursor);
      if (s && isManagerUnit(s)) return str(s.name);
      cursor = parent.get(cursor) || "";
    }
    return "";
  };

  /**
   * A station's children: units and regions stand as they are; workplaces are grouped by city —
   * always under HQ (with a country layer when the company spans countries), under any other
   * unit only when its workplaces span 2+ cities, and always on an employee's own chain.
   */
  const addChildren = (id, key, level) => {
    const node = nodes.get(key);
    const childIds = (kids.get(id) || []).filter((k) => keep.has(k));
    const isWorkplace = (k) => ["branch", "site"].includes(branchLevel(byId.get(k), stations));
    const workplaces = childIds.filter(isWorkplace);
    childIds.filter((k) => !isWorkplace(k)).forEach((k) => node.childKeys.push(addBranch(k, key)));
    const cityKeys = new Set(workplaces.map(cityKeyOf).filter(Boolean));
    const group = workplaces.length > 0 && (scope !== "all" || level === "hq" || cityKeys.size >= 2);
    if (!group) { workplaces.forEach((k) => node.childKeys.push(addBranch(k, key))); return; }
    const buckets = new Map();
    workplaces.forEach((k) => {
      const ck = cityKeyOf(k) || "none";
      if (!buckets.has(ck)) buckets.set(ck, []);
      buckets.get(ck).push(k);
    });
    const countryNodes = new Map();
    buckets.forEach((members, ck) => {
      const none = ck === "none";
      const first = placeOf.get(members[0]);
      let holder = node;
      if (!none && level === "hq" && multiCountry) {
        const code = first.countryCode || "SA";
        if (!countryNodes.has(code)) {
          const country = countryOf(code);
          const ckey = `k:${id}:${code}`;
          const made = {
            key: ckey, id: ckey, kind: "country", level: "country", order: COUNTRY_ORDER, stationId: "", seatId: "", employeeId: "",
            name: country ? (ar ? country.ar : country.en) : code, title: "", unit: "", seatCode: "", state: "filled", vacant: false, isMe: false,
            avatarUrl: "", countryCode: code, counted, branchCount: 0, headcount: 0, parentKey: key, childKeys: [],
          };
          nodes.set(ckey, made);
          node.childKeys.push(ckey);
          countryNodes.set(code, made);
        }
        holder = countryNodes.get(code);
      }
      const gkey = `c:${id}:${none ? "none" : ck}`;
      const city = {
        key: gkey,
        id: gkey,
        kind: "city",
        level: "city",
        order: none ? NO_CITY_ORDER : CITY_ORDER,
        noCity: none,
        stationId: "",
        seatId: "",
        employeeId: "",
        name: none ? (ar ? NO_CITY.ar : NO_CITY.en) : (ar ? first.city : (first.cityEn || first.city)),
        title: none ? "" : (first.regionAr ? (ar ? first.regionAr : first.regionEn) : ((countryOf(first.countryCode) && (ar ? countryOf(first.countryCode).ar : countryOf(first.countryCode).en)) || "")),
        unit: "",
        seatCode: "",
        state: "filled",
        vacant: false,
        isMe: false,
        avatarUrl: "",
        countryCode: none ? "" : first.countryCode,
        city: none ? "" : first.city,
        counted,
        branchCount: members.length,
        headcount: 0,
        parentKey: holder.key,
        childKeys: [],
      };
      nodes.set(gkey, city);
      holder.childKeys.push(gkey);
      members.forEach((k) => city.childKeys.push(addBranch(k, gkey)));
      city.headcount = city.childKeys.reduce((n, k) => n + (nodes.get(k)?.headcount || 0), 0);
      if (holder !== node) {
        holder.branchCount += city.branchCount;
        holder.headcount += city.headcount;
      }
    });
  };

  const addBranch = (id, parentKey) => {
    const s = byId.get(id);
    const key = branchKey(id);
    const level = branchLevel(s, stations);
    const mgr = managerOf.get(id) || { key: "", vacant: true, name: "", seatId: "" };
    const where = placeOf.get(id);
    const place = where.city || (level === "branch" || level === "site" ? regionNameOf(id) : "");
    const label = BRANCH_LEVEL_LABELS[level];
    const ids = counted ? subtree(id) : [];
    const headcount = ids.reduce((n, sid) => n + (staffAt.get(sid) || 0), 0);
    const seatRow = ids.reduce((acc, sid) => {
      const r = seatsAt.get(sid);
      if (r) { acc.seats += r.seats; acc.vacant += r.vacant; }
      return acc;
    }, { seats: 0, vacant: 0 });
    const findings = findingsAt.get(id) || 0;
    let flag = null;
    if (counted && health && mgr.vacant && level !== "hq") {
      // the manager line already says «شاغر» — the chip only marks it as a problem
      flag = { kind: "MANAGER_VACANT", ar: "بلا مدير", en: "No manager" };
    } else if (counted && health && findings) {
      flag = { kind: "FINDINGS", ar: findings === 1 ? "ملاحظة واحدة" : `${Number(findings)} ملاحظات`, en: `${findings} finding${findings === 1 ? "" : "s"}` };
    }
    const node = {
      key,
      kind: "branch",
      level,
      order: LEVEL_ORDER[level],
      id: key,
      stationId: id,
      seatId: "",
      employeeId: "",
      name: str(s.name) || (ar ? label.ar : label.en),
      title: [ar ? label.ar : label.en, place].filter(Boolean).join(" · "),
      unit: "",
      seatCode: str(s.code),
      state: "filled",
      vacant: false,
      isMe: id === viewerBranchId,
      avatarUrl: "",
      managerKey: mgr.key,
      managerName: mgr.name,
      managerVacant: Boolean(mgr.vacant),
      managerSeatId: mgr.vacant ? str(mgr.seatId) : "",
      counted,
      headcount,
      seats: seatRow.seats,
      vacantSeats: seatRow.vacant,
      findings,
      flag,
      city: where.city,
      cityDerived: where.derived,
      countryCode: where.countryCode,
      // «حدّد المدينة» (owner/HR): a workplace with no city known, stored or derived
      needsCity: counted && health && !where.city && (level === "branch" || level === "site"),
      parentKey,
      childKeys: [],
    };
    nodes.set(key, node);
    addChildren(id, key, level);
    // «أشخاص الفرع»: the manager's people (employees: only in their own branch, from their pruned tree)
    const showPeople = scope === "all" || id === viewerBranchId;
    if (showPeople) {
      const group = branchPeopleKey(id);
      let top = [];
      if (mgr.key && people.nodes.has(mgr.key)) top = people.nodes.get(mgr.key).childKeys;
      else {
        people.nodes.forEach((n) => {
          if (str(n.stationId) !== id) return;
          const p = n.parentKey ? people.nodes.get(n.parentKey) : null;
          if (!p || str(p.stationId) !== id) top.push(n.key);
        });
      }
      const made = [];
      top.forEach((k) => { const m = addPerson(k, group); if (m) made.push(m); });
      if (made.length) {
        nodes.set(group, {
          key: group,
          kind: "people",
          order: PEOPLE_ORDER,
          id: group,
          stationId: id,
          seatId: "",
          employeeId: "",
          name: ar ? `أشخاص ${node.name}` : `${node.name} people`,
          title: mgr.name ? (ar ? `تحت إدارة ${mgr.name}` : `Under ${mgr.name}`) : (ar ? "فريق الفرع" : "Branch team"),
          unit: "",
          seatCode: "",
          state: "filled",
          vacant: false,
          isMe: false,
          avatarUrl: "",
          peopleCount: made.length,
          parentKey: key,
          childKeys: made,
        });
        node.childKeys.push(group);
      }
    }
    return key;
  };

  const roots = [];
  stations.forEach((s) => {
    const id = str(s.id);
    if (!keep.has(id)) return;
    const p = parent.get(id) || "";
    if (!p || !keep.has(p)) roots.push(addBranch(id, ""));
  });
  return { nodes, roots, viewerKey: viewerBranchId ? branchKey(viewerBranchId) : "", scope, kind: "branches" };
}

/**
 * Opened on first load: HQ, every region and every city / country group, so every branch is on
 * screen at once; people folded.
 * Plus the chain down to the viewer's branch.
 */
export function defaultBranchExpanded(tree) {
  const out = new Set();
  const opens = (k) => ["branch", "city", "country"].includes(tree.nodes.get(k)?.kind);
  tree?.nodes?.forEach((node) => {
    if (isGroupKind(node.kind)) { if (node.childKeys.length) out.add(node.key); return; }
    if (node.kind !== "branch") return;
    if ((node.level === "hq" || node.level === "region") && node.childKeys.some(opens)) out.add(node.key);
  });
  let cursor = tree?.nodes?.get(tree.viewerKey)?.parentKey || "";
  while (cursor && tree.nodes.has(cursor)) { out.add(cursor); cursor = tree.nodes.get(cursor).parentKey || ""; }
  return out;
}

/** «توسيع الكل» in the branches view: every branch with something under it; people stay folded. */
export function expandAllBranches(tree) {
  const out = new Set();
  tree?.nodes?.forEach((node) => {
    const opens = node.childKeys.some((k) => ["branch", "city", "country"].includes(tree.nodes.get(k)?.kind));
    if ((node.kind === "branch" || isGroupKind(node.kind)) && opens) out.add(node.key);
  });
  return out;
}

/** The action menu of a branch card (owner/HR), routed like the person actions. */
export function orgBranchActions(node, { canWrite = false, data = null, user = null } = {}) {
  if (!node || node.kind !== "branch" || !canWrite) return [];
  const station = (data?.stations || []).find((s) => str(s.id) === str(node.stationId));
  const out = [];
  const add = (id, ar, en, group, extra = {}) => out.push({ id, ar, en, group, blocked: null, ...extra });
  if (station && !isHrUnit(station)) add("branch", "الفرع والوحدة", "Branch / unit", "open");
  if (node.managerKey) add("people", "عرض أشخاص الفرع", "Show the branch's people", "open");
  const editBlock = user && data && !canEditOrgDesign(user, data)
    ? { ar: "التعديل على المناصب للمالك والموارد البشرية.", en: "Seat changes are made by the owner and HR." }
    : null;
  if (station && !isCompanyRootStation(station) && !isHrUnit(station)) add("moveUnder", "نقل تحت…", "Move under…", "decide", { blocked: editBlock });
  if (station && !isHrUnit(station)) {
    add("addSeat", "إضافة منصب في الفرع", "Add a seat here", "seat", {
      stationId: str(station.id),
      blocked: isManagerUnit(station) ? { ar: "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه.", en: "A manager is not a hire workplace. Convert it to a branch, then hire there." } : null,
    });
  }
  if (node.managerVacant && node.level !== "hq") {
    add("hireManager", node.level === "region" ? "تعيين مدير المنطقة" : "تعيين مدير الفرع", "Hire the manager", "seat", {
      blocked: station && isManagerUnit(station)
        ? { ar: "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه.", en: "A manager is not a hire workplace. Convert it to a branch, then hire there." }
        : null,
    });
  }
  add("health", "صحة الهيكل", "Structure health", "look", { count: Number(node.findings || 0) });
  add("authority", "الصلاحيات", "Authority", "look");
  return out;
}
