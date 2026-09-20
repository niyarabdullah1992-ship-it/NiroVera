/**
 * Assets & custody when the `assets` cloud function is down (local preview).
 */
import { getCompanyData, getSession, updateCompany } from "@/lib/store";
import { assetRights, checkAssetWriteGate, visibleAssetsFor } from "@/lib/assetRights";
import { logAudit } from "@/lib/auditLog";
import { notifyMoneyMany, notifyMoneyReviewers, stationManagerIds } from "@/lib/moneyNotifications";

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function actor(companyId) {
  const session = getSession();
  const data = getCompanyData(companyId);
  const user = (data?.employees || []).find((e) => e.id === session?.userId);
  // An actor the register does not know is nobody in particular: it must not fall back
  // to the id "owner" (which would match a company whose ownerId is that literal) and
  // it must not sign Arabic records with a Latin word.
  return {
    id: user?.id || session?.userId || "",
    name: user?.name || "مستخدم غير معروف",
    user: user || null,
  };
}

function fail(message, extra = {}) {
  const error = new Error(message);
  error.response = { data: { error: extra.error || message, reason: extra.reason, reasonEn: extra.reasonEn } };
  throw error;
}

function gateOrFail(gate) {
  if (gate.ok) return;
  fail(gate.reason, gate);
}

function rightsFor(companyId, who) {
  const data = getCompanyData(companyId);
  const known = !!who.id && data?.ownerId === who.id;
  const user = who.user || (known ? { id: who.id, role: "owner" } : { id: who.id, role: "employee" });
  return assetRights(user, data);
}

function findAsset(companyId, assetId) {
  const data = getCompanyData(companyId);
  return (data?.assets || []).find((row) => row.id === assetId) || null;
}

/**
 * Who has to hear about a custody or accountability event on this asset: the holder,
 * the branch it sits in and the branch that bought it — because the book cost stays
 * on the buyer even after the asset moves.
 */
function assetAudience(data, asset, extra = []) {
  return [
    asset?.holderId,
    ...extra,
    ...stationManagerIds(data, asset?.stationId),
    ...stationManagerIds(data, asset?.originStationId),
  ].filter(Boolean);
}

function ensureLedger(data) {
  if (!Array.isArray(data.assets)) data.assets = [];
  if (!Array.isArray(data.assetCustody)) data.assetCustody = [];
  if (!Array.isArray(data.assetMaintenance)) data.assetMaintenance = [];
  if (!Array.isArray(data.assetTransfers)) data.assetTransfers = [];
  return data;
}

export function localAssetsCall(session, action, payload = {}) {
  const companyId = session?.companyId;
  if (!companyId) fail("Missing companyId");
  const who = actor(companyId);
  const rights = rightsFor(companyId, who);

  if (action === "list") {
    const current = getCompanyData(companyId);
    if (!current) return { assets: [], custody: [], maintenance: [] };
    if (!Array.isArray(current.assets) || !Array.isArray(current.assetCustody) || !Array.isArray(current.assetMaintenance)) {
      updateCompany(companyId, (data) => { if (data) ensureLedger(data); });
    }
    const data = getCompanyData(companyId) || {};
    ensureLedger(data);
    const assets = visibleAssetsFor(rights, data.assets);
    const ids = new Set(assets.map((row) => row.id));
    return {
      assets,
      custody: data.assetCustody.filter((row) => ids.has(row.assetId)),
      maintenance: data.assetMaintenance.filter((row) => ids.has(row.assetId)),
      canManageRegister: rights.canCreate,
      canDeleteAsset: rights.canDelete,
    };
  }

  if (action === "saveAsset") {
    const incoming = { ...(payload.asset || {}) };
    if (!String(incoming.name || "").trim() || !String(incoming.assetCode || incoming.qrCode || "").trim()) {
      fail("اسم الأصل ورقمه مطلوبان.");
    }
    const target = payload.assetId ? findAsset(companyId, payload.assetId) : { stationId: incoming.stationId };
    gateOrFail(checkAssetWriteGate(rights, target, "save"));
    // A manager cannot push a row into a station outside their reach. This only
    // applies when the station actually changes — an asset the branch bought stays
    // on its book after a transfer, and editing that row in place is not a move.
    const moving = payload.assetId && String(incoming.stationId || "") !== String(target?.stationId || "");
    if (moving) gateOrFail(checkAssetWriteGate(rights, { stationId: incoming.stationId }, "save"));
    if (!incoming.holderId) {
      incoming.holderId = who.id;
      incoming.holderName = who.name;
    }
    let saved = null;
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      if (payload.assetId) {
        const index = data.assets.findIndex((row) => row.id === payload.assetId);
        if (index < 0) fail("NotFound");
        saved = {
          ...data.assets[index],
          ...incoming,
          id: payload.assetId,
          companyId,
          originStationId: incoming.originStationId || data.assets[index].originStationId || incoming.stationId,
        };
        data.assets[index] = saved;
        return;
      }
      saved = {
        ...incoming,
        id: uid("ast"),
        companyId,
        assetCode: incoming.assetCode,
        qrCode: incoming.qrCode || `AST-${Date.now().toString(36).toUpperCase()}`,
        status: incoming.status || "available",
        originStationId: incoming.originStationId || incoming.stationId,
      };
      data.assets.unshift(saved);
      data.assetCustody.unshift({
        id: uid("cst"),
        companyId,
        assetId: saved.id,
        fromId: null,
        fromName: "—",
        toId: saved.holderId,
        toName: saved.holderName || "—",
        stationId: saved.stationId || null,
        handedAt: new Date().toISOString(),
        condition: incoming.condition || "",
        notes: "initial",
      });
    });
    return { asset: saved };
  }

  if (action === "handover") {
    const { assetId, toId, toName, condition, imageUrls, fromSignatureUrl, toSignatureUrl, notes } = payload;
    gateOrFail(checkAssetWriteGate(rights, findAsset(companyId, assetId), "handover"));
    if (!fromSignatureUrl || !toSignatureUrl) {
      fail("التسليم يتطلب توقيع الطرفين.", {
        error: "SignaturesRequired",
        reason: "التسليم يتطلب توقيع الطرفين.",
        reasonEn: "A handover needs both signatures.",
      });
    }
    let updated = null;
    let record = null;
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const asset = data.assets.find((row) => row.id === assetId);
      if (!asset) fail("NotFound");
      record = {
        id: uid("cst"),
        companyId,
        assetId,
        fromId: asset.holderId || null,
        fromName: asset.holderName || "—",
        toId,
        toName,
        stationId: asset.stationId || null,
        handedAt: new Date().toISOString(),
        condition: condition || "",
        imageUrls: imageUrls || [],
        fromSignatureUrl,
        toSignatureUrl,
        notes: notes || "",
      };
      data.assetCustody.unshift(record);
      asset.holderId = toId;
      asset.holderName = toName;
      asset.status = "in_custody";
      updated = { ...asset };
    });
    if (updated && record) {
      // Custody is an accountability event — the holder changes and offboarding is
      // gated on it — so it is announced, and the announcement names the condition
      // the two parties signed off on.
      const data = getCompanyData(companyId);
      notifyMoneyMany(companyId, assetAudience(data, updated, [record.fromId, record.toId]), {
        ar: `سُلّمت عهدة الأصل «${updated.name}» من ${record.fromName || "—"} إلى ${record.toName || "—"} — ${record.condition || record.notes || "بلا ملاحظة على الحالة"}`,
        en: `Custody of asset «${updated.name}» passed from ${record.fromName || "—"} to ${record.toName || "—"} — ${record.condition || record.notes || "no condition note"}`,
        to: "/app/assets",
        key: `ast-handover-${record.id}`,
      });
    }
    return { asset: updated, custody: record };
  }

  if (action === "logMaintenance") {
    gateOrFail(checkAssetWriteGate(rights, findAsset(companyId, payload.assetId), "maintenance"));
    let record = null;
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      record = { id: uid("mnt"), ...(payload.maintenance || {}), companyId, assetId: payload.assetId };
      data.assetMaintenance.unshift(record);
      const asset = data.assets.find((row) => row.id === payload.assetId);
      if (asset) {
        if (payload.nextInspectionDate) asset.nextInspectionDate = payload.nextInspectionDate;
        if (payload.status) asset.status = payload.status;
      }
    });
    return { maintenance: record };
  }

  if (action === "setStatus") {
    gateOrFail(checkAssetWriteGate(rights, findAsset(companyId, payload.assetId), "status"));
    let updated = null;
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const asset = data.assets.find((row) => row.id === payload.assetId);
      if (!asset) fail("NotFound");
      asset.status = payload.status;
      if (payload.status === "lost") {
        // A second report is a second case, not an edit of the first: the closed one
        // is filed before the new one takes its place, so no decision ever disappears.
        const previous = asset.lostCase && typeof asset.lostCase === "object" ? asset.lostCase : null;
        if (previous?.closedAt) {
          asset.lostHistory = [previous, ...(Array.isArray(asset.lostHistory) ? asset.lostHistory : [])];
        }
        asset.lostCase = {
          openedAt: new Date().toISOString(),
          openedBy: who.name,
          openedById: who.id,
          reason: payload.reason || "",
        };
      }
      updated = { ...asset };
    });
    if (updated?.status === "lost") {
      const data = getCompanyData(companyId);
      notifyMoneyMany(companyId, assetAudience(data, updated), {
        ar: `فُتح بلاغ فقدان الأصل «${updated.name}» — ${updated.lostCase?.reason || "بلا سبب مكتوب"}`,
        en: `A loss report was opened on asset «${updated.name}» — ${updated.lostCase?.reason || "no reason written"}`,
        to: "/app/assets",
        key: `ast-lost-open-${updated.id}-${updated.lostCase?.openedAt || ""}`,
      });
      notifyMoneyReviewers(companyId, {
        ar: `فُتح بلاغ فقدان الأصل «${updated.name}» — ${updated.lostCase?.reason || "بلا سبب مكتوب"}`,
        en: `A loss report was opened on asset «${updated.name}» — ${updated.lostCase?.reason || "no reason written"}`,
        to: "/app/assets",
        key: `ast-lost-open-${updated.id}-${updated.lostCase?.openedAt || ""}`,
      });
    }
    return { asset: updated };
  }

  if (action === "resolveLost") {
    gateOrFail(checkAssetWriteGate(rights, findAsset(companyId, payload.assetId), "resolve"));
    let updated = null;
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const asset = data.assets.find((row) => row.id === payload.assetId);
      if (!asset) fail("NotFound");
      asset.status = payload.decision === "charged" ? "retired" : "available";
      // Two reasons, never one: the loss itself is why the case was opened, and the
      // decision carries its own. The stored case is the authority — the caller's copy
      // of it is not trusted, because an empty one would wipe the opening reason and
      // with it the only record of why the asset was declared lost.
      const opened = asset.lostCase && typeof asset.lostCase === "object" ? asset.lostCase : {};
      asset.lostCase = {
        ...opened,
        closedAt: new Date().toISOString(),
        closedBy: who.name,
        closedById: who.id,
        decision: payload.decision,
        decisionReason: payload.reason || "",
      };
      updated = { ...asset };
    });
    if (updated) {
      const data = getCompanyData(companyId);
      const charged = updated.lostCase?.decision === "charged";
      const notice = {
        ar: charged
          ? `أُغلق بلاغ فقدان الأصل «${updated.name}» بالتحميل والشطب — ${updated.lostCase?.decisionReason || "بلا سبب مكتوب"}`
          : `أُغلق بلاغ فقدان الأصل «${updated.name}» بالعثور عليه — ${updated.lostCase?.decisionReason || "بلا سبب مكتوب"}`,
        en: charged
          ? `The loss case on asset «${updated.name}» closed as charged / written off — ${updated.lostCase?.decisionReason || "no reason written"}`
          : `The loss case on asset «${updated.name}» closed as found — ${updated.lostCase?.decisionReason || "no reason written"}`,
        to: "/app/assets",
        key: `ast-lost-close-${updated.id}-${updated.lostCase?.closedAt || ""}`,
      };
      notifyMoneyMany(companyId, assetAudience(data, updated, [updated.lostCase?.openedById]), notice);
      notifyMoneyReviewers(companyId, notice);
    }
    return { asset: updated };
  }

  if (action === "deleteAsset") {
    const target = findAsset(companyId, payload.assetId);
    const ledger = getCompanyData(companyId);
    gateOrFail(checkAssetWriteGate(rights, target, "delete", {
      custody: ledger?.assetCustody || [],
      maintenance: ledger?.assetMaintenance || [],
    }));
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      data.assets = data.assets.filter((row) => row.id !== payload.assetId);
      data.assetCustody = data.assetCustody.filter((row) => row.assetId !== payload.assetId);
    });
    // A register row leaves by name, not by id, so the trail stays readable.
    logAudit(companyId, "asset_deleted", who.name,
      `حُذف الأصل «${target?.name || payload.assetId}» (${target?.assetCode || "—"}) قبل أن يكون له سجل عهدة.`);
    return { ok: true };
  }

  fail("UnknownAction");
  return { ok: false };
}
