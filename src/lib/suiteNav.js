/**
 * In-app navigation derived from SUITE_APPS — sidebar rail, section pages, search, mobile tabs.
 */
import {
  LayoutDashboard,
  ListTodo,
  ShieldQuestion,
  MessageCircle,
  MessageSquare,
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
  Briefcase,
  CalendarClock,
  CalendarOff,
  Network,
  Settings2,
  HelpCircle,
  UserCog,
  Trophy,
  ArrowUpCircle,
} from "lucide-react";
import { SUITE_APPS, SUITE_GROUPS, suiteAppLabel } from "@/lib/suiteApps";

/** Sidebar group-rail order (production nirovera.sa/app). */
export const SUITE_GROUP_ORDER = [
  "daily",
  "workforce",
  "compliance",
  "money",
  "admin",
];

const LUCIDE_BY_ICON = {
  grid: LayoutDashboard,
  ops: ListTodo,
  escalation: ArrowUpCircle,
  clock: CalendarClock,
  camera: Camera,
  pen: PenLine,
  day: FileText,
  chat: MessageSquare,
  cal: CalendarOff,
  users: UserCog,
  brief: Briefcase,
  trend: Trophy,
  org: Network,
  shield: ShieldQuestion,
  message: MessageCircle,
  wallet: Banknote,
  receipt: ReceiptText,
  chart: Calculator,
  box: Boxes,
  folder: FolderOpen,
  spark: Sparkles,
  settings: Settings2,
  help: HelpCircle,
};

const ICON_OVERRIDES = {
  command: LayoutDashboard,
  attendance: ClipboardCheck,
  inventory: Warehouse,
};

/** Group-level icons for the compact sidebar rail. */
const RAIL_ICONS = {
  daily: LayoutDashboard,
  workforce: UserCog,
  compliance: ShieldQuestion,
  money: Banknote,
  admin: Network,
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

/** Labels used on the group rail (production wording). */
export function suiteRailGroupMeta(lang = "ar") {
  const ar = lang !== "en";
  return {
    daily: { icon: RAIL_ICONS.daily, label: ar ? "التشغيل اليومي" : "Daily Ops" },
    workforce: { icon: RAIL_ICONS.workforce, label: ar ? "القوى العاملة" : "Workforce" },
    compliance: { icon: RAIL_ICONS.compliance, label: ar ? "الالتزام والرعاية" : "Care & Compliance" },
    money: { icon: RAIL_ICONS.money, label: ar ? "المال والأصول" : "Money & Assets" },
    admin: { icon: RAIL_ICONS.admin, label: ar ? "المؤسسة" : "Institution" },
  };
}

/** All suite paths plus legacy manual route for plan gates. */
export function suiteAppPaths() {
  return [...SUITE_APPS.map((app) => app.path), "/app/manual"];
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
 * @param {{ badgeFor?: (app: import("@/lib/suiteApps").SuiteApp) => number | undefined }} [options]
 */
export function buildSuiteNavItems(lang, options = {}) {
  const { badgeFor } = options;
  return SUITE_APPS.filter((app) => app.rail !== false).map((app) => ({
    to: app.path,
    icon: suiteLucideIcon(app),
    label: suiteAppLabel(app, lang),
    end: app.path === "/app",
    category: app.group,
    badge: badgeFor?.(app),
    appId: app.id,
  }));
}

/**
 * Build primary sidebar destinations — one link per suite group.
 * @param {ReturnType<typeof buildSuiteNavItems>} visibleItems
 * @param {string} lang
 */
export function buildSuiteRailGroups(visibleItems, lang = "ar") {
  const meta = suiteRailGroupMeta(lang);
  return SUITE_GROUP_ORDER.map((key) => {
    const items = visibleItems.filter((item) => item.category === key);
    if (!items.length) return null;
    const badge = items.reduce((sum, item) => sum + (item.badge || 0), 0) || undefined;
    return {
      key,
      icon: meta[key]?.icon || LayoutDashboard,
      label: meta[key]?.label || key,
      items,
      to: items[0].to,
      badge,
    };
  }).filter(Boolean);
}

const MOBILE_TAB_IDS = [
  "command",
  "attendance",
  "tasks",
  "work-proof",
  "chat",
  "inventory",
  "expenses",
  "hr",
  "daily-report",
  "safety",
];

const MOBILE_I18N_KEYS = {
  command: "dashboard",
  tasks: "myTasks",
  "work-proof": "workProof",
  attendance: "attendanceScheduling",
  chat: "chat",
  inventory: "inventory",
  expenses: "expenses",
  hr: "hr",
  "daily-report": "reports",
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
