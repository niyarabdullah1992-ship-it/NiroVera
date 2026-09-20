import { deriveSaudiStatus, checkContractTermGate, nationalityIsSaudi } from "@/lib/complianceDerivations";
import { checkProbationGate, workPatternForcesFixed } from "@/lib/contractLawDerivations";
import { getCompanyData, logAudit, updateCompany } from "@/lib/store";
import { createOrgRecord } from "@/lib/orgTree";
import { canAddStation } from "@/lib/planLimits";
import { gradeSalaryRange, gradesForList, jobGradeLabel, orderedJobGrades } from "@/lib/jobGrades";
import { LEAVE_TYPES, statutoryLeaveFloor } from "@/lib/leaveTypes";
import { listedPacks } from "@/lib/permissionPackTemplate";
import { templateById, templateLabel } from "@/lib/permissionTemplates";
import { rankFromScore, scorePermissions } from "@/lib/smartPositions";
import { applyWorkplaceManagerRule, seatCompanyHeadOnRoot } from "@/lib/peopleTreeGraph";
import { appendOrgStructureEvent } from "@/lib/orgStructureLog";
import {
  applyExtraCoverageStrip,
  checkSetStationParentGate,
  companyRootStation,
  hangOrphanStationsUnderCompany,
  isCompanyRootStation,
  isTreeManagerTitle,
  normalizeUnitKind,
  isManagerUnit,
  rootStations,
  stationParentId,
  stationSubtreeIds,
  stripDescendantCoverage,
} from "@/lib/stationTree";

export { gradeSalaryRange };

export const OPEN_HIRE_EVENT = "nirovera:open-hire";
export const HIRE_SESSION_SUGGEST_AT = 2;

export const CONTRACT_TYPES = [
  { id: "indefinite", ar: "غير محدد المدة", en: "Indefinite" },
  { id: "fixed", ar: "محدد المدة", en: "Fixed term" },
  { id: "trial", ar: "فترة تجربة", en: "Probation" },
];

export function hireContractId(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "fixed" || raw === "definite") return "fixed";
  if (raw === "trial" || raw === "probation") return "trial";
  return "indefinite";
}

export function fileContractType(value, { nonSaudi = false, workPattern = "" } = {}) {
  if (nonSaudi) return "fixed";
  if (workPatternForcesFixed(workPattern)) return "fixed";
  return hireContractId(value) === "fixed" ? "fixed" : "indefinite";
}

export function openHireDrawer(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_HIRE_EVENT, { detail }));
}

export function todayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function contractLabel(id, ar) {
  const row = CONTRACT_TYPES.find((item) => item.id === id);
  if (!row) return id || "";
  return ar ? row.ar : row.en;
}

export function annualLeaveFromHireDate(hireDate, entitlement) {
  const floor = statutoryLeaveFloor("annual", { hireDate }) ?? (LEAVE_TYPES[0]?.defaultTotal || 21);
  const cap = entitlement ?? floor;
  const key = String(hireDate || todayKey()).slice(0, 10);
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return cap;
  const year = Number(match[1]);
  const start = new Date(year, Number(match[2]) - 1, Number(match[3]));
  const end = new Date(year, 11, 31);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  return Math.round((days / 365) * cap * 10) / 10;
}

function packById(data, listId) {
  if (!listId) return null;
  return listedPacks(data).find((pack) => pack.id === listId) || templateById(data, listId);
}

function stationById(data, stationId) {
  return (data?.stations || []).find((station) => String(station.id) === String(stationId)) || null;
}

function gradeById(data, gradeId) {
  return orderedJobGrades(data).find((grade) => grade.id === gradeId) || null;
}

function unitOwner(data, stationId, explicitId) {
  if (explicitId) {
    const named = (data?.employees || []).find((item) => item.id === explicitId);
    if (named) return named;
  }
  const station = stationById(data, stationId);
  if (station?.managerId) {
    const manager = (data?.employees || []).find((item) => item.id === station.managerId);
    if (manager) return manager;
  }
  return (data?.employees || []).find((item) => item.id === data?.ownerId || item.role === "owner") || null;
}

export function orgSeats(data) {
  return Array.isArray(data?.orgSeats) ? data.orgSeats : [];
}

function normName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBranchManagerTitle(title) {
  return isTreeManagerTitle(title);
}

export function stationHasManager(station) {
  return Boolean(String(station?.managerId || "").trim());
}

/** One branch manager per workplace — a filled manager slot blocks another manager title. */
export function managerTitleBlocked(station, title) {
  return stationHasManager(station) && isBranchManagerTitle(title);
}

export function ownerEmployee(data) {
  return (data?.employees || []).find((item) => item.id === data?.ownerId || item.role === "owner" || item.isOwner) || null;
}

export function seatForEmployee(data, employeeId) {
  if (!employeeId) return null;
  return orgSeats(data).find((seat) => String(seat.employeeId) === String(employeeId)) || null;
}

export function findEmployeeByName(data, name) {
  const key = normName(name);
  if (!key) return null;
  const matches = (data?.employees || []).filter((item) => {
    if (item?.role === "system") return false;
    const status = item?.profile?.employmentStatus;
    if (status === "terminated" || item.active === false) return false;
    return normName(item.name) === key;
  });
  return matches.length === 1 ? matches[0] : (matches[0] || null);
}

export function attachReportsTo(seat, data, reportsToName, reportsToId) {
  if (!seat) return;
  const byId = String(reportsToId || "").trim()
    ? (data?.employees || []).find((item) => String(item.id) === String(reportsToId))
    : null;
  const named = findEmployeeByName(data, reportsToName);
  const workplace = unitOwner(data, seat.stationId, seat.approverId);
  const manager = byId || named || workplace || ownerEmployee(data);
  const managerSeat = manager ? seatForEmployee(data, manager.id) : null;
  seat.reportsToEmployeeId = manager?.id || null;
  seat.reportsToSeatId = managerSeat?.id || null;
  seat.reportsToName = manager?.name || "";
  seat.approverId = manager?.id || seat.approverId || null;
  seat.reportsToMissing = (byId || named) || !String(reportsToName || "").trim() ? "" : String(reportsToName).trim();
}

export function vacateEmployeeSeats(data, employeeId) {
  (data?.orgSeats || []).forEach((seat) => {
    if (String(seat.employeeId) !== String(employeeId)) return;
    seat.employeeId = null;
    seat.filledAt = null;
    seat.vacatedAt = new Date().toISOString();
    seat.hireOpen = true;
  });
}

export function syncStationManagersFromSeats(data) {
  if (!data) return;
  (data.stations || []).forEach((station) => {
    const managerSeat = orgSeats(data).find((seat) =>
      String(seat.stationId) === String(station.id) && isBranchManagerTitle(seat.title)
    );
    if (!managerSeat) return;
    station.managerId = managerSeat.employeeId || null;
  });
  applyWorkplaceManagerRule(data);
}

export function activeActingAssignments(employee, day = todayKey()) {
  const today = String(day || todayKey()).slice(0, 10);
  return (employee?.actingAssignments || []).filter((item) => {
    if (item?.endedAt) return false;
    const until = String(item.until || "").slice(0, 10);
    return !until || until >= today;
  });
}

export function setActingAssignment(companyId, employeeId, input) {
  const stationId = String(input?.stationId || "").trim();
  const until = String(input?.until || "").slice(0, 10);
  if (!companyId || !employeeId || !stationId || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return { ok: false, error: "FIELDS" };
  }
  let error = "";
  updateCompany(companyId, (data) => {
    const employee = (data.employees || []).find((item) => item.id === employeeId);
    if (!employee) {
      error = "MISSING";
      return;
    }
    const home = String(employee.stationId || "");
    if (stationId === home) {
      error = "HOME";
      return;
    }
    if (!(data.stations || []).some((station) => String(station.id) === stationId)) {
      error = "MISSING";
      return;
    }
    const seat = seatForEmployee(data, employeeId);
    const live = activeActingAssignments(employee).filter((item) => String(item.stationId) !== stationId);
    live.push({
      id: uid("act"),
      seatId: String(input.seatId || seat?.id || ""),
      title: String(input.title || seat?.title || employee.position || "").trim(),
      stationId,
      listId: String(input.listId || seat?.listId || ""),
      until,
      createdAt: new Date().toISOString(),
    });
    employee.actingAssignments = live;
    appendOrgStructureEvent(data, {
      type: "acting",
      stationId,
      employeeId,
      employeeName: employee.name,
      until,
    });
  });
  if (error) return { ok: false, error };
  return { ok: true };
}

export function endActingAssignment(companyId, employeeId, actingId) {
  if (!companyId || !employeeId || !actingId) return { ok: false, error: "FIELDS" };
  updateCompany(companyId, (data) => {
    const employee = (data.employees || []).find((item) => item.id === employeeId);
    if (!employee) return;
    (employee.actingAssignments || []).forEach((item) => {
      if (item.id !== actingId) return;
      item.endedAt = new Date().toISOString();
      appendOrgStructureEvent(data, {
        type: "acting_end",
        stationId: item.stationId,
        employeeId,
        employeeName: employee.name,
      });
    });
  });
  return { ok: true };
}

export function delegationScopeFromSeat(data, employeeId) {
  const seat = seatForEmployee(data, employeeId);
  const station = stationById(data, seat?.stationId);
  const pack = packById(data, seat?.listId);
  return {
    stationId: seat?.stationId || "",
    listId: seat?.listId || "",
    branch: station?.name || "",
    list: pack ? templateLabel(pack, true) : (seat?.list || ""),
  };
}

export function vacantSeats(data, stationId, listId) {
  return orgSeats(data).filter((seat) => {
    if (seat.employeeId) return false;
    if (stationId && String(seat.stationId) !== String(stationId)) return false;
    if (listId && seat.listId !== listId && seat.list !== listId) return false;
    if (isManagerUnit(stationById(data, seat.stationId))) return false;
    return true;
  });
}

export function occupiedSeats(data) {
  return orgSeats(data).filter((seat) => seat.employeeId);
}

export function seatReadout(seat, data, ar = true) {
  if (!seat) return null;
  const station = stationById(data, seat.stationId);
  const grade = gradeById(data, seat.gradeId);
  const pack = packById(data, seat.listId);
  const range = gradeSalaryRange(grade);
  const min = range.min ?? (Number(seat.salaryMin) > 0 ? Number(seat.salaryMin) : null);
  const max = range.max ?? (Number(seat.salaryMax) > 0 ? Number(seat.salaryMax) : null);
  const approver = unitOwner(data, seat.stationId, seat.approverId);
  const schedule = (data?.schedules || []).find((item) => String(item.stationId) === String(seat.stationId));
  return {
    title: seat.title || "",
    branch: station?.name || "",
    stationId: seat.stationId || "",
    list: pack ? templateLabel(pack, ar) : (seat.list || ""),
    listId: seat.listId || "",
    grade: jobGradeLabel(grade) || "",
    gradeId: seat.gradeId || "",
    salaryMin: min,
    salaryMax: max,
    salary: min,
    approver: approver?.name || "",
    approverId: approver?.id || "",
    schedule: schedule ? (ar ? "جدول الفرع" : "Branch schedule") : (ar ? "جدول الفرع عند نشره" : "Branch schedule when published"),
  };
}

export function formatSalaryRange(min, max, ar) {
  if (min == null && max == null) return ar ? "—" : "—";
  const money = (n) => Number(n).toLocaleString("en-US");
  if (min != null && max != null) return `${money(min)} – ${money(max)}`;
  if (min != null) return ar ? `من ${money(min)}` : `From ${money(min)}`;
  return ar ? `حتى ${money(max)}` : `Up to ${money(max)}`;
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function ensureStationNode(data, stationId) {
  data.orgTree = data.orgTree || [];
  const station = stationById(data, stationId);
  if (!station) return null;
  let node = data.orgTree.find((item) => item.type === "station" && String(item.refId) === String(stationId));
  if (!node) {
    node = {
      id: `org_station_${station.id}`,
      type: "station",
      refId: station.id,
      title: station.name || "",
      parentId: null,
      order: data.orgTree.filter((item) => !item.parentId).length,
    };
    data.orgTree.push(node);
  }
  const parent = stationParentId(station);
  if (parent && String(parent) !== String(station.id)) {
    const parentNode = ensureStationNode(data, parent);
    if (parentNode && node.id !== parentNode.id) node.parentId = parentNode.id;
  } else {
    node.parentId = null;
  }
  return node;
}

export function occupantTitle(employee, data, ar = true) {
  if (!employee) return "";
  const seat = seatForEmployee(data, employee.id);
  return seat?.title
    || employee.profile?.position
    || employee.position
    || (employee.role === "owner" || employee.isOwner ? (ar ? "المالك" : "Owner") : "");
}

export function ensureCompanyRootStation(companyId, companyName, ar = true) {
  if (!companyId || !getCompanyData(companyId)) return { ok: false };
  const label = String(companyName || "").trim() || (ar ? "المنشأة" : "Company");
  const live = getCompanyData(companyId);
  const existing = companyRootStation(live?.stations);
  const orphans = (live?.stations || []).filter((station) => !isCompanyRootStation(station) && !stationParentId(station));
  const owner = ownerEmployee(live);
  const already = existing
    && !existing.parentStationId
    && existing.name === label
    && !orphans.length
    && (!owner || (existing.managerId && owner.stationId));
  if (already) return { ok: true, stationId: existing.id, changed: false };

  let stationId = existing?.id || "";
  updateCompany(companyId, (data) => {
    data.stations = data.stations || [];
    let root = companyRootStation(data.stations);
    if (!root) {
      const named = rootStations(data.stations).find((station) => String(station.name || "").trim() === label);
      if (named) {
        named.isCompanyRoot = true;
        named.parentStationId = null;
        root = named;
      }
    }
    if (!root) {
      root = {
        id: uid("st"),
        name: label,
        location: label,
        type: "branch",
        status: "active",
        managerId: null,
        parentStationId: null,
        isCompanyRoot: true,
        lat: null,
        lng: null,
        radiusMeters: 200,
        createdAt: new Date().toISOString(),
      };
      data.stations.push(root);
    } else {
      root.isCompanyRoot = true;
      root.parentStationId = null;
      if (root.name !== label) root.name = label;
    }
    root.unitKind = "branch";
    const holder = ownerEmployee(data);
    if (holder && !root.managerId) root.managerId = holder.id;
    seatCompanyHeadOnRoot(data);
    hangOrphanStationsUnderCompany(data.stations);
    ensureStationNode(data, root.id);
    stationId = root.id;
  });
  return { ok: true, stationId, changed: true };
}

export function createOrgBranch(companyId, name, company, data, parentStationId, unitKind) {
  const title = String(name || "").trim();
  if (!title) return { ok: false, error: "NAME" };
  const live = data || getCompanyData(companyId);
  if (company && live && !canAddStation(company, live)) return { ok: false, error: "LIMIT" };
  const root = companyRootStation(live?.stations);
  const parent = String(parentStationId || "").trim() || root?.id || null;
  if (parent && live && checkSetStationParentGate(live.stations || [], "new", parent).error === "PARENT_NOT_FOUND") {
    return { ok: false, error: "PARENT" };
  }
  const stationId = createOrgRecord(companyId, {
    type: "station",
    name: title,
    location: title,
    parentStationId: parent,
    unitKind: normalizeUnitKind(unitKind),
  });
  logAudit(companyId, "org_branch_added", parent ? `${title} → ${parent}` : title);
  updateCompany(companyId, (liveData) => {
    appendOrgStructureEvent(liveData, {
      type: "created",
      stationId,
      stationName: title,
      parentStationId: parent,
    });
  });
  return { ok: true, stationId };
}

export function setOrgUnitKind(companyId, stationId, unitKind) {
  const kind = normalizeUnitKind(unitKind);
  let error = "";
  updateCompany(companyId, (data) => {
    const station = stationById(data, stationId);
    if (!station) {
      error = "MISSING";
      return;
    }
    if (isCompanyRootStation(station)) {
      error = "COMPANY_ROOT";
      return;
    }
    const previous = station.unitKind;
    station.unitKind = kind;
    appendOrgStructureEvent(data, {
      type: "kind",
      stationId,
      stationName: station.name,
      from: previous,
      to: kind,
    });
  });
  if (error) return { ok: false, error };
  logAudit(companyId, "org_unit_kind", `${stationId} → ${kind}`);
  return { ok: true };
}

export function setOrgBranchParent(companyId, stationId, parentStationId) {
  let error = "";
  updateCompany(companyId, (data) => {
    const station = stationById(data, stationId);
    if (!station) {
      error = "MISSING";
      return;
    }
    if (isCompanyRootStation(station)) {
      error = "COMPANY_ROOT";
      return;
    }
    const root = companyRootStation(data.stations || []);
    const requestedParent = String(parentStationId || "").trim() || root?.id || null;
    const gate = checkSetStationParentGate(data.stations || [], station.id, requestedParent);
    if (!gate.ok) {
      error = gate.error;
      return;
    }
    const previous = station.parentStationId;
    station.parentStationId = gate.parentStationId;
    ensureStationNode(data, station.id);
    applyExtraCoverageStrip(data);
    const parentStation = stationById(data, gate.parentStationId);
    appendOrgStructureEvent(data, {
      type: "parent",
      stationId,
      stationName: station.name,
      from: previous,
      to: gate.parentStationId,
      toName: parentStation?.name || "",
      parentStationId: gate.parentStationId,
    });
  });
  if (error) return { ok: false, error };
  logAudit(companyId, "org_branch_parent", `${stationId} → ${parentStationId || "root"}`);
  return { ok: true };
}

export function renameOrgBranch(companyId, stationId, name) {
  const title = String(name || "").trim();
  if (!companyId || !stationId || !title) return { ok: false, error: "NAME" };
  let error = "";
  updateCompany(companyId, (data) => {
    const stations = data.stations || [];
    const station = stations.find((item) => item.id === stationId || item.stationId === stationId);
    if (!station) {
      error = "MISSING";
      return;
    }
    if (isCompanyRootStation(station)) {
      error = "COMPANY_ROOT";
      return;
    }
    const taken = stations.some((item) => {
      const same = item.id === station.id || item.stationId === station.id || item.id === station.stationId;
      return !same && String(item.name || "").trim() === title;
    });
    if (taken) {
      error = "DUP";
      return;
    }
    const previous = station.name;
    station.name = title;
    const node = (data.orgTree || []).find((item) => item.type === "station" && String(item.refId) === String(station.id || station.stationId));
    if (node) node.title = title;
    appendOrgStructureEvent(data, {
      type: "renamed",
      stationId,
      stationName: title,
      from: previous,
      to: title,
    });
  });
  if (error) return { ok: false, error };
  logAudit(companyId, "org_branch_renamed", title);
  return { ok: true };
}

export function toggleEmployeeExtraBranch(companyId, employeeId, stationId) {
  const target = String(stationId || "").trim();
  if (!companyId || !employeeId || !target) return { ok: false, error: "FIELDS" };
  let error = "";
  let added = false;
  updateCompany(companyId, (data) => {
    const employee = (data.employees || []).find((item) => item.id === employeeId);
    if (!employee) {
      error = "MISSING";
      return;
    }
    const home = String(employee.stationId || "");
    if (target === home) {
      error = "HOME";
      return;
    }
    if (!(data.stations || []).some((station) => String(station.id) === target)) {
      error = "MISSING";
      return;
    }
    const inherited = new Set(stationSubtreeIds(data.stations || [], home));
    if (inherited.has(target)) {
      error = "INHERITED";
      employee.managedStations = stripDescendantCoverage(employee.managedStations, data.stations || [], home);
      return;
    }
    const extra = new Set(stripDescendantCoverage(employee.managedStations, data.stations || [], home));
    if (extra.has(target)) extra.delete(target);
    else {
      extra.add(target);
      added = true;
    }
    employee.managedStations = [...extra];
  });
  if (error) return { ok: false, error };
  return { ok: true, added };
}

export function createOrgSeat(companyId, input) {
  const title = String(input?.title || "").trim();
  const stationId = String(input?.stationId || "").trim();
  if (!title || !stationId) return { ok: false, error: "SEAT_FIELDS" };
  let seatId = "";
  let error = "";
  updateCompany(companyId, (data) => {
    const listId = String(input.listId || "").trim();
    if (!listId) {
      error = "SEAT_FIELDS";
      return;
    }
    const ladder = gradesForList(data, listId);
    if (ladder.length && (!input.gradeId || !ladder.some((grade) => grade.id === input.gradeId))) {
      error = "GRADE_LIST";
      return;
    }
    data.orgSeats = data.orgSeats || [];
    const station = stationById(data, stationId);
    if (!station) {
      error = "MISSING";
      return;
    }
    if (isManagerUnit(station)) {
      error = "ADMIN_NO_HIRE";
      return;
    }
    if (managerTitleBlocked(station, title)) {
      error = "MANAGER_TAKEN";
      return;
    }
    const approver = unitOwner(data, stationId, input.approverId);
    const grade = gradeById(data, input.gradeId);
    const range = gradeSalaryRange(grade);
    seatId = uid("seat");
    data.orgSeats.push({
      id: seatId,
      title,
      stationId,
      listId,
      list: input.list || "",
      gradeId: input.gradeId || "",
      employeeId: null,
      hireOpen: true,
      reportsToEmployeeId: null,
      reportsToSeatId: null,
      reportsToName: "",
      approverId: approver?.id || station?.managerId || null,
      salaryMin: range.min,
      salaryMax: range.max,
      createdAt: new Date().toISOString(),
    });
  });
  if (error) return { ok: false, error };
  return { ok: true, seatId };
}

function missingDocKinds(nationalId, nationality) {
  const id = String(nationalId || "").replace(/\D/g, "");
  const status = deriveSaudiStatus({ nationalId: id, nationality });
  const saudi = status.countable ? status.saudi : false;
  const kinds = saudi ? ["national_id", "gosi", "qiwa_title"] : ["iqama", "work_permit", "gosi", "qiwa_title"];
  if (!/^\d{10}$/.test(id)) kinds.unshift(saudi ? "national_id" : "iqama");
  return [...new Set(kinds)];
}

export function hireFromSeat(companyId, input) {
  const name = String(input?.name || "").trim();
  const draft = Boolean(input?.draft);
  let seatId = String(input?.seatId || "").trim();
  if (!name) return { ok: false, error: "NAME" };
  if (!seatId && input?.newSeat) {
    const created = createOrgSeat(companyId, input.newSeat);
    if (!created.ok) return created;
    seatId = created.seatId;
  }
  if (!seatId) return { ok: false, error: "SEAT" };

  let employeeId = "";
  let inviteToken = "";
  let warnings = [];
  let salary = null;
  let leaveDays = 0;
  let error = "";

  updateCompany(companyId, (data) => {
    data.orgSeats = data.orgSeats || [];
    const seat = data.orgSeats.find((item) => item.id === seatId);
    if (!seat || seat.employeeId) {
      warnings.push("SEAT_TAKEN");
      return;
    }
    if (isManagerUnit(stationById(data, seat.stationId))) {
      error = "ADMIN_NO_HIRE";
      return;
    }
    if (managerTitleBlocked(stationById(data, seat.stationId), seat.title)) {
      error = "MANAGER_TAKEN";
      return;
    }
    const stationNode = ensureStationNode(data, seat.stationId);
    const pack = packById(data, seat.listId);
    const permissions = pack?.permissions || {};
    const grade = gradeById(data, seat.gradeId);
    const range = gradeSalaryRange(grade);
    const min = range.min ?? (Number(seat.salaryMin) > 0 ? Number(seat.salaryMin) : null);
    const max = range.max ?? (Number(seat.salaryMax) > 0 ? Number(seat.salaryMax) : null);
    const requested = input.salary == null || input.salary === "" ? min : Number(input.salary);
    salary = Number.isFinite(requested) && requested > 0 ? requested : min;
    const outOfRange = salary != null && ((min != null && salary < min) || (max != null && salary > max));
    const salaryNote = String(input.salaryNote || "").trim()
      || (outOfRange ? (input.ar ? "أُدخل خارج نطاق الدرجة مع التوثيق." : "Entered outside the grade range, with a note.") : "");
    if (outOfRange) warnings.push("SALARY_RANGE");

    const hireDate = String(input.hireDate || todayKey()).slice(0, 10);
    leaveDays = annualLeaveFromHireDate(hireDate);
    const nationalId = String(input.nationalId || "").replace(/\D/g, "");
    const nationality = String(input.nationality || input.profile?.nationality || "").trim();
    const phone = String(input.phone || "").trim();
    const hireType = hireContractId(input.contractType);
    const workPattern = String(input.workPattern || input.profile?.workPattern || "ordinary");
    const nonSaudi = nationalityIsSaudi(nationality) === false;
    const contractType = fileContractType(hireType, { nonSaudi, workPattern });
    let contractEndDate = String(input.contractEndDate || input.profile?.contractEndDate || "").slice(0, 10);
    const termGate = checkContractTermGate({
      contractType,
      contractEndDate,
      hireDate,
      nationality,
      nationalId,
    });
    if (termGate.deemed && termGate.endDate) contractEndDate = termGate.endDate;
    if (!termGate.ok) {
      error = termGate.error === "CONTRACT_EXPIRED" ? "CONTRACT_EXPIRED"
        : termGate.error === "CONTRACT_NONSAUDI_FIXED_REQUIRED" ? "CONTRACT_NONSAUDI_FIXED"
        : "CONTRACT_END";
      return;
    }
    const probation = hireType === "trial" || Boolean(input.probation || input.profile?.probation);
    const probationDays = Number(input.probationDays || input.profile?.probationDays || 0);
    const probationGate = checkProbationGate({
      probation,
      probationDays,
      hireDate,
      probationPriorAtEmployer: input.probationPriorAtEmployer ?? input.profile?.probationPriorAtEmployer,
      probationOtherProfession: input.probationOtherProfession ?? input.profile?.probationOtherProfession,
      probationRehireGapMonths: input.probationRehireGapMonths ?? input.profile?.probationRehireGapMonths,
    });
    if (!probationGate.ok) {
      error = probationGate.error;
      return;
    }
    const approver = unitOwner(data, seat.stationId, seat.approverId);
    const missing = missingDocKinds(nationalId, nationality);
    if (missing.length) warnings.push("DOCS");

    employeeId = uid("emp");
    inviteToken = uid("inv");
    const jobTitle = seat.title || "";
    data.employees = data.employees || [];
    const extra = stripDescendantCoverage(input.managedStationIds, data.stations || [], seat.stationId);
    data.employees.push({
      id: employeeId,
      name,
      email: String(input.email || "").trim(),
      role: "employee",
      stationId: seat.stationId || null,
      phone,
      anonymousId: `ANON-${Math.floor(Math.random() * 1e8).toString(16).toUpperCase().padStart(8, "0")}`,
      managedStations: extra,
      position: jobTitle,
      nationalId: nationalId || undefined,
      nationality: nationality || undefined,
      profile: {
        position: jobTitle,
        department: pack ? templateLabel(pack, true) : (seat.list || ""),
        gradeId: seat.gradeId || null,
        hireDate,
        contractType,
        nationality,
        nationalId,
        phone,
        baseSalary: salary || "",
        currency: "SAR",
        directManagerId: approver?.id || null,
        leaveTotals: { annual: leaveDays },
        leaveBalance: { annual: leaveDays },
        employmentStatus: draft ? "draft" : "active",
        inviteToken,
        salaryOutOfRangeNote: outOfRange ? salaryNote : "",
        complianceQueued: missing,
        ...(input.profile || {}),
        position: jobTitle,
        department: pack ? templateLabel(pack, true) : (seat.list || ""),
        gradeId: seat.gradeId || null,
        hireDate,
        nationality,
        nationalId,
        phone,
        contractType,
        contractEndDate: contractType === "fixed" ? contractEndDate : "",
        workPattern,
        probation,
        probationDays: probation ? probationDays : "",
        contract: {
          ...((input.profile && input.profile.contract) || {}),
          type: contractType,
          startDate: hireDate,
          endDate: contractType === "fixed" ? contractEndDate : "",
          workPattern,
        },
      },
      createdAt: new Date().toISOString(),
    });

    data.orgTree = data.orgTree || [];
    const parentId = stationNode?.id || null;
    data.orgTree.push({
      id: `org_${employeeId}`,
      type: "employee",
      refId: employeeId,
      title: jobTitle,
      parentId,
      order: data.orgTree.filter((node) => (node.parentId || null) === parentId).length,
    });

    const score = scorePermissions(permissions);
    data.smartPositions = data.smartPositions || [];
    data.smartPositions.push({
      employeeId,
      title: jobTitle,
      titleManual: true,
      permissions,
      templateId: pack?.id || seat.listId || "",
      score,
      rank: rankFromScore(score),
      updatedAt: new Date().toISOString(),
    });

    seat.employeeId = employeeId;
    seat.filledAt = new Date().toISOString();
    seat.hireOpen = false;
    attachReportsTo(seat, data, input.reportsTo, input.reportsToId);
    const hired = data.employees.find((item) => item.id === employeeId);
    if (hired?.profile) hired.profile.directManagerId = seat.reportsToEmployeeId || hired.profile.directManagerId || null;
    syncStationManagersFromSeats(data);
  });

  if (error) return { ok: false, error };
  if (!employeeId) return { ok: false, error: warnings.includes("SEAT_TAKEN") ? "SEAT_TAKEN" : "SEAT" };

  logAudit(
    companyId,
    draft ? "employee_hired_draft" : "employee_hired",
    `${name} → ${seatId}${draft ? " (draft)" : ""}`,
  );

  return {
    ok: true,
    employeeId,
    seatId,
    inviteToken,
    warnings,
    salary,
    leaveDays,
    draft,
  };
}

export function placeExistingEmployee(companyId, employeeId, input) {
  let error = "";
  updateCompany(companyId, (data) => {
    const employee = (data.employees || []).find((item) => item.id === employeeId);
    if (!employee) {
      error = "MISSING";
      return;
    }
    data.orgSeats = data.orgSeats || [];
    let seatId = String(input?.seatId || "").trim();
    if (!seatId && input?.newSeat) {
      const title = String(input.newSeat.title || "").trim();
      const stationId = String(input.newSeat.stationId || "").trim();
      const listId = String(input.newSeat.listId || "").trim();
      const ladder = gradesForList(data, listId);
      if (!title || !stationId || !listId) {
        error = "SEAT_FIELDS";
        return;
      }
      if (ladder.length && (!input.newSeat.gradeId || !ladder.some((grade) => grade.id === input.newSeat.gradeId))) {
        error = "GRADE_LIST";
        return;
      }
      const station = stationById(data, stationId);
      if (isManagerUnit(station)) {
        error = "ADMIN_NO_HIRE";
        return;
      }
      if (managerTitleBlocked(station, title)) {
        error = "MANAGER_TAKEN";
        return;
      }
      const approver = unitOwner(data, stationId, input.newSeat.approverId);
      const grade = gradeById(data, input.newSeat.gradeId);
      const range = gradeSalaryRange(grade);
      seatId = uid("seat");
      data.orgSeats.push({
        id: seatId,
        title,
        stationId,
        listId,
        list: input.newSeat.list || "",
        gradeId: input.newSeat.gradeId,
        employeeId: null,
        hireOpen: true,
        reportsToEmployeeId: null,
        reportsToSeatId: null,
        reportsToName: "",
        approverId: approver?.id || station?.managerId || null,
        salaryMin: range.min,
        salaryMax: range.max,
        createdAt: new Date().toISOString(),
      });
    }
    const seat = data.orgSeats.find((item) => item.id === seatId);
    if (!seat) {
      error = "SEAT";
      return;
    }
    if (isManagerUnit(stationById(data, seat.stationId))) {
      error = "ADMIN_NO_HIRE";
      return;
    }
    if (managerTitleBlocked(stationById(data, seat.stationId), seat.title)) {
      error = "MANAGER_TAKEN";
      return;
    }
    if (seat.employeeId && seat.employeeId !== employeeId) {
      error = "SEAT_TAKEN";
      return;
    }
    data.orgSeats.forEach((item) => {
      if (item.employeeId === employeeId && item.id !== seat.id) {
        item.employeeId = null;
        item.filledAt = null;
        item.hireOpen = true;
        item.vacatedAt = new Date().toISOString();
      }
    });
    const stationNode = ensureStationNode(data, seat.stationId);
    const pack = packById(data, seat.listId);
    const extra = stripDescendantCoverage(input.managedStationIds, data.stations || [], seat.stationId);
    const name = String(input.name || employee.name || "").trim();
    const nationalId = String(input.nationalId || employee.nationalId || employee.profile?.nationalId || "").replace(/\D/g, "");
    const phone = String(input.phone || employee.phone || "").trim();
    const email = String(input.email || employee.email || "").trim();
    const hireDate = String(input.hireDate || employee.profile?.hireDate || todayKey()).slice(0, 10);
    const jobTitle = seat.title || employee.position || "";
    const grade = gradeById(data, seat.gradeId);
    const range = gradeSalaryRange(grade);
    const requested = input.salary == null || input.salary === ""
      ? Number(input.profile?.baseSalary || employee.profile?.baseSalary)
      : Number(input.salary);
    const salary = Number.isFinite(requested) && requested > 0 ? requested : null;
    const outOfRange = salary != null && ((range.min != null && salary < range.min) || (range.max != null && salary > range.max));
    const leaveDays = annualLeaveFromHireDate(hireDate);
    employee.name = name || employee.name;
    employee.email = email;
    employee.phone = phone;
    employee.stationId = seat.stationId || null;
    employee.managedStations = extra;
    employee.position = jobTitle;
    if (nationalId) employee.nationalId = nationalId;
    employee.profile = {
      ...(employee.profile || {}),
      ...(input.profile || {}),
      position: jobTitle,
      department: pack ? templateLabel(pack, true) : (seat.list || ""),
      gradeId: seat.gradeId || null,
      hireDate,
      nationalId: nationalId || employee.profile?.nationalId || "",
      phone,
      baseSalary: salary ?? employee.profile?.baseSalary ?? "",
      leaveTotals: { ...(employee.profile?.leaveTotals || {}), annual: leaveDays },
      leaveBalance: {
        ...(employee.profile?.leaveBalance || {}),
        annual: employee.profile?.leaveBalance?.annual != null ? employee.profile.leaveBalance.annual : leaveDays,
      },
      salaryOutOfRangeNote: outOfRange
        ? (String(input.salaryNote || employee.profile?.salaryOutOfRangeNote || "").trim()
          || (input.ar ? "أُدخل خارج نطاق الدرجة مع التوثيق." : "Entered outside the grade range, with a note."))
        : (employee.profile?.salaryOutOfRangeNote || ""),
    };
    data.orgTree = data.orgTree || [];
    const parentId = stationNode?.id || null;
    const node = data.orgTree.find((item) => item.type === "employee" && item.refId === employeeId);
    if (node) {
      node.parentId = parentId;
      node.title = jobTitle;
    } else {
      data.orgTree.push({
        id: `org_${employeeId}`,
        type: "employee",
        refId: employeeId,
        title: jobTitle,
        parentId,
        order: data.orgTree.filter((item) => (item.parentId || null) === parentId).length,
      });
    }
    const permissions = pack?.permissions || {};
    const score = scorePermissions(permissions);
    data.smartPositions = data.smartPositions || [];
    const smart = data.smartPositions.find((item) => item.employeeId === employeeId);
    if (smart) {
      smart.title = jobTitle;
      smart.templateId = pack?.id || seat.listId || "";
      smart.permissions = permissions;
      smart.score = score;
      smart.rank = rankFromScore(score);
      smart.updatedAt = new Date().toISOString();
    } else {
      data.smartPositions.push({
        employeeId,
        title: jobTitle,
        titleManual: true,
        permissions,
        templateId: pack?.id || seat.listId || "",
        score,
        rank: rankFromScore(score),
        updatedAt: new Date().toISOString(),
      });
    }
    seat.employeeId = employeeId;
    seat.filledAt = new Date().toISOString();
    seat.hireOpen = false;
    attachReportsTo(seat, data, input.reportsTo, input.reportsToId);
    employee.profile.directManagerId = seat.reportsToEmployeeId || employee.profile.directManagerId || null;
    syncStationManagersFromSeats(data);
  });
  if (error) return { ok: false, error };
  logAudit(companyId, "employee_placed_from_template", String(input?.name || employeeId));
  return { ok: true, employeeId, updated: true };
}

export function inviteUrl(employeeId, token) {
  if (typeof window === "undefined") return "";
  const url = new URL(`/app/employees/${employeeId}`, window.location.origin);
  if (token) url.searchParams.set("invite", token);
  return url.toString();
}
