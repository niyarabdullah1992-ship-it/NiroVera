import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";

const MANAGER_ROLES = ["director", "ops_manager", "pgm", "station_manager"];

// Best-effort Gmail alert sent from the company's connected Gmail account.
async function sendGmail(base44, to, subject, text) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("gmail");
  const { createMimeMessage } = await import("npm:mimetext@3.0.24");
  const msg = createMimeMessage();
  msg.setSender({ name: "PowerCare", addr: "no-reply@powercare.app" });
  msg.setRecipient(to);
  msg.setSubject(subject);
  msg.addMessage({ contentType: "text/plain", data: text });
  const bytes = new TextEncoder().encode(msg.asRaw());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const raw = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) console.error("Gmail send failed:", await res.text());
}

// Best-effort Google Calendar deadline event on the connected calendar.
function cleanChatFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.filter((f) => f && f.url).map((f) => {
    const durationSec = Number(f.durationSec);
    return {
      url: f.url,
      name: f.name || "file",
      type: f.type || "file",
      ...(Number.isFinite(durationSec) && durationSec > 0 ? { durationSec: Math.round(durationSec) } : {}),
    };
  });
}

function chatPreviewText(row) {
  const text = String(row?.text || "").trim();
  if (text) return text.slice(0, 80);
  const files = Array.isArray(row?.files) ? row.files : [];
  if (files.some((f) => /^audio\//i.test(String(f?.type || "")) || /\.(webm|mp3|wav|m4a|ogg)$/i.test(String(f?.name || "")))) {
    return "مقطع صوتي";
  }
  if (files[0]?.name) return String(files[0].name).slice(0, 80);
  return "";
}

async function addCalendarDeadline(base44, { title, description, endDate }) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");
  const day = new Date(endDate).toISOString().slice(0, 10);
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: `📋 ${title}`,
      description: description || "",
      start: { date: day },
      end: { date: next.toISOString().slice(0, 10) },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }, { method: "email", minutes: 24 * 60 }] },
    }),
  });
  if (!res.ok) console.error("Calendar event failed:", await res.text());
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "").replace(/\/rest\/v\d+$/, "");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { action } = body;
    if (action === "runEscalationSweep") {
      const workflowUser = await base44.auth.me().catch(() => null);
      if (!workflowUser || workflowUser.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    // ---- Server-side authorization ----
    // Roles are never trusted from the request body. The caller must present the
    // session token issued at login; the role is derived from the server's own
    // Employee record. The scheduled escalation sweep runs without a user session.
    let auth = null;
    if (action !== "runEscalationSweep") {
      const { sessionToken, companyId } = body;
      if (sessionToken && companyId) {
        const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: sessionToken, companyId });
        const s = sessions[0];
        if (s && new Date(s.expiresAt).getTime() > Date.now()) {
          const emps = s.userId
            ? await base44.asServiceRole.entities.Employee.filter({ companyId, employeeId: s.userId })
            : [];
          const emp = emps[0] || null;
          auth = s.role === "owner"
            ? { isManager: true, role: "owner", companyId, userId: s.userId || null, name: emp?.name || "Owner" }
            : {
                isManager: MANAGER_ROLES.includes(emp?.role), role: emp?.role || "employee",
                companyId, userId: s.userId, stationId: emp?.stationId || null,
                managedStations: Array.isArray(emp?.managedStations) ? emp.managedStations : [],
                name: emp?.name || "Employee",
              };
        }
      }
      if (!auth) {
        const platformUser = await base44.auth.me().catch(() => null);
        if (platformUser && platformUser.role === "admin") {
          // Admin must still name a company — no tenantless target access.
          if (!body.companyId) return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
          const employees = body.userId
            ? await base44.asServiceRole.entities.Employee.filter({ companyId: body.companyId, employeeId: body.userId })
            : [];
          const employee = employees[0] || null;
          auth = { admin: true, isManager: true, role: employee?.role || "owner", companyId: body.companyId, userId: body.userId || null, name: employee?.name || platformUser.full_name || "Admin" };
        }
      }
      if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (!auth.companyId) return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
    }
    const isManager = !!auth?.isManager;
    const canSetCompletionMode = !!auth?.admin || ["owner", "director", "ops_manager", "station_manager"].includes(auth?.role);

    // ---- Multi-tenant boundary ----
    // The shared targets table has no company column, so membership is resolved
    // against the validated company's own employees and stations.
    const getCompanyScope = async () => {
      const [emps, sts] = await Promise.all([
        base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId }),
        base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId }),
      ]);
      return {
        employeeIds: new Set(emps.map((e) => e.employeeId)),
        stationIds: new Set(sts.map((s) => s.stationId)),
      };
    };
    const targetInScope = (tg, scope) =>
      scope.employeeIds.has(tg.employee_id) || scope.employeeIds.has(tg.manager_id) ||
      scope.stationIds.has(tg.station_id) || scope.stationIds.has(tg.assignment_id);
    let taskBlobCache;
    const getTaskBlob = async () => {
      if (taskBlobCache !== undefined) return taskBlobCache;
      const records = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category: "tasks" });
      taskBlobCache = records[0] || null;
      if (!taskBlobCache || !Array.isArray(taskBlobCache.payload) || !taskBlobCache.payload.length) {
        const legacy = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category: "operationsTasks" });
        if (legacy[0] && Array.isArray(legacy[0].payload) && legacy[0].payload.length) {
          if (taskBlobCache) {
            taskBlobCache = await base44.asServiceRole.entities.CompanyDataBlob.update(taskBlobCache.id, { payload: legacy[0].payload });
          } else {
            taskBlobCache = await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: auth.companyId, category: "tasks", payload: legacy[0].payload });
          }
        }
      }
      return taskBlobCache;
    };
    const taskMetadataFor = async (targetId) => {
      const blob = await getTaskBlob();
      return (blob?.payload || []).find((item) => item.id === targetId) || null;
    };
    const withTaskMetadata = async (target) => {
      const metadata = await taskMetadataFor(target.id);
      return {
        ...target,
        completionMode: metadata?.completionMode || "onsite",
        remoteConvertedBy: metadata?.remoteConvertedBy || null,
        remoteConvertedAt: metadata?.remoteConvertedAt || null,
        effortWeight: Number(metadata?.effortWeight) || 1,
        evidenceType: metadata?.evidenceType || null,
        clientCompany: metadata?.clientCompany || "",
        clientProject: metadata?.clientProject || "",
        clientContact: metadata?.clientContact || "",
        clientPhone: metadata?.clientPhone || "",
        pendingReviewAt: metadata?.pendingReviewAt || null,
        reviewedAt: metadata?.reviewedAt || null,
        reviewedBy: metadata?.reviewedBy || null,
        autoApproved: !!metadata?.autoApproved,
      };
    };
    const saveTaskMetadata = async (target, updates) => {
      const blob = await getTaskBlob();
      const payload = Array.isArray(blob?.payload) ? [...blob.payload] : [];
      const index = payload.findIndex((item) => item.id === target.id);
      const current = index >= 0 ? payload[index] : { id: target.id, title: target.title || "" };
      const next = { ...current, title: target.title || current.title || "", ...updates };
      if (index >= 0) payload[index] = next;
      else payload.push(next);
      if (blob) {
        taskBlobCache = await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
      } else {
        taskBlobCache = await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: auth.companyId, category: "tasks", payload });
      }
      return next;
    };
    // ---- Points ledger ----
    // Every award/deduction is written as an immutable entry BEFORE the employee's
    // running total changes, so each point can be traced back to its task, its
    // evidence, its approver and its moment. Entries are never edited or deleted;
    // a correction is a new negative entry pointing at the same targetId.
    const recordPoints = async ({ employeeId, points, target, awardedBy, reason }) => {
      const delta = Number(points);
      if (!employeeId || !Number.isFinite(delta) || delta === 0) return null;
      const evidenceUrls = (Array.isArray(target?.completion_proof) ? target.completion_proof : [])
        .map((item) => item?.url).filter(Boolean);
      const entry = await base44.asServiceRole.entities.PointsLedger.create({
        companyId: auth.companyId,
        employeeId,
        points: delta,
        targetId: target?.id || null,
        taskTitle: target?.title || "",
        priority: target?.priority || null,
        effortWeight: Number(target?.effortWeight) || 1,
        stationId: target ? targetStationId(target) : null,
        awardedBy: awardedBy || "system",
        awardedAt: new Date().toISOString(),
        reason: reason || "",
        evidenceUrls,
      });
      const records = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId });
      if (records[0]) await base44.asServiceRole.entities.Employee.update(records[0].id, { points: (Number(records[0].points) || 0) + delta });
      return entry;
    };

    // The ONE scoring equation for the whole system: the company's configured
    // priority value × the task's effort weight. Both approval paths (a supervisor
    // approving, and the deadline auto-approval) call this — so the same task can
    // never be worth two different amounts depending on who closed it.
    // Design formula (Platform Component): High 3 · Medium 2 · Low 1 × effort weight.
    // urgent maps to high. Company rewardPoints overrides remain allowed when set.
    const DEFAULT_PRIORITY_POINTS = { urgent: 3, high: 3, medium: 2, low: 1 };
    const taskPointsFor = async (target) => {
      const meta = await getCompanyMeta().catch(() => ({}));
      const configured = Number(meta.rewardPoints?.[target.priority]);
      const base = Number.isFinite(configured) && configured > 0 ? configured : (DEFAULT_PRIORITY_POINTS[target.priority] || 1);
      return base * (Number(target.effortWeight) || 1);
    };
    const pointRecipientsFor = async (target) => {
      if (target.assignment_type === "member" && target.employee_id) return [target.employee_id];
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      if (target.assignment_type === "hq_team") {
        return emps.filter((e) => !e.stationId).map((e) => e.employeeId);
      }
      const stationKey = target.assignment_id || target.station_id;
      if (!stationKey) return [];
      return emps.filter((e) => e.stationId === stationKey).map((e) => e.employeeId);
    };
    const awardTargetPoints = async (target, awardedBy, reason) => {
      const points = await taskPointsFor(target);
      const recipientIds = await pointRecipientsFor(target);
      for (const rid of recipientIds) await recordPoints({ employeeId: rid, points, target, awardedBy, reason });
      return { points, recipientIds };
    };

    // Fetches one target and verifies it belongs to the caller's company.
    const getScopedTarget = async (targetId) => {
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(targetId)}`, { headers });
      const rows = await getRes.json();
      const tg = Array.isArray(rows) && rows[0];
      if (!tg) return null;
      if (!auth?.companyId) return null;
      const scope = await getCompanyScope();
      return targetInScope(tg, scope) ? await withTaskMetadata(tg) : null;
    };
    const targetStationId = (tg) => tg.assignment_type === "station_team"
      ? (tg.assignment_id || tg.station_id)
      : tg.assignment_type === "hq_team" ? "hq" : tg.station_id;
    const canManageStation = (stationId) => {
      if (auth?.admin || ["owner", "director", "ops_manager"].includes(auth?.role)) return true;
      if (auth?.role === "pgm") return (auth.managedStations || []).includes(stationId);
      if (auth?.role === "station_manager") return auth.stationId === stationId || (auth.managedStations || []).includes(stationId);
      return false;
    };
    const canManageTarget = (tg) => !!tg && canManageStation(targetStationId(tg));
    const canManageStations = !!auth?.admin || ["owner", "director"].includes(auth?.role);
    // ---- Identity boundary: callers may only act/read as themselves ----
    let companyMetaCache;
    const getCompanyMeta = async () => {
      if (companyMetaCache !== undefined) return companyMetaCache;
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category: "companyMeta" });
      companyMetaCache = rows[0]?.payload?.[0] || {};
      return companyMetaCache;
    };
    const taskVisibilityRecipients = async (target) => {
      const stationId = targetStationId(target);
      const meta = await getCompanyMeta();
      const linkedStations = new Set([stationId].filter(Boolean));
      for (const group of meta.stationChatGroups || []) {
        if ((group.stationIds || []).includes(stationId)) (group.stationIds || []).forEach((id) => linkedStations.add(id));
      }
      const employees = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      return employees.filter((employee) => {
        if (employee.employeeId === target.manager_id) return true;
        if (["director", "ops_manager"].includes(employee.role)) return true;
        if (employee.role === "pgm") return (employee.managedStations || []).some((id) => linkedStations.has(id));
        if (employee.role === "station_manager") return linkedStations.has(employee.stationId) || (employee.managedStations || []).some((id) => linkedStations.has(id));
        return linkedStations.has(employee.stationId);
      });
    };
    const canActAs = async (userId) => {
      if (!userId) return false;
      if (auth?.admin) return !auth.userId || auth.userId === userId;
      if (auth?.userId) return auth.userId === userId;
      if (auth?.role !== "owner") return false;
      return (await getCompanyMeta()).ownerId === userId;
    };
    const actorNameFor = async (userId) => {
      const employees = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId: userId });
      return employees[0]?.name || auth?.name || "User";
    };
    // ---- PostgREST injection guard ----
    // Ids interpolated into logical `or=(...)` query trees must never contain
    // grouping characters (encodeURIComponent does NOT escape parentheses/commas).
    // All system ids are [A-Za-z0-9_-], so anything else is stripped.
    const safeId = (v) => String(v || "").replace(/[^\w-]/g, "");
    // ---- Cross-tenant room boundary (chat rooms & task folders) ----
    // Resolves a client-supplied room/station id to a server-validated id scoped
    // to the caller's company. Shared "all" rooms are namespaced per company;
    // station ids must exist in the caller's company; group ids must be
    // one of the caller's own chat groups. Returns null when out of bounds.
    const resolveRoomId = async (stationId) => {
      const id = String(stationId || "");
      if (!id) return null;
      if (!auth?.companyId) return null;
      const senior = auth?.admin || ["owner", "director", "ops_manager"].includes(auth?.role);
      const meta = await getCompanyMeta();
      if (id === "hq") return null;
      if (id === "all") return meta.crossStationChatEnabled ? `${auth.companyId}_all` : null;
      if (id.startsWith("group_")) {
        const group = (meta.stationChatGroups || []).find((item) => `group_${item.id}` === id);
        return group && (senior || (auth.stationId && (group.stationIds || []).includes(auth.stationId))) ? id : null;
      }
      const stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId, stationId: id });
      if (!stations.length) return null;
      if (senior) return id;
      if (auth.role === "pgm") return (auth.managedStations || []).includes(id) ? id : null;
      if (auth.role === "station_manager") return (auth.stationId === id || (auth.managedStations || []).includes(id)) ? id : null;
      return auth.stationId === id ? id : null;
    };
    const resolveCallRoom = async (chatType, roomId, otherUserId) => {
      if (chatType === "general") return await resolveRoomId(roomId);
      if (chatType !== "dm" || !otherUserId || !auth?.userId) return null;
      const scope = await getCompanyScope();
      if (!scope.employeeIds.has(otherUserId)) return null;
      return `${auth.companyId}_dm_${[auth.userId, otherUserId].sort().join("_")}`;
    };
    if (action === "stationDataSummary" || action === "removeStationData") {
      if (!canManageStations) return Response.json({ error: "Forbidden" }, { status: 403 });
      const stationId = String(body.stationId || "");
      const mode = body.mode;
      const targetStationIdValue = String(body.targetStationId || "");
      if (!stationId) return Response.json({ error: "Missing stationId" }, { status: 400 });
      const sourceStations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId, stationId });
      if (!sourceStations.length) return Response.json({ error: "Station not found" }, { status: 404 });
      if (action === "removeStationData") {
        if (!["transfer", "delete"].includes(mode)) return Response.json({ error: "Invalid mode" }, { status: 400 });
        if (mode === "transfer") {
          if (!targetStationIdValue || targetStationIdValue === stationId) return Response.json({ error: "Invalid target station" }, { status: 400 });
          const targetStations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId, stationId: targetStationIdValue });
          if (!targetStations.length) return Response.json({ error: "Target station not found" }, { status: 404 });
        }
      }
      const targetRes = await fetch(`${SUPABASE_URL}/rest/v1/targets?order=created_at.desc`, { headers });
      const allTargets = await targetRes.json();
      const scope = await getCompanyScope();
      const linkedTargets = (Array.isArray(allTargets) ? allTargets : []).filter((target) => targetInScope(target, scope) && targetStationId(target) === stationId);
      const sourceRoom = stationId;
      const folderRes = await fetch(`${SUPABASE_URL}/rest/v1/task_folders?station_id=eq.${encodeURIComponent(sourceRoom)}`, { headers });
      const folders = await folderRes.json();
      if (action === "stationDataSummary") return Response.json({ openTasks: linkedTargets.filter((target) => target.status !== "completed").length, folders: Array.isArray(folders) ? folders.length : 0 });
      for (const target of linkedTargets) {
        const url = `${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(target.id)}`;
        if (mode === "delete") await fetch(url, { method: "DELETE", headers });
        else {
          const patch = target.assignment_type === "station_team" || target.assignment_type === "hq_team"
            ? { assignment_type: "station_team", assignment_id: targetStationIdValue, station_id: targetStationIdValue }
            : { station_id: targetStationIdValue };
          await fetch(url, { method: "PATCH", headers, body: JSON.stringify(patch) });
        }
      }
      if (Array.isArray(folders) && folders.length) {
        if (mode === "delete") await fetch(`${SUPABASE_URL}/rest/v1/task_folders?station_id=eq.${encodeURIComponent(sourceRoom)}`, { method: "DELETE", headers });
        else {
          const targetRoom = targetStationIdValue;
          await fetch(`${SUPABASE_URL}/rest/v1/task_folders?station_id=eq.${encodeURIComponent(sourceRoom)}`, { method: "PATCH", headers, body: JSON.stringify({ station_id: targetRoom }) });
        }
      }
      return Response.json({ ok: true, tasks: linkedTargets.length, folders: Array.isArray(folders) ? folders.length : 0 });
    }

    if (action === "listTargets") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/targets?order=created_at.desc`, { headers });
      let rows = await res.json();
      if (!Array.isArray(rows)) rows = [];
      // Strict tenant boundary: every caller (including admin) is scoped to companyId.
      const scope = await getCompanyScope();
      rows = rows.filter((tg) => targetInScope(tg, scope));
      rows = await Promise.all(rows.map((target) => withTaskMetadata(target)));
      // Overdue detection: auto-close targets past their end date
      const now = Date.now();
      for (const tg of rows) {
        if (tg.status === "active" && new Date(tg.end_date).getTime() < now) {
          // notify manager
          await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              user_id: tg.manager_id,
              message: `Target "${tg.title || "Untitled"}" is OVERDUED — time expired before reaching the goal (${tg.completed_tasks}/${tg.task_target}).`,
            }),
          });
          // notify assigned employee (member only)
          if (tg.assignment_type === "member" && tg.employee_id) {
            await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                user_id: tg.employee_id,
                message: `Your target "${tg.title || "Untitled"}" is OVERDUED — time expired (${tg.completed_tasks}/${tg.task_target}).`,
              }),
            });
          }
          // mark overdue in DB
          await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(tg.id)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status: "overdue" }),
          });
          tg.status = "overdue";
        }
      }
      // Auto-approval by deadline: a pending review older than the company's approval
      // deadline is approved automatically — stalling approvals can't be used as a
      // silent weapon against the employee's score.
      if (auth.companyId) {
        const meta = await getCompanyMeta().catch(() => ({}));
        const deadlineHours = Number(meta.approvalDeadlineHours) > 0 ? Number(meta.approvalDeadlineHours) : 48;
        for (const tg of rows) {
          if (tg.status !== "pending_review" || !tg.pendingReviewAt) continue;
          if ((now - new Date(tg.pendingReviewAt).getTime()) / 3600000 < deadlineHours) continue;
          const comments = Array.isArray(tg.comments) ? tg.comments : [];
          comments.push({
            id: crypto.randomUUID(), user_id: "system", user_name: "System",
            content: "✅ اعتماد تلقائي بانقضاء مهلة المراجعة — Auto-approved: review deadline passed.",
            files: [], is_issue: false, is_auto_approval: true, created_at: new Date().toISOString(),
          });
          await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(tg.id)}`, {
            method: "PATCH", headers, body: JSON.stringify({ status: "completed", comments }),
          });
          await saveTaskMetadata(tg, { autoApproved: true, reviewedAt: new Date().toISOString(), reviewedBy: "system" });
          tg.status = "completed"; tg.comments = comments; tg.autoApproved = true;
          // Single scoring equation, shared with the supervisor approval path.
          const { points: pts, recipientIds } = await awardTargetPoints(
            tg, "system",
            `اعتماد تلقائي بانقضاء مهلة ${deadlineHours} ساعة — Auto-approved after the ${deadlineHours}h review deadline.`
          );
          for (const rid of recipientIds) {
            await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
              method: "POST", headers,
              body: JSON.stringify({ user_id: rid, message: `🎉 "${tg.title || "Untitled"}" — اعتماد تلقائي بانقضاء المهلة (+${pts} نقطة)` }),
            });
          }
          await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
            method: "POST", headers,
            body: JSON.stringify({ user_id: tg.manager_id, message: `⏱️ "${tg.title || "Untitled"}" was auto-approved — the ${deadlineHours}h review deadline passed.` }),
          });
        }
      }
      if (isManager) {
        // PGM sees only managed stations; station_manager sees only their station
        if (auth.role === "pgm") {
          const managed = new Set(auth.managedStations || []);
          const filtered = rows.filter((tg) => {
            const key = tg.assignment_type === "station_team" ? (tg.assignment_id || tg.station_id)
              : tg.assignment_type === "hq_team" ? "hq"
              : (tg.station_id || tg.employee_id);
            return managed.has(key);
          });
          return Response.json({ targets: filtered });
        }
        if (auth.role === "station_manager") {
          const managed = new Set([auth.stationId, ...(auth.managedStations || [])].filter(Boolean));
          const filtered = rows.filter((tg) => {
            if (tg.assignment_type === "station_team") return managed.has(tg.assignment_id);
            if (tg.assignment_type === "member") return managed.has(tg.station_id);
            return false;
          });
          return Response.json({ targets: filtered });
        }
        return Response.json({ targets: rows });
      }
      // Employee: filter by assignment type (identity from the session, not the body)
      const employeeScope = await getCompanyScope();
      const myStation = auth.stationId || employeeScope.stationIds.values().next().value || null;
      const filtered = rows.filter((tg) => {
        if (tg.assignment_type === "member") return tg.employee_id === auth.userId;
        if (tg.assignment_type === "station_team") return tg.assignment_id === myStation;
        if (tg.assignment_type === "hq_team") return !myStation;
        // legacy rows without assignment_type
        return tg.employee_id === auth.userId;
      });
      return Response.json({ targets: filtered });
    }

    if (action === "createTarget") {
      if (!isManager) {
        return Response.json({ error: "Forbidden: only managers can create targets" }, { status: 403 });
      }
      const { managerId, taskTarget, days, title, description, steps, fileUrl, fileUrls, assignmentType, assignmentId, employeeId, stationId, priority, startDate: customStart, endDate: customEnd, section, taskType, completionMode = "onsite", effortWeight, client } = body;
      const weight = Math.min(5, Math.max(1, Number(effortWeight) || 1));
      const targetAmount = Number(taskTarget);
      if (!(title || "").trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) {
        return Response.json({ error: "A title and positive task target are required" }, { status: 400 });
      }
      const hasCustomRange = customStart && customEnd;
      const hasDays = Number(days) > 0;
      if (!hasCustomRange && !hasDays) {
        return Response.json({ error: "Missing duration or date range" }, { status: 400 });
      }
      const aType = assignmentType || "member";
      if (!["member", "station_team"].includes(aType)) return Response.json({ error: "Invalid assignment type" }, { status: 400 });
      if (!["urgent", "high", "medium", "low"].includes(priority || "medium")) return Response.json({ error: "Invalid priority" }, { status: 400 });
      if (!["onsite", "remote"].includes(completionMode)) return Response.json({ error: "Invalid completion mode" }, { status: 400 });
      if (completionMode !== "onsite" && !canSetCompletionMode) return Response.json({ error: "Forbidden" }, { status: 403 });
      const companyScope = await getCompanyScope();
      if (aType === "member" && (!employeeId || !companyScope.employeeIds.has(employeeId))) return Response.json({ error: "Select an employee in your company" }, { status: 400 });
      if (aType === "station_team" && (!assignmentId || !companyScope.stationIds.has(assignmentId))) return Response.json({ error: "Select a station in your company" }, { status: 400 });
      let resolvedStationId = stationId || null;
      if (aType === "member") {
        const assigned = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId });
        resolvedStationId = assigned[0]?.stationId || companyScope.stationIds.values().next().value || null;
      } else {
        resolvedStationId = assignmentId;
      }
      if (!resolvedStationId || !canManageStation(resolvedStationId)) return Response.json({ error: "Assignment is outside your management scope" }, { status: 403 });
      const startDate = customStart || new Date().toISOString();
      const endDate = customEnd || new Date(Date.now() + Number(days) * 86400000).toISOString();
      if (!Number.isFinite(new Date(startDate).getTime()) || !Number.isFinite(new Date(endDate).getTime()) || new Date(endDate) <= new Date(startDate)) return Response.json({ error: "End date must be after start date" }, { status: 400 });
      const effectiveManagerId = auth?.userId || (auth?.role === "owner" ? (await getCompanyMeta()).ownerId : null);
      if (!effectiveManagerId) return Response.json({ error: "Manager identity is required" }, { status: 400 });
      const durationDays = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
      const res = await fetch(`${SUPABASE_URL}/rest/v1/targets`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          title: title.trim(),
          description: description || null,
          steps: steps || null,
          file_url: (Array.isArray(fileUrls) && fileUrls[0]?.url) ? fileUrls[0].url : (fileUrl || null),
          file_urls: Array.isArray(fileUrls) && fileUrls.length ? fileUrls : null,
          employee_id: aType === "member" ? employeeId : (assignmentId || effectiveManagerId),
          assignment_type: aType,
          assignment_id: assignmentId || null,
          station_id: resolvedStationId,
          section: section || null,
          task_type: taskType || null,
          manager_id: effectiveManagerId,
          task_target: targetAmount,
          days: durationDays,
          completed_tasks: 0,
          start_date: startDate,
          end_date: endDate,
          priority: priority || "medium",
          status: "active",
        }),
      });
      const created = await res.json();
      if (!res.ok) {
        return Response.json({ error: created?.message || "Failed to create target — run: ALTER TABLE targets ADD COLUMN IF NOT EXISTS section text; ALTER TABLE targets ADD COLUMN IF NOT EXISTS task_type text;" }, { status: 400 });
      }
      const createdTarget = Array.isArray(created) ? created[0] : created;
      const clientFields = {
        clientCompany: String(client?.clientCompany || "").trim().slice(0, 120),
        clientProject: String(client?.clientProject || "").trim().slice(0, 120),
        clientContact: String(client?.clientContact || "").trim().slice(0, 120),
        clientPhone: String(client?.clientPhone || "").trim().slice(0, 80),
      };
      await saveTaskMetadata(createdTarget, { completionMode, effortWeight: weight, ...clientFields });
      // Notify the assigned employee (member only)
      if (aType === "member" && employeeId) {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: employeeId,
            message: `New target assigned: ${title.trim()} — ${targetAmount} tasks in ${durationDays} days.`,
          }),
        });
        // Gmail email alert to the assigned employee (best-effort)
        try {
          const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId });
          const email = emps[0]?.email;
          if (email) {
            await sendGmail(
              base44, email,
              `PowerCare — مهمة جديدة أُسندت إليك${title ? `: ${title}` : ""}`,
              `مرحبًا ${emps[0]?.name || ""}،\n\nتم إسناد مهمة جديدة إليك${title ? `: "${title}"` : ""} (${taskTarget} مهمة).\nيرجى الدخول إلى منصة PowerCare لمراجعة التفاصيل.\n\nA new task${title ? ` "${title}"` : ""} has been assigned to you on PowerCare.`
            );
          }
        } catch (e) {
          console.error("Gmail alert failed:", e.message);
        }
      }
      // Google Calendar: deadline event with alerts (best-effort)
      try {
        await addCalendarDeadline(base44, {
          title: title || `${taskTarget} tasks`,
          description: `PowerCare task deadline — target: ${taskTarget}.${description ? `\n${description}` : ""}`,
          endDate,
        });
      } catch (e) {
        console.error("Calendar sync failed:", e.message);
      }
      return Response.json({ target: await withTaskMetadata(createdTarget) });
    }

    if (action === "updateProgress") {
      const { targetId, amount, managerId, employeeName, proofFiles, attestation } = body;
      const progressAmount = Number(amount);
      if (!targetId || !Number.isFinite(progressAmount) || progressAmount <= 0) {
        return Response.json({ error: "Progress must be a positive number" }, { status: 400 });
      }
      // Fetch current target (company-scoped)
      const tg = await getScopedTarget(targetId);
      if (!tg) return Response.json({ error: "Target not found" }, { status: 404 });
      const isAssignee = tg.assignment_type === "station_team" ? tg.assignment_id === auth?.stationId :
        tg.assignment_type === "hq_team" ? !auth?.stationId : tg.employee_id === auth?.userId;
      if (!auth?.admin && !isAssignee) return Response.json({ error: "Forbidden" }, { status: 403 });
      if (tg.status !== "active" || new Date(tg.end_date).getTime() < Date.now()) return Response.json({ error: "TASK_NOT_ACTIVE" }, { status: 400 });
      if (!auth?.admin && auth?.userId) {
        const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId: auth.companyId });
        const isIndividual = String(accounts[0]?.plan || "").toLowerCase() === "individual";
        if (!isIndividual && tg.completionMode !== "remote") {
          const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
          const attendanceRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=eq.${encodeURIComponent(auth.userId)}&date=eq.${today}`, { headers });
          const attendanceRows = await attendanceRes.json();
          const attendance = Array.isArray(attendanceRows) && attendanceRows[0];
          if (!attendance || !["present", "late"].includes(attendance.status)) return Response.json({ error: "CHECK_IN_REQUIRED" }, { status: 403 });
        }
      }
      const newCompleted = Math.min((Number(tg.completed_tasks) || 0) + progressAmount, Number(tg.task_target));
      const reachesTarget = newCompleted >= tg.task_target;
      const cleanProof = Array.isArray(proofFiles)
        ? proofFiles.filter((f) => f && f.url).map((f) => ({ url: f.url, name: f.name || "file", type: f.type || "file" }))
        : [];
      // Reaching the quota requires evidence — a field proof (photo/file) or a
      // written non-photographed attestation ("لا نقطة بلا أثر") — then waits for review.
      const attestationText = String(attestation || "").trim();
      if (reachesTarget && cleanProof.length === 0 && !attestationText) {
        return Response.json({ error: "PROOF_REQUIRED" }, { status: 400 });
      }
      const status = reachesTarget ? "pending_review" : "active";
      const patch: Record<string, unknown> = { completed_tasks: newCompleted, status };
      if (reachesTarget) {
        patch.completion_proof = cleanProof.length ? cleanProof : [{ url: "", name: "attestation", type: "attestation", text: attestationText }];
        // Remember the count before this submission so a rejection can restore it
        // instead of leaving completed_tasks stuck at the target (looking "100% done").
        patch.pre_review_completed = tg.completed_tasks;
        // Fresh review cycle — reset the dispute-escalation chain back to the start.
        patch.escalation_level = 0;
      }
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(targetId)}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify(patch),
        }
      );
      const updated = await patchRes.json();
      if (!patchRes.ok) {
        return Response.json({ error: updated?.message || "Failed to update progress — run: ALTER TABLE targets ADD COLUMN IF NOT EXISTS completion_proof jsonb; ALTER TABLE targets ADD COLUMN IF NOT EXISTS pre_review_completed integer;" }, { status: 400 });
      }
      if (reachesTarget) {
        // Review-deadline clock starts now; evidence path is recorded for auditing.
        await saveTaskMetadata(tg, { pendingReviewAt: new Date().toISOString(), evidenceType: cleanProof.length ? "field" : "attestation" });
      }
      if (reachesTarget && tg.completionMode === "remote") {
        const recipients = await taskVisibilityRecipients(tg);
        const message = `${auth?.name || "الموظف"} أنجز مهمة عن بُعد: ${tg.title || "مهمة"}`;
        await Promise.all(recipients.map((recipient) => fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: "POST",
          headers,
          body: JSON.stringify({ user_id: recipient.employeeId, message }),
        })));
      }
      // Notify the recorded manager using the authenticated actor identity.
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: tg.manager_id,
          message: reachesTarget
            ? `${auth?.name || "Employee"} submitted "${tg.title || "Untitled"}" for review (${newCompleted}/${tg.task_target}).`
            : `${auth?.name || "Employee"} completed ${progressAmount} tasks (${newCompleted}/${tg.task_target}).`,
        }),
      });
      return Response.json({ target: await withTaskMetadata(updated[0]) });
    }

    if (action === "reviewCompletion") {
      if (!isManager) {
        return Response.json({ error: "Forbidden: only managers can review completions" }, { status: 403 });
      }
      const { targetId, approve, reason, reviewerId, reviewerName } = body;
      if (!targetId) return Response.json({ error: "Missing targetId" }, { status: 400 });
      // A rejection must be justified — no silent/arbitrary rejections of an employee's proof.
      if (!approve && !(reason || "").trim()) {
        return Response.json({ error: "REASON_REQUIRED" }, { status: 400 });
      }
      const tg = await getScopedTarget(targetId);
      if (!tg) return Response.json({ error: "Target not found" }, { status: 404 });
      if (!canManageTarget(tg)) return Response.json({ error: "Forbidden" }, { status: 403 });
      if (tg.status !== "pending_review" || !Array.isArray(tg.completion_proof) || tg.completion_proof.length === 0) return Response.json({ error: "Task is not ready for review" }, { status: 400 });
      const patch: Record<string, unknown> = approve
        ? { status: "completed" }
        : { status: "active", completion_proof: null, completed_tasks: tg.pre_review_completed ?? 0 };
      if (!approve) {
        const comments = Array.isArray(tg.comments) ? tg.comments : [];
        comments.push({
          id: crypto.randomUUID(),
          user_id: auth?.userId || tg.manager_id,
          user_name: auth?.name || "Manager",
          content: `❌ ${reason.trim()}`,
          files: [],
          is_issue: false,
          is_rejection: true,
          created_at: new Date().toISOString(),
        });
        patch.comments = comments;
      }
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      const updated = await patchRes.json();
      if (!patchRes.ok) {
        return Response.json({ error: updated?.message || "Failed to review completion" }, { status: 400 });
      }
      // Supervisor accountability: record who reviewed and when (feeds supervisor metrics).
      await saveTaskMetadata(tg, { reviewedAt: new Date().toISOString(), reviewedBy: auth?.userId || null, autoApproved: false });
      // Points are computed and granted here — never on the client — so the value
      // is identical whichever path approved the task, and every point gets a ledger entry.
      let awarded = null;
      if (approve) {
        awarded = await awardTargetPoints(tg, auth?.userId || "manager", `اعتماد إنجاز — approved by ${auth?.name || "manager"}`);
      }
      if (tg.assignment_type === "member" && tg.employee_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: tg.employee_id,
            message: approve
              ? `Target "${tg.title || "Untitled"}" COMPLETED — proof approved (+${awarded?.points || 0} points).`
              : `Your completion proof for "${tg.title || "Untitled"}" was rejected: ${reason.trim()}. Please resubmit with new proof.`,
          }),
        });
      }
      return Response.json({ target: await withTaskMetadata(updated[0]), awardedPoints: awarded?.points || 0 });
    }

    if (action === "managerComplete") {
      if (!isManager) return Response.json({ error: "Forbidden: only managers can complete tasks" }, { status: 403 });
      const { targetId } = body;
      if (!targetId) return Response.json({ error: "Missing targetId" }, { status: 400 });
      const tg = await getScopedTarget(targetId);
      if (!tg) return Response.json({ error: "Target not found" }, { status: 404 });
      if (!canManageTarget(tg)) return Response.json({ error: "Forbidden" }, { status: 403 });
      if (tg.status === "completed") return Response.json({ target: tg });
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ status: "completed", completed_tasks: tg.task_target }),
      });
      const updated = await patchRes.json();
      if (!patchRes.ok) return Response.json({ error: updated?.message || "Failed to complete task" }, { status: 400 });
      if (tg.assignment_type === "member" && tg.employee_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: "POST",
          headers,
          body: JSON.stringify({ user_id: tg.employee_id, message: `✅ ${auth?.name || "Manager"} completed task: ${tg.title || "Untitled"}` }),
        });
      }
      return Response.json({ target: await withTaskMetadata(updated[0]) });
    }

    if (action === "disputeRejection") {
      const { targetId, message, escalationLevel, notifyUserIds } = body;
      if (!targetId || !(message || "").trim()) return Response.json({ error: "Missing fields" }, { status: 400 });
      const tg = await getScopedTarget(targetId);
      if (!tg) return Response.json({ error: "Target not found" }, { status: 404 });
      const isAssignee = tg.assignment_type === "station_team" ? tg.assignment_id === auth?.stationId :
        tg.assignment_type === "hq_team" ? !auth?.stationId : tg.employee_id === auth?.userId;
      if (!auth?.admin && !isAssignee) return Response.json({ error: "Forbidden" }, { status: 403 });
      const requestedLevel = Number(escalationLevel);
      const currentLevel = Number(tg.escalation_level || 0);
      if (!Number.isInteger(requestedLevel) || requestedLevel !== currentLevel + 1) return Response.json({ error: "Invalid escalation sequence" }, { status: 400 });
      const scope = await getCompanyScope();
      const recipients = [...new Set((Array.isArray(notifyUserIds) ? notifyUserIds : []).filter((id) => scope.employeeIds.has(id)))];
      if (recipients.length === 0) return Response.json({ error: "No valid escalation handler" }, { status: 400 });
      const employeeName = auth?.name || "Employee";
      const comments = Array.isArray(tg.comments) ? tg.comments : [];
      comments.push({
        id: crypto.randomUUID(),
        user_id: auth?.userId || null,
        user_name: employeeName,
        content: `🚩 ${message.trim()}`,
        files: [],
        is_issue: false,
        is_dispute: true,
        created_at: new Date().toISOString(),
      });
      const patch: Record<string, unknown> = { comments, escalation_level: requestedLevel };
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      const updated = await patchRes.json();
      if (!patchRes.ok) {
        return Response.json({ error: updated?.message || "Failed to submit objection — run: ALTER TABLE targets ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 0;" }, { status: 400 });
      }
      // Notify only validated handlers from the same company after the escalation is saved.
      for (const uid of recipients) {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: uid,
            message: `🚩 ${employeeName || "Employee"} escalated the rejection of "${tg.title || "Untitled"}": ${message.trim()}`,
          }),
        });
      }
      return Response.json({ target: await withTaskMetadata(updated[0]) });
    }

    if (action === "deleteTarget") {
      if (!isManager) {
        return Response.json({ error: "Forbidden: only managers can delete targets" }, { status: 403 });
      }
      const { targetId } = body;
      if (!targetId) return Response.json({ error: "Missing targetId" }, { status: 400 });
      const tg = await getScopedTarget(targetId);
      if (!tg) return Response.json({ error: "Target not found" }, { status: 404 });
      if (!canManageTarget(tg)) return Response.json({ error: "Forbidden" }, { status: 403 });
      await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(targetId)}`, {
        method: "DELETE",
        headers,
      });
      return Response.json({ ok: true });
    }

    if (action === "updateTarget") {
      if (!isManager) {
        return Response.json({ error: "Forbidden: only managers can edit targets" }, { status: 403 });
      }
      const { targetId, title, description, steps, priority, endDate, taskTarget, section, taskType, completionMode, effortWeight } = body;
      if (!targetId) return Response.json({ error: "Missing targetId" }, { status: 400 });
      const existingTg = await getScopedTarget(targetId);
      if (!existingTg) return Response.json({ error: "Target not found" }, { status: 404 });
      if (!canManageTarget(existingTg)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const patch: Record<string, unknown> = {};
      if (title !== undefined) {
        if (!String(title).trim()) return Response.json({ error: "Title is required" }, { status: 400 });
        patch.title = String(title).trim();
      }
      if (description !== undefined) patch.description = description;
      if (steps !== undefined) patch.steps = steps;
      if (priority !== undefined) {
        if (!["urgent", "high", "medium", "low"].includes(priority)) return Response.json({ error: "Invalid priority" }, { status: 400 });
        patch.priority = priority;
      }
      if (endDate !== undefined) {
        if (!Number.isFinite(new Date(endDate).getTime()) || new Date(endDate) <= new Date(existingTg.start_date)) return Response.json({ error: "Invalid end date" }, { status: 400 });
        patch.end_date = endDate;
      }
      if (taskTarget !== undefined) {
        const nextTarget = Number(taskTarget);
        if (!Number.isFinite(nextTarget) || nextTarget <= 0 || nextTarget < Number(existingTg.completed_tasks || 0)) return Response.json({ error: "Target cannot be below completed progress" }, { status: 400 });
        patch.task_target = nextTarget;
      }
      if (section !== undefined) patch.section = section;
      if (taskType !== undefined) patch.task_type = taskType;
      if (completionMode !== undefined && !["onsite", "remote"].includes(completionMode)) return Response.json({ error: "Invalid completion mode" }, { status: 400 });
      if (completionMode !== undefined && !canSetCompletionMode) return Response.json({ error: "Forbidden" }, { status: 403 });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      const updated = await res.json();
      if (!res.ok) {
        return Response.json({ error: updated?.message || "Failed to update target" }, { status: 400 });
      }
      const updatedTarget = Array.isArray(updated) ? updated[0] : updated;
      if (completionMode !== undefined) {
        const conversion = existingTg.completionMode !== "remote" && completionMode === "remote"
          ? { completionMode, remoteConvertedBy: auth?.userId || auth?.name || "owner", remoteConvertedAt: new Date().toISOString() }
          : { completionMode };
        await saveTaskMetadata(updatedTarget, conversion);
      }
      if (effortWeight !== undefined && effortWeight !== null && effortWeight !== "") {
        await saveTaskMetadata(updatedTarget, { effortWeight: Math.min(5, Math.max(1, Number(effortWeight) || 1)) });
      }
      return Response.json({ target: await withTaskMetadata(updatedTarget) });
    }

    if (action === "convertToRemote") {
      if (!isManager || !canSetCompletionMode) return Response.json({ error: "Forbidden" }, { status: 403 });
      const target = await getScopedTarget(body.targetId);
      if (!target) return Response.json({ error: "Target not found" }, { status: 404 });
      if (!canManageTarget(target)) return Response.json({ error: "Forbidden" }, { status: 403 });
      await saveTaskMetadata(target, {
        completionMode: "remote",
        remoteConvertedBy: auth?.userId || auth?.name || "owner",
        remoteConvertedAt: new Date().toISOString(),
      });
      const recipients = await taskVisibilityRecipients(target);
      const message = `${auth?.name || "المدير"} حوّل المهمة إلى عن بُعد: ${target.title || "مهمة"}`;
      await Promise.all(recipients.map((recipient) => fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: recipient.employeeId, message }),
      })));
      return Response.json({ target: await withTaskMetadata(target) });
    }

    if (action === "getPointsLedger") {
      // Everyone may audit their OWN score. Supervisors may audit only the
      // employees inside their management scope — never the whole company.
      const requestedId = String(body.employeeId || auth?.userId || "");
      if (!requestedId) return Response.json({ error: "Missing employeeId" }, { status: 400 });
      const isSelf = auth?.userId === requestedId;
      if (!isSelf) {
        if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
        const records = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId: requestedId });
        const subject = records[0];
        if (!subject) return Response.json({ error: "Employee not found" }, { status: 404 });
        if (!canManageStation(subject.stationId)) return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const entries = await base44.asServiceRole.entities.PointsLedger.filter(
        { companyId: auth.companyId, employeeId: requestedId }, "-awardedAt", 200
      );
      const total = entries.reduce((sum, entry) => sum + (Number(entry.points) || 0), 0);
      return Response.json({ entries, total });
    }

    if (action === "listNotifications") {
      // Signed-in employees can only read their own notifications; owner sessions
      // (no userId) may only read notifications of members of their own company.
      const notifUserId = auth?.userId || body.userId;
      if (!(await canActAs(notifUserId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${encodeURIComponent(notifUserId)}&order=created_at.desc&limit=20`,
        { headers }
      );
      const rows = await res.json();
      return Response.json({ notifications: rows });
    }

    if (action === "listUnreadInbox") {
      if (!auth?.userId) return Response.json({ error: "Forbidden" }, { status: 403 });
      const me = safeId(auth.userId);
      const threads = [];
      const dmRes = await fetch(
        `${SUPABASE_URL}/rest/v1/direct_messages?or=(sender_id.eq.${me},receiver_id.eq.${me})&order=created_at.desc&limit=80`,
        { headers },
      );
      const dms = dmRes.ok ? await dmRes.json() : [];
      const seenDm = new Set();
      for (const row of Array.isArray(dms) ? dms : []) {
        if (Array.isArray(row.deleted_for) && row.deleted_for.includes(auth.userId)) continue;
        const otherId = String(row.sender_id) === String(auth.userId) ? row.receiver_id : row.sender_id;
        const key = `dm:${otherId}`;
        if (!otherId || seenDm.has(key)) continue;
        seenDm.add(key);
        threads.push({
          key,
          lastAt: row.created_at,
          fromId: row.sender_id,
          preview: chatPreviewText(row),
        });
      }
      const requested = (Array.isArray(body.stationIds) ? body.stationIds : []).slice(0, 24);
      const resolved = [];
      for (const key of requested) {
        const roomId = await resolveRoomId(key);
        if (roomId) resolved.push({ key: String(key), roomId });
      }
      if (resolved.length) {
        const inList = resolved.map((item) => `"${String(item.roomId).replace(/"/g, "")}"`).join(",");
        const chatRes = await fetch(
          `${SUPABASE_URL}/rest/v1/station_chat?station_id=in.(${inList})&order=created_at.desc&limit=120`,
          { headers },
        );
        const chats = chatRes.ok ? await chatRes.json() : [];
        const byRoom = new Map(resolved.map((item) => [item.roomId, item.key]));
        const seenRoom = new Set();
        for (const row of Array.isArray(chats) ? chats : []) {
          const threadKey = byRoom.get(row.station_id);
          if (!threadKey || seenRoom.has(threadKey)) continue;
          seenRoom.add(threadKey);
          threads.push({
            key: threadKey,
            lastAt: row.created_at,
            fromId: row.user_id,
            preview: chatPreviewText(row),
          });
        }
      }
      return Response.json({ threads });
    }

    if (action === "dismissNotification") {
      const notifUserId = auth?.userId || body.userId;
      const notificationId = String(body.notificationId || "");
      if (!notificationId || !(await canActAs(notifUserId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const result = await fetch(
        `${SUPABASE_URL}/rest/v1/notifications?id=eq.${encodeURIComponent(notificationId)}&user_id=eq.${encodeURIComponent(notifUserId)}`,
        { method: "DELETE", headers }
      );
      if (!result.ok) return Response.json({ error: "Failed to dismiss notification" }, { status: 400 });
      return Response.json({ ok: true });
    }

    if (action === "addComment") {
      const { targetId, content, files, isIssue } = body;
      if (!targetId || (!content && (!files || files.length === 0))) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
      }
      const tg = await getScopedTarget(targetId);
      if (!tg) return Response.json({ error: "Target not found" }, { status: 404 });
      // Comments are limited to the assignee and managers responsible for this target's scope.
      const isAssignee = tg.assignment_type === "station_team" ? tg.assignment_id === auth?.stationId :
        tg.assignment_type === "hq_team" ? !auth?.stationId : tg.employee_id === auth?.userId;
      if (!auth?.admin && !isAssignee && !canManageTarget(tg)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const userId = auth?.userId || null;
      const userName = auth?.name || "User";
      const comments = Array.isArray(tg.comments) ? tg.comments : [];
      const cleanFiles = Array.isArray(files)
        ? files
            .filter((f) => f && f.url)
            .map((f) => ({ url: f.url, name: f.name || "file", type: f.type || "file" }))
        : [];
      const newComment = {
        id: crypto.randomUUID(),
        user_id: userId,
        user_name: userName,
        content: content || "",
        files: cleanFiles,
        is_issue: !!isIssue,
        created_at: new Date().toISOString(),
      };
      comments.push(newComment);
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(targetId)}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({ comments }),
        }
      );
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        return Response.json({ error: patchData?.message || "Failed to save comment — run: ALTER TABLE targets ADD COLUMN IF NOT EXISTS comments jsonb DEFAULT '[]'::jsonb;" }, { status: 400 });
      }
      if (isIssue) {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: tg.manager_id,
            message: `⚠️ ${userName || "Employee"} reported a stoppage issue on "${tg.title || "Untitled"}": ${content}`,
          }),
        });
      }
      return Response.json({ comment: newComment, comments });
    }

    if (action === "listFolders") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/task_folders?order=sort_order.asc,path.asc`, { headers });
      const rows = await res.json();
      if (!res.ok) return Response.json({ folders: [] });
      if (!auth?.companyId) return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
      const sts = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
      let stationIds = sts.map((station) => station.stationId);
      if (auth.role === "pgm") stationIds = stationIds.filter((id) => (auth.managedStations || []).includes(id));
      if (["station_manager", "employee"].includes(auth.role)) stationIds = stationIds.filter((id) => id === auth.stationId);
      const allowed = new Set(stationIds);
      const visibleFolders = (rows || [])
        .filter((folder) => allowed.has(folder.station_id));
      return Response.json({ folders: visibleFolders });
    }

    if (action === "createFolder") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { stationId, path, sortOrder } = body;
      if (!stationId || !path) return Response.json({ error: "Missing fields" }, { status: 400 });
      const roomId = await resolveRoomId(stationId);
      if (!roomId || !canManageStation(stationId)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/task_folders?station_id=eq.${encodeURIComponent(roomId)}&path=eq.${encodeURIComponent(path)}`,
        { headers }
      );
      const existing = await checkRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        return Response.json({ folder: { ...existing[0], station_id: stationId } });
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/task_folders`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ station_id: roomId, path, sort_order: Number(sortOrder) || 0 }),
      });
      const created = await res.json();
      if (!res.ok) {
        return Response.json({ error: created?.message || "Failed to create section — run: CREATE TABLE IF NOT EXISTS task_folders (id uuid primary key default gen_random_uuid(), station_id text, path text, sort_order integer default 0, created_at timestamptz default now());" }, { status: 400 });
      }
      const createdFolder = Array.isArray(created) ? created[0] : created;
      return Response.json({ folder: { ...createdFolder, station_id: stationId } });
    }

    if (action === "reorderFolders") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { items } = body;
      if (!Array.isArray(items) || items.length === 0) return Response.json({ error: "Missing items" }, { status: 400 });
      const validated = [];
      for (const item of items.filter((entry) => entry && entry.id)) {
        const folderRes = await fetch(`${SUPABASE_URL}/rest/v1/task_folders?id=eq.${encodeURIComponent(item.id)}`, { headers });
        const folderRows = await folderRes.json();
        const folder = Array.isArray(folderRows) && folderRows[0];
        const stationId = folder?.station_id;
        if (!folder || !canManageStation(stationId)) return Response.json({ error: "Forbidden" }, { status: 403 });
        validated.push(item);
      }
      await Promise.all(validated.map((item) => fetch(`${SUPABASE_URL}/rest/v1/task_folders?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH", headers, body: JSON.stringify({ sort_order: Number(item.sortOrder) || 0 }),
      })));
      return Response.json({ ok: true });
    }

    if (action === "renameFolder") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { stationId, oldPath, newPath } = body;
      if (!stationId || !oldPath || !newPath) return Response.json({ error: "Missing fields" }, { status: 400 });
      const roomId = await resolveRoomId(stationId);
      if (!roomId || !canManageStation(stationId)) return Response.json({ error: "Forbidden" }, { status: 403 });
      // Two plain-filter queries instead of an or=() tree — user-typed folder
      // paths can contain parentheses/commas that would break the logical tree.
      const [exactRes, nestedRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/task_folders?station_id=eq.${encodeURIComponent(roomId)}&path=eq.${encodeURIComponent(oldPath)}`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/task_folders?station_id=eq.${encodeURIComponent(roomId)}&path=like.${encodeURIComponent(oldPath)}/*`, { headers }),
      ]);
      const rows = [...(await exactRes.json() || []), ...(await nestedRes.json() || [])];
      for (const row of rows || []) {
        const updatedPath = row.path === oldPath ? newPath : newPath + row.path.slice(oldPath.length);
        await fetch(`${SUPABASE_URL}/rest/v1/task_folders?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ path: updatedPath }),
        });
      }
      return Response.json({ ok: true });
    }

    if (action === "deleteFolder") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { stationId, path } = body;
      if (!stationId || !path) return Response.json({ error: "Missing fields" }, { status: 400 });
      const roomId = await resolveRoomId(stationId);
      if (!roomId || !canManageStation(stationId)) return Response.json({ error: "Forbidden" }, { status: 403 });
      // Two plain-filter deletes instead of an or=() tree (injection-safe).
      await fetch(`${SUPABASE_URL}/rest/v1/task_folders?station_id=eq.${encodeURIComponent(roomId)}&path=eq.${encodeURIComponent(path)}`, { method: "DELETE", headers });
      await fetch(`${SUPABASE_URL}/rest/v1/task_folders?station_id=eq.${encodeURIComponent(roomId)}&path=like.${encodeURIComponent(path)}/*`, { method: "DELETE", headers });
      return Response.json({ ok: true });
    }

    if (action === "listChatMessages") {
      const roomId = await resolveRoomId(body.stationId);
      if (!roomId) return Response.json({ error: "Forbidden" }, { status: 403 });
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/station_chat?station_id=eq.${encodeURIComponent(roomId)}&order=created_at.asc&limit=200`,
        { headers }
      );
      const rows = await res.json();
      if (!res.ok) return Response.json({ messages: [] });
      return Response.json({ messages: rows || [] });
    }

    if (action === "sendChatMessage") {
      const { stationId, userId, userName, text, files } = body;
      if (!stationId || !userId || (!text && (!files || files.length === 0))) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
      }
      const roomId = await resolveRoomId(stationId);
      if (!roomId || !(await canActAs(userId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const actorName = await actorNameFor(userId);
      const cleanFiles = cleanChatFiles(files);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/station_chat`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          station_id: roomId,
          user_id: userId,
          user_name: actorName,
          text: text || "",
          files: cleanFiles,
        }),
      });
      const created = await res.json();
      if (!res.ok) {
        return Response.json({ error: created?.message || "Failed to send message — run: CREATE TABLE IF NOT EXISTS station_chat (id uuid primary key default gen_random_uuid(), station_id text, user_id text, user_name text, text text, files jsonb DEFAULT '[]'::jsonb, created_at timestamptz default now());" }, { status: 400 });
      }
      return Response.json({ message: Array.isArray(created) ? created[0] : created });
    }

    // ---- Delete a station/group chat message: only the sender, and only within ----
    // 3 minutes of sending — after that the message is permanent for everyone.
    if (action === "deleteChatMessage") {
      const { messageId, userId } = body;
      if (!messageId || !userId) return Response.json({ error: "Missing fields" }, { status: 400 });
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/station_chat?id=eq.${encodeURIComponent(messageId)}`, { headers });
      const rows = await getRes.json();
      const msg = Array.isArray(rows) && rows[0];
      if (!msg) return Response.json({ error: "Message not found" }, { status: 404 });
      const rawRoom = msg.station_id === `${auth.companyId}_all` ? "all" : msg.station_id;
      if (!(await canActAs(userId)) || msg.user_id !== userId || (await resolveRoomId(rawRoom)) !== msg.station_id) return Response.json({ error: "Forbidden" }, { status: 403 });
      const ageMs = Date.now() - new Date(msg.created_at).getTime();
      if (ageMs > 3 * 60 * 1000) {
        return Response.json({ error: "Messages can only be deleted within 3 minutes of sending" }, { status: 403 });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/station_chat?id=eq.${encodeURIComponent(messageId)}`, { method: "DELETE", headers });
      return Response.json({ ok: true });
    }

    if (action === "listDirectMessages") {
      const { userId, otherUserId } = body;
      if (!userId || !otherUserId) return Response.json({ error: "Missing fields" }, { status: 400 });
      // Only two members of the same company may read the conversation.
      const dmScope = await getCompanyScope();
      if (!(await canActAs(userId)) || !dmScope.employeeIds.has(otherUserId)) return Response.json({ error: "Forbidden" }, { status: 403 });
      // safeId strips parentheses/commas so ids can never break out of the or=() tree.
      const me = safeId(userId);
      const other = safeId(otherUserId);
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/direct_messages?or=(and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me}))&order=created_at.asc&limit=200`,
        { headers }
      );
      const rows = await res.json();
      if (!res.ok) return Response.json({ messages: [] });
      const visible = (rows || []).filter((m) => !(Array.isArray(m.deleted_for) && m.deleted_for.includes(userId)));
      return Response.json({ messages: visible });
    }

    // ---- Delete a sent DM: within 3 minutes it's removed for both sides, after ----
    // that it only disappears from the sender's own view (stays for the other side).
    if (action === "deleteDirectMessage") {
      const { messageId, userId } = body;
      if (!messageId || !userId) return Response.json({ error: "Missing fields" }, { status: 400 });
      // The claimed identity must match the authenticated session.
      if (!(await canActAs(userId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/direct_messages?id=eq.${encodeURIComponent(messageId)}`, { headers });
      const rows = await getRes.json();
      const msg = Array.isArray(rows) && rows[0];
      if (!msg) return Response.json({ error: "Message not found" }, { status: 404 });
      const dmScope = await getCompanyScope();
      const otherParticipant = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (msg.sender_id !== userId || !dmScope.employeeIds.has(otherParticipant)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const ageMs = Date.now() - new Date(msg.created_at).getTime();
      if (ageMs <= 3 * 60 * 1000) {
        await fetch(`${SUPABASE_URL}/rest/v1/direct_messages?id=eq.${encodeURIComponent(messageId)}`, { method: "DELETE", headers });
        return Response.json({ ok: true, deletedForEveryone: true });
      }
      const deletedFor = Array.isArray(msg.deleted_for) ? msg.deleted_for : [];
      if (!deletedFor.includes(userId)) deletedFor.push(userId);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/direct_messages?id=eq.${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ deleted_for: deletedFor }),
      });
      if (!res.ok) {
        const err = await res.json();
        return Response.json({ error: err?.message || "Failed to delete — run: ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted_for jsonb DEFAULT '[]'::jsonb;" }, { status: 400 });
      }
      return Response.json({ ok: true, deletedForEveryone: false });
    }

    if (action === "sendDirectMessage") {
      const { senderId, senderName, receiverId, text, files } = body;
      if (!senderId || !receiverId || (!text && (!files || files.length === 0))) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
      }
      // Messages may only be sent as the authenticated user to a company colleague.
      const dmScope = await getCompanyScope();
      if (!(await canActAs(senderId)) || !dmScope.employeeIds.has(receiverId)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const actorName = await actorNameFor(senderId);
      const cleanFiles = cleanChatFiles(files);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/direct_messages`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          sender_id: senderId,
          sender_name: actorName,
          receiver_id: receiverId,
          text: text || "",
          files: cleanFiles,
        }),
      });
      const created = await res.json();
      if (!res.ok) {
        return Response.json({ error: created?.message || "Failed to send message — run: CREATE TABLE IF NOT EXISTS direct_messages (id uuid primary key default gen_random_uuid(), sender_id text, sender_name text, receiver_id text, text text, files jsonb DEFAULT '[]'::jsonb, created_at timestamptz default now());" }, { status: 400 });
      }
      return Response.json({ message: Array.isArray(created) ? created[0] : created });
    }

    if (action === "createCallSession") {
      const { chatType, roomId, otherUserId, mode, participantIds, initiatorName } = body;
      if (!auth?.userId || !["audio", "video"].includes(mode)) return Response.json({ error: "Invalid call" }, { status: 400 });
      const resolved = await resolveCallRoom(chatType, roomId, otherUserId);
      if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
      const scope = await getCompanyScope();
      const participants = [...new Set((participantIds || []).filter((id) => scope.employeeIds.has(id)))];
      if (!participants.includes(auth.userId)) participants.push(auth.userId);
      const activeCalls = await base44.asServiceRole.entities.CallSession.filter({ companyId: auth.companyId, roomId: resolved, status: "active" });
      if (activeCalls.length) return Response.json({ call: activeCalls[0] });
      const call = await base44.asServiceRole.entities.CallSession.create({ companyId: auth.companyId, roomId: resolved, chatType, mode, initiatorId: auth.userId, initiatorName: initiatorName || auth.name, participantIds: participants, status: "active", signals: [], startedAt: new Date().toISOString(), endedAt: null });
      return Response.json({ call });
    }

    if (action === "listCallSessions") {
      if (!auth?.userId) return Response.json({ calls: [] });
      const resolved = await resolveCallRoom(body.chatType, body.roomId, body.otherUserId);
      if (!resolved) return Response.json({ calls: [] });
      const calls = await base44.asServiceRole.entities.CallSession.filter({ companyId: auth.companyId, roomId: resolved, status: "active" });
      return Response.json({ calls: calls.filter((item) => (item.participantIds || []).includes(auth.userId)).slice(0, 1) });
    }

    if (action === "sendCallSignal") {
      const calls = await base44.asServiceRole.entities.CallSession.filter({ id: body.callId, companyId: auth.companyId, status: "active" });
      const call = calls[0];
      if (!call || !(call.participantIds || []).includes(auth.userId)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const signals = Array.isArray(call.signals) ? call.signals.slice(-299) : [];
      signals.push({ id: crypto.randomUUID(), from: auth.userId, to: body.to || null, type: body.type, data: body.data || null, createdAt: new Date().toISOString() });
      await base44.asServiceRole.entities.CallSession.update(call.id, { signals });
      return Response.json({ ok: true });
    }

    if (action === "endCallSession") {
      const calls = await base44.asServiceRole.entities.CallSession.filter({ id: body.callId, companyId: auth.companyId });
      const call = calls[0];
      if (!call || !(call.participantIds || []).includes(auth.userId)) return Response.json({ error: "Forbidden" }, { status: 403 });
      if (call.status === "active") await base44.asServiceRole.entities.CallSession.update(call.id, { status: "ended", endedAt: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    if (action === "runEscalationSweep") {
      // Server-driven sweep (called by a scheduled workflow) — marks newly overdue
      // targets and sends repeat escalation notifications for targets still overdue,
      // so escalation no longer depends on someone having the app open.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/targets?status=in.(active,overdue)&order=created_at.desc`, { headers });
      const rows = await res.json();
      if (!res.ok) return Response.json({ error: rows?.message || "Failed to fetch targets" }, { status: 400 });
      const now = Date.now();
      let newlyOverdue = 0;
      let escalated = 0;
      for (const tg of rows || []) {
        if (tg.status === "active" && new Date(tg.end_date).getTime() < now) {
          await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              user_id: tg.manager_id,
              message: `Target "${tg.title || "Untitled"}" is OVERDUED — time expired before reaching the goal (${tg.completed_tasks}/${tg.task_target}).`,
            }),
          });
          if (tg.assignment_type === "member" && tg.employee_id) {
            await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                user_id: tg.employee_id,
                message: `Your target "${tg.title || "Untitled"}" is OVERDUED — time expired (${tg.completed_tasks}/${tg.task_target}).`,
              }),
            });
          }
          await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(tg.id)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status: "overdue" }),
          });
          newlyOverdue++;
          continue;
        }
        if (tg.status === "overdue") {
          const comments = Array.isArray(tg.comments) ? tg.comments : [];
          const lastEscalation = [...comments].reverse().find((c) => c.is_escalation);
          const hoursSince = lastEscalation ? (now - new Date(lastEscalation.created_at).getTime()) / 3600000 : Infinity;
          if (hoursSince >= 24) {
            const daysOverdue = Math.max(1, Math.ceil((now - new Date(tg.end_date).getTime()) / 86400000));
            comments.push({
              id: crypto.randomUUID(),
              user_id: "system",
              user_name: "System",
              content: `🔺 Automatic escalation — overdue by ${daysOverdue} day(s). Manager notified again.`,
              files: [],
              is_issue: false,
              is_escalation: true,
              created_at: new Date().toISOString(),
            });
            await fetch(`${SUPABASE_URL}/rest/v1/targets?id=eq.${encodeURIComponent(tg.id)}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify({ comments }),
            });
            await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                user_id: tg.manager_id,
                message: `🔺 Escalation: "${tg.title || "Untitled"}" is still overdue by ${daysOverdue} day(s) (${tg.completed_tasks}/${tg.task_target}).`,
              }),
            });
            escalated++;
          }
        }
      }
      return Response.json({ ok: true, newlyOverdue, escalated });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});