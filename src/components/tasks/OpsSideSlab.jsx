import React from "react";

// Same dark-green slab as «بانتظار القرار» in الطلبات and «رصيد إجازاتي».
export const DK = {
  bg: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)",
  ink: "#fff",
  soft: "#C5DBCD",
  faint: "#A9CDB8",
  line: "rgba(255,255,255,.12)",
  on: "rgba(255,255,255,.08)",
  gold: "#C8A45A",
  bad: "#F4A3A3",
};

/** Section title with the gold dash — «أوامر العمل», «طلبات من الإدارة». */
export function OpsListHead({ title, note, trailing = null }) {
  return (
    <div data-ops-list-head="1" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 2px", flexWrap: "wrap" }}>
      <span aria-hidden style={{ width: 14, height: 2, background: DK.gold, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 220px" }}>
        <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{title}</strong>
        {note ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>{note}</span> : null}
      </span>
      {trailing}
    </div>
  );
}

function Pill({ tone = "gold", children }) {
  const bg = tone === "bad" ? "#FDECEC" : tone === "soft" ? "rgba(255,255,255,.14)" : DK.gold;
  const fg = tone === "bad" ? "#9B1C1C" : tone === "soft" ? DK.ink : "#0B3D27";
  return (
    <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", height: 19, padding: "0 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: fg, flexShrink: 0 }}>
      {children}
    </span>
  );
}

/**
 * The side slab: a head (what this list is, one line on how to use it, the count), then branches,
 * each with its rows. A branch narrows the page to it; a row opens or selects what it names, and
 * the selected row offers its one next action as a gold link.
 *
 * groups: [{ id, name, alert, rows: [{ id, title, line, count, tone, action }] }]
 */
export default function OpsSideSlab({
  ar = true,
  title,
  standing,
  note,
  summary,
  groups = [],
  emptyText,
  focusId = "",
  onFocus,
  selectedId = "",
  onSelect,
  dataKey,
}) {
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  return (
    <section data-ops-side={dataKey || "1"} style={{ background: DK.bg, color: DK.ink, borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 18px rgba(6,61,38,.16)" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${DK.line}`, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: DK.ink }}>{title}</span>
        {standing ? <span style={{ fontSize: 12.5, fontWeight: 600, color: DK.ink, lineHeight: 1.6 }}>{standing}</span> : null}
        {note ? <span style={{ fontSize: 11.5, color: DK.soft, lineHeight: 1.75 }}>{note}</span> : null}
        {summary ? <span style={{ fontSize: 11.5, color: DK.soft }}>{summary}</span> : null}
      </div>
      {total === 0 ? (
        <div style={{ padding: "16px 18px", fontSize: 12, color: DK.soft, lineHeight: 1.8 }}>{emptyText}</div>
      ) : groups.filter((g) => g.rows.length).map((group) => {
        const groupOn = focusId && String(group.id) === String(focusId);
        return (
          <div key={group.id || group.name} data-side-group={group.id || ""}>
            <button
              type="button"
              data-side-branch={group.id || ""}
              onClick={() => onFocus?.(groupOn ? "" : group.id)}
              aria-pressed={groupOn ? "true" : "false"}
              style={{ padding: "10px 18px 8px", display: "flex", flexDirection: "column", gap: 2, width: "100%", textAlign: "start", background: groupOn ? DK.on : "transparent", border: "none", borderBottom: `1px solid ${DK.line}`, cursor: onFocus ? "pointer" : "default", fontFamily: "inherit", color: DK.ink }}
            >
              <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{group.name}</span>
                {groupOn ? <span style={{ fontSize: 10.5, fontWeight: 700, color: DK.soft }}>{ar ? "معروض وحده" : "Showing only this"}</span> : null}
              </span>
              {group.alert ? <span style={{ fontSize: 11.5, color: DK.soft, lineHeight: 1.55 }}>{group.alert}</span> : null}
            </button>
            {group.rows.map((row) => {
              const on = String(row.id) === String(selectedId);
              return (
                <div key={row.id} data-side-row={row.id} style={{ borderBottom: `1px solid ${DK.line}`, background: on ? DK.on : "transparent", borderInlineStart: `3px solid ${on ? DK.gold : "transparent"}` }}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(on ? "" : row.id)}
                    aria-current={on ? "true" : undefined}
                    style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", textAlign: "start", padding: "10px 18px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", color: DK.ink }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 0 }}>{row.title}</span>
                      {row.count != null && row.count !== "" ? <Pill tone={row.tone}>{row.count}</Pill> : null}
                    </span>
                    {row.line ? <span style={{ fontSize: 11.5, color: row.tone === "bad" ? DK.bad : DK.soft, lineHeight: 1.6 }}>{row.line}</span> : null}
                  </button>
                  {on && row.action ? (
                    <div style={{ padding: "0 18px 11px", display: "flex", gap: 14, flexWrap: "wrap" }}>
                      {(Array.isArray(row.action) ? row.action : [row.action]).filter(Boolean).map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          data-side-action={a.key || a.label}
                          onClick={a.onClick}
                          style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: 0, border: "none", background: "transparent", color: DK.gold, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
