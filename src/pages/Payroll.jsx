import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileSpreadsheet, ListChecks, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  ensurePayrollRun,
  getRun,
  isPayrollEmployee,
  monthKey,
  netOf,
  payrollItemIssues,
  setOwnerPayrollEnabled,
  updatePayrollItem,
  setItemPaid,
  syncPayrollFromProfiles,
} from "@/lib/payroll";
import { printReport } from "@/lib/printReport";
import PayrollTableRows from "@/components/payroll/PayrollTableRows";
import PayrollSalaryNotice from "@/components/payroll/PayrollSalaryNotice";
import OwnerPayrollToggle from "@/components/payroll/OwnerPayrollToggle";
import PayrollSyncDialog from "@/components/payroll/PayrollSyncDialog";
import PayrollTemplateCard from "@/components/payroll/PayrollTemplateCard";
import { canAdjustPayroll, hrScopeStations } from "@/lib/permissions";
import { toast } from "@/components/ui/use-toast";
import { stationIdForTreeEmployee } from "@/lib/orgTree";
import DeductionLinesDialog from "@/components/payroll/DeductionLinesDialog";
import PayrollRunBoard from "@/components/payroll/PayrollRunBoard";
import PayrollWpsBoard from "@/components/payroll/PayrollWpsBoard";
import PayrollCycleStrip from "@/components/payroll/PayrollCycleStrip";
import {
  addDeductionLine,
  removeDeductionLine,
  resolveDeductionDispute,
  backfillLegacyDeduction,
  disputeDeductionLine,
  deductionLines,
} from "@/lib/payrollDeductions";
import { addNotification } from "@/lib/store";
import useStationScope from "@/hooks/useStationScope";
import IdentityCard from "@/components/shared/IdentityCard";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import ErpSectionFrame from "@/components/erp/ErpSectionFrame";
import { erpKicker } from "@/lib/erpModuleMeta";
import { article90MaxDeduction, isWpsLate } from "@/lib/payrollDerivations";
import { BORDER, MUTED, NEUTRAL, WARN, OK, field, ui, SURFACE } from "@/lib/platformStyles";
import { brandReportColor } from "@/lib/pdfTheme";

const UNASSIGNED_STATION_ID = "__unassigned__";
const LAYERS = new Set(["run", "lines", "wps", "files"]);

const monthInputStyle = {
  ...field,
  width: "auto",
  height: "34px",
  background: SURFACE,
  colorScheme: "light",
  fontWeight: 500,
};

export default function Payroll() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const [month, setMonth] = useState(monthKey());
  const headerScope = useStationScope();
  const [stationFilter, setStationFilter] = useState(() => (headerScope === "all" ? [] : [headerScope]));
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [deductionItemId, setDeductionItemId] = useState(null);
  const [serverMeta, setServerMeta] = useState({ status: "", wps: null, heads: 0 });
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab = LAYERS.has(requested) ? requested : "run";

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "run") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const canView = canAdjustPayroll(currentUser, data);
  const includeOwner = data?.settings?.includeOwnerInPayroll === true;

  useEffect(() => {
    if (canView && company) ensurePayrollRun(company.id, month);
  }, [company?.id, month, canView, includeOwner]);

  useEffect(() => {
    setStationFilter(headerScope === "all" ? [] : [headerScope]);
  }, [headerScope, data?.stations]);

  if (!canView) {
    return (
      <p style={{
        margin: "40px auto",
        maxWidth: "420px",
        textAlign: "center",
        fontSize: "13px",
        color: MUTED,
        lineHeight: 1.7,
      }}
      >
        {ar ? "هذا القسم متاح للإدارة العليا فقط." : "This section is available to executive management only."}
      </p>
    );
  }

  const run = getRun(data, month);
  const items = run?.items || [];
  const payrollScope = currentUser?.hrLevelId
    ? hrScopeStations(currentUser, data)
    : currentUser?.role === "pgm" ? (currentUser.managedStations || []) : null;
  const stationIdOf = (stationId) => stationId || null;
  const employeeStationId = (employee) => stationIdOf(stationIdForTreeEmployee(data, employee.id) || employee.stationId);
  const payrollEmployees = (data.employees || []).filter((employee) => isPayrollEmployee(employee, includeOwner) && (payrollScope === null || payrollScope.includes(employeeStationId(employee))));
  const ownerIds = new Set(includeOwner ? [] : (data.employees || []).filter((employee) => employee.role === "owner").map((employee) => employee.id));
  const employeeForItem = (item) => payrollEmployees.find((employee) => employee.id === item.employeeId) || {
    id: item.employeeId,
    name: item.employeeName || (ar ? "موظف سابق" : "Former employee"),
    position: item.employeePosition || "",
    stationId: stationIdOf(item.employeeStationId),
  };
  const itemStationId = (item) => {
    const employee = (data.employees || []).find((entry) => entry.id === item.employeeId);
    return employee ? employeeStationId(employee) : stationIdOf(item.employeeStationId);
  };
  const allowedStations = (data.stations || []).filter((station) => payrollScope === null || payrollScope.includes(station.id));
  const filterStations = [...allowedStations, { id: UNASSIGNED_STATION_ID, name: ar ? "غير مخصص" : "Unassigned" }];
  const allowedStationIds = new Set(filterStations.map((station) => station.id));
  const selectedStationIds = stationFilter.filter((id) => allowedStationIds.has(id));
  const scopedItems = items.filter((item) => !ownerIds.has(item.employeeId) && (payrollEmployees.some((employee) => employee.id === item.employeeId) || (item.employeeName && (payrollScope === null || payrollScope.includes(itemStationId(item))))));
  const visible = selectedStationIds.length === 0 ? scopedItems : scopedItems.filter((item) => selectedStationIds.includes(itemStationId(item) || UNASSIGNED_STATION_ID));
  const paidCount = visible.filter((i) => i.paid).length;
  const issueCount = visible.filter((i) => payrollItemIssues(i).length).length;
  const branding = data.reportBranding || {};
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(ar ? "ar-SA" : "en-GB", { month: "long", year: "numeric" });
  const scopedStationName = headerScope !== "all"
    ? (data.stations || []).find((s) => String(s.id) === String(headerScope))?.name
    : null;

  const headers = ar
    ? ["الموظف", "الأساسي", "البدلات", "مكافآت", "خصومات", "سقف م.93", "الصافي", "الحالة"]
    : ["Employee", "Base", "Allowances", "Bonus", "Deductions", "Art. 93 cap", "Net", "Status"];

  const hints = {
    run: ar
      ? "تجهيز واعتماد المسير: الحضور يُقفل هنا. راجع الإجمالي ثم اعتمد قبل ملف مدى."
      : "Prepare and approve the run: attendance closes here. Review the total, then approve before the Mudad file.",
    lines: ar
      ? "حضور معتمد يظهر كبند خصم هنا، ثم الصافي يدخل صف مدى. المادة 93 تمنع تجاوز نصف الأجر."
      : "Approved attendance appears here as a deduction line, then net enters the Mudad row. Article 93 blocks anything over half the wage.",
    wps: ar
      ? "حماية الأجور: هوية · آيبان · تطابق قوى · صافٍ موجب — ثم ملف مدى خلال 30 يوماً من الاستحقاق."
      : "Wage protection: ID · IBAN · Qiwa match · positive net — then the Mudad file within 30 days of entitlement.",
    files: ar
      ? "قالب المبالغ من ملف الموظف. الصفوف المدفوعة لا تُمس."
      : "Amount template from the employee file. Paid rows are left untouched.",
  };

  const syncFromProfiles = () => {
    const count = syncPayrollFromProfiles(company.id, month);
    toast({
      title: ar ? "تم تحديث بيانات الرواتب" : "Payroll data refreshed",
      description: ar ? `تم تحديث بيانات ${count} موظف.` : `${count} employee profiles were updated.`,
    });
  };

  const exportPayslip = (item) => {
    const e = employeeForItem(item);
    printReport({
      title: ar ? "قسيمة راتب" : "Payslip",
      companyName: company.name,
      periodLabel: `${e?.name || ""} — ${monthLabel}`,
      dir,
      logoUrl: branding.logoUrl || "",
      color: brandReportColor(branding.color),
      stats: [{ value: `${netOf(item).toLocaleString("en-US")} ${item.currency}`, label: ar ? "صافي الراتب" : "Net salary" }],
      sections: [{
        heading: ar ? "تفاصيل الراتب" : "Salary breakdown",
        headers: ar ? ["البند", "المبلغ"] : ["Item", "Amount"],
        rows: [
          [ar ? "الراتب الأساسي" : "Base salary", `${Number(item.base).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "البدلات" : "Allowances", `${Number(item.allowances).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "المكافآت" : "Bonus", `${Number(item.bonus).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "الخصومات" : "Deductions", `- ${Number(item.deductions).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "سقف الخصم (المادة 93)" : "Deduction cap (Art. 93)", `${article90MaxDeduction(item).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "الصافي" : "Net", `${netOf(item).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "حالة الدفع" : "Payment status", item.paid ? (ar ? "مدفوع" : "Paid") : (ar ? "غير مدفوع" : "Unpaid")],
        ],
      }],
    });
  };

  const deductionItem = visible.find((entry) => entry.id === deductionItemId) || null;

  return (
    <PlatformStampShell
      ar={ar}
      kicker={erpKicker("/app/payroll", lang)}
      title={scopedStationName || (ar ? "مسير الأجور" : "Wage run")}
      hint={hints[tab]}
      maxWidth={1280}
      sections={[
        { value: "run", label: ar ? "المسير" : "Run", icon: Wallet },
        { value: "lines", label: ar ? "البنود" : "Lines", icon: ListChecks },
        { value: "wps", label: ar ? "حماية الأجور" : "Wage protection", icon: ShieldCheck },
        { value: "files", label: ar ? "القالب" : "Template", icon: FileSpreadsheet },
      ]}
      tool={tab}
      onTool={setTab}
      meta={(
        <>
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            dir="ltr"
            aria-label={ar ? "شهر المسير" : "Payroll month"}
            style={monthInputStyle}
          />
          <span style={{ ...NEUTRAL, borderRadius: 8 }}>{visible.length} {ar ? "موظفًا" : "employees"}</span>
          <span style={{ ...(paidCount === visible.length && visible.length ? OK : NEUTRAL), borderRadius: 8 }}>
            {paidCount}/{visible.length} {ar ? "مدفوع" : "paid"}
          </span>
          {issueCount > 0 && (
            <span style={{ ...WARN, borderRadius: 8 }}>{issueCount} {ar ? "بندًا يحتاج تصحيحًا" : "lines need a fix"}</span>
          )}
          <button type="button" onClick={() => setShowSyncConfirm(true)} style={{ ...ui.btnSecondary, height: 34, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw style={{ width: 13, height: 13 }} />
            {ar ? "تحديث من الملفات" : "Refresh from profiles"}
          </button>
        </>
      )}
    >
      <ErpSectionFrame
        path="/app/payroll"
        ar={ar}
        stats={[
          { label: ar ? "موظفون في المسير" : "Employees in run", value: visible.length },
          {
            label: ar ? "مدفوع" : "Paid",
            value: `${paidCount}/${visible.length}`,
            tone: visible.length && paidCount === visible.length ? "ok" : paidCount > 0 ? "warn" : null,
          },
          { label: ar ? "بنود تحتاج تصحيح" : "Lines to fix", value: issueCount, tone: issueCount > 0 ? "warn" : null },
        ]}
      >
      <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
        {ar ? (
          <>
            المسير يُغذّى من{" "}
            <Link to="/app/attendance" style={{ fontWeight: 600, color: "inherit" }}>الحضور المعتمد</Link>.
          </>
        ) : (
          <>
            The run is fed by{" "}
            <Link to="/app/attendance" style={{ fontWeight: 600, color: "inherit" }}>approved attendance</Link>.
          </>
        )}
      </p>
      <PayrollCycleStrip
        ar={ar}
        hasRun={visible.length > 0 || serverMeta.heads > 0}
        heads={visible.length || serverMeta.heads}
        issueCount={issueCount}
        status={serverMeta.status}
        wpsLate={!!serverMeta.wps?.late || isWpsLate(month)}
        activeTab={tab}
        onOpenTab={setTab}
      />

      {tab === "run" && (
        <PayrollRunBoard
          month={month}
          lang={lang}
          stationScope={headerScope}
          onEditLines={() => setTab("lines")}
          onOpenWps={() => setTab("wps")}
          onMeta={setServerMeta}
        />
      )}

      {tab === "lines" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PayrollSalaryNotice ar={ar} />
          <IdentityCard
            icon={ListChecks}
            kicker={ar ? "البنود" : "Lines"}
            title={ar ? "مراجعة الأجر التعاقدي" : "Contractual wage review"}
            subtitle={ar ? "حضور معتمد → بند خصم → صافٍ → ملف مدى. المادة 93 تمنع تجاوز نصف الأجر." : "Approved attendance → deduction line → net → Mudad file. Article 93 blocks anything over half the wage."}
            meta={issueCount > 0 ? <span style={{ ...WARN, borderRadius: 8 }}>{issueCount} {ar ? "بندًا يحتاج تصحيحًا" : "lines need a fix"}</span> : null}
            bodyStyle={{ padding: 0, overflowX: "auto" }}
          >
            {visible.length === 0 ? (
              <p style={{ margin: "24px 18px", textAlign: "center", fontSize: 13, color: MUTED }}>
                {ar ? "لا موظفين في هذا النطاق — وسّع نطاق الهيدر أو حدّث من الملفات." : "No employees in this scope — widen header scope or refresh from profiles."}
              </p>
            ) : (
              <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[...headers, ar ? "قسيمة" : "Payslip"].map((h) => (
                      <th key={h} style={{ padding: "11px 12px", textAlign: "center", fontSize: 10, letterSpacing: "0.06em", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <PayrollTableRows
                    items={visible}
                    stations={allowedStations}
                    getStationId={itemStationId}
                    employeeForItem={employeeForItem}
                    ar={ar}
                    onChange={(itemId, field, value) => updatePayrollItem(company.id, month, itemId, { [field]: value })}
                    onTogglePaid={(item, paid) => {
                      if (paid && payrollItemIssues(item).length) {
                        const issues = payrollItemIssues(item);
                        const msg = (issues.includes("ARTICLE_93_EXCEEDED") || issues.includes("ARTICLE_90_EXCEEDED"))
                          ? (ar ? "لا يمكن الدفع — مجموع الخصومات يتجاوز نصف الأجر (المادة 93)." : "Payment blocked — deductions exceed half the wage (Art. 93).")
                          : issues.includes("OT_ANNUAL_CAP")
                            ? (ar ? "لا يمكن الدفع — ساعات الإضافي تتجاوز 720 ساعة في السنة (اللائحة مادة 22)." : "Payment blocked — overtime exceeds 720 hours in a year (implementing regulations Art. 22).")
                            : (ar ? "لا يمكن اعتماد الدفع قبل إدخال راتب أساسي ومبالغ صحيحة وصافي موجب وعملة صالحة." : "Payment cannot be approved until base salary, valid amounts, a positive net, and a valid currency are set.");
                        alert(msg);
                        return;
                      }
                      setItemPaid(company.id, month, item.id, paid);
                    }}
                    onPayslip={exportPayslip}
                    onDeductions={(item) => { backfillLegacyDeduction(company.id, month, item); setDeductionItemId(item.id); }}
                  />
                </tbody>
              </table>
            )}
          </IdentityCard>
        </div>
      )}

      {tab === "wps" && (
        <PayrollWpsBoard
          month={month}
          lang={lang}
          items={visible}
          employeeForItem={employeeForItem}
          onBackToRun={() => setTab("run")}
          onMeta={setServerMeta}
        />
      )}

      {tab === "files" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PayrollTemplateCard company={company} data={data} employees={payrollEmployees} month={month} ar={ar} />
          <OwnerPayrollToggle checked={includeOwner} onChange={(checked) => setOwnerPayrollEnabled(company.id, checked)} ar={ar} />
        </div>
      )}

      <PayrollSyncDialog open={showSyncConfirm} onOpenChange={setShowSyncConfirm} onConfirm={syncFromProfiles} ar={ar} />

      <DeductionLinesDialog
        open={Boolean(deductionItem)}
        onOpenChange={(open) => !open && setDeductionItemId(null)}
        item={deductionItem}
        employeeName={deductionItem ? employeeForItem(deductionItem)?.name || "" : ""}
        ar={ar}
        canEdit
        onAdd={(line) => addDeductionLine(company.id, month, deductionItem, line, currentUser)}
        onRemove={(lineId) => removeDeductionLine(company.id, month, deductionItem, lineId, currentUser)}
        onResolve={(lineId, status) => resolveDeductionDispute(company.id, month, deductionItem, lineId, status, currentUser)}
        currentUserId={currentUser?.id}
        onDispute={(lineId, note) => {
          disputeDeductionLine(company.id, month, deductionItem, lineId, note, currentUser);
          const line = deductionLines(deductionItem).find((entry) => entry.id === lineId);
          if (line?.createdBy && !["system", "unknown"].includes(line.createdBy)) {
            addNotification(company.id, line.createdBy, ar
              ? `اعتراض جديد على بند خصم — ${employeeForItem(deductionItem)?.name || ""}: ${note}`
              : `New deduction dispute — ${employeeForItem(deductionItem)?.name || ""}: ${note}`);
          }
        }}
      />
      </ErpSectionFrame>
    </PlatformStampShell>
  );
}
