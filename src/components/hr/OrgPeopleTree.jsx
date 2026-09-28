import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { CARD, MUTED, NAVY } from "@/lib/platformStyles";
import { buildPeopleTree, explainWorkplaceManager, filterPeopleHits, flattenPeopleTree } from "@/lib/peopleTree";
import HierarchyZoomControls from "@/components/hr/HierarchyZoomControls";
import OrgTreeFullscreenButton from "@/components/hr/OrgTreeFullscreenButton";
import OrgWorkforceChart from "@/components/hr/OrgWorkforceChart";
import useOrgTreeViewport from "@/hooks/useOrgTreeViewport";
import { toast } from "@/components/ui/use-toast";
import { quickTransferEmployee } from "@/lib/employeeStationTransfer";
import { deleteEmployeeAccount } from "@/lib/store";
import { workplaceStations } from "@/lib/stationTree";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { printReport } from "@/lib/printReport";
import { buildWorkforceSeatChart } from "@/lib/workforceSeatChart";
import { orgBtnGhost, orgBtnPrimary, orgSelect, orgTreeStageStyle } from "@/lib/orgWorkspaceStyles";
import { OrgInspector, OrgInspectorField, OrgPanel, OrgSearchBox, OrgToolbar, OrgTreeCanvas } from "@/components/hr/OrgWorkspace";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";

export default function OrgPeopleTree({
  lang = "ar",
  canWrite = false,
  embedded = false,
  query: queryProp,
  onQueryChange,
  pickHit = null,
  onPickHitConsumed,
  trunkSignal = 0,
  fullSignal = 0,
  printSignal = 0,
  hrSignal = 0,
  onFullChange,
  onSearchHits,
  byGrade = false,
}) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [queryLocal, setQueryLocal] = useState("");
  const query = typeof queryProp === "string" ? queryProp : queryLocal;
  const setQuery = onQueryChange || setQueryLocal;
  const [fullTree, setFullTree] = useState(false);
  const [spine, setSpine] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [previewEmployee, setPreviewEmployee] = useState(null);
  const viewportRef = useRef(null);
  const treeRef = useRef(null);
  const companyName = data?.settings?.companyName || company?.name || (ar ? "المنشأة" : "Company");
  const meId = String(currentUser?.id || "");
  const tree = useMemo(() => {
    try {
      return buildPeopleTree(data);
    } catch (error) {
      console.error("NiroVera people tree:", error);
      return { roots: [], ownerId: "", total: 0 };
    }
  }, [data]);
  const chart = useMemo(() => {
    try {
      return buildWorkforceSeatChart(data, { ar, meId });
    } catch (error) {
      console.error("NiroVera workforce chart:", error);
      return { roots: [], flat: [] };
    }
  }, [data, ar, meId]);
  const people = useMemo(() => flattenPeopleTree(tree.roots), [tree]);
  const ids = useMemo(() => new Set(people.map((person) => person.id)), [people]);
  const activeId = ids.has(selectedId) ? selectedId : "";
  const selectedEmployee = activeId
    ? ((data?.employees || []).find((item) => String(item.id) === String(activeId)) || null)
    : null;
  const workplaces = useMemo(() => workplaceStations(data?.stations || []), [data]);
  const moveTargets = workplaces.filter((station) => station.id && station.id !== selectedEmployee?.stationId);
  const canDeleteSelected = Boolean(
    canWrite
    && selectedEmployee
    && selectedEmployee.id !== data?.ownerId
    && selectedEmployee.id !== currentUser?.id
  );
  const hits = filterPeopleHits(
    chart.flat.map((node) => ({ ...node, job: node.title, branch: node.kindTag })),
    query,
    8,
  );

  const setSafeZoom = (value) => setZoom(Math.max(0.25, Math.min(2, value)));
  const panTree = (x, y) => setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  const gestures = useOrgTreeViewport(viewportRef, zoom, setSafeZoom, offset, setOffset);

  const fitTree = () => {
    const viewport = viewportRef.current;
    const node = treeRef.current;
    if (!viewport || !node) return;
    const width = Math.max(node.scrollWidth, node.offsetWidth, 1);
    const height = Math.max(node.scrollHeight, node.offsetHeight, 1);
    if (width < 8 || height < 8) {
      setSafeZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const avail = Math.max(1, viewport.clientWidth - 24);
    const next = Math.min(1, Math.max(0.12, avail / width));
    setSafeZoom(Number.isFinite(next) ? next : 1);
    setOffset({ x: 0, y: 0 });
  };
  const scheduleFit = () => {
    requestAnimationFrame(() => requestAnimationFrame(fitTree));
  };

  const enterFullscreen = () => {
    setOffset({ x: 0, y: 0 });
    setFullscreen(true);
    scheduleFit();
  };
  const exitFullscreen = () => {
    setOffset({ x: 0, y: 0 });
    setFullscreen(false);
    scheduleFit();
  };

  useEffect(() => {
    if (!fullscreen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const revealPerson = (personId) => {
    setSelectedId(personId);
    setFullTree(false);
    setSpine(true);
  };

  const showSpine = () => {
    setFullTree(false);
    setSpine(true);
  };

  const printTree = () => {
    printReport({
      title: ar ? "هيكل الموظفين" : "People structure",
      companyName,
      periodLabel: new Date().toISOString().slice(0, 10),
      dir: ar ? "rtl" : "ltr",
      stats: [{ label: ar ? "الموظفون" : "People", value: String(tree.total || people.length) }],
      sections: [{
        title: ar ? "من الفرع" : "From the workplace",
        headers: ar ? ["الاسم", "المنصب", "الفرع"] : ["Name", "Title", "Branch"],
        rows: people.map((person) => [person.name, person.job || "", person.branch || ""]),
      }],
    });
  };

  useEffect(() => {
    onSearchHits?.(hits);
  }, [hits, onSearchHits]);

  useEffect(() => {
    onFullChange?.(fullTree);
  }, [fullTree, onFullChange]);

  useEffect(() => {
    if (!trunkSignal) return;
    setFullTree(false);
    setSpine(true);
  }, [trunkSignal]);

  useEffect(() => {
    if (!fullSignal) return;
    setSpine(false);
    setFullTree((current) => !current);
  }, [fullSignal]);

  useEffect(() => {
    if (!printSignal) return;
    printTree();
  }, [printSignal]);

  useEffect(() => {
    if (!hrSignal) return;
    const hrPerson = people.find((person) => {
      const blob = `${person.name || ""} ${person.job || ""} ${person.branch || ""}`.toLowerCase();
      return /hr|م\.?\s*ب|موارد|human/.test(blob);
    });
    if (hrPerson?.id) {
      revealPerson(hrPerson.id);
    }
  }, [hrSignal]);

  useEffect(() => {
    if (!pickHit) return;
    const id = pickHit.id || pickHit.stationId;
    if (id) revealPerson(id);
    onPickHitConsumed?.();
  }, [pickHit]);

  const moveSelected = () => {
    if (!company?.id || !canWrite || !selectedEmployee?.id || !moveTo) return;
    const result = quickTransferEmployee(company.id, {
      employeeId: selectedEmployee.id,
      toStationId: moveTo,
      actor: currentUser,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    setMoveTo("");
    toast({
      description: ar
        ? `نُقل ${result.employee?.name || selectedEmployee.name} إلى ${result.record.toStationName}`
        : `${result.employee?.name || selectedEmployee.name} moved to ${result.record.toStationName}`,
    });
  };

  const deleteSelected = async () => {
    if (!company?.id || !canDeleteSelected) return;
    setDeleting(true);
    try {
      const ok = await deleteEmployeeAccount(company.id, selectedEmployee.id);
      if (!ok) {
        toast({ description: ar ? "تعذر حذف الحساب." : "Account could not be deleted.", variant: "destructive" });
        return;
      }
      setSelectedId("");
      toast({ description: ar ? `حُذف حساب ${selectedEmployee.name} وأُخلي المقعد.` : `${selectedEmployee.name} deleted and the seat vacated.` });
    } finally {
      setDeleting(false);
    }
  };

  const openChartNode = (node) => {
    if (!node?.employeeId) return;
    const employee = (data?.employees || []).find((item) => String(item.id) === String(node.employeeId));
    if (employee) setPreviewEmployee(employee);
  };

  const panel = (
    <OrgPanel ar={ar} fullscreen={fullscreen} embedded={embedded && !fullscreen}>
      {embedded && !fullscreen ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", background: "var(--nv-card)", borderBottom: "1px solid var(--nv-line)" }}>
          <OrgSearchBox
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ar ? "⌕ ابحث باسم أو وظيفة أو رقم" : "⌕ Search name, seat, or number"}
            width={240}
            hits={hits}
            onPick={(person) => {
              revealPerson(person.id);
              setQuery("");
            }}
            renderHit={(person) => (
              <>
                {person.name}
                <span style={{ color: MUTED }}> · {person.job || person.branch}</span>
              </>
            )}
          />
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => { setSpine(false); setFullTree(true); }} style={{ ...orgBtnGhost, height: 32, borderRadius: 8, border: "1px solid var(--nv-line)", color: "var(--nv-ink)" }}>
            {ar ? "توسيع الكل" : "Expand all"}
          </button>
          <button type="button" onClick={showSpine} style={{ ...orgBtnGhost, height: 32, borderRadius: 8, border: "1px solid var(--nv-line)", color: "var(--nv-ink)" }}>
            {ar ? "طيّ الكل" : "Collapse all"}
          </button>
          <HierarchyZoomControls
            zoom={zoom}
            onZoom={(change) => setSafeZoom(zoom + change)}
            onSetZoom={setSafeZoom}
            onFit={fitTree}
            onPan={panTree}
            ar={ar}
            htmlStrip
          />
          <OrgTreeFullscreenButton
            active={fullscreen}
            onToggle={(next) => (next ? enterFullscreen() : exitFullscreen())}
            ar={ar}
            htmlLabel
          />
        </div>
      ) : (
      <OrgToolbar
        title={ar ? "شجرة الناس" : "People tree"}
        subtitle={ar
          ? "الرقم يفتح الأغصان، والاسم يركّز السلسلة، و≡ يفتح الملف. التبعية من شجرة المكان."
          : "Count opens branches, name focuses the chain, ≡ opens the file. Reporting follows place."}
      >
        <OrgSearchBox
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ar ? "⌕ ابحث باسم موظف أو وظيفة أو فرع" : "⌕ Search name, seat, or branch"}
          width={220}
          hits={hits}
          onPick={(person) => {
            revealPerson(person.id);
            setQuery("");
          }}
          renderHit={(person) => (
            <>
              {person.name}
              <span style={{ color: MUTED }}> · {person.job || person.branch}</span>
            </>
          )}
        />
        <button type="button" onClick={showSpine} style={orgBtnGhost}>
          {ar ? "ابدأ من الجذع" : "Start from trunk"}
        </button>
        <button type="button" onClick={printTree} style={orgBtnGhost}>
          {ar ? "طباعة" : "Print"}
        </button>
        <HierarchyZoomControls
          zoom={zoom}
          onZoom={(change) => setSafeZoom(zoom + change)}
          onSetZoom={setSafeZoom}
          onFit={fitTree}
          onPan={panTree}
          ar={ar}
        />
        <OrgTreeFullscreenButton
          active={fullscreen}
          onToggle={(next) => (next ? enterFullscreen() : exitFullscreen())}
          ar={ar}
        />
      </OrgToolbar>
      )}
      {selectedEmployee ? (
        <OrgInspector label={ar ? "المحدد" : "Selected"} title={selectedEmployee.name}>
          {(() => {
            const note = explainWorkplaceManager(data, selectedEmployee.id, { ar });
            if (!note) return null;
            return (
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7, flex: "1 1 260px" }}>
                {note.many ? (
                  <>
                    <span style={{ fontWeight: 600, color: NAVY }}>{ar ? "مرة واحدة" : "Once"}</span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--nv-ok-ink)", marginInline: 8 }}>1 seat · 1 home</span>
                  </>
                ) : null}
                {note.line}
              </span>
            );
          })()}
          <Link
            to={`/app/employees/${encodeURIComponent(selectedEmployee.id)}`}
            style={{ ...orgBtnGhost, textDecoration: "none", marginBottom: 0, alignSelf: "flex-end" }}
          >
            {ar ? "الملف" : "File"}
          </Link>
          {canWrite ? (
            <>
              <OrgInspectorField label={ar ? "نقل إلى" : "Move to"}>
              <select
                value={moveTo}
                onChange={(event) => setMoveTo(event.target.value)}
                aria-label={ar ? "نقل إلى فرع" : "Transfer to branch"}
                style={{ ...orgSelect, minWidth: 140 }}
              >
                <option value="">{ar ? "اختر فرعًا…" : "Pick branch…"}</option>
                {moveTargets.map((station) => (
                  <option key={station.id} value={station.id}>{station.name}</option>
                ))}
              </select>
              </OrgInspectorField>
              <button type="button" disabled={!moveTo} onClick={moveSelected} style={orgBtnPrimary(!moveTo)}>
                {ar ? "نقل" : "Move"}
              </button>
              {canDeleteSelected ? (
                <ConfirmDeleteDialog
                  title={ar ? "حذف حساب الموظف؟" : "Delete employee account?"}
                  description={ar
                    ? `سيتم حذف حساب «${selectedEmployee.name}» وإخلاء مقعده. لا يمكن التراجع.`
                    : `“${selectedEmployee.name}” will be deleted and the seat vacated. This cannot be undone.`}
                  onConfirm={deleteSelected}
                  trigger={(
                    <button
                      type="button"
                      disabled={deleting}
                      style={{
                        all: "unset",
                        cursor: deleting ? "not-allowed" : "pointer",
                        height: 32,
                        padding: "0 12px",
                        borderRadius: 8,
                        border: "1px solid var(--nv-line)",
                        background: CARD,
                        color: "var(--nv-bad-ink)",
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        opacity: deleting ? 0.5 : 1,
                      }}
                    >
                      {ar ? "حذف" : "Delete"}
                    </button>
                  )}
                />
              ) : null}
            </>
          ) : null}
        </OrgInspector>
      ) : null}
      <OrgTreeCanvas
        viewportRef={viewportRef}
        gestures={{
          ...gestures,
          onClick: (event) => {
            if (event.target.closest?.("[data-org-hit]")) return;
            setSelectedId("");
            setMoveTo("");
          },
        }}
        fullscreen={fullscreen}
        embedded={embedded && !fullscreen}
      >
        <div
          ref={treeRef}
          style={orgTreeStageStyle(offset, zoom)}
        >
          {chart.roots.length ? (
            <OrgWorkforceChart
              roots={chart.roots}
              full={fullTree}
              spine={spine && !fullTree}
              focusId={activeId || meId}
              selectedId={selectedId}
              ar={ar}
              onSelect={(node) => setSelectedId(node?.employeeId || node?.id || "")}
              onOpenDetails={openChartNode}
              byGrade={byGrade}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 28, maxWidth: 380 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
                {ar ? "لا ناس بعد — يُشتقّون من المكان" : "No people yet — they are derived from place"}
              </span>
              <span style={{ fontSize: 12, color: MUTED, textAlign: "center", lineHeight: 1.65 }}>
                {ar
                  ? "وظّف على فرع من شجرة المكان بقائمة صلاحيات. هنا تظهر البطاقة مديرًا، والصندوق من يعمل في الفرع."
                  : "Hire onto a workplace from the place tree with an access list. Here the card is the manager; the tray is who works in the branch."}
              </span>
            </div>
          )}
        </div>
      </OrgTreeCanvas>
      {embedded && !fullscreen ? (
        <div className="nv-org-legend">
          <span><i style={{ background: "#0B3D27" }} />{ar ? "مشغول" : "Occupied"}</span>
          <span><i style={{ background: "transparent", border: "1.5px dashed #B7791F" }} />{ar ? "شاغر" : "Vacant"}</span>
          <span><i style={{ background: "#C8A45A" }} />{ar ? "مكلَّف" : "Acting"}</span>
          <span><i style={{ background: "#9B2335" }} />{ar ? "تنبيه نظامي" : "Compliance alert"}</span>
          <span className="nv-org-legend__note">{ar ? "انقر البطاقة للتفاصيل · الرقم يفتح الأغصان" : "Click a card for details · the count opens branches"}</span>
        </div>
      ) : null}
    </OrgPanel>
  );

  return (
    <>
      {fullscreen ? createPortal(panel, document.body) : panel}
      <OrgEmployeePreview
        open={Boolean(previewEmployee)}
        employee={previewEmployee}
        data={data}
        companyId={company?.id || ""}
        canWrite={canWrite}
        companyName={companyName}
        ar={ar}
        onClose={() => setPreviewEmployee(null)}
      />
    </>
  );
}
