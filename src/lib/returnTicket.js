/**
 * The return ticket at the end of service — unified model regulation Art. 11 (Annex 1, decision 115921):
 *   3. at the end of service, per Labour Law Art. 40(1) — the employer bears the non-Saudi worker's
 *      return to his country;
 *   4. not borne if he proved unfit for the work during probation, chose to return without a
 *      legitimate reason, or committed a violation that led to his deportation by an administrative
 *      decision or a court ruling.
 *
 * Derived from nationality and the contract exit; the employer records the ticket (or the exception
 * and its reason) on contractExit.returnTicket. Pure; server twin base44/shared/returnTicket.ts.
 */
import { deriveSaudiStatus } from "./complianceDerivations.js";

export const RETURN_TICKET_EXCEPTIONS = [
  { key: "probation_unfit", ar: "ثبت عدم صلاحيته للعمل خلال فترة التجربة", en: "Proved unfit during probation" },
  { key: "own_wish", ar: "رغب في العودة دون سبب مشروع", en: "Chose to return without a legitimate reason", reasons: ["resignation", "article_81"] },
  { key: "deported", ar: "ارتكب مخالفة أدت إلى ترحيله بقرار إداري أو حكم قضائي", en: "Deported for a violation by decision or ruling", reasons: ["article_80"] },
];

/**
 * → { state: "na" | "unknown" | "pending" | "owed" | "provided" | "excepted", ... }
 *   na       — a Saudi worker (no repatriation)
 *   unknown  — nationality not settled on the file
 *   pending  — non-Saudi, no exit recorded yet (for reference)
 *   owed     — non-Saudi with an exit recorded and neither ticket nor exception
 */
export function deriveReturnTicket(employee, exitOverride) {
  const identity = deriveSaudiStatus(employee);
  const exit = exitOverride || employee?.profile?.contractExit || employee?.contractExit || {};
  const ticket = exit.returnTicket || {};
  if (identity.saudi === true && !identity.mismatch) return { state: "na", ticket };
  const nonSaudi = identity.nationalitySaudi === false || identity.idKind === "iqama";
  if (!nonSaudi) return { state: "unknown", ticket };
  if (ticket.providedAt) return { state: "provided", ticket };
  if (ticket.exception && RETURN_TICKET_EXCEPTIONS.some((row) => row.key === ticket.exception)) return { state: "excepted", ticket };
  if (!exit.reason) return { state: "pending", ticket };
  return { state: "owed", ticket, exitReason: exit.reason };
}

/** Recording the exception needs a reason and, where the article ties it to an exit, that exit. */
export function checkReturnTicketExceptionGate({ exception, note, exitReason } = {}) {
  const row = RETURN_TICKET_EXCEPTIONS.find((item) => item.key === exception);
  if (!row) return { ok: false, error: "RETURN_EXCEPTION_REQUIRED", reason: "اختر حالة الاستثناء من المادة 11/4.", reasonEn: "Pick the Art. 11(4) exception." };
  if (row.reasons && !row.reasons.includes(String(exitReason || ""))) {
    return { ok: false, error: "RETURN_EXCEPTION_MISMATCH", reason: `«${row.ar}» لا يتفق مع سبب الإنهاء المسجّل — صحّح سبب الإنهاء أولاً.`, reasonEn: `"${row.en}" does not match the recorded end reason.` };
  }
  if (String(note || "").trim().length < 8) return { ok: false, error: "RETURN_EXCEPTION_NOTE", reason: "اكتب سند الاستثناء (قرار، محضر التجربة، أو طلب العامل).", reasonEn: "Write the basis of the exception." };
  return { ok: true };
}

/** End-of-service gate: a non-Saudi's return ticket is settled before the file closes. */
export function checkReturnTicketGate(employee, exitOverride) {
  const t = deriveReturnTicket(employee, exitOverride);
  if (t.state !== "owed") return { ok: true, state: t.state };
  return {
    ok: false,
    error: "RETURN_TICKET_OWED",
    reason: "موقوف — تذكرة عودة العامل غير السعودي إلى بلده على المنشأة عند انتهاء الخدمة (النموذج الموحد م11/3 · المادة 40/1). سجّل تأمينها، أو حالة الاستثناء وسندها.",
    reasonEn: "Blocked — the non-Saudi worker's return ticket home is on the company at the end of service (model Art. 11(3) · Art. 40(1)). Record it, or the exception and its basis.",
  };
}
