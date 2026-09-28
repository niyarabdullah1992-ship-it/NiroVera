import React from "react";
import { X } from "lucide-react";
import SwipeToDeleteItem from "@/components/notifications/SwipeToDeleteItem";
import {
  formatNotificationText,
  kindForNotification,
  notificationEscalated,
  relativeNotificationTime,
} from "@/lib/notificationKind";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, PAPER_SHADOW, PILL_RADIUS, RADIUS, SURFACE, ui } from "@/lib/platformStyles";

const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";
const MONO = "'IBM Plex Mono', monospace";

export default function NotificationPanel({
  items = [],
  unread = 0,
  lang,
  t,
  onOpen,
  onDismiss,
  onMarkAll,
  title,
}) {
  const ar = lang === "ar";
  const rows = groupedNotices(items, lang);

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        width: 360,
        maxWidth: "92vw",
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: RADIUS,
        boxShadow: PAPER_SHADOW,
        overflow: "hidden",
        color: NAVY,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 20px",
          background: CARD,
          borderBottom: "1px solid var(--nv-line)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: MUTED, fontFamily: MONO }}>
            NIROVERA
          </span>
          <h2 style={{ margin: 0, fontFamily: NASKH, fontSize: 18, fontWeight: 600, lineHeight: 1.35, color: NAVY }}>
            {title || t("notifications")}
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, paddingTop: 2 }}>
          {unread > 0 ? (
            <span
              dir="ltr"
              style={{
                minWidth: 20,
                height: 20,
                padding: "0 6px",
                borderRadius: PILL_RADIUS,
                background: NAVY_FILL,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
              }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
          {unread > 0 ? (
            <button type="button" onClick={onMarkAll} style={ui.btnMiniQuiet}>
              {t("markRead")}
            </button>
          ) : null}
        </div>
      </header>

      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "18px 20px 22px", fontSize: 12, color: MUTED, lineHeight: 1.85, textAlign: "start" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 6 }}>{t("noNotifications")}</div>
            {ar
              ? "عندما يحدث أمر يستحق المتابعة سيظهر هنا — بنفس أثره وموضعه في المنصة."
              : "When something needs attention, it will appear here — with its effect and place in the platform."}
          </div>
        ) : (
          rows.map((item) => {
            const kind = kindForNotification(item.text);
            const title = formatNotificationText(item, lang) || (ar ? kind.ar : kind.en);
            const unreadRow = !item.read;
            const dismiss = () => (item.ids || [item.id]).forEach((id) => onDismiss(id));
            return (
              <SwipeToDeleteItem key={item.ids?.[0] || item.id} onDelete={dismiss}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "12px 16px 12px 12px",
                    borderBottom: "1px solid var(--nv-line)",
                    background: unreadRow ? SURFACE : CARD,
                    borderInlineStart: unreadRow ? `3px solid ${NAVY_FILL}` : "3px solid transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      textAlign: "start",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      padding: 0,
                    }}
                  >
                    <span style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: unreadRow ? 700 : 500,
                          color: unreadRow ? NAVY : MUTED,
                          lineHeight: 1.55,
                          minWidth: 0,
                        }}
                      >
                        {title}
                      </span>
                      <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10, color: MUTED, flexShrink: 0 }}>
                        {relativeNotificationTime(item.createdAt, lang)}
                      </span>
                    </span>
                    <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                      {ar ? kind.ar : kind.en}
                      {item.count > 1 ? (
                        <span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate" }}>{` · ${item.count}`}</span>
                      ) : null}
                      {item.escalated ? (ar ? " · تصعيد" : " · Escalated") : null}
                      {unreadRow ? (ar ? " · غير مقروء" : " · Unread") : (ar ? " · مقروء" : " · Read")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    aria-label={ar ? "إخفاء" : "Dismiss"}
                    style={{
                      width: 26,
                      height: 26,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 10,
                      background: CARD,
                      color: MUTED,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </SwipeToDeleteItem>
            );
          })
        )}
      </div>
    </div>
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
  return groups.slice(0, 12);
}
