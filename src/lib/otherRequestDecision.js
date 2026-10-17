import {
  checkApproveOtherRequestGate,
  checkRefuseRequestReasonGate,
  checkRejectNightFitnessGate,
  checkRejectStudyConsentGate,
  NIGHT_FITNESS_TYPE,
  STUDY_CONSENT_TYPE,
} from "./otherRequestDerivations.js";
import { checkGroundedRefusalGate, refusalGroundsFor, refusalText } from "./statutoryRefusal.js";
import { setOtherRequestStatus } from "./store.js";

/**
 * One management decision on an «other» request (approve / return / refuse) — the same gates طلباتي
 * runs, shared so «الجزاءات» decides a grievance (م71) or an Art. 91 damage objection exactly as the
 * request inbox does. Nothing here is new law: it is the inbox's own sequence, moved out of the component.
 */

/** The refusal note as stored: a statutory ground (when the kind has grounds) plus the manager's detail. */
export function groundedRefusalNote(row, { note = "", ground = "", ar = true } = {}) {
  return refusalGroundsFor(row)?.length && ground ? refusalText(row, ground, note, ar) : note;
}

/** What the decision cell shows before a click: the approve gate, the refuse gate and whether refusing is blocked. */
export function otherRequestDecisionState(row, { note = "", ground = "", verified = false, issuedFile = null, ar = true } = {}) {
  const approveGate = checkApproveOtherRequestGate({ ...row, issuedFile });
  const grounded = checkGroundedRefusalGate({ ...row, family: "other" }, { ground, verified, actor: "manager" });
  const rejectGate = !grounded.ok ? grounded : row.type === STUDY_CONSENT_TYPE
    ? checkRejectStudyConsentGate(row, note)
    : row.type === NIGHT_FITNESS_TYPE
      ? checkRejectNightFitnessGate(row, note)
      : { ok: true };
  const groundedNote = groundedRefusalNote(row, { note, ground, ar });
  const reasonGate = !rejectGate.ok || row.type === STUDY_CONSENT_TYPE || row.type === NIGHT_FITNESS_TYPE
    ? rejectGate
    : checkRefuseRequestReasonGate(groundedNote);
  return {
    approveGate,
    rejectGate,
    refusalGrounds: refusalGroundsFor(row),
    groundedNote,
    refuseBlocked: !rejectGate.ok || !reasonGate.ok || !String(groundedNote || "").trim(),
  };
}

/**
 * Decide one other-request. `status` is "approved" | "rejected" | "revise". Returns { ok } or the named
 * refusal { ok: false, reason, reasonEn } — the caller shows it; nothing is written on a refusal.
 */
export function decideOtherRequest({ companyId, row, status, note = "", ground = "", verified = false, issuedFile = null, actor, ar = true }) {
  const groundedNote = groundedRefusalNote(row, { note, ground, ar });
  if (status === "rejected") {
    const grounded = checkGroundedRefusalGate({ ...row, family: "other" }, { ground, verified, actor: "manager" });
    const rejectGate = !grounded.ok ? grounded : row.type === STUDY_CONSENT_TYPE
      ? checkRejectStudyConsentGate(row, note)
      : row.type === NIGHT_FITNESS_TYPE
        ? checkRejectNightFitnessGate(row, note)
        : checkRefuseRequestReasonGate(groundedNote);
    if (!rejectGate.ok) return rejectGate;
    if (row.type !== STUDY_CONSENT_TYPE && row.type !== NIGHT_FITNESS_TYPE) {
      const named = checkRefuseRequestReasonGate(groundedNote);
      if (!named.ok) return named;
    }
  }
  const result = setOtherRequestStatus(companyId, row.employee.id, row.id, status === "revise" ? "revise" : status, actor?.name, status === "rejected" ? groundedNote : note, {
    issuedFile,
    actorId: actor?.id,
    actor,
    rejectGround: ground,
    rejectVerified: verified,
  });
  if (result && result.ok === false) return result;
  return { ok: true };
}
