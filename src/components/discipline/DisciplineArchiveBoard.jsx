import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import { collectDisciplineArchive, disciplineArchiveSmartItems } from "@/lib/disciplineBoard";
import { BORDER, CARD, MUTED, NAVY, PILL_RADIUS } from "@/lib/platformStyles";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "7px 12px",
    border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
    background: on ? "var(--nv-navy)" : CARD,
    color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: PILL_RADIUS,
  };
}

/**
 * Settled sanctions archive — search + day groups via RecordSmartArchive.
 * scope: "manage" | "mine"
 */
export default function DisciplineArchiveBoard({
  cases,
  employees,
  stations,
  ar,
  today,
  selfOnly,
  userId,
  scope: scopeProp,
}) {
  const scope = scopeProp === "mine" || scopeProp === "manage"
    ? scopeProp
    : (selfOnly ? "mine" : "manage");
  const mineOnly = scope === "mine";
  const [filter, setFilter] = useState("all");
  const archive = useMemo(
    () => collectDisciplineArchive({
      cases,
      employees,
      stations,
      ar,
      today,
      filter,
      selfOnly: mineOnly,
      userId,
    }),
    [cases, employees, stations, ar, today, filter, mineOnly, userId],
  );
  const items = useMemo(
    () => disciplineArchiveSmartItems(archive.rows, { ar }),
    [archive.rows, ar],
  );

  const filters = [
    ["all", ar ? "الكل" : "All"],
    ["cut", ar ? "بحسم" : "With a cut"],
    ["warn", ar ? "بلا حسم" : "No cut"],
    ["objected", ar ? "قُرّر في اعتراضه" : "Ruled on objection"],
  ];

  const subtitle = scope === "manage"
    ? (ar
      ? "ما استقرّ في نطاق فرعك — مجمّع يومًا بيوم. قيد المسار يبقى في إدارة. اضغط السطر لأثره وروابطه."
      : "What settled in your station scope — grouped day by day. Open files stay on Manage. Open a row for effect and links.")
    : (ar
      ? "جزاءاتك المستقرّة فقط — مجمّعة يومًا بيوم. الساري يبقى في ملفي. اضغط السطر لأثره وروابطه."
      : "Only your settled sanctions — grouped day by day. Live cases stay on My file. Open a row for effect and links.");

  const emptyText = ar
    ? "لا ملفات مستقرّة بعد. ما يُوقَّع أو يُحفَظ أو يُقرَّر فيه اعتراض ينتقل إلى الأرشيف بتاريخه ومرجعه."
    : "No settled files yet. What is signed, filed, or ruled on after an objection moves here with its date and reference.";

  return (
    <RecordSmartArchive
      items={items}
      lang={ar ? "ar" : "en"}
      dir={ar ? "rtl" : "ltr"}
      emptyLabel={emptyText}
      searchPlaceholder={ar ? "بحث في الأرشيف…" : "Search archive…"}
      subtitle={`${archive.note} ${subtitle}`}
      meta={(
        <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {filters.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} style={chip(filter === id)}>{label}</button>
          ))}
        </span>
      )}
      renderOpen={(item) => {
        const row = item.row;
        if (!row) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 2, borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: NAVY, paddingTop: 10 }}>
              {ar ? "أثر ومرجع" : "Effect and reference"}
            </span>
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>{row.meta}</span>
            {row.ref ? (
              row.payrollHref ? (
                <Link to={row.payrollHref} style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "none" }}>
                  {row.refTag ? `${row.refTag} · ${row.ref}` : row.ref}
                </Link>
              ) : (
                <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.75 }}>
                  {row.refTag ? `${row.refTag} · ${row.ref}` : row.ref}
                </span>
              )
            ) : null}
            {row.href && scope !== "mine" ? (
              <Link to={row.href} style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "none" }}>
                {ar ? "ملف الموظف ←" : "Employee file →"}
              </Link>
            ) : null}
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
              {ar
                ? "لا يُحذف من الأرشيف ملف. الجزاء يُمحى من سجل الموظف الظاهر بعد سنة من توقيعه ويبقى هنا."
                : "Nothing is deleted. A sanction drops off the employee's visible record one year after signing, and stays here."}
            </span>
          </div>
        );
      }}
    />
  );
}
