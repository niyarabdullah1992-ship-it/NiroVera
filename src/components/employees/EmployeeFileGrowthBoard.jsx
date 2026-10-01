import React from "react";
import { Link } from "react-router-dom";

const paper = { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" };

export default function EmployeeFileGrowthBoard({ view, ar }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: 16, alignItems: "stretch" }}>
      <section className="nv-doc" style={paper}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--nv-ink)", letterSpacing: 0 }}>{ar ? "التدرّج الوظيفي" : "Progression"}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--nv-ink2)", lineHeight: 1.75 }}>{ar ? "التعيين والنقل والترقية بتواريخها ومن أجراها." : "Hire, transfer and promotion — dated and named."}</span>
        </div>
        {(view.growth || []).length === 0 ? (
          <div style={{ padding: "16px 20px", fontSize: 13, fontWeight: 500, color: "var(--nv-ink2)" }}>{ar ? "لا حركة مثبتة بعد." : "No written movement yet."}</div>
        ) : view.growth.map((row) => (
          <div key={`${row.t}-${row.at}-${row.move}`} style={{ padding: "13px 20px", borderBottom: "1px solid var(--nv-line2)", borderInlineEnd: `3px solid ${row.dot}`, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, color: "var(--nv-ink)" }}>{row.t} — {row.move}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--nv-ink2)", whiteSpace: "nowrap" }}>{row.at}</span>
            </div>
            {row.note ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--nv-ink2)", lineHeight: 1.8 }}>{row.note}</span> : null}
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--nv-ink3)" }}>{ar ? `أجراها ${row.by}` : `By ${row.by}`}</span>
          </div>
        ))}
      </section>

      <section className="nv-doc" style={paper}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--nv-ink)", letterSpacing: 0 }}>{ar ? "الجزاءات التأديبية" : "Disciplinary sanctions"}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--nv-ink2)", lineHeight: 1.75 }}>{ar ? "لا جزاء بلا إبلاغ وتحقيق وسماع دفاع." : "No sanction without notice, investigation and a hearing."}</span>
          </div>
          <Link
            to="/app/discipline"
            style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: "var(--nv-ink)", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap", textDecoration: "none" }}
          >
            {ar ? "مسار المواد 66–73 ←" : "Articles 66–73 path →"}
          </Link>
        </div>
        {(view.penalties || []).length === 0 ? (
          <div style={{ padding: "16px 20px", fontSize: 13, fontWeight: 500, color: "var(--nv-ink2)" }}>{ar ? "لا جزاء على سجل الموظف الظاهر." : "No sanction on the visible record."}</div>
        ) : view.penalties.map((row) => (
          <div
            key={`${row.t}-${row.at}`}
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--nv-line2)",
              background: row.bg || "var(--nv-soft)",
              borderInlineStart: `3px solid ${row.border || "var(--nv-line)"}`,
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--nv-ink)" }}>{row.t}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ink)", background: "var(--nv-card)", border: `1px solid ${row.border || "var(--nv-line)"}`, borderRadius: 999, padding: "2px 8px" }}>{row.art}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)", whiteSpace: "nowrap" }}>{row.at}</span>
            </div>
            {row.reason ? (
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nv-ink)", lineHeight: 1.75 }}>
                {row.reason}
              </span>
            ) : null}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: row.color || "var(--nv-warn-ink)" }}>{row.state}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{row.wageEff}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{ar ? `وقّعها ${row.by}` : `Signed by ${row.by}`}</span>
            </div>
          </div>
        ))}
        <div style={{ padding: "14px 20px", fontSize: 12, fontWeight: 500, color: "var(--nv-ink2)", lineHeight: 1.85 }}>{view.penaltyNote}</div>
      </section>
    </div>
  );
}
