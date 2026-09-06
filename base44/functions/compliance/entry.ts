import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  buildWpsFileRows,
  checkComplianceDocGate,
  checkGosiFileGate,
  checkNitaqatHireGate,
  checkWpsFileGate,
  deriveExpiringDocs,
  deriveGosiMonthly,
  deriveNitaqat,
  type EmployeeComplianceLike,
} from "../../shared/complianceDerivations.ts";

const COMPLIANCE_CATEGORY = "employeeCompliance";
const SETTINGS_CATEGORY = "companySettings";

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
      return (blob?.payload || {}) as {
        gosiEstablishment?: string;
        qiwaEstablishment?: string;
      };
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
      const settings = await loadSettings();
      settings.gosiEstablishment = number;
      await saveBlob(SETTINGS_CATEGORY, settings);
      await audit("compliance.setGosiEstablishment", `Set GOSI establishment ${number}`);
      return Response.json({ ok: true, gosiEstablishment: number });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("compliance function error", e);
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
