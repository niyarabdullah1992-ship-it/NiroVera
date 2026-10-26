/** HSE derivations — exposure from headcount×2080; TRIR/LTIFR/DART; hazard close gate.
 *  Design ref: NiroVera Platform.dc.html class Component (HSE / hierarchy of controls).
 */

export const HOURS_PER_WORKER_YEAR = 2080;

export const HIERARCHY_OF_CONTROLS = [
  { id: "elim", factor: 0.10, ar: "إزالة", en: "Elimination" },
  { id: "sub", factor: 0.25, ar: "استبدال", en: "Substitution" },
  { id: "eng", factor: 0.40, ar: "ضابط هندسي", en: "Engineering" },
  { id: "adm", factor: 0.70, ar: "ضابط إداري", en: "Administrative" },
  { id: "ppe", factor: 0.85, ar: "مهمات وقاية", en: "PPE" },
] as const;

export type IncidentCounts = {
  fatal?: number;
  lti?: number;
  restrict?: number;
  medical?: number;
  firstAid?: number;
  nearMiss?: number;
  unsafe?: number;
  /** Generic recordable count when class breakdown is unavailable */
  recordable?: number;
};

export function exposureHours(headcount: number) {
  const n = Math.max(0, Number(headcount) || 0);
  return n * HOURS_PER_WORKER_YEAR;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function recordableCount(inc: IncidentCounts) {
  if (inc.recordable != null) return Math.max(0, Number(inc.recordable) || 0);
  return (
    (Number(inc.fatal) || 0) +
    (Number(inc.lti) || 0) +
    (Number(inc.restrict) || 0) +
    (Number(inc.medical) || 0)
  );
}

export function deriveHseRates(headcount: number, inc: IncidentCounts) {
  const hours = exposureHours(headcount);
  const recordable = recordableCount(inc);
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

export function inherentRisk(likelihood: number, severity: number) {
  const L = Math.min(5, Math.max(1, Math.round(Number(likelihood) || 1)));
  const S = Math.min(5, Math.max(1, Math.round(Number(severity) || 1)));
  return L * S;
}

export function residualRisk(inherent: number, controlId: string | null | undefined) {
  const ctrl = HIERARCHY_OF_CONTROLS.find((c) => c.id === controlId);
  if (!ctrl) return Math.max(1, Number(inherent) || 1);
  return Math.max(1, Math.round((Number(inherent) || 1) * ctrl.factor));
}

export function isStrongControl(controlId: string | null | undefined) {
  return ["elim", "sub", "eng"].includes(String(controlId || ""));
}

/** Named close gate — control + residual + before/after photos. */
export function checkHazardCloseGate(input: {
  controlId?: string | null;
  likelihood?: number;
  severity?: number;
  inherent?: number;
  beforePhoto?: unknown;
  afterPhoto?: unknown;
}) {
  const inherent =
    input.inherent != null
      ? Math.max(1, Number(input.inherent) || 1)
      : inherentRisk(input.likelihood ?? 3, input.severity ?? 3);
  const controlId = input.controlId ? String(input.controlId) : "";
  if (!controlId) {
    return {
      ok: false as const,
      error: "CONTROL_REQUIRED",
      reason: "لا يُغلق خطر قبل تسمية الضابط المطبَّق.",
      reasonEn: "A hazard is never closed before naming the control applied.",
      inherent,
    };
  }
  const residual = residualRisk(inherent, controlId);
  if (inherent >= 10 && !isStrongControl(controlId)) {
    return {
      ok: false as const,
      error: "WEAK_CONTROL",
      reason: "الخطورة الأصلية عالية — لا يُقبل ضابط إداري أو مهمات وقاية وحده.",
      reasonEn: "High inherent risk — administrative control or PPE alone is not accepted.",
      inherent,
      residual,
    };
  }
  if (residual >= 10) {
    return {
      ok: false as const,
      error: "RESIDUAL_HIGH",
      reason: "الخطورة المتبقية ما زالت عالية — ارفع مستوى الضابط قبل الإغلاق.",
      reasonEn: "Residual risk is still high — raise the control level before closing.",
      inherent,
      residual,
    };
  }
  // Twin of hseDerivations.js `hasPhoto`: a bare truthiness test accepted `{}`, `{name:"x"}` and
  // "  " as photo proof, so a hazard could close server-side with no picture at all.
  const hasPhoto = (p: unknown) => {
    if (!p) return false;
    if (typeof p === "string") return p.trim().length > 0;
    const row = p as { url?: string; file_url?: string };
    return Boolean(row.url || row.file_url);
  };
  if (!hasPhoto(input.beforePhoto) || !hasPhoto(input.afterPhoto)) {
    return {
      ok: false as const,
      error: "PHOTOS_REQUIRED",
      reason: "يلزم إثبات مصوّر قبل وبعد قبل الإغلاق.",
      reasonEn: "Before and after photo proof is required before closing.",
      inherent,
      residual,
    };
  }
  return { ok: true as const, inherent, residual, controlId };
}

/** Reporting a hazard/near-miss earns points; the recordable incident itself does not. */
export function reportingPointsEligible(kind: string | null | undefined) {
  const k = String(kind || "").toLowerCase();
  if (["hazard", "near_miss", "nearmiss", "unsafe", "unsafe_act"].includes(k)) return true;
  if (["fatal", "lti", "restrict", "medical", "incident", "recordable"].includes(k)) return false;
  return k === "first_aid" || k === "firstaid" ? false : false;
}

export function reportingPointsFor(kind: string, inherent = 6) {
  if (!reportingPointsEligible(kind)) return 0;
  const band = inherent >= 15 ? 5 : inherent >= 10 ? 4 : inherent >= 5 ? 3 : 2;
  return band;
}
