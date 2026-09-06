import React, { useEffect, useState } from "react";
import { Loader2, Banknote, ListChecks } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { monthKey as localMonthKey } from "@/lib/payroll";
import {
  OT_RATE,
  checkApprovePayrollGate,
  wpsDeadline,
  isWpsLate,
} from "@/lib/payrollDerivations";
import { toast } from "@/components/ui/use-toast";
import { ACCENT, MUTED, NAVY, WARN, NEUTRAL, OK, ui, CARD, SURFACE } from "@/lib/platformStyles";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

async function payrollApi(payload) {
  const res = await base44.functions.invoke("payroll", payload);
  return res?.data ?? res;
}

const fmt = (n, currency = "SAR") =>
  `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;

const tableHead = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.4fr) 78px 110px 110px 110px",
  gap: "12px",
  padding: "11px 18px",
  background: SURFACE,
  borderTop: "none",
  borderBottom: "1px solid #E2E8F0",
  fontSize: "10px",
  letterSpacing: "0.06em",
  color: MUTED,
  fontWeight: 600,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.4fr) 78px 110px 110px 110px",
  gap: "12px",
  padding: "12px 18px",
  borderBottom: "1px solid #F1F5F9",
  alignItems: "center",
};

/**
 * Platform payroll — navy total · WPS card · by-station table (L1013+).
 * The period is chosen once in the page toolbar; this board follows that choice
 * so there is a single month selector on the surface.
 */
export default function PayrollRunBoard({ month: monthProp, lang = "ar", stationScope = "all", onEditLines, onOpenWps, onMeta }) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const [month, setMonth] = useState(monthProp || localMonthKey());
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [seedHours, setSeedHours] = useState("4");
  const [hoverRow, setHoverRow] = useState(null);

  useEffect(() => {
    if (monthProp) setMonth(monthProp);
  }, [monthProp]);

  const stationName = (id) => {
    if (!id || id === "__unassigned__") return ar ? "غير مخصص" : "Unassigned";
    return data?.stations?.find((s) => s.id === id)?.name || id;
  };

  const applyRemote = (remote) => {
    const next = remote?.run || (remote?.ok && remote.run === null ? null : undefined);
    if (remote?.run) setRun(remote.run);
    else if (remote?.ok && remote.run === null) setRun(null);
    if (next !== undefined) {
      onMeta?.({
        status: next?.status || "",
        wps: next?.wps || null,
        heads: next?.totals?.heads || 0,
      });
    }
  };

  const load = async () => {
    if (!company?.id) return;
    try {
      const remote = await payrollApi({ action: "list", companyId: company.id, month });
      applyRemote(remote);
    } catch {
      setRun(null);
    }
  };

  useEffect(() => { load(); }, [company?.id, month]);

  const runAction = async (payload, okMsg) => {
    if (!company?.id) return;
    setBusy(true);
    try {
      const remote = await payrollApi({ ...payload, companyId: company.id, month });
      if (remote?.error) {
        toast({
          description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.reason || remote.error),
          variant: "destructive",
        });
      } else {
        if (okMsg) toast({ description: okMsg });
        if (remote.run) setRun(remote.run);
        else applyRemote(remote);
      }
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const ensureFromEmployees = async () => {
    const employees = (data?.employees || []).filter((e) => e.role !== "owner");
    const items = employees.map((e) => {
      const base = Number(e.profile?.baseSalary) || 0;
      const allowances = Number(e.profile?.allowances) || 0;
      return {
        employeeId: e.id,
        employeeName: e.name,
        stationId: e.stationId || null,
        base,
        allowances,
        bonus: 0,
        overtimeHours: Number(seedHours) || 0,
        deductions: 0,
        currency: String(e.profile?.currency || "SAR").toUpperCase(),
        qiwaWage: base + allowances,
      };
    });
    await runAction(
      { action: "ensureRun", items },
      ar ? `فُتح مسير ${month}` : `Opened run ${month}`,
    );
  };

  const approve = async () => {
    if (!run) return;
    const gate = checkApprovePayrollGate(run);
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    await runAction(
      { action: "approve" },
      ar ? "اعتُمد المسير — انتقل إلى حماية الأجور لإنشاء ملف مدى." : "Run approved — open wage protection to build the Mudad file.",
    );
  };

  if (!currentUser) return null;

  const totals = run?.totals;
  const wps = run?.wps;
  const stationRows = stationScope === "all"
    ? (run?.byStation || [])
    : (run?.byStation || []).filter((r) => String(r.stationId ?? "") === String(stationScope));
  const currency = run?.items?.[0]?.currency || "SAR";
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(ar ? "ar-SA" : "en-GB", {
    month: "long",
    year: "numeric",
  });
  const scopedName = stationScope !== "all" ? stationName(stationScope) : null;
  const displayTotals = stationScope === "all"
    ? totals
    : stationRows.length
      ? {
          heads: stationRows.reduce((s, r) => s + (Number(r.heads) || 0), 0),
          baseAndAllowances: stationRows.reduce((s, r) => s + (Number(r.baseAndAllowances) || 0), 0),
          overtime: stationRows.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
          deductions: stationRows.reduce((s, r) => s + (Number(r.deductions) || 0), 0),
          total: stationRows.reduce((s, r) => s + (Number(r.total) || 0), 0),
          issueCount: totals?.issueCount || 0,
        }
      : {
          heads: 0,
          baseAndAllowances: 0,
          overtime: 0,
          deductions: 0,
          total: 0,
          issueCount: totals?.issueCount || 0,
        };

  const deadline = wps?.deadline || wpsDeadline(month);
  const late = wps?.late ?? isWpsLate(month);
  const approved = run?.status === "approved" || run?.status === "sent";
  const sent = run?.status === "sent";

  return (
    <section dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ ...NEUTRAL, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LaborArticleCite ruleId="hours.ot.premium" ar={ar} />
          {ar ? `إضافي ${OT_RATE * 100}%` : `OT ${OT_RATE * 100}%`}
        </span>
        <span style={{ ...NEUTRAL, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LaborArticleCite ruleId="hours.ot.compLeave.cite" ar={ar} />
          {ar ? "إجازة تعويضية بدل الإضافي بموافقة العامل" : "Compensatory leave instead of OT with consent"}
        </span>
        <span style={{ ...NEUTRAL, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LaborArticleCite ruleId="hours.ot.exceptionDayHours" ar={ar} />
          {ar ? "سقف الاستثناء 10/60" : "Exception cap 10/60"}
        </span>
        <span style={{ ...NEUTRAL, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LaborArticleCite ruleId="payroll.deduction.capRatio" ar={ar} />
          {ar ? "سقف الخصم نصف الأجر" : "deductions ≤ half the wage"}
        </span>
        <span style={late ? WARN : NEUTRAL}>
          {ar ? `حماية الأجور — المهلة ${deadline || "—"}` : `Wage protection — due ${deadline || "—"}`}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <LaborArticleCite ruleId="hours.ot.annualMaxHours" ar={ar} showText />
        <LaborArticleCite ruleId="hours.ot.compLeave.minHoursPerOtHour" ar={ar} showText />
        <LaborArticleCite ruleId="hours.ot.compLeave.windowDays" ar={ar} showText />
        <LaborArticleCite ruleId="hours.ot.compLeave.maxDaysPerYear" ar={ar} showText />
      </div>

      {!run && (
        <IdentityCard
          icon={Banknote}
          title={ar ? `لا مسير على الخادم لـ ${monthLabel}` : `No server run for ${monthLabel}`}
          subtitle={ar
            ? "افتح المسير من ملفات الموظفين — الراتب الأساسي والبدلات تُسحب تلقائيًا، ثم راجع البنود قبل الاعتماد."
            : "Open the run from employee profiles — base salary and allowances are pulled in, then review the lines before approval."}
          dir={ar ? "rtl" : "ltr"}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "10px" }}>
            <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: MUTED }}>
              <span>{ar ? "ساعات إضافية أولية" : "Initial OT hours"} <LaborArticleCite ruleId="hours.ot.premium" ar={ar} /></span>
              <input
                value={seedHours}
                onChange={(e) => setSeedHours(e.target.value)}
                style={{
                  height: "34px",
                  width: "96px",
                  borderRadius: "9px",
                  border: "1px solid #E2E8F0",
                  background: SURFACE,
                  padding: "0 8px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={ensureFromEmployees}
              style={{ ...ui.btnPrimary, height: "34px", opacity: busy ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {busy ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Banknote style={{ width: 14, height: 14 }} />}
              {ar ? "افتح المسير من الملفات" : "Open run from profiles"}
            </button>
          </div>
        </IdentityCard>
      )}

      {run && displayTotals && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <IdentityCard
            icon={Banknote}
            title={ar ? "إجمالي المسير" : "Run total"}
            subtitle={`${monthLabel}${scopedName ? ` · ${scopedName}` : ""} · ${displayTotals.heads} ${ar ? "موظفًا" : "employees"}${
              scopedName
                ? (ar ? " — الاعتماد على مستوى المنشأة" : " — approval is establishment-wide")
                : (ar ? " — قبل الاعتماد" : " — before approval")
            }`}
            rail={approved ? ACCENT : NAVY}
            dir={ar ? "rtl" : "ltr"}
            meta={(
              <>
                <span style={{ ...NEUTRAL, borderRadius: 8 }} dir="ltr">{fmt(displayTotals.total, currency)}</span>
                <span style={{ ...(approved ? OK : NEUTRAL), borderRadius: 8 }}>
                  {approved ? (ar ? "معتمد" : "Approved") : (ar ? "بانتظار الاعتماد" : "Awaiting approval")}
                </span>
                <button
                  type="button"
                  disabled={busy || run.status === "approved" || run.status === "sent"}
                  onClick={approve}
                  style={{
                    ...ui.btnPrimary,
                    opacity: busy || run.status === "approved" || run.status === "sent" ? 0.4 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {busy ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : null}
                  {approved
                    ? (ar ? "اعتُمد المسير" : "Run approved")
                    : (ar ? "اعتمد المسير" : "Approve run")}
                </button>
                {approved && onOpenWps && (
                  <button type="button" onClick={onOpenWps} style={ui.btnSecondary}>
                    {sent
                      ? (ar ? "ملف حماية الأجور" : "Wage-protection file")
                      : (ar ? "التالي: حماية الأجور" : "Next: wage protection")}
                  </button>
                )}
              </>
            )}
          >

            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              {[
                { label: ar ? "الأساسي والبدلات" : "Base & allowances", value: fmt(displayTotals.baseAndAllowances, currency) },
                { label: ar ? "ساعات إضافية" : "Overtime", value: fmt(displayTotals.overtime, currency) },
                { label: ar ? "استقطاعات" : "Deductions", value: fmt(displayTotals.deductions, currency) },
              ].map((m) => (
                <div key={m.label} style={{ border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 16px", background: CARD }}>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: 600, color: MUTED, letterSpacing: "0.04em" }}>{m.label}</p>
                  <p dir="ltr" style={{ margin: "8px 0 0", fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "18px", fontWeight: 600, color: NAVY, textAlign: "start" }}>{m.value}</p>
                </div>
              ))}
            </div>

            {displayTotals.issueCount > 0 && (
              <button
                type="button"
                onClick={() => onEditLines?.()}
                style={{
                  ...ui.btnSecondary,
                  marginTop: "14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#B45309",
                }}
              >
                <ListChecks style={{ width: 14, height: 14, flexShrink: 0 }} />
                {displayTotals.issueCount} {ar ? "بندًا فيه خلل يمنع الاعتماد — افتح البنود" : "lines with issues blocking approval — open lines"}
              </button>
            )}
          </IdentityCard>

          <IdentityCard
            icon={ListChecks}
            title={ar ? "التوزيع حسب الفرع" : "Breakdown by station"}
            subtitle={ar
              ? "الأساسي والبدلات والإضافي قبل الاعتماد النهائي"
              : "Base, allowances and overtime before final approval"}
            bodyStyle={{ padding: 0 }}
            dir={ar ? "rtl" : "ltr"}
          >
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "620px" }}>
                <div style={tableHead}>
                  <div>{ar ? "الفرع" : "Station"}</div>
                  <div>{ar ? "العدد" : "Heads"}</div>
                  <div>{ar ? "الأساسي" : "Base"}</div>
                  <div title={ar ? `إضافي ×${OT_RATE}` : `OT ×${OT_RATE}`}>{ar ? "الإضافي" : "Overtime"}</div>
                  <div>{ar ? "الإجمالي" : "Total"}</div>
                </div>
                <div style={{ padding: "9px 18px", borderBottom: "1px solid #F1F5F9", fontSize: "11px", color: MUTED }}>
                  {ar
                    ? `قاعدة الإضافي: ${OT_RATE * 100}% من أجر الساعة (المادة 107)`
                    : `OT rule: ${OT_RATE * 100}% of hourly wage (Article 107)`}
                  {stationScope !== "all" && (
                    <>
                      {" · "}
                      {ar
                        ? "التصفية أدناه بحسب نطاق الفرع — ملف حماية الأجور يُقدَّم على مستوى المنشأة كاملة"
                        : "Rows below follow the station scope — the WPS file is still filed for the whole establishment"}
                    </>
                  )}
                </div>
                {stationRows.length === 0 ? (
                  <div style={{ padding: "22px 18px", textAlign: "center", fontSize: "12px", color: MUTED }}>
                    {stationScope === "all"
                      ? (ar ? "لا صفوف فروع في هذا المسير." : "No station rows in this run.")
                      : (ar ? "لا صف لهذا الفرع في المسير — بدّل الفرع أو اختر كل الفروع." : "No row for this station in the run — switch station or pick all stations.")}
                  </div>
                ) : (
                  stationRows.map((r) => (
                    <div
                      key={r.stationId}
                      style={{
                        ...tableRow,
                        background: hoverRow === r.stationId ? "#F7F8FA" : undefined,
                      }}
                      onMouseEnter={() => setHoverRow(r.stationId)}
                      onMouseLeave={() => setHoverRow(null)}
                    >
                      <div style={{ fontSize: "13px", fontWeight: 500, color: NAVY }}>{stationName(r.stationId)}</div>
                      <div dir="ltr" style={{ fontSize: "12px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right" }}>{r.heads}</div>
                      <div dir="ltr" style={{ fontSize: "12px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right" }}>{fmt(r.baseAndAllowances, "")}</div>
                      <div
                        dir="ltr"
                        style={{
                          fontSize: "12px",
                          fontFamily: "'IBM Plex Sans',sans-serif",
                          textAlign: "right",
                          color: r.overtime > 50000 ? "#DC2626" : MUTED,
                          fontWeight: r.overtime > 50000 ? 600 : 400,
                        }}
                      >
                        {fmt(r.overtime, "")}
                      </div>
                      <div dir="ltr" style={{ fontSize: "13px", fontWeight: 600, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right", color: NAVY }}>
                        {fmt(r.total, "")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </IdentityCard>
        </div>
      )}
    </section>
  );
}
