import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
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
import ComplianceMhrsdBoard from "@/components/hr/ComplianceMhrsdBoard";
import CompanyObligationsList from "@/components/dashboard/CompanyObligationsList";
import { visibleEmployees } from "@/lib/permissions";
import { matchesStationScope } from "@/hooks/useStationScope";
import HrOverviewBoard from "@/components/hr/HrOverviewBoard";
import HrBranchesBoard from "@/components/hr/HrBranchesBoard";
import HrStructurePane from "@/components/hr/HrStructurePane";
import HrSectionSearch from "@/components/hr/HrSectionSearch";
import HireSeatDrawer from "@/components/hr/HireSeatDrawer";
import { MUTED } from "@/lib/platformStyles";
import { Fold } from "@/components/payroll/PayrollCycleReview";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";
import OrgTemplateBoard from "@/components/hr/OrgTemplateBoard";
import OrgFormerFilesBoard from "@/components/hr/OrgFormerFilesBoard";
import { formerEmployeeCount } from "@/lib/formerEmployees";
import OrgLookupField from "@/components/hr/OrgLookupField";
import StationTransferPanel from "@/components/employees/StationTransferPanel";
import { personLookupOption } from "@/lib/orgLookup";

/**
 * «الموارد البشرية» — one management section that merged «الهيكل والفروع» (/app/hr) and
 * «المحطات التي أديرها» (/app/org admin). One hero, one switch:
 *   نظرة عامة · الموظفون · الهيكل · الفروع والمحطات · الامتثال
 * Each pane keeps the gate of what it carried (lib/hrSection). Old /app/org admin links redirect
 * here with their parameters; the employee keeps «مكاني في الهيكل» on /app/org?view=employee.
 */
const quickBtn = (primary) => ({
  fontFamily: "inherit", height: 34, padding: "0 14px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
  display: "inline-flex", alignItems: "center", gap: 6,
  border: primary ? "1px solid var(--nv-accent, #1E9E63)" : "1px solid var(--nv-line, #D5DCD8)",
  background: primary ? "var(--nv-accent, #1E9E63)" : "var(--nv-card, #fff)",
  color: primary ? "#fff" : "var(--nv-ink, #111418)",
});

export default function HRStructureManagement() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const stationScope = useStationScope();
  /* direct move / acting: pick the mode and the person, then the person's file opens on that step */
  const [movePick, setMovePick] = useState(null);
  const [moveOpen, setMoveOpen] = useState(null);
  const scopeEmployees = useMemo(
    () => (data && currentUser ? visibleEmployees(currentUser, data).filter((employee) => matchesStationScope(employee.stationId, stationScope, data?.stations || [])) : []),
    [data, currentUser, stationScope],
  );
  const [gradesOpen, setGradesOpen] = useState(false);
  const [hire, setHire] = useState(null);

  const access = useMemo(
    () => (data && currentUser ? hrSectionAccessFor(currentUser, data, company) : { panes: [] }),
    [currentUser, data, company],
  );
  const hashWantsCompliance = typeof window !== "undefined" && window.location.hash === "#compliance-center";
  const requested = searchParams.get("tab") || (hashWantsCompliance ? "compliance" : "");
  // three everyday tabs: «اليوم» carries compliance, «الهيكل» carries the branches
  const folded = { compliance: "overview", branches: "org" };
  const shown = (access.panes || []).filter((id) => !(folded[id] && access.panes.includes(folded[id])));
  const tabFor = (id) => (folded[id] && shown.includes(folded[id]) ? folded[id] : id);
  const tab = tabFor(resolveHrPane(requested, access));

  const setTab = useCallback((value) => {
    const next = new URLSearchParams();
    if (value) next.set("tab", value);
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (hashWantsCompliance && access.panes?.includes("compliance") && searchParams.get("tab") !== "compliance") setTab(access.panes.includes("overview") ? "overview" : "compliance");
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

  // file lists moved to «الموظفون»: old links to the structure's file panes land there
  useEffect(() => {
    const pane = searchParams.get("pane");
    if (searchParams.get("tab") === "org" && (pane === "files" || pane === "former")) setSearchParams(new URLSearchParams({ tab: "people" }), { replace: true });
  }, [searchParams, setSearchParams]);

  if (!data || !currentUser || !company) return null;
  if (!access.panes.length) return <Navigate to="/app/org?view=employee" replace />;

  const SHORT = { overview: { ar: "التنبيهات", en: "Alerts" }, people: { ar: "الموظفون", en: "Employees" }, org: { ar: "الهيكل التنظيمي", en: "Org structure" } };
  const options = shown.map((id) => ({ value: id, label: ar ? (SHORT[id] || HR_PANE_LABELS[id]).ar : (SHORT[id] || HR_PANE_LABELS[id]).en }));
  const branchesBoard = access.panes.includes("branches") ? (
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
  ) : null;
  const complianceBoard = access.panes.includes("compliance") ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CompanyObligationsList employees={scopeEmployees} data={data} ar={ar} />
      <ComplianceMhrsdBoard ministry="hr" />
    </div>
  ) : null;
  const filter = searchParams.get("filter") || "";

  return (
    <>
      <OpsFrame
        ar={ar}
        lane="manage"
        section={ar ? "الموظفون" : "People"}
        title={ar ? "الموارد البشرية" : "Human resources"}
        hint={null}
        meta={(
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
            {options.length > 1 ? <HeroSwitch options={options} value={tab} onChange={setTab} label={ar ? "أقسام الموارد البشرية" : "HR panes"} /> : null}
            {access.orgWrite ? (
              <div style={{ display: "inline-flex", gap: 8, marginInlineStart: "auto", flexWrap: "wrap" }}>
                {access.panes.includes("org") ? (
                  <button type="button" onClick={() => setSearchParams(new URLSearchParams({ tab: "org", add: "branch" }), { replace: true })} style={quickBtn(false)}>
                    {ar ? "＋ فرع جديد" : "+ New branch"}
                  </button>
                ) : null}
                <button type="button" onClick={() => openHire({})} style={quickBtn(true)}>
                  {ar ? "＋ توظيف" : "+ Hire"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      >
        <div data-hr-section={tab} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <HrSectionSearch ar={ar} data={data} access={access} />
          <PageErrorBoundary resetKey={`hr:${tab}`}>
            {tab === "overview" ? (
              <>
                <HrOverviewBoard ar={ar} data={data} scopeIds={scopeIds} orgWrite={access.orgWrite} />
                {/* The rest is reference — folded so the alerts read at a glance. */}
                {access.panes.includes("compliance") ? (
                  <>
                    <Fold id="hr-obligations" title={ar ? "مواعيد الشركة النظامية" : "The company's statutory dates"} note={ar ? "التزامات الشركة وحقوقها بتاريخها — الأقرب أولاً." : "What the company owes and may do, by date."}>
                      <div style={{ padding: "0 14px 14px" }}><CompanyObligationsList employees={scopeEmployees} data={data} ar={ar} /></div>
                    </Fold>
                    <Fold id="hr-compliance" title={ar ? "الامتثال الوزاري والتفتيش" : "Ministry compliance and inspection"} note={ar ? "فهرس الأقسام، ونطاقات، والسجلات، وجاهزية الفروع، والتأمينات والوثائق." : "Section index, Nitaqat, registers, branch readiness, GOSI and documents."}>
                      <div style={{ padding: "0 14px 14px" }}><ComplianceMhrsdBoard ministry="hr" /></div>
                    </Fold>
                  </>
                ) : null}
              </>
            ) : null}
            {tab === "people" ? (
              <PeoplePane ar={ar} lang={lang} data={data} onHire={openHire} filter={filter} canSeeFormer={access.orgWrite} scopeIds={access.branchHr ? access.scopeIds : null} />
            ) : null}
            {tab === "org" ? (
              <HrStructurePane ar={ar} lang={lang} data={data} currentUser={currentUser} company={company} canWrite={access.orgWrite} onHire={openHire} branches={branchesBoard} />
            ) : null}
            {tab === "branches" ? branchesBoard : null}
            {tab === "compliance" ? complianceBoard : null}
          </PageErrorBoundary>
          {!tab ? <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا قسم متاح لك هنا." : "No pane is open to you here."}</p> : null}
        </div>
      </OpsFrame>
      {movePick ? (
        <MovePicker
          ar={ar}
          data={data}
          pick={movePick}
          onChange={setMovePick}
          companyId={company.id}
          actor={currentUser}
          onCancel={() => setMovePick(null)}
          onGo={() => {
            const employee = (data?.employees || []).find((item) => String(item.id) === String(movePick.person));
            if (!employee) return;
            setMoveOpen({ employee, tab: movePick.mode });
            setMovePick(null);
          }}
        />
      ) : null}
      <OrgEmployeePreview
        open={Boolean(moveOpen)}
        employee={moveOpen?.employee || null}
        initialTab={moveOpen?.tab || "profile"}
        data={data}
        companyId={company.id}
        canWrite={access.orgWrite}
        ar={ar}
        onHire={openHire}
        onClose={() => setMoveOpen(null)}
      />
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


function MovePicker({ ar, data, pick, onChange, onCancel, onGo, companyId, actor }) {
  const stationName = (id) => (data?.stations || []).find((item) => String(item.id) === String(id))?.name || "";
  const heads = new Set((data?.stations || []).filter((s) => !s.closedAt && s.managerId).map((s) => String(s.managerId)));
  const acting = pick.mode === "acting";
  // نقل: anyone, from branch to branch · تكليف: only whoever runs a branch
  const options = (data?.employees || [])
    .filter((item) => item && item.role !== "system" && item.status !== "terminated" && String(item.name || "").trim())
    .filter((item) => !acting || heads.has(String(item.id)))
    .map((employee) => personLookupOption(employee, stationName(employee.stationId), ar));
  const employee = (data?.employees || []).find((item) => String(item.id) === String(pick.person));
  const modeBtn = (on) => ({
    fontFamily: "inherit", flex: 1, height: 38, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
    border: on ? "1px solid var(--nv-accent, #1E9E63)" : "1px solid var(--nv-line, #D5DCD8)",
    background: on ? "var(--nv-accent-soft, #E8F5EE)" : "var(--nv-card, #fff)",
    color: on ? "var(--nv-accent, #1E9E63)" : "var(--nv-ink, #111418)",
  });
  return (
    <div role="dialog" aria-modal="true" aria-label={ar ? "نقل أو تكليف" : "Move or acting"} onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(10,14,18,.35)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir={ar ? "rtl" : "ltr"} onClick={(event) => event.stopPropagation()}
        style={{ width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--nv-card, #fff)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 18px 50px rgba(0,0,0,.18)" }}>
        <strong style={{ fontSize: 15 }}>{ar ? "نقل أو تكليف" : "Move or acting"}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" aria-pressed={!acting} onClick={() => onChange({ mode: "transfer", person: "" })} style={modeBtn(!acting)}>
            {ar ? "نقل من فرع إلى فرع" : "Move between branches"}
          </button>
          <button type="button" aria-pressed={acting} onClick={() => onChange({ mode: "acting", person: "" })} style={modeBtn(acting)}>
            {ar ? "تكليف بإدارة فرع" : "Acting branch head"}
          </button>
        </div>
        <OrgLookupField
          ar={ar}
          label={acting ? (ar ? "مدير الفرع" : "Branch head") : (ar ? "الموظف" : "Employee")}
          value={pick.person}
          onChange={(person) => onChange({ ...pick, person })}
          options={options}
          placeholder={ar ? "ابحث بالاسم أو الوظيفة أو الرقم أو الفرع" : "Search name, title, number, or branch"}
        />
        {!acting && employee ? (
          <StationTransferPanel
            key={employee.id}
            employee={employee}
            stations={data?.stations || []}
            companyId={companyId}
            actor={actor}
            ar={ar}
            startOpen
            onDone={(res) => { if (res?.ok !== false) onCancel(); }}
          />
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={quickBtn(false)}>{ar ? "إلغاء" : "Cancel"}</button>
          {acting ? (
            <button type="button" disabled={!pick.person} onClick={onGo} style={{ ...quickBtn(true), opacity: pick.person ? 1 : 0.5 }}>{ar ? "متابعة" : "Continue"}</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}


/** «الموظفون»: every file in one list — on the job, or whose service ended. */
function PeoplePane({ ar, lang, data, onHire, filter, canSeeFormer, scopeIds = null }) {
  const [view, setView] = useState("current");
  const former = useMemo(() => formerEmployeeCount(data), [data]);
  const seg = (on) => ({
    fontFamily: "inherit", height: 32, padding: "0 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5,
    fontWeight: on ? 700 : 500, background: on ? "var(--nv-navy, #0B3D27)" : "transparent", color: on ? "#fff" : "var(--nv-ink)",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {canSeeFormer ? (
        <div role="tablist" style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 10, background: "var(--nv-soft)", border: "1px solid var(--nv-line)", alignSelf: "flex-start" }}>
          <button type="button" role="tab" aria-selected={view === "current"} onClick={() => setView("current")} style={seg(view === "current")}>{ar ? "على رأس العمل" : "On the job"}</button>
          <button type="button" role="tab" aria-selected={view === "former"} onClick={() => setView("former")} style={seg(view === "former")}>
            {ar ? "انتهت خدمتهم" : "Service ended"}{former ? ` (${former})` : ""}
          </button>
        </div>
      ) : null}
      {view === "former" && canSeeFormer
        ? <OrgFormerFilesBoard data={data} ar={ar} />
        : <OrgTemplateBoard lang={lang} onHire={onHire} embedded fixedView="files" initialFlag={filter} scopeIds={scopeIds} />}
    </div>
  );
}
