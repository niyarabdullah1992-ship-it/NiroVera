import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hrSectionSearch } from "@/lib/hrSection";

const KIND = {
  person: { ar: "موظف", en: "Person" },
  seat: { ar: "منصب", en: "Seat" },
  branch: { ar: "فرع", en: "Branch" },
};

/**
 * One search at the top of «الموارد البشرية»: people, seats and branches. A hit opens the pane that
 * fixes it (the file, «المناصب», «الفروع والمحطات») — or the chart for a read-only viewer.
 */
export default function HrSectionSearch({ ar = true, data, access }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const hits = useMemo(() => hrSectionSearch(data, query, { access, ar }), [data, query, access, ar]);
  const open = (hit) => {
    if (!hit) return;
    setQuery("");
    navigate(hit.to, { state: { from: "/app/hr" } });
  };
  return (
    <div className="nv-hr-search" style={{ position: "relative", minWidth: 0 }}>
      <input
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(hits.length - 1, i + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); open(hits[active]); }
          else if (e.key === "Escape") setQuery("");
        }}
        placeholder={access?.full
          ? (ar ? "ابحث عن موظف أو منصب أو فرع" : "Search a person, seat or branch")
          : (ar ? "ابحث في محطاتك: موظف أو منصب أو فرع" : "Search your stations: person, seat or branch")}
        aria-label={ar ? "بحث في الموارد البشرية" : "Search human resources"}
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls="nv-hr-search-list"
        className="nv-od-input"
        style={{ width: "100%", boxSizing: "border-box", height: 38 }}
      />
      {query.trim().length >= 2 ? (
        <div
          id="nv-hr-search-list"
          role="listbox"
          style={{ position: "absolute", insetInline: 0, top: "calc(100% + 4px)", zIndex: 30, background: "var(--nv-card, #fff)", border: "1px solid var(--nv-line)", borderRadius: 8, boxShadow: "0 10px 24px rgba(15,23,42,.10)", overflow: "hidden" }}
        >
          {hits.length ? hits.map((hit, i) => (
            <button
              key={`${hit.kind}:${hit.id}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => open(hit)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", border: "none", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", background: i === active ? "var(--nv-soft)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "start", color: "var(--nv-ink)" }}
            >
              <span style={{ fontSize: 10.5, color: "var(--nv-muted)", minWidth: 40 }}>{ar ? KIND[hit.kind].ar : KIND[hit.kind].en}</span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.label}</b>
                {hit.sub ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.sub}</span> : null}
              </span>
            </button>
          )) : (
            <p style={{ margin: 0, padding: "10px 14px", fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "لا نتيجة في نطاقك." : "No result in your scope."}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
