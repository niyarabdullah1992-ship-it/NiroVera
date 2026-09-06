import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { BRAND, BRAND_SOFT, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { formatDate } from "@/lib/dateFormat";

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

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const navBtnStyle = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--nv-line, #E2E8F0)",
  background: CARD,
  color: NAVY,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

/** Header trigger only — options render inside the calendar card body. */
function CardJumpTrigger({
  label,
  valueLabel,
  open,
  onOpen,
  minWidth = 72,
}) {
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
        height: 34,
        borderRadius: 10,
        border: open
          ? "1px solid color-mix(in oklab, var(--nv-navy, #14284B) 22%, #E2E8F0)"
          : "1px solid var(--nv-line, #E2E8F0)",
        background: CARD,
        color: NAVY,
        fontSize: 13,
        fontWeight: 650,
        fontFamily: "inherit",
        padding: "0 8px 0 10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        boxSizing: "border-box",
        boxShadow: open
          ? "0 0 0 3px color-mix(in oklab, var(--nv-navy, #14284B) 7%, transparent)"
          : "0 1px 2px rgba(20,40,75,.04)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", textAlign: "start" }}>
        {valueLabel}
      </span>
      <ChevronDown
        size={13}
        style={{
          color: MUTED,
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
          padding: 8,
          borderRadius: 12,
          border: "1px solid var(--nv-line, #E2E8F0)",
          background: "var(--nv-inset, var(--nv-soft, #F7F8FA))",
          display: "flex",
          flexDirection: "column",
          gap: 5,
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
                minHeight: 36,
                padding: "8px 11px",
                borderRadius: 10,
                border: active
                  ? "1px solid color-mix(in oklab, var(--nv-navy, #14284B) 35%, #E2E8F0)"
                  : "1px solid var(--nv-line, #E2E8F0)",
                background: active ? "var(--nv-navy, #14284B)" : CARD,
                color: active ? "#fff" : NAVY,
                fontSize: 12,
                fontWeight: active ? 700 : 550,
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "start",
                boxSizing: "border-box",
                boxShadow: active ? "none" : "0 1px 2px rgba(20,40,75,.03)",
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
 * Platform-styled due-date field + calendar popover (card identity).
 */
export default function PlatformDateField({
  value = "",
  onChange,
  ar = true,
  placeholder,
  placement = "bottom",
}) {
  const rootRef = useRef(null);
  const parsed = parseKey(value);
  const today = new Date();
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [open, setOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(null); // "month" | "year" | null
  const [cursor, setCursor] = useState(() => (
    parsed ? new Date(parsed.y, parsed.m, 1) : new Date(today.getFullYear(), today.getMonth(), 1)
  ));

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setJumpOpen(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (parsed) setCursor(new Date(parsed.y, parsed.m, 1));
  }, [value]);

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
    const years = [];
    for (let y = base - 8; y <= base + 12; y += 1) years.push(y);
    if (!years.includes(year)) years.push(year);
    return years.sort((a, b) => a - b).map((y) => ({ value: y, label: String(y) }));
  }, [year]);

  const display = parsed
    ? formatDate(new Date(parsed.y, parsed.m, parsed.d), ar ? "ar" : "en", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : (placeholder || (ar ? "اختر التاريخ" : "Pick a date"));

  const weekdays = ar
    ? ["اث", "ثل", "أر", "خم", "جم", "سب", "أح"]
    : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const pick = (day) => {
    if (!day) return;
    onChange?.(toKey(year, month, day));
    setOpen(false);
    setJumpOpen(null);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange?.("");
    setOpen(false);
    setJumpOpen(null);
  };

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setJumpOpen(null);
        }}
        style={{
          width: "100%",
          height: 36,
          minHeight: 36,
          padding: "0 12px",
          borderRadius: 9,
          border: "1px solid var(--nv-line, #E2E8F0)",
          background: CARD,
          color: parsed ? NAVY : MUTED,
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: parsed ? 600 : 500,
          lineHeight: 1,
          boxSizing: "border-box",
          textAlign: "start",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: SURFACE,
            border: "1px solid var(--nv-line, #E2E8F0)",
            display: "grid",
            placeItems: "center",
            color: NAVY,
            flexShrink: 0,
          }}
        >
          <CalendarDays size={13} strokeWidth={1.75} />
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display}
        </span>
        {parsed ? (
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
              borderRadius: 6,
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

      {open ? (
        <div
          style={{
            position: "absolute",
            insetInlineStart: 0,
            ...(placement === "top"
              ? { bottom: "calc(100% + 6px)", top: "auto" }
              : { top: "calc(100% + 6px)" }),
            zIndex: 80,
            width: 292,
            minWidth: 292,
            borderRadius: 16,
            border: "1px solid var(--nv-line, #E2E8F0)",
            background: CARD,
            boxShadow: "0 16px 40px rgba(20,40,75,.14)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "10px 12px",
              borderBottom: "1px solid var(--nv-line, #E2E8F0)",
              background: "linear-gradient(180deg, color-mix(in oklab, var(--nv-accent, #1E9E63) 6%, var(--nv-card, #fff)) 0%, var(--nv-card, #fff) 100%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setJumpOpen(null);
                  setCursor(new Date(year, month - 1, 1));
                }}
                aria-label={ar ? "الشهر السابق" : "Previous month"}
                style={navBtnStyle}
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
                  setCursor(new Date(year, month + 1, 1));
                }}
                aria-label={ar ? "الشهر التالي" : "Next month"}
                style={navBtnStyle}
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
                  setCursor(new Date(year, Number(next), 1));
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
                const selected = key === value;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pick(day)}
                    style={{
                      height: 34,
                      borderRadius: 9,
                      border: selected
                        ? "none"
                        : isToday
                          ? `1px solid ${BRAND}`
                          : "1px solid transparent",
                      background: selected ? "var(--nv-navy, #14284B)" : "transparent",
                      color: selected ? "#fff" : NAVY,
                      fontSize: 12,
                      fontWeight: selected || isToday ? 700 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
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
                  onChange?.(todayKey);
                  setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                  setOpen(false);
                  setJumpOpen(null);
                }}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 9,
                  border: `1px solid ${BRAND}`,
                  background: BRAND_SOFT,
                  color: BRAND,
                  fontSize: 12,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {ar ? "اليوم" : "Today"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setJumpOpen(null);
                }}
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 9,
                  border: "1px solid var(--nv-line, #E2E8F0)",
                  background: SURFACE,
                  color: MUTED,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {ar ? "إغلاق" : "Close"}
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
