import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { hrSectionAccessFor } from "@/lib/navVisibility";
import { HR_PANE_LABELS, resolveHrPane } from "@/lib/hrSection";
import { OPEN_HIRE_EVENT } from "@/lib/orgHire";
import { isManagerUnit, stationSubtreeIds } from "@/lib/stationTree";
import { syncWorkplaceManagers } from "@/lib/peopleTree";
import { canEditOrgDesign } from "@/lib/orgDesign";
import { notifyActingReminders, publishDueOrgChanges } from "@/lib/orgDesignStore";
import { toast } from "@/components/ui/use-toast";
import useStationScope from "@/hooks/useStationScope";
import OpsFrame, { HeroSwitch } from "@/components/tasks/OpsFrame";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import JobGradeManager from "@/components/employees/JobGradeManager";
import HrDirectoryBoard from "@/components/hr/HrDirectoryBoard";
import ComplianceMhrsdBoard from "@/components/hr/ComplianceMhrsdBoard";
import HrOverviewBoard from "@/components/hr/HrOverviewBoard";
import HrBranchesBoard from "@/components/hr/HrBranchesBoard";
import HrStructurePane from "@/components/hr/HrStructurePane";
import HrSectionSearch from "@/components/hr/HrSectionSearch";
import HireSeatDrawer from "@/components/hr/HireSeatDrawer";
import { MUTED } from "@/lib/platformStyles";

/**
 * «الموارد البشرية» — one management section that merged «الهيكل والفروع» (/app/hr) and
 * «المحطات التي أديرها» (/app/org admin). One hero, one switch:
 *   نظرة عامة · الموظفون · الهيكل · الفروع والمحطات · الامتثال
 * Each pane keeps the gate of what it carried (lib/hrSection). Old /app/org admin links redirect
 * here with their parameters; the employee keeps «مكاني في الهيكل» on /app/org?view=employee.
 */
export default function HRStructureManagement() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const stationScope = useStationScope();
  const [gradesOpen, setGradesOpen] = useState(false);
  const [hire, setHire] = useState(null);

  const access = useMemo(
    () => (data && currentUser ? hrSectionAccessFor(currentUser, data, company) : { panes: [] }),
    [currentUser, data, company],
  );
  const hashWantsCompliance = typeof window !== "undefined" && window.location.hash === "#compliance-center";
  const requested = searchParams.get("tab") || (hashWantsCompliance ? "compliance" : "");
  const tab = resolveHrPane(requested, access);

  const setTab = useCallback((value) => {
    const next = new URLSearchParams();
    if (value) next.set("tab", value);
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (hashWantsCompliance && access.panes?.includes("compliance") && searchParams.get("tab") !== "compliance") setTab("compliance");
  }, [hashWantsCompliance, access.panes, searchParams, setTab]);

  // HR's header scope narrows the glance like it narrows the directory; a station lead never leaves theirs.
  const scopeIds = useMemo(() => {
    if (access.scopeIds) return access.scopeIds;
    if (!stationScope || stationScope === "all") return null;
    return stationSubtreeIds(data?.stations || [], stationScope).map(String);
  }, [access.scopeIds, stationScope, data?.stations]);

  /* the hire drawer: ?hire=1&station=&seat=&list= (old /app/org?hire=1 links too) and the global «أضف موظف» */
  const openHire = useCallback((detail = {}) => {
    const station = (data?.stations || []).find((item) => String(item.id) === String(detail.stationId || ""));
    if (detail.stationId && isManagerUnit(station)) {
      toast({
        description: ar ? "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه." : "A manager is not a hire workplace. Convert it to a branch, then hire there.",
        variant: "destructive",
      });
      return;
    }
    setHire({ stationId: detail.stationId || "", seatId: detail.seatId || "", listId: detail.listId || "", listName: detail.listName || "" });
  }, [data?.stations, ar]);
  useEffect(() => {
    if (!searchParams.get("hire")) return;
    setHire({ stationId: searchParams.get("station") || "", seatId: searchParams.get("seat") || "", listId: searchParams.get("list") || "", listName: "" });
    const next = new URLSearchParams(searchParams);
    ["hire", "station", "seat", "list"].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    const onOpen = (event) => {
      const detail = event.detail || {};
      setHire({ stationId: detail.stationId || "", seatId: detail.seatId || "", listId: detail.listId || "", listName: detail.listName || "" });
    };
    window.addEventListener(OPEN_HIRE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HIRE_EVENT, onOpen);
  }, []);

  // Approved structure changes publish on their date; acting roles remind before they end; managers sync.
  const canEditDesign = Boolean(data && currentUser && canEditOrgDesign(currentUser, data));
  const housekeeping = useRef("");
  useEffect(() => {
    if (!company?.id || !canEditDesign || !currentUser) return;
    const stamp = `${company.id}:${currentUser.id}:${new Date().toDateString()}`;
    if (housekeeping.current === stamp) return;
    housekeeping.current = stamp;
    publishDueOrgChanges(company.id, currentUser);
    notifyActingReminders(company.id, currentUser);
  }, [company?.id, canEditDesign, currentUser]);
  useEffect(() => {
    if (!company?.id || !access.orgWrite) return;
    syncWorkplaceManagers(company.id);
  }, [company?.id, access.orgWrite]);

  const clearBranch = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("branch");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!data || !currentUser || !company) return null;
  if (!access.panes.length) return <Navigate to="/app/org?view=employee" replace />;

  const options = access.panes.map((id) => ({ value: id, label: ar ? HR_PANE_LABELS[id].ar : HR_PANE_LABELS[id].en }));
  const filter = searchParams.get("filter") || "";

  return (
    <>
      <OpsFrame
        ar={ar}
        lane="manage"
        section={ar ? "الموظفون" : "People"}
        title={ar ? "الموارد البشرية" : "Human resources"}
        hint={access.full
          ? (ar
            ? "الملف والمنصب والفرع والامتثال في قسم واحد — المنصب يحدد التبعية والصلاحية، والملف يغذّي الرواتب والإثبات."
            : "File, seat, branch and compliance in one section — the seat sets reporting and authority; the file feeds payroll and proof.")
          : (ar
            ? "محطاتك ومكانك في الهيكل — للاطلاع؛ التغيير في الملفات والهيكل عبر الموارد البشرية."
            : "Your stations and your place in the structure — read only; files and structure change through HR.")}
        meta={options.length > 1 ? <HeroSwitch options={options} value={tab} onChange={setTab} label={ar ? "أقسام الموارد البشرية" : "HR panes"} /> : null}
      >
        <div data-hr-section={tab} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <HrSectionSearch ar={ar} data={data} access={access} />
          <PageErrorBoundary resetKey={`hr:${tab}`}>
            {tab === "overview" ? (
              <HrOverviewBoard ar={ar} data={data} scopeIds={scopeIds} orgWrite={access.orgWrite} />
            ) : null}
            {tab === "people" ? (
              <>
                <HrDirectoryBoard lang={lang} stationScope={stationScope} initialFilter={filter} />
                <div>
                  <button
                    type="button"
                    onClick={() => setGradesOpen((open) => !open)}
                    aria-expanded={gradesOpen}
                    className="flex w-full items-center justify-between py-3 text-start text-[13px] font-semibold text-[var(--nv-ink)]"
                  >
                    {t("jobGradesManage")}
                    <ChevronDown className={`h-4 w-4 text-[var(--nv-muted)] transition-transform ${gradesOpen ? "rotate-180" : ""}`} />
                  </button>
                  {gradesOpen ? (
                    <div className="pb-2">
                      <JobGradeManager companyId={company.id} data={data} />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            {tab === "org" ? (
              <HrStructurePane ar={ar} lang={lang} data={data} currentUser={currentUser} company={company} canWrite={access.orgWrite} onHire={openHire} />
            ) : null}
            {tab === "branches" ? (
              <HrBranchesBoard
                ar={ar}
                data={data}
                company={company}
                access={access}
                onHire={openHire}
                branchId={searchParams.get("branch") || ""}
                initialQuery={searchParams.get("q") || ""}
                onBranchConsumed={clearBranch}
              />
            ) : null}
            {tab === "compliance" ? <ComplianceMhrsdBoard ministry="hr" /> : null}
          </PageErrorBoundary>
          {!tab ? <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا قسم متاح لك هنا." : "No pane is open to you here."}</p> : null}
        </div>
      </OpsFrame>
      <HireSeatDrawer
        open={Boolean(hire)}
        data={data}
        companyId={company.id}
        ar={ar}
        stationId={hire?.stationId || ""}
        seatId={hire?.seatId || ""}
        listId={hire?.listId || ""}
        listName={hire?.listName || ""}
        onClose={() => setHire(null)}
        onNeedAccess={() => {
          setHire(null);
          if (access.orgWrite) setSearchParams(new URLSearchParams({ tab: "org", pane: "authority", open: "perm" }), { replace: true });
        }}
      />
    </>
  );
}
