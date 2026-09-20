import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  buildShortDailyNote,
  checkApproveDailyGate,
  checkApproveDailyRoleGate,
  checkCloseShiftDailyGate,
  checkFileDailyGate,
  checkIssueSignedDailyGate,
  DEFAULT_SHIFT_END,
  deriveDailyRowStatus,
  deriveDailySummary,
  deriveStationFacts,
  riyadhDateKey,
} from "../../shared/dailyReportDerivations.ts";
import { deriveProofStage } from "../../shared/workProofDerivations.ts";
import { isOnApprovedLeave } from "../../shared/leaveDerivations.ts";

/**
 * do-not-invoke-from-frontend — store + Operations own the live daily/ops bags.
 * Writes stay on canonical `reports` / `tasks`. Legacy keys are read-only fallback.
 */
const REPORTS_CATEGORY = "reports";
const LEGACY_DAILY_CATEGORY = "dailyReports"; // do-not-write
const TASKS_CATEGORY = "tasks";
const TASKS_LEGACY_CATEGORY = "operationsTasks"; // do-not-write
const SAFETY_CATEGORY = "safety";
const PROOFS_CATEGORY = "workProofs";
const FILES_CATEGORY = "files";
const NOTIFS_CATEGORY = "notifications";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hmNow() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function isDailyRow(r: any) {
  if (!r) return false;
  if (r.kind === "daily" || r.type === "daily" || r.category === "daily") return true;
  // Legacy dailyReports blob rows (no kind, station + date + filed/approved).
  return !!(r.stationId && (r.dateKey || "filedAt" in r || "approved" in r) && !r.reportType);
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

    const loadBlob = async (category: string) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category });
      return rows[0] || null;
    };
    const saveBlob = async (category: string, payload: unknown) => {
      const blob = await loadBlob(category);
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: auth.companyId, category, payload });
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

    const dateKey = String(body.dateKey || riyadhDateKey());
    const shiftEnd = String(body.shiftEnd || DEFAULT_SHIFT_END);

    const loadAllReports = async () => {
      const primary = await loadBlob(REPORTS_CATEGORY);
      const legacy = await loadBlob(LEGACY_DAILY_CATEGORY);
      const fromPrimary = Array.isArray(primary?.payload) ? primary.payload : [];
      const fromLegacy = Array.isArray(legacy?.payload) ? legacy.payload : [];
      // Merge legacy daily rows that are not already present by id/station+date.
      const keys = new Set(
        fromPrimary
          .filter(isDailyRow)
          .map((r: any) => r.id || `${r.stationId}|${r.dateKey || ""}`),
      );
      const merged = [...fromPrimary];
      for (const r of fromLegacy) {
        if (!r) continue;
        const key = r.id || `${r.stationId}|${r.dateKey || ""}`;
        if (keys.has(key)) continue;
        merged.push({ ...r, kind: r.kind || "daily", companyId: r.companyId || auth.companyId });
        keys.add(key);
      }
      return merged;
    };

    const loadDayReports = async () => {
      const all = await loadAllReports();
      return all.filter((r: any) =>
        r
        && isDailyRow(r)
        && (!r.companyId || r.companyId === auth.companyId)
        && (r.dateKey === dateKey || !r.dateKey),
      );
    };

    const saveDayReports = async (dayReports: any[]) => {
      const all = await loadAllReports();
      const others = all.filter((r: any) => {
        if (!isDailyRow(r)) return true;
        if (r.companyId && r.companyId !== auth.companyId) return true;
        if (r.dateKey && r.dateKey !== dateKey) return true;
        if (!r.dateKey) {
          // Drop undated daily rows for stations we are rewriting today.
          const hit = dayReports.some((d) => d.stationId === r.stationId);
          return !hit;
        }
        return false;
      });
      const stamped = dayReports.map((r) => ({
        ...r,
        kind: "daily",
        companyId: auth.companyId,
        dateKey: r.dateKey || dateKey,
      }));
      await saveBlob(REPORTS_CATEGORY, [...others, ...stamped]);
    };

    const pushNotification = async (userId: string | null, text: string) => {
      if (!userId) return;
      const blob = await loadBlob(NOTIFS_CATEGORY);
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      payload.unshift({
        id: uid("ntf"),
        userId,
        text,
        read: false,
        createdAt: new Date().toISOString(),
      });
      await saveBlob(NOTIFS_CATEGORY, payload);
    };

    const buildBoard = async () => {
      const stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      const taskBlob = await loadBlob(TASKS_CATEGORY);
      let tasks = (Array.isArray(taskBlob?.payload) ? taskBlob.payload : []).filter((t: any) => t?.companyId === auth.companyId || !t?.companyId);
      if (!tasks.length) {
        const legacyTasks = await loadBlob(TASKS_LEGACY_CATEGORY);
        tasks = (Array.isArray(legacyTasks?.payload) ? legacyTasks.payload : []).filter((t: any) => t?.companyId === auth.companyId || !t?.companyId);
        if (tasks.length) await saveBlob(TASKS_CATEGORY, tasks);
      }
      const safetyBlob = await loadBlob(SAFETY_CATEGORY);
      const safety = Array.isArray(safetyBlob?.payload) ? safetyBlob.payload : [];
      const proofBlob = await loadBlob(PROOFS_CATEGORY);
      const proofs = (Array.isArray(proofBlob?.payload) ? proofBlob.payload : []).filter((p: any) => p?.companyId === auth.companyId || !p?.companyId);
      const dayReports = await loadDayReports();
      const byStation = new Map(dayReports.map((r: any) => [r.stationId, r]));

      const nowHm = hmNow();
      const shiftEnded = nowHm > shiftEnd;

      const rows = stations.map((st: any) => {
        const stationId = st.id;
        const report = byStation.get(stationId) || {
          stationId,
          companyId: auth.companyId,
          dateKey,
          filedAt: null,
          approved: false,
        };
        const tasksClosed = tasks.filter((t: any) =>
          t.stationId === stationId && (t.status === "completed" || t.approvedAt),
        ).length;
        const openHazards = (safety.find((s: any) => s.stationId === stationId)?.hazards || []).length;
        const proofsApproved = proofs.filter((p: any) => {
          if (p.stationId !== stationId) return false;
          const stage = deriveProofStage(p);
          return stage === "sealed" || stage === "accepted";
        }).length;
        const stationEmps = emps.filter((e: any) => e.stationId === stationId);
        const unexcusedAbsences = stationEmps.filter((e: any) =>
          e.attendanceStatus === "absent" && !isOnApprovedLeave(e.leaveRequests || [], dateKey),
        ).length;

        const facts = deriveStationFacts({ tasksClosed, openHazards, unexcusedAbsences, proofsApproved });
        const derived = deriveDailyRowStatus(report, { shiftEnd, shiftEnded });
        return {
          ...derived,
          stationName: st.name,
          filedBy: report.filedBy || null,
          note: report.note || null,
          approvedBy: report.approvedBy || null,
          approvedAt: report.approvedAt || null,
          returnReason: report.returnReason || null,
          facts,
          dateKey,
        };
      });

      return { rows, summary: deriveDailySummary(rows), dateKey, shiftEnd };
    };

    if (action === "board" || action === "summary") {
      const board = await buildBoard();
      if (action === "summary") return Response.json({ summary: board.summary, dateKey, shiftEnd });
      return Response.json(board);
    }

    if (action === "file") {
      const stationId = String(body.stationId || auth.stationId || "").trim();
      const reports = await loadDayReports();
      const idx = reports.findIndex((r: any) => r.stationId === stationId);
      let managedStations: string[] | null = null;
      if (auth.userId) {
        try {
          const me = await base44.asServiceRole.entities.Employee.get(auth.userId);
          managedStations = Array.isArray(me?.managedStations) ? me.managedStations.map(String) : null;
        } catch {
          managedStations = null;
        }
      }
      const fileGate = checkFileDailyGate({
        role: auth.role,
        owner: auth.owner,
        stationId,
        userStationId: auth.stationId,
        managedStations,
        report: idx >= 0 ? reports[idx] : null,
      });
      if (!fileGate.ok) {
        return Response.json({ error: fileGate.error, reason: fileGate.reason, reasonEn: fileGate.reasonEn }, { status: 422 });
      }
      const filedAt = String(body.filedAt || hmNow());
      let note = String(body.note || "").trim().slice(0, 160);
      if (!note) {
        const board = await buildBoard();
        const row = board.rows.find((r) => r.stationId === stationId);
        note = filedAt > shiftEnd
          ? "رُفع من الفرع بعد نهاية الوردية"
          : buildShortDailyNote(row?.facts || [], true);
      }
      const next = {
        id: idx >= 0 ? reports[idx].id : uid("dr"),
        companyId: auth.companyId,
        stationId,
        dateKey,
        kind: "daily",
        filedAt,
        filedBy: auth.name,
        note,
        approved: false,
        approvedAt: null,
        approvedBy: null,
        returnedAt: null,
        returnReason: null,
        isLateAtFile: filedAt > shiftEnd,
        status: "pending",
      };
      if (idx >= 0) reports[idx] = { ...reports[idx], ...next, approved: false, approvedAt: null, approvedBy: null };
      else reports.push(next);
      await saveDayReports(reports);
      await audit("daily_report_filed", `Daily report filed for ${stationId} at ${filedAt}`);
      return Response.json({ report: next, ok: true, isLate: next.isLateAtFile });
    }

    if (action === "approve" || action === "approveAll") {
      const roleGate = checkApproveDailyRoleGate(auth.role, auth.owner);
      if (!roleGate.ok) {
        return Response.json({ error: roleGate.error, reason: roleGate.reason, reasonEn: roleGate.reasonEn }, { status: 403 });
      }
      const reports = await loadDayReports();
      const ids = action === "approveAll"
        ? reports.filter((r: any) => r.filedAt && !r.approved).map((r: any) => r.stationId)
        : [String(body.stationId || "").trim()].filter(Boolean);
      if (!ids.length) return Response.json({ error: "Nothing to approve" }, { status: 400 });

      const approved: any[] = [];
      for (const stationId of ids) {
        const idx = reports.findIndex((r: any) => r.stationId === stationId);
        if (idx < 0) {
          if (action === "approve") return Response.json({ error: "REPORT_NOT_FOUND" }, { status: 404 });
          continue;
        }
        const gate = checkApproveDailyGate(reports[idx]);
        if (!gate.ok) {
          if (action === "approve") return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
          continue;
        }
        reports[idx] = {
          ...reports[idx],
          approved: true,
          approvedAt: new Date().toISOString(),
          approvedBy: auth.name,
          isLate: gate.isLate || !!reports[idx].isLateAtFile,
          status: "approved",
        };
        approved.push(reports[idx]);
      }
      await saveDayReports(reports);
      await audit("daily_report_approved", `Approved ${approved.length} daily report(s)`);
      return Response.json({ ok: true, approved });
    }

    if (action === "return") {
      const roleGate = checkApproveDailyRoleGate(auth.role, auth.owner);
      if (!roleGate.ok) {
        return Response.json({ error: roleGate.error, reason: roleGate.reason, reasonEn: roleGate.reasonEn }, { status: 403 });
      }
      const stationId = String(body.stationId || "").trim();
      const reason = String(body.reason || "").trim();
      const reports = await loadDayReports();
      const idx = reports.findIndex((r: any) => r.stationId === stationId);
      if (idx < 0) return Response.json({ error: "REPORT_NOT_FOUND" }, { status: 404 });
      const prev = reports[idx];
      if (!prev.approved) {
        return Response.json({
          error: "NOT_APPROVED",
          reason: "الإعادة للتصحيح بعد الاعتماد فقط.",
          reasonEn: "Return for correction is only after approval.",
        }, { status: 422 });
      }
      const prevLate = prev.isLate || prev.isLateAtFile || (prev.filedAt && prev.filedAt > shiftEnd);
      reports[idx] = {
        ...prev,
        approved: false,
        approvedAt: null,
        approvedBy: null,
        returnedAt: new Date().toISOString(),
        returnReason: reason || null,
        isLate: !!prevLate,
        status: "review",
      };
      await saveDayReports(reports);
      // Notify the filer when we can resolve them by name on Employee.
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      const author = emps.find((e: any) => e.name === prev.filedBy);
      if (author?.id) {
        await pushNotification(
          author.id,
          reason
            ? `أُعيد تقريرك اليومي للتصحيح: ${reason}`
            : "أُعيد تقريرك اليومي للتصحيح — راجع الملاحظات.",
        );
      }
      await audit("daily_report_returned", `Returned daily report ${stationId}`, { reason });
      return Response.json({ ok: true, report: reports[idx] });
    }

    if (action === "chase") {
      const roleGate = checkApproveDailyRoleGate(auth.role, auth.owner);
      if (!roleGate.ok) {
        return Response.json({ error: roleGate.error, reason: roleGate.reason, reasonEn: roleGate.reasonEn }, { status: 403 });
      }
      const board = await buildBoard();
      const missing = board.rows.filter((r) => r.missing);
      const names = missing.map((r) => r.stationName);
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      for (const row of missing) {
        const managers = emps.filter((e: any) =>
          e.stationId === row.stationId && (e.role === "station_manager" || managerRoles.includes(e.role)),
        );
        const text = `التقرير اليومي مستحق منذ نهاية الوردية — ${row.stationName}`;
        if (managers.length) {
          for (const m of managers) await pushNotification(m.id, text);
        } else {
          const owners = emps.filter((e: any) => e.role === "owner" || e.role === "director");
          for (const o of owners) await pushNotification(o.id, text);
        }
      }
      await audit("daily_report_chased", `Chased outstanding daily reports: ${names.join(", ") || "none"}`);
      return Response.json({ ok: true, chased: names, count: names.length });
    }

    if (action === "closeShift") {
      const stationId = String(body.stationId || auth.stationId || "").trim();
      if (!stationId) return Response.json({ error: "Missing stationId" }, { status: 400 });
      const reports = await loadDayReports();
      const report = reports.find((r: any) => r.stationId === stationId) || null;
      const gate = checkCloseShiftDailyGate(report);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
      }
      await audit("daily_shift_closed", `Shift closed for ${stationId} after approved daily report`);
      return Response.json({ ok: true, stationId, closed: true, dateKey });
    }

    if (action === "issueSigned") {
      const roleGate = checkApproveDailyRoleGate(auth.role, auth.owner);
      if (!roleGate.ok) {
        return Response.json({ error: roleGate.error, reason: roleGate.reason, reasonEn: roleGate.reasonEn }, { status: 403 });
      }
      const board = await buildBoard();
      const signedBlob = await loadBlob("dailySignedRecords");
      const signedPayload = Array.isArray(signedBlob?.payload) ? signedBlob.payload : [];
      const alreadyIssued = signedPayload.some((r: any) => r && r.dateKey === dateKey && r.companyId === auth.companyId);
      const issueGate = checkIssueSignedDailyGate({ rows: board.rows, alreadyIssued });
      if (!issueGate.ok) {
        return Response.json({ error: issueGate.error, reason: issueGate.reason, reasonEn: issueGate.reasonEn }, { status: 422 });
      }
      const record = {
        id: uid("drsig"),
        companyId: auth.companyId,
        dateKey,
        issuedAt: new Date().toISOString(),
        issuedBy: auth.name,
        summary: board.summary,
        rows: board.rows.map((r) => ({
          stationId: r.stationId,
          stationName: r.stationName,
          filedAt: r.filedAt,
          approved: r.approved,
          isLate: r.isLate,
          facts: r.facts,
        })),
      };
      signedPayload.unshift(record);
      await saveBlob("dailySignedRecords", signedPayload);

      const filesBlob = await loadBlob(FILES_CATEGORY);
      const files = Array.isArray(filesBlob?.payload) ? filesBlob.payload : [];
      files.unshift({
        id: uid("file"),
        type: "file",
        name: `حصيلة يومية موقّعة — ${dateKey}.pdf`,
        parentId: null,
        url: `#daily-signed-${record.id}`,
        size: 0,
        mimeType: "application/pdf",
        uploadedBy: auth.name,
        stationId: null,
        source: "daily_report",
        recordId: record.id,
        createdAt: new Date().toISOString(),
      });
      await saveBlob(FILES_CATEGORY, files);

      // Prefer entity SignatureRequest when available; fall back to blob.
      try {
        await base44.asServiceRole.entities.SignatureRequest.create({
          companyId: auth.companyId,
          status: "pending",
          title: `حصيلة يومية موقّعة — ${dateKey}`,
          source: "daily_report",
          recordId: record.id,
        });
      } catch {
        const sigBlob = await loadBlob("signatureRequests");
        const sigs = Array.isArray(sigBlob?.payload) ? sigBlob.payload : [];
        sigs.unshift({
          id: uid("sg"),
          companyId: auth.companyId,
          status: "pending",
          title: `حصيلة يومية موقّعة — ${dateKey}`,
          source: "daily_report",
          recordId: record.id,
          createdAt: new Date().toISOString(),
        });
        await saveBlob("signatureRequests", sigs);
      }

      await audit("daily_report_signed_issued", `Issued signed daily record for ${dateKey}`);
      return Response.json({ ok: true, record });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("dailyReport error:", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
