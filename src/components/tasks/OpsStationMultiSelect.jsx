import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  BORDER,
  CARD,
  CONTROL_RADIUS,
  INK,
  MUTED,
  PILL_RADIUS,
  RADIUS,
  SURFACE,
  field,
} from "@/lib/platformStyles";

const NAVY = "var(--nv-navy)";
const NAVY_SOFT = "color-mix(in srgb, var(--nv-navy) 10%, #fff)";
const NAVY_LINE = "color-mix(in srgb, var(--nv-navy) 28%, var(--nv-line, #DFE3EA))";
const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
const ROW_H = 40;

function rowStyle(on) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    width: "100%",
    height: ROW_H,
    minHeight: ROW_H,
    maxHeight: ROW_H,
    margin: 0,
    padding: "0 10px",
    boxSizing: "border-box",
    border: "none",
    borderBottom: `1px solid ${BORDER}`,
    borderRadius: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    lineHeight: 1,
    textAlign: "start",
    background: on ? NAVY_SOFT : CARD,
    color: on ? NAVY : INK,
    fontWeight: on ? 600 : 400,
  };
}

const chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  height: 24,
  padding: "0 6px 0 8px",
  borderRadius: PILL_RADIUS,
  border: `1px solid ${NAVY_LINE}`,
  background: NAVY_SOFT,
  color: NAVY,
  fontSize: 11,
  fontWeight: 600,
};

/** Branch picker — closed by default, opens into a searchable checklist with chips for the picks. */
export default function OpsStationMultiSelect({ stations = [], value = [], onChange, ar, onDone }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        onDone?.();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onDone]);

  const sorted = useMemo(
    () => [...stations].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), ar ? "ar" : "en")),
    [stations, ar],
  );
  const chosen = useMemo(() => new Set((value || []).map((id) => String(id))), [value]);
  const q = query.trim().toLowerCase();
  const visible = q ? sorted.filter((s) => String(s.name || "").toLowerCase().includes(q)) : sorted;
  const selected = sorted.filter((s) => chosen.has(String(s.id)));
  const selectedNames = selected.map((s) => String(s.name || "").trim()).filter(Boolean);
  const toggle = (id) => {
    const key = String(id);
    onChange(chosen.has(key) ? (value || []).filter((x) => String(x) !== key) : [...(value || []).map(String), key]);
  };
  const allOn = stations.length > 0 && stations.every((s) => chosen.has(String(s.id)));
  const close = () => {
    setOpen(false);
    onDone?.();
  };

  return (
    <div ref={wrapRef} data-station-picker style={{ position: "static", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, width: "100%" }}>
      <button
        type="button"
        data-station-trigger
        data-assign-trigger
        onClick={() => setOpen((o) => {
          if (o) onDone?.();
          return !o;
        })}
        style={{ ...field, height: ROW_H, minHeight: ROW_H, maxHeight: ROW_H, width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 8, margin: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: selectedNames.length ? INK : MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>
          {selectedNames.length
            ? selectedNames.join(ar ? "، " : ", ")
            : (ar ? "اختر الفرع" : "Select a branch")}
        </span>
        <ChevronDown style={{ width: 14, height: 14, color: MUTED, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {!open && selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.slice(0, 6).map((s) => (
            <span key={s.id} style={chip}>
              {s.name}
              <X style={{ width: 12, height: 12, cursor: "pointer" }} onClick={() => toggle(s.id)} />
            </span>
          ))}
          {selected.length > 6 && (
            <span style={{ ...chip, border: `1px dashed ${BORDER}`, background: SURFACE, color: MUTED }}>
              +<span dir="ltr" style={{ fontFamily: MONO }}>{selected.length - 6}</span>
            </span>
          )}
        </div>
      )}

      {open && (
        <div
          data-station-panel
          style={{
            position: "static",
            width: "100%",
            boxSizing: "border-box",
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            background: CARD,
            overflow: "hidden",
          }}
        >
          {stations.length > 6 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: ROW_H, padding: "0 10px", boxSizing: "border-box", borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
              <Search style={{ width: 13, height: 13, color: MUTED, flexShrink: 0 }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ar ? "ابحث عن فرع…" : "Search a branch…"}
                style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontSize: 12.5, fontFamily: "inherit", color: INK, height: 24 }}
              />
            </div>
          )}

          <div style={{ maxHeight: ROW_H * 6, overflowY: "auto", overflowX: "hidden", padding: 0, margin: 0 }}>
            {visible.length === 0 ? (
              <div style={{ fontSize: 12, color: MUTED, height: ROW_H, display: "flex", alignItems: "center", padding: "0 10px", boxSizing: "border-box" }}>{ar ? "لا فرع مطابق." : "No matching branch."}</div>
            ) : (
              visible.map((s) => {
                const on = chosen.has(String(s.id));
                return (
                  <button key={s.id} type="button" data-station-row data-selected={on ? "true" : "false"} onClick={() => toggle(s.id)} style={rowStyle(on)}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                        border: `1px solid ${on ? NAVY : BORDER}`,
                        background: on ? NAVY : CARD,
                      }}
                    >
                      {on && <Check style={{ width: 11, height: 11, color: "#fff" }} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>{s.name}</span>
                  </button>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, height: ROW_H, padding: "0 10px", boxSizing: "border-box", borderTop: `1px solid ${BORDER}`, background: SURFACE }}>
            <span style={{ fontSize: 11, color: MUTED }}>
              {ar
                ? <><span dir="ltr" style={{ fontFamily: MONO }}>{value.length}</span> من <span dir="ltr" style={{ fontFamily: MONO }}>{stations.length}</span></>
                : <><span dir="ltr" style={{ fontFamily: MONO }}>{value.length}</span> of <span dir="ltr" style={{ fontFamily: MONO }}>{stations.length}</span></>}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {stations.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(allOn ? [] : stations.map((s) => String(s.id)))}
                  style={{ height: 28, padding: "0 10px", borderRadius: CONTROL_RADIUS, border: `1px dashed ${BORDER}`, background: CARD, color: MUTED, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}
                >
                  {allOn ? (ar ? "إلغاء الكل" : "Clear all") : (ar ? "تحديد الكل" : "Select all")}
                </button>
              )}
              <button
                type="button"
                onClick={close}
                style={{ height: 28, padding: "0 12px", borderRadius: CONTROL_RADIUS, border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
              >
                {ar ? "تم" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
