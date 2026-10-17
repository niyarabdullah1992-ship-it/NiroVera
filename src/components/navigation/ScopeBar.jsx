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
import { Bell, ChevronDown, MapPin } from "lucide-react";
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
    return <span className="nv-hdr-select-count">{count === 1 ? "فرع واحد" : "فرعان"}</span>;
  }
  return (
    <span className="nv-hdr-select-count">
      <span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate", color: "var(--nv-ink)", fontWeight: 600 }}>{count}</span>
      <span>{word}</span>
    </span>
  );
}

function myStationLine(data, user, ar) {
  const vacant = ar ? "شاغر" : "Vacant";
  const station = (data?.stations || []).find((item) => String(item.id) === String(user?.stationId || ""));
  const people = data?.employees || [];
  const acting = station ? actingAtStation(data, station.id) : null;
  const manager = workplaceManagerDisplay(station, people);
  const hr = station ? hrManagerForStation(data, station.id) : null;
  const managerName = acting?.employee?.name || manager.managerName || "";
  return {
    station: station?.name || vacant,
    manager: managerName || vacant,
    hr: hr?.name || vacant,
    vacant: { station: !station?.name, manager: !managerName, hr: !hr?.name },
  };
}


/**
 * The header bell — one ghost segment in the utility group.
 * Manage: urgent branch notices (red). Employee: own unread, green; red only while an unread one is urgent.
 */
export function NotificationBell({
  notifOpen = false,
  onToggleNotif,
  onCloseNotif,
  notifItems = [],
  onOpenNotif,
  onDismissNotif,
  onMarkAllNotifs,
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const { data, currentUser, company } = useAuth();
  const railSide = useRailSide();
  const manage = railSide !== "employee";
  const notifBtnRef = useRef(null);
  const notifPanelRef = useRef(null);
  const [notifBox, setNotifBox] = useState(null);

  useEffect(() => {
    if (!notifOpen) return undefined;
    const onClick = (event) => {
      if (notifBtnRef.current?.contains(event.target)) return;
      if (notifPanelRef.current?.contains(event.target)) return;
      onCloseNotif?.();
    };
    const onKey = (event) => {
      if (event.key === "Escape") onCloseNotif?.();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
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
  const badgeTone = manage || urgent > 0 ? "bad" : "ok";
  const name = manage ? (ar ? "الإشعارات" : "Notifications") : (ar ? "إشعاراتي" : "My notifications");

  const openBranchNotice = (item) => {
    if (item?.stationId) setStationScope(item.stationId);
    onCloseNotif?.();
    if (item?.route) navigate(item.route);
  };

  return (
    <>
      <button
        ref={notifBtnRef}
        type="button"
        className="nv-hdr-seg nv-hdr-bell"
        onClick={onToggleNotif}
        aria-expanded={notifOpen}
        aria-label={badgeCount > 0 ? `${name} (${badgeCount})` : name}
        title={name}
        data-open={notifOpen ? "true" : undefined}
      >
        <Bell style={{ width: 16, height: 16 }} strokeWidth={1.75} />
        {badgeCount > 0 ? (
          <span dir="ltr" className="nv-hdr-badge" data-tone={badgeTone}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </button>
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
                unread={personalUnread}
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
    </>
  );
}

/** Quiet labour-law status: a dot and a short line; the full wording sits in the tooltip. */
export function ComplianceStatus({ violationCount = 0 }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const violated = violationCount > 0;
  const full = violated
    ? (ar ? `${violationCount} مخالفة لنظام العمل ولائحته التنفيذية في هذه الصفحة` : `${violationCount} Labor Law ${violationCount === 1 ? "violation" : "violations"} on this page`)
    : (ar ? "متوافق مع نظام العمل ولائحته التنفيذية" : "Compliant with the Saudi Labor Law");
  return (
    <span className="nv-compliance" data-violated={violated ? "true" : "false"} title={full} aria-label={full} role="status">
      <span aria-hidden className="nv-compliance-dot" />
      <span>
        {violated
          ? (ar ? `${violationCount} مخالفة` : `${violationCount} ${violationCount === 1 ? "violation" : "violations"}`)
          : (ar ? "متوافق مع النظام" : "Labor-law compliant")}
      </span>
    </span>
  );
}

function Fact({ label, value, vacant, icon }) {
  return (
    <span className="nv-hdr-fact" data-vacant={vacant ? "true" : undefined}>
      {icon}
      <span className="nv-hdr-fact-label">{label}</span>
      <strong className="nv-hdr-fact-value">{value}</strong>
    </span>
  );
}

/**
 * One scope line for every section.
 * Manage: the branch switcher (نطاقك). Employee: the administration they belong to, fixed.
 */
export default function ScopeBar({ violationCount = 0 }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser } = useAuth();
  const railSide = useRailSide();
  const manage = railSide !== "employee";
  const { stations, scope, scopedStation, canSwitch } = useStationSwitcher();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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

  const workplaces = stations.filter((station) => !isManagerUnit(station));
  const branchCount = workplaces.length || stations.length;
  const label = scopedStation?.name
    || (scope !== "all" ? String(scope) : (ar ? "كل نطاقي" : "All my scope"));
  const stationCode = scope === "all" ? "" : [scopedStation?.code, scopedStation?.shortCode]
    .map((part) => String(part || "").trim())
    .find((part) => part && part !== label) || "";
  const mine = useMemo(
    () => (manage ? null : myStationLine(data, currentUser, ar)),
    [manage, data, currentUser, ar],
  );

  return (
    <div className="nv-scope-bar" data-lane={manage ? "manage" : "employee"}>
      {manage ? (
        <div className="nv-hdr-scope">
          <span className="nv-hdr-fact-label" id="nv-hdr-scope-label">{ar ? "نطاقك" : "Your scope"}</span>
          <div ref={rootRef} className="nv-hdr-scope-anchor">
            <button
              type="button"
              className="nv-hdr-select"
              onClick={() => canSwitch && setOpen((value) => !value)}
              disabled={!canSwitch}
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-describedby="nv-hdr-scope-label"
              title={ar ? "نطاق الفروع · Ctrl+Shift+K" : "Station scope · Ctrl+Shift+K"}
            >
              <span aria-hidden className="nv-hdr-select-dot" />
              <span className="nv-hdr-select-text">{label}</span>
              {scope === "all" ? <CountPhrase count={branchCount} ar={ar} /> : stationCode ? (
                <span dir="ltr" className="nv-hdr-select-code">{stationCode}</span>
              ) : null}
              {canSwitch ? <ChevronDown aria-hidden className="nv-hdr-select-chev" strokeWidth={1.8} /> : null}
            </button>
            <StationQuickSwitch anchorRef={rootRef} open={open && canSwitch} onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : mine ? (
        <div className="nv-hdr-facts no-scrollbar" title={ar ? "المحطة التي تتبع لها" : "The station you belong to"}>
          <Fact
            icon={<MapPin aria-hidden className="nv-hdr-fact-icon" strokeWidth={1.8} />}
            label={ar ? "محطتي" : "My station"}
            value={mine.station}
            vacant={mine.vacant.station}
          />
          <Fact label={ar ? "مدير الفرع" : "Branch manager"} value={mine.manager} vacant={mine.vacant.manager} />
          <Fact label={ar ? "الموارد البشرية" : "Human resources"} value={mine.hr} vacant={mine.vacant.hr} />
        </div>
      ) : <span />}
      <ComplianceStatus violationCount={violationCount} />
    </div>
  );
}
