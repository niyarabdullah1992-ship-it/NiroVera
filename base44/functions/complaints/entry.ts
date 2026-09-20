import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  appendVoiceAudit,
  applySlaAutoEscalate,
  checkCloseGate,
  checkEscalateGate,
  checkFileAnonymousGate,
  countFilingsInWindow,
  defaultEscalationChain,
  deriveComplaintStats,
  deriveEscalationChain,
  enrichComplaint,
  normalizeRateLimits,
  RATE_WINDOW_MS,
  type ComplaintLike,
  type EscalationTier,
  type RateLimits,
} from "../../shared/complaintDerivations.ts";

const COMPLAINTS_CATEGORY = "anonymousReports";
const COMPLAINTS_LEGACY_CATEGORY = "complaintQueue"; // do-not-write — read fallback only

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type ComplaintsPayload = {
  reports: Array<ComplaintLike & { companyId: string; id: string }>;
  rateLimits: RateLimits;
  chainHandlerIds: string[];
};

function emptyPayload(): ComplaintsPayload {
  return {
    reports: [],
    rateLimits: normalizeRateLimits(null),
    chainHandlerIds: [],
  };
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

    const handlerRoles = [
      "owner", "director", "ops_manager", "pgm", "station_manager",
      "admin", "hr_manager", "hr",
    ];
    const isHandlerRole = auth.owner || auth.admin || handlerRoles.includes(auth.role);

    const loadBlob = async (category = COMPLAINTS_CATEGORY) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category,
      });
      return rows[0] || null;
    };

    const loadEscalationIds = async (): Promise<string[]> => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category: "complaintEscalationChain",
      });
      const payload = rows[0]?.payload;
      if (Array.isArray(payload)) return payload.filter((x: unknown) => typeof x === "string");
      if (Array.isArray(payload?.ids)) return payload.ids.filter((x: unknown) => typeof x === "string");
      return [];
    };

    const reportsFromPayload = (raw: unknown): Array<ComplaintLike & { companyId: string; id: string }> => {
      const rows = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === "object" && Array.isArray((raw as { reports?: unknown[] }).reports)
          ? (raw as { reports: unknown[] }).reports
          : []);
      return rows.filter(
        (r: ComplaintLike & { companyId?: string; id?: string }) =>
          r && r.id && r.title && (!r.companyId || r.companyId === auth.companyId),
      ) as Array<ComplaintLike & { companyId: string; id: string }>;
    };

    const loadPayload = async (): Promise<ComplaintsPayload> => {
      const blob = await loadBlob(COMPLAINTS_CATEGORY);
      const base = emptyPayload();
      base.reports = reportsFromPayload(blob?.payload);
      if (!base.reports.length) {
        const legacy = await loadBlob(COMPLAINTS_LEGACY_CATEGORY);
        base.reports = reportsFromPayload(legacy?.payload);
        const raw = legacy?.payload && typeof legacy.payload === "object" && !Array.isArray(legacy.payload)
          ? legacy.payload as { rateLimits?: unknown; chainHandlerIds?: unknown[] }
          : {};
        base.rateLimits = normalizeRateLimits(raw.rateLimits || null);
        base.chainHandlerIds = Array.isArray(raw.chainHandlerIds)
          ? raw.chainHandlerIds.filter((x: unknown) => typeof x === "string")
          : [];
      } else {
        const raw = blob?.payload && typeof blob.payload === "object" && !Array.isArray(blob.payload)
          ? blob.payload as { rateLimits?: unknown; chainHandlerIds?: unknown[] }
          : {};
        base.rateLimits = normalizeRateLimits(raw.rateLimits || null);
        base.chainHandlerIds = Array.isArray(raw.chainHandlerIds)
          ? raw.chainHandlerIds.filter((x: unknown) => typeof x === "string")
          : [];
      }
      if (!base.chainHandlerIds.length) base.chainHandlerIds = await loadEscalationIds();
      return base;
    };

    const savePayload = async (payload: ComplaintsPayload) => {
      const reports = payload.reports.map((r) => ({ ...r, companyId: r.companyId || auth.companyId }));
      const blob = await loadBlob(COMPLAINTS_CATEGORY);
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload: reports });
      else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: COMPLAINTS_CATEGORY,
          payload: reports,
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

    const resolveChain = async (data: ComplaintsPayload): Promise<EscalationTier[]> => {
      let ids = data.chainHandlerIds;
      if (!ids.length) ids = await loadEscalationIds();
      if (!ids.length) return defaultEscalationChain(null);
      const employees = await base44.asServiceRole.entities.Employee.filter({
        companyId: auth.companyId,
      });
      const profiles = employees.map((e: { id?: string; employeeId?: string; name?: string }) => ({
        id: e.employeeId || e.id,
        name: e.name,
      }));
      return deriveEscalationChain(ids, profiles, null);
    };

    const isActorHandler = (report: ComplaintLike, chain: EscalationTier[]) => {
      if (isHandlerRole) return true;
      if (!auth.userId) return false;
      const level = Math.max(0, Number(report.escalationLevel) || 0);
      const tier = chain[Math.min(level, chain.length - 1)];
      return !!(tier?.handlerIds || []).includes(auth.userId);
    };

    const enrichBoard = (data: ComplaintsPayload, chain: EscalationTier[], nowMs = Date.now()) => {
      const reports = data.reports.map((r) => enrichComplaint(r, chain, nowMs));
      return {
        ok: true,
        reports,
        stats: deriveComplaintStats(data.reports, chain, nowMs),
        rateLimits: data.rateLimits,
        chain: chain.map((t) => ({
          id: t.id,
          labelAr: t.labelAr,
          labelEn: t.labelEn,
          handlerIds: t.handlerIds || [],
        })),
      };
    };

    const usageForActor = async (data: ComplaintsPayload, nowMs = Date.now()) => {
      if (!auth.userId) return { day: 0, week: 0, month: 0 };
      const receipts = await base44.asServiceRole.entities.AnonymousReportReceipt.filter({
        companyId: auth.companyId,
        employeeId: auth.userId,
      });
      const mine = new Set(receipts.map((r: { reportId: string }) => r.reportId));
      const ats = data.reports
        .filter((r) => mine.has(r.id) && r.anonymous)
        .map((r) => r.createdAt);
      return {
        day: countFilingsInWindow(ats, RATE_WINDOW_MS.day, nowMs),
        week: countFilingsInWindow(ats, RATE_WINDOW_MS.week, nowMs),
        month: countFilingsInWindow(ats, RATE_WINDOW_MS.month, nowMs),
      };
    };

    if (action === "list") {
      const data = await loadPayload();
      const chain = await resolveChain(data);
      const swept = applySlaAutoEscalate(data.reports, chain);
      if (swept.escalated > 0) {
        data.reports = swept.reports as ComplaintsPayload["reports"];
        await savePayload(data);
        await audit("complaints.slaSweep", `Auto-escalated ${swept.escalated} report(s)`, {
          reason: "SLA_BREACH",
        });
      }
      return Response.json(enrichBoard(data, chain));
    }

    if (action === "seedDemo") {
      if (!isHandlerRole) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      if (data.reports.length) {
        const chain = await resolveChain(data);
        return Response.json(enrichBoard(data, chain));
      }
      const now = Date.now();
      const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();
      data.reports = [
        {
          companyId: auth.companyId,
          id: uid("cmp"),
          kind: "anonymous",
          anonymous: true,
          anonymousId: "ANON-4F2B91C0",
          title: "تجاوز في ساعات العمل دون احتساب الإضافي",
          message: "Working hours exceeded without overtime credit",
          stationId: body.stationId || auth.stationId || "jbl2",
          stationName: "الجبيل 2",
          priority: "high",
          status: "open",
          escalationLevel: 3,
          levelSinceAt: iso(30),
          createdAt: iso(54),
          autoEscalated: true,
          lastEscalationReason: "SLA_BREACH",
        },
        {
          companyId: auth.companyId,
          id: uid("cmp"),
          kind: "safety",
          anonymous: false,
          reporterName: "خالد الزهراني",
          title: "معدات وقاية شخصية غير مطابقة في الوردية الليلية",
          message: "Non-compliant PPE on night shift",
          stationId: "rbg",
          stationName: "رابغ",
          priority: "high",
          status: "open",
          escalationLevel: 0,
          levelSinceAt: iso(21),
          createdAt: iso(21),
        },
        {
          companyId: auth.companyId,
          id: uid("cmp"),
          kind: "anonymous",
          anonymous: true,
          anonymousId: "ANON-8C1D45E2",
          title: "سلوك غير مهني من مشرف مباشر",
          message: "Unprofessional conduct by a direct supervisor",
          stationId: "ynb",
          stationName: "ينبع",
          priority: "medium",
          status: "open",
          escalationLevel: 1,
          levelSinceAt: iso(72),
          createdAt: iso(96),
          autoEscalated: true,
          lastEscalationReason: "SLA_BREACH",
        },
        {
          companyId: auth.companyId,
          id: uid("cmp"),
          kind: "suggestion",
          type: "suggestion",
          anonymous: false,
          reporterName: "تركي المطيري",
          title: "جدولة الصيانة الوقائية خارج ذروة التشغيل",
          message: "Schedule preventive maintenance outside peak load",
          stationId: "jbl1",
          stationName: "الجبيل 1",
          priority: "low",
          status: "open",
          escalationLevel: 0,
          levelSinceAt: iso(24),
          createdAt: iso(24),
        },
        {
          companyId: auth.companyId,
          id: uid("cmp"),
          kind: "facilities",
          anonymous: false,
          reporterName: "نورة الرشيد",
          title: "تكييف غرفة الاستراحة معطل منذ أسبوع",
          message: "Break room AC out for a week",
          stationId: "dmm",
          stationName: "الدمام",
          priority: "low",
          status: "open",
          escalationLevel: 0,
          levelSinceAt: iso(48),
          createdAt: iso(48),
        },
      ];
      data.rateLimits = normalizeRateLimits(null);
      await savePayload(data);
      await audit("complaints.seedDemo", "Seeded complaint queue demo");
      const chain = await resolveChain(data);
      return Response.json(enrichBoard(data, chain));
    }

    if (action === "fileAnonymous") {
      if (!auth.userId) {
        return Response.json({
          error: "SESSION_REQUIRED",
          reason: "جلسة موظف مطلوبة للبلاغ المجهول.",
          reasonEn: "Employee session required to file anonymously.",
        }, { status: 403 });
      }
      const data = await loadPayload();
      const usage = await usageForActor(data);
      const gate = checkFileAnonymousGate({
        message: body.message || body.title,
        usage,
        limits: data.rateLimits,
        stationId: auth.stationId,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          limit: "limit" in gate ? gate.limit : undefined,
          used: "used" in gate ? gate.used : undefined,
        }, { status: gate.error?.startsWith("RATE_LIMIT") ? 429 : 400 });
      }
      const nowIso = new Date().toISOString();
      const reportId = uid("anr");
      const anonCode = "ANON-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
      const record: ComplaintLike & { companyId: string; id: string } = {
        companyId: auth.companyId,
        id: reportId,
        kind: "anonymous",
        anonymous: true,
        anonymousId: anonCode,
        type: body.type === "suggestion" ? "suggestion" : "complaint",
        title: String(body.title || gate.message).slice(0, 200),
        message: gate.message,
        stationId: auth.stationId || null,
        stationName: body.stationName || null,
        priority: ["high", "medium", "low"].includes(body.priority) ? body.priority : "medium",
        status: "open",
        escalationLevel: 0,
        levelSinceAt: nowIso,
        createdAt: nowIso,
        reporterName: null,
        auditTrail: appendVoiceAudit({}, "raise", {}, { at: nowIso, hideActor: true, level: 0 }),
      };
      data.reports = [record, ...data.reports];
      await savePayload(data);
      await base44.asServiceRole.entities.AnonymousReportReceipt.create({
        companyId: auth.companyId,
        reportId,
        employeeId: auth.userId,
      });
      await audit("complaints.fileAnonymous", `Filed ${anonCode}`, { newValue: reportId });
      const chain = await resolveChain(data);
      return Response.json({ ok: true, report: enrichComplaint(record, chain), ...enrichBoard(data, chain) });
    }

    if (action === "escalate") {
      const data = await loadPayload();
      const chain = await resolveChain(data);
      const idx = data.reports.findIndex((r) => r.id === String(body.reportId || ""));
      if (idx < 0) {
        return Response.json({
          error: "REPORT_NOT_FOUND",
          reason: "البلاغ غير موجود.",
          reasonEn: "Report not found.",
        }, { status: 404 });
      }
      const report = data.reports[idx];
      const gate = checkEscalateGate(report, chain, {
        actorId: auth.userId,
        isHandler: isActorHandler(report, chain),
        forceSla: false,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: 400 });
      }
      const nowIso = new Date().toISOString();
      data.reports[idx] = {
        ...report,
        escalationLevel: gate.nextLevel,
        levelSinceAt: nowIso,
        lastEscalationReason: "MANUAL",
        status: "open",
        auditTrail: appendVoiceAudit(report, "escalate", { id: auth.userId, name: auth.name, role: auth.role }, {
          at: nowIso,
          level: Number(report.escalationLevel) || 0,
          toLevel: gate.nextLevel,
          reason: "MANUAL",
        }),
      };
      await savePayload(data);
      await audit("complaints.escalate", `${report.id} → L${gate.nextLevel}`, {
        reason: "MANUAL",
        oldValue: String(report.escalationLevel || 0),
        newValue: String(gate.nextLevel),
      });
      return Response.json(enrichBoard(data, chain));
    }

    if (action === "sweepSla") {
      if (!isHandlerRole) return Response.json({ error: "Forbidden" }, { status: 403 });
      const data = await loadPayload();
      const chain = await resolveChain(data);
      const swept = applySlaAutoEscalate(data.reports, chain);
      data.reports = swept.reports as ComplaintsPayload["reports"];
      if (swept.escalated > 0) {
        await savePayload(data);
        await audit("complaints.slaSweep", `Auto-escalated ${swept.escalated} report(s)`, {
          reason: "SLA_BREACH",
        });
      }
      return Response.json({ ...enrichBoard(data, chain), escalated: swept.escalated });
    }

    if (action === "close") {
      const data = await loadPayload();
      const chain = await resolveChain(data);
      const idx = data.reports.findIndex((r) => r.id === String(body.reportId || ""));
      if (idx < 0) {
        return Response.json({
          error: "REPORT_NOT_FOUND",
          reason: "البلاغ غير موجود.",
          reasonEn: "Report not found.",
        }, { status: 404 });
      }
      const report = data.reports[idx];
      const gate = checkCloseGate(report, { isHandler: isActorHandler(report, chain) });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: 400 });
      }
      const nowIso = new Date().toISOString();
      data.reports[idx] = {
        ...report,
        status: "closed",
        closedAt: nowIso,
        closedBy: auth.name,
        satisfaction: body.satisfaction != null ? Number(body.satisfaction) : report.satisfaction ?? null,
        auditTrail: appendVoiceAudit(report, "adopt", { id: auth.userId, name: auth.name, role: auth.role }, {
          at: nowIso,
          detail: String(body.note || body.reason || "").trim(),
          level: Number(report.escalationLevel) || 0,
        }),
      };
      await savePayload(data);
      await audit("complaints.close", `Closed ${report.id}`, { newValue: report.title });
      return Response.json(enrichBoard(data, chain));
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
});
