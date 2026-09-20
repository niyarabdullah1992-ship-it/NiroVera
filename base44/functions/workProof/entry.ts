import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
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
  isSameProofBranch,
  isWorkProofArchived,
  applyWorkProofArchive,
  workProofArchiveDate,
  sealIdFor,
  appendWorkProofAudit,
  type WorkProofLike,
} from "../../shared/workProofDerivations.ts";

/** Live store is this blob. WorkProof entity is unused — do-not-write that table. */
const PROOFS_CATEGORY = "workProofs";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = String(body.action || "");
    const companyId = requireCompanyId(body.companyId);
    if (!companyId) {
      return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
    }

    const sessionAuth = await authPowerCareSession(base44, companyId, body.sessionToken);
    if (!sessionAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const auth = {
      companyId,
      userId: sessionAuth.userId || null,
      name: sessionAuth.name || "User",
      role: sessionAuth.role || "employee",
      stationId: sessionAuth.stationId || null,
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
    };

    const managerRoles = ["owner", "director", "ops_manager", "station_manager", "pgm", "admin"];
    const isManager = auth.owner || auth.admin || managerRoles.includes(auth.role);

    const loadBlob = async () => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category: PROOFS_CATEGORY });
      return rows[0] || null;
    };
    const listProofs = async (): Promise<WorkProofLike[]> => {
      const blob = await loadBlob();
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      return payload.filter((p: WorkProofLike & { companyId?: string }) => p && p.companyId === auth.companyId && p.ref);
    };
    const saveProofs = async (proofs: WorkProofLike[]) => {
      const blob = await loadBlob();
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload: proofs });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: auth.companyId, category: PROOFS_CATEGORY, payload: proofs });
    };
    const audit = async (actionKey: string, details: string, extra: Record<string, unknown> = {}) => {
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: auth.companyId,
        action: actionKey,
        performedBy: auth.name,
        details,
        reason: extra.reason || null,
        oldValue: extra.oldValue || null,
        newValue: extra.newValue || null,
      });
    };

    if (action === "list" || action === "counts") {
      let proofs = await listProofs();
      const scope = body.stationId ? String(body.stationId) : null;
      if (scope) proofs = proofs.filter((p) => p.stationId === scope);
      const counts = deriveProofCounts(proofs);
      if (action === "counts") return Response.json({ counts });
      return Response.json({
        proofs: proofs.map((p) => {
          const archived = isWorkProofArchived(p);
          return {
            ...p,
            stage: deriveProofStage(p),
            expectedSeal: sealIdFor(p),
            archived,
            archivedAt: archived ? workProofArchiveDate(p) : null,
          };
        }),
        counts,
      });
    }

    if (action === "raise") {
      const title = String(body.title || "").trim();
      const workReason = String(body.workReason || "").trim();
      const entityName = String(body.entityName || body.client || "").trim();
      const client = String(body.client || entityName).trim();
      const stationId = String(body.stationId || auth.stationId || "").trim();
      const beforeStamp = String(body.beforeStamp || "").trim();
      if (!title || !workReason || !entityName || !stationId || !beforeStamp) {
        return Response.json({ error: "Missing title, workReason, entityName, stationId, or beforeStamp" }, { status: 400 });
      }
      // No silent default: an unstated place would decide the sun ban for the crew.
      const placeGate = checkProofPlaceGate(body.place);
      if (!placeGate.ok) {
        return Response.json({ error: placeGate.error, reason: placeGate.reason, reasonEn: placeGate.reasonEn, gate: placeGate }, { status: 422 });
      }
      // Opening the record is refused inside the window; a span that already ran
      // through it is recorded and flagged at end instead.
      const heatGate = checkProofHeatBanGate({ place: placeGate.place, now: new Date() });
      if (!heatGate.ok) {
        return Response.json({ error: heatGate.error, reason: heatGate.reason, reasonEn: heatGate.reasonEn, gate: heatGate }, { status: 422 });
      }
      const geoVerdict = String(body.geoVerdict || "in").toLowerCase().startsWith("out") ? "out" : "in";
      const ref = String(body.ref || `WP-${Date.now().toString().slice(-6)}`);
      const proof: WorkProofLike & { companyId: string; createdAt: string; beforeUrl?: string; afterUrl?: string } = {
        id: uid("wp"),
        companyId: auth.companyId,
        ref,
        title,
        workReason,
        entityKind: String(body.entityKind || "company").trim() || "company",
        entityScope: "external",
        entityStationId: null,
        entityName,
        entityUnified: String(body.entityUnified || "").trim() || null,
        entityCr: String(body.entityCr || "").trim() || null,
        entityQiwa: String(body.entityQiwa || "").trim() || null,
        entitySite: String(body.entitySite || "").trim() || null,
        entityProject: String(body.entityProject || "").trim() || null,
        entityContact: String(body.entityContact || "").trim() || null,
        entityPhone: String(body.entityPhone || "").trim() || null,
        entityEmail: String(body.entityEmail || "").trim() || null,
        personName: String(body.personName || "").trim() || null,
        personId: String(body.personId || "").trim() || null,
        personTitle: String(body.personTitle || "").trim() || null,
        personPhone: String(body.personPhone || "").trim() || null,
        people: Array.isArray(body.people) ? body.people : [],
        startedAt: body.startedAt || new Date().toISOString(),
        endedAt: null,
        vehicle: body.vehicle && typeof body.vehicle === "object" ? body.vehicle : {},
        vehicles: Array.isArray(body.vehicles) ? body.vehicles : [],
        client,
        stationId,
        place: placeGate.place,
        techId: body.techId ? String(body.techId) : auth.userId,
        raiserId: auth.userId,
        raiserName: auth.name || null,
        beforeStamp,
        afterStamp: null,
        beforeUrl: body.beforeUrl || null,
        afterUrl: null,
        attachments: Array.isArray(body.attachments)
          ? body.attachments.filter((f: any) => f && (f.url || f.name)).slice(0, 20).map((f: any) => ({
            id: String(f.id || uid("att")),
            url: String(f.url || ""),
            name: String(f.name || "file"),
            type: String(f.type || ""),
            createdAt: f.createdAt || new Date().toISOString(),
            updatedAt: f.updatedAt || f.createdAt || new Date().toISOString(),
          }))
          : [],
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
      proof.auditTrail = appendWorkProofAudit(proof, "raise", { id: auth.userId, name: auth.name }, { at: proof.createdAt });
      const proofs = await listProofs();
      proofs.unshift(proof);
      await saveProofs(proofs);
      await audit("work_proof_raised", `Work proof ${ref} raised for ${client}`);
      return Response.json({ proof: { ...proof, stage: deriveProofStage(proof) }, ok: true });
    }

    if (action === "attachAfter" || action === "end") {
      const id = String(body.id || body.ref || "").trim();
      const afterStamp = String(body.afterStamp || "").trim();
      const afterUrl = body.afterUrl || null;
      if (!id || !afterStamp || !afterUrl) return Response.json({ error: "Missing id/ref, afterStamp, or afterUrl" }, { status: 400 });
      const proofs = await listProofs();
      const idx = proofs.findIndex((p) => p.id === id || p.ref === id);
      if (idx < 0) return Response.json({ error: "PROOF_NOT_FOUND" }, { status: 404 });
      const p = { ...proofs[idx] };
      const sameBranch = isSameProofBranch(auth.stationId, p.stationId);
      const gate = checkEndWorkProofGate({ proof: p, actorUserId: auth.userId, sameBranch, isManager });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, gate }, { status: 422 });
      }
      p.endedAt = body.endedAt || new Date().toISOString();
      p.afterStamp = afterStamp;
      (p as any).afterUrl = afterUrl;
      (p as any).endedById = auth.userId;
      (p as any).endedBy = auth.name;
      p.status = "ready";
      p.sealId = null;
      p.approvedAt = null;
      p.auditTrail = appendWorkProofAudit(p, "end", { id: auth.userId, name: auth.name });
      stampProofHeatBan(p, { id: auth.userId, name: auth.name });
      const approve = checkApproveWorkProofGate({
        proof: p,
        actorUserId: auth.userId,
        geoClearReason: body.geoClearReason || "إنهاء العمل بصورة البعد",
      });
      if (approve.ok) {
        if (String(p.geoVerdict || "").toLowerCase().startsWith("out")) {
          p.geoCleared = true;
          p.geoClearReason = String(body.geoClearReason || "إنهاء العمل بصورة البعد").trim();
        }
        p.approvedBy = auth.name;
        p.approvedAt = new Date().toISOString();
        p.sealId = approve.sealId;
        p.status = "sealed";
        Object.assign(p, applyWorkProofArchive(p, p.approvedAt));
      }
      proofs[idx] = p;
      await saveProofs(proofs);
      await audit(
        p.status === "sealed" ? "work_proof_ended_sealed" : "work_proof_ended",
        `Work proof ${p.ref} ended by ${auth.name}${p.sealId ? ` sealed ${p.sealId}` : ""}`,
      );
      return Response.json({ proof: { ...p, stage: deriveProofStage(p) }, ok: true });
    }

    if (action === "edit") {
      const id = String(body.id || body.ref || "").trim();
      const proofs = await listProofs();
      const idx = proofs.findIndex((p) => p.id === id || p.ref === id);
      if (idx < 0) return Response.json({ error: "PROOF_NOT_FOUND" }, { status: 404 });
      const current = proofs[idx];
      const sameBranch = isSameProofBranch(auth.stationId, current.stationId);
      const gate = checkEditWorkProofGate({ proof: current, actorUserId: auth.userId, sameBranch, isManager });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, gate }, { status: 422 });
      }
      const title = String(body.title || "").trim();
      const workReason = String(body.workReason || "").trim();
      const entityName = String(body.entityName || body.client || "").trim();
      if (!title || !workReason || !entityName) {
        return Response.json({ error: "MISSING_FIELDS", reason: "الوصف وسبب العمل واسم المستفيد مطلوبة." }, { status: 400 });
      }
      // The place travels with the record: an edit may correct it, never blank it.
      const editPlace = checkProofPlaceGate(body.place ?? current.place);
      if (!editPlace.ok) {
        return Response.json({ error: editPlace.error, reason: editPlace.reason, reasonEn: editPlace.reasonEn, gate: editPlace }, { status: 422 });
      }
      const p = {
        ...current,
        place: editPlace.place,
        title,
        workReason,
        entityKind: String(body.entityKind || current.entityKind || "company").trim(),
        entityName,
        entityUnified: String(body.entityUnified ?? (current as any).entityUnified ?? "").trim() || null,
        entityCr: String(body.entityCr ?? (current as any).entityCr ?? "").trim() || null,
        entityQiwa: String(body.entityQiwa ?? (current as any).entityQiwa ?? "").trim() || null,
        entitySite: String(body.entitySite ?? (current as any).entitySite ?? "").trim() || null,
        entityProject: String(body.entityProject ?? (current as any).entityProject ?? "").trim() || null,
        entityContact: String(body.entityContact ?? (current as any).entityContact ?? "").trim() || null,
        entityPhone: String(body.entityPhone ?? (current as any).entityPhone ?? "").trim() || null,
        entityEmail: String(body.entityEmail ?? (current as any).entityEmail ?? "").trim() || null,
        personName: String(body.personName ?? (current as any).personName ?? "").trim() || null,
        personId: String(body.personId ?? (current as any).personId ?? "").trim() || null,
        personTitle: String(body.personTitle ?? (current as any).personTitle ?? "").trim() || null,
        personPhone: String(body.personPhone ?? (current as any).personPhone ?? "").trim() || null,
        people: Array.isArray(body.people) ? body.people : ((current as any).people || []),
        startedAt: body.startedAt || (current as any).startedAt || null,
        vehicle: body.vehicle && typeof body.vehicle === "object" ? body.vehicle : (current as any).vehicle,
        vehicles: Array.isArray(body.vehicles) ? body.vehicles : ((current as any).vehicles || []),
        client: String(body.client || body.entityContact || entityName).trim(),
        stationId: String(body.stationId || current.stationId || "").trim(),
        entityScope: "external",
        entityStationId: null,
        geoVerdict: String(body.geoVerdict || current.geoVerdict || "in").toLowerCase().startsWith("out") ? "out" : "in",
        editedAt: new Date().toISOString(),
        editedBy: auth.name,
        editedById: auth.userId,
        auditTrail: appendWorkProofAudit(current, "edit", { id: auth.userId, name: auth.name }),
      };
      proofs[idx] = p;
      await saveProofs(proofs);
      await audit("work_proof_edited", `Work proof ${p.ref} edited by ${auth.name}`);
      return Response.json({ proof: { ...p, stage: deriveProofStage(p) }, ok: true });
    }

    if (action === "approve") {
      const id = String(body.id || body.ref || "").trim();
      const proofs = await listProofs();
      const idx = proofs.findIndex((p) => p.id === id || p.ref === id);
      if (idx < 0) return Response.json({ error: "PROOF_NOT_FOUND" }, { status: 404 });
      let p = { ...proofs[idx] };
      if (!isManager && !isSameProofBranch(auth.stationId, p.stationId)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const gate = checkApproveWorkProofGate({
        proof: p,
        actorUserId: auth.userId,
        geoClearReason: body.geoClearReason,
      });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, gate }, { status: 422 });
      }
      if (isOutsideNeedsClear(p) && body.geoClearReason) {
        p.geoCleared = true;
        p.geoClearReason = String(body.geoClearReason).trim();
      }
      p.approvedBy = auth.name;
      p.approvedAt = new Date().toISOString();
      p.sealId = gate.sealId;
      p.status = "sealed";
      Object.assign(p, applyWorkProofArchive(p, p.approvedAt));
      const hasEnd = (Array.isArray(p.auditTrail) ? p.auditTrail : []).some((event) => event.type === "end" || event.type === "seal");
      if (!hasEnd) p.auditTrail = appendWorkProofAudit(p, "end", { id: auth.userId, name: auth.name });
      stampProofHeatBan(p, { id: auth.userId, name: auth.name });
      proofs[idx] = p;
      await saveProofs(proofs);
      await audit("work_proof_sealed", `Work proof ${p.ref} sealed ${p.sealId}`);
      return Response.json({ proof: { ...p, stage: deriveProofStage(p) }, ok: true });
    }

    if (action === "reject") {
      const id = String(body.id || body.ref || "").trim();
      const reason = String(body.reason || "").trim();
      const proofs = await listProofs();
      const idx = proofs.findIndex((p) => p.id === id || p.ref === id);
      if (idx < 0) return Response.json({ error: "PROOF_NOT_FOUND" }, { status: 404 });
      const p = { ...proofs[idx] };
      if (!isManager && !isSameProofBranch(auth.stationId, p.stationId)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      if (auth.userId && p.raiserId && String(auth.userId) === String(p.raiserId)) {
        return Response.json({
          error: "SELF_APPROVE_FORBIDDEN",
          reason: "من رفع الإثبات لا يرفضه كمعتمد.",
        }, { status: 422 });
      }
      p.status = "rejected";
      (p as any).rejectReason = reason || null;
      (p as any).rejectedBy = auth.name;
      (p as any).rejectedById = auth.userId;
      (p as any).rejectedAt = new Date().toISOString();
      p.sealId = null;
      p.approvedAt = null;
      Object.assign(p, applyWorkProofArchive(p, (p as any).rejectedAt));
      p.auditTrail = appendWorkProofAudit(p, "reject", { id: auth.userId, name: auth.name }, { detail: reason || "" });
      proofs[idx] = p;
      await saveProofs(proofs);
      await audit("work_proof_rejected", `Work proof ${p.ref} rejected`, { reason });
      return Response.json({ proof: { ...p, stage: deriveProofStage(p) }, ok: true });
    }

    if (action === "accept") {
      const id = String(body.id || body.ref || "").trim();
      const proofs = await listProofs();
      const idx = proofs.findIndex((p) => p.id === id || p.ref === id);
      if (idx < 0) return Response.json({ error: "PROOF_NOT_FOUND" }, { status: 404 });
      const p = { ...proofs[idx] };
      const gate = checkAcceptGate(p);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, gate }, { status: 422 });
      }
      p.acceptedAt = new Date().toISOString();
      p.status = "accepted";
      p.sealId = gate.sealId;
      Object.assign(p, applyWorkProofArchive(p, p.acceptedAt));
      proofs[idx] = p;
      await saveProofs(proofs);
      await audit("work_proof_accepted", `Work proof ${p.ref} accepted by client`);
      return Response.json({ proof: { ...p, stage: deriveProofStage(p) }, ok: true });
    }

    if (action === "checkApprove") {
      const id = String(body.id || body.ref || "").trim();
      const proofs = await listProofs();
      const proof = proofs.find((p) => p.id === id || p.ref === id) || null;
      return Response.json(checkApproveWorkProofGate({ proof, actorUserId: auth.userId, geoClearReason: body.geoClearReason }));
    }

    if (action === "addAttachment") {
      const id = String(body.id || body.ref || "").trim();
      const url = String(body.url || "").trim();
      const name = String(body.name || "file").trim() || "file";
      if (!id || !url) return Response.json({ error: "FILE_REQUIRED", reason: "أرفق مستندًا أولًا." }, { status: 400 });
      const proofs = await listProofs();
      const idx = proofs.findIndex((p) => p.id === id || p.ref === id);
      if (idx < 0) return Response.json({ error: "PROOF_NOT_FOUND" }, { status: 404 });
      const p = { ...proofs[idx] } as WorkProofLike & { attachments?: any[]; attachmentsUpdatedAt?: string };
      const sameBranch = isSameProofBranch(auth.stationId, p.stationId);
      const isRaiser = !!(auth.userId && p.raiserId && String(auth.userId) === String(p.raiserId));
      const stage = deriveProofStage(p);
      if (stage === "sealed" || stage === "accepted" || stage === "rejected") {
        return Response.json({ error: "PROOF_CLOSED", reason: "البطاقة مكتملة — لا يُضاف مستند." }, { status: 422 });
      }
      if (!isRaiser && !isManager && !sameBranch) {
        return Response.json({ error: "FORBIDDEN", reason: "إرفاق المستند لفرع العمل أو للرافع." }, { status: 403 });
      }
      const at = new Date().toISOString();
      const current = Array.isArray(p.attachments) ? p.attachments : [];
      const replaceId = String(body.replaceId || "").trim();
      const entry = {
        id: replaceId || uid("att"),
        url,
        name,
        type: String(body.type || ""),
        createdAt: at,
        updatedAt: at,
      };
      p.attachments = replaceId
        ? current.map((item: any, index: number) => (
          String(item?.id) === replaceId || String(index) === replaceId
            ? { ...item, ...entry, id: item?.id || entry.id, createdAt: item?.createdAt || at }
            : item
        ))
        : [...current, entry];
      p.attachmentsUpdatedAt = at;
      p.auditTrail = appendWorkProofAudit(p, "attach", { id: auth.userId, name: auth.name }, { detail: name });
      proofs[idx] = p;
      await saveProofs(proofs);
      await audit("work_proof_attach", `Document on ${p.ref} by ${auth.name}: ${name}`);
      return Response.json({ proof: { ...p, stage: deriveProofStage(p) }, ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("workproof error:", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});

function isOutsideNeedsClear(p: WorkProofLike) {
  const v = String(p.geoVerdict || "in").toLowerCase();
  return (v === "out" || v.includes("outside")) && !p.geoCleared;
}

/**
 * A worked span that overlapped the sun-ban window is stamped on the record and
 * on the trail at closing — never refused. Refusing the record would erase the
 * only evidence that the crew was under the sun.
 */
function stampProofHeatBan(p: WorkProofLike, actor: { id?: string | null; name?: string | null }) {
  const flag = deriveProofHeatBanFlag(p);
  if (!flag) return;
  p.heatBanFlag = flag;
  const trail = Array.isArray(p.auditTrail) ? p.auditTrail : [];
  if (trail.some((event) => event.type === "heat_ban")) return;
  p.auditTrail = appendWorkProofAudit(p, "heat_ban", actor, { detail: flag.textAr });
}
