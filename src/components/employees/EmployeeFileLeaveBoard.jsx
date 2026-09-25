import React from "react";
import { Link } from "react-router-dom";
import { MUTED, NAVY } from "@/lib/platformStyles";

const paper = { background: "#fff", border: "1px solid #E4E9E6", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" };

export default function EmployeeFileLeaveBoard({ view, ar }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="nv-doc" style={paper}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "الإجازات — مجموعة بسلوكها" : "Leave — grouped by how it behaves"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>{view.leaveScope}</span>
          </div>
          <Link to="/app/requests/leave" style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 600, color: "var(--nv-ok-ink)", textDecoration: "none", whiteSpace: "nowrap" }}>
            {ar ? "قدّم من طلباتي" : "Raise from My Requests"}
          </Link>
        </div>
        {(view.leaveGroups || []).map((group) => (
          <div key={group.title} style={{ borderBottom: "1px solid var(--nv-line3)" }}>
            <div style={{ padding: "12px 20px 6px", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{group.title}</span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7, minWidth: 0 }}>{group.rule}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(110px,1.3fr) 62px minmax(0,1.5fr) minmax(0,1.2fr) minmax(0,1fr)", gap: 12, padding: "8px 20px", fontSize: 10, color: MUTED, background: "var(--nv-soft)", borderTop: "1px solid var(--nv-line2)", borderBottom: "1px solid var(--nv-line2)" }}>
              <span>{ar ? "النوع" : "Type"}</span>
              <span>{ar ? "المادة" : "Art."}</span>
              <span>{ar ? "الاستحقاق" : "Entitlement"}</span>
              <span>{ar ? "الأثر على الأجر" : "Wage effect"}</span>
              <span>{ar ? "الشرط" : "Condition"}</span>
            </div>
            {group.rows.map((row) => (
              <div key={`${group.title}-${row.name}`} style={{ display: "grid", gridTemplateColumns: "minmax(110px,1.3fr) 62px minmax(0,1.5fr) minmax(0,1.2fr) minmax(0,1fr)", gap: 12, padding: "11px 20px", alignItems: "start", borderBottom: "1px solid var(--nv-line2)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.6, minWidth: 0, color: NAVY }}>{row.name}</span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--nv-ink2)", textAlign: "end" }}>{row.art}</span>
                <span style={{ fontSize: 11, color: "#3C4657", lineHeight: 1.8, minWidth: 0 }}>{row.ent}</span>
                <span style={{ fontSize: 11, color: row.wageColor, lineHeight: 1.8, minWidth: 0 }}>{row.wage}</span>
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8, minWidth: 0 }}>{row.cond}</span>
              </div>
            ))}
          </div>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 0, alignItems: "stretch" }}>
        <section className="nv-doc" style={paper}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "الرصيد المثبت في الملف" : "Balance on the file"}</span>
          </div>
          {(view.balances || []).map((item) => (
            <div key={item.name} style={{ padding: "12px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{item.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--nv-ink2)", background: "var(--nv-mute-soft)", border: "1px solid var(--nv-mute-line)", borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>{item.art}</span>
                </span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--nv-ink2)", whiteSpace: "nowrap" }}>{item.val}</span>
              </div>
              <div style={{ height: 7, background: "var(--nv-line3)" }}>
                <div style={{ height: 7, width: item.pct, background: item.color }} />
              </div>
            </div>
          ))}
          <div style={{ padding: "12px 20px", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9 }}>{view.balanceNote}</div>
        </section>

        <section className="nv-doc" style={paper}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "إجازات مثبتة على الملف" : "Leave written on the file"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{view.filedNote}</span>
          </div>
          {view.hasPendingLeave ? (
            <Link
              to={view.pendingHref || "/app/requests/leave"}
              style={{ display: "block", padding: "12px 20px", fontSize: 12, fontWeight: 600, color: "#8A6516", lineHeight: 1.8, textDecoration: "none", borderBottom: view.noFiled ? "none" : "1px solid var(--nv-line2)" }}
            >
              {view.pendingPointer || (ar ? "طلب بانتظار القرار — الرد في طلباتي" : "A request is awaiting a decision — reply in My Requests")}
            </Link>
          ) : null}
          {view.noFiled ? (
            <div style={{ padding: "16px 20px", fontSize: 13, color: MUTED, lineHeight: 1.85 }}>
              {view.filedEmpty || (ar ? "لا توجد طلبات إجازة بعد" : "No leave written on the file yet")}
            </div>
          ) : (view.filed || []).map((row) => (
            <div key={`${row.type}-${row.meta}`} style={{ padding: "12px 20px", borderBottom: "1px solid var(--nv-line2)", borderInlineEnd: "3px solid #B9A27A", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{row.type}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--nv-ink2)", background: "var(--nv-mute-soft)", border: "1px solid var(--nv-mute-line)", borderRadius: 999, padding: "1px 7px" }}>{row.art}</span>
                </span>
                <span style={{ fontSize: 11, color: "var(--nv-ink2)", whiteSpace: "nowrap" }}>{row.days}</span>
              </div>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>{row.meta}</span>
              {row.hasAt ? (
                <span style={{ display: "flex", gap: 7, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: MUTED }}>{ar ? "تاريخ الاعتماد" : "Approved on"}</span>
                  <span style={{ fontSize: 10, color: "var(--nv-ink2)" }}>{row.atDate}</span>
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: MUTED }}>{row.atTime}</span>
                </span>
              ) : null}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
