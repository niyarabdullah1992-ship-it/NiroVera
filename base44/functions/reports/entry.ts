import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  SCHEDULED_REPORTS,
  checkCloseTimesheetGate,
  checkGenerateReportGate,
  checkReopenTimesheetGate,
  deriveAttendanceOtAnalysis,
  deriveReportCards,
  deriveTimesheetDay,
  deriveTimesheetTotals,
  parsePeriod,
  sheetKey,
  type DayPunchLike,
  type OtDayLike,
  type TimesheetCloseLike,
} from "../../shared/reportsDerivations.ts";

/**
 * do-not-invoke-from-frontend — daily reports live on the `reports` blob (store + dailyReport).
 * Do not write `reportAnalytics`. Leftover callers should read `reports`.
 */
const REPORTS_CATEGORY = "reports";
const REPORTS_LEGACY_CATEGORY = "reportAnalytics"; // do-not-write

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type ReportsPayload = {
  lastRuns: Record<string, string>;
  closedSheets: Record<string, TimesheetCloseLike & { companyId: string }>;
  /** Demo / captured OT day rows for attendance_ot analysis (server-derived). */
  otDays: Array<OtDayLike & { companyId: string }>;
  punches: Array<DayPunchLike & { companyId: string; employeeId: string; stationId?: string }>;
};

function emptyPayload(): ReportsPayload {
  return { lastRuns: {}, closedSheets: {}, otDays: [], punches: [] };
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

    const manageRoles = [
      "owner", "director", "ops_manager", "admin", "pgm", "hr_manager", "hr", "station_manager",
    ];
    const canManage = auth.owner || auth.admin || manageRoles.includes(String(auth.role || ""));

    const loadBlob = async () => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category: REPORTS_LEGACY_CATEGORY,
      });
      return rows[0] || null;
    };

    const loadPayload = async (): Promise<ReportsPayload> => {
      const blob = await loadBlob();
      const raw = blob?.payload && typeof blob.payload === "object" ? blob.payload : {};
      const base = emptyPayload();
      if (raw.lastRuns && typeof raw.lastRuns === "object") {
        for (const [k, v] of Object.entries(raw.lastRuns as Record<string, unknown>)) {
          if (typeof v === "string") base.lastRuns[k] = v;
        }
      }
      if (raw.closedSheets && typeof raw.closedSheets === "object") {
        for (const [k, v] of Object.entries(raw.closedSheets as Record<string, TimesheetCloseLike & { companyId?: string }>)) {
          if (v && v.companyId === auth.companyId) base.closedSheets[k] = v as TimesheetCloseLike & { companyId: string };
        }
      }
      base.otDays = (Array.isArray(raw.otDays) ? raw.otDays : []).filter(
        (d: OtDayLike & { companyId?: string }) => d && d.companyId === auth.companyId && d.employeeId,
      );
      base.punches = (Array.isArray(raw.punches) ? raw.punches : []).filter(
        (p: DayPunchLike & { companyId?: string; employeeId?: string }) =>
          p && p.companyId === auth.companyId && p.employeeId && p.date,
      );
      return base;
    };

    const savePayload = async (_payload: ReportsPayload) => {
      // do-not-write reportAnalytics. Canonical `reports` is the daily-report array —
      // never persist this analytics object onto that bag.
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

    const buildBoard = (data: ReportsPayload, nowMs = Date.now()) => {
      const cards = deriveReportCards(data.lastRuns, nowMs);
      const analysis = deriveAttendanceOtAnalysis(data.otDays);
      return {
        ok: true,
        reportCards: cards,
        scheduled: SCHEDULED_REPORTS,
        analysis,
        sheetSubAr:
          "يوم بيوم للفترة، بالقواعد نفسها: سماح 10 دقائق، ووردية 8 ساعات، وما زاد إضافي. هذا هو المستند الذي يُقفل عليه مسير الرواتب.",
        sheetSubEn:
          "Day by day for the period: a 10-minute grace, an 8-hour shift, and anything beyond counted as overtime. This is the document a payroll run closes against.",
      };
    };

    if (action === "list") {
      const data = await loadPayload();
      return Response.json(buildBoard(data));
    }

    if (action === "seedDemo") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      if (data.otDays.length > 0 || Object.keys(data.lastRuns).length > 0) {
        return Response.json(buildBoard(data));
      }
      const period = "2026-08";
      const demoOt: Array<OtDayLike & { companyId: string }> = [];
      const heads = [
        { id: "e_sa", name: "سعود الحربي", st: "jbl1" },
        { id: "e_as", name: "عبدالله الشمري", st: "jbl2" },
        { id: "e_tm", name: "تركي المطيري", st: "jbl1" },
        { id: "e_kz", name: "خالد الزهراني", st: "jbl2" },
        { id: "e_fq", name: "فهد القحطاني", st: "jbl2" },
      ];
      for (let d = 1; d <= 7; d++) {
        const date = `2026-08-${String(d).padStart(2, "0")}`;
        for (const h of heads) {
          const ot = h.st === "jbl2" ? 90 + d * 5 : d === 3 ? 45 : 0;
          const late = d === 2 || d === 5 ? 18 : 0;
          demoOt.push({
            companyId: auth.companyId,
            employeeId: h.id,
            employeeName: h.name,
            stationId: h.st,
            date,
            ordinaryMinutes: 8 * 60,
            overtimeMinutes: ot,
            lateMinutes: late,
            status: late ? "late" : "present",
          });
        }
      }
      // Repeat absences for analysis
      demoOt.push(
        { companyId: auth.companyId, employeeId: "e_as", employeeName: "عبدالله الشمري", stationId: "jbl2", date: "2026-08-12", ordinaryMinutes: 0, overtimeMinutes: 0, status: "absent" },
        { companyId: auth.companyId, employeeId: "e_as", employeeName: "عبدالله الشمري", stationId: "jbl2", date: "2026-08-19", ordinaryMinutes: 0, overtimeMinutes: 0, status: "absent" },
      );
      const punches: ReportsPayload["punches"] = [
        { companyId: auth.companyId, employeeId: "e_sa", stationId: "jbl1", date: "2026-08-01", checkIn: "07:05", checkOut: "16:10" },
        { companyId: auth.companyId, employeeId: "e_sa", stationId: "jbl1", date: "2026-08-02", checkIn: "07:22", checkOut: "15:00" },
        { companyId: auth.companyId, employeeId: "e_sa", stationId: "jbl1", date: "2026-08-03", checkIn: "07:00", checkOut: null },
        { companyId: auth.companyId, employeeId: "e_sa", stationId: "jbl1", date: "2026-08-04", onLeave: true, status: "leave" },
        { companyId: auth.companyId, employeeId: "e_sa", stationId: "jbl1", date: "2026-08-05", restDay: true, status: "rest" },
        { companyId: auth.companyId, employeeId: "e_sa", stationId: "jbl1", date: "2026-08-06", checkIn: "07:00", checkOut: "15:30" },
      ];
      data.otDays = demoOt;
      data.punches = punches;
      data.lastRuns = {
        consolidated_daily: new Date(Date.now() - 2 * 3600_000).toISOString(),
        attendance_ot: new Date(Date.now() - 26 * 3600_000).toISOString(),
      };
      await savePayload(data);
      await audit("reports.seedDemo", `Seeded report analytics demo for ${period}`);
      return Response.json(buildBoard(data));
    }

    if (action === "generate") {
      const data = await loadPayload();
      const gate = checkGenerateReportGate({
        reportId: body.reportId,
        period: body.period,
        actor: auth,
        scopeEmpty: body.scopeEmpty === true,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          gate,
        }, { status: 400 });
      }
      const nowIso = new Date().toISOString();
      data.lastRuns[gate.entry.id] = nowIso;
      await savePayload(data);
      await audit("reports.generate", `Generated ${gate.entry.id}`, {
        newValue: { reportId: gate.entry.id, period: gate.period, format: gate.entry.format },
      });

      let payload: Record<string, unknown> = {
        reportId: gate.entry.id,
        format: gate.entry.format,
        period: gate.period,
        generatedAt: nowIso,
        titleAr: gate.entry.titleAr,
        titleEn: gate.entry.titleEn,
      };
      if (gate.entry.id === "attendance_ot") {
        payload = { ...payload, analysis: deriveAttendanceOtAnalysis(data.otDays) };
      }
      if (gate.entry.id === "consolidated_daily") {
        payload = { ...payload, note: "Use dailyReport board for station filing/approval; this run stamps the library lastRun." };
      }
      return Response.json({ ok: true, ...payload, ...buildBoard(data) });
    }

    if (action === "timesheet") {
      const data = await loadPayload();
      const employeeId = String(body.employeeId || "").trim();
      const period = String(body.period || "").trim();
      if (!employeeId) {
        return Response.json({
          error: "EMPLOYEE_REQUIRED",
          reason: "اختر موظفًا.",
          reasonEn: "Pick an employee.",
        }, { status: 400 });
      }
      if (!parsePeriod(period)) {
        return Response.json({
          error: "PERIOD_REQUIRED",
          reason: "فترة غير صالحة.",
          reasonEn: "Invalid period.",
        }, { status: 400 });
      }
      const key = sheetKey(employeeId, period);
      const sheet = data.closedSheets[key] || {
        companyId: auth.companyId,
        employeeId,
        period,
        closed: false,
      };
      const punches = data.punches.filter((p) => p.employeeId === employeeId && p.date.startsWith(period));
      const days = punches.map((p) => deriveTimesheetDay(p));
      const totals = deriveTimesheetTotals(days);
      return Response.json({
        ok: true,
        employeeId,
        period,
        sheet,
        days,
        totals,
        canClose: !sheet.closed && totals.openCheckouts === 0,
        closeGate: checkCloseTimesheetGate({
          sheet,
          employeeId,
          period,
          openCheckouts: totals.openCheckouts,
        }),
      });
    }

    if (action === "closeTimesheet") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      const employeeId = String(body.employeeId || "").trim();
      const period = String(body.period || "").trim();
      const key = sheetKey(employeeId, period);
      const existing = data.closedSheets[key] || {
        companyId: auth.companyId,
        employeeId,
        period,
        closed: false,
      };
      const punches = data.punches.filter((p) => p.employeeId === employeeId && p.date.startsWith(period));
      const totals = deriveTimesheetTotals(punches.map((p) => deriveTimesheetDay(p)));
      const gate = checkCloseTimesheetGate({
        sheet: existing,
        employeeId,
        period,
        openCheckouts: totals.openCheckouts,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          gate,
          totals,
        }, { status: 400 });
      }
      const payrollRunId = uid("pay");
      const closed: TimesheetCloseLike & { companyId: string } = {
        companyId: auth.companyId,
        employeeId: gate.employeeId,
        period: gate.period,
        closed: true,
        closedAt: new Date().toISOString(),
        closedBy: auth.name,
        payrollRunId,
      };
      data.closedSheets[key] = closed;
      await savePayload(data);
      await audit("reports.closeTimesheet", `Closed timesheet ${key} → payroll ${payrollRunId}`, {
        newValue: { totals, payrollRunId },
      });
      return Response.json({
        ok: true,
        sheet: closed,
        totals,
        messageAr: `أُقفل كشف ${gate.period} وانتقل إلى مسير الرواتب.`,
        messageEn: `Timesheet ${gate.period} closed and sent to payroll.`,
      });
    }

    if (action === "reopenTimesheet") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      const employeeId = String(body.employeeId || "").trim();
      const period = String(body.period || "").trim();
      const key = sheetKey(employeeId, period);
      const existing = data.closedSheets[key];
      const gate = checkReopenTimesheetGate({ sheet: existing, reason: body.reason });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          gate,
        }, { status: 400 });
      }
      const next = {
        ...existing!,
        closed: false,
        closedAt: null,
        closedBy: null,
        payrollRunId: null,
      };
      data.closedSheets[key] = next;
      await savePayload(data);
      await audit("reports.reopenTimesheet", `Reopened timesheet ${key}`, {
        reason: gate.reason,
        oldValue: existing,
        newValue: next,
      });
      return Response.json({ ok: true, sheet: next });
    }

    if (action === "attendanceOt") {
      const data = await loadPayload();
      return Response.json({
        ok: true,
        analysis: deriveAttendanceOtAnalysis(data.otDays),
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
});
