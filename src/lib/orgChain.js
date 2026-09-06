import { actingAtStation } from "./orgStructureLog.js";
import { companyLists } from "./permissionTemplates.js";
import { deriveBranchEscalationChain } from "./orgDerivations.js";
import { isWorkplaceStation } from "./stationTree.js";

export const ORG_CHAIN = [
  { value: "branches", step: 1, ar: "المكان", en: "Place" },
  { value: "people", step: 2, ar: "الناس", en: "People" },
  { value: "lists", step: 3, ar: "الصلاحية", en: "Access" },
  { value: "escalation", step: 4, ar: "التصعيد", en: "Escalation" },
];

export function orgChainHealth(data) {
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  let vacant = 0;
  let acting = 0;
  stations.forEach((station) => {
    if (!String(station.managerId || "").trim()) vacant += 1;
    if (actingAtStation(data, station.id)) acting += 1;
  });
  const people = (data?.employees || []).filter((employee) => (
    employee?.active !== false
    && employee.role !== "system"
    && employee.profile?.employmentStatus !== "terminated"
  )).length;
  const lists = companyLists(data);
  const listsWithAccess = lists.filter((pack) => (
    Object.values(pack.permissions || {}).some((level) => level && level !== "hidden")
  )).length;
  const workplaces = stations.filter((station) => isWorkplaceStation(station));
  const escalationBranches = workplaces.filter((station) => {
    const sid = String(station.id || station.stationId || "");
    return sid && deriveBranchEscalationChain(sid, data).length > 0;
  }).length;

  return {
    vacant,
    acting,
    unpublished: !data?.settings?.orgPublishedAt,
    publishedAt: data?.settings?.orgPublishedAt || "",
    branches: stations.length,
    people,
    lists: lists.length,
    listsWithAccess,
    escalationBranches,
  };
}

export function orgChainNext(data, ar = true) {
  const health = orgChainHealth(data);
  if (health.branches < 2) {
    return {
      tab: "branches",
      tone: "amber",
      ar: "أضف فرعًا تحت المنشأة. الشجرة مكان عمل واحد، لا طبقات متداخلة.",
      en: "Add a branch under the company. One workplace tree — not stacked layers.",
    };
  }
  if (!health.lists) {
    return {
      tab: "lists",
      tone: "amber",
      ar: "أنشئ صلاحية قبل توزيع المناصب. الموارد البشرية لا تضع موظفاً على فرع بلا قائمة ومسمّيات.",
      en: "Create an access pack before distributing titles. HR cannot place people on a branch without a list and job titles.",
    };
  }
  if (!health.listsWithAccess) {
    return {
      tab: "lists",
      tone: "amber",
      ar: "الحزمة بلا مفتاح. عيّن صلاحيات الموارد البشرية والموظفين حتى يوزَّع المنصب بسهولة.",
      en: "The pack grants nothing yet. Set HR and employee access so titles can be distributed.",
    };
  }
  if (health.vacant) {
    return {
      tab: "branches",
      tone: "amber",
      ar: `${health.vacant} بلا مدير — عيّن مديرًا أو وكالة بتاريخ. المقعد الفارغ يبقى صادقًا.`,
      en: `${health.vacant} vacant — assign a manager or dated acting. Empty seats stay honest.`,
    };
  }
  if (health.unpublished) {
    return {
      tab: "branches",
      tone: "amber",
      ar: "انشر الهيكل ليصير مرجع الحضور والمهام والتصعيد.",
      en: "Publish the structure so attendance, tasks, and escalation can trust it.",
    };
  }
  if (health.people < 2) {
    return {
      tab: "people",
      tone: "navy",
      ar: "وظّف على فرع بقائمة. شجرة الناس تُشتق بعد التعيين — بلا محرر «يتبع».",
      en: "Hire onto a branch with a list. The people tree is derived after hire — no reports-to editor.",
    };
  }
  if (health.branches >= 2 && health.escalationBranches < Math.max(1, health.branches - 1)) {
    return {
      tab: "escalation",
      tone: "navy",
      ar: "عيّن مسؤول تصعيد — يمكن أن يكون من المقر ليمسك الفروع الميدانية.",
      en: "Assign escalation handlers — HQ staff can cover field branches.",
    };
  }
  return {
    tab: "people",
    tone: "green",
    ar: "السلسلة مكتملة. الناس يُشتقّون، والتصعيد يمشي شجرة المكان نفسها.",
    en: "The chain is complete. People are derived; escalation walks the same workplace tree.",
  };
}

