import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listFormerEmployees } from "@/lib/formerEmployees";
import { mono } from "@/components/schedules/scheduleChrome";
import { Note, Slab, SlabBar } from "@/components/hr/orgdesign/orgDesignUi";

/**
 * Org-structure archive: files of workers whose employment ended.
 * Live tree stays active seats only — these rows are retained and confidential.
 * One slab, one row per file (wraps on a phone), the file link as a green action.
 */
export default function OrgFormerFilesBoard({ data, ar = true, boardRef }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => listFormerEmployees(data, { ar, query }),
    [data, ar, query],
  );

  return (
    <Slab
      slabRef={boardRef}
      label={ar ? "ملفات من انتهت خدمتهم" : "Files of former workers"}
      title={(
        <>
          {ar ? "ملفات من انتهت خدمتهم" : "Files of former workers"}
          <span dir="ltr" style={{ ...mono, fontSize: 12, fontWeight: 600, color: "var(--nv-muted)", marginInline: 8 }}>{rows.length}</span>
        </>
      )}
      note={ar
        ? "الملفات محفوظة وسرية داخل الشركة. لا تُحذف — الخروج بإنهاء الخدمة أو الاستقالة وفق نظام العمل. الشجرة الحية للمقاعد النشطة فقط."
        : "Files stay stored and confidential inside the company. They are not deleted — exit is termination or resignation under the Labour Law. The live tree shows active seats only."}
    >
      <div data-org-former-files="1" style={{ display: "flex", flexDirection: "column" }}>
        <SlabBar>
          <input
            className="nv-od-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ar ? "ابحث في الملفات المحفوظة" : "Search retained files"}
            aria-label={ar ? "بحث في ملفات من انتهت خدمتهم" : "Search former worker files"}
            style={{ flex: "1 1 220px", maxWidth: 360 }}
          />
        </SlabBar>

        {!rows.length ? (
          <Note style={{ padding: "14px 18px" }}>
            {query.trim()
              ? (ar ? "لا نتيجة في الملفات المحفوظة." : "No match in retained files.")
              : (ar
                ? "لا ملفات محفوظة بعد لمن انتهت خدمتهم. عند إكمال إنهاء الخدمة يظهر الملف هنا."
                : "No retained former-worker files yet. When offboarding completes, the file appears here.")}
          </Note>
        ) : rows.map((row) => (
          <Link
            key={row.id}
            to={row.href}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 14px",
              padding: "11px 18px",
              borderBottom: "1px solid var(--nv-line2, var(--nv-line))",
              alignItems: "baseline",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nv-ink)", minWidth: 0, flex: "1 1 160px" }}>{row.name}</span>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6, minWidth: 0, flex: "1 1 160px" }}>
              {row.position}
              {row.stationName && row.stationName !== "—" ? <span style={{ color: "var(--nv-muted)" }}>{` · ${row.stationName}`}</span> : null}
            </span>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", flex: "0 1 auto" }}>{row.reason}</span>
            <span dir="ltr" style={{ ...mono, fontSize: 11.5, color: "var(--nv-muted)" }}>{row.endedLabel}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ok-ink)", whiteSpace: "nowrap", marginInlineStart: "auto" }}>
              {ar ? "افتح الملف ‹" : "Open file ›"}
            </span>
          </Link>
        ))}
      </div>
    </Slab>
  );
}
