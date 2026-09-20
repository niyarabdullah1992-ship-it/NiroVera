import React, { useState } from "react";
import { Link } from "react-router-dom";
import { collectDisciplineArchive, countAr } from "@/lib/disciplineBoard";

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

export default function DisciplineArchiveBoard({
  cases,
  employees,
  stations,
  ar,
  today,
  selfOnly,
  userId,
}) {
  const [filter, setFilter] = useState("all");
  const archive = collectDisciplineArchive({
    cases,
    employees,
    stations,
    ar,
    today,
    filter,
    selfOnly,
    userId,
  });

  const filters = [
    ["all", ar ? "الكل" : "All"],
    ["cut", ar ? "بحسم" : "With a cut"],
    ["warn", ar ? "بلا حسم" : "No cut"],
    ["objected", ar ? "قُرّر في اعتراضه" : "Ruled on objection"],
  ];

  return (
    <section className="nv-paper" style={{ background: "#fff", border: "1px solid #DFE3EA", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "أرشيف الجزاءات" : "Sanctions archive"}</span>
          <span style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>{archive.note}</span>
        </div>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
          {filters.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} style={chip(filter === id)}>{label}</button>
          ))}
        </span>
      </div>
      {archive.groups.length === 0 ? (
        <div style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.9 }}>
            {ar
              ? "لا ملفات مستقرّة بعد. ما يُوقَّع أو يُحفَظ أو يُقرَّر فيه اعتراض ينتقل إلى الأرشيف بتاريخه ومرجعه."
              : "No settled files yet. What is signed, filed, or ruled on after an objection moves here with its date and reference."}
          </span>
        </div>
      ) : archive.groups.map((group) => (
        <div key={group.year} style={{ borderBottom: "1px solid #EEF0F4" }}>
          <div style={{ padding: "10px 20px", background: "#FAFBFC", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{group.title}</span>
            <span style={{ marginInlineStart: "auto", fontSize: 11, color: "#6B7280" }}>{group.count}</span>
          </div>
          {group.rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.7fr) minmax(96px,1fr) minmax(0,1.2fr) minmax(84px,auto)",
                gap: 12,
                padding: "12px 20px",
                alignItems: "start",
                borderBottom: "1px solid #F7F8FA",
                borderInlineEnd: `3px solid ${row.accent}`,
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                {row.href ? (
                  <Link to={row.href} style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.6, color: "#14213D", textDecoration: "none" }}>{row.title}</Link>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.6 }}>{row.title}</span>
                )}
                <span style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.75 }}>{row.meta}</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: row.stColor, background: row.stBg, border: `1px solid ${row.stBorder}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", justifySelf: "start", alignSelf: "start", height: "fit-content" }}>
                {row.state}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                {row.payrollHref ? (
                  <Link to={row.payrollHref} style={{ fontSize: 10, color: "#6B7280", textDecoration: "none" }}>{row.refTag}</Link>
                ) : (
                  <span style={{ fontSize: 10, color: "#6B7280" }}>{row.refTag}</span>
                )}
                <span style={{ fontSize: 10, color: "#4B5567", lineHeight: 1.75, minWidth: 0 }}>{row.ref}</span>
              </span>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#4B5567", whiteSpace: "nowrap", textAlign: "end" }}>{row.at}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ padding: "13px 20px", fontSize: 11, color: "#4B5567", lineHeight: 1.95 }}>
        {ar
          ? `مرتّب بالسنة ثم بالتاريخ، ولا يُحذف منه ملف. المعروض هنا ما استقرّ — وما زال في المسار يبقى في وجهه. الجزاء يُمحى من سجل الموظف الظاهر بعد سنة من توقيعه ويبقى في أرشيف الشركة.`
          : `Sorted by year then date. Nothing is deleted. What you see here has settled — open files stay on their face. A sanction drops off the employee's visible record one year after signing, and stays in the company archive.`}
        {archive.rows.length ? ` ${ar ? countAr(archive.rows.length, "ملف واحد معروض", "ملفان معروضان", "ملفات معروضة", "ملفاً معروضاً") : `${archive.rows.length} shown.`}` : ""}
      </div>
    </section>
  );
}
