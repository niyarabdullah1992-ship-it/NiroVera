import { updateCompany } from "@/lib/store";
import { SMART_DEPARTMENTS } from "@/lib/smartPositions";

// Payroll and complaints are sensitive — only the company owner may grant them.
export const OWNER_ONLY_DEPARTMENTS = ["payroll", "complaints"];

export const INHERIT_TEMPLATE_ID = "__inherit__";
/** Owner-named position — permissions distributed by section (SAP-style). */
export const CUSTOM_TEMPLATE_ID = "";

const dailyOpsView = {
  tasks: "view",
  attendance: "view",
  chat: "view",
  performance: "view",
  expenses: "view",
  files: "view",
};

// Examples only: applying one fills the section list; the job title stays free text.
export const BUILT_IN_TEMPLATES = [
  {
    id: "field",
    ar: "موظف ميداني",
    en: "Field employee",
    permissions: { ...dailyOpsView, safety: "view", work_proof: "view" },
  },
  {
    id: "safety_officer",
    ar: "مسؤول سلامة",
    en: "Safety officer",
    permissions: { ...dailyOpsView, safety: "manage", work_proof: "view" },
  },
  {
    id: "station_manager",
    ar: "مدير فرع",
    en: "Branch manager",
    permissions: {
      tasks: "manage",
      attendance: "manage",
      chat: "manage",
      performance: "manage",
      safety: "manage",
      employees: "view",
      inventory: "view",
      expenses: "view",
      work_proof: "view",
      signing: "view",
      reports: "view",
      files: "view",
    },
  },
  {
    id: "finance_officer",
    ar: "مسؤول مالية",
    en: "Finance officer",
    permissions: {
      expenses: "manage",
      payroll: "view",
      inventory: "view",
      attendance: "view",
      reports: "view",
      files: "view",
    },
  },
  {
    id: "hr_officer",
    ar: "مسؤول موارد بشرية",
    en: "HR officer",
    permissions: {
      hr: "manage",
      employees: "manage",
      attendance: "view",
      performance: "view",
      expenses: "view",
      files: "view",
      reports: "view",
    },
  },
];

export const companyTemplates = (data) => [...BUILT_IN_TEMPLATES, ...(data?.permissionTemplates || [])];
export const templateById = (data, id) => companyTemplates(data).find((template) => template.id === id) || null;
export const templateLabel = (template, ar) => (ar ? template.ar : template.en || template.ar);

const builtInIds = () => new Set(BUILT_IN_TEMPLATES.map((item) => item.id));

/** Lists the company created — not platform packs such as «موظف ميداني». */
export function companyLists(data) {
  const skip = builtInIds();
  return (data?.permissionTemplates || []).filter((pack) => pack?.id && pack?.ar && !skip.has(pack.id));
}

export function createCompanyList(companyId, name) {
  let id = "";
  updateCompany(companyId, (data) => {
    data.permissionTemplates = data.permissionTemplates || [];
    const key = String(name || "").trim();
    if (!key) return;
    const skip = builtInIds();
    const existing = data.permissionTemplates.find((item) =>
      !skip.has(item.id) && (item.ar === key || item.en === key)
    );
    if (existing) {
      id = existing.id;
      return;
    }
    id = `tpl_${Math.random().toString(36).slice(2, 9)}`;
    data.permissionTemplates.push({ id, ar: key, en: key, permissions: {}, positions: [] });
  });
  return id;
}

export function renameCompanyList(companyId, listId, name) {
  const key = String(name || "").trim();
  if (!companyId || !listId || !key) return { ok: false, error: "FIELDS" };
  let error = "";
  updateCompany(companyId, (data) => {
    const skip = builtInIds();
    if (skip.has(listId)) {
      error = "BUILTIN";
      return;
    }
    const pack = (data.permissionTemplates || []).find((item) => item.id === listId);
    if (!pack) {
      error = "MISSING";
      return;
    }
    const clash = (data.permissionTemplates || []).find((item) =>
      item.id !== pack.id && !skip.has(item.id) && (item.ar === key || item.en === key)
    );
    if (clash) {
      error = "DUP";
      return;
    }
    const previous = pack.ar;
    pack.ar = key;
    pack.en = key;
    (data.orgSeats || []).forEach((seat) => {
      if (seat.listId === pack.id || seat.list === previous) seat.list = key;
    });
    (data.employees || []).forEach((employee) => {
      if (employee?.profile?.department === previous) employee.profile.department = key;
    });
    (data.smartPositions || []).forEach((smart) => {
      if (smart.templateId !== pack.id) return;
      const employee = (data.employees || []).find((item) => item.id === smart.employeeId);
      if (!employee) return;
      employee.profile = { ...(employee.profile || {}), department: key };
    });
  });
  return error ? { ok: false, error } : { ok: true, id: listId };
}

const TREE_LIST_SKIP = new Set(["عام", "بلا فرع"]);

function findCompanyListRecord(templates, name, skipIds) {
  return (templates || []).find((item) =>
    !skipIds.has(item.id) && (item.ar === name || item.en === name)
  ) || null;
}

/** Persist lists (and job titles) that already appear on the org tree. */
export function ensureCompanyListsFromTree(companyId, data, treeLists) {
  if (!companyId) return false;
  const skipIds = builtInIds();
  const wanted = (treeLists || [])
    .map((item) => ({
      name: String(item?.name || "").trim(),
      titles: [...new Set((item?.titles || []).map((title) => String(title || "").trim()).filter((title) => title && title !== "—"))],
    }))
    .filter((item) => item.name && !TREE_LIST_SKIP.has(item.name));
  if (!wanted.length) return false;

  const templates = data?.permissionTemplates || [];
  const needsWrite = wanted.some((item) => {
    const pack = findCompanyListRecord(templates, item.name, skipIds);
    if (!pack) return true;
    const have = new Set(listPositions(pack).map((row) => row.title));
    const skipped = new Set(pack.removedPositions || []);
    return item.titles.some((title) => !have.has(title) && !skipped.has(title));
  });
  if (!needsWrite) return false;

  updateCompany(companyId, (company) => {
    company.permissionTemplates = company.permissionTemplates || [];
    wanted.forEach((item) => {
      let pack = findCompanyListRecord(company.permissionTemplates, item.name, skipIds);
      if (!pack) {
        pack = { id: `tpl_${Math.random().toString(36).slice(2, 9)}`, ar: item.name, en: item.name, permissions: {}, positions: [] };
        company.permissionTemplates.push(pack);
      }
      pack.positions = Array.isArray(pack.positions) ? pack.positions : [];
      const have = new Set(pack.positions.map((row) => row.title));
      const skipped = new Set(pack.removedPositions || []);
      item.titles.forEach((title) => {
        if (have.has(title) || skipped.has(title)) return;
        pack.positions.push({ id: `pos_${Math.random().toString(36).slice(2, 9)}`, title });
        have.add(title);
      });
    });
  });
  return true;
}

export const grantedCount = (permissions = {}) => Object.values(permissions).filter((access) => access && access !== "hidden").length;

export const samePermissions = (a = {}, b = {}) =>
  SMART_DEPARTMENTS.every((department) => (a[department.id] || "hidden") === (b[department.id] || "hidden"));

const demote = (permissions = {}) =>
  Object.fromEntries(Object.entries(permissions).filter(([, access]) => access === "manage").map(([id]) => [id, "view"]));

export function inheritedPermissions(data, parentNodeId) {
  const nodes = data?.orgTree || [];
  let cursor = nodes.find((node) => node.id === parentNodeId);
  while (cursor && cursor.type !== "employee") cursor = nodes.find((node) => node.id === cursor.parentId);
  if (!cursor) return {};
  const permissions = (data?.smartPositions || []).find((item) => item.employeeId === cursor.refId)?.permissions || {};
  return demote(permissions);
}

export function stationForParentNode(data, parentNodeId) {
  const nodes = data?.orgTree || [];
  let cursor = nodes.find((node) => node.id === parentNodeId);
  while (cursor && cursor.type !== "station") cursor = nodes.find((node) => node.id === cursor.parentId);
  return cursor ? (data?.stations || []).find((station) => station.id === cursor.refId) || null : null;
}

export function stripOwnerOnly(permissions = {}) {
  const next = { ...permissions };
  OWNER_ONLY_DEPARTMENTS.forEach((id) => delete next[id]);
  return next;
}

export function saveCompanyTemplate(companyId, name, permissions) {
  let id = "";
  updateCompany(companyId, (data) => {
    data.permissionTemplates = data.permissionTemplates || [];
    const key = String(name || "").trim();
    const builtIn = BUILT_IN_TEMPLATES.find((item) => item.ar === key || item.en === key);
    const existing = data.permissionTemplates.find((item) =>
      (builtIn && item.id === builtIn.id) || item.ar === key || item.en === key
    );
    if (existing) {
      existing.permissions = permissions;
      existing.ar = key;
      existing.en = existing.en || key;
      id = existing.id;
      return;
    }
    if (builtIn) {
      id = builtIn.id;
      data.permissionTemplates.push({ id, ar: builtIn.ar, en: builtIn.en, permissions, positions: [] });
      return;
    }
    id = `tpl_${Math.random().toString(36).slice(2, 9)}`;
    data.permissionTemplates.push({ id, ar: key, en: key, permissions, positions: [] });
  });
  return id;
}

export function listPositions(pack) {
  return Array.isArray(pack?.positions) ? pack.positions.filter((item) => String(item?.title || "").trim()) : [];
}

function findOrCreatePackRecord(data, pack) {
  data.permissionTemplates = data.permissionTemplates || [];
  let existing = data.permissionTemplates.find((item) => item.id === pack.id)
    || data.permissionTemplates.find((item) => item.ar === pack.ar || item.en === pack.en);
  if (!existing) {
    existing = {
      id: pack.id,
      ar: pack.ar,
      en: pack.en || pack.ar,
      permissions: { ...(pack.permissions || {}) },
      positions: listPositions(pack).map((item) => ({ ...item })),
    };
    data.permissionTemplates.push(existing);
  }
  return existing;
}

export function upsertListPack(companyId, pack, patch = {}) {
  if (!companyId || !pack?.id) return;
  updateCompany(companyId, (data) => {
    const existing = findOrCreatePackRecord(data, pack);
    existing.ar = pack.ar || existing.ar;
    existing.en = pack.en || existing.en;
    if (patch.permissions) existing.permissions = patch.permissions;
    if (patch.positions) existing.positions = patch.positions;
  });
}

export function saveListPermissions(companyId, pack, permissions) {
  upsertListPack(companyId, pack, { permissions });
}

export function addListPosition(companyId, pack, title) {
  const name = String(title || "").trim();
  if (!companyId || !pack?.id || !name) return { ok: false, error: "FIELDS" };
  let error = "";
  updateCompany(companyId, (data) => {
    const existing = findOrCreatePackRecord(data, pack);
    const positions = listPositions(existing);
    if (positions.some((item) => item.title === name)) {
      error = "DUP";
      return;
    }
    existing.positions = [...positions, { id: `pos_${Math.random().toString(36).slice(2, 9)}`, title: name }];
    existing.removedPositions = (existing.removedPositions || []).filter((item) => item !== name);
  });
  return error ? { ok: false, error } : { ok: true };
}

export function removeListPosition(companyId, pack, positionId) {
  if (!companyId || !pack?.id || !positionId) return { ok: false };
  let removed = "";
  updateCompany(companyId, (data) => {
    const existing = findOrCreatePackRecord(data, pack);
    const positions = listPositions(existing);
    const hit = positions.find((item) => item.id === positionId)
      || positions.find((item) => item.title === positionId);
    removed = hit?.title || String(positionId || "").trim();
    existing.positions = positions.filter((item) => item.id !== positionId && item.title !== removed);
    if (removed) {
      existing.removedPositions = [...new Set([...(existing.removedPositions || []), removed])];
    }
  });
  return removed ? { ok: true, title: removed } : { ok: false };
}

export function deleteCompanyTemplate(companyId, templateId) {
  updateCompany(companyId, (data) => {
    data.permissionTemplates = (data.permissionTemplates || []).filter((item) => item.id !== templateId);
    data.jobGrades = (data.jobGrades || []).filter((grade) => grade.listId !== templateId);
  });
}
