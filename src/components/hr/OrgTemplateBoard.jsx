import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { identityIconWrap } from "@/components/shared/IdentityCard";
import { BORDER, CARD, PAPER_SHADOW, RADIUS, SURFACE } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import {
  GREEN,
  MUTED,
  NAVY,
  branchWord,
  buildOrgDiagram,
  peopleFromCompany,
  peopleWord,
} from "@/lib/orgTemplateView";
import { toast } from "@/components/ui/use-toast";
import { seedDemoOrgTree } from "@/lib/demoOrgTree";
import { createOrgBranch, ensureCompanyRootStation, occupantTitle, renameOrgBranch, setActingAssignment, endActingAssignment, setOrgBranchParent, setOrgUnitKind } from "@/lib/orgHire";
import { setStationManager } from "@/lib/store";
import { explainWorkplaceManager, syncWorkplaceManagers, workplaceManagerCardMark } from "@/lib/peopleTree";
import { renameCompany } from "@/lib/companySettings";
import { allowedStationParents, checkSetStationParentGate, companyRootStation, effectiveUnitKind, isCompanyRootStation } from "@/lib/stationTree";
import StationDeleteDialog from "@/components/stations/StationDeleteDialog";
import { quickTransferEmployee } from "@/lib/employeeStationTransfer";
import { publishOrgStructure, structurePublishIssues } from "@/lib/jobGrades";
import HierarchyZoomControls from "@/components/hr/HierarchyZoomControls";
import OrgTreeFullscreenButton from "@/components/hr/OrgTreeFullscreenButton";
import OrgUnitKindPicker from "@/components/hr/OrgUnitKindPicker";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";
import { OrgCap, OrgColumn, OrgKids } from "@/components/hr/OrgChartLayout";
import useOrgTreeViewport from "@/hooks/useOrgTreeViewport";
import { printReport } from "@/lib/printReport";
import { orgBtnDanger, orgBtnGhost, orgBtnPrimary, orgInput, orgSelect, orgTreeStageStyle } from "@/lib/orgWorkspaceStyles";
import { OrgFooterStrip, OrgNotice, OrgPanel, OrgSearchBox, OrgToolbar, OrgTreeCanvas } from "@/components/hr/OrgWorkspace";
import {
  actingAtStation,
  flattenOrgBranches,
  formatOrgStructureEvent,
  orgStructureEvents,
  pathToOrgBranch,
  printOrgPyramidRows,
} from "@/lib/orgStructureLog";

export default function OrgTemplateBoard({ lang = "ar", onHire }) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const skipBranchSave = useRef(false);
  const [open, setOpen] = useState({});
  const [addingBranch, setAddingBranch] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchParentId, setBranchParentId] = useState("");
  const [branchUnitKind, setBranchUnitKind] = useState("branch");
  const [plusMenu, setPlusMenu] = useState(null);
  const [attachStationId, setAttachStationId] = useState("");
  const [renamingStationId, setRenamingStationId] = useState("");
  const [branchRename, setBranchRename] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [overStationId, setOverStationId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [actingPick, setActingPick] = useState("");
  const [actingUntil, setActingUntil] = useState("");
  const [actingMenu, setActingMenu] = useState(null);
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

  const addBranch = () => {
    if (!company?.id || !canWrite) return;
    const result = createOrgBranch(company.id, branchName, company, data, branchParentId, branchUnitKind);
    if (!result.ok) {
      toast({
        description: result.error === "LIMIT"
          ? (ar ? "بلغت حد الفروع في الخطة." : "Branch limit reached.")
          : result.error === "PARENT"
            ? (ar ? "الفرع الأب غير موجود." : "Parent branch not found.")
          : (ar ? "أدخل الاسم." : "Enter a name."),
        variant: "destructive",
      });
      return;
    }
    const title = branchName.trim();
    toast({
      description: branchUnitKind === "manager"
        ? (ar ? `أُضيفت إدارة «${title}»` : `Admin seat “${title}” added`)
        : (ar
          ? `أُضيف فرع «${title}». صار في قائمة عمود الفرع بالقالب — نزّل قالباً فارغاً أو الملفات الحالية من الشريط.`
          : `Branch “${title}” added. It is now in the template’s branch list — download a blank template or current files from the strip.`),
    });
    setBranchName("");
    setBranchParentId("");
    setBranchUnitKind("branch");
    setAddingBranch(false);
    if (result.stationId) setTemplateStationId(result.stationId);
  };

  const saveBranchName = async (stationId) => {
    if (!company?.id || !canWrite || !stationId) return;
    const name = branchRename.trim();
    const current = (data?.stations || []).find((item) => item.id === stationId || item.stationId === stationId);
    if (!name || name === current?.name) {
      setRenamingStationId("");
      return;
    }
    if (current?.isCompanyRoot) {
      const saved = await renameCompany(company.id, name);
      setRenamingStationId("");
      toast({
        description: saved
          ? (ar ? `صار اسم المنشأة «${name}» في المنصة.` : `Company renamed to “${name}” across the platform.`)
          : (ar ? "تعذّر تعديل اسم المنشأة." : "Could not rename the company."),
        variant: saved ? undefined : "destructive",
      });
      return;
    }
    const result = renameOrgBranch(company.id, stationId, name);
    if (!result.ok) {
      toast({
        description: result.error === "DUP"
          ? (ar ? "هذا الاسم مستخدم لفرع آخر." : "That name is already used by another branch.")
          : (ar ? "تعذّر تعديل اسم الفرع." : "Could not rename the branch."),
        variant: "destructive",
      });
      return;
    }
    setRenamingStationId("");
    toast({ description: ar ? `صار اسم الفرع «${name}».` : `Branch renamed to “${name}”.` });
  };

  const saveBranchParent = (stationId, parentStationId) => {
    if (!company?.id || !canWrite || !stationId) return;
    const result = setOrgBranchParent(company.id, stationId, parentStationId);
    if (!result.ok) {
      toast({
        description: result.error === "CYCLE_FORBIDDEN"
          ? (ar ? "لا يمكن أن يتبع الفرع نفسه أو أحد أبنائه." : "A branch cannot report to itself or a descendant.")
          : result.error === "COMPANY_ROOT"
            ? (ar ? "المنشأة هي الفرع الرئيسي ولا تتبع فرعاً آخر." : "The company is the main branch and cannot hang under another.")
          : (ar ? "تعذّر ربط الفرع." : "Could not attach the branch."),
        variant: "destructive",
      });
      return;
    }
    toast({ description: ar ? "حُفظت تبعية الفرع." : "Branch parent saved." });
  };

  const attachableUnder = (parentId) =>
    (data?.stations || []).filter((station) => {
      if (!station?.id || String(station.id) === String(parentId)) return false;
      if (isCompanyRootStation(station)) return false;
      if (String(station.parentStationId || station.parentBranchId || "") === String(parentId)) return false;
      return checkSetStationParentGate(data?.stations || [], station.id, parentId).ok;
    });

  const openCreateChild = (parentId) => {
    setPlusMenu(null);
    setAttachStationId("");
    setBranchParentId(parentId);
    setBranchUnitKind("branch");
    setBranchName("");
    setAddingBranch(true);
  };

  const attachExistingChild = (parentId) => {
    if (!attachStationId) {
      toast({ description: ar ? "اختر فرعًا لإضافته." : "Pick a branch to add.", variant: "destructive" });
      return;
    }
    saveBranchParent(attachStationId, parentId);
    setPlusMenu(null);
    setAttachStationId("");
  };

  const saveUnitKind = (stationId, unitKind) => {
    if (!company?.id || !canWrite || !stationId) return;
    const result = setOrgUnitKind(company.id, stationId, unitKind);
    if (!result.ok) {
      toast({
        description: result.error === "COMPANY_ROOT"
          ? (ar ? "رأس المنشأة فرع رئيسي دائمًا — لا يُحوَّل إلى مدير." : "The company apex is always the main branch — it cannot become a manager node.")
          : (ar ? "تعذّر تغيير نوع العقدة." : "Could not change the node kind."),
        variant: "destructive",
      });
      return;
    }
    const onStation = (data?.employees || []).filter((employee) =>
      String(employee.stationId) === String(stationId)
      && employee.active !== false
      && employee.role !== "system"
    );
    toast({
      description: unitKind === "manager"
        ? (onStation.length
          ? (ar
            ? `صار إدارة: خارج نطاق الفروع والحضور. ${onStation.length} موظفًا ما زالوا على هذه العقدة — حوّلها إلى فرع قبل التوظيف.`
            : `Now an admin seat: out of station and attendance scope. ${onStation.length} people remain on this node — convert it to a branch before hiring.`)
          : (ar ? "صار إدارة: يظهر في الشجرة وليس مكان توظيف." : "Now an admin seat: on the tree, not a hire workplace."))
        : (ar ? "صار فرعًا: يمكنك التوظيف عليه الآن." : "Now a branch: you can hire on it now."),
    });
  };

  const saveManager = (stationId, employeeId) => {
    if (!company?.id || !canWrite || !stationId) return;
    const result = setStationManager(company.id, stationId, employeeId || null);
    if (!result?.ok) {
      toast({
        description: ar ? "تعذّر حفظ المدير — حدّد البطاقة من الشجرة ثم أعد المحاولة." : "Could not save the manager — select the card on the tree and try again.",
        variant: "destructive",
      });
      return;
    }
    const note = employeeId
      ? explainWorkplaceManager({
        ...data,
        stations: (data?.stations || []).map((station) => (
          String(station.id) === String(stationId) ? { ...station, managerId: employeeId } : station
        )),
      }, employeeId, { ar })
      : null;
    toast({
      description: note?.many
        ? note.line
        : employeeId
          ? (ar ? "حُفظ مدير الفرع." : "Branch manager saved.")
          : (ar ? "أُزيل المدير." : "Manager cleared."),
    });
  };

  const defaultActingUntil = () => {
    const day = new Date();
    day.setDate(day.getDate() + 30);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  };

  const saveActing = (stationId) => {
    const sid = String(stationId || selectedStationId || "");
    if (!company?.id || !canWrite || !sid || !actingPick) return;
    const until = actingUntil || defaultActingUntil();
    const result = setActingAssignment(company.id, actingPick, { stationId: sid, until });
    if (!result.ok) {
      toast({
        description: result.error === "HOME"
          ? (ar ? "لا وكالة على فرع الموظف نفسه." : "Acting cannot be on the person's own branch.")
          : (ar ? "تعذّرت الوكالة." : "Could not set acting manager."),
        variant: "destructive",
      });
      return;
    }
    setActingPick("");
    setActingUntil(defaultActingUntil());
    setActingMenu(null);
    toast({ description: ar ? "عُيّن مدير بالوكالة." : "Acting manager assigned." });
  };

  const stopActing = (employeeId, actingId) => {
    if (!company?.id || !canWrite || !employeeId || !actingId) return;
    endActingAssignment(company.id, employeeId, actingId);
    setActingMenu(null);
    toast({ description: ar ? "أُنهيت الوكالة." : "Acting ended." });
  };

  const openActingMenu = (stationId, event) => {
    event.stopPropagation();
    if (!canWrite || !stationId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (actingMenu?.stationId === stationId) {
      setActingMenu(null);
      return;
    }
    setSelectedStationId(stationId);
    setActingPick("");
    setActingUntil(defaultActingUntil());
    setActingMenu({
      stationId,
      top: rect.bottom + 6,
      left: ar ? rect.left : Math.max(8, rect.right - 240),
    });
  };

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
    const path = pathToOrgBranch(diagram.branches, selectedStationId) || [];
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

  const CARD_W = 228;
  const ELLIPSIS = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  };
  const cardSelect = {
    ...orgSelect,
    height: 30,
    width: "100%",
    fontSize: 11.5,
    padding: "0 8px",
  };
  const initialsOf = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`;
  };

  const BranchPersonCard = ({ branch, isRoot = false, drop = {} }) => {
    if (!branch) return null;
    const stationId = String(branch.stationId || "");
    const liveStation = stations.find((item) => String(item.id) === stationId) || null;
    const managerId = String(liveStation?.managerId || branch.managerId || "");
    const manager = managerId
      ? (data?.employees || []).find((item) => String(item.id) === managerId) || null
      : null;
    const acting = actingAtStation(data, branch.stationId);
    const who = String(manager?.name || acting?.employee?.name || "");
    const vacant = !manager;
    const until = String(acting?.assignment?.until || "").slice(0, 10);
    const title = String(branch.managerTitle || (manager ? occupantTitle(manager, data, ar) : "") || "").trim();
    const kind = isRoot ? "branch" : effectiveUnitKind(liveStation || { unitKind: branch.unitKind });
    const isManagerNode = !isRoot && kind === "manager";
    const roleLabel = title
      || (isRoot ? (ar ? "رأس المنشأة" : "Company apex") : "")
      || (isManagerNode ? (ar ? "إدارة" : "Admin") : "")
      || (ar ? "مدير فرع" : "Branch manager");
    const avatarUrl = String((manager || acting?.employee)?.profile?.avatarUrl || (manager || acting?.employee)?.avatarUrl || "");
    const renaming = Boolean(canWrite && stationId && renamingStationId === stationId && selectedStationId === stationId);
    const selected = Boolean(stationId && selectedStationId === stationId);
    const editing = Boolean(selected && canWrite && stationId);
    const folded = stationId && collapsed.has(stationId);
    const childCount = branch.childCount || (branch.children || []).length || 0;
    const canFold = childCount > 0;
    const dropStyle = drop && typeof drop.style === "object" && drop.style ? drop.style : {};
    const parentValue = String(liveStation?.parentStationId || branch.parentStationId || companyRootId || "");
    const mark = managerId ? workplaceManagerCardMark(data, managerId, stationId) : null;
    const seatBusy = vacant
      ? (ar ? "بلا مدير" : "Vacant")
      : (ar ? "مقعد المدير مشغول" : "Manager seat filled");
    const glanceCount = isManagerNode
      ? [childCount > 0 ? (ar ? `${branchWord(childCount, ar)} تحته` : `${branchWord(childCount, ar)} under it`) : (ar ? "بلا فروع" : "No branches"), ar ? "لا مقاعد" : "No seats"].join(" · ")
      : [branch.treePeople || branch.ownPeople || branch.seatCount ? peopleWord(branch.treePeople || branch.ownPeople || 0, ar) : peopleWord(0, ar), seatBusy].join(" · ");
    const cardBorder = isManagerNode
      ? `1px dashed ${selected ? NAVY : "#B9C0CC"}`
      : `1px solid ${selected || mark === "home" ? NAVY : BORDER}`;
    return (
      <div
        data-org-hit="true"
        onClick={() => {
          if (!stationId) return;
          setSelectedStationId(stationId);
        }}
        onDragOver={typeof drop.onDragOver === "function" ? drop.onDragOver : undefined}
        onDrop={typeof drop.onDrop === "function" ? drop.onDrop : undefined}
        title={canWrite && !selected
          ? (ar ? "اضغط للتعديل" : "Click to edit")
          : [who, branch.name].filter(Boolean).join(" · ")}
        style={{
          width: CARD_W,
          minWidth: CARD_W,
          maxWidth: CARD_W,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          flex: "none",
          borderRadius: RADIUS,
          border: cardBorder,
          background: CARD,
          boxShadow: selected
            ? `0 0 0 2px color-mix(in oklab, #14213D 18%, transparent), ${PAPER_SHADOW}`
            : PAPER_SHADOW,
          overflow: "hidden",
          cursor: "pointer",
          transition: "box-shadow .15s ease, border-color .15s ease",
          ...dropStyle,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) auto", gap: 10, alignItems: "start", padding: "11px 12px 9px" }}>
          <button
            type="button"
            data-org-hit="true"
            aria-label={vacant && !acting
              ? (ar ? "مقعد بلا موظف" : "Vacant seat")
              : (ar ? `بطاقة ${who || "الموظف"}` : `Card for ${who || "employee"}`)}
            title={vacant && !acting
              ? (ar ? "لا يوجد موظف" : "No employee")
              : (ar ? "عرض بطاقة الموظف" : "View employee card")}
            onClick={(event) => {
              const person = manager || acting?.employee || null;
              if (!person) return;
              event.stopPropagation();
              setPreviewEmployee(person);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              ...identityIconWrap,
              width: 34,
              height: 34,
              minWidth: 34,
              minHeight: 34,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              overflow: "hidden",
              flex: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              border: (vacant && !acting) || isManagerNode ? `1px dashed ${isManagerNode ? "#B9C0CC" : BORDER}` : (identityIconWrap.border || `1px solid ${BORDER}`),
              background: (vacant && !acting) || isManagerNode ? "#fff" : identityIconWrap.background,
              color: (vacant && !acting) || isManagerNode ? MUTED : identityIconWrap.color,
              fontFamily: "inherit",
            }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (vacant && !acting ? "—" : initialsOf(who))}
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, lineHeight: 1.3, ...ELLIPSIS }}>
              {who || (ar ? "بلا مدير" : "Vacant")}
            </span>
            <span style={{ fontSize: 10.5, color: "#4B5567", lineHeight: 1.35, ...ELLIPSIS }}>
              {branch.name || (ar ? "بلا فرع" : "No branch")}
            </span>
            <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.3, ...ELLIPSIS }}>
              {roleLabel}
              {acting ? (ar ? ` · وكالة حتى ${until}` : ` · Acting until ${until}`) : ""}
            </span>
            {mark === "home" ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: "#137A49", background: "#F2FAF6", border: "1px solid #BFE6D2", padding: "1px 6px", alignSelf: "flex-start", marginTop: 3, whiteSpace: "nowrap" }}>
                {ar ? "بيتي · الحضور هنا" : "Home · punch here"}
              </span>
            ) : mark === "cover" ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: "#8A6516", background: "#FDF6E8", border: "1px solid #ECD9A8", padding: "1px 6px", alignSelf: "flex-start", marginTop: 3, whiteSpace: "nowrap" }}>
                {ar ? "تغطية · لا مقعد ثانٍ" : "Cover · not a second seat"}
              </span>
            ) : null}
          </div>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: isManagerNode ? "#4B5567" : "#137A49",
            background: isManagerNode ? "#F5F6F8" : "#F2FAF6",
            border: `1px solid ${isManagerNode ? BORDER : "#BFE6D2"}`,
            padding: "1px 7px",
            whiteSpace: "nowrap",
          }}>
            {isManagerNode ? (ar ? "إدارة" : "Admin") : (ar ? "تشغيلي" : "Workplace")}
          </span>
        </div>

        {editing ? (
          <div
            data-org-hit="true"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "10px 12px 12px",
              borderTop: `1px solid ${BORDER}`,
              background: SURFACE,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: MUTED }}>
                {ar ? "اسم الفرع" : "Branch name"}
              </span>
              {renaming ? (
                <input
                  value={branchRename}
                  onChange={(event) => setBranchRename(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveBranchName(stationId);
                    }
                    if (event.key === "Escape") {
                      skipBranchSave.current = true;
                      setRenamingStationId("");
                    }
                  }}
                  onBlur={() => {
                    if (skipBranchSave.current) {
                      skipBranchSave.current = false;
                      return;
                    }
                    saveBranchName(stationId);
                  }}
                  autoFocus
                  style={{ ...cardSelect, fontWeight: 600 }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRenamingStationId(stationId);
                    setBranchRename(branch.name);
                  }}
                  style={{
                    ...cardSelect,
                    textAlign: "start",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {branch.name || (ar ? "بلا اسم" : "Untitled")}
                </button>
              )}
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: MUTED }}>
                {isRoot ? (ar ? "مدير المنشأة" : "Company manager") : (ar ? "مدير الفرع" : "Branch manager")}
              </span>
              <select
                value={managerId}
                onChange={(event) => saveManager(stationId, event.target.value)}
                style={cardSelect}
              >
                <option value="">{ar ? "بدون مدير" : "No manager"}</option>
                {movers.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
              {(() => {
                const note = managerId ? explainWorkplaceManager(data, managerId, { ar }) : null;
                const text = note?.line
                  || (isManagerNode
                    ? (ar ? "هذه الإدارة ليست مكان توظيف أو حضور." : "This admin seat is not a hire or attendance workplace.")
                    : "");
                return text ? (
                  <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{text}</span>
                ) : null;
              })()}
            </label>

            {!isRoot ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => { if (kind !== "branch") saveUnitKind(stationId, "branch"); }}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    height: 30,
                    borderRadius: 7,
                    textAlign: "center",
                    fontSize: 11.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    background: kind === "branch" ? NAVY : CARD,
                    color: kind === "branch" ? "#fff" : NAVY,
                    border: `1px solid ${kind === "branch" ? NAVY : BORDER}`,
                  }}
                >
                  {ar ? "فرع" : "Branch"}
                </button>
                <button
                  type="button"
                  onClick={() => { if (kind !== "manager") saveUnitKind(stationId, "manager"); }}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    height: 30,
                    borderRadius: 7,
                    textAlign: "center",
                    fontSize: 11.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    background: kind === "manager" ? NAVY : CARD,
                    color: kind === "manager" ? "#fff" : NAVY,
                    border: `1px solid ${kind === "manager" ? NAVY : BORDER}`,
                  }}
                >
                  {ar ? "إدارة" : "Admin"}
                </button>
              </div>
            ) : null}

            {!isRoot ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: MUTED }}>{ar ? "يتبع" : "Reports to"}</span>
                <select
                  value={parentValue}
                  onChange={(event) => saveBranchParent(stationId, event.target.value)}
                  style={cardSelect}
                >
                  {companyRootId ? (
                    <option value={companyRootId}>{companyRoot.name || companyName}</option>
                  ) : (
                    <option value="">{ar ? "المنشأة" : "Company"}</option>
                  )}
                  {allowedStationParents(stations, stationId)
                    .filter((station) => station.id !== companyRootId)
                    .map((station) => (
                      <option key={station.id} value={station.id}>{station.name}</option>
                    ))}
                </select>
              </label>
            ) : null}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              {isManagerNode ? (
                <button
                  type="button"
                  disabled
                  title={ar ? "عقدة إدارة — ليست مكان توظيف. وظّف على فرع تشغيلي تحتها." : "Admin node — not a hire workplace. Hire on a workplace branch under it."}
                  style={{ ...orgBtnGhost, height: 30, fontSize: 11, color: MUTED, background: "#EEF0F4", cursor: "not-allowed" }}
                >
                  {ar ? "لا توظيف — إدارة" : "No hire — admin"}
                </button>
              ) : onHire && canWrite ? (
                <button
                  type="button"
                  onClick={() => onHire({ stationId })}
                  style={{ ...orgBtnGhost, height: 30, fontSize: 11, background: "#137A49", color: "#fff", border: "none" }}
                >
                  {ar ? "وظّف على مقعد" : "Hire onto a seat"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setPlusMenu({
                    stationId,
                    top: rect.bottom + 6,
                    left: ar ? rect.left : Math.max(8, rect.right - 200),
                  });
                }}
                style={{ ...orgBtnGhost, height: 30, fontSize: 11 }}
              >
                {ar ? "فرع تابع" : "Child branch"}
              </button>
              <button
                type="button"
                onClick={(event) => openActingMenu(stationId, event)}
                style={{ ...orgBtnGhost, height: 30, fontSize: 11 }}
              >
                {acting ? (ar ? "تعديل الوكالة" : "Edit acting") : (ar ? "وكالة" : "Acting")}
              </button>
              {acting ? (
                <button
                  type="button"
                  onClick={() => stopActing(acting.employee?.id, acting.assignment?.id)}
                  style={{ ...orgBtnGhost, height: 30, fontSize: 11, color: MUTED }}
                >
                  {ar ? "إنهاء وكالة" : "End acting"}
                </button>
              ) : null}
              {!isRoot ? (
                <StationDeleteDialog
                  station={liveStation}
                  stations={stations}
                  data={data}
                  company={company}
                  lang={lang}
                  label={ar ? "حذف" : "Delete"}
                  onDeleted={(_id, nextId) => setSelectedStationId(nextId || companyRootId)}
                  buttonStyle={{ ...orgBtnDanger, height: 30, fontSize: 11 }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          style={{
            padding: "6px 12px",
            borderTop: isManagerNode ? "1px dashed #DFE3EA" : "1px solid #EEF0F4",
            background: "#FAFBFC",
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            data-org-hit="true"
            disabled={!canFold}
            title={canFold
              ? (folded
                ? (ar ? "إظهار الفروع التابعة" : "Show child branches")
                : (ar ? "طي الفروع التابعة" : "Hide child branches"))
              : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (!canFold || !stationId) return;
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(stationId)) next.delete(stationId);
                else next.add(stationId);
                return next;
              });
              setSelectedStationId(stationId);
            }}
            style={{
              all: "unset",
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              fontSize: 10.5,
              color: "#4B5567",
              fontFamily: "inherit",
              cursor: canFold ? "pointer" : "default",
            }}
          >
            <span style={{ ...ELLIPSIS }}>{glanceCount}</span>
            {canFold ? <span style={{ color: MUTED }}>{folded ? "+" : "−"}</span> : null}
          </button>
          {isManagerNode ? (
            <button
              type="button"
              data-org-hit="true"
              disabled
              title={ar ? "عقدة إدارة — ليست مكان توظيف. وظّف على فرع تشغيلي تحتها." : "Admin node — not a hire workplace. Hire on a workplace branch under it."}
              onClick={(event) => event.stopPropagation()}
              style={{
                fontFamily: "inherit",
                fontSize: 10,
                fontWeight: 600,
                padding: "4px 9px",
                border: "1px solid #DFE3EA",
                background: "#EEF0F4",
                color: "#4B5567",
                cursor: "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              {ar ? "لا توظيف — إدارة" : "No hire — admin"}
            </button>
          ) : onHire && canWrite ? (
            <button
              type="button"
              data-org-hit="true"
              onClick={(event) => {
                event.stopPropagation();
                onHire({ stationId });
              }}
              style={{
                fontFamily: "inherit",
                fontSize: 10,
                fontWeight: 600,
                padding: "4px 9px",
                border: "none",
                background: "#137A49",
                color: "#fff",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {ar ? "وظّف على مقعد" : "Hire onto a seat"}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const setSafeZoom = (value) => setZoom(Math.max(0.15, Math.min(2.5, value)));
  const panTree = (x, y) => setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  const gestures = useOrgTreeViewport(viewportRef, zoom, setSafeZoom, offset, setOffset);
  const fitTree = () => {
    const viewport = viewportRef.current;
    const tree = treeRef.current;
    if (!viewport || !tree) return;
    const pad = 72;
    const vw = Math.max(1, viewport.clientWidth - pad);
    const vh = Math.max(1, viewport.clientHeight - pad);
    const width = Math.max(tree.scrollWidth, tree.offsetWidth, 1);
    const height = Math.max(tree.scrollHeight, tree.offsetHeight, 1);
    if (width < 8 || height < 8) {
      setSafeZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const next = Math.min(vw / width, vh / height);
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

  useEffect(() => {
    setActingPick("");
    const day = new Date();
    day.setDate(day.getDate() + 30);
    setActingUntil(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
  }, [selectedStationId]);

  const stations = data?.stations || [];
  const companyRoot = companyRootStation(stations);
  const companyRootId = companyRoot?.id || "";
  const movers = (data?.employees || []).filter((employee) =>
    employee?.name
    && employee.role !== "system"
    && employee.active !== false
  );
  const needle = query.trim().toLowerCase();
  const branchHits = needle
    ? flattenOrgBranches(diagram.branches).filter((node) =>
      `${node.name || ""} ${node.managerName || ""} ${node.kind || ""}`.toLowerCase().includes(needle)
    ).slice(0, 8)
    : [];
  const structureLog = orgStructureEvents(data).slice(0, 8);
  const actingMenuStation = (data?.stations || []).find((station) => String(station.id) === String(actingMenu?.stationId || ""));
  const actingMenuCandidates = movers.filter((employee) =>
    String(employee.stationId || "") !== String(actingMenu?.stationId || "")
    && String(employee.id) !== String(actingMenuStation?.managerId || "")
  );
  const moveEmployee = (employeeId, stationId) => {
    if (!company?.id || !canWrite || !employeeId || !stationId) return;
    const result = quickTransferEmployee(company.id, {
      employeeId,
      toStationId: stationId,
      actor: currentUser,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({
      description: ar
        ? `نُقل ${result.employee?.name || ""} إلى ${result.record.toStationName}`
        : `${result.employee?.name || ""} moved to ${result.record.toStationName}`,
    });
  };

  const branchDrop = (stationId) => {
    if (!canWrite || !stationId) return {};
    const over = overStationId === stationId && draggingId;
    return {
      onDragOver: (event) => {
        if (!draggingId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOverStationId(stationId);
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = event.dataTransfer.getData("text/plain") || event.dataTransfer.getData("text") || draggingId;
        setOverStationId("");
        setDraggingId("");
        if (!id) return;
        const home = (data?.employees || []).find((item) => String(item.id) === String(id))?.stationId;
        if (home && String(home) === String(stationId)) return;
        moveEmployee(id, stationId);
      },
      style: over ? { boxShadow: `inset 0 0 0 2px ${GREEN}`, background: "hsl(154 79% 27% / .08)" } : undefined,
    };
  };

  return (
    <>
      {(panel => (fullscreen ? createPortal(panel, document.body) : panel))(
        <OrgPanel ar={ar} fullscreen={fullscreen}>
          <OrgToolbar
            title={ar ? "شجرة المكان" : "Place tree"}
            subtitle={ar
              ? "مدير فرعين شخص واحد: يظهر على البطاقتين، يحضر من مقعده، ويتبع مدير المكان الأعلى."
              : "A manager of two branches is one person: on both cards, punches at their seat, reports to the parent-place manager."}
          >
            <OrgSearchBox
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ar ? "ابحث عن فرع" : "Find branch"}
              hits={branchHits}
              onPick={(node) => {
                revealStation(node.stationId);
                setQuery("");
              }}
              renderHit={(node) => (
                <>
                  {node.name}
                  <span style={{ color: MUTED }}> · {node.managerName || (ar ? "بلا مدير" : "Vacant")}</span>
                </>
              )}
            />
            <button type="button" onClick={collapseDistant} style={orgBtnGhost}>
              {ar ? "طي" : "Collapse"}
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
              {addingBranch ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 200 }}>
                    <OrgUnitKindPicker value={branchUnitKind} onChange={setBranchUnitKind} ar={ar} compact />
                  </div>
                  <input
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") addBranch(); }}
                    placeholder={branchUnitKind === "manager" ? (ar ? "اسم المدير" : "Manager name") : (ar ? "اسم الفرع" : "Branch name")}
                    autoFocus
                    style={{ ...orgInput, width: 160 }}
                  />
                  <select
                    value={branchParentId || companyRootId}
                    onChange={(event) => setBranchParentId(event.target.value)}
                    aria-label={ar ? "يتبع" : "Reports to"}
                    style={{ ...orgSelect, maxWidth: 180 }}
                  >
                    {companyRootId ? (
                      <option value={companyRootId}>{ar ? `يتبع ${companyRoot.name || companyName}` : `Reports to ${companyRoot.name || companyName}`}</option>
                    ) : (
                      <option value="">{ar ? "يتبع المنشأة" : "Reports to company"}</option>
                    )}
                    {(data?.stations || []).filter((station) => station.id && station.id !== companyRootId).map((station) => (
                      <option key={station.id} value={station.id}>{station.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={addBranch} style={orgBtnPrimary()}>
                    {ar ? "إضافة" : "Add"}
                  </button>
                  <button type="button" onClick={() => { setAddingBranch(false); setBranchName(""); setBranchParentId(""); setBranchUnitKind("branch"); }} style={orgBtnGhost}>
                    {ar ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => { setBranchParentId(""); setBranchUnitKind("branch"); setAddingBranch(true); }} style={orgBtnGhost}>
                  {ar ? "أضف فرعًا أو مديرًا" : "Add branch or manager"}
                </button>
              )}
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
                setRenamingStationId("");
              },
            }}
            fullscreen={fullscreen}
          >
            <div
              ref={treeRef}
              style={orgTreeStageStyle(offset, zoom)}
            >
              {(() => {
                const rootBranch = (diagram.branches || []).find((branch) => branch.isCompanyRoot);
                const treeBranches = rootBranch ? (rootBranch.children || []) : (diagram.branches || []);
                const rootDrop = branchDrop(rootBranch?.stationId || companyRootId);
                const rootName = rootBranch?.name || companyRoot?.name || companyName;
                const rootTitle = rootBranch?.managerTitle || "";
                const rootWho = rootBranch?.managerName || "";
                const rootId = String(rootBranch?.stationId || companyRootId || "");
                const rootFolded = rootId && collapsed.has(rootId);
                const seen = new Set(rootId ? [rootId] : []);
                const renderKids = (items, depth) => {
                  if (depth > 20) return null;
                  const row = (items || []).filter((branch) => {
                    const id = String(branch?.stationId || branch?.name || "");
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                  });
                  if (!row.length) return null;
                  return (
                    <OrgKids>
                      {row.map((branch, index) => {
                        const folded = collapsed.has(String(branch.stationId || ""));
                        const kids = Array.isArray(branch.children) ? branch.children : [];
                        return (
                          <OrgColumn key={branch.stationId || branch.name || index}>
                            <OrgCap index={index} total={row.length} />
                            <BranchPersonCard branch={branch} drop={branchDrop(branch.stationId)} />
                            {!folded && kids.length ? renderKids(kids, depth + 1) : null}
                          </OrgColumn>
                        );
                      })}
                    </OrgKids>
                  );
                };
                return (
                  <OrgColumn pad={false}>
                    <BranchPersonCard
                      branch={rootBranch || {
                        name: rootName,
                        stationId: rootBranch?.stationId || companyRootId,
                        managerName: rootWho,
                        managerTitle: rootTitle,
                        managerId: String(companyRoot?.managerId || ""),
                        unitKind: rootBranch?.unitKind || companyRoot?.unitKind,
                        treePeople: rootBranch?.treePeople || 0,
                        childCount: treeBranches.length,
                      }}
                      isRoot
                      drop={rootDrop}
                    />
                    {!rootFolded && treeBranches.length
                      ? renderKids(treeBranches, 0)
                      : (!treeBranches.length ? (
                        <span style={{ marginBlockStart: 16, fontSize: 12, color: MUTED }}>
                          {ar ? "لا فروع بعد — أضف فرعًا من أعلى الشجرة." : "No branches yet — add a branch above."}
                        </span>
                      ) : null)}
                  </OrgColumn>
                );
              })()}
            </div>
          </OrgTreeCanvas>

          {!fullscreen && structureLog.length ? (
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
      {plusMenu ? createPortal(
        <div data-org-hit="true">
          <button
            type="button"
            aria-label={ar ? "إغلاق" : "Close"}
            onClick={() => { setPlusMenu(null); setAttachStationId(""); }}
            style={{ position: "fixed", inset: 0, border: 0, background: "transparent", zIndex: 450, cursor: "default" }}
          />
          <div
            role="menu"
            style={{
              position: "fixed",
              top: plusMenu.top,
              left: plusMenu.left,
              zIndex: 451,
              width: 220,
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {plusMenu.mode === "attach" ? (
              <>
                <span style={{ fontSize: 11, color: MUTED, padding: "4px 8px" }}>
                  {ar ? "أضف فرعًا موجودًا تحت هذه العقدة" : "Hang an existing branch under this node"}
                </span>
                {attachableUnder(plusMenu.stationId).length ? (
                  <>
                    <select
                      value={attachStationId}
                      onChange={(event) => setAttachStationId(event.target.value)}
                      style={{ height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, padding: "0 8px", fontSize: 12, fontFamily: "inherit", background: CARD, color: NAVY }}
                    >
                      <option value="">{ar ? "اختر فرعًا" : "Pick a branch"}</option>
                      {attachableUnder(plusMenu.stationId).map((station) => (
                        <option key={station.id} value={station.id}>{station.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => attachExistingChild(plusMenu.stationId)}
                      style={{ all: "unset", cursor: "pointer", height: 32, borderRadius: 8, background: GREEN, color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: "inherit", textAlign: "center" }}
                    >
                      {ar ? "إضافة الفرع" : "Add branch"}
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: MUTED, padding: "6px 8px", lineHeight: 1.55 }}>
                    {ar ? "لا فرع يمكن إضافته هنا." : "No branch can be added here."}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setPlusMenu({ ...plusMenu, mode: "pick" }); setAttachStationId(""); }}
                  style={{ all: "unset", cursor: "pointer", height: 30, padding: "0 8px", fontSize: 12, color: MUTED, fontFamily: "inherit" }}
                >
                  {ar ? "رجوع" : "Back"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openCreateChild(plusMenu.stationId)}
                  style={{ all: "unset", cursor: "pointer", height: 34, padding: "0 10px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: NAVY, fontFamily: "inherit", textAlign: "start" }}
                >
                  {ar ? "إنشاء فرع" : "Create branch"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setPlusMenu({ ...plusMenu, mode: "attach" })}
                  style={{ all: "unset", cursor: "pointer", height: 34, padding: "0 10px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: NAVY, fontFamily: "inherit", textAlign: "start" }}
                >
                  {ar ? "إضافة فرع" : "Add branch"}
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
      {actingMenu ? createPortal(
        <div data-org-hit="true">
          <button
            type="button"
            aria-label={ar ? "إغلاق" : "Close"}
            onClick={() => setActingMenu(null)}
            style={{ position: "fixed", inset: 0, border: 0, background: "transparent", zIndex: 450, cursor: "default" }}
          />
          <div
            role="dialog"
            aria-label={ar ? "مدير بالوكالة" : "Acting manager"}
            style={{
              position: "fixed",
              top: actingMenu.top,
              left: actingMenu.left,
              zIndex: 451,
              width: 240,
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxShadow: "0 12px 28px hsl(220 43% 11% / .12)",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>
              {ar ? "مدير بالوكالة على هذه البطاقة" : "Acting manager on this card"}
            </span>
            {actingMenuCandidates.length ? (
              <>
                <select
                  value={actingPick}
                  onChange={(event) => setActingPick(event.target.value)}
                  aria-label={ar ? "مدير بالوكالة" : "Acting manager"}
                  style={{ ...orgSelect, minWidth: 0, width: "100%" }}
                >
                  <option value="">{ar ? "اختر موظفًا" : "Pick an employee"}</option>
                  {actingMenuCandidates.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                  ))}
                </select>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: MUTED }}>
                  {ar ? "حتى" : "Until"}
                  <PlatformDateField
                    ar={ar}
                    compact
                    value={actingUntil}
                    onChange={setActingUntil}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => saveActing(actingMenu.stationId)}
                  disabled={!actingPick}
                  style={{
                    all: "unset",
                    cursor: actingPick ? "pointer" : "not-allowed",
                    height: 32,
                    borderRadius: 8,
                    background: actingPick ? NAVY : "hsl(220 13% 88%)",
                    color: actingPick ? "#fff" : MUTED,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    textAlign: "center",
                  }}
                >
                  {ar ? "تعيين وكالة" : "Assign acting"}
                </button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
                {ar ? "لا يوجد من يُعيَّن بالوكالة هنا — لا تُعطى الوكالة لموظف على نفس الفرع." : "No one can act here — acting cannot be the person's own branch."}
              </span>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
      <OrgEmployeePreview
        open={Boolean(previewEmployee)}
        employee={previewEmployee}
        data={data}
        companyName={companyName}
        ar={ar}
        onClose={() => setPreviewEmployee(null)}
      />
    </>
  );
}
