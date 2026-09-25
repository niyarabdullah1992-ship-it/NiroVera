/**
 * Person-drawer mutations: vacate a seat, open vacant seats under it,
 * set the actual workplace, and cycle the seat's admin grants.
 * Pure on a company data object so the drawer and tests share one path.
 */

import { gradeRank, gradesForTitle } from "./jobGradeTitles.js";
import { appendOrgStructureEvent } from "./orgStructureLog.js";
import { companyRootStation, isManagerUnit, isTreeManagerTitle } from "./stationTree.js";

export const HTML_JOB_TITLES = [
  "سائق",
  "مشغّل رافعة",
  "فني تبريد وتكييف",
  "فني كهرباء",
  "محاسب",
  "مساعد مستودع",
  "حارس أمن",
  "عامل ميداني",
  "مهندس موقع",
  "أخصائي سلامة",
  "أخصائي موارد بشرية",
];

export const SEAT_ACCESS_ROWS = [
  { id: "hr", department: "hr", ar: "الهيكل التنظيمي", en: "Org structure", hintAr: "إنشاء الفروع والمناصب والتعيين والتكليف", hintEn: "Branches, seats, hire, and acting" },
  { id: "employees", department: "employees", ar: "ملف الموظف", en: "Employee file", hintAr: "عرض البيانات والوثائق وتعديل المعلومات الشخصية", hintEn: "File, documents, and personal data" },
  { id: "requests", department: "attendance", ar: "طلباتي", en: "My requests", hintAr: "اعتماد طلبات الإجازة والسلف والنقل", hintEn: "Leave, advance, and transfer requests" },
  { id: "attendance", department: "attendance", ar: "الحضور", en: "Attendance", hintAr: "تعديل البصمات ومعالجة الغياب", hintEn: "Stamps and absence" },
  { id: "schedule", department: "attendance", ar: "جدول الدوام والتقويم", en: "Roster and calendar", hintAr: "بناء الورديات واعتماد الجدول والاستثناءات", hintEn: "Shifts, roster, and exceptions" },
  { id: "complaints", department: "complaints", ar: "صوت الموظف", en: "Employee voice", hintAr: "استلام الشكاوى والردّ عليها", hintEn: "Receive and answer complaints", ownerOnly: true },
  { id: "discipline", department: "hr", ar: "الجزاءات", en: "Sanctions", hintAr: "إيقاع الجزاء والاعتراض عليه", hintEn: "Issue a sanction and hear the objection" },
];

const SEAT_DRAWER_REASONS = {
  NO_SEAT: { ar: "لا مقعد حيّ لهذا الشاغل.", en: "This person has no live seat." },
  ALREADY_VACANT: { ar: "الوظيفة شاغرة أصلاً.", en: "This seat is already vacant." },
  COMPANY_HEAD: {
    ar: "مقعد رأس المنشأة لا يُخلى من هنا — غيّر الشاغل من تبويب التغيير النهائي.",
    en: "The company-head seat is not vacated here — change the holder from the permanent-change tab.",
  },
  ACTING: {
    ar: "تكليف سارٍ على هذه الوظيفة. أنهِ التكليف قبل إخلاء المقعد.",
    en: "An acting assignment is open on this seat. End it before vacating.",
  },
  TITLE: { ar: "اكتب مسمّى المنصب", en: "Enter a position title" },
  GRADE_ORDER: { ar: "درجة المنصب يجب أن تكون أقل من درجة المدير.", en: "The new grade must be below the manager's grade." },
  NO_GRADE: { ar: "هذا المسمّى بلا درجات. أضف درجة على سلّمه أولاً.", en: "This title has no grades. Add one on its ladder first." },
  GRADE_TITLE: { ar: "الدرجة ليست على سلّم هذا المسمّى.", en: "That grade is not on this title's ladder." },
  ADMIN_NO_HIRE: { ar: "هذه وحدة إدارية لا يُنشأ تحتها منصب.", en: "A manager unit cannot hold a new seat." },
  MANAGER_TAKEN: { ar: "مدير الفرع موجود. المسمّى الجديد لا يكون مدير فرع.", en: "This branch already has a manager title." },
  NO_LIST: { ar: "لا قائمة صلاحيات لربط المنصب.", en: "No permission list to attach the seat to." },
  GRADE_LIST: { ar: "الدرجة ليست على قائمة هذا المقعد.", en: "That grade is not on this seat's list." },
  OWNER_ONLY: { ar: "صوت الموظف يمنحه مالك الشركة فقط.", en: "Only the company owner grants employee voice." },
  MISSING: { ar: "الموظف أو الفرع غير موجود.", en: "Employee or branch was not found." },
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function todayKey() {
  const day = new Date();
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function drawerFail(error) {
  const row = SEAT_DRAWER_REASONS[error] || {};
  return { ok: false, error, reason: row.ar || "", reasonEn: row.en || "" };
}

export function seatDrawerReason(code, ar = true) {
  const row = SEAT_DRAWER_REASONS[code];
  if (!row) return "";
  return ar ? row.ar : row.en;
}

function seatForEmployee(data, employeeId) {
  if (!employeeId) return null;
  return (data?.orgSeats || []).find((seat) => String(seat.employeeId) === String(employeeId)) || null;
}

function orderedGrades(data) {
  return [...(data?.jobGrades || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function salaryRange(grade) {
  const min = Number(grade?.minSalary);
  const max = Number(grade?.maxSalary);
  return {
    min: Number.isFinite(min) && min > 0 ? min : null,
    max: Number.isFinite(max) && max > 0 ? max : null,
  };
}

function scoreOf(permissions = {}) {
  return Object.values(permissions).reduce((sum, access) => sum + (access === "manage" ? 2 : access === "view" ? 1 : 0), 0);
}

function rankOf(score) {
  return score >= 13 ? "executive" : score >= 8 ? "manager" : score >= 4 ? "supervisor" : "employee";
}

function activeActing(employee) {
  const today = todayKey();
  return (employee?.actingAssignments || []).filter((item) => {
    if (item?.endedAt) return false;
    const until = String(item.until || "").slice(0, 10);
    return !until || until >= today;
  });
}

export function jobTitleCatalog(data) {
  const seen = new Set();
  const titles = [];
  (data?.permissionTemplates || []).forEach((pack) => {
    (Array.isArray(pack?.positions) ? pack.positions : []).forEach((row) => {
      const name = String(row?.title || "").trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      titles.push(name);
    });
  });
  return titles.length ? titles : HTML_JOB_TITLES.slice();
}

export function drawerGrades(data, employee, title = "") {
  const seat = seatForEmployee(data, employee?.id);
  const name = String(title || seat?.title || employee?.profile?.position || employee?.jobTitle || "").trim();
  return gradesForTitle(data, name);
}

function accessWord(value) {
  if (value === "manage" || value === "view" || value === "hidden") return value;
  if (value === "none") return "hidden";
  return "";
}

export function seatAccessOf(data, employeeOrId) {
  const id = typeof employeeOrId === "string" ? employeeOrId : employeeOrId?.id;
  const seat = seatForEmployee(data, id);
  const stored = seat?.permissions && typeof seat.permissions === "object" ? seat.permissions : null;
  const hasStored = stored && Object.keys(stored).length > 0;
  const smart = (data?.smartPositions || []).find((item) => String(item.employeeId) === String(id))?.permissions || {};
  const pack = (data?.permissionTemplates || []).find((item) => String(item.id) === String(seat?.listId || ""))?.permissions || {};
  const out = {};
  SEAT_ACCESS_ROWS.forEach((row) => {
    const direct = hasStored ? accessWord(stored[row.id]) : "";
    if (direct) {
      out[row.id] = direct;
      return;
    }
    const inherited = accessWord(smart[row.id])
      || accessWord(pack[row.id])
      || accessWord(smart[row.department])
      || accessWord(pack[row.department]);
    out[row.id] = inherited || "view";
  });
  return out;
}

function mirrorSeatAccess(access) {
  const rank = { hidden: 0, view: 1, manage: 2 };
  const pick = (...values) => values.reduce((best, value) => ((rank[value] || 0) > (rank[best] || 0) ? value : best), "hidden");
  return {
    hr: access.hr || "view",
    employees: access.employees || "view",
    attendance: pick(access.attendance, access.requests, access.schedule),
    complaints: access.complaints || "view",
    discipline: access.discipline || "view",
  };
}

function writeHolderAccess(data, employee, access) {
  if (!employee?.id) return;
  const permissions = mirrorSeatAccess(access);
  const score = scoreOf(permissions);
  data.smartPositions = data.smartPositions || [];
  const index = data.smartPositions.findIndex((item) => String(item.employeeId) === String(employee.id));
  const previous = index >= 0 ? data.smartPositions[index] : null;
  const record = {
    employeeId: employee.id,
    title: previous?.title || employee.profile?.position || employee.position || "",
    titleManual: previous?.titleManual ?? true,
    permissions,
    score,
    rank: rankOf(score),
    manualOrder: previous?.manualOrder,
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) data.smartPositions[index] = record;
  else data.smartPositions.push(record);
}

function rememberCatalogTitle(data, listId, title) {
  const name = String(title || "").trim();
  const pack = (data?.permissionTemplates || []).find((item) => String(item.id) === String(listId || ""));
  if (!pack || !name) return;
  const positions = Array.isArray(pack.positions) ? pack.positions : [];
  if (positions.some((item) => item.title === name)) return;
  pack.positions = [...positions, { id: uid("pos"), title: name }];
}

export function cycleSeatAccessOn(data, employeeId, rowId, { owner = false } = {}) {
  const row = SEAT_ACCESS_ROWS.find((item) => item.id === rowId);
  if (!data || !row) return drawerFail("MISSING");
  if (row.ownerOnly && !owner) return drawerFail("OWNER_ONLY");
  const employee = (data.employees || []).find((item) => String(item.id) === String(employeeId));
  const seat = seatForEmployee(data, employeeId);
  if (!employee || !seat) return drawerFail("NO_SEAT");
  const current = seatAccessOf(data, employeeId);
  const now = current[row.id] || "view";
  const next = now === "view" ? "manage" : now === "manage" ? "hidden" : "view";
  const permissions = { ...current, [row.id]: next };
  seat.permissions = permissions;
  writeHolderAccess(data, employee, permissions);
  (data.employees || []).forEach((person) => {
    if (String(person.id) === String(employee.id)) return;
    const covers = activeActing(person).some((item) => String(item.seatId || "") === String(seat.id));
    if (covers) writeHolderAccess(data, person, permissions);
  });
  const label = next === "manage" ? "إدارة" : next === "hidden" ? "بلا وصول" : "عرض";
  appendOrgStructureEvent(data, {
    type: "change",
    stationId: seat.stationId,
    employeeId: employee.id,
    employeeName: employee.name,
    to: `${row.ar}: ${label}`,
  });
  return { ok: true, value: next };
}

export function endSeatTenureOn(data, employeeId) {
  if (!data) return drawerFail("MISSING");
  const employee = (data.employees || []).find((item) => String(item.id) === String(employeeId));
  const seat = seatForEmployee(data, employeeId);
  if (!employee) return drawerFail("NO_SEAT");
  if (!seat?.id) {
    return drawerFail(employee.profile?.unseatedAt || employee.profile?.chartReleased ? "ALREADY_VACANT" : "NO_SEAT");
  }
  if (!seat.employeeId) return drawerFail("ALREADY_VACANT");
  const root = companyRootStation(data.stations || []);
  if (root && String(root.managerId || "") === String(employee.id)) return drawerFail("COMPANY_HEAD");
  const actingOpen = (data.employees || []).some((person) => activeActing(person).some((item) => {
    if (item.seatId) return String(item.seatId) === String(seat.id);
    return String(item.stationId || "") === String(seat.stationId) && isTreeManagerTitle(seat.title);
  }));
  if (actingOpen) return drawerFail("ACTING");
  const parentId = String(seat.reportsToEmployeeId || "").trim();
  const parent = parentId
    ? (data.employees || []).find((item) => String(item.id) === parentId)
    : null;
  (data.orgSeats || []).forEach((item) => {
    if (String(item.employeeId) !== String(employee.id)) return;
    item.employeeId = null;
    item.filledAt = null;
    item.vacatedAt = new Date().toISOString();
    item.hireOpen = true;
  });
  (data.stations || []).forEach((station) => {
    if (String(station.managerId || "") === String(employee.id) && !station.isCompanyRoot) station.managerId = null;
  });
  (data.orgSeats || []).forEach((item) => {
    if (String(item.reportsToEmployeeId || "") !== String(employee.id)) return;
    item.reportsToEmployeeId = parent?.id || null;
    item.reportsToName = parent?.name || "";
  });
  (data.employees || []).forEach((person) => {
    if (String(person.id) === String(employee.id)) return;
    if (String(person.profile?.directManagerId || "") !== String(employee.id)) return;
    person.profile = { ...(person.profile || {}), directManagerId: parent?.id || null };
  });
  const stillSeated = (data.orgSeats || []).some((item) => String(item.employeeId || "") === String(employee.id));
  if (!stillSeated) {
    employee.profile = {
      ...(employee.profile || {}),
      unseatedAt: new Date().toISOString(),
      chartReleased: true,
    };
  }
  appendOrgStructureEvent(data, {
    type: "end",
    stationId: seat.stationId,
    employeeId: employee.id,
    employeeName: employee.name,
    to: seat.title || "",
  });
  return { ok: true, seatId: seat.id };
}

export function createVacantSeatsUnderManagerOn(data, input = {}) {
  if (!data) return drawerFail("MISSING");
  const manager = (data.employees || []).find((item) => String(item.id) === String(input.managerId || ""));
  const title = String(input.title || "").trim();
  if (!manager) return drawerFail("MISSING");
  if (!title) return drawerFail("TITLE");
  const seat = seatForEmployee(data, manager.id);
  if (!seat?.id) return drawerFail("NO_SEAT");
  const station = (data.stations || []).find((item) => String(item.id) === String(seat.stationId || manager.stationId)) || null;
  if (!station) return drawerFail("MISSING");
  if (isManagerUnit(station)) return drawerFail("ADMIN_NO_HIRE");
  if (station.managerId && isTreeManagerTitle(title)) return drawerFail("MANAGER_TAKEN");
  const qty = Math.max(1, Math.min(20, Number(input.qty) || 1));
  const grades = gradesForTitle(data, title);
  if (!grades.length) return drawerFail("NO_GRADE");
  const gradeId = String(input.gradeId || "").trim();
  const grade = grades.find((item) => String(item.id) === gradeId);
  if (!grade) return drawerFail("GRADE_TITLE");
  const managerGradeId = String(seat.gradeId || manager.profile?.gradeId || "");
  const managerGrade = orderedGrades(data).find((item) => String(item.id) === managerGradeId);
  const managerRank = gradeRank(managerGrade);
  const nextRank = gradeRank(grade);
  if (managerRank != null && nextRank != null && nextRank >= managerRank) return drawerFail("GRADE_ORDER");
  const listId = String(grade.listId || seat.listId || "").trim()
    || String((data.permissionTemplates || []).find((item) => item?.id)?.id || "");
  if (!listId) return drawerFail("NO_LIST");
  const range = salaryRange(grade);
  const pack = (data.permissionTemplates || []).find((item) => String(item.id) === listId);
  data.orgSeats = data.orgSeats || [];
  const seatIds = [];
  for (let index = 0; index < qty; index += 1) {
    const id = uid("seat");
    seatIds.push(id);
    data.orgSeats.push({
      id,
      title,
      stationId: station.id,
      listId,
      list: pack?.ar || seat.list || "",
      gradeId: grade.id,
      employeeId: null,
      hireOpen: true,
      reportsToEmployeeId: manager.id,
      reportsToSeatId: seat.id,
      reportsToName: manager.name || "",
      approverId: manager.id,
      salaryMin: range.min,
      salaryMax: range.max,
      createdAt: new Date().toISOString(),
    });
  }
  rememberCatalogTitle(data, listId, title);
  appendOrgStructureEvent(data, {
    type: "seat",
    stationId: station.id,
    employeeId: manager.id,
    employeeName: manager.name,
    to: qty > 1 ? `${qty} × ${title}` : title,
  });
  return { ok: true, seatIds, count: qty };
}

export function setActualWorkSiteOn(data, employeeId, stationId) {
  if (!data) return drawerFail("MISSING");
  const employee = (data.employees || []).find((item) => String(item.id) === String(employeeId));
  if (!employee) return drawerFail("MISSING");
  const seat = seatForEmployee(data, employee.id);
  const home = String(seat?.stationId || employee.stationId || "").trim();
  const next = String(stationId || "").trim();
  if (next && !(data.stations || []).some((station) => String(station.id) === next)) return drawerFail("MISSING");
  if (next && isManagerUnit((data.stations || []).find((station) => String(station.id) === next))) {
    return drawerFail("ADMIN_NO_HIRE");
  }
  employee.profile = { ...(employee.profile || {}) };
  const previous = String(employee.profile.workStationId || home || "");
  if (!next || next === home) delete employee.profile.workStationId;
  else employee.profile.workStationId = next;
  const landed = String(employee.profile.workStationId || home || "");
  if (previous !== landed) {
    appendOrgStructureEvent(data, {
      type: "transfer",
      employeeId: employee.id,
      employeeName: employee.name,
      fromStationId: previous,
      toStationId: landed,
    });
  }
  return { ok: true, stationId: landed };
}
