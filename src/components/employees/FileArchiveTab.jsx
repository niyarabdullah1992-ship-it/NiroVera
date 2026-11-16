import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import RightHint from "@/components/shared/RightHint";
import { ARCHIVE_GROUPS, buildFileArchive, filterFileArchive } from "@/lib/fileArchive";
import { contractSheet } from "@/lib/contractDocument";
import { printSheet } from "@/lib/printSheet";
import { regulationOf } from "@/lib/workRegulation";
import SanctionsElsewhereLink from "@/components/employees/SanctionsElsewhereLink";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import { fileChangeArchiveItems } from "@/lib/fileChangeTrail";

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

/** «سجل التعديلات»: every change on the file — what, who, and the day, month and year — in the shared archive. */
function FileChangeTrail({ employee, isSelf, ar }) {
  const items = useMemo(() => fileChangeArchiveItems(employee, ar), [employee, ar]);
  return (
    <RecordSmartArchive
      items={items}
      lang={ar ? "ar" : "en"}
      dir={ar ? "rtl" : "ltr"}
      kicker={ar ? "سجل زمني" : "Timeline"}
      title={isSelf ? (ar ? "التعديلات على ملفي" : "Changes on my file") : (ar ? "سجل تعديلات الملف" : "File change log")}
      subtitle={ar
        ? `${items.length} تحديث على الملف — ما الذي تغيّر، ومن قام به، وفي أي يوم وشهر وسنة. ما يُسجَّل في الأقسام الأخرى يبقى فيها. لا يُحذف منه شيء.`
        : `${items.length} changes — what changed, who did it, and when. Nothing is deleted.`}
      emptyLabel={ar ? "لا تعديلات مسجّلة على الملف بعد." : "No changes recorded on the file yet."}
      searchPlaceholder={ar ? "ابحث في التعديلات…" : "Search changes…"}
      exportName={ar ? `سجل-تعديلات-${employee?.name || "الملف"}` : `file-changes-${employee?.id || ""}`}
      renderOpen={(item) => (
        <div data-file-change={item.id} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, borderTop: "1px solid var(--nv-line)" }}>
          <span style={{ fontSize: 12, color: MUTED }}>{ar ? "قام به" : "By"}: <strong style={{ color: INK }}>{item.by}</strong></span>
          {item.changes?.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: MUTED, textAlign: ar ? "right" : "left" }}>
                  <th style={{ padding: "4px 6px", fontWeight: 600 }}>{ar ? "الحقل" : "Field"}</th>
                  <th style={{ padding: "4px 6px", fontWeight: 600 }}>{ar ? "قبل" : "Before"}</th>
                  <th style={{ padding: "4px 6px", fontWeight: 600 }}>{ar ? "بعد" : "After"}</th>
                </tr>
              </thead>
              <tbody>
                {item.changes.map((c) => (
                  <tr key={c.label} style={{ borderTop: "1px solid var(--nv-line)" }}>
                    <td style={{ padding: "5px 6px", color: INK, fontWeight: 600 }}>{c.label}</td>
                    <td style={{ padding: "5px 6px", color: MUTED }}>{c.from || (c.to ? "—" : (ar ? "مخفي" : "Hidden"))}</td>
                    <td style={{ padding: "5px 6px", color: INK }}>{c.to || (c.from ? "—" : (ar ? "مخفي" : "Hidden"))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <span style={{ fontSize: 12, color: MUTED }}>{ar ? "لا تفاصيل حقول لهذا الإجراء." : "No field details for this action."}</span>}
        </div>
      )}
    />
  );
}

/**
 * «أرشيف الملف»: the updates made to this employee's file only — what changed, who, and when.
 * Records of other sections (requests, sanctions, letters, custody) stay in those sections.
 */
export default function FileArchiveTab({ employee, isSelf, ar }) {
  return (
    <div data-file-archive="1" className="nv-list-stack">
      <FileChangeTrail employee={employee} isSelf={isSelf} ar={ar} />
    </div>
  );
}

/** The documents gathered on the file — kept for reuse; the archive tab shows file updates only. */
export function FileDocsArchive({ employee, data, isSelf, managerView, ar }) {
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

  return (
    <div data-file-archive="1" className="nv-list-stack">
      {/* «أرشيف ملفي» filters as in طلباتي: a title, then الكل and each document type with its count —
          its own card; the documents sit below in a separate card. */}
      <StatusFilterPills
        card
        dataKey="file-archive"
        title={isSelf ? (ar ? "أرشيف ملفي" : "My file archive") : (ar ? "أرشيف الملف" : "File archive")}
        value={group}
        onChange={setGroup}
        items={archive.groups.length ? [
          { id: "all", label: ar ? "الكل" : "All", n: archive.count || 0 },
          ...present.map((g) => ({ id: g.id, label: ar ? g.ar : g.en, n: archive.groups.find((row) => row.id === g.id)?.items.length || 0 })),
        ] : []}
        trailing={archive.groups.length ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ar ? "ابحث في الأرشيف" : "Search the archive"}
            aria-label={ar ? "ابحث في الأرشيف" : "Search the archive"}
            style={{ fontFamily: "inherit", height: 30, width: 220, maxWidth: "100%", padding: "0 10px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: INK, fontSize: 12 }}
          />
        ) : null}
      >
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
          {isSelf
            ? (ar
              ? "كل وثيقة على ملفك: العقد والشهادات والنسخ والإيصالات والإقرارات — بمصدرها وإثباتها."
              : "Every document on your file — contract, letters, copies, receipts and acknowledgements — with its source and proof.")
            : (ar
              ? "كل وثيقة على الملف: العقد والقرارات والشهادات والنسخ والإيصالات والإقرارات — بمصدرها وإثباتها."
              : "Every document on the file — contract, decisions, letters, copies, receipts and acknowledgements — with its source and proof.")}
          {isSelf ? <div style={{ marginTop: 6 }}><SanctionsElsewhereLink ar={ar} /></div> : null}
        </div>
      </StatusFilterPills>
      <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" }}>
      {groups.length === 0 ? (
        <div style={{ padding: "14px 20px", fontSize: 12, color: MUTED }}>
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
    </div>
  );
}
