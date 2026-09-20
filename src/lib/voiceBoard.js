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

export const VOICE_CHANNELS = [
  {
    id: "suggestion",
    ar: "اقتراح",
    en: "Suggestion",
    accent: "#1D9A5B",
    color: "#137A49",
    bg: "#F2FAF6",
    border: "#BFE6D2",
    identityAr: "باسمك",
    identityEn: "In your name",
    blurbAr: "تحسين عمل أو إجراء أو بيئة فرع.",
    blurbEn: "Improve a process, a practice, or a station.",
    promiseAr: "يصل باسمك حتى يمكن التواصل معك، ويُراجع ثم يُعتمد أو يُعاد بملاحظة مكتوبة.",
    promiseEn: "It arrives in your name so you can be reached, then it is adopted or returned with a written note.",
    hours: 96,
    defaultPrio: "low",
  },
  {
    id: "complaint",
    ar: "شكوى",
    en: "Complaint",
    accent: "#C9962B",
    color: "#8A6516",
    bg: "#FDF6E8",
    border: "#ECD9A8",
    identityAr: "بهوية ظاهرة",
    identityEn: "Named",
    blurbAr: "حقّ تطلبه أو ضرر وقع عليك.",
    blurbEn: "A right you claim, or a harm that fell on you.",
    promiseAr: "تُعالَج بالاسم لأن معالجتها تحتاج تفصيلاً منك، ولا تُتخذ سبباً لجزاء.",
    promiseEn: "It is handled in the open because it needs your detail, and it is not a ground for a sanction.",
    hours: 48,
    defaultPrio: "medium",
  },
  {
    id: "anonymous",
    ar: "بلاغ مجهول",
    en: "Anonymous report",
    accent: "#8A1C2B",
    color: "#8A1C2B",
    bg: "#FBF1F2",
    border: "#E9C4C9",
    identityAr: "بلا هويّة",
    identityEn: "No identity",
    blurbAr: "خطر أو تجاوز تخشى كشف نفسك فيه.",
    blurbEn: "A risk or a breach you fear naming yourself over.",
    promiseAr: "يصل برقم لا باسم. لا تُسجَّل هويّتك ولا يُمكن ردّها من الرقم — ولذلك لا يصلك ردّ شخصي.",
    promiseEn: "It arrives as a number, not a name. Your identity is not stored, so there is no personal reply.",
    hours: 24,
    defaultPrio: "high",
  },
];

export const VOICE_PRIOs = [
  { id: "low", hours: 96, ar: "منخفضة — 96 ساعة", en: "Low — 96 hours" },
  { id: "medium", hours: 48, ar: "متوسطة — 48 ساعة", en: "Medium — 48 hours" },
  { id: "high", hours: 24, ar: "عالية — 24 ساعة", en: "High — 24 hours" },
];

export function channelOf(id) {
  return VOICE_CHANNELS.find((row) => row.id === id) || VOICE_CHANNELS[0];
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
  const label = outcome === "adopt"
    ? (item.channel === "anonymous" ? (ar ? "عُولِج" : "Handled") : (ar ? "اعتُمد" : "Adopted"))
    : outcome === "return"
      ? (ar ? "أُعيد بملاحظة" : "Returned with a note")
      : (overdue ? (ar ? "رُفع لتجاوز المهلة" : "Raised — SLA passed") : (ar ? "قيد المراجعة" : "Under review"));
  const steps = (enriched.steps || []).map((step) => ({
    name: ar ? (step.labelAr || step.labelEn) : (step.labelEn || step.labelAr),
    when: step.state === "done"
      ? (ar ? "مضت مهلته" : "Window passed")
      : step.state === "current"
        ? (ar ? "عنده الآن" : "With them now")
        : (ar ? "لم يبلغه" : "Not reached"),
    bg: step.state === "pending" ? "#fff" : "#F7F8FA",
    color: step.state === "pending" ? "#6B7280" : "#14213D",
  }));
  return {
    item,
    ch,
    author,
    station,
    outcome,
    settled,
    left,
    overdue,
    title: item.title,
    body: item.body,
    channel: ar ? ch.ar : ch.en,
    accent: settled ? (outcome === "adopt" ? "#1D9A5B" : "#C7CCD6") : (overdue ? "#8A1C2B" : "#C9962B"),
    stColor: settled ? (outcome === "adopt" ? "#137A49" : "#8A6516") : (overdue ? "#8A1C2B" : "#8A6516"),
    stBg: settled ? (outcome === "adopt" ? "#F2FAF6" : "#FDF6E8") : (overdue ? "#FBF1F2" : "#FDF6E8"),
    stBorder: settled ? (outcome === "adopt" ? "#BFE6D2" : "#ECD9A8") : (overdue ? "#E9C4C9" : "#ECD9A8"),
    state: label,
    slaLabel: overdue ? (ar ? "تجاوز المهلة" : "Past the window") : (ar ? "المتبقي للمراجعة" : "Time left"),
    slaVal: left == null
      ? "—"
      : (ar
        ? (overdue ? `بـ${hoursAr(left, true)}` : hoursAr(left))
        : (overdue ? `${Math.abs(Math.round(left))}h over` : `${Math.round(left)}h`)),
    slaColor: overdue ? "#8A1C2B" : (left != null && left <= 24 ? "#8A6516" : "#137A49"),
    tier: enriched.escalationLevel > 0
      ? (ar ? `رُفع تلقائياً · ${enriched.currentTierLabelAr || ""}` : `Raised · ${enriched.currentTierLabelEn || ""}`)
      : (ar ? `لدى ${enriched.currentTierLabelAr || chain[0]?.labelAr || ""}` : `With ${enriched.currentTierLabelEn || chain[0]?.labelEn || ""}`),
    tierColor: enriched.escalationLevel > 0 ? "#8A1C2B" : "#4B5567",
    tierBg: enriched.escalationLevel > 0 ? "#FBF1F2" : "#F5F6F8",
    tierBorder: enriched.escalationLevel > 0 ? "#E9C4C9" : "#DFE3EA",
    meta: [
      ar ? ch.ar : ch.en,
      item.channel === "anonymous"
        ? (ar ? `برقم ${item.anonymousId} بلا هويّة` : `Ref ${item.anonymousId} — no identity`)
        : (author?.name ? (ar ? `رفعه ${author.name}` : `Raised by ${author.name}`) : (ar ? "باسمك" : "In your name")),
      station?.name || "",
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
} = {}) {
  const workStation = String(viewerStationId || "").trim();
  const scoped = Array.isArray(queueItems)
    ? queueItems
    : canManage
      ? items
      : items.filter((row) => {
        const mineNamed = row.channel !== "anonymous" && String(row.authorId) === String(userId);
        const settledAnon = row.channel === "anonymous" && (row.status === "closed" || row.status === "rejected");
        const sameStation = !workStation || String(row.stationId || "") === workStation;
        return mineNamed || (settledAnon && sameStation);
      });
  const cards = scoped.map((item) => decorateVoiceItem(item, { employees, stations, ar, nowMs, chain, canManage }));
  const mine = items
    .filter((row) => String(row.authorId) === String(userId) && row.channel !== "anonymous")
    .map((item) => decorateVoiceItem(item, { employees, stations, ar, nowMs, chain, currentUser: { id: userId }, canManage }));
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
      { val: String(stats.openCount), unit: "", lbl: ar ? "بانتظار المراجعة" : "Awaiting review", note: ar ? "في نطاقك" : "In your scope", accent: "#8A6516" },
      { val: String(stats.breachedCount), unit: "", lbl: ar ? "تجاوزت مهلتها" : "Past the window", note: stats.breachedCount ? (ar ? "رُفعت للمدير التالي تلقائياً" : "Raised to the next manager") : (ar ? "لا تجاوز" : "On time"), accent: "#8A1C2B" },
      { val: String(stats.avgResponseHours), unit: ar ? "ساعة" : "h", lbl: ar ? "متوسط زمن المراجعة" : "Average review time", note: settled.length ? (ar ? "محسوب على ما استقرّ" : "On what has settled") : (ar ? "محسوب على المفتوح — لا قرار بعد" : "On the open set — no ruling yet"), accent: "#137A49" },
      { val: String(scoped.filter((row) => row.channel === "anonymous").length), unit: "", lbl: ar ? "بلاغات مجهولة" : "Anonymous reports", note: ar ? "بلا هويّة — لا ردّ شخصي" : "No identity — no personal reply", accent: "#14213D" },
    ],
    pulse,
    pulseKind: overdue.length ? "bad" : open.length ? "warn" : "ok",
    pulseColor: overdue.length ? "#8A1C2B" : open.length ? "#8A6516" : "#137A49",
    pulseBg: overdue.length ? "#FBF1F2" : open.length ? "#FDF6E8" : "#F2FAF6",
    pulseBorder: overdue.length ? "#E9C4C9" : open.length ? "#ECD9A8" : "#BFE6D2",
    pulseDot: overdue.length ? "#8A1C2B" : open.length ? "#C9962B" : "#1D9A5B",
    openCount: open.length,
    mineOpen: mine.filter((card) => !card.settled).length,
    chain: chain.map((tier, idx) => ({
      num: `0${idx + 1}`,
      name: ar ? tier.labelAr : tier.labelEn,
      mark: idx === 0 ? "✓" : "",
      bg: idx === 0 ? "#137A49" : "#fff",
      border: idx === 0 ? "#137A49" : "#C7CCD6",
      color: idx === 0 ? "#14213D" : "#4B5567",
      weight: idx === 0 ? 700 : 400,
    })),
    chainNote: ar
      ? `يبدأ عند ${chain[0]?.labelAr || "مدير الفرع"}، ويصعد درجةً واحدة عند كل تجاوز للمهلة حتى ${chain[chain.length - 1]?.labelAr || "مدير العمليات"}. ولك أن ترفعه مرّة إن أُعيد بملاحظة ولم تقتنع.`
      : `It starts with ${chain[0]?.labelEn || "the station manager"} and climbs one step each time the window is missed, up to ${chain[chain.length - 1]?.labelEn || "operations"}. You may raise it once if it was returned and you do not accept the note.`,
    promises: VOICE_CHANNELS.map((row) => ({ tag: ar ? row.ar : row.en, t: ar ? row.promiseAr : row.promiseEn })).concat([
      { tag: ar ? "لا انتقام" : "No reprisal", t: ar ? "رفع الصوت لا يُتخذ سبباً لجزاء ولا لتغيير وردية — وأي جزاء يُربط به يُبطل في قسم الجزاءات." : "Raising a voice is not a ground for a sanction or a shift change — a sanction tied to it is voided in Sanctions." },
      { tag: ar ? "لا إهمال" : "No neglect", t: ar ? "ما لا يُراجع في مهلته يُرفع للمدير التالي تلقائياً، فلا يسقط الصوت بالسكوت." : "What is not reviewed in time is raised to the next manager, so a voice does not fall by silence." },
    ]),
  };
}

export { hoursSince, responseHoursFor };
