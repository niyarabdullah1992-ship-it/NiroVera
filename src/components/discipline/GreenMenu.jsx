import React, { useEffect, useRef, useState } from "react";

const ACTION = "#3C7D50";

const trigger = {
  fontFamily: "inherit",
  fontSize: 14,
  height: 44,
  padding: "0 14px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-page)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  textAlign: "start",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

/**
 * List menu whose selected row is the green action, never the browser blue.
 */
export default function GreenMenu({
  value,
  options = [],
  onChange,
  ariaLabel,
  placeholder = "—",
  menuId,
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const selected = options.find((row) => String(row.value) === String(value));
  const label = selected?.label || placeholder || "—";

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={boxRef} style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => options.length && setOpen((next) => !next)}
        style={trigger}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span aria-hidden style={{ color: "var(--nv-muted)", fontSize: 10 }}>▾</span>
      </button>
      {open && options.length ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            zIndex: 30,
            insetInlineStart: 0,
            top: "calc(100% + 4px)",
            minWidth: "100%",
            maxWidth: "min(420px, 80vw)",
            background: "var(--nv-card)",
            border: "1px solid var(--nv-line)",
            borderRadius: 12,
            boxShadow: "0 10px 26px rgba(12,20,16,.12)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
            maxHeight: 280,
            overflow: "auto",
          }}
        >
          {options.map((row) => {
            const on = String(row.value) === String(value);
            return (
              <button
                key={row.value}
                type="button"
                role="option"
                aria-selected={on}
                data-menu-value={row.value}
                onClick={() => {
                  onChange?.(row.value);
                  setOpen(false);
                }}
                style={{
                  fontFamily: "inherit",
                  fontSize: 12,
                  lineHeight: 1.55,
                  textAlign: "start",
                  padding: "8px 10px",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: on ? ACTION : "transparent",
                  color: on ? "#fff" : "var(--nv-ink)",
                  fontWeight: on ? 700 : 500,
                }}
                onMouseEnter={(event) => {
                  if (!on) event.currentTarget.style.background = "var(--nv-hover)";
                }}
                onMouseLeave={(event) => {
                  if (!on) event.currentTarget.style.background = "transparent";
                }}
              >
                {row.label || "—"}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
