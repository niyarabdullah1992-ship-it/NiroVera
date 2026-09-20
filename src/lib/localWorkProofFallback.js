import {
  checkAcceptGate,
  checkApproveWorkProofGate,
  checkEditWorkProofGate,
  checkEndWorkProofGate,
  checkProofHeatBanGate,
  checkProofPlaceGate,
  deriveProofCounts,
  deriveProofHeatBanFlag,
  deriveProofStage,
  appendWorkProofAudit,
  applyWorkProofArchive,
  isWorkProofArchived,
  workProofArchiveDate,
} from "@/lib/workProofDerivations";
import { updateCompany } from "@/lib/store";
import { cleanedPeople, cleanedVehicles, peopleFromProof, vehiclesFromProof } from "@/lib/workProofCrew";
import { cleanProofAttachments, makeProofAttachment } from "@/lib/proofAttachments";

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A worked span that overlapped the sun-ban window is stamped on the record and
 * on the trail at closing — never refused. Refusing the record would erase the
 * only evidence that the crew was under the sun.
 */
function stampProofHeatBan(proof, actor) {
  const flag = deriveProofHeatBanFlag(proof);
  if (!flag) return proof;
  const trail = Array.isArray(proof.auditTrail) ? proof.auditTrail : [];
  if (trail.some((event) => event?.type === "heat_ban")) return { ...proof, heatBanFlag: flag };
  return {
    ...proof,
    heatBanFlag: flag,
    auditTrail: appendWorkProofAudit(proof, "heat_ban", actor || {}, { detail: flag.textAr }),
  };
}

function withStage(proof) {
  const stage = deriveProofStage(proof);
  const archived = isWorkProofArchived({ ...proof, stage });
  return {
    ...proof,
    stage,
    archived,
    archivedAt: archived ? workProofArchiveDate(proof) : null,
  };
}

export function listLocalWorkProofs(data) {
  const proofs = (Array.isArray(data?.workProofs) ? data.workProofs : []).map(withStage);
  return { proofs, counts: deriveProofCounts(proofs), source: "local" };
}

export function raiseLocalWorkProof(companyId, input, actor = {}) {
  const title = String(input.title || "").trim();
  const workReason = String(input.workReason || "").trim();
  const entityScope = "external";
  const entityStationId = "";
  const entityName = String(input.entityName || input.client || "").trim();
  const client = String(input.client || entityName).trim();
  const stationId = String(input.stationId || "").trim();
  const beforeStamp = String(input.beforeStamp || "").trim();
  if (!title || !workReason || !entityName || !stationId || !beforeStamp) {
    return { ok: false, error: "Missing title, workReason, entityName, stationId, or beforeStamp" };
  }
  // No silent default: an unstated place would decide the sun ban for the crew.
  const placeGate = checkProofPlaceGate(input.place);
  if (!placeGate.ok) {
    return { error: placeGate.error, reason: placeGate.reason, reasonEn: placeGate.reasonEn, gate: placeGate };
  }
  // Opening the record is refused inside the window; a span that already ran
  // through it is recorded and flagged at end instead.
  const heatGate = checkProofHeatBanGate({ place: placeGate.place });
  if (!heatGate.ok) {
    return { error: heatGate.error, reason: heatGate.reason, reasonEn: heatGate.reasonEn, gate: heatGate };
  }
  const geoVerdict = String(input.geoVerdict || "in").toLowerCase().startsWith("out") ? "out" : "in";
  const proof = {
    id: uid("wp"),
    companyId,
    ref: `WP-${Date.now().toString().slice(-6)}`,
    title,
    workReason,
    entityScope,
    entityStationId,
    entityKind: String(input.entityKind || "company").trim() === "individual" ? "individual" : "company",
    entityName,
    entityUnified: String(input.entityUnified || "").trim(),
    entityCr: String(input.entityCr || "").trim(),
    entityQiwa: String(input.entityQiwa || "").trim(),
    entitySite: String(input.entitySite || "").trim(),
    entityProject: String(input.entityProject || "").trim(),
    entityContact: String(input.entityContact || "").trim(),
    entityPhone: String(input.entityPhone || "").trim(),
    entityEmail: String(input.entityEmail || "").trim(),
    people: cleanedPeople(input.people?.length ? input.people : peopleFromProof(input), stationId),
    personName: String(input.personName || "").trim(),
    personId: String(input.personId || "").trim(),
    personTitle: String(input.personTitle || "").trim(),
    personPhone: String(input.personPhone || "").trim(),
    startedAt: input.startedAt || new Date().toISOString(),
    endedAt: null,
    vehicles: cleanedVehicles(input.vehicles?.length ? input.vehicles : vehiclesFromProof(input)),
    vehicle: input.vehicle && typeof input.vehicle === "object" ? input.vehicle : {},
    client,
    stationId,
    place: placeGate.place,
    techId: actor.id || null,
    raiserId: actor.id || null,
    raiserName: actor.name || input.raiserName || null,
    beforeStamp,
    afterStamp: null,
    beforeUrl: input.beforeUrl || null,
    afterUrl: null,
    attachments: cleanProofAttachments(input.attachments),
    attachmentsUpdatedAt: Array.isArray(input.attachments) && input.attachments.length ? new Date().toISOString() : null,
    geoVerdict,
    geoCleared: false,
    status: "await",
    archived: false,
    archivedAt: null,
    endedById: null,
    endedBy: null,
    createdAt: new Date().toISOString(),
    auditTrail: [],
  };
  proof.auditTrail = appendWorkProofAudit(proof, "raise", actor, { at: proof.createdAt });
  updateCompany(companyId, (data) => {
    data.workProofs = [proof, ...(Array.isArray(data.workProofs) ? data.workProofs : [])];
  });
  return { ok: true, proof: withStage(proof) };
}

export function endLocalWorkProof(companyId, proof, actor, extra = {}) {
  const gate = checkEndWorkProofGate({
    proof,
    actorUserId: actor?.id,
    sameBranch: !!extra.sameBranch,
    isManager: !!extra.isManager,
  });
  if (!gate.ok) return { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn };
  const afterStamp = String(extra.afterStamp || "").trim();
  const afterUrl = extra.afterUrl || null;
  if (!afterStamp || !afterUrl) {
    return { error: "AFTER_PHOTO_REQUIRED", reason: "ارفع صورة البعد لإنهاء العمل." };
  }
  let next = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.workProofs) ? data.workProofs : [];
    const idx = list.findIndex((item) => item.id === proof.id || item.ref === proof.ref);
    if (idx < 0) return;
    next = {
      ...list[idx],
      endedAt: extra.endedAt || new Date().toISOString(),
      afterStamp,
      afterUrl,
      endedById: actor?.id || null,
      endedBy: actor?.name || null,
      status: "ready",
      sealId: null,
      approvedAt: null,
      auditTrail: appendWorkProofAudit(list[idx], "end", actor),
    };
    next = stampProofHeatBan(next, actor);
    const approve = checkApproveWorkProofGate({
      proof: next,
      actorUserId: actor?.id,
      geoClearReason: extra.geoClearReason || "إنهاء العمل بصورة البعد",
    });
    if (approve.ok) {
      next = {
        ...next,
        geoCleared: next.geoVerdict === "out" ? true : next.geoCleared,
        geoClearReason: extra.geoClearReason || next.geoClearReason || "إنهاء العمل بصورة البعد",
        approvedBy: actor?.name || null,
        approvedAt: new Date().toISOString(),
        sealId: approve.sealId,
        status: "sealed",
        ...applyWorkProofArchive(next),
      };
    }
    list[idx] = next;
    data.workProofs = list;
  });
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود." };
  return { ok: true, proof: withStage(next) };
}

export function editLocalWorkProof(companyId, proof, actor, input = {}) {
  const gate = checkEditWorkProofGate({
    proof,
    actorUserId: actor?.id,
    sameBranch: !!input.sameBranch,
    isManager: !!input.isManager,
  });
  if (!gate.ok) return { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn };
  const title = String(input.title || "").trim();
  const workReason = String(input.workReason || "").trim();
  const entityName = String(input.entityName || input.client || "").trim();
  if (!title || !workReason || !entityName) {
    return { error: "MISSING_FIELDS", reason: "الوصف وسبب العمل واسم المستفيد مطلوبة." };
  }
  // The place travels with the record: an edit may correct it, never blank it.
  const editPlace = checkProofPlaceGate(input.place ?? proof?.place);
  if (!editPlace.ok) {
    return { error: editPlace.error, reason: editPlace.reason, reasonEn: editPlace.reasonEn, gate: editPlace };
  }
  const entityScope = "external";
  const entityStationId = "";
  let next = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.workProofs) ? data.workProofs : [];
    const idx = list.findIndex((item) => item.id === proof.id || item.ref === proof.ref);
    if (idx < 0) return;
    next = {
      ...list[idx],
      title,
      workReason,
      place: editPlace.place,
      entityScope,
      entityStationId,
      entityKind: String(input.entityKind || list[idx].entityKind || "company").trim() === "individual" ? "individual" : "company",
      entityName,
      entityUnified: String(input.entityUnified ?? list[idx].entityUnified ?? "").trim(),
      entityCr: String(input.entityCr ?? list[idx].entityCr ?? "").trim(),
      entityQiwa: String(input.entityQiwa ?? list[idx].entityQiwa ?? "").trim(),
      entitySite: String(input.entitySite ?? list[idx].entitySite ?? "").trim(),
      entityProject: String(input.entityProject ?? list[idx].entityProject ?? "").trim(),
      entityContact: String(input.entityContact ?? list[idx].entityContact ?? "").trim(),
      entityPhone: String(input.entityPhone ?? list[idx].entityPhone ?? "").trim(),
      entityEmail: String(input.entityEmail ?? list[idx].entityEmail ?? "").trim(),
      people: cleanedPeople(input.people?.length ? input.people : peopleFromProof({ ...list[idx], ...input }), String(input.stationId || list[idx].stationId || "")),
      personName: String(input.personName ?? list[idx].personName ?? "").trim(),
      personId: String(input.personId ?? list[idx].personId ?? "").trim(),
      personTitle: String(input.personTitle ?? list[idx].personTitle ?? "").trim(),
      personPhone: String(input.personPhone ?? list[idx].personPhone ?? "").trim(),
      startedAt: input.startedAt || list[idx].startedAt,
      vehicles: cleanedVehicles(input.vehicles?.length ? input.vehicles : vehiclesFromProof({ ...list[idx], ...input })),
      vehicle: input.vehicle && typeof input.vehicle === "object" ? input.vehicle : list[idx].vehicle,
      client: String(input.client || input.entityContact || entityName).trim(),
      stationId: String(input.stationId || list[idx].stationId || "").trim(),
      geoVerdict: String(input.geoVerdict || list[idx].geoVerdict || "in").toLowerCase().startsWith("out") ? "out" : "in",
      editedAt: new Date().toISOString(),
      editedBy: actor?.name || null,
      editedById: actor?.id || null,
      auditTrail: appendWorkProofAudit(list[idx], "edit", actor),
    };
    list[idx] = next;
    data.workProofs = list;
  });
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود." };
  return { ok: true, proof: withStage(next) };
}

export function approveLocalWorkProof(companyId, proof, actor, geoClearReason) {
  const gate = checkApproveWorkProofGate({
    proof,
    actorUserId: actor?.id,
    geoClearReason,
  });
  if (!gate.ok) return { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn };
  let next = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.workProofs) ? data.workProofs : [];
    const idx = list.findIndex((item) => item.id === proof.id || item.ref === proof.ref);
    if (idx < 0) return;
    const current = list[idx];
    const hasEnd = (Array.isArray(current.auditTrail) ? current.auditTrail : []).some((event) => event.type === "end" || event.type === "seal");
    next = {
      ...current,
      geoCleared: current.geoVerdict === "out" ? true : current.geoCleared,
      geoClearReason: geoClearReason || current.geoClearReason || null,
      approvedBy: actor?.name || "Supervisor",
      approvedAt: new Date().toISOString(),
      sealId: gate.sealId,
      status: "sealed",
      ...applyWorkProofArchive(current),
      auditTrail: hasEnd ? current.auditTrail : appendWorkProofAudit(current, "end", actor),
    };
    next = stampProofHeatBan(next, actor);
    list[idx] = next;
    data.workProofs = list;
  });
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود." };
  return { ok: true, proof: withStage(next) };
}

export function acceptLocalWorkProof(companyId, proof) {
  const gate = checkAcceptGate(proof);
  if (!gate.ok) return { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn };
  let next = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.workProofs) ? data.workProofs : [];
    const idx = list.findIndex((item) => item.id === proof.id || item.ref === proof.ref);
    if (idx < 0) return;
    next = {
      ...list[idx],
      acceptedAt: new Date().toISOString(),
      status: "accepted",
      sealId: gate.sealId,
      ...applyWorkProofArchive(list[idx]),
    };
    list[idx] = next;
    data.workProofs = list;
  });
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود." };
  return { ok: true, proof: withStage(next) };
}

export function rejectLocalWorkProof(companyId, proof, actor, reason) {
  if (actor?.id && proof.raiserId && String(actor.id) === String(proof.raiserId)) {
    return { error: "SELF_APPROVE_FORBIDDEN", reason: "من رفع الإثبات لا يرفضه كمعتمد." };
  }
  let next = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.workProofs) ? data.workProofs : [];
    const idx = list.findIndex((item) => item.id === proof.id || item.ref === proof.ref);
    if (idx < 0) return;
    next = {
      ...list[idx],
      status: "rejected",
      rejectReason: reason || null,
      rejectedBy: actor?.name || null,
      rejectedById: actor?.id || null,
      rejectedAt: new Date().toISOString(),
      sealId: null,
      approvedAt: null,
      ...applyWorkProofArchive(list[idx]),
      auditTrail: appendWorkProofAudit(list[idx], "reject", actor, { detail: reason || "" }),
    };
    list[idx] = next;
    data.workProofs = list;
  });
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود." };
  return { ok: true, proof: withStage(next) };
}

export function attachLocalWorkProof(companyId, proof, entry, extra = {}) {
  if (!proof) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود." };
  const file = entry?.url || entry?.name ? makeProofAttachment(entry) : null;
  if (!file) return { error: "FILE_REQUIRED", reason: "أرفق مستندًا أولًا.", reasonEn: "Attach a document first." };
  let next = null;
  updateCompany(companyId, (data) => {
    const list = Array.isArray(data.workProofs) ? data.workProofs : [];
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
    next = {
      ...list[idx],
      attachments,
      attachmentsUpdatedAt: file.updatedAt,
      auditTrail: appendWorkProofAudit(list[idx], "attach", extra.actor || {}, { detail: file.name || "" }),
    };
    list[idx] = next;
    data.workProofs = list;
  });
  if (!next) return { error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود." };
  return { ok: true, proof: withStage(next) };
}
