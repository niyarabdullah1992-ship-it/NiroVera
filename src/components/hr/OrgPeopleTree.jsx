import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { identityIconWrap } from "@/components/shared/IdentityCard";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";
import { GREEN, branchWord, peopleWord } from "@/lib/orgTemplateView";
import { buildPeopleTree, explainWorkplaceManager, filterPeopleHits, flattenPeopleTree, pathToPerson } from "@/lib/peopleTree";
import HierarchyZoomControls from "@/components/hr/HierarchyZoomControls";
import OrgTreeFullscreenButton from "@/components/hr/OrgTreeFullscreenButton";
import { OrgCap, OrgColumn, OrgKids, OrgRow, OrgStaffTray } from "@/components/hr/OrgChartLayout";
import useOrgTreeViewport from "@/hooks/useOrgTreeViewport";
import { toast } from "@/components/ui/use-toast";
import { quickTransferEmployee } from "@/lib/employeeStationTransfer";
import { deleteEmployeeAccount } from "@/lib/store";
import { workplaceStations } from "@/lib/stationTree";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { printReport } from "@/lib/printReport";
import { activeActingAssignments } from "@/lib/orgHire";
import { orgBtnGhost, orgBtnPrimary, orgSelect, orgTreeStageStyle } from "@/lib/orgWorkspaceStyles";
import { OrgInspector, OrgInspectorField, OrgPanel, OrgSearchBox, OrgToolbar, OrgTreeCanvas } from "@/components/hr/OrgWorkspace";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";
import { FileSelfBadge } from "@/components/employees/ProfileHero";

const CARD_W = 236;
const CARD_H = 108;
const STAFF_W = 156;
const STAFF_H = 56;
const STAFF_GAP = 8;
const ELLIPSIS = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function splitChildren(person) {
  const kids = person?.children || [];
  return {
    branchKids: kids.filter((child) => child.isBranchHead),
    staffKids: kids.filter((child) => !child.isBranchHead),
  };
}

function staffGridCols(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 1) return 1;
  const side = Math.ceil(Math.sqrt(n));
  if (n <= 25) return Math.max(2, side);
  if (n <= 36) return 6;
  return 7;
}

export default function OrgPeopleTree({ lang = "ar", canWrite = false }) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
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
  const hits = filterPeopleHits(people, query, 8);

  const setSafeZoom = (value) => setZoom(Math.max(0.15, Math.min(2.5, value)));
  const panTree = (x, y) => setOffset((current) => ({ x: current.x + x, y: current.y + y }));
  const gestures = useOrgTreeViewport(viewportRef, zoom, setSafeZoom, offset, setOffset);

  const fitTree = () => {
    const viewport = viewportRef.current;
    const node = treeRef.current;
    if (!viewport || !node) return;
    const pad = 72;
    const vw = Math.max(1, viewport.clientWidth - pad);
    const vh = Math.max(1, viewport.clientHeight - pad);
    const width = Math.max(node.scrollWidth, node.offsetWidth, 1);
    const height = Math.max(node.scrollHeight, node.offsetHeight, 1);
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
    const path = pathToPerson(tree.roots, personId) || [];
    setCollapsed((current) => {
      const next = new Set(current);
      path.forEach((node) => next.delete(node.id));
      return next;
    });
    setSelectedId(personId);
  };

  const collapseDistant = () => {
    const path = activeId ? (pathToPerson(tree.roots, activeId) || []) : [];
    const keepOpen = new Set(path.map((node) => String(node.id)));
    const next = new Set();
    people.forEach((person) => {
      if (!keepOpen.has(String(person.id)) && (person.children || []).length) next.add(person.id);
    });
    setCollapsed(next);
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

  const toggleStaff = (id, event) => {
    event.stopPropagation();
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedId(id);
  };

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

  const PersonCard = ({ person, compact = false }) => {
    const selected = person.id === activeId;
    const isMe = person.id === meId;
    const { branchKids, staffKids } = splitChildren(person);
    const folded = collapsed.has(person.id);
    const canOpen = staffKids.length > 0;
    const peopleCount = person.scopePeople || 0;
    const branchCount = person.treeBranches || 0;
    const countLabel = [
      peopleCount ? peopleWord(peopleCount, ar) : "",
      branchCount ? branchWord(branchCount, ar) : "",
    ].filter(Boolean).join(" · ");
    const employee = (data?.employees || []).find((item) => String(item.id) === String(person.id));
    const place = explainWorkplaceManager(data, person.id, { ar });
    const acting = activeActingAssignments(employee)[0];
    const actingUntil = String(acting?.until || "").slice(0, 10);
    const actingBranch = acting
      ? (data?.stations || []).find((station) => String(station.id) === String(acting.stationId))?.name || ""
      : "";
    const width = compact ? STAFF_W : CARD_W;
    const height = compact ? STAFF_H : CARD_H;
    const avatar = compact ? 32 : 40;
    return (
      <div
        data-org-hit="true"
        title={[person.name, person.job, person.branch].filter(Boolean).join(" · ")}
        onClick={() => setSelectedId(person.id)}
        style={{
          width,
          height,
          minWidth: width,
          minHeight: height,
          maxWidth: width,
          maxHeight: height,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          flex: "none",
          borderRadius: 10,
          border: `1px solid ${selected ? NAVY_FILL : BORDER}`,
          background: CARD,
          boxShadow: compact
            ? "none"
            : selected
              ? "0 0 0 2px color-mix(in oklab, #14284B 18%, transparent)"
              : "0 1px 2px rgba(20,40,75,.04)",
          overflow: "hidden",
          cursor: "pointer",
          transition: "box-shadow .15s ease, border-color .15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 7 : 10, padding: compact ? "0 8px" : "10px 12px 8px", flex: 1, minHeight: 0 }}>
          <button
            type="button"
            data-org-hit="true"
            aria-label={ar ? `بطاقة ${person.name || "الموظف"}` : `Card for ${person.name || "employee"}`}
            title={ar ? "عرض بطاقة الموظف" : "View employee card"}
            onClick={(event) => {
              event.stopPropagation();
              if (employee) {
                setPreviewEmployee(employee);
                return;
              }
              if (!person.id) return;
              setPreviewEmployee({
                id: person.id,
                name: person.name,
                avatarUrl: person.avatar,
                profile: { position: person.job, avatarUrl: person.avatar },
              });
            }}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              ...identityIconWrap,
              width: avatar,
              height: avatar,
              minWidth: avatar,
              minHeight: avatar,
              borderRadius: 999,
              fontSize: compact ? 10 : 11,
              fontWeight: 700,
              overflow: "hidden",
              flex: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              border: identityIconWrap.border || `1px solid ${BORDER}`,
              fontFamily: "inherit",
            }}
          >
            {person.avatar
              ? <img src={person.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initialsOf(person.name)}
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1, textAlign: "start" }}>
            <span style={{ fontSize: compact ? 11.5 : 13, fontWeight: 700, color: NAVY, lineHeight: ar ? 1.4 : 1.3, ...ELLIPSIS }}>
              {person.name || "—"}
              {isMe ? <>{" "}<FileSelfBadge ar={ar} /></> : null}
            </span>
            <span style={{ fontSize: compact ? 10.5 : 11.5, color: MUTED, lineHeight: ar ? 1.45 : 1.35, ...ELLIPSIS }}>
              {person.isBranchHead
                ? (person.branch || person.job || (ar ? "بلا فرع" : "No branch"))
                : (person.job || (ar ? "بلا منصب" : "No title"))}
            </span>
            {!compact && place?.many ? (
              <span style={{ fontSize: 10, color: "#4B5567", lineHeight: 1.35, ...ELLIPSIS }}>
                {ar ? "مرة واحدة" : "Once"}
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#137A49", marginInlineStart: 6 }}>1 seat · 1 home</span>
              </span>
            ) : !compact && acting ? (
              <span style={{ fontSize: 11, color: GREEN, lineHeight: ar ? 1.45 : 1.35, ...ELLIPSIS }}>
                {ar
                  ? `وكالة${actingBranch ? ` · ${actingBranch}` : ""}${actingUntil ? ` حتى ${actingUntil}` : ""}`
                  : `Acting${actingBranch ? ` · ${actingBranch}` : ""}${actingUntil ? ` until ${actingUntil}` : ""}`}
              </span>
            ) : !compact && person.isBranchHead && person.job ? (
              <span style={{ fontSize: 11, color: MUTED, lineHeight: ar ? 1.45 : 1.35, ...ELLIPSIS }}>{person.job}</span>
            ) : !compact && !person.isBranchHead ? (
              <span style={{ fontSize: 11, color: MUTED, lineHeight: ar ? 1.45 : 1.35, ...ELLIPSIS }}>
                {person.branch || (ar ? "بلا فرع" : "No branch")}
              </span>
            ) : null}
          </div>
        </div>
        {!compact && countLabel ? (
          <button
            type="button"
            data-org-hit="true"
            disabled={!canOpen}
            title={canOpen
              ? (folded
                ? (ar ? "إظهار موظفي هذا الفرع" : "Show this branch’s people")
                : (ar ? "إخفاء الموظفين" : "Hide people"))
              : undefined}
            onClick={(event) => (canOpen ? toggleStaff(person.id, event) : event.stopPropagation())}
            style={{
              all: "unset",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              height: 34,
              minHeight: 34,
              flex: "none",
              padding: "0 12px",
              borderTop: `1px solid ${BORDER}`,
              background: canOpen ? (folded ? "hsl(222 32% 97%)" : "hsl(154 79% 27% / .08)") : SURFACE,
              color: canOpen ? NAVY : MUTED,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'IBM Plex Sans', sans-serif",
              cursor: canOpen ? "pointer" : "default",
            }}
          >
            <span>{countLabel}</span>
            {canOpen ? <span style={{ fontSize: 11, color: MUTED }}>{folded ? "+" : "−"}</span> : null}
          </button>
        ) : null}
      </div>
    );
  };

  const renderBranch = (person, seen, compact = false) => {
    if (!person?.id || seen.has(person.id)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(person.id);
    const { branchKids, staffKids } = splitChildren(person);
    const showStaff = !collapsed.has(person.id);
    if (compact) {
      return (
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          <PersonCard person={person} compact />
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <PersonCard person={person} />
        {showStaff && staffKids.length ? (
          <OrgStaffTray
            cols={staffGridCols(staffKids.length)}
            itemW={STAFF_W}
            itemH={STAFF_H}
            gap={STAFF_GAP}
            label={ar ? "في هذا الفرع" : "At this workplace"}
          >
            {staffKids.map((child) => (
              <div key={child.id} style={{ width: STAFF_W, height: STAFF_H, minWidth: STAFF_W, minHeight: STAFF_H, overflow: "hidden" }}>
                {renderBranch(child, nextSeen, true)}
              </div>
            ))}
          </OrgStaffTray>
        ) : null}
        {branchKids.length ? (
          <OrgKids>
            {branchKids.map((child, index) => (
              <OrgColumn key={child.id}>
                <OrgCap index={index} total={branchKids.length} />
                {renderBranch(child, nextSeen)}
              </OrgColumn>
            ))}
          </OrgKids>
        ) : null}
      </div>
    );
  };

  const panel = (
    <OrgPanel ar={ar} fullscreen={fullscreen}>
      <OrgToolbar
        title={ar ? "شجرة الناس" : "People tree"}
        subtitle={ar
          ? "التبعية تُشتق من شجرة المكان. مدير فرعين يتبع مدير الأب ويحضر من مقعده."
          : "Reporting follows the place tree. A two-branch manager reports to the parent manager and attends from their seat."}
      >
        <OrgSearchBox
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ar ? "ابحث عن موظف" : "Find employee"}
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
        <button type="button" onClick={collapseDistant} style={orgBtnGhost}>
          {ar ? "طي البعيد" : "Collapse"}
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
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#137A49", marginInline: 8 }}>1 seat · 1 home</span>
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
                        border: "1px solid #FECACA",
                        background: CARD,
                        color: "#DC2626",
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
      >
        <div
          ref={treeRef}
          style={orgTreeStageStyle(offset, zoom)}
        >
          {tree.roots.length ? (
            tree.roots.length === 1
              ? renderBranch(tree.roots[0], new Set())
              : (
                <OrgRow>
                  {tree.roots.map((person, index) => (
                    <OrgColumn key={person.id}>
                      <OrgCap index={index} total={tree.roots.length} />
                      {renderBranch(person, new Set())}
                    </OrgColumn>
                  ))}
                </OrgRow>
              )
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
    </OrgPanel>
  );

  return (
    <>
      {fullscreen ? createPortal(panel, document.body) : panel}
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
