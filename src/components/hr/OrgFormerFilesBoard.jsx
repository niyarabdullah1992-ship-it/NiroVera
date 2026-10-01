import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Archive } from "lucide-react";
import { listFormerEmployees } from "@/lib/formerEmployees";
import { MUTED, NAVY } from "@/lib/platformStyles";
import { ORG_MONO, orgStack } from "@/components/hr/orgUi";

/**
 * Org-structure archive: files of workers whose employment ended.
 * Live tree stays active seats only — these rows are retained and confidential.
 */
export default function OrgFormerFilesBoard({ data, ar = true, boardRef }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => listFormerEmployees(data, { ar, query }),
    [data, ar, query],
  );

  return (
    <section
      ref={boardRef}
      data-org-former-files="1"
      style={{ ...orgStack, gap: 12, marginTop: 8 }}
    >
      <div
        className="nv-paper"
        style={{
          background: "var(--nv-card)",
          border: "1px solid var(--nv-line)",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--nv-line)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: "1 1 240px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" }}>
              <Archive style={{ width: 16, height: 16, color: MUTED }} aria-hidden />
              {ar ? "ملفات من انتهت خدمتهم" : "Files of former workers"}
            </span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
              {ar
                ? "الملفات محفوظة وسرية داخل الشركة. لا تُحذف — الخروج بإنهاء الخدمة أو الاستقالة وفق نظام العمل. الشجرة الحية للمقاعد النشطة فقط."
                : "Files stay stored and confidential inside the company. They are not deleted — exit is termination or resignation under the Labour Law. The live tree shows active seats only."}
            </span>
          </div>
          <span
            dir="ltr"
            style={{
              ...ORG_MONO,
              marginInlineStart: "auto",
              fontSize: 12,
              fontWeight: 700,
              color: NAVY,
              background: "var(--nv-soft)",
              border: "1px solid var(--nv-line)",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            {rows.length}
          </span>
        </div>

        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line2)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ar ? "⌕ ابحث في الملفات المحفوظة" : "⌕ Search retained files"}
            aria-label={ar ? "بحث في ملفات من انتهت خدمتهم" : "Search former worker files"}
            style={{
              flex: "1 1 220px",
              maxWidth: 360,
              height: 34,
              borderRadius: 8,
              border: "1px solid var(--nv-line)",
              background: "var(--nv-soft)",
              padding: "0 12px",
              fontFamily: "inherit",
              fontSize: 12,
              color: "var(--nv-ink)",
            }}
          />
        </div>

        {!rows.length ? (
          <div style={{ padding: "18px 20px", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            {query.trim()
              ? (ar ? "لا نتيجة في الملفات المحفوظة." : "No match in retained files.")
              : (ar
                ? "لا ملفات محفوظة بعد لمن انتهت خدمتهم. عند إكمال إنهاء الخدمة يظهر الملف هنا."
                : "No retained former-worker files yet. When offboarding completes, the file appears here.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(160px,1.4fr) minmax(100px,1fr) minmax(90px,0.9fr) minmax(88px,0.8fr) auto",
                gap: 10,
                padding: "10px 18px",
                background: "var(--nv-soft)",
                borderBottom: "1px solid var(--nv-line)",
                fontSize: 10,
                fontWeight: 600,
                color: MUTED,
                letterSpacing: "0.04em",
              }}
            >
              <span>{ar ? "الاسم" : "Name"}</span>
              <span>{ar ? "آخر منصب / فرع" : "Last seat / branch"}</span>
              <span>{ar ? "سبب الخروج" : "Exit reason"}</span>
              <span>{ar ? "تاريخ الانتهاء" : "Ended"}</span>
              <span />
            </div>
            {rows.map((row) => (
              <Link
                key={row.id}
                to={row.href}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(160px,1.4fr) minmax(100px,1fr) minmax(90px,0.9fr) minmax(88px,0.8fr) auto",
                  gap: 10,
                  padding: "12px 18px",
                  borderBottom: "1px solid var(--nv-line2)",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "inherit",
                  background: "var(--nv-card)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nv-ink)", minWidth: 0 }}>{row.name}</span>
                <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.6, minWidth: 0 }}>
                  {row.position}
                  {row.stationName && row.stationName !== "—" ? (
                    <span style={{ display: "block", color: MUTED }}>{row.stationName}</span>
                  ) : null}
                </span>
                <span style={{ fontSize: 11, color: "var(--nv-ink2)" }}>{row.reason}</span>
                <span dir="ltr" style={{ ...ORG_MONO, fontSize: 11, color: MUTED }}>{row.endedLabel}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-accent, #1E9E63)", whiteSpace: "nowrap" }}>
                  {ar ? "الملف ←" : "File →"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
