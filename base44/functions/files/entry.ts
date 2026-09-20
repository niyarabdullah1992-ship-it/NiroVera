import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  checkAccessGate,
  checkCreateFolderGate,
  checkMoveFolderGate,
  checkUploadGate,
  deriveArchiveStats,
  deriveRecentFiles,
  deriveVisibleFolders,
  enrichFile,
  enrichFolder,
  inferKind,
  normalizeAccess,
  type ArchiveActor,
  type ArchiveNodeLike,
} from "../../shared/fileArchiveDerivations.ts";

/**
 * do-not-invoke-from-frontend — companyDirectory + store sync the live `files` bag.
 * Leftover callers persist to `files` only. `smartArchive` is read-once fallback.
 */
const FILES_CATEGORY = "files";
const FILES_LEGACY_CATEGORY = "smartArchive"; // do-not-write

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type FilesPayload = {
  nodes: Array<ArchiveNodeLike & { companyId: string }>;
};

function emptyPayload(): FilesPayload {
  return { nodes: [] };
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

    const auth: ArchiveActor & {
      companyId: string;
      userId: string | null;
      name: string;
    } = {
      companyId,
      userId: sessionAuth.userId || null,
      name: sessionAuth.name || "User",
      role: sessionAuth.role || "employee",
      stationId: sessionAuth.stationId || null,
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
      stationIds: Array.isArray(body.stationIds)
        ? body.stationIds.filter((x: unknown) => typeof x === "string")
        : (sessionAuth.stationId ? [sessionAuth.stationId] : []),
    };

    const manageRoles = [
      "owner", "director", "ops_manager", "admin", "pgm", "station_manager", "hr_manager", "hr",
    ];
    const canManage = auth.owner || auth.admin || manageRoles.includes(String(auth.role || ""));

    const loadBlob = async (category = FILES_CATEGORY) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category,
      });
      return rows[0] || null;
    };

    const nodesFromPayload = (raw: unknown) => {
      const rows = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === "object" && Array.isArray((raw as { nodes?: unknown[] }).nodes)
          ? (raw as { nodes: unknown[] }).nodes
          : []);
      return rows.filter(
        (n: ArchiveNodeLike & { companyId?: string }) =>
          n && n.id && n.name && (n.type === "folder" || n.type === "file")
          && (!n.companyId || n.companyId === auth.companyId),
      ) as Array<ArchiveNodeLike & { companyId: string }>;
    };

    const loadPayload = async (): Promise<FilesPayload> => {
      const blob = await loadBlob(FILES_CATEGORY);
      const base = emptyPayload();
      base.nodes = nodesFromPayload(blob?.payload);
      if (!base.nodes.length) {
        const legacy = await loadBlob(FILES_LEGACY_CATEGORY);
        base.nodes = nodesFromPayload(legacy?.payload);
      }
      return base;
    };

    const savePayload = async (payload: FilesPayload) => {
      const nodes = payload.nodes.map((n) => ({ ...n, companyId: n.companyId || auth.companyId }));
      const blob = await loadBlob(FILES_CATEGORY);
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload: nodes });
      else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: FILES_CATEGORY,
          payload: nodes,
        });
      }
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

    const stationScope = String(body.scope || body.stationScope || "all");
    const folderId = body.folderId ? String(body.folderId) : null;

    const enrichBoard = (data: FilesPayload) => {
      const folders = deriveVisibleFolders(data.nodes, auth, {
        stationScope,
        parentId: null,
      });
      const recentFiles = deriveRecentFiles(data.nodes, auth, {
        stationScope,
        folderId,
        limit: 40,
      });
      const stats = deriveArchiveStats(data.nodes, auth, { stationScope });
      return {
        ok: true,
        folders,
        recentFiles,
        stats,
        folderId,
        scope: stationScope,
      };
    };

    if (action === "list") {
      const data = await loadPayload();
      return Response.json(enrichBoard(data));
    }

    if (action === "get") {
      const data = await loadPayload();
      const node = data.nodes.find((n) => n.id === String(body.nodeId || ""));
      const gate = checkAccessGate(auth, data.nodes, node);
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: gate.error === "NODE_NOT_FOUND" ? 404 : 403 });
      }
      const enriched = node!.type === "folder"
        ? enrichFolder(node!, data.nodes, auth)
        : enrichFile(node!, data.nodes, auth);
      return Response.json({ ok: true, node: enriched });
    }

    if (action === "createFolder") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      const gate = checkCreateFolderGate({
        name: body.name,
        access: body.access,
        parentId: body.parentId || null,
        nodes: data.nodes,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: 400 });
      }
      if (body.parentId) {
        const parent = data.nodes.find((n) => n.id === String(body.parentId) && n.type === "folder");
        if (!parent) {
          return Response.json({
            error: "PARENT_NOT_FOUND",
            reason: "المجلد الأب غير موجود.",
            reasonEn: "Parent folder not found.",
          }, { status: 400 });
        }
        const accessGate = checkAccessGate(auth, data.nodes, parent);
        if (!accessGate.ok) {
          return Response.json({
            error: accessGate.error,
            reason: accessGate.reason,
            reasonEn: accessGate.reasonEn,
          }, { status: 403 });
        }
      }
      const nowIso = new Date().toISOString();
      const record: ArchiveNodeLike & { companyId: string } = {
        companyId: auth.companyId,
        id: uid("fold"),
        type: "folder",
        name: gate.name,
        parentId: body.parentId ? String(body.parentId) : null,
        access: gate.access,
        stationId: body.stationId || auth.stationId || null,
        stationName: body.stationName || null,
        companyWide: !!body.companyWide,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      data.nodes = [record, ...data.nodes];
      await savePayload(data);
      await audit("files.createFolder", record.name, { newValue: record.id });
      return Response.json({ ok: true, folder: enrichFolder(record, data.nodes, auth), ...enrichBoard(data) });
    }

    if (action === "moveFolder") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      const id = String(body.nodeId || body.folderId || "");
      const newParentId = body.parentId === undefined || body.parentId === null || body.parentId === ""
        ? null
        : String(body.parentId);
      const gate = checkMoveFolderGate(data.nodes, id, newParentId);
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: gate.error === "FOLDER_CYCLE" ? 400 : 404 });
      }
      const idx = data.nodes.findIndex((n) => n.id === id);
      const before = data.nodes[idx].parentId || null;
      data.nodes[idx] = {
        ...data.nodes[idx],
        parentId: newParentId,
        updatedAt: new Date().toISOString(),
      };
      await savePayload(data);
      await audit("files.moveFolder", id, {
        reason: "MOVE",
        oldValue: String(before),
        newValue: String(newParentId),
      });
      return Response.json(enrichBoard(data));
    }

    if (action === "upload") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      const gate = checkUploadGate({
        name: body.name,
        stationId: body.stationId,
        companyWide: body.companyWide,
        folderId: body.folderId || body.parentId || null,
        nodes: data.nodes,
        actor: auth,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: gate.error === "ACCESS_DENIED_BY_SCOPE" ? 403 : 400 });
      }
      const parentId = body.folderId || body.parentId ? String(body.folderId || body.parentId) : null;
      const nowIso = new Date().toISOString();
      const record: ArchiveNodeLike & { companyId: string } = {
        companyId: auth.companyId,
        id: uid("file"),
        type: "file",
        name: gate.name,
        parentId,
        stationId: gate.companyWide ? "all" : gate.stationId,
        stationName: body.stationName || (gate.companyWide ? "كل الفروع" : null),
        companyWide: gate.companyWide,
        kind: inferKind(gate.name, body.kind),
        sizeBytes: body.sizeBytes != null ? Number(body.sizeBytes) : null,
        url: body.url || null,
        uploadedBy: auth.name,
        access: body.access ? normalizeAccess(body.access) : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      data.nodes = [record, ...data.nodes];
      await savePayload(data);
      await audit("files.upload", record.name, { newValue: record.id });
      return Response.json({ ok: true, file: enrichFile(record, data.nodes, auth), ...enrichBoard(data) });
    }

    if (action === "seedDemo") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      if (data.nodes.length) return Response.json(enrichBoard(data));
      const now = Date.now();
      const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();
      const fContracts = uid("fold");
      const fOps = uid("fold");
      const fCerts = uid("fold");
      const fSafety = uid("fold");
      const fDrawings = uid("fold");
      data.nodes = [
        {
          companyId: auth.companyId, id: fContracts, type: "folder", name: "العقود",
          parentId: null, access: "restricted", companyWide: true, stationId: "all",
          createdAt: iso(48), updatedAt: iso(2),
        },
        {
          companyId: auth.companyId, id: fOps, type: "folder", name: "إجراءات التشغيل",
          parentId: null, access: "all_staff", companyWide: true, stationId: "all",
          createdAt: iso(72), updatedAt: iso(20),
        },
        {
          companyId: auth.companyId, id: fCerts, type: "folder", name: "شهادات الموظفين",
          parentId: null, access: "hr", companyWide: true, stationId: "all",
          createdAt: iso(96), updatedAt: iso(22),
        },
        {
          companyId: auth.companyId, id: fSafety, type: "folder", name: "تقارير السلامة",
          parentId: null, access: "supervisors", companyWide: true, stationId: "all",
          createdAt: iso(40), updatedAt: iso(3),
        },
        {
          companyId: auth.companyId, id: fDrawings, type: "folder", name: "المخططات الفنية",
          parentId: null, access: "supervisors", companyWide: true, stationId: "all",
          createdAt: iso(120), updatedAt: iso(96),
        },
        {
          companyId: auth.companyId, id: uid("file"), type: "file",
          name: "عقد الصيانة السنوي — الخليج للخدمات الفنية.pdf",
          parentId: fContracts, kind: "PDF", sizeBytes: 2_400_000,
          companyWide: true, stationId: "all", stationName: "كل الفروع",
          uploadedBy: "منى العتيبي", createdAt: iso(4), updatedAt: iso(2),
        },
        {
          companyId: auth.companyId, id: uid("file"), type: "file",
          name: "خطة الطوارئ — رابغ (نسخة معتمدة).pdf",
          parentId: fOps, kind: "PDF", sizeBytes: 1_100_000,
          stationId: "rbg", stationName: "رابغ",
          uploadedBy: "منى العتيبي", createdAt: iso(28), updatedAt: iso(20),
        },
        {
          companyId: auth.companyId, id: uid("file"), type: "file",
          name: "جرد قطع الغيار — أغسطس 2026.xlsx",
          parentId: fOps, kind: "XLSX", sizeBytes: 486_000,
          stationId: "shb", stationName: "الشعيبة",
          uploadedBy: "خالد الزهراني", createdAt: iso(30), updatedAt: iso(22),
        },
        {
          companyId: auth.companyId, id: uid("file"), type: "file",
          name: "شهادة السلامة المهنية — سعود الحربي.pdf",
          parentId: fCerts, kind: "PDF", sizeBytes: 820_000,
          stationId: "jbl1", stationName: "الجبيل 1",
          uploadedBy: "الموارد البشرية", createdAt: iso(96), updatedAt: iso(90),
        },
        {
          companyId: auth.companyId, id: uid("file"), type: "file",
          name: "مخطط شبكة التبريد — الجبيل 2.dwg",
          parentId: fDrawings, kind: "DWG", sizeBytes: 8_700_000,
          stationId: "jbl2", stationName: "الجبيل 2",
          uploadedBy: "فهد القحطاني", createdAt: iso(120), updatedAt: iso(100),
        },
        {
          companyId: auth.companyId, id: uid("file"), type: "file",
          name: "تقرير التفتيش الأسبوعي — الدمام.pdf",
          parentId: fSafety, kind: "PDF", sizeBytes: 1_600_000,
          stationId: "dmm", stationName: "الدمام",
          uploadedBy: "نورة الرشيد", createdAt: iso(140), updatedAt: iso(130),
        },
      ];
      await savePayload(data);
      await audit("files.seedDemo", "Seeded smart archive folders + recent files");
      return Response.json(enrichBoard(data));
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
});
