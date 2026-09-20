import React, { useState } from "react";
import { Link } from "react-router-dom";
import { countAr } from "@/lib/disciplineBoard";
import { fmtVoiceDate } from "@/lib/voiceBoard";
import VoiceAuditTrail from "@/components/complaints/VoiceAuditTrail";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "7px 12px",
    border: `1px solid ${on ? "#14213D" : "#DFE3EA"}`,
    background: on ? "#14213D" : "#fff",
    color: on ? "#fff" : "#4B5567",
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

export default function VoiceArchiveBoard({ cards, ar, canManage }) {
  const [filter, setFilter] = useState("all");
  const rows = cards.filter((card) => card.settled && (filter === "all" || card.item.channel === filter));
  const filters = [
    ["all", ar ? "الكل" : "All"],
    ["suggestion", ar ? "اقتراحات" : "Suggestions"],
    ["complaint", ar ? "شكاوى" : "Complaints"],
    ["anonymous", ar ? "مجهولة" : "Anonymous"],
  ];

  return (
    <section className="nv-paper" style={{ background: "#fff", border: "1px solid #DFE3EA", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "الأرشيف" : "Archive"}</span>
          <span style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>
            {ar
              ? `${countAr(rows.length, "صوت واحد مستقرّ", "صوتان مستقرّان", "أصوات مستقرّة", "صوتاً مستقرّاً", "لا أصوات مستقرّة")}${canManage ? " في هذا الفرع" : " في أصواتك"} — لا يُحذف منها شيء.`
              : `${rows.length} settled voice(s)${canManage ? " on this station" : " of yours"} — nothing is deleted.`}
          </span>
        </div>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
          {filters.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} style={chip(filter === id)}>{label}</button>
          ))}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) minmax(104px,1fr) minmax(0,1.3fr) minmax(90px,auto)", gap: 12, padding: "10px 20px", background: "#FAFBFC", borderBottom: "1px solid #EEF0F4", fontSize: 11, color: "#6B7280" }}>
        <span>{ar ? "الصوت" : "Voice"}</span>
        <span>{ar ? "القرار" : "Ruling"}</span>
        <span>{ar ? "ما تغيّر" : "What changed"}</span>
        <span>{ar ? "التاريخ" : "Date"}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "18px 20px", fontSize: 11, color: "#6B7280", lineHeight: 1.9 }}>
          {ar
            ? "لا أصوات مؤرشفة بعد. ما يُعتمد أو يُعاد بملاحظة أو يُعالَج ينتقل إلى هنا بقراره وأثره."
            : "No archived voices yet. What is adopted, returned with a note, or handled moves here with its ruling."}
        </div>
      ) : rows.map((row) => (
        <div
          key={row.item.id}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.7fr) minmax(104px,1fr) minmax(0,1.3fr) minmax(90px,auto)",
            gap: 12,
            padding: "12px 20px",
            alignItems: "start",
            borderBottom: "1px solid #F7F8FA",
            borderInlineEnd: `3px solid ${row.accent}`,
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            {row.item.authorId ? (
              <Link to={`/app/employees/${encodeURIComponent(row.item.authorId)}`} style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.6, color: "#14213D", textDecoration: "none" }}>{row.title}</Link>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.6 }}>{row.title}</span>
            )}
            <span style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.75 }}>{row.meta}</span>
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: row.stColor, background: row.stBg, border: `1px solid ${row.stBorder}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", justifySelf: "start", alignSelf: "start", height: "fit-content" }}>{row.state}</span>
          <span style={{ fontSize: 11, color: "#4B5567", lineHeight: 1.8, minWidth: 0 }}>{row.reply || "—"}</span>
          <span style={{ fontSize: 11, color: "#4B5567", whiteSpace: "nowrap" }}>{fmtVoiceDate(row.item.closedAt || row.item.decidedAt || row.item.createdAt, ar)}</span>
          <div style={{ gridColumn: "1 / -1" }}>
            <VoiceAuditTrail events={row.audit} ar={ar} />
          </div>
        </div>
      ))}
      <div style={{ padding: "13px 20px", fontSize: 11, color: "#4B5567", lineHeight: 1.95 }}>
        {ar
          ? "لا يُحذف من الأرشيف صوت. والبلاغ المجهول يبقى مجهولاً فيه — يُحفظ قراره وأثره دون هويّة مُبلِّغه."
          : "Nothing is deleted. An anonymous report stays anonymous here — its ruling and effect are kept without the reporter's identity."}
      </div>
    </section>
  );
}
