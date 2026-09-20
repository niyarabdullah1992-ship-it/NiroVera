import React, { useState } from "react";
import { Link } from "react-router-dom";
import { collectRequestFiles } from "@/lib/requestWorkspace";
import { CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "7px 12px",
    border: `1px solid ${on ? "#14213d" : "#dfe3ea"}`,
    background: on ? "#14213d" : "#fff",
    color: on ? "#fff" : MUTED,
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
  };
}

export default function RequestFilesBoard({ employees, ar }) {
  const [filter, setFilter] = useState("all");
  const all = collectRequestFiles(employees, ar ? "ar" : "en");
  const rows = all.filter((row) => filter === "all" || row.side === filter);
  const attached = all.filter((row) => row.side === "in").length;
  const issued = all.filter((row) => row.side === "out").length;

  return (
    <section style={{ background: CARD, border: "1px solid #dfe3ea", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #eef0f4", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "ملفات طلباتي" : "My request files"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            {ar
              ? `${all.length} · ${attached} أرفقتها · ${issued} صدرت لك`
              : `${all.length} · ${attached} attached · ${issued} issued`}
          </span>
        </div>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[["all", ar ? "الكل" : "All"], ["in", ar ? "ما أرفقته" : "Attached"], ["out", ar ? "ما صدر لي" : "Issued"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} style={chip(filter === id)}>{label}</button>
          ))}
        </span>
      </div>
      {rows.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) max-content minmax(0,1.5fr) auto", gap: 12, padding: "10px 20px", fontSize: 11, color: MUTED, background: SURFACE, borderBottom: "1px solid #eef0f4", alignItems: "center" }}>
          <span>{ar ? "الملف" : "File"}</span>
          <span>{ar ? "نوعه" : "Kind"}</span>
          <span>{ar ? "مرجعه" : "Reference"}</span>
          <span />
        </div>
      ) : null}
      {rows.length === 0 ? (
        <div style={{ padding: "18px 20px", fontSize: 11, color: MUTED, lineHeight: 1.9 }}>
          {all.length === 0
            ? (ar ? "لا ملفات بعد. ما ترفعه مع طلب وما يصدر لك من وثائق يظهر هنا ببصمته أو برقم تحققه — لا مجلّد مرفوعات عام." : "No files yet. What you attach and what the company issues appear here by fingerprint or verify id — not a general uploads folder.")
            : (ar ? "لا ملف في هذا الترشيح." : "Nothing in this filter.")}
        </div>
      ) : rows.map((row) => (
        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) max-content minmax(0,1.5fr) auto", gap: 12, padding: "12px 20px", borderBottom: "1px solid #f7f8fa", alignItems: "center" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{row.name}</span>
            <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.7 }}>{row.meta}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 600, color: row.side === "out" ? "#137a49" : "#8a6516", background: row.side === "out" ? "#f2faf6" : "#fdf6e8", border: `1px solid ${row.side === "out" ? "#bfe6d2" : "#ecd9a8"}`, padding: "2px 8px", alignSelf: "center", justifySelf: "start", whiteSpace: "nowrap", lineHeight: 1.4, width: "max-content", height: "fit-content" }}>
            {ar ? row.kindAr : row.kindEn}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: MUTED }}>{row.refTag}</span>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED, wordBreak: "break-all" }}>{row.ref}</span>
          </span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {row.downloadUrl ? (
              <a href={row.downloadUrl} download={row.name} style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "none" }}>
                {ar ? "نزّل" : "Download"}
              </a>
            ) : null}
            <Link to={row.href || "/verify"} style={{ fontSize: 11, fontWeight: 600, color: "#137a49", textDecoration: "none" }}>{ar ? "تحقّق ←" : "Verify ←"}</Link>
          </span>
        </div>
      ))}
      <div style={{ padding: "13px 20px", fontSize: 11, color: MUTED, lineHeight: 1.95 }}>
        {ar
          ? "كل ملف هنا تابع لطلب. المستند الذي أرفقته تُحسب بصمته، والوثيقة التي أصدرتها الشركة تحمل رقم تحقق مربوطاً بها في صفحة التحقق."
          : "Every file here belongs to a request. An attachment is fingerprinted; an issued letter carries a verify id on the public verify page."}
      </div>
    </section>
  );
}
