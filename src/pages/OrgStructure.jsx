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
import OrgTemplateBoard from "@/components/hr/OrgTemplateBoard";
import OrgPeopleTree from "@/components/hr/OrgPeopleTree";
import HireSeatDrawer from "@/components/hr/HireSeatDrawer";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { MUTED } from "@/lib/platformStyles";
import { useRailSide } from "@/lib/railSide";

/**
 * Workforce /org — HTML composition: view toggle · hero toolbar · tree stage ·
 * escalation / permissions / event log below (admin). Design System v2 tokens.
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

  const health = useMemo(() => orgChainHealth(data), [data]);

  const scrollPanel = (ref) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
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
    scrollPanel(escRef);
  };
  const goPerm = () => {
    setOpenPerm(true);
    scrollPanel(permRef);
  };
  const goLog = () => {
    setOpenLog(true);
    scrollPanel(logRef);
  };

  useEffect(() => {
    if (!requestedTab) return;
    const params = new URLSearchParams(searchParams);
    if (requestedTab === "escalation") {
      setOpenEsc(true);
      if (canWrite) params.set("view", "admin");
    } else if (requestedTab === "lists") {
      setOpenPerm(true);
      if (canWrite) params.set("view", "admin");
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
            <OrgWorkforceHero
              ar={ar}
              data={data}
              health={health}
              canWrite={canWrite}
              isAdminView={isAdminView}
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
              onFocusHr={() => setHrSignal((n) => n + 1)}
              onToggleFull={() => setFullSignal((n) => n + 1)}
              fullActive={fullActive}
              onAddBranch={isAdminView ? () => setAddBranchSignal((n) => n + 1) : undefined}
              onPrint={() => setPrintSignal((n) => n + 1)}
              onGoEsc={goEsc}
              onGoPerm={goPerm}
              onGoGrades={() => {
                setOpenGrades(true);
                scrollPanel(gradesRef);
              }}
              onToggleByGrade={() => setByGrade((value) => !value)}
              byGrade={byGrade}
              onGoLog={goLog}
            />

            <PageErrorBoundary resetKey={view}>
              {isAdminView ? (
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
                />
              ) : (
                <OrgPeopleTree
                  lang={lang}
                  canWrite={false}
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
                />
              )}
            </PageErrorBoundary>

            {isAdminView ? (
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
            ) : null}
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
