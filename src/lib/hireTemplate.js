import { getCompanyData, updateCompany } from "@/lib/store";
import {
  CONTRACT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  ID_TYPE_OPTIONS,
  MARITAL_OPTIONS,
  PROFILE_GROUPS,
  canonicalFieldValue,
  displayProfileField,
  profileFieldValue,
  profileCompletionStats,
} from "@/lib/employeeProfileFields";
import { employeeJobGrade, ensureListGrade, findListGrade, gradesForList, jobGradeLabel } from "@/lib/jobGrades";
import { attachReportsTo, createOrgBranch, findEmployeeByName, hireFromSeat, placeExistingEmployee, setOrgBranchParent, todayKey, vacantSeats } from "@/lib/orgHire";
import { applyExtraCoverageStrip, isManagerUnit, stationParentId, stripDescendantCoverage } from "@/lib/stationTree";
import { addListPosition, companyLists, companyTemplates, createCompanyList, listPositions, templateById, templateLabel } from "@/lib/permissionTemplates";
import { downloadXlsx, excelSerialToIso, isZipBuffer, listValidation, namedRange, parseXlsxFirstSheet } from "@/lib/simpleXlsx";

const PLACEMENT_HEADERS = ["الاسم", "البريد", "الهوية", "الجوال", "تاريخ التعيين", "القائمة", "المنصب", "الدرجة", "الفرع", "يتبع فرع", "يتبع", "فروع إضافية"];
const PROFILE_SKIP = new Set([
  "nationalId",
  "hireDate",
  "position",
  "department",
  "expectedBirthDate",
  "pregnant",
  "nightFitnessStatus",
  "nightMedicalShareConsent",
  "nightPregnancyBanUntil",
  "nightTransferImpossible",
  "nightPayPreserved",
  "familyResponsibilities",
]);
const PROFILE_FIELDS = PROFILE_GROUPS.flatMap((group) => group.fields).filter((field) => !PROFILE_SKIP.has(field.key));
const PAY_FIELDS = [
  { key: "baseSalary", ar: "الراتب الأساسي", en: "Base salary" },
  { key: "allowances", ar: "البدلات", en: "Allowances" },
];
const ALL_PROFILE_FIELDS = [...PROFILE_FIELDS, ...PAY_FIELDS];
const HEADERS = [...PLACEMENT_HEADERS, ...ALL_PROFILE_FIELDS.map((field) => field.ar)];
const GAPS_HEADER = "ناقص في الملف";
const PEOPLE_HEADERS = [...HEADERS, GAPS_HEADER];

const HEADER_KEY = {
  الاسم: "name",
  name: "name",
  البريد: "email",
  email: "email",
  الهوية: "nationalId",
  nationalid: "nationalId",
  الجوال: "phone",
  phone: "phone",
  "تاريخ التعيين": "hireDate",
  hire_date: "hireDate",
  hiredate: "hireDate",
  القائمة: "list",
  list: "list",
  المنصب: "title",
  title: "title",
  الدرجة: "grade",
  grade: "grade",
  الفرع: "branch",
  branch: "branch",
  "يتبع فرع": "parentBranch",
  parent_branch: "parentBranch",
  parentbranch: "parentBranch",
  يتبع: "reportsTo",
  reports_to: "reportsTo",
  reportsto: "reportsTo",
  manager: "reportsTo",
  "فروع إضافية": "extraBranches",
  "الرقم الوظيفي": "employeeNo",
  employee_no: "employeeNo",
  employeeno: "employeeNo",
  extra_branches: "extraBranches",
  covers: "extraBranches",
  "المناصب المتاحة": "titlesHint",
  available_titles: "titlesHint",
  "الدرجات المتاحة": "gradesHint",
  available_grades: "gradesHint",
  "الفروع المتاحة": "branchesHint",
  available_branches: "branchesHint",
  "الراتب الأساسي": "baseSalary",
  base_salary: "baseSalary",
  basesalary: "baseSalary",
  البدلات: "allowances",
  allowances: "allowances",
  "ناقص في الملف": "_gaps",
  missing: "_gaps",
  gaps: "_gaps",
};
ALL_PROFILE_FIELDS.forEach((field) => {
  HEADER_KEY[field.ar] = field.key;
  HEADER_KEY[field.en] = field.key;
  HEADER_KEY[field.key] = field.key;
});

const DATE_KEYS = new Set(["hireDate", ...ALL_PROFILE_FIELDS.filter((field) => field.type === "date").map((field) => field.key)]);

const norm = (value) => String(value || "")
  .toLowerCase()
  .replace(/[أإآ]/g, "ا")
  .replace(/ة/g, "ه")
  .replace(/\s+/g, " ")
  .trim();

const HEADER_NORM = {};
Object.entries(HEADER_KEY).forEach(([header, key]) => {
  HEADER_NORM[norm(header)] = key;
});

function mapHeader(header) {
  const raw = String(header || "").trim();
  return HEADER_KEY[raw] || HEADER_KEY[raw.toLowerCase()] || HEADER_NORM[norm(raw)] || "";
}

function coerceCell(key, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (DATE_KEYS.has(key) && /^\d{4,5}$/.test(raw)) return excelSerialToIso(raw) || raw;
  return raw;
}

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

function splitNames(text) {
  return String(text || "")
    .split(/[،,;|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stationByName(data, name) {
  const key = norm(name);
  if (!key) return null;
  return (data?.stations || []).find((station) => norm(station.name) === key) || null;
}

function listByName(data, name) {
  const key = String(name || "").trim();
  if (!key) return null;
  const match = (pack) =>
    pack.id === key
    || pack.ar === key
    || pack.en === key
    || templateLabel(pack, true) === key
    || norm(pack.ar) === norm(key)
    || norm(pack.en) === norm(key);
  const lists = companyLists(data);
  const named = lists.filter(match);
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    return named.find((pack) => gradesForList(data, pack.id).length) || named[0];
  }
  const byTitle = lists.find((pack) => listPositions(pack).some((item) => norm(item.title) === norm(key)));
  if (byTitle) return byTitle;
  return companyTemplates(data).find(match) || null;
}

function gradeByLabel(data, listId, label) {
  return findListGrade(data, listId, label);
}

function branchCatalog(data) {
  const seen = new Set();
  return (data?.stations || [])
    .map((station) => String(station?.name || "").trim())
    .filter((name) => {
      const key = norm(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function hireTemplateCatalogBranches(data) {
  return branchCatalog(data);
}

function fileGaps(employee) {
  const stats = profileCompletionStats(employee);
  return {
    labels: stats.missing.map((field) => field.ar).filter(Boolean),
    pct: stats.pct,
    count: stats.missing.length,
  };
}

function emptyProfile() {
  const row = {};
  ALL_PROFILE_FIELDS.forEach((field) => { row[field.key] = ""; });
  return row;
}

function listHints(data, pack) {
  const titles = listPositions(pack).map((item) => item.title).filter(Boolean);
  const grades = gradesForList(data, pack?.id).map((grade) => grade.title || jobGradeLabel(grade)).filter(Boolean);
  return {
    titlesHint: titles.join("، "),
    gradesHint: grades.join("، "),
    branchesHint: branchCatalog(data).join("، "),
  };
}

function blankRow(data, extras = {}) {
  const pack = extras.pack || listByName(data, extras.list);
  const hints = listHints(data, pack);
  return {
    name: "",
    email: "",
    nationalId: "",
    phone: "",
    hireDate: "",
    list: "",
    title: "",
    grade: "",
    branch: "",
    parentBranch: "",
    reportsTo: "",
    extraBranches: "",
    ...emptyProfile(),
    ...hints,
    ...extras,
    pack: undefined,
  };
}

function packForEmployee(employee, data) {
  const smart = (data?.smartPositions || []).find((item) => item.employeeId === employee.id);
  if (smart?.templateId) {
    return companyLists(data).find((pack) => pack.id === smart.templateId) || templateById(data, smart.templateId);
  }
  return listByName(data, employee.profile?.department);
}

function employeeRow(employee, data) {
  const stations = data?.stations || [];
  const home = stations.find((station) => station.id === employee.stationId);
  const extras = stripDescendantCoverage(employee.managedStations, stations, employee.stationId)
    .map((id) => stations.find((station) => station.id === id)?.name)
    .filter(Boolean)
    .join("، ");
  const pack = packForEmployee(employee, data);
  const grade = employeeJobGrade(employee, data);
  const profile = employee.profile || {};
  const seat = (data?.orgSeats || []).find((item) => String(item.employeeId) === String(employee.id));
  const reportsEmp = (data?.employees || []).find((item) => item.id === (seat?.reportsToEmployeeId || profile.directManagerId));
  const row = blankRow(data, {
    name: employee.name || "",
    email: employee.email || "",
    nationalId: profile.nationalId || employee.nationalId || "",
    phone: employee.phone || profile.phone || "",
    hireDate: profile.hireDate || "",
    list: pack ? templateLabel(pack, true) : (profile.department || ""),
    title: seat?.title || profile.position || employee.position || "",
    grade: grade?.title || jobGradeLabel(grade) || "",
    branch: home?.name || "",
    parentBranch: stations.find((station) => station.id === stationParentId(home))?.name || "",
    reportsTo: seat?.reportsToName || reportsEmp?.name || "",
    extraBranches: extras,
    pack,
  });
  PROFILE_FIELDS.forEach((field) => {
    const raw = profileFieldValue(profile, field.key, employee);
    row[field.key] = displayProfileField(field, raw, true) || raw || "";
  });
  row.baseSalary = profile.baseSalary || "";
  row.allowances = profile.allowances || "";
  const gaps = fileGaps(employee);
  row._gaps = gaps.labels.join("، ");
  row._gapPct = gaps.pct;
  return row;
}

function placementRows(data) {
  const lists = companyLists(data);
  const stations = data?.stations || [];
  const rows = [];
  const seen = new Set();
  const remember = (row) => {
    const key = `${row.list}|${row.title}|${row.grade}|${row.branch}`;
    if (row.name) {
      rows.push(row);
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  (data?.employees || []).filter((employee) => employee?.name && employee.role !== "system").forEach((employee) => {
    remember(employeeRow(employee, data));
  });

  vacantSeats(data).forEach((seat) => {
    const pack = lists.find((item) => item.id === seat.listId) || listByName(data, seat.list);
    const grade = (data?.jobGrades || []).find((item) => item.id === seat.gradeId);
    const station = stations.find((item) => item.id === seat.stationId);
    remember(blankRow(data, {
      list: pack ? templateLabel(pack, true) : (seat.list || ""),
      title: seat.title || "",
      grade: grade.title || jobGradeLabel(grade) || "",
      branch: station?.name || "",
      pack,
    }));
  });

  lists.forEach((pack) => {
    const titles = listPositions(pack);
    const grades = gradesForList(data, pack.id);
    remember(blankRow(data, {
      list: templateLabel(pack, true),
      title: titles[0]?.title || "",
      grade: grades[0]?.title || jobGradeLabel(grades[0]) || "",
      branch: "",
      pack,
    }));
  });

  if (!rows.some((row) => !row.name)) {
    remember(blankRow(data, { branch: "" }));
  }

  return rows;
}

export function isHirePeopleCsv(text) {
  const first = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/)[0] || "";
  const headers = parseCsvLine(first).map((header) => header.replace(/^"|"$/g, "").trim());
  const hasKind = headers.includes("نوع السجل") || headers.includes("kind") || headers.includes("record_type");
  return !hasKind && headers.some((header) => ["تاريخ التعيين", "فروع إضافية", "الفروع المتاحة", "hire_date", "extra_branches", "الجنسية"].includes(header));
}

export function parseHireTemplateText(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const keys = parseCsvLine(lines[0]).map((header) => mapHeader(header));
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    keys.forEach((key, index) => {
      if (key) row[key] = coerceCell(key, cells[index]);
    });
    return row;
  }).filter((row) => Object.values(row).some((value) => String(value || "").trim()));
}

export function previewHireTemplate(data, rows, ar = true) {
  const willHire = [];
  const willUpdate = [];
  const skipped = [];
  const errors = [];
  const grid = [];
  const fileNames = new Set((rows || []).map((row) => norm(row.name)).filter(Boolean));
  const creates = { lists: [], branches: [], grades: [], seats: 0 };
  (rows || []).forEach((row, index) => {
    const resolved = resolveRow(data, row, ar, fileNames);
    if (resolved.skip) {
      skipped.push(index + 2);
      grid.push({
        index,
        name: "",
        list: row.list || "",
        title: row.title || "",
        grade: row.grade || "",
        branch: row.branch || "",
        reportsTo: row.reportsTo || "",
        extraBranches: row.extraBranches || "",
        error: "",
        warnings: [],
        creates: [],
        existing: false,
        skip: true,
      });
      return;
    }
    if (!resolved.ok) {
      errors.push({ row: index + 2, name: row.name || "", error: resolved.error });
      grid.push({
        index,
        name: row.name || "",
        list: row.list || "",
        title: row.title || "",
        grade: row.grade || "",
        branch: row.branch || "",
        reportsTo: row.reportsTo || "",
        extraBranches: row.extraBranches || "",
        error: resolved.error,
        warnings: [],
        creates: [],
        existing: false,
      });
      return;
    }
    if (resolved.existing) willUpdate.push(resolved.name);
    else willHire.push(resolved.name);
    const createBits = [];
    if (resolved.willCreate.list) {
      creates.lists.push(resolved.willCreate.list);
      createBits.push(ar ? `قائمة «${resolved.willCreate.list}»` : `list “${resolved.willCreate.list}”`);
    }
    if (resolved.willCreate.parentBranch) {
      creates.branches.push(resolved.willCreate.parentBranch);
      createBits.push(ar ? `فرع أب «${resolved.willCreate.parentBranch}»` : `parent branch “${resolved.willCreate.parentBranch}”`);
    }
    if (resolved.willCreate.branch) {
      creates.branches.push(resolved.willCreate.branch);
      createBits.push(ar ? `فرع «${resolved.willCreate.branch}»` : `branch “${resolved.willCreate.branch}”`);
    }
    (resolved.willCreate.extraBranches || []).forEach((label) => {
      creates.branches.push(label);
      createBits.push(ar ? `فرع «${label}»` : `branch “${label}”`);
    });
    if (resolved.willCreate.grade) {
      creates.grades.push(`${resolved.listName}:${resolved.willCreate.grade}`);
      createBits.push(ar ? `درجة «${resolved.willCreate.grade}»` : `grade “${resolved.willCreate.grade}”`);
    }
    if (resolved.willCreate.seat) {
      creates.seats += 1;
      createBits.push(ar ? `منصب «${resolved.title}»` : `seat “${resolved.title}”`);
    }
    grid.push({
      index,
      name: resolved.name,
      list: resolved.listName,
      title: resolved.title,
      grade: resolved.gradeLabel,
      branch: resolved.branchName,
      reportsTo: resolved.reportsTo,
      extraBranches: row.extraBranches || "",
      error: "",
      warnings: resolved.warnings || [],
      creates: createBits,
      existing: Boolean(resolved.existing),
      orphan: resolved.reportsMissing,
    });
  });
  return {
    rows: rows || [],
    willHire,
    willUpdate,
    skipped,
    errors,
    grid,
    creates: {
      lists: uniqueLabels(creates.lists),
      branches: uniqueLabels(creates.branches),
      grades: uniqueLabels(creates.grades),
      seats: creates.seats,
    },
  };
}

function uniqueLabels(values) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

export function hirePreviewSummary(preview, ar = true) {
  if (!preview) return "";
  const parts = [];
  if (preview.willHire.length) parts.push(ar ? `${preview.willHire.length} ملف` : `${preview.willHire.length} files`);
  if (preview.willUpdate.length) parts.push(ar ? `${preview.willUpdate.length} يُحدَّث` : `${preview.willUpdate.length} to update`);
  if (preview.creates?.lists?.length) parts.push(ar ? `${preview.creates.lists.length} قوائم` : `${preview.creates.lists.length} lists`);
  if (preview.creates?.seats) parts.push(ar ? `${preview.creates.seats} مناصب` : `${preview.creates.seats} seats`);
  if (preview.creates?.branches?.length) parts.push(ar ? `${preview.creates.branches.length} فروع` : `${preview.creates.branches.length} branches`);
  if (preview.skipped.length) parts.push(ar ? `${preview.skipped.length} بلا اسم` : `${preview.skipped.length} unnamed`);
  if (preview.errors.length) parts.push(ar ? `${preview.errors.length} فيه خطأ` : `${preview.errors.length} with errors`);
  const first = preview.errors[0];
  const detail = first ? (ar ? ` · صف ${first.row}: ${first.error}` : ` · row ${first.row}: ${first.error}`) : "";
  return (parts.join(" · ") || (ar ? "لا صفوف بأسماء." : "No named rows.")) + detail;
}

export function hireApplySummary(result, ar = true) {
  const parts = [];
  if (result?.hired?.length) parts.push(ar ? `عُيّن ${result.hired.length}` : `Hired ${result.hired.length}`);
  if (result?.updated?.length) parts.push(ar ? `حُدّث ${result.updated.length}` : `Updated ${result.updated.length}`);
  if (result?.skipped?.length) parts.push(ar ? `${result.skipped.length} صف بلا اسم` : `${result.skipped.length} unnamed`);
  if (result?.errors?.length) parts.push(ar ? `${result.errors.length} لم يُحفظ` : `${result.errors.length} failed`);
  const first = result?.errors?.[0];
  const detail = first ? (ar ? ` · صف ${first.row}: ${first.error}` : ` · row ${first.row}: ${first.error}`) : "";
  return (parts.join(" · ") || (ar ? "لا صفوف بأسماء." : "No named rows.")) + detail;
}

function colLetter(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function colRange(header, last) {
  const index = HEADERS.indexOf(header);
  if (index < 0) return "";
  const letter = colLetter(index);
  return `${letter}2:${letter}${last}`;
}

function catalogSheet(data) {
  const lists = companyLists(data).map((pack) => templateLabel(pack, true));
  const titles = [...new Set(companyLists(data).flatMap((pack) => listPositions(pack).map((item) => item.title).filter(Boolean)))];
  const grades = [...new Set(companyLists(data).flatMap((pack) => gradesForList(data, pack.id).flatMap((grade) => [grade.title, jobGradeLabel(grade)].filter(Boolean))))];
  const branches = branchCatalog(data);
  const idTypes = ID_TYPE_OPTIONS.map((item) => item.ar);
  const genders = GENDER_OPTIONS.map((item) => item.ar);
  const marital = MARITAL_OPTIONS.map((item) => item.ar);
  const contracts = CONTRACT_TYPE_OPTIONS.map((item) => item.ar);
  const names = (data?.employees || []).map((employee) => employee.name).filter(Boolean);
  const height = Math.max(lists.length, titles.length, grades.length, branches.length, idTypes.length, genders.length, marital.length, contracts.length, names.length, 1);
  const rows = [["القوائم", "المناصب", "الدرجات", "الفروع", "نوع الهوية", "الجنس", "الحالة الاجتماعية", "نوع العقد", "يتبع"]];
  for (let index = 0; index < height; index += 1) {
    rows.push([
      lists[index] || "",
      titles[index] || "",
      grades[index] || "",
      branches[index] || "",
      idTypes[index] || "",
      genders[index] || "",
      marital[index] || "",
      contracts[index] || "",
      names[index] || "",
    ]);
  }
  return rows;
}

function guideSheet() {
  const required = new Set(["الاسم", "القائمة", "المنصب", "الدرجة", "الفرع"]);
  const notes = {
    الاسم: "كما في الهوية. صف بلا اسم يُتخطى.",
    البريد: "بريد الدخول إن وُجد.",
    الهوية: "رقم الهوية الوطنية أو الإقامة — 10 أرقام.",
    الجوال: "رقم الجوال.",
    "تاريخ التعيين": "YYYY-MM-DD. إن تُرك يُستخدم اليوم.",
    الفرع: "اضغط السهم في الخلية واختر من ورقة «الفروع» — هذه فروع المنصة. لكل موظف تختار أين يوضع.",
    "يتبع فرع": "أب هذا الفرع في الشجرة إن لزم. فارغ = المنشأة. إن لم يوجد الأب يُنشأ.",
    يتبع: "اسم المعتمِد. إن لم يوجد يُعلَّق بالمالك ويُظلَّل.",
    "فروع إضافية": "فروع تغطية إضافية مفصولة بفاصلة. غير الموجودة تُنشأ.",
    القائمة: "من عمود القوائم في ورقة الدليل. إن لم توجد تُنشأ.",
    المنصب: "مسمّى المنصب. إن لم يوجد على القائمة يُضاف.",
    الدرجة: "درجة القائمة. إن لم توجد تُنشأ على القائمة.",
    الجنسية: "مثال: سعودي.",
    "نوع الهوية": "هوية وطنية أو إقامة.",
    "انتهاء الهوية / الإقامة": "YYYY-MM-DD.",
    "تاريخ الميلاد": "YYYY-MM-DD.",
    الجنس: "ذكر أو أنثى.",
    "الحالة الاجتماعية": "أعزب / متزوج / مطلق / أرمل.",
    "رقم الجواز": "لغير السعوديين.",
    "انتهاء الجواز": "YYYY-MM-DD.",
    "رقم التأمينات الاجتماعية (GOSI)": "رقم الاشتراك في التأمينات.",
    "رقم التأمين الطبي": "رقم الوثيقة.",
    "انتهاء التأمين الطبي": "YYYY-MM-DD.",
    "الفحص الطبي": "نتيجة أو تاريخ الفحص إن وُجد.",
    "المسمى في منصة قوى": "يطابق المسمى الوظيفي.",
    "نوع العقد": "غير محدد المدة أو محدد المدة.",
    "رقم رخصة العمل": "لغير السعوديين.",
    "انتهاء رخصة العمل": "YYYY-MM-DD.",
    "المؤهل العلمي": "أعلى مؤهل.",
    "جهة اتصال الطوارئ": "الاسم.",
    "هاتف الطوارئ": "رقم للتواصل.",
    العنوان: "عنوان السكن.",
    ملاحظات: "أي بيان إضافي.",
    "الحساب البنكي (IBAN)": "SA ثم 22 رقمًا — لملف حماية الأجور.",
    "الراتب الأساسي": "بالريال، بلا فواصل.",
    البدلات: "مجموع البدلات الشهرية بالريال.",
    "ناقص في الملف": "يُحسب عند تنزيل الملفات الحالية. الخلية الفارغة في الأعمدة الأخرى هي الناقص — املأها ثم ارفع الملف ليُحفظ في ملف الموظف.",
  };
  const rows = [["العمود", "مطلوب", "الشرح"]];
  PEOPLE_HEADERS.forEach((header) => {
    rows.push([header, required.has(header) ? "نعم" : "لا", notes[header] || "يُحفظ في ملف الموظف."]);
  });
  return rows;
}

function gapsSheet(rows) {
  const named = (rows || []).filter((row) => row.name);
  const sorted = [...named].sort((a, b) => (a._gapPct ?? 100) - (b._gapPct ?? 100));
  const out = [["الاسم", "الفرع", "المنصب", "اكتمال الملف", "ناقص في الملف"]];
  sorted.forEach((row) => {
    out.push([
      row.name,
      row.branch || "",
      row.title || "",
      `${row._gapPct ?? 100}%`,
      row._gaps || "—",
    ]);
  });
  if (out.length === 1) out.push(["", "", "", "", "لا صفوف بأسماء في هذا التنزيل."]);
  return out;
}

function branchesSheet(data) {
  const stations = data?.stations || [];
  const rows = [["الفرع", "يتبع"]];
  branchCatalog(data).forEach((name) => {
    const station = stations.find((item) => norm(item.name) === norm(name));
    const parent = station ? stations.find((item) => item.id === stationParentId(station)) : null;
    rows.push([name, parent?.name || ""]);
  });
  if (rows.length === 1) {
    rows.push(["", "لا فروع في المنصة. أنشئ فرعاً من الهيكل ثم نزّل القالب."]);
  }
  return rows;
}

function catalogNamedRanges(data) {
  const lists = companyLists(data).map((pack) => templateLabel(pack, true)).filter(Boolean);
  const titles = [...new Set(companyLists(data).flatMap((pack) => listPositions(pack).map((item) => item.title).filter(Boolean)))];
  const grades = [...new Set(companyLists(data).flatMap((pack) => gradesForList(data, pack.id).flatMap((grade) => [grade.title, jobGradeLabel(grade)].filter(Boolean))))];
  const branches = branchCatalog(data);
  const idTypes = ID_TYPE_OPTIONS.map((item) => item.ar);
  const genders = GENDER_OPTIONS.map((item) => item.ar);
  const marital = MARITAL_OPTIONS.map((item) => item.ar);
  const contracts = CONTRACT_TYPE_OPTIONS.map((item) => item.ar);
  const names = (data?.employees || []).map((employee) => employee.name).filter(Boolean);
  const size = (list) => Math.max(list.length, 1);
  return [
    namedRange("NV_LISTS", "دليل", 2, size(lists), "A"),
    namedRange("NV_TITLES", "دليل", 2, size(titles), "B"),
    namedRange("NV_GRADES", "دليل", 2, size(grades), "C"),
    namedRange("NV_BRANCHES", "الفروع", 2, size(branches), "A"),
    namedRange("NV_IDTYPES", "دليل", 2, size(idTypes), "E"),
    namedRange("NV_GENDERS", "دليل", 2, size(genders), "F"),
    namedRange("NV_MARITAL", "دليل", 2, size(marital), "G"),
    namedRange("NV_CONTRACTS", "دليل", 2, size(contracts), "H"),
    namedRange("NV_MANAGERS", "دليل", 2, size(names), "I"),
  ];
}

function peopleValidations(last) {
  const branchPrompt = {
    promptTitle: "فرع المنصة",
    prompt: "اضغط السهم واختر أين يوضع الموظف. القائمة من ورقة الفروع = فروع المنصة.",
    errorTitle: "فرع المنصة",
    error: "اختر فرعاً من ورقة الفروع، أو اترك الخلية فارغة إلى أن تختار.",
  };
  const items = [
    listValidation(colRange("القائمة", last), "NV_LISTS"),
    listValidation(colRange("المنصب", last), "NV_TITLES"),
    listValidation(colRange("الدرجة", last), "NV_GRADES"),
    listValidation(colRange("الفرع", last), "NV_BRANCHES", branchPrompt),
    listValidation(colRange("يتبع فرع", last), "NV_BRANCHES"),
    listValidation(colRange("يتبع", last), "NV_MANAGERS"),
    listValidation(colRange("نوع الهوية", last), "NV_IDTYPES"),
    listValidation(colRange("الجنس", last), "NV_GENDERS"),
    listValidation(colRange("الحالة الاجتماعية", last), "NV_MARITAL"),
    listValidation(colRange("نوع العقد", last), "NV_CONTRACTS"),
  ].filter(Boolean);
  return `<dataValidations count="${items.length}">${items.join("")}</dataValidations>`;
}

export function buildHireTemplatePeople(data, options = {}) {
  const mode = options.mode === "blank" ? "blank" : "files";
  const stationIds = (options.stationIds || []).map(String).filter(Boolean);
  const employeeIds = (options.employeeIds || []).map(String).filter(Boolean);
  const focusStationId = String(options.focusStationId || "");
  const scopedIds = [...new Set([...stationIds, focusStationId].filter(Boolean))];
  const blankCount = Number(options.blanks) > 0
    ? Number(options.blanks)
    : (mode === "blank" ? 12 : 3);

  const named = mode === "blank"
    ? []
    : (data?.employees || [])
      .filter((employee) => employee?.name && employee.role !== "system")
      .filter((employee) => !employeeIds.length || employeeIds.includes(String(employee.id)))
      .filter((employee) => !scopedIds.length || scopedIds.includes(String(employee.stationId)))
      .map((employee) => employeeRow(employee, data));

  const blanks = Array.from({ length: blankCount }, () => blankRow(data));

  return mode === "blank" ? blanks : [...named, ...blanks];
}

export function downloadHireTemplate(data, ar = true, options = {}) {
  const mode = options.mode === "blank" ? "blank" : "files";
  const rows = buildHireTemplatePeople(data, { ...options, mode });
  const people = [PEOPLE_HEADERS, ...rows.map((row) => PEOPLE_HEADERS.map((header) => row[HEADER_KEY[header]] || ""))];
  const last = Math.max(people.length, 80);
  const extra = peopleValidations(last);
  const focus = String(options.focusStationId || (options.stationIds || [])[0] || "");
  const focusName = (data?.stations || []).find((station) => String(station.id) === focus)?.name || "";
  const file = mode === "blank"
    ? (ar ? "قالب-تعيين-موظف" : "hire-blank-template")
    : (focusName
      ? (ar ? `ملفات-ونواقص-${focusName}` : `employee-files-${focusName}`)
      : (ar ? "ملفات-الموظفين-والنواقص" : "employee-files-and-gaps"));
  const sheets = [
    { name: "الأشخاص", rows: people, extra, rtl: true, freeze: true },
    { name: "الفروع", rows: branchesSheet(data), rtl: true, freeze: true },
    { name: "دليل", rows: catalogSheet(data), rtl: true, freeze: true },
    { name: "شرح الأعمدة", rows: guideSheet(), rtl: true, freeze: true },
  ];
  if (mode === "files") {
    sheets.splice(1, 0, { name: "نواقص الملف", rows: gapsSheet(rows), rtl: true, freeze: true });
  }
  downloadXlsx(file, sheets, { definedNames: catalogNamedRanges(data) });
}

function rowsFromGrid(grid) {
  if (!grid?.length) return [];
  const headerAt = grid.findIndex((row) => (row || []).some((cell) => mapHeader(cell) === "name"));
  if (headerAt < 0 || headerAt >= grid.length - 1) return [];
  const keys = (grid[headerAt] || []).map((header) => mapHeader(header));
  return grid.slice(headerAt + 1).map((cells) => {
    const row = {};
    keys.forEach((key, index) => {
      if (key) row[key] = coerceCell(key, cells[index]);
    });
    return row;
  }).filter((row) => Object.values(row).some((value) => String(value || "").trim()));
}

function parseHireTemplateHtml(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];
  const grid = [...table.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => cell.textContent.trim()));
  return rowsFromGrid(grid);
}

export async function parseHireTemplateFile(file) {
  const buffer = await file.arrayBuffer();
  if (isZipBuffer(buffer) || /\.xlsx$/i.test(file.name || "")) {
    return rowsFromGrid(await parseXlsxFirstSheet(buffer, "الأشخاص"));
  }
  const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  if (/<table/i.test(text)) return parseHireTemplateHtml(text);
  return parseHireTemplateText(text);
}

function profileFromRow(row) {
  const patch = {};
  ALL_PROFILE_FIELDS.forEach((field) => {
    const raw = String(row[field.key] || "").trim();
    if (!raw) return;
    patch[field.key] = field.options ? canonicalFieldValue(field, raw) : raw;
  });
  return patch;
}

function findExisting(data, row) {
  const people = (data?.employees || []).filter((employee) => employee?.role !== "system");
  const email = String(row.email || "").trim().toLowerCase();
  if (email) {
    const hit = people.find((employee) => String(employee.email || "").trim().toLowerCase() === email);
    if (hit) return hit;
  }
  const nid = String(row.nationalId || "").replace(/\D/g, "");
  if (nid.length >= 10) {
    const hit = people.find((employee) => String(employee.nationalId || employee.profile?.nationalId || "").replace(/\D/g, "") === nid);
    if (hit) return hit;
  }
  const name = norm(row.name);
  if (!name) return null;
  const matches = people.filter((employee) => norm(employee.name) === name);
  return matches.length === 1 ? matches[0] : null;
}

function resolveRow(data, row, ar, fileNames = new Set()) {
  const name = String(row.name || "").trim();
  if (!name) return { ok: false, skip: true };
  const listName = String(row.list || "").trim();
  if (!listName) return { ok: false, error: ar ? "القائمة مطلوبة." : "List is required." };
  const pack = listByName(data, listName);
  const gradeLabel = String(row.grade || "").trim();
  if (!gradeLabel) return { ok: false, error: ar ? "الدرجة مطلوبة." : "Grade is required." };
  const grade = pack ? gradeByLabel(data, pack.id, gradeLabel) : null;
  const branchName = String(row.branch || "").trim();
  if (!branchName) return { ok: false, error: ar ? "الفرع مطلوب." : "Branch is required." };
  const home = stationByName(data, branchName);
  if (home && isManagerUnit(home)) {
    return {
      ok: false,
      error: ar
        ? "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه."
        : "A manager is not a hire workplace. Convert it to a branch, then hire there.",
    };
  }
  const extraNames = splitNames(row.extraBranches);
  const extra = extraNames
    .map((label) => stationByName(data, label))
    .filter((station) => station && !isManagerUnit(station))
    .map((station) => station.id)
    .filter((id) => id !== home?.id);
  const unknownExtra = extraNames.filter((label) => !stationByName(data, label));
  const title = String(row.title || "").trim();
  if (!title) return { ok: false, error: ar ? "المنصب مطلوب." : "Job title is required." };
  const reportsTo = String(row.reportsTo || "").trim();
  const reportsEmp = reportsTo ? findEmployeeByName(data, reportsTo) : null;
  const reportsInFile = reportsTo && fileNames.has(norm(reportsTo));
  const warnings = [];
  if (reportsTo && !reportsEmp && !reportsInFile) {
    warnings.push(ar
      ? `يتبع «${reportsTo}» غير موجود — يُعلَّق بالمالك.`
      : `Reports-to “${reportsTo}” is missing — hangs under the owner.`);
  }
  const parentBranchName = String(row.parentBranch || "").trim();
  const parentHome = parentBranchName ? stationByName(data, parentBranchName) : null;
  const willCreate = {
    list: pack ? "" : listName,
    branch: home ? "" : branchName,
    parentBranch: parentBranchName && !parentHome ? parentBranchName : "",
    grade: pack && grade ? "" : gradeLabel,
    extraBranches: unknownExtra,
    seat: false,
  };
  if (pack && home && grade) {
    const match = vacantSeats(data, home.id, pack.id).find((seat) => seat.title === title && seat.gradeId === grade.id);
    const occupied = (data?.orgSeats || []).find((seat) =>
      seat.title === title && seat.gradeId === grade.id && seat.stationId === home.id
    );
    willCreate.seat = !match && !occupied;
  } else {
    willCreate.seat = true;
  }
  return {
    ok: true,
    name,
    email: String(row.email || "").trim(),
    nationalId: String(row.nationalId || "").replace(/\D/g, "").slice(0, 10),
    phone: String(row.phone || "").trim(),
    hireDate: String(row.hireDate || "").trim() || todayKey(),
    employeeNo: String(row.employeeNo || "").trim(),
    pack,
    grade,
    gradeLabel,
    home,
    extra,
    unknownExtra,
    title,
    listName,
    branchName,
    parentBranchName,
    reportsTo,
    reportsMissing: Boolean(reportsTo && !reportsEmp && !reportsInFile),
    profile: profileFromRow(row),
    existing: findExisting(data, row),
    willCreate,
    warnings,
  };
}

function seatInput(resolved) {
  return {
    name: resolved.name,
    email: resolved.email,
    nationalId: resolved.nationalId,
    phone: resolved.phone,
    hireDate: resolved.hireDate,
    employeeNo: String(resolved.employeeNo || "").trim(),
    managedStationIds: resolved.extra,
    profile: resolved.profile,
    reportsTo: resolved.reportsTo,
    salary: resolved.profile?.baseSalary,
  };
}

function ensureRowStructure(companyId, row, resolved, ar) {
  let pack = resolved.pack;
  if (!pack) {
    const listId = createCompanyList(companyId, resolved.listName);
    const live = getCompanyData(companyId);
    pack = templateById(live, listId) || listByName(live, resolved.listName);
    if (!pack) return { ok: false, error: ar ? "تعذّر إنشاء القائمة." : "Could not create the list." };
  }
  if (resolved.willCreate?.parentBranch) {
    let parent = stationByName(getCompanyData(companyId), resolved.parentBranchName);
    if (!parent) {
      const createdParent = createOrgBranch(companyId, resolved.parentBranchName);
      if (!createdParent.ok && createdParent.error === "LIMIT") {
        return { ok: false, error: ar ? "بلغت حد الفروع في الخطة." : "Branch limit reached." };
      }
      parent = stationByName(getCompanyData(companyId), resolved.parentBranchName);
    }
  }
  if (resolved.willCreate?.branch || !resolved.home) {
    const live = getCompanyData(companyId);
    const parent = resolved.parentBranchName ? stationByName(live, resolved.parentBranchName) : null;
    const created = createOrgBranch(companyId, resolved.branchName, null, live, parent?.id || "");
    if (!created.ok && created.error === "LIMIT") {
      return { ok: false, error: ar ? "بلغت حد الفروع في الخطة." : "Branch limit reached." };
    }
  } else if (resolved.home && resolved.parentBranchName) {
    const live = getCompanyData(companyId);
    const parent = stationByName(live, resolved.parentBranchName);
    if (parent?.id && !stationParentId(resolved.home)) {
      setOrgBranchParent(companyId, resolved.home.id, parent.id);
    }
  }
  (resolved.unknownExtra || []).forEach((label) => {
    createOrgBranch(companyId, label);
  });
  addListPosition(companyId, pack, resolved.title);
  let grade = resolved.grade;
  if (!grade?.id) {
    const ensured = ensureListGrade(companyId, pack.id, resolved.gradeLabel, pack.ar);
    if (!ensured.ok) return { ok: false, error: ar ? "تعذّر إنشاء الدرجة على القائمة." : "Could not create the grade on the list." };
    grade = { id: ensured.id };
  }
  const live = getCompanyData(companyId);
  const home = stationByName(live, resolved.branchName);
  const extra = stripDescendantCoverage(
    splitNames(row.extraBranches)
      .map((label) => stationByName(live, label))
      .filter((station) => station && !isManagerUnit(station))
      .map((station) => station.id),
    live?.stations || [],
    home?.id,
  );
  if (!home) return { ok: false, error: ar ? "تعذّر إنشاء الفرع." : "Could not create the branch." };
  if (isManagerUnit(home)) {
    return {
      ok: false,
      error: ar
        ? "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه."
        : "A manager is not a hire workplace. Convert it to a branch, then hire there.",
    };
  }
  return { ok: true, pack, grade, home, extra };
}

export function applyHireTemplate(companyId, rows, ar = true) {
  const hired = [];
  const updated = [];
  const skipped = [];
  const errors = [];
  const placed = [];
  (rows || []).forEach((row, index) => {
    const data = getCompanyData(companyId);
    const fileNames = new Set((rows || []).map((item) => norm(item.name)).filter(Boolean));
    const resolved = resolveRow(data, row, ar, fileNames);
    if (resolved.skip) {
      skipped.push(index + 2);
      return;
    }
    if (!resolved.ok) {
      errors.push({ row: index + 2, name: row.name || "", error: resolved.error });
      return;
    }
    const structure = ensureRowStructure(companyId, row, resolved, ar);
    if (!structure.ok) {
      errors.push({ row: index + 2, name: resolved.name, error: structure.error });
      return;
    }
    const { pack, grade, home, extra } = structure;
    const live = getCompanyData(companyId);
    const match = vacantSeats(live, home.id, pack.id).find((seat) =>
      seat.title === resolved.title && seat.gradeId === grade.id && (!seat.employeeId || seat.employeeId === resolved.existing?.id)
    );
    const occupied = (live?.orgSeats || []).find((seat) => seat.employeeId === resolved.existing?.id
      && seat.title === resolved.title
      && seat.gradeId === grade.id
      && seat.stationId === home.id);
    const payload = {
      ...seatInput({ ...resolved, extra }),
      ar,
      seatId: occupied?.id || match?.id || "",
      newSeat: (occupied || match)
        ? null
        : {
            title: resolved.title,
            stationId: home.id,
            listId: pack.id,
            list: pack.ar,
            gradeId: grade.id,
          },
    };
    const result = resolved.existing
      ? placeExistingEmployee(companyId, resolved.existing.id, payload)
      : hireFromSeat(companyId, payload);
    if (!result.ok) {
      errors.push({
        row: index + 2,
        name: resolved.name,
        error: result.error === "NO_GRADES"
          ? (ar ? "القائمة بلا درجات." : "The list has no grades.")
          : (ar ? "تعذّر حفظ هذا الصف." : "Could not save this row."),
      });
      return;
    }
    placed.push({ employeeId: result.employeeId, reportsTo: resolved.reportsTo });
    if (result.updated) updated.push(resolved.name);
    else hired.push(resolved.name);
  });
  updateCompany(companyId, (data) => {
    placed.forEach((item) => {
      const seat = (data.orgSeats || []).find((row) => String(row.employeeId) === String(item.employeeId));
      if (!seat) return;
      attachReportsTo(seat, data, item.reportsTo);
      const employee = (data.employees || []).find((row) => row.id === item.employeeId);
      if (employee?.profile) employee.profile.directManagerId = seat.reportsToEmployeeId || employee.profile.directManagerId || null;
    });
    applyExtraCoverageStrip(data);
  });
  return { hired, updated, skipped, errors };
}
