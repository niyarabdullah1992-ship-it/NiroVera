// Pure: no React, no store — the rail and its node tests import it.
/**
 * The management sections, exactly as the management side lists them. A person is given each one as
 * «يدير» (manage) or «لا يدير» (hidden); nothing in between. Voice and pay are granted by the owner only.
 */
export const MANAGE_SECTIONS = [
  { id: "attendance", rail: "duty", ar: "الحضور والدوام", en: "Time & Attendance", hintAr: "البصمات والغياب وجدول الدوام", hintEn: "Punches, absence and the roster", to: "/app/attendance?lane=manage" },
  { id: "tasks", rail: "daily", ar: "المهام والإثبات", en: "Tasks and proof", hintAr: "إنشاء المهام ومراجعتها واعتماد الإثبات", hintEn: "Create, review and approve proof", to: "/app/tasks?lane=manage" },
  { id: "safety", rail: "hse", ar: "السلامة", en: "Safety", hintAr: "بلاغات السلامة والتفتيش", hintEn: "Safety reports and inspections", to: "/app/safety?lane=manage" },
  { id: "hr", rail: "hr", ar: "الموارد البشرية", en: "Human resources", hintAr: "الملفات والهيكل والفروع والتوظيف — ويعدّل الهيكل مباشرة", hintEn: "Files, structure, branches, hiring — edits the structure directly", to: "/app/hr" },
  { id: "requests", rail: "requests", ar: "الطلبات", en: "Requests", hintAr: "اعتماد الإجازات والطلبات", hintEn: "Approve leave and requests", to: "/app/requests/manage" },
  { id: "discipline", rail: "discipline", ar: "الجزاءات", en: "Sanctions", hintAr: "رفع المخالفات وإصدار الجزاءات", hintEn: "Raise violations and issue sanctions", to: "/app/discipline?tab=manage&lane=manage" },
  { id: "complaints", rail: "complaints", ar: "صوت الموظف", en: "Employee voice", hintAr: "استلام الاقتراحات والشكاوى والبلاغات", hintEn: "Receive suggestions, complaints and reports", to: "/app/complaints?tab=manage", ownerOnly: true },
  { id: "performance", rail: "performance", ar: "الأداء", en: "Performance", hintAr: "تقييم الأداء ومؤشراته", hintEn: "Performance scoring and metrics", to: "/app/performance?view=manage" },
  { id: "payroll", rail: "money", ar: "المال والرواتب", en: "Pay and money", hintAr: "مسير الرواتب والبدلات", hintEn: "Payroll and allowances", to: "/app/payroll?view=manage", ownerOnly: true },
];


/** What the owner granted this person on one section: "manage" · "hidden" · null (nothing set). */
export function sectionGrant(data, userId, sectionId) {
  const id = String(userId || "");
  if (!id) return null;
  const row = (data?.smartPositions || []).find((item) => String(item.employeeId || "") === id);
  const value = row?.permissions?.[sectionId];
  return value === "manage" || value === "hidden" ? value : null;
}
