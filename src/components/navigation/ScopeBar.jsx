import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { useRailSide } from "@/lib/railSide";
import useStationSwitcher, { OPEN_STATION_SWITCH_EVENT } from "@/hooks/useStationSwitcher";
import StationQuickSwitch from "@/components/navigation/StationQuickSwitch";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import BranchNoticePanel from "@/components/notifications/BranchNoticePanel";
import { isUrgentNotification } from "@/lib/notificationKind";
import { isManagerUnit, stationParentId } from "@/lib/stationTree";
import { requestSelfEmployee } from "@/lib/employeeFileView";
import { buildBranchNotices } from "@/lib/managerScopeChips";
import { setStationScope } from "@/lib/stationScopeStore";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";

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
    return <span style={{ color: "#555C66", fontSize: 12 }}>{count === 1 ? "فرع واحد" : "فرعان"}</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, color: "#555C66", fontSize: 12 }}>
      <span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate" }}>{count}</span>
      <span>{word}</span>
    </span>
  );
}

function administrationName(employee, stations) {
  const list = Array.isArray(stations) ? stations : [];
  const byId = new Map(list.map((station) => [String(station.id), station]));
  const stationId = String(employee?.stationId || "").trim();
  const home = stationId ? byId.get(stationId) : null;
  const department = String(employee?.profile?.department || "").trim();
  if (department) return department;
  if (home && isManagerUnit(home) && home.name) return String(home.name);
  let cursor = home;
  const seen = new Set();
  while (cursor) {
    const parentId = stationParentId(cursor);
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    const parent = byId.get(String(parentId));
    if (!parent) break;
    if (isManagerUnit(parent) && parent.name) return String(parent.name);
    cursor = parent;
  }
  return home?.name ? String(home.name) : "";
}

const face = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 34,
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #C5CEC9",
  background: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  color: "#111418",
};

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

  const employeeScope = administrationName(
    requestSelfEmployee(currentUser, data?.employees || []) || currentUser,
    data?.stations || stations,
  );
  const openBranchNotice = (item) => {
    if (item?.stationId) setStationScope(item.stationId);
    onCloseNotif?.();
    if (item?.route) navigate(item.route);
  };
  return (
    <div className="nv-scope-bar" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 }}>
      {manage ? (
        <>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#555C66", flexShrink: 0 }}>
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
              style={{ ...face, maxWidth: 280, fontWeight: 700 }}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "#0B8A4F", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#111418", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
              </span>
              {scope === "all" ? <CountPhrase count={branchCount} ar={ar} /> : stationCode ? (
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "#555C66", unicodeBidi: "isolate", flexShrink: 0 }}>{stationCode}</span>
              ) : null}
              <span style={{ color: "#555C66", fontSize: 10, flexShrink: 0 }}>▾</span>
            </button>
            <StationQuickSwitch anchorRef={rootRef} open={open && canSwitch} onClose={() => setOpen(false)} />
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#555C66", flexShrink: 0 }}>
            {ar ? "نطاقك" : "Your scope"}
          </span>
          <span
            title={ar ? "الإدارة التي تتبعها" : "The administration you belong to"}
            style={{ ...face, maxWidth: 280, fontWeight: 700, cursor: "default" }}
          >
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "#0B8A4F", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#111418", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {employeeScope || "—"}
            </span>
          </span>
        </>
      )}

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
        {urgent > 0 ? (
          <span dir="ltr" style={{
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 999,
            background: "#9B2335",
            color: "#fff",
            fontFamily: MONO,
            fontSize: 10.5,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            unicodeBidi: "isolate",
          }}
          >
            {urgent > 9 ? "9+" : urgent}
          </span>
        ) : null}
      </button>
      {notifOpen && notifBox && typeof document !== "undefined"
        ? createPortal(
          <div ref={notifPanelRef} style={{ position: "fixed", top: notifBox.top, left: notifBox.left, width: notifBox.width, zIndex: 82 }}>
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
    </div>
  );
}
