import React, { useEffect, useState } from "react";
import { reconcileAdvanceInstallments } from "@/lib/deductionGenerators";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  ensurePayrollRun,
  getRun,
  monthKey,
  netOf,
  payrollItemIssues,
  setOwnerPayrollEnabled,
  updatePayrollItem,
  setItemPaid,
  refreshOwnPayrollDerivation,
  syncPayrollFromProfiles,
} from "@/lib/payroll";
import { facePayrollItem } from "@/lib/payrollWageSync";
import { slipRows } from "@/components/payroll/PayrollSlipBoard";
import { companyPayday } from "@/lib/payrollLaw";
import { printReport } from "@/lib/printReport";
import PayrollTableRows from "@/components/payroll/PayrollTableRows";
import OwnerPayrollToggle from "@/components/payroll/OwnerPayrollToggle";
import PayrollSyncDialog from "@/components/payroll/PayrollSyncDialog";
import PayrollTemplateCard from "@/components/payroll/PayrollTemplateCard";
import { canAdjustPayroll } from "@/lib/permissions";
import { toast } from "@/components/ui/use-toast";
import { payrollManageScope, UNASSIGNED_STATION_ID } from "@/lib/payrollManageScope";
import DeductionLinesDialog from "@/components/payroll/DeductionLinesDialog";
import PayrollRunBoard from "@/components/payroll/PayrollRunBoard";
import PayrollWpsBoard from "@/components/payroll/PayrollWpsBoard";
import PayrollAttendanceBoard from "@/components/payroll/PayrollAttendanceBoard";
import PayrollGosiBoard from "@/components/payroll/PayrollGosiBoard";
import GosiFollowUpBoard from "@/components/payroll/GosiFollowUpBoard";
import PayrollEosBoard from "@/components/payroll/PayrollEosBoard";
import { AllowanceLedgerCard, PayslipEstimateCard, SiteConditionsCard } from "@/components/payroll/PayslipLedger";
import { requestSelfEmployee } from "@/lib/employeeFileView";
import { derivePayrollMonthAttendance } from "@/lib/payrollMonthAttendance";
import PayrollCycleReview, { Fold } from "@/components/payroll/PayrollCycleReview";
import { stationWithSite } from "@/lib/siteRemoteness";
import { previousMonth } from "@/lib/payrollReview";
import MyPayslipArchive from "@/components/payroll/MyPayslipArchive";
import CompensationRing from "@/components/payroll/CompensationRing";
import MyRightsList, { PAY_RIGHT_IDS } from "@/components/dashboard/MyRightsList";
import PayrollSlipBoard from "@/components/payroll/PayrollSlipBoard";
import PayrollArchiveBoard, { shiftMonthKey } from "@/components/payroll/PayrollArchiveBoard";
import {
  addDeductionLine,
  removeDeductionLine,
  resolveDeductionDispute,
  backfillLegacyDeduction,
  disputeDeductionLine,
  deductionLines,
  reconcileDamageObjections,
} from "@/lib/payrollDeductions";
import PayrollLawPanel from "@/components/payroll/PayrollLawPanel";
import PayrollMinistryPanel from "@/components/payroll/PayrollMinistryPanel";
import PayrollMineDeductions from "@/components/payroll/PayrollMineDeductions";
import { notifyMoney } from "@/lib/moneyNotifications";
import useStationScope from "@/hooks/useStationScope";
import OpsFrame, { HeroSwitch } from "@/components/tasks/OpsFrame";
import { article90MaxDeduction, lineComponents } from "@/lib/payrollDerivations";
import { BORDER, MUTED, SURFACE, tableShell } from "@/lib/platformStyles";
import { brandReportColor } from "@/lib/pdfTheme";
import FinanceViewSwitch from "@/components/shared/FinanceViewSwitch";
import { MANAGE, SELF, canManageSurface, resolveFinanceView } from "@/lib/financeRights";
import { useRailSide } from "@/lib/railSide";
import { PAYROLL_DENY, payrollDenyReason } from "@/lib/payrollRights";

const MANAGE_LAYERS = ["run", "att", "lines", "deduct", "gosi", "eos", "slip", "wps", "files", "archive"];
// An employee is not "management minus buttons" here: the whole run is somebody
// else's business. What is theirs is the one line charged to their own name.
const SELF_LAYERS = ["slip", "deduct", "archive"];

// Four sections for management, like the other sections: each holds its tabs; the rest open from the cycle's steps.
const MANAGE_GROUPS = [
  { id: "run", ar: "المسير", en: "Run", tabs: ["run", "att", "eos", "files"] },
  { id: "lines", ar: "البنود والخصومات", en: "Lines and deductions", tabs: ["lines", "deduct"] },
  { id: "wps", ar: "حماية الأجور والتأمينات", en: "Wage protection and GOSI", tabs: ["wps", "gosi"] },
  { id: "archive", ar: "الأرشيف والقسائم", en: "Archive and payslips", tabs: ["archive", "slip"] },
];
const SUB_LABELS = {
  lines: ["البنود", "Lines"], deduct: ["بنود الخصم", "Deductions"],
  wps: ["حماية الأجور", "Wage protection"], gosi: ["التأمينات", "GOSI"],
  archive: ["الأرشيف", "Archive"], slip: ["قسيمة الراتب", "Payslip"],
  att: ["الحضور المقفل", "Locked attendance"], eos: ["نهاية الخدمة", "End of service"], files: ["القالب", "Template"],
};
const quickBtn = (primary, disabled = false) => ({
  fontFamily: "inherit", height: 34, padding: "0 14px", borderRadius: 8, cursor: disabled ? "default" : "pointer", fontSize: 12.5, fontWeight: 700,
  display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1,
  border: primary ? "1px solid var(--nv-accent, #1E9E63)" : "1px solid var(--nv-line, #D5DCD8)",
  background: primary ? "var(--nv-accent, #1E9E63)" : "var(--nv-card, #fff)",
  color: primary ? "#fff" : "var(--nv-ink, #111418)",
});

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
  const requestedRaw = searchParams.get("tab");
  const requested = requestedRaw === "payslip" ? "slip" : requestedRaw;
  const tab = layers.includes(requested) ? requested : homeTab;
  const month = liveMonth;
  const group = view === MANAGE ? MANAGE_GROUPS.find((g) => g.tabs.includes(tab)) || MANAGE_GROUPS[0] : null;

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
    if (canView && view === MANAGE && company) {
      ensurePayrollRun(company.id, liveMonth);
      // Art. 91: accepted damage objections are refunded on the open line.
      if (canManage) reconcileDamageObjections(company.id, liveMonth);
      // Art. 92(1): each approved advance still owed takes this month's instalment (≤ 10% of the wage).
      if (canManage) reconcileAdvanceInstallments(company.id, liveMonth, currentUser);
    }
    if (company && view === SELF) refreshOwnPayrollDerivation(company.id, liveMonth);
  }, [company?.id, liveMonth, canView, includeOwner, view]);

  useEffect(() => {
    setStationFilter(headerScope === "all" ? [] : [headerScope]);
  }, [headerScope, data?.stations]);

  const run = getRun(data, month);
  const items = run?.items || [];
  // Whose lines this manager sees — shared with the «الامتثال الوزاري» index (lib/payrollManageScope).
  const { payrollScope, payrollEmployees, ownerIds, employeeForItem, itemStationId, inScope: lineInScope } = payrollManageScope(data, currentUser, { ar });
  const allowedStations = (data.stations || []).filter((station) => payrollScope === null || payrollScope.includes(station.id));
  const filterStations = [...allowedStations, { id: UNASSIGNED_STATION_ID, name: ar ? "غير مخصص" : "Unassigned" }];
  const allowedStationIds = new Set(filterStations.map((station) => station.id));
  const selectedStationIds = stationFilter.filter((id) => allowedStationIds.has(id));
  const scopedItems = items.filter(lineInScope);
  const managedVisible = selectedStationIds.length === 0 ? scopedItems : scopedItems.filter((item) => selectedStationIds.includes(itemStationId(item) || UNASSIGNED_STATION_ID));
  // The personal view is a single line: the one charged to the signed-in person.
  // Station scope has nothing to do with it, and nobody else's wage passes through.
  const myItems = items.filter((item) => String(item.employeeId || "") === String(currentUser?.id || ""));
  const faceOf = (item) => facePayrollItem(
    item,
    (data.employees || []).find((employee) => employee.id === item.employeeId),
    { otDecisions: data?.otDecisions, month, company: data },
  );
  const myFaced = myItems.map(faceOf);
  const visible = view === MANAGE ? managedVisible : myFaced;
  const myItem = myFaced[0] || null;
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
      ? "الأجر الخاضع = الأساسي + بدل السكن + العمولات، بسقف 45,000 وحد أدنى 1,500 (400 للوافد في الأخطار). النقل والبدلات الأخرى والليلي والإضافي والمكافأة خارجه. المشترك القديم 9.75٪ و11.75٪. المشترك الجديد بحسب جدول المعاشات الساري في شهر المسير. تاريخ التسجيل الفارغ يُبقي حصة السعودي 9.75٪. الوافد: 2٪ أخطار مهنية على الشركة."
      : "Contributory wage = basic + housing + commissions, capped at 45,000 with a 1,500 floor (400 for expats in hazards). Transport, other, night, overtime and bonus stay outside. Old subscriber 9.75% / 11.75%. A new subscriber uses the annuity band in force for the payroll month. An empty registration date keeps a Saudi at 9.75%. Expat: 2% occupational hazard on the company.",
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
    const faced = faceOf(item);
    const e = employeeForItem(faced);
    const parts = lineComponents(faced);
    printReport({
      title: ar ? "قسيمة راتب" : "Payslip",
      companyName: company.name,
      periodLabel: `${e?.name || ""} — ${monthLabel}`,
      dir,
      logoUrl: branding.logoUrl || "",
      color: brandReportColor(branding.color),
      stats: [
        { value: `${netOf(faced).toLocaleString("en-US")} ${faced.currency}`, label: ar ? "الصافي المحوَّل" : "Net transferred" },
        { value: faced.paid ? (ar ? "مدفوع" : "Paid") : (ar ? "غير مدفوع" : "Unpaid"), label: ar ? "حالة الدفع" : "Payment status" },
      ],
      sections: [{
        heading: ar ? "تفاصيل الراتب" : "Salary breakdown",
        headers: ar ? ["البند", "المبلغ"] : ["Item", "Amount"],
        rows: [
          ...slipRows(faced, e, parts, ar).map((row) => [
            row.label,
            row.info ? row.valueText : `${row.minus ? "- " : ""}${Number(row.amount || 0).toLocaleString("en-US")} ${faced.currency}`,
          ]),
          [ar ? "سقف الخصم (المادة 93)" : "Deduction cap (Art. 93)", `${article90MaxDeduction(faced).toLocaleString("en-US")} ${faced.currency}`],
          [ar ? "الصافي المحوَّل" : "Net transferred", `${netOf(faced).toLocaleString("en-US")} ${faced.currency}`],
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

  const approvedRun = ["approved", "sent"].includes(serverMeta.status || run?.status || "");

  return (
    <OpsFrame
      ar={ar}
      lane={view === SELF ? "mine" : "manage"}
      section={ar ? "المال" : "Money"}
      title={view === SELF ? (ar ? "قسيمتي" : "My payslip") : (ar ? "المال والرواتب" : "Money and payroll")}
      hint={null}
      meta={(
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
          {view === MANAGE ? (
            <HeroSwitch
              options={MANAGE_GROUPS.map((g) => ({ value: g.id, label: ar ? g.ar : g.en }))}
              value={group?.id}
              onChange={(id) => setTab(MANAGE_GROUPS.find((g) => g.id === id).tabs[0])}
              label={ar ? "أقسام المال والرواتب" : "Payroll sections"}
            />
          ) : (
            <HeroSwitch
              options={[
                { value: "slip", label: ar ? "قسيمتي" : "My payslip" },
                { value: "deduct", label: ar ? "خصوماتي" : "My deductions" },
                { value: "archive", label: ar ? "أرشيف قسيمتي" : "My payslip archive" },
              ]}
              value={tab}
              onChange={setTab}
              label={ar ? "قسيمتي" : "My payslip"}
            />
          )}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginInlineStart: "auto", flexWrap: "wrap" }}>
            {railSide && view === SELF ? null : <FinanceViewSwitch ar={ar} view={view} canManage={canManage} showSwitch={!railSide} onChange={setView} />}
            {view === MANAGE ? (
              <>
                <button type="button" onClick={() => setShowSyncConfirm(true)} style={quickBtn(false)}>
                  <RefreshCw style={{ width: 13, height: 13 }} />
                  {ar ? "تحديث من الملفات" : "Refresh from profiles"}
                </button>
                <button
                  type="button"
                  disabled={approvedRun}
                  onClick={() => {
                    if (tab !== "run") setTab("run");
                    window.setTimeout(() => window.dispatchEvent(new Event("nv:payroll-approve")), tab === "run" ? 0 : 400);
                  }}
                  style={quickBtn(true, approvedRun)}
                >
                  {approvedRun ? (ar ? "✓ المسير معتمد" : "✓ Run approved") : (ar ? "✓ اعتمد المسير" : "✓ Approve run")}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    >
      {view === MANAGE && group && group.tabs.length > 1 && group.id !== "run" ? (
        <div style={{ marginBottom: 12 }}>
          <HeroSwitch
            options={group.tabs.map((t) => ({ value: t, label: ar ? SUB_LABELS[t][0] : SUB_LABELS[t][1] }))}
            value={tab}
            onChange={setTab}
            label={ar ? (group.ar) : group.en}
          />
        </div>
      ) : null}
      {view === MANAGE && group?.id === "run" && tab !== "run" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setTab("run")} style={quickBtn(false)}>{ar ? "→ العودة إلى دورة المسير" : "← Back to the run cycle"}</button>
          <strong style={{ fontSize: 14, color: "var(--nv-ink)" }}>{ar ? SUB_LABELS[tab][0] : SUB_LABELS[tab][1]}</strong>
          <span style={{ fontSize: 12, color: MUTED }}>{hints[tab]}</span>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tab === "run" && view === MANAGE && (() => {
        const faced = managedVisible.map(faceOf);
        const scopeIds = new Set(faced.map((item) => itemStationId(item) || UNASSIGNED_STATION_ID));
        const prevRun = getRun(data, previousMonth(month));
        const prevItems = (prevRun?.items || []).filter((item) => !ownerIds.has(item.employeeId)
          && (selectedStationIds.length === 0
            ? (payrollScope === null || payrollScope.includes(itemStationId(item)))
            : scopeIds.has(itemStationId(item) || UNASSIGNED_STATION_ID)));
        const attGaps = faced.filter((item) => derivePayrollMonthAttendance(item.employeeId, month, data).attGap).length;
        const deductionGaps = faced.filter((item) => {
          const lines = (item.deductionLines || []).filter((line) => Number(line?.amount) > 0);
          return (Number(item.deductions) > 0 && !lines.length) || lines.some((line) => line.source === "manual" && !String(line.reason || line.note || "").trim());
        }).length;
        const gosiOpen = faced.filter((item) => item.isSaudi == null || item.gosiBlocked).length;
        return (
          <PayrollCycleReview
            ar={ar}
            month={month}
            monthLabel={monthLabel}
            run={run}
            items={faced}
            prevItems={prevItems}
            employeeForItem={employeeForItem}
            employees={data.employees || []}
            stationName={(id) => (id === UNASSIGNED_STATION_ID || id === "__unassigned__" ? (ar ? "غير مخصص" : "Unassigned") : (data.stations || []).find((s) => s.id === id)?.name || id)}
            stationOf={(item) => itemStationId(item) || "__unassigned__"}
            stations={(data.stations || []).map((st) => stationWithSite(data, st.id))}
            attGaps={attGaps}
            issueCount={issueCount}
            deductionGaps={deductionGaps}
            gosiOpen={gosiOpen}
            onGo={setTab}
            middle={(
              <PayrollRunBoard
                month={month}
                lang={lang}
                stationScope={headerScope}
                onEditLines={() => setTab("lines")}
                onOpenWps={() => setTab("wps")}
                onMeta={setServerMeta}
              />
            )}
          />
        );
      })()}

      {tab === "run" && view === MANAGE && (
        <Fold
          id="payroll-law"
          title={ar ? "مواعيد الأجر وحمايته" : "Wage timing and protection"}
          note={ar ? "يوم الصرف، والأجر الأسبوعي، وأجر الإجازة مقدّماً، والحد الأدنى الداخلي، وكشف الأجور." : "Payday, weekly pay, leave pay ahead, the internal minimum and the wage sheet."}
        >
          <PayrollLawPanel
            companyId={company?.id}
            data={data}
            month={month}
            items={managedVisible.map(faceOf)}
            employeeForItem={employeeForItem}
            canManage={canManage}
            ar={ar}
            embedded
          />
        </Fold>
      )}

      {tab === "run" && view === MANAGE && (
        <PayrollMinistryPanel
          ar={ar}
          data={data}
          month={month}
          items={managedVisible.map(faceOf)}
          employeeForItem={employeeForItem}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <GosiFollowUpBoard data={data} companyId={company?.id} ar={ar} by={currentUser?.name || ""} />
          <PayrollGosiBoard items={visible} employeeForItem={employeeForItem} ar={ar} month={month} />
        </div>
      )}

      {tab === "eos" && view === MANAGE && (
        <PayrollEosBoard items={visible} employeeForItem={employeeForItem} ar={ar} payrollRuns={data?.payrollRuns || []} />
      )}

      {tab === "archive" && view === SELF && (() => {
        const me = myItem ? employeeForItem(myItem) : requestSelfEmployee(currentUser, data.employees || []);
        return (
          <MyPayslipArchive
            employee={me}
            employeeIds={[currentUser?.id]}
            runs={data.payrollRuns || []}
            ar={ar}
            lang={lang}
            companyName={company?.name || ""}
          />
        );
      })()}

      {tab === "deduct" && view === SELF && (
        <PayrollMineDeductions
          ar={ar}
          item={myItem}
          employee={myItem ? employeeForItem(myItem) : null}
          onDispute={(lineId, note) => disputeLine(lineId, note)}
          onExport={(rows) => printReport({
            title: ar ? "خصوماتي" : "My deductions",
            companyName: company.name,
            periodLabel: `${currentUser?.name || ""} — ${monthLabel}`,
            dir,
            logoUrl: branding.logoUrl || "",
            color: brandReportColor(branding.color),
            sections: [{
              heading: ar ? "بنود الخصم" : "Deduction lines",
              headers: ar ? ["البند", "المبلغ", "السبب والسند", "الحالة"] : ["Line", "Amount", "Reason", "Status"],
              rows: rows.map((row) => [
                row.sub ? `${row.title} · ${row.sub}` : row.title,
                row.amountText || `SAR ${Number(row.amount || 0).toLocaleString("en-US")}`,
                row.reason,
                row.status.label,
              ]),
            }],
          })}
        />
      )}

      {tab === "slip" && view === SELF && (() => {
        // قسيمتي: the run's line when the month has one; otherwise the file's own reading of the month.
        const me = myItem ? employeeForItem(myItem) : requestSelfEmployee(currentUser, data.employees || []);
        const station = stationWithSite(data, me?.stationId);
        return (
          <div data-my-payslip="1" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* the same two-column face as طلباتي: the slip on the start side, the ring and the rights beside it */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 16, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                {myItem ? (
                  <PayrollSlipBoard
                    monthLabel={monthLabel}
                    month={month}
                    items={visible}
                    employeeForItem={employeeForItem}
                    data={data}
                    ar={ar}
                    personal
                    onExport={exportPayslip}
                  />
                ) : me ? (
                  <PayslipEstimateCard
                    employee={me}
                    ar={ar}
                    monthLabel={monthLabel}
                    month={month}
                    stationName={station.name || ""}
                    note={ar
                      ? "لا بند لك في مسير هذا الشهر بعد — تقدير من ملفك حتى يُجهَّز المسير ويُقفل الحضور."
                      : "No line for you in this month's run yet — an estimate from your file until the run is prepared and attendance locks."}
                  />
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا ملف موظف مرتبط بحسابك بعد." : "No employee file is linked to your account yet."}</p>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                {me ? <CompensationRing employee={me} ar={ar} line={myItem || null} month={month} onHistory={() => setTab("archive")} /> : null}
                <MyRightsList employee={me} data={data} ar={ar} only={PAY_RIGHT_IDS} title={ar ? "حقوق راتبي" : "My pay rights"} lede={ar ? "موعد راتبك وحد الخصم منه — من ملفك." : "Your payday and the deduction cap — from your file."} />
              </div>
            </div>
            {me ? <AllowanceLedgerCard employee={me} ar={ar} /> : null}
            {me ? <SiteConditionsCard employee={me} station={station} ar={ar} /> : null}
            {me ? <PayrollMinistryPanel ar={ar} data={data} month={month} items={myItem ? [myItem] : []} self /> : null}
          </div>
        );
      })()}

      {tab === "slip" && view !== SELF && (
        <PayrollSlipBoard
          monthLabel={monthLabel}
          month={month}
          items={visible}
          employeeForItem={employeeForItem}
          data={data}
          ar={ar}
          personal={false}
          onExport={exportPayslip}
        />
      )}

      {(tab === "lines" || tab === "deduct") && view === MANAGE && !approvedRun && visible.length ? (
        <p data-pay-locked="1" style={{ margin: 0, padding: "10px 14px", borderRadius: 10, background: "var(--nv-warn-soft, #FBF3E2)", color: "var(--nv-warn-ink, #7A5A12)", fontSize: 12.5, lineHeight: 1.7 }}>
          {ar ? "المسير لم يُعتمد بعد — يُعدَّل هنا ما يلزم، ولا يُحدَّد «مدفوع» إلا بعد الاعتماد." : "The run is not approved yet — edit what is needed here; «Paid» opens after approval."}
        </p>
      ) : null}
      {(tab === "lines" || tab === "deduct") && view === MANAGE && (
        <div style={{ ...tableShell, overflowX: "auto" }}>
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
                    payday={companyPayday(data?.settings, month)}
                    payLocked={!approvedRun}
                    onChange={(itemId, field, value) => refused(updatePayrollItem(company.id, month, itemId, { [field]: value }))}
                    onTogglePaid={(item, paid) => {
                      if (paid && !approvedRun) {
                        toast({ description: ar ? "يُصرف الأجر بعد اعتماد المسير — اعتمده أولاً من «المسير»." : "Wages are paid after the run is approved — approve it first.", variant: "destructive" });
                        return;
                      }
                      if (paid && payrollItemIssues(item).length) {
                        const issues = payrollItemIssues(item);
                        const msg = (issues.includes("ARTICLE_93_EXCEEDED") || issues.includes("ARTICLE_90_EXCEEDED"))
                          ? (ar ? "لا يمكن الدفع — مجموع الخصومات يتجاوز نصف الأجر (المادة 93)." : "Payment blocked — deductions exceed half the wage (Art. 93).")
                          : issues.includes("CURRENCY_NOT_SAR")
                            ? (ar ? "لا يمكن الدفع — الأجر يُدفع بالعملة الرسمية للمملكة (الريال) — المادة 90." : "Payment blocked — wages are paid in the Kingdom's official currency (SAR) — Art. 90.")
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
    </OpsFrame>
  );
}
