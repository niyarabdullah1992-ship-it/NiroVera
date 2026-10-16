/** Decision 18632 — the employer's five night-work obligations as rule rows.
 *  The first three (first aid · emergency transfer · food access) block publishing when missing with night work;
 *  parity (a) and the procedures guide (f) are alerts. Storage stays where the publish gate already reads it:
 *  the `true` flag on the station roster (or company.nightFacilities), with the proof beside it in
 *  `nightDutyProof[key]` = { by, byName, at, ...fields }.
 */

import { NIGHT_FACILITY_FLAGS } from "./decision18632.js";
import { NIGHT_EMPLOYER_DUTIES } from "./ministryExtras.js";

/** Parity acknowledgement (a) is renewed yearly. */
export const NIGHT_PARITY_RENEW_DAYS = 365;

const FIRST_AID_CERT_RE = /إسعاف|اسعاف|first\s*-?\s*aid|cpr|bls/i;

export const NIGHT_OBLIGATIONS = [
  ...NIGHT_FACILITY_FLAGS.map((flag) => ({ ...flag, clause: "ثالثاً", clauseEn: "III", blocks: true, gateId: "night_facilities" })),
  ...NIGHT_EMPLOYER_DUTIES.map((duty) => ({ ...duty, clauseEn: duty.clause === "أ" ? "a" : "f", clause: `متطلبات ${duty.clause}`, blocks: false, gateId: "night_employer_duties" })),
];

export const NIGHT_FOOD_METHODS = [
  { id: "kitchen", ar: "مطبخ أو مقصف في الموقع", en: "On-site kitchen or canteen" },
  { id: "allowance", ar: "بدل وجبة ليلية", en: "Night meal allowance" },
  { id: "supplier", ar: "مورّد أو توصيل متعاقد", en: "Contracted supplier or delivery" },
];

function dayKey(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function daysBetween(fromKey, toKey) {
  const a = Date.parse(`${fromKey}T00:00:00Z`);
  const b = Date.parse(`${toKey}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** The bag that holds the flag — the proof lives beside it. */
function flagBag(bags, key) {
  return (bags || []).find((bag) => bag && bag[key] === true) || null;
}

/** An employee's first-aid certificate: the linked one by id, else the first one whose name reads first aid. */
export function firstAidCertificate(employee, certId) {
  const certs = Array.isArray(employee?.certificates) ? employee.certificates : [];
  if (certId) {
    const hit = certs.find((cert) => String(cert?.id) === String(certId));
    if (hit) return hit;
  }
  return certs.find((cert) => FIRST_AID_CERT_RE.test(String(cert?.name || cert?.title || ""))) || null;
}

/** Each named first-aider, read live against the employee file (certificate expiry). */
export function firstAidersState(proof, { employees = [], today } = {}) {
  const todayKey = dayKey(today);
  return (proof?.aiders || []).map((aider) => {
    const employee = aider?.employeeId ? employees.find((row) => String(row?.id) === String(aider.employeeId)) : null;
    const cert = employee ? firstAidCertificate(employee, aider.certId) : null;
    const expiry = dayKey(cert?.expiryDate || "");
    const expired = !!(expiry && todayKey && expiry < todayKey);
    return {
      name: String(employee?.name || aider?.name || "").trim(),
      employeeId: aider?.employeeId || null,
      certName: cert ? String(cert.name || cert.title || "") : "",
      expiry,
      expired,
    };
  }).filter((row) => row.name);
}

/**
 * Is one obligation met? The flag must be on file; when a proof is on file it must still hold
 * (a first-aider with a current certificate · parity acknowledged within the year).
 * A flag set before proofs existed still counts — the gate read it that way and keeps doing so.
 */
export function nightObligationMet(key, { bags = [], employees = [], today } = {}) {
  const bag = flagBag(bags, key);
  if (!bag) return { met: false, reason: "missing", proof: null };
  const proof = bag.nightDutyProof?.[key] || null;
  if (!proof) return { met: true, reason: "flag", proof: null };
  const todayKey = dayKey(today);
  if (key === "nightFirstAidReady") {
    const aiders = firstAidersState(proof, { employees, today });
    if (aiders.length && aiders.every((row) => row.expired)) {
      return { met: false, reason: "cert_expired", proof, aiders };
    }
    return { met: true, reason: "proof", proof, aiders };
  }
  if (key === "nightTrainingParity") {
    const at = dayKey(proof.at);
    if (at && todayKey && daysBetween(at, todayKey) > NIGHT_PARITY_RENEW_DAYS) {
      return { met: false, reason: "renew_due", proof };
    }
  }
  return { met: true, reason: "proof", proof };
}

function niceDate(key, ar) {
  if (!key) return "";
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  try {
    return d.toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return key;
  }
}

function proofDetail(key, state, ar) {
  const proof = state.proof || {};
  if (key === "nightFirstAidReady") {
    const aiders = state.aiders || [];
    return aiders.map((row) => {
      if (!row.expiry) return row.name;
      return row.expired
        ? (ar ? `${row.name} (انتهت الشهادة ${niceDate(row.expiry, ar)})` : `${row.name} (certificate expired ${niceDate(row.expiry, ar)})`)
        : (ar ? `${row.name} (شهادة سارية حتى ${niceDate(row.expiry, ar)})` : `${row.name} (certificate valid to ${niceDate(row.expiry, ar)})`);
    }).join(ar ? "، " : ", ");
  }
  if (key === "nightEmergencyTransferReady") {
    return [proof.method, proof.party, proof.contact ? `${ar ? "هاتف" : "Tel."} ${proof.contact}` : "", proof.file?.name].filter(Boolean).join(" · ");
  }
  if (key === "nightFoodAccessReady") {
    const method = NIGHT_FOOD_METHODS.find((row) => row.id === proof.method);
    return [method ? (ar ? method.ar : method.en) : "", proof.note].filter(Boolean).join(" · ");
  }
  if (key === "nightTrainingParity") {
    const at = dayKey(proof.at);
    if (!at) return "";
    const due = new Date(Date.parse(`${at}T12:00:00Z`) + NIGHT_PARITY_RENEW_DAYS * 86400000).toISOString().slice(0, 10);
    return ar ? `إقرار الموارد البشرية بسياسة التكافؤ · يُجدَّد قبل ${niceDate(due, ar)}` : `HR acknowledged the parity policy · renew before ${niceDate(due, ar)}`;
  }
  if (key === "nightGuidePublished") {
    return proof.file?.name ? (ar ? `الدليل: ${proof.file.name} — في ملفات المنشأة` : `Guide: ${proof.file.name} — in company files`) : "";
  }
  return "";
}

/**
 * One rule row per obligation for the ministry panel. Derived only:
 *  no night work → void «لا عمل ليلي هذا الأسبوع» · missing → blocked «يمنع النشر» (first three) or alert «تنبيه» ·
 *  met → settled «مستوفى» with who/when on the sub line.
 */
export function nightObligationRows({ bags = [], employees = [], today, nightWork = false, ar = true } = {}) {
  return NIGHT_OBLIGATIONS.map((ob) => {
    const state = nightObligationMet(ob.key, { bags, employees, today });
    const proof = state.proof;
    const byLine = proof
      ? [proof.byName || proof.by || "", niceDate(dayKey(proof.at), ar)].filter(Boolean).join(ar ? " · " : " · ")
      : "";
    const detail = proof ? proofDetail(ob.key, state, ar) : "";
    let status;
    let pillLabel;
    if (!nightWork) {
      status = "void";
      pillLabel = ar ? "لا عمل ليلي هذا الأسبوع" : "No night work this week";
    } else if (state.met) {
      status = "settled";
      pillLabel = ar ? "مستوفى" : "Met";
    } else if (ob.blocks) {
      status = "blocked";
      pillLabel = ar ? "يمنع النشر" : "Blocks publish";
    } else {
      status = "alert";
      pillLabel = ar ? "تنبيه" : "Alert";
    }
    let note = "";
    if (state.reason === "cert_expired") {
      note = ar ? `انتهت شهادة الإسعافات لكل من سُمّي: ${detail}. سمِّ مسعفاً بشهادة سارية.` : `Every named first-aider's certificate has expired: ${detail}. Name a first-aider with a current certificate.`;
    } else if (state.reason === "renew_due") {
      note = ar ? "مضى عام على إقرار سياسة التكافؤ — يُجدَّد الإقرار سنوياً." : "A year has passed since the parity acknowledgement — it is renewed yearly.";
    } else if (!state.met && nightWork) {
      note = ob.blocks
        ? (ar ? "ناقص مع وجود عمل ليلي هذا الأسبوع — يمنع نشر الجدول حتى يُثبت." : "Missing with night work this week — blocks publishing until proven.")
        : (ar ? "غير مثبت — تنبيه لا يمنع النشر." : "Not proven — an alert, not a publish block.");
    }
    let sub = "";
    if (state.met) {
      sub = state.reason === "flag"
        ? (ar ? "مسجّل دون تفاصيل — أضف الإثبات" : "On file without details — add the proof")
        : [byLine, detail].filter(Boolean).join(" · ");
    }
    return {
      id: `night_ob_${ob.key}`,
      key: ob.key,
      article: "18632",
      decision: "18632",
      clause: ar ? ob.clause : ob.clauseEn,
      blocks: ob.blocks,
      status,
      pillLabel,
      met: state.met,
      reason: state.reason,
      title: ar ? ob.ar : ob.en,
      summary: note,
      who: "",
      sub,
      proof,
      checkId: ob.gateId,
      obligationKey: ob.key,
    };
  });
}

/** The publish-gate gaps — same objects the gate always listed, plus a reason when a proof stopped holding. */
export function nightObligationGaps(list, { bags = [], employees = [], today } = {}) {
  return list
    .map((flag) => ({ flag, state: nightObligationMet(flag.key, { bags, employees, today }) }))
    .filter(({ state }) => !state.met)
    .map(({ flag, state }) => {
      if (state.reason === "cert_expired") {
        return { ...flag, reason: "cert_expired", ar: `${flag.ar} (انتهت شهادة المسعف)`, en: `${flag.en} (first-aider certificate expired)` };
      }
      if (state.reason === "renew_due") {
        return { ...flag, reason: "renew_due", ar: `${flag.ar} (حان تجديد الإقرار السنوي)`, en: `${flag.en} (yearly acknowledgement due)` };
      }
      return flag;
    });
}
