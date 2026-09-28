import { logAudit } from "@/lib/auditLog";
import { readSubscriberNumber, readWageFields } from "@/lib/facts";
import {
  BUILT_IN_TEMPLATES,
  deleteCompanyTemplate,
  saveCompanyTemplate,
  samePermissions,
  templateLabel,
} from "@/lib/permissionTemplates";
import { employeeJobGrade, jobGradeLabel } from "@/lib/jobGrades";
import { rankLabel, SMART_DEPARTMENTS } from "@/lib/smartPositions";

const HEADERS = [
  "نوع السجل",
  "الاسم",
  "البريد",
  "الجوال",
  "الهوية",
  "الفرع",
  "الوحدة",
  "القائمة",
  "الدرجة",
  "المنصب",
  "يتبع",
  "حزمة الصلاحيات",
  "القسم",
  "المستوى",
  "النطاق",
  "الفروع المشمولة",
  "الشرط",
  "حتى تاريخ",
  "تاريخ البداية",
  "الآيبان",
  "الراتب الأساسي",
  "البدلات",
  "العملة",
  "التأمينات",
  "رقم العقد",
  "ملاحظة",
];

const HEADER_KEY = {
  "نوع السجل": "kind",
  record_type: "kind",
  kind: "kind",
  "حزمة الصلاحيات": "pack",
  permission_pack: "pack",
  pack: "pack",
  القسم: "section",
  section: "section",
  المستوى: "level",
  level: "level",
  الاسم: "name",
  name: "name",
  البريد: "email",
  email: "email",
  الفرع: "branch",
  branch: "branch",
  الوحدة: "unit",
  unit: "unit",
  القائمة: "list",
  list: "list",
  الدرجة: "grade",
  grade: "grade",
  المنصب: "title",
  title: "title",
  يتبع: "manager",
  manager: "manager",
  "حزمة الصلاحيات": "pack",
  permission_pack: "pack",
  pack: "pack",
  القسم: "section",
  section: "section",
  المستوى: "level",
  level: "level",
  النطاق: "scope",
  scope: "scope",
  "الفروع المشمولة": "covers",
  covers: "covers",
  الشرط: "condition",
  condition: "condition",
  "حتى تاريخ": "until",
  until: "until",
  "تاريخ البداية": "start",
  start: "start",
  الآيبان: "iban",
  iban: "iban",
  "الراتب الأساسي": "salary",
  salary: "salary",
  البدلات: "allowances",
  allowances: "allowances",
  العملة: "currency",
  currency: "currency",
  التأمينات: "gosi",
  gosi: "gosi",
  "رقم العقد": "contract",
  contract: "contract",
  الجوال: "phone",
  phone: "phone",
  الهوية: "nationalId",
  nationalid: "nationalId",
  ملاحظة: "note",
  note: "note",
};

const KIND = {
  employee: "موظف",
  grant: "صلاحية",
  condition: "شرط",
  exception: "استثناء",
};

const LEVEL_AR = { view: "قراءة", manage: "اعتماد", hidden: "لا يرى" };
const LEVEL_FROM = {
  قراءة: "view",
  view: "view",
  إدخال: "view",
  own: "view",
  اعتماد: "manage",
  manage: "manage",
  "لا يرى": "hidden",
  hidden: "hidden",
  "—": "hidden",
  "": "hidden",
};

const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const norm = (value) => String(value || "")
  .toLowerCase()
  .replace(/[أإآ]/g, "ا")
  .replace(/ة/g, "ه")
  .replace(/\s+/g, " ")
  .trim();

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}

function isOwnerPackName(name) {
  const key = norm(name);
  return key === "المالك" || key === "owner" || key === "حزمة المالك";
}

export function listedPacks(data) {
  const map = new Map();
  BUILT_IN_TEMPLATES.forEach((pack) => map.set(norm(pack.ar), pack));
  (data?.permissionTemplates || []).forEach((pack) => map.set(norm(pack.ar), pack));
  return [...map.values()];
}

function departmentByLabel(label) {
  const key = norm(label);
  if (key === "الكل" || key === "all") return { id: "*", ar: "الكل", en: "All" };
  return SMART_DEPARTMENTS.find((item) => norm(item.ar) === key || norm(item.en) === key) || null;
}

function levelAr(access) {
  return LEVEL_AR[access] || LEVEL_AR.hidden;
}

function packForEmployee(employee, data) {
  const position = (data?.smartPositions || []).find((item) => item.employeeId === employee.id);
  if (position?.templateId) {
    const byId = listedPacks(data).find((pack) => pack.id === position.templateId);
    if (byId) return byId;
  }
  if (position?.permissions) {
    const match = listedPacks(data).find((pack) => samePermissions(pack.permissions, position.permissions));
    if (match) return match;
  }
  return null;
}

function stationName(employee, data) {
  const id = employee?.stationId || employee?.profile?.stationId;
  return (data?.stations || []).find((station) => station.id === id)?.name || "";
}

function workforce(data) {
  return (data?.employees || []).filter((employee) => employee.id !== data?.ownerId && employee.role !== "owner");
}

export function employeesOnPack(data, pack) {
  if (!pack) return [];
  return workforce(data).filter((employee) => packForEmployee(employee, data)?.id === pack.id);
}

function ownerEmployee(data) {
  return (data?.employees || []).find((employee) => employee.id === data?.ownerId || employee.role === "owner") || null;
}

function describeChange(previous = {}, next = {}, ar) {
  const bits = [];
  SMART_DEPARTMENTS.forEach((department) => {
    const from = previous[department.id] || "hidden";
    const to = next[department.id] || "hidden";
    if (from === to) return;
    const label = ar ? department.ar : department.en;
    if (from === "hidden") {
      bits.push(ar ? `أُضيف قسم ${label} بمستوى ${levelAr(to)}` : `Added ${label} at ${levelAr(to)}`);
    } else if (to === "hidden") {
      bits.push(ar ? `أُزيل قسم ${label}` : `Removed ${label}`);
    } else {
      bits.push(ar
        ? `حُدّث ${label} من ${levelAr(from)} إلى ${levelAr(to)}`
        : `Changed ${label} from ${levelAr(from)} to ${levelAr(to)}`);
    }
  });
  return bits.join(ar ? "؛ " : "; ");
}

function newPackPhrase(names, ar) {
  const list = names.join(ar ? "، " : ", ");
  const n = names.length;
  if (!n) return "";
  if (!ar) return n === 1 ? `1 new pack: ${list}` : `${n} new packs: ${list}`;
  if (n === 1) return `حزمة جديدة: ${list}`;
  if (n === 2) return `حزمتان جديدتان: ${list}`;
  if (n <= 10) return `${n} حزم جديدة: ${list}`;
  return `${n} حزمة جديدة: ${list}`;
}

function rowCells(record = {}) {
  return HEADERS.map((header) => record[HEADER_KEY[header]] || "");
}

function managerName(employee, data) {
  const nodes = data?.orgTree || [];
  const node = nodes.find((item) => item.type === "employee" && item.refId === employee.id);
  const parent = nodes.find((item) => item.id === node?.parentId);
  if (!parent || parent.type !== "employee") return "";
  return (data?.employees || []).find((item) => item.id === parent.refId)?.name || parent.title || "";
}

function listName(employee, data) {
  const position = (data?.smartPositions || []).find((item) => item.employeeId === employee.id);
  return employee.profile?.department
    || employee.profile?.unit
    || rankLabel(position?.rank || "employee", true)
    || "عام";
}

export function downloadPermissionPackTemplate(data, ar = true) {
  const packs = listedPacks(data);
  const rows = [];

  workforce(data).forEach((employee) => {
    const pack = packForEmployee(employee, data);
    const profile = employee.profile || {};
    const grade = employeeJobGrade(employee, data);
    rows.push(rowCells({
      kind: KIND.employee,
      name: employee.name || "",
      email: employee.email || "",
      phone: employee.phone || profile.phone || "",
      nationalId: profile.nationalId || profile.iqama || "",
      branch: stationName(employee, data),
      unit: profile.department || profile.unit || "",
      list: listName(employee, data),
      grade: jobGradeLabel(grade),
      title: profile.position || employee.position || "",
      manager: managerName(employee, data),
      pack: pack ? templateLabel(pack, true) : "",
      start: profile.startDate || profile.hiredAt || "",
      iban: profile.iban || "",
      salary: readWageFields(employee).baseSalary ?? "",
      allowances: readWageFields(employee).allowances ?? "",
      currency: profile.currency || "SAR",
      gosi: readSubscriberNumber(employee),
      contract: profile.contractNumber || "",
    }));
  });

  packs.forEach((pack) => {
    const grants = SMART_DEPARTMENTS.filter((department) => pack.permissions?.[department.id] && pack.permissions[department.id] !== "hidden");
    if (!grants.length) {
      rows.push(rowCells({ kind: KIND.grant, pack: templateLabel(pack, true), note: ar ? "حزمة بلا أقسام ظاهرة" : "Pack with no visible sections" }));
      return;
    }
    grants.forEach((department) => {
      rows.push(rowCells({
        kind: KIND.grant,
        pack: templateLabel(pack, true),
        section: department.ar,
        level: levelAr(pack.permissions[department.id]),
        note: pack.id && BUILT_IN_TEMPLATES.some((item) => item.id === pack.id) ? (ar ? "حزمة منصة" : "Built-in pack") : "",
      }));
    });
  });

  let conditionCount = 0;
  workforce(data).forEach((employee) => {
    (employee.certificates || []).forEach((certificate) => {
      const title = certificate.name || certificate.title || "";
      if (!title) return;
      conditionCount += 1;
      const pack = packForEmployee(employee, data);
      rows.push(rowCells({
        kind: KIND.condition,
        pack: pack ? templateLabel(pack, true) : "",
        name: employee.name || "",
        email: employee.email || "",
        branch: stationName(employee, data),
        title: employee.profile?.position || employee.position || "",
        condition: title,
        until: certificate.expiry || certificate.expiresAt || "",
        note: ar ? "شهادة قائمة في ملف الموظف" : "Certificate on the employee file",
      }));
    });
  });
  if (!conditionCount) {
    rows.push(rowCells({
      kind: KIND.condition,
      pack: packs[0] ? templateLabel(packs[0], true) : "",
      note: ar ? "أضف شرطًا هنا — مثل شهادة مطلوبة للمقعد" : "Add a condition here — e.g. a required certificate",
    }));
  }

  const owner = ownerEmployee(data);
  rows.push(rowCells({
    kind: KIND.exception,
    pack: "المالك",
    section: "الكل",
    level: "اعتماد",
    name: owner?.name || "",
    email: owner?.email || "",
    title: owner?.profile?.position || owner?.position || "",
    note: ar ? "محجوز — لا يُعدَّل من القالب" : "Reserved — not changed from the template",
  }));
  workforce(data).forEach((employee) => {
    const position = (data?.smartPositions || []).find((item) => item.employeeId === employee.id);
    const pack = packForEmployee(employee, data);
    if (!position?.permissions || !pack) return;
    if (samePermissions(position.permissions, pack.permissions)) return;
    rows.push(rowCells({
      kind: KIND.exception,
      pack: templateLabel(pack, true),
      name: employee.name || "",
      email: employee.email || "",
      branch: stationName(employee, data),
      title: position.title || employee.profile?.position || "",
      note: ar ? "صلاحية الصف تختلف عن حزمة المنصب" : "Row access differs from the seat pack",
    }));
  });

  const csv = `\uFEFF${[HEADERS, ...rows].map((row) => row.map(esc).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = ar ? "قالب-نيروفيرا-الشامل.csv" : "nirovera-org-template.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function parsePermissionPackFile(file) {
  const text = (await file.text()).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const keys = parseCsvLine(lines[0]).map((header) => HEADER_KEY[header.trim().toLowerCase()] || HEADER_KEY[header.trim()] || "");
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    keys.forEach((key, index) => {
      if (key) row[key] = cells[index] || "";
    });
    return row;
  }).filter((row) => Object.values(row).some(Boolean));
}

function packsFromRows(rows) {
  const names = new Map();
  rows.forEach((row) => {
    const pack = String(row.pack || "").trim();
    if (!pack) return;
    const kind = String(row.kind || "").trim();
    if (kind && kind !== KIND.grant && norm(kind) !== "grant") {
      if (!names.has(norm(pack))) names.set(norm(pack), { name: pack, permissions: {} });
      return;
    }
    const current = names.get(norm(pack)) || { name: pack, permissions: {} };
    const department = departmentByLabel(row.section);
    const access = LEVEL_FROM[String(row.level || "").trim()] || LEVEL_FROM[norm(row.level)] || "hidden";
    if (department?.id === "*") {
      SMART_DEPARTMENTS.forEach((item) => {
        current.permissions[item.id] = access === "hidden" ? "manage" : access;
      });
    } else if (department && access !== "hidden") {
      current.permissions[department.id] = access;
    }
    names.set(norm(pack), current);
  });
  return [...names.values()];
}

export function previewPermissionPackFile(rows, data, ar = true) {
  const incoming = packsFromRows(rows);
  const existing = listedPacks(data);
  const created = [];
  const matched = [];
  const updated = [];
  const ownerBlocked = [];

  incoming.forEach((pack) => {
    if (isOwnerPackName(pack.name)) {
      const current = existing.find((item) => isOwnerPackName(item.ar) || isOwnerPackName(item.en));
      if (current && !samePermissions(current.permissions, pack.permissions)) {
        ownerBlocked.push({ name: pack.name, reason: ar ? "المالك محجوز — لا تُعدّل حزمته من القالب." : "The owner pack is reserved and is not changed from the template." });
      }
      return;
    }
    const current = existing.find((item) => norm(item.ar) === norm(pack.name) || norm(item.en) === norm(pack.name));
    if (!current) {
      created.push(pack);
      return;
    }
    if (samePermissions(current.permissions, pack.permissions)) {
      matched.push({ name: pack.name, id: current.id });
      return;
    }
    updated.push({
      name: pack.name,
      id: current.id,
      builtIn: BUILT_IN_TEMPLATES.some((item) => item.id === current.id),
      permissions: pack.permissions,
      detail: describeChange(current.permissions, pack.permissions, ar) || (ar ? "تغيير في الأقسام" : "Section change"),
    });
  });

  const mentioned = new Set(incoming.map((pack) => norm(pack.name)));
  const deleteSuggestions = (data?.permissionTemplates || [])
    .filter((pack) => !mentioned.has(norm(pack.ar)) && !mentioned.has(norm(pack.en)) && !isOwnerPackName(pack.ar))
    .map((pack) => {
      const holders = employeesOnPack(data, pack);
      return {
        id: pack.id,
        name: templateLabel(pack, true),
        inUse: holders.length > 0,
        holders,
      };
    });

  const kinds = { employee: 0, grant: 0, condition: 0, exception: 0 };
  rows.forEach((row) => {
    const kind = String(row.kind || "").trim();
    if (kind === KIND.employee) kinds.employee += 1;
    else if (kind === KIND.grant) kinds.grant += 1;
    else if (kind === KIND.condition) kinds.condition += 1;
    else if (kind === KIND.exception) kinds.exception += 1;
  });

  return {
    created,
    matched,
    updated,
    deleteSuggestions,
    ownerBlocked,
    kinds,
    newPackLine: newPackPhrase(created.map((pack) => pack.name), ar),
    people: rows
      .filter((row) => String(row.kind || "").trim() === KIND.employee)
      .map((row) => ({
        name: row.name || "",
        branch: row.branch || "",
        unit: row.unit || "",
        list: row.list || "",
        grade: row.grade || "",
        job: row.title || "",
        manager: row.manager || "",
        pack: row.pack || "",
        covers: row.covers || "",
        scope: row.scope || "",
      })),
    incomingPacks: incoming,
  };
}

export function applyPermissionPackPreview(companyId, preview, actor, selectedDeletes = []) {
  if (!companyId || !preview) return { ok: false };
  const allowedDeletes = new Set(
    (preview.deleteSuggestions || [])
      .filter((item) => selectedDeletes.includes(item.id) && !item.inUse)
      .map((item) => item.id),
  );

  preview.created.forEach((pack) => {
    saveCompanyTemplate(companyId, pack.name, pack.permissions);
  });
  preview.updated.forEach((pack) => {
    saveCompanyTemplate(companyId, pack.name, pack.permissions);
  });
  allowedDeletes.forEach((id) => deleteCompanyTemplate(companyId, id));

  const createdNames = preview.created.map((pack) => pack.name);
  const updatedNames = preview.updated.map((pack) => pack.name);
  const details = [
    createdNames.length ? `new:${createdNames.join(",")}` : "",
    updatedNames.length ? `update:${updatedNames.join(",")}` : "",
    allowedDeletes.size ? `delete:${allowedDeletes.size}` : "",
  ].filter(Boolean).join(" · ");
  logAudit(companyId, "permission_pack_template", actor || "unknown", details.slice(0, 1000));
  return { ok: true };
}
