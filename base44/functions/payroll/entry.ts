import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  checkApprovePayrollGate,
  checkSendWpsGate,
  deriveRunTotals,
  deriveStationBreakdown,
  deriveWpsStatus,
  enrichLine,
  overtimePay,
  settlementStamp,
  type PayrollLineLike,
  type PayrollRunLike,
} from "../../shared/payrollDerivations.ts";

const PAYROLL_CATEGORY = "payrollRuns";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

    const payrollRoles = ["owner", "director", "ops_manager", "pgm", "admin"];
    const canPayroll = auth.owner || auth.admin || payrollRoles.includes(auth.role);

    const loadBlob = async () => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category: PAYROLL_CATEGORY,
      });
      return rows[0] || null;
    };

    const loadRuns = async (): Promise<PayrollRunLike[]> => {
      const blob = await loadBlob();
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      return payload.filter((r: PayrollRunLike) => r && r.companyId === auth.companyId && r.month);
    };

    const saveRuns = async (runs: PayrollRunLike[]) => {
      const blob = await loadBlob();
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload: runs });
      else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: PAYROLL_CATEGORY,
          payload: runs,
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

    const enrichRun = (run: PayrollRunLike, now = new Date()) => {
      const items = (run.items || []).map(enrichLine);
      return {
        ...run,
        items,
        totals: deriveRunTotals(items),
        byStation: deriveStationBreakdown(items),
        wps: deriveWpsStatus({ ...run, items }, now),
      };
    };

    if (!canPayroll) {
      return Response.json({ error: "Forbidden — payroll role required" }, { status: 403 });
    }

    if (action === "list" || action === "get") {
      const month = String(body.month || monthKey());
      const runs = await loadRuns();
      let run = runs.find((r) => r.month === month) || null;
      if (!run && action === "get") {
        return Response.json({ ok: true, run: null, month });
      }
      return Response.json({
        ok: true,
        month,
        run: run ? enrichRun(run) : null,
        runs: runs.map((r) => ({ month: r.month, status: r.status || "draft", heads: (r.items || []).length })),
      });
    }

    if (action === "ensureRun") {
      const month = String(body.month || monthKey());
      const runs = await loadRuns();
      let run = runs.find((r) => r.month === month);
      if (!run) {
        const seedItems: PayrollLineLike[] = Array.isArray(body.items) ? body.items : [];
        run = {
          id: uid("run"),
          companyId: auth.companyId,
          month,
          status: "draft",
          items: seedItems.map((it) => ({
            id: it.id || uid("itm"),
            employeeId: it.employeeId,
            employeeName: it.employeeName,
            stationId: it.stationId || null,
            base: Number(it.base) || 0,
            allowances: Number(it.allowances) || 0,
            bonus: Number(it.bonus) || 0,
            overtimeHours: Number(it.overtimeHours) || 0,
            overtimePay: overtimePay(Number(it.base) || 0, Number(it.overtimeHours) || 0),
            deductions: Number(it.deductions) || 0,
            currency: String(it.currency || "SAR").toUpperCase(),
            qiwaWage: it.qiwaWage != null ? Number(it.qiwaWage) : (Number(it.base) || 0) + (Number(it.allowances) || 0),
            isSaudi: it.isSaudi ?? null,
            paid: false,
          })),
          approvedAt: null,
          approvedBy: null,
          wpsSentAt: null,
          wpsSentBy: null,
        };
        runs.push(run);
        await saveRuns(runs);
        await audit("payroll.ensureRun", `Opened payroll run ${month}`, { newValue: run.id });
      }
      return Response.json({ ok: true, run: enrichRun(run) });
    }

    if (action === "upsertLine") {
      const month = String(body.month || "");
      const runs = await loadRuns();
      const idx = runs.findIndex((r) => r.month === month);
      if (idx < 0) return Response.json({ error: "RUN_NOT_FOUND" }, { status: 404 });
      const run = runs[idx];
      if (run.status === "approved" || run.status === "sent") {
        return Response.json({
          error: "RUN_LOCKED",
          reason: "لا تعديل بعد الاعتماد.",
          reasonEn: "Cannot edit lines after approval.",
        }, { status: 400 });
      }
      const lineIn = body.line || body;
      const employeeId = String(lineIn.employeeId || "");
      if (!employeeId) return Response.json({ error: "EMPLOYEE_REQUIRED" }, { status: 400 });
      const items = [...(run.items || [])];
      const li = items.findIndex((i) => i.employeeId === employeeId || i.id === lineIn.id);
      // A settled line is not editable. The handler used to rebuild it with paid:false,
      // which both unpaid it and dropped the figures it was settled with.
      if (li >= 0 && items[li].paid) {
        return Response.json({
          error: "LINE_PAID",
          reason: "البند مدفوع — لا يُعدَّل بعد الصرف.",
          reasonEn: "This line is paid — it cannot be edited after settlement.",
        }, { status: 400 });
      }
      const next: PayrollLineLike = {
        id: (li >= 0 ? items[li].id : null) || uid("itm"),
        employeeId,
        employeeName: String(lineIn.employeeName || (li >= 0 ? items[li].employeeName : "") || ""),
        stationId: lineIn.stationId ?? (li >= 0 ? items[li].stationId : null),
        base: Number(lineIn.base ?? (li >= 0 ? items[li].base : 0)) || 0,
        allowances: Number(lineIn.allowances ?? (li >= 0 ? items[li].allowances : 0)) || 0,
        bonus: Number(lineIn.bonus ?? (li >= 0 ? items[li].bonus : 0)) || 0,
        overtimeHours: Number(lineIn.overtimeHours ?? (li >= 0 ? items[li].overtimeHours : 0)) || 0,
        deductions: Number(lineIn.deductions ?? (li >= 0 ? items[li].deductions : 0)) || 0,
        currency: String(lineIn.currency || (li >= 0 ? items[li].currency : "SAR") || "SAR").toUpperCase(),
        qiwaWage: lineIn.qiwaWage != null
          ? Number(lineIn.qiwaWage)
          : (li >= 0 ? items[li].qiwaWage : null),
        isSaudi: lineIn.isSaudi ?? (li >= 0 ? items[li].isSaudi : null),
        paid: false,
      };
      next.overtimePay = overtimePay(next.base || 0, next.overtimeHours || 0);
      if (li >= 0) items[li] = next;
      else items.push(next);
      runs[idx] = { ...run, items };
      await saveRuns(runs);
      await audit("payroll.upsertLine", `Upserted line ${employeeId} on ${month}`);
      return Response.json({ ok: true, run: enrichRun(runs[idx]) });
    }

    if (action === "approve") {
      const month = String(body.month || "");
      const runs = await loadRuns();
      const idx = runs.findIndex((r) => r.month === month);
      if (idx < 0) return Response.json({ error: "RUN_NOT_FOUND", reason: "مسير الرواتب غير موجود." }, { status: 404 });
      const gate = checkApprovePayrollGate(runs[idx]);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, count: "count" in gate ? gate.count : undefined }, { status: 400 });
      }
      runs[idx] = {
        ...runs[idx],
        // Approval decides the figures. Freezing them on the lines here is what keeps a
        // later change to the net formula from rewriting a run the company already signed.
        items: (runs[idx].items || []).map((it) => (it.settledNet == null ? { ...it, ...settlementStamp(it) } : it)),
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: auth.name,
      };
      await saveRuns(runs);
      await audit("payroll.approve", `Approved payroll run ${month}`);
      return Response.json({ ok: true, run: enrichRun(runs[idx]) });
    }

    if (action === "sendWps") {
      const month = String(body.month || "");
      const runs = await loadRuns();
      const idx = runs.findIndex((r) => r.month === month);
      if (idx < 0) return Response.json({ error: "RUN_NOT_FOUND" }, { status: 404 });
      const gate = checkSendWpsGate(runs[idx]);
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          count: "count" in gate ? gate.count : undefined,
          matched: "matched" in gate ? gate.matched : undefined,
          total: "total" in gate ? gate.total : undefined,
        }, { status: 400 });
      }
      const fileRef = `WPS-${month}-${uid("f").slice(-6).toUpperCase()}`;
      runs[idx] = {
        ...runs[idx],
        status: "sent",
        wpsSentAt: new Date().toISOString(),
        wpsSentBy: auth.name,
        wpsFileRef: fileRef,
        wpsLate: gate.late,
      } as PayrollRunLike & { wpsFileRef?: string; wpsLate?: boolean };
      await saveRuns(runs);
      await audit("payroll.sendWps", `WPS file ${fileRef} sent for ${month}${gate.late ? " (late)" : ""}`);
      return Response.json({
        ok: true,
        fileRef,
        late: gate.late,
        deadline: gate.deadline,
        run: enrichRun(runs[idx]),
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message || err) }, { status: 500 });
  }
});
