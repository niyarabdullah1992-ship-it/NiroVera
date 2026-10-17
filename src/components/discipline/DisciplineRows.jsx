import React from "react";
import { SectionHead, slab } from "@/components/schedules/scheduleChrome";
import KindFrameCard from "@/components/requests/KindFrameCard";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";

const CHIP = {
  bad: { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "var(--nv-bad-line)" },
  warn: { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)", border: "var(--nv-warn-line)" },
};

/** The article a line stands on («م 66», «م 71», «م 91») — a quiet hairline badge, never a colour. */
export function ArticleBadge({ children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "var(--nv-ink2)", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", whiteSpace: "nowrap", flex: "none" }}>
      {children}
    </span>
  );
}

/** A status chip — only for something that needs attention (a window closing, a reply owed). */
export function AttentionChip({ tone = "warn", children }) {
  const c = CHIP[tone] || CHIP.warn;
  return (
    <span data-attention={tone} style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: c.color, background: c.background, border: `1px solid ${c.border}`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function openBtn(go, on) {
  return {
    fontFamily: "inherit",
    height: 32,
    padding: "0 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    border: go && !on ? "1px solid var(--nv-ok-fill, #3C7D50)" : "1px solid var(--nv-line)",
    background: go && !on ? "var(--nv-ok-fill, #3C7D50)" : "var(--nv-card)",
    color: go && !on ? "#fff" : "var(--nv-ink)",
  };
}

/**
 * «سطر لا بطاقة»: one line per sanction, grievance or objection — the article, the title and a muted
 * line, the date in mono, a chip only when it needs attention, and «افتح». `children` is what opens
 * under it (the record, the decision, the deadlines) when `open`.
 */
export function DisciplineRow({ id, badge, title, sub, date, chip, go = true, open = false, selected = false, onOpen, openLabel, closeLabel, ar = true, children, dataKey = "disc-line" }) {
  return (
    <li data-row-kind={dataKey} data-row-id={id} style={{ borderBottom: "1px solid var(--nv-line2, #EEF1EF)", background: selected ? "var(--nv-ok-soft)" : "transparent", boxShadow: selected ? "inset -3px 0 0 var(--nv-ok-fill, #3C7D50)" : "none" }}>
      <div className="nv-disc-line" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", flexWrap: "wrap" }}>
        {badge ? <ArticleBadge>{badge}</ArticleBadge> : null}
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 200px" }}>
          <strong style={{ fontSize: 13, color: "var(--nv-ink)", lineHeight: 1.5, overflowWrap: "anywhere" }}>{title}</strong>
          {sub ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6, overflowWrap: "anywhere" }}>{sub}</span> : null}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, marginInlineStart: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {chip || null}
          {date ? <span dir="ltr" style={{ fontFamily: MONO, fontSize: 12, color: "var(--nv-ink)", unicodeBidi: "isolate" }}>{date}</span> : null}
          {onOpen ? (
            <button type="button" data-row-open={id} aria-expanded={open} onClick={onOpen} style={openBtn(go, open)}>
              {open ? (closeLabel || (ar ? "أغلق" : "Close")) : (openLabel || (ar ? "افتح" : "Open"))}
            </button>
          ) : null}
        </span>
      </div>
      {open && children ? (
        <div data-row-detail={id} style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      ) : null}
    </li>
  );
}

/** The list body under a pill row: plain lines in one slab, or one empty sentence. */
export function DisciplineRowList({ children, empty, dataKey }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <section data-disc-list={dataKey || ""} style={{ ...slab, overflow: "hidden" }}>
      {rows.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{rows}</ul>
      ) : (
        <p style={{ margin: 0, padding: "14px 16px", fontSize: 12.5, color: "var(--nv-muted)", lineHeight: 1.8 }}>{empty}</p>
      )}
    </section>
  );
}

/**
 * «طلب جديد» / «إجراء جديد» — the طلباتي frame: one slab, the type tiles, then the picked type's form
 * below in the same frame.
 */
export function DisciplineNewFrame({ title, note, tiles = [], value, onPick, children, dataKey }) {
  return (
    <section data-disc-new={dataKey || ""} style={{ ...slab, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <SectionHead title={title} note={note} />
      <div className="nv-req-kind-grid" role="radiogroup" aria-label={typeof title === "string" ? title : undefined} style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)" }}>
        {tiles.map((tile) => (
          <KindFrameCard
            key={tile.id}
            dataKey={tile.id}
            on={value === tile.id}
            letter={tile.letter}
            title={tile.title}
            hint={tile.hint}
            onClick={() => onPick?.(tile.id)}
          />
        ))}
      </div>
      {children ? (
        <div style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>{children}</div>
      ) : null}
    </section>
  );
}
