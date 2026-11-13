/** Single source (client + server). Client re-exports via src/lib/hseDerivations.js */

export const HOURS_PER_WORKER_YEAR = 2080;

export const HIERARCHY_OF_CONTROLS = [
  { id: "elim", factor: 0.1, ar: "إزالة", en: "Elimination" },
  { id: "sub", factor: 0.25, ar: "استبدال", en: "Substitution" },
  { id: "eng", factor: 0.4, ar: "ضابط هندسي", en: "Engineering" },
  { id: "adm", factor: 0.7, ar: "ضابط إداري", en: "Administrative" },
  { id: "ppe", factor: 0.85, ar: "مهمات وقاية", en: "PPE" },
];

export function exposureHours(headcount) {
  return Math.max(0, Number(headcount) || 0) * HOURS_PER_WORKER_YEAR;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function deriveHseRates(headcount, inc = {}) {
  const hours = exposureHours(headcount);
  const recordable =
    inc.recordable != null
      ? Math.max(0, Number(inc.recordable) || 0)
      : (Number(inc.fatal) || 0) + (Number(inc.lti) || 0) + (Number(inc.restrict) || 0) + (Number(inc.medical) || 0);
  const lti = Number(inc.lti) || 0;
  const dart = lti + (Number(inc.restrict) || 0);
  const nearMiss = Number(inc.nearMiss) || 0;
  return {
    headcount: Math.max(0, Number(headcount) || 0),
    exposureHours: hours,
    recordable,
    lti,
    dart,
    nearMiss,
    trir: hours ? round2((recordable * 200000) / hours) : 0,
    ltifr: hours ? round2((lti * 1000000) / hours) : 0,
    dartRate: hours ? round2((dart * 200000) / hours) : 0,
    nearMissRatio: recordable ? Math.round(nearMiss / recordable) : nearMiss,
  };
}

export function inherentRisk(likelihood, severity) {
  const L = Math.min(5, Math.max(1, Math.round(Number(likelihood) || 1)));
  const S = Math.min(5, Math.max(1, Math.round(Number(severity) || 1)));
  return L * S;
}

export function residualRisk(inherent, controlId) {
  const ctrl = HIERARCHY_OF_CONTROLS.find((c) => c.id === controlId);
  if (!ctrl) return Math.max(1, Number(inherent) || 1);
  return Math.max(1, Math.round((Number(inherent) || 1) * ctrl.factor));
}

export function checkHazardCloseGate({ controlId, likelihood = 3, severity = 3, inherent, beforePhoto, afterPhoto }) {
  const inn = inherent != null ? Math.max(1, Number(inherent) || 1) : inherentRisk(likelihood, severity);
  if (!controlId) {
    return { ok: false, error: "CONTROL_REQUIRED", reason: "لا يُغلق خطر قبل تسمية الضابط المطبَّق.", inherent: inn };
  }
  const residual = residualRisk(inn, controlId);
  const strong = ["elim", "sub", "eng"].includes(controlId);
  if (inn >= 10 && !strong) {
    return { ok: false, error: "WEAK_CONTROL", reason: "الخطورة الأصلية عالية — لا يُقبل ضابط إداري أو مهمات وقاية وحده.", inherent: inn, residual };
  }
  if (residual >= 10) {
    return { ok: false, error: "RESIDUAL_HIGH", reason: "الخطورة المتبقية ما زالت عالية — ارفع مستوى الضابط قبل الإغلاق.", inherent: inn, residual };
  }
  const hasPhoto = (p) => {
    if (!p) return false;
    if (typeof p === "string") return p.trim().length > 0;
    return Boolean(p.url || p.file_url);
  };
  if (!hasPhoto(beforePhoto)) {
    return {
      ok: false,
      error: "BEFORE_PHOTO_REQUIRED",
      reason: "لا صورة قبل لهذا الخطر — ارفع صورة قبل عند الفتح أو عند الإغلاق.",
      reasonEn: "No before photo on this hazard — upload one at open or at close.",
      inherent: inn,
      residual,
    };
  }
  if (!hasPhoto(afterPhoto)) {
    return {
      ok: false,
      error: "AFTER_PHOTO_REQUIRED",
      reason: "يلزم رفع صورة بعد قبل الإغلاق.",
      reasonEn: "Upload an after photo before closing.",
      inherent: inn,
      residual,
    };
  }
  return { ok: true, inherent: inn, residual, controlId };
}

export function reportingPointsEligible(kind) {
  const k = String(kind || "").toLowerCase();
  return ["hazard", "near_miss", "nearmiss", "unsafe", "unsafe_act"].includes(k);
}

export function reportingPointsFor(kind, inherent = 6) {
  if (!reportingPointsEligible(kind)) return 0;
  if (inherent >= 15) return 5;
  if (inherent >= 10) return 4;
  if (inherent >= 5) return 3;
  return 2;
}
