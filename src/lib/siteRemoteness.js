/**
 * «الأماكن البعيدة عن العمران» — Implementing Regulations Art. 30 (decision 115921), for Labour Law Art. 146:
 *   1. a work site more than 50 km from the urban boundary the municipalities set when the road is paved,
 *      or more than 25 km when it is not;
 *   2. population clusters that lack utilities and services.
 *
 * The station keeps the distance and the road type on its safety record (rec.site — who and when);
 * the flag is derived, never ticked. What depends on it: Art. 146 (shops, recreation, medical care and
 * the family's treatment, schools, mosques, literacy — all or some as the Minister sets) and Art. 147
 * (housing or camps and meals). Pure (node-testable).
 */

export const REMOTE_PAVED_KM = 50;
export const REMOTE_UNPAVED_KM = 25;

export const ROAD_TYPES = [
  { key: "paved", ar: "طريق معبّد", en: "Paved road", limit: REMOTE_PAVED_KM },
  { key: "unpaved", ar: "طريق غير معبّد", en: "Unpaved road", limit: REMOTE_UNPAVED_KM },
];

/** Art. 146(1–6) — owed in remote places «كل ما يأتي أو بعضه وفقاً لما يحدده الوزير». */
export const REMOTE_DUTIES_146 = [
  { key: "shops", ar: "حوانيت للطعام والملابس والحاجات الضرورية بأسعار معتدلة", en: "Shops for food, clothing and necessities at fair prices" },
  { key: "recreation", ar: "وسائل ترفيه وتثقيف وملاعب رياضية", en: "Recreation, education and sports grounds" },
  { key: "medical", ar: "ترتيبات طبية وعلاج الأسرة المقيمة علاجاً شاملاً", en: "Medical arrangements and full treatment of the resident family" },
  { key: "schools", ar: "مدارس لأولاد العمال إن لم تكفِ مدارس المنطقة", en: "Schools for workers' children where the area has too few" },
  { key: "mosques", ar: "مساجد أو مصليات في أماكن العمل", en: "Mosques or prayer rooms at the workplace" },
  { key: "literacy", ar: "برامج لمحو الأمية", en: "Literacy programmes" },
];

const yesish = (v) => v === true || v === 1 || /^(yes|true|1|نعم)$/i.test(String(v ?? "").trim());

/**
 * site: { distanceKm, roadType, noServices } — from the station's safety record.
 * legacy: the old hand-ticked station.remoteSite, read only while no distance is recorded.
 */
export function deriveRemoteness(site = {}, legacy) {
  const raw = site?.distanceKm;
  const distanceKm = raw === "" || raw == null || !Number.isFinite(Number(raw)) ? null : Math.max(0, Number(raw));
  const road = ROAD_TYPES.find((row) => row.key === site?.roadType) || null;
  const noServices = yesish(site?.noServices);
  if (noServices) {
    return {
      known: true, remote: true, basis: "services", distanceKm, roadType: road?.key || "", limit: road?.limit ?? null,
      reasonAr: "تجمع سكاني لا تتوفر به المرافق والخدمات (اللائحة م30/2).",
      reasonEn: "A population cluster without utilities and services (Regs Art. 30(2)).",
    };
  }
  if (distanceKm != null && road) {
    const remote = distanceKm > road.limit;
    return {
      known: true, remote, basis: road.key, distanceKm, roadType: road.key, limit: road.limit,
      reasonAr: remote
        ? `${distanceKm} كم عن النطاق العمراني على ${road.ar} — أكثر من ${road.limit} كم (اللائحة م30/1).`
        : `${distanceKm} كم عن النطاق العمراني على ${road.ar} — لا يزيد على ${road.limit} كم.`,
      reasonEn: remote
        ? `${distanceKm} km from the urban boundary on a ${road.key} road — over ${road.limit} km (Regs Art. 30(1)).`
        : `${distanceKm} km from the urban boundary on a ${road.key} road — within ${road.limit} km.`,
    };
  }
  if (distanceKm != null || road) {
    return {
      known: false, remote: false, basis: "", distanceKm, roadType: road?.key || "", limit: road?.limit ?? null,
      reasonAr: distanceKm == null ? "سجّل المسافة عن النطاق العمراني." : "حدّد نوع الطريق: معبّد أو غير معبّد.",
      reasonEn: distanceKm == null ? "Record the distance from the urban boundary." : "Set the road type: paved or unpaved.",
    };
  }
  if (legacy != null && legacy !== "") {
    const remote = yesish(legacy);
    return {
      known: true, remote, basis: "declared", distanceKm: null, roadType: "", limit: null,
      reasonAr: remote ? "مُعلَّم بعيداً عن العمران دون مسافة مسجّلة — سجّل المسافة ونوع الطريق." : "غير بعيد — بلا مسافة مسجّلة.",
      reasonEn: remote ? "Marked remote with no distance on record — record the distance and road." : "Not remote — no distance on record.",
    };
  }
  return { known: false, remote: false, basis: "", distanceKm: null, roadType: "", limit: null, reasonAr: "لم تُسجَّل المسافة ونوع الطريق.", reasonEn: "No distance or road type on record." };
}

/** The station's site record lives on its safety record (persisted with the safety register). */
export function siteRecordOf(data, stationId) {
  const rec = (data?.safety || []).find((row) => String(row?.stationId) === String(stationId || ""));
  return rec?.site || {};
}

/** A station with its derived remoteness folded in — what siteConditions and the pay panel read. */
export function stationWithSite(data, stationId) {
  const station = (data?.stations || []).find((row) => String(row?.id) === String(stationId || "")) || {};
  const site = siteRecordOf(data, stationId);
  const remoteness = deriveRemoteness(site, station.remoteSite);
  return { ...station, site, remoteness, remoteSite: remoteness.known ? remoteness.remote : station.remoteSite };
}

/** Validate a site record before it is saved (who and when are stamped by the caller). */
export function checkSiteRecordGate({ distanceKm, roadType, noServices } = {}) {
  const services = yesish(noServices);
  const hasDistance = !(distanceKm === "" || distanceKm == null);
  if (hasDistance && (!Number.isFinite(Number(distanceKm)) || Number(distanceKm) < 0)) {
    return { ok: false, error: "SITE_DISTANCE_INVALID", reason: "المسافة بالكيلومتر رقم موجب.", reasonEn: "The distance is a positive number of km." };
  }
  if (hasDistance && !ROAD_TYPES.some((row) => row.key === roadType)) {
    return { ok: false, error: "SITE_ROAD_REQUIRED", reason: "حدّد نوع الطريق: معبّد أو غير معبّد (اللائحة م30/1).", reasonEn: "Set the road type: paved or unpaved (Regs Art. 30(1))." };
  }
  if (!hasDistance && !services) {
    return { ok: false, error: "SITE_DISTANCE_REQUIRED", reason: "سجّل المسافة عن النطاق العمراني الذي تحدده الأمانة أو البلدية.", reasonEn: "Record the distance from the urban boundary set by the municipality." };
  }
  return { ok: true, site: { distanceKm: hasDistance ? Math.round(Number(distanceKm) * 10) / 10 : null, roadType: hasDistance ? roadType : "", noServices: services } };
}
