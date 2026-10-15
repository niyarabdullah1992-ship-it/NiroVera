/**
 * Lane-specific section pages for الحضور والدوام.
 * الموظف sees only what is personal — three pages, one question each:
 *   بصمتي (اليوم) · سجلي (الشهر — كشفي + تقويمي merged) · جدولي (الأسبوع);
 * الإدارة sees only the team (حضور الفريق · جدول الدوام · السياسة والمواقع).
 * Routes stay the same — only the strip and its labels change per lane.
 */
import { CalendarClock, CalendarDays, CalendarRange, Fingerprint, MapPinned, Users } from "lucide-react";

const DUTY_PATHS = ["/app/attendance", "/app/shifts", "/app/calendar"];

function clean(pathname) {
  return String(pathname || "").replace(/\/+$/, "") || "/";
}

function under(path, base) {
  return path === base || path.startsWith(`${base}/`);
}

/** True on any duty surface except the leave redirect. */
export function isDutyPath(pathname) {
  const path = clean(pathname);
  if (path.endsWith("/leave")) return false;
  return DUTY_PATHS.some((base) => under(path, base));
}

function tabOf(search) {
  return new URLSearchParams(String(search || "").replace(/^\?/, "")).get("tab") || "";
}

function isShifts(path) {
  return under(path, "/app/shifts") || under(path, "/app/attendance/shifts");
}

function isCalendar(path) {
  return under(path, "/app/calendar") || under(path, "/app/attendance/calendar");
}

/**
 * @param {{ side: "employee"|"manage"|string, ar: boolean, canPolicy?: boolean, badge?: number|null }} options
 */
export function dutySectionPages({ side, ar, canPolicy = false, badge = null }) {
  if (side === "manage") {
    return [
      {
        key: "team",
        to: "/app/attendance?lane=manage",
        label: ar ? "حضور الفريق" : "Team attendance",
        icon: Users,
        badge: badge || null,
        match: (path, search) => clean(path) === "/app/attendance" && !["policy", "settings", "map"].includes(tabOf(search)),
      },
      {
        key: "shifts",
        to: "/app/shifts?lane=manage",
        label: ar ? "جدول الدوام" : "Duty roster",
        icon: CalendarClock,
        match: (path) => isShifts(clean(path)),
      },
      ...(canPolicy
        ? [{
            key: "policy",
            to: "/app/attendance?lane=manage&tab=policy",
            label: ar ? "السياسة والمواقع" : "Policy and sites",
            icon: MapPinned,
            match: (path, search) => clean(path) === "/app/attendance" && ["policy", "settings", "map"].includes(tabOf(search)),
          }]
        : []),
    ];
  }
  const recordTabs = ["record", "mine", "report"];
  return [
    {
      key: "punch",
      to: "/app/attendance",
      label: ar ? "بصمتي" : "My punch",
      icon: Fingerprint,
      match: (path, search) => clean(path) === "/app/attendance" && !recordTabs.includes(tabOf(search)),
    },
    {
      key: "record",
      to: "/app/attendance?tab=record",
      label: ar ? "سجلي" : "My record",
      icon: CalendarDays,
      match: (path, search) => clean(path) === "/app/attendance" && recordTabs.includes(tabOf(search)),
    },
    {
      key: "calendar",
      to: "/app/calendar",
      label: ar ? "التقويم التشغيلي" : "Operations calendar",
      icon: CalendarClock,
      // Employee lane only — the management lane plans on جدول الدوام.
      match: (path) => isCalendar(clean(path)),
    },
    {
      key: "shifts",
      to: "/app/shifts",
      label: ar ? "جدولي" : "My roster",
      icon: CalendarRange,
      match: (path) => isShifts(clean(path)),
    },
  ];
}

/** Breadcrumb leaf for a duty page: the section, then the lane page. */
export function dutyCrumb(pages, pathname, search) {
  return pages.find((page) => page.match(pathname, search)) || null;
}
