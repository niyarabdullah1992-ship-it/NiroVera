import { LABOR_WORKPLACE_ITEMS } from "./safetyStandards.js";
import { citeRule } from "./laborRules.js";
import { profileGender } from "./employeeProfileFields.js";

/**
 * Labour Law duties on the workplace — Arts. 63, 125, 158 — per branch, on its safety record
 * (`rec.workplaceLaw[itemId] = { met, note, by, at }`). Two are read from the files, never ticked by hand:
 *  - Art. 158 applies only where women work (gender on file);
 *  - Art. 144's medical cover is counted from each worker's insurance end date.
 * Every row names its article from the catalog.
 */
export function workplaceLawRows({ rec = {}, employees = [], today = "" } = {}) {
  const store = rec.workplaceLaw || {};
  const women = employees.filter((person) => profileGender(person?.profile || {}) === "female").length;
  const noCover = employees.filter((person) => {
    const end = String(person?.profile?.medicalInsuranceExpiry || "").slice(0, 10);
    return !/^\d{4}-\d{2}-\d{2}$/.test(end) || (today && end < today);
  });
  return LABOR_WORKPLACE_ITEMS.map(([id, ar, en, ruleId]) => {
    const cite = citeRule(ruleId);
    const saved = store[id] || null;
    const row = { id, ar, en, cite, saved, applies: true, derivedAr: "", derivedEn: "", blocked: false };
    if (id === "law_158_seats" && !women) {
      row.applies = false;
      row.derivedAr = "لا عاملات في هذا الفرع حسب الملفات — لا يلزم الآن.";
      row.derivedEn = "No women on this branch's files — not required now.";
    }
    if (id === "law_144_health") {
      row.derivedAr = noCover.length
        ? `${noCover.length} من ${employees.length} بلا تأمين طبي ساري في الملف`
        : (employees.length ? `التأمين الطبي ساري للجميع (${employees.length})` : "لا موظفين في الفرع");
      row.derivedEn = noCover.length ? `${noCover.length} of ${employees.length} without valid medical cover on file` : `Medical cover valid for all (${employees.length})`;
      row.blocked = noCover.length > 0;
    }
    row.state = !row.applies ? "na" : row.blocked ? "bad" : saved?.met === true ? "ok" : saved?.met === false ? "bad" : "none";
    return row;
  });
}

/** Named gate before a row is recorded: «غير مستوفى» needs a note saying what is missing. */
export function checkWorkplaceLawGate({ met, note } = {}) {
  if (met !== true && met !== false) return { ok: false, error: "WORKPLACE_LAW_STATE", reason: "اختر: مستوفى أو غير مستوفى.", reasonEn: "Choose met or not met." };
  if (met === false && String(note || "").trim().length < 5) return { ok: false, error: "WORKPLACE_LAW_NOTE", reason: "اكتب ما الناقص (5 أحرف على الأقل).", reasonEn: "Say what is missing (at least 5 characters)." };
  return { ok: true };
}
