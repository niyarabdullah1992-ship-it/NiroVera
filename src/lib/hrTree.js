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
  // one director: once the unit has a seated manager, a leftover title does not make a second
  const seated = unit ? employeeById(data, unit.managerId) : null;
  if (seated && seated.active !== false && seated.role !== "system" && String(seated.id) !== ceoId(data)) return false;
  return hrPostOf(employee, data) === "director";
}

export const HR_DIRECTOR_TITLE = "مدير الموارد البشرية";

/**
 * The HR unit changes hands: the outgoing director keeps working in HR as «مدير موارد بشرية»
 * (free to serve branches), the incoming one takes the director title and seat mark.
 */
export function handOverHrDirector(data, previous, next) {
  const retitle = (employee, title) => {
    const seat = seatOf(data, employee.id);
    if (seat) seat.title = title;
    employee.profile = { ...(employee.profile || {}), position: title };
    if (employee.position !== undefined) employee.position = title;
    if (employee.jobTitle !== undefined) employee.jobTitle = title;
    return seat;
  };
  if (previous?.id && String(previous.id) !== String(next?.id || "")) {
    const seat = retitle(previous, BRANCH_HR_TITLE);
    if (seat?.hrPost === "director") delete seat.hrPost;
  }
  if (next?.id) {
    const before = String(seatOf(data, next.id)?.title || next.profile?.position || "").trim();
    if (before && before !== HR_DIRECTOR_TITLE && next.hrTitleBefore === undefined) next.hrTitleBefore = before;
    const seat = retitle(next, HR_DIRECTOR_TITLE);
    if (seat) seat.hrPost = "director";
    // a director does not also serve a branch
    (data.stations || []).forEach((station) => {
      if (String(station.hrManagerId || "") === String(next.id)) station.hrManagerId = null;
    });
    next.hrServesStationIds = [];
    next.hrStationId = null;
  }
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
    if (!station || isHrUnit(station)) return;
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
  // HR staff hired into a branch work under that branch's manager, like anyone else there.
  if (!isRegionalHr(employee, data) && branchManagerOver(data, employee)) return { handled: false, managerId: null };
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

/** The manager of the field branch this person sits in, when there is one. */
export function branchManagerOver(data, employee) {
  const sid = String(employee?.stationId || "");
  if (!sid) return "";
  const station = (data?.stations || []).find((item) => String(item.id) === sid);
  if (!station || isHrUnit(station) || isCompanyRootStation(station)) return "";
  const managerId = String(station.managerId || "");
  if (!managerId || managerId === String(employee.id)) return "";
  // only when the seat was placed under that manager (hired into the branch under him)
  const seat = seatOf(data, employee.id);
  return String(seat?.reportsToEmployeeId || "") === managerId ? managerId : "";
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
  // HR staff a branch manager hired under him stay in that branch
  if (!isRegionalHr(employee, data) && branchManagerOver(data, employee)) return false;
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
    // a post HR removed on purpose («حذف المنصب الشاغر») is not recreated
    const wanted = hrRegionId ? `seat_hr_regional_${hrRegionId}` : (lead ? `seat_hr_${hrPost}_${lead}` : `seat_hr_${hrPost}`);
    if ((data.dismissedHrPosts || []).includes(wanted)) return false;
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
  // a director chosen on the unit stands; the title only fills an empty seat
  const seated = employeeById(data, unit.managerId);
  const seatedOk = seated && seated.active !== false && seated.role !== "system" && String(seated.id) !== ceoId(data);
  if (!seatedOk && titledDirector && String(unit.managerId || "") !== String(titledDirector.id) && !managesFieldStation(data, titledDirector.id)) {
    unit.managerId = titledDirector.id;
    changed = true;
  }
  const manager = employeeById(data, unit.managerId);
  const directorId = manager && isHrDirector(manager, data) ? String(manager.id) : "";
  // one director: whoever sits on the unit carries the title; a former one stays in HR as «مدير موارد بشرية»
  if (directorId) {
    (data.employees || []).forEach((employee) => {
      if (!employee?.id || String(employee.id) === directorId) return;
      const seat = seatOf(data, employee.id);
      const titled = /مديرة?\s+الموارد\s+البشرية/.test(hrTitleBlob(employee, data)) && !/م\.?\s*ب/.test(hrTitleBlob(employee, data));
      if (seat?.hrPost !== "director" && !titled) return;
      handOverHrDirector(data, employee, null);
      changed = true;
    });
    const seat = seatOf(data, directorId);
    const current = String(seat?.title || manager.profile?.position || "").trim();
    if (current !== HR_DIRECTOR_TITLE && !/مديرة\s+الموارد\s+البشرية/.test(current)) {
      handOverHrDirector(data, null, manager);
      changed = true;
    } else if (seat && seat.hrPost !== "director") {
      seat.hrPost = "director";
      changed = true;
    }
  }
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

function servePlace(name) {
  return String(name || "")
    .replace(/^فرع\s+/, "")
    .replace("المقر الرئيسي", "المقر")
    .trim();
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
  const names = (Array.isArray(seat.hrServesStationIds) ? seat.hrServesStationIds : []).slice(0, HR_SPAN_MAX).map((id) => {
    const station = (data?.stations || []).find((item) => String(item.id) === String(id));
    return servePlace(station?.name || "");
  });
  const label = names.filter(Boolean).join(" + ");
  if (!label) return "";
  const count = names.filter(Boolean).length;
  return ar
    ? `يخدم: ${label} · ${count} من ${HR_SPAN_MAX}`
    : `Serves: ${label} · ${count} of ${HR_SPAN_MAX}`;
}

export function coordinateLine(employee, data, ar = true) {
  if (!isRegionalHr(employee, data)) return "";
  const names = servedStationIds(data, employee.id).slice(0, HR_SPAN_MAX).map((id) => {
    const station = (data?.stations || []).find((item) => String(item.id) === id);
    return servePlace(station?.name || "");
  }).filter(Boolean);
  if (!names.length) return "";
  return ar
    ? `يخدم: ${names.join(" + ")} · ${names.length} من ${HR_SPAN_MAX}`
    : `Serves: ${names.join(" + ")} · ${names.length} of ${HR_SPAN_MAX}`;
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
  if (!station || isHrUnit(station) || !employee || employee.active === false || employee.role === "system") {
    return { ok: false, error: "MISSING" };
  }
  if (String(station.unitKind || "") === "manager") return { ok: false, error: "NOT_BRANCH" };
  if (isHrDirector(employee, data)) return { ok: false, error: "DIRECTOR" };
  if (managesFieldStation(data, eid)) return { ok: false, error: "BRANCH_MANAGER" };
  if (ceoId(data) === eid) return { ok: false, error: "DIRECTOR" };
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
  promoteToBranchHrTitle(data, employee);
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
  (data.employees || []).forEach((item) => {
    if (item?.hrTitleBefore === undefined || servedStationIds(data, item.id).length) return;
    restoreTitleBefore(data, item);
  });
  return { ok: true };
}

/** A branch HR appointee is a manager, not an officer: «مدير موارد بشرية». The old title is kept to restore on removal. */
export const BRANCH_HR_TITLE = "مدير موارد بشرية";

/** Every person serving a branch as its HR manager carries «مدير موارد بشرية». */
export function titleBranchHrManagers(data) {
  let changed = false;
  (data?.employees || []).forEach((employee) => {
    if (!employee?.id || employee.active === false || isHrDirector(employee, data)) return;
    if (!servedStationIds(data, employee.id).length) return;
    if (promoteToBranchHrTitle(data, employee)) changed = true;
  });
  return changed;
}

function promoteToBranchHrTitle(data, employee) {
  if (!employee) return false;
  const seat = seatOf(data, employee.id);
  const current = String(seat?.title || employee.profile?.position || employee.position || "").trim();
  if (/^مدير(?:ة)?\s+(?:ال)?موارد\s+(?:ال)?بشرية/.test(current) || /م\.?\s*ب/.test(current)) return false;
  if (employee.hrTitleBefore === undefined) employee.hrTitleBefore = current;
  if (seat) seat.title = BRANCH_HR_TITLE;
  employee.profile = { ...(employee.profile || {}), position: BRANCH_HR_TITLE };
  if (employee.position !== undefined) employee.position = BRANCH_HR_TITLE;
  return true;
}

function restoreTitleBefore(data, employee) {
  const before = String(employee.hrTitleBefore || "").trim();
  delete employee.hrTitleBefore;
  if (!before) return;
  const seat = seatOf(data, employee.id);
  if (seat && seat.title === BRANCH_HR_TITLE) seat.title = before;
  if (employee.profile?.position === BRANCH_HR_TITLE) employee.profile = { ...employee.profile, position: before };
  if (employee.position === BRANCH_HR_TITLE) employee.position = before;
}

export function fieldBranchesForHr(data) {
  // the head office is a workplace too: its staff need an HR manager like any branch
  const root = companyRootStation(data?.stations);
  return [...(root ? [root] : []), ...fieldWorkplaces(data)];
}
