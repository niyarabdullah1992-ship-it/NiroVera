import { kindForNotification } from "@/lib/notificationKind";

const EVENT = "powercare:notif-prefs";

function keyFor(companyId, userId) {
  return `powercare_notif_kinds_${companyId}_${userId}`;
}

export function readNotificationKinds(companyId, userId) {
  if (!companyId || !userId) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(companyId, userId)) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function notificationKindAllowed(text, companyId, userId) {
  const prefs = readNotificationKinds(companyId, userId);
  const id = kindForNotification(text).id;
  return prefs[id] !== false;
}

export function writeNotificationKind(companyId, userId, id, on) {
  if (!companyId || !userId || !id) return {};
  const next = { ...readNotificationKinds(companyId, userId), [id]: Boolean(on) };
  localStorage.setItem(keyFor(companyId, userId), JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
  return next;
}

export const NOTIFICATION_PREFS_EVENT = EVENT;
