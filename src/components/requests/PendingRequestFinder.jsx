import React, { useEffect, useMemo, useRef, useState } from "react";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";
import { filterPendingRequests } from "@/lib/requestWorkspace";

const NAVY_FILL = "var(--nv-navy, #14213d)";

function fieldStyle() {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    padding: "9px 10px",
    border: `1px solid ${BORDER}`,
    background: CARD,
    color: NAVY,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    minWidth: 0,
  };
}

export default function PendingRequestFinder({
  rows = [],
  stations = [],
  value,
  onChange,
  ar = true,
  label,
  compact = false,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef(null);

  const selected = rows.find((row) => `${row.family}-${row.id}` === String(value));
  const result = useMemo(
    () => filterPendingRequests({ rows, stations, query: open ? query : "" }),
    [rows, stations, query, open],
  );
  const hits = result.rows || [];

  useEffect(() => {
    if (open) return;
    setQuery(selected ? `${selected.title}${selected.employee?.name ? ` · ${selected.employee.name}` : ""}` : "");
  }, [selected, open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (row) => {
    onChange?.(row);
    setQuery(`${row.title}${row.employee?.name ? ` · ${row.employee.name}` : ""}`);
    setOpen(false);
  };

  const onKey = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setHighlight((n) => Math.min(hits.length - 1, n + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((n) => Math.max(0, n - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && hits[highlight]) pick(hits[highlight]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: compact ? 0 : 4, minWidth: compact ? 220 : 0 }}>
      {compact ? null : <span style={{ fontSize: 11, color: MUTED }}>{label || (ar ? "ابحث في ملفات الموظفين" : "Search employee files")}</span>}
      <div ref={boxRef} style={{ position: "relative" }}>
        <input
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="nv-req-pending-list"
          value={open ? query : (selected ? `${selected.title}${selected.employee?.name ? ` · ${selected.employee.name}` : ""}` : query)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={(event) => {
            setOpen(true);
            setQuery("");
            event.target.select();
          }}
          onKeyDown={onKey}
          placeholder={ar ? "⌕ ابحث باسم موظف أو نوع طلب" : "Search by name or request type"}
          style={compact ? { ...fieldStyle(), height: 30, borderRadius: 10, fontSize: 11.5, padding: "0 12px" } : fieldStyle()}
        />
        {open ? (
          <div
            id="nv-req-pending-list"
            role="listbox"
            style={{
              position: "absolute",
              insetInline: 0,
              top: "calc(100% + 4px)",
              zIndex: 20,
              background: CARD,
              border: `1px solid ${BORDER}`,
              maxHeight: 280,
              overflowY: "auto",
              boxShadow: "0 10px 28px rgba(20,33,61,0.08)",
            }}
          >
            {result.ok ? hits.map((row, index) => {
              const key = `${row.family}-${row.id}`;
              const on = key === String(value) || index === highlight;
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={key === String(value)}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(row)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 10,
                    padding: "9px 12px",
                    border: "none",
                    borderBottom: "1px solid #f3f4f7",
                    background: on ? NAVY_FILL : CARD,
                    color: on ? "#fff" : NAVY,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "start",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: on ? 700 : 500 }}>{row.title}{row.employee?.name ? ` · ${row.employee.name}` : ""}</span>
                  <span style={{ fontSize: 11, opacity: on ? 0.85 : 1, color: on ? "#fff" : MUTED, whiteSpace: "nowrap" }}>
                    {ar ? "معلّق" : "Pending"}
                  </span>
                </button>
              );
            }) : (
              <div style={{ padding: "12px 14px", fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                {ar ? result.reason : result.reasonEn}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}
