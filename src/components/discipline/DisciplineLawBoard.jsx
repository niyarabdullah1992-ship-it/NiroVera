import React, { useState } from "react";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { deriveDisciplineLawBoard } from "@/lib/disciplineBoard";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "7px 12px",
    border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
    background: on ? "var(--nv-navy)" : "var(--nv-card)",
    color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

export default function DisciplineLawBoard({ cases, employees, ar, today }) {
  const [filter, setFilter] = useState("all");
  const board = deriveDisciplineLawBoard({ cases, employees, ar, today, filter });

  return (
    <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontFamily: "'Noto Naskh Arabic',serif", fontSize: 19, fontWeight: 600 }}>
            {ar ? "أنظمة الوزارة — التأديب في نظام العمل" : "Ministry rules — discipline in the Labour Law"}
          </span>
          <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.85 }}>{board.note}</span>
        </div>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
          {board.filters.map((row) => (
            <button key={row.id} type="button" onClick={() => setFilter(row.id)} style={chip(filter === row.id)}>
              {row.label}
            </button>
          ))}
        </span>
      </div>
      {board.rows.map((row) => (
        <div
          key={row.id}
          style={{
            padding: "15px 20px",
            borderBottom: "1px solid var(--nv-line2)",
            display: "grid",
            gridTemplateColumns: "78px minmax(0,1fr)",
            gap: 16,
            alignItems: "start",
            background: row.rowBg,
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 17, fontWeight: 500, color: row.numColor }}>{row.art}</span>
            <span style={{ fontSize: 10, color: "var(--nv-muted)" }}>{row.art === "—" || row.art === "قاعدة" || row.art === "Rule" ? (ar ? "قاعدة" : "Rule") : (ar ? "مادة" : "Art.")}</span>
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{row.head}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: row.tagColor, background: row.tagBg, border: `1px solid ${row.tagBorder}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
                {row.tag}
              </span>
            </span>
            {row.text ? <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.95 }}>{row.text}</span> : null}
            <LaborArticleCite ruleId={row.id} ar={ar} />
            <span style={{ fontSize: 11, color: "var(--nv-ink2)", background: "var(--nv-soft)", border: "1px solid var(--nv-line3)", borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>
              {row.applied}
            </span>
          </span>
        </div>
      ))}
      <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 7 }}>
        <span style={{ fontSize: 11, color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)", border: "1px solid var(--nv-warn-line)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.9 }}>
          {ar
            ? "أرقام المواد ونصوصها مرجعها نظام العمل كما نُشر. تُطابَق مع النص الرسمي قبل التشغيل، والمنصة تعرضها ولا تُفتي بها."
            : "Article numbers and wording follow the Labour Law as published. They are matched to the official text before go-live; the platform displays them and does not give a fatwa."}
        </span>
        <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.95 }}>
          {ar
            ? "ما لا تنصّ عليه اللائحة لا يُوقَّع جزاء عليه. وكل مانع في هذا القسم مربوط بمادّته أعلاه ويُعرض بسببه لا يُعطَّل صامتاً."
            : "What the regulations do not name is not signed. Every block in this section is tied to its article above and writes its reason."}
        </span>
      </div>
    </section>
  );
}
