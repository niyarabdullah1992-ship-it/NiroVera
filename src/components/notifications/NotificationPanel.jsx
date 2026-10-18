import React, { useState } from "react";
import { X } from "lucide-react";
import SwipeToDeleteItem from "@/components/notifications/SwipeToDeleteItem";
import {
  formatNotificationText,
  kindForNotification,
  notificationEscalated,
  relativeNotificationTime,
} from "@/lib/notificationKind";
import { MUTED } from "@/lib/platformStyles";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { bandAction, DayHeading, KindTile, NoticeFoot, NoticeHead, NoticeShell, rowChip } from "@/components/notifications/noticeChrome";
const MONO = "'IBM Plex Mono', monospace";

/** «اليوم» · «أمس» · «أقدم» — by the notice's own date. */
function dayBucket(iso) {
  const then = new Date(iso || 0);
  if (Number.isNaN(then.getTime())) return "older";
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (then.getTime() >= start) return "today";
  if (then.getTime() >= start - 86400000) return "yesterday";
  return "older";
}

const BUCKETS = [
  ["today", "اليوم", "Today"],
  ["yesterday", "أمس", "Yesterday"],
  ["older", "أقدم", "Earlier"],
];

/**
 * «إشعاراتي» — the person's own notices in the طلباتي frame: green head with the unread count and
 * «تحديد الكل كمقروء», pills by state and kind (counted from the list itself), rows as cards grouped
 * by day. `embedded` drops the head when the panel sits inside «الإشعارات» of the management side.
 */
export default function NotificationPanel({
  items = [],
  unread = 0,
  lang,
  t,
  onOpen,
  onDismiss,
  onMarkAll,
  title,
  embedded = false,
}) {
  const ar = lang === "ar";
  const [filter, setFilter] = useState("all");
  const rowsAll = groupedNotices(items, lang);
  const kindsPresent = [];
  for (const row of rowsAll) {
    const kind = kindForNotification(row.text);
    if (!kindsPresent.some((k) => k.id === kind.id)) kindsPresent.push(kind);
  }
  const pills = [
    { id: "all", label: ar ? "الكل" : "All", n: rowsAll.length },
    { id: "unread", label: ar ? "غير مقروءة" : "Unread", n: rowsAll.filter((row) => !row.read).length },
    ...kindsPresent.map((kind) => ({ id: `k:${kind.id}`, label: ar ? kind.ar : kind.en, n: rowsAll.filter((row) => kindForNotification(row.text).id === kind.id).length })),
  ];
  const rows = rowsAll.filter((row) => (
    filter === "all"
      ? true
      : filter === "unread"
        ? !row.read
        : kindForNotification(row.text).id === filter.slice(2)
  ));
  const buckets = BUCKETS.map(([id, labelAr, labelEn]) => ({
    id,
    label: ar ? labelAr : labelEn,
    rows: rows.filter((row) => dayBucket(row.createdAt) === id),
  })).filter((bucket) => bucket.rows.length);

  const list = (
    <div data-notice-list style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "4px 10px 10px", display: "grid", alignContent: "start", gridAutoRows: "max-content", gap: 6 }}>
      {rowsAll.length ? (
        <div style={{ padding: "8px 2px 2px" }}>
          <StatusFilterPills bare size="sm" dataKey="my-notices" value={filter} onChange={setFilter} items={pills} />
        </div>
      ) : null}
      {rows.length === 0 ? (
        <div style={{ margin: "8px 2px", padding: "16px 14px", background: "var(--nv-card)", border: "1px solid var(--nv-line2)", borderRadius: 10, fontSize: 12, color: MUTED, lineHeight: 1.85 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", marginBottom: 4 }}>
            {rowsAll.length ? (ar ? "لا شيء في هذا الفلتر" : "Nothing in this filter") : t("noNotifications")}
          </div>
          {ar
            ? "عندما يحدث أمر يخصك يظهر هنا — ومعه المكان الذي يُتابَع فيه."
            : "When something concerns you it appears here — with the place to follow it."}
        </div>
      ) : buckets.map((bucket) => (
        <React.Fragment key={bucket.id}>
          <DayHeading>{bucket.label}</DayHeading>
          {bucket.rows.map((item) => {
            const kind = kindForNotification(item.text);
            const text = formatNotificationText(item, lang) || (ar ? kind.ar : kind.en);
            const unreadRow = !item.read;
            const dismiss = () => (item.ids || [item.id]).forEach((id) => onDismiss(id));
            return (
              <SwipeToDeleteItem key={item.ids?.[0] || item.id} onDelete={dismiss}>
                <div
                  data-notice-row={unreadRow ? "unread" : "read"}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 10px 10px 8px",
                    background: unreadRow ? "var(--nv-card)" : "var(--nv-card)",
                    border: `1px solid ${unreadRow ? "var(--nv-ok-line)" : "var(--nv-line2)"}`,
                    borderRadius: 10,
                    boxShadow: unreadRow ? "inset 3px 0 0 var(--nv-ok-fill)" : "none",
                  }}
                >
                  <KindTile Icon={kind.icon} tone={item.escalated ? "bad" : kind.tone} />
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, textAlign: "start", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "inherit" }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: unreadRow ? 700 : 500, color: unreadRow ? "var(--nv-ink)" : "var(--nv-ink2)", lineHeight: 1.65 }}>{text}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={rowChip(kind.tone)}>{ar ? kind.ar : kind.en}</span>
                      {item.count > 1 ? <span dir="ltr" style={{ ...rowChip("navy"), fontFamily: MONO }}>{`×${item.count}`}</span> : null}
                      {item.escalated ? <span style={rowChip("bad")}>{ar ? "تصعيد" : "Escalated"}</span> : null}
                      <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, unicodeBidi: "isolate" }}>{relativeNotificationTime(item.createdAt, lang)}</span>
                      {unreadRow ? <span aria-label={ar ? "غير مقروء" : "Unread"} style={{ width: 7, height: 7, borderRadius: 999, background: "var(--nv-ok-fill)" }} /> : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    aria-label={ar ? "إخفاء" : "Dismiss"}
                    style={{ width: 26, height: 26, border: "1px solid var(--nv-line2)", borderRadius: 8, background: "var(--nv-card)", color: MUTED, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </SwipeToDeleteItem>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );

  if (embedded) return list;
  return (
    <NoticeShell ar={ar} label={title || t("notifications")}>
      <NoticeHead
        title={title || t("notifications")}
        sub={unread > 0
          ? (ar ? `${unread > 9 ? "9+" : unread} غير مقروءة — الأهم أولاً` : `${unread} unread — most urgent first`)
          : (ar ? "كلها مقروءة" : "All read")}
        trailing={unread > 0 ? <button type="button" onClick={onMarkAll} style={bandAction()}>{t("markRead")}</button> : null}
      />
      {list}
      <NoticeFoot>
        {ar ? "اضغط الإشعار لفتح مكانه. اسحبه أو اضغط × لإخفائه. المتكرر يُجمع في سطر واحد." : "Press a notice to open its place. Swipe or press × to hide it. Repeats collapse into one row."}
      </NoticeFoot>
    </NoticeShell>
  );
}

function noticeRank(item) {
  const tone = kindForNotification(item.text).tone;
  const escalated = notificationEscalated(item);
  const band = escalated ? 0 : tone === "bad" ? 1 : tone === "warn" ? 2 : 3;
  return (item.read ? 10 : 0) + band;
}

/** Same wording collapses into one row. Urgent, then awaiting a decision, then the rest. */
function groupedNotices(items, lang) {
  const sorted = [...items].sort((a, b) => {
    const diff = noticeRank(a) - noticeRank(b);
    if (diff) return diff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  const groups = [];
  const index = new Map();
  for (const item of sorted) {
    const key = formatNotificationText(item, lang) || String(item.id);
    const at = index.get(key);
    if (at == null) {
      index.set(key, groups.length);
      groups.push({
        ...item,
        count: 1,
        ids: [item.id],
        escalated: notificationEscalated(item),
      });
    } else {
      const row = groups[at];
      row.count += 1;
      row.ids.push(item.id);
      if (!item.read) row.read = false;
      if (notificationEscalated(item)) row.escalated = true;
    }
  }
  return groups.slice(0, 30);
}
