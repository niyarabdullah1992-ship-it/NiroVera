/**
 * Who may fill or edit the employee file. Pure — no "@/" imports, so the scripts can test it.
 *
 * Owner rule: «الملف بأكمله لا يستطيع ملئه إلا قسم الموارد البشرية».
 *   - HR: an active HR level holding "manage_employees", inside that level's station scope.
 *   - The company owner and the director keep full rights as the account administrator.
 *   - Everyone else reads: the employee himself, his direct manager, the branch manager (station_manager),
 *     pgm and ops_manager. A fact is changed through «طلب تعديل بيان», which HR approves.
 *   - An HR member does not edit his own file (owner/director excepted) — the same correction request.
 *
 * Server twin: base44/shared/employeeFileGate.ts (canWriteEmployeeFile) — keep the two in step.
 */

export const EMPLOYEE_FILE_HR_ONLY = "EMPLOYEE_FILE_HR_ONLY";
export const EMPLOYEE_FILE_HR_ONLY_LINE = { ar: "التعديل للموارد البشرية", en: "Edits are made by HR" };
// «طلب تعديل الملف الوظيفي» in طلباتي (fileCorrection.js FILE_CORRECTION_HREF).
export const EMPLOYEE_FILE_CORRECTION_HREF = "/app/requests?kind=file_correction";

const str = (v) => String(v ?? "").trim();

function activeHrLevel(user, data) {
  if (!user?.hrLevelId) return null;
  return (data?.hrLevels || []).find((l) => l.id === user.hrLevelId && l.active !== false) || null;
}

/** Stations an HR level reaches: null = company-wide, [] = none. Mirrors permissions.hrScopeStations. */
function hrLevelScope(user, data, level) {
  if (!level) return [];
  if (Array.isArray(level.stationIds) && level.stationIds.length > 0) return level.stationIds.map(str);
  if (level.scope === "station") return user.hrStationId ? [str(user.hrStationId)] : [];
  if (level.scope === "cluster") {
    const cluster = (data?.hrClusters || []).find((c) => c.id === user.hrClusterId);
    return cluster ? (cluster.stationIds || []).map(str) : [];
  }
  return null;
}

/** The account administrator: the company owner or the director role. */
export function isFileAdministrator(user, data) {
  if (!user) return false;
  return user.role === "owner" || Boolean(user.isOwner) || Boolean(data?.ownerId && str(user.id) === str(data.ownerId)) || user.role === "director";
}

function sameEmployee(user, employee) {
  if (!user || !employee) return false;
  const mine = [user.id, user.employeeId].map(str).filter(Boolean);
  const file = [employee.id, employee.employeeId].map(str).filter(Boolean);
  return file.some((id) => mine.includes(id));
}

/**
 * The decision with its named reason.
 * @returns {{ ok: true, as: "admin" | "hr" } | { ok: false, error: string, reason: string, reasonEn: string }}
 */
export function employeeFileEditGate(user, employee, data) {
  const refuse = (reason, reasonEn) => ({ ok: false, error: EMPLOYEE_FILE_HR_ONLY, reason, reasonEn });
  if (!user || !employee) return refuse("لا ملف ولا مستخدم.", "No file or no user.");
  if (isFileAdministrator(user, data)) return { ok: true, as: "admin" };
  const level = activeHrLevel(user, data);
  if (!level || !(level.permissions || []).includes("manage_employees")) {
    return sameEmployee(user, employee)
      ? refuse("ملفك تملؤه الموارد البشرية — اطلب تعديل بيان.", "HR fills your file — ask for a correction.")
      : refuse("ملف الموظف تملؤه الموارد البشرية وحدها.", "Only HR fills the employee file.");
  }
  if (sameEmployee(user, employee)) {
    return refuse("لا تعدّل ملفك بنفسك — اطلب تعديل بيان تعتمده الموارد البشرية.", "You do not edit your own file — ask for a correction HR approves.");
  }
  const scope = hrLevelScope(user, data, level);
  const station = str(employee.stationId);
  if (scope !== null && !scope.includes(station)) {
    return refuse("الموظف خارج نطاق مستواك في الموارد البشرية.", "The employee is outside your HR scope.");
  }
  return { ok: true, as: "hr" };
}

export function canEditEmployeeFile(user, employee, data) {
  return employeeFileEditGate(user, employee, data).ok;
}

/** Wage lines on the file: a file editor who also holds payroll rights (administrator, or HR with manage_payroll). */
export function canEditEmployeeFileWage(user, employee, data) {
  const gate = employeeFileEditGate(user, employee, data);
  if (!gate.ok) return false;
  if (gate.as === "admin") return true;
  return Boolean(activeHrLevel(user, data)?.permissions?.includes("manage_payroll"));
}
