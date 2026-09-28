import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { orgLookupMatches } from "@/lib/orgLookup";

const fieldStyle = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  borderRadius: 12,
  border: "1px solid var(--nv-line)",
  fontSize: 12,
  color: "var(--nv-ink)",
  background: "var(--nv-card)",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

/**
 * Searchable picker. Matches name, title, job number, and branch in any order.
 * Replaces the native select so the list is not a fixed blue menu.
 */
export default function OrgLookupField({
  ar = true,
  label,
  value = "",
  onChange,
  options = [],
  placeholder,
  disabled = false,
  allowEmpty = false,
  emptyLabel,
}) {
  const listId = useId();
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const selected = options.find((option) => String(option.id) === String(value)) || null;
  const closedText = selected?.primary || "";

  const hits = useMemo(() => {
    const matched = options.filter((option) => orgLookupMatches(option, open ? query : ""));
    return { rows: matched.slice(0, 40), extra: Math.max(0, matched.length - 40) };
  }, [options, query, open]);

  useEffect(() => {
    if (!open) setQuery(closedText);
  }, [open, closedText, value]);

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

  const pick = (option) => {
    onChange?.(option ? String(option.id) : "");
    setQuery(option?.primary || "");
    setOpen(false);
  };

  const onKey = (event) => {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setHighlight((index) => Math.min(hits.rows.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && hits.rows[highlight]) pick(hits.rows[highlight]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setQuery(closedText);
    }
  };

  const hint = placeholder || (ar ? "ابحث بالاسم أو الوظيفة أو الرقم أو الفرع" : "Search name, title, number, or branch");

  const inputId = `${listId}-input`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-muted)", minWidth: 0 }}>
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <div ref={boxRef} style={{ position: "relative", minWidth: 0 }}>
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listId}
          disabled={disabled}
          value={open ? query : closedText}
          placeholder={selected ? closedText : hint}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery("");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKey}
          style={{ ...fieldStyle, opacity: disabled ? 0.6 : 1 }}
        />
        {open && !disabled ? (
          <div
            id={listId}
            role="listbox"
            style={{
              position: "absolute",
              zIndex: 30,
              top: 38,
              insetInlineStart: 0,
              width: "100%",
              maxHeight: 240,
              overflow: "auto",
              background: "var(--nv-card)",
              border: "1px solid var(--nv-line)",
              borderRadius: 12,
              boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
            }}
          >
            {allowEmpty ? (
              <button
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(null)}
                style={rowStyle(false)}
              >
                {emptyLabel || (ar ? "— بدون تعيين —" : "— None —")}
              </button>
            ) : null}
            {hits.rows.length ? hits.rows.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={String(option.id) === String(value)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(option)}
                style={rowStyle(index === highlight || String(option.id) === String(value))}
              >
                <span style={{ display: "block", fontSize: 12, fontWeight: 650, color: "var(--nv-ink)", lineHeight: 1.35 }}>{option.primary}</span>
                {option.secondary ? (
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--nv-ink2)", lineHeight: 1.35 }}>{option.secondary}</span>
                ) : null}
              </button>
            )) : (
              <div style={{ padding: "12px 10px", fontSize: 12, color: "var(--nv-muted)", textAlign: "center" }}>
                {ar ? "لا يطابق البحث" : "No match"}
              </div>
            )}
            {hits.extra > 0 ? (
              <div style={{ padding: "8px 10px", fontSize: 10.5, color: "var(--nv-muted)", textAlign: "center" }}>
                {ar ? `و ${hits.extra} غيرها — ضيّق البحث` : `${hits.extra} more — narrow the search`}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function rowStyle(active) {
  return {
    display: "block",
    width: "100%",
    textAlign: "start",
    padding: "8px 10px",
    border: "none",
    borderBottom: "1px solid var(--nv-line)",
    background: active ? "var(--nv-soft, #E6F2EA)" : "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
