/**
 * People on an open proof — workers of an outside party (إثبات العمل) or guests (إثبات زائر).
 * A crew rarely arrives together and never leaves together, so each person carries their own
 * time in and out. Pure helpers; the local fallbacks write, the cards read.
 */
import { PROOF_PEOPLE_LIMIT, cleanedPeople, normalizePerson } from "./workProofCrew.js";

const err = (error, ar, en) => ({ ok: false, error, errorAr: ar, errorEn: en });

function idKey(v) {
  return String(v || "").replace(/\s+/g, "");
}

/** Who is still inside: everyone without a time out. */
export function peopleInside(people) {
  return (Array.isArray(people) ? people : []).filter((p) => p?.name && !p.outAt);
}

/**
 * Add one person to a proof that is still open.
 * kind "work" needs an ID (the outside party's worker); kind "visitor" needs a nationality.
 */
export function addProofPerson(proof, raw, { kind = "work", at = new Date().toISOString() } = {}) {
  if (!proof) return err("PROOF_NOT_FOUND", "الإثبات غير موجود.", "Proof not found.");
  if (proof.leftAt || proof.status === "left" || proof.sealId || proof.approvedAt || proof.status === "rejected") {
    return err("PROOF_CLOSED", "الإثبات مغلق — لا يُضاف إليه أحد.", "The proof is closed — nobody can be added.");
  }
  const person = normalizePerson(raw, proof.stationId);
  if (!person.name) return err("NAME_REQUIRED", "اكتب الاسم.", "Write the name.");
  if (kind === "work" && !person.id) return err("ID_REQUIRED", "اكتب رقم الهوية أو الإقامة.", "Write the ID or iqama number.");
  if (kind === "visitor" && !person.nationality) return err("NATIONALITY_REQUIRED", "اكتب الجنسية.", "Write the nationality.");
  const current = cleanedPeople(proof.people, proof.stationId);
  if (current.length >= PROOF_PEOPLE_LIMIT) {
    return err("LIMIT", `الحد ${PROOF_PEOPLE_LIMIT} أشخاص في الإثبات الواحد — افتح إثباتاً آخر.`, `Up to ${PROOF_PEOPLE_LIMIT} people on one proof — open another.`);
  }
  if (person.id && current.some((p) => idKey(p.id) === idKey(person.id))) {
    return err("DUPLICATE_ID", "رقم الهوية مسجّل على هذا الإثبات.", "That ID is already on this proof.");
  }
  return { ok: true, people: [...current, { ...person, inAt: at }] };
}

/** Record that one person left. When nobody is inside any more the caller may close the proof. */
export function markProofPersonOut(proof, index, { at = new Date().toISOString() } = {}) {
  const current = cleanedPeople(proof?.people, proof?.stationId);
  const person = current[index];
  if (!person) return err("PERSON_NOT_FOUND", "الشخص غير موجود على الإثبات.", "Person not on this proof.");
  if (person.outAt) return err("ALREADY_OUT", `${person.name} سُجّل خروجه.`, `${person.name} already left.`);
  const people = current.map((p, i) => (i === index ? { ...p, outAt: at } : p));
  return { ok: true, people, allOut: peopleInside(people).length === 0 };
}

/** Extend a visitor pass to a later day, with a written reason. */
export function checkExtendVisitGate(proof, { to, reason, today }) {
  const day = String(to || "").slice(0, 10);
  const current = String(proof?.visitTo || proof?.visitFrom || "").slice(0, 10);
  if (!proof) return err("PROOF_NOT_FOUND", "الإثبات غير موجود.", "Proof not found.");
  if (proof.leftAt || proof.status === "left") return err("ALREADY_LEFT", "الزائر غادر — سجّل زيارة جديدة.", "The visitor left — record a new visit.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return err("DATE_REQUIRED", "اختر التاريخ الجديد لنهاية الزيارة.", "Pick the new end date.");
  if (day < today) return err("DATE_PAST", "التاريخ الجديد لا يكون قبل اليوم.", "The new date cannot be before today.");
  if (current && day <= current) return err("NOT_LATER", "التمديد يكون إلى تاريخ بعد نهاية التصريح الحالية.", "An extension must end after the current pass.");
  if (!String(reason || "").trim()) return err("REASON_REQUIRED", "اكتب سبب التمديد.", "Write why the visit is extended.");
  return { ok: true, to: day, from: current };
}
