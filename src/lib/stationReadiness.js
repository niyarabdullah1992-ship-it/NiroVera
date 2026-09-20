/**
 * Per-station readiness derived from the local company register only.
 * Every signal names the surface that clears it — nothing here is entered by
 * hand and nothing is fetched from a government rail (Qiwa/GOSI/Mudad remain
 * deferred until credentials, see GOV_INTEGRATIONS.md).
 */
import { deriveExpiringDocs, deriveNitaqat, checkContractTermGate, EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";

/** Weight per open blocker — readiness is 100 minus what the register still owes. */
const WEIGHT = {
  expiredDoc: 14,
  expiringDoc: 6,
  expiredContract: 14,
  contractEndMissing: 14,
  expiringContract: 6,
  criticalSafety: 18,
  openHazard: 7,
  pendingLeave: 4,
  overdueTask: 6,
};

function employeesAtStation(data, stationId) {
  return (data?.employees || []).filter((e) => String(e.stationId ?? "") === String(stationId));
}

function safetyRecordFor(data, stationId) {
  return (data?.safety || []).find((s) => String(s.stationId) === String(stationId)) || null;
}

function taskStationId(task) {
  return task?.stationId ?? task?.station_id ?? null;
}

/**
 * @returns {{ stationId: string, score: number, level: "ready"|"watch"|"blocked", blockers: Array<{key,ar,en,to,count}>, crew: number, saudiRate: number }}
 */
export function deriveStationReadiness(data, station) {
  const stationId = station?.id;
  const crewList = employeesAtStation(data, stationId);
  const nitaqat = deriveNitaqat(crewList);
  const safety = safetyRecordFor(data, stationId);
  const hazards = (safety?.hazards || []).filter((h) => !h.closedAt);
  const expiring = deriveExpiringDocs(crewList);
  const expiredDocs = expiring.filter((d) => d.days < 0);
  const expiringDocs = expiring.filter((d) => d.days >= 0);
  const pendingLeave = crewList.reduce(
    (sum, e) => sum + (e.leaveRequests || []).filter((r) => r.status === "pending").length,
    0,
  );
  const now = Date.now();
  const overdueTasks = (data?.tasks || []).filter((task) => {
    if (String(taskStationId(task) ?? "") !== String(stationId)) return false;
    if (task.status === "completed") return false;
    const due = task.dueDate || task.dueAt || task.endDate || task.end_date;
    return due && new Date(due).getTime() < now;
  });

  const blockers = [];
  if (expiredDocs.length) {
    blockers.push({
      key: "doc_expired",
      count: expiredDocs.length,
      weight: WEIGHT.expiredDoc * expiredDocs.length,
      to: "/app/hr",
      ar: `${expiredDocs.length} وثيقة نظامية منتهية — لا إسناد قبل التجديد`,
      en: `${expiredDocs.length} statutory documents expired — no assignment before renewal`,
    });
  }
  if (expiringDocs.length) {
    blockers.push({
      key: "doc_expiring",
      count: expiringDocs.length,
      weight: WEIGHT.expiringDoc * expiringDocs.length,
      to: "/app/hr",
      ar: `${expiringDocs.length} وثيقة تنتهي خلال ${EXPIRY_WARN_DAYS} يومًا`,
      en: `${expiringDocs.length} documents expire within ${EXPIRY_WARN_DAYS} days`,
    });
  }
  const expiredContracts = [];
  const missingContractEnds = [];
  const expiringContracts = [];
  for (const emp of crewList) {
    const gate = checkContractTermGate(emp);
    if (gate.error === "CONTRACT_EXPIRED") expiredContracts.push(emp);
    else if (gate.error === "CONTRACT_END_REQUIRED") missingContractEnds.push(emp);
    else if (gate.warning === "CONTRACT_EXPIRING") expiringContracts.push(emp);
  }
  if (expiredContracts.length) {
    blockers.push({
      key: "contract_expired",
      count: expiredContracts.length,
      weight: WEIGHT.expiredContract * expiredContracts.length,
      to: "/app/hr",
      ar: `${expiredContracts.length} عقد محدد المدة منتهٍ — لا إسناد قبل التجديد`,
      en: `${expiredContracts.length} fixed-term contracts expired — no assignment before renewal`,
    });
  }
  if (missingContractEnds.length) {
    blockers.push({
      key: "contract_end_required",
      count: missingContractEnds.length,
      weight: WEIGHT.contractEndMissing * missingContractEnds.length,
      to: "/app/hr",
      ar: `${missingContractEnds.length} عقد محدد المدة بلا تاريخ نهاية`,
      en: `${missingContractEnds.length} fixed-term contracts missing an end date`,
    });
  }
  if (expiringContracts.length) {
    blockers.push({
      key: "contract_expiring",
      count: expiringContracts.length,
      weight: WEIGHT.expiringContract * expiringContracts.length,
      to: "/app/hr",
      ar: `${expiringContracts.length} عقد محدد المدة ينتهي خلال ${EXPIRY_WARN_DAYS} يومًا`,
      en: `${expiringContracts.length} fixed-term contracts end within ${EXPIRY_WARN_DAYS} days`,
    });
  }
  if (safety?.level === "red") {
    blockers.push({
      key: "safety_critical",
      count: 1,
      weight: WEIGHT.criticalSafety,
      to: "/app/safety",
      ar: "الفرع بمستوى سلامة حرج — الاعتماد موقوف حتى إغلاق السبب",
      en: "Station at critical safety level — approval blocked until the cause is closed",
    });
  }
  if (hazards.length) {
    blockers.push({
      key: "hazards_open",
      count: hazards.length,
      weight: WEIGHT.openHazard * hazards.length,
      to: "/app/safety",
      ar: `${hazards.length} مخاطر مفتوحة بانتظار الإغلاق`,
      en: `${hazards.length} open hazards awaiting closure`,
    });
  }
  if (pendingLeave) {
    blockers.push({
      key: "leave_pending",
      count: pendingLeave,
      weight: WEIGHT.pendingLeave * pendingLeave,
      to: "/app/requests/leave",
      ar: `${pendingLeave} طلب إجازة نظامية بانتظار القرار (نظام العمل م.109)`,
      en: `${pendingLeave} statutory leave requests awaiting a decision (Labour Law art.109)`,
    });
  }
  if (overdueTasks.length) {
    blockers.push({
      key: "task_overdue",
      count: overdueTasks.length,
      weight: WEIGHT.overdueTask * overdueTasks.length,
      to: "/app/tasks",
      ar: `${overdueTasks.length} مهمة تجاوزت الاستحقاق`,
      en: `${overdueTasks.length} tasks past their due date`,
    });
  }

  const penalty = blockers.reduce((sum, b) => sum + b.weight, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const level = score >= 85 ? "ready" : score >= 55 ? "watch" : "blocked";

  return {
    stationId,
    score,
    level,
    blockers: blockers.sort((a, b) => b.weight - a.weight),
    crew: crewList.length,
    saudiRate: nitaqat.rate,
  };
}

export function deriveReadinessByStation(data, stations) {
  const map = new Map();
  for (const station of stations || []) {
    map.set(String(station.id), deriveStationReadiness(data, station));
  }
  return map;
}

export const READINESS_COLOR = {
  ready: "#1E9E63",
  watch: "#F59E0B",
  blocked: "#DC2626",
};

export function readinessLabel(level, ar) {
  if (level === "ready") return ar ? "جاهزة" : "Ready";
  if (level === "watch") return ar ? "تحت المتابعة" : "Watch";
  return ar ? "موقوفة بسبب" : "Blocked";
}
