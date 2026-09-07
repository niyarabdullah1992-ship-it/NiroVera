import { updateCompany } from "@/lib/store";

/**
 * Grantable product sections — aligned with Layout sidebar labels & routes.
 * `employees` is not a nav item; it unlocks filling files in branch scope.
 */
export const SMART_DEPARTMENTS = [
  // Proof cycle — matches Layout category "daily"
  {
    id: "attendance",
    ar: "الحضور والانصراف",
    en: "Attendance",
    hintAr: "يشمل الورديات وطلبات الإجازة",
    hintEn: "Includes shifts and leave",
    group: "daily",
  },
  {
    id: "tasks",
    ar: "المهام والعمليات",
    en: "Operations",
    hintAr: "تنفيذ ومراجعة وتصعيد المهام",
    hintEn: "Task execution, review, and escalation",
    group: "daily",
  },
  {
    id: "signing",
    ar: "التوقيع الرقمي",
    en: "Digital signing",
    hintAr: "ختم واعتماد المستندات",
    hintEn: "Document stamp and approval",
    group: "daily",
  },
  {
    id: "work_proof",
    ar: "إثبات العمل",
    en: "Work proof",
    hintAr: "أدلة ميدانية وإثبات للعميل",
    hintEn: "Field evidence and client proof",
    group: "daily",
  },
  {
    id: "daily_report",
    ar: "التقرير اليومي",
    en: "Daily report",
    hintAr: "ملخص تشغيل اليوم",
    hintEn: "Day operations summary",
    group: "daily",
  },
  {
    id: "chat",
    ar: "المحادثات التشغيلية",
    en: "Operations chat",
    hintAr: "تواصل الفرق في الفرع",
    hintEn: "Team communication",
    group: "daily",
  },
  // Workforce
  {
    id: "hr",
    ar: "الموارد البشرية",
    en: "Human resources",
    hintAr: "الدليل والهيكل",
    hintEn: "Directory and org",
    group: "workforce",
  },
  {
    id: "performance",
    ar: "الأداء",
    en: "Performance",
    hintAr: "مؤشرات وإثبات الجهد",
    hintEn: "Metrics and effort proof",
    group: "workforce",
  },
  {
    id: "employees",
    ar: "ملفات الموظفين",
    en: "Employee files",
    hintAr: "تعبئة ملفات نفس الفرع",
    hintEn: "Fill files in the same branch",
    group: "workforce",
  },
  // Care & compliance
  {
    id: "safety",
    ar: "السلامة HSE",
    en: "Safety HSE",
    hintAr: "ملاحظات ومخاطر الفرع",
    hintEn: "Hazards and site notes",
    group: "compliance",
  },
  {
    id: "complaints",
    ar: "صوت الموظف",
    en: "Employee Voice",
    hintAr: "للمالك فقط منحه",
    hintEn: "Owner grants only",
    group: "compliance",
    ownerOnly: true,
  },
  // Money
  {
    id: "expenses",
    ar: "المصروفات",
    en: "Expenses",
    hintAr: "مطالبات ومصاريف الفرع",
    hintEn: "Branch claims and spend",
    group: "money",
  },
  {
    id: "assets",
    ar: "الأصول / العهد",
    en: "Assets / Custody",
    hintAr: "سجل الأصول والعهدة",
    hintEn: "Asset register and custody",
    group: "money",
  },
  {
    id: "inventory",
    ar: "المخزون",
    en: "Inventory",
    hintAr: "صرف وطلبات الفرع",
    hintEn: "Branch stock and requests",
    group: "money",
  },
  {
    id: "payroll",
    ar: "الرواتب",
    en: "Payroll",
    hintAr: "للمالك فقط منحه",
    hintEn: "Owner grants only",
    group: "money",
    ownerOnly: true,
  },
  // Admin
  {
    id: "reports",
    ar: "التقارير والتحليلات",
    en: "Reports & analytics",
    hintAr: "لوحات ومتابعة",
    hintEn: "Dashboards and tracking",
    group: "admin",
  },
  {
    id: "files",
    ar: "الملفات",
    en: "Files",
    hintAr: "مستندات الشركة",
    hintEn: "Company documents",
    group: "admin",
  },
  {
    id: "assistant",
    ar: "المساعد الذكي",
    en: "AI assistant",
    hintAr: "أسئلة ضمن الصلاحيات",
    hintEn: "Ask within permissions",
    group: "admin",
  },
];

export const SMART_SECTION_GROUPS = [
  { id: "daily", ar: "دورة الإثبات", en: "Proof cycle" },
  { id: "workforce", ar: "القوى العاملة", en: "Workforce" },
  { id: "compliance", ar: "الالتزام والرعاية", en: "Care & compliance" },
  { id: "money", ar: "المال والأصول", en: "Money & assets" },
  { id: "admin", ar: "المؤسسة", en: "Institution" },
];

/** department id → routes removed when not granted (after owner composed access). */
export const SMART_SECTION_ROUTES = {
  tasks: ["/app/tasks"],
  attendance: ["/app/attendance", "/app/shifts", "/app/leave"],
  daily_report: ["/app/daily-report"],
  chat: ["/app/chat"],
  performance: ["/app/performance"],
  hr: ["/app/hr", "/app/org", "/app/discipline"],
  employees: [],
  safety: ["/app/safety"],
  work_proof: ["/app/work-proof", "/app/client-proof"],
  signing: ["/app/signing"],
  complaints: ["/app/complaints"],
  expenses: ["/app/expenses"],
  assets: ["/app/assets"],
  inventory: ["/app/inventory"],
  payroll: ["/app/payroll"],
  reports: ["/app/daily-report"],
  files: ["/app/files"],
  assistant: ["/app/assistant"],
};

export const rankFromScore = (score) => (score >= 13 ? "executive" : score >= 8 ? "manager" : score >= 4 ? "supervisor" : "employee");
export const rankLabel = (rank, ar) => ({
  employee: ar ? "موظف" : "Employee",
  supervisor: ar ? "مشرف" : "Supervisor",
  manager: ar ? "مدير" : "Manager",
  executive: ar ? "مدير تنفيذي" : "Executive Director",
}[rank]);
export const scorePermissions = (permissions = {}) => Object.values(permissions).reduce((sum, access) => sum + (access === "manage" ? 2 : access === "view" ? 1 : 0), 0);

export function suggestSmartTitle(permissions = {}, ar = false) {
  const has = (...ids) => ids.every((id) => permissions[id]);
  const score = scorePermissions(permissions);
  if (score >= 13) return ar ? "مدير تنفيذي للعمليات" : "Executive Operations Director";
  if (has("payroll", "employees") || has("hr", "employees")) return ar ? "مدير موارد بشرية" : "Human Resources Manager";
  if (has("expenses") || has("payroll")) return ar ? "مسؤول مالية" : "Finance officer";
  if (has("safety", "attendance")) return ar ? "مشرف عمليات" : "Operations Supervisor";
  if (has("complaints", "performance")) return ar ? "مدير جودة" : "Quality Manager";
  if (has("inventory", "attendance")) return ar ? "مشرف تشغيل" : "Operations Coordinator";
  const first = SMART_DEPARTMENTS.find((department) => permissions[department.id]);
  return first ? `${rankLabel(rankFromScore(score), ar)} ${ar ? first.ar : first.en}` : "";
}

export function saveSmartPosition(companyId, employeeId, title, permissions, titleManual = false) {
  const score = scorePermissions(permissions);
  updateCompany(companyId, (data) => {
    data.smartPositions = data.smartPositions || [];
    const index = data.smartPositions.findIndex((item) => item.employeeId === employeeId);
    const previous = index >= 0 ? data.smartPositions[index] : null;
    const record = {
      employeeId,
      title,
      titleManual,
      permissions,
      score,
      rank: rankFromScore(score),
      manualOrder: previous?.manualOrder,
      updatedAt: new Date().toISOString(),
    };
    if (index >= 0) data.smartPositions[index] = record;
    else data.smartPositions.push(record);
  });
}

export function reorderSmartRank(companyId, rank, employeeIds) {
  updateCompany(companyId, (data) => {
    (data.smartPositions || []).forEach((position) => {
      if (position.rank === rank) position.manualOrder = employeeIds.indexOf(position.employeeId);
    });
  });
}
