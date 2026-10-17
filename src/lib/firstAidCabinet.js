/**
 * The first-aid cabinet — Labour Law Art. 142 and Implementing Regulations Art. 29 (decision 115921).
 *   1. the cabinet holds at least the listed supplies and quantities (the table below, verbatim);
 *   2. they stay fit for use at all times;
 *   3. any item below its minimum is made up;
 *   4. the cabinet is sized for its contents, kept in a sanitary place at a suitable temperature,
 *      marked with a red crescent on white, and notices posted visibly in the workplace give its
 *      location and the name of the person responsible;
 *   5. the employer adds what the nature and size of the work call for.
 *
 * The check is kept per station on its safety record (rec.firstAidCabinet) with who checked it and when.
 * Status is derived from that record — never ticked as a whole. Pure (node-testable).
 */

export const FIRST_AID_ITEMS = [
  { key: "burn_gauze", min: 50, unitAr: "قطعة", ar: "شاش حروق", en: "Burn gauze" },
  { key: "sponge_dressing", min: 10, unitAr: "قطع", ar: "ضمادات إسفنجية", en: "Sponge dressings" },
  { key: "cleaning_gauze", min: 50, unitAr: "قطعة", ar: "قطع شاش للتنظيف", en: "Cleaning gauze pieces" },
  { key: "sterile_gauze_10", min: 50, unitAr: "قطعة", ar: "قطع شاش معقم 10×10", en: "Sterile gauze 10×10" },
  { key: "gauze_5", min: 50, unitAr: "قطعة", ar: "قطع شاش 5×5", en: "Gauze 5×5" },
  { key: "gauze_bandage_5", min: 10, unitAr: "أربطة", ar: "أربطة شاش 5×5", en: "Gauze bandages 5×5" },
  { key: "tourniquet", min: 1, unitAr: "", ar: "جور نيكيت", en: "Tourniquet" },
  { key: "compression_bandage", min: 10, unitAr: "أربطة", ar: "أربطة ضاغطة مقاسات مختلفة", en: "Compression bandages, assorted" },
  { key: "medical_wipes", min: 100, unitAr: "قطعة", ar: "مسحات طبية", en: "Medical swabs" },
  { key: "plaster_rolls", min: 5, unitAr: "لفات", ar: "لفات بلاستر", en: "Plaster rolls" },
  { key: "sterile_plasters", min: 20, unitAr: "قطعة", ar: "قطع بلاستر معقمة", en: "Sterile plasters" },
  { key: "sterile_gloves", min: 20, unitAr: "قفاز", ar: "قفازات معقمة", en: "Sterile gloves" },
  { key: "masks", min: 10, unitAr: "كمامات", ar: "كمامات للفم", en: "Mouth masks" },
  { key: "eye_wash", min: 1, unitAr: "عبوة", ar: "محلول لغسيل العين", en: "Eye-wash solution" },
  { key: "stretcher", min: 1, unitAr: "", ar: "نقالة مريض قابلة للطي", en: "Folding stretcher" },
  { key: "antiseptic", min: 1, unitAr: "عبوة", ar: "محلول مطهر للجروح", en: "Wound antiseptic" },
  { key: "airways", min: 1, unitAr: "طقم", ar: "طقم ممرات هوائية", en: "Airway set" },
  { key: "limb_splints", min: 1, unitAr: "طقم", ar: "طقم جبائر للفخذ والساق والساعد", en: "Thigh, leg and forearm splints" },
  { key: "spine_board", min: 1, unitAr: "", ar: "لوح صلب لإصابات العمود الفقري", en: "Spine board" },
  { key: "cervical_collars", min: 1, unitAr: "طقم", ar: "طقم جبائر عنقية لإصابات الرقبة", en: "Cervical collars" },
  { key: "scissors", min: 2, unitAr: "", ar: "مقص بالحجم المناسب", en: "Scissors" },
  { key: "blanket", min: 1, unitAr: "", ar: "بطانية حجم كبير", en: "Large blanket" },
  { key: "forceps", min: 2, unitAr: "", ar: "ملقط بالحجم المناسب", en: "Forceps" },
];

/** Art. 29(2–4) — the conditions the cabinet itself must meet, beside the table. */
export const FIRST_AID_CONDITIONS = [
  { key: "usable", ar: "كل الأنواع صالحة للاستعمال", en: "Every item fit for use", para: "29/2" },
  { key: "sanitary", ar: "حجم مناسب، ومكان صحي، ودرجة حرارة مناسبة", en: "Right size, sanitary place, suitable temperature", para: "29/4" },
  { key: "crescent", ar: "مميّزة بهلال أحمر على خلفية بيضاء", en: "Marked with a red crescent on white", para: "29/4" },
  { key: "posted", ar: "إعلان ظاهر بمكان الخزانة واسم المسؤول عنها", en: "A visible notice of the cabinet's place and its keeper", para: "29/4" },
];

/** Days after which the last check counts as stale — the platform's monthly readiness review. */
export const FIRST_AID_STALE_DAYS = 31;

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * cabinet: { counts: {key: n}, conditions: {key: bool}, location, keeper, extra, checkedBy, checkedAt }
 * → { state: none | short | stale | met, short: [...items below min], missing: [...conditions], ... }
 */
export function deriveFirstAidCabinet(cabinet, { today } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  if (!cabinet || !dateOnly(cabinet.checkedAt)) {
    return { state: "none", short: FIRST_AID_ITEMS.slice(), missing: FIRST_AID_CONDITIONS.slice(), checkedAt: "", checkedBy: "", age: null, location: "", keeper: "" };
  }
  const counts = cabinet.counts || {};
  const short = FIRST_AID_ITEMS.filter((item) => !(Number(counts[item.key]) >= item.min));
  const conditions = cabinet.conditions || {};
  const missing = FIRST_AID_CONDITIONS.filter((row) => conditions[row.key] !== true);
  const location = String(cabinet.location || "").trim();
  const keeper = String(cabinet.keeper || "").trim();
  if ((!location || !keeper) && !missing.some((row) => row.key === "posted")) missing.push(FIRST_AID_CONDITIONS.find((row) => row.key === "posted"));
  const checkedAt = dateOnly(cabinet.checkedAt);
  const age = daysBetween(checkedAt, day);
  const state = short.length || missing.length ? "short" : age > FIRST_AID_STALE_DAYS ? "stale" : "met";
  return { state, short, missing, checkedAt, checkedBy: cabinet.checkedBy || "", age, location, keeper };
}

/** Validate a check before it is saved: every item counted, the location and keeper named. */
export function checkFirstAidRecordGate({ counts = {}, location, keeper } = {}) {
  const uncounted = FIRST_AID_ITEMS.filter((item) => counts[item.key] === "" || counts[item.key] == null || !Number.isFinite(Number(counts[item.key])) || Number(counts[item.key]) < 0);
  if (uncounted.length) {
    return { ok: false, error: "FIRST_AID_UNCOUNTED", reason: `اكتب العدد الموجود لكل صنف — ناقص: ${uncounted.slice(0, 3).map((row) => row.ar).join("، ")}${uncounted.length > 3 ? "…" : ""} (اللائحة م29/1).`, reasonEn: "Count every item in the table (Regs Art. 29(1)).", uncounted };
  }
  if (String(location || "").trim().length < 3 || String(keeper || "").trim().length < 3) {
    return { ok: false, error: "FIRST_AID_POSTING", reason: "اكتب مكان الخزانة واسم المسؤول عنها — يُعلَن ذلك في أماكن العمل (اللائحة م29/4).", reasonEn: "Write the cabinet's place and its keeper — posted in the workplace (Regs Art. 29(4))." };
  }
  return { ok: true };
}

/** Company view for the ministry row: stations short, stale, never checked. */
export function firstAidSummary(stations = [], recFor, { today } = {}) {
  const rows = (stations || []).map((station) => ({ station, ...deriveFirstAidCabinet(recFor(station.id)?.firstAidCabinet, { today }) }));
  return {
    rows,
    none: rows.filter((row) => row.state === "none").length,
    short: rows.filter((row) => row.state === "short").length,
    stale: rows.filter((row) => row.state === "stale").length,
    met: rows.filter((row) => row.state === "met").length,
  };
}
