import {
  Bell, CalendarClock, CalendarOff, ListTodo, MessageSquare,
  Package, PenLine, Shield, Trophy,
} from "lucide-react";

const KINDS = [
  { id: "inventory", routeHint: "/app/inventory", keywords: ["inventory", "stock", "مخزون", "مواد"], icon: Package, tone: "warn", ar: "مخزون", en: "Stock" },
  { id: "task", routeHint: "/app/tasks", keywords: ["task", "overdue", "مهمة", "متأخر", "تصعيد"], icon: ListTodo, tone: "bad", ar: "مهام", en: "Tasks" },
  { id: "attendance", routeHint: "/app/attendance", keywords: ["attendance", "check-in", "late", "absent", "حضور", "انصراف", "تأخير", "غياب"], icon: CalendarClock, tone: "navy", ar: "حضور", en: "Attendance" },
  { id: "leave", routeHint: "/app/leave", keywords: ["leave", "vacation", "إجازة"], icon: CalendarOff, tone: "navy", ar: "إجازة", en: "Leave" },
  { id: "chat", routeHint: "/app/chat", keywords: ["message", "chat", "رسالة", "محادثة"], icon: MessageSquare, tone: "navy", ar: "محادثة", en: "Chat" },
  { id: "signing", routeHint: "/app/signing", keywords: ["signature", "signing", "توقيع"], icon: PenLine, tone: "ok", ar: "توقيع", en: "Signing" },
  { id: "compliance", routeHint: "/app/hr", keywords: ["وثيقة", "عقد", "حماية الأجور", "نطاقات", "حظر الشمس", "expired document", "wps"], icon: Shield, tone: "bad", ar: "امتثال", en: "Compliance" },
  { id: "safety", routeHint: "/app/safety", keywords: ["safety", "incident", "سلامة", "حادث"], icon: Shield, tone: "bad", ar: "سلامة", en: "Safety" },
  { id: "performance", routeHint: "/app/performance", keywords: ["point", "نقاط", "إنجاز"], icon: Trophy, tone: "ok", ar: "أداء", en: "Performance" },
];

const TONE = {
  ok: { bg: "#ECFDF3", fg: "#15803D" },
  warn: { bg: "#FFFBEB", fg: "#B45309" },
  bad: { bg: "#FEF2F2", fg: "#DC2626" },
  navy: { bg: "#F1F5F9", fg: "#14284B" },
};

export function cleanNotificationText(text) {
  return String(text || "")
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function kindForNotification(text) {
  const lower = String(text || "").toLowerCase();
  return KINDS.find((kind) => kind.keywords.some((key) => lower.includes(key)))
    || { id: "general", icon: Bell, tone: "navy", ar: "إشعار", en: "Notice" };
}

export function isChatNotification(text) {
  return kindForNotification(text).id === "chat";
}

export function notificationTone(kind) {
  return TONE[kind.tone] || TONE.navy;
}

export function relativeNotificationTime(iso, lang) {
  const ar = lang === "ar";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (mins < 1) return ar ? "الآن" : "Just now";
  if (mins < 60) return ar ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return ar ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return ar ? "أمس" : "Yesterday";
  if (days < 7) return ar ? `منذ ${days} أيام` : `${days}d ago`;
  return then.toLocaleDateString(ar ? "ar-SA" : "en-GB", { day: "numeric", month: "short" });
}
