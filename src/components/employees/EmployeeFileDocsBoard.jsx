import React from "react";
import { Link } from "react-router-dom";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";

const paper = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)", overflow: "hidden", display: "flex", flexDirection: "column" };

export default function EmployeeFileDocsBoard({ view, ar }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="nv-doc" style={paper}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "الوثائق والشهادات" : "Documents and certificates"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{view.docsScope}</span>
          </div>
          <Link to="/app/requests" style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 600, color: "#137A49", textDecoration: "none", whiteSpace: "nowrap" }}>
            {ar ? "اطلب وثيقة من طلباتي ←" : "Request a letter from My requests →"}
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1.6fr) minmax(0,1fr) minmax(90px,1fr) minmax(88px,1fr)", gap: 12, padding: "10px 20px", fontSize: 11, color: MUTED, background: "#FAFBFC", borderBottom: "1px solid #EEF0F4" }}>
          <span>{ar ? "الوثيقة" : "Document"}</span>
          <span>{ar ? "المرجع" : "Reference"}</span>
          <span>{ar ? "الانتهاء" : "Ends"}</span>
          <span>{ar ? "الحالة" : "State"}</span>
        </div>
        {(view.docs || []).length === 0 ? (
          <div style={{ padding: "16px 20px", fontSize: 12, color: MUTED }}>{ar ? "لا وثيقة مؤرّخة على الملف." : "No dated document on the file."}</div>
        ) : view.docs.map((row) => (
          <div key={`${row.name}-${row.ref}`} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1.6fr) minmax(0,1fr) minmax(90px,1fr) minmax(88px,1fr)", gap: 12, padding: "11px 20px", alignItems: "center", borderBottom: "1px solid #F7F8FA" }}>
            <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.6, minWidth: 0, color: NAVY }}>{row.name}</span>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#4B5567", textAlign: "end", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.ref}</span>
            <span style={{ fontSize: 11, color: "#4B5567", whiteSpace: "nowrap" }}>{row.exp}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: row.color, whiteSpace: "nowrap" }}>{row.state}</span>
          </div>
        ))}
        <div style={{ padding: "13px 20px", fontSize: 11, color: "#4B5567", lineHeight: 1.9 }}>{view.docsNote}</div>
      </section>

      <section className="nv-doc" style={{ ...paper, marginTop: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "العهد والأصول" : "Custody and assets"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{ar ? "ما بحوزة الموظف وما أُعيد — يُستعاد في إخلاء الطرف." : "What is in hand and what was returned — recovered at clearance."}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1.6fr) minmax(0,1fr) minmax(90px,1fr) minmax(80px,1fr)", gap: 12, padding: "10px 20px", fontSize: 11, color: MUTED, background: "#FAFBFC", borderBottom: "1px solid #EEF0F4" }}>
          <span>{ar ? "العهدة" : "Item"}</span>
          <span>{ar ? "الرقم" : "Ref"}</span>
          <span>{ar ? "تاريخ التسليم" : "Handed"}</span>
          <span>{ar ? "الحالة" : "State"}</span>
        </div>
        {(view.custody || []).length === 0 ? (
          <div style={{ padding: "16px 20px", fontSize: 12, color: MUTED }}>{ar ? "لا عهدة مسجّلة بحوزته." : "No custody item is assigned."}</div>
        ) : view.custody.map((row) => (
          <div key={`${row.name}-${row.ref}`} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1.6fr) minmax(0,1fr) minmax(90px,1fr) minmax(80px,1fr)", gap: 12, padding: "11px 20px", alignItems: "center", borderBottom: "1px solid #F7F8FA" }}>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 0, color: NAVY }}>{row.name}</span>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#4B5567", textAlign: "end" }}>{row.ref}</span>
            <span style={{ fontSize: 11, color: "#4B5567", whiteSpace: "nowrap" }}>{row.at}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: row.color, whiteSpace: "nowrap" }}>{row.state}</span>
          </div>
        ))}
        <div style={{ padding: "13px 20px", fontSize: 11, color: "#4B5567", lineHeight: 1.9 }}>{view.custodyNote}</div>
      </section>
    </div>
  );
}
