import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  MUTED,
  buildOrgDiagram,
  peopleFromCompany,
} from "@/lib/orgTemplateView";
import { toast } from "@/components/ui/use-toast";
import { seedDemoOrgTree } from "@/lib/demoOrgTree";
import { ensureCompanyRootStation } from "@/lib/orgHire";
import { syncWorkplaceManagers } from "@/lib/peopleTree";
import { publishOrgStructure, structurePublishIssues } from "@/lib/jobGrades";
import HierarchyZoomControls from "@/components/hr/HierarchyZoomControls";
import OrgTreeFullscreenButton from "@/components/hr/OrgTreeFullscreenButton";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";
import { OrgAddBranchDrawer, OrgBranchDrawer } from "@/components/hr/OrgBranchDrawer";
import useOrgTreeViewport from "@/hooks/useOrgTreeViewport";
import { printReport } from "@/lib/printReport";
import { orgBtnGhost, orgBtnPrimary, orgTreeStageStyle } from "@/lib/orgWorkspaceStyles";
import { OrgFooterStrip, OrgNotice, OrgPanel, OrgSearchBox, OrgToolbar, OrgTreeCanvas } from "@/components/hr/OrgWorkspace";
import OrgWorkforceChart from "@/components/hr/OrgWorkforceChart";
import { buildWorkforceSeatChart } from "@/lib/workforceSeatChart";
import { isHrUnit } from "@/lib/stationTree";
import {
  actingAtStation,
  flattenOrgBranches,
  formatOrgStructureEvent,
  orgStructureEvents,
  pathToOrgBranch,
  printOrgPyramidRows,
} from "@/lib/orgStructureLog";


export default function OrgTemplateBoard({
  lang = "ar",
  onHire,
  addBranchSignal = 0,
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
  const [open, setOpen] = useState({});
  const [addingBranch, setAddingBranch] = useState(false);
  const [branchParentId, setBranchParentId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [branchFocusId, setBranchFocusId] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [fullTree, setFullTree] = useState(false);
  const [spine, setSpine] = useState(false);
  const [opened, setOpened] = useState(() => new Set());
  const [queryLocal, setQueryLocal] = useState("");
  const query = typeof queryProp === "string" ? queryProp : queryLocal;
  const setQuery = onQueryChange || setQueryLocal;
  const [previewEmployee, setPreviewEmployee] = useState(null);
  const viewportRef = useRef(null);
  const treeRef = useRef(null);
  const companyName = data?.settings?.companyName || company?.name || (ar ? "المنشأة" : "Company");

  const canWrite = Boolean(currentUser && (
    currentUser.id === data?.ownerId
    || ["owner", "director", "admin", "pgm", "hr_manager"].includes(currentUser.role)
  ));
  const demoSeeded = useRef(false);

  const livePeople = useMemo(() => {
    try {
      return peopleFromCompany(data);
    } catch (error) {
      console.error("NiroVera org people:", error);
      return [];
    }
  }, [data]);
  const people = livePeople;
  const diagram = useMemo(() => {
    try {
      return buildOrgDiagram(people, open, (id) => setOpen((prev) => ({ ...prev, [id]: !prev[id] })), data?.stations || []);
    } catch (error) {
      console.error("NiroVera org diagram:", error);
      return { branches: [], headline: "", listCards: [] };
    }
  }, [people, open, data?.stations]);
  const chart = useMemo(() => {
    try {
      return buildWorkforceSeatChart(data, { ar, meId: currentUser?.id || "" });
    } catch (error) {
      console.error("NiroVera workforce chart:", error);
      return { roots: [], flat: [] };
    }
  }, [data, ar, currentUser?.id]);
  const publishIssues = useMemo(() => structurePublishIssues(data, ar), [data, ar]);
  const publishedAt = data?.settings?.orgPublishedAt;

  useEffect(() => {
    if (!company?.id || !canWrite || demoSeeded.current || !data) return;
    const already = (data?.employees || []).some((employee) =>
      String(employee.email || "").toLowerCase().endsWith("@demo.nirovera.local")
    );
    if (already) {
      demoSeeded.current = true;
      seedDemoOrgTree(company.id, { ar });
      return;
    }
    try {
      const result = seedDemoOrgTree(company.id, { ar });
      demoSeeded.current = result.ok && (result.hired > 0 || result.demoCount > 0);
      if (result.hired > 0) toast({ description: result.message });
    } catch (error) {
      demoSeeded.current = false;
      console.error("NiroVera demo org seed:", error);
    }
  }, [company?.id, canWrite, ar, data?.employees]);

  useEffect(() => {
    if (!company?.id || !canWrite) return;
    ensureCompanyRootStation(company.id, companyName, ar);
    syncWorkplaceManagers(company.id);
  }, [company?.id, canWrite, companyName, ar]);

  useEffect(() => {
    if (!addBranchSignal || !canWrite) return;
    setBranchParentId("");
    setAddingBranch(true);
  }, [addBranchSignal, canWrite]);


  const revealStation = (stationId) => {
    const path = pathToOrgBranch(diagram.branches, stationId) || [];
    setCollapsed((current) => {
      const next = new Set(current);
      path.forEach((node) => next.delete(String(node.stationId || "")));
      return next;
    });
    setSelectedStationId(stationId);
  };

  const collapseDistant = () => {
    const me = (data?.employees || []).find((item) => String(item.id) === String(currentUser?.id || ""));
    const focus = selectedStationId || me?.stationId || "";
    const path = focus ? (pathToOrgBranch(diagram.branches, focus) || []) : [];
    const keepOpen = new Set(path.map((node) => String(node.stationId || "")).filter(Boolean));
    const next = new Set();
    flattenOrgBranches(diagram.branches).forEach((node) => {
      const id = String(node.stationId || "");
      if (!id || !(node.children || []).length) return;
      if (!keepOpen.has(id)) next.add(id);
    });
    setCollapsed(next);
  };

  const printTree = () => {
    const attachActing = (nodes) => (nodes || []).map((node) => ({
      ...node,
      actingName: actingAtStation(data, node.stationId)?.employee?.name || "",
      children: attachActing(node.children),
    }));
    const pyramid = attachActing(diagram.branches);
    const flat = flattenOrgBranches(pyramid);
    printReport({
      title: ar ? "هيكل الفروع" : "Branch structure",
      companyName,
      periodLabel: new Date().toISOString().slice(0, 10),
      dir: ar ? "rtl" : "ltr",
      stats: [
        { label: ar ? "الفروع" : "Branches", value: String(flat.length) },
        { label: ar ? "بلا مدير" : "Vacant", value: String(flat.filter((row) => !String(row.managerId || "").trim()).length) },
      ],
      sections: [{
        title: ar ? "الهرم كما هو" : "Pyramid as seen",
        headers: ar ? ["الفرع", "المدير", "النوع", "الموظفون"] : ["Branch", "Manager", "Kind", "People"],
        rows: printOrgPyramidRows(pyramid, ar),
      }],
    });
  };

  const publish = () => {
    const result = publishOrgStructure(company.id, data, ar);
    if (!result.ok) {
      toast({ description: result.issues[0], variant: "destructive" });
      return;
    }
    toast({ description: ar ? "نُشر الهيكل." : "Org structure published." });
  };


  const setSafeZoom = (value) => setZoom(Math.max(0.12, Math.min(2, value)));
  const panTree = (x, y) => setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  const gestures = useOrgTreeViewport(viewportRef, zoom, setSafeZoom, offset, setOffset);
  const fitTree = () => {
    const viewport = viewportRef.current;
    const tree = treeRef.current;
    if (!viewport || !tree) return;
    const width = Math.max(tree.scrollWidth, tree.offsetWidth, 1);
    const height = Math.max(tree.scrollHeight, tree.offsetHeight, 1);
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      setZoom((current) => Math.max(0.15, Math.min(2.5, current - event.deltaY * 0.002)));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [fullscreen]);

  useEffect(() => {
    if (!selectedStationId) return;
    const exists = (data?.stations || []).some((station) => String(station.id) === String(selectedStationId));
    if (!exists) setSelectedStationId("");
  }, [data?.stations, selectedStationId]);


  const needle = query.trim().toLowerCase();
  const branchHits = needle
    ? chart.flat.filter((node) =>
      `${node.name || ""} ${node.title || ""} ${node.kindTag || ""} ${node.empLine || ""}`.toLowerCase().includes(needle)
    ).slice(0, 8)
    : [];
  const structureLog = orgStructureEvents(data).slice(0, 8);

  useEffect(() => {
    onSearchHits?.(branchHits);
  }, [branchHits, onSearchHits]);

  useEffect(() => {
    onFullChange?.(fullTree);
  }, [fullTree, onFullChange]);

  useEffect(() => {
    if (!trunkSignal) return;
    setFullTree(false);
    setSpine(true);
    setOpened(new Set());
    collapseDistant();
  }, [trunkSignal]);

  useEffect(() => {
    if (!fullSignal) return;
    setSpine(false);
    setFullTree((current) => !current);
  }, [fullSignal]);

  useEffect(() => {
    if (fullTree) {
      setCollapsed(new Set());
      return;
    }
    setOpened(new Set());
    collapseDistant();
  }, [fullTree]);

  useEffect(() => {
    if (!printSignal) return;
    printTree();
  }, [printSignal]);

  useEffect(() => {
    if (!hrSignal) return;
    const director = chart.flat.find((node) => node.kindLock || node.hrPost === "director");
    setFullTree(false);
    setSpine(true);
    setSelectedStationId("");
    setBranchFocusId("");
    if (director?.id) setSelectedNodeId(director.id);
  }, [hrSignal]);

  useEffect(() => {
    if (!pickHit) return;
    const id = pickHit.stationId || pickHit.id;
    if (id) revealStation(id);
    onPickHitConsumed?.();
  }, [pickHit]);


  return (
    <>
      {(panel => (fullscreen ? createPortal(panel, document.body) : panel))(
        <OrgPanel ar={ar} fullscreen={fullscreen} embedded={embedded && !fullscreen}>
          {embedded && !fullscreen ? (
            <div className="nv-org-stage-bar">
              <span className="nv-org-stage-bar__hint">
                {fullTree
                  ? (ar
                    ? "الشركة كاملة — عجلة الفأرة أو القرص للتكبير حول المؤشر، والسحب للتحرّك"
                    : "Whole company — wheel or slider zooms at the pointer, drag to pan")
                  : (ar
                    ? "اسحب للتحرّك، قرّص بإصبعين للتكبير، ونقرتان للملاءمة. انقر الرقم «مباشرون / إجمالي» فتتفرّع الأغصان تحت صاحبها، ثم تفرّع منها ما شئت حتى الأوراق. النقر مرة أخرى يطوي الغصن بكل ما تحته."
                    : "Drag to pan, pinch to zoom, double-click to fit. The direct/total count opens branches; click again to fold them.")}
              </span>
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
            title={ar ? "شجرة الهيكل" : "Structure tree"}
            subtitle={ar
              ? "اسحب للتحرّك، وانقر الرقم «مباشرون» للتفرّع. الوظيفة ثابتة؛ الشخص يتغيّر."
              : "Drag to pan; click the count to expand. The seat stays; the person changes."}
          >
            <OrgSearchBox
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ar ? "⌕ ابحث باسم موظف أو وظيفة أو فرع" : "⌕ Search name, seat, or branch"}
              width={220}
              hits={branchHits}
              onPick={(node) => {
                setSelectedNodeId(node.id);
                if (node.stationId) setSelectedStationId(node.stationId);
                setFullTree(false);
                setSpine(true);
                setQuery("");
              }}
              renderHit={(node) => (
                <>
                  {node.name}
                  <span style={{ color: MUTED }}> · {node.title || node.kindTag || ""}</span>
                </>
              )}
            />
            <button type="button" onClick={collapseDistant} style={orgBtnGhost}>
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
            {canWrite ? (
              <>
                <button type="button" onClick={() => { setBranchParentId(""); setAddingBranch(true); }} style={orgBtnPrimary()}>
                  {ar ? "＋ إضافة فرع" : "+ Add branch"}
                </button>
              <button
                type="button"
                onClick={publish}
                disabled={publishIssues.length > 0}
                title={publishIssues[0] || ""}
                style={orgBtnPrimary(publishIssues.length > 0)}
              >
                {publishedAt ? (ar ? "منشور" : "Published") : (ar ? "نشر" : "Publish")}
              </button>
                </>
              ) : null}
          </OrgToolbar>
          )}

          {publishIssues.length ? (
            <OrgNotice tone="warn">
              {publishIssues[0]}
              {publishIssues.length > 1 ? ` · +${publishIssues.length - 1}` : ""}
            </OrgNotice>
          ) : null}

          <OrgTreeCanvas
            viewportRef={viewportRef}
            gestures={{
              ...gestures,
              onClick: (event) => {
                if (event.target.closest?.("[data-org-hit]")) return;
                setSelectedStationId("");
                setSelectedNodeId("");
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
                  focusId={selectedNodeId || currentUser?.id || ''}
                  selectedId={selectedNodeId}
                  ar={ar}
                  onSelect={(node) => {
                    setSelectedNodeId(node?.id || '');
                    setBranchFocusId('');
                    const station = (data?.stations || []).find((item) => String(item.id) === String(node?.stationId || ""));
                    if (node?.employeeId || node?.kindLock || node?.hrPost || isHrUnit(station)) {
                      setSelectedStationId('');
                      return;
                    }
                    if (node?.stationId && node.kind !== 'person') setSelectedStationId(node.stationId);
                    else setSelectedStationId('');
                  }}
                  onOpenDetails={(node) => {
                    const employee = node?.employeeId
                      ? (data?.employees || []).find((item) => String(item.id) === String(node.employeeId))
                      : null;
                    if (employee) {
                      setPreviewEmployee(employee);
                      return;
                    }
                    const station = (data?.stations || []).find((item) => String(item.id) === String(node?.stationId || ""));
                    if (node?.stationId && !node?.kindLock && !node?.hrPost && !isHrUnit(station)) setSelectedStationId(node.stationId);
                  }}
                  byGrade={byGrade}
                />
              ) : (
                <span style={{ marginBlockStart: 16, fontSize: 12, color: MUTED }}>
                  {ar ? 'لا مقاعد بعد — أضف فرعًا أو وظّف من أعلى الشجرة.' : 'No seats yet — add a branch or hire above.'}
                </span>
              )}
            </div>
          </OrgTreeCanvas>

          {!fullscreen && !embedded && structureLog.length ? (
            <OrgFooterStrip>
              {structureLog.slice(0, 4).map((event) => (
                <span key={event.id}>
                  {String(event.at || "").slice(0, 10)} · {formatOrgStructureEvent(event, ar)}
                </span>
              ))}
            </OrgFooterStrip>
          ) : null}
        </OrgPanel>
        )}
      {(() => {
        const selectedNode = chart.flat.find((node) => node.id === selectedNodeId);
        const selectedStation = selectedNode && !selectedNode.employeeId && selectedNode.kind !== "person" && selectedNode.stationId
          ? (data?.stations || []).find((item) => String(item.id) === String(selectedNode.stationId))
          : null;
        const station = (branchFocusId
          ? (data?.stations || []).find((item) => String(item.id) === String(branchFocusId))
          : null) || selectedStation;
        if (!canWrite || !station || isHrUnit(station)) return null;
        return (
          <OrgBranchDrawer
            open
            station={station}
            data={data}
            companyId={company?.id || ""}
            companyName={companyName}
            ar={ar}
            canWrite={canWrite}
            onHire={onHire}
            onAddChild={(parentId) => {
              setBranchParentId(parentId);
              setAddingBranch(true);
            }}
            onClose={() => {
              setSelectedNodeId("");
              setSelectedStationId("");
              setBranchFocusId("");
            }}
            onDeleted={() => {
              setSelectedNodeId("");
              setSelectedStationId("");
              setBranchFocusId("");
            }}
          />
        );
      })()}
      <OrgAddBranchDrawer
        open={Boolean(canWrite && addingBranch)}
        initialParentId={branchParentId}
        data={data}
        company={company}
        companyId={company?.id || ""}
        companyName={companyName}
        ar={ar}
        onClose={() => {
          setAddingBranch(false);
          setBranchParentId("");
        }}
        onCreated={(stationId) => {
          setAddingBranch(false);
          setBranchParentId("");
          if (stationId) {
            setSelectedStationId(stationId);
            const node = chart.flat.find((item) => String(item.stationId) === String(stationId) && item.kind !== "person");
            if (node) setSelectedNodeId(node.id);
          }
        }}
      />
      <OrgEmployeePreview
        open={Boolean(previewEmployee)}
        employee={previewEmployee}
        data={data}
        companyId={company?.id || ""}
        canWrite={canWrite}
        companyName={companyName}
        ar={ar}
        onOpenBranch={(stationId) => {
          setPreviewEmployee(null);
          setBranchFocusId(stationId);
        }}
        onClose={() => setPreviewEmployee(null)}
      />
    </>
  );
}
