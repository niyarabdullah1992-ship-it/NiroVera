/** Zod schemas — proof-cycle pipeline (attendance → tasks → work proof → HR lock). */
import { z } from "npm:zod@3.24.2";
import {
  companyIdSchema,
  employeeIdSchema,
  entityIdSchema,
  geoCoordsSchema,
  proofFileSchema,
  sessionTokenSchema,
  tenantRequestSchema,
  validateActionRequest,
  validationFailed,
} from "./requestValidation.ts";

export { validationFailed };

const opsBase = tenantRequestSchema;

export const opsLogCompletionSchema = opsBase.extend({
  action: z.literal("logCompletion"),
  taskId: entityIdSchema,
  amount: z.coerce.number().int().positive().max(999).optional(),
  attestation: z.string().max(4000).optional(),
  proofFiles: z.array(proofFileSchema).max(20).optional(),
  scope: z.string().nullable().optional(),
});

export const opsApproveSchema = opsBase.extend({
  action: z.literal("approve"),
  taskId: entityIdSchema,
  scope: z.string().nullable().optional(),
});

export const opsRejectSchema = opsBase.extend({
  action: z.literal("reject"),
  taskId: entityIdSchema,
  reason: z.string().trim().min(1).max(2000),
  lang: z.enum(["ar", "en"]).optional(),
  scope: z.string().nullable().optional(),
});

export const opsEmployeeEscalateSchema = opsBase.extend({
  action: z.literal("employeeEscalate"),
  taskId: entityIdSchema,
  reason: z.string().trim().min(1).max(2000),
  lang: z.enum(["ar", "en"]).optional(),
  scope: z.string().nullable().optional(),
});

export const opsAttendanceStatusSchema = opsBase.extend({
  action: z.literal("attendanceStatus"),
  employeeId: employeeIdSchema.optional(),
});

export const opsCreateSchema = opsBase.extend({
  action: z.literal("create"),
  title: z.string().trim().min(1).max(500),
  stationId: z.string().trim().min(1).optional(),
  stationIds: z.array(z.string()).optional(),
  targetCount: z.coerce.number().int().positive().max(9999).optional(),
  effortWeight: z.coerce.number().min(0).max(10).optional(),
  priority: z.string().optional(),
  mode: z.enum(["onsite", "field", "remote"]).optional(),
  workKind: z.string().max(120).optional(),
  assignMode: z.enum(["one", "some", "all"]).optional(),
  ownerId: z.string().optional(),
  ownersByStation: z.record(z.string()).optional(),
  memberIds: z.array(z.string()).optional(),
  startAt: z.string().optional(),
  dueAt: z.string().optional(),
  planPinned: z.boolean().optional(),
  planHorizon: z.string().optional(),
  steps: z.union([z.array(z.string()), z.string()]).optional(),
  attachments: z.array(z.object({
    url: z.string().optional(),
    name: z.string().max(300).optional(),
    type: z.string().max(120).optional(),
  }).passthrough()).max(20).optional(),
  recurrence: z.object({
    kind: z.enum(["once", "weekly", "selected_dates", "monthly_weekday", "monthly_dates"]),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
    dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(52).optional(),
    timesPerMonth: z.coerce.number().int().min(1).max(31).optional(),
    monthDays: z.array(z.coerce.number().int().min(1).max(31)).max(31).optional(),
    horizon: z.enum(["m", "q", "y"]).optional(),
  }).optional(),
  lang: z.enum(["ar", "en"]).optional(),
  scope: z.string().nullable().optional(),
}).passthrough();

export const opsReassignSchema = opsBase.extend({
  action: z.literal("reassign"),
  taskId: entityIdSchema,
  toId: z.string().min(1).optional(),
  ownerId: z.string().optional(),
  reason: z.string().trim().min(1).max(2000),
  kind: z.enum(["delegate", "acting", "transfer"]).optional(),
  delegatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  actingUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

export const opsEndDelegationSchema = opsBase.extend({
  action: z.literal("endDelegation"),
  taskId: entityIdSchema,
  reason: z.string().trim().min(1).max(2000),
  endedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

export const opsExtendDueSchema = opsBase.extend({
  action: z.literal("extendDue"),
  taskId: entityIdSchema,
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  reason: z.string().trim().min(1).max(2000),
  lang: z.enum(["ar", "en"]).optional(),
  scope: z.string().nullable().optional(),
  expected: z.coerce.number().optional(),
  logged: z.coerce.number().optional(),
  gap: z.coerce.number().optional(),
  blockerDay: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

export const opsRedistributePaceSchema = opsBase.extend({
  action: z.literal("redistributePace"),
  taskId: entityIdSchema,
  reason: z.string().trim().min(1).max(2000),
  lang: z.enum(["ar", "en"]).optional(),
  scope: z.string().nullable().optional(),
  expected: z.coerce.number().optional(),
  logged: z.coerce.number().optional(),
  gap: z.coerce.number().optional(),
  blockerDay: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

export const opsAddCommentSchema = opsBase.extend({
  action: z.literal("addComment"),
  taskId: entityIdSchema,
  text: z.string().trim().max(4000).optional(),
  issue: z.boolean().optional(),
  isIssue: z.boolean().optional(),
  files: z.array(z.object({
    url: z.string().min(1),
    name: z.string().max(300).optional(),
    type: z.string().max(120).optional(),
  }).passthrough()).max(12).optional(),
}).refine((v) => !!(String(v.text || "").trim() || (Array.isArray(v.files) && v.files.length)), {
  message: "text or files required",
  path: ["text"],
});

export const opsDeleteCommentSchema = opsBase.extend({
  action: z.literal("deleteComment"),
  taskId: entityIdSchema,
  commentId: z.string().trim().min(1),
});

export const opsDeleteSchema = opsBase.extend({
  action: z.literal("delete"),
  taskId: entityIdSchema,
  reason: z.string().trim().max(2000).optional(),
  ack: z.boolean().optional(),
  undoCreate: z.boolean().optional(),
  lang: z.enum(["ar", "en"]).optional(),
  scope: z.string().nullable().optional(),
});

export const opsActionSchemas = {
  logCompletion: opsLogCompletionSchema,
  approve: opsApproveSchema,
  reject: opsRejectSchema,
  employeeEscalate: opsEmployeeEscalateSchema,
  attendanceStatus: opsAttendanceStatusSchema,
  create: opsCreateSchema,
  reassign: opsReassignSchema,
  endDelegation: opsEndDelegationSchema,
  extendDue: opsExtendDueSchema,
  redistributePace: opsRedistributePaceSchema,
  addComment: opsAddCommentSchema,
  deleteComment: opsDeleteCommentSchema,
  delete: opsDeleteSchema,
} as const;

export function validateOpsRequest(body: unknown) {
  return validateActionRequest(body, opsActionSchemas);
}

const wpVehicleFields = z
  .object({
    plate: z.string().optional(),
    model: z.string().optional(),
    color: z.string().optional(),
    maker: z.string().optional(),
    make: z.string().optional(),
    type: z.string().optional(),
    year: z.string().optional(),
    plateLetters: z.string().optional(),
    plateNumbers: z.string().optional(),
    assetId: z.string().optional(),
  })
  .passthrough();

const wpVehicleSchema = wpVehicleFields.optional();

const wpPersonSchema = z.object({
  name: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  id: z.string().max(40).optional(),
  title: z.string().max(120).optional(),
  employeeId: z.string().max(120).optional(),
  homeStationId: z.string().max(120).optional(),
  visitor: z.boolean().optional(),
}).passthrough();

export const workProofRaiseSchema = tenantRequestSchema.extend({
  action: z.literal("raise"),
  title: z.string().trim().min(1).max(500),
  workReason: z.string().trim().min(1).max(2000),
  entityName: z.string().trim().min(1).max(500),
  stationId: z.string().trim().min(1),
  beforeStamp: z.string().trim().min(1).max(120),
  client: z.string().optional(),
  entityKind: z.string().optional(),
  entityScope: z.enum(["internal", "external"]).optional(),
  entityStationId: z.string().trim().max(120).optional(),
  geoVerdict: z.string().optional(),
  // Named here because checkProofPlaceGate reads it: an unstated place decides the sun ban.
  place: z.string().trim().max(40).optional(),
  beforeUrl: z.string().nullable().optional(),
  startedAt: z.string().optional(),
  vehicle: wpVehicleSchema,
  vehicles: z.array(wpVehicleFields).max(12).optional(),
  people: z.array(wpPersonSchema).max(12).optional(),
  attachments: z.array(z.object({
    url: z.string().optional(),
    name: z.string().max(300).optional(),
    type: z.string().max(120).optional(),
  }).passthrough()).max(20).optional(),
  ref: z.string().optional(),
});

export const workProofEndSchema = tenantRequestSchema.extend({
  action: z.enum(["end", "attachAfter"]),
  id: entityIdSchema.optional(),
  ref: z.string().optional(),
  afterStamp: z.string().trim().min(1).max(120),
  afterUrl: z.string().min(1),
  endedAt: z.string().optional(),
  geoClearReason: z.string().max(500).optional(),
}).refine((v) => !!(v.id || v.ref), { message: "id or ref is required", path: ["id"] });

export const workProofEditSchema = tenantRequestSchema.extend({
  action: z.literal("edit"),
  id: entityIdSchema.optional(),
  ref: z.string().optional(),
  title: z.string().trim().min(1).max(500),
  workReason: z.string().trim().min(1).max(2000),
  entityName: z.string().trim().min(1).max(500),
  stationId: z.string().trim().min(1).optional(),
  geoVerdict: z.string().optional(),
  place: z.string().trim().max(40).optional(),
  entityKind: z.string().optional(),
  entityScope: z.enum(["internal", "external"]).optional(),
  entityStationId: z.string().trim().max(120).optional(),
  vehicle: wpVehicleSchema,
  vehicles: z.array(wpVehicleFields).max(12).optional(),
  people: z.array(wpPersonSchema).max(12).optional(),
}).refine((v) => !!(v.id || v.ref), { message: "id or ref is required", path: ["id"] });

export const workProofRejectSchema = tenantRequestSchema.extend({
  action: z.literal("reject"),
  id: entityIdSchema.optional(),
  ref: z.string().optional(),
  reason: z.string().max(2000).optional(),
}).refine((v) => !!(v.id || v.ref), { message: "id or ref is required", path: ["id"] });

export const workProofAttendanceStatusSchema = tenantRequestSchema.extend({
  action: z.literal("attendanceStatus"),
  employeeId: employeeIdSchema.optional(),
});

export const workProofAddAttachmentSchema = tenantRequestSchema.extend({
  action: z.literal("addAttachment"),
  id: entityIdSchema.optional(),
  ref: z.string().optional(),
  url: z.string().min(1),
  name: z.string().max(300).optional(),
  type: z.string().max(120).optional(),
  replaceId: z.string().optional(),
}).refine((v) => !!(v.id || v.ref), { message: "id or ref is required", path: ["id"] });

export const workProofActionSchemas = {
  raise: workProofRaiseSchema,
  end: workProofEndSchema,
  attachAfter: workProofEndSchema,
  edit: workProofEditSchema,
  reject: workProofRejectSchema,
  attendanceStatus: workProofAttendanceStatusSchema,
  addAttachment: workProofAddAttachmentSchema,
} as const;

export function validateWorkProofRequest(body: unknown) {
  return validateActionRequest(body, workProofActionSchemas);
}

export const attendanceCheckInSchema = tenantRequestSchema.extend({
  action: z.literal("checkIn"),
  employeeId: employeeIdSchema,
  employeeName: z.string().max(200).optional(),
  stationId: z.string().optional(),
  shiftStart: z.string().optional(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  accuracy: z.number().finite().optional(),
});

export const attendanceCheckOutSchema = tenantRequestSchema.extend({
  action: z.literal("checkOut"),
  employeeId: employeeIdSchema,
  shiftEnd: z.string().optional(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  accuracy: z.number().finite().optional(),
});

export const attendanceActionSchemas = {
  checkIn: attendanceCheckInSchema,
  checkOut: attendanceCheckOutSchema,
} as const;

export function validateAttendanceRequest(body: unknown) {
  return validateActionRequest(body, attendanceActionSchemas);
}

export const offboardingMarkReturnedSchema = tenantRequestSchema.extend({
  action: z.literal("markReturned"),
  employeeId: employeeIdSchema,
  assetId: entityIdSchema,
});

export const offboardingCompleteSchema = tenantRequestSchema.extend({
  action: z.literal("complete"),
  employeeId: employeeIdSchema,
});

export const offboardingActionSchemas = {
  markReturned: offboardingMarkReturnedSchema,
  complete: offboardingCompleteSchema,
} as const;

export function validateOffboardingRequest(body: unknown) {
  return validateActionRequest(body, offboardingActionSchemas);
}

/** Domain literals shared with frontend types. */
export const taskStatusSchema = z.enum([
  "active",
  "awaiting_approval",
  "completed",
  "escalated",
]);

export const workProofStageSchema = z.enum([
  "await",
  "ready",
  "sealed",
  "accepted",
  "rejected",
]);

export const attendanceDayStatusSchema = z.enum([
  "present",
  "late",
  "absent",
  "on_leave",
  "pending_review",
]);

export const gateErrorSchema = z.enum([
  "CHECK_IN_REQUIRED",
  "GEO_CHECK_IN_REQUIRED",
  "ON_APPROVED_LEAVE",
  "VALIDATION_FAILED",
  "PROOF_REQUIRED",
]);
