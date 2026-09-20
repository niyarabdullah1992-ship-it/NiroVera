/** Client mirror of base44/shared/complaintDerivations.ts
 *  Keep in sync — complaints / anonymous rate limits / SLA escalation.
 */

export const DEFAULT_RATE_LIMITS = { day: 3, week: 10, month: 30 };

export const RATE_WINDOW_MS = {
  day: 86_400_000,
  week: 86_400_000 * 7,
  month: 86_400_000 * 30,
};

export const RESPONSE_HOURS_BY_PRIORITY = {
  high: 24,
  medium: 48,
  low: 96,
};

export const DEFAULT_CHAIN_IDS = [
  "station_manager",
  "hr_supervisor",
  "region_manager",
  "ops_director",
];

const TIER_LABELS = {
  station_manager: { ar: "مدير الفرع", en: "Station Manager" },
  hr_supervisor: { ar: "مشرف الموارد البشرية", en: "HR Supervisor" },
  region_manager: { ar: "مدير المنطقة", en: "Region Manager" },
  ops_director: { ar: "مدير العمليات", en: "Ops Director" },
  safety: { ar: "منسق السلامة", en: "Safety Coordinator" },
  facilities: { ar: "إدارة المرافق", en: "Facilities" },
};

export function normalizeRateLimits(raw) {
  return {
    day: Math.max(1, Number(raw?.day ?? DEFAULT_RATE_LIMITS.day) || DEFAULT_RATE_LIMITS.day),
    week: Math.max(1, Number(raw?.week ?? DEFAULT_RATE_LIMITS.week) || DEFAULT_RATE_LIMITS.week),
    month: Math.max(1, Number(raw?.month ?? DEFAULT_RATE_LIMITS.month) || DEFAULT_RATE_LIMITS.month),
  };
}

export function defaultEscalationChain(stationManagerName) {
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

export function deriveEscalationChain(handlerIds = [], employees = [], stationManagerName) {
  const ids = (handlerIds || []).filter(Boolean);
  if (!ids.length) return defaultEscalationChain(stationManagerName);
  return ids.map((empId) => {
    const emp = employees.find((e) => e.id === empId);
    const name = emp?.name || empId;
    return { id: empId, labelAr: name, labelEn: name, handlerIds: [empId] };
  });
}

export function stageCount(chain = []) {
  return Math.max(1, chain.length || DEFAULT_CHAIN_IDS.length);
}

export function clampLevel(level, chainLen) {
  const max = Math.max(0, chainLen - 1);
  return Math.min(max, Math.max(0, Number(level) || 0));
}

export function responseHoursFor(report) {
  if (report.responseHours != null && Number.isFinite(Number(report.responseHours))) {
    return Math.max(1, Number(report.responseHours));
  }
  const pri = String(report.priority || "medium");
  return RESPONSE_HOURS_BY_PRIORITY[pri] ?? RESPONSE_HOURS_BY_PRIORITY.medium;
}

export function hoursSince(iso, nowMs = Date.now()) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (nowMs - t) / (1000 * 60 * 60));
}

export function clockStartAt(report) {
  return report.levelSinceAt || report.createdAt || null;
}

export function slaHoursLeft(report, nowMs = Date.now()) {
  if (report.status === "closed") return null;
  const budget = responseHoursFor(report);
  const used = hoursSince(clockStartAt(report), nowMs);
  return Math.round((budget - used) * 10) / 10;
}

export function isSlaBreached(report, nowMs = Date.now()) {
  if (report.status === "closed" || report.status === "rejected") return false;
  const left = slaHoursLeft(report, nowMs);
  return left != null && left < 0;
}

export function isAtTop(report, chainLen) {
  return clampLevel(Number(report.escalationLevel) || 0, chainLen) >= chainLen - 1;
}

export function buildEscalationSteps(report, chain) {
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

/** Voice channels: suggestion · named complaint · anonymous report. */
export function isAnonymousReport(report) {
  if (!report) return false;
  if (report.anonymous === true || report.kind === "anonymous" || report.channel === "anonymous") return true;
  if (report.authorId || report.reporterName) return false;
  return Boolean(report.anonymousId) || report.reporterName == null;
}

export function voiceKind(report) {
  if (!report) return "public";
  if (isAnonymousReport(report)) return "anonymous";
  if (report.kind === "suggestion" || report.type === "suggestion") return "suggestion";
  return report.kind === "public" || report.type === "complaint" ? "public" : (report.kind || "public");
}

export function matchesVoiceChannel(report, voice) {
  if (!voice || voice === "all") return true;
  const kind = voiceKind(report);
  if (voice === "suggestion") return kind === "suggestion";
  if (voice === "anonymous") return kind === "anonymous";
  if (voice === "complaint") return kind === "public" || kind === "safety" || kind === "facilities";
  return kind === voice;
}

export function enrichComplaint(report, chain = defaultEscalationChain(), nowMs = Date.now()) {
  const len = stageCount(chain);
  const level = clampLevel(Number(report.escalationLevel) || 0, len);
  const status = report.status === "closed" || report.status === "rejected" ? report.status : "open";
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

export function deriveComplaintStats(reports, chain = defaultEscalationChain(), nowMs = Date.now()) {
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
      ? Math.round(open.reduce((s, r) => s + hoursSince(clockStartAt(r), nowMs), 0) / open.length)
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

export function countFilingsInWindow(filedAts, windowMs, nowMs = Date.now()) {
  return filedAts.filter((iso) => {
    const t = Date.parse(String(iso || ""));
    return Number.isFinite(t) && nowMs - t < windowMs;
  }).length;
}

export function checkRateLimitGate(usage, limits = DEFAULT_RATE_LIMITS) {
  const lim = normalizeRateLimits(limits);
  if (usage.day >= lim.day) {
    return {
      ok: false,
      error: "RATE_LIMIT_DAY",
      reason: `بلغت حد البلاغات اليومي (${lim.day}).`,
      reasonEn: `Daily anonymous report limit reached (${lim.day}).`,
      limit: lim.day,
      used: usage.day,
    };
  }
  if (usage.week >= lim.week) {
    return {
      ok: false,
      error: "RATE_LIMIT_WEEK",
      reason: `بلغت حد البلاغات الأسبوعي (${lim.week}).`,
      reasonEn: `Weekly anonymous report limit reached (${lim.week}).`,
      limit: lim.week,
      used: usage.week,
    };
  }
  if (usage.month >= lim.month) {
    return {
      ok: false,
      error: "RATE_LIMIT_MONTH",
      reason: `بلغت حد البلاغات الشهري (${lim.month}).`,
      reasonEn: `Monthly anonymous report limit reached (${lim.month}).`,
      limit: lim.month,
      used: usage.month,
    };
  }
  return { ok: true, limits: lim };
}

export function resolveVoiceWorkStationId(actor) {
  const id = String(actor?.stationId || "").trim();
  return id || null;
}

export function checkSubmitVoiceGate({ channel, title, message, usage, limits, stationId } = {}) {
  const heading = String(title || "").trim();
  const text = String(message || "").trim();
  if (!resolveVoiceWorkStationId({ stationId })) {
    return {
      ok: false,
      error: "STATION_REQUIRED",
      reason: "لا يُرفع صوت بلا محطة عمل — اربط ملفك بفرع أولاً.",
      reasonEn: "A voice cannot be raised without a work station — place your file on a branch first.",
    };
  }
  if (heading.length < 5) {
    return {
      ok: false,
      error: "TITLE_REQUIRED",
      reason: "العنوان مختصر جداً — اكتب ما يُقرأ في الطابور.",
      reasonEn: "The title is too short — write what the queue will read first.",
    };
  }
  if (text.length < 15) {
    return {
      ok: false,
      error: "DETAIL_REQUIRED",
      reason: "التفصيل غير كافٍ — بلا واقعة لا تُراجع.",
      reasonEn: "The detail is not enough — a voice without an incident cannot be reviewed.",
    };
  }
  if (channel === "anonymous") {
    const rate = checkRateLimitGate(usage, limits);
    if (!rate.ok) return rate;
  }
  return { ok: true, title: heading.slice(0, 160), message: text.slice(0, 5000) };
}

export function checkWorkerAppealGate(report, chain, actorId) {
  if (!report) {
    return {
      ok: false,
      error: "REPORT_NOT_FOUND",
      reason: "الصوت غير موجود.",
      reasonEn: "The voice was not found.",
    };
  }
  if (isAnonymousReport(report) || !report.authorId) {
    return {
      ok: false,
      error: "ANONYMOUS_NO_APPEAL",
      reason: "البلاغ المجهول لا يُرفع من صاحبه — لا هويّة تُخاطَب.",
      reasonEn: "An anonymous report cannot be raised by its author — there is no identity to address.",
    };
  }
  if (String(report.authorId) !== String(actorId)) {
    return {
      ok: false,
      error: "NOT_AUTHOR",
      reason: "لا يرفع الصوت إلا صاحبه.",
      reasonEn: "Only the author can raise this voice.",
    };
  }
  if (report.status !== "rejected") {
    return {
      ok: false,
      error: "NOT_RETURNED",
      reason: "لا يُرفع إلا بعد إعادة بملاحظة.",
      reasonEn: "It can be raised only after it was returned with a note.",
    };
  }
  return checkEscalateGate(report, chain, { forceSla: true });
}

export function checkReturnNoteGate(note) {
  if (String(note || "").trim().length < 5) {
    return {
      ok: false,
      error: "RETURN_NOTE_REQUIRED",
      reason: "الإعادة تحتاج ملاحظة مكتوبة يصلها صاحب الصوت.",
      reasonEn: "A return needs a written note the author will see.",
    };
  }
  return { ok: true };
}

export function checkFileAnonymousGate({ message, usage, limits, stationId } = {}) {
  const text = String(message || "").trim();
  if (!resolveVoiceWorkStationId({ stationId })) {
    return {
      ok: false,
      error: "STATION_REQUIRED",
      reason: "لا يُرفع بلاغ مجهول بلا محطة عمل — يُحال لمدير الفرع دون كشف هويّتك.",
      reasonEn: "An anonymous report cannot be filed without a work station — it is routed to that station's manager without naming you.",
    };
  }
  if (!text) {
    return {
      ok: false,
      error: "MESSAGE_REQUIRED",
      reason: "نص البلاغ مطلوب.",
      reasonEn: "Report message is required.",
    };
  }
  const rate = checkRateLimitGate(usage, limits);
  if (!rate.ok) return rate;
  return { ok: true, message: text.slice(0, 5000), limits: rate.limits };
}

export function checkEscalateGate(report, chain, opts = {}) {
  if (!report) {
    return {
      ok: false,
      error: "REPORT_NOT_FOUND",
      reason: "البلاغ غير موجود.",
      reasonEn: "Report not found.",
    };
  }
  if (report.status === "closed") {
    return {
      ok: false,
      error: "ALREADY_CLOSED",
      reason: "البلاغ مغلق ولا يُصعَّد.",
      reasonEn: "Report is already closed.",
    };
  }
  const len = stageCount(chain);
  const level = clampLevel(Number(report.escalationLevel) || 0, len);
  if (level >= len - 1) {
    return {
      ok: false,
      error: "AT_TOP_OF_CHAIN",
      reason: "البلاغ عند أعلى مستوى في السلسلة.",
      reasonEn: "Report is at the top of the escalation chain.",
    };
  }
  if (!opts.forceSla && opts.isHandler === false) {
    return {
      ok: false,
      error: "NOT_HANDLER",
      reason: "لست معالجًا لهذا المستوى — لا تصعيد يدوي.",
      reasonEn: "You are not a handler at this level — cannot escalate manually.",
    };
  }
  const nextTier = chain[level + 1];
  const isDefaultRoleTier = !!nextTier && DEFAULT_CHAIN_IDS.includes(nextTier.id);
  if (
    !opts.forceSla
    && nextTier
    && !isDefaultRoleTier
    && Array.isArray(nextTier.handlerIds)
    && nextTier.handlerIds.length === 0
  ) {
    return {
      ok: false,
      error: "NO_HANDLER_AT_LEVEL",
      reason: "لا معالج معيَّن في المستوى التالي.",
      reasonEn: "No handler assigned at the next escalation level.",
    };
  }
  return {
    ok: true,
    nextLevel: level + 1,
    reason: opts.forceSla ? "SLA_BREACH" : "MANUAL",
  };
}

export function checkCloseGate(report, opts = {}) {
  if (!report) {
    return {
      ok: false,
      error: "REPORT_NOT_FOUND",
      reason: "البلاغ غير موجود.",
      reasonEn: "Report not found.",
    };
  }
  if (report.status === "closed") {
    return {
      ok: false,
      error: "ALREADY_CLOSED",
      reason: "البلاغ مغلق مسبقًا.",
      reasonEn: "Report is already closed.",
    };
  }
  if (opts.isHandler === false) {
    return {
      ok: false,
      error: "NOT_HANDLER",
      reason: "لست معالجًا لهذا البلاغ.",
      reasonEn: "You are not a handler for this report.",
    };
  }
  return { ok: true };
}

const ACTOR_ROLE_LABELS = {
  ...TIER_LABELS,
  director: { ar: "المدير", en: "Director" },
  ops_manager: { ar: "مدير العمليات", en: "Ops manager" },
  pgm: { ar: "مدير البرنامج", en: "Programme manager" },
  owner: { ar: "مالك الشركة", en: "Company owner" },
  admin: { ar: "الإدارة", en: "Admin" },
  employee: { ar: "الموظف", en: "Employee" },
};

const AUDIT_TYPE_ORDER = { raise: 0, sla: 1, escalate: 2, return: 3, adopt: 4 };

function voiceAuditId(prefix = "vae") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function scrubVoiceAuditEvent(event, anonymous) {
  if (!event || typeof event !== "object") return null;
  const row = { ...event };
  delete row.rateActorId;
  if (anonymous && row.type === "raise") {
    row.actorId = null;
    row.actorName = "";
  }
  return row;
}

function sortVoiceAudit(events) {
  return events.slice().sort((a, b) => {
    const ta = Date.parse(a?.at || "") || 0;
    const tb = Date.parse(b?.at || "") || 0;
    if (ta !== tb) return ta - tb;
    return (AUDIT_TYPE_ORDER[a?.type] ?? 9) - (AUDIT_TYPE_ORDER[b?.type] ?? 9);
  });
}

export function appendVoiceAudit(report, type, actor = {}, extra = {}) {
  const trail = Array.isArray(report?.auditTrail) ? report.auditTrail.filter(Boolean) : [];
  const hide = Boolean(extra.hideActor);
  const event = {
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

export function derivedVoiceAudit(report, extras = {}) {
  if (!report) return [];
  const events = [];
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

export function ensureVoiceAuditTrail(report, extras = {}) {
  const anon = isAnonymousReport(report);
  const stored = (Array.isArray(report?.auditTrail) ? report.auditTrail : [])
    .map((event) => scrubVoiceAuditEvent(event, anon))
    .filter(Boolean);
  if (stored.length) {
    if (!stored.some((event) => event.type === "raise")) {
      return sortVoiceAudit([
        ...derivedVoiceAudit(report, extras).filter((event) => event.type === "raise"),
        ...stored,
      ]);
    }
    return sortVoiceAudit(stored);
  }
  return derivedVoiceAudit(report, extras).map((event) => scrubVoiceAuditEvent(event, anon)).filter(Boolean);
}

export function voiceAuditActorLabel(event, { hideName = false, anonymous = false, ar = true, chain = [] } = {}) {
  if (event?.type === "sla") return ar ? "النظام" : "System";
  if (event?.type === "raise") {
    if (anonymous || hideName) return ar ? "بلا هويّة" : "No identity";
    const named = String(event?.actorName || "").trim();
    return named || (ar ? "صاحب الصوت" : "The author");
  }
  if (hideName) {
    const role = ACTOR_ROLE_LABELS[event?.actorRole] || ACTOR_ROLE_LABELS[chain[event?.level]?.id];
    if (role) return ar ? role.ar : role.en;
    const tier = chain[event?.level];
    if (tier) return ar ? (tier.labelAr || tier.labelEn) : (tier.labelEn || tier.labelAr);
    return ar ? "المراجع" : "Reviewer";
  }
  return String(event?.actorName || "").trim() || (ar ? "غير مسمّى" : "Unnamed");
}

export function voiceAuditActionLabel(event, { ar = true, report, chain = [] } = {}) {
  if (event?.type === "raise") return ar ? "رُفع" : "Raised";
  if (event?.type === "return") return ar ? "أُعيد بملاحظة" : "Returned with a note";
  if (event?.type === "adopt") {
    return isAnonymousReport(report) ? (ar ? "عُولِج" : "Handled") : (ar ? "اعتُمد" : "Adopted");
  }
  if (event?.type === "sla") {
    const dest = chain[event.toLevel];
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
    const dest = chain[event.toLevel];
    if (dest) return ar ? `صُعِّد إلى ${dest.labelAr}` : `Escalated to ${dest.labelEn}`;
    return ar ? "صُعِّد" : "Escalated";
  }
  return event?.type || "";
}

export function buildVoiceAuditTimeline(report, opts = {}) {
  const ar = opts.ar !== false;
  const viewerIsHandler = Boolean(opts.viewerIsHandler);
  const anon = isAnonymousReport(report);
  const hideName = anon && !viewerIsHandler;
  const chain = opts.chain || [];
  const events = ensureVoiceAuditTrail(report, { authorName: opts.authorName });
  const tones = { raise: "#4B5567", return: "#8A6516", adopt: "#137A49", escalate: "#8A1C2B", sla: "#8A1C2B" };
  return events.map((event, index) => ({
    id: event.id || `vae_${index}`,
    type: event.type,
    at: event.at || "",
    actor: voiceAuditActorLabel(event, { hideName, anonymous: anon, ar, chain }),
    text: voiceAuditActionLabel(event, { ar, report, chain }),
    detail: String(event.detail || "").trim(),
    tone: tones[event.type] || "#94A3B8",
  }));
}

export function applySlaAutoEscalate(reports, chain, nowMs = Date.now()) {
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
