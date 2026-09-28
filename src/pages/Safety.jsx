import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, FileSignature, LayoutDashboard, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { getRoleLabel } from "@/lib/roles";
import { incidentIsMine } from "@/lib/safetyReportCard";
import { visibleStations, canApproveReports } from "@/lib/permissions";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { updateSafetyRecord, recordSafetyIncident, closeSafetyHazard, approveSafetyRecord, revokeSafetyApproval, patchSafetyIncident } from "@/lib/safetyStore";
import { safetyApprovalIssues } from "@/lib/safetyLogic";
import SafetyIncidentReportForm from "@/components/safety/SafetyIncidentReportForm";
import SafetyOverviewTab from "@/components/safety/SafetyOverviewTab";
import { SafetyComplyBoard, SafetyDashboard, SafetyInjuryTable, SafetyMinistryPanel, SafetyRiskRegister } from "@/components/safety/SafetyManageViews";
import { toast } from "@/components/ui/use-toast";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import { MUTED, NEUTRAL } from "@/lib/platformStyles";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
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
  const openHazardCount = scopedSafety.reduce((n, r) => n + (r.hazards || []).filter((h) => !h?.closedAt).length, 0);
  const awaitingApprove = stations.filter((station) => !recFor(station.id)?.approvedBy).length;

  const employeeHint = ar
    ? "البلاغ حقّ وواجب، ولا يُتخذ سبباً لجزاء. يصل مسؤول السلامة ومدير الفرع."
    : "A report is a right and a duty, and it is not grounds for a penalty. It reaches the safety officer and the branch manager.";
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

  const reportRows = stations.flatMap((station) => {
    const rec = recFor(station.id);
    return (rec?.incidentLog || []).map((item) => ({
      stationId: station.id,
      stationName: station.name || "—",
      item,
    }));
  });
  const openReportRows = reportRows.filter((row) => row.item?.status !== "closed");
  const criticalOpen = openReportRows.some((row) => (row.item.card?.score || 0) >= 15 || row.item.card?.levelKey === "critical");
  const injuryOpen = openReportRows.some((row) => row.item.card?.injured || row.item.card?.kind === 3);
  const openHazards = stations.flatMap((station) => (recFor(station.id)?.hazards || []).filter((hazard) => !hazard?.closedAt));
  const trackedReports = openReportRows.filter((row) => !row.item.card?.positive);
  const controlGap = trackedReports.some((row) => !row.item.card?.controlId) || openHazards.some((hazard) => !hazard?.controlId);
  const controlLabel = !trackedReports.length && !openHazards.length ? "—" : controlGap ? (ar ? "ناقص" : "Missing") : (ar ? "مستوفٍ" : "Met");
  const controlTone = !trackedReports.length && !openHazards.length ? "" : controlGap ? "warn" : "ok";

  const handlePatchIncident = (stationId, incidentId, patch) => {
    const saved = patchSafetyIncident(company.id, stationId, incidentId, patch, currentUser.name);
    toast({
      description: saved
        ? (patch.afterPhotoName
          ? (ar ? "أُغلق البلاغ بصورة بعد." : "The report was closed with an after photo.")
          : patch.escalate
            ? (ar ? "صُعّد البلاغ إلى مدير الفرع." : "The report was escalated to the branch manager.")
            : (ar ? "اعتُمد الإجراء على البلاغ." : "The action on the report was approved."))
        : (ar ? "تعذّر تحديث البلاغ." : "The report was not updated."),
      variant: saved ? "default" : "destructive",
    });
  };

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
        badge: level || (ar ? "حادث" : "Incident"),
        search: [i.description, card.code, card.where, card.categoryAr, card.categoryEn, i.anonymous ? "بلاغ بلا اسم" : i.by].filter(Boolean).join(" "),
      };
    });
    const hazards = ((rec?.hazardLog) || []).map((h, idx) => ({
      id: `${station.id}_haz_${h.id || h.closedAt || idx}`,
      date: h.closedAt || h.openedAt,
      title: station.name,
      text: h.description || "",
      badge: ar ? "خطر أُغلق" : "Hazard closed",
    }));
    return [...incidents, ...hazards];
  });

  const toolbarTabs = [
    { key: "dash", icon: LayoutDashboard, label: ar ? "لوحة السلامة" : "Safety board" },
    { key: "register", icon: ShieldAlert, label: ar ? "سجل المخاطر" : "Risk register" },
    { key: "permits", icon: FileSignature, label: ar ? "تصاريح العمل" : "Permits" },
    { key: "inspect", icon: ClipboardCheck, label: ar ? "التفتيش والجاهزية" : "Inspection" },
    { key: "incidents", icon: AlertTriangle, label: ar ? "الحوادث والإصابات" : "Incidents" },
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
  const myReports = (data.safety || [])
    .flatMap((rec) => (rec.incidentLog || []).filter((item) => incidentIsMine(item, currentUser)))
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  return (
    <PlatformStampShell
      ar={ar}
      kicker={pageKicker("/app/safety", lang)}
      title={employeeRail ? (ar ? "بلاغ سلامة" : "Safety report") : (ar ? "السلامة HSE" : "Safety HSE")}
      hint={employeeRail ? employeeHint : adminHint}
      maxWidth={1280}
      sections={employeeRail ? [] : toolbarTabs.map((tabItem) => ({
        value: tabItem.key,
        label: tabItem.label,
        icon: tabItem.icon,
        count: tabItem.key === "register" ? openReportRows.length : tabItem.key === "dash" ? openHazardCount + openReportRows.length : tabItem.key === "inspect" ? awaitingApprove : tabItem.key === "incidents" ? archiveItems.length : 0,
      }))}
      tool={tab}
      onTool={setTab}
      meta={employeeRail ? null : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={NEUTRAL}>{ar ? `${stations.length} فرع` : `${stations.length} stations`}</span>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.35)", background: "transparent", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            {ar ? "طباعة / حفظ PDF" : "Print / save PDF"}
          </button>
        </span>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {employeeRail && (
        <SafetyIncidentReportForm
          station={reportStation}
          ar={ar}
          reporter={reporter}
          reports={myReports}
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
                ? (ar ? `أُرسلت البطاقة${card.code ? ` ${card.code}` : ""} إلى مسؤول السلامة ومدير الفرع.` : `Card${card.code ? ` ${card.code}` : ""} was sent to the safety officer and the branch manager.`)
                : (ar ? "تعذّر حفظ البلاغ. إن كان الوصف نفسه قد سُجّل اليوم فلن يُكرَّر." : "The report was not saved. The same description already logged today is not repeated."),
              variant: saved ? "default" : "destructive",
            });
            return Boolean(saved);
          }}
        />
      )}

      {tab === "dash" && !employeeRail && (
        <SafetyDashboard ar={ar} stations={stations} recFor={recFor} onOpenRegister={() => setTab("register")} />
      )}
      {tab === "register" && !employeeRail && (
        <SafetyRiskRegister ar={ar} rows={openReportRows} canAct={canEdit || canApprove} onPatch={handlePatchIncident} />
      )}
      {tab === "permits" && !employeeRail && (
        <SafetyComplyBoard ar={ar} stations={stations} recFor={recFor} part="permits" />
      )}
      {tab === "inspect" && !employeeRail && (
        <>
          <SafetyComplyBoard ar={ar} stations={stations} recFor={recFor} part="inspect" />
          {levelApproval}
        </>
      )}
      {tab === "incidents" && !employeeRail && (
        <>
          <SafetyInjuryTable ar={ar} rows={reportRows} />
          <RecordSmartArchive
            items={archiveItems}
            lang={lang}
            dir={dir}
            emptyLabel={ar ? "لا حوادث أو مخاطر مغلقة في هذا النطاق." : "No closed incidents or hazards in this scope."}
          />
        </>
      )}
      {!employeeRail ? (
        <SafetyMinistryPanel ar={ar} criticalOpen={criticalOpen} controlLabel={controlLabel} controlTone={controlTone} injuryOpen={injuryOpen} />
      ) : null}
      </div>
    </PlatformStampShell>
  );
}
