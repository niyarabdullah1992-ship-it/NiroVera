/**
 * In-app notifications — self visibility by userId.
 */

export const NOTIFICATION_FACTS = Object.freeze([
  {
    id: "notify.inbox",
    domain: "notifications",
    scope: "notification",
    home: "notifications",
    path: "notifications",
    blobCategory: "notifications",
    writer: "notify-system",
    stored: true,
    isolation: "companyId",
    surfaceAr: "التنبيهات",
    noteAr: "userId → Employee. الكاتب عادة النظام / الاشتقاق.",
  },
  {
    id: "notify.prefs",
    domain: "notifications",
    scope: "prefs",
    home: "employee / company settings prefs",
    path: "notificationPrefs",
    writer: "hr-file",
    stored: true,
    isolation: "companyId",
    surfaceAr: "تفضيلات التنبيه",
  },
]);

export function readNotifications(company) {
  return Array.isArray(company?.notifications) ? company.notifications : [];
}

export function notificationsForUser(company, userId) {
  const id = String(userId || "");
  if (!id) return [];
  return readNotifications(company).filter((row) => String(row?.userId || "") === id);
}
