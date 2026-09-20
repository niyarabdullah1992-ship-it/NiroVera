/** Complaints / anonymous reports — escalation chain, SLA, rate limits.
 *  Design: NiroVera Platform.dc.html (complaints / rateLimits / escalation chain).
 *  Reuses the same chain shape as src/lib/escalation.js (level 0 = station manager).
 */

export const DEFAULT_RATE_LIMITS = {
  day: 3,
  week: 10,
  month: 30,
} as const;

export const RATE_WINDOW_MS = {
  day: 86_400_000,
  week: 86_400_000 * 7,
  month: 86_400_000 * 30,
} as const;

/** Response-time SLA (hours) by priority — clock resets on each escalate. */
export const RESPONSE_HOURS_BY_PRIORITY: Record<string, number> = {
  high: 24,
  medium: 48,
  low: 96,
};

/** Fallback chain when company has no custom handlers (mirrors design CHAIN). */
export const DEFAULT_CHAIN_IDS = [
  "station_manager",
  "hr_supervisor",
  "region_manager",
  "ops_director",
] as const;

export type ComplaintKind = "anonymous" | "safety" | "suggestion" | "facilities" | "public";
export type ComplaintPriority = "high" | "medium" | "low";
export type ComplaintStatus = "open" | "closed" | "rejected";

export type EscalationTier = {
  id: string;
  labelAr: string;
  labelEn: string;
  handlerIds: string[];
};

export type ComplaintLike = {
  id?: string;
  companyId?: string;
  kind?: ComplaintKind | string;
  type?: "complaint" | "suggestion" | string;
  anonymous?: boolean;
  anonymousId?: string | null;
  title: string;
  message?: string | null;
  stationId?: string | null;
  stationName?: string | null;
  priority?: ComplaintPriority | string;
  status?: ComplaintStatus | string;
  escalationLevel?: number;
  /** When the current level's response clock started (created or last escalate). */
  levelSinceAt?: string | null;
  createdAt?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  reporterName?: string | null; // null/empty for anonymous
  authorId?: string | null;
  channel?: string | null;
  responseHours?: number | null; // override
  autoEscalated?: boolean;
  lastEscalationReason?: string | null;
  satisfaction?: number | null; // 0–100 when closed
  resolution?: string | null;
  replies?: Array<{
    authorName?: string;
    role?: string;
    text?: string;
    createdAt?: string;
    level?: number;
  }>;
  auditTrail?: VoiceAuditEvent[];
};

export type VoiceAuditType = "raise" | "return" | "adopt" | "escalate" | "sla";

export type VoiceAuditEvent = {
  id?: string;
  type: VoiceAuditType | string;
  at?: string;
  actorId?: string | null;
  actorName?: string;
  actorRole?: string;
  level?: number;
  toLevel?: number;
  detail?: string;
  reason?: string;
};

export type VoiceAuditActor = {
  id?: string | null;
  userId?: string | null;
  name?: string;
  role?: string;
};

export type VoiceAuditExtra = {
  id?: string;
  at?: string;
  hideActor?: boolean;
  actorName?: string;
  actorRole?: string;
  level?: number;
  toLevel?: number;
  detail?: string;
  reason?: string;
  authorName?: string;
};

export type RateLimits = {
  day: number;
  week: number;
  month: number;
};

export type RateUsage = {
  day: number;
  week: number;
  month: number;
};

const TIER_LABELS: Record<string, { ar: string; en: string }> = {
  station_manager: { ar: "مدير الفرع", en: "Station Manager" },
  hr_supervisor: { ar: "مشرف الموارد البشرية", en: "HR Supervisor" },
  region_manager: { ar: "مدير المنطقة", en: "Region Manager" },
  ops_director: { ar: "مدير العمليات", en: "Ops Director" },
  safety: { ar: "منسق السلامة", en: "Safety Coordinator" },
  facilities: { ar: "إدارة المرافق", en: "Facilities" },
};

export function normalizeRateLimits(raw?: Partial<RateLimits> | null): RateLimits {
  return {
    day: Math.max(1, Number(raw?.day ?? DEFAULT_RATE_LIMITS.day) || DEFAULT_RATE_LIMITS.day),
    week: Math.max(1, Number(raw?.week ?? DEFAULT_RATE_LIMITS.week) || DEFAULT_RATE_LIMITS.week),
    month: Math.max(1, Number(raw?.month ?? DEFAULT_RATE_LIMITS.month) || DEFAULT_RATE_LIMITS.month),
  };
}

/** Build default 4-tier chain; optional station-manager name for label. */
export function defaultEscalationChain(stationManagerName?: string | null): EscalationTier[] {
  return DEFAULT_CHAIN_IDS.map((id) => {
    const base = TIER_LABELS[id] || { ar: id, en: id };
    if (id === "station_manager" && stationManagerName) {
      return {
        id,
        labelAr: `مدير الفرع — ${stationManagerName}`,
        labelEn: `Station Manager — ${stationManagerName}`,
        handlerIds: [],
      };
    }
    return { id, labelAr: base.ar, labelEn: base.en, handlerIds: [] };
  });
}

/**
 * Derive chain from org/handler ids (manual complaintEscalationChain).
 * Falls back to default tiers when empty — same rule as escalation.js.
 */
export function deriveEscalationChain(
  handlerIds: string[] = [],
  employees: Array<{ id: string; name?: string }> = [],
  stationManagerName?: string | null,
): EscalationTier[] {
  const ids = (handlerIds || []).filter(Boolean);
  if (!ids.length) return defaultEscalationChain(stationManagerName);
  return ids.map((empId) => {
    const emp = employees.find((e) => e.id === empId);
    const name = emp?.name || empId;
    return {
      id: empId,
      labelAr: name,
      labelEn: name,
      handlerIds: [empId],
    };
  });
}

export function stageCount(chain: EscalationTier[] = []) {
  return Math.max(1, chain.length || DEFAULT_CHAIN_IDS.length);
}

export function clampLevel(level: number, chainLen: number) {
  const max = Math.max(0, chainLen - 1);
  return Math.min(max, Math.max(0, Number(level) || 0));
}

export function responseHoursFor(report: ComplaintLike) {
  if (report.responseHours != null && Number.isFinite(Number(report.responseHours))) {
    return Math.max(1, Number(report.responseHours));
  }
  const pri = String(report.priority || "medium");
  return RESPONSE_HOURS_BY_PRIORITY[pri] ?? RESPONSE_HOURS_BY_PRIORITY.medium;
}

export function hoursSince(iso: string | null | undefined, nowMs = Date.now()) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (nowMs - t) / (1000 * 60 * 60));
}

export function clockStartAt(report: ComplaintLike) {
  return report.levelSinceAt || report.createdAt || null;
}

/** Hours remaining until SLA breach (negative = overdue). */
export function slaHoursLeft(report: ComplaintLike, nowMs = Date.now()) {
  if (report.status === "closed") return null;
  const budget = responseHoursFor(report);
  const used = hoursSince(clockStartAt(report), nowMs);
  return Math.round((budget - used) * 10) / 10;
}

export function isSlaBreached(report: ComplaintLike, nowMs = Date.now()) {
  if (report.status === "closed" || report.status === "rejected") return false;
  const left = slaHoursLeft(report, nowMs);
  return left != null && left < 0;
}

export function isAtTop(report: ComplaintLike, chainLen: number) {
  return clampLevel(Number(report.escalationLevel) || 0, chainLen) >= chainLen - 1;
}

export function buildEscalationSteps(
  report: ComplaintLike,
  chain: EscalationTier[],
) {
  const lvl = clampLevel(Number(report.escalationLevel) || 0, chain.length);
  return chain.map((tier, idx) => ({
    idx,
    id: tier.id,
    labelAr: tier.labelAr,
    labelEn: tier.labelEn,
    hasHandler: (tier.handlerIds || []).length > 0 || idx === 0,
    state: idx < lvl ? "done" : idx === lvl ? "current" : "pending",
  }));
}

export function isAnonymousReport(report: ComplaintLike | null | undefined) {
  if (!report) return false;
  if (report.anonymous === true || report.kind === "anonymous" || report.channel === "anonymous") return true;
  if (report.authorId || report.reporterName) return false;
  return Boolean(report.anonymousId) || report.reporterName == null;
}

export function voiceKind(report: ComplaintLike | null | undefined): ComplaintKind | string {
  if (!report) return "public";
  if (isAnonymousReport(report)) return "anonymous";
  if (report.kind === "suggestion" || report.type === "suggestion") return "suggestion";
  return report.kind === "public" || report.type === "complaint" ? "public" : (report.kind || "public");
}

export function matchesVoiceChannel(report: ComplaintLike | null | undefined, voice?: string | null) {
  if (!voice || voice === "all") return true;
  const kind = voiceKind(report);
  if (voice === "suggestion") return kind === "suggestion";
  if (voice === "anonymous") return kind === "anonymous";
  if (voice === "complaint") return kind === "public" || kind === "safety" || kind === "facilities";
  return kind === voice;
}

export function enrichComplaint(
  report: ComplaintLike,
  chain: EscalationTier[] = defaultEscalationChain(),
  nowMs = Date.now(),
) {
  const len = stageCount(chain);
  const level = clampLevel(Number(report.escalationLevel) || 0, len);
  const status = (report.status === "closed" || report.status === "rejected"
    ? report.status
    : "open") as ComplaintStatus;
  const left = status === "open" ? slaHoursLeft({ ...report, status }, nowMs) : null;
  const breached = status === "open" && left != null && left < 0;
  const tier = chain[level] || chain[chain.length - 1];
  const anon = isAnonymousReport(report);
  return {
    ...report,
    status,
    escalationLevel: level,
    anonymous: anon,
    kind: report.kind || (anon ? "anonymous" : report.type === "suggestion" ? "suggestion" : "public"),
    responseHours: responseHoursFor(report),
    slaHoursLeft: left,
    slaBreached: breached,
    atTop: isAtTop({ ...report, escalationLevel: level }, len),
    currentTierId: tier?.id || null,
    currentTierLabelAr: tier?.labelAr || null,
    currentTierLabelEn: tier?.labelEn || null,
    steps: buildEscalationSteps({ ...report, escalationLevel: level }, chain),
    canAutoEscalate: breached && !isAtTop({ ...report, escalationLevel: level }, len),
  };
}

export function deriveComplaintStats(
  reports: ComplaintLike[],
  chain: EscalationTier[] = defaultEscalationChain(),
  nowMs = Date.now(),
) {
  const enriched = reports.map((r) => enrichComplaint(r, chain, nowMs));
  const open = enriched.filter((r) => r.status === "open");
  const anonOpen = open.filter((r) => r.anonymous);
  const breached = open.filter((r) => r.slaBreached);
  const closed = enriched.filter((r) => r.status === "closed");
  const monthStart = new Date(nowMs);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const closedMonth = closed.filter((r) => {
    const t = Date.parse(String(r.closedAt || ""));
    return Number.isFinite(t) && t >= monthStart.getTime();
  });
  const responseSamples = enriched
    .filter((r) => r.status === "closed" && r.createdAt && r.closedAt)
    .map((r) => hoursSince(r.createdAt, Date.parse(String(r.closedAt))));
  const avgResponse = responseSamples.length
    ? Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length)
    : open.length
      ? Math.round(
        open.reduce((s, r) => s + hoursSince(clockStartAt(r), nowMs), 0) / open.length,
      )
      : 0;
  const sats = closedMonth
    .map((r) => Number(r.satisfaction))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const avgSat = sats.length ? Math.round(sats.reduce((a, b) => a + b, 0) / sats.length) : null;
  return {
    openCount: open.length,
    anonymousOpen: anonOpen.length,
    avgResponseHours: avgResponse,
    breachedCount: breached.length,
    autoEscalatedOpen: open.filter((r) => r.autoEscalated).length,
    closedThisMonth: closedMonth.length,
    avgSatisfaction: avgSat,
  };
}

export function countFilingsInWindow(
  filedAts: Array<string | null | undefined>,
  windowMs: number,
  nowMs = Date.now(),
) {
  return filedAts.filter((iso) => {
    const t = Date.parse(String(iso || ""));
    return Number.isFinite(t) && nowMs - t < windowMs;
  }).length;
}

export function checkRateLimitGate(
  usage: RateUsage,
  limits: Partial<RateLimits> | null | undefined = DEFAULT_RATE_LIMITS,
) {
  const lim = normalizeRateLimits(limits);
  if (usage.day >= lim.day) {
    return {
      ok: false as const,
      error: "RATE_LIMIT_DAY",
      reason: `بلغت حد البلاغات اليومي (${lim.day}).`,
      reasonEn: `Daily anonymous report limit reached (${lim.day}).`,
      limit: lim.day,
      used: usage.day,
    };
  }
  if (usage.week >= lim.week) {
    return {
      ok: false as const,
      error: "RATE_LIMIT_WEEK",
      reason: `بلغت حد البلاغات الأسبوعي (${lim.week}).`,
      reasonEn: `Weekly anonymous report limit reached (${lim.week}).`,
      limit: lim.week,
      used: usage.week,
    };
  }
  if (usage.month >= lim.month) {
    return {
      ok: false as const,
      error: "RATE_LIMIT_MONTH",
      reason: `بلغت حد البلاغات الشهري (${lim.month}).`,
      reasonEn: `Monthly anonymous report limit reached (${lim.month}).`,
      limit: lim.month,
      used: usage.month,
    };
  }
  return { ok: true as const, limits: lim };
}

export function resolveVoiceWorkStationId(actor: { stationId?: string | null } | null | undefined) {
  const id = String(actor?.stationId || "").trim();
  return id || null;
}

export function checkSubmitVoiceGate(opts: {
  channel?: string | null;
  title?: string | null;
  message?: string | null;
  usage?: RateUsage | null;
  limits?: Partial<RateLimits> | null;
  stationId?: string | null;
}) {
  const heading = String(opts.title || "").trim();
  const text = String(opts.message || "").trim();
  if (!resolveVoiceWorkStationId({ stationId: opts.stationId })) {
    return {
      ok: false as const,
      error: "STATION_REQUIRED",
      reason: "لا يُرفع صوت بلا محطة عمل — اربط ملفك بفرع أولاً.",
      reasonEn: "A voice cannot be raised without a work station — place your file on a branch first.",
    };
  }
  if (heading.length < 5) {
    return {
      ok: false as const,
      error: "TITLE_REQUIRED",
      reason: "العنوان مختصر جداً — اكتب ما يُقرأ في الطابور.",
      reasonEn: "The title is too short — write what the queue will read first.",
    };
  }
  if (text.length < 15) {
    return {
      ok: false as const,
      error: "DETAIL_REQUIRED",
      reason: "التفصيل غير كافٍ — بلا واقعة لا تُراجع.",
      reasonEn: "The detail is not enough — a voice without an incident cannot be reviewed.",
    };
  }
  if (opts.channel === "anonymous") {
    const rate = checkRateLimitGate(opts.usage || { day: 0, week: 0, month: 0 }, opts.limits);
    if (!rate.ok) return rate;
  }
  return { ok: true as const, title: heading.slice(0, 160), message: text.slice(0, 5000) };
}

export function checkWorkerAppealGate(
  report: ComplaintLike | null | undefined,
  chain: EscalationTier[],
  actorId?: string | null,
) {
  if (!report) {
    return {
      ok: false as const,
      error: "REPORT_NOT_FOUND",
      reason: "الصوت غير موجود.",
      reasonEn: "The voice was not found.",
    };
  }
  if (isAnonymousReport(report) || !report.authorId) {
    return {
      ok: false as const,
      error: "ANONYMOUS_NO_APPEAL",
      reason: "البلاغ المجهول لا يُرفع من صاحبه — لا هويّة تُخاطَب.",
      reasonEn: "An anonymous report cannot be raised by its author — there is no identity to address.",
    };
  }
  if (String(report.authorId) !== String(actorId)) {
    return {
      ok: false as const,
      error: "NOT_AUTHOR",
      reason: "لا يرفع الصوت إلا صاحبه.",
      reasonEn: "Only the author can raise this voice.",
    };
  }
  if (report.status !== "rejected") {
    return {
      ok: false as const,
      error: "NOT_RETURNED",
      reason: "لا يُرفع إلا بعد إعادة بملاحظة.",
      reasonEn: "It can be raised only after it was returned with a note.",
    };
  }
  return checkEscalateGate(report, chain, { forceSla: true });
}

export function checkReturnNoteGate(note?: string | null) {
  if (String(note || "").trim().length < 5) {
    return {
      ok: false as const,
      error: "RETURN_NOTE_REQUIRED",
      reason: "الإعادة تحتاج ملاحظة مكتوبة يصلها صاحب الصوت.",
      reasonEn: "A return needs a written note the author will see.",
    };
  }
  return { ok: true as const };
}

export function checkFileAnonymousGate(opts: {
  message?: string | null;
  usage: RateUsage;
  limits?: Partial<RateLimits> | null;
  stationId?: string | null;
}) {
  if (!resolveVoiceWorkStationId({ stationId: opts.stationId })) {
    return {
      ok: false as const,
      error: "STATION_REQUIRED",
      reason: "لا يُرفع بلاغ مجهول بلا محطة عمل — يُحال لمدير الفرع دون كشف هويّتك.",
      reasonEn: "An anonymous report cannot be filed without a work station — it is routed to that station's manager without naming you.",
    };
  }
  const message = String(opts.message || "").trim();
  if (!message) {
    return {
      ok: false as const,
      error: "MESSAGE_REQUIRED",
      reason: "نص البلاغ مطلوب.",
      reasonEn: "Report message is required.",
    };
  }
  const rate = checkRateLimitGate(opts.usage, opts.limits);
  if (!rate.ok) return rate;
  return { ok: true as const, message: message.slice(0, 5000), limits: rate.limits };
}

export function checkEscalateGate(
  report: ComplaintLike | null | undefined,
  chain: EscalationTier[],
  opts: { actorId?: string | null; isHandler?: boolean; forceSla?: boolean } = {},
) {
  if (!report) {
    return {
      ok: false as const,
      error: "REPORT_NOT_FOUND",
      reason: "البلاغ غير موجود.",
      reasonEn: "Report not found.",
    };
  }
  if (report.status === "closed") {
    return {
      ok: false as const,
      error: "ALREADY_CLOSED",
      reason: "البلاغ مغلق ولا يُصعَّد.",
      reasonEn: "Report is already closed.",
    };
  }
  const len = stageCount(chain);
  const level = clampLevel(Number(report.escalationLevel) || 0, len);
  if (level >= len - 1) {
    return {
      ok: false as const,
      error: "AT_TOP_OF_CHAIN",
      reason: "البلاغ عند أعلى مستوى في السلسلة.",
      reasonEn: "Report is at the top of the escalation chain.",
    };
  }
  // Manual escalate requires current-level handler (unless SLA sweep).
  if (!opts.forceSla && opts.isHandler === false) {
    return {
      ok: false as const,
      error: "NOT_HANDLER",
      reason: "لست معالجًا لهذا المستوى — لا تصعيد يدوي.",
      reasonEn: "You are not a handler at this level — cannot escalate manually.",
    };
  }
  const nextTier = chain[level + 1];
  const isDefaultRoleTier = !!nextTier
    && (DEFAULT_CHAIN_IDS as readonly string[]).includes(nextTier.id);
  // Custom handler chain: next tier must name at least one employee.
  if (
    !opts.forceSla
    && nextTier
    && !isDefaultRoleTier
    && Array.isArray(nextTier.handlerIds)
    && nextTier.handlerIds.length === 0
  ) {
    return {
      ok: false as const,
      error: "NO_HANDLER_AT_LEVEL",
      reason: "لا معالج معيَّن في المستوى التالي.",
      reasonEn: "No handler assigned at the next escalation level.",
    };
  }
  return {
    ok: true as const,
    nextLevel: level + 1,
    reason: opts.forceSla ? "SLA_BREACH" : "MANUAL",
  };
}

export function checkCloseGate(
  report: ComplaintLike | null | undefined,
  opts: { isHandler?: boolean } = {},
) {
  if (!report) {
    return {
      ok: false as const,
      error: "REPORT_NOT_FOUND",
      reason: "البلاغ غير موجود.",
      reasonEn: "Report not found.",
    };
  }
  if (report.status === "closed") {
    return {
      ok: false as const,
      error: "ALREADY_CLOSED",
      reason: "البلاغ مغلق مسبقًا.",
      reasonEn: "Report is already closed.",
    };
  }
  if (opts.isHandler === false) {
    return {
      ok: false as const,
      error: "NOT_HANDLER",
      reason: "لست معالجًا لهذا البلاغ.",
      reasonEn: "You are not a handler for this report.",
    };
  }
  return { ok: true as const };
}

const ACTOR_ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  ...TIER_LABELS,
  director: { ar: "المدير", en: "Director" },
  ops_manager: { ar: "مدير العمليات", en: "Ops manager" },
  pgm: { ar: "مدير البرنامج", en: "Programme manager" },
  owner: { ar: "مالك الشركة", en: "Company owner" },
  admin: { ar: "الإدارة", en: "Admin" },
  employee: { ar: "الموظف", en: "Employee" },
};

const AUDIT_TYPE_ORDER: Record<string, number> = { raise: 0, sla: 1, escalate: 2, return: 3, adopt: 4 };

function voiceAuditId(prefix = "vae") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function scrubVoiceAuditEvent(event: VoiceAuditEvent, anonymous: boolean): VoiceAuditEvent | null {
  if (!event || typeof event !== "object") return null;
  const row = { ...event } as VoiceAuditEvent & { rateActorId?: unknown };
  delete row.rateActorId;
  if (anonymous && row.type === "raise") {
    row.actorId = null;
    row.actorName = "";
  }
  return row;
}

function sortVoiceAudit(events: VoiceAuditEvent[]) {
  return events.slice().sort((a, b) => {
    const ta = Date.parse(a?.at || "") || 0;
    const tb = Date.parse(b?.at || "") || 0;
    if (ta !== tb) return ta - tb;
    return (AUDIT_TYPE_ORDER[a?.type] ?? 9) - (AUDIT_TYPE_ORDER[b?.type] ?? 9);
  });
}

export function appendVoiceAudit(
  report: ComplaintLike | null | undefined,
  type: VoiceAuditType | string,
  actor: VoiceAuditActor = {},
  extra: VoiceAuditExtra = {},
): VoiceAuditEvent[] {
  const trail = Array.isArray(report?.auditTrail) ? report.auditTrail.filter(Boolean) : [];
  const hide = Boolean(extra.hideActor);
  const event: VoiceAuditEvent = {
    id: extra.id || voiceAuditId(type),
    type,
    at: extra.at || new Date().toISOString(),
    actorId: hide ? null : (actor.id || actor.userId || null),
    actorName: hide ? "" : String(actor.name || extra.actorName || "").trim(),
    actorRole: hide ? "" : String(actor.role || extra.actorRole || "").trim(),
    level: extra.level != null ? Number(extra.level) : Number(report?.escalationLevel) || 0,
    detail: String(extra.detail || "").trim(),
    reason: extra.reason || "",
  };
  if (extra.toLevel != null) event.toLevel = Number(extra.toLevel);
  return [...trail, event];
}

export function derivedVoiceAudit(report: ComplaintLike | null | undefined, extras: VoiceAuditExtra = {}) {
  if (!report) return [];
  const events: VoiceAuditEvent[] = [];
  const anon = isAnonymousReport(report);
  if (report.createdAt || report.authorId || report.anonymousId || report.reporterName) {
    events.push({
      id: "derived_raise",
      type: "raise",
      at: report.createdAt || "",
      actorId: anon ? null : (report.authorId || null),
      actorName: anon ? "" : String(extras.authorName || report.reporterName || "").trim(),
      actorRole: "",
      level: 0,
      detail: "",
      reason: "",
    });
  }
  const replies = Array.isArray(report.replies) ? report.replies.filter(Boolean) : [];
  replies.forEach((reply, index) => {
    const last = index === replies.length - 1;
    const adopted = last && (report.resolution === "approved" || report.resolution === "adopt" || report.status === "closed")
      && report.status !== "rejected";
    events.push({
      id: `derived_reply_${index}`,
      type: adopted ? "adopt" : "return",
      at: reply.createdAt || report.closedAt || "",
      actorId: null,
      actorName: String(reply.authorName || "").trim(),
      actorRole: String(reply.role || "").trim(),
      level: reply.level != null ? Number(reply.level) : Number(report.escalationLevel) || 0,
      detail: String(reply.text || "").trim(),
      reason: "",
    });
  });
  if (
    (report.autoEscalated || report.lastEscalationReason === "SLA_BREACH")
    && !events.some((event) => event.type === "sla")
  ) {
    const toLevel = Number(report.escalationLevel) || 1;
    events.push({
      id: "derived_sla",
      type: "sla",
      at: report.levelSinceAt || report.createdAt || "",
      actorId: null,
      actorName: "",
      actorRole: "",
      level: Math.max(0, toLevel - 1),
      toLevel,
      detail: "",
      reason: "SLA_BREACH",
    });
  }
  return sortVoiceAudit(events);
}

export function ensureVoiceAuditTrail(report: ComplaintLike | null | undefined, extras: VoiceAuditExtra = {}) {
  const anon = isAnonymousReport(report);
  const stored = (Array.isArray(report?.auditTrail) ? report.auditTrail : [])
    .map((event) => scrubVoiceAuditEvent(event, anon))
    .filter((event): event is VoiceAuditEvent => Boolean(event));
  if (stored.length) {
    if (!stored.some((event) => event.type === "raise")) {
      return sortVoiceAudit([
        ...derivedVoiceAudit(report, extras).filter((event) => event.type === "raise"),
        ...stored,
      ]);
    }
    return sortVoiceAudit(stored);
  }
  return derivedVoiceAudit(report, extras)
    .map((event) => scrubVoiceAuditEvent(event, anon))
    .filter((event): event is VoiceAuditEvent => Boolean(event));
}

export function voiceAuditActorLabel(
  event: VoiceAuditEvent | null | undefined,
  opts: { hideName?: boolean; anonymous?: boolean; ar?: boolean; chain?: EscalationTier[] } = {},
) {
  const hideName = Boolean(opts.hideName);
  const anonymous = Boolean(opts.anonymous);
  const ar = opts.ar !== false;
  const chain = opts.chain || [];
  if (event?.type === "sla") return ar ? "النظام" : "System";
  if (event?.type === "raise") {
    if (anonymous || hideName) return ar ? "بلا هويّة" : "No identity";
    const named = String(event?.actorName || "").trim();
    return named || (ar ? "صاحب الصوت" : "The author");
  }
  if (hideName) {
    const role = ACTOR_ROLE_LABELS[event?.actorRole || ""] || ACTOR_ROLE_LABELS[chain[event?.level || 0]?.id];
    if (role) return ar ? role.ar : role.en;
    const tier = chain[event?.level || 0];
    if (tier) return ar ? (tier.labelAr || tier.labelEn) : (tier.labelEn || tier.labelAr);
    return ar ? "المراجع" : "Reviewer";
  }
  return String(event?.actorName || "").trim() || (ar ? "غير مسمّى" : "Unnamed");
}

export function voiceAuditActionLabel(
  event: VoiceAuditEvent | null | undefined,
  opts: { ar?: boolean; report?: ComplaintLike; chain?: EscalationTier[] } = {},
) {
  const ar = opts.ar !== false;
  const chain = opts.chain || [];
  if (event?.type === "raise") return ar ? "رُفع" : "Raised";
  if (event?.type === "return") return ar ? "أُعيد بملاحظة" : "Returned with a note";
  if (event?.type === "adopt") {
    return isAnonymousReport(opts.report) ? (ar ? "عُولِج" : "Handled") : (ar ? "اعتُمد" : "Adopted");
  }
  if (event?.type === "sla") {
    const dest = chain[event.toLevel ?? -1];
    if (dest) {
      return ar
        ? `رُفع تلقائياً لتجاوز المهلة إلى ${dest.labelAr}`
        : `Raised automatically — window missed · ${dest.labelEn}`;
    }
    return ar ? "رُفع تلقائياً لتجاوز المهلة" : "Raised automatically — window missed";
  }
  if (event?.type === "escalate") {
    if (event.reason === "WORKER_APPEAL") {
      return ar ? "رفعه صاحبه بعد إعادة" : "Author raised it after a return";
    }
    const dest = chain[event.toLevel ?? -1];
    if (dest) return ar ? `صُعِّد إلى ${dest.labelAr}` : `Escalated to ${dest.labelEn}`;
    return ar ? "صُعِّد" : "Escalated";
  }
  return event?.type || "";
}

export function buildVoiceAuditTimeline(
  report: ComplaintLike | null | undefined,
  opts: { ar?: boolean; viewerIsHandler?: boolean; authorName?: string; chain?: EscalationTier[] } = {},
) {
  const ar = opts.ar !== false;
  const viewerIsHandler = Boolean(opts.viewerIsHandler);
  const anon = isAnonymousReport(report);
  const hideName = anon && !viewerIsHandler;
  const chain = opts.chain || [];
  const events = ensureVoiceAuditTrail(report, { authorName: opts.authorName });
  const tones: Record<string, string> = { raise: "#4B5567", return: "#8A6516", adopt: "#137A49", escalate: "#8A1C2B", sla: "#8A1C2B" };
  return events.map((event, index) => ({
    id: event.id || `vae_${index}`,
    type: event.type,
    at: event.at || "",
    actor: voiceAuditActorLabel(event, { hideName, anonymous: anon, ar, chain }),
    text: voiceAuditActionLabel(event, { ar, report: report || undefined, chain }),
    detail: String(event.detail || "").trim(),
    tone: tones[event.type] || "#94A3B8",
  }));
}

/**
 * Apply SLA auto-escalation for open breached reports.
 * Returns mutated copies + count of escalations performed.
 */
export function applySlaAutoEscalate(
  reports: ComplaintLike[],
  chain: EscalationTier[],
  nowMs = Date.now(),
) {
  const nowIso = new Date(nowMs).toISOString();
  let escalated = 0;
  const next = reports.map((r) => {
    if (r.status !== "open") return r;
    if (!isSlaBreached(r, nowMs)) return r;
    const gate = checkEscalateGate(r, chain, { forceSla: true });
    if (!gate.ok) return r;
    const toLevel = gate.nextLevel;
    const trail = Array.isArray(r.auditTrail) ? r.auditTrail : [];
    const already = trail.some((event) => event?.type === "sla" && Number(event.toLevel) === toLevel);
    escalated += 1;
    return {
      ...r,
      escalationLevel: toLevel,
      levelSinceAt: nowIso,
      autoEscalated: true,
      lastEscalationReason: "SLA_BREACH",
      auditTrail: already
        ? trail
        : appendVoiceAudit(r, "sla", {}, {
          id: `vae_sla_${r.id || "x"}_${toLevel}`,
          at: nowIso,
          hideActor: true,
          level: Number(r.escalationLevel) || 0,
          toLevel,
          reason: "SLA_BREACH",
        }),
    };
  });
  return { reports: next, escalated };
}
