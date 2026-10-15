/**
 * Client twins of base44/shared/syncLaw.ts — how law-bound company data travels to Base44.
 *
 *   • employerDuties — the training / medical-exam / held-document registers live on each employee in
 *     the local cache; they reach the server as one row per employee (like leaveRoster) and are merged
 *     back into the employees on hydration. Records are joined by id, never dropped.
 *   • abuseCases — who may read a confidential case (model regulation Art. 56(1)).
 *
 * Pure (node-testable).
 */

const str = (v) => String(v ?? "");

/** One row per employee — the server copy of the registers (Law Arts. 42–48, 143; Regs Art. 6). */
export function employerDutyRosterFromEmployees(employees) {
  return (employees || [])
    .filter((e) => e && (e.id || e.employeeId))
    .map((e) => {
      const id = str(e.id || e.employeeId);
      return {
        id,
        employeeId: id,
        stationId: e.stationId || null,
        trainings: Array.isArray(e.trainings) ? e.trainings : [],
        medicalExams: Array.isArray(e.medicalExams) ? e.medicalExams : [],
        heldDocuments: Array.isArray(e.profile?.heldDocuments) ? e.profile.heldDocuments : [],
        occupationalExposure: Boolean(e.profile?.occupationalExposure),
        exposureHazard: str(e.profile?.exposureHazard),
      };
    })
    .filter((r) => r.trainings.length || r.medicalExams.length || r.heldDocuments.length || r.occupationalExposure);
}

function unionById(a, b) {
  const out = new Map();
  for (const r of Array.isArray(a) ? a : []) if (r?.id) out.set(str(r.id), r);
  for (const r of Array.isArray(b) ? b : []) {
    if (!r?.id) continue;
    const prev = out.get(str(r.id));
    out.set(str(r.id), prev ? { ...r, ...prev } : r);
  }
  return [...out.values()];
}

/**
 * Lays the server registers back onto the cached employees. Local records not yet on the server are
 * kept; a record on both sides keeps every field either side holds (rows only gain fields).
 */
export function applyEmployerDutyRoster(employees, roster) {
  const rows = new Map((Array.isArray(roster) ? roster : []).filter((r) => r?.employeeId).map((r) => [str(r.employeeId), r]));
  if (!rows.size) return employees;
  return (employees || []).map((e) => {
    const row = rows.get(str(e?.id || e?.employeeId));
    if (!row) return e;
    const profile = { ...(e.profile || {}) };
    profile.heldDocuments = unionById(row.heldDocuments, profile.heldDocuments);
    if (!profile.heldDocuments.length) delete profile.heldDocuments;
    if (row.occupationalExposure && profile.occupationalExposure === undefined) {
      profile.occupationalExposure = true;
      profile.exposureHazard = row.exposureHazard || "";
    }
    const trainings = unionById(row.trainings, e.trainings);
    const medicalExams = unionById(row.medicalExams, e.medicalExams);
    return {
      ...e,
      profile,
      ...(trainings.length ? { trainings } : {}),
      ...(medicalExams.length ? { medicalExams } : {}),
    };
  });
}

export function abuseCommitteeIds(row) {
  return (row?.committee?.members || []).map((m) => str(m?.id ?? m)).filter(Boolean);
}

/** Model regulation Art. 56(1): the filer, the members named on this case's committee, and senior HR. */
export function canReadAbuseCase(row, { userId, senior = false } = {}) {
  if (senior) return true;
  const id = str(userId);
  if (!id || !row) return false;
  if (str(row.reporterId || row.userId) === id) return true;
  return abuseCommitteeIds(row).includes(id);
}

export function regulationVersionOf(reg) {
  return str(reg?.version || reg?.savedAt || reg?.approvedAt).slice(0, 19);
}

/** A short history row for a superseded regulation version (Law Art. 13 — each amendment is announced anew). */
export function regulationVersionEntry(reg) {
  const acks = reg?.acks && typeof reg.acks === "object" ? reg.acks : {};
  return {
    version: regulationVersionOf(reg),
    approvalNo: str(reg?.approvalNo),
    approvedAt: str(reg?.approvedAt).slice(0, 10),
    announcedAt: str(reg?.announcedAt).slice(0, 10),
    savedAt: str(reg?.savedAt),
    savedBy: str(reg?.savedBy),
    clauses: Array.isArray(reg?.clauses) ? reg.clauses.length : 0,
    acks: Object.keys(acks).length,
  };
}

/**
 * Categories promoted to the server after records already lived only in browsers: an empty server
 * answer must not wipe a local copy that has not been pushed yet (the next write uploads it).
 */
export const PROMOTED_LOCAL_CATEGORIES = ["workRegulation", "trainingPlan", "employerDuties"];

export function keepLocalOverEmptyServer(category, serverValue, localValue) {
  if (!PROMOTED_LOCAL_CATEGORIES.includes(category)) return false;
  const empty = (v) => v == null || (Array.isArray(v) ? v.length === 0 : typeof v === "object" && Object.keys(v).length === 0);
  return empty(serverValue) && !empty(localValue);
}
