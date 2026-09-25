/**
 * Company job number. Issued once inside that company, then left alone.
 * NV-{hire year}-{company sequence}. Not the national ID, and not shared across companies.
 */

export const EMPLOYEE_NO_TAKEN = "EMPLOYEE_NO_TAKEN";

const ISSUED = /^NV-(\d{4})-(\d+)$/;

export function readEmployeeNo(employee) {
  const profile = employee?.profile || {};
  return [employee?.employeeNo, profile.employeeNo, profile.employeeNumber, employee?.employeeNumber]
    .map((item) => String(item || "").trim())
    .find(Boolean) || "";
}

export function stampEmployeeNo(employee, value) {
  const no = String(value || "").trim();
  if (!employee || !no) return "";
  employee.employeeNo = no;
  employee.profile = { ...(employee.profile || {}), employeeNo: no, employeeNumber: no };
  return no;
}

function hireYear(employee, hireDate) {
  const raw = String(hireDate || employee?.profile?.hireDate || employee?.hireDate || employee?.createdAt || "").slice(0, 4);
  const year = Number(raw);
  if (year >= 1900 && year <= 2200) return year;
  return new Date().getFullYear();
}

function sequenceOf(value) {
  const match = ISSUED.exec(String(value || "").trim());
  if (!match) return 0;
  const seq = Number(match[2]);
  return Number.isFinite(seq) ? seq : 0;
}

function rememberSequence(data, seq) {
  const next = Math.max(Number(data?.employeeNoSeq) || 0, Number(data?.settings?.employeeNoSeq) || 0, Number(seq) || 0);
  data.employeeNoSeq = next;
  data.settings = { ...(data.settings || {}), employeeNoSeq: next };
  return next;
}

function highWater(data) {
  let max = Math.max(Number(data?.employeeNoSeq) || 0, Number(data?.settings?.employeeNoSeq) || 0);
  for (const employee of data?.employees || []) {
    max = Math.max(max, sequenceOf(readEmployeeNo(employee)));
  }
  return max;
}

export function formatEmployeeNo(year, seq) {
  return `NV-${year}-${String(seq).padStart(4, "0")}`;
}

export function employeeNumberTaken(data, value, exceptId = "") {
  const want = String(value || "").trim();
  if (!want) return false;
  return (data?.employees || []).some((employee) => {
    if (exceptId && String(employee?.id || "") === String(exceptId)) return false;
    return readEmployeeNo(employee) === want;
  });
}

/**
 * Keep a stored number. Accept an imported one when it is free in this company.
 * Otherwise issue the next sequence for this company only.
 */
export function assignEmployeeNumber(data, employee, { imported = "", hireDate = "" } = {}) {
  if (!data || !employee) return { ok: false, error: "MISSING", reason: "الموظف غير موجود في سجل الشركة." };
  data.employees = data.employees || [];
  const existing = readEmployeeNo(employee);
  if (existing) {
    rememberSequence(data, sequenceOf(existing));
    stampEmployeeNo(employee, existing);
    return { ok: true, employeeNo: existing, issued: false };
  }
  const brought = String(imported || "").trim();
  if (brought) {
    if (employeeNumberTaken(data, brought, employee.id)) {
      return {
        ok: false,
        error: EMPLOYEE_NO_TAKEN,
        reason: "الرقم الوظيفي مستخدم في هذه الشركة.",
      };
    }
    stampEmployeeNo(employee, brought);
    rememberSequence(data, sequenceOf(brought));
    return { ok: true, employeeNo: brought, issued: false };
  }
  const seq = highWater(data) + 1;
  const no = formatEmployeeNo(hireYear(employee, hireDate), seq);
  stampEmployeeNo(employee, no);
  rememberSequence(data, seq);
  return { ok: true, employeeNo: no, issued: true };
}

export function ensureEmployeeNumbers(data) {
  if (!data || !Array.isArray(data.employees)) return false;
  const pending = data.employees.filter((employee) => employee && !readEmployeeNo(employee));
  const water = highWater(data);
  if (!pending.length) {
    if ((Number(data.employeeNoSeq) || 0) === water && (Number(data.settings?.employeeNoSeq) || 0) === water) return false;
    if (!water) return false;
    rememberSequence(data, water);
    return true;
  }
  pending.sort((a, b) => {
    const da = String(a?.profile?.hireDate || a?.hireDate || a?.createdAt || "");
    const db = String(b?.profile?.hireDate || b?.hireDate || b?.createdAt || "");
    if (da !== db) return da < db ? -1 : 1;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
  let changed = false;
  for (const employee of pending) {
    const result = assignEmployeeNumber(data, employee, {
      hireDate: employee?.profile?.hireDate || employee?.hireDate || "",
    });
    if (result.issued) changed = true;
  }
  return changed;
}
