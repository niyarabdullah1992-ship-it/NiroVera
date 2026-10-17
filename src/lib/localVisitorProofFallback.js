import { updateCompany } from "@/lib/store";
import { cleanProofAttachments, makeProofAttachment } from "@/lib/proofAttachments";
import {
  checkCloseVisitorProofGate,
  deriveVisitorProofCounts,
  deriveVisitorProofStage,
  visitorProofFields,
  visitorProofsForStations,
} from "@/lib/visitorProof";
import { addProofPerson, checkExtendVisitGate, markProofPersonOut } from "@/lib/proofPeople";

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function withStage(proof) {
  return { ...proof, stage: deriveVisitorProofStage(proof) };
}

export function listLocalVisitorProofs(data) {
  const proofs = (Array.isArray(data?.visitorProofs) ? data.visitorProofs : []).map(withStage);
  return { proofs, counts: deriveVisitorProofCounts(proofs), source: "local" };
}

export function raiseLocalVisitorProof(companyId, input, actor = {}) {
  const parsed = visitorProofFields(input);
  if (!parsed.ok) return { ok: false, error: parsed.error, reason: parsed.errorAr, reasonEn: parsed.errorEn };
  const rows = visitorProofsForStations(parsed.fields);
  if (!rows.length) {
    return { ok: false, error: "STATION_REQUIRED", reason: parsed.errorAr, reasonEn: parsed.errorEn };
  }
  const stamp = Date.now().toString().slice(-6);
  const createdAt = new Date().toISOString();
  const proofs = rows.map((fields, index) => ({
    id: uid("vp"),
    companyId,
    ref: `VP-${stamp}${parsed.fields.stationIds.length > 1 ? String(index + 1).padStart(2, "0") : ""}`,
    title: fields.personName || fields.visitReason,
    ...fields,
    attachments: cleanProofAttachments(input.attachments || fields.attachments),
    leftAt: null,
    status: "on_site",
    raiserId: actor.id || null,
    raiserName: actor.name || null,
    createdAt,
  }));
  updateCompany(companyId, (data) => {
    data.visitorProofs = [...proofs, ...(Array.isArray(data.visitorProofs) ? data.visitorProofs : [])];
  });
  return { ok: true, proof: withStage(proofs[0]), proofs: proofs.map(withStage) };
}

export function closeLocalVisitorProof(companyId, proof, actor, extra = {}) {
  const gate = checkCloseVisitorProofGate({
    proof,
    actorUserId: actor?.id,
    sameBranch: !!extra.sameBranch,
    isManager: !!extra.isManager,
  });
  if (!gate.ok) return { error: gate.error, reason: gate.errorAr, reasonEn: gate.errorEn };
  let next = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.visitorProofs) ? data.visitorProofs : [];
    const idx = list.findIndex((item) => item.id === proof.id || item.ref === proof.ref);
    if (idx < 0) return;
    const leftAt = extra.leftAt || new Date().toISOString();
    // Everyone still inside leaves with the pass.
    const people = Array.isArray(list[idx].people)
      ? list[idx].people.map((person) => (person?.name && !person.outAt ? { ...person, outAt: leftAt } : person))
      : list[idx].people;
    next = {
      ...list[idx],
      people,
      leftAt,
      status: "left",
      closedById: actor?.id || null,
      closedBy: actor?.name || null,
    };
    list[idx] = next;
    data.visitorProofs = list;
  });
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  return { ok: true, proof: withStage(next) };
}

export function attachLocalVisitorProof(companyId, proof, entry, extra = {}) {
  if (!proof) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  const file = entry?.url || entry?.name ? makeProofAttachment(entry) : null;
  if (!file) return { error: "FILE_REQUIRED", reason: "أرفق مستندًا أولًا.", reasonEn: "Attach a document first." };
  let next = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.visitorProofs) ? data.visitorProofs : [];
    const idx = list.findIndex((item) => item.id === proof.id || item.ref === proof.ref);
    if (idx < 0) return;
    const current = Array.isArray(list[idx].attachments) ? list[idx].attachments : [];
    const replaceId = extra.replaceId != null ? String(extra.replaceId) : "";
    const attachments = replaceId
      ? current.map((item, index) => (
        String(item.id) === replaceId || String(index) === replaceId
          ? { ...item, ...file, id: item.id || file.id, createdAt: item.createdAt || file.createdAt }
          : item
      ))
      : [...current, file];
    next = { ...list[idx], attachments, attachmentsUpdatedAt: file.updatedAt };
    list[idx] = next;
    data.visitorProofs = list;
  });
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  return { ok: true, proof: withStage(next) };
}

function patchVisitorProof(companyId, proof, build) {
  let next = null;
  let failure = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.visitorProofs) ? data.visitorProofs : [];
    const idx = list.findIndex((item) => item.id === proof?.id || item.ref === proof?.ref);
    if (idx < 0) return;
    const out = build(list[idx]);
    if (!out?.ok) { failure = out; return; }
    next = out.proof;
    list[idx] = next;
    data.visitorProofs = list;
  });
  if (failure) return { error: failure.error, reason: failure.errorAr, reasonEn: failure.errorEn };
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  return { ok: true, proof: withStage(next) };
}

function logOf(row, text, actor) {
  const log = Array.isArray(row.log) ? row.log : [];
  return [...log, { at: new Date().toISOString(), by: actor?.name || "", text }];
}

/** A companion who joined an open visit. */
export function addLocalVisitorPerson(companyId, proof, person, actor = {}) {
  return patchVisitorProof(companyId, proof, (row) => {
    const res = addProofPerson(row, person, { kind: "visitor" });
    if (!res.ok) return res;
    return { ok: true, proof: { ...row, people: res.people, log: logOf(row, `انضم ${res.people[res.people.length - 1].name}`, actor) } };
  });
}

/** One visitor left; when the last one leaves the pass closes. */
export function markLocalVisitorPersonOut(companyId, proof, index, actor = {}) {
  return patchVisitorProof(companyId, proof, (row) => {
    const res = markProofPersonOut(row, index);
    if (!res.ok) return res;
    const at = res.people[index].outAt;
    const closed = res.allOut
      ? { leftAt: at, status: "left", closedById: actor?.id || null, closedBy: actor?.name || null }
      : {};
    return { ok: true, proof: { ...row, people: res.people, ...closed, log: logOf(row, `غادر ${res.people[index].name}`, actor) } };
  });
}

/** The visit runs longer than cleared: a new end date with the reason, the old one kept. */
export function extendLocalVisitorProof(companyId, proof, { to, reason }, actor = {}, today) {
  return patchVisitorProof(companyId, proof, (row) => {
    const gate = checkExtendVisitGate(row, { to, reason, today });
    if (!gate.ok) return gate;
    const extensions = Array.isArray(row.extensions) ? row.extensions : [];
    return {
      ok: true,
      proof: {
        ...row,
        visitTo: gate.to,
        extensions: [...extensions, { from: gate.from, to: gate.to, reason: String(reason).trim(), by: actor?.name || "", at: new Date().toISOString() }],
        log: logOf(row, `مُدّد التصريح إلى ${gate.to}`, actor),
      },
    };
  });
}
