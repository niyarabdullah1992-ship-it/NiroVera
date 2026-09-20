import React, { useEffect, useMemo, useRef, useState } from "react";
import useStationScope from "@/hooks/useStationScope";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";
import { filterRequestPeople, requestPeopleStations } from "@/lib/requestWorkspace";

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

export default function RequestEmployeePicker({
  employees = [],
  stations = [],
  value,
  onChange,
  ar = true,
  label,
}) {
  const headerScope = useStationScope();
  const branches = useMemo(() => requestPeopleStations(employees, stations), [employees, stations]);
  const defaultStation = headerScope && headerScope !== "all" && branches.some((row) => String(row.id) === String(headerScope))
    ? String(headerScope)
    : (branches[0]?.id ? String(branches[0].id) : "");
  const [stationId, setStationId] = useState(defaultStation);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (headerScope && headerScope !== "all" && branches.some((row) => String(row.id) === String(headerScope))) {
      setStationId(String(headerScope));
      return;
    }
    if (branches[0]?.id) setStationId(String(branches[0].id));
  }, [headerScope, branches]);

  const selected = employees.find((row) => String(row.id) === String(value));
  const result = useMemo(
    () => filterRequestPeople({ employees, stations, query: open ? query : "", stationId, ar }),
    [employees, stations, query, open, stationId, ar],
  );
  const rows = result.rows || [];

  useEffect(() => {
    if (open) return;
    setQuery(selected?.name || "");
  }, [selected?.name, selected?.id, open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, stationId, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (row) => {
    onChange?.(row.id);
    setQuery(row.name || "");
    setOpen(false);
  };

  const onKey = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setHighlight((n) => Math.min(rows.length - 1, n + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((n) => Math.max(0, n - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && rows[highlight]) pick(rows[highlight]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setQuery(selected?.name || "");
    }
  };

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: MUTED }}>{label || (ar ? "الموظف" : "Employee")}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
        <div ref={boxRef} style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="nv-req-people-list"
            value={open ? query : (selected?.name || query)}
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
            placeholder={ar ? "اكتب الاسم أو الفرع" : "Type a name or branch"}
            style={fieldStyle()}
          />
          {open ? (
            <div
              id="nv-req-people-list"
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
              {result.ok ? rows.map((row, index) => {
                const on = String(row.id) === String(value) || index === highlight;
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="option"
                    aria-selected={String(row.id) === String(value)}
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
                    <span style={{ fontSize: 13, fontWeight: on ? 700 : 500 }}>{row.name}</span>
                    <span style={{ fontSize: 11, opacity: on ? 0.85 : 1, color: on ? "#fff" : MUTED, whiteSpace: "nowrap" }}>
                      {ar ? row.branchLineAr : row.branchLineEn}
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
      </div>
    </label>
  );
}
