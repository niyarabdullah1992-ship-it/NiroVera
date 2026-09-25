import React from "react";
import { CARD, MUTED, NAVY } from "@/lib/platformStyles";

const paper = {
  background: "#fff",
  border: "1px solid #E4E9E6",
  borderRadius: 14,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

export default function EmployeeFileSummary({ view, ar, onOpenTab }) {
  return (
    <div className="nv-emp-summary" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)", gap: 16, alignItems: "stretch" }}>
      <section style={paper}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "#111418" }}>{ar ? "الحقائق الحاكمة" : "Governing facts"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
            {ar ? "ستّ حقائق تجيب أكثر ما يُسأل عن الملف." : "Six facts that answer what is asked most about the file."}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 0 }}>
          {(view.facts || []).map((fact) => (
            <div key={fact.k} style={{ padding: "14px 18px", borderInlineStart: "1px solid #F2F4F7", borderBottom: "1px solid #F2F4F7", display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11, color: MUTED }}>{fact.k}</span>
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: NAVY }}>{fact.v}</span>
              <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.6 }}>{fact.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={paper}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "#111418" }}>{ar ? "ما يحتاج إجراءً" : "Needs action"}</span>
          <span style={{ marginInlineStart: "auto", fontSize: 11, color: MUTED }}>{view.todoNote}</span>
        </div>
        {(view.todos || []).length === 0 ? (
          <div style={{ padding: "16px 20px", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            {ar ? "لا نقص ولا تجديد معلّق على هذا الملف." : "No gap or renewal is pending on this file."}
          </div>
        ) : view.todos.map((item) => (
          <button
            key={`${item.tab}-${item.text}`}
            type="button"
            onClick={() => onOpenTab?.(item.tab)}
            style={{
              fontFamily: "inherit",
              textAlign: "start",
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 20px",
              border: "none",
              borderBottom: "1px solid var(--nv-line2)",
              background: CARD,
              cursor: "pointer",
              display: "grid",
              gridTemplateColumns: "auto minmax(0,1fr) auto",
              gap: 11,
              alignItems: "start",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.color, marginTop: 6 }} />
            <span style={{ fontSize: 12, color: NAVY, lineHeight: 1.8, minWidth: 0 }}>{item.text}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: item.color, whiteSpace: "nowrap" }}>{item.tag}</span>
          </button>
        ))}
        <div style={{ padding: "13px 20px", borderTop: "1px solid #EEF0F4", display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{ar ? "آخر التغييرات" : "Latest changes"}</span>
          {(view.auditTop || []).length === 0 ? (
            <span style={{ fontSize: 11, color: MUTED }}>{ar ? "لا حركة مثبتة بعد." : "No written movement yet."}</span>
          ) : view.auditTop.map((row) => (
            <div key={`${row.text}-${row.at}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 11, color: "#4B5567", lineHeight: 1.8, minWidth: 0 }}>{row.text}</span>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{row.at}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
