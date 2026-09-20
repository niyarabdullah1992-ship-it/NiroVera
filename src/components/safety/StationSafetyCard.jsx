
import React, { useContext, useState } from "react";
import { LayoutDashboard, Grid3X3, Gauge, ClipboardCheck, FileSignature, ChevronDown, Shield } from "lucide-react";
import { identityIconWrap } from "@/components/shared/IdentityCard";
import { StampNestContext } from "@/components/shared/stampNestContext";
import SafetyOverviewTab from "@/components/safety/SafetyOverviewTab";
import RiskAssessmentTab from "@/components/safety/RiskAssessmentTab";
import SafetyKpiTab from "@/components/safety/SafetyKpiTab";
import SafetyChecklistTab from "@/components/safety/SafetyChecklistTab";
import PermitWorkTab from "@/components/safety/PermitWorkTab";
import SafetyTabsSettings from "@/components/safety/SafetyTabsSettings";
import { checklistCompliance } from "@/lib/safetyStandards";
import { safetyLevelMeta } from "@/lib/safetyLogic";
import { ACCENT, BORDER, MUTED, NAVY, NAVY_FILL, SURFACE, NEUTRAL, CARD } from "@/lib/platformStyles";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

export default function StationSafetyCard({ station, rec, canEdit, canApprove, canCustomize, approvalIssues = [], lang, signerName, onUpdate, onDisabledTabsChange, onCloseHazard, onApprove, onRevokeApproval, onIncident, defaultExpanded = false, layer = "full" }) {
  const nested = useContext(StampNestContext);
  const layered = layer !== "full";
  const [tab, setTab] = useState(layer === "comply" ? "checklist" : "overview");
  const [expanded, setExpanded] = useState(!!defaultExpanded || layered);
  const ar = lang === "ar";
  const complyTabs = [
    ["checklist", ClipboardCheck, ar ? "قوائم التحقق" : "Checklists"],
    ["risks", Grid3X3, ar ? "تقييم المخاطر" : "Risk Matrix"],
    ["permits", FileSignature, ar ? "تصاريح العمل" : "Permits"],
    ["kpis", Gauge, "KPIs"],
  ];
  const tabs = layer === "comply"
    ? complyTabs
    : [
        ["overview", LayoutDashboard, ar ? "نظرة عامة" : "Overview"],
        ...complyTabs,
      ];
  const disabledTabs = Array.isArray(rec?.disabledTabs) ? rec.disabledTabs.filter((key) => key !== "overview") : [];
  const visibleTabs = tabs.filter(([key]) => !disabledTabs.includes(key));
  const shared = { rec: rec || {}, canEdit, lang, onUpdate };
  const changeDisabledTabs = (next) => {
    if (next.includes(tab)) setTab("overview");
    onDisabledTabsChange(next);
  };
  const compliance = checklistCompliance(rec?.checklistResults || {});
  const levelTone = safetyLevelMeta(rec?.level, ar);

  return (
    <section
      {...(nested ? {} : { "data-nv": "identity" })}
      style={nested
        ? { display: "flex", flexDirection: "column" }
        : {
            display: "flex",
            flexDirection: "column",
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            background: CARD,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(20,40,75,.06)",
          }}
      dir={ar ? "rtl" : "ltr"}
    >
      {nested ? null : <div aria-hidden style={{ height: 3, background: NAVY_FILL }} />}
      <div
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: nested ? "4px 0 10px" : "14px 16px",
          borderBottom: expanded ? `1px solid ${BORDER}` : "none",
          background: nested ? "transparent" : CARD,
        }}
      >
        <button
          type="button"
          onClick={layered ? undefined : () => setExpanded((value) => !value)}
          aria-expanded={layered ? true : expanded}
          style={{
            display: "flex",
            minWidth: 0,
            flex: 1,
            alignItems: "center",
            gap: 10,
            textAlign: "start",
            background: "none",
            border: "none",
            padding: 0,
            cursor: layered ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          <span style={identityIconWrap}>
            <Shield style={{ width: 18, height: 18 }} strokeWidth={1.75} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {station.name}
            </span>
            {rec?.lastActionBy && (
              <span style={{ display: "block", fontSize: 10, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ar ? "آخر إجراء" : "Last action"}: {rec.lastActionBy}
              </span>
            )}
          </span>
        </button>
        <span style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 6 }}>
          <span
            style={{
              borderRadius: 8,
              background: levelTone.soft,
              color: levelTone.fg,
              border: `1px solid ${levelTone.border}`,
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {levelTone.label}
          </span>
          <span style={{ ...NEUTRAL, borderRadius: 8 }}>{compliance}%</span>
          {canCustomize && layer !== "work" && layer !== "approve" && <SafetyTabsSettings tabs={tabs} disabledTabs={disabledTabs} ar={ar} onChange={changeDisabledTabs} />}
          {!layered && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? (ar ? "طي البطاقة" : "Collapse card") : (ar ? "فتح البطاقة" : "Expand card")}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              border: "1px solid #E2E8F0",
              background: SURFACE,
              color: MUTED,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronDown style={{ width: 16, height: 16, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          )}
        </span>
      </div>

      {(layered || expanded) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, background: nested ? "transparent" : SURFACE, padding: nested ? 0 : 14 }}>
          {(layer === "comply" || layer === "full") && (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <LaborArticleCite ruleId="safety.hygiene.cite" ar={ar} showText />
              <LaborArticleCite ruleId="safety.precautions.cite" ar={ar} showText />
              <LaborArticleCite ruleId="safety.inform.cite" ar={ar} showText />
            </div>
          )}
          {(layer === "comply" || layer === "full") && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {visibleTabs.map(([key, Icon, label]) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  style={{
                    display: "inline-flex",
                    flexShrink: 0,
                    alignItems: "center",
                    gap: 5,
                    borderRadius: 9,
                    border: active
                      ? `1px solid color-mix(in oklab, ${ACCENT} 40%, #fff)`
                      : "1px solid #E2E8F0",
                    background: active ? "color-mix(in oklab, #1E9E63 10%, #fff)" : CARD,
                    boxShadow: active ? `inset 3px 0 0 ${ACCENT}` : "none",
                    color: active ? NAVY : MUTED,
                    padding: "6px 11px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon style={{ width: 12, height: 12, color: active ? ACCENT : MUTED }} strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </div>
          )}
          <div
            style={{
              borderRadius: 12,
              border: layer === "work" || layer === "approve" ? "none" : `1px solid ${BORDER}`,
              background: layer === "work" || layer === "approve" ? "transparent" : CARD,
              padding: layer === "work" || layer === "approve" ? 0 : 14,
              overflow: "hidden",
            }}
          >
            {(layer === "work" || layer === "approve" || tab === "overview") && (
              <SafetyOverviewTab
                station={station}
                {...shared}
                canApprove={canApprove}
                approvalIssues={approvalIssues}
                onCloseHazard={onCloseHazard}
                onApprove={onApprove}
                onRevokeApproval={onRevokeApproval}
                onIncident={onIncident}
                pane={layer === "work" ? "work" : layer === "approve" ? "status" : "all"}
              />
            )}
            {(layer === "full" || layer === "comply") && tab === "risks" && <RiskAssessmentTab items={rec?.riskItems || []} canEdit={canEdit} lang={lang} onChange={(riskItems) => onUpdate({ riskItems })} />}
            {(layer === "full" || layer === "comply") && tab === "kpis" && <SafetyKpiTab {...shared} />}
            {(layer === "full" || layer === "comply") && tab === "checklist" && <SafetyChecklistTab results={rec?.checklistResults || {}} canEdit={canEdit} lang={lang} onChange={(checklistResults) => onUpdate({ checklistResults })} />}
            {(layer === "full" || layer === "comply") && tab === "permits" && <PermitWorkTab permits={rec?.permits || []} canEdit={canEdit} lang={lang} signerName={signerName} onChange={(permits) => onUpdate({ permits })} />}
          </div>
        </div>
      )}
    </section>
  );
}
