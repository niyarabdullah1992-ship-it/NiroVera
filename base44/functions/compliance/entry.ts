import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  buildWpsFileRows,
  checkComplianceDocGate,
  checkContractTermGate,
  checkGosiFileGate,
  checkNitaqatHireGate,
  checkWpsFileGate,
  deriveExpiringDocs,
  deriveGosiMonthly,
  deriveNitaqat,
  type EmployeeComplianceLike,
} from "../../shared/complianceDerivations.ts";
import {
  deriveLaborComplianceScore,
  deriveMhrsdSectorBoard,
  laborRulesCatalog,
  reviewArbitrationCase,
  sealArbitrationVerdict,
  visibleArbitrationOutcomes,
} from "../../shared/arbitrationDerivations.ts";

const COMPLIANCE_CATEGORY = "employeeCompliance";
const SETTINGS_CATEGORY = "companyMeta";
const SETTINGS_LEGACY_CATEGORY = "companySettings"; // do-not-write — read fallback only
const ARBITRATION_CATEGORY = "arbitrationOutcomes";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  return id || null;
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
    const managerRoles = ["owner", "director", "ops_manager", "hr", "admin", "pgm"];
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
        actorName: auth.name,
        actorId: auth.userId || auth.role,
        details,
        createdAt: new Date().toISOString(),
        ...extra,
      });
    };

    const loadFiles = async (): Promise<EmployeeComplianceLike[]> => {
      const blob = await loadBlob(COMPLIANCE_CATEGORY);
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      return payload as EmployeeComplianceLike[];
    };

    const loadSettings = async () => {
      const blob = await loadBlob(SETTINGS_CATEGORY);
      const raw = Array.isArray(blob?.payload) ? blob.payload[0] : blob?.payload;
      let settings = (raw || {}) as {
        gosiEstablishment?: string;
        qiwaEstablishment?: string;
      };
      if (!settings.gosiEstablishment && !settings.qiwaEstablishment) {
        const legacy = await loadBlob(SETTINGS_LEGACY_CATEGORY);
        const legacyRaw = Array.isArray(legacy?.payload) ? legacy.payload[0] : legacy?.payload;
        if (legacyRaw && typeof legacyRaw === "object") settings = { ...settings, ...legacyRaw };
      }
      return settings;
    };

    if (action === "overview") {
      if (!isManager) {
        return Response.json({
          error: "FORBIDDEN",
          reason: "لوحة الامتثال للمدير/الموارد البشرية.",
          reasonEn: "Compliance board is manager/HR only.",
        }, { status: 403 });
      }
      let files = await loadFiles();
      if (!files.length) {
        const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
        files = (emps || []).slice(0, 100).map((e: {
          employeeId?: string; id?: string; name?: string; nationality?: string; nationalId?: string;
          profile?: { nationality?: string; nationalId?: string };
        }) => ({
          employeeId: e.employeeId || e.id,
          name: e.name,
          nationality: e.nationality || e.profile?.nationality || null,
          nationalId: e.nationalId || e.profile?.nationalId || null,
          docs: [],
        }));
      }
      const nitaqat = deriveNitaqat(files);
      const expiring = deriveExpiringDocs(files);
      const settings = await loadSettings();
      return Response.json({
        nitaqat,
        expiring,
        fileCount: files.length,
        gosiEstablishment: settings.gosiEstablishment || null,
        qiwaEstablishment: settings.qiwaEstablishment || null,
        liveIntegrations: {
          qiwa: false,
          gosi: false,
          mudad: false,
          nafath: false,
          noteAr: "الربط الحيّ ببوابات الوزارة يحتاج اعتمادات رسمية — الحالة الحالية محاكاة/ملف جاهز.",
          noteEn: "Live Ministry rails need official credentials — current state is file-ready / simulated.",
        },
      });
    }

    if (action === "upsertFile") {
      if (!isManager) {
        return Response.json({ error: "FORBIDDEN", reason: "تحديث الملف النظامي للموارد البشرية.", reasonEn: "Statutory file updates are HR-only." }, { status: 403 });
      }
      const file = body.file as EmployeeComplianceLike;
      if (!file?.employeeId) {
        return Response.json({ error: "EMPLOYEE_REQUIRED", reason: "يلزم معرّف موظف.", reasonEn: "employeeId is required." }, { status: 400 });
      }
      const files = await loadFiles();
      const idx = files.findIndex((f) => f.employeeId === file.employeeId);
      if (idx >= 0) files[idx] = { ...files[idx], ...file };
      else files.push(file);
      await saveBlob(COMPLIANCE_CATEGORY, files);
      await audit("compliance.upsertFile", `Updated statutory file for ${file.employeeId}`, { employeeId: file.employeeId });
      return Response.json({ ok: true, gate: checkComplianceDocGate({ employee: file }) });
    }

    if (action === "checkEmployee") {
      const files = await loadFiles();
      const emp = files.find((f) => f.employeeId === body.employeeId) || body.employee;
      const gate = checkComplianceDocGate({ employee: emp, requiredKinds: body.requiredKinds });
      return Response.json(gate);
    }

    if (action === "checkNitaqatHire") {
      const files = await loadFiles();
      const nitaqat = deriveNitaqat(files);
      const gate = checkNitaqatHireGate({
        nitaqat,
        candidateSaudi: !!body.candidateSaudi,
        nitaqatEffectStated: !!body.nitaqatEffectStated,
      });
      return Response.json({ nitaqat, ...gate });
    }

    if (action === "gosiMonthly") {
      if (!isManager) {
        return Response.json({ error: "FORBIDDEN", reason: "ملف GOSI للمدير فقط.", reasonEn: "GOSI file is manager-only." }, { status: 403 });
      }
      const settings = await loadSettings();
      const establishment = body.establishmentNumber || settings.gosiEstablishment;
      const files = await loadFiles();
      const lines = Array.isArray(body.lines) && body.lines.length
        ? body.lines
        : files.map((f) => ({
          employeeId: f.employeeId,
          employeeName: f.name,
          base: Number(body.defaultBase || 4000),
          allowances: Number(body.defaultAllowances || 0),
          gosiNumber: f.gosiNumber || f.docs?.find((d) => d.kind === "gosi")?.number,
        }));
      const report = deriveGosiMonthly(lines, establishment);
      const gate = checkGosiFileGate({ establishmentNumber: establishment, rows: report.rows });
      if (!gate.ok && body.send) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      if (body.send && gate.ok) {
        await audit("compliance.gosiMonthly.simulateSend", `Simulated GOSI file ${report.grandTotal} SAR`, {
          establishment,
          grandTotal: report.grandTotal,
        });
        return Response.json({ ok: true, simulated: true, report, gate });
      }
      return Response.json({ report, gate });
    }

    if (action === "wpsFile") {
      if (!isManager) {
        return Response.json({ error: "FORBIDDEN", reason: "ملف WPS للمدير فقط.", reasonEn: "WPS file is manager-only." }, { status: 403 });
      }
      const files = await loadFiles();
      const byId = new Map(files.map((f) => [f.employeeId, f]));
      const lines = (Array.isArray(body.lines) ? body.lines : []).map((line: {
        employeeId: string; employeeName?: string; base?: number; allowances?: number; netPay?: number; qiwaWage?: number;
      }) => {
        const f = byId.get(line.employeeId);
        return {
          ...line,
          nationalId: line.nationalId || f?.nationalId || f?.docs?.find((d) => d.kind === "national_id")?.number,
          iban: line.iban || f?.iban,
        };
      });
      const rows = buildWpsFileRows(lines);
      const gate = checkWpsFileGate(rows);
      if (!gate.ok && body.send) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      if (body.send && gate.ok) {
        const ref = `MUDAD-SIM-${Date.now().toString(36).toUpperCase()}`;
        await audit("compliance.wpsFile.simulateSend", `Simulated Mudad/WPS send ${ref}`, { ref, rowCount: rows.length });
        return Response.json({ ok: true, simulated: true, channel: "mudad", fileRef: ref, rows, gate });
      }
      return Response.json({ rows, gate, channel: "mudad" });
    }

    if (action === "laborCatalog") {
      return Response.json({
        rules: laborRulesCatalog({ family: body.family, source: body.source, onDate: body.onDate }),
        noteAr: "كتالوج للقراءة فقط — ليست جدولاً تعدّله المنشأة.",
        noteEn: "Read-only catalog — not a table the establishment edits.",
      });
    }

    if (action === "review") {
      const review = reviewArbitrationCase({
        kind: body.kind,
        request: body.request,
        employee: body.employee,
        line: body.line,
        extraAdvance: body.extraAdvance,
        onDate: body.onDate,
        overtimeMinutes: body.overtimeMinutes,
        decision: body.decision,
        workerConsent: body.workerConsent,
        alreadyDecided: body.alreadyDecided,
        overtimeHoursYtd: body.overtimeHoursYtd,
        annualCapConsent: body.annualCapConsent,
      });
      if (!review.ok && body.commit) {
        return Response.json({
          error: review.error || "BLOCKED",
          reason: review.reason,
          reasonEn: review.reasonEn,
          review,
          overrideAllowed: false,
        }, { status: 400 });
      }
      let outcome = null;
      if (body.seal) {
        if (!isManager && String(body.employeeId || body.employee?.employeeId || "") !== String(auth.userId || "")) {
          return Response.json({
            error: "FORBIDDEN",
            reason: "ختم التحكيم للإدارة أو لصاحب الطلب.",
            reasonEn: "Sealing a verdict is for management or the request owner.",
          }, { status: 403 });
        }
        const blob = await loadBlob(ARBITRATION_CATEGORY);
        const list = Array.isArray(blob?.payload) ? blob.payload : [];
        const sealed = sealArbitrationVerdict(review, {
          companyId: auth.companyId,
          requestId: body.requestId,
          employeeId: body.employeeId || body.employee?.employeeId || body.employee?.id,
          actorRole: "system",
          actorId: auth.userId || "",
        });
        if (!list.some((row: { id?: string }) => row.id === sealed.id)) {
          list.push(sealed);
          await saveBlob(ARBITRATION_CATEGORY, list);
          await audit("arbitration.verdict", `Arbitration ${sealed.kind} ${sealed.status} ${sealed.ruleId || ""}`.trim(), {
            outcomeId: sealed.id,
            employeeId: sealed.employeeId,
          });
        }
        outcome = sealed;
      }
      return Response.json({ review, outcome, overrideAllowed: false });
    }

    if (action === "outcomes") {
      const blob = await loadBlob(ARBITRATION_CATEGORY);
      const list = Array.isArray(blob?.payload) ? blob.payload : [];
      const audience = isManager ? "manager" : "employee";
      const rows = visibleArbitrationOutcomes(list, { audience, employeeId: auth.userId || "" });
      return Response.json({ outcomes: rows, audience });
    }

    if (action === "score") {
      if (!isManager) {
        return Response.json({
          error: "FORBIDDEN",
          reason: "درجة الامتثال للإدارة.",
          reasonEn: "The compliance score is for management.",
        }, { status: 403 });
      }
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      const checks = (emps || []).slice(0, 200).map((row: { employeeId?: string; id?: string; name?: string }) => {
        const gate = checkContractTermGate({ employee: row });
        return {
          id: `contract:${row.employeeId || row.id}`,
          ok: !!gate.ok,
          kind: "contract_end",
          sector: "contracts",
          error: "error" in gate ? gate.error : null,
        };
      });
      return Response.json({
        ...deriveLaborComplianceScore(checks),
        ...deriveMhrsdSectorBoard(checks),
        checks,
      });
    }

    if (action === "setGosiEstablishment") {
      if (!auth.owner && !auth.admin && auth.role !== "hr") {
        return Response.json({
          error: "FORBIDDEN",
          reason: "رقم منشأة التأمينات لمالك الحساب أو الموارد البشرية.",
          reasonEn: "GOSI establishment number is owner/HR only.",
        }, { status: 403 });
      }
      const number = String(body.gosiEstablishment || "").trim();
      if (!number) {
        return Response.json({
          error: "GOSI_ESTABLISHMENT_REQUIRED",
          reason: "يلزم رقم منشأة غير فارغ.",
          reasonEn: "A non-empty establishment number is required.",
        }, { status: 400 });
      }
      const metaBlob = await loadBlob(SETTINGS_CATEGORY);
      const current = Array.isArray(metaBlob?.payload) ? (metaBlob.payload[0] || {}) : (metaBlob?.payload || {});
      const settings = { ...(typeof current === "object" ? current : {}), gosiEstablishment: number };
      await saveBlob(SETTINGS_CATEGORY, Array.isArray(metaBlob?.payload) || !metaBlob ? [settings] : settings);
      await audit("compliance.setGosiEstablishment", `Set GOSI establishment ${number}`);
      return Response.json({ ok: true, gosiEstablishment: number });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("compliance function error", e);
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
