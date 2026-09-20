import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";

// Assets & custody: every asset has exactly one holder, and every transfer is
// signed by both sides. All writes are authorized by the active company session.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const companyId = body.companyId;
    const auth = await authPowerCareSession(base44, companyId, body.sessionToken);
    if (!auth || !companyId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const svc = base44.asServiceRole.entities;
    const actor = { id: auth.userId || "owner", name: auth.name || "—" };

    // Authorization. src/lib/assetRights.js mirrors these rules for the local
    // fallback — neither layer may be more permissive than the other.
    const senior = !!auth.owner || !!auth.admin || ["owner", "director", "ops_manager", "admin"].includes(auth.role);
    const stationManager = !senior && ["station_manager", "pgm"].includes(auth.role);
    const readAll = senior || auth.role === "financial_officer";
    const reach = new Set([auth.stationId, ...(auth.managedStations || [])].map((id) => String(id || "")).filter(Boolean));
    const inReach = (stationId?: string | null) => senior || !stationId || reach.has(String(stationId));
    const holds = (asset) => !!asset && String(asset?.holderId || "") === String(actor.id);
    // A transferred asset sits in one branch but stays on the buying branch's book,
    // so both branches keep authority over it.
    const reachesAsset = (asset) =>
      inReach(asset?.stationId) || (!!asset?.originStationId && inReach(asset.originStationId));
    const deny = (error: string, reason: string, reasonEn: string) =>
      Response.json({ error, reason, reasonEn }, { status: 403 });

    const registerGate = (asset, kind: "save" | "status" | "resolve") => {
      if (senior) return null;
      if (!stationManager) {
        if (kind === "status") return deny("ASSET_LOST_DENIED", "فتح بلاغ الفقدان لمدير الفرع المالك أو الإدارة.", "Opening a loss report is for the owning station manager or management.");
        if (kind === "resolve") return deny("ASSET_LOST_DECISION_DENIED", "إغلاق بلاغ الفقدان لمدير الفرع المالك أو الإدارة.", "Closing a loss case is for the owning station manager or management.");
        return deny("ASSET_REGISTER_DENIED", "تعديل سجل الأصول لمدير الفرع المالك أو الإدارة.", "Editing the asset register is for the owning station manager or management.");
      }
      if (!reachesAsset(asset)) return deny("ASSET_OUT_OF_REACH", "هذا الأصل في فرع خارج نطاقك.", "This asset sits in a station outside your scope.");
      return null;
    };
    const custodyGate = (asset, kind: "handover" | "maintenance") => {
      if (senior || holds(asset) || (stationManager && inReach(asset?.stationId))) return null;
      return kind === "handover"
        ? deny("ASSET_HANDOVER_DENIED", "تسليم العهدة لحائز الأصل أو مدير فرعه.", "A handover is for the current holder or their station manager.")
        : deny("ASSET_MAINTENANCE_DENIED", "تسجيل الصيانة لحائز الأصل أو مدير فرعه.", "Logging maintenance is for the current holder or their station manager.");
    };
    const loadAsset = async (assetId: string) => (await svc.Asset.filter({ companyId, id: assetId }))[0] || null;

    // Same words the register screen shows, so the trail reads like the surface.
    const STATUS_AR: Record<string, string> = {
      available: "متاح", in_custody: "في العهدة", inspection: "قيد الفحص",
      maintenance: "تحت الصيانة", lost: "مفقود", retired: "مستبعد",
    };
    const audit = async (action: string, details: string) => {
      const row = await svc.AuditLog.create({ companyId, action, performedBy: actor.name, details });
      return row?.id || null;
    };

    if (body.action === "list") {
      const [all, custody, maintenance] = await Promise.all([
        svc.Asset.filter({ companyId }),
        svc.AssetCustody.filter({ companyId }),
        svc.AssetMaintenance.filter({ companyId }),
      ]);
      const assets = readAll ? all : all.filter((row) => reachesAsset(row) || holds(row));
      const ids = new Set(assets.map((row) => row.id));
      return Response.json({
        assets,
        custody: custody.filter((row) => ids.has(row.assetId)),
        maintenance: maintenance.filter((row) => ids.has(row.assetId)),
        canManageRegister: senior || stationManager,
        canDeleteAsset: senior,
      });
    }

    if (body.action === "saveAsset") {
      const payload = { ...body.asset, companyId };
      const existing = body.assetId ? await loadAsset(body.assetId) : null;
      // The destination check only applies when the station actually changes: an
      // asset the branch bought stays on its book after a transfer, so editing that
      // row while it is parked elsewhere is not a move out of reach.
      const moving = !!body.assetId && String(payload.stationId || "") !== String(existing?.stationId || "");
      const blocked = registerGate(body.assetId ? existing : { stationId: payload.stationId }, "save")
        || (moving ? registerGate({ stationId: payload.stationId }, "save") : null);
      if (blocked) return blocked;
      // Rule 1 — an asset is never without a holder.
      if (!payload.holderId) {
        payload.holderId = actor.id;
        payload.holderName = actor.name;
      }
      let asset;
      if (body.assetId) {
        asset = await svc.Asset.update(body.assetId, payload);
        await audit("asset_updated", `${payload.name} (${payload.assetCode})`);
      } else {
        payload.qrCode = payload.qrCode || `AST-${Date.now().toString(36).toUpperCase()}`;
        asset = await svc.Asset.create(payload);
        await audit("asset_created", `${payload.name} (${payload.assetCode})`);
        await svc.AssetCustody.create({
          companyId, assetId: asset.id, fromId: null, fromName: "—",
          toId: payload.holderId, toName: payload.holderName || "—",
          stationId: payload.stationId || null, handedAt: new Date().toISOString(),
          condition: body.asset?.condition || "", notes: "initial",
        });
      }
      return Response.json({ asset });
    }

    if (body.action === "handover") {
      const { assetId, toId, toName, condition, imageUrls, fromSignatureUrl, toSignatureUrl, notes } = body;
      const asset = await loadAsset(assetId);
      if (!asset) return Response.json({ error: "NotFound" }, { status: 404 });
      const blocked = custodyGate(asset, "handover");
      if (blocked) return blocked;
      // Rule 2 — a handover is valid only when both parties signed.
      if (!fromSignatureUrl || !toSignatureUrl) {
        return Response.json({
          error: "SignaturesRequired",
          reason: "التسليم يتطلب توقيع الطرفين.",
          reasonEn: "A handover needs both signatures.",
        }, { status: 400 });
      }

      const auditRef = await audit("asset_handover", `${asset.name} (${asset.assetCode}): ${asset.holderName || "—"} → ${toName}`);
      const record = await svc.AssetCustody.create({
        companyId, assetId, fromId: asset.holderId || null, fromName: asset.holderName || "—",
        toId, toName, stationId: asset.stationId || null, handedAt: new Date().toISOString(),
        condition: condition || "", imageUrls: imageUrls || [],
        fromSignatureUrl, toSignatureUrl, auditRef, notes: notes || "",
      });
      const updated = await svc.Asset.update(assetId, { holderId: toId, holderName: toName, status: "in_custody" });
      return Response.json({ asset: updated, custody: record });
    }

    if (body.action === "logMaintenance") {
      const target = await loadAsset(body.assetId);
      const blocked = custodyGate(target, "maintenance");
      if (blocked) return blocked;
      const record = await svc.AssetMaintenance.create({ ...body.maintenance, companyId, assetId: body.assetId });
      if (body.nextInspectionDate || body.status) {
        await svc.Asset.update(body.assetId, {
          ...(body.nextInspectionDate ? { nextInspectionDate: body.nextInspectionDate } : {}),
          ...(body.status ? { status: body.status } : {}),
        });
      }
      await audit("asset_maintenance", `صيانة على «${target?.name || body.assetId}» (${target?.assetCode || "—"}): ${body.maintenance?.type || "بلا نوع مكتوب"}`);
      return Response.json({ maintenance: record });
    }

    if (body.action === "setStatus") {
      const target = await loadAsset(body.assetId);
      const blocked = registerGate(target, "status");
      if (blocked) return blocked;
      // Rule 5 — a lost asset opens an investigation closed only by a documented decision.
      const patch: Record<string, unknown> = { status: body.status };
      if (body.status === "lost") {
        // A second report is a second case, not an edit of the first: the closed one
        // is filed before the new one takes its place, so no decision ever disappears.
        const previous = target?.lostCase && typeof target.lostCase === "object" ? target.lostCase : null;
        if (previous?.closedAt) {
          patch.lostHistory = [previous, ...(Array.isArray(target?.lostHistory) ? target.lostHistory : [])];
        }
        patch.lostCase = { openedAt: new Date().toISOString(), openedBy: actor.name, openedById: actor.id, reason: body.reason || "" };
      }
      const updated = await svc.Asset.update(body.assetId, patch);
      await audit("asset_status", `«${target?.name || body.assetId}» (${target?.assetCode || "—"}) → ${STATUS_AR[body.status] || body.status}${body.reason ? ` — ${body.reason}` : ""}`);
      return Response.json({ asset: updated });
    }

    if (body.action === "resolveLost") {
      const existing = await loadAsset(body.assetId);
      const blocked = registerGate(existing, "resolve");
      if (blocked) return blocked;
      const auditRef = await audit(
        "asset_lost_resolved",
        `أُغلق بلاغ فقدان «${existing?.name || body.assetId}» (${existing?.assetCode || "—"}) — ${body.decision === "charged" ? "تحميل وشطب" : "عُثر عليه"}: ${body.reason || "بلا سبب مكتوب"}. سبب فتح البلاغ: ${existing?.lostCase?.reason || "بلا سبب مكتوب"}`,
      );
      // Two reasons, never one: the loss itself is why the case was opened, and the
      // decision carries its own. The stored case is the authority — the caller's copy
      // of it is not trusted, because an empty one would wipe the opening reason and
      // with it the only record of why the asset was declared lost.
      const opened = existing?.lostCase && typeof existing.lostCase === "object" ? existing.lostCase : {};
      const updated = await svc.Asset.update(body.assetId, {
        status: body.decision === "charged" ? "retired" : "available",
        lostCase: { ...opened, closedAt: new Date().toISOString(), closedBy: actor.name, closedById: actor.id, decision: body.decision, decisionReason: body.reason || "", auditRef },
      });
      return Response.json({ asset: updated });
    }

    if (body.action === "deleteAsset") {
      if (!senior) return deny("ASSET_DELETE_DENIED", "حذف أصل من السجل للإدارة العليا فقط.", "Deleting a register row is for senior management only.");
      const target = await loadAsset(body.assetId);
      if (!target) return Response.json({ error: "NotFound" }, { status: 404 });
      // An asset that was handed over, serviced or reported lost carries accountability
      // history; deleting the register row would take that history down with it. Only a
      // row that never left the register — a data-entry mistake — may be deleted.
      const [custody, maintenance] = await Promise.all([
        svc.AssetCustody.filter({ companyId, assetId: body.assetId }),
        svc.AssetMaintenance.filter({ companyId, assetId: body.assetId }),
      ]);
      const handedOver = (custody || []).some((row) => !!row.fromId || row.notes !== "initial");
      if (handedOver || (maintenance || []).length || target.lostCase || (target.lostHistory || []).length) {
        return deny(
          "ASSET_DELETE_HAS_TRAIL",
          "هذا الأصل له سجل عهدة أو صيانة أو بلاغ فقدان — لا يُحذف. أغلقه بالشطب ليبقى تاريخه في السجل.",
          "This asset already carries a custody, maintenance or loss trail — it is not deleted. Retire it so its history stays in the register.",
        );
      }
      await svc.Asset.delete(body.assetId);
      for (const row of custody || []) await svc.AssetCustody.delete(row.id);
      // The row leaves by name, not by id, so the trail stays readable.
      await audit("asset_deleted", `حُذف الأصل «${target.name}» (${target.assetCode || "—"}) قبل أن يكون له سجل عهدة.`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "UnknownAction" }, { status: 400 });
  } catch (error) {
    console.error("assets error", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});