const SECTION_HINTS = {
  tasks: ["task", "target", "مهم", "هدف"], attendanceToday: ["attendance", "present", "absent", "حضور", "غياب"],
  payroll: ["payroll", "salary", "راتب", "رواتب"],
  safety: ["safety", "incident", "risk", "سلامة", "حادث", "خطر"], dailyReports: ["report", "تقرير"],
  complaints: ["complaint", "شكوى", "بلاغ"], schedules: ["schedule", "shift", "جدول", "وردية"],
  files: ["file", "document", "ملف", "مستند"], employees: ["employee", "staff", "موظف"], stations: ["station", "فرع"],
};

export function selectAssistantContext(context, question) {
  const query = String(question || "").toLowerCase();
  const scored = Object.keys(context).map((key) => {
    const hints = SECTION_HINTS[key] || [];
    const hintScore = hints.reduce((score, hint) => score + (query.includes(hint) ? 5 : 0), 0);
    const valueText = JSON.stringify(context[key] || "").toLowerCase();
    const wordScore = query.split(/\s+/).filter((word) => word.length > 2 && valueText.includes(word)).length;
    return { key, score: hintScore + wordScore };
  }).sort((a, b) => b.score - a.score);
  const planning = /priority|plan|summary|recommend|أولو|خطة|ملخص|توص/i.test(query) ? ["tasks", "safety", "attendanceToday"] : [];
  const keys = new Set(["company", "today", "stations", "employees", ...planning, ...scored.filter((item) => item.score > 0).slice(0, 6).map((item) => item.key)]);
  return Object.fromEntries([...keys].filter((key) => context[key] !== undefined).map((key) => [key, context[key]]));
}

export function relevantDocumentUrls(context, question) {
  const words = String(question || "").toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  return (context.files || []).filter((file) => file.url && words.some((word) => String(file.name || "").toLowerCase().includes(word))).slice(0, 3).map((file) => file.url);
}

export function needsWebSearch(question) {
  return /latest|current|today|news|internet|web|regulation|law|حديث|حالي|اليوم|أخبار|إنترنت|الويب|لائحة|نظام/i.test(question);
}