import React, { useEffect, useRef, useState } from "react";
import NvIcon from "@/components/shared/NvIcon";

const MONO = "'IBM Plex Mono', monospace";
const pad = (n) => String(n).padStart(2, "0");
const toMin = (hm) => {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * The platform's own time field — 24-hour, mono digits, the طلباتي frame: a quiet field that opens a small
 * card with the hours of the window and the minutes, the chosen one in the dark green. No browser picker.
 * Clicks preventDefault: inside a <label> the closing minute chip would otherwise re-click the toggle and reopen it.
 * min / max are "HH:MM" (a window that passes midnight is read in order); step is in minutes.
 */
export default function TimeField({ ar = true, value = "", onChange, min = "00:00", max = "23:59", step = 5, placeholder = "--:--", dataKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const esc = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const from = toMin(min) ?? 0;
  let to = toMin(max) ?? 1439;
  if (to < from) to += 1440;
  const hours = [];
  for (let h = Math.floor(from / 60); h <= Math.floor(to / 60); h += 1) hours.push(h % 24);
  const chosenH = value ? Number(value.slice(0, 2)) : null;
  const chosenM = value ? Number(value.slice(3, 5)) : null;
  const minutes = [];
  for (let m = 0; m < 60; m += step) minutes.push(m);
  const inside = (h, m) => {
    let t = h * 60 + m;
    if (t < from) t += 1440;
    return t >= from && t <= to;
  };
  const pick = (h, m) => {
    const minute = m ?? (inside(h, chosenM ?? 0) ? (chosenM ?? 0) : minutes.find((x) => inside(h, x)) ?? 0);
    onChange?.(`${pad(h)}:${pad(minute)}`);
  };
  const chip = (on, enabled = true) => ({
    fontFamily: MONO,
    fontVariantNumeric: "tabular-nums",
    height: 28,
    width: "100%",
    minWidth: 0,
    padding: 0,
    borderRadius: 7,
    border: on ? "1px solid #0B3D27" : "1px solid var(--nv-line)",
    background: on ? "#0B3D27" : "var(--nv-card)",
    color: on ? "#fff" : enabled ? "var(--nv-ink)" : "var(--nv-mute-fill, #C5CEC9)",
    fontSize: 12.5,
    fontWeight: on ? 700 : 500,
    cursor: enabled ? "pointer" : "default",
  });

  return (
    <span ref={ref} data-time-field={dataKey || "1"} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={(event) => { event.preventDefault(); setOpen((v) => !v); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ fontFamily: "inherit", height: 32, minWidth: 104, display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 10px", border: `1px solid ${open ? "#3C7D50" : "var(--nv-line)"}`, borderRadius: 8, background: "var(--nv-card)", color: value ? "var(--nv-ink)" : "var(--nv-muted)", cursor: "pointer", boxShadow: open ? "0 0 0 3px rgba(60,125,80,.14)" : "none" }}
      >
        <span dir="ltr" style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: value ? 700 : 500 }}>{value || placeholder}</span>
        <NvIcon name="clock" size={13} inline={false} style={{ color: "var(--nv-muted)" }} />
      </button>
      {open ? (
        <div role="dialog" aria-label={ar ? "اختر الوقت" : "Pick a time"} style={{ position: "absolute", top: "100%", insetInlineStart: 0, marginTop: 6, zIndex: 30, width: 256, maxWidth: "calc(100vw - 32px)", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, boxShadow: "0 14px 32px rgba(12,20,16,.16)", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{ar ? "الساعة" : "Hour"}</span>
            <span dir="ltr" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>{value || placeholder}</span>
          </div>
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div dir="ltr" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
              {hours.map((h) => (
                <button key={`h${h}`} type="button" onClick={(event) => { event.preventDefault(); pick(h); }} style={chip(chosenH === h)}>{pad(h)}</button>
              ))}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-muted)" }}>{ar ? "الدقيقة" : "Minute"}</span>
            <div dir="ltr" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
              {minutes.map((m) => {
                const enabled = chosenH == null || inside(chosenH, m);
                return (
                  <button key={`m${m}`} type="button" disabled={!enabled} onClick={(event) => { event.preventDefault(); pick(chosenH ?? hours[0], m); setOpen(false); }} style={chip(chosenM === m && chosenH != null, enabled)}>{pad(m)}</button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}
