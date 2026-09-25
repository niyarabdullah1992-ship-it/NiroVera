import { getCompanyData, updateCompany } from "@/lib/store";
import { applyPreviewStationPin } from "@/lib/previewStationPins";
import { assignEmployeeNumber } from "@/lib/employeeNumber";
import { ownerEmployee, syncStationManagersFromSeats } from "@/lib/orgHire";
import { applyWorkplaceManagerRule, seatCompanyHeadOnRoot } from "@/lib/peopleTreeGraph";
import { applyExtraCoverageStrip, companyRootStation, hangOrphanStationsUnderCompany, isCompanyRootStation, stationParentId, stripDescendantCoverage } from "@/lib/stationTree";
import {
  DEMO_BRANCH_MANAGERS,
  DEMO_ORG_EMAIL_DOMAIN,
  DEMO_ORG_MANAGER_EMAIL,
  demoOrgBranchPlan,
  demoOrgHireRows,
} from "@/lib/demoOrgTreeData";

export {
  DEMO_BRANCH_MANAGERS,
  DEMO_ORG_EMAIL_DOMAIN,
  DEMO_ORG_MANAGER_EMAIL,
  demoOrgBranchPlan,
  demoOrgHireRows,
};

function applyDemoBranchManagers(data) {
  hangOrphanStationsUnderCompany(data.stations);
  const byEmail = new Map();
  (data.employees || []).forEach((employee) => {
    const email = String(employee.email || "").trim().toLowerCase();
    if (email) byEmail.set(email, employee);
  });
  DEMO_BRANCH_MANAGERS.forEach(({ branch, email }) => {
    const station = stationByName(data, branch);
    const manager = byEmail.get(String(email).toLowerCase());
    if (!station || !manager) return;
    station.managerId = manager.id;
    if (!manager.stationId) manager.stationId = station.id;
  });
  const root = companyRootStation(data.stations);
  const owner = ownerEmployee(data);
  if (root && owner) root.managerId = owner.id;
  seatCompanyHeadOnRoot(data);
  applyWorkplaceManagerRule(data);
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function stationByName(data, name) {
  const key = norm(name);
  if (!key) return null;
  return (data?.stations || []).find((station) => norm(station.name) === key) || null;
}

function isDemoEmail(email) {
  return String(email || "").trim().toLowerCase().endsWith(`@${DEMO_ORG_EMAIL_DOMAIN}`);
}

function ensureList(data, name) {
  data.permissionTemplates = data.permissionTemplates || [];
  const existing = data.permissionTemplates.find((pack) => pack.ar === name || pack.en === name);
  if (existing) return existing;
  const pack = { id: uid("tpl"), ar: name, en: name, permissions: {}, positions: [] };
  data.permissionTemplates.push(pack);
  return pack;
}

function ensureGrade(data, listId, title) {
  data.jobGrades = data.jobGrades || [];
  const hit = data.jobGrades.find((grade) => grade.listId === listId && String(grade.title || "").trim() === title);
  if (hit) return hit;
  const prefix = title === "مدير" ? "LD" : "OP";
  const used = new Set(data.jobGrades.filter((grade) => grade.listId === listId).map((grade) => String(grade.gradeNumber || "")));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  const grade = {
    id: uid("grade"),
    listId,
    gradeNumber: `${prefix}${n}`,
    title,
    order: data.jobGrades.length,
    minSalary: null,
    maxSalary: null,
    requiredCerts: [],
  };
  data.jobGrades.push(grade);
  return grade;
}

function addTitle(pack, title) {
  pack.positions = Array.isArray(pack.positions) ? pack.positions : [];
  if (pack.positions.some((item) => String(item?.title || item || "").trim() === title)) return;
  pack.positions.push({ title });
}

function ensureStationNode(data, stationId, trail = new Set()) {
  data.orgTree = data.orgTree || [];
  const id = String(stationId || "");
  if (!id || trail.has(id)) return null;
  trail.add(id);
  const station = (data.stations || []).find((item) => String(item.id) === id);
  if (!station) return null;
  let node = data.orgTree.find((item) => item.type === "station" && String(item.refId) === id);
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
    const parentNode = ensureStationNode(data, parent, trail);
    if (parentNode && node.id !== parentNode.id) node.parentId = parentNode.id;
  } else {
    node.parentId = null;
  }
  return node;
}

function ensureCompanyRoot(data, companyName) {
  const label = String(companyName || "").trim() || "المنشأة";
  let root = companyRootStation(data.stations);
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
      demo: true,
      lat: null,
      lng: null,
      radiusMeters: 200,
      createdAt: new Date().toISOString(),
    };
    applyPreviewStationPin(root);
    data.stations = data.stations || [];
    data.stations.push(root);
  } else {
    root.isCompanyRoot = true;
    root.parentStationId = null;
    applyPreviewStationPin(root);
  }
  const owner = ownerEmployee(data);
  if (owner && !root.managerId) root.managerId = owner.id;
  seatCompanyHeadOnRoot(data);
  ensureStationNode(data, root.id);
  return root;
}

function ensureBranch(data, name, parentName, unitKind) {
  data.stations = data.stations || [];
  let station = stationByName(data, name);
  const parent = parentName ? stationByName(data, parentName) : companyRootStation(data.stations);
  if (!station) {
    station = {
      id: uid("st"),
      name,
      location: name,
      type: "branch",
      unitKind: unitKind === "manager" ? "manager" : "branch",
      status: "active",
      managerId: null,
      parentStationId: parent?.id || null,
      demo: true,
      lat: null,
      lng: null,
      radiusMeters: 200,
      createdAt: new Date().toISOString(),
    };
    applyPreviewStationPin(station);
    data.stations.push(station);
  } else if (!isCompanyRootStation(station)) {
    applyPreviewStationPin(station);
    const wanted = parent?.id || null;
    if ((stationParentId(station) || null) !== wanted) station.parentStationId = wanted;
    if (unitKind) station.unitKind = unitKind === "manager" ? "manager" : "branch";
  }
  ensureStationNode(data, station.id);
  return station;
}

export function seedDemoOrgTree(companyId, { ar = true } = {}) {
  if (!companyId || !getCompanyData(companyId)) {
    return { ok: false, hired: [], message: ar ? "لا توجد منشأة لملئها." : "No company to fill." };
  }
  let hired = 0;
  updateCompany(companyId, (data) => {
    const companyName = data?.settings?.companyName || "";
    ensureCompanyRoot(data, companyName);
    demoOrgBranchPlan().forEach((item) => ensureBranch(data, item.name, item.parent, item.unitKind));
    const rows = demoOrgHireRows();
    const known = new Set((data.employees || []).map((item) => String(item.email || "").trim().toLowerCase()));
    const byName = new Map();
    (data.employees || []).forEach((employee) => {
      if (employee?.name) byName.set(norm(employee.name), employee);
    });
    const owner = ownerEmployee(data);
    if (owner?.name) byName.set(norm(owner.name), owner);
    data.employees = data.employees || [];
    data.orgSeats = data.orgSeats || [];
    data.smartPositions = data.smartPositions || [];
    data.orgTree = data.orgTree || [];
    const now = new Date().toISOString();
    const companyRoot = companyRootStation(data.stations);
    rows.forEach((row) => {
      const email = String(row.email || "").trim().toLowerCase();
      if (known.has(email)) {
        const existing = data.employees.find((item) => String(item.email || "").trim().toLowerCase() === email);
        if (existing) byName.set(norm(existing.name), existing);
        return;
      }
      const home = row.onCompanyRoot ? companyRoot : stationByName(data, row.branch);
      if (!home) return;
      const pack = ensureList(data, row.list);
      const grade = ensureGrade(data, pack.id, row.grade);
      addTitle(pack, row.title);
      const extra = stripDescendantCoverage(
        String(row.extraBranches || "")
          .split(/[،,]/)
          .map((label) => stationByName(data, label.trim())?.id)
          .filter(Boolean),
        data.stations || [],
        home.id,
      );
      const employeeId = uid("emp");
      const seatId = uid("seat");
      const reports = (row.reportsTo ? byName.get(norm(row.reportsTo)) : null) || owner;
      data.employees.push({
        id: employeeId,
        name: row.name,
        email: row.email,
        role: "employee",
        stationId: home.id,
        phone: row.phone || "",
        anonymousId: `ANON-${employeeId.slice(-8).toUpperCase()}`,
        managedStations: extra,
        position: row.title,
        nationalId: row.nationalId,
        profile: {
          demo: true,
          position: row.title,
          department: pack.ar,
          gradeId: grade.id,
          hireDate: row.hireDate,
          contractType: "indefinite",
          nationalId: row.nationalId,
          phone: row.phone || "",
          baseSalary: "",
          currency: "SAR",
          directManagerId: reports?.id || null,
          employmentStatus: "active",
        },
        createdAt: now,
      });
      assignEmployeeNumber(data, data.employees[data.employees.length - 1], { hireDate: row.hireDate });
      const stationNode = ensureStationNode(data, home.id);
      data.orgTree.push({
        id: `org_${employeeId}`,
        type: "employee",
        refId: employeeId,
        title: row.title,
        parentId: stationNode?.id || null,
        order: data.orgTree.filter((node) => (node.parentId || null) === (stationNode?.id || null)).length,
      });
      data.smartPositions.push({
        employeeId,
        title: row.title,
        titleManual: true,
        permissions: {},
        templateId: pack.id,
        score: 0,
        rank: "employee",
        updatedAt: now,
      });
      data.orgSeats.push({
        id: seatId,
        title: row.title,
        stationId: home.id,
        listId: pack.id,
        list: pack.ar,
        gradeId: grade.id,
        employeeId,
        hireOpen: false,
        filledAt: now,
        reportsToEmployeeId: reports?.id || null,
        reportsToSeatId: null,
        reportsToName: reports?.name || "",
        approverId: reports?.id || null,
        salaryMin: null,
        salaryMax: null,
        createdAt: now,
      });
      const hiredEmp = data.employees[data.employees.length - 1];
      byName.set(norm(hiredEmp.name), hiredEmp);
      known.add(email);
      hired += 1;
    });
    syncStationManagersFromSeats(data);
    applyDemoBranchManagers(data);
    applyExtraCoverageStrip(data);
    data.settings = { ...(data.settings || {}), demoOrgTreeAt: new Date().toISOString() };
  });
  const demoCount = (getCompanyData(companyId)?.employees || []).filter((employee) => isDemoEmail(employee.email)).length;
  if (!hired) {
    return {
      ok: demoCount > 0,
      hired: 0,
      demoCount,
      message: demoCount
        ? (ar ? `الموظفون الوهميون موجودون (${demoCount}).` : `Demo employees are already in place (${demoCount}).`)
        : (ar ? "تعذّر إنشاء الموظفين الوهميين." : "Could not create demo employees."),
    };
  }
  return {
    ok: true,
    hired,
    demoCount,
    message: ar
      ? `أُضيف ${hired} موظفًا وهميًا على شجرة الفروع.`
      : `Added ${hired} demo employees on the branch tree.`,
  };
}
