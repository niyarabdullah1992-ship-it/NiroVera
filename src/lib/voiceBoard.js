import { isPastArchiveDue } from "./archiveRule.js";
import { formatDate } from "./dateFormat.js";
import {
  buildVoiceAuditTimeline,
  defaultEscalationChain,
  deriveComplaintStats,
  enrichComplaint,
  hoursSince,
  responseHoursFor,
  slaHoursLeft,
  voiceKind,
} from "./complaintDerivations.js";
import { countAr } from "./disciplineBoard.js";
import { canHandleHrVoice, canSeeVoiceItem, filterAbuseCasesForViewer, isHrOnlyVoice, isOwnVoice, isVoiceHrReceiver } from "./voicePrivacy.js";

export const VOICE_CHANNELS = [
  {
    id: "suggestion",
    ar: "اقتراح",
    en: "Suggestion",
    accent: "var(--nv-ok-fill)",
    color: "var(--nv-ok-ink)",
    bg: "var(--nv-ok-soft)",
    border: "var(--nv-ok-line)",
    identityAr: "باسمك",
    identityEn: "In your name",
    blurbAr: "تحسين عمل أو إجراء أو بيئة فرع.",
    blurbEn: "Improve a process, a practice, or a station.",
    lawAr: "لائحة تنظيم العمل",
    lawEn: "Work regulations",
    promiseAr: "يصل باسمك إلى الموارد البشرية وحدها ليُمكن التواصل معك — لا يمر بمديرك ولا يُصعَّد. يُراجَع ويُعتمد أو يُعاد بملاحظة مكتوبة.",
    promiseEn: "It reaches HR alone in your name so you can be reached — it does not pass your manager and does not climb. It is reviewed, then adopted or returned with a written note.",
    hours: 96,
    defaultPrio: "low",
  },
  {
    id: "complaint",
    ar: "شكوى جهرية",
    en: "Open complaint",
    accent: "var(--nv-warn-fill)",
    color: "var(--nv-warn-ink)",
    bg: "var(--nv-warn-soft)",
    border: "var(--nv-warn-line)",
    identityAr: "بهوية ظاهرة",
    identityEn: "Named",
    blurbAr: "حقّ تطلبه أو ضرر وقع عليك.",
    blurbEn: "A right you claim, or a harm that fell on you.",
    lawAr: "المادة 220 · التسوية الودية",
    lawEn: "Article 220 · amicable settlement",
    promiseAr: "شكوى جهرية: تُعالَج بالاسم وتبدأ عند مديرك المباشر، وتتصعّد درجةً عند كل مهلة تفوت حتى الموارد البشرية. لا تُتخذ سبباً لجزاء، ولك بعد المسار الداخلي التسوية الودية ثم المحكمة العمالية.",
    promiseEn: "It is handled in your name because it needs your detail. It is not a ground for a sanction. After the internal path you may seek amicable settlement, then the labour court.",
    hours: 48,
    defaultPrio: "medium",
  },
  {
    id: "anonymous",
    ar: "شكوى سرية",
    en: "Confidential complaint",
    accent: "var(--nv-bad-fill)",
    color: "var(--nv-bad-ink)",
    bg: "var(--nv-bad-soft)",
    border: "var(--nv-bad-line)",
    identityAr: "بلا هويّة",
    identityEn: "No identity",
    blurbAr: "خطر أو تجاوز تخشى كشف نفسك فيه.",
    blurbEn: "A risk or a breach you fear naming yourself over.",
    lawAr: "الباب الثامن · السلامة",
    lawEn: "Chapter eight · safety",
    promiseAr: "شكوى سرية: تصل برقم لا باسم إلى الموارد البشرية وحدها، بلا تصعيد ولا مرور بمديرك. تتابع قرارها برقم المتابعة في ملفك.",
    promiseEn: "A confidential complaint: it reaches HR alone as a number, with no ladder and never via your manager. Follow its ruling by the follow-up number on your file.",
    hours: 24,
    defaultPrio: "high",
  },
];

/**
 * «شكوى إيذاء أو تحرش» — the fourth tile of the raise card. Not a voice row: a confidential HR case
 * (abuseCases, model regulation Arts. 54–56) that reaches HR only.
 */
export const ABUSE_VOICE_CHANNEL = {
  id: "abuse",
  ar: "شكوى تحرش أو إيذاء",
  en: "Harassment or abuse",
  identityAr: "سرية",
  identityEn: "Confidential",
  windowAr: "5 أيام عمل",
  windowEn: "5 working days",
  lawAr: "النموذج الموحد م54–56",
  lawEn: "Model regulation Arts. 54–56",
  promiseAr: "تصل باسمك إلى الموارد البشرية وحدها، وتُحقَّق بسرية بلجنة ليس فيها أحد الطرفين خلال خمسة أيام عمل، ولا يطّلع عليها المشكو في حقه.",
  promiseEn: "It reaches HR alone in your name and is investigated confidentially within five working days by a committee without the parties; the accused never sees it.",
  hours: 0,
  defaultPrio: "high",
};

/** Where each channel goes — the calm line under the tiles. */
export function voiceRouteLine(channelId, ar = true) {
  const hrOnly = channelId === "suggestion" || channelId === "anonymous" || channelId === "abuse";
  if (hrOnly) return ar ? "تصل إلى الموارد البشرية فقط — لا يراها مديرك" : "Reaches HR only — your manager does not see it";
  return ar ? "تبدأ عند مديرك وتتصعّد إن لم تُحل" : "Starts with your manager and climbs if not resolved";
}

export const VOICE_PRIOs = [
  { id: "low", hours: 96, ar: "منخفضة — 96 ساعة", en: "Low — 96 hours" },
  { id: "medium", hours: 48, ar: "متوسطة — 48 ساعة", en: "Medium — 48 hours" },
  { id: "high", hours: 24, ar: "عالية — 24 ساعة", en: "High — 24 hours" },
];

export const VOICE_TOPICS = [
  { id: "wage", ar: "الأجر والمستحقات", en: "Wage and dues", cite: "المادة 90 · 93", ruleAr: "الأجر في موعده، والخصم لا يتجاوز نصف الأجر", ruleEn: "Wages are paid on time, and a deduction may not exceed half the wage" },
  { id: "hours", ar: "ساعات العمل والراحة", en: "Hours and rest", cite: "المادة 98 · 101 · 104", ruleAr: "8 ساعات يومياً، راحة كل 5 ساعات، ويوم راحة أسبوعي", ruleEn: "Eight hours a day, a rest every five hours, and a weekly rest day" },
  { id: "leave", ar: "الإجازات", en: "Leave", cite: "المادة 109 · 117", ruleAr: "21 يوماً سنوية، والمرضية بتقرير", ruleEn: "Twenty-one days of annual leave, and sick leave with a report" },
  { id: "safety", ar: "السلامة والصحة", en: "Safety and health", cite: "المادة 121 · 125", ruleAr: "حماية العمال ووسائل الإسعاف", ruleEn: "Protection of workers and first-aid means" },
  { id: "conduct", ar: "سلوك أو إساءة", en: "Conduct or abuse", cite: "المادة 61", ruleAr: "حسن معاملة العمال والامتناع عما يمسّ كرامتهم", ruleEn: "Decent treatment, and nothing that touches a worker's dignity" },
  { id: "place", ar: "بيئة العمل", en: "Workplace", cite: "المادة 122", ruleAr: "توفير بيئة عمل آمنة", ruleEn: "A safe workplace is required" },
  { id: "contract", ar: "العقد والوثائق", en: "Contract and papers", cite: "المادة 51 · 53", ruleAr: "عقد مكتوب وفترة تجربة محدودة", ruleEn: "A written contract and a limited probation" },
  { id: "other", ar: "أخرى", en: "Other", cite: "لائحة تنظيم العمل", ruleAr: "ما لا يندرج تحت مادة محدّدة", ruleEn: "What does not fall under one article" },
];

export function channelOf(id) {
  return VOICE_CHANNELS.find((row) => row.id === id) || VOICE_CHANNELS[0];
}

export function topicOf(id) {
  return VOICE_TOPICS.find((row) => row.id === id) || VOICE_TOPICS[0];
}

export function voicePublicId(item) {
  const ref = String(item?.voiceRef || item?.anonymousId || "").trim();
  if (ref) return ref;
  // Older rows carry only an internal id — show a stable short reference, never the raw key.
  const id = String(item?.id || "");
  if (!id) return "—";
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 10000;
  return `${item?.anonymous || item?.kind === "anonymous" ? "AN" : "VO"}-${String(h).padStart(4, "0")}`;
}

export function hoursAr(n, gen = false) {
  const a = Math.abs(Math.round(Number(n) || 0));
  if (a === 1) return gen ? "ساعة" : "ساعة واحدة";
  if (a === 2) return gen ? "ساعتين" : "ساعتان";
  return a <= 10 ? `${a} ساعات` : `${a} ساعة`;
}

function dateOnly(iso) {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export function fmtVoiceDate(iso, ar = true) {
  const s = dateOnly(iso);
  const lang = ar ? "ar" : "en";
  if (s) return formatDate(s, lang, { day: "numeric", month: "long", year: "numeric" }) || "—";
  return formatDate(iso, lang, { day: "numeric", month: "long", year: "numeric" }) || "—";
}

export function voiceDecisionNoticeText({ outcome, channel, title } = {}, lang = "ar") {
  const ar = lang === "ar";
  const bit = title ? ` — ${title}` : "";
  if (outcome === "adopt") {
    return channel === "anonymous"
      ? (ar ? "عُولِج البلاغ المجهول بوقائعه." : "The anonymous report was handled on its facts.")
      : (ar ? `اعتُمد صوتك${bit}.` : `Your voice was adopted${bit}.`);
  }
  if (outcome === "return") {
    return ar ? `أُعيد صوتك بملاحظة${bit}.` : `Your voice was returned with a note${bit}.`;
  }
  if (outcome === "raised") {
    return channel === "anonymous"
      ? (ar ? "بلاغ مجهول جديد بانتظار المراجعة." : "A new anonymous report is awaiting review.")
      : (ar ? `صوت جديد بانتظار مراجعتك${bit}.` : `A new voice awaits your review${bit}.`);
  }
  return ar ? "تحديث على صوت موظف." : "An employee voice was updated.";
}

function titleOf(row) {
  const written = String(row?.title || "").trim();
  if (written) return written;
  const body = String(row?.message || row?.body || "").trim();
  return body.split(/\n/)[0].slice(0, 80) || "—";
}

function outcomeOf(row) {
  const resolution = String(row?.resolution || row?.outcome || "");
  if (resolution === "approved" || resolution === "adopt") return "adopt";
  if (resolution === "rejected" || resolution === "return") return "return";
  if (row?.status === "closed") return "adopt";
  if (row?.status === "rejected") return "return";
  return "";
}

export function collectVoiceItems({ publicReports = [], anonymousReports = [] } = {}) {
  const named = (publicReports || []).map((row) => ({
    ...row,
    bucket: "public",
    channel: voiceKind(row) === "suggestion" ? "suggestion" : "complaint",
    title: titleOf(row),
    body: row.message || row.body || "",
  }));
  const hidden = (anonymousReports || []).map((row) => ({
    ...row,
    bucket: "anon",
    channel: "anonymous",
    title: titleOf(row),
    body: row.message || row.body || "",
    anonymousId: row.anonymousId || `AN-${String(row.id || "").slice(-4).toUpperCase()}`,
  }));
  return [...named, ...hidden];
}

const LADDER_ROLES = ["director", "ops_manager", "pgm", "station_manager"];

/**
 * The open voices one viewer is queued on — the single source for badges, chips and counts.
 * HR-only channels count only for an HR receiver in scope; a named complaint for the ladder roles.
 * Never the viewer's own voice.
 */
export function viewerVoiceQueueItems(data, user) {
  if (!user?.id) return [];
  const items = collectVoiceItems({ publicReports: data?.publicReports, anonymousReports: data?.anonymousReports });
  const ladder = LADDER_ROLES.includes(user.role) || isVoiceHrReceiver(user, data);
  return items.filter((item) => {
    if (isOwnVoice(item, user)) return false;
    if (isHrOnlyVoice(item)) return canHandleHrVoice(item, user, data);
    return ladder;
  });
}

/** Open abuse files this viewer runs or sits on (never the accused, never a line manager). */
export function viewerOpenAbuseCount(data, user) {
  return filterAbuseCasesForViewer(data?.abuseCases || [], user, data)
    .filter((row) => String(row.reporterId || row.userId) !== String(user?.id) && !["decided", "closed"].includes(String(row.status || ""))).length;
}

export function voiceRelatedLinks(item, { employeeId, ar = true } = {}) {
  const text = `${item?.title || ""} ${item?.body || ""}`;
  const links = [];
  if (employeeId && item?.channel !== "anonymous") {
    links.push({
      to: `/app/employees/${encodeURIComponent(employeeId)}`,
      label: ar ? "ملف الموظف" : "Employee file",
      tip: ar ? "الصوت يصل باسم صاحبه لا كجزاء" : "The voice arrives in the author's name, not as a sanction",
    });
  }
  if (/جزاء|عقوب|sanction|disciplin/i.test(text)) {
    links.push({
      to: "/app/discipline",
      label: ar ? "الجزاءات" : "Sanctions",
      tip: ar ? "رفع الصوت لا يُتخذ سبباً لجزاء" : "Raising a voice is not a ground for a sanction",
    });
  }
  if (/راتب|بدل|أجر|حسم|payroll|wage/i.test(text)) {
    links.push({ to: "/app/payroll", label: ar ? "المسير" : "Payroll", tip: ar ? "أثر الأجر يُراجع في المسير" : "Wage effect is reviewed on payroll" });
  }
  if (/ورد|حضور|تأخ|غياب|shift|attend/i.test(text)) {
    links.push({ to: "/app/attendance", label: ar ? "الحضور" : "Attendance", tip: ar ? "الواقعة مربوطة بوقت العمل" : "The incident is tied to working time" });
  }
  links.push({
    to: "/app/discipline",
    label: ar ? "الجزاءات" : "Sanctions",
    tip: ar ? "الاعتراض على جزاء مسار آخر" : "Objecting to a sanction is a different path",
  });
  const seen = new Set();
  return links.filter((row) => {
    if (seen.has(row.to)) return false;
    seen.add(row.to);
    return true;
  });
}

export function decorateVoiceItem(item, {
  employees = [],
  stations = [],
  ar = true,
  nowMs = Date.now(),
  chain = defaultEscalationChain(),
  currentUser,
  canManage = false,
} = {}) {
  const ch = channelOf(item.channel);
  const enriched = enrichComplaint(item, chain, nowMs);
  const author = employees.find((row) => String(row.id) === String(item.authorId));
  const station = stations.find((row) => row.id === (item.stationId || author?.stationId));
  const outcome = outcomeOf(item);
  const settled = Boolean(outcome) || item.status === "closed" || item.status === "rejected";
  const left = settled ? null : slaHoursLeft(item, nowMs);
  const overdue = left != null && left < 0;
  const lastReply = (item.replies || []).slice(-1)[0];
  const note = lastReply?.text || item.rulingNote || item.decisionNote || "";
  const decidedAt = lastReply?.createdAt || item.closedAt || item.decidedAt || "";
  // The archive rule (lib/archiveRule): a ruled voice stays under «معتمدة» / «مُعادة» 30 days — time for the
  // worker to read the ruling and appeal — then moves to «الأرشيف» only.
  const archived = settled && isPastArchiveDue({ settledAt: item.closedAt || item.decidedAt || lastReply?.createdAt || item.updatedAt || item.createdAt }, nowMs);
  const label = outcome === "adopt"
    ? (item.channel === "anonymous" ? (ar ? "عُولِج" : "Handled") : (ar ? "اعتُمد" : "Adopted"))
    : outcome === "return"
      ? (ar ? "أُعيد بملاحظة" : "Returned with a note")
      : (overdue ? (ar ? "رُفع لتجاوز المهلة" : "Raised — SLA passed") : (ar ? "قيد المراجعة" : "Under review"));
  const skipped = Number(item.reviewStartLevel) || 0;
  const steps = (enriched.steps || []).map((step, index) => ({
    name: ar ? (step.labelAr || step.labelEn) : (step.labelEn || step.labelAr),
    when: index < skipped
      ? (ar ? "تخطّاه — صاحب الصوت" : "Skipped — the author")
      : step.state === "done"
      ? (ar ? "مضت مهلته" : "Window passed")
      : step.state === "current"
        ? (settled ? (ar ? "قرّر" : "Ruled") : (ar ? "عنده الآن" : "With them now"))
        : (ar ? "لم يبلغه" : "Not reached"),
    bg: step.state === "pending" ? "var(--nv-card)" : "var(--nv-inset)",
    color: step.state === "pending" ? "var(--nv-muted)" : "var(--nv-ink)",
    // The shared ladder reads this: one vocabulary for صوت الموظف and المهام.
    ladder: index < skipped
      ? "skipped"
      : step.state === "done"
        ? (step.vacant ? "vacant" : "passed")
        : step.state === "current"
          ? (settled ? "ruled" : "now")
          : step.vacant
            ? "vacant"
            : (!settled && (enriched.steps || [])[index - 1]?.state === "current" ? "next" : "later"),
  }));
  return {
    item,
    ch,
    author,
    station,
    outcome,
    settled,
    archived,
    left,
    overdue,
    title: item.title,
    body: item.body,
    channel: ar ? ch.ar : ch.en,
    accent: settled ? (outcome === "adopt" ? "var(--nv-ok-fill)" : "var(--nv-box)") : (overdue ? "var(--nv-bad-ink)" : "var(--nv-warn-fill)"),
    stColor: settled ? (outcome === "adopt" ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)") : (overdue ? "var(--nv-bad-ink)" : "var(--nv-warn-ink)"),
    stBg: settled ? (outcome === "adopt" ? "var(--nv-ok-soft)" : "var(--nv-warn-soft)") : (overdue ? "var(--nv-bad-soft)" : "var(--nv-warn-soft)"),
    stBorder: settled ? (outcome === "adopt" ? "var(--nv-ok-line)" : "var(--nv-warn-line)") : (overdue ? "var(--nv-bad-line)" : "var(--nv-warn-line)"),
    state: label,
    slaLabel: overdue ? (ar ? "تجاوز المهلة" : "Past the window") : (ar ? "المتبقي للمراجعة" : "Time left"),
    slaVal: left == null
      ? "—"
      : (ar
        ? (overdue ? `بـ${hoursAr(left, true)}` : hoursAr(left))
        : (overdue ? `${Math.abs(Math.round(left))}h over` : `${Math.round(left)}h`)),
    slaColor: overdue ? "var(--nv-bad-ink)" : (left != null && left <= 24 ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)"),
    tier: enriched.escalationLevel > skipped
      ? (ar ? `رُفع تلقائياً · ${enriched.currentTierLabelAr || "—"}` : `Raised · ${enriched.currentTierLabelEn || "—"}`)
      : (ar ? `لدى ${enriched.currentTierLabelAr || chain[0]?.labelAr || "—"}` : `With ${enriched.currentTierLabelEn || chain[0]?.labelEn || "—"}`),
    tierColor: enriched.escalationLevel > skipped ? "var(--nv-bad-ink)" : "var(--nv-ink2)",
    tierBg: enriched.escalationLevel > skipped ? "var(--nv-bad-soft)" : "var(--nv-mute-soft)",
    tierBorder: enriched.escalationLevel > skipped ? "var(--nv-bad-line)" : "var(--nv-line)",
    meta: [
      ar ? ch.ar : ch.en,
      (() => {
        const topic = VOICE_TOPICS.find((row) => row.id === item.topicId);
        return topic ? (ar ? topic.ar : topic.en) : "";
      })(),
      item.channel === "anonymous"
        ? (ar ? `برقم ${item.anonymousId || "—"} بلا هويّة` : `Ref ${item.anonymousId || "—"} — no identity`)
        : (author?.name ? (ar ? `رفعه ${author.name}` : `Raised by ${author.name}`) : (ar ? "باسمك" : "In your name")),
      station?.name || "",
      item.incidentDate ? fmtVoiceDate(item.incidentDate, ar) : "",
      item.requestText ? (ar ? `يطلب: ${item.requestText}` : `Asks: ${item.requestText}`) : "",
      fmtVoiceDate(item.createdAt, ar),
      item.file?.name || (item.files?.[0]?.name ? (ar ? `مرفق: ${item.files[0].name}` : `Attached: ${item.files[0].name}`) : ""),
    ].filter(Boolean).join(" · "),
    reply: settled && note
      ? `${outcome === "adopt"
        ? (item.channel === "anonymous" ? (ar ? "اتُّخذ إجراء بناءً على البلاغ" : "Action was taken on the report") : (ar ? "اعتُمد الصوت ويُنفَّذ" : "The voice was adopted and will be carried out"))
        : (ar ? "أُعيد بملاحظة من المراجع" : "Returned with a reviewer's note")}${note ? ` — «${note}»` : ""} · ${fmtVoiceDate(decidedAt, ar)}`
      : "",
    canEscalate: outcome === "return" && item.authorId === currentUser?.id && !enriched.atTop,
    audit: buildVoiceAuditTimeline(item, {
      ar,
      viewerIsHandler: Boolean(canManage),
      authorName: author?.name || "",
      chain,
    }),
    steps,
    related: voiceRelatedLinks(item, { employeeId: item.authorId, ar }),
    atTop: enriched.atTop,
    level: enriched.escalationLevel,
  };
}

/** Settled cards → RecordSmartArchive rows (search / day groups). */
export function voiceArchiveSmartItems(cards = [], { ar = true } = {}) {
  return (cards || [])
    .filter((card) => card.settled)
    .map((card) => ({
      id: card.item.id,
      title: card.title,
      text: [card.meta, card.reply].filter(Boolean).join(" · "),
      date: card.item.closedAt || card.item.decidedAt || card.item.createdAt,
      branch: card.station?.name || "",
      badge: card.state,
      search: [
        card.title,
        card.meta,
        card.reply,
        card.channel,
        card.item?.anonymousId,
        card.author?.name,
        card.state,
      ].filter(Boolean).join(" "),
      card,
      ar,
    }));
}

/**
 * Named settled voice trail for one employee file.
 * Anonymous reports never appear on a personal file.
 */
export function employeeVoiceArchiveCards({
  publicReports = [],
  employeeId,
  employees = [],
  stations = [],
  ar = true,
  nowMs = Date.now(),
  chain = defaultEscalationChain(),
  canManage = false,
  viewer = null,
  data = null,
} = {}) {
  const want = String(employeeId || "").trim();
  if (!want) return [];
  // A suggestion reaches HR only: on someone else's file it shows to HR, never to his manager.
  const items = collectVoiceItems({ publicReports, anonymousReports: [] })
    .filter((row) => String(row.authorId) === want && row.channel !== "anonymous")
    .filter((row) => !viewer || canSeeVoiceItem(row, viewer, data || { employees }));
  return items
    .map((item) => decorateVoiceItem(item, {
      employees,
      stations,
      ar,
      nowMs,
      chain,
      canManage,
      currentUser: { id: want },
    }))
    .filter((card) => card.settled);
}

function isOwnRow(row, userId) {
  const uid = String(userId || "");
  if (!uid) return false;
  if (row.channel === "anonymous") return String(row.rateActorId || "") === uid;
  return String(row.authorId) === uid;
}

export function deriveVoiceBoard({
  items = [],
  queueItems,
  viewerStationId,
  employees = [],
  stations = [],
  ar = true,
  nowMs = Date.now(),
  canManage = false,
  userId,
  chain = defaultEscalationChain(),
  chainFor = null,
} = {}) {
  // Each voice climbs its own branch ladder when the caller can name it.
  const ladder = (item) => (typeof chainFor === "function" ? (chainFor(item) || chain) : chain);
  const workStation = String(viewerStationId || "").trim();
  const scoped = Array.isArray(queueItems)
    ? queueItems
    : canManage
      ? items
      // A worker sees only what he raised — an anonymous report by its follow-up number (rate actor),
      // never another branch voice: no line, count or published ruling reaches a non-receiver.
      : items.filter((row) => isOwnRow(row, userId));
  void workStation;
  const cards = scoped.map((item) => decorateVoiceItem(item, { employees, stations, ar, nowMs, chain: ladder(item), canManage }));
  const mine = items
    .filter((row) => isOwnRow(row, userId))
    .map((item) => decorateVoiceItem(item, { employees, stations, ar, nowMs, chain: ladder(item), currentUser: { id: userId }, canManage }));
  const open = cards.filter((card) => !card.settled);
  const overdue = open.filter((card) => card.overdue);
  const settled = cards.filter((card) => card.settled);
  const stats = deriveComplaintStats(scoped, chain, nowMs);
  const pulse = overdue.length
    ? (ar
      ? countAr(overdue.length, "صوت واحد تجاوز مهلته", "صوتان تجاوزا مهلتهما", "أصوات تجاوزت مهلتها", "صوتاً تجاوز مهلته")
      : `${overdue.length} voice(s) past the window`)
    : open.length
      ? (ar
        ? countAr(open.length, "صوت واحد بانتظار المراجعة", "صوتان بانتظار المراجعة", "أصوات بانتظار المراجعة", "صوتاً بانتظار المراجعة")
        : `${open.length} voice(s) awaiting review`)
      : (ar ? "لا صوت مفتوح" : "No open voice");
  return {
    cards,
    mine,
    open,
    overdue,
    settled,
    stats: [
      { val: String(stats.openCount), unit: "", lbl: ar ? "بانتظار المراجعة" : "Awaiting review", note: ar ? "في نطاقك" : "In your scope", accent: "var(--nv-ink)", action: stats.openCount > 0 },
      { val: String(stats.breachedCount), unit: "", lbl: ar ? "تجاوزت مهلتها" : "Past the window", note: stats.breachedCount ? (ar ? "رُفعت للمدير التالي تلقائياً" : "Raised to the next manager") : (ar ? "لا تجاوز" : "On time"), accent: "var(--nv-ink)", tone: stats.breachedCount ? "bad" : null, flag: ar ? "صُعّدت تلقائياً" : "Auto-escalated" },
      { val: String(stats.avgResponseHours), unit: ar ? "ساعة" : "h", lbl: ar ? "متوسط زمن المراجعة" : "Average review time", note: settled.length ? (ar ? "محسوب على ما استقرّ" : "On what has settled") : (ar ? "محسوب على المفتوح — لا قرار بعد" : "On the open set — no ruling yet"), accent: "var(--nv-ink)" },
      { id: "anon", val: String(scoped.filter((row) => row.channel === "anonymous").length), unit: "", lbl: ar ? "بلاغات مجهولة" : "Anonymous reports", note: ar ? "بلا هويّة — لا ردّ شخصي" : "No identity — no personal reply", accent: "var(--nv-ink)" },
    ],
    pulse,
    pulseKind: overdue.length ? "bad" : open.length ? "warn" : "ok",
    pulseColor: overdue.length ? "var(--nv-bad-ink)" : open.length ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)",
    pulseBg: overdue.length ? "var(--nv-bad-soft)" : open.length ? "var(--nv-warn-soft)" : "var(--nv-ok-soft)",
    pulseBorder: overdue.length ? "var(--nv-bad-line)" : open.length ? "var(--nv-warn-line)" : "var(--nv-ok-line)",
    pulseDot: overdue.length ? "var(--nv-bad-ink)" : open.length ? "var(--nv-warn-fill)" : "var(--nv-ok-fill)",
    openCount: open.length,
    mineOpen: mine.filter((card) => !card.settled).length,
    chain: chain.map((tier, idx) => ({
      num: `0${idx + 1}`,
      name: ar ? tier.labelAr : tier.labelEn,
      mark: idx === 0 ? "check" : "",
      bg: idx === 0 ? "var(--nv-ok-ink)" : "var(--nv-card)",
      border: idx === 0 ? "var(--nv-ok-ink)" : "var(--nv-box)",
      color: idx === 0 ? "var(--nv-ink)" : "var(--nv-ink2)",
      weight: idx === 0 ? 700 : 400,
    })),
    chainNote: ar
      ? `يبدأ عند ${chain[0]?.labelAr || "مدير الفرع"}، ويصعد درجةً واحدة عند كل تجاوز للمهلة حتى ${chain[chain.length - 1]?.labelAr || "مدير العمليات"}. ولك أن ترفعه مرّة إن أُعيد بملاحظة ولم تقتنع.`
      : `It starts with ${chain[0]?.labelEn || "the station manager"} and climbs one step each time the window is missed, up to ${chain[chain.length - 1]?.labelEn || "operations"}. You may raise it once if it was returned and you do not accept the note.`,
    promises: VOICE_CHANNELS.map((row) => ({ tag: ar ? row.ar : row.en, t: ar ? row.promiseAr : row.promiseEn })).concat([
      { tag: ar ? "لا انتقام" : "No reprisal", t: ar ? "رفع الصوت لا يُتخذ سبباً لجزاء ولا لتغيير وردية — وأي جزاء يُربط به يُبطل في قسم الجزاءات." : "Raising a voice is not a ground for a sanction or a shift change — a sanction tied to it is voided in Sanctions." },
      { tag: ar ? "لا إهمال" : "No neglect", t: ar ? "الشكوى الجهرية التي لا تُراجع في مهلتها تُرفع للمستوى التالي تلقائياً حتى الموارد البشرية، والسرية والاقتراح عند الموارد البشرية بمهلتها — فلا يسقط الصوت بالسكوت." : "An open complaint not reviewed in time climbs automatically up to HR; confidential complaints and suggestions sit with HR on their window — a voice does not fall by silence." },
    ]),
  };
}

export { hoursSince, responseHoursFor };
