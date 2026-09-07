/**
 * Saudi ERP module metadata — kickers, trust tags, and section framing per app.
 */
import { SUITE_APPS, SUITE_GROUPS } from "@/lib/suiteApps";

/** @type {Record<string, { ar: string[], en: string[] }>} */
const MODULE_SAUDI = {
  command: { ar: ["ERP موحّد", "دورة إثبات"], en: ["Unified ERP", "Proof cycle"] },
  attendance: { ar: ["موقع الفرع", "تكامل الإجازات"], en: ["Station geofence", "Leave sync"] },
  tasks: { ar: ["إثبات ميداني", "تصعيد تلقائي"], en: ["Field proof", "Auto escalation"] },
  escalation: { ar: ["سلسلة الفرع", "صندوق مراجعة"], en: ["Branch chain", "Review inbox"] },
  "work-proof": { ar: ["إفصاح العميل", "رقم تحقق"], en: ["Client disclosure", "Verify link"] },
  signing: { ar: ["ختم رقمي", "سجل تدقيق"], en: ["Digital seal", "Audit trail"] },
  "daily-report": { ar: ["تقرير الفرع", "اعتماد يومي"], en: ["Station report", "Daily approval"] },
  payroll: { ar: ["حماية الأجور", "WPS / مدى"], en: ["Wage protection", "WPS / Mudad"] },
  expenses: { ar: ["ميزانية الفرع", "مسار اعتماد"], en: ["Station budget", "Approval path"] },
  assets: { ar: ["سجل QR", "تسليم موثّق", "شرط إنهاء الخدمة"], en: ["QR register", "Documented handover", "Offboarding gate"] },
  inventory: { ar: ["مخزون الفروع", "صرف للعمل"], en: ["Multi-station stock", "Issue to work"] },
  hr: { ar: ["نطاقات", "قوى · تأمينات"], en: ["Nitaqat", "Qiwa · GOSI"] },
  org: { ar: ["صلاحيات الهيكل", "تصعيد"], en: ["Org permissions", "Escalation"] },
  performance: { ar: ["مهام معتمدة", "بدون تقييم وهمي"], en: ["Approved tasks", "No vanity scores"] },
  safety: { ar: ["HSE", "إغلاق المخاطر"], en: ["HSE", "Hazard closure"] },
  complaints: { ar: ["صوت محمي", "مسار تصعيد"], en: ["Protected voice", "Escalation path"] },
  discipline: { ar: ["مواد 66–73", "تظلم 30 يوماً"], en: ["Arts 66–73", "30-day appeal"] },
  files: { ar: ["أرشيف الشركة", "صلاحيات"], en: ["Company archive", "Permissions"] },
  assistant: { ar: ["ضمن صلاحياتك", "بيانات الشركة"], en: ["Within permissions", "Company data"] },
  settings: { ar: ["هوية الشركة", "نطاق الفروع"], en: ["Company identity", "Station scope"] },
  help: { ar: ["دليل تشغيل", "عربي أولاً"], en: ["Ops guide", "Arabic-first"] },
  chat: { ar: ["قنوات الفروع", "ضمن الصلاحية"], en: ["Station channels", "Permission-scoped"] },
  shifts: { ar: ["جدول شهري", "يرتبط بالحضور"], en: ["Monthly matrix", "Feeds attendance"] },
  leave: { ar: ["استحقاق", "يمنع الحضور"], en: ["Entitlement", "Blocks check-in"] },
};

const PROOF_CYCLE_IDS = new Set([
  "attendance", "tasks", "escalation", "signing", "work-proof", "daily-report", "payroll",
]);

const MONEY_PROOF_IDS = new Set(["payroll", "expenses", "assets", "inventory"]);

/** @param {string} path e.g. /app/hr */
export function erpMetaForPath(path) {
  const app = SUITE_APPS.find((row) => row.path === path);
  if (!app) return null;

  const group = SUITE_GROUPS.find((g) => g.id === app.group);
  const groupIndex = SUITE_GROUPS.findIndex((g) => g.id === app.group) + 1;

  return {
    appId: app.id,
    path: app.path,
    group: app.group,
    groupLabelAr: group?.ar || "",
    groupLabelEn: group?.en || "",
    kickerAr: `${String(groupIndex).padStart(2, "0")} · ${group?.ar || ""}`,
    kickerEn: `${String(groupIndex).padStart(2, "0")} · ${group?.en || ""}`,
    showProofCycle: PROOF_CYCLE_IDS.has(app.id) || MONEY_PROOF_IDS.has(app.id),
    showHubStrip: app.id !== "command",
    saudiTagsAr: MODULE_SAUDI[app.id]?.ar || [],
    saudiTagsEn: MODULE_SAUDI[app.id]?.en || [],
  };
}

export function erpKicker(path, lang = "ar") {
  const meta = erpMetaForPath(path);
  if (!meta) return "NiroVera ERP";
  return lang === "en" ? meta.kickerEn : meta.kickerAr;
}

export function saudiTagsForPath(path, lang = "ar") {
  const meta = erpMetaForPath(path);
  if (!meta) return [];
  return lang === "en" ? meta.saudiTagsEn : meta.saudiTagsAr;
}
