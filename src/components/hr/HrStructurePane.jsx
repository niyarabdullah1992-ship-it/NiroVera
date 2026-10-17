import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { orgChainHealth } from "@/lib/orgChain";
import { formerEmployeeCount } from "@/lib/formerEmployees";
import { canEditOrgDesign, deriveOrgHealth, deriveSeatRegister, orgDesignOf } from "@/lib/orgDesign";
import { changeSeedFromParams } from "@/lib/orgChartActions";
import { HR_ORG_PANES } from "@/lib/hrSection";
import { chipButton, mono } from "@/components/schedules/scheduleChrome";
import OrgWorkforceHero, { OrgBranchTools } from "@/components/hr/OrgWorkforceHero";
import OrgWorkforceAdminPanels from "@/components/hr/OrgWorkforceAdminPanels";
import OrgTemplateBoard, { OrgChartUpkeep } from "@/components/hr/OrgTemplateBoard";
import OrgFormerFilesBoard from "@/components/hr/OrgFormerFilesBoard";
import OrgSeatRegister from "@/components/hr/orgdesign/OrgSeatRegister";
import OrgHealthBoard from "@/components/hr/orgdesign/OrgHealthBoard";
import OrgDoaBoard from "@/components/hr/orgdesign/OrgDoaBoard";
import OrgChangesBoard from "@/components/hr/orgdesign/OrgChangesBoard";
import OrgChartEntry from "@/components/hr/orgdesign/OrgChartEntry";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import { MUTED } from "@/lib/platformStyles";

const sub = (on) => chipButton(on, { height: 30, padding: "0 12px", fontSize: 12 });

/**
 * «الهيكل» inside «الموارد البشرية» — what /app/org carried for HR: the org tree (people / branches
 * views, management tree, «⋯» action panel), «المناصب», «صحة الهيكل», «الصلاحيات» and «التغييرات».
 * The seat stays and the person changes; reporting, authority and the approval path derive from it.
 * Read-only viewers (HR readers, station leads) get their place in the structure and the chart.
 */
export default function HrStructurePane({ ar = true, lang = "ar", data, currentUser, company, canWrite = false, onHire }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPane = searchParams.get("pane");
  const pane = canWrite && HR_ORG_PANES.includes(requestedPane) ? requestedPane : "chart";
  const chartMode = searchParams.get("chart") === "entry" ? "entry" : "tree";
  const [query, setQuery] = useState("");
  const [hrSignal, setHrSignal] = useState(0);
  const [addBranchSignal, setAddBranchSignal] = useState(0);
  const [pickHit, setPickHit] = useState(null);
  const [searchHits, setSearchHits] = useState([]);
  const [openEsc, setOpenEsc] = useState(false);
  const [openPerm, setOpenPerm] = useState(false);
  const [openLog, setOpenLog] = useState(false);
  const [openGrades, setOpenGrades] = useState(false);
  const [changeSeed, setChangeSeed] = useState(null);
  const [seatFocus, setSeatFocus] = useState("");
  const escRef = useRef(null);
  const permRef = useRef(null);
  const logRef = useRef(null);
  const gradesRef = useRef(null);
  const formerRef = useRef(null);

  const canEditDesign = Boolean(data && currentUser && canEditOrgDesign(currentUser, data));
  const health = useMemo(() => ({
    ...orgChainHealth(data),
    vacantSeats: data ? deriveSeatRegister(data).filter((row) => row.state === "vacant").length : 0,
  }), [data]);
  const formerCount = useMemo(() => formerEmployeeCount(data), [data]);
  const paneCounts = useMemo(() => {
    if (!data || !canWrite) return {};
    const findings = deriveOrgHealth(data);
    return {
      seats: deriveSeatRegister(data).filter((row) => row.state === "vacant").length,
      health: findings.bad + findings.warn,
      changes: orgDesignOf(data).changes.filter((c) => c.status === "pending").length,
    };
  }, [data, canWrite]);

  const setParams = useCallback((edit) => {
    const params = new URLSearchParams(searchParams);
    edit(params);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);
  const setPane = useCallback((next) => setParams((p) => {
    if (next === "chart") p.delete("pane");
    else p.set("pane", next);
  }), [setParams]);
  const setChartMode = (next) => setParams((p) => {
    if (next === "entry") p.set("chart", "entry");
    else p.delete("chart");
  });

  // a redirected /app/org?tab=escalation|lists opens its fold once (?open=esc|perm), then drops it
  useEffect(() => {
    const open = searchParams.get("open");
    if (!open) return;
    if (open === "esc") setOpenEsc(true);
    if (open === "perm") setOpenPerm(true);
    if (open === "log") setOpenLog(true);
    if (open === "grades") setOpenGrades(true);
    setParams((p) => p.delete("open"));
  }, [searchParams, setParams]);

  // the chart's «⋯» actions land here: ?pane=seats&seat= opens the seat card,
  // ?pane=changes&op=…&seat= opens a change request seeded with that seat (read once, then dropped)
  useEffect(() => {
    if (searchParams.get("hire")) return;
    const seat = searchParams.get("seat") || searchParams.get("unit") || "";
    if (!seat || (pane !== "seats" && pane !== "changes")) return;
    if (pane === "seats") setSeatFocus(searchParams.get("seat") || "");
    else {
      const seed = changeSeedFromParams(searchParams);
      if (seed) setChangeSeed(seed);
    }
    setParams((p) => { p.delete("seat"); p.delete("op"); p.delete("to"); p.delete("unit"); });
  }, [pane, searchParams, setParams]);

  const scrollPanel = (ref) => setTimeout(() => ref.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }), 60);
  const goAuthority = (setOpen, ref) => {
    setOpen(true);
    setPane("authority");
    scrollPanel(ref);
  };
  const handleSearchHits = useCallback((hits) => {
    setSearchHits((prev) => {
      const next = Array.isArray(hits) ? hits : [];
      if (prev.length === next.length && prev.every((row, i) => String(row.id || row.stationId || "") === String(next[i]?.id || next[i]?.stationId || ""))) return prev;
      return next;
    });
  }, []);

  if (!canWrite) {
    return (
      <div data-hr-structure="read" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.7 }}>
          {ar
            ? "للاطلاع فقط — سلسلة إدارتك وزملاؤك وفريقك. التغيير في الهيكل عبر الموارد البشرية."
            : "Read-only — your management chain, peers and team. Structural changes go through HR."}
        </p>
        <PageErrorBoundary resetKey="hr-structure-mine">
          <OrgChartEntry ar={ar} data={data} user={currentUser} scope="mine" />
        </PageErrorBoundary>
      </div>
    );
  }

  const tabs = [
    { value: "chart", label: ar ? "المخطط" : "Chart" },
    { value: "seats", label: ar ? "المناصب" : "Seats", count: paneCounts.seats },
    { value: "health", label: ar ? "صحة الهيكل" : "Health", count: paneCounts.health },
    { value: "authority", label: ar ? "الصلاحيات" : "Authority" },
    { value: "changes", label: ar ? "التغييرات" : "Changes", count: paneCounts.changes },
  ];

  return (
    <div className="nv-org-page" data-hr-structure="admin" data-org-pane={pane} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <OrgWorkforceHero
        ar={ar}
        data={data}
        health={health}
        onGoEsc={() => goAuthority(setOpenEsc, escRef)}
        onGoPerm={() => goAuthority(setOpenPerm, permRef)}
        onGoGrades={() => goAuthority(setOpenGrades, gradesRef)}
        onGoLog={() => goAuthority(setOpenLog, logRef)}
        onGoFormer={() => { if (pane !== "chart") setPane("chart"); scrollPanel(formerRef); }}
        formerCount={formerCount}
      />
      <div role="tablist" aria-label={ar ? "أقسام الهيكل" : "Structure panes"} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={pane === t.value} onClick={() => setPane(t.value)} style={sub(pane === t.value)}>
            {t.label}
            {t.count ? <span dir="ltr" style={{ ...mono, fontSize: 10.5, opacity: 0.8 }}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tabs.find((t) => t.value === pane)?.label} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <PageErrorBoundary resetKey={`hr-structure:${pane}:${chartMode}`}>
          {pane === "chart" ? (
            <>
              <div role="group" aria-label={ar ? "طريقة العرض" : "Chart mode"} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" aria-pressed={chartMode === "tree"} onClick={() => setChartMode("tree")} style={sub(chartMode === "tree")}>{ar ? "الشجرة والدليل" : "Tree & directory"}</button>
                <button type="button" aria-pressed={chartMode === "entry"} onClick={() => setChartMode("entry")} style={sub(chartMode === "entry")}>{ar ? "السلسلة" : "Chain"}</button>
              </div>
              {chartMode === "entry" ? (
                <>
                  <OrgChartUpkeep lang={lang} />
                  <OrgChartEntry ar={ar} data={data} user={currentUser} scope="all" />
                </>
              ) : (
                <>
                  <OrgBranchTools
                    ar={ar}
                    query={query}
                    onQueryChange={setQuery}
                    searchHits={searchHits}
                    onPickHit={(hit) => { setPickHit(hit); setQuery(""); setSearchHits([]); }}
                    renderHit={(hit) => (
                      <>
                        {hit.name || hit.label}
                        <span style={{ color: MUTED }}>{" · "}{hit.managerName || hit.job || hit.branch || ""}</span>
                      </>
                    )}
                    onFocusHr={() => setHrSignal((n) => n + 1)}
                    onAddBranch={() => setAddBranchSignal((n) => n + 1)}
                  />
                  <OrgTemplateBoard
                    lang={lang}
                    onHire={onHire}
                    addBranchSignal={addBranchSignal}
                    embedded
                    query={query}
                    onQueryChange={setQuery}
                    pickHit={pickHit}
                    onPickHitConsumed={() => setPickHit(null)}
                    hrSignal={hrSignal}
                    onSearchHits={handleSearchHits}
                  />
                </>
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
              focusSeat={seatFocus}
              onFocusConsumed={() => setSeatFocus("")}
              onOpenChanges={(seed) => { setChangeSeed(seed); setPane("changes"); }}
            />
          ) : null}
          {pane === "health" ? (
            <OrgHealthBoard
              ar={ar}
              data={data}
              actor={currentUser}
              companyId={company.id}
              canEdit={canEditDesign}
              onOpenSeat={(seatId) => { setSeatFocus(seatId); setPane("seats"); }}
            />
          ) : null}
          {pane === "authority" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <OrgDoaBoard ar={ar} data={data} actor={currentUser} companyId={company.id} canEdit={canEditDesign} />
              <OrgWorkforceAdminPanels
                ar={ar}
                data={data}
                companyId={company.id}
                canWrite={canWrite}
                ownerMode={currentUser.id === data.ownerId || currentUser.role === "owner"}
                onHire={onHire}
                openEsc={openEsc}
                openPerm={openPerm}
                openLog={openLog}
                openGrades={openGrades}
                onToggleGrades={() => setOpenGrades((v) => !v)}
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
    </div>
  );
}
