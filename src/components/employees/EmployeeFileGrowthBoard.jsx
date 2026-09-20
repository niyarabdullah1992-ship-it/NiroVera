import React from "react";
import { Link } from "react-router-dom";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";

const paper = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)", overflow: "hidden", display: "flex", flexDirection: "column" };

export default function EmployeeFileGrowthBoard({ view, ar }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: 16, alignItems: "stretch" }}>
      <section className="nv-doc" style={paper}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "التدرّج الوظيفي" : "Progression"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{ar ? "التعيين والنقل والترقية بتواريخها ومن أجراها." : "Hire, transfer and promotion — dated and named."}</span>
        </div>
        {(view.growth || []).length === 0 ? (
          <div style={{ padding: "16px 20px", fontSize: 12, color: MUTED }}>{ar ? "لا حركة مثبتة بعد." : "No written movement yet."}</div>
        ) : view.growth.map((row) => (
          <div key={`${row.t}-${row.at}-${row.move}`} style={{ padding: "13px 20px", borderBottom: "1px solid #F7F8FA", borderInlineEnd: `3px solid ${row.dot}`, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 0, color: NAVY }}>{row.t} — {row.move}</span>
              <span style={{ fontSize: 11, color: "#4B5567", whiteSpace: "nowrap" }}>{row.at}</span>
            </div>
            {row.note ? <span style={{ fontSize: 11, color: "#4B5567", lineHeight: 1.8 }}>{row.note}</span> : null}
            <span style={{ fontSize: 10, color: MUTED }}>{ar ? `أجراها ${row.by}` : `By ${row.by}`}</span>
          </div>
        ))}
      </section>

      <section className="nv-doc" style={paper}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "الجزاءات التأديبية" : "Disciplinary sanctions"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{ar ? "لا جزاء بلا إبلاغ وتحقيق وسماع دفاع." : "No sanction without notice, investigation and a hearing."}</span>
          </div>
          <Link
            to="/app/discipline"
            style={{ marginInlineStart: "auto", fontSize: 10, fontWeight: 600, color: "#4B5567", background: "#F5F6F8", border: "1px solid #E6E9EF", borderRadius: 9, padding: "2px 9px", whiteSpace: "nowrap", textDecoration: "none" }}
          >
            {ar ? "مسار المواد 66–73 ←" : "Articles 66–73 path →"}
          </Link>
        </div>
        {(view.penalties || []).length === 0 ? (
          <div style={{ padding: "16px 20px", fontSize: 12, color: MUTED }}>{ar ? "لا جزاء على سجل الموظف الظاهر." : "No sanction on the visible record."}</div>
        ) : view.penalties.map((row) => (
          <div key={`${row.t}-${row.at}`} style={{ padding: "13px 20px", borderBottom: "1px solid #F7F8FA", background: row.bg, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{row.t}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#4B5567", background: "#fff", border: `1px solid ${row.border}`, borderRadius: 9, padding: "1px 7px" }}>{row.art}</span>
              </span>
              <span style={{ fontSize: 11, color: "#4B5567", whiteSpace: "nowrap" }}>{row.at}</span>
            </div>
            {row.reason ? <span style={{ fontSize: 11, color: "#3C4657", lineHeight: 1.85 }}>{row.reason}</span> : null}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: row.color }}>{row.state}</span>
              <span style={{ fontSize: 10, color: MUTED }}>{row.wageEff}</span>
              <span style={{ fontSize: 10, color: MUTED }}>{ar ? `وقّعها ${row.by}` : `Signed by ${row.by}`}</span>
            </div>
          </div>
        ))}
        <div style={{ padding: "13px 20px", fontSize: 11, color: "#4B5567", lineHeight: 1.9 }}>{view.penaltyNote}</div>
      </section>
    </div>
  );
}
