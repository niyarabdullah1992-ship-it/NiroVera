/**
 * Derived Money & Assets notices — Arabic text names the reason and links the surface.
 * Never invent amounts; pass only figures already on the record.
 */
import { addNotification, getCompanyData } from "@/lib/store";

export function moneyNoticeLang() {
  try {
    return localStorage.getItem("powercare_lang") === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function notifyMoney(companyId, userId, { ar, en, to, key }) {
  if (!companyId || !userId || (!ar && !en)) return;
  const text = moneyNoticeLang() === "en" ? (en || ar) : (ar || en);
  addNotification(companyId, userId, text, { to, key });
}

export function notifyMoneyMany(companyId, userIds, payload) {
  const seen = new Set();
  for (const id of userIds || []) {
    const key = String(id || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    notifyMoney(companyId, key, payload);
  }
}

/** Finance / directors / owner — people who close money gates. */
export function moneyReviewerIds(data) {
  const ids = [];
  if (data?.ownerId) ids.push(data.ownerId);
  for (const emp of data?.employees || []) {
    if (["owner", "director", "ops_manager", "financial_officer", "admin"].includes(emp.role)) {
      ids.push(emp.id);
    }
  }
  return ids;
}

export function stationManagerIds(data, stationId) {
  const sid = String(stationId || "");
  return (data?.employees || [])
    .filter((emp) => {
      if (emp.role === "station_manager" && String(emp.stationId) === sid) return true;
      return (emp.managedStations || []).map(String).includes(sid);
    })
    .map((emp) => emp.id);
}

export function notifyMoneyReviewers(companyId, payload) {
  const data = getCompanyData(companyId);
  notifyMoneyMany(companyId, moneyReviewerIds(data), payload);
}
