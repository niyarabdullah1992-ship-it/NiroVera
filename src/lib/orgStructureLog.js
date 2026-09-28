/** Dated workplace-structure history and the same parent/manager walk ops uses. */

import { isHrUnit } from "./stationTree.js";

const MAX_EVENTS = 400;

function uid() {
  return `orglog_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function todayKey(day) {
  if (day) return String(day).slice(0, 10);
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function stationKey(station) {
  return String(station?.id || station?.stationId || "");
}

function stationNameOf(data, stationId) {
  const sid = String(stationId || "");
  if (!sid) return "";
  return (data?.stations || []).find((station) => stationKey(station) === sid)?.name || "";
}

function personNameOf(data, employeeId) {
  const id = String(employeeId || "");
  if (!id) return "";
  return (data?.employees || []).find((employee) => String(employee.id) === id)?.name || "";
}

export function appendOrgStructureEvent(data, event) {
  if (!data || !event) return null;
  const row = {
    id: uid(),
    at: new Date().toISOString(),
    type: String(event.type || "change"),
    stationId: event.stationId ? String(event.stationId) : "",
    stationName: event.stationName || stationNameOf(data, event.stationId),
    employeeId: event.employeeId ? String(event.employeeId) : "",
    employeeName: event.employeeName || personNameOf(data, event.employeeId),
    from: event.from == null ? "" : String(event.from),
    to: event.to == null ? "" : String(event.to),
    fromName: event.fromName || "",
    toName: event.toName || "",
    until: event.until ? String(event.until).slice(0, 10) : "",
    parentStationId: event.parentStationId ? String(event.parentStationId) : "",
    fromStationId: event.fromStationId ? String(event.fromStationId) : "",
    toStationId: event.toStationId ? String(event.toStationId) : "",
    fromStationName: event.fromStationName || stationNameOf(data, event.fromStationId),
    toStationName: event.toStationName || stationNameOf(data, event.toStationId),
  };
  data.orgStructureLog = Array.isArray(data.orgStructureLog) ? data.orgStructureLog : [];
  data.orgStructureLog.unshift(row);
  if (data.orgStructureLog.length > MAX_EVENTS) data.orgStructureLog.length = MAX_EVENTS;
  return row;
}

export function orgStructureEvents(data) {
  return Array.isArray(data?.orgStructureLog) ? data.orgStructureLog : [];
}

export function formatOrgStructureEvent(event, ar = true) {
  if (!event) return "";
  const branch = event.stationName || "";
  const who = event.employeeName || event.toName || "";
  if (event.type === "manager") {
    if (event.to) return ar ? `مدير «${branch}»: ${event.toName || who || event.to}` : `Manager of ${branch}: ${event.toName || who || event.to}`;
    return ar ? `أُخلي مقعد مدير «${branch}»` : `Cleared manager of ${branch}`;
  }
  if (event.type === "parent") {
    return ar ? `«${branch}» يتبع ${event.toName || event.to || "المنشأة"}` : `${branch} now hangs under ${event.toName || event.to || "company"}`;
  }
  if (event.type === "kind") {
    const kind = event.to === "manager" ? (ar ? "مدير" : "manager") : (ar ? "فرع" : "branch");
    return ar ? `«${branch}» أصبح ${kind}` : `${branch} is now a ${kind}`;
  }
  if (event.type === "created") {
    const count = Number(event.to);
    if (count > 1 && who) {
      return ar
        ? `أُنشئت ${count} وظائف «${branch}» تحت ${who}`
        : `Created ${count} «${branch}» seats under ${who}`;
    }
    return ar ? `أُنشئ «${branch}»${who ? ` تحت ${who}` : ""}` : `Created ${branch}${who ? ` under ${who}` : ""}`;
  }
  if (event.type === "end") {
    return ar
      ? `أُقفلت فترة ${who || "الشاغل"} على «${event.to || branch || "الوظيفة"}» — الوظيفة شاغرة`
      : `Closed ${who || "the holder"} on ${event.to || branch || "the seat"} — the seat is vacant`;
  }
  if (event.type === "site") {
    const place = event.toStationName || event.to || "";
    return ar
      ? `مكان عمل ${who || "الموظف"}: ${place || "مطابق للتبعية"}`
      : `Workplace of ${who || "the employee"}: ${place || "matches reporting"}`;
  }
  if (event.type === "deleted") {
    return ar ? `حُذف «${branch}»` : `Deleted ${branch}`;
  }
  if (event.type === "renamed") {
    return ar ? `أُعيد تسمية الفرع إلى «${event.to || branch}»` : `Renamed branch to ${event.to || branch}`;
  }
  if (event.type === "transfer") {
    return ar
      ? `نُقل ${who || "موظف"} من ${event.fromStationName || "—"} إلى ${event.toStationName || "—"}`
      : `Moved ${who || "employee"} from ${event.fromStationName || "—"} to ${event.toStationName || "—"}`;
  }
  if (event.type === "acting") {
    return ar
      ? `${who || "موظف"} مدير بالوكالة على «${branch}» حتى ${event.until || "—"}`
      : `${who || "Employee"} acting manager on ${branch} until ${event.until || "—"}`;
  }
  if (event.type === "acting_end") {
    return ar ? `انتهت وكالة ${who || "موظف"} على «${branch}»` : `Ended acting on ${branch} for ${who || "employee"}`;
  }
  if (event.type === "grade") {
    return ar ? (event.to || "تغيير في المسار الوظيفي") : (event.toName || event.to || "Career track change");
  }
  if (event.type === "seat") {
    return ar
      ? `منصب «${event.to || ""}» تحت ${who || branch}`
      : `Seat «${event.to || ""}» under ${who || branch}`;
  }
  if (event.type === "hr") {
    return ar
      ? `${who || "—"} مدير الموارد البشرية لـ«${branch}»`
      : `${who || "—"} is HR manager for ${branch}`;
  }
  return branch || who || event.type;
}

export function flattenOrgBranches(roots, acc = []) {
  (roots || []).forEach((node) => {
    if (!node) return;
    acc.push(node);
    flattenOrgBranches(node.children, acc);
  });
  return acc;
}

export function pathToOrgBranch(roots, stationId) {
  const id = String(stationId || "");
  const walk = (nodes, trail) => {
    for (const node of nodes || []) {
      const next = [...trail, node];
      if (String(node.stationId || "") === id) return next;
      const hit = walk(node.children, next);
      if (hit) return hit;
    }
    return null;
  };
  return walk(roots, []);
}

export function printOrgPyramidRows(roots, ar = true) {
  const rows = [];
  const walk = (nodes, depth) => {
    (nodes || []).forEach((node) => {
      const vacant = !String(node.managerId || "").trim();
      const acting = node.actingName
        ? (ar ? `بالوكالة · ${node.actingName}` : `Acting · ${node.actingName}`)
        : "";
      const indent = `${"· ".repeat(depth)}${node.name || ""}`;
      rows.push([
        indent,
        vacant ? (acting || (ar ? "بلا مدير" : "Vacant")) : (node.managerName || ""),
        node.kind || "",
        String(node.treePeople ?? ""),
      ]);
      walk(node.children, depth + 1);
    });
  };
  walk(roots, 0);
  return rows;
}

/** Display follows station.managerId only — never invent a person from a job title. */
export function workplaceManagerDisplay(station, people = []) {
  const managerId = String(station?.managerId || "").trim();
  const row = managerId
    ? people.find((item) => String(item.employeeId || item.id) === managerId && !item.vacant)
    : null;
  return {
    managerId,
    managerName: row?.name || "",
    managerTitle: row?.job || row?.title || "",
  };
}

export function actingAtStation(data, stationId, day) {
  const sid = String(stationId || "");
  if (!sid) return null;
  const today = todayKey(day);
  for (const employee of data?.employees || []) {
    const assignment = (employee.actingAssignments || []).find((item) => {
      if (item?.endedAt) return false;
      if (String(item.stationId) !== sid) return false;
      const until = String(item.until || "").slice(0, 10);
      return !until || until >= today;
    });
    if (assignment) return { employee, assignment };
  }
  return null;
}

/** Workplace ladder: acting manager covers the station first, else station.managerId, then parentStationId. */
export function workplaceEscalationManagers(data, stationId) {
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  const byId = new Map(stations.map((station) => [stationKey(station), station]));
  const out = [];
  const seenStations = new Set();
  const seenPeople = new Set();
  let cursor = byId.get(String(stationId || ""));
  while (cursor) {
    const sid = stationKey(cursor);
    if (!sid || seenStations.has(sid)) break;
    seenStations.add(sid);
    const acting = actingAtStation(data, sid);
    const aid = acting?.employee?.id ? String(acting.employee.id) : "";
    if (aid && !seenPeople.has(aid)) {
      seenPeople.add(aid);
      out.push({
        employeeId: aid,
        title: "مدير بالوكالة",
        stationId: sid,
        acting: true,
        until: acting.assignment?.until || "",
      });
    } else {
      const managerId = String(cursor.managerId || "").trim();
      if (managerId && !seenPeople.has(managerId)) {
        seenPeople.add(managerId);
        out.push({
          employeeId: managerId,
          title: "مدير الفرع",
          stationId: sid,
          acting: false,
        });
      }
    }
    const parent = String(cursor.parentStationId || cursor.parentBranchId || "").trim();
    cursor = parent ? byId.get(parent) : null;
  }
  return out;
}

/**
 * Same parent walk as workplaceEscalationManagers, plus a vacant rung when the
 * seat has no acting cover and no managerId. The hidden HR unit is not a rung.
 * Handler resolution still uses workplaceEscalationManagers and skips vacancies.
 */
export function workplaceEscalationLine(data, stationId) {
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  const byId = new Map(stations.map((station) => [stationKey(station), station]));
  const out = [];
  const seenStations = new Set();
  const seenPeople = new Set();
  let cursor = byId.get(String(stationId || ""));
  while (cursor) {
    const sid = stationKey(cursor);
    if (!sid || seenStations.has(sid)) break;
    seenStations.add(sid);
    const acting = actingAtStation(data, sid);
    const aid = acting?.employee?.id ? String(acting.employee.id) : "";
    const hidden = isHrUnit(cursor);
    if (aid && !seenPeople.has(aid)) {
      seenPeople.add(aid);
      out.push({
        employeeId: aid,
        title: "مدير بالوكالة",
        stationId: sid,
        acting: true,
        vacant: false,
      });
    } else if (!aid) {
      const managerId = String(cursor.managerId || "").trim();
      if (managerId && !seenPeople.has(managerId)) {
        seenPeople.add(managerId);
        out.push({
          employeeId: managerId,
          title: "مدير الفرع",
          stationId: sid,
          acting: false,
          vacant: false,
        });
      } else if (!managerId && !hidden) {
        out.push({
          employeeId: "",
          title: "مدير الفرع",
          stationId: sid,
          acting: false,
          vacant: true,
        });
      }
    }
    const parent = String(cursor.parentStationId || cursor.parentBranchId || "").trim();
    cursor = parent ? byId.get(parent) : null;
  }
  return out;
}
