/**
 * Owner board / subscription — owner-only, off the suite rail.
 * Do not add an editable GOSI rate table here (user cancelled «الغاء»).
 */

export const OWNER_FACTS = Object.freeze([
  {
    id: "owner.subscriptionPlan",
    domain: "owner",
    scope: "platform",
    home: "SubscriptionPlan",
    path: "SubscriptionPlan",
    writer: "owner-board",
    stored: true,
    isolation: null,
    surfaceAr: "لوحة المالك",
    noteAr: "كتالوج خطط — بلا companyId.",
  },
  {
    id: "owner.payment",
    domain: "owner",
    scope: "platform",
    home: "SubscriptionPayment",
    path: "SubscriptionPayment",
    writer: "owner-board",
    stored: true,
    isolation: "companyId",
    surfaceAr: "لوحة المالك",
    noteAr: "companyId قد يكون فارغاً قبل إنشاء الشركة.",
  },
  {
    id: "owner.assistant",
    domain: "owner",
    scope: "assistant",
    home: "plannerItems | assistantFacts",
    path: "plannerItems",
    blobCategory: "plannerItems",
    writer: "notify-system",
    stored: true,
    isolation: "companyId",
    surfaceAr: "المساعد",
  },
  {
    id: "owner.boardRoute",
    domain: "owner",
    scope: "route",
    home: "/owner",
    path: "/owner",
    writer: "owner-board",
    stored: false,
    isolation: "owner",
    surfaceAr: "لوحة المالك",
    noteAr: "خارج شريط الجناح. مالك فقط.",
  },
]);
