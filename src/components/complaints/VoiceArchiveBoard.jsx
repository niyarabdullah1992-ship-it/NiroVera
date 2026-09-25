import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import VoiceAuditTrail from "@/components/complaints/VoiceAuditTrail";
import { countAr } from "@/lib/disciplineBoard";
import { voiceArchiveSmartItems } from "@/lib/voiceBoard";
import { BORDER, CARD, MUTED, NAVY, PILL_RADIUS } from "@/lib/platformStyles";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "7px 12px",
    border: `1px solid ${on ? "var(--nv-navy, #14213d)" : BORDER}`,
    background: on ? "var(--nv-navy, #14213d)" : CARD,
    color: on ? "#fff" : MUTED,
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: PILL_RADIUS,
  };
}

/**
 * Settled voice archive — search + day groups via RecordSmartArchive.
 * scope: "manage" | "mine" | "employee"
 */
export default function VoiceArchiveBoard({
  cards,
  ar,
  canManage = false,
  scope = canManage ? "manage" : "mine",
  employeeName = "",
}) {
  const [filter, setFilter] = useState("all");
  const settled = useMemo(() => (cards || []).filter((card) => card.settled), [cards]);
  const filtered = useMemo(
    () => settled.filter((card) => filter === "all" || card.item.channel === filter),
    [settled, filter],
  );
  const items = useMemo(() => voiceArchiveSmartItems(filtered, { ar }), [filtered, ar]);

  const filters = [
    ["all", ar ? "الكل" : "All"],
    ["suggestion", ar ? "اقتراحات" : "Suggestions"],
    ["complaint", ar ? "شكاوى" : "Complaints"],
    ["anonymous", ar ? "مجهولة" : "Anonymous"],
  ];
  const channelFilters = scope === "employee"
    ? filters.filter(([id]) => id !== "anonymous")
    : filters;

  const subtitle = scope === "employee"
    ? (ar
      ? `أصوات ${employeeName || "الموظف"} المستقرّة فقط — مجمّعة يومًا بيوم. البلاغ المجهول لا يظهر في الملف.`
      : `Only ${employeeName || "this employee"}'s settled voices — grouped day by day. Anonymous reports do not appear on the file.`)
    : scope === "manage"
      ? (ar
        ? "ما استقرّ في نطاق فرعك — مجمّع يومًا بيوم. قيد المراجعة يبقى في طابور الإدارة. اضغط السطر لمسار القرار."
        : "What settled in your station scope — grouped day by day. Open items stay in the manage queue. Open a row for the decision path.")
      : (ar
        ? "أصواتك المستقرّة وما نُشر من مجهول فرعك بالرقم — مجمّعة يومًا بيوم. اضغط السطر لمسار القرار."
        : "Your settled voices and station anonymous rulings by number — grouped day by day. Open a row for the decision path.");

  const emptyText = ar
    ? "لا أصوات مؤرشفة بعد. ما يُعتمد أو يُعاد بملاحظة أو يُعالَج ينتقل إلى هنا بقراره وأثره."
    : "No archived voices yet. What is adopted, returned with a note, or handled moves here with its ruling.";

  const countHint = ar
    ? `${countAr(settled.length, "صوت واحد مستقرّ", "صوتان مستقرّان", "أصوات مستقرّة", "صوتاً مستقرّاً", "لا أصوات مستقرّة")}${scope === "manage" ? " في هذا الفرع" : scope === "employee" ? " في الملف" : " في أصواتك"} — لا يُحذف منها شيء.`
    : `${settled.length} settled voice(s)${scope === "manage" ? " on this station" : scope === "employee" ? " on the file" : " of yours"} — nothing is deleted.`;

  return (
    <RecordSmartArchive
      items={items}
      lang={ar ? "ar" : "en"}
      dir={ar ? "rtl" : "ltr"}
      emptyLabel={emptyText}
      searchPlaceholder={ar ? "بحث في الأرشيف…" : "Search archive…"}
      subtitle={`${countHint} ${subtitle}`}
      meta={(
        <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {channelFilters.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} style={chip(filter === id)}>{label}</button>
          ))}
        </span>
      )}
      renderOpen={(item) => {
        const row = item.card;
        if (!row) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 2, borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: NAVY, paddingTop: 10 }}>
              {ar ? "مسار القرار" : "Decision path"}
            </span>
            {row.item?.authorId && scope !== "employee" ? (
              <Link
                to={`/app/employees/${encodeURIComponent(row.item.authorId)}`}
                style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "none" }}
              >
                {ar ? "ملف الموظف ←" : "Employee file →"}
              </Link>
            ) : null}
            <VoiceAuditTrail events={row.audit} ar={ar} />
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
              {ar
                ? "لا يُحذف من الأرشيف صوت. والبلاغ المجهول يبقى مجهولاً فيه — يُحفظ قراره وأثره دون هويّة مُبلِّغه."
                : "Nothing is deleted. An anonymous report stays anonymous here — its ruling and effect are kept without the reporter's identity."}
            </span>
          </div>
        );
      }}
    />
  );
}
