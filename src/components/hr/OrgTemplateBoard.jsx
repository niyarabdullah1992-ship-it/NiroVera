import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  MUTED,
  buildOrgDiagram,
  peopleFromCompany,
} from "@/lib/orgTemplateView";
import { toast } from "@/components/ui/use-toast";
import { seedDemoOrgTree } from "@/lib/demoOrgTree";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { ensureCompanyRootStation } from "@/lib/orgHire";
import { syncWorkplaceManagers } from "@/lib/peopleTree";
import { publishOrgStructure, structurePublishIssues } from "@/lib/jobGrades";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";
import { OrgAddBranchDrawer, OrgBranchDrawer } from "@/components/hr/OrgBranchDrawer";
import { printReport } from "@/lib/printReport";
import { orgBtnGhost, orgBtnPrimary } from "@/lib/orgWorkspaceStyles";
import { chipButton } from "@/components/schedules/scheduleChrome";
import { OrgFooterStrip, OrgNotice, OrgPanel, OrgSearchBox, OrgToolbar, OrgTreeCanvas } from "@/components/hr/OrgWorkspace";
import OrgTreeChart from "@/components/hr/orgdesign/OrgTreeChart";
import OrgSeatDirectory from "@/components/hr/OrgSeatDirectory";
import OrgEmployeeFilesBoard from "@/components/hr/OrgEmployeeFilesBoard";
import { buildWorkforceSeatChart } from "@/lib/workforceSeatChart";
import { isHrUnit } from "@/lib/stationTree";
import {
  actingAtStation,
  flattenOrgBranches,
  formatOrgStructureEvent,
  orgStructureEvents,
  printOrgPyramidRows,
} from "@/lib/orgStructureLog";

const segBtn = (on) => chipButton(on, { height: 32, padding: "0 12px", fontSize: 12 });

/**
 * Chart upkeep that runs wherever the chart opens (focus or whole tree): the company root unit,
 * the workplace-manager sync, and the demo tree for an empty company.
 */
export function OrgChartUpkeep({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const companyName = data?.settings?.companyName || company?.name || (ar ? "المنشأة" : "Company");
  const canWrite = Boolean(currentUser && (
    currentUser.id === data?.ownerId
    || ["owner", "director", "admin", "pgm", "hr_manager"].includes(currentUser.role)
  ));
  const demoSeeded = useRef(false);

  useEffect(() => {
    if (!company?.id || !canWrite || demoSeeded.current || !data) return;
    // Demo people belong to the local preview only — a real company's tree is never filled with them.
    if (!isLocalPreviewActive()) return;
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

  return null;
}

/**
 * «الفروع والدليل» on /app/org: the people tree (the same SAP-style chart as /app/org/chart, with
 * many branches open at once and the «⋯» admin actions), the seat directory and employee files,
 * plus the branch drawers (add / edit a branch) and the structure print.
 */
export default function OrgTemplateBoard({
  lang = "ar",
  onHire,
  addBranchSignal = 0,
  embedded = false,
  query: queryProp,
  onQueryChange,
  pickHit = null,
  onPickHitConsumed,
  printSignal = 0,
  hrSignal = 0,
  onSearchHits,
  focusId = "",
  branchId = "",
  onBranchConsumed,
}) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const [addingBranch, setAddingBranch] = useState(false);
  const [branchParentId, setBranchParentId] = useState("");
  const [branchFocusId, setBranchFocusId] = useState("");
  const [queryLocal, setQueryLocal] = useState("");
  const [chartView, setChartView] = useState("people");
  const [reveal, setReveal] = useState(null);
  const query = typeof queryProp === "string" ? queryProp : queryLocal;
  const setQuery = onQueryChange || setQueryLocal;
  const [previewEmployee, setPreviewEmployee] = useState(null);
  const [previewVacant, setPreviewVacant] = useState(null);
  const companyName = data?.settings?.companyName || company?.name || (ar ? "المنشأة" : "Company");

  const canWrite = Boolean(currentUser && (
    currentUser.id === data?.ownerId
    || ["owner", "director", "admin", "pgm", "hr_manager"].includes(currentUser.role)
  ));

  const people = useMemo(() => {
    try {
      return peopleFromCompany(data);
    } catch (error) {
      console.error("NiroVera org people:", error);
      return [];
    }
  }, [data]);
  // the branch pyramid behind the structure print
  const diagram = useMemo(() => {
    try {
      return buildOrgDiagram(people, {}, () => {}, data?.stations || []);
    } catch (error) {
      console.error("NiroVera org diagram:", error);
      return { branches: [], headline: "", listCards: [] };
    }
  }, [people, data?.stations]);
  const chart = useMemo(() => {
    try {
      return buildWorkforceSeatChart(data, { ar, meId: currentUser?.id || "" });
    } catch (error) {
      console.error("NiroVera workforce chart:", error);
      return { roots: [], flat: [] };
    }
  }, [data, ar, currentUser?.id]);
  const directoryNodes = useMemo(() => {
    const rows = [];
    const walk = (list, parentId) => {
      (list || []).forEach((node) => {
        rows.push({ ...node, reportsTo: parentId });
        walk(node.children, node.id);
      });
    };
    walk(chart.roots, "");
    return rows;
  }, [chart]);
  const publishIssues = useMemo(() => structurePublishIssues(data, ar), [data, ar]);
  const publishedAt = data?.settings?.orgPublishedAt;

  const showOnChart = (key) => {
    if (!key) return;
    setChartView("people");
    setReveal({ key: String(key), nonce: Date.now() });
  };

  useEffect(() => {
    if (!addBranchSignal || !canWrite) return;
    setBranchParentId("");
    setAddingBranch(true);
  }, [addBranchSignal, canWrite]);

  // an /app/org?chart=full&branch=<id> link (the chart's «الفرع والوحدة») opens that branch's drawer
  useEffect(() => {
    if (!branchId) return;
    setBranchFocusId(String(branchId));
    onBranchConsumed?.();
  }, [branchId, onBranchConsumed]);

  useEffect(() => {
    if (focusId) showOnChart(focusId);
  }, [focusId]);

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
    if (!printSignal) return;
    printTree();
  }, [printSignal]);

  // «وحدة الموارد البشرية»: show the HR director's card
  useEffect(() => {
    if (!hrSignal) return;
    const director = chart.flat.find((node) => node.kindLock || node.hrPost === "director");
    if (director) showOnChart(director.seatId || director.id);
  }, [hrSignal]);

  useEffect(() => {
    if (!pickHit) return;
    showOnChart(pickHit.seatId || pickHit.employeeId || pickHit.id);
    onPickHitConsumed?.();
  }, [pickHit]);

  const openNode = (node) => {
    const employee = node?.employeeId
      ? (data?.employees || []).find((item) => String(item.id) === String(node.employeeId))
      : null;
    if (employee) {
      setPreviewVacant(null);
      setPreviewEmployee(employee);
      return;
    }
    if (node?.vacant) {
      setPreviewEmployee(null);
      setPreviewVacant(node);
    }
  };

  // card actions the board owns; the rest route to the admin panes (seat card, changes, authority, health)
  const onChartAction = (id, card) => {
    if (id !== "branch") return false;
    const station = (data?.stations || []).find((item) => String(item.id) === String(card?.stationId || ""));
    if (!station || isHrUnit(station)) return false;
    setBranchFocusId(String(station.id));
    return true;
  };

  return (
    <>
      <OrgChartUpkeep lang={lang} />
      <OrgPanel ar={ar} fullscreen={false} embedded={embedded}>
        {embedded ? (
          <div className="nv-org-stage-bar">
            <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
              {[
                ["people", ar ? "شجرة الأشخاص" : "People"],
                ["dir", ar ? "دليل الموظفين" : "Directory"],
                ["files", ar ? "ملفات الموظفين" : "Employee files"],
              ].map(([id, label]) => {
                const on = chartView === id;
                return (
                  <button key={id} type="button" aria-pressed={on} onClick={() => setChartView(id)} style={segBtn(on)}>{label}</button>
                );
              })}
            </div>
            {chartView === "people" ? (
              <span className="nv-org-stage-bar__hint">
                {ar ? "اضغط الرقم أسفل البطاقة لفتح فريقها — تبقى الفروع المفتوحة كما هي" : "Press the count on a card to open its team — open branches stay open"}
              </span>
            ) : null}
          </div>
        ) : (
          <OrgToolbar
            title={ar ? "شجرة الهيكل" : "Structure tree"}
            subtitle={ar
              ? "اضغط الرقم «مباشر / الكل» لفتح الفريق؛ تبقى الفروع المفتوحة. الوظيفة ثابتة؛ الشخص يتغيّر."
              : "Press the count to open a team; open branches stay open. The seat stays; the person changes."}
          >
            <OrgSearchBox
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ar ? "⌕ ابحث باسم موظف أو وظيفة أو فرع" : "⌕ Search name, seat, or branch"}
              width={220}
              hits={branchHits}
              onPick={(node) => {
                showOnChart(node.seatId || node.employeeId || node.id);
                setQuery("");
              }}
              renderHit={(node) => (
                <>
                  {node.name}
                  <span style={{ color: MUTED }}> · {node.title || node.kindTag || ""}</span>
                </>
              )}
            />
            <button type="button" onClick={printTree} style={orgBtnGhost}>
              {ar ? "طباعة" : "Print"}
            </button>
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

        {chartView === "files" ? (
          <OrgEmployeeFilesBoard
            data={data}
            nodes={directoryNodes}
            ar={ar}
            canWrite={canWrite}
            companyId={company?.id || ""}
            actor={currentUser}
            onHire={onHire}
            onManage={(employee) => {
              setPreviewVacant(null);
              setPreviewEmployee(employee);
            }}
          />
        ) : chartView === "dir" ? (
          <OrgTreeCanvas gestures={{}} fullscreen={false} embedded={embedded} center={false}>
            <OrgSeatDirectory
              nodes={directoryNodes}
              stations={data?.stations || []}
              ar={ar}
              onOpen={openNode}
            />
          </OrgTreeCanvas>
        ) : chart.roots.length ? (
          <OrgTreeChart
            ar={ar}
            data={data}
            user={currentUser}
            companyId={company?.id || ""}
            scope="all"
            canWrite={canWrite}
            onHire={onHire}
            variant="embedded"
            onAction={onChartAction}
            reveal={reveal}
          />
        ) : (
          <p style={{ margin: 0, padding: 18, fontSize: 12, color: MUTED }}>
            {ar ? "لا مقاعد بعد — أضف فرعًا أو وظّف من أعلى الشجرة." : "No seats yet — add a branch or hire above."}
          </p>
        )}

        {!embedded && structureLog.length ? (
          <OrgFooterStrip>
            {structureLog.slice(0, 4).map((event) => (
              <span key={event.id}>
                {String(event.at || "").slice(0, 10)} · {formatOrgStructureEvent(event, ar)}
              </span>
            ))}
          </OrgFooterStrip>
        ) : null}
      </OrgPanel>
      {(() => {
        const station = branchFocusId
          ? (data?.stations || []).find((item) => String(item.id) === String(branchFocusId))
          : null;
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
            onClose={() => setBranchFocusId("")}
            onDeleted={() => setBranchFocusId("")}
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
          if (stationId) setBranchFocusId(stationId);
        }}
      />
      <OrgEmployeePreview
        open={Boolean(previewEmployee || previewVacant)}
        employee={previewEmployee}
        vacantNode={previewVacant}
        data={data}
        companyId={company?.id || ""}
        canWrite={canWrite}
        companyName={companyName}
        ar={ar}
        onHire={onHire}
        onOpenBranch={(stationId) => {
          setPreviewEmployee(null);
          setPreviewVacant(null);
          setBranchFocusId(stationId);
        }}
        onClose={() => {
          setPreviewEmployee(null);
          setPreviewVacant(null);
        }}
      />
    </>
  );
}
