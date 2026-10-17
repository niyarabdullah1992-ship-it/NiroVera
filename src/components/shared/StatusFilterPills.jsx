import React from "react";

/**
 * The status filter row of طلباتي («الكل · بانتظار · معتمدة · مرفوضة · الأرشيف»), shared so every
 * list section filters the same way: a list title, then pill buttons with a mono count. The active
 * pill is the one green fill; the rest are white with a hairline.
 */
export function statusPillStyle(on) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 12px",
    borderRadius: 999,
    border: on ? "none" : "1px solid #D5DCD8",
    background: on ? "#3C7D50" : "var(--nv-card, #fff)",
    color: on ? "#fff" : "var(--nv-ink2, #3A4048)",
    fontSize: 12,
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export default function StatusFilterPills({ title, items = [], value, onChange, note, dataKey }) {
  return (
    <header className="nv-req-inbox-head is-mine" data-status-pills={dataKey || undefined}>
      {title ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2>
            <span aria-hidden />
            {title}
          </h2>
          {note ? <span className="nv-req-inbox-meta">{note}</span> : null}
        </div>
      ) : null}
      <div className="nv-req-inbox-pills" role="tablist">
        {items.map((item) => {
          const on = value === item.id;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={on} aria-pressed={on} onClick={() => onChange?.(item.id)} style={statusPillStyle(on)}>
              {item.label}
              <span dir="ltr" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, background: on ? "rgba(255,255,255,.22)" : "var(--nv-ok-soft, #E6F2EA)", color: on ? "#fff" : "var(--nv-ok-ink, #2F6B43)", borderRadius: 999, padding: "0 6px", minWidth: 18, textAlign: "center", unicodeBidi: "isolate" }}>{item.n}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
