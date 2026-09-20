import React from "react";
import { Link } from "react-router-dom";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";

function tabBtn(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? "#14213d" : "#dfe3ea"}`,
    background: on ? "#14213d" : "#fff",
    color: on ? "#fff" : "#4b5567",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

function KickerLine({ kicker }) {
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  const index = parts[0] || "";
  const rest = parts.slice(1).join(" · ");
  return (
    <span style={{ fontSize: 11, letterSpacing: ".14em", color: MUTED, display: "flex", gap: 7, alignItems: "center" }}>
      {index ? <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{index}</span> : null}
      {rest ? <span>·</span> : null}
      <span>{rest || kicker}</span>
    </span>
  );
}

/** HTML-faithful attendance chrome — two sharp slabs, then the day's work. */
export default function AttendanceSectionFrame({
  ar,
  kicker,
  tabs = [],
  tool,
  onTool,
  laneBar = null,
  children,
}) {
  return (
    <div className="nv-att-frame" style={{ width: "min(1320px, 100%)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <section
        className="nv-att-card"
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <KickerLine kicker={kicker} />
        <h1 className="nv-h" style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 700, color: NAVY, lineHeight: 1.35 }}>
          {ar ? "الحضور — مَن وأين" : "Attendance — who and where"}
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#4b5567", lineHeight: 1.85 }}>
          {ar ? (
            <>
              <Link to="/app/shifts" style={{ color: NAVY, fontWeight: 600 }}>جدول الدوام</Link>
              {" "}يقرّر · الحضور يلتقط ·{" "}
              <Link to="/app/calendar" style={{ color: NAVY, fontWeight: 600 }}>التقويم التشغيلي</Link>
              {" "}يثبت. هذه الشاشة لليوم الجاري.
            </>
          ) : (
            <>
              <Link to="/app/shifts" style={{ color: NAVY, fontWeight: 600 }}>The duty roster</Link>
              {" "}decides · attendance captures ·{" "}
              <Link to="/app/calendar" style={{ color: NAVY, fontWeight: 600 }}>the operational calendar</Link>
              {" "}confirms. This screen is for today.
            </>
          )}
        </p>
      </section>

      {laneBar}

      {tabs.length > 1 ? (
        <div className="nv-att-tabs" style={{ background: CARD, border: `1px solid ${BORDER}`, padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap" }}>
          {tabs.map((item) => {
            const on = tool === item.key;
            return (
              <button key={item.key} type="button" onClick={() => onTool?.(item.key)} style={tabBtn(on)}>
                {item.label}
                {item.count > 0 ? (
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                      background: on ? "#1d9a5b" : "#f5f6f8",
                      color: on ? "#fff" : "#4b5567",
                      padding: "1px 7px",
                      borderRadius: 999,
                    }}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {children}
    </div>
  );
}
