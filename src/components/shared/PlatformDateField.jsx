import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, RADIUS, SURFACE } from "@/lib/platformStyles";
import { formatDate, formatMonthYear } from "@/lib/dateFormat";

function pad(n) {
  return String(n).padStart(2, "0");
}

function toKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseKey(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function parseMonthKey(value) {
  const m = /^(\d{4})-(\d{2})/.exec(String(value || ""));
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1 };
}

function toMonthKey(y, m) {
  return `${y}-${pad(m + 1)}`;
}

function monthOutOfRange(key, min, max) {
  if (!key) return false;
  const k = String(key).slice(0, 7);
  const lo = min ? String(min).slice(0, 7) : "";
  const hi = max ? String(max).slice(0, 7) : "";
  if (lo && k < lo) return true;
  if (hi && k > hi) return true;
  return false;
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function outOfRange(key, min, max) {
  if (!key) return false;
  if (min && key < min) return true;
  if (max && key > max) return true;
  return false;
}

function formatTriggerDate(parsed, ar) {
  if (!parsed) return "";
  return formatDate(new Date(parsed.y, parsed.m, parsed.d), ar ? "ar" : "en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const chromeBtn = {
  borderRadius: RADIUS,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: NAVY,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
  fontFamily: "inherit",
};

function CardJumpTrigger({ label, valueLabel, open, onOpen, minWidth = 72 }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{
        flex: "1 1 auto",
        minWidth,
        height: 32,
        borderRadius: RADIUS,
        border: open ? `1px solid ${NAVY_FILL}` : `1px solid ${BORDER}`,
        background: open ? NAVY_FILL : CARD,
        color: open ? "#fff" : NAVY,
        fontSize: 13,
        fontWeight: 650,
        fontFamily: "inherit",
        padding: "0 8px 0 10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        boxSizing: "border-box",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", textAlign: "start" }}>
        {valueLabel}
      </span>
      <ChevronDown
        size={13}
        style={{
          color: open ? "rgba(255,255,255,.72)" : MUTED,
          flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 120ms ease",
        }}
      />
    </button>
  );
}

function JumpOptionsPanel({ label, options, value, onChange, ar }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 650, color: NAVY }}>{label}</div>
        <div style={{ fontSize: 11, color: MUTED }}>
          {ar ? "اختر من القائمة" : "Choose from the list"}
        </div>
      </div>
      <div
        role="listbox"
        aria-label={label}
        style={{
          maxHeight: 248,
          overflowY: "auto",
          padding: 6,
          borderRadius: RADIUS,
          border: `1px solid ${BORDER}`,
          background: SURFACE,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {options.map((opt) => {
          const active = String(opt.value) === String(value);
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(opt.value)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                minHeight: 34,
                padding: "7px 10px",
                borderRadius: RADIUS,
                border: active ? `1px solid ${NAVY_FILL}` : `1px solid ${BORDER}`,
                background: active ? NAVY_FILL : CARD,
                color: active ? "#fff" : NAVY,
                fontSize: 12,
                fontWeight: active ? 700 : 550,
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "start",
                boxSizing: "border-box",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Shared platform date picker — ISO day (YYYY-MM-DD) or month (YYYY-MM).
 */
export default function PlatformDateField({
  value,
  defaultValue = "",
  onChange,
  ar = true,
  placeholder,
  placement = "bottom",
  min,
  max,
  disabled = false,
  name,
  required = false,
  id,
  compact = false,
  allowClear,
  granularity = "day",
  style,
}) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue || "");
  const monthMode = granularity === "month";
  const current = controlled ? (value || "") : inner;
  const parsed = monthMode ? parseMonthKey(current) : parseKey(current);
  const today = new Date();
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());
  const todayMonthKey = toMonthKey(today.getFullYear(), today.getMonth());
  const canClear = allowClear ?? !required;

  const [open, setOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(null);
  const [coords, setCoords] = useState(null);
  const [cursor, setCursor] = useState(() => (
    parsed ? new Date(parsed.y, parsed.m, 1) : new Date(today.getFullYear(), today.getMonth(), 1)
  ));

  const commit = (next) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
      setJumpOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    let broughtIntoView = false;
    const place = () => {
      const trigger = triggerRef.current;
      const pop = popRef.current;
      if (!trigger) return;
      let r = trigger.getBoundingClientRect();
      const w = Math.max(292, pop?.offsetWidth || 292);
      const h = Math.max(280, pop?.offsetHeight || 320);
      const pad = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!broughtIntoView && placement !== "top" && vh - pad - (r.bottom + 6) < h) {
        broughtIntoView = true;
        trigger.scrollIntoView({ block: "center", inline: "nearest" });
        r = trigger.getBoundingClientRect();
      }
      const boundaryEl = trigger.closest("form") || trigger.closest("[role='dialog']") || trigger.closest("section");
      const b = boundaryEl?.getBoundingClientRect();
      const minL = Math.max(pad, b ? b.left + 8 : pad);
      const maxR = Math.min(vw - pad, b ? b.right - 8 : vw - pad);
      let left = ar ? r.right - w : r.left;
      if (left < minL) left = minL;
      if (left + w > maxR) left = maxR - w;
      if (left < minL) left = minL;
      const below = r.bottom + 6;
      const above = r.top - 6 - h;
      let top = placement === "top" ? above : below;
      if (top + h > vh - pad && above >= pad && placement !== "top") top = above;
      if (top < pad) top = pad;
      setCoords({ top, left, w });
    };
    place();
    const idFrame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(idFrame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, ar, placement, jumpOpen]);

  useEffect(() => {
    if (parsed) setCursor(new Date(parsed.y, parsed.m, 1));
  }, [current]);

  useEffect(() => {
    if (!open) setJumpOpen(null);
  }, [open]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthMatrix(year, month), [year, month]);

  const monthOptions = useMemo(() => {
    const locale = ar ? "ar" : "en";
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: formatDate(new Date(2024, i, 1), locale, { month: "long" }),
    }));
  }, [ar]);

  const yearOptions = useMemo(() => {
    const base = new Date().getFullYear();
    let lo = base - 90;
    let hi = base + 20;
    const bounds = [min, max, current].map((item) => parseMonthKey(item) || parseKey(item)).filter(Boolean);
    for (const p of bounds) {
      lo = Math.min(lo, p.y);
      hi = Math.max(hi, p.y);
    }
    const years = [];
    for (let y = lo; y <= hi; y += 1) years.push(y);
    return years.map((y) => ({ value: y, label: String(y) }));
  }, [year, min, max, current]);

  const display = parsed
    ? (monthMode ? formatMonthYear(new Date(parsed.y, parsed.m, 1), ar ? "ar" : "en") : formatTriggerDate(parsed, ar))
    : (placeholder || (monthMode ? (ar ? "اختر الشهر" : "Pick a month") : (ar ? "اختر التاريخ" : "Pick a date")));

  const weekdays = ar
    ? ["اث", "ثل", "أر", "خم", "جم", "سب", "أح"]
    : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const pick = (day) => {
    if (!day) return;
    const key = toKey(year, month, day);
    if (outOfRange(key, min, max)) return;
    commit(key);
    setOpen(false);
    setJumpOpen(null);
  };

  const clear = (e) => {
    e.stopPropagation();
    commit("");
    setOpen(false);
    setJumpOpen(null);
  };

  const height = compact ? 32 : 36;

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%", minWidth: compact ? 148 : 0 }}>
      {name ? (
        <input
          type="text"
          name={name}
          id={id}
          value={current}
          required={required}
          disabled={disabled}
          readOnly
          tabIndex={-1}
          aria-hidden
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          setJumpOpen(null);
        }}
        style={{
          width: "100%",
          height,
          minHeight: height,
          padding: compact ? "0 8px" : "0 12px",
          borderRadius: RADIUS,
          border: `1px solid ${BORDER}`,
          background: CARD,
          color: parsed ? NAVY : MUTED,
          display: "flex",
          alignItems: "center",
          gap: compact ? 6 : 8,
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          fontSize: compact ? 12 : 13,
          fontWeight: parsed ? 600 : 500,
          lineHeight: 1,
          boxSizing: "border-box",
          textAlign: "start",
          opacity: disabled ? 0.55 : 1,
          ...style,
        }}
      >
        <span
          style={{
            width: compact ? 18 : 22,
            height: compact ? 18 : 22,
            borderRadius: RADIUS,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            display: "grid",
            placeItems: "center",
            color: NAVY,
            flexShrink: 0,
          }}
        >
          <CalendarDays size={compact ? 12 : 13} strokeWidth={1.75} />
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display}
        </span>
        {parsed && canClear && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            onClick={clear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") clear(e);
            }}
            aria-label={ar ? "مسح التاريخ" : "Clear date"}
            style={{
              width: 22,
              height: 22,
              borderRadius: RADIUS,
              display: "grid",
              placeItems: "center",
              color: MUTED,
              flexShrink: 0,
            }}
          >
            <X size={13} />
          </span>
        ) : null}
      </button>

      {open ? createPortal(
        <div
          ref={popRef}
          dir={ar ? "rtl" : "ltr"}
          role="dialog"
          aria-label={monthMode ? (ar ? "الشهر" : "Month") : (ar ? "التقويم" : "Calendar")}
          style={{
            position: "fixed",
            top: coords?.top ?? -9999,
            left: coords?.left ?? 0,
            zIndex: 220,
            width: coords?.w ?? 292,
            minWidth: 292,
            borderRadius: RADIUS,
            border: `1px solid ${BORDER}`,
            background: CARD,
            boxShadow: "none",
            overflow: "hidden",
            visibility: coords ? "visible" : "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "10px 12px",
              borderBottom: `1px solid ${BORDER}`,
              background: CARD,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setJumpOpen(null);
                  setCursor(monthMode ? new Date(year - 1, month, 1) : new Date(year, month - 1, 1));
                }}
                aria-label={monthMode ? (ar ? "السنة السابقة" : "Previous year") : (ar ? "الشهر السابق" : "Previous month")}
                style={{ ...chromeBtn, width: 28, height: 28 }}
              >
                {ar ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <CardJumpTrigger
                  label={ar ? "الشهر" : "Month"}
                  valueLabel={monthOptions.find((o) => o.value === month)?.label || ""}
                  minWidth={96}
                  open={jumpOpen === "month"}
                  onOpen={() => setJumpOpen((v) => (v === "month" ? null : "month"))}
                />
                <CardJumpTrigger
                  label={ar ? "السنة" : "Year"}
                  valueLabel={String(year)}
                  minWidth={68}
                  open={jumpOpen === "year"}
                  onOpen={() => setJumpOpen((v) => (v === "year" ? null : "year"))}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setJumpOpen(null);
                  setCursor(monthMode ? new Date(year + 1, month, 1) : new Date(year, month + 1, 1));
                }}
                aria-label={monthMode ? (ar ? "السنة التالية" : "Next year") : (ar ? "الشهر التالي" : "Next month")}
                style={{ ...chromeBtn, width: 28, height: 28 }}
              >
                {ar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>

          <div style={{ padding: 12 }}>
            {jumpOpen === "month" ? (
              <JumpOptionsPanel
                ar={ar}
                label={ar ? "اختر الشهر" : "Pick a month"}
                options={monthOptions}
                value={month}
                onChange={(next) => {
                  const nextMonth = Number(next);
                  setCursor(new Date(year, nextMonth, 1));
                  if (monthMode) {
                    const key = toMonthKey(year, nextMonth);
                    if (!monthOutOfRange(key, min, max)) {
                      commit(key);
                      setOpen(false);
                    }
                  }
                  setJumpOpen(null);
                }}
              />
            ) : jumpOpen === "year" ? (
              <JumpOptionsPanel
                ar={ar}
                label={ar ? "اختر السنة" : "Pick a year"}
                options={yearOptions}
                value={year}
                onChange={(next) => {
                  setCursor(new Date(Number(next), month, 1));
                  setJumpOpen(null);
                }}
              />
            ) : monthMode ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {monthOptions.map((opt) => {
                    const key = toMonthKey(year, opt.value);
                    const selected = key === String(current).slice(0, 7);
                    const isNow = key === todayMonthKey;
                    const blocked = monthOutOfRange(key, min, max);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (blocked) return;
                          commit(key);
                          setCursor(new Date(year, opt.value, 1));
                          setOpen(false);
                          setJumpOpen(null);
                        }}
                        style={{
                          minHeight: 40,
                          padding: "8px 6px",
                          borderRadius: RADIUS,
                          border: selected
                            ? `1px solid ${NAVY_FILL}`
                            : isNow
                              ? `1px solid ${NAVY_FILL}`
                              : `1px solid ${BORDER}`,
                          background: selected ? NAVY_FILL : CARD,
                          color: selected ? "#fff" : blocked ? MUTED : NAVY,
                          fontSize: 12,
                          fontWeight: selected || isNow ? 700 : 550,
                          cursor: blocked ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                          opacity: blocked ? 0.38 : 1,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setJumpOpen(null);
                    }}
                    style={{
                      height: 32,
                      padding: "0 12px",
                      borderRadius: RADIUS,
                      border: `1px solid ${BORDER}`,
                      background: CARD,
                      color: MUTED,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {ar ? "إغلاق" : "Close"}
                  </button>
                  <button
                    type="button"
                    disabled={monthOutOfRange(todayMonthKey, min, max)}
                    onClick={() => {
                      if (monthOutOfRange(todayMonthKey, min, max)) return;
                      commit(todayMonthKey);
                      setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                      setOpen(false);
                      setJumpOpen(null);
                    }}
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: RADIUS,
                      border: `1px solid ${NAVY_FILL}`,
                      background: CARD,
                      color: NAVY,
                      fontSize: 12,
                      fontWeight: 650,
                      cursor: monthOutOfRange(todayMonthKey, min, max) ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      opacity: monthOutOfRange(todayMonthKey, min, max) ? 0.4 : 1,
                    }}
                  >
                    {ar ? "هذا الشهر" : "This month"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 2,
                    marginBottom: 6,
                  }}
                >
                  {weekdays.map((w) => (
                    <div
                      key={w}
                      style={{
                        textAlign: "center",
                        fontSize: 10,
                        fontWeight: 650,
                        color: MUTED,
                        padding: "4px 0",
                      }}
                    >
                      {w}
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                  {cells.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />;
                    const key = toKey(year, month, day);
                    const selected = key === current;
                    const isToday = key === todayKey;
                    const blocked = outOfRange(key, min, max);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={blocked}
                        onClick={() => pick(day)}
                        style={{
                          height: 34,
                          width: "100%",
                          borderRadius: selected || isToday ? "50%" : RADIUS,
                          border: selected
                            ? "none"
                            : isToday
                              ? `1px solid ${NAVY_FILL}`
                              : "1px solid transparent",
                          background: selected ? NAVY_FILL : "transparent",
                          color: selected ? "#fff" : blocked ? MUTED : NAVY,
                          fontSize: 12,
                          fontWeight: selected || isToday ? 700 : 500,
                          cursor: blocked ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                          opacity: blocked ? 0.38 : 1,
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setJumpOpen(null);
                    }}
                    style={{
                      height: 32,
                      padding: "0 12px",
                      borderRadius: RADIUS,
                      border: `1px solid ${BORDER}`,
                      background: CARD,
                      color: MUTED,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {ar ? "إغلاق" : "Close"}
                  </button>
                  <button
                    type="button"
                    disabled={outOfRange(todayKey, min, max)}
                    onClick={() => {
                      if (outOfRange(todayKey, min, max)) return;
                      commit(todayKey);
                      setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                      setOpen(false);
                      setJumpOpen(null);
                    }}
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: RADIUS,
                      border: `1px solid ${NAVY_FILL}`,
                      background: CARD,
                      color: NAVY,
                      fontSize: 12,
                      fontWeight: 650,
                      cursor: outOfRange(todayKey, min, max) ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      opacity: outOfRange(todayKey, min, max) ? 0.4 : 1,
                    }}
                  >
                    {ar ? "اليوم" : "Today"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      , document.body) : null}
    </div>
  );
}
