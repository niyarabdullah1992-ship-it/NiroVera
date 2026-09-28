import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { useRailSide } from "@/lib/railSide";
import useStationSwitcher, { OPEN_STATION_SWITCH_EVENT } from "@/hooks/useStationSwitcher";
import StationQuickSwitch from "@/components/navigation/StationQuickSwitch";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import BranchNoticePanel from "@/components/notifications/BranchNoticePanel";
import { Bell, MapPin } from "lucide-react";
import { isUrgentNotification } from "@/lib/notificationKind";
import { isManagerUnit } from "@/lib/stationTree";
import { buildBranchNotices } from "@/lib/managerScopeChips";
import { setStationScope } from "@/lib/stationScopeStore";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";
import { hrManagerForStation } from "@/lib/hrTree";
import { actingAtStation, workplaceManagerDisplay } from "@/lib/orgStructureLog";

const MONO = "'IBM Plex Mono', monospace";

function branchWord(count, ar) {
  if (!ar) return count === 1 ? "branch" : "branches";
  if (count === 1) return "فرع";
  if (count === 2) return "فرعان";
  if (count >= 3 && count <= 10) return "فروع";
  return "فرعاً";
}

function CountPhrase({ count, ar }) {
  const word = branchWord(count, ar);
  if (ar && (count === 1 || count === 2)) {
    return <span style={{ color: "var(--nv-ink3)", fontSize: 12 }}>{count === 1 ? "فرع واحد" : "فرعان"}</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, color: "var(--nv-ink3)", fontSize: 12 }}>
      <span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate" }}>{count}</span>
      <span>{word}</span>
    </span>
  );
}

const face = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 32,
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 9,
  border: "1px solid var(--nv-line, #E4E9E6)",
  background: "var(--nv-card)",
  cursor: "pointer",
  fontFamily: "inherit",
  color: "var(--nv-ink)",
};

function myStationLine(data, user, ar) {
  const vacant = ar ? "شاغر" : "Vacant";
  const station = (data?.stations || []).find((item) => String(item.id) === String(user?.stationId || ""));
  const people = data?.employees || [];
  const acting = station ? actingAtStation(data, station.id) : null;
  const manager = workplaceManagerDisplay(station, people);
  const hr = station ? hrManagerForStation(data, station.id) : null;
  return {
    station: station?.name || vacant,
    manager: acting?.employee?.name || manager.managerName || vacant,
    hr: hr?.name || vacant,
  };
}

/**
 * One scope bar for every section.
 * Manage: the branch switcher. Employee: the administration they belong to, fixed.
 */
export default function ScopeBar({
  notifOpen = false,
  onToggleNotif,
  onCloseNotif,
  notifItems = [],
  onOpenNotif,
  onDismissNotif,
  onMarkAllNotifs,
  violationCount = 0,
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const { data, currentUser, company } = useAuth();
  const railSide = useRailSide();
  const manage = railSide !== "employee";
  const { stations, scope, scopedStation, canSwitch } = useStationSwitcher();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const notifBtnRef = useRef(null);
  const notifPanelRef = useRef(null);
  const [notifBox, setNotifBox] = useState(null);

  useEffect(() => {
    if (!manage) setOpen(false);
  }, [manage]);

  useEffect(() => {
    const show = () => {
      if (manage) setOpen(true);
    };
    window.addEventListener(OPEN_STATION_SWITCH_EVENT, show);
    return () => window.removeEventListener(OPEN_STATION_SWITCH_EVENT, show);
  }, [manage]);

  useEffect(() => {
    if (!notifOpen) return undefined;
    const onClick = (event) => {
      if (notifBtnRef.current?.contains(event.target)) return;
      if (notifPanelRef.current?.contains(event.target)) return;
      onCloseNotif?.();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [notifOpen, onCloseNotif]);

  useLayoutEffect(() => {
    if (!notifOpen) return undefined;
    const place = () => {
      const node = notifBtnRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const width = Math.min(manage ? 460 : 360, window.innerWidth - 16);
      let left = rect.right - width;
      if (left < 8) left = 8;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      setNotifBox({ top: rect.bottom + 6, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [notifOpen, manage]);

  const workplaces = stations.filter((station) => !isManagerUnit(station));
  const branchCount = workplaces.length || stations.length;
  const label = scopedStation?.name
    || (scope !== "all" ? String(scope) : (ar ? "كل نطاقي" : "All my scope"));
  const stationCode = scope === "all" ? "" : [scopedStation?.code, scopedStation?.shortCode]
    .map((part) => String(part || "").trim())
    .find((part) => part && part !== label) || "";
  const attendanceRows = useMemo(
    () => listLocalTodayAttendance(company?.id, data),
    [company?.id, data],
  );
  const branchNotices = useMemo(
    () => (manage ? buildBranchNotices({ user: currentUser, data, attendanceRows }) : []),
    [manage, currentUser, data, attendanceRows],
  );
  const urgent = manage
    ? branchNotices.filter((item) => item.band === "urgent").reduce((total, item) => total + item.count, 0)
    : notifItems.filter((item) => !item.read && isUrgentNotification(item.text)).length;
  const personalUnread = notifItems.filter((item) => !item.read).length;
  const badgeCount = manage ? urgent : personalUnread;
  const mine = useMemo(
    () => (manage ? null : myStationLine(data, currentUser, ar)),
    [manage, data, currentUser, ar],
  );

  const openBranchNotice = (item) => {
    if (item?.stationId) setStationScope(item.stationId);
    onCloseNotif?.();
    if (item?.route) navigate(item.route);
  };
  const violated = violationCount > 0;
  return (
    <div className="nv-scope-bar" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: "1 1 auto", minWidth: 0, width: "100%" }}>
      {manage ? (
        <>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-muted)", flexShrink: 0 }}>
            {ar ? "نطاقك" : "Your scope"}
          </span>
          <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => canSwitch && setOpen((value) => !value)}
              disabled={!canSwitch}
              aria-expanded={open}
              aria-haspopup="dialog"
              title={ar ? "نطاق الفروع · Ctrl+Shift+K" : "Station scope · Ctrl+Shift+K"}
              style={{ ...face, maxWidth: 320, minWidth: 200, fontWeight: 700 }}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--nv-btn-fill)", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
              </span>
              {scope === "all" ? <CountPhrase count={branchCount} ar={ar} /> : stationCode ? (
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--nv-muted)", unicodeBidi: "isolate", flexShrink: 0 }}>{stationCode}</span>
              ) : null}
              <span style={{ color: "var(--nv-muted)", fontSize: 10, flexShrink: 0 }}>▾</span>
            </button>
            <StationQuickSwitch anchorRef={rootRef} open={open && canSwitch} onClose={() => setOpen(false)} />
          </div>
        </>
      ) : null}

      <button
        ref={notifBtnRef}
        type="button"
        onClick={onToggleNotif}
        aria-expanded={notifOpen}
        aria-label={manage ? (ar ? "الإشعارات" : "Notifications") : (ar ? "إشعاراتي" : "My notifications")}
        style={{ ...face, flexShrink: 0, fontWeight: 600, fontSize: 12.5 }}
      >
        <Bell style={{ width: 15, height: 15 }} strokeWidth={1.75} />
        <span>{manage ? (ar ? "الإشعارات" : "Notifications") : (ar ? "إشعاراتي" : "My notifications")}</span>
        {badgeCount > 0 ? (
          <span dir="ltr" style={{
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 999,
            background: manage ? "#9B2335" : "#C8A45A",
            color: manage ? "#fff" : "#111418",
            fontFamily: MONO,
            fontSize: 10.5,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            unicodeBidi: "isolate",
          }}
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </button>
      {!manage && mine ? (
        <span
          title={ar ? "المحطة التي تتبع لها" : "The station you belong to"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 32,
            padding: "0 12px",
            borderRadius: 9,
            border: "1px solid var(--nv-line, #E4E9E6)",
            background: "var(--nv-card)",
            fontSize: 12.5,
            color: "var(--nv-ink, #111418)",
            whiteSpace: "nowrap",
            maxWidth: "100%",
            overflow: "hidden",
          }}
        >
          <MapPin style={{ width: 14, height: 14, flexShrink: 0 }} strokeWidth={2.2} />
          <span style={{ fontSize: 11, color: "var(--nv-ok-ink, #2F6B43)" }}>{ar ? "محطتي" : "My station"}</span>
          <strong style={{ fontWeight: 700 }}>{mine.station}</strong>
          <span aria-hidden style={{ width: 1, height: 14, background: "var(--nv-ok-line, #BCDFCB)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--nv-ink3, #555C66)" }}>{ar ? "مدير الفرع" : "Branch manager"}</span>
          <strong style={{ fontWeight: 600, fontSize: 12 }}>{mine.manager}</strong>
          <span aria-hidden style={{ width: 1, height: 14, background: "var(--nv-ok-line, #BCDFCB)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--nv-ink3, #555C66)" }}>{ar ? "الموارد البشرية" : "Human resources"}</span>
          <strong style={{ fontWeight: 600, fontSize: 12 }}>{mine.hr}</strong>
        </span>
      ) : null}
      {notifOpen && notifBox && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={notifPanelRef}
            style={{
              position: "fixed",
              top: notifBox.top,
              left: notifBox.left,
              width: notifBox.width,
              zIndex: 82,
              borderTop: `3px solid ${manage ? "#0B3D27" : "#C8A45A"}`,
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 18px 44px rgba(12,20,16,.18)",
            }}
          >
            {manage ? (
              <BranchNoticePanel
                items={branchNotices}
                lang={lang}
                companyId={company?.id}
                userId={currentUser?.id}
                onOpen={openBranchNotice}
                onPickBranch={(id) => {
                  setStationScope(id);
                  onCloseNotif?.();
                }}
              />
            ) : (
              <NotificationPanel
                items={notifItems}
                unread={notifItems.filter((item) => !item.read).length}
                lang={lang}
                t={t}
                title={ar ? "إشعاراتي" : "My notifications"}
                onOpen={onOpenNotif}
                onDismiss={onDismissNotif}
                onMarkAll={onMarkAllNotifs}
              />
            )}
          </div>,
          document.body,
        )
        : null}
      <span
        className="nv-compliance"
        data-violated={violated ? "true" : "false"}
        style={{
          marginInlineStart: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          height: 28,
          padding: "0 12px",
          borderRadius: 999,
          fontSize: 11.5,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: violated ? "#9B2335" : "#3C7D50", flexShrink: 0 }} />
        {violated
          ? (ar ? `${violationCount} مخالفة` : `${violationCount} ${violationCount === 1 ? "violation" : "violations"}`)
          : (ar ? "متوافق مع نظام العمل ولائحته التنفيذية" : "Compliant with the Saudi Labor Law")}
      </span>
    </div>
  );
}
