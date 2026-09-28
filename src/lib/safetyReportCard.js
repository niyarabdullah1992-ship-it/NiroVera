/** Safety observation card — labels and score for an incidentLog row. */

export const SAFETY_REPORT_KINDS = [
  { ar: "حالة غير آمنة", en: "Unsafe condition", subAr: "مكان أو معدّة", subEn: "Place or equipment" },
  { ar: "تصرّف غير آمن", en: "Unsafe act", subAr: "طريقة عمل", subEn: "Way of working" },
  { ar: "حادث وشيك", en: "Near miss", subAr: "Near miss · كاد يقع", subEn: "Near miss · almost happened" },
  { ar: "إصابة أو ضرر", en: "Injury or damage", subAr: "وقع فعلاً", subEn: "It happened" },
  { ar: "ملاحظة إيجابية", en: "Positive note", subAr: "ممارسة تستحق التعميم", subEn: "A practice worth sharing" },
];

export const SAFETY_REPORT_CATEGORIES = [
  { ar: "سطح عمل وانزلاق", en: "Surface and slip" },
  { ar: "عمل على ارتفاع", en: "Work at height" },
  { ar: "حريق", en: "Fire" },
  { ar: "كهرباء", en: "Electrical" },
  { ar: "آلات ومعدّات", en: "Machinery" },
  { ar: "مواد خطرة", en: "Hazardous materials" },
  { ar: "إجهاد حراري", en: "Heat stress" },
  { ar: "بيئة العمل والرفع", en: "Workplace and lifting" },
  { ar: "مركبات ورافعات", en: "Vehicles and lifts" },
];

export const SAFETY_LIKELIHOOD = [
  { ar: "نادر", en: "Rare" },
  { ar: "غير محتمل", en: "Unlikely" },
  { ar: "ممكن", en: "Possible" },
  { ar: "محتمل", en: "Likely" },
  { ar: "شبه مؤكد", en: "Almost certain" },
];

export const SAFETY_SEVERITY = [
  { ar: "طفيف", en: "Slight" },
  { ar: "إسعاف أولي", en: "First aid" },
  { ar: "علاج طبي", en: "Medical treatment" },
  { ar: "إصابة مقعِدة", en: "Disabling injury" },
  { ar: "وفاة أو عجز", en: "Fatality or disability" },
];

export const SAFETY_REPORT_CONTROLS = [
  { id: "elim", ar: "الإزالة", en: "Elimination", subAr: "أزل الخطر", subEn: "Remove the hazard" },
  { id: "sub", ar: "الاستبدال", en: "Substitution", subAr: "بديل أقل خطراً", subEn: "A less hazardous substitute" },
  { id: "eng", ar: "ضابط هندسي", en: "Engineering", subAr: "حاجز · تهوية · عزل", subEn: "Barrier, ventilation, isolation" },
  { id: "adm", ar: "ضابط إداري", en: "Administrative", subAr: "إجراء · تصريح · تدريب", subEn: "Procedure, permit, training" },
  { id: "ppe", ar: "معدات الوقاية", en: "PPE", subAr: "PPE — الملاذ الأخير", subEn: "PPE — last resort" },
];

export const SAFETY_REPORT_STEPS = [
  { ar: "رُفع", en: "Raised" },
  { ar: "مدير الفرع", en: "Branch manager" },
  { ar: "الإجراء", en: "Action" },
  { ar: "أُغلق بصورة بعد", en: "Closed with an after photo" },
];

export function safetyReportSlaHours(levelKey) {
  if (levelKey === "critical") return 0;
  if (levelKey === "high") return 24;
  if (levelKey === "medium") return 72;
  if (levelKey === "low") return 24 * 7;
  return null;
}

export function safetyReportSlaLine(card, at, now = Date.now(), ar = true) {
  if (!card) return "—";
  if (card.positive) return (ar ? card.slaAr : card.slaEn) || "—";
  const hours = safetyReportSlaHours(card.levelKey);
  if (hours == null || !at) return "—";
  if (hours === 0) return ar ? "فوري" : "Immediate";
  const end = new Date(at).getTime() + hours * 3600000;
  if (!Number.isFinite(end)) return "—";
  const left = end - now;
  if (left <= 0) return ar ? "انتهت المهلة" : "SLA elapsed";
  const wholeHours = Math.max(1, Math.ceil(left / 3600000));
  if (wholeHours >= 48) {
    const days = Math.ceil(wholeHours / 24);
    return ar ? `ينتهي خلال ${days} ي` : `Due in ${days} d`;
  }
  return ar ? `ينتهي خلال ${wholeHours} س` : `Due in ${wholeHours} h`;
}

const CODE_RE = /^HSE-\d{4}-[A-Z0-9]{4}$/;

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function safetyReportCode(at = new Date()) {
  const d = new Date(at);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HSE-${yy}${mm}-${tail}`;
}

export function safetyReportLevel(score, positive) {
  if (positive) {
    return {
      key: "positive",
      ar: "إيجابية",
      en: "Positive",
      tone: "ok",
      slaAr: "تُعمَّم في الجولة القادمة",
      slaEn: "Shared on the next round",
      actAr: "",
      actEn: "",
    };
  }
  const n = Number(score) || 0;
  if (!n) return null;
  if (n >= 15) {
    return {
      key: "critical",
      ar: "حرج",
      en: "Critical",
      tone: "crit",
      slaAr: "فوري",
      slaEn: "Immediate",
      actAr: "أوقف العمل فوراً — صلاحية الإيقاف لكل موظف",
      actEn: "Stop the work now — any employee may stop the job",
    };
  }
  if (n >= 10) {
    return {
      key: "high",
      ar: "مرتفع",
      en: "High",
      tone: "bad",
      slaAr: "24 س",
      slaEn: "24 h",
      actAr: "يُعالج خلال 24 ساعة ويُبلَّغ مدير الفرع",
      actEn: "Treat within 24 hours and tell the branch manager",
    };
  }
  if (n >= 5) {
    return {
      key: "medium",
      ar: "متوسط",
      en: "Medium",
      tone: "warn",
      slaAr: "72 س",
      slaEn: "72 h",
      actAr: "إجراء تصحيحي خلال 72 ساعة",
      actEn: "Corrective action within 72 hours",
    };
  }
  return {
    key: "low",
    ar: "منخفض",
    en: "Low",
    tone: "ok",
    slaAr: "7 أيام",
    slaEn: "7 days",
    actAr: "يُتابع ضمن الجولة الأسبوعية",
    actEn: "Follow up on the weekly round",
  };
}

export function buildSafetyReportCard(detail, at = new Date()) {
  if (!detail || typeof detail !== "object") return null;
  const kind = clampInt(detail.kind, 0, SAFETY_REPORT_KINDS.length - 1);
  const category = clampInt(detail.category, 0, SAFETY_REPORT_CATEGORIES.length - 1);
  const positive = kind === SAFETY_REPORT_KINDS.length - 1;
  const likelihood = positive ? 0 : clampInt(detail.likelihood, 0, 5);
  const severity = positive ? 0 : clampInt(detail.severity, 0, 5);
  const score = positive ? 0 : likelihood * severity;
  const controlIndex = detail.controlIndex == null || detail.controlIndex === ""
    ? -1
    : clampInt(detail.controlIndex, -1, SAFETY_REPORT_CONTROLS.length - 1);
  const level = safetyReportLevel(score, positive);
  const requested = String(detail.code || "").trim().toUpperCase();
  const kindRow = SAFETY_REPORT_KINDS[kind];
  const catRow = SAFETY_REPORT_CATEGORIES[category];
  const ctrl = controlIndex >= 0 ? SAFETY_REPORT_CONTROLS[controlIndex] : null;
  return {
    code: CODE_RE.test(requested) ? requested : safetyReportCode(at),
    kind,
    kindAr: kindRow.ar,
    kindEn: kindRow.en,
    category,
    categoryAr: catRow.ar,
    categoryEn: catRow.en,
    where: String(detail.where || "").trim().slice(0, 240),
    what: String(detail.what || "").trim().slice(0, 500),
    action: String(detail.action || "").trim().slice(0, 500),
    likelihood,
    severity,
    score,
    positive,
    levelKey: level?.key || "",
    levelAr: level?.ar || "",
    levelEn: level?.en || "",
    levelTone: level?.tone || "",
    slaAr: positive ? level.slaAr : (level ? `التقييم خلال ${level.slaAr}` : ""),
    slaEn: positive ? level.slaEn : (level ? `Assessment within ${level.slaEn}` : ""),
    actAr: level?.actAr || "",
    actEn: level?.actEn || "",
    controlId: ctrl?.id || "",
    controlAr: ctrl?.ar || "",
    controlEn: ctrl?.en || "",
    injured: Boolean(detail.injured),
    photoName: String(detail.photoName || "").trim().slice(0, 180),
    anonymous: Boolean(detail.anonymous),
    stopped: Boolean(detail.stopped),
    reporterId: String(detail.reporterId || "").slice(0, 80),
    step: 0,
  };
}

const OPEN_RISK_BANDS = [
  { key: "critical", ar: "حرج", en: "Critical", test: (score) => score >= 15 },
  { key: "high", ar: "مرتفع", en: "High", test: (score) => score >= 10 && score < 15 },
  { key: "medium", ar: "متوسط", en: "Medium", test: (score) => score >= 5 && score < 10 },
  { key: "low", ar: "منخفض", en: "Low", test: (score) => score > 0 && score < 5 },
];

/** Stored matrix product only. A missing or zero score is not a grade. */
export function matrixScoreOf(item) {
  const raw = item?.card?.score;
  if (raw == null || raw === "" || raw === "—") return null;
  const score = Number(raw);
  if (!Number.isFinite(score) || score <= 0) return null;
  return score;
}

/**
 * Open incident-log rows and the severity buckets that must sum to that count.
 * A row with no matrix grade stays in the open count and in «بلا درجة».
 */
export function deriveOpenRiskMap(reports) {
  const open = (Array.isArray(reports) ? reports : []).filter((item) => item && item.status !== "closed");
  const buckets = OPEN_RISK_BANDS.map((band) => ({
    key: band.key,
    ar: band.ar,
    en: band.en,
    n: open.filter((item) => {
      const score = matrixScoreOf(item);
      return score != null && band.test(score);
    }).length,
  }));
  const graded = buckets.reduce((sum, band) => sum + band.n, 0);
  buckets.push({
    key: "ungraded",
    ar: "بلا درجة",
    en: "No grade",
    n: open.length - graded,
  });
  return { openCount: open.length, buckets };
}

export function incidentIsMine(item, user) {
  if (!item || !user) return false;
  if (item.reporterId && user.id && item.reporterId === user.id) return true;
  if (item.card?.reporterId && user.id && item.card.reporterId === user.id) return true;
  if (item.anonymous || item.card?.anonymous) return false;
  return Boolean(item.by && user.name && item.by === user.name);
}
