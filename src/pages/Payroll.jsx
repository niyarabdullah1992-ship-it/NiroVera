import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
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
import OwnerPayrollToggle from "@/components/payroll/OwnerPayrollToggle";
import PayrollSyncDialog from "@/components/payroll/PayrollSyncDialog";
import PayrollTemplateCard from "@/components/payroll/PayrollTemplateCard";
import { canAdjustPayroll, hrScopeStations } from "@/lib/permissions";
import { toast } from "@/components/ui/use-toast";
import { stationIdForTreeEmployee } from "@/lib/orgTree";
import DeductionLinesDialog from "@/components/payroll/DeductionLinesDialog";
import PayrollRunBoard from "@/components/payroll/PayrollRunBoard";
import PayrollWpsBoard from "@/components/payroll/PayrollWpsBoard";
import PayrollAttendanceBoard from "@/components/payroll/PayrollAttendanceBoard";
import PayrollGosiBoard from "@/components/payroll/PayrollGosiBoard";
import PayrollEosBoard from "@/components/payroll/PayrollEosBoard";
import PayrollSlipBoard from "@/components/payroll/PayrollSlipBoard";
import PayrollArchiveBoard, { shiftMonthKey } from "@/components/payroll/PayrollArchiveBoard";
import {
  addDeductionLine,
  removeDeductionLine,
  resolveDeductionDispute,
  backfillLegacyDeduction,
  disputeDeductionLine,
  deductionLines,
  sourceLabel,
} from "@/lib/payrollDeductions";
import DeductionDisputeForm from "@/components/payroll/DeductionDisputeForm";
import { notifyMoney } from "@/lib/moneyNotifications";
import useStationScope from "@/hooks/useStationScope";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import { pageKicker } from "@/lib/moduleMeta";
import { article90MaxDeduction, lineComponents, OT_RATE } from "@/lib/payrollDerivations";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { BORDER, MUTED, WARN, ui, SURFACE, tableShell } from "@/lib/platformStyles";
import { brandReportColor } from "@/lib/pdfTheme";
import FinanceViewSwitch from "@/components/shared/FinanceViewSwitch";
import { MANAGE, SELF, SELF_VIEW_NOTE, canManageSurface, resolveFinanceView } from "@/lib/financeRights";
import { useRailSide } from "@/lib/railSide";
import { PAYROLL_DENY, payrollDenyReason } from "@/lib/payrollRights";

const UNASSIGNED_STATION_ID = "__unassigned__";
const MANAGE_LAYERS = ["run", "att", "lines", "deduct", "gosi", "eos", "slip", "wps", "files", "archive"];
// An employee is not "management minus buttons" here: the whole run is somebody
// else's business. What is theirs is the one line charged to their own name.
const SELF_LAYERS = ["slip", "deduct"];

export default function Payroll() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const liveMonth = monthKey();
  const [archiveMonth, setArchiveMonth] = useState(() => shiftMonthKey(monthKey(), -1));
  const headerScope = useStationScope();
  const [stationFilter, setStationFilter] = useState(() => (headerScope === "all" ? [] : [headerScope]));
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [deductionItemId, setDeductionItemId] = useState(null);
  const [serverMeta, setServerMeta] = useState({ status: "", wps: null, heads: 0 });
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canManageSurface("payroll", currentUser, data);
  const railSide = useRailSide();
  const view = resolveFinanceView("payroll", currentUser, data, searchParams.get("view"), railSide);
  const layers = view === MANAGE ? MANAGE_LAYERS : SELF_LAYERS;
  const homeTab = layers[0];
  const requested = searchParams.get("tab");
  const tab = layers.includes(requested) ? requested : homeTab;
  const month = liveMonth;

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === homeTab) next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };
  const setView = (value) => {
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    if (value === SELF) next.set("view", SELF);
    else next.delete("view");
    setSearchParams(next, { replace: true });
  };

  const canView = canAdjustPayroll(currentUser, data);
  const includeOwner = data?.settings?.includeOwnerInPayroll === true;

  useEffect(() => {
    // Materialising the month's run is a management write. The personal view reads
    // whatever run already exists and says so plainly when there is none.
    if (canView && view === MANAGE && company) ensurePayrollRun(company.id, liveMonth);
  }, [company?.id, liveMonth, canView, includeOwner, view]);

  useEffect(() => {
    setStationFilter(headerScope === "all" ? [] : [headerScope]);
  }, [headerScope, data?.stations]);

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
  const managedVisible = selectedStationIds.length === 0 ? scopedItems : scopedItems.filter((item) => selectedStationIds.includes(itemStationId(item) || UNASSIGNED_STATION_ID));
  // The personal view is a single line: the one charged to the signed-in person.
  // Station scope has nothing to do with it, and nobody else's wage passes through.
  const myItems = items.filter((item) => String(item.employeeId || "") === String(currentUser?.id || ""));
  const visible = view === MANAGE ? managedVisible : myItems;
  const myItem = myItems[0] || null;
  const myDeductionCount = deductionLines(myItem).length;
  const paidCount = visible.filter((i) => i.paid).length;
  const issueCount = visible.filter((i) => payrollItemIssues(i).length).length;
  const branding = data.reportBranding || {};
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { month: "long", year: "numeric" });

  const headers = ar
    ? ["الموظف", "الأساسي", "البدلات", "مكافآت", "خصومات", "سقف الخصم", "الصافي", "الحالة"]
    : ["Employee", "Base", "Allowances", "Bonus", "Deductions", "Deduction cap", "Net", "Status"];

  const hints = {
    run: ar
      ? "دورة نظامية: تجهيز البنود · المواد 90 و92 و93 و107 · الاعتماد · حماية الأجور خلال 30 يوماً من الاستحقاق."
      : "Statutory cycle: prepare lines · Art. 90, 92, 93 and 107 · approve · wage protection within 30 days of entitlement.",
    att: ar
      ? "يُقرأ من التقويم التشغيلي ولا يُحرَّر هنا. الإضافي والغياب يُشتقّان منه."
      : "Read from the operational calendar — not edited here. Overtime and absence are derived from it.",
    lines: ar
      ? "الإضافي مشتقّ من الحضور. الصافي = الإجمالي − الخصومات − حصة الموظف من التأمينات. المادة 93 تمنع تجاوز نصف الأجر."
      : "Overtime is derived from attendance. Net = gross − deductions − employee GOSI. Article 93 bars exceeding half the wage.",
    deduct: ar
      ? "كل بند يحمل مصدراً وسبباً. الغياب مشتقّ من الحضور — تصحيحه من التقويم."
      : "Every line carries a source and a reason. Absence is derived from attendance — correct it on the calendar.",
    gosi: ar
      ? "الأجر الخاضع = الأساسي + البدلات بسقف 45,000. السعودي 9.75٪ و11.75٪. الوافد: 2٪ أخطار مهنية على الشركة."
      : "Contributory wage = base + allowances, capped at 45,000. Saudi 9.75% / 11.75%. Expat: 2% occupational hazard on the company.",
    eos: ar
      ? "نصف أجر شهر لكل سنة من الخمس الأولى، وأجر شهر لكل سنة تالية — التزام يُراكم ولا يُصرف إلا بانتهاء الخدمة."
      : "Half a month per year for the first five, a full month thereafter — accrued, paid only at exit.",
    slip: ar
      ? "الأرقام مشتقّة من المسير لا تُكتب يدوياً على القسيمة."
      : "Figures are derived from the run — they are not typed onto the slip.",
    wps: ar
      ? "لا ملف قبل اعتماد المسير، ولا إرسال لصف بلا هوية أو آيبان."
      : "No file before the run is approved, and no send while a row lacks ID or IBAN.",
    files: ar
      ? "المبالغ من ملف الموظف. هذا التبويب يحدّث البنود — لا يرسل مدى ولا يعتمد المسير."
      : "Amounts come from the employee file. This tab refreshes lines — it does not send Mudad or approve the run.",
    archive: ar
      ? "الشهور المغلقة تُقرأ من هنا. دورة هذا الشهر تبقى على المسير."
      : "Closed months are read here. This month’s cycle stays on the run.",
  };

  // Payroll mutators refuse with a code instead of throwing. Swallowing that code
  // would leave a blocked write looking like a write that simply did nothing, so
  // every guarded call is routed through here and the named reason is shown.
  const refused = (code) => {
    const reason = payrollDenyReason(code, ar);
    if (!reason) return false;
    toast({ description: reason, variant: "destructive" });
    return true;
  };

  const syncFromProfiles = () => {
    const count = syncPayrollFromProfiles(company.id, month);
    if (typeof count !== "number") {
      if (!refused(count)) {
        toast({ description: ar ? PAYROLL_DENY.MANAGE.reason : PAYROLL_DENY.MANAGE.reasonEn, variant: "destructive" });
      }
      return;
    }
    toast({
      title: ar ? "تم تحديث بيانات الرواتب" : "Payroll data refreshed",
      description: ar ? `تم تحديث بيانات ${count} موظف.` : `${count} employee profiles were updated.`,
    });
  };

  const exportPayslip = (item) => {
    const e = employeeForItem(item);
    const parts = lineComponents(item);
    printReport({
      title: ar ? "قسيمة راتب" : "Payslip",
      companyName: company.name,
      periodLabel: `${e?.name || ""} — ${monthLabel}`,
      dir,
      logoUrl: branding.logoUrl || "",
      color: brandReportColor(branding.color),
      // Payment status is a state, not an amount: left inside the amounts table it was
      // charted as a zero next to real money in the printed summary.
      stats: [
        { value: `${netOf(item).toLocaleString("en-US")} ${item.currency}`, label: ar ? "الصافي المحوَّل" : "Net transferred" },
        { value: item.paid ? (ar ? "مدفوع" : "Paid") : (ar ? "غير مدفوع" : "Unpaid"), label: ar ? "حالة الدفع" : "Payment status" },
      ],
      sections: [{
        heading: ar ? "تفاصيل الراتب" : "Salary breakdown",
        headers: ar ? ["البند", "المبلغ"] : ["Item", "Amount"],
        // The printed slip carries the same components as the on-screen one, or the two
        // documents would disagree about the same wage.
        rows: [
          [ar ? "الراتب الأساسي" : "Base salary", `${Number(item.base).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "البدلات" : "Allowances", `${Number(item.allowances).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "المكافآت" : "Bonus", `${Number(item.bonus).toLocaleString("en-US")} ${item.currency}`],
          ...(parts.overtimePay > 0
            ? [[
                ar
                  ? `أجر الساعات الإضافية المعتمدة (${parts.overtimeHours} × ${OT_RATE} — المادة 107)`
                  : `Approved overtime (${parts.overtimeHours}h × ${OT_RATE} — Art. 107)`,
                `${parts.overtimePay.toLocaleString("en-US")} ${item.currency}`,
              ]]
            : []),
          [ar ? "الخصومات" : "Deductions", `- ${Number(item.deductions).toLocaleString("en-US")} ${item.currency}`],
          [ar ? "سقف الخصم (المادة 93)" : "Deduction cap (Art. 93)", `${article90MaxDeduction(item).toLocaleString("en-US")} ${item.currency}`],
          [
            ar ? "التأمينات — حصة الموظف (خارج سقف المادة 93)" : "GOSI — employee share (outside the Art. 93 cap)",
            `- ${parts.gosiEmployee.toLocaleString("en-US")} ${item.currency}`,
          ],
          [ar ? "الصافي المحوَّل" : "Net transferred", `${netOf(item).toLocaleString("en-US")} ${item.currency}`],
        ],
      }],
    });
  };

  const deductionItem = visible.find((entry) => entry.id === deductionItemId) || null;
  // Shared by the management dialog and the employee's own deductions tab, so the
  // objection is logged and routed the same way whichever surface raised it.
  const disputeLine = (lineId, note, target = myItem) => {
    if (!target) return;
    const denial = disputeDeductionLine(company.id, liveMonth, target, lineId, note, currentUser);
    if (denial) {
      if (!refused(denial)) {
        toast({ description: ar ? PAYROLL_DENY.DISPUTE_OWN.reason : PAYROLL_DENY.DISPUTE_OWN.reasonEn, variant: "destructive" });
      }
      return;
    }
    const line = deductionLines(target).find((entry) => entry.id === lineId);
    if (line?.createdBy && !["system", "unknown"].includes(line.createdBy)) {
      notifyMoney(company.id, line.createdBy, {
        ar: `اعتراض جديد على بند خصم — ${employeeForItem(target)?.name || ""}: ${note}`,
        en: `New deduction dispute — ${employeeForItem(target)?.name || ""}: ${note}`,
        to: "/app/payroll?tab=deduct",
        key: `pay-dispute-${target.id}-${lineId}`,
      });
    }
    toast({ description: ar ? "سُجّل اعتراضك على بند الخصم." : "Your objection was recorded." });
  };
  const archiveRows = (data?.payrollRuns || [])
    .filter((entry) => entry.month < liveMonth)
    .map((entry) => {
      const runItems = (entry.items || []).filter((item) => !ownerIds.has(item.employeeId) && (
        payrollEmployees.some((employee) => employee.id === item.employeeId)
        || (item.employeeName && (payrollScope === null || payrollScope.includes(itemStationId(item))))
      ));
      const scoped = selectedStationIds.length === 0
        ? runItems
        : runItems.filter((item) => selectedStationIds.includes(itemStationId(item) || UNASSIGNED_STATION_ID));
      const currency = scoped[0]?.currency || "SAR";
      const total = scoped.reduce((sum, item) => sum + netOf(item), 0);
      return {
        month: entry.month,
        status: entry.status,
        heads: scoped.length,
        paid: scoped.filter((item) => item.paid).length,
        total: `${total.toLocaleString("en-US")} ${currency}`,
      };
    });

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/payroll", lang)}
      title={ar ? "مسير الأجور" : "Wage run"}
      hint={ar
        ? "الحضور يغذّي المسير. المسير لا يمسّ أوعية المصروفات والمخزون والأصول، ومطالبة مصروف لا تُصرف من المسير."
        : "Attendance feeds the run. The run does not touch expense, stock, or asset vessels, and an expense claim is never paid from payroll."}
      viewNote={view === SELF
        ? (tab === "slip"
          ? (ar ? SELF_VIEW_NOTE.payroll.ar : SELF_VIEW_NOTE.payroll.en)
          : (ar
            ? "كل بند خصم يحمل مصدره وسببه. إن رأيت بندًا غير صحيح فاعترض عليه هنا — الاعتراض يُسجَّل باسمك ويُبتّ فيه من الإدارة."
            : "Every deduction line carries its source and reason. If a line looks wrong, object here — the objection is logged in your name and settled by management."))
        : hints[tab]}
      legal={ar
        ? "دورة نظامية: تجهيز البنود · المواد 90 و92 و93 و107 · الاعتماد · حماية الأجور خلال 30 يوماً من الاستحقاق."
        : "Statutory cycle: prepare lines · Art. 90, 92, 93 and 107 · approve · wage protection within 30 days of entitlement."}
      tabs={view === MANAGE ? [
        { value: "run", label: ar ? "المسير" : "Run" },
        { value: "att", label: ar ? "الحضور المقفل" : "Locked attendance", count: issueCount },
        { value: "lines", label: ar ? "البنود" : "Lines" },
        { value: "deduct", label: ar ? "بنود الخصم" : "Deductions" },
        { value: "gosi", label: ar ? "التأمينات" : "GOSI" },
        { value: "eos", label: ar ? "نهاية الخدمة" : "End of service" },
        { value: "slip", label: ar ? "قسيمة الراتب" : "Payslip" },
        { value: "wps", label: ar ? "حماية الأجور" : "Wage protection" },
        { value: "files", label: ar ? "القالب" : "Template" },
        { value: "archive", label: ar ? "الأرشيف" : "Archive", count: (data?.payrollRuns || []).filter((entry) => entry.month < liveMonth).length },
      ] : [
        { value: "slip", label: ar ? "قسيمتي" : "My payslip" },
        { value: "deduct", label: ar ? "خصوماتي" : "My deductions", count: myDeductionCount },
      ]}
      tool={tab}
      onTool={setTab}
      meta={(
        <>
          <FinanceViewSwitch ar={ar} view={view} canManage={canManage} showSwitch={!railSide} onChange={setView} />
          {view === SELF ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
                <span style={{ fontSize: 10, color: MUTED }}>{ar ? "صافي راتبي" : "My net"}</span>
                <span dir="ltr" style={{ fontSize: 15, fontWeight: 700 }}>
                  {myItem ? `${netOf(myItem).toLocaleString("en-US")} ${myItem.currency}` : "—"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
                <span style={{ fontSize: 10, color: MUTED }}>{ar ? "دورة هذا الشهر" : "This month’s cycle"}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{monthLabel}</span>
              </div>
            </>
          ) : tab !== "archive" ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
                <span style={{ fontSize: 10, color: MUTED }}>{ar ? "الموظفون في النطاق" : "People in scope"}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{visible.length}</span>
              </div>
              <span style={{ width: 1, height: 30, background: BORDER }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
                <span style={{ fontSize: 10, color: MUTED }}>{ar ? "مدفوع" : "Paid"}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: paidCount === visible.length && visible.length ? "#137A49" : MUTED }}>{paidCount}/{visible.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
                <span style={{ fontSize: 10, color: MUTED }}>{ar ? "دورة هذا الشهر" : "This month’s cycle"}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{monthLabel}</span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
              <span style={{ fontSize: 10, color: MUTED }}>{ar ? "مسيرات مؤرشفة" : "Archived runs"}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{archiveRows.length}</span>
            </div>
          )}
          {view === MANAGE && tab !== "wps" && tab !== "archive" && (serverMeta.status || serverMeta.heads > 0) ? (
            <>
              {issueCount > 0 ? <span style={WARN}>{issueCount} {ar ? "بندًا يحتاج تصحيحًا" : "lines need a fix"}</span> : null}
              <button type="button" onClick={() => setShowSyncConfirm(true)} style={{ ...ui.btnSecondary, height: 34, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <RefreshCw style={{ width: 13, height: 13 }} />
                {ar ? "تحديث من الملفات" : "Refresh from profiles"}
              </button>
            </>
          ) : null}
        </>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tab === "run" && view === MANAGE && (
        <PayrollRunBoard
          month={month}
          lang={lang}
          stationScope={headerScope}
          onEditLines={() => setTab("lines")}
          onOpenWps={() => setTab("wps")}
          onMeta={setServerMeta}
        />
      )}

      {tab === "att" && view === MANAGE && (
        <PayrollAttendanceBoard
          month={month}
          items={visible}
          employeeForItem={employeeForItem}
          data={data}
          ar={ar}
          onOpenDeductions={(item) => { setDeductionItemId(item.id); setTab("deduct"); }}
        />
      )}

      {tab === "gosi" && view === MANAGE && (
        <PayrollGosiBoard items={visible} employeeForItem={employeeForItem} ar={ar} />
      )}

      {tab === "eos" && view === MANAGE && (
        <PayrollEosBoard items={visible} employeeForItem={employeeForItem} ar={ar} />
      )}

      {tab === "deduct" && view === SELF && (
        <div style={{ ...tableShell, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <LaborArticleCite ruleId="payroll.deduction.capRatio" ar={ar} showText />
          {!myItem ? (
            <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
              {ar ? "لا بند لك في مسير هذا الشهر بعد." : "You have no line in this month’s run yet."}
            </p>
          ) : myDeductionCount === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
              {ar ? "لا خصم على راتبك هذا الشهر." : "No deduction is charged to your wage this month."}
            </p>
          ) : deductionLines(myItem).map((line) => (
            <div key={line.id} style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{sourceLabel(line.source, ar)}</span>
                <span dir="ltr" style={{ fontSize: 13, fontWeight: 700 }}>{Number(line.amount || 0).toLocaleString("en-US")} {myItem.currency}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.7 }}>{line.reason || "—"}</p>
              {line.disputeStatus && line.disputeStatus !== "none" ? (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>
                  {ar ? "حالة الاعتراض: " : "Dispute: "}
                  {{
                    open: ar ? "مفتوح — بانتظار الإدارة" : "Open — awaiting management",
                    accepted: ar ? "قُبل وأُلغي الخصم" : "Accepted — deduction cancelled",
                    rejected: ar ? "رُفض" : "Rejected",
                  }[line.disputeStatus] || line.disputeStatus}
                </p>
              ) : myItem.paid ? (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>
                  {ar ? "الراتب مدفوع — لا يُفتح اعتراض بعد الصرف." : "The wage is paid — a dispute cannot be opened after payment."}
                </p>
              ) : (
                <DeductionDisputeForm ar={ar} onSubmit={(note) => disputeLine(line.id, note)} />
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "slip" && (
        <PayrollSlipBoard
          monthLabel={monthLabel}
          month={month}
          items={visible}
          employeeForItem={employeeForItem}
          data={data}
          ar={ar}
          onExport={exportPayslip}
        />
      )}

      {(tab === "lines" || tab === "deduct") && view === MANAGE && (
        <div style={{ ...tableShell, overflowX: "auto" }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", margin: "0 0 10px" }}>
              <LaborArticleCite ruleId="payroll.deduction.capRatio" ar={ar} showText />
              <LaborArticleCite ruleId="payroll.wage.payment.cite" ar={ar} showText />
              <LaborArticleCite ruleId="hours.ot.premium" ar={ar} showText />
            </div>
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
                    onChange={(itemId, field, value) => refused(updatePayrollItem(company.id, month, itemId, { [field]: value }))}
                    onTogglePaid={(item, paid) => {
                      if (paid && payrollItemIssues(item).length) {
                        const issues = payrollItemIssues(item);
                        const msg = (issues.includes("ARTICLE_93_EXCEEDED") || issues.includes("ARTICLE_90_EXCEEDED"))
                          ? (ar ? "لا يمكن الدفع — مجموع الخصومات يتجاوز نصف الأجر (المادة 93)." : "Payment blocked — deductions exceed half the wage (Art. 93).")
                          : issues.includes("OT_ANNUAL_CAP")
                            ? (ar ? "لا يمكن الدفع — ساعات الإضافي تتجاوز 720 ساعة في السنة (اللائحة مادة 22)." : "Payment blocked — overtime exceeds 720 hours in a year (implementing regulations Art. 22).")
                            : (ar ? "لا يمكن اعتماد الدفع قبل إدخال راتب أساسي ومبالغ صحيحة وصافي موجب وعملة صالحة." : "Payment cannot be approved until base salary, valid amounts, a positive net, and a valid currency are set.");
                        toast({ description: msg, variant: "destructive" });
                        return;
                      }
                      refused(setItemPaid(company.id, month, item.id, paid));
                    }}
                    onPayslip={exportPayslip}
                    onDeductions={(item) => { backfillLegacyDeduction(company.id, month, item); setDeductionItemId(item.id); }}
                  />
                </tbody>
              </table>
            )}
        </div>
      )}

      {tab === "wps" && view === MANAGE && (
        <PayrollWpsBoard
          month={month}
          lang={lang}
          items={visible}
          employeeForItem={employeeForItem}
          onBackToRun={() => setTab("run")}
          onMeta={setServerMeta}
        />
      )}

      {tab === "files" && view === MANAGE && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PayrollTemplateCard company={company} data={data} employees={payrollEmployees} month={month} ar={ar} />
          <OwnerPayrollToggle checked={includeOwner} onChange={(checked) => refused(setOwnerPayrollEnabled(company.id, checked))} ar={ar} />
        </div>
      )}

      {tab === "archive" && view === MANAGE && (
        <PayrollArchiveBoard
          ar={ar}
          liveMonth={liveMonth}
          month={archiveMonth}
          onMonth={setArchiveMonth}
          rows={archiveRows}
        />
      )}

      <PayrollSyncDialog open={showSyncConfirm} onOpenChange={setShowSyncConfirm} onConfirm={syncFromProfiles} ar={ar} />

      <DeductionLinesDialog
        open={Boolean(deductionItem)}
        onOpenChange={(open) => !open && setDeductionItemId(null)}
        item={deductionItem}
        employeeName={deductionItem ? employeeForItem(deductionItem)?.name || "" : ""}
        ar={ar}
        canEdit={view === MANAGE}
        onAdd={(line) => {
          // The code goes back to the form too, which prints the gate's own message
          // under the inputs. Swallowing it left an Article 93 refusal looking like a
          // write that simply vanished: fields cleared, nothing said, nothing saved.
          const code = addDeductionLine(company.id, liveMonth, deductionItem, line, currentUser);
          refused(code);
          return code;
        }}
        onRemove={(lineId) => refused(removeDeductionLine(company.id, liveMonth, deductionItem, lineId, currentUser))}
        onResolve={(lineId, status) => refused(resolveDeductionDispute(company.id, liveMonth, deductionItem, lineId, status, currentUser))}
        currentUserId={currentUser?.id}
        onDispute={(lineId, note) => disputeLine(lineId, note, deductionItem)}
      />
      </div>
    </SuiteWorkspaceFrame>
  );
}
