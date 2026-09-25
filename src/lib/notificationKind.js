import {
  Bell, CalendarClock, CalendarOff, ListTodo, MessageSquare,
  Package, PenLine, Shield, Trophy,
} from "lucide-react";
import { formatDate } from "./dateFormat.js";
import { leaveDecisionNoticeText } from "./leaveEntitlementCycle.js";
import { voiceDecisionNoticeText } from "./voiceBoard.js";
import { LEAVE_TYPES, leaveTypeLabel } from "./leaveTypes.js";

const KINDS = [
  { id: "inventory", routeHint: "/app/inventory", keywords: ["inventory", "stock", "مخزون", "مواد", "صرف للعمل"], icon: Package, tone: "warn", ar: "مخزون", en: "Stock" },
  { id: "expenses", routeHint: "/app/expenses", keywords: ["مصروف", "مطالبة", "المالية", "المدير المالي", "وعاء الفرع", "operating claim", "expense claim", "cfo"], icon: Bell, tone: "navy", ar: "مصروفات", en: "Expenses" },
  { id: "assets", routeHint: "/app/assets", keywords: ["أصل", "عهد", "نقل أصل", "المنشأ", "asset transfer", "custody"], icon: Package, tone: "navy", ar: "أصول", en: "Assets" },
  { id: "payroll", routeHint: "/app/payroll", keywords: ["راتب", "مسير", "أجور", "مدفوع", "payroll", "wage"], icon: Shield, tone: "ok", ar: "رواتب", en: "Payroll" },
  { id: "task", routeHint: "/app/tasks", keywords: ["task", "overdue", "مهمة", "متأخر", "تصعيد"], icon: ListTodo, tone: "bad", ar: "مهام", en: "Tasks" },
  { id: "attendance", routeHint: "/app/attendance", keywords: ["attendance", "check-in", "late", "absent", "حضور", "انصراف", "تأخير", "غياب"], icon: CalendarClock, tone: "navy", ar: "حضور", en: "Attendance" },
  { id: "leave", routeHint: "/app/requests", keywords: ["leave", "vacation", "إجازة", "إجازت"], icon: CalendarOff, tone: "navy", ar: "إجازة", en: "Leave" },
  { id: "requests", routeHint: "/app/requests", keywords: ["request", "شهادة", "استئذان", "سلفة", "طلب", "موافقة خطية", "18632", "ليلي", "دراسة", "موافقة دراسية", "امتحان"], icon: CalendarOff, tone: "navy", ar: "طلباتي", en: "Requests" },
  { id: "chat", routeHint: "/app", keywords: ["message", "chat", "رسالة", "محادثة"], icon: MessageSquare, tone: "navy", ar: "محادثة", en: "Chat" },
  { id: "signing", routeHint: "/app/signing", keywords: ["signature", "signing", "توقيع"], icon: PenLine, tone: "ok", ar: "توقيع", en: "Signing" },
  { id: "compliance", routeHint: "/app/hr", keywords: ["وثيقة", "عقد", "حماية الأجور", "نطاقات", "حظر الشمس", "expired document", "wps"], icon: Shield, tone: "bad", ar: "امتثال", en: "Compliance" },
  { id: "safety", routeHint: "/app/safety", keywords: ["safety", "incident", "سلامة", "حادث"], icon: Shield, tone: "bad", ar: "سلامة", en: "Safety" },
  { id: "performance", routeHint: "/app/performance", keywords: ["point", "نقاط", "إنجاز"], icon: Trophy, tone: "ok", ar: "أداء", en: "Performance" },
];

const TONE = {
  ok: { bg: "var(--nv-ok-soft)", fg: "var(--nv-ok-ink)" },
  warn: { bg: "var(--tint-amber-bg)", fg: "var(--tint-amber-fg)" },
  bad: { bg: "var(--nv-bad-soft)", fg: "var(--nv-bad-ink)" },
  navy: { bg: "var(--nv-mute-soft)", fg: "var(--nv-ink)" },
};

const ISO_DAY = /\b(\d{4}-\d{2}-\d{2})\b/g;

function localizeNotificationDates(text, lang = "ar") {
  const ar = lang === "ar";
  let out = String(text || "").replace(ISO_DAY, (iso) => (
    formatDate(iso, lang, { day: "numeric", month: "long", year: "numeric" }) || iso
  ));
  out = out.replace(/(\d{1,2} \S+ \d{4})\s*→\s*\1/g, "$1");
  for (const row of LEAVE_TYPES) {
    out = out.replace(new RegExp(`\\(${row.key}\\)`, "gi"), `(${leaveTypeLabel(row.key, ar)})`);
  }
  return out;
}

export function cleanNotificationText(text, lang = "ar") {
  return localizeNotificationDates(
    String(text || "")
      .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "")
      .replace(/\s+/g, " ")
      .trim(),
    lang,
  );
}

/** Current UI language: stored leave-decision payload, else ISO dates inside the baked string. */
export function formatNotificationText(note, lang = "ar") {
  if (note && typeof note === "object" && note.leaveDecision) {
    return leaveDecisionNoticeText(note.leaveDecision, lang);
  }
  if (note && typeof note === "object" && note.voiceNotice) {
    return voiceDecisionNoticeText(note.voiceNotice, lang);
  }
  return cleanNotificationText(typeof note === "string" ? note : note?.text, lang);
}

/** Digital-signing desk completions — they do not belong in طلباتي. */
export function isSigningDeskNotice(text) {
  return /اكتمل التوقيع|يمكن تنزيل النسخة|توقيع مع رفض|signing completed|final copy can be downloaded/i.test(String(text || ""));
}

/** Asset register & custody events — «أصول» owns them, not طلباتي, even though a
 *  transfer request says «طلب» and a handover says «عهدة». */
export function isAssetDeskNotice(text) {
  // Every asset notice names the asset in guillemets right after the word أصل.
  const value = String(text || "");
  return /أصل\s*«/.test(value) || /asset «|custody of asset/i.test(value);
}

/** Stock desk — material requests stay in المخزون, not طلباتي, even though the line says «طلب». */
export function isInventoryDeskNotice(text) {
  const value = String(text || "");
  return /طلب مخزون|طلب المخزون|طلب مادة|طلب مواد|صرف للعمل|صُرف مخزون|حركة المخزون|stock request|material request|inventory request|issued to work/i.test(value);
}

export function isRequestWorkspaceNotice(text) {
  const value = String(text || "");
  if (isSigningDeskNotice(value) || isAssetDeskNotice(value) || isInventoryDeskNotice(value)) return false;
  return /إجازة|طلب|شهادة|موافقة|موافقته|عهدة|سلفة|رصيد|ليلي|18632|leave|request|consent|letter/i.test(value);
}

export function kindForNotification(text) {
  const lower = String(text || "").toLowerCase();
  const signing = KINDS.find((kind) => kind.id === "signing");
  if (signing?.keywords.some((key) => lower.includes(key))) return signing;
  return KINDS.find((kind) => kind.keywords.some((key) => lower.includes(key)))
    || { id: "general", icon: Bell, tone: "navy", ar: "إشعار", en: "Notice" };
}

export function isChatNotification(text) {
  return kindForNotification(text).id === "chat";
}

/** Red pill on the scope bar — overdue, safety, and compliance only. */
export function isUrgentNotification(text) {
  return kindForNotification(text).tone === "bad";
}

const ESCALATE_MS = 48 * 60 * 60 * 1000;

/** An urgent notice with no action rises after 48 hours. */
export function notificationEscalated(note) {
  if (!note || note.read || !isUrgentNotification(note.text)) return false;
  const then = new Date(note.createdAt || 0).getTime();
  return Number.isFinite(then) && Date.now() - then >= ESCALATE_MS;
}

export function notificationKindChoices() {
  return KINDS.filter((kind) => kind.id !== "chat").map((kind) => ({ id: kind.id, ar: kind.ar, en: kind.en }));
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
  return then.toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short" });
}
