/**
 * Single catalog of NiroVera suite apps — feeds public gallery, pricing,
 * signup transparency, and in-app launcher. Settings stays app-only.
 */

export const SUITE_GROUPS = [
  {
    id: "decide",
    ar: "القرار",
    en: "Decision",
    num: "",
    blurbAr: "نظرة قرار: الحضور يغذّي المسير، والمهمة تحتاج إثباتاً.",
    blurbEn: "A decision glance: attendance feeds payroll, and a task needs proof.",
  },
  {
    id: "daily",
    ar: "التشغيل اليومي",
    en: "Daily operations",
    num: "01",
    blurbAr: "مهمة ثم إثبات للعميل — والحضور من قسم الدوام يغذي البداية.",
    blurbEn: "Task, then client proof — attendance in Time & Attendance starts the chain.",
  },
  {
    id: "signing",
    ar: "التوقيع الرقمي",
    en: "Digital Signing",
    num: "02",
    blurbAr: "ختم ورقم تحقق قابل للمراجعة — حلقة الإثبات الخامسة.",
    blurbEn: "Seal and a verifiable stamp — the fifth ring of the proof cycle.",
  },
  {
    id: "duty",
    ar: "الدوام والحضور",
    en: "Time & Attendance",
    num: "03",
    blurbAr: "جدول الورديات يحدد من يجب أن يحضر — ثم تسجيل الحضور والانصراف يغذي المسير.",
    blurbEn: "The rota says who should be present — then check-in feeds payroll.",
  },
  {
    id: "requests",
    ar: "طلباتي",
    en: "My Requests",
    num: "04",
    blurbAr: "إجازة وطلبات أخرى في صندوق واحد.",
    blurbEn: "Leave and other requests in one inbox.",
  },
  {
    id: "workforce",
    ar: "القوى العاملة",
    en: "Workforce",
    num: "05",
    blurbAr: "هيكل ثم ملفات.",
    blurbEn: "Org, then files.",
  },
  {
    id: "performance",
    ar: "الأداء",
    en: "Performance",
    num: "06",
    blurbAr: "أهداف ووزن مهام معتمدة من دورة الإثبات.",
    blurbEn: "Goals and approved task weight from the proof cycle.",
  },
  {
    id: "complaints",
    ar: "صوت الموظف",
    en: "Employee Voice",
    num: "07",
    blurbAr: "اقتراح وشكوى وبلاغ مجهول بمسار تصعيد.",
    blurbEn: "Suggestion, complaint, and anonymous report with an escalation path.",
  },
  {
    id: "people",
    ar: "الناس",
    en: "Stations I manage",
    num: "",
    blurbAr: "المحطات التي تديرها — المقاعد والتصعيد من الهيكل.",
    blurbEn: "Stations you manage — seats and escalation from the org.",
  },
  {
    id: "discipline",
    ar: "الجزاءات",
    en: "Sanctions",
    num: "08",
    blurbAr: "واقعة ثم إشعار ومحضر وقرار وتظلم.",
    blurbEn: "Incident, notice, hearing, decision, appeal.",
  },
  {
    id: "compliance",
    ar: "الالتزام والرعاية",
    en: "Care & compliance",
    num: "09",
    blurbAr: "سلامة الموقع داخل سلسلة الثقة.",
    blurbEn: "Site safety inside the trust chain.",
  },
  {
    id: "money",
    ar: "المال والأصول",
    en: "Money & assets",
    num: "10",
    blurbAr: "البصمة تغذّي المسير. المصروف والمخزون والأصول والعهد في مسار واحد، ولكل مسار سطحه.",
    blurbEn: "Attendance feeds payroll. Expenses, stock, and assets & custody each have their own path.",
  },
  {
    id: "admin",
    ar: "المؤسسة",
    en: "Institution",
    num: "11",
    blurbAr: "ملفات ومساعد ذكي داخل صلاحياتك.",
    blurbEn: "Files and AI assistant within your permissions.",
  },
];

/** @typedef {{ id: string, path: string, planSection: string | null, group: string, public: boolean, rail?: boolean, aliases?: string[], ar: string, en: string, blurbAr: string, blurbEn: string, icon: string }} SuiteApp */

/** @type {SuiteApp[]} */
export const SUITE_APPS = [
  {
    id: "command",
    path: "/app",
    planSection: null,
    group: "decide",
    public: true,
    ar: "لوحة القيادة",
    en: "Dashboard",
    blurbAr: "نظرة قرار عبر الناس والتشغيل والثقة.",
    blurbEn: "Decision glance across people, ops, and trust.",
    icon: "grid",
  },
  {
    id: "attendance",
    path: "/app/attendance",
    planSection: "attendance",
    group: "duty",
    public: true,
    ar: "الحضور",
    en: "Attendance",
    blurbAr: "سؤالان: مَن يسجّل، وأين هو. البصمة من الجدول فقط.",
    blurbEn: "Two questions: who punched, and where. The punch follows the rota only.",
    icon: "clock",
  },
  {
    id: "calendar",
    path: "/app/calendar",
    planSection: "attendance",
    group: "duty",
    public: true,
    aliases: ["/app/attendance/calendar"],
    ar: "التقويم التشغيلي",
    en: "Operational calendar",
    blurbAr: "كل يوم يحمل توزيعه: حضر، تأخّر، غاب — واليوم الذي انكسرت فيه حلقة يُعلَّم بحدّ ذهبي.",
    blurbEn: "Each day carries its split: on time, late, absent — a broken ring is marked in gold.",
    icon: "month",
  },
  {
    id: "tasks",
    path: "/app/tasks",
    planSection: "tasks",
    group: "daily",
    public: true,
    ar: "المهام والعمليات",
    en: "Operations",
    blurbAr: "أمر عمل لموظف الشركة — حتى إن نفّذ العمل في فرع آخر.",
    blurbEn: "A work order for a company employee — even if they execute at another branch.",
    icon: "ops",
  },
  {
    id: "escalation",
    path: "/app/escalation",
    planSection: "tasks",
    group: "daily",
    public: false,
    ar: "التصعيد",
    en: "Escalation",
    blurbAr: "صندوق مراجعة — سلسلة لكل فرع حتى القمة.",
    blurbEn: "Review inbox — per-station chain to the top.",
    icon: "escalation",
  },
  {
    id: "signing",
    path: "/app/signing",
    planSection: "signing",
    group: "signing",
    public: true,
    ar: "التوقيع الرقمي",
    en: "Digital Signing",
    blurbAr: "ختم ورقم تحقق قابل للمراجعة.",
    blurbEn: "Seal and verifiable stamp.",
    icon: "pen",
  },
  {
    id: "work-proof",
    path: "/app/work-proof",
    planSection: "tasks",
    group: "daily",
    public: true,
    ar: "إثبات العمل",
    en: "Work Proof",
    blurbAr: "إثبات عمل لجهة خارج الشركة — المنشئ والمنشأة وهويات العمال.",
    blurbEn: "Work proof for an outside company — raiser, establishment, worker IDs.",
    icon: "camera",
  },
  {
    id: "visitor-proof",
    path: "/app/visitor-proof",
    planSection: "tasks",
    group: "daily",
    public: true,
    ar: "إثبات زائر",
    en: "Visitor Proof",
    blurbAr: "ضيف على الفرع — ليس موظفاً ينفّذ من فرع آخر وليس جهة خارجية.",
    blurbEn: "A guest at the station — not a company employee executing from another branch, and not an outside company.",
    icon: "idcard",
  },
  {
    id: "org",
    path: "/app/org",
    planSection: "hr",
    group: "people",
    public: true,
    ar: "المحطات التي أديرها",
    en: "Stations I manage",
    blurbAr: "الوظيفة ثابتة، والشخص يتغيّر — فروع ومقاعد وتصعيد.",
    blurbEn: "The seat stays, the person changes — stations, seats, escalation.",
    icon: "org",
  },
  {
    id: "hr",
    path: "/app/hr",
    planSection: "hr",
    group: "workforce",
    public: true,
    ar: "الموارد البشرية",
    en: "Human Resources",
    blurbAr: "ملفات وعقود وامتثال صاحب العمل.",
    blurbEn: "Files, contracts, employer compliance.",
    icon: "users",
  },
  {
    id: "performance",
    path: "/app/performance",
    planSection: "performance",
    group: "performance",
    public: true,
    ar: "الأداء",
    en: "Performance",
    blurbAr: "أهداف ووزن مهام معتمدة.",
    blurbEn: "Goals and approved task weight.",
    icon: "trend",
  },
  {
    id: "shifts",
    path: "/app/shifts",
    planSection: "attendance",
    group: "duty",
    public: true,
    aliases: ["/app/attendance/shifts"],
    ar: "جدول الدوام",
    en: "Duty roster",
    blurbAr: "الوردية المنشورة هي مصدر الوقت: من يحضر ومتى يُعدّ متأخراً.",
    blurbEn: "The published shift is the clock: who attends, and when lateness starts.",
    icon: "clock",
  },
  {
    id: "requests",
    path: "/app/requests",
    planSection: "attendance",
    group: "requests",
    public: true,
    aliases: ["/app/leave", "/app/attendance/leave", "/app/requests/leave", "/app/requests/other", "/app/requests/manage", "/app/requests/archive"],
    ar: "طلباتي",
    en: "My Requests",
    blurbAr: "إجازة وطلبات أخرى في صندوق واحد.",
    blurbEn: "Leave and other requests in one inbox.",
    icon: "clip",
  },
  {
    id: "safety",
    path: "/app/safety",
    planSection: "safety",
    group: "compliance",
    public: true,
    ar: "السلامة HSE",
    en: "Safety HSE",
    blurbAr: "مخاطر وإغلاقات واعتماد.",
    blurbEn: "Hazards, closures, and approval.",
    icon: "shield",
  },
  {
    id: "complaints",
    path: "/app/complaints",
    planSection: "complaints",
    group: "complaints",
    public: true,
    ar: "صوت الموظف",
    en: "Employee Voice",
    blurbAr: "اقتراح وشكوى وبلاغ مجهول بمسار تصعيد.",
    blurbEn: "Suggestion, complaint, and anonymous report with an escalation path.",
    icon: "megaphone",
  },
  {
    id: "discipline",
    path: "/app/discipline",
    planSection: "hr",
    group: "discipline",
    public: true,
    ar: "الجزاءات",
    en: "Sanctions",
    blurbAr: "واقعة ثم إشعار ومحضر وقرار وتظلم.",
    blurbEn: "Incident, notice, hearing, decision, appeal.",
    icon: "shield",
  },
  {
    id: "payroll",
    path: "/app/payroll",
    planSection: "payroll",
    group: "money",
    public: true,
    ar: "الرواتب",
    en: "Payroll",
    blurbAr: "الحضور يُقفل في المسير قبل ملف مدى. مواد 90 و92 و93 و107.",
    blurbEn: "Attendance closes into the run before the Mudad file. Art. 90, 92, 93 and 107.",
    icon: "wallet",
  },
  {
    id: "expenses",
    path: "/app/expenses",
    planSection: "expenses",
    group: "money",
    public: true,
    ar: "المصروفات",
    en: "Expenses",
    blurbAr: "وعاء تشغيلي · إيصال بوابة · اعتماد متدرّج بالمبلغ.",
    blurbEn: "Operating vessel · receipt gate · amount-derived approval.",
    icon: "receipt",
  },
  {
    id: "assets",
    path: "/app/assets",
    planSection: "assets",
    group: "money",
    public: true,
    ar: "الأصول / العهد",
    en: "Assets / Custody",
    blurbAr: "سجل أصل · حائز واحد · نقل بين الفروع · تسليم بتوقيع الطرفين.",
    blurbEn: "Asset register · one holder · inter-station transfer · dual-sign handover.",
    icon: "box",
  },
  {
    id: "inventory",
    path: "/app/inventory",
    planSection: "inventory",
    group: "money",
    public: true,
    ar: "المخزون",
    en: "Inventory",
    blurbAr: "لا مركزي: رصيد الفرع · شراء · طلب من فرع آخر · صرف للعمل.",
    blurbEn: "Decentralised: station balance · buy · request from another station · issue to work.",
    icon: "box",
  },
  {
    id: "files",
    path: "/app/files",
    planSection: "files",
    group: "admin",
    public: true,
    ar: "الملفات",
    en: "Files",
    blurbAr: "أرشيف المستندات — قسم مستقل.",
    blurbEn: "Document archive — its own section.",
    icon: "folder",
  },
  {
    id: "assistant",
    path: "/app/assistant",
    planSection: "assistant",
    group: "admin",
    public: true,
    ar: "المساعد الذكي",
    en: "AI Assistant",
    blurbAr: "اسأل بيانات الشركة داخل صلاحياتك.",
    blurbEn: "Ask company data within your permissions.",
    icon: "spark",
  },
  {
    id: "settings",
    path: "/app/settings",
    planSection: "hr",
    group: "admin",
    public: false,
    ar: "إعدادات الشركة",
    en: "Company Settings",
    blurbAr: "نطاق الفروع والصلاحيات والهوية.",
    blurbEn: "Station scope, permissions, and identity.",
    icon: "settings",
  },
];

export const SUITE_ICON_PATHS = {
  day: ["M5 3.5h14v17H5z", "M8.5 8h7", "M8.5 12h7", "M8.5 16h4"],
  org: ["M9.5 3.5h5v4h-5z", "M3 16.5h5v4H3z", "M16 16.5h5v4h-5z", "M12 7.5v3", "M5.5 16.5v-3h13v3"],
  cal: ["M4 6.5h16v14H4z", "M4 10.5h16", "M8.5 3.5v4", "M15.5 3.5v4"],
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M14 14h6v6h-6z", "M4 14h6v6H4z"],
  ops: ["M9 11.5l2.2 2.2L16 9", "M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.5V12l3 1.8"],
  camera: ["M4 8h3l1.6-2.2h6.8L17 8h3v11H4z", "M9.4 13.2l1.8 1.8 3.4-3.6"],
  shield: ["M12 3l7.5 3v5.5c0 4.6-3.1 7.7-7.5 9.5-4.4-1.8-7.5-4.9-7.5-9.5V6z", "M12 9v4", "M12 16.2h.01"],
  box: ["M20.5 7.8L12 3 3.5 7.8 12 12.6z", "M3.5 7.8v8.4L12 21l8.5-4.8V7.8"],
  chat: ["M20.5 4.5h-17v11h4v4l4.5-4h8.5z"],
  users: ["M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M3 20a6.5 6.5 0 0 1 13 0", "M17 10.5a3 3 0 1 0 0-6", "M18.5 20a6 6 0 0 0-2.6-4.9"],
  trend: ["M3.5 16.5l5-5 3.5 3.5 8-8", "M15.5 7h4.5v4.5"],
  wallet: ["M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h11", "M16.5 13.5h.01"],
  receipt: ["M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5z", "M9.5 9h5", "M9.5 13h5"],
  folder: ["M3.5 6.5h6l2 2.5h9v9.5h-17z"],
  pen: ["M12.5 20H21", "M16.6 3.9a2.1 2.1 0 0 1 3 3L7.4 19.1 3.5 20.2l1.1-3.9z"],
  message: ["M20.5 12a8 8 0 0 1-8 8H7l-3.5 2.5V12a8 8 0 0 1 8-8h1a8 8 0 0 1 8 8z"],
  chart: ["M4.5 20V11", "M10 20V4.5", "M15.5 20v-6", "M21 20H3.5"],
  hand: ["M8 13.5V8.2a1.2 1.2 0 0 1 2.4 0V12", "M10.4 12V7.4a1.2 1.2 0 1 1 2.4 0V12", "M12.8 12V8.6a1.2 1.2 0 1 1 2.4 0v6.2c0 2.4-1.7 4.2-4.4 4.2H9.2C6.6 19 5 17.2 5 14.8V13l3-3.2"],
  spark: ["M12 3.5l1.9 5.3 5.3 1.9-5.3 1.9L12 17.9l-1.9-5.3L4.8 10.7l5.3-1.9z"],
  brief: ["M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7", "M4 8.5h16v11H4z", "M4 12.5h16"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
};

export function publicSuiteApps() {
  return SUITE_APPS.filter((app) => app.public);
}

export function suiteAppsByGroup(apps = SUITE_APPS) {
  return SUITE_GROUPS.map((group) => ({
    ...group,
    apps: apps.filter((app) => app.group === group.id),
  })).filter((group) => group.apps.length > 0);
}

export function suiteAppLabel(app, lang = "ar") {
  return lang === "en" ? app.en : app.ar;
}

/** Longest matching suite app for a live path (aliases included). `/app` stays exact. */
export function suiteAppForPath(pathname = "", apps = SUITE_APPS) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  let best = null;
  let bestLen = -1;
  for (const app of apps) {
    const candidates = [app.path, ...(app.aliases || [])];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const base = String(candidate).replace(/\/+$/, "") || "/";
      const match = base === "/app"
        ? (path === "/app")
        : (path === base || path.startsWith(`${base}/`));
      if (match && base.length > bestLen) {
        best = app;
        bestLen = base.length;
      }
    }
  }
  return best;
}

export function suiteAppBlurb(app, lang = "ar") {
  return lang === "en" ? app.blurbEn : app.blurbAr;
}

export function suiteGroupLabel(group, lang = "ar") {
  return lang === "en" ? group.en : group.ar;
}

export function suiteGroupBlurb(group, lang = "ar") {
  return lang === "en" ? group.blurbEn : group.blurbAr;
}

/** Plan section keys covered by the public suite (for signup transparency). */
export function suitePlanSections(apps = SUITE_APPS) {
  return [...new Set(apps.map((app) => app.planSection).filter(Boolean))];
}

export function appsEnabledForPlan(planConfig, apps = SUITE_APPS) {
  const sections = new Set(planConfig?.enabledSections || []);
  return apps.filter((app) => !app.planSection || sections.has(app.planSection));
}

export const WELCOME_FLAG_PREFIX = "nirovera_suite_welcome_";

export function welcomeStorageKey(companyId) {
  return `${WELCOME_FLAG_PREFIX}${companyId || "unknown"}`;
}

export function hasSeenSuiteWelcome(companyId) {
  try {
    return localStorage.getItem(welcomeStorageKey(companyId)) === "1";
  } catch {
    return true;
  }
}

export function markSuiteWelcomeSeen(companyId) {
  try {
    localStorage.setItem(welcomeStorageKey(companyId), "1");
  } catch {
    /* ignore */
  }
}
