import { updateCompany } from "@/lib/store";
import { cleanProofAttachments, makeProofAttachment } from "@/lib/proofAttachments";
import {
  checkCloseVisitorProofGate,
  deriveVisitorProofCounts,
  deriveVisitorProofStage,
  visitorProofFields,
  visitorProofsForStations,
} from "@/lib/visitorProof";

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
    next = {
      ...list[idx],
      leftAt: extra.leftAt || new Date().toISOString(),
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
