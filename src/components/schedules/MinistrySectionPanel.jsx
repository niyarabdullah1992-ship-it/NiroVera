import React, { useMemo, useState } from "react";
import { mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, { Counter, ministryBadgeStyle, MinistryRow, RegsSourceLine } from "@/components/schedules/MinistrySourceCards";
import RightHint from "@/components/shared/RightHint";
import useHashScroll from "@/hooks/useHashScroll";
import { buildMinistrySection } from "@/lib/ministrySections";

/**
 * «أنظمة الوزارة — ما يخص <القسم>» — the one frame every section renders: head with its totals,
 * one source card per instrument (click filters), group bands, one row per rule with its status and
 * the ⚖ hint. The rows are built by lib/ministrySections from the section's own rows lib; this
 * component lays them out and judges nothing.
 *
 * Either pass `section` (a buildMinistrySection result) or `sectionKey` + `lane` + `inputs`.
 */
function Num({ children }) {
  return <span dir="ltr" style={mono}>{children}</span>;
}

/** «7 قواعد» · «11 قاعدة» · «قاعدتان». */
function rulesWord(n) {
  if (n === 1) return "قاعدة واحدة";
  if (n === 2) return "قاعدتان";
  const last = n % 100;
  return last >= 3 && last <= 10 ? "قواعد" : "قاعدة";
}

export function MinistryCounters({ totals, ar = true, size }) {
  return (
    <>
      <Counter value={totals.alert} label={ar ? "تنبيه" : "alert"} tone="warn" size={size} />
      <Counter value={totals.met} label={ar ? "مستوفٍ" : "met"} tone="ok" size={size} />
      <Counter value={totals.info} label={ar ? "للعلم" : "reference"} tone="mute" size={size} />
    </>
  );
}

export default function MinistrySectionPanel({ section: given, sectionKey, lane = "employee", inputs = {}, ar = true, today, id }) {
  const [source, setSource] = useState("all");
  const section = useMemo(
    () => given || buildMinistrySection(sectionKey, { lane, ar, today, ...inputs }),
    [given, sectionKey, lane, ar, today, inputs],
  );
  const anchor = id || section.anchor || `nv-ministry-${section.key}`;
  useHashScroll(anchor);
  const { cards, rows, totals } = section;
  if (!rows.length) return null;

  const shown = cards.map((card) => ({
    ...card,
    counters: <MinistryCounters totals={card.counts} ar={ar} />,
  }));
  const groups = shown
    .filter((card) => source === "all" || source === card.key)
    .map((card) => ({ card, rows: rows.filter((row) => row.source === card.key) }));
  const citesRegs = cards.some((card) => card.key === "regs" || card.key === "model");
  const n = rows.length;

  return (
    <section
      id={anchor}
      data-ministry-section={section.key}
      data-lane={section.lane}
      style={{ ...slab, display: "flex", flexDirection: "column", scrollMarginTop: 88 }}
    >
      <SectionHead
        title={section.title}
        note={ar
          ? <>قراءة فقط · <Num>{n}</Num> {rulesWord(n)}، وكل سطر يقول هل تستوفيها المنصة الآن.</>
          : <>Read only · <Num>{n}</Num> rule{n === 1 ? "" : "s"}; each row says whether the platform meets it now.</>}
        trailing={<div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}><MinistryCounters totals={totals} ar={ar} /></div>}
      />
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <MinistrySourceCards cards={shown} active={source} onPick={setSource} ar={ar} />
      </div>
      {groups.map(({ card, rows: list }) => (
        <div key={card.key} data-ministry-group={card.key} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
            <span style={ministryBadgeStyle("", ar, /[؀-ۿ]/.test(card.badge) ? { fontFamily: "inherit", direction: "rtl" } : {})}>{card.badge}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5, flex: "1 1 180px", minWidth: 0 }}>{card.title}</span>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}><Num>{list.length}</Num> {ar ? "في المجموع" : "in all"}</span>
          </div>
          {list.map((row) => (
            <MinistryRow
              key={row.key}
              rowKey={row.key}
              source={row.source}
              badge={row.badge}
              status={row.status}
              pill={row.pill}
              title={row.title}
              sub={row.sub || row.hint ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {row.sub ? <span>{row.sub}</span> : null}
                  {row.hint ? <RightHint ar={ar} onDate={today} hint={row.hint} /> : null}
                </span>
              ) : undefined}
              ar={ar}
            />
          ))}
        </div>
      ))}
      {citesRegs ? <RegsSourceLine ar={ar} /> : null}
    </section>
  );
}
