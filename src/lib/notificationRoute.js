// Infers which app page a notification refers to, based on its message text.
// Notifications only carry a text message (from Supabase or local events),
// so we match keywords in both English and Arabic.
const RULES = [
  { route: "/app/signing", keywords: ["signature", "signing", "signed", "sign the", "توقيع", "وقّع", "وقع المستند"] },
  { route: "/app/complaints", keywords: ["complaint", "شكوى", "شكاوى", "بلاغ"] },
  { route: "/app/chat", keywords: ["message", "chat", "رسالة", "محادثة", "دردشة"] },
  { route: "/app/inventory", keywords: ["inventory", "stock", "material request", "مخزون", "مواد", "طلب معتمد"] },
  { route: "/app/attendance", keywords: ["attendance", "check-in", "check in", "checked in", "late", "absent", "shift", "schedule", "حضور", "انصراف", "تأخير", "غياب", "غائب", "وردية", "جدول"] },
  { route: "/app/leave", keywords: ["leave request", "leave ", "vacation", "إجازة", "طلب إجازة"] },
  { route: "/app/hr", keywords: ["وثيقة", "عقد", "نطاقات", "هوية", "expired document", "contract"] },
  { route: "/app/payroll", keywords: ["حماية الأجور", "wps", "مسير"] },
  { route: "/app/tasks", keywords: ["escalat", "overdue", "تصعيد", "متأخر"] },
  { route: "/app/daily-report", keywords: ["daily report", "تقرير يومي"] },
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