import React, { useMemo } from "react";
import { Archive } from "lucide-react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { BORDER, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

function shiftMonthKey(key, delta) {
  const [year, month] = String(key || "").split("-").map(Number);
  if (!year || !month) return key;
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key, ar) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString(
    ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
    { month: "long", year: "numeric" },
  );
}

function runStatus(run, ar) {
  if (run?.status === "sent") return ar ? "أُرسل مدى" : "Mudad sent";
  if (run?.status === "approved") return ar ? "معتمد" : "Approved";
  if (run) return ar ? "لم يُغلق" : "Still open";
  return ar ? "لا مسير" : "No run";
}

const DK = { bg: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)", soft: "#C5DBCD", faint: "#A9CDB8", line: "rgba(255,255,255,.14)", gold: "#C8A45A" };
const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };
const TONE = {
  ok: { ink: "var(--nv-ok-ink)", bg: "var(--nv-ok-soft)", line: "var(--nv-ok-line)", dot: "#0F5535" },
  warn: { ink: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", line: "var(--nv-warn-line)", dot: "#C8A45A" },
  mute: { ink: "var(--nv-ink2)", bg: "var(--nv-soft)", line: "var(--nv-line)", dot: "var(--nv-muted)" },
};
const runTone = (run) => (run?.status === "sent" ? "ok" : run?.status === "approved" ? "ok" : run ? "warn" : "mute");

export default function PayrollArchiveBoard({
  ar,
  liveMonth,
  month,
  onMonth,
  rows = [],
}) {
  const selected = rows.find((row) => row.month === month) || null;
  const isLive = month === liveMonth;
  const groups = useMemo(() => {
    const byYear = new Map();
    rows.forEach((row) => {
      const year = String(row.month).slice(0, 4);
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(row);
    });
    return [...byYear.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, items]) => ({
        year,
        items: items.slice().sort((a, b) => String(b.month).localeCompare(String(a.month))),
      }));
  }, [rows]);
  const sent = rows.filter((row) => row.status === "sent").length;
  const open = rows.filter((row) => row.status !== "sent" && row.status !== "approved").length;

  return (
    <section data-archive="payroll" style={{ display: "flex", flexDirection: "column", borderRadius: 14, overflow: "hidden", border: `1px solid ${BORDER}`, background: CARD, boxShadow: "var(--nv-paper)" }}>
      <header style={{ background: DK.bg, color: "#fff", padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Archive size={18} strokeWidth={1.75} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 220px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 600, color: DK.faint }}>
            <span aria-hidden style={{ width: 12, height: 2, background: DK.gold, borderRadius: 8 }} />
            {ar ? "الرواتب" : "Payroll"}
          </span>
          <strong style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 700 }}>{ar ? "أرشيف المسير" : "Wage-run archive"}</strong>
          <span style={{ fontSize: 12, color: DK.soft, lineHeight: 1.7 }}>
            {ar ? "الشهور المغلقة تُقرأ من هنا. دورة هذا الشهر تبقى على تبويب المسير." : "Closed months are read here. This month’s cycle stays on the Run tab."}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "flex-end", gap: 16, flexShrink: 0 }}>
          {[
            { v: rows.length, l: ar ? "شهر" : "months" },
            { v: sent, l: ar ? "أُرسل مدى" : "Mudad sent", gold: true },
            ...(open ? [{ v: open, l: ar ? "لم يُغلق" : "still open" }] : []),
          ].map((f) => (
            <span key={f.l} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <strong style={{ ...MONO, fontSize: 26, fontWeight: 700, lineHeight: 1, color: "#fff" }}>{f.v}</strong>
              <span style={{ fontSize: 11, color: DK.faint }}>{f.l}</span>
            </span>
          ))}
        </span>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>{ar ? "اقرأ شهراً" : "Read a month"}</span>
        <div style={{ width: 188 }}>
          <PlatformDateField
            compact
            granularity="month"
            ar={ar}
            value={month}
            max={shiftMonthKey(liveMonth, -1)}
            allowClear={false}
            onChange={(next) => next && onMonth(next)}
          />
        </div>
      </div>

      {isLive ? (
        <div style={{ padding: "16px 18px", fontSize: 12.5, color: MUTED, lineHeight: 1.8, borderBottom: `1px solid ${BORDER}` }}>
          {ar ? `${monthLabel(liveMonth, ar)} دورة حية. اعمل عليها من تبويب المسير.` : `${monthLabel(liveMonth, ar)} is the live cycle. Work it from the Run tab.`}
        </div>
      ) : selected ? (
        <div data-payroll-selected="1" style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          {[
            { label: ar ? "الشهر" : "Month", value: monthLabel(selected.month, ar) },
            { label: ar ? "الحالة" : "Status", value: runStatus(selected, ar) },
            { label: ar ? "الموظفون" : "People", value: String(selected.heads), mono: true },
            { label: ar ? "مدفوع" : "Paid", value: `${selected.paid}/${selected.heads}`, mono: true },
            { label: ar ? "الصافي" : "Net", value: selected.total, mono: true },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 10, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...(item.mono ? MONO : null), textAlign: "start" }}>{item.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "16px 18px", fontSize: 12.5, color: MUTED, lineHeight: 1.8, borderBottom: `1px solid ${BORDER}` }}>
          {ar ? `لا مسير محفوظ لـ ${monthLabel(month, ar)}. الشهور التي أُغلقت تظهر أدناه.` : `No saved run for ${monthLabel(month, ar)}. Closed months appear below.`}
        </div>
      )}

      <div style={{ padding: "6px 16px 16px", display: "flex", flexDirection: "column", gap: 14, background: SURFACE }}>
        {groups.length === 0 ? (
          <div data-archive-empty="1" style={{ padding: "30px 8px", textAlign: "center", fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
            {ar ? "لا مسيرات مؤرشفة بعد. ما يُعتمد أو يُرسل أو يجاوز شهره ينتقل إلى هنا بتاريخه." : "No archived runs yet. What is approved, sent, or past its month moves here with its date."}
          </div>
        ) : groups.map((group) => (
          <div key={group.year} data-archive-month={group.year} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px 4px" }}>
              <strong style={{ ...MONO, fontSize: 13.5, color: "var(--nv-ink)" }}>{group.year}</strong>
              <span aria-hidden style={{ height: 1, flex: 1, background: BORDER }} />
              <span style={{ ...MONO, fontSize: 11.5, color: MUTED }}>{group.items.length}</span>
            </div>
            {group.items.map((row) => {
              const on = row.month === month;
              const tone = TONE[runTone(row)];
              return (
                <button
                  key={row.month}
                  type="button"
                  data-archive-row={row.month}
                  aria-pressed={on}
                  onClick={() => onMonth(row.month)}
                  className="nv-archive-row"
                  style={{ position: "relative", display: "grid", gridTemplateColumns: "54px minmax(0, 1fr)", gap: 12, width: "100%", padding: "11px 14px", borderRadius: 12, border: `1px solid ${on ? "#0B3D27" : BORDER}`, background: CARD, color: NAVY, textAlign: "start", cursor: "pointer", font: "inherit" }}
                >
                  <span aria-hidden style={{ position: "absolute", insetInlineStart: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, background: tone.dot }} />
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 10, background: on ? "#0B3D27" : "var(--nv-soft)", color: on ? "#fff" : "var(--nv-ink)", border: "1px solid var(--nv-line2, #EEF1EF)", padding: "6px 0" }}>
                    <strong style={{ ...MONO, fontSize: 18, lineHeight: 1.1 }}>{String(row.month).slice(5, 7)}</strong>
                    <span style={{ ...MONO, fontSize: 10.5, opacity: 0.7 }}>{String(row.month).slice(0, 4)}</span>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{monthLabel(row.month, ar)}</strong>
                      <span style={{ display: "inline-flex", alignItems: "center", height: 21, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: tone.ink, background: tone.bg, border: `1px solid ${tone.line}` }}>{runStatus(row, ar)}</span>
                      <span style={{ marginInlineStart: "auto", fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}><span style={MONO}>{row.total}</span></span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>
                      {ar ? "مدفوع " : "Paid "}<span style={MONO}>{row.paid}/{row.heads}</span>{ar ? " موظف" : " people"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

export { shiftMonthKey };
