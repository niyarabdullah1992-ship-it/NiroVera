import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, BarChart3, AlertTriangle, BadgeCheck, ListChecks } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations, canApproveReports } from "@/lib/permissions";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { updateSafetyRecord, recordSafetyIncident, closeSafetyHazard, approveSafetyRecord, revokeSafetyApproval } from "@/lib/safetyStore";
import { safetyApprovalIssues } from "@/lib/safetyLogic";
import StationSafetyCard from "@/components/safety/StationSafetyCard";
import SafetyStationStrip from "@/components/safety/SafetyStationStrip";
import SafetyIncidentReportForm from "@/components/safety/SafetyIncidentReportForm";
import HseRatesPanel from "@/components/safety/HseRatesPanel";
import HseInsightBoard from "@/components/safety/HseInsightBoard";
import { toast } from "@/components/ui/use-toast";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import { MUTED, NEUTRAL } from "@/lib/platformStyles";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import KpiStrip from "@/components/shared/KpiStrip";
import { pageKicker } from "@/lib/moduleMeta";

const LAYERS = new Set(["work", "comply", "approve", "analytics", "archive"]);

export default function Safety() {
  const { lang, dir } = useI18n();
  const { data, currentUser, company } = useAuth();
  const ar = lang === "ar";
  const [searchParams, setSearchParams] = useSearchParams();
  const headerScope = useStationScope();
  const requested = searchParams.get("tab");
  const tab = LAYERS.has(requested) ? requested : requested === "manage" ? "work" : "work";
  const [stationId, setStationId] = useState(searchParams.get("station") || "");

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "work") next.delete("tab");
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
  const canEdit = ["director", "ops_manager", "pgm", "station_manager"].includes(currentUser.role) || isSafetyOfficer || data.ownerId === currentUser.id;
  const canCustomize = ["director", "ops_manager", "station_manager"].includes(currentUser.role) || isSafetyOfficer || data.ownerId === currentUser.id;
  const canApprove = canApproveReports(currentUser) || isSafetyOfficer || data.ownerId === currentUser.id;
  const canSeeAnalytics = canEdit || canApprove || data.ownerId === currentUser.id;
  const reportStation = (data.stations || []).find((station) => station.id === currentUser.stationId);
  const recFor = (sid) =>
    scopedSafety.find((s) => String(s.stationId) === String(sid))
    || (data.safety || []).find((s) => String(s.stationId) === String(sid))
    || null;

  const selectedStation = stations.find((station) => station.id === selectedId) || null;
  const openHazardCount = scopedSafety.reduce((n, r) => n + (r.hazards || []).filter((h) => !h?.closedAt).length, 0);
  const awaitingApprove = stations.filter((station) => !recFor(station.id)?.approvedBy).length;

  const hints = {
    work: ar ? "افتح الخطر إن كان قائمًا، أو سجّل الحادث إن كان قد وقع." : "Open a hazard if it is still present, or log an incident if it already happened.",
    comply: ar ? "قوائم التحقق وتقييم المخاطر والتصاريح قبل الاعتماد." : "Checklists, risk assessment and permits before approval.",
    approve: ar ? "حدّد المستوى بعد التفتيش. لا تعتمد «آمنة» مع مخاطر مفتوحة." : "Set the level after inspection. Do not approve Safe with open hazards.",
    analytics: ar ? "المعدّلات والهرم عبر النطاق الحالي." : "Rates and pyramid for the current scope.",
    archive: ar ? "حوادث ومخاطر مغلقة في هذا النطاق." : "Closed incidents and hazards in this scope.",
  };

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

  const archiveItems = stations.flatMap((station) => {
    const rec = recFor(station.id);
    const incidents = ((rec?.incidentLog) || []).map((i, idx) => ({
      id: `${station.id}_inc_${i.at || idx}`,
      date: i.at || i.reviewedAt,
      title: station.name,
      text: i.description || "",
      badge: ar ? "حادث" : "Incident",
    }));
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
    { key: "work", icon: AlertTriangle, label: ar ? "العمل" : "Work" },
    { key: "comply", icon: ListChecks, label: ar ? "الامتثال" : "Compliance" },
    { key: "approve", icon: BadgeCheck, label: ar ? "الاعتماد" : "Approval" },
    ...(canSeeAnalytics ? [{ key: "analytics", icon: BarChart3, label: ar ? "المؤشرات" : "Rates" }] : []),
    { key: "archive", icon: Archive, label: ar ? "الأرشيف" : "Archive" },
  ];

  const stationWorkspace = (layer) => {
    if (!selectedStation) {
      return (
        <p style={{ margin: "24px 0", textAlign: "center", fontSize: 13, color: MUTED }}>
          {headerScope !== "all"
            ? (ar ? "لا فرع في هذا النطاق — اختر فرعًا من نطاق الهيدر." : "No station in this scope — pick one from header scope.")
            : (ar ? "لا فروع بعد — أضف فرعًا أولًا." : "No stations yet — add a station first.")}
        </p>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {stations.length > 1 && (
          <SafetyStationStrip stations={stations} recFor={recFor} selectedId={selectedId} onSelect={setStationId} ar={ar} />
        )}
        <StationSafetyCard
          key={`${selectedStation.id}-${layer}`}
          station={selectedStation}
          rec={recFor(selectedStation.id)}
          canEdit={canEdit}
          canApprove={canApprove}
          canCustomize={canCustomize && layer === "comply"}
          approvalIssues={safetyApprovalIssues(recFor(selectedStation.id), ar)}
          lang={lang}
          signerName={currentUser.name}
          layer={layer}
          onUpdate={(updates) => handleUpdate(selectedStation.id, updates)}
          onDisabledTabsChange={(disabledTabs) => updateSafetyRecord(company.id, selectedStation.id, { disabledTabs }, currentUser.name)}
          onCloseHazard={(index, opts) => handleCloseHazard(selectedStation.id, index, opts)}
          onApprove={() => handleApprove(selectedStation.id)}
          onRevokeApproval={() => handleRevokeApproval(selectedStation.id)}
          onIncident={(desc) => handleIncident(selectedStation.id, desc)}
        />
      </div>
    );
  };

  return (
    <PlatformStampShell
      ar={ar}
      kicker={pageKicker("/app/safety", lang)}
      title={ar ? "السلامة HSE" : "Safety HSE"}
      hint={hints[tab]}
      maxWidth={1280}
      sections={toolbarTabs.map((tabItem) => ({
        value: tabItem.key,
        label: tabItem.label,
        icon: tabItem.icon,
        count: tabItem.key === "approve" ? awaitingApprove : tabItem.key === "work" ? openHazardCount : tabItem.key === "archive" ? archiveItems.length : 0,
      }))}
      tool={tab}
      onTool={setTab}
      meta={(
        <>
          <span style={NEUTRAL}>{ar ? `${stations.length} فرع` : `${stations.length} stations`}</span>
        </>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <KpiStrip
        stats={[
          { label: ar ? "مخاطر مفتوحة" : "Open hazards", value: openHazardCount, tone: openHazardCount > 0 ? "warn" : "ok" },
          { label: ar ? "بانتظار الاعتماد" : "Awaiting approve", value: awaitingApprove, tone: awaitingApprove > 0 ? "warn" : null },
        ]}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!canEdit && reportStation && tab === "work" && (
        <SafetyIncidentReportForm
          station={reportStation}
          ar={ar}
          onSubmit={async (description) => {
            const saved = recordSafetyIncident(company.id, reportStation.id, description, currentUser.name);
            toast({
              description: saved
                ? (ar ? "تم إرسال بلاغ السلامة." : "Safety report submitted.")
                : (ar ? "تم تسجيل البلاغ نفسه اليوم مسبقًا." : "This report was already submitted today."),
              variant: saved ? "default" : "destructive",
            });
            return saved;
          }}
        />
      )}

      {tab === "work" && stationWorkspace("work")}
      {tab === "comply" && stationWorkspace("comply")}
      {tab === "approve" && stationWorkspace("approve")}

      {tab === "analytics" && canSeeAnalytics && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <HseRatesPanel lang={lang} stationScope={headerScope} />
          <HseInsightBoard lang={lang} stationScope={headerScope} />
        </div>
      )}

      {tab === "archive" && (
        <RecordSmartArchive
          items={archiveItems}
          lang={lang}
          dir={dir}
          emptyLabel={ar ? "لا حوادث أو مخاطر مغلقة في هذا النطاق." : "No closed incidents or hazards in this scope."}
        />
      )}
      </div>
      </div>
    </PlatformStampShell>
  );
}
