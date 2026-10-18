/**
 * Labour Law duties on the workplace itself — each item names its article (catalog ids → citeRule), so the
 * inspection reads the law, not a house checklist. Art. 144 is also read per worker from the file (medical cover).
 */
export const LABOR_WORKPLACE_ITEMS = [
  ["law_125_fire", "احتياطات الوقاية من الحريق ووسائل مكافحته متوفرة، ومنافذ النجاة صالحة في كل وقت", "Fire prevention and fire-fighting means are in place, and escape exits are usable at all times", "safety.fire.cite"],
  ["law_125_notice", "تعليمات مفصّلة بوسائل منع الحريق معلّقة في مكان ظاهر", "Detailed fire-prevention instructions are posted in a visible place", "safety.fire.cite"],
  ["law_63_substances", "دخول المواد المحرمة شرعاً إلى أماكن العمل ممنوع، والمنع معلن للعاملين", "Substances forbidden by Sharia are kept out of the workplace, and the ban is made known", "safety.substances.cite"],
  ["law_144_health", "العناية الصحية الوقائية والعلاجية متوفرة، والتأمين الطبي ساري لكل العاملين", "Preventive and curative health care is provided, and medical cover is valid for every worker", "health.care.cite"],
  ["law_158_seats", "مقاعد لاستراحة العاملات في كل مكان تعمل فيه نساء", "Seats for women workers' rest wherever women work", "women.seats.cite"],
];

export const CHECKLIST_GROUPS = [
  { id: "law", ar: "نظام العمل — بيئة العمل", en: "Labour Law — the workplace", items: LABOR_WORKPLACE_ITEMS },
  { id: "iso", ar: "ISO 45001", en: "ISO 45001", items: [
    ["iso_policy", "سياسة السلامة موثقة ومعلنة", "Safety policy is documented and communicated"],
    ["iso_roles", "المسؤوليات والصلاحيات محددة", "HSE roles and responsibilities are defined"],
    ["iso_risks", "تقييم المخاطر محدث", "Risk assessment is current"],
    ["iso_legal", "المتطلبات القانونية محددة", "Legal requirements are identified"],
    ["iso_training", "التدريب والكفاءة موثقان", "Training and competence are documented"],
    ["iso_consult", "مشاركة العاملين وتشاورتهم مفعلة", "Worker consultation and participation are active"],
    ["iso_control", "ضوابط التشغيل مطبقة", "Operational controls are implemented"],
    ["iso_emergency", "خطط الطوارئ مختبرة", "Emergency plans are tested"],
    ["iso_incidents", "الحوادث والإجراءات التصحيحية موثقة", "Incidents and corrective actions are recorded"],
    ["iso_audit", "التدقيق والمراجعة الإدارية مكتملان", "Audit and management review are complete"],
  ]},
  { id: "nfpa", ar: "NFPA / الإطفاء والإخلاء", en: "NFPA / Fire & Evacuation", items: [
    ["nfpa_ext", "طفايات الحريق متاحة وصالحة", "Fire extinguishers are accessible and inspected"],
    ["nfpa_alarm", "نظام الإنذار يعمل وتم اختباره", "Fire alarm system is operational and tested"],
    ["nfpa_exit", "مخارج الطوارئ واضحة وغير معاقة", "Emergency exits are marked and unobstructed"],
    ["nfpa_route", "مسارات الإخلاء معلقة ومحدثة", "Evacuation routes are posted and current"],
    ["nfpa_light", "إنارة الطوارئ تعمل", "Emergency lighting is operational"],
    ["nfpa_drill", "تم تنفيذ تمرين إخلاء دوري", "A periodic evacuation drill was completed"],
    ["nfpa_storage", "تخزين المواد القابلة للاشتعال آمن", "Flammable materials are stored safely"],
    ["nfpa_team", "فريق الطوارئ محدد ومدرب", "Emergency response team is assigned and trained"],
  ]},
];

export const PERMIT_TYPES = [
  ["excavation", "حفر", "Excavation"], ["height", "عمل على ارتفاع", "Work at Height"],
  ["electrical", "أعمال كهربائية", "Electrical"], ["confined", "أماكن محصورة", "Confined Space"],
  ["hot", "أعمال ساخنة / حريق", "Hot Work / Fire"],
];

export const PERMIT_REQUIREMENTS = [
  ["ppe", "معدات الوقاية الشخصية", "Required PPE"], ["isolation", "العزل وتأمين الطاقة", "Isolation / LOTO"],
  ["gas", "فحص الغازات", "Gas testing"], ["barricade", "حواجز ومنطقة آمنة", "Barricades and safe zone"],
  ["firewatch", "مراقب حريق", "Fire watch"], ["rescue", "خطة إنقاذ", "Rescue plan"],
];

export const riskTone = (score) => score <= 4 ? "bg-emerald-100 text-emerald-800" : score <= 9 ? "bg-yellow-100 text-yellow-800" : score <= 16 ? "bg-orange-100 text-orange-800" : "bg-red-100 text-red-800";

export function checklistCompliance(results = {}) {
  const standard = CHECKLIST_GROUPS.flatMap((group) => group.items.map(([id]) => id));
  const custom = Object.keys(results).filter((id) => id.startsWith("custom_"));
  const ids = [...standard, ...custom];
  const yes = ids.filter((id) => results[id]?.status === "yes").length;
  return ids.length ? Math.round((yes / ids.length) * 100) : 0;
}

const currentMonthKey = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };

export function getMonthlyHours(dailyHours = [], yearMonth = currentMonthKey()) {
  return dailyHours.filter((item) => String(item.date || "").startsWith(yearMonth)).reduce((sum, item) => sum + Math.max(0, Number(item.hours) || 0), 0);
}

export function getMonthlyLti(ltiEntries = [], yearMonth = currentMonthKey()) {
  return ltiEntries.filter((item) => String(item.date || "").startsWith(yearMonth)).length;
}

export function safetyKpis(rec = {}, yearMonth = currentMonthKey(), headcount = 0) {
  const current = yearMonth === currentMonthKey();
  const declaredHours = Array.isArray(rec.dailyHours) ? getMonthlyHours(rec.dailyHours, yearMonth) : current ? Number(rec.workHoursMonthly) || 0 : 0;
  // Design: exposure hours derive from headcount × 2080 when headcount is known.
  const hours = headcount > 0 ? headcount * 2080 : declaredHours;
  const lti = Array.isArray(rec.ltiEntries) ? getMonthlyLti(rec.ltiEntries, yearMonth) : current ? Number(rec.ltiCount) || 0 : 0;
  const loggedIncidents = (rec.incidentLog || []).filter((item) => String(item.at || "").slice(0, 7) === yearMonth).length;
  const incidents = Math.max(loggedIncidents, lti);
  const restrict = (rec.incidentLog || []).filter((item) => String(item.cls || item.kind || "").toLowerCase().includes("restrict") && String(item.at || "").slice(0, 7) === yearMonth).length;
  const last = [...(rec.incidentLog || [])].filter((item) => item.at).sort((a, b) => new Date(b.at) - new Date(a.at))[0]?.at || rec.lastIncidentAt || rec.createdAt;
  const days = last ? Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / 86400000)) : 0;
  const dart = lti + restrict;
  return {
    hours,
    lti,
    incidents,
    dart,
    trir: hours ? (incidents * 200000) / hours : 0,
    ltifr: hours ? (lti * 1000000) / hours : 0,
    dartRate: hours ? (dart * 200000) / hours : 0,
    days,
    exposureFromHeadcount: headcount > 0,
  };
}