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
import { bandAction, DayHeading, NoticeFoot, NoticeHead, NoticeShell, rowChip } from "@/components/notifications/noticeChrome";
import { letterOf } from "@/components/schedules/rosterTile";
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
                {/* The طلباتي kind card: white, hairline, radius 12, a letter mark, title then a quiet hint. */}
                <div className="nv-req-kind-card" data-notice-row={unreadRow ? "unread" : "read"} style={{ cursor: "default", alignItems: "flex-start", padding: "11px 12px" }}>
                  <span className="nv-req-kind-mark" aria-hidden style={item.escalated || kind.tone === "bad" ? { background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)" } : undefined}>
                    {letterOf(ar ? kind.ar : kind.en)}
                  </span>
                  <button
                    type="button"
                    className="nv-req-kind-copy"
                    onClick={() => onOpen(item)}
                    style={{ flex: 1, textAlign: "start", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "inherit", gap: 4 }}
                  >
                    <span className="nv-req-kind-title" style={{ fontWeight: unreadRow ? 700 : 600, lineHeight: 1.6 }}>{text}</span>
                    <span className="nv-req-kind-hint" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{ar ? kind.ar : kind.en}</span>
                      <span aria-hidden>·</span>
                      <span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate" }}>{relativeNotificationTime(item.createdAt, lang)}</span>
                      {item.count > 1 ? <><span aria-hidden>·</span><span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate" }}>{`×${item.count}`}</span></> : null}
                    </span>
                  </button>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    {item.escalated
                      ? <span style={rowChip("bad")}>{ar ? "تصعيد" : "Escalated"}</span>
                      : unreadRow ? <span style={rowChip("ok")}>{ar ? "جديد" : "New"}</span> : null}
                    <button
                      type="button"
                      onClick={dismiss}
                      aria-label={ar ? "إخفاء" : "Dismiss"}
                      style={{ width: 24, height: 24, border: "1px solid var(--nv-line2)", borderRadius: 8, background: "var(--nv-card)", color: MUTED, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </span>
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
