import React, { useMemo } from "react";
import { SummaryLine, btnGhost, btnPrimary, btnQuiet, filterChip } from "@/components/hr/orgdesign/orgDesignUi";
import { mono } from "@/components/schedules/scheduleChrome";
import { orgStructureEvents } from "@/lib/orgStructureLog";

/**
 * Under the green hero: one calm summary line (numbers in ink) and the quiet links that jump to
 * the authority folds — escalation, permissions, grade ladder, event log, former files.
 * The page title, the lane and the pane switch live on the hero itself (OpsFrame).
 */
export default function OrgWorkforceHero({
  ar,
  data,
  health,
  onGoEsc,
  onGoPerm,
  onGoGrades,
  onGoLog,
  onGoFormer,
  formerCount = 0,
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

  const link = btnQuiet({ fontSize: 12 });
  const count = (n) => <span dir="ltr" style={{ ...mono, fontSize: 11, color: "var(--nv-muted)", marginInline: 5 }}>{n}</span>;

  return (
    <div className="nv-org-summary" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px 18px", flexWrap: "wrap", minWidth: 0 }}>
      <SummaryLine parts={summary} label={ar ? "ملخص الهيكل" : "Structure summary"} />
      <nav aria-label={ar ? "اختصارات الهيكل" : "Structure shortcuts"} style={{ display: "flex", gap: "4px 16px", flexWrap: "wrap", alignItems: "center" }}>
        {onGoEsc ? <button type="button" onClick={onGoEsc} style={link}>{ar ? "سلسلة التصعيد" : "Escalation"}</button> : null}
        {onGoPerm ? <button type="button" onClick={onGoPerm} style={link}>{ar ? "صلاحيات الإدارة" : "Permissions"}</button> : null}
        {onGoGrades ? <button type="button" onClick={onGoGrades} style={link}>{ar ? "سلّم الدرجات" : "Grade ladder"}</button> : null}
        {onGoLog ? <button type="button" onClick={onGoLog} style={link}>{ar ? "سجل الأحداث" : "Event log"}{count(logCount)}</button> : null}
        {onGoFormer ? <button type="button" onClick={onGoFormer} style={link}>{ar ? "ملفات من انتهت خدمتهم" : "Former files"}{count(formerCount)}</button> : null}
      </nav>
    </div>
  );
}

/**
 * Tools of the branches tree («الفروع والدليل») — search with inline hits, the HR unit, colour by
 * grade and «إضافة فرع». They sit on the tree's own strip, not on the page.
 */
export function OrgBranchTools({
  ar,
  query = "",
  onQueryChange,
  searchHits = [],
  onPickHit,
  renderHit,
  onFocusHr,
  onToggleByGrade,
  byGrade = false,
  onAddBranch,
}) {
  const hasHits = Boolean(query.trim() && searchHits?.length);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
      <input
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
        placeholder={ar ? "ابحث باسم موظف أو وظيفة أو فرع" : "Search name, seat, or branch"}
        className="nv-od-input"
        aria-label={ar ? "بحث في الشجرة" : "Search the tree"}
        style={{ flex: "1 1 220px", maxWidth: 340 }}
      />
      {hasHits ? searchHits.map((hit) => (
        <button key={hit.id || hit.stationId || hit.name} type="button" onClick={() => onPickHit?.(hit)} style={filterChip(false)}>
          {renderHit ? renderHit(hit) : (hit.label || hit.name)}
        </button>
      )) : null}
      {onFocusHr ? <button type="button" onClick={onFocusHr} style={btnGhost()}>{ar ? "وحدة الموارد البشرية" : "HR unit"}</button> : null}
      {onToggleByGrade ? (
        <button type="button" onClick={onToggleByGrade} aria-pressed={byGrade} style={filterChip(byGrade, { height: 32, padding: "0 12px", fontSize: 12 })}>{ar ? "لوّن حسب الدرجة" : "Colour by grade"}</button>
      ) : null}
      {onAddBranch ? (
        <button type="button" onClick={onAddBranch} style={{ ...btnPrimary(), marginInlineStart: "auto" }}>{ar ? "＋ إضافة فرع" : "+ Add branch"}</button>
      ) : null}
    </div>
  );
}
