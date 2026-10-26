/**
 * Proof-cycle domain types — mirrors base44/shared/proofCycleSchemas.ts literals.
 * Use for UI state transitions and API response typing during TS migration.
 */

export type TaskStatus = "active" | "awaiting_approval" | "completed" | "escalated";

export type WorkProofStage = "await" | "ready" | "sealed" | "accepted" | "rejected";

export type AttendanceDayStatus =
  | "present"
  | "late"
  | "absent"
  | "on_leave"
  | "pending_review";

export type GateErrorCode =
  | "CHECK_IN_REQUIRED"
  | "GEO_CHECK_IN_REQUIRED"
  | "ON_APPROVED_LEAVE"
  | "VALIDATION_FAILED"
  | "PROOF_REQUIRED"
  | string;

export type GateResult =
  | { ok: true; skipped?: string; attendance?: AttendanceRowLike | null }
  | {
      ok: false;
      error: GateErrorCode;
      reason: string;
      reasonEn?: string;
      attendance?: AttendanceRowLike | null;
    };

export type AttendanceRowLike = {
  status?: AttendanceDayStatus | string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  in_zone?: boolean | null;
  location_status?: string | null;
  employee_id?: string;
  employeeId?: string;
  date?: string;
};

/** Audit-worthy domain events along the proof pipeline. */
export type ProofCycleDomainEvent =
  | { type: "attendance.check_in"; employeeId: string; status: AttendanceDayStatus }
  | { type: "attendance.check_out"; employeeId: string }
  | { type: "attendance.blocked_leave"; employeeId: string; dayKey: string }
  | { type: "task.log_completion"; taskId: string; completedCount: number }
  | { type: "task.approved"; taskId: string; pointsAwarded: number }
  | { type: "task.rejected"; taskId: string; reason: string; escalated: boolean }
  | { type: "work_proof.raised"; proofId: string; ref: string }
  | { type: "work_proof.ended"; proofId: string; sealed: boolean }
  | { type: "work_proof.sealed"; proofId: string; sealId: string }
  | { type: "signing.completed"; documentId: string }
  | { type: "offboarding.blocked_assets"; employeeId: string; outstandingCount: number }
  | { type: "offboarding.completed"; employeeId: string };

export type ValidationIssue = { path: string; message: string };

export type ApiValidationError = {
  error: "VALIDATION_FAILED";
  reason: string;
  reasonEn: string;
  issues: ValidationIssue[];
};

export function isGateOpen(gate: GateResult | null | undefined): gate is Extract<GateResult, { ok: true }> {
  return !!gate && gate.ok === true;
}

export function gateMessage(gate: GateResult | null | undefined, ar = true): string {
  // strictNullChecks مطفأ في jsconfig، وفيه لا يضيّق `if (gate.ok)` الاتحاد المميَّز.
  // المقارنة بالقيمة الحرفية تضيّقه، فيرى المصرّف فرع ok:false وحقولَه.
  if (!gate || gate.ok === true) return "";
  return ar ? gate.reason : (gate.reasonEn || gate.reason);
}
