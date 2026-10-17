import React from "react";

/**
 * Attendance chrome — one green head that names the lane (مساحة الموظف / الإدارة)
 * and the page, then the day's work. Lane pages live in the top strip, not here.
 */
export default function AttendanceSectionFrame({
  ar,
  lane = "mine",
  title,
  hint,
  meta = null,
  laneBar = null,
  section = null,
  maxWidth = 1320,
  children,
}) {
  const manage = lane === "manage";
  return (
    <div className="nv-att-frame" data-att-lane={manage ? "manage" : "mine"} style={{ width: `min(${maxWidth}px, 100%)`, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <header
        className="nv7-section-head nv-att-hero"
        data-sec-head="1"
        style={{
          background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)",
          borderRadius: 12,
          padding: "16px 20px",
          boxShadow: "0 6px 18px rgba(6,61,38,.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          color: "#fff",
          textAlign: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: "1 1 260px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* The lane (الموظف / الإدارة) is named once, in the header chip — not repeated here. */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#A9CDB8", fontWeight: 600, fontSize: 11 }}>
              <span aria-hidden style={{ width: 12, height: 2, background: "#C8A45A", borderRadius: 8, display: "inline-block" }} />
              {section || (ar ? "الحضور والدوام" : "Time & attendance")}
            </span>
          </span>
          <h1 className="nv-h" style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.4, letterSpacing: 0 }}>{title}</h1>
          {hint ? <div style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "#C5DBCD", maxWidth: 720 }}>{hint}</div> : null}
        </div>
        {meta ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>{meta}</div> : null}
      </header>

      {laneBar}

      {children}
    </div>
  );
}
