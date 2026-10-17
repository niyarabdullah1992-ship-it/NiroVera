/**
 * The employee file is filled by HR only — «الملف بأكمله لا يستطيع ملئه إلا قسم الموارد البشرية».
 *
 * companyDirectory/syncEmployees runs every pushed Employee row through `enforceEmployeeFileWrite`:
 * a writer who is not HR (or the account administrator) keeps the server's values for every file fact,
 * and the push carries back a named refusal (EMPLOYEE_FILE_HR_ONLY) with the fields it held.
 * The rest of the row (requests, consents, signatures, org placement) is untouched by this gate.
 *
 * File facts = what the file UI types: name, phone, certificates, and the profile keys below
 * (identity, contract terms, wage and allowances, platforms, site conditions, duty-on-file, photo).
 * Not file facts, written elsewhere and left on purpose: the worker's own acts (contract.workerAck,
 * contractExit from a resignation / Art. 81, night consents, hajj, leave carry, personal seal),
 * law-derived writes (leaveTotals floors, unpaidSuspendedDays), and org placement (stationId,
 * actingAssignments, managedStations, and the title / department the org tree writes onto
 * profile.position / profile.department when a seat is renamed — gated elsewhere).
 * Two law-derived rewrites of contract terms pass for any writer because the platform computes them:
 * an Art. 55 conversion (contractType → indefinite with art55AppliedAt newly set) and an Art. 116
 * unpaid-leave extension (contractEndDate pushed later with unpaidSuspendedDays grown).
 *
 * Client twin: src/lib/employeeFileRights.js (employeeFileEditGate). Pure, no imports.
 */

export const EMPLOYEE_FILE_HR_ONLY = "EMPLOYEE_FILE_HR_ONLY";

export const FILE_TOP_KEYS = ["name", "phone", "certificates"];

export const FILE_PROFILE_KEYS = [
  // identity, nationality, personal, contact, bank
  "idType", "nationalId", "idExpiry", "iqamaExpiry", "passportExpiry", "birthDate", "gender", "nationality",
  "workPermitNumber", "workPermitExpiry", "qiwaTitle", "qiwaStatus", "maritalStatus", "religion", "dependents",
  "medicalInsuranceExpiry", "medicalInsuranceNumber", "emergencyName", "emergencyPhone", "qualification",
  "iban", "bankName", "bank", "avatarUrl",
  // employment and contract terms
  "hireDate", "contractType", "wageType", "contractEndDate", "probationEnd",
  "probationSecondFile", "contractPdf", "contractFileName", "contractUrl",
  // wage and allowances, GOSI
  "baseSalary", "housingAllowance", "transportAllowance", "otherAllowances", "allowances", "hazardAllowance",
  "livingAllowance", "commissionAmount", "remoteAreaAllowance", "medicalDistanceAllowance", "mealAllowance",
  "currency", "gosiNumber", "gosiRegisteredAt", "housingMode", "transportMode", "inKindMonthly",
  "salaryCertificateUrl", "salaryCertificateName",
  // site conditions
  "hospitalMinutes", "remoteSite", "medicalOnSite", "mealsProvided",
  // duty kept on the file
  "weeklyRestDayCount", "weeklyOffDows", "hoursBasis", "hoursCategory108", "hoursExempt108",
  "juvenileIdDoc", "juvenileFitnessCert", "juvenileGuardianConsent", "guardianFullName", "juvenileResidence",
  "juvenileOfficeNotifiedAt",
];

/** Keys of profile.contract that are the worker's own act, not a file fact. */
const CONTRACT_OWN_KEYS = ["workerAck"];

const str = (v: unknown) => String(v ?? "").trim();
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const day = (v: unknown) => { const d = str(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ""; };

function contractFacts(contract: any) {
  if (!contract || typeof contract !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(contract)) if (!CONTRACT_OWN_KEYS.includes(k)) out[k] = v;
  return out;
}

/** Contract-term changes the platform derives from the law (see header). */
function lawDerivedTermChange(prevProfile: any, nextProfile: any, key: string) {
  const p = prevProfile || {};
  const n = nextProfile || {};
  const art55 = str(n.contractType) === "indefinite" && day(n.art55AppliedAt) && day(n.art55AppliedAt) !== day(p.art55AppliedAt);
  if (art55 && (key === "contractType" || key === "contractEndDate" || key === "contract")) {
    if (key === "contractEndDate") return !str(n.contractEndDate);
    if (key === "contract") {
      const a = contractFacts(p.contract) || {};
      const b = contractFacts(n.contract) || {};
      const rest = (o: any) => { const { type: _t, endDate: _e, ...r } = o; return r; };
      return same(rest(a), rest(b)) && str(b.type) === "indefinite" && !str(b.endDate);
    }
    return true;
  }
  const suspended = (Number(n.unpaidSuspendedDays) || 0) > (Number(p.unpaidSuspendedDays) || 0);
  if (suspended && (key === "contractEndDate" || key === "contract")) {
    const before = day(p.contractEndDate || p.contract?.endDate);
    const after = day(key === "contract" ? n.contract?.endDate : n.contractEndDate);
    if (!before || !after || after <= before) return false;
    if (key === "contract") {
      const rest = (o: any) => { const { endDate: _e, ...r } = o || {}; return r; };
      return same(rest(contractFacts(p.contract)), rest(contractFacts(n.contract)));
    }
    return true;
  }
  return false;
}

/** File-fact keys that differ between the stored row and the pushed one ("profile.x" for profile keys). */
export function employeeFileFactChanges(previous: any, incoming: any): string[] {
  const prev = previous || {};
  const next = incoming || {};
  const out: string[] = [];
  for (const k of FILE_TOP_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, k)) continue;
    if (!same(prev[k], next[k])) out.push(k);
  }
  const pp = prev.profile || {};
  const np = next.profile;
  if (np && typeof np === "object") {
    for (const k of FILE_PROFILE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(np, k) && !Object.prototype.hasOwnProperty.call(pp, k)) continue;
      if (same(pp[k], np[k])) continue;
      if (lawDerivedTermChange(pp, np, k)) continue;
      out.push(`profile.${k}`);
    }
    if (!same(contractFacts(pp.contract), contractFacts(np.contract)) && !lawDerivedTermChange(pp, np, "contract")) {
      out.push("profile.contract");
    }
  }
  return out;
}

export type FileWriter = {
  admin?: boolean;          // platform admin or the company owner session
  role?: string;            // the actor's app role
  employeeId?: string;      // the actor's own employee id
  permissions?: Set<string> | string[];
  scope?: string[] | null;  // HR station scope; null = company-wide
};

const has = (perms: FileWriter["permissions"], key: string) => (perms instanceof Set ? perms.has(key) : Array.isArray(perms) ? perms.includes(key) : false);

/** Mirrors employeeFileEditGate on the page. */
export function canWriteEmployeeFile(writer: FileWriter, target: { employeeId?: string; stationId?: string | null }) {
  if (!writer) return false;
  if (writer.admin || writer.role === "owner" || writer.role === "director") return true;
  if (!has(writer.permissions, "manage_employees")) return false;
  if (str(writer.employeeId) && str(writer.employeeId) === str(target?.employeeId)) return false;
  if (writer.scope === null || writer.scope === undefined) return writer.scope === null;
  return writer.scope.map(str).includes(str(target?.stationId));
}

/**
 * Applies the gate to one pushed row against the stored one.
 * @returns {{ record, refused: null | { employeeId, error, reason, reasonEn, fields } }}
 * A refused row keeps the stored value of every changed file fact; nothing else in it changes.
 */
export function enforceEmployeeFileWrite(writer: FileWriter, previous: any, incoming: any) {
  if (!previous || !incoming) return { record: incoming, refused: null };
  const fields = employeeFileFactChanges(previous, incoming);
  if (!fields.length) return { record: incoming, refused: null };
  if (canWriteEmployeeFile(writer, { employeeId: previous.employeeId, stationId: previous.stationId })) return { record: incoming, refused: null };
  const record: any = { ...incoming };
  const profile: any = { ...(incoming.profile || {}) };
  for (const f of fields) {
    if (!f.startsWith("profile.")) {
      if (Object.prototype.hasOwnProperty.call(previous, f)) record[f] = previous[f]; else delete record[f];
      continue;
    }
    const k = f.slice("profile.".length);
    const pp = previous.profile || {};
    if (k === "contract") {
      const kept = { ...(pp.contract || {}) };
      for (const own of CONTRACT_OWN_KEYS) {
        if (profile.contract && Object.prototype.hasOwnProperty.call(profile.contract, own)) kept[own] = profile.contract[own];
      }
      profile.contract = kept;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(pp, k)) profile[k] = pp[k]; else delete profile[k];
  }
  record.profile = profile;
  const self = str(writer?.employeeId) && str(writer?.employeeId) === str(previous.employeeId);
  return {
    record,
    refused: {
      employeeId: str(previous.employeeId),
      error: EMPLOYEE_FILE_HR_ONLY,
      reason: self ? "ملفك تملؤه الموارد البشرية — اطلب تعديل بيان." : "ملف الموظف تملؤه الموارد البشرية وحدها.",
      reasonEn: self ? "HR fills your file — ask for a correction." : "Only HR fills the employee file.",
      fields,
    },
  };
}
