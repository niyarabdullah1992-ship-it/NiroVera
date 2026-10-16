import React, { useMemo } from "react";
import Nv7SectionHead from "@/components/shared/Nv7SectionHead";
import { SummaryLine } from "@/components/hr/orgdesign/orgDesignUi";
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
  onGoFormer,
  formerCount = 0,
  showTools = true,
  showSearch = true,
}) {
  const logCount = useMemo(() => orgStructureEvents(data).length, [data]);

  const vacant = health?.vacantSeats ?? health?.vacant ?? 0;
  // One calm line, numbers in ink — no stat row (owner preference).
  const summary = ar
    ? [
      { key: "branches", value: health?.branches ?? 0, label: "فروع" },
      { key: "seats", value: health?.seats ?? 0, label: "وظيفة معتمدة" },
      { key: "vacant", before: "منها", value: vacant, label: "شاغرة" },
      { key: "acting", value: health?.acting ?? 0, label: "تكليف ساري" },
      { key: "former", value: formerCount, label: "ملف منتهٍ" },
    ]
    : [
      { key: "branches", value: health?.branches ?? 0, label: "branches" },
      { key: "seats", value: health?.seats ?? 0, label: "approved seats" },
      { key: "vacant", value: vacant, label: "vacant" },
      { key: "acting", value: health?.acting ?? 0, label: "acting now" },
      { key: "former", value: formerCount, label: "former files" },
    ];

  const hasHits = Boolean(query.trim() && searchHits?.length);

  return (
    <div style={{ ...orgStack, gap: 12 }} className="nv-org-hero">
      <Nv7SectionHead
        kicker={ar ? "05 · القوى العاملة" : "05 · Workforce"}
        title={ar ? "الهيكل التنظيمي" : "Org structure"}
        hint={ar
          ? "الوظيفة ثابتة، والشخص يتغيّر. منه تُشتق التبعية والصلاحيات ومسار الاعتماد والتصعيد. الملفات والعقود في الموارد البشرية."
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
          <SummaryLine parts={summary} label={ar ? "ملخص الهيكل" : "Structure summary"} />
          {showTools ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {showSearch ? (
            <input
              value={query}
              onChange={(event) => onQueryChange?.(event.target.value)}
              placeholder={ar ? "⌕ ابحث باسم موظف أو وظيفة أو فرع" : "⌕ Search name, seat, or branch"}
              className="nv-org-hero__search"
              aria-label={ar ? "بحث" : "Search"}
              style={{ flex: "1 1 220px", maxWidth: 340, height: 32, borderRadius: 8 }}
            />
            ) : null}
            {showSearch && hasHits ? searchHits.map((hit) => (
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
            {onGoFormer ? (
              <button type="button" onClick={onGoFormer} style={orgNavChip()}>
                {ar ? "ملفات من انتهت خدمتهم" : "Former worker files"}{" "}
                <span dir="ltr" style={ORG_MONO}>{formerCount}</span>
              </button>
            ) : null}
            {onAddBranch ? (
              <button type="button" onClick={onAddBranch} style={orgPrimaryBtn()}>{ar ? "＋ إضافة فرع" : "+ Add branch"}</button>
            ) : null}
          </div>
          ) : null}
        </>
      )}
    </div>
  );
}
