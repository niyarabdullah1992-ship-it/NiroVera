import React, { useState } from "react";
import BranchNoticePanel, { SCOPE_FOOT } from "@/components/notifications/BranchNoticePanel";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import { BandCount, bandAction, bandPill, NoticeFoot, NoticeHead, NoticeShell } from "@/components/notifications/noticeChrome";

/**
 * «الإشعارات» on the management side: two lists in one frame —
 *   نطاقي   — what every branch you administer needs (urgent · your decision · for notice);
 *   إشعاراتي — what was sent to you personally (a manager is an employee too).
 * Before this the management side showed the branches only, and a manager's own notices
 * (his leave decision, a night-remedy note, a signing request) never surfaced there.
 */
export default function ManageNoticePanel({
  branchItems = [],
  personalItems = [],
  personalUnread = 0,
  lang = "ar",
  t,
  companyId,
  userId,
  onOpenBranch,
  onPickBranch,
  onOpenPersonal,
  onDismissPersonal,
  onMarkAllPersonal,
}) {
  const ar = lang === "ar";
  const scopeCount = branchItems.reduce((total, item) => total + (item.count || 0), 0);
  const [tab, setTab] = useState(() => (scopeCount === 0 && personalUnread > 0 ? "mine" : "scope"));
  return (
    <NoticeShell ar={ar} label={ar ? "الإشعارات" : "Notifications"}>
      <NoticeHead
        title={ar ? "الإشعارات" : "Notifications"}
        sub={tab === "scope"
          ? (ar ? "كل فروع نطاقك — مرتّبة بالأولوية ومجمّعة لكل فرع" : "Every branch in your scope — by priority, per branch")
          : (ar ? "ما أُرسل إليك أنت" : "What was sent to you")}
        trailing={tab === "mine" && personalUnread > 0
          ? <button type="button" onClick={onMarkAllPersonal} style={bandAction()}>{t("markRead")}</button>
          : null}
      >
        <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" role="tab" data-notice-tab="scope" aria-selected={tab === "scope"} onClick={() => setTab("scope")} style={bandPill(tab === "scope")}>
            {ar ? "نطاقي" : "My scope"}<BandCount n={scopeCount} on={tab === "scope"} />
          </button>
          <button type="button" role="tab" data-notice-tab="mine" aria-selected={tab === "mine"} onClick={() => setTab("mine")} style={bandPill(tab === "mine")}>
            {ar ? "إشعاراتي" : "Mine"}<BandCount n={personalUnread} on={tab === "mine"} />
          </button>
        </div>
      </NoticeHead>
      {tab === "scope" ? (
        <BranchNoticePanel embedded items={branchItems} lang={lang} companyId={companyId} userId={userId} onOpen={onOpenBranch} onPickBranch={onPickBranch} />
      ) : (
        <NotificationPanel embedded items={personalItems} unread={personalUnread} lang={lang} t={t} onOpen={onOpenPersonal} onDismiss={onDismissPersonal} onMarkAll={onMarkAllPersonal} />
      )}
      <NoticeFoot>
        {tab === "scope"
          ? SCOPE_FOOT[ar ? "ar" : "en"]
          : (ar ? "اضغط الإشعار لفتح مكانه. اسحبه أو اضغط × لإخفائه. المتكرر يُجمع في سطر واحد." : "Press a notice to open its place. Swipe or press × to hide it. Repeats collapse into one row.")}
      </NoticeFoot>
    </NoticeShell>
  );
}
