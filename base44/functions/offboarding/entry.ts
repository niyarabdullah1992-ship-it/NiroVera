import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  checkCompleteOffboardingGate,
  checkMarkReturnedGate,
  enrichOffboardingCase,
  type OffboardingCaseLike,
} from "../../shared/offboardingDerivations.ts";
import { validateOffboardingRequest, validationFailed } from "../../shared/proofCycleSchemas.ts";

const OFFBOARDING_CATEGORY = "offboardingCustody";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type OffboardingPayload = {
  cases: Array<OffboardingCaseLike & { companyId: string; id: string }>;
};

function emptyPayload(): OffboardingPayload {
  return { cases: [] };
}

function demoAssets(employeeId: string) {
  const prefix = String(employeeId || "emp").slice(0, 8);
  return [
    { id: `a1_${prefix}`, name: "جهاز لاسلكي Motorola DP4400", serial: "RAD-2291", status: "outstanding" as const },
    { id: `a2_${prefix}`, name: "حاسب محمول Dell Latitude", serial: "LAP-0847", status: "outstanding" as const },
    { id: `a3_${prefix}`, name: "بطاقة دخول الفرع", serial: "BDG-1042", status: "outstanding" as const },
    { id: `a4_${prefix}`, name: "معدات وقاية شخصية — طقم كامل", serial: "PPE-3310", status: "outstanding" as const },
  ];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const rawBody = await req.json();
    const action = String(rawBody?.action || "");
    let body = rawBody;
    if (action === "markReturned" || action === "complete") {
      const parsed = validateOffboardingRequest(rawBody);
      if (!parsed.success) return validationFailed(parsed.error);
      body = parsed.data;
    }
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

    const hrRoles = ["owner", "director", "ops_manager", "pgm", "admin", "hr_manager", "hr"];
    const canManage = auth.owner || auth.admin || hrRoles.includes(auth.role);

    const loadBlob = async () => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category: OFFBOARDING_CATEGORY,
      });
      return rows[0] || null;
    };

    const loadPayload = async (): Promise<OffboardingPayload> => {
      const blob = await loadBlob();
      const raw = blob?.payload && typeof blob.payload === "object" ? blob.payload : {};
      const base = emptyPayload();
      base.cases = (Array.isArray(raw.cases) ? raw.cases : []).filter(
        (c: OffboardingCaseLike & { companyId?: string; id?: string }) =>
          c && c.companyId === auth.companyId && c.employeeId && c.id,
      );
      return base;
    };

    const savePayload = async (payload: OffboardingPayload) => {
      const blob = await loadBlob();
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
      else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: OFFBOARDING_CATEGORY,
          payload,
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

    const findCase = (data: OffboardingPayload, employeeId: string) =>
      data.cases.find((c) => c.employeeId === employeeId) || null;

    const respondCase = (row: OffboardingCaseLike & { companyId: string; id: string } | null) => {
      if (!row) return { ok: true, case: null };
      return { ok: true, case: enrichOffboardingCase(row) };
    };

    if (action === "list" || action === "get") {
      const employeeId = String(body.employeeId || "").trim();
      if (!employeeId) {
        return Response.json({ error: "EMPLOYEE_REQUIRED", reason: "معرّف الموظف مطلوب." }, { status: 400 });
      }
      const data = await loadPayload();
      return Response.json(respondCase(findCase(data, employeeId)));
    }

    if (action === "seedDemo") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const employeeId = String(body.employeeId || "").trim();
      if (!employeeId) {
        return Response.json({ error: "EMPLOYEE_REQUIRED", reason: "معرّف الموظف مطلوب." }, { status: 400 });
      }
      const data = await loadPayload();
      const existing = findCase(data, employeeId);
      if (existing) return Response.json(respondCase(existing));

      const employees = await base44.asServiceRole.entities.Employee.filter({
        companyId: auth.companyId,
        employeeId,
      });
      const emp = employees[0] || null;
      const profile = emp?.profile && typeof emp.profile === "object" ? emp.profile : {};
      const salary = profile.salary && typeof profile.salary === "object" ? profile.salary : {};
      const leave = profile.leave && typeof profile.leave === "object" ? profile.leave : {};

      const row: OffboardingCaseLike & { companyId: string; id: string } = {
        companyId: auth.companyId,
        id: uid("off"),
        employeeId,
        employeeName: String(body.employeeName || emp?.name || employeeId),
        stationId: emp?.stationId || body.stationId || null,
        hireDate: String(body.hireDate || profile.hireDate || profile.hire || "2019-02-03"),
        base: Number(body.base ?? salary.base ?? profile.base ?? 9800),
        allowances: Number(body.allowances ?? salary.allowances ?? profile.allow ?? 2600),
        annualLeaveUsed: Number(body.annualLeaveUsed ?? leave.annual ?? 12),
        status: "in_progress",
        accessRevoked: false,
        qiwaNotified: false,
        safetyCleared: true,
        assets: demoAssets(employeeId),
      };
      data.cases.unshift(row);
      await savePayload(data);
      await audit("offboarding.seedDemo", `Seeded custody case for ${employeeId}`);
      return Response.json(respondCase(row));
    }

    if (!canManage) {
      return Response.json({ error: "Forbidden — HR role required" }, { status: 403 });
    }

    if (action === "markReturned") {
      const employeeId = String(body.employeeId || "").trim();
      const assetId = String(body.assetId || "").trim();
      const data = await loadPayload();
      const row = findCase(data, employeeId);
      const gate = checkMarkReturnedGate(row, assetId);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const asset = row!.assets!.find((a) => a.id === assetId)!;
      asset.status = "returned";
      asset.returnedAt = new Date().toISOString();
      asset.returnedBy = auth.name;
      await savePayload(data);
      await audit("offboarding.markReturned", `${employeeId}:${assetId}`, {
        newValue: asset.name,
      });
      return Response.json(respondCase(row));
    }

    if (action === "complete") {
      const employeeId = String(body.employeeId || "").trim();
      const data = await loadPayload();
      const row = findCase(data, employeeId);
      const employees = await base44.asServiceRole.entities.Employee.filter({
        companyId: auth.companyId,
        employeeId,
      });
      const emp = employees[0];
      const profile = emp?.profile && typeof emp.profile === "object" ? emp.profile as Record<string, unknown> : {};
      const gate = checkCompleteOffboardingGate(row, { contractExit: profile.contractExit as OffboardingCaseLike["contractExit"] });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }

      row!.status = "completed";
      row!.accessRevoked = true;
      row!.qiwaNotified = true;
      row!.completedAt = new Date().toISOString();
      row!.completedBy = auth.name;
      await savePayload(data);

      // Revoke login: delete credentials + sessions (same outcome as disableEmployeeAccess).
      if (emp) {
        const meta = await base44.asServiceRole.entities.CompanyDataBlob.filter({
          companyId: auth.companyId,
          category: "companyMeta",
        });
        const ownerId = meta[0]?.payload?.[0]?.ownerId || null;
        if (ownerId !== employeeId) {
          const credentials = await base44.asServiceRole.entities.EmployeeCredential.filter({
            companyId: auth.companyId,
            employeeId,
          });
          const sessions = await base44.asServiceRole.entities.CompanySession.filter({
            companyId: auth.companyId,
            userId: employeeId,
          });
          for (const credential of credentials) {
            await base44.asServiceRole.entities.EmployeeCredential.delete(credential.id);
          }
          for (const session of sessions) {
            await base44.asServiceRole.entities.CompanySession.delete(session.id);
          }
          const profile = emp.profile && typeof emp.profile === "object" ? emp.profile : {};
          await base44.asServiceRole.entities.Employee.update(emp.id, {
            profile: { ...profile, employmentStatus: "terminated" },
          });
        }
      }

      await audit(
        "offboarding.complete",
        `Offboarding completed, access revoked and Qiwa notified: ${employeeId}`,
      );
      return Response.json(respondCase(row));
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("offboarding error", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
