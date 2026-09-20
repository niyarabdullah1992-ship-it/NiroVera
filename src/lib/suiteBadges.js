/**
 * Suite-rail attention counts — derived from live queues only.
 * Omit the pill when the count is 0. Never invent a number.
 */
import { pendingManagerDecideCount, pendingRequestsCount, isManagerDecideOtherRequest } from "./otherRequestDerivations.js";
import { commandSigningSnapshot, projectRequest } from "./multiSignDerivations.js";
import { deskSigningRows, flattenWrittenConsents, isNightWrittenConsent, isOpenConsent, openWrittenConsentCount } from "./writtenConsent.js";
import {
  canReviewOpsTask,
  isAwaitingApproval,
  isDone,
  isEscalated,
  isOpsTaskDeleted,
  isOverdue,
  taskAssigneeIds,
} from "./opsDerivations.js";
import { checkApproveWorkProofGate } from "./workProofDerivations.js";
import { collectVoiceItems, deriveVoiceBoard } from "./voiceBoard.js";
import { deriveDisciplineBoard } from "./disciplineBoard.js";
import { deriveWpsStatus } from "./payrollDerivations.js";
import { canSeeManagedNightDue, managedDutyEmployees, nightDueAdminCoveredEmployees, nightDueScopeEmployees, requestInboxEmployees, requestInboxMaySee, requestManageEmployees } from "./dutyScope.js";
import { requestSelfEmployee } from "./employeeFileView.js";
import { nightRotateDue, pendingNightRotate } from "./nightRotateCycle.js";
import { scheduleForEmployee } from "./nightDueNotify.js";
import { statutoryGlowState } from "./statutoryItem.js";
import { employeeWorkStationId, weekStartDate } from "./shiftWeek.js";

export function asSuiteBadge(n) {
  const count = Math.max(0, Math.round(Number(n) || 0));
  return count > 0 ? count : undefined;
}

function isOwner(user, data) {
  return !!(user && (user.isOwner || user.role === "owner" || (data?.ownerId && user.id === data.ownerId)));
}

function canManageOps(user, data) {
  return isOwner(user, data) || ["director", "ops_manager", "pgm", "station_manager"].includes(user?.role);
}

function hasHrPerm(user, data, key) {
  if (!user?.hrLevelId) return false;
  const level = (data?.hrLevels || []).find((row) => row.id === user.hrLevelId && row.active !== false);
  return !!(level?.permissions || []).includes(key);
}

function canManageRequests(user, data) {
  return canManageOps(user, data) || hasHrPerm(user, data, "manage_leave");
}

function requestSelf(user, employees) {
  return (employees || []).find((row) => row.id === user?.id) || user || null;
}

function requestAdminEmployees(user, data, employees) {
  if (!canManageRequests(user, data)) return [];
  const inbox = requestInboxEmployees(user, data);
  if (inbox.length) return inbox;
  const managed = requestManageEmployees(user, data).filter((row) => requestInboxMaySee(user, row, data));
  if (managed.length) return managed;
  return (employees || []).filter((row) => requestInboxMaySee(user, row, data));
}

export function isNightDueEmployee(employee, data, weekStart) {
  if (!employee?.id) return false;
  return statutoryGlowState({
    kind: "18632",
    employee,
    schedule: scheduleForEmployee(data, employee),
    weekStart: weekStartDate(weekStart || new Date()),
  }) === "due";
}

/** Visible people whose 18632 glow is due (consent / rotate / pending night rights). */
export function nightDueEmployeeCount(employees = [], data = {}, weekStart) {
  return (employees || []).filter((employee) => isNightDueEmployee(employee, data, weekStart)).length;
}

/** Due but not yet an open طلباتي consent — so the pill moves before the inbox row exists. */
export function nightDueFreshCount(employees = [], data = {}, weekStart) {
  return (employees || []).filter((employee) => (
    isNightDueEmployee(employee, data, weekStart) && !pendingNightRotate(employee)
  )).length;
}

function hasOpenNightConsent(employee) {
  return flattenWrittenConsents([employee]).some((row) => isNightWrittenConsent(row) && isOpenConsent(row));
}

/** إدارة — due / open 18632 rows in the manager's watch, never the viewer's own file. */
export function nightDueAdminEmployees(user, data, weekStart) {
  if (!canSeeManagedNightDue(user, data)) return [];
  return nightDueAdminCoveredEmployees(user, data).filter((employee) => (
    employee.id !== user?.id
    && (
      isNightDueEmployee(employee, data, weekStart)
      || pendingNightRotate(employee)
      || hasOpenNightConsent(employee)
    )
  ));
}

function nightDueAdminLabels(employee, data, weekStart, ar = true) {
  const labels = [];
  if (pendingNightRotate(employee)) {
    labels.push(ar ? "اختيار في طلباتي" : "Choice in Requests");
  }
  if (hasOpenNightConsent(employee) && !pendingNightRotate(employee)) {
    labels.push(ar ? "موافقة خطية مفتوحة" : "Open written consent");
  }
  if (isNightDueEmployee(employee, data, weekStart)) {
    const rotate = nightRotateDue({
      employee,
      schedule: scheduleForEmployee(data, employee),
      weekStart,
    });
    labels.push(ar ? "دوران أو موافقة" : "Rotate or consent");
    if (rotate?.months) labels.push(ar ? `${rotate.months} أشهر` : `${rotate.months} mo`);
  }
  return labels;
}

/** إدارة alerts rail — due people grouped by the stations the manager actually covers. */
export function managerDutyAlertGroups(user, data, weekStart, ar = true) {
  const names = new Map(
    (data?.stations || []).map((station) => [String(station.id), station.name || station.nameAr || station.id]),
  );
  const groups = new Map();
  for (const employee of nightDueAdminEmployees(user, data, weekStart)) {
    const sid = String(employeeWorkStationId(employee) || employee.stationId || "");
    const stationName = names.get(sid) || (ar ? "فرع" : "Station");
    if (!groups.has(sid)) groups.set(sid, { stationId: sid, stationName, people: [] });
    groups.get(sid).people.push({
      id: employee.id,
      name: employee.name,
      href: `/app/employees/${encodeURIComponent(employee.id)}`,
      glow: "due",
      labels: nightDueAdminLabels(employee, data, weekStart, ar),
    });
  }
  return [...groups.values()];
}

/** طلباتي — my open file + manager decide queue across every station in scope. */
export function pendingRequestsBadgeCount(user, data, employees = [], weekStart) {
  const roster = (data?.employees?.length ? data.employees : employees) || [];
  const self = requestSelf(user, roster);
  const mine = self ? pendingRequestsCount([self]) + openWrittenConsentCount([self]) : 0;
  const admin = pendingManagerDecideCount(requestAdminEmployees(user, data, roster));
  const dueFresh = nightDueFreshCount(nightDueScopeEmployees(user, data), data, weekStart);
  return mine + admin + dueFresh;
}

export function needsPunchDecision(employee, attendanceById = {}) {
  const row = attendanceById[String(employee?.id)];
  const asked = (employee?.otherRequests || []).some(
    (item) => (item.type === "manual_punch" || item.type === "checkout_fix") && isManagerDecideOtherRequest(item),
  );
  return !!(
    row?.location_status === "outside"
    || (row?.check_in_at && !row?.check_out_at && row?.status !== "absent")
    || row?.early_checkout
    || asked
  );
}

/** الدوام والحضور — manager punch queue / pending manual punch. */
export function pendingPunchQueueCount(employees = [], attendanceRows = []) {
  const byId = Object.fromEntries(
    (attendanceRows || []).map((row) => [String(row.employee_id ?? row.employeeId), row]),
  );
  return (employees || []).filter((employee) => needsPunchDecision(employee, byId)).length;
}

function projectSigningForUser(record, user) {
  const actor = {
    id: user?.id,
    userId: user?.id,
    email: String(user?.email || "").toLowerCase(),
    name: user?.name || "",
    role: user?.role || "",
  };
  const projected = projectRequest(record, actor);
  if (projected.myStatus) return projected;
  const uid = String(user?.id || "");
  const signer = (record.signers || []).find((row) => String(row.userId || row.employeeId || "") === uid);
  return { ...projected, myStatus: signer?.status || null };
}

/** التوقيع — docs waiting for this user (sign or release). */
export function pendingSigningBadgeCount(requests = [], user) {
  if (!user?.id) return 0;
  const rows = deskSigningRows(requests).map((row) => projectSigningForUser(row, user));
  const snap = commandSigningSnapshot(rows);
  const release = rows.filter((row) => row.canRelease).length;
  return snap.mine + release;
}

/** التشغيل — tasks / reviews waiting on this user. */
export function pendingOpsBadgeCount(tasks = [], user, data, today = new Date()) {
  if (!user) return 0;
  const uid = String(user.id || user.employeeId || "");
  return (tasks || []).filter((task) => {
    if (isOpsTaskDeleted(task) || isDone(task)) return false;
    const reviewWait = (isAwaitingApproval(task) || isEscalated(task)) && canReviewOpsTask(task, user, data);
    const overdueWait = isOverdue(task, today) && (
      canReviewOpsTask(task, user, data) || taskAssigneeIds(task).includes(uid)
    );
    return reviewWait || overdueWait;
  }).length;
}

/** إثبات العمل — ready proofs this user may seal. */
export function pendingWorkProofBadgeCount(proofs = [], user) {
  if (!user?.id) return 0;
  return (proofs || []).filter((proof) => {
    const gate = checkApproveWorkProofGate({ proof, actorUserId: user.id });
    return gate.ok || gate.error === "GEO_CLEARANCE_REQUIRED";
  }).length;
}

function canManageVoice(user, data) {
  return !!(
    isOwner(user, data)
    || ["director", "ops_manager", "pgm", "station_manager"].includes(user?.role)
    || hasHrPerm(user, data, "view_anonymous_reports")
    || hasHrPerm(user, data, "manage_anonymous_reports")
  );
}

/** صوت الموظف — open voices in the reviewer's queue. */
export function pendingVoiceBadgeCount(data, user) {
  if (!canManageVoice(user, data)) return 0;
  const items = collectVoiceItems({
    publicReports: data?.publicReports,
    anonymousReports: data?.anonymousReports,
  });
  const board = deriveVoiceBoard({
    items,
    employees: data?.employees || [],
    stations: data?.stations || [],
    canManage: true,
    userId: user?.id,
  });
  return board.openCount || 0;
}

function canManageDiscipline(user, data) {
  return !!(isOwner(user, data) || user?.hrLevelId || ["director", "ops_manager", "station_manager"].includes(user?.role));
}

/** الجزاءات — open files / objections in scope (or the worker's open file). */
export function pendingDisciplineBadgeCount(data, user) {
  const cases = data?.disciplinaryCases || [];
  const visible = canManageDiscipline(user, data)
    ? cases
    : cases.filter((row) => row.employeeId === user?.id);
  const board = deriveDisciplineBoard({
    cases: visible,
    employees: data?.employees || [],
    stations: data?.stations || [],
    canDecide: canManageDiscipline(user, data),
  });
  return board.openCount || 0;
}

function canReviewExpenseClaims(user, data) {
  return canManageOps(user, data) || user?.role === "financial_officer";
}

function canReviewPayroll(user, data) {
  if (!user) return false;
  if (isOwner(user, data)) return true;
  if (["director", "ops_manager", "pgm"].includes(user.role)) return true;
  return hasHrPerm(user, data, "manage_payroll");
}

function isOpenExpenseClaim(claim, user, data) {
  const status = claim?.status || "pending";
  if (status === "pending" || status === "submitted") return canManageOps(user, data) || isOwner(user, data);
  if (status === "manager_approved") return user?.role === "financial_officer" || isOwner(user, data);
  return false;
}

/** المال — claims / payroll runs waiting a decision. */
export function pendingExpenseBadgeCount(claims = [], user, data) {
  if (!canReviewExpenseClaims(user, data)) return 0;
  return (claims || []).filter((claim) => isOpenExpenseClaim(claim, user, data)).length;
}

export function pendingPayrollBadgeCount(runs = [], user, data) {
  if (!canReviewPayroll(user, data)) return 0;
  return (runs || []).filter((run) => {
    if (!(run.items || []).length) return false;
    return deriveWpsStatus(run).status === "awaiting_approval";
  }).length;
}

function canManageSafety(user, data) {
  return !!(
    isOwner(user, data)
    || ["director", "ops_manager", "pgm", "station_manager", "safety_officer"].includes(user?.role)
  );
}

/** الالتزام — open hazards only (a real HSE queue). */
export function pendingSafetyBadgeCount(safety = [], user, data) {
  if (!canManageSafety(user, data)) return 0;
  return (safety || []).reduce(
    (n, rec) => n + (rec.hazards || []).filter((hazard) => !hazard?.closedAt).length,
    0,
  );
}

function dutyEmployees(user, data, employees) {
  if (!canManageOps(user, data)) return [];
  const managed = new Set(managedDutyEmployees(user, data).map((row) => row.id));
  return (employees || []).filter((row) => managed.has(row.id));
}

/**
 * @param {{
 *   data?: object,
 *   user?: object,
 *   employees?: object[],
 *   attendanceRows?: object[],
 *   inScope?: (stationId: string | null | undefined) => boolean,
 * }} input
 * @returns {{ byApp: Record<string, number | undefined> }}
 */
export function collectSuiteBadges(input = {}) {
  const data = input.data || {};
  const user = input.user || null;
  const employees = input.employees || data.employees || [];
  const attendanceRows = input.attendanceRows || [];
  const scoped = (stationId) => !input.inScope || input.inScope(stationId);

  const weekStart = input.weekStart || new Date();
  const duty = dutyEmployees(user, data, employees);
  const nightScope = nightDueScopeEmployees(user, data);
  const nightDueDuty = nightDueEmployeeCount(nightScope, data, weekStart);
  const nightDueRequests = nightDueDuty;
  const byApp = {
    requests: asSuiteBadge(pendingRequestsBadgeCount(user, data, employees, weekStart)),
    attendance: asSuiteBadge(pendingPunchQueueCount(duty, attendanceRows) + nightDueDuty),
    signing: asSuiteBadge(pendingSigningBadgeCount((data.signatureRequests || []).filter((row) => !row.stationId || scoped(row.stationId)), user)),
    tasks: asSuiteBadge(pendingOpsBadgeCount((data.tasks || []).filter((row) => scoped(row.stationId)), user, data)),
    "work-proof": asSuiteBadge(pendingWorkProofBadgeCount((data.workProofs || []).filter((row) => scoped(row.stationId)), user)),
    complaints: asSuiteBadge(pendingVoiceBadgeCount(data, user)),
    discipline: asSuiteBadge(pendingDisciplineBadgeCount(data, user)),
    expenses: asSuiteBadge(pendingExpenseBadgeCount((data.expenseClaims || data.expenses || []).filter((row) => scoped(row.stationId)), user, data)),
    payroll: asSuiteBadge(pendingPayrollBadgeCount(data.payrollRuns, user, data)),
    safety: asSuiteBadge(pendingSafetyBadgeCount((data.safety || []).filter((row) => scoped(row.stationId)), user, data)),
  };

  const glowByApp = {
    requests: nightDueRequests > 0 ? "due" : undefined,
    attendance: nightDueDuty > 0 ? "due" : undefined,
  };

  return { byApp, glowByApp };
}

export function suiteAppBadge(app, badges) {
  if (!app || !badges?.byApp) return undefined;
  if (app.id === "leave") return badges.byApp.requests;
  return badges.byApp[app.id];
}

export function suiteAppGlow(app, badges) {
  if (!app || !badges?.glowByApp) return undefined;
  if (app.id === "leave") return badges.glowByApp.requests;
  return badges.glowByApp[app.id];
}
