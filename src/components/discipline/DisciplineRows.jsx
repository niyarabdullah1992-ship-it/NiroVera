import React from "react";
import { SectionHead, slab } from "@/components/schedules/scheduleChrome";
import KindFrameCard from "@/components/requests/KindFrameCard";
import CollapsibleItemCard from "@/components/shared/CollapsibleItemCard";

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
 * One sanction, grievance or objection — its own card under the list header card, folded to one row:
 * the article badge, the title, the date in mono, a chip only when it needs attention, a chevron.
 * `children` (the record, the decision, the deadlines) unfold under it; the muted line opens first.
 * A row with no `children` is an action line: its button runs `onOpen` (e.g. «اعترض»).
 */
export function DisciplineRow({ id, badge, title, sub, date, chip, go = true, open = false, selected = false, onOpen, openLabel, closeLabel, ar = true, children, dataKey = "disc-line" }) {
  if (children) {
    return (
      <li data-row-kind={dataKey} data-row-id={id} style={{ listStyle: "none", minWidth: 0 }}>
        <CollapsibleItemCard
          data-row-open={id}
          open={open}
          onToggle={() => onOpen?.()}
          focus={selected}
          title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{badge ? <ArticleBadge>{badge}</ArticleBadge> : null}<span>{title}</span></span>}
          date={date}
          status={chip || null}
          ar={ar}
        >
          {sub ? <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.7, overflowWrap: "anywhere" }}>{sub}</span> : null}
          {children}
        </CollapsibleItemCard>
      </li>
    );
  }
  return (
    <li data-row-kind={dataKey} data-row-id={id} className="nv-cic" style={{ listStyle: "none", background: selected ? "var(--nv-ok-soft)" : undefined }}>
      <div className="nv-disc-line" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", flexWrap: "wrap" }}>
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
    </li>
  );
}

/** The items under a list header card: each row its own card with a gap, or one empty sentence. */
export function DisciplineRowList({ children, empty, dataKey }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <section data-disc-list={dataKey || ""} style={{ minWidth: 0 }}>
      {rows.length ? (
        <ul className="nv-list-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>{rows}</ul>
      ) : (
        <p className="nv-cic" style={{ margin: 0, padding: "14px 16px", fontSize: 12.5, color: "var(--nv-muted)", lineHeight: 1.8 }}>{empty}</p>
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
