// Fixed 5-tier global HR hierarchy (SAP-style). Each tier has a Manager (full
// action rights: approve / reject / escalate) and an Assistant (view & audit only).
// IDs are fixed strings so the hierarchy is stable across companies and schema migrations.

const NAMES = {
  1: {
    manager: { en: "Regional HR Manager", ar: "مدير م.ب. لمجموعة فروع", de: "Standort-HR-Manager", fr: "Responsable RH de site", es: "Gerente de RH del sitio", pt: "Gerente de RH do site", ru: "HR-менеджер площадки", ja: "拠点HRマネージャー", ko: "현장 HR 매니저" },
    assistant: { en: "HR Specialist", ar: "أخصائي موارد بشرية", de: "Standort-HR-Assistent", fr: "Assistant RH de site", es: "Asistente de RH del sitio", pt: "Assistente de RH do site", ru: "Ассистент HR площадки", ja: "拠点HRアシスタント", ko: "현장 HR 어시스턴트" },
  },
  2: {
    manager: { en: "Cluster HR Manager", ar: "مدير الفروع", de: "Cluster-HR-Manager", fr: "Responsable RH de cluster", es: "Gerente de RH de clúster", pt: "Gerente de RH de cluster", ru: "Менеджер HR кластера", ja: "クラスターHRマネージャー", ko: "클러스터 HR 매니저" },
    assistant: { en: "Cluster HR Assistant", ar: "مساعد مدير الفروع", de: "Cluster-HR-Assistent", fr: "Assistant RH de cluster", es: "Asistente de RH de clúster", pt: "Assistente de RH de cluster", ru: "Ассистент HR кластера", ja: "クラスターHRアシスタント", ko: "클러스터 HR 어시스턴트" },
  },
  3: {
    manager: { en: "Head of HR Operations", ar: "المدير فوق مدير الفروع", de: "Leiter HR-Operations", fr: "Chef des opérations RH", es: "Jefe de Operaciones de RH", pt: "Chefe de Operações de RH", ru: "Руководитель HR-операций", ja: "HRオペレーション責任者", ko: "HR 운영 총괄" },
    assistant: { en: "HR Operations Assistant", ar: "مساعد المدير فوق مدير الفروع", de: "HR-Operations-Assistent", fr: "Assistant opérations RH", es: "Asistente de Operaciones de RH", pt: "Assistente de Operações de RH", ru: "Ассистент по HR-операциям", ja: "HRオペレーションアシスタント", ko: "HR 운영 어시스턴트" },
  },
  4: {
    manager: { en: "Vice President of HR", ar: "نائب الرئيس", de: "Vizepräsident für HR", fr: "Vice-président RH", es: "Vicepresidente de RH", pt: "Vice-presidente de RH", ru: "Вице-президент по HR", ja: "HR担当副社長", ko: "HR 부사장" },
    assistant: { en: "Assistant to the VP of HR", ar: "مساعد نائب الرئيس", de: "Assistent des HR-Vizepräsidenten", fr: "Assistant du vice-président RH", es: "Asistente del vicepresidente de RH", pt: "Assistente do vice-presidente de RH", ru: "Ассистент вице-президента по HR", ja: "副社長アシスタント", ko: "부사장 어시스턴트" },
  },
  5: {
    manager: { en: "Chief Human Resources Officer (CHRO)", ar: "الرئيس", de: "Chief Human Resources Officer (CHRO)", fr: "Directeur des ressources humaines (CHRO)", es: "Director de Recursos Humanos (CHRO)", pt: "Diretor de Recursos Humanos (CHRO)", ru: "Директор по персоналу (CHRO)", ja: "最高人事責任者（CHRO）", ko: "최고인사책임자(CHRO)" },
    assistant: { en: "Executive Assistant to the CHRO", ar: "مساعد الرئيس", de: "Leitender Assistent des CHRO", fr: "Assistant exécutif du CHRO", es: "Asistente Ejecutivo del CHRO", pt: "Assistente Executivo do CHRO", ru: "Исполнительный ассистент CHRO", ja: "CHROエグゼクティブアシスタント", ko: "CHRO 임원 어시스턴트" },
  },
};

const NOTES = {
  1: {
    en: "Handles local station technician attendance, local leave forms, and daily corrective/safety task distribution.",
    ar: "يخدم فرعين أو ثلاثة. لا يرأس موظفي الفرع. التعيين والنقل لمديرة الموارد البشرية، والجدول يعتده مدير الفرع.",
  },
  2: {
    en: "Oversees a group of stations, balances staff shortages, and acts as the first escalation review for open reports.",
    ar: "يشرف على مجموعة من الفروع، ويعالج نقص الموظفين، ويُعد أول مستوى لمراجعة التصعيد للبلاغات المفتوحة.",
  },
  3: {
    en: "Controls company-wide payroll, global safety certification audits, and central HQ data access.",
    ar: "يتحكم في رواتب الشركة على مستوى المؤسسة، ومراجعات شهادات السلامة العالمية، والوصول المركزي لبيانات المقر الرئيسي.",
  },
  4: {
    en: "Approves regional policies, cross-departmental operations alignment, and next-to-final escalations.",
    ar: "يوافق على السياسات الإقليمية، ومواءمة العمليات بين الأقسام، ويتولى التصعيدات قبل الأخيرة.",
  },
  5: {
    en: "Approves global annual budgets, organizational chart updates, and serves as the ultimate final authority.",
    ar: "يوافق على الموازنات السنوية العالمية، وتحديثات الهيكل التنظيمي، ويُعد السلطة النهائية العليا.",
  },
};

// tier 1 = single station | tier 2 = cluster (group of stations) | tier 3-5 = company-wide
const SCOPE_BY_TIER = { 1: "station", 2: "cluster", 3: "company", 4: "company", 5: "company" };

export const HR_TIER_COUNT = 5;

export function tierLevelId(tier, role) {
  return `hr_t${tier}_${role}`; // role: "manager" | "assistant"
}

export function tierScope(tier) {
  return SCOPE_BY_TIER[tier];
}

export function tierName(tier, role, lang) {
  return NAMES[tier]?.[role]?.[lang] || NAMES[tier]?.[role]?.en || "";
}

export function tierNote(tier, lang) {
  return NOTES[tier]?.[lang] || NOTES[tier]?.en || "";
}

export const MANAGER_PERMISSIONS = ["view_employees", "manage_employees", "view_reports", "manage_leave", "view_safety", "manage_anonymous_reports", "view_anonymous_reports", "manage_payroll"];
export const ASSISTANT_PERMISSIONS = ["view_employees", "view_reports", "view_safety", "view_anonymous_reports"];

// The 10 default HR levels (5 tiers x manager/assistant), used only to seed a new
// company's hierarchy. `order` (not `tier`) drives escalation/display order from here on,
// and `name` starts as null so the built-in translated tierName() is used until a
// company renames the position (see levelName()).
export function buildHRLevels() {
  const levels = [];
  for (let tier = 1; tier <= HR_TIER_COUNT; tier++) {
    const scope = SCOPE_BY_TIER[tier];
    levels.push({ id: tierLevelId(tier, "manager"), order: tier, role: "manager", scope, name: null, permissions: MANAGER_PERMISSIONS, maxCount: null });
    levels.push({ id: tierLevelId(tier, "assistant"), order: tier, role: "assistant", scope, name: null, permissions: ASSISTANT_PERMISSIONS, maxCount: null });
  }
  return levels;
}

export function isManagerLevel(level) {
  return level?.role === "manager";
}
export function isAssistantLevel(level) {
  return level?.role === "assistant";
}

// Display label for a level: a company's custom name always wins, otherwise fall
// back to the built-in translated name for the first 5 default tiers.
export function levelName(level, lang) {
  if (!level) return "";
  if (level.name) return level.name;
  if (level.order >= 1 && level.order <= HR_TIER_COUNT) return tierName(level.order, level.role, lang);
  return level.role === "assistant" ? "Assistant" : "Manager";
}

export function levelNote(level, lang) {
  if (!level || level.name) return "";
  if (level.order >= 1 && level.order <= HR_TIER_COUNT) return tierNote(level.order, lang);
  return "";
}

// Groups a company's flat hrLevels array into ordered tiers (manager + optional
// assistant sharing the same `order`), ascending from lowest to highest authority.
export function groupLevelsByOrder(levels) {
  const orders = Array.from(new Set((levels || []).map((l) => l.order))).sort((a, b) => a - b);
  return orders.map((order) => ({
    order,
    scope: levels.find((l) => l.order === order)?.scope || "company",
    manager: levels.find((l) => l.order === order && l.role === "manager") || null,
    assistant: levels.find((l) => l.order === order && l.role === "assistant") || null,
  }));
}