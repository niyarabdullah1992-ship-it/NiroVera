import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { getRoleLabel } from "@/lib/roles";
import { safetyCardFaceCounts, safetyCardStage, safetyCardsOnFace, safetyCardsVisibleTo } from "@/lib/safetyBranchVisibility";
import { visibleStations, canApproveReports } from "@/lib/permissions";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { updateSafetyRecord, recordSafetyIncident, closeSafetyHazard, approveSafetyRecord, revokeSafetyApproval, decideSafetyCard, issueSafetyPermit, actOnSafetyPermit, recordInspectionRound, saveIncidentInvestigation } from "@/lib/safetyStore";
import PermitDesk from "@/components/safety/PermitDesk";
import InspectionRound from "@/components/safety/InspectionRound";
import IncidentRegister from "@/components/safety/IncidentRegister";
import HseCommand, { deriveHseCommand } from "@/components/safety/HseCommand";
import { injuryReportState, isTrackedIncident, openCapas } from "@/lib/safetyOps";
import { safetyApprovalIssues } from "@/lib/safetyLogic";
import SafetyIncidentReportForm from "@/components/safety/SafetyIncidentReportForm";
import StationSiteDutiesCard from "@/components/safety/StationSiteDutiesCard";
import WorkplaceLawCard from "@/components/safety/WorkplaceLawCard";
import NightSiteDutiesCard from "@/components/safety/NightSiteDutiesCard";
import { safetyMinistryFacts } from "@/lib/safetyMinistryRows";
import SafetyOverviewTab from "@/components/safety/SafetyOverviewTab";
import { SafetyDashboard } from "@/components/safety/SafetyManageViews";
import { SafetyCardBody, SafetyCardRow, SafetyDecisionComposer } from "@/components/safety/SafetyCardRows";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import TwoPaneWorkspace, { ListStack } from "@/components/shared/TwoPaneWorkspace";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";
import { toast } from "@/components/ui/use-toast";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import { MUTED } from "@/lib/platformStyles";
import { pageKicker } from "@/lib/moduleMeta";
import { useRailSide } from "@/lib/railSide";

const ADMIN_TABS = new Set(["dash", "register", "permits", "inspect", "incidents"]);
const TAB_ALIAS = {
  work: "register",
  comply: "permits",
  approve: "inspect",
  analytics: "dash",
  archive: "incidents",
  manage: "dash",
};

export default function Safety() {
  const { lang, dir, t } = useI18n();
  const { data, currentUser, company } = useAuth();
  const ar = lang === "ar";
  const employeeRail = useRailSide() === "employee";
  const [searchParams, setSearchParams] = useSearchParams();
  const headerScope = useStationScope();
  const requested = searchParams.get("tab");
  const tab = employeeRail
    ? "work"
    : (ADMIN_TABS.has(requested) ? requested : (TAB_ALIAS[requested] || "dash"));
  const [stationId, setStationId] = useState(searchParams.get("station") || "");
  const [levelOpen, setLevelOpen] = useState(false);

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "dash") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const stations = data && currentUser
    ? visibleStations(currentUser, data).filter((station) => matchesStationScope(station.id, headerScope, data.stations))
    : [];
  const selectedId = stations.some((station) => station.id === stationId) ? stationId : (stations[0]?.id || "");

  useEffect(() => {
    if (selectedId && selectedId !== stationId) setStationId(selectedId);
  }, [selectedId, stationId]);

  // Safety cards follow the branch rule of المهام / إثبات العمل / إثبات الزائر (lib/safetyBranchVisibility):
  // the reporter, his branch and the managers whose scope holds the branch — redacted where named.
  const [mineScope, setMineScope] = useState("mine");
  const [mineFace, setMineFace] = useState("all");
  const [manageFace, setManageFace] = useState("open");
  const managerRole = Boolean(currentUser) && (["director", "ops_manager", "pgm", "station_manager", "safety_officer"].includes(currentUser.role) || data?.ownerId === currentUser.id);
  const managedKey = managerRole ? stations.map((station) => station.id).join("|") : "";
  const visibleCards = useMemo(() => (data && currentUser ? safetyCardsVisibleTo({
    safety: data.safety || [],
    stations: data.stations || [],
    viewer: currentUser,
    managedStationIds: managedKey ? managedKey.split("|") : [],
  }) : []), [data, currentUser, managedKey]);
  const scopedCards = visibleCards.filter((row) => row.mine || matchesStationScope(row.stationId, headerScope, data?.stations));
  const mineCards = scopedCards.filter((row) => row.mine);
  const branchCards = scopedCards.filter((row) => !row.mine);
  const laneCards = employeeRail ? (mineScope === "branch" ? branchCards : mineCards) : scopedCards.filter((row) => row.managed || row.sameBranch);
  const laneCounts = safetyCardFaceCounts(laneCards);
  const isCriticalCard = (row) => row.stage !== "closed" && row.stage !== "archive" && ((Number(row.item.card?.score) || 0) >= 15 || row.item.card?.levelKey === "critical");
  const shownCards = employeeRail
    ? safetyCardsOnFace(laneCards, mineFace)
    : (manageFace === "critical" ? laneCards.filter(isCriticalCard) : safetyCardsOnFace(laneCards, manageFace));
  const focusCard = searchParams.get("card") || "";
  const fold = useCollapsibleItems(shownCards.map((row) => String(row.item.id)), focusCard);

  if (!data || !currentUser) return null;

  const scopedSafety = (data.safety || []).filter((rec) => matchesStationScope(rec.stationId, headerScope, data.stations));
  const isSafetyOfficer = currentUser.role === "safety_officer";
  const roleCanEdit = ["director", "ops_manager", "pgm", "station_manager"].includes(currentUser.role) || isSafetyOfficer || data.ownerId === currentUser.id;
  const canEdit = roleCanEdit && !employeeRail;
  const canApprove = (canApproveReports(currentUser) || isSafetyOfficer || data.ownerId === currentUser.id) && !employeeRail;
  const reportStation = (data.stations || []).find((station) => station.id === currentUser.stationId);
  const recFor = (sid) =>
    scopedSafety.find((s) => String(s.stationId) === String(sid))
    || (data.safety || []).find((s) => String(s.stationId) === String(sid))
    || null;

  const selectedStation = stations.find((station) => station.id === selectedId) || null;

  const employeeHint = ar
    ? "بلاغاتك وبلاغات فرعك — كل بطاقة بمرحلتها ومهلتها ومن يعالجها. يرى البلاغ فرعه ومسؤول السلامة ومدير الفرع."
    : "Your reports and your branch's — each card with its stage, its window and who handles it. A report is seen by its branch, the safety officer and the branch manager.";
  const adminHint = ar
    ? "لوحة واحدة للمخاطر وتصاريح العمل وجاهزية الفروع والحوادث. نظام العمل — الباب الثامن «الوقاية من مخاطر العمل»."
    : "One board for hazards, permits, branch readiness and incidents. Labour Law, Part Eight.";

  const handleUpdate = (id, updates) => {
    const rec = recFor(id);
    const extra = updates.hazards && updates.hazards.length > (rec?.hazards?.length || 0) && (!rec?.level || rec.level === "green")
      ? { level: "amber" }
      : {};
    updateSafetyRecord(company.id, id, { ...updates, ...extra, approvedBy: null, approvedAt: null }, currentUser.name);
  };

  // Regs Arts. 29–30: the site record and the first-aid check sit on the station's safety record,
  // stamped with who and when — they do not reset the branch-level approval.
  const stamp = () => ({ recordedBy: currentUser.name || "", recordedAt: new Date().toISOString() });
  const handleSaveSite = (id, site) => {
    updateSafetyRecord(company.id, id, { site: { ...site, ...stamp() } }, currentUser.name);
    toast({ description: ar ? "سُجّل موقع الفرع — يُشتق «بعيد عن العمران» منه (اللائحة م30)." : "Site recorded — remoteness is derived from it (Regs Art. 30)." });
  };
  const handleSaveWorkplaceLaw = (id, workplaceLaw, itemId) => {
    const at = new Date().toISOString();
    const next = { ...workplaceLaw, [itemId]: { ...workplaceLaw[itemId], by: currentUser.name || "", at } };
    updateSafetyRecord(company.id, id, { workplaceLaw: next }, currentUser.name);
    toast({ description: ar ? "سُجّل فحص البند مع اسمك والتاريخ." : "Check recorded with your name and the date." });
  };
  const handleSaveCabinet = (id, cabinet) => {
    const at = new Date().toISOString();
    updateSafetyRecord(company.id, id, { firstAidCabinet: { ...cabinet, checkedBy: currentUser.name || "", checkedAt: at } }, currentUser.name);
    toast({ description: ar ? "حُفظ فحص خزانة الإسعافات (اللائحة م29)." : "First-aid cabinet check saved (Regs Art. 29)." });
  };
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  // Reports, hazards, the first-aid check (Regs 29) and the site distance (Regs 30) in scope — the same
  // facts «مرجعية الوزارة» and the «الامتثال الوزاري» index read (lib/safetyMinistryRows).
  const ministryFacts = safetyMinistryFacts({ stations, recFor, today: todayKey });

  const handleApprove = (id) => {
    const result = approveSafetyRecord(company.id, id, currentUser.name);
    if (result && result.ok === false) {
      toast({ description: ar ? result.reason : (result.reasonEn || result.reason), variant: "destructive" });
      return false;
    }
    return true;
  };
  const handleRevokeApproval = (id) => revokeSafetyApproval(company.id, id, currentUser.name);
  const handleCloseHazard = (id, index, opts = {}) => {
    const result = closeSafetyHazard(company.id, id, index, currentUser.name, opts);
    if (result && result.ok === false) {
      toast({ description: ar ? result.reason : (result.reasonEn || result.reason), variant: "destructive" });
    }
    return result;
  };

  const handleIncident = (id, desc) => {
    const dup = (recFor(id)?.incidentLog || []).some(
      (i) => (i.description || "") === desc && i.at && new Date(i.at).toDateString() === new Date().toDateString()
    );
    if (dup) {
      toast({ description: ar ? "هذا الوصف مسجّل اليوم كحادث." : "This description is already logged as an incident today.", variant: "destructive" });
      return;
    }
    const saved = recordSafetyIncident(company.id, id, desc, currentUser.name);
    toast({
      description: saved
        ? (ar ? "سُجّل الحادث. انتقل إلى الاعتماد بعد التفتيش الجديد." : "Incident logged. Move to approval after a new inspection.")
        : (ar ? "تعذّر تسجيل الحادث." : "Couldn't log the incident."),
      variant: saved ? "default" : "destructive",
    });
  };

  const openCardCount = laneCounts.open + laneCounts.progress;

  // The طلباتي الإدارة composer: one decision, written, gated, on the trail; the reporter is told by number.
  const handleDecide = (row, decision) => {
    const result = decideSafetyCard(company.id, row.stationId, row.item.id, decision, { id: currentUser.id, name: currentUser.name }, lang);
    const done = {
      assign: ar ? "أُسند البلاغ — وصل المُبلِّغ إشعار برقمه." : "Assigned — the reporter was told by its number.",
      action: ar ? "سُجّل الإجراء التصحيحي — وصل المُبلِّغ إشعار." : "Corrective action recorded — the reporter was told.",
      close: ar ? "أُغلق البلاغ بسبب مكتوب — وصل المُبلِّغ إشعار." : "Closed with a written reason — the reporter was told.",
      escalate: ar ? "صُعّد البلاغ للمستوى التالي." : "Escalated to the next level.",
    }[decision.action];
    toast({ description: result.ok ? done : (ar ? result.reason : (result.reasonEn || result.reason)), variant: result.ok ? "default" : "destructive" });
    // The decided card stays in view: the filter follows it to its new stage.
    if (result.ok && manageFace !== "all") setManageFace(safetyCardStage(result.item));
    return result;
  };
  const staffOf = (sid) => (data.employees || []).filter((person) => person.id && person.name && (String(person.stationId) === String(sid) || (person.managedStations || []).map(String).includes(String(sid)) || person.id === data.ownerId || person.role === "safety_officer"));

  const archiveItems = stations.flatMap((station) => {
    const rec = recFor(station.id);
    const incidents = ((rec?.incidentLog) || []).map((i, idx) => {
      const card = i.card || {};
      const level = ar ? card.levelAr : card.levelEn;
      return {
        id: `${station.id}_inc_${i.at || idx}`,
        date: i.at || i.reviewedAt,
        title: station.name,
        text: [i.description || card.what || "—", ar ? card.categoryAr : card.categoryEn, card.where].filter(Boolean).join(" · "),
        branch: station.name,
        badge: level || (ar ? "حادث" : "Incident"),
        search: [i.description, card.code, card.where, card.categoryAr, card.categoryEn, i.anonymous ? "بلاغ بلا اسم" : i.by].filter(Boolean).join(" "),
      };
    });
    const hazards = ((rec?.hazardLog) || []).map((h, idx) => ({
      id: `${station.id}_haz_${h.id || h.closedAt || idx}`,
      date: h.closedAt || h.openedAt,
      title: station.name,
      text: h.description || "",
      branch: station.name,
      badge: ar ? "خطر أُغلق" : "Hazard closed",
    }));
    return [...incidents, ...hazards];
  });

  // Safety operations (lib/safetyOps): permits, monthly rounds, investigations — each gate names its refusal.
  const actor = { id: currentUser.id, name: currentUser.name };
  const say = (result, okText) => {
    toast({ description: result?.ok ? okText : (ar ? result?.reason : (result?.reasonEn || result?.reason)) || (ar ? "تعذّر الحفظ." : "Not saved."), variant: result?.ok ? "default" : "destructive" });
    return Boolean(result?.ok);
  };
  const handleIssuePermit = (draft) => {
    const result = issueSafetyPermit(company.id, draft, actor, lang);
    return say(result, ar ? `صدر التصريح ${result.permit?.id || ""} — وصل المنفّذ إشعار بوقته.` : `Permit ${result.permit?.id || ""} issued — the holder was told its window.`);
  };
  const handleActPermit = (row, action, opts) => {
    const result = actOnSafetyPermit(company.id, row.permit.stationId, row.permit.id, action, opts, actor);
    const done = { suspend: ar ? "أُوقف العمل — السبب في سجل التصريح." : "Work stopped — the reason is on the permit.", resume: ar ? "استؤنف العمل." : "Work resumed.", close: ar ? "أُغلق التصريح بتوقيعك." : "Permit closed with your signature.", cancel: ar ? "أُلغي التصريح." : "Permit cancelled." }[action];
    return say(result, done);
  };
  const handleRound = (stationId, results) => {
    const result = recordInspectionRound(company.id, stationId, results, actor);
    return say(result, ar
      ? `سُجّلت الجولة بنتيجة ${result.round?.score ?? "—"}%${result.findings ? ` — رُفع ${result.findings} بلاغاً في «بلاغات السلامة»` : ""}.`
      : `Round recorded at ${result.round?.score ?? "—"}%${result.findings ? ` — ${result.findings} reports raised in Safety reports` : ""}.`);
  };
  const handleInvestigation = (row, draft) => {
    const result = saveIncidentInvestigation(company.id, row.stationId, row.item.id, draft, actor);
    return say(result, ar ? "سُجّل التحقيق والإجراء التصحيحي." : "Investigation and corrective action recorded.");
  };
  const command = deriveHseCommand({ stations, recFor, employees: data.employees || [], now: Date.now() });
  const trackedLog = stations.flatMap((station) => (recFor(station.id)?.incidentLog || []).filter(isTrackedIncident));
  const incidentAttention = trackedLog.filter((item) => ["due", "overdue"].includes(injuryReportState(item)?.state)).length + openCapas(trackedLog).filter((c) => c.overdue).length;

  const toolbarTabs = [
    { key: "dash", label: ar ? "لوحة السلامة" : "Safety board" },
    { key: "register", label: ar ? "بلاغات السلامة" : "Safety reports" },
    { key: "permits", label: ar ? "تصاريح العمل" : "Permits" },
    { key: "inspect", label: ar ? "التفتيش والجاهزية" : "Inspection" },
    { key: "incidents", label: ar ? "الحوادث والإصابات" : "Incidents" },
  ];

  const levelApproval = selectedStation ? (
    <details
      open={levelOpen}
      onToggle={(event) => setLevelOpen(event.currentTarget.open)}
      style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" }}
    >
      <summary style={{ padding: "12px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>
        {ar ? "اعتماد مستوى الفرع" : "Branch level approval"}
      </summary>
      <div style={{ padding: 14, borderTop: "1px solid var(--nv-line)", display: levelOpen ? "flex" : "none", flexDirection: "column", gap: 12 }}>
        {stations.length > 1 ? (
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {stations.map((station) => {
              const on = station.id === selectedId;
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => setStationId(station.id)}
                  style={{
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 999,
                    border: on ? "1px solid #3C7D50" : "1px solid var(--nv-line)",
                    background: on ? "#3C7D50" : "var(--nv-card)",
                    color: on ? "#fff" : "var(--nv-ink)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  {station.name}
                </button>
              );
            })}
          </div>
        ) : null}
        <SafetyOverviewTab
          station={selectedStation}
          rec={recFor(selectedStation.id) || {}}
          canEdit={canEdit}
          canApprove={canApprove}
          approvalIssues={safetyApprovalIssues(recFor(selectedStation.id), ar)}
          lang={lang}
          onUpdate={(updates) => handleUpdate(selectedStation.id, updates)}
          onCloseHazard={(index, opts) => handleCloseHazard(selectedStation.id, index, opts)}
          onApprove={() => handleApprove(selectedStation.id)}
          onRevokeApproval={() => handleRevokeApproval(selectedStation.id)}
          onIncident={(desc) => handleIncident(selectedStation.id, desc)}
          pane="status"
          listReports={false}
        />
      </div>
    </details>
  ) : (
    <p style={{ margin: 0, textAlign: "center", color: MUTED }}>—</p>
  );

  const reporter = currentUser?.name
    ? `${currentUser.name} · ${getRoleLabel(company, currentUser.role, t)}`
    : "—";
  const now = Date.now();
  const L = (a, e) => (ar ? a : e);
  const faceItems = [
    { id: "all", label: L("الكل", "All"), n: laneCounts.all },
    { id: "open", label: L("مفتوحة", "Open"), n: laneCounts.open },
    { id: "progress", label: L("قيد المعالجة", "In progress"), n: laneCounts.progress },
    { id: "closed", label: L("مغلقة", "Closed"), n: laneCounts.closed },
    { id: "archive", label: L("الأرشيف", "Archive"), n: laneCounts.archive },
  ];
  const criticalCount = laneCards.filter(isCriticalCard).length;
  const emptyLine = employeeRail
    ? (mineScope === "branch"
      ? L("لا بلاغات من زملاء فرعك في هذا الترشيح.", "No reports from your branch colleagues in this filter.")
      : L("لم ترفع بلاغاً في هذا الترشيح.", "You have raised no report in this filter."))
    : L("لا بلاغات في نطاقك في هذا الترشيح.", "No reports in your scope in this filter.");
  const cardList = (
    <ListStack data-safety-list={employeeRail ? mineScope : "manage"}>
      <StatusFilterPills
        card
        dataKey={employeeRail ? `safety-${mineScope}` : "safety-register"}
        title={employeeRail ? (mineScope === "branch" ? L("بلاغات الفرع", "Branch reports") : L("بلاغاتي", "My reports")) : L("بلاغات السلامة", "Safety reports")}
        note={employeeRail && mineScope === "branch" ? L("بلاغات زملاء فرعك — بلا اسم المُبلِّغ إن رُفع بلا اسم، وبلا اسم المصاب.", "Your branch colleagues' reports — without the reporter's name when anonymous, and without the injured person's name.") : undefined}
        value={employeeRail ? mineFace : manageFace}
        onChange={employeeRail ? setMineFace : setManageFace}
        items={employeeRail || (!criticalCount && manageFace !== "critical") ? faceItems : [...faceItems.slice(0, 2), { id: "critical", label: L("حرجة", "Critical"), n: criticalCount }, ...faceItems.slice(2)]}
      />
      {shownCards.length ? shownCards.map((row) => {
        const key = String(row.item.id);
        return (
          <SafetyCardRow key={key} row={row} ar={ar} now={now} open={fold.isOpen(key)} onToggle={() => fold.toggle(key)}>
            <SafetyCardBody row={row} ar={ar} now={now} />
            {!employeeRail && (canEdit || canApprove) ? (
              <SafetyDecisionComposer
                row={row}
                ar={ar}
                actor={{ id: currentUser.id, name: currentUser.name }}
                staff={staffOf(row.stationId)}
                onDecide={(decision) => handleDecide(row, decision)}
              />
            ) : null}
          </SafetyCardRow>
        );
      }) : (
        <p className="nv-cic" style={{ margin: 0, padding: "14px 16px", fontSize: 12.5, color: "var(--nv-muted)", lineHeight: 1.8 }}>{emptyLine}</p>
      )}
    </ListStack>
  );

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/safety", lang)}
      title={employeeRail ? L("بلاغات السلامة", "Safety reports") : L("السلامة HSE", "Safety HSE")}
      hint={employeeRail ? employeeHint : adminHint}
      maxWidth={1280}
      tabs={employeeRail
        ? [
          { value: "mine", label: L("بلاغاتي", "My reports"), count: mineCards.length },
          { value: "branch", label: L("بلاغات الفرع", "Branch reports"), count: branchCards.length },
        ]
        : toolbarTabs.map((tabItem) => ({
          value: tabItem.key,
          label: tabItem.label,
          count: tabItem.key === "register" ? openCardCount
            : tabItem.key === "dash" ? command.queue.length
              : tabItem.key === "permits" ? command.permits.live + command.permits.unclosed
                : tabItem.key === "inspect" ? command.branches.filter((b) => b.roundDue).length
                  : tabItem.key === "incidents" ? incidentAttention : 0,
        }))}
      tool={employeeRail ? mineScope : tab}
      onTool={employeeRail ? (value) => { setMineScope(value); setMineFace("all"); } : setTab}
      meta={null}
    >
      <div data-safety-face={employeeRail ? "employee" : "manage"} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {employeeRail && (
        <TwoPaneWorkspace
          dataKey="safety-mine"
          raise={(
            <SafetyIncidentReportForm
              station={reportStation}
              ar={ar}
              reporter={reporter}
              onSubmit={async (card) => {
                if (!reportStation?.id) {
                  toast({
                    description: ar ? "لا فرع مرتبط بهذا الحساب — لا يُحفظ البلاغ." : "No branch is linked to this account — the report was not saved.",
                    variant: "destructive",
                  });
                  return false;
                }
                const saved = recordSafetyIncident(company.id, reportStation.id, card.what, currentUser.name, {
                  ...card,
                  reporterId: currentUser.id,
                });
                toast({
                  description: saved
                    ? (ar ? `أُرسل البلاغ${card.code ? ` ${card.code}` : ""} — يراه فرعك ومسؤول السلامة ومدير الفرع.` : `Report${card.code ? ` ${card.code}` : ""} sent — your branch, the safety officer and the branch manager see it.`)
                    : (ar ? "تعذّر حفظ البلاغ. إن كان الوصف نفسه قد سُجّل اليوم فلن يُكرَّر." : "The report was not saved. The same description already logged today is not repeated."),
                  variant: saved ? "default" : "destructive",
                });
                if (saved) { setMineScope("mine"); setMineFace("all"); }
                return Boolean(saved);
              }}
            />
          )}
          list={cardList}
        />
      )}

      {tab === "dash" && !employeeRail && (
        <>
          <HseCommand ar={ar} command={command} onGo={setTab} />
          <SafetyDashboard ar={ar} stations={stations} recFor={recFor} onOpenRegister={() => setTab("register")} data={data} companyId={company?.id} canEdit={!employeeRail} command={command} />
          <HseCommand ar={ar} command={command} part="matrix" />
        </>
      )}
      {tab === "register" && !employeeRail && (
        <TwoPaneWorkspace dataKey="safety-register" list={cardList} />
      )}
      {tab === "permits" && !employeeRail && (
        <PermitDesk ar={ar} stations={stations} recFor={recFor} staffOf={staffOf} canEdit={canEdit} today={todayKey} onIssue={handleIssuePermit} onAct={handleActPermit} />
      )}
      {tab === "inspect" && !employeeRail && (
        <>
          <InspectionRound ar={ar} stations={stations} recFor={recFor} canEdit={canEdit} onSave={handleRound} />
          <StationSiteDutiesCard ar={ar} stations={stations} recFor={recFor} canEdit={canEdit} today={todayKey} onSaveSite={handleSaveSite} onSaveCabinet={handleSaveCabinet} />
          {/* Labour Law on the workplace — Arts. 125 · 63 · 144 · 158, each under its article. */}
          <WorkplaceLawCard ar={ar} stations={stations} recFor={recFor} data={data} canEdit={canEdit} today={todayKey} onSave={handleSaveWorkplaceLaw} />
          {/* Decision 18632 (III) — first aid · emergency transfer · food for night work live here, in السلامة. */}
          <NightSiteDutiesCard
            ar={ar}
            stations={stations}
            data={data}
            companyId={company?.id}
            canEdit={canEdit}
            actor={currentUser}
            today={todayKey}
            focus={searchParams.get("focus") === "night"}
            onSaved={() => toast({ description: ar ? "حُفظ الإثبات — يقرؤه جدول الدوام عند النشر." : "Proof saved — the duty roster reads it when publishing." })}
          />
          {levelApproval}
        </>
      )}
      {tab === "incidents" && !employeeRail && (
        <>
          <IncidentRegister ar={ar} stations={stations} recFor={recFor} canEdit={canEdit} onSave={handleInvestigation} />
          <RecordSmartArchive
            items={archiveItems}
            lang={lang}
            dir={dir}
            emptyLabel={ar ? "لا حوادث أو مخاطر مغلقة في هذا النطاق." : "No closed incidents or hazards in this scope."}
          />
        </>
      )}
      {/* The employee side reads the same duties for his knowledge — his branch, no recording. */}
      {employeeRail && reportStation ? (
        <WorkplaceLawCard ar={ar} stations={[reportStation]} recFor={recFor} data={data} canEdit={false} today={todayKey} readOnly self={(data.employees || []).find((p) => p.id === currentUser.id) || currentUser} />
      ) : null}
      {/* «أنظمة الوزارة» once — on the board (manage) or the employee's page, never under every tab. */}
      {employeeRail || tab === "dash" ? <MinistrySectionPanel
        sectionKey="safety"
        lane={employeeRail ? "employee" : "manage"}
        ar={ar}
        today={todayKey}
        inputs={{ facts: employeeRail ? {} : ministryFacts }}
      /> : null}
      </div>
    </SuiteWorkspaceFrame>
  );
}
