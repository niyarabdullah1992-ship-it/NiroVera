// Infers which app page a notification refers to, based on its message text.
// Notifications only carry a text message (from Supabase or local events),
// so we match keywords in both English and Arabic.
const RULES = [
  { route: "/app/signing", keywords: ["signature", "signing", "signed", "sign the", "توقيع", "وقّع", "وقع المستند"] },
  { route: "/app/complaints", keywords: ["complaint", "شكوى", "شكاوى", "بلاغ"] },
  { route: "/app/inventory", keywords: ["inventory", "stock", "material request", "مخزون", "مواد", "طلب معتمد", "صرف للعمل"] },
  { route: "/app/expenses", keywords: ["مصروف", "مطالبة مصروف", "المدير المالي", "وعاء الفرع", "operating claim", "expense claim"] },
  { route: "/app/assets", keywords: ["نقل أصل", "أصل «", "المنشأ يبقى", "asset transfer", "custody"] },
  { route: "/app/attendance", keywords: ["attendance", "check-in", "check in", "checked in", "late", "absent", "shift", "schedule", "حضور", "انصراف", "تأخير", "غياب", "غائب", "وردية", "جدول"] },
  { route: "/app/requests/manage", keywords: ["مستحق موافقة خطية ليلية", "موافقة ليلية سارية", "سحب موافقته الخطية", "night consent is in force", "is due for night", "بانتظار مراجعتك", "needs your review", "بشأن:"] },
  { route: "/app/requests", keywords: ["اعتُمدت إجازتك", "اعتُمدت إجازة", "تهانينا", "مبارك", "شفاك", "تقبّل الله", "عظّم الله", "your leave was approved", "ليلي", "ليلية", "18632", "تقليص الساعات", "night-work", "night work", "موافقة خطية", "written consent"] },
  { route: "/app/requests/leave", keywords: ["leave request", "leave ", "vacation", "إجازة", "طلب إجازة", "استحقاق", "رصيدك", "رفع رصيد"] },
  { route: "/app/requests/other", keywords: ["salary letter", "permission", "overtime request", "advance", "شهادة راتب", "استئذان", "سلفة", "طلب آخر", "موافقة دراسية", "study consent"] },
  { route: "/app/hr", keywords: ["وثيقة", "عقد", "نطاقات", "هوية", "expired document", "contract"] },
  { route: "/app/payroll", keywords: ["حماية الأجور", "wps", "مسير", "راتب", "أُشر كمدفوع", "payroll"] },
  { route: "/app/tasks", keywords: ["escalat", "overdue", "تصعيد", "متأخر"] },
  { route: "/app/tasks", keywords: ["reminder", "planner", "تذكير", "مخطط"] },
  { route: "/app/tasks", keywords: ["target", "task", "progress", "مهمة", "مهام", "هدف", "تقدم", "إنجاز"] },
];

export function routeForNotification(text) {
  const lower = String(text || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.route;
  }
  return "/app";
}