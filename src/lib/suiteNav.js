/**
 * In-app navigation derived from SUITE_APPS — sidebar rail, section pages, search, mobile tabs.
 */
import {
  LayoutDashboard,
  ListTodo,
  ShieldQuestion,
  MessageCircle,
  FileText,
  PenLine,
  ClipboardCheck,
  FolderOpen,
  Sparkles,
  Banknote,
  Warehouse,
  Boxes,
  Calculator,
  ReceiptText,
  Camera,
  IdCard,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  Network,
  Settings2,
  UserCog,
  Trophy,
  ArrowUpCircle,
  Scale,
  Megaphone,
} from "lucide-react";
import { SUITE_APPS, SUITE_GROUPS, suiteAppLabel } from "@/lib/suiteApps";
import { RAIL_SIDES, railBadgeKind, railBadgeTone, buildSuiteRailClusters, activeSuiteRailKey } from "@/lib/suiteRailFrame";

export { RAIL_SIDES, railBadgeKind, railBadgeTone, buildSuiteRailClusters, activeSuiteRailKey };

/** Sidebar group-rail order — v4 section split. Owner board is not a company group. */
export const SUITE_GROUP_ORDER = [
  "decide",
  "daily",
  "signing",
  "duty",
  "requests",
  "workforce",
  "performance",
  "complaints",
  "people",
  "discipline",
  "compliance",
  "money",
  "admin",
];

const LUCIDE_BY_ICON = {
  grid: LayoutDashboard,
  ops: ListTodo,
  escalation: ArrowUpCircle,
  clock: CalendarClock,
  month: CalendarDays,
  camera: Camera,
  idcard: IdCard,
  pen: PenLine,
  day: FileText,
  cal: CalendarOff,
  clip: ClipboardList,
  users: UserCog,
  brief: Briefcase,
  trend: Trophy,
  org: Network,
  shield: ShieldQuestion,
  message: MessageCircle,
  megaphone: Megaphone,
  wallet: Banknote,
  receipt: ReceiptText,
  chart: Calculator,
  box: Boxes,
  folder: FolderOpen,
  spark: Sparkles,
  settings: Settings2,
};

const ICON_OVERRIDES = {
  command: LayoutDashboard,
  attendance: ClipboardCheck,
  inventory: Warehouse,
};

/** Group-level icons for the compact sidebar rail. */
const RAIL_ICONS = {
  decide: LayoutDashboard,
  daily: ListTodo,
  signing: PenLine,
  duty: CalendarClock,
  requests: ClipboardList,
  workforce: UserCog,
  performance: Trophy,
  complaints: Megaphone,
  people: Network,
  discipline: Scale,
  compliance: ShieldQuestion,
  money: Banknote,
  admin: FolderOpen,
};

/** @param {import("@/lib/suiteApps").SuiteApp} app */
export function suiteLucideIcon(app) {
  if (ICON_OVERRIDES[app.id]) return ICON_OVERRIDES[app.id];
  return LUCIDE_BY_ICON[app.icon] || LayoutDashboard;
}

export function suiteNavGroupLabels(lang = "ar") {
  return Object.fromEntries(
    SUITE_GROUPS.map((group) => [group.id, lang === "en" ? group.en : group.ar]),
  );
}

/** Labels used on the group rail — v4 nav items, not the platform owner board. */
export function suiteRailGroupMeta(lang = "ar", role = "") {
  const ar = lang !== "en";
  const employee = role === "employee";
  return {
    decide: { icon: RAIL_ICONS.decide, label: ar ? "لوحة القيادة" : "Dashboard" },
    daily: { icon: RAIL_ICONS.daily, label: ar ? (employee ? "مهامي" : "المهام والعمليات") : (employee ? "My tasks" : "Operations") },
    signing: { icon: RAIL_ICONS.signing, label: ar ? (employee ? "توقيعاتي" : "التوقيع الرقمي") : (employee ? "My signing" : "Digital Signing") },
    duty: { icon: RAIL_ICONS.duty, label: ar ? (employee ? "بصمتي" : "الحضور والدوام") : (employee ? "My punch" : "Time & Attendance") },
    requests: { icon: RAIL_ICONS.requests, label: ar ? (employee ? "طلباتي" : "الطلبات") : "Requests" },
    workforce: { icon: RAIL_ICONS.workforce, label: ar ? "القوى العاملة" : "Workforce" },
    performance: { icon: RAIL_ICONS.performance, label: ar ? (employee ? "أدائي" : "الأداء") : "Performance" },
    complaints: { icon: RAIL_ICONS.complaints, label: ar ? "صوت الموظف" : "Employee Voice" },
    people: { icon: RAIL_ICONS.people, label: ar ? "المحطات التي أديرها" : "Stations I manage" },
    discipline: { icon: RAIL_ICONS.discipline, label: ar ? "الجزاءات" : "Sanctions" },
    compliance: { icon: RAIL_ICONS.compliance, label: ar ? (employee ? "بلاغ سلامة" : "السلامة HSE") : (employee ? "Safety report" : "Safety HSE") },
    money: { icon: RAIL_ICONS.money, label: ar ? "المال والأصول" : "Money & Assets" },
    admin: { icon: RAIL_ICONS.admin, label: ar ? "الملفات والمساعد" : "Files & assistant" },
  };
}

/** All suite paths for plan gates. */
export function suiteAppPaths() {
  return SUITE_APPS.map((app) => app.path);
}

/** Route → plan section map for navVisibility. */
export function buildPlanRouteSections() {
  /** @type {Record<string, string>} */
  const map = {};
  for (const app of SUITE_APPS) {
    if (app.planSection) map[app.path] = app.planSection;
  }
  return map;
}

/**
 * Match strength for a nav item against the current path.
 * @returns {"exact" | "prefix" | null}
 */
export function matchSuiteNavItem(item, pathname) {
  const paths = [item.to, ...(item.aliases || [])];
  if (item.end) return pathname === item.to ? "exact" : null;
  if (paths.some((path) => pathname === path)) return "exact";
  if (paths.some((path) => pathname.startsWith(`${path}/`))) return "prefix";
  return null;
}

/**
 * @param {string} lang
 * @param {{ badgeFor?: (app: import("@/lib/suiteApps").SuiteApp) => number | undefined, glowFor?: (app: import("@/lib/suiteApps").SuiteApp) => string | undefined }} [options]
 */
export function buildSuiteNavItems(lang, options = {}) {
  const { badgeFor, glowFor } = options;
  return SUITE_APPS.filter((app) => app.rail !== false).map((app) => ({
    to: app.path,
    icon: suiteLucideIcon(app),
    label: suiteAppLabel(app, lang),
    end: app.path === "/app" || app.id === "attendance",
    category: app.group,
    badge: badgeFor?.(app),
    glow: glowFor?.(app),
    appId: app.id,
    aliases: app.aliases || [],
  }));
}

/**
 * Build primary sidebar destinations — one link per suite group.
 * @param {ReturnType<typeof buildSuiteNavItems>} visibleItems
 * @param {string} lang
 */
export function buildSuiteRailGroups(visibleItems, lang = "ar", role = "") {
  const meta = suiteRailGroupMeta(lang, role);
  return SUITE_GROUP_ORDER.map((key) => {
    const items = visibleItems.filter((item) => item.category === key);
    if (!items.length) return null;
    const badge = items.reduce((sum, item) => sum + (item.badge || 0), 0) || undefined;
    const glow = items.some((item) => item.glow === "due") ? "due" : undefined;
    return {
      key,
      icon: meta[key]?.icon || LayoutDashboard,
      label: meta[key]?.label || key,
      items,
      to: items[0].to,
      badge,
      glow,
      badgeKind: railBadgeKind(key),
    };
  }).filter(Boolean);
}

const MOBILE_TAB_IDS = [
  "command",
  "attendance",
  "tasks",
  "work-proof",
  "inventory",
  "expenses",
  "hr",
  "safety",
];

const MOBILE_I18N_KEYS = {
  command: "dashboard",
  tasks: "myTasks",
  "work-proof": "workProof",
  attendance: "attendanceScheduling",
  inventory: "inventory",
  expenses: "expenses",
  hr: "hr",
  complaints: "allComplaints",
  safety: "safety",
};

/** Bottom tab bar entries — paths and icons from catalog, labels via i18n keys. */
export function buildMobileTabs() {
  return MOBILE_TAB_IDS.map((id) => {
    const app = SUITE_APPS.find((row) => row.id === id);
    if (!app) return null;
    return {
      to: app.path,
      icon: suiteLucideIcon(app),
      key: MOBILE_I18N_KEYS[id] || id,
      end: app.path === "/app",
    };
  }).filter(Boolean);
}

/** Global search group labels from SUITE_GROUPS. */
export function searchGroupLabel(category, lang = "ar") {
  const group = SUITE_GROUPS.find((row) => row.id === category);
  if (group) return lang === "en" ? group.en : group.ar;
  return lang === "ar" ? "قسم" : "Section";
}
