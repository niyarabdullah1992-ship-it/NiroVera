import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  checkCreateBranchGate,
  checkCreateDelegationGate,
  checkReparentGate,
  checkSetPermGate,
  deriveDelegationStatus,
  deriveEscalationFromBranches,
  deriveOrgStats,
  checkRemoveTitleGate,
  derivePermissionMatrix,
  effectiveScope,
  effectiveTitleScope,
  nextScopeInCycle,
  permKey,
  titlePermKey,
  titleSlug,
  type BranchLike,
  type DelegationLike,
  type OrgNodeLike,
  type PermOverride,
  type ScopeCode,
} from "../../shared/orgDerivations.ts";

const ORG_CATEGORY = "orgTree";
const ORG_LEGACY_CATEGORY = "orgStructure"; // do-not-write — read fallback only
const META_CATEGORY = "companyMeta";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type OrgPayload = {
  branches: Array<BranchLike & { companyId: string }>;
  treeNodes: Array<OrgNodeLike & { companyId?: string; type?: string; refId?: string; title?: string }>;
  permOverrides: Record<string, PermOverride>;
  delegations: Array<DelegationLike & { companyId: string }>;
  knownTitles?: string[];
  removedTitles?: string[];
};

function emptyPayload(): OrgPayload {
  return { branches: [], treeNodes: [], permOverrides: {}, delegations: [] };
}

/** Migrate forced east/west → optional free-text group; branch name stays primary. */
function normalizeBranchRow(b: BranchLike & { companyId: string; group?: string | null; orgGroup?: string | null }) {
  const legacy = b.region === "west" || b.region === "east";
  const group = String(b.group || b.orgGroup || (legacy ? "" : b.region) || "").trim() || null;
  return { ...b, group, region: group };
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
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
    };

    const seniorRoles = ["owner", "director", "ops_manager", "pgm", "admin"];
    const isSenior = auth.owner || auth.admin || seniorRoles.includes(auth.role);

    const loadBlob = async (category: string) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category,
      });
      return rows[0] || null;
    };

    const metaRecord = (raw: unknown) => {
      if (Array.isArray(raw)) return raw[0] && typeof raw[0] === "object" ? raw[0] as Record<string, unknown> : {};
      return raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    };

    const loadPayload = async (): Promise<OrgPayload> => {
      const treeBlob = await loadBlob(ORG_CATEGORY);
      const treeRaw = treeBlob?.payload;
      const treeNodesFromCanon = Array.isArray(treeRaw)
        ? treeRaw
        : (treeRaw && typeof treeRaw === "object" && Array.isArray((treeRaw as { treeNodes?: unknown[] }).treeNodes)
          ? (treeRaw as { treeNodes: unknown[] }).treeNodes
          : (treeRaw && typeof treeRaw === "object" && Array.isArray((treeRaw as { nodes?: unknown[] }).nodes)
            ? (treeRaw as { nodes: unknown[] }).nodes
            : []));
      const metaBlob = await loadBlob(META_CATEGORY);
      const meta = metaRecord(metaBlob?.payload);
      const board = meta.orgBoard && typeof meta.orgBoard === "object" ? meta.orgBoard as Record<string, unknown> : {};
      let raw: Record<string, unknown> = { ...board };
      if (!treeNodesFromCanon.length && !Array.isArray(board.branches) && !board.permOverrides) {
        const legacy = await loadBlob(ORG_LEGACY_CATEGORY);
        raw = legacy?.payload && typeof legacy.payload === "object" && !Array.isArray(legacy.payload)
          ? legacy.payload as Record<string, unknown>
          : raw;
      }
      const base = emptyPayload();
      base.branches = (Array.isArray(raw.branches) ? raw.branches : [])
        .filter((b: BranchLike & { companyId?: string }) => b && b.companyId === auth.companyId && b.id)
        .map((b: BranchLike & { companyId: string }) => normalizeBranchRow(b));
      base.treeNodes = (treeNodesFromCanon.length ? treeNodesFromCanon : (Array.isArray(raw.treeNodes) ? raw.treeNodes : [])).filter(
        (n: OrgNodeLike & { companyId?: string }) => n && (!n.companyId || n.companyId === auth.companyId) && n.id,
      );
      const overrides: Record<string, PermOverride> = {};
      const rawOv = raw.permOverrides && typeof raw.permOverrides === "object" ? raw.permOverrides : {};
      for (const [k, v] of Object.entries(rawOv)) {
        if (v && typeof v === "object" && "scope" in (v as object)) overrides[k] = v as PermOverride;
        else if (typeof v === "number") overrides[k] = { key: k, scope: v as ScopeCode };
      }
      base.permOverrides = overrides;
      base.delegations = (Array.isArray(raw.delegations) ? raw.delegations : []).filter(
        (d: DelegationLike & { companyId?: string }) => d && d.companyId === auth.companyId && d.id,
      );
      base.knownTitles = (Array.isArray(raw.knownTitles) ? raw.knownTitles : [])
        .map((t: unknown) => String(t || "").trim())
        .filter(Boolean);
      base.removedTitles = (Array.isArray(raw.removedTitles) ? raw.removedTitles : [])
        .map((t: unknown) => titleSlug(t))
        .filter(Boolean);
      return base;
    };

    const savePayload = async (payload: OrgPayload) => {
      const treeBlob = await loadBlob(ORG_CATEGORY);
      const existingTree = Array.isArray(treeBlob?.payload) ? treeBlob.payload : [];
      const tree = (payload.treeNodes || []).length ? payload.treeNodes : existingTree;
      if (treeBlob) await base44.asServiceRole.entities.CompanyDataBlob.update(treeBlob.id, { payload: tree });
      else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: ORG_CATEGORY,
          payload: tree,
        });
      }
      const extras = {
        branches: payload.branches,
        permOverrides: payload.permOverrides,
        delegations: payload.delegations,
        knownTitles: payload.knownTitles || [],
        removedTitles: payload.removedTitles || [],
      };
      const metaBlob = await loadBlob(META_CATEGORY);
      const meta = metaRecord(metaBlob?.payload);
      const nextMeta = { ...meta, id: meta.id || "meta", orgBoard: extras };
      const metaPayload = Array.isArray(metaBlob?.payload)
        ? [{ ...metaRecord(metaBlob.payload), ...nextMeta }]
        : [nextMeta];
      if (metaBlob) await base44.asServiceRole.entities.CompanyDataBlob.update(metaBlob.id, { payload: metaPayload });
      else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: META_CATEGORY,
          payload: metaPayload,
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

    const seedBranchesFromStations = async (data: OrgPayload) => {
      if (data.branches.length) return data;
      const stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
      data.branches = (stations || []).map((s: { stationId?: string; id?: string; name?: string; managerId?: string; location?: string }, i: number) => {
        const loc = String(s.location || "").trim();
        const fakeRegion = /^(eastern|western)\s+region$/i.test(loc)
          || loc === "المنطقة الغربية"
          || loc === "المنطقة الشرقية";
        return {
          companyId: auth.companyId,
          id: s.stationId || s.id || `st_${i}`,
          name: s.name || `Station ${i + 1}`,
          // Optional free-text label only — never invent East/West.
          group: loc && !fakeRegion ? loc : null,
          region: null,
          managerId: s.managerId || null,
          managerName: null,
          crew: 0,
          seeded: true,
        };
      });
      return data;
    };

    const mergeTitles = (data: OrgPayload, incoming: unknown) => {
      const removed = new Set(data.removedTitles || []);
      const seen = new Set<string>();
      const out: string[] = [];
      const add = (raw: unknown, revive = false) => {
        const label = String(raw || "").trim();
        const id = titleSlug(label);
        if (!label || !id || seen.has(id)) return;
        if (removed.has(id) && !revive) return;
        if (revive) removed.delete(id);
        seen.add(id);
        out.push(label);
      };
      for (const title of data.knownTitles || []) add(title);
      for (const node of data.treeNodes || []) {
        if (node.type === "employee") add(node.title);
      }
      const list = Array.isArray(incoming) ? incoming : [];
      for (const item of list) {
        add(typeof item === "string" ? item : (item as { label?: string; id?: string })?.label || (item as { id?: string })?.id, true);
      }
      data.removedTitles = [...removed];
      data.knownTitles = out;
      return out;
    };

    const enrich = (data: OrgPayload, now = new Date()) => {
      const overrideMap: Record<string, ScopeCode> = {};
      for (const [k, v] of Object.entries(data.permOverrides)) overrideMap[k] = v.scope;
      const titles = data.knownTitles || [];
      const matrix = derivePermissionMatrix(overrideMap, titles);
      const dirty = Object.keys(data.permOverrides).length > 0;
      const delegations = data.delegations.map((d) => ({
        ...d,
        ...deriveDelegationStatus(d, now),
      }));
      return {
        ok: true,
        branches: data.branches,
        treeNodes: data.treeNodes,
        matrix,
        titles,
        removedTitles: data.removedTitles || [],
        permDirty: dirty,
        permOverrides: data.permOverrides,
        escalation: deriveEscalationFromBranches(data.branches),
        delegations,
        stats: deriveOrgStats(data.branches, data.delegations, now),
      };
    };

    if (action === "list") {
      let data = await loadPayload();
      data = await seedBranchesFromStations(data);
      const beforeTitles = JSON.stringify(data.knownTitles || []);
      mergeTitles(data, body.titles);
      const hadBlob = !!(await loadBlob());
      if (!hadBlob && (data.branches.length || (data.knownTitles || []).length)) await savePayload(data);
      else if (hadBlob && JSON.stringify(data.knownTitles || []) !== beforeTitles) await savePayload(data);
      return Response.json(enrich(data));
    }

    if (!isSenior) {
      return Response.json({ error: "Forbidden — senior role required to change org structure" }, { status: 403 });
    }

    if (action === "createBranch") {
      const gate = checkCreateBranchGate(body);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const data = await seedBranchesFromStations(await loadPayload());
      const id = uid("br");
      const stationId = id;
      const orgGroup = String(body.group || body.orgGroup || body.region || "").trim() || null;
      await base44.asServiceRole.entities.Station.create({
        companyId: auth.companyId,
        stationId,
        name: gate.name,
        location: orgGroup || gate.name,
        type: "branch",
        status: "active",
        managerId: body.managerId || null,
      });
      const branch: BranchLike & { companyId: string; group?: string | null } = {
        companyId: auth.companyId,
        id: stationId,
        name: gate.name,
        group: orgGroup,
        region: orgGroup, // legacy field kept as optional label — not East/West enum
        managerId: body.managerId || null,
        managerName: body.managerName || gate.manager,
        crew: Math.max(1, Number(body.crew) || 12),
        seeded: false,
      };
      data.branches = [...data.branches, branch];
      data.treeNodes = [
        ...data.treeNodes,
        { id: `org_station_${stationId}`, parentId: null, companyId: auth.companyId, type: "station", refId: stationId },
      ];
      await savePayload(data);
      await audit("org.createBranch", `Created branch ${gate.name}`, { newValue: stationId });
      return Response.json({ ok: true, branch, ...enrich(data) });
    }

    if (action === "renameBranch") {
      const branchId = String(body.branchId || "");
      const name = String(body.name || "").trim();
      if (!branchId || !name) {
        return Response.json({
          error: "NAME_REQUIRED",
          reason: "اسم الفرع مطلوب.",
          reasonEn: "Branch name is required.",
        }, { status: 400 });
      }
      const data = await seedBranchesFromStations(await loadPayload());
      const idx = data.branches.findIndex((b) => b.id === branchId);
      if (idx < 0) return Response.json({ error: "BRANCH_NOT_FOUND" }, { status: 404 });
      const prev = data.branches[idx];
      data.branches[idx] = { ...prev, name };
      try {
        const stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
        const st = (stations || []).find((s: { stationId?: string; id?: string }) => (s.stationId || s.id) === branchId);
        if (st?.id) await base44.asServiceRole.entities.Station.update(st.id, { name });
      } catch {
        // best-effort Station sync
      }
      await savePayload(data);
      await audit("org.renameBranch", `Branch renamed ${prev.name} → ${name}`, { oldValue: prev.name, newValue: name });
      return Response.json({ ok: true, ...enrich(data) });
    }

    if (action === "setBranchManager") {
      const branchId = String(body.branchId || "");
      const managerId = body.managerId != null ? String(body.managerId) : null;
      const managerName = body.managerName != null ? String(body.managerName) : null;
      if (!branchId || !(managerId || managerName)) {
        return Response.json({ error: "MANAGER_REQUIRED", reason: "المسؤول مطلوب." }, { status: 400 });
      }
      const data = await seedBranchesFromStations(await loadPayload());
      const idx = data.branches.findIndex((b) => b.id === branchId);
      if (idx < 0) return Response.json({ error: "BRANCH_NOT_FOUND" }, { status: 404 });
      const prev = data.branches[idx];
      data.branches[idx] = {
        ...prev,
        managerId,
        managerName: managerName || managerId,
      };
      try {
        const stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
        const st = (stations || []).find((s: { stationId?: string; id?: string }) => (s.stationId || s.id) === branchId);
        if (st?.id) {
          await base44.asServiceRole.entities.Station.update(st.id, { managerId });
        }
      } catch {
        // Station sync best-effort — blob remains source for escalation derivation
      }
      await savePayload(data);
      await audit(
        "org.setBranchManager",
        `Branch ${prev.name} manager → ${managerName || managerId} — permissions and escalation moved immediately`,
        { oldValue: prev.managerId || prev.managerName, newValue: managerId || managerName },
      );
      return Response.json({ ok: true, ...enrich(data) });
    }

    if (action === "reparent") {
      const nodeId = String(body.nodeId || "");
      const newParentId = body.parentId == null || body.parentId === "" ? null : String(body.parentId);
      const data = await loadPayload();
      const gate = checkReparentGate(data.treeNodes, nodeId, newParentId);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      data.treeNodes = data.treeNodes.map((n) => (n.id === nodeId ? { ...n, parentId: newParentId } : n));
      await savePayload(data);
      await audit("org.reparent", `Reparented ${nodeId} under ${newParentId || "root"}`);
      return Response.json({ ok: true, ...enrich(data) });
    }

    if (action === "setPerm") {
      const sectionIdx = Number(body.sectionIdx);
      const titleKey = String(body.titleKey || "").trim();
      const roleIdx = titleKey ? -1 : Number(body.roleIdx);
      const data = await loadPayload();
      mergeTitles(data, body.titles);
      const overrideMap: Record<string, ScopeCode> = {};
      for (const [k, v] of Object.entries(data.permOverrides)) overrideMap[k] = v.scope;
      const current = titleKey
        ? effectiveTitleScope(sectionIdx, titleSlug(titleKey), overrideMap)
        : effectiveScope(sectionIdx, roleIdx, overrideMap);
      if (current.derived) {
        return Response.json({
          error: "DELEGATED_IS_DERIVED",
          reason: "«بتفويض» حالة مشتقة من سجل التفويض — لا تُضبط من المصفوفة.",
          reasonEn: "\"Delegated\" is derived from the delegation register — not set from the matrix.",
        }, { status: 400 });
      }
      const next = body.scope != null ? Number(body.scope) : nextScopeInCycle(current.scope);
      const gate = checkSetPermGate(next);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const key = titleKey ? titlePermKey(sectionIdx, titleKey) : permKey(sectionIdx, roleIdx);
      data.permOverrides[key] = {
        key,
        scope: gate.scope,
        by: auth.name,
        at: new Date().toISOString(),
      };
      await savePayload(data);
      await audit("org.setPerm", `Perm ${key} → ${gate.scope}`, {
        oldValue: String(current.scope),
        newValue: String(gate.scope),
      });
      return Response.json({ ok: true, ...enrich(data) });
    }

    if (action === "removeTitle") {
      const gate = checkRemoveTitleGate(body.titleKey);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const data = await loadPayload();
      data.removedTitles = [...new Set([...(data.removedTitles || []), gate.id])];
      data.knownTitles = (data.knownTitles || []).filter((title) => titleSlug(title) !== gate.id);
      data.treeNodes = data.treeNodes.map((node) => (
        node.type === "employee" && titleSlug(node.title) === gate.id ? { ...node, title: "" } : node
      ));
      for (const key of Object.keys(data.permOverrides)) {
        if (key.includes(`:title:${gate.id}`)) delete data.permOverrides[key];
      }
      await savePayload(data);
      await audit("org.removeTitle", `Removed job title ${gate.id}`);
      return Response.json({ ok: true, ...enrich(data) });
    }

    if (action === "resetPerms") {
      const data = await loadPayload();
      data.permOverrides = {};
      await savePayload(data);
      await audit("org.resetPerms", "Permission matrix reset to structure-derived baseline");
      return Response.json({ ok: true, ...enrich(data) });
    }

    if (action === "createDelegation") {
      const gate = checkCreateDelegationGate(body);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const data = await loadPayload();
      const rec: DelegationLike & { companyId: string } = {
        companyId: auth.companyId,
        id: uid("dg"),
        fromId: String(body.fromId),
        toId: String(body.toId),
        perm: String(body.perm).trim(),
        reason: String(body.reason || "").trim() || null,
        start: String(body.start || "").trim() || null,
        end: String(body.end),
        stationId: String(body.stationId || "").trim() || null,
        listId: String(body.listId || "").trim() || null,
        revoked: false,
      };
      data.delegations = [rec, ...data.delegations];
      await savePayload(data);
      await audit("org.createDelegation", `Delegated ${rec.perm} to ${rec.toId} until ${rec.end}`);
      return Response.json({ ok: true, delegation: rec, ...enrich(data) });
    }

    if (action === "revokeDelegation") {
      const id = String(body.id || "");
      const data = await loadPayload();
      const idx = data.delegations.findIndex((d) => d.id === id);
      if (idx < 0) return Response.json({ error: "DELEGATION_NOT_FOUND" }, { status: 404 });
      data.delegations[idx] = { ...data.delegations[idx], revoked: true };
      await savePayload(data);
      await audit("org.revokeDelegation", `Revoked delegation ${id}`);
      return Response.json({ ok: true, ...enrich(data) });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message || err) }, { status: 500 });
  }
});
