import React, { useMemo } from "react";
import Nv7SectionHead from "@/components/shared/Nv7SectionHead";
import {
  ORG_MONO,
  orgChip,
  orgNavChip,
  orgPrimaryBtn,
  orgStack,
} from "@/components/hr/orgUi";
import { orgStructureEvents } from "@/lib/orgStructureLog";

/**
 * HTML workforce hero — kicker, seat-vs-person title, derived stats,
 * search + inline hit pills + nav chips + legend in one paper.
 */
export default function OrgWorkforceHero({
  ar,
  data,
  health,
  canWrite = false,
  isAdminView = true,
  query = "",
  onQueryChange,
  searchHits = [],
  onPickHit,
  renderHit,
  onTrunk,
  onFocusHr,
  onToggleFull,
  fullActive = false,
  onAddBranch,
  onPrint,
  onGoEsc,
  onGoPerm,
  onGoGrades,
  onToggleByGrade,
  byGrade = false,
  onGoLog,
}) {
  const logCount = useMemo(() => orgStructureEvents(data).length, [data]);

  const stats = [
    { id: "branches", label: ar ? "الفروع" : "Branches", value: health?.branches ?? 0 },
    { id: "seats", label: ar ? "وظائف معتمدة" : "Approved seats", value: health?.seats ?? 0 },
    {
      id: "vacant",
      label: ar ? "شاغرة" : "Vacant",
      value: health?.vacantSeats ?? health?.vacant ?? 0,
      tone: (health?.vacantSeats ?? health?.vacant ?? 0) > 0 ? "warn" : undefined,
    },
    {
      id: "acting",
      label: ar ? "تكليفات سارية" : "Acting now",
      value: health?.acting ?? 0,
      tone: (health?.acting ?? 0) > 0 ? "ok" : undefined,
    },
  ];

  const hasHits = Boolean(query.trim() && searchHits?.length);
  const kpiTone = { warn: "#C8A45A", ok: "#3C7D50" };

  return (
    <div style={{ ...orgStack, gap: 12 }} className="nv-org-hero">
      <Nv7SectionHead
        kicker={ar ? "05 · القوى العاملة" : "05 · Workforce"}
        title={ar ? "الهيكل التنظيمي" : "Org structure"}
        hint={ar
          ? "الوظيفة ثابتة، والشخص يتغيّر. الرقم على البطاقة «مباشرون / إجمالي» يفتح الأغصان، والاسم يجعلها طرف السلسلة. الملفات والعقود في الموارد البشرية."
          : "The seat stays and the person changes. The card count opens the branches; the name ends the chain."}
      />

      {!isAdminView ? (
        <div style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          background: "var(--nv-card)",
          border: "1px solid var(--nv-line)",
          borderRadius: 8,
          padding: "11px 16px",
          fontSize: 12.5,
          color: "var(--nv-ink2)",
          lineHeight: 1.8,
        }}
        >
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--nv-warn-fill)", flex: "none", marginTop: 7 }} />
          <span>
            {ar
              ? "هيكل الشركة للاطلاع فقط: ترى موقعك ومديرك وزملاءك ومن يعلوك حتى الرئيس التنفيذي. التوظيف والتكليف والصلاحيات لدى الإدارة."
              : "Read-only company structure: your place, your manager, and the chain above you. Hiring and access stay with management."}
          </span>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {stats.map((stat) => (
              <div key={stat.id} style={{ position: "relative", overflow: "hidden", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 8, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
                <span aria-hidden style={{ position: "absolute", top: 0, insetInline: 0, height: 3, background: kpiTone[stat.tone] || "var(--nv-navy)" }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--nv-muted)" }}>{stat.label}</span>
                <strong dir="ltr" style={{ ...ORG_MONO, fontSize: 18, fontWeight: 700, color: "var(--nv-ink)" }}>{stat.value}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={query}
              onChange={(event) => onQueryChange?.(event.target.value)}
              placeholder={ar ? "⌕ ابحث باسم موظف أو وظيفة أو فرع" : "⌕ Search name, seat, or branch"}
              className="nv-org-hero__search"
              aria-label={ar ? "بحث" : "Search"}
              style={{ flex: "1 1 220px", maxWidth: 340, height: 32, borderRadius: 8 }}
            />
            {hasHits ? searchHits.map((hit) => (
              <button
                key={hit.id || hit.stationId || hit.name}
                type="button"
                onClick={() => onPickHit?.(hit)}
                style={orgNavChip()}
              >
                {renderHit ? renderHit(hit) : (hit.label || hit.name)}
              </button>
            )) : null}
            {onFocusHr ? (
              <button type="button" onClick={onFocusHr} style={orgNavChip()}>{ar ? "وحدة الموارد البشرية" : "HR unit"}</button>
            ) : null}
            <button type="button" onClick={onGoEsc} style={orgNavChip()}>{ar ? "سلسلة التصعيد" : "Escalation"}</button>
            <button type="button" onClick={onGoPerm} style={orgNavChip()}>{ar ? "الصلاحيات" : "Permissions"}</button>
            {onGoGrades ? <button type="button" onClick={onGoGrades} style={orgNavChip()}>{ar ? "سلّم الدرجات" : "Grade ladder"}</button> : null}
            {onToggleByGrade ? (
              <button type="button" onClick={onToggleByGrade} style={orgChip(byGrade)}>{ar ? "لوّن حسب الدرجة" : "Color by grade"}</button>
            ) : null}
            <button type="button" onClick={onGoLog} style={orgNavChip()}>
              {ar ? "سجل الأحداث" : "Event log"} <span dir="ltr" style={ORG_MONO}>{logCount}</span>
            </button>
            {onAddBranch ? (
              <button type="button" onClick={onAddBranch} style={orgPrimaryBtn()}>{ar ? "＋ إضافة فرع" : "+ Add branch"}</button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
