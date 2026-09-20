import React from "react";
import { Link } from "react-router-dom";
import { collectRequestInbox, derivedAlertCount, formatArDate, inboxNoticeShowsBody } from "@/lib/requestWorkspace";
import { CARD, MUTED, NAVY } from "@/lib/platformStyles";

function AlertBadge({ count, mark }) {
  const number = mark?.number || (count != null ? derivedAlertCount(count) : "");
  if (number === "" || number == null) return null;
  if (!mark?.number && derivedAlertCount(count) === 0) return null;
  return (
    <span
      dir="ltr"
      className="nv-req-alert-badge"
      title={mark?.label || String(number)}
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        fontWeight: 700,
        minWidth: 22,
        textAlign: "center",
        padding: "2px 7px",
        background: mark?.kind === "decision" ? "#8A1C2B" : (derivedAlertCount(count) ? "#8A6516" : "#14213D"),
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {number}
    </span>
  );
}

export default function RequestInboxSlab({ employees, notifications, userId, viewer, ar, ownOnly = false }) {
  const inbox = collectRequestInbox(employees, notifications, userId, ar ? "ar" : "en", { ownOnly, viewer: viewer || userId });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const fresh = inbox.filter((row) => String(row.at || "").slice(0, 10) === today).length;
  const total = inbox.length;

  return (
    <section style={{ background: CARD, border: "1px solid #dfe3ea", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #eef0f4", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "إشعاراتي" : "My notices"}</span>
        <AlertBadge count={total} />
        <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 600, color: fresh ? "#137a49" : MUTED }}>
          {fresh ? (ar ? `${fresh} جديد اليوم` : `${fresh} new today`) : (total ? (ar ? `${total} إشعار` : `${total} notices`) : (ar ? "لا إشعارات" : "No notices"))}
        </span>
      </div>
      {inbox.length === 0 ? (
        <div style={{ padding: "16px 20px", fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
          {ar ? "لا إشعارات. كل قرار على طلبك يصل هنا مع أثره وموضعه في المنصة." : "No notices. Every decision on your request lands here with its effect and place."}
        </div>
      ) : inbox.map((row) => (
        <div key={row.id} style={{ padding: "12px 20px", borderBottom: "1px solid #f7f8fa", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 10, alignItems: "baseline" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: row.color, minWidth: 0 }}>{row.head}</span>
            <AlertBadge mark={{ number: row.alertNumber, label: row.alertLabel, kind: row.decisionId ? "decision" : (row.article ? "article" : "") }} />
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED }}>{formatArDate(String(row.at || "").slice(0, 10), ar ? "ar" : "en")}</span>
          </div>
          {row.alertLabel ? (
            <span style={{ fontSize: 10, color: NAVY, fontWeight: 600 }}>{row.alertLabel}</span>
          ) : null}
          {inboxNoticeShowsBody(row) ? (
            <span style={{ fontSize: 11, color: "#3c4657", lineHeight: 1.9 }}>{row.body}</span>
          ) : null}
          <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {row.downloadUrl ? (
              <a href={row.downloadUrl} download style={{ fontSize: 11, fontWeight: 600, color: "#137a49", textDecoration: "none" }}>
                {ar ? "نزّل الوثيقة" : "Download the letter"}
              </a>
            ) : null}
            {row.linkLabel && row.href ? (
              <Link to={row.href} style={{ fontSize: 11, fontWeight: 600, color: "#137a49", textDecoration: "none" }}>{row.linkLabel} ←</Link>
            ) : null}
          </span>
        </div>
      ))}
    </section>
  );
}
