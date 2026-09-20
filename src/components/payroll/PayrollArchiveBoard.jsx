import React, { useMemo } from "react";
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

  return (
    <section className="nv-paper" style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "أرشيف المسير" : "Wage-run archive"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            {ar
              ? "الشهور المغلقة تُقرأ من هنا. دورة هذا الشهر تبقى على تبويب المسير — لا تُقلَّب من الهيدر."
              : "Closed months are read here. This month’s cycle stays on the Run tab — it is not flipped from the header."}
          </span>
        </div>
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
        <div style={{ padding: "18px 20px", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
          {ar
            ? `${monthLabel(liveMonth, ar)} دورة حية. اعمل عليها من تبويب المسير.`
            : `${monthLabel(liveMonth, ar)} is the live cycle. Work it from the Run tab.`}
        </div>
      ) : selected ? (
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          {[
            { label: ar ? "الشهر" : "Month", value: monthLabel(selected.month, ar) },
            { label: ar ? "الحالة" : "Status", value: runStatus(selected, ar) },
            { label: ar ? "الموظفون" : "People", value: String(selected.heads) },
            { label: ar ? "مدفوع" : "Paid", value: `${selected.paid}/${selected.heads}` },
            { label: ar ? "الصافي" : "Net", value: selected.total },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 10, color: MUTED }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "18px 20px", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
          {ar
            ? `لا مسير محفوظ لـ ${monthLabel(month, ar)}. الشهور التي أُغلقت تظهر في القائمة أدناه.`
            : `No saved run for ${monthLabel(month, ar)}. Closed months appear in the list below.`}
        </div>
      )}

      {groups.length === 0 ? (
        <div style={{ padding: "18px 20px", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
          {ar
            ? "لا مسيرات مؤرشفة بعد. ما يُعتمد أو يُرسل أو يجاوز شهره ينتقل إلى هنا بتاريخه."
            : "No archived runs yet. What is approved, sent, or past its month moves here with its date."}
        </div>
      ) : groups.map((group) => (
        <div key={group.year} style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ padding: "10px 20px", background: SURFACE, display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{group.year}</span>
            <span style={{ marginInlineStart: "auto", fontSize: 11, color: MUTED }}>{group.items.length}</span>
          </div>
          {group.items.map((row) => {
            const on = row.month === month;
            return (
              <button
                key={row.month}
                type="button"
                onClick={() => onMonth(row.month)}
                style={{
                  display: "grid",
                  width: "100%",
                  gridTemplateColumns: "minmax(0,1.4fr) minmax(88px,0.8fr) minmax(72px,0.7fr) minmax(88px,auto)",
                  gap: 12,
                  padding: "12px 20px",
                  border: "none",
                  borderTop: `1px solid ${BORDER}`,
                  background: on ? SURFACE : CARD,
                  color: NAVY,
                  textAlign: "inherit",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: on ? 700 : 500 }}>{monthLabel(row.month, ar)}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{runStatus(row, ar)}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{row.paid}/{row.heads}</span>
                <span dir="ltr" style={{ fontSize: 12, fontWeight: 600 }}>{row.total}</span>
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}

export { shiftMonthKey };
