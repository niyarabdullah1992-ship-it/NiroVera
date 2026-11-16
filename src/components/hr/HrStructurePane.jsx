import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { orgChainHealth } from "@/lib/orgChain";
import { formerEmployeeCount } from "@/lib/formerEmployees";
import { canEditOrgDesign, deriveOrgHealth, deriveSeatRegister, orgDesignOf } from "@/lib/orgDesign";
import { changeSeedFromParams } from "@/lib/orgChartActions";
import { HR_ORG_PANES } from "@/lib/hrSection";
import { chipButton, mono } from "@/components/schedules/scheduleChrome";
import OrgChangesBoard from "@/components/hr/orgdesign/OrgChangesBoard";
import OrgWorkforceAdminPanels from "@/components/hr/OrgWorkforceAdminPanels";
import OrgTemplateBoard, { OrgChartUpkeep } from "@/components/hr/OrgTemplateBoard";
import OrgFormerFilesBoard from "@/components/hr/OrgFormerFilesBoard";
import OrgSeatRegister from "@/components/hr/orgdesign/OrgSeatRegister";
import OrgHealthBoard from "@/components/hr/orgdesign/OrgHealthBoard";
import OrgChartEntry from "@/components/hr/orgdesign/OrgChartEntry";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import { MUTED } from "@/lib/platformStyles";

const sub = (on) => chipButton(on, { height: 30, padding: "0 12px", fontSize: 12 });

/**
 * «الهيكل» inside «الموارد البشرية» — what /app/org carried for HR: the org tree (people / branches
 * views, management tree, «⋯» action panel), «المناصب», «الصلاحيات» and «التغييرات».
 * The seat stays and the person changes; reporting, authority and the approval path derive from it.
 * Read-only viewers (HR readers, station leads) get their place in the structure and the chart.
 */
export default function HrStructurePane({ ar = true, lang = "ar", data, currentUser, company, canWrite = false, onHire, branches = null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPane = searchParams.get("pane");
  const pane = (requestedPane === "branches" && branches) ? "branches"
    : (canWrite && (HR_ORG_PANES.includes(requestedPane) || requestedPane === "files" || requestedPane === "former") ? requestedPane : "chart");
  // «الهيكل» stays inside الموارد البشرية: the chart pane is the embedded tree, and its «شاشة كاملة»
  // button opens /app/org/chart?lane=manage, whose «خروج» returns here. Nothing redirects out on entry.
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
  const [permSeed, setPermSeed] = useState("");
  const [seatFocus, setSeatFocus] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = (event) => { if (!moreRef.current?.contains(event.target)) setMoreOpen(false); };
    const esc = (event) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [moreOpen]);
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
  const setPane = useCallback((next) => {
    setParams((p) => { if (next === "chart") p.delete("pane"); else p.set("pane", next); });
  }, [setParams]);
  const setChartMode = (next) => setParams((p) => {
    if (next === "entry") p.set("chart", "entry");
    else p.delete("chart");
  });
  const goChart = (mode = "tree") => setParams((p) => {
    p.delete("pane");
    if (mode === "entry") p.set("chart", "entry"); else p.delete("chart");
  });

  // «＋ فرع جديد» from the page head lands here: open the tree and its add-branch form at once
  useEffect(() => {
    if (searchParams.get("add") !== "branch") return;
    setAddBranchSignal((n) => n + 1);
    setParams((p) => { p.delete("add"); p.delete("pane"); p.delete("chart"); });
  }, [searchParams, setParams]);

  // a redirected /app/org?tab=escalation|lists opens its fold once (?open=esc|perm), then drops it
  useEffect(() => {
    const open = searchParams.get("open");
    if (!open) return;
    if (open === "esc") setOpenEsc(true);
    if (open === "perm") { setOpenPerm(true); if (searchParams.get("emp")) setPermSeed(searchParams.get("emp")); }
    if (open === "log") setOpenLog(true);
    if (open === "grades") setOpenGrades(true);
    setParams((p) => { p.delete("open"); p.delete("emp"); });
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

  // a bare ?pane=changes (old links) has nothing to edit: back to the tree
  useEffect(() => {
    if (pane === "health") { goChart("tree"); return; }
    if (pane !== "changes" || changeSeed || searchParams.get("op")) return;
    const id = setTimeout(() => { if (!searchParams.get("op")) goChart("tree"); }, 50);
    return () => clearTimeout(id);
  }, [pane, changeSeed, searchParams]);

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
            ? "للاطلاع — الشركة كلها بفروعها وموظفيها. التغيير في الهيكل عبر الموارد البشرية."
            : "Read-only — the whole company, every branch and person. Structural changes go through HR."}
        </p>
        <PageErrorBoundary resetKey="hr-structure-read">
          <OrgChartEntry ar={ar} data={data} user={currentUser} scope="all" />
        </PageErrorBoundary>
      </div>
    );
  }

  // three everyday views; the rarely used settings live behind «المزيد»
  const tabs = [
    { value: "chart", label: ar ? "المخطط" : "Chart" },
    { value: "seats", label: ar ? "المناصب" : "Seats", count: paneCounts.seats },
    ...(branches ? [{ value: "branches", label: ar ? "الفروع" : "Branches" }] : []),
    { value: "authority", label: ar ? "إدارة الهيكل" : "Structure admin" },
  ];
  const more = [
    { id: "authority", label: ar ? "الصلاحيات واعتماد القرارات" : "Authority", run: () => setPane("authority") },
    { id: "changes", label: ar ? "تعديل الهيكل (قرار مباشر)" : "Edit the structure", run: () => setPane("changes") },
    { id: "esc", label: ar ? "سلسلة التصعيد" : "Escalation", run: () => goAuthority(setOpenEsc, escRef) },
    { id: "perm", label: ar ? "صلاحيات الإدارة" : "Permissions", run: () => goAuthority(setOpenPerm, permRef) },
    { id: "grades", label: ar ? "سلّم الدرجات" : "Grade ladder", run: () => goAuthority(setOpenGrades, gradesRef) },
    { id: "log", label: ar ? "سجل الأحداث" : "Event log", run: () => goAuthority(setOpenLog, logRef) },
    { id: "chain", label: ar ? "عرض السلسلة الإدارية" : "Chain view", run: () => goChart("entry") },
    { id: "hr", label: ar ? "إظهار وحدة الموارد البشرية" : "Show the HR unit", run: () => { goChart("tree"); setHrSignal((n) => n + 1); } },
  ];
  const moreActive = pane === "authority" || pane === "changes" || pane === "health";

  return (
    <div className="nv-org-page" data-hr-structure="admin" data-org-pane={pane} style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div role="tablist" aria-label={ar ? "أقسام الهيكل" : "Structure panes"} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={pane === t.value || (t.value === "chart" && pane === "changes")} onClick={() => { if (t.value === "chart") goChart("tree"); else setPane(t.value); }} style={sub(pane === t.value || (t.value === "chart" && pane === "changes"))}>
              {t.label}
              {t.count ? <span dir="ltr" style={{ ...mono, fontSize: 10.5, opacity: 0.8 }}>{t.count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" aria-label={tabs.find((t) => t.value === pane)?.label || pane} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <PageErrorBoundary resetKey={`hr-structure:${pane}:${chartMode}`}>
          {pane === "branches" ? branches : null}
          {pane === "files" ? (
            <OrgTemplateBoard lang={lang} onHire={onHire} embedded fixedView="files" />
          ) : null}
          {pane === "former" ? <OrgFormerFilesBoard data={data} ar={ar} boardRef={formerRef} /> : null}
          {pane === "chart" ? (
            <>
              {chartMode === "entry" ? (
                <>
                  <OrgChartUpkeep lang={lang} />
                  <OrgChartEntry ar={ar} data={data} user={currentUser} scope="all" />
                </>
              ) : (
                <>
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
                    fixedView="people"
                  />
                </>
              )}
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
          {false ? (
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
              {/* permissions and escalation; moves and acting live on the tree and the direct button */}
              <OrgWorkforceAdminPanels
                ar={ar}
                data={data}
                companyId={company.id}
                canWrite={canWrite}
                ownerMode={currentUser.id === data.ownerId || currentUser.role === "owner"}
                onHire={onHire}
                openEsc={openEsc}
                openPerm={openPerm}
                permSeed={permSeed}
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
            /* a move / freeze / dotted line picked on the tree opens here as a direct edit, then returns to the tree */
            changeSeed ? (
              <OrgChangesBoard
                ar={ar}
                data={data}
                actor={currentUser}
                companyId={company.id}
                canEdit={canEditDesign}
                seed={changeSeed}
                onSeedConsumed={() => {}}
                quick
                onDone={() => { setChangeSeed(null); goChart("tree"); }}
              />
            ) : null
          ) : null}
        </PageErrorBoundary>
      </div>
    </div>
  );
}
