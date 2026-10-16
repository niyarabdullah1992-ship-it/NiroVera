import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { OPEN_HIRE_EVENT } from "@/lib/orgHire";
import { isManagerUnit } from "@/lib/stationTree";
import { toast } from "@/components/ui/use-toast";
import { syncWorkplaceManagers } from "@/lib/peopleTree";
import { orgChainHealth } from "@/lib/orgChain";
import OrgWorkforceHero from "@/components/hr/OrgWorkforceHero";
import OrgWorkforceAdminPanels from "@/components/hr/OrgWorkforceAdminPanels";
import OrgTemplateBoard, { OrgChartUpkeep } from "@/components/hr/OrgTemplateBoard";
import OrgFormerFilesBoard from "@/components/hr/OrgFormerFilesBoard";
import HireSeatDrawer from "@/components/hr/HireSeatDrawer";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { MUTED } from "@/lib/platformStyles";
import { useRailSide } from "@/lib/railSide";
import { formerEmployeeCount } from "@/lib/formerEmployees";
import { canEditOrgDesign, deriveOrgHealth, orgDesignOf, deriveSeatRegister } from "@/lib/orgDesign";
import { notifyActingReminders, publishDueOrgChanges } from "@/lib/orgDesignStore";
import OrgDesignTabs from "@/components/hr/orgdesign/OrgDesignTabs";
import OrgSeatRegister from "@/components/hr/orgdesign/OrgSeatRegister";
import OrgHealthBoard from "@/components/hr/orgdesign/OrgHealthBoard";
import OrgDoaBoard from "@/components/hr/orgdesign/OrgDoaBoard";
import OrgChangesBoard from "@/components/hr/orgdesign/OrgChangesBoard";
import OrgFocusChart from "@/components/hr/orgdesign/OrgFocusChart";
import { SectionHead } from "@/components/hr/orgdesign/orgDesignUi";

const PANES = ["chart", "seats", "health", "authority", "changes"];

/**
 * Workforce /org — one surface, five panes: «المخطط» (interactive seat chart) · «المناصب»
 * (positions register) · «صحة الهيكل» (health, span & layers, headcount) · «الصلاحيات»
 * (delegation of authority, escalation, admin permissions) · «التغييرات» (dated change requests,
 * signed decisions, the structure as of a date). The employee side is «مكاني في الهيكل» only.
 */
export default function OrgStructure() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hire, setHire] = useState(null);
  const [addBranchSignal, setAddBranchSignal] = useState(0);
  const [query, setQuery] = useState("");
  const [trunkSignal, setTrunkSignal] = useState(0);
  const [fullSignal, setFullSignal] = useState(0);
  const [printSignal, setPrintSignal] = useState(0);
  const [hrSignal, setHrSignal] = useState(0);
  const [pickHit, setPickHit] = useState(null);
  const [fullActive, setFullActive] = useState(false);
  const [searchHits, setSearchHits] = useState([]);
  const [openEsc, setOpenEsc] = useState(false);
  const [openPerm, setOpenPerm] = useState(false);
  const [openLog, setOpenLog] = useState(false);
  const [openGrades, setOpenGrades] = useState(false);
  const [byGrade, setByGrade] = useState(false);
  const escRef = useRef(null);
  const permRef = useRef(null);
  const logRef = useRef(null);
  const gradesRef = useRef(null);
  const formerRef = useRef(null);

  const canWrite = Boolean(currentUser && (
    currentUser.id === data?.ownerId
    || ["owner", "director", "admin", "pgm", "hr_manager", "ops_manager"].includes(currentUser.role)
  ));

  const railSide = useRailSide();
  const requestedView = searchParams.get("view");
  const requestedTab = searchParams.get("tab");
  const view = railSide === "employee"
    ? "employee"
    : railSide === "manage"
      ? (canWrite ? "admin" : "employee")
      : (requestedView === "employee" || (!canWrite && requestedView !== "admin")
        ? "employee"
        : (requestedView === "admin" || canWrite ? "admin" : "employee"));
  const isAdminView = view === "admin" && canWrite && railSide !== "employee";

  const setView = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === "admin") params.set("view", "admin");
    else params.set("view", "employee");
    params.delete("tab");
    setSearchParams(params, { replace: true });
    setQuery("");
    setSearchHits([]);
    setPickHit(null);
  };

  // One vacancy figure on the page: seat state (frozen / planned seats are not open vacancies).
  const health = useMemo(() => ({
    ...orgChainHealth(data),
    vacantSeats: data ? deriveSeatRegister(data).filter((row) => row.state === "vacant").length : 0,
  }), [data]);
  const canEditDesign = Boolean(data && currentUser && canEditOrgDesign(currentUser, data));
  const requestedPane = searchParams.get("pane");
  const pane = PANES.includes(requestedPane) ? requestedPane : "chart";
  // «التركيز» (my card first) is the default chart; «الشجرة كاملة» is the secondary canvas for HR.
  const chartMode = searchParams.get("chart") === "full" ? "full" : "focus";
  const setChartMode = useCallback((next) => {
    const params = new URLSearchParams(searchParams);
    if (next === "full") params.set("chart", "full");
    else params.delete("chart");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);
  const focusParam = searchParams.get("focus") || "";
  const clearFocus = useCallback(() => {
    if (!searchParams.get("focus")) return;
    const params = new URLSearchParams(searchParams);
    params.delete("focus");
    setSearchParams(params);
  }, [searchParams, setSearchParams]);
  const [changeSeed, setChangeSeed] = useState(null);
  const setPane = useCallback((next) => {
    const params = new URLSearchParams(searchParams);
    if (next === "chart") params.delete("pane");
    else params.set("pane", next);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);
  const paneCounts = useMemo(() => {
    if (!data || !isAdminView) return {};
    const findings = deriveOrgHealth(data);
    return {
      seats: deriveSeatRegister(data).filter((row) => row.state === "vacant").length,
      health: findings.bad + findings.warn,
      changes: orgDesignOf(data).changes.filter((c) => c.status === "pending").length,
    };
  }, [data, isAdminView]);

  // Approved changes publish on their effective date; acting roles remind before they end.
  const housekeeping = useRef("");
  useEffect(() => {
    if (!company?.id || !canEditDesign || !currentUser) return;
    const stamp = `${company.id}:${currentUser.id}:${new Date().toDateString()}`;
    if (housekeeping.current === stamp) return;
    housekeeping.current = stamp;
    publishDueOrgChanges(company.id, currentUser);
    notifyActingReminders(company.id, currentUser);
  }, [company?.id, canEditDesign, currentUser]);
  const formerCount = useMemo(() => formerEmployeeCount(data), [data]);

  const scrollPanel = (ref) => {
    setTimeout(() => {
      ref.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }, 60);
  };

  const goFormer = () => {
    if (pane !== "chart") setPane("chart");
    scrollPanel(formerRef);
  };

  const handleSearchHits = useCallback((hits) => {
    setSearchHits((prev) => {
      const next = Array.isArray(hits) ? hits : [];
      if (
        prev.length === next.length
        && prev.every((row, index) => String(row.id || row.stationId || "") === String(next[index]?.id || next[index]?.stationId || ""))
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const goEsc = () => {
    setOpenEsc(true);
    setPane("authority");
    scrollPanel(escRef);
  };
  const goPerm = () => {
    setOpenPerm(true);
    setPane("authority");
    scrollPanel(permRef);
  };
  const goLog = () => {
    setOpenLog(true);
    setPane("authority");
    scrollPanel(logRef);
  };

  useEffect(() => {
    if (!requestedTab) return;
    const params = new URLSearchParams(searchParams);
    if (requestedTab === "escalation") {
      setOpenEsc(true);
      if (canWrite) {
        params.set("view", "admin");
        params.set("pane", "authority");
      }
    } else if (requestedTab === "lists") {
      setOpenPerm(true);
      if (canWrite) {
        params.set("view", "admin");
        params.set("pane", "authority");
      }
    } else if (PANES.includes(requestedTab)) {
      if (canWrite) {
        params.set("view", "admin");
        if (requestedTab === "chart") params.delete("pane");
        else params.set("pane", requestedTab);
      }
    } else if (requestedTab === "people") {
      params.set("view", "employee");
    } else if (requestedTab === "branches" || requestedTab === "seats" || requestedTab === "template") {
      if (canWrite) params.set("view", "admin");
    }
    params.delete("tab");
    setSearchParams(params, { replace: true });
  }, [requestedTab, canWrite, searchParams, setSearchParams]);

  const openHire = (detail = {}) => {
    const station = (data?.stations || []).find((item) => String(item.id) === String(detail.stationId || ""));
    if (detail.stationId && isManagerUnit(station)) {
      toast({
        description: ar
          ? "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه."
          : "A manager is not a hire workplace. Convert it to a branch, then hire there.",
        variant: "destructive",
      });
      return;
    }
    setHire({
      stationId: detail.stationId || "",
      seatId: detail.seatId || "",
      listId: detail.listId || "",
      listName: detail.listName || "",
    });
  };

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;
    if (nextParams.get("hire")) {
      setHire({
        stationId: nextParams.get("station") || "",
        seatId: nextParams.get("seat") || "",
        listId: nextParams.get("list") || "",
        listName: "",
      });
      nextParams.delete("hire");
      nextParams.delete("station");
      nextParams.delete("seat");
      nextParams.delete("list");
      changed = true;
    }
    if (changed) setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const onOpen = (event) => {
      const detail = event.detail || {};
      setHire({
        stationId: detail.stationId || "",
        seatId: detail.seatId || "",
        listId: detail.listId || "",
        listName: detail.listName || "",
      });
    };
    window.addEventListener(OPEN_HIRE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HIRE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!company?.id || !canWrite) return;
    syncWorkplaceManagers(company.id);
  }, [company?.id, canWrite]);

  return (
    <>
      <PlatformStampShell
        ar={ar}
        bare
        maxWidth={1400}
        flushBody
      >
        {!data || !currentUser || !company ? (
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "جارٍ تحميل الهيكل…" : "Loading org structure…"}</p>
        ) : (
          <div className="nv-org-page">
            {!isAdminView ? (
              <PageErrorBoundary resetKey="mine">
                <section className="nv-od" aria-label={ar ? "مكاني في الهيكل" : "My place in the structure"}>
                  <SectionHead
                    title={ar ? "مكاني في الهيكل" : "My place in the structure"}
                    hint={ar
                      ? "تفتح الصفحة على بطاقتك: فوقها مديرك وسلسلة الإدارة، وتحتها فريقك، وبجانبها زملاؤك. انقر أي بطاقة لتنتقل إليها. للاطلاع فقط — التغيير في الهيكل عبر الموارد البشرية."
                      : "Opens on your card: your manager and chain above, your team below, your peers beside. Click any card to move to it. Read-only — structural changes go through HR."}
                  />
                  <OrgFocusChart ar={ar} data={data} user={currentUser} companyId={company.id} scope="mine" />
                </section>
              </PageErrorBoundary>
            ) : (
              <>
                <OrgWorkforceHero
                  ar={ar}
                  data={data}
                  health={health}
                  canWrite={canWrite}
                  isAdminView={isAdminView}
                  showTools={pane === "chart"}
                  showSearch={chartMode === "full"}
                  query={query}
                  onQueryChange={setQuery}
                  searchHits={searchHits}
                  onPickHit={(hit) => {
                    setPickHit(hit);
                    setQuery("");
                    setSearchHits([]);
                  }}
                  renderHit={(hit) => (
                    <>
                      {hit.name || hit.label}
                      <span style={{ color: MUTED }}>
                        {" · "}
                        {hit.managerName || hit.job || hit.branch || ""}
                      </span>
                    </>
                  )}
                  onTrunk={() => setTrunkSignal((n) => n + 1)}
                  onFocusHr={chartMode === "full" ? () => setHrSignal((n) => n + 1) : undefined}
                  onToggleFull={() => setFullSignal((n) => n + 1)}
                  fullActive={fullActive}
                  onAddBranch={chartMode === "full" ? () => setAddBranchSignal((n) => n + 1) : undefined}
                  onPrint={() => setPrintSignal((n) => n + 1)}
                  onGoEsc={goEsc}
                  onGoPerm={goPerm}
                  onGoGrades={() => {
                    setOpenGrades(true);
                    setPane("authority");
                    scrollPanel(gradesRef);
                  }}
                  onToggleByGrade={chartMode === "full" ? () => setByGrade((value) => !value) : undefined}
                  byGrade={byGrade}
                  onGoLog={goLog}
                  onGoFormer={goFormer}
                  formerCount={formerCount}
                />

                <OrgDesignTabs
                  ar={ar}
                  label={ar ? "أقسام الهيكل" : "Structure panes"}
                  value={pane}
                  onChange={setPane}
                  tabs={[
                    { value: "chart", label: ar ? "المخطط" : "Chart" },
                    { value: "seats", label: ar ? "المناصب" : "Seats", count: paneCounts.seats },
                    { value: "health", label: ar ? "صحة الهيكل" : "Health", count: paneCounts.health },
                    { value: "authority", label: ar ? "الصلاحيات" : "Authority" },
                    { value: "changes", label: ar ? "التغييرات" : "Changes", count: paneCounts.changes },
                  ]}
                />

                <div role="tabpanel" id={`nv-od-pane-${pane}`} aria-labelledby={`nv-od-tab-${pane}`} style={{ minWidth: 0 }}>
                  <PageErrorBoundary resetKey={`${view}:${pane}`}>
                    {pane === "chart" ? (
                      <>
                        <div className="nv-od-filters" role="group" aria-label={ar ? "طريقة العرض" : "Chart mode"} style={{ marginBottom: 12 }}>
                          <button type="button" className="nv-od-chip" aria-pressed={chartMode === "focus"} onClick={() => setChartMode("focus")}>{ar ? "التركيز" : "Focus"}</button>
                          <button type="button" className="nv-od-chip" aria-pressed={chartMode === "full"} onClick={() => setChartMode("full")}>{ar ? "الشجرة كاملة" : "Whole tree"}</button>
                        </div>
                        {chartMode === "focus" ? (
                          <>
                            <OrgChartUpkeep lang={lang} />
                            <OrgFocusChart ar={ar} data={data} user={currentUser} companyId={company.id} scope="all" canWrite={canWrite} onHire={openHire} />
                          </>
                        ) : (
                          <OrgTemplateBoard
                            lang={lang}
                            onHire={openHire}
                            addBranchSignal={addBranchSignal}
                            embedded
                            query={query}
                            onQueryChange={setQuery}
                            pickHit={pickHit}
                            onPickHitConsumed={() => setPickHit(null)}
                            trunkSignal={trunkSignal}
                            fullSignal={fullSignal}
                            printSignal={printSignal}
                            hrSignal={hrSignal}
                            onFullChange={setFullActive}
                            onSearchHits={handleSearchHits}
                            byGrade={byGrade}
                            focusId={focusParam}
                            onClearFocus={clearFocus}
                          />
                        )}
                        <OrgFormerFilesBoard data={data} ar={ar} boardRef={formerRef} />
                      </>
                    ) : null}
                    {pane === "seats" ? (
                      <OrgSeatRegister
                        ar={ar}
                        data={data}
                        actor={currentUser}
                        companyId={company.id}
                        canEdit={canEditDesign}
                        onOpenChanges={(seed) => {
                          setChangeSeed(seed);
                          setPane("changes");
                        }}
                      />
                    ) : null}
                    {pane === "health" ? (
                      <OrgHealthBoard ar={ar} data={data} actor={currentUser} companyId={company.id} canEdit={canEditDesign} />
                    ) : null}
                    {pane === "authority" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <OrgDoaBoard ar={ar} data={data} actor={currentUser} companyId={company.id} canEdit={canEditDesign} />
                        <OrgWorkforceAdminPanels
                          ar={ar}
                          data={data}
                          companyId={company.id}
                          canWrite={canWrite}
                          ownerMode={currentUser.id === data.ownerId || currentUser.role === "owner"}
                          onHire={openHire}
                          openEsc={openEsc}
                          openPerm={openPerm}
                          openLog={openLog}
                          openGrades={openGrades}
                          onToggleGrades={() => setOpenGrades((value) => !value)}
                          gradesRef={gradesRef}
                          onToggleEsc={() => setOpenEsc((v) => !v)}
                          onTogglePerm={() => setOpenPerm((v) => !v)}
                          onToggleLog={() => setOpenLog((v) => !v)}
                          escRef={escRef}
                          permRef={permRef}
                          logRef={logRef}
                        />
                      </div>
                    ) : null}
                    {pane === "changes" ? (
                      <OrgChangesBoard
                        ar={ar}
                        data={data}
                        actor={currentUser}
                        companyId={company.id}
                        canEdit={canEditDesign}
                        seed={changeSeed}
                        onSeedConsumed={() => setChangeSeed(null)}
                      />
                    ) : null}
                  </PageErrorBoundary>
                </div>
              </>
            )}
          </div>
        )}
      </PlatformStampShell>
      {data && company ? (
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
            setView("admin");
            goPerm();
          }}
        />
      ) : null}
    </>
  );
}
