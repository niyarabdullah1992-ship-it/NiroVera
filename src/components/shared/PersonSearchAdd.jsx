import React, { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { peopleQueryMatches } from "@/lib/peopleTreeGraph";

const MUTED = "var(--nv-muted)";
const field = {
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
  height: 40,
  paddingBlock: 0,
  paddingInlineStart: 34,
  paddingInlineEnd: 12,
  "--nv-input-start": "34px",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  fontSize: 13,
  outline: "none",
};

function Letter({ name }) {
  const ch = String(name || "").trim().charAt(0) || "؟";
  return (
    <span aria-hidden style={{ width: 26, height: 26, flex: "none", borderRadius: 7, background: "var(--nv-ok-soft)", color: "var(--nv-ok-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
      {ch}
    </span>
  );
}

/**
 * Search, then add — no wall of names. The field stays quiet until something is typed; matches open as a
 * short list under it (name, then title · branch). Enter adds the first match; a pick clears the field.
 *
 * rows: [{ id, name, sub?, hay? }]
 */
export default function PersonSearchAdd({ ar = true, rows = [], onPick, placeholder, actionLabel, emptyScope, limit = 6, dataKey = "person-search" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const typed = q.trim();
  const matches = useMemo(
    () => (typed ? rows.filter((row) => peopleQueryMatches(row.hay || [row.name, row.sub].filter(Boolean).join(" "), typed)).slice(0, limit) : []),
    [rows, typed, limit],
  );
  const pick = (row) => {
    onPick?.(row);
    setQ("");
    setOpen(false);
    inputRef.current?.focus();
  };
  if (!rows.length) {
    return <span style={{ fontSize: 11.5, color: MUTED }}>{emptyScope || (ar ? "لا موظف آخر في نطاقك." : "No other employee in your scope.")}</span>;
  }
  return (
    <span data-person-search={dataKey} style={{ position: "relative", display: "block" }}>
      <Search aria-hidden size={14} strokeWidth={1.75} style={{ position: "absolute", insetInlineStart: 11, top: 20, transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
      <input
        ref={inputRef}
        data-people-search="1"
        value={q}
        onChange={(event) => { setQ(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && matches[0]) { event.preventDefault(); pick(matches[0]); }
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder || (ar ? "ابحث عن موظف بالاسم أو المسمى أو الفرع" : "Search an employee by name, title or branch")}
        aria-label={ar ? "ابحث عن موظف" : "Search an employee"}
        role="combobox"
        aria-expanded={open && !!typed}
        style={field}
      />
      {open && typed ? (
        <div role="listbox" style={{ position: "absolute", top: "100%", insetInline: 0, marginTop: 4, zIndex: 20, background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 10, boxShadow: "0 12px 28px rgba(12,20,16,.14)", padding: 4, display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
          {matches.length ? matches.map((row) => (
            <button
              key={row.id}
              type="button"
              role="option"
              data-person-option={row.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(row)}
              style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", border: "none", borderRadius: 8, background: "transparent", color: "var(--nv-ink)", cursor: "pointer", textAlign: "start" }}
            >
              <Letter name={row.name} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                {row.sub ? <span style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sub}</span> : null}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--nv-ok-ink)", fontWeight: 700 }}>{actionLabel || (ar ? "أضف" : "Add")}</span>
            </button>
          )) : (
            <span style={{ padding: "8px 10px", fontSize: 12, color: MUTED }}>{ar ? `لا أحد يطابق «${typed}».` : `Nobody matches “${typed}”.`}</span>
          )}
        </div>
      ) : null}
    </span>
  );
}
