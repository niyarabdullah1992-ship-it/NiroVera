/**
 * HR in the org tree.
 * المقر الرئيسي and وحدة الموارد البشرية are fixed.
 * The HR director reports to the CEO.
 * A regional HR manager serves two or three branches, with a solid line
 * up to the director and a dotted coordination line to those branch managers.
 * Compliance and payroll stay under the director.
 * Branch employees stay under their branch manager.
 */

import { companyRootStation, isCompanyRootStation, isHrUnit, stationParentId } from "./stationTree.js";

export { isHrUnit };
export const HR_UNIT_ID = "st_hr_unit";
export const HR_UNIT_NAME = "وحدة الموارد البشرية";
export const HR_SPAN_MAX = 3;

const POST_TITLE = {
  director: "مديرة الموارد البشرية",
  compliance: "مسؤول الالتزام والعلاقات العمالية",
  payroll: "مسؤول الرواتب والعقود",
  recruitment: "أخصائي توظيف",
  affairs: "أخصائي شؤون موظفين",
};

export function hrUnitStation(data) {
  return (data?.stations || []).find((station) => isHrUnit(station)) || null;
}

function seatOf(data, employeeId) {
  if (!employeeId) return null;
  return (data?.orgSeats || []).find((seat) => String(seat.employeeId || "") === String(employeeId)) || null;
}

function employeeById(data, employeeId) {
  return (data?.employees || []).find((item) => String(item.id) === String(employeeId || "")) || null;
}

export function hrTitleBlob(employee, data) {
  const seat = seatOf(data, employee?.id);
  return `${seat?.title || ""} ${employee?.profile?.position || ""} ${employee?.position || ""} ${employee?.jobTitle || ""}`;
}

export function hrPostOf(employee, data) {
  const seat = seatOf(data, employee?.id);
  const marked = String(seat?.hrPost || "");
  if (["director", "compliance", "payroll", "recruitment", "affairs"].includes(marked)) return marked;
  const text = hrTitleBlob(employee, data);
  if (/أخصائي(?:ة)?\s+توظيف/.test(text)) return "recruitment";
  if (/أخصائي(?:ة)?\s+شؤون/.test(text)) return "affairs";
  if (/التزام|علاقات\s*عمالية/.test(text)) return "compliance";
  if (/رواتب/.test(text) && /عقود/.test(text)) return "payroll";
  if (/مديرة?\s+الموارد\s+البشرية/.test(text) && !/م\.?\s*ب/.test(text)) return "director";
  return "";
}

function ceoId(data) {
  const root = companyRootStation(data?.stations);
  return String(root?.managerId || "");
}

export function isHrDirector(employee, data) {
  if (!employee?.id) return false;
  if (ceoId(data) === String(employee.id)) return false;
  const unit = hrUnitStation(data);
  if (unit && String(unit.managerId || "") === String(employee.id)) return true;
  return hrPostOf(employee, data) === "director";
}

export function servedStationIds(data, employeeId) {
  const id = String(employeeId || "");
  if (!id) return [];
  const employee = employeeById(data, id);
  const listed = [
    ...(Array.isArray(employee?.hrServesStationIds) ? employee.hrServesStationIds : []),
    employee?.hrStationId || "",
  ];
  (data?.stations || []).forEach((station) => {
    if (String(station?.hrManagerId || "") === id) listed.push(station.id);
  });
  const seen = new Set();
  const out = [];
  listed.forEach((item) => {
    const sid = String(item || "").trim();
    if (!sid || seen.has(sid)) return;
    const station = (data?.stations || []).find((row) => String(row.id) === sid);
    if (!station || isHrUnit(station) || isCompanyRootStation(station)) return;
    seen.add(sid);
    out.push(sid);
  });
  return out;
}

export function isRegionalHr(employee, data) {
  if (!employee?.id || isHrDirector(employee, data)) return false;
  if (servedStationIds(data, employee.id).length) return true;
  return /م\.?\s*ب/.test(hrTitleBlob(employee, data));
}

export function isHrStaff(employee, data) {
  if (!employee?.id) return false;
  if (isHrDirector(employee, data) || isRegionalHr(employee, data)) return true;
  const post = hrPostOf(employee, data);
  return post === "recruitment" || post === "affairs" || post === "compliance" || post === "payroll";
}

export function hrManagerForStation(data, stationId) {
  const sid = String(stationId || "");
  if (!sid) return null;
  const station = (data?.stations || []).find((item) => String(item.id) === sid);
  const marked = String(station?.hrManagerId || "");
  if (marked) {
    const holder = employeeById(data, marked);
    if (holder && holder.active !== false && holder.role !== "system") return holder;
  }
  return (data?.employees || []).find((employee) => (
    employee
    && employee.active !== false
    && employee.role !== "system"
    && servedStationIds(data, employee.id).includes(sid)
  )) || null;
}

function managesFieldStation(data, employeeId) {
  const id = String(employeeId || "");
  return (data?.stations || []).some((station) => (
    String(station?.managerId || "") === id
    && !isHrUnit(station)
    && !isCompanyRootStation(station)
  ));
}

/** Solid line: director → CEO, regional and central → director, specialists → their regional manager. */
export function hrSolidManager(employee, data) {
  if (!employee?.id || !isHrStaff(employee, data)) return { handled: false, managerId: null };
  const unit = hrUnitStation(data);
  const director = String(unit?.managerId || "");
  const directorId = director && isHrDirector(employeeById(data, director), data) ? director : "";
  const ceo = ceoId(data);
  if (isHrDirector(employee, data)) {
    const managerId = ceo && ceo !== String(employee.id) ? ceo : null;
    return { handled: true, managerId };
  }
  const post = hrPostOf(employee, data);
  if (post === "recruitment" || post === "affairs") {
    const seat = seatOf(data, employee.id);
    const lead = String(seat?.hrLeadId || seat?.reportsToEmployeeId || "");
    const leadEmployee = lead ? employeeById(data, lead) : null;
    if (leadEmployee && isRegionalHr(leadEmployee, data) && lead !== String(employee.id)) {
      return { handled: true, managerId: lead };
    }
  }
  if (directorId && directorId !== String(employee.id)) return { handled: true, managerId: directorId };
  if (ceo && ceo !== String(employee.id)) return { handled: true, managerId: ceo };
  return { handled: true, managerId: null };
}

/** Field staff never report to HR. Walk up to the first manager who is not HR staff. */
export function nonHrManagerId(data, station, selfId) {
  const byId = new Map((data?.stations || []).map((item) => [String(item.id), item]));
  let cursor = station || null;
  const seen = new Set();
  while (cursor) {
    const parentId = stationParentId(cursor);
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    cursor = byId.get(String(parentId));
    if (!cursor) break;
    const managerId = String(cursor.managerId || "");
    if (!managerId || managerId === String(selfId || "")) continue;
    const manager = employeeById(data, managerId);
    if (manager && !isHrStaff(manager, data)) return managerId;
  }
  const ceo = ceoId(data);
  if (!ceo || ceo === String(selfId || "")) return null;
  const head = employeeById(data, ceo);
  if (head && isHrStaff(head, data)) return null;
  return ceo;
}

export function seatsOnHrUnit(employee, data) {
  if (!employee?.id || !isHrStaff(employee, data)) return false;
  if (ceoId(data) === String(employee.id)) return false;
  if (isRegionalHr(employee, data) && managesFieldStation(data, employee.id)) return false;
  return true;
}

export function ensureHrUnit(data) {
  if (!data) return false;
  const root = companyRootStation(data.stations);
  if (!root?.id) return false;
  data.stations = data.stations || [];
  let changed = false;
  let unit = data.stations.find((station) => isHrUnit(station)) || null;
  if (!unit) {
    const id = data.stations.some((station) => String(station.id) === HR_UNIT_ID) ? `st_hr_${Date.now()}` : HR_UNIT_ID;
    unit = {
      id,
      name: HR_UNIT_NAME,
      location: HR_UNIT_NAME,
      code: "HR",
      type: "branch",
      status: "active",
      unitKind: "branch",
      fixedUnit: "hr",
      parentStationId: root.id,
      managerId: null,
      isCompanyRoot: false,
      lat: null,
      lng: null,
      radiusMeters: 200,
      createdAt: new Date().toISOString(),
    };
    data.stations.push(unit);
    changed = true;
  }
  if (unit.fixedUnit !== "hr") {
    unit.fixedUnit = "hr";
    changed = true;
  }
  if (String(unit.code || "").trim().toUpperCase() !== "HR") {
    unit.code = "HR";
    changed = true;
  }
  if (String(unit.parentStationId || "") !== String(root.id)) {
    unit.parentStationId = root.id;
    changed = true;
  }
  if (unit.isCompanyRoot) {
    unit.isCompanyRoot = false;
    changed = true;
  }
  if (String(unit.unitKind || "") !== "branch") {
    unit.unitKind = "branch";
    changed = true;
  }
  data.stations.forEach((station) => {
    if (!station || station === unit) return;
    if (String(stationParentId(station) || "") !== String(unit.id)) return;
    station.parentStationId = root.id;
    changed = true;
  });
  return changed;
}

function findPostSeat(data, hrPost, hrLeadId = "") {
  const lead = String(hrLeadId || "");
  return (data?.orgSeats || []).find((seat) => (
    seat?.hrPost === hrPost && String(seat.hrLeadId || "") === lead
  )) || null;
}

function holderOfPost(data, hrPost, hrLeadId = "") {
  const lead = String(hrLeadId || "");
  return (data?.employees || []).find((employee) => {
    if (!employee?.id || employee.role === "system" || employee.active === false) return false;
    if (hrPostOf(employee, data) !== hrPost) return false;
    if (!lead) return true;
    const seat = seatOf(data, employee.id);
    return String(seat?.hrLeadId || "") === lead;
  }) || null;
}

function sameIdList(left, right) {
  const a = (left || []).map((id) => String(id || "")).filter(Boolean);
  const b = (right || []).map((id) => String(id || "")).filter(Boolean);
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function regionStations(data) {
  return (data?.stations || []).filter((station) => (
    station?.id
    && !isCompanyRootStation(station)
    && !isHrUnit(station)
    && String(station.unitKind || "") === "manager"
  ));
}

function regionFieldBranches(data, region) {
  return (data?.stations || []).filter((station) => (
    station?.id
    && String(stationParentId(station) || "") === String(region?.id || "")
    && !isHrUnit(station)
    && !isCompanyRootStation(station)
    && String(station.unitKind || "") !== "manager"
  )).slice(0, HR_SPAN_MAX);
}

function findRegionalSeat(data, regionId) {
  const id = String(regionId || "");
  return (data?.orgSeats || []).find((seat) => (
    seat?.hrPost === "regional" && String(seat.hrRegionId || "") === id
  )) || null;
}

function regionCoveredByPerson(data, region) {
  const name = String(region?.name || "").replace(/^المنطقة\s+/, "").trim();
  if (!name) return false;
  return (data?.employees || []).some((employee) => (
    employee?.id
    && employee.active !== false
    && employee.role !== "system"
    && isRegionalHr(employee, data)
    && hrTitleBlob(employee, data).includes(name)
  ));
}

function regionHasPerson(data, branchIds) {
  const ids = new Set((branchIds || []).map((id) => String(id)));
  if (!ids.size) return false;
  return (data?.employees || []).some((employee) => (
    employee?.id
    && employee.active !== false
    && employee.role !== "system"
    && isRegionalHr(employee, data)
    && servedStationIds(data, employee.id).some((sid) => ids.has(String(sid)))
  ));
}

function upsertVacantPost(data, { hrPost, hrLeadId = "", reportsToEmployeeId = null, reportsToSeatId = null, stationId, title = "", hrRegionId = "", hrServesStationIds = null }) {
  const lead = String(hrLeadId || "");
  const parent = reportsToEmployeeId ? String(reportsToEmployeeId) : null;
  const parentSeat = reportsToSeatId ? String(reportsToSeatId) : null;
  const expectedTitle = title || POST_TITLE[hrPost] || "";
  let seat = hrPost === "regional" && hrRegionId
    ? findRegionalSeat(data, hrRegionId)
    : findPostSeat(data, hrPost, lead);
  if (!seat) {
    seat = {
      id: hrRegionId
        ? `seat_hr_regional_${hrRegionId}`
        : (lead ? `seat_hr_${hrPost}_${lead}` : `seat_hr_${hrPost}`),
      title: expectedTitle,
      stationId,
      hrPost,
      hrLeadId: lead || null,
      hrRegionId: hrRegionId || null,
      hrServesStationIds: Array.isArray(hrServesStationIds) ? hrServesStationIds.map(String) : null,
      employeeId: null,
      hireOpen: true,
      reportsToEmployeeId: parent,
      reportsToSeatId: parentSeat,
      reportsToName: "",
      createdAt: new Date().toISOString(),
    };
    data.orgSeats.push(seat);
    return true;
  }
  let changed = false;
  if (String(seat.stationId || "") !== String(stationId || "")) {
    seat.stationId = stationId;
    changed = true;
  }
  if (expectedTitle && String(seat.title || "") !== expectedTitle) {
    seat.title = expectedTitle;
    changed = true;
  }
  if (hrRegionId && String(seat.hrRegionId || "") !== String(hrRegionId)) {
    seat.hrRegionId = hrRegionId;
    changed = true;
  }
  if (Array.isArray(hrServesStationIds) && !sameIdList(seat.hrServesStationIds, hrServesStationIds)) {
    seat.hrServesStationIds = hrServesStationIds.map(String);
    changed = true;
  }
  if (!seat.employeeId && String(seat.reportsToEmployeeId || "") !== String(parent || "")) {
    seat.reportsToEmployeeId = parent;
    changed = true;
  }
  if (!seat.employeeId && String(seat.reportsToSeatId || "") !== String(parentSeat || "")) {
    seat.reportsToSeatId = parentSeat;
    changed = true;
  }
  return changed;
}

function dropVacantRegional(data, regionId) {
  const seat = findRegionalSeat(data, regionId);
  if (!seat || seat.employeeId) return false;
  const id = String(seat.id);
  data.orgSeats = data.orgSeats.filter((item) => (
    item !== seat && !(!item?.employeeId && String(item.hrLeadId || "") === id)
  ));
  return true;
}

export function ensureHrPosts(data) {
  const unit = hrUnitStation(data);
  const root = companyRootStation(data?.stations);
  if (!data || !unit?.id || !root?.id) return false;
  data.orgSeats = data.orgSeats || [];
  let changed = false;
  const titledDirector = holderOfPost(data, "director");
  if (titledDirector && String(unit.managerId || "") !== String(titledDirector.id) && !managesFieldStation(data, titledDirector.id)) {
    unit.managerId = titledDirector.id;
    changed = true;
  }
  const manager = employeeById(data, unit.managerId);
  const directorId = manager && isHrDirector(manager, data) ? String(manager.id) : "";
  const ceo = ceoId(data) || null;
  const directorSeatId = "seat_hr_director";

  if (!directorId) {
    if (upsertVacantPost(data, {
      hrPost: "director",
      reportsToEmployeeId: ceo,
      reportsToSeatId: null,
      stationId: unit.id,
    })) changed = true;
  } else {
    const vacant = findPostSeat(data, "director", "");
    if (vacant && !vacant.employeeId) {
      data.orgSeats = data.orgSeats.filter((seat) => seat !== vacant);
      changed = true;
    }
  }

  const centralParent = directorId || null;
  const centralSeat = directorId ? null : directorSeatId;
  ["compliance", "payroll"].forEach((hrPost) => {
    const holder = holderOfPost(data, hrPost);
    if (holder) {
      const seat = seatOf(data, holder.id);
      if (seat) {
        if (seat.hrPost !== hrPost) {
          seat.hrPost = hrPost;
          changed = true;
        }
        if (centralParent && String(seat.reportsToEmployeeId || "") !== centralParent) {
          seat.reportsToEmployeeId = centralParent;
          seat.reportsToSeatId = null;
          changed = true;
        }
      }
      return;
    }
    if (upsertVacantPost(data, {
      hrPost,
      reportsToEmployeeId: centralParent,
      reportsToSeatId: centralSeat,
      stationId: unit.id,
    })) changed = true;
  });

  (data.employees || []).forEach((employee) => {
    if (!isRegionalHr(employee, data)) return;
    ["recruitment", "affairs"].forEach((hrPost) => {
      const holder = holderOfPost(data, hrPost, employee.id);
      if (holder) return;
      if (upsertVacantPost(data, {
        hrPost,
        hrLeadId: employee.id,
        reportsToEmployeeId: employee.id,
        stationId: unit.id,
      })) changed = true;
    });
  });

  regionStations(data).forEach((region) => {
    const branches = regionFieldBranches(data, region);
    if (!branches.length) return;
    const branchIds = branches.map((station) => String(station.id));
    if (regionHasPerson(data, branchIds) || regionCoveredByPerson(data, region)) {
      if (dropVacantRegional(data, region.id)) changed = true;
      return;
    }
    const regionalTitle = `مدير م.ب. ${String(region.name || "").trim()}`;
    if (upsertVacantPost(data, {
      hrPost: "regional",
      hrRegionId: region.id,
      title: regionalTitle,
      hrServesStationIds: branchIds,
      reportsToEmployeeId: centralParent,
      reportsToSeatId: centralSeat,
      stationId: unit.id,
    })) changed = true;
    const regionalSeat = findRegionalSeat(data, region.id);
    if (!regionalSeat?.id || regionalSeat.employeeId) return;
    ["recruitment", "affairs"].forEach((hrPost) => {
      if (upsertVacantPost(data, {
        hrPost,
        hrLeadId: regionalSeat.id,
        reportsToEmployeeId: null,
        reportsToSeatId: regionalSeat.id,
        stationId: unit.id,
      })) changed = true;
    });
  });
  return changed;
}

function joinNames(names) {
  const list = (names || []).map((name) => String(name || "").trim()).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} و${list[1]}`;
  return `${list.slice(0, -1).join("، ")} و${list[list.length - 1]}`;
}

export function regionalSeatLine(seat, data, ar = true) {
  if (seat?.hrPost !== "regional") return "";
  const names = (Array.isArray(seat.hrServesStationIds) ? seat.hrServesStationIds : []).map((id) => {
    const station = (data?.stations || []).find((item) => String(item.id) === String(id));
    return station?.name || "";
  });
  const label = names.filter(Boolean).join(" + ");
  if (!label) return "";
  return ar ? `يخدم: ${label}` : `Serves: ${label}`;
}

export function coordinateLine(employee, data, ar = true) {
  if (!isRegionalHr(employee, data)) return "";
  const names = servedStationIds(data, employee.id).map((id) => {
    const station = (data?.stations || []).find((item) => String(item.id) === id);
    return station?.name || "";
  }).filter(Boolean);
  if (!names.length) return "";
  return ar ? `يخدم: ${names.join(" + ")}` : `Serves: ${names.join(" + ")}`;
}

export function branchCoordinateLine(data, station, ar = true) {
  if (!station || isHrUnit(station) || isCompanyRootStation(station)) return "";
  const manager = hrManagerForStation(data, station.id);
  if (!manager?.name) return "";
  return ar
    ? `خط متقطع · ${manager.name} · تنسيق الجدول`
    : `Dotted line · ${manager.name}`;
}

function fieldWorkplaces(data) {
  return (data?.stations || []).filter((station) => (
    station?.id
    && !isCompanyRootStation(station)
    && !isHrUnit(station)
    && String(station.unitKind || "") !== "manager"
  ));
}

/** Link one branch to a regional HR manager. One manager serves at most three branches. */
export function linkBranchHr(data, stationId, employeeId) {
  const sid = String(stationId || "").trim();
  const eid = String(employeeId || "").trim();
  if (!data || !sid || !eid) return { ok: false, error: "FIELDS" };
  const station = (data.stations || []).find((item) => String(item.id) === sid);
  const employee = employeeById(data, eid);
  if (!station || isHrUnit(station) || isCompanyRootStation(station) || !employee || employee.active === false || employee.role === "system") {
    return { ok: false, error: "MISSING" };
  }
  if (String(station.unitKind || "") === "manager") return { ok: false, error: "NOT_BRANCH" };
  if (isHrDirector(employee, data)) return { ok: false, error: "DIRECTOR" };
  if (managesFieldStation(data, eid)) return { ok: false, error: "BRANCH_MANAGER" };
  const allowed = /م\.?\s*ب|موارد\s*بشر/i.test(hrTitleBlob(employee, data))
    || employee.role === "hr_manager"
    || Boolean(employee.hrLevelId)
    || servedStationIds(data, eid).length > 0;
  if (!allowed) return { ok: false, error: "NOT_HR" };
  const already = servedStationIds(data, eid);
  if (!already.includes(sid) && already.length >= HR_SPAN_MAX) return { ok: false, error: "HR_SPAN" };
  (data.employees || []).forEach((item) => {
    if (String(item.id) === eid) return;
    if (Array.isArray(item.hrServesStationIds)) {
      item.hrServesStationIds = item.hrServesStationIds.filter((id) => String(id) !== sid);
    }
    if (String(item.hrStationId || "") === sid) item.hrStationId = null;
  });
  station.hrManagerId = eid;
  const next = [...new Set([...already, sid])];
  employee.hrServesStationIds = next;
  employee.hrStationId = sid;
  return { ok: true, stationIds: next };
}

export function unlinkBranchHr(data, stationId) {
  const sid = String(stationId || "").trim();
  if (!data || !sid) return { ok: false, error: "FIELDS" };
  const station = (data.stations || []).find((item) => String(item.id) === sid);
  if (!station) return { ok: false, error: "MISSING" };
  if (station.hrManagerId) station.hrManagerId = null;
  (data.employees || []).forEach((item) => {
    if (Array.isArray(item.hrServesStationIds)) {
      item.hrServesStationIds = item.hrServesStationIds.filter((id) => String(id) !== sid);
    }
    if (String(item.hrStationId || "") === sid) item.hrStationId = null;
  });
  return { ok: true };
}

export function fieldBranchesForHr(data) {
  return fieldWorkplaces(data);
}
