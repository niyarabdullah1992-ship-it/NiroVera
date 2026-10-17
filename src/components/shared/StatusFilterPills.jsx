import React from "react";

/**
 * The status filter row of طلباتي («الكل · بانتظار · معتمدة · مرفوضة · الأرشيف»), shared so every
 * list section filters the same way: a list title, then pill buttons with a mono count. The active
 * pill is the one green fill; the rest are white with a hairline.
 *
 * Optional, all backward-compatible:
 *   trailing  — a node at the end of the title row (a create button, a density switch, a sort).
 *   children  — a node under the pills inside the same header (a search box).
 *   size      — "md" (default, 30px) or "sm" (26px) for pills inside a denser board.
 *   hideZero  — hides pills whose count is 0, except «الكل», «الأرشيف» and the active pill.
 *   bare      — the pills row alone, without the header chrome (for a slot inside another head).
 */
export function statusPillStyle(on, size = "md") {
  const sm = size === "sm";
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: sm ? 26 : 30,
    padding: sm ? "0 10px" : "0 12px",
    borderRadius: 999,
    border: on ? "none" : "1px solid var(--nv-pill-line, #D5DCD8)",
    background: on ? "#3C7D50" : "var(--nv-card, #fff)",
    color: on ? "#fff" : "var(--nv-ink2, #3A4048)",
    fontSize: sm ? 11.5 : 12,
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

const KEEP_IDS = new Set(["all", "archive"]);

export default function StatusFilterPills({
  title,
  items = [],
  value,
  onChange,
  note,
  dataKey,
  trailing = null,
  children = null,
  size = "md",
  hideZero = false,
  bare = false,
}) {
  const shown = hideZero
    ? items.filter((item) => KEEP_IDS.has(item.id) || item.id === value || Number(item.n) > 0)
    : items;
  const pills = (
    <div className="nv-req-inbox-pills" role="tablist" data-status-pills={bare ? (dataKey || "") : undefined}>
      {shown.map((item) => {
        const on = value === item.id;
        return (
          <button key={item.id} type="button" role="tab" data-pill={item.id} aria-selected={on} aria-pressed={on} onClick={() => onChange?.(item.id)} style={statusPillStyle(on, size)}>
            {item.label}
            {item.n == null ? null : (
              <span dir="ltr" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, background: on ? "rgba(255,255,255,.22)" : "var(--nv-ok-soft, #E6F2EA)", color: on ? "#fff" : "var(--nv-ok-ink, #2F6B43)", borderRadius: 999, padding: "0 6px", minWidth: 18, textAlign: "center", unicodeBidi: "isolate" }}>{item.n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
  if (bare) return pills;
  return (
    <header className="nv-req-inbox-head is-mine" data-status-pills={dataKey || undefined}>
      {title || trailing ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          {title ? (
            <h2>
              <span aria-hidden />
              {title}
            </h2>
          ) : <span />}
          {note || trailing ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
              {note ? <span className="nv-req-inbox-meta">{note}</span> : null}
              {trailing}
            </span>
          ) : null}
        </div>
      ) : null}
      {shown.length ? pills : null}
      {children}
    </header>
  );
}
