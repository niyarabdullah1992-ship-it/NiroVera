/** Client mirror of base44/shared/assistantDerivations.ts
 *  Keep in sync — Assistant board Q&A, scope, and named gates.
 */

export const ASSISTANT_SECTION = "assistant";
export const AI_FEATURE = "ai";

const CAREERS_LEAK_RE =
  /careers|candidate|applicant|nv-app-|طلب\s*توظيف|متقدم|مرشح|صفحة\s*التوظيف|job\s*application/i;
const CROSS_TENANT_RE =
  /شركة\s*أخرى|مستأجر\s*آخر|other\s*compan|other\s*tenant|cross[- ]?tenant|شركة\s*منافسة/i;

export const PROMPT_CATALOG = [
  {
    id: "compare_stations",
    textAr: "قارن أداء الفروع هذا الشهر",
    textEn: "Compare station performance this month",
    roles: [
      "owner", "director", "ops_manager", "admin", "pgm", "station_manager", "hr_manager", "hr",
    ],
    sections: ["assistant", "reports", "performance"],
  },
  {
    id: "overtime_excess",
    textAr: "من تجاوز ساعاته الإضافية؟",
    textEn: "Who exceeded overtime limits?",
    roles: [
      "owner", "director", "ops_manager", "admin", "pgm", "hr_manager", "hr", "station_manager",
    ],
    sections: ["assistant", "attendance", "payroll"],
  },
  {
    id: "overdue_safety",
    textAr: "لخّص بنود السلامة المتأخرة",
    textEn: "Summarize overdue safety items",
    roles: [
      "owner", "director", "ops_manager", "admin", "pgm", "station_manager", "safety_officer",
    ],
    sections: ["assistant", "safety"],
  },
  {
    id: "board_report",
    textAr: "جهّز تقرير المجلس الشهري",
    textEn: "Draft the monthly board report",
    roles: ["owner", "director", "ops_manager", "admin", "pgm"],
    sections: ["assistant", "reports"],
  },
];

export const SPOTLIGHT_PROMPT = {
  id: "task_drop_spotlight",
  textAr: "لماذا انخفض إنجاز المهام في فرع الجبيل 2 هذا الأسبوع؟",
  textEn: "Why did task completion drop at Jubail 2 this week?",
  roles: [
    "owner", "director", "ops_manager", "admin", "pgm", "station_manager",
  ],
  sections: ["assistant", "tasks"],
};

export function catalogById(id) {
  if (!id) return null;
  if (id === SPOTLIGHT_PROMPT.id) return SPOTLIGHT_PROMPT;
  return PROMPT_CATALOG.find((p) => p.id === id) || null;
}

export function matchPromptByText(text) {
  const q = String(text || "").trim().toLowerCase();
  if (!q) return null;
  const all = [SPOTLIGHT_PROMPT, ...PROMPT_CATALOG];
  return all.find((p) => p.textAr.toLowerCase() === q || p.textEn.toLowerCase() === q) || null;
}

export function actorMayAsk(actor, entry) {
  if (!actor) return false;
  if (actor.owner || actor.admin || actor.role === "owner" || actor.role === "admin") return true;
  const roles = entry.roles || [];
  if (!roles.length) return true;
  return roles.includes(String(actor.role || ""));
}

export function planAllowsAssistant(plan) {
  const sections = plan?.enabledSections || [];
  const features = plan?.enabledFeatures || [];
  if (!plan) return true;
  if (Array.isArray(sections) && sections.length > 0 && !sections.includes(ASSISTANT_SECTION)) {
    return false;
  }
  if (Array.isArray(features) && features.length > 0 && !features.includes(AI_FEATURE)) {
    return false;
  }
  if (Array.isArray(features) && features.length === 0 && Array.isArray(sections) && sections.includes(ASSISTANT_SECTION)) {
    return false;
  }
  return true;
}

export function scopeStations(stations, actor, companyId) {
  const scoped = (stations || []).filter(
    (s) => s && s.id && (!s.companyId || s.companyId === companyId),
  );
  if (!actor) return [];
  if (actor.owner || actor.admin || actor.allStations || actor.role === "owner" || actor.role === "admin") {
    return scoped;
  }
  const allowed = new Set(
    [
      ...(Array.isArray(actor.stationIds) ? actor.stationIds : []),
      actor.stationId || "",
    ].filter(Boolean),
  );
  if (!allowed.size) return [];
  return scoped.filter((s) => allowed.has(s.id));
}

export function scopeHazards(hazards, stationIds, companyId) {
  return (hazards || []).filter(
    (h) =>
      h &&
      !h.closed &&
      (!h.companyId || h.companyId === companyId) &&
      stationIds.has(h.stationId),
  );
}

export function scopeAssets(assets, stationIds, companyId) {
  return (assets || []).filter(
    (a) => a && (!a.companyId || a.companyId === companyId) && stationIds.has(a.stationId),
  );
}

export function scopeBlockedTasks(tasks, stationIds, companyId) {
  return (tasks || []).filter(
    (t) => t && (!t.companyId || t.companyId === companyId) && stationIds.has(t.stationId),
  );
}

export function checkAskGate(input) {
  if (input.careersChannel) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "قناة التوظيف العامة لا تقرأ بيانات الموظفين أو العمليات.",
      reasonEn: "The public careers channel cannot read employee or operations data.",
    };
  }
  if (input.crossTenant) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "لا يُسمح بتجاوز حدود الشركة (companyId).",
      reasonEn: "Cross-tenant access is blocked (companyId scope).",
    };
  }
  if (!planAllowsAssistant(input.plan)) {
    return {
      ok: false,
      error: "FEATURE_DISABLED",
      reason: "المساعد الذكي غير مفعّل في خطة الشركة.",
      reasonEn: "AI Assistant is not enabled on this company's plan.",
    };
  }

  const question = String(input.question || "").trim();
  const byId = catalogById(input.promptId);
  const byText = matchPromptByText(question);
  const entry = byId || byText;

  if (!question && !entry) {
    return {
      ok: false,
      error: "EMPTY_QUESTION",
      reason: "اكتب سؤالًا قبل الإرسال.",
      reasonEn: "Enter a question before sending.",
    };
  }

  const textForScope = question || entry?.textAr || entry?.textEn || "";
  if (CAREERS_LEAK_RE.test(textForScope)) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "بيانات المتقدمين عبر Careers خارج نطاق المساعد التشغيلي — لا تسريب من قناة إلى أخرى.",
      reasonEn: "Careers applicant data is out of assistant scope — no cross-channel leak.",
    };
  }
  if (CROSS_TENANT_RE.test(textForScope)) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "السؤال يطلب بيانات خارج الشركة الحالية.",
      reasonEn: "The question asks for data outside the current company.",
    };
  }

  if (entry) {
    if (!actorMayAsk(input.actor, entry)) {
      return {
        ok: false,
        error: "FORBIDDEN",
        reason: "لا صلاحية لهذا السؤال حسب الدور.",
        reasonEn: "Your role is not allowed to ask this question.",
      };
    }
    const needed = entry.sections || [];
    const allowed = new Set(input.allowedSections || []);
    if (input.allowedSections && Array.isArray(input.allowedSections)) {
      if (!allowed.has(ASSISTANT_SECTION) && !allowed.has("/app/assistant")) {
        return {
          ok: false,
          error: "FORBIDDEN",
          reason: "قسم المساعد غير ظاهر لصلاحياتك (navVisibility).",
          reasonEn: "Assistant is not visible for your permissions (navVisibility).",
        };
      }
      const topicOk = needed.length <= 1
        || needed.some((s) => s === ASSISTANT_SECTION || allowed.has(s) || allowed.has(`/app/${s}`));
      if (!topicOk) {
        return {
          ok: false,
          error: "FORBIDDEN",
          reason: "الموضوع المطلوب خارج الأقسام المسموحة لدورك.",
          reasonEn: "That topic is outside the sections allowed for your role.",
        };
      }
    }
  }

  return { ok: true, entry, question: question || entry?.textAr || "" };
}

function stationName(st, lang) {
  return lang === "ar" ? st.nameAr : st.nameEn;
}

export function derivePromptAnswer(
  promptId,
  facts,
  scopedStations,
  scopedHazards,
  scopedAssets,
  scopedTasks,
) {
  const byId = (id) => scopedStations.find((s) => s.id === id);

  if (promptId === "task_drop_spotlight") {
    const jbl2 = byId("jbl2") || scopedStations[0];
    const completion = jbl2?.taskCompletionPct ?? 0;
    const crew = jbl2?.crewDeltaPct ?? 0;
    const pump = scopedAssets.find((a) => a.stationId === (jbl2?.id || "jbl2"))
      || scopedAssets[0];
    const blocked = scopedTasks.filter((t) => t.stationId === (jbl2?.id || "jbl2"));
    const blockedN = blocked.length || 3;
    const assignee = blocked[0]?.assigneeName || "سعود الحربي";
    const downH = pump?.hours ?? 31;
    const drop = completion ? `-${Math.max(1, 100 - completion)}%` : "-23%";
    return {
      promptId,
      questionAr: SPOTLIGHT_PROMPT.textAr,
      questionEn: SPOTLIGHT_PROMPT.textEn,
      answerAr:
        `الانخفاض مصدره سبب واحد: توقف ${pump?.labelAr || "مضخة التبريد"} أوقف ${blockedN} مهام تشغيلية معتمدة عليها، ولم تُعاد جدولتها. الحضور والطاقم لم يتغيرا (${crew}%). المهام مسندة إلى ${assignee}.`,
      answerEn:
        `The drop traces to a single cause: ${pump?.labelEn || "cooling pump"} downtime blocked ${blockedN} dependent tasks that were never rescheduled. Attendance and crew levels were unchanged (${crew}%). Tasks sit with ${assignee}.`,
      evidence: [
        {
          sourceAr: "العمليات",
          sourceEn: "OPERATIONS",
          value: drop,
          labelAr: "إنجاز المهام أسبوعيًا",
          labelEn: "Weekly completion",
        },
        {
          sourceAr: "الحضور",
          sourceEn: "ATTENDANCE",
          value: `${crew}%`,
          labelAr: "تغير في الطاقم",
          labelEn: "Change in crew",
        },
        {
          sourceAr: "الأصول",
          sourceEn: "ASSETS",
          value: `${downH}h`,
          labelAr: pump?.labelAr || "توقف الأصل",
          labelEn: pump?.labelEn || "Asset downtime",
        },
      ],
      primaryActionAr: `أعد جدولة المهام الـ ${blockedN}`,
      primaryActionEn: `Reschedule the ${blockedN} tasks`,
      secondaryActionAr: "أرسل الملخص لمدير الفرع",
      secondaryActionEn: "Send summary to station manager",
      goOps: "/app/tasks",
    };
  }

  if (promptId === "compare_stations") {
    const ranked = [...scopedStations].sort(
      (a, b) => (b.readiness || 0) - (a.readiness || 0),
    );
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];
    const gap = top && bottom ? (top.readiness || 0) - (bottom.readiness || 0) : 0;
    const safetyTop = top?.safetyClosurePct ?? 0;
    const safetyBot = bottom?.safetyClosurePct ?? 0;
    return {
      promptId,
      questionAr: "قارن أداء الفروع هذا الشهر",
      questionEn: "Compare station performance this month",
      answerAr: top && bottom
        ? `${stationName(top, "ar")} في المقدمة (${top.readiness})، و${stationName(bottom, "ar")} في المؤخرة عند ${bottom.readiness} — والفارق الأكبر في إغلاق بنود السلامة: ${safetyTop}% مقابل ${safetyBot}%. الحضور متقارب، فالفجوة تشغيلية لا في القوى العاملة.`
        : "لا فروع في النطاق لعمل المقارنة.",
      answerEn: top && bottom
        ? `${stationName(top, "en")} leads (${top.readiness}); ${stationName(bottom, "en")} trails at ${bottom.readiness} — the widest gap is safety closure: ${safetyTop}% against ${safetyBot}%. Attendance is comparable, so the gap is operational, not staffing.`
        : "No stations in scope to compare.",
      evidence: [
        { sourceAr: "الأداء", sourceEn: "PERF", value: String(top?.readiness ?? "—"), labelAr: "الأعلى", labelEn: "Highest" },
        { sourceAr: "الأداء", sourceEn: "PERF", value: String(bottom?.readiness ?? "—"), labelAr: "الأدنى", labelEn: "Lowest" },
        { sourceAr: "الأداء", sourceEn: "PERF", value: String(gap), labelAr: "الفارق", labelEn: "Gap" },
      ],
      primaryActionAr: "افتح مقارنة الأداء",
      primaryActionEn: "Open performance comparison",
      secondaryActionAr: "جهّز ملخصًا للمدير",
      secondaryActionEn: "Draft a manager summary",
      goOps: "/app/performance?view=manage",
    };
  }

  if (promptId === "overtime_excess") {
    const companyOt = facts.companyOtHoursWeek
      ?? scopedStations.reduce((s, st) => s + (st.overtimeHoursWeek || 0), 0);
    const ranked = [...scopedStations].sort(
      (a, b) => (b.overtimeHoursWeek || 0) - (a.overtimeHoursWeek || 0),
    );
    const hot = ranked[0];
    const hotH = hot?.overtimeHoursWeek ?? 0;
    return {
      promptId,
      questionAr: "من تجاوز ساعاته الإضافية؟",
      questionEn: "Who exceeded overtime limits?",
      answerAr: hot
        ? `${stationName(hot, "ar")} استهلكت ${hotH} ساعة إضافية من أصل ${companyOt} على مستوى النطاق. راجع الحضور قبل اعتماد الإضافي في المسير.`
        : "لا بيانات إضافي في النطاق.",
      answerEn: hot
        ? `${stationName(hot, "en")} consumed ${hotH} of ${companyOt} overtime hours in scope. Review attendance before approving OT in payroll.`
        : "No overtime data in scope.",
      evidence: [
        { sourceAr: "الحضور", sourceEn: "ATTENDANCE", value: `${companyOt}h`, labelAr: "المجموع", labelEn: "Total" },
        { sourceAr: "الحضور", sourceEn: "ATTENDANCE", value: `${hotH}h`, labelAr: hot ? stationName(hot, "ar") : "—", labelEn: hot ? stationName(hot, "en") : "—" },
        { sourceAr: "الحضور", sourceEn: "ATTENDANCE", value: String(scopedStations.filter((s) => (s.overtimeHoursWeek || 0) > 0).length), labelAr: "فروع نشطة", labelEn: "Active stations" },
      ],
      primaryActionAr: "افتح تحليل الحضور والإضافي",
      primaryActionEn: "Open attendance & OT analysis",
      secondaryActionAr: "راجع كشف الشهر",
      secondaryActionEn: "Review the monthly timesheet",
      goOps: "/app/attendance",
    };
  }

  if (promptId === "overdue_safety") {
    const open = scopedHazards.filter((h) => !h.closed);
    const critical = open.filter((h) => h.severity === "critical" || h.overdue || h.blocksAssignment);
    const overdueN = open.filter((h) => h.overdue).length;
    const closure = scopedStations.length
      ? Math.round(
        scopedStations.reduce((s, st) => s + (st.safetyClosurePct || 0), 0) / scopedStations.length,
      )
      : 0;
    const lines = critical.slice(0, 3).map((h) => h.titleAr).join("، ");
    return {
      promptId,
      questionAr: "لخّص بنود السلامة المتأخرة",
      questionEn: "Summarize overdue safety items",
      answerAr: critical.length
        ? `${critical.length} بنود حرجة/متأخرة مفتوحة${lines ? `: ${lines}` : ""}. الشهادات المنتهية توقف إسناد المهام التي تشترطها.`
        : "لا بنود سلامة متأخرة في النطاق.",
      answerEn: critical.length
        ? `${critical.length} critical/overdue items are open${lines ? `: ${critical.slice(0, 3).map((h) => h.titleEn).join(", ")}` : ""}. Expired certifications block assignment of tasks that require them.`
        : "No overdue safety items in scope.",
      evidence: [
        { sourceAr: "السلامة", sourceEn: "HSE", value: String(critical.length), labelAr: "حرجة", labelEn: "Critical" },
        { sourceAr: "السلامة", sourceEn: "HSE", value: String(overdueN), labelAr: "متأخرة", labelEn: "Overdue" },
        { sourceAr: "السلامة", sourceEn: "HSE", value: `${closure}%`, labelAr: "إغلاق", labelEn: "Closure" },
      ],
      primaryActionAr: "افتح سجل المخاطر",
      primaryActionEn: "Open the hazard register",
      secondaryActionAr: "راجع شهادات الكفاءة",
      secondaryActionEn: "Review competency certificates",
      goSafety: "/app/safety",
    };
  }

  if (promptId === "board_report") {
    const readiness = facts.readiness ?? Math.round(
      scopedStations.reduce((s, st) => s + (st.readiness || 0), 0) / Math.max(1, scopedStations.length),
    );
    const delta = facts.readinessDelta ?? 0;
    const tasksPct = facts.taskCompletionPct
      ?? Math.round(
        scopedStations.reduce((s, st) => s + (st.taskCompletionPct || 0), 0)
          / Math.max(1, scopedStations.length),
      );
    const days = facts.daysWithoutLti ?? 0;
    const hotBudget = Object.entries(facts.budgetPctByStation || {})
      .sort((a, b) => b[1] - a[1])[0];
    const hotSt = hotBudget ? byId(hotBudget[0]) : null;
    return {
      promptId,
      questionAr: "جهّز تقرير المجلس الشهري",
      questionEn: "Draft the monthly board report",
      answerAr:
        `جهّزت المسودة: مؤشر الجاهزية ${readiness} (${delta >= 0 ? "+" : ""}${delta})، إنجاز المهام ${tasksPct}%، ${days} يومًا بلا حادث يفقد وقت عمل${hotSt ? `، وتكلفة تشغيل ضمن الميزانية عدا ${stationName(hotSt, "ar")} عند ${hotBudget[1]}%` : ""}. تحتاج مراجعتك قبل الإرسال.`,
      answerEn:
        `Draft ready: readiness ${readiness} (${delta >= 0 ? "+" : ""}${delta}), task completion ${tasksPct}%, ${days} days without a lost-time incident${hotSt ? `, and operating cost within budget except ${stationName(hotSt, "en")} at ${hotBudget[1]}%` : ""}. It needs your review before sending.`,
      evidence: [
        { sourceAr: "تنفيذي", sourceEn: "EXEC", value: String(readiness), labelAr: "الجاهزية", labelEn: "Readiness" },
        { sourceAr: "العمليات", sourceEn: "OPS", value: `${tasksPct}%`, labelAr: "الإنجاز", labelEn: "Completion" },
        { sourceAr: "السلامة", sourceEn: "HSE", value: String(days), labelAr: "بلا حادث", labelEn: "LTI-free days" },
      ],
      primaryActionAr: "راجع المسودة في التقارير",
      primaryActionEn: "Review the draft in Reports",
      secondaryActionAr: "أرسِل للرئيس والمدير المالي",
      secondaryActionEn: "Send to CEO and CFO",
      goOps: "/app",
    };
  }

  return null;
}

export function buildAssistantBoard(input) {
  const stations = scopeStations(input.facts.stations, input.actor, input.companyId);
  const ids = new Set(stations.map((s) => s.id));
  const hazards = scopeHazards(input.facts.hazards, ids, input.companyId);
  const assets = scopeAssets(input.facts.assets, ids, input.companyId);
  const tasks = scopeBlockedTasks(input.facts.blockedTasks, ids, input.companyId);

  const prompts = PROMPT_CATALOG.map((p) => ({
    ...p,
    allowed: actorMayAsk(input.actor, p),
  }));

  const active = input.activePromptId || "task_drop_spotlight";
  const answer = derivePromptAnswer(active, input.facts, stations, hazards, assets, tasks);

  return { prompts, answer, stationCount: stations.length };
}

export function demoAssistantFacts(companyId) {
  return {
    companyId,
    readiness: 82,
    readinessDelta: 6,
    taskCompletionPct: 78,
    daysWithoutLti: 214,
    companyOtHoursWeek: 84,
    budgetPctByStation: { jbl2: 97, jbl1: 88, ynb: 91 },
    stations: [
      { id: "jbl1", nameAr: "الجبيل 1", nameEn: "Jubail 1", companyId, readiness: 88, taskCompletionPct: 86, safetyClosurePct: 79, attendanceDeltaPct: 0, overtimeHoursWeek: 12, crewDeltaPct: 0 },
      { id: "jbl2", nameAr: "الجبيل 2", nameEn: "Jubail 2", companyId, readiness: 74, taskCompletionPct: 77, safetyClosurePct: 44, attendanceDeltaPct: 0, overtimeHoursWeek: 26, crewDeltaPct: 0 },
      { id: "ynb", nameAr: "ينبع", nameEn: "Yanbu", companyId, readiness: 86, taskCompletionPct: 84, safetyClosurePct: 71, overtimeHoursWeek: 14, crewDeltaPct: 0 },
      { id: "rbg", nameAr: "رابغ", nameEn: "Rabigh", companyId, readiness: 76, taskCompletionPct: 74, safetyClosurePct: 63, overtimeHoursWeek: 10, crewDeltaPct: 0 },
      { id: "shb", nameAr: "الشعيبة", nameEn: "Shuaiba", companyId, readiness: 84, taskCompletionPct: 85, safetyClosurePct: 82, overtimeHoursWeek: 11, crewDeltaPct: 0 },
      { id: "dmm", nameAr: "الدمام", nameEn: "Dammam", companyId, readiness: 71, taskCompletionPct: 69, safetyClosurePct: 58, overtimeHoursWeek: 11, crewDeltaPct: 0 },
    ],
    hazards: [
      { id: "hz1", companyId, stationId: "jbl2", severity: "critical", titleAr: "تسريب زيت في الجبيل 2", titleEn: "Oil leak at Jubail 2", overdue: true },
      { id: "hz2", companyId, stationId: "rbg", severity: "critical", titleAr: "درابزين مفكوك في رابغ", titleEn: "Loose handrail at Rabigh", overdue: true },
      { id: "hz3", companyId, stationId: "dmm", severity: "critical", titleAr: "شهادتان منتهيتان في الدمام", titleEn: "Two expired certifications at Dammam", blocksAssignment: true },
    ],
    assets: [
      { id: "as1", companyId, stationId: "jbl2", labelAr: "توقف مضخة التبريد", labelEn: "Cooling pump downtime", hours: 31 },
    ],
    blockedTasks: [
      { id: "t1", companyId, stationId: "jbl2", titleAr: "مهمة تشغيل 1", titleEn: "Ops task 1", assigneeName: "سعود الحربي", blockedByAssetId: "as1" },
      { id: "t2", companyId, stationId: "jbl2", titleAr: "مهمة تشغيل 2", titleEn: "Ops task 2", assigneeName: "سعود الحربي", blockedByAssetId: "as1" },
      { id: "t3", companyId, stationId: "jbl2", titleAr: "مهمة تشغيل 3", titleEn: "Ops task 3", assigneeName: "سعود الحربي", blockedByAssetId: "as1" },
    ],
  };
}
