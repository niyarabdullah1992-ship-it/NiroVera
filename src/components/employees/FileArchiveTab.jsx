import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import RightHint from "@/components/shared/RightHint";
import { ARCHIVE_GROUPS, buildFileArchive, filterFileArchive } from "@/lib/fileArchive";
import { contractSheet } from "@/lib/contractDocument";
import { printSheet } from "@/lib/printSheet";
import { regulationOf } from "@/lib/workRegulation";
import SanctionsElsewhereLink from "@/components/employees/SanctionsElsewhereLink";

const MUTED = "var(--nv-ink3)";
const INK = "var(--nv-ink)";
const ACTION = "var(--nv-ok-ink)";

const CHIP = {
  sealed: { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" },
  signed: { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" },
  uploaded: { color: "var(--nv-ink2)", background: "var(--nv-soft)" },
  ack: { color: "var(--nv-ink2)", background: "var(--nv-soft)" },
};

const actionStyle = { fontSize: 11.5, fontWeight: 700, color: ACTION, textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" };

function ArchiveLine({ row, ar, employee }) {
  const chip = CHIP[row.proof?.id] || CHIP.uploaded;
  const openLabel = ar ? "عرض" : "View";
  return (
    <li data-archive-item={row.id} style={{ padding: "11px 20px", borderTop: "1px solid var(--nv-line2, var(--nv-line))", display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "baseline" }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 220px" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.7, overflowWrap: "anywhere" }}>{row.title}</span>
        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, overflowWrap: "anywhere" }}>
          {row.type}
          {row.at && row.at !== "—" ? <>{" · "}<span style={{ color: INK }}>{row.at}</span></> : null}
          {row.by ? ` · ${row.by}` : ""}
        </span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...chip, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
          {row.proof?.label}
          {row.proof?.ref ? <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500, marginInlineStart: 4 }}>{row.proof.ref}</span> : null}
        </span>
        {row.open?.to ? <Link to={row.open.to} style={actionStyle}>{openLabel}</Link> : null}
        {row.open?.href ? <a href={row.open.href} target="_blank" rel="noopener noreferrer" style={actionStyle}>{openLabel}</a> : null}
        {row.verifyHref ? <a href={row.verifyHref} target="_blank" rel="noopener noreferrer" style={actionStyle}>{ar ? "تحقّق" : "Verify"}</a> : null}
        {row.print === "contract" ? (
          <button type="button" style={actionStyle} onClick={() => printSheet(contractSheet(employee?.profile?.contract?.model || {}, { ar: true, ref: employee?.id || "" }))}>{ar ? "اطبع" : "Print"}</button>
        ) : null}
        {row.downloadUrl ? <a href={row.downloadUrl} download target="_blank" rel="noopener noreferrer" style={actionStyle}>{ar ? "تنزيل" : "Download"}</a> : null}
      </span>
    </li>
  );
}

function MissingLine({ row, ar }) {
  return (
    <li data-archive-missing={row.id} style={{ padding: "10px 20px", borderTop: "1px solid var(--nv-line2, var(--nv-line))", display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: MUTED, flex: "1 1 200px", minWidth: 0 }}>{row.title} — {row.note}</span>
      <RightHint ar={ar} hint={row.hint} />
    </li>
  );
}

/** «أرشيف الملف»: the documents on this file, grouped by type. Edits stay on the file trail, not here. */
export default function FileArchiveTab({ employee, data, isSelf, managerView, ar }) {
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const archive = useMemo(() => buildFileArchive({
    employee,
    cases: data?.disciplinaryCases || [],
    assets: data?.assets || [],
    regulation: regulationOf(data),
    signatureRequests: data?.signatureRequests || [],
    signedDocuments: data?.signedDocuments || [],
    managerView: Boolean(managerView) && !isSelf,
    selfView: Boolean(isSelf),
    ar,
    profileHref: employee?.id ? `/app/employees/${employee.id}` : "",
  }), [employee, data, managerView, isSelf, ar]);
  const groups = filterFileArchive(archive, { group, query });
  const present = ARCHIVE_GROUPS.filter((g) => archive.groups.some((row) => row.id === g.id));
  const pill = (on) => ({
    fontFamily: "inherit",
    height: 28,
    padding: "0 11px",
    borderRadius: 999,
    border: on ? "none" : "1px solid var(--nv-line)",
    background: on ? "var(--nv-btn-fill, #3C7D50)" : "var(--nv-card)",
    color: on ? "var(--nv-btn-ink, #F4F7F5)" : INK,
    fontSize: 11.5,
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
  });

  return (
    <section data-file-archive="1" className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: INK }}>
            {isSelf ? (ar ? "أرشيف ملفي" : "My file archive") : (ar ? "أرشيف الملف" : "File archive")}
            {archive.count ? <span style={{ fontSize: 12, fontWeight: 600, color: INK, marginInlineStart: 8 }}>{archive.count}</span> : null}
          </div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.75, marginTop: 3 }}>
            {isSelf
              ? (ar
                ? "كل وثيقة على ملفك: العقد والشهادات والنسخ والإيصالات والإقرارات — بمصدرها وإثباتها."
                : "Every document on your file — contract, letters, copies, receipts and acknowledgements — with its source and proof.")
              : (ar
                ? "كل وثيقة على الملف: العقد والقرارات والشهادات والنسخ والإيصالات والإقرارات — بمصدرها وإثباتها."
                : "Every document on the file — contract, decisions, letters, copies, receipts and acknowledgements — with its source and proof.")}
          </div>
          {isSelf ? <div style={{ marginTop: 6 }}><SanctionsElsewhereLink ar={ar} /></div> : null}
        </div>
        {archive.groups.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <button type="button" style={pill(group === "all")} onClick={() => setGroup("all")} aria-pressed={group === "all"}>{ar ? "الكل" : "All"}</button>
            {present.map((g) => (
              <button key={g.id} type="button" style={pill(group === g.id)} onClick={() => setGroup(g.id)} aria-pressed={group === g.id}>{ar ? g.ar : g.en}</button>
            ))}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? "ابحث في الأرشيف" : "Search the archive"}
              aria-label={ar ? "ابحث في الأرشيف" : "Search the archive"}
              style={{ fontFamily: "inherit", height: 30, flex: "1 1 160px", minWidth: 0, maxWidth: 260, padding: "0 10px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: INK, fontSize: 12 }}
            />
          </div>
        ) : null}
      </div>
      {groups.length === 0 ? (
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--nv-line)", fontSize: 12, color: MUTED }}>
          {archive.empty ? archive.emptyLine : (ar ? "لا وثيقة تطابق البحث." : "No document matches.")}
        </div>
      ) : groups.map((g) => (
        <div key={g.id} data-archive-group={g.id}>
          <div style={{ padding: "10px 20px 6px", borderTop: "1px solid var(--nv-line)", fontSize: 11.5, fontWeight: 700, color: MUTED, display: "flex", gap: 6 }}>
            <span>{g.label}</span>
            {g.items.length ? <span style={{ color: INK }}>{g.items.length}</span> : null}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {g.items.map((row) => <ArchiveLine key={row.id} row={row} ar={ar} employee={employee} />)}
            {g.missing.map((row) => <MissingLine key={row.id} row={row} ar={ar} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}
