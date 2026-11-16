/** Single source (client + server). Client re-exports via src/lib/dailyReportDerivations.js */

export const DEFAULT_SHIFT_END = "14:00";

export const DAILY_FILE_ROLES = [
  "station_manager",
  "ops_manager",
  "director",
  "owner",
  "pgm",
  "admin",
];

export const DAILY_APPROVE_ROLES = [
  "ops_manager",
  "director",
  "owner",
  "pgm",
  "admin",
];

export function parseHm(hm) {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function isLateSubmit(filedAt, shiftEnd = DEFAULT_SHIFT_END) {
  const t = parseHm(filedAt);
  const end = parseHm(shiftEnd);
  if (t == null || end == null) return false;
  return t > end;
}

export function deriveStationFacts({ tasksClosed = 0, openHazards = 0, unexcusedAbsences = 0, proofsApproved = 0 } = {}) {
  return [
    { id: "tasks", value: Math.max(0, Number(tasksClosed) || 0), link: "ops", bad: false },
    { id: "hazards", value: Math.max(0, Number(openHazards) || 0), link: "hse", bad: true },
    { id: "absence", value: Math.max(0, Number(unexcusedAbsences) || 0), link: "attendance", bad: true },
    { id: "proofs", value: Math.max(0, Number(proofsApproved) || 0), link: "workproof", bad: false },
  ];
}

export function deriveDailyRowStatus(report, { shiftEnd = DEFAULT_SHIFT_END, shiftEnded = false } = {}) {
  const filedAt = report.filedAt || null;
  const isLate = isLateSubmit(filedAt, shiftEnd);
  const approved = !!report.approved;
  const missing = !approved && !filedAt;
  const overdueMissing = missing && shiftEnded;
  let status = "missing";
  if (approved) status = "approved";
  else if (filedAt && isLate) status = "late";
  else if (filedAt && report.returnedAt) status = "review";
  else if (filedAt) status = "ok";
  else if (overdueMissing) status = "late";
  return {
    stationId: report.stationId,
    filedAt: filedAt || "—",
    isLate: approved ? isLate : isLate || overdueMissing,
    approved,
    missing,
    canApprove: !approved && !!filedAt,
    status,
    lateChip: approved && isLate,
    canCloseShift: !!approved && !!filedAt,
  };
}

export function canFileDailyRole(role, owner = false) {
  if (owner) return true;
  return DAILY_FILE_ROLES.includes(String(role || ""));
}

export function canApproveDailyRole(role, owner = false) {
  if (owner) return true;
  return DAILY_APPROVE_ROLES.includes(String(role || ""));
}

export function checkFileDailyGate({
  role,
  owner = false,
  stationId,
  userStationId,
  managedStations,
  report,
} = {}) {
  if (!canFileDailyRole(role, owner)) {
    return {
      ok: false,
      error: "FORBIDDEN_FILE",
      reason: "رفع التقرير من صلاحية مدير الفرع (أو من ينوب عنه).",
      reasonEn: "Filing is for the station manager (or a higher ops role on their behalf).",
    };
  }
  const sid = String(stationId || "").trim();
  if (!sid) {
    return { ok: false, error: "MISSING_STATION", reason: "الفرع مطلوبة.", reasonEn: "Station is required." };
  }
  if (String(role || "") === "station_manager" && !owner) {
    const managed = (managedStations || []).map(String);
    const home = userStationId != null ? String(userStationId) : "";
    const allowed = managed.includes(sid) || (home && home === sid);
    if (!allowed) {
      return {
        ok: false,
        error: "STATION_SCOPE",
        reason: "لا ترفع تقرير فرع خارج نطاقك.",
        reasonEn: "You cannot file a report for a station outside your scope.",
      };
    }
  }
  if (report?.approved) {
    return {
      ok: false,
      error: "ALREADY_APPROVED",
      reason: "التقرير معتمد — أعده للتصحيح قبل إعادة الرفع.",
      reasonEn: "Report is approved — return it for correction before refiling.",
    };
  }
  return { ok: true };
}

export function checkApproveDailyGate(report) {
  if (!report) {
    return { ok: false, error: "REPORT_NOT_FOUND", reason: "التقرير غير موجود.", reasonEn: "Report not found." };
  }
  if (report.approved) {
    return { ok: false, error: "ALREADY_APPROVED", reason: "التقرير معتمد مسبقًا.", reasonEn: "Report already approved." };
  }
  if (!report.filedAt) {
    return {
      ok: false,
      error: "NOT_FILED",
      reason: "لا اعتماد قبل رفع التقرير من الفرع.",
      reasonEn: "Cannot approve before the station files the report.",
    };
  }
  return { ok: true, isLate: isLateSubmit(report.filedAt) };
}

export function checkApproveDailyRoleGate(role, owner = false) {
  if (!canApproveDailyRole(role, owner)) {
    return {
      ok: false,
      error: "FORBIDDEN_APPROVE",
      reason: "الاعتماد من صلاحية العمليات أو الإدارة — ليس مدير الفرع وحده.",
      reasonEn: "Approval is for ops / leadership — not the station manager alone.",
    };
  }
  return { ok: true };
}

export function checkCloseShiftDailyGate(report) {
  if (!report?.filedAt) {
    return {
      ok: false,
      error: "SHIFT_OPEN_NOT_FILED",
      reason: "لا إغلاق للوردية قبل رفع التقرير اليومي.",
      reasonEn: "The shift cannot close before the daily report is filed.",
    };
  }
  if (!report.approved) {
    return {
      ok: false,
      error: "SHIFT_OPEN_NOT_APPROVED",
      reason: "لا إغلاق للوردية قبل اعتماد التقرير من المشرف.",
      reasonEn: "The shift cannot close before the supervisor approves the report.",
    };
  }
  return { ok: true };
}

export function checkIssueSignedDailyGate({ rows = [], alreadyIssued = false } = {}) {
  if (alreadyIssued) {
    return {
      ok: false,
      error: "ALREADY_ISSUED",
      reason: "حُصيلة اليوم الموقّعة صدرت مسبقًا — مرة واحدة في اليوم.",
      reasonEn: "Today's signed daily record was already issued — once per day.",
    };
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    return {
      ok: false,
      error: "NO_ROWS",
      reason: "لا فروع لإصدار الحصيلة.",
      reasonEn: "No stations to issue a signed record for.",
    };
  }
  const pending = list.filter((r) => !r.approved);
  if (pending.length) {
    return {
      ok: false,
      error: "NOT_ALL_APPROVED",
      reason: `لا إصدار قبل اعتماد كل التقارير (${pending.length} متبقية).`,
      reasonEn: `Cannot issue until every report is approved (${pending.length} left).`,
    };
  }
  return { ok: true };
}

export function buildShortDailyNote(facts = [], ar = true) {
  const get = (id) => facts.find((f) => f.id === id)?.value ?? 0;
  if (ar) {
    return `مهام مغلقة ${get("tasks")} · مخاطر ${get("hazards")} · غياب ${get("absence")} · إثباتات ${get("proofs")}`;
  }
  return `Closed tasks ${get("tasks")} · hazards ${get("hazards")} · absences ${get("absence")} · proofs ${get("proofs")}`;
}

export function deriveDailySummary(rows = []) {
  const total = rows.length;
  const submitted = rows.filter((r) => r.filedAt && r.filedAt !== "—").length;
  const late = rows.filter((r) => r.isLate).length;
  const ready = rows.filter((r) => r.canApprove).length;
  const missing = rows.filter((r) => r.missing).length;
  const closable = rows.filter((r) => r.approved).length;
  const mins = rows.map((r) => parseHm(r.filedAt === "—" ? null : r.filedAt)).filter((n) => n != null);
  const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null;
  const avgHm = avg == null ? null : `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
  return { total, submitted, late, ready, missing, closable, avgSubmitTime: avgHm };
}

export function riyadhDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
