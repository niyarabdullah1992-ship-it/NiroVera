import React, { useState } from "react";
import { Link } from "react-router-dom";
import { collectRequestFiles, requestFileInFilter } from "@/lib/requestWorkspace";
import { chipButton, slab } from "@/components/schedules/scheduleChrome";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL } from "@/lib/platformStyles";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "7px 12px",
    border: `1px solid ${on ? NAVY_FILL : BORDER}`,
    background: on ? NAVY_FILL : CARD,
    color: on ? "#fff" : MUTED,
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
  };
}

const SCOPE_TITLE = {
  pending: ["ملفات الطلبات الجارية", "Files of open requests"],
  approved: ["ملفات الطلبات المعتمدة", "Files of approved requests"],
  rejected: ["ملفات الطلبات المرفوضة", "Files of refused requests"],
  archive: ["ملفات الأرشيف", "Archived files"],
};

/** Files follow طلباتي's filter: «بانتظار» shows open requests' files, «الأرشيف» the settled ones. */
export default function RequestFilesBoard({ employees, ar, filter: scope = "all" }) {
  const [filter, setFilter] = useState("all");
  const every = collectRequestFiles(employees, ar ? "ar" : "en");
  const all = every.filter((row) => requestFileInFilter(row, scope));
  const archivedN = every.filter((row) => requestFileInFilter(row, "archive") && !requestFileInFilter(row, "all")).length;
  const rows = all.filter((row) => filter === "all" || row.side === filter);
  const attached = all.filter((row) => row.side === "in").length;
  const issued = all.filter((row) => row.side === "out").length;

  // A filtered view with no files stays quiet — no empty box under the list.
  if (scope !== "all" && all.length === 0) return null;

  return (
    <section style={{ ...slab, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line3)", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
          <span className="nv-req-title" style={{ fontSize: 14 }}>{SCOPE_TITLE[scope] ? SCOPE_TITLE[scope][ar ? 0 : 1] : (ar ? "ملفات طلباتي" : "My request files")}</span>
          <span style={{ fontSize: 11, color: MUTED }}>
            {ar
              ? `${all.length} · ${attached} أرفقتها · ${issued} صدرت لك`
              : `${all.length} · ${attached} attached · ${issued} issued`}
          </span>
        </div>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[["all", ar ? "الكل" : "All"], ["in", ar ? "ما أرفقته" : "Attached"], ["out", ar ? "ما صدر لي" : "Issued"]].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} style={chipButton(filter === id)}>{label}</button>
          ))}
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "18px 20px", fontSize: 11, color: MUTED, lineHeight: 1.9 }}>
          {all.length === 0 && archivedN > 0
            ? (ar ? `لا ملفات لطلبات جارية. ملفات الطلبات المنتهية (${archivedN}) انتقلت إلى «الأرشيف».` : `No files on open requests. Files of settled requests (${archivedN}) moved to Archive.`)
            : all.length === 0
            ? (ar ? "لا ملفات بعد. ما ترفعه مع طلب وما يصدر لك من وثائق يظهر هنا ببصمته أو برقم تحققه — لا مجلّد مرفوعات عام." : "No files yet. What you attach and what the company issues appear here by fingerprint or verify id — not a general uploads folder.")
            : (ar ? "لا ملف في هذا الترشيح." : "Nothing in this filter.")}
        </div>
      ) : (
        <div style={{ overflow: "auto" }}>
          <div style={{ minWidth: 560, display: "grid", gridTemplateColumns: "minmax(0,1.7fr) 90px minmax(0,1.3fr) 80px", gap: 12, padding: "9px 18px", background: "var(--nv-mute-soft, var(--nv-soft))", borderBottom: "1px solid var(--nv-line3)", fontSize: 10.5, color: MUTED, fontWeight: 600, alignItems: "center" }}>
            <span>{ar ? "الملف" : "File"}</span>
            <span>{ar ? "نوعه" : "Kind"}</span>
            <span>{ar ? "مرجعه" : "Reference"}</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.id} style={{ minWidth: 560, display: "grid", gridTemplateColumns: "minmax(0,1.7fr) 90px minmax(0,1.3fr) 80px", gap: 12, padding: "11px 18px", borderBottom: "1px solid var(--nv-line3, var(--nv-soft))", alignItems: "center", fontSize: 12 }}>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <strong dir="auto" style={{ fontSize: 12, textAlign: "start", unicodeBidi: "plaintext", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name}>{row.name}</strong>
                <span style={{ fontSize: 10.5, color: MUTED }}>{row.meta}</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", width: "fit-content", color: row.side === "out" ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)", background: row.side === "out" ? "var(--nv-ok-soft)" : "var(--nv-warn-soft)", border: `1px solid ${row.side === "out" ? "var(--nv-ok-line)" : "var(--nv-warn-line)"}` }}>
                {ar ? row.kindAr : row.kindEn}
              </span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, color: MUTED }}>{row.refTag}</span>
                <span dir="ltr" style={{ font: "500 11px 'IBM Plex Mono', monospace", textAlign: "end", unicodeBidi: "isolate" }}>{row.ref}</span>
              </span>
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {row.downloadUrl ? (
                  <a href={row.downloadUrl} download={row.name} style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "none" }}>
                    {ar ? "نزّل" : "Download"}
                  </a>
                ) : null}
                <Link to={row.href || "/verify"} style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-ok-ink)", textDecoration: "none" }}>{ar ? "تحقّق ←" : "Verify ←"}</Link>
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: "13px 20px", fontSize: 11, color: MUTED, lineHeight: 1.95 }}>
        {ar
          ? "كل ملف هنا تابع لطلب. المستند الذي أرفقته تُحسب بصمته، والوثيقة التي أصدرتها الشركة تحمل رقم تحقق مربوطاً بها في صفحة التحقق."
          : "Every file here belongs to a request. An attachment is fingerprinted; an issued letter carries a verify id on the public verify page."}
      </div>
    </section>
  );
}
