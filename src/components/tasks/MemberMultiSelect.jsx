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

/* Platform identity: the one green accent, soft green for what is picked, ink for names. */
const NAVY = "var(--nv-ok-ink, #2F6B45)";
const NAVY_SOFT = "var(--nv-ok-soft, #E8F2EC)";
const NAVY_LINE = "color-mix(in srgb, var(--nv-ok-ink, #2F6B45) 22%, var(--nv-line, #DFE3EA))";
const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
const ROW_H = 40;

function compareMembers(a, b) {
  const byName = String(a?.name || "").localeCompare(String(b?.name || ""), "ar", { sensitivity: "base" });
  if (byName) return byName;
  return String(a?.id || "").localeCompare(String(b?.id || ""), "ar");
}

function initialsOf(name) {
  const parts = String(name || "").split(/\s+/).filter(Boolean).slice(0, 2);
  // «السالم» gives «س», not the article's «ا».
  const letters = parts.map((part) => (/^ال.{2,}/.test(part) ? part[2] : part[0])).join("");
  return letters || "—";
}

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
  gap: 6,
  flex: "none",
  maxWidth: "100%",
  height: 30,
  margin: 0,
  paddingInlineStart: 4,
  paddingInlineEnd: 4,
  boxSizing: "border-box",
  borderRadius: PILL_RADIUS,
  border: `1px solid ${NAVY_LINE}`,
  background: NAVY_SOFT,
  color: INK,
  fontSize: 12.5,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const chipAvatar = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  flex: "none",
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 700,
  background: NAVY,
  color: "#fff",
};

const chipRemove = {
  width: 22,
  height: 22,
  flex: "none",
  display: "grid",
  placeItems: "center",
  margin: 0,
  padding: 0,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  color: MUTED,
  cursor: "pointer",
};

/** Assign one task to several members — closed by default, opens into a searchable checklist. */
export default function MemberMultiSelect({ members, selected, onChange, lang, emptyLabel }) {
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const sorted = useMemo(() => [...(members || [])].sort(compareMembers), [members]);
  const chosen = useMemo(() => new Set((selected || []).map((id) => String(id))), [selected]);
  const q = query.trim().toLowerCase();
  const shown = q ? sorted.filter((m) => (m.name || "").toLowerCase().includes(q)) : sorted;
  const picked = sorted.filter((m) => chosen.has(String(m.id)));
  const pickedNames = picked.map((m) => String(m.name || "").trim()).filter(Boolean);
  const toggle = (id) => {
    const key = String(id);
    onChange(chosen.has(key) ? (selected || []).filter((x) => String(x) !== key) : [...(selected || []), key]);
  };
  const allOn = sorted.length > 0 && sorted.every((m) => chosen.has(String(m.id)));

  if (sorted.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: MUTED, fontFamily: "inherit" }}>
        {emptyLabel || (ar ? "لا يوجد أعضاء في هذا الفرع." : "No members in this station.")}
      </p>
    );
  }

  return (
    <div
      ref={wrapRef}
      data-member-picker
      style={{ position: "static", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, width: "100%" }}
    >
      <button
        type="button"
        data-member-trigger
        data-assign-trigger
        onClick={() => setOpen((o) => !o)}
        style={{
          ...field,
          height: ROW_H,
          minHeight: ROW_H,
          maxHeight: ROW_H,
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "start",
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: pickedNames.length ? INK : MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>
          {pickedNames.length
            ? (ar
              ? (pickedNames.length === 1 ? "عضو واحد محدد" : pickedNames.length === 2 ? "عضوان محددان" : `${pickedNames.length} ${pickedNames.length <= 10 ? "أعضاء محددون" : "عضواً محدداً"}`)
              : `${pickedNames.length} selected`)
            : (ar ? "اختر الأعضاء" : "Select members")}
        </span>
        <ChevronDown style={{ width: 14, height: 14, color: MUTED, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {!open && picked.length > 0 && (
        <div
          data-member-chip-row
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, width: "100%" }}
        >
          {picked.map((m) => (
            <span key={m.id} data-member-chip style={chip}>
              <span aria-hidden style={chipAvatar}>{initialsOf(m.name)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{m.name}</span>
              <button type="button" onClick={() => toggle(m.id)} aria-label={ar ? `إزالة ${m.name}` : `Remove ${m.name}`} style={chipRemove}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div
          data-member-panel
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: ROW_H, padding: "0 10px", boxSizing: "border-box", borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
            <Search style={{ width: 13, height: 13, color: MUTED, flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? "ابحث عن عضو..." : "Search member..."}
              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontSize: 12.5, fontFamily: "inherit", color: INK, height: 24 }}
            />
          </div>
          <div style={{ maxHeight: ROW_H * 6, overflowY: "auto", overflowX: "hidden", padding: 0, margin: 0 }}>
            {shown.length === 0 ? (
              <div style={{ fontSize: 12, color: MUTED, height: ROW_H, display: "flex", alignItems: "center", padding: "0 10px", boxSizing: "border-box" }}>{ar ? "لا توجد نتائج." : "No results."}</div>
            ) : shown.map((m) => {
              const on = chosen.has(String(m.id));
              return (
                <button key={m.id} type="button" data-member-row data-selected={on ? "true" : "false"} onClick={() => toggle(m.id)} style={rowStyle(on)}>
                  <span
                    data-member-avatar
                    aria-hidden
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10,
                      fontWeight: 650,
                      lineHeight: 1,
                      boxSizing: "border-box",
                      border: `1px solid ${on ? NAVY : BORDER}`,
                      background: on ? NAVY : SURFACE,
                      color: on ? "#fff" : MUTED,
                    }}
                  >
                    {initialsOf(m.name)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>{m.name}</span>
                  <span aria-hidden style={{ width: 16, height: 16, flexShrink: 0, display: "grid", placeItems: "center" }}>
                    {on ? <Check style={{ width: 14, height: 14, color: NAVY }} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, height: ROW_H, padding: "0 10px", boxSizing: "border-box", borderTop: `1px solid ${BORDER}`, background: SURFACE }}>
            <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>
              {ar
                ? <><span dir="ltr" style={{ fontFamily: MONO }}>{selected.length}</span> من <span dir="ltr" style={{ fontFamily: MONO }}>{sorted.length}</span></>
                : <><span dir="ltr" style={{ fontFamily: MONO }}>{selected.length}</span> of <span dir="ltr" style={{ fontFamily: MONO }}>{sorted.length}</span></>}
            </span>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => onChange(allOn ? [] : sorted.map((m) => m.id))}
                style={{ height: 28, padding: "0 10px", borderRadius: CONTROL_RADIUS, border: `1px dashed ${BORDER}`, background: CARD, color: MUTED, fontSize: 11, fontFamily: "inherit", cursor: "pointer", boxSizing: "border-box" }}
              >
                {allOn ? (ar ? "إلغاء الكل" : "Clear all") : (ar ? "تحديد الكل" : "Select all")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ height: 28, padding: "0 12px", borderRadius: CONTROL_RADIUS, border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxSizing: "border-box" }}
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
