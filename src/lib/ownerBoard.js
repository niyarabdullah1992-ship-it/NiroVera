/**
 * Platform-owner rulings: each company's subscription name and price,
 * plus that company's official holidays and Ramadan date.
 * Edited only on the independent /owner surface — company /app UI does not show
 * the plan chip; gates and billing still derive from the saved ruling.
 * /owner-panel redirects to /owner (one board).
 */

import { isCompanyHeadPerson, isCompanyOwner } from "./dutyScope.js";
import {
  isRamadanDay,
  isRamadanHoursSubject,
  ownerRamadanRuling,
  ruleValue,
  rulingCivicDate,
  rulingEidSpan,
} from "./laborRules.js";
import { DEFAULT_SUBSCRIPTION_PLANS, planDisplayName } from "./subscriptionPlans.js";
import { officialHolidayList, ramadanWindowForYear } from "./ummAlQuraCalendar.js";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Local-preview apex (نيار) — opens /owner without Base44 cloud admin. */
const PLATFORM_OWNER_PREVIEW_IDS = new Set(["emp_owner_preview"]);
const PLATFORM_OWNER_PREVIEW_EMAILS = new Set(["preview@nirovera.local"]);

/**
 * Complete لوحة المالك inventory — one surface at /owner.
 * /owner-panel and /app/owner redirect here. Company /app never hosts these tabs.
 */
export const OWNER_BOARD_SECTIONS = [
  {
    value: "glance",
    labelAr: "نظرة",
    labelEn: "Glance",
    hintAr: "تحليلات المنصة والمشتركين والزوار في نظرة واحدة.",
    hintEn: "Platform analytics, subscribers, and visitors at a glance.",
  },
  {
    value: "companies",
    labelAr: "الشركات",
    labelEn: "Companies",
    hintAr: "إنشاء الشركات ودخولها وحذفها من سطح المالك.",
    hintEn: "Create, enter, and delete companies from the owner surface.",
  },
  {
    value: "rulings",
    labelAr: "اشتراكات الشركات",
    labelEn: "Company plans",
    hintAr: "اسم الاشتراك وسعره لكل شركة — حكم خارج /app.",
    hintEn: "Plan name and price per company — ruled outside /app.",
  },
  {
    value: "holidays",
    labelAr: "الإجازات",
    labelEn: "Holidays",
    hintAr: "حكم الإجازات الرسمية لكل الشركات.",
    hintEn: "Official holiday rulings for every company.",
  },
  {
    value: "ramadan",
    labelAr: "رمضان",
    labelEn: "Ramadan",
    hintAr: "موعد رمضان يحكم ساعات كل الشركات.",
    hintEn: "Ramadan date rules every company's hours.",
  },
  {
    value: "subscribers",
    labelAr: "المشتركون",
    labelEn: "Subscribers",
    hintAr: "إدارة اشتراكات SaaS والتمديد والتجميد.",
    hintEn: "Manage SaaS subscriptions, extensions, and freezes.",
  },
  {
    value: "invoices",
    labelAr: "الفواتير",
    labelEn: "Invoices",
    hintAr: "فواتير الاشتراك وحالاتها.",
    hintEn: "Subscription invoices and their status.",
  },
  {
    value: "plans",
    labelAr: "الباقات",
    labelEn: "Catalog",
    hintAr: "كتالوج الباقات واستحقاقات المنصة.",
    hintEn: "Platform plan catalog and entitlements.",
  },
  {
    value: "report",
    labelAr: "التقرير",
    labelEn: "Report",
    hintAr: "تقرير تشغيل المنصة.",
    hintEn: "Platform operations report.",
  },
  {
    value: "feedback",
    labelAr: "التقييمات",
    labelEn: "Feedback",
    hintAr: "ملاحظات المنتج من الشركات.",
    hintEn: "Product feedback from companies.",
  },
  {
    value: "audit",
    labelAr: "التدقيق",
    labelEn: "Audit",
    hintAr: "سجل تدقيق المنصة.",
    hintEn: "Platform audit trail.",
  },
  {
    value: "roadmap",
    labelAr: "الخارطة",
    labelEn: "Roadmap",
    hintAr: "خارطة طريق المنتج.",
    hintEn: "Product roadmap.",
  },
  {
    value: "news",
    labelAr: "الأخبار",
    labelEn: "News",
    hintAr: "بث رسالة بريد لكل المشتركين.",
    hintEn: "Broadcast an email to every subscriber.",
  },
];

export function ownerBoardSections(ar) {
  return OWNER_BOARD_SECTIONS.map((section) => ({
    value: section.value,
    label: ar ? section.labelAr : section.labelEn,
    hint: ar ? section.hintAr : section.hintEn,
  }));
}

/** In-company sighting card only — not the platform owner board. */
export function canEditOwnerBoard(user, data) {
  return isCompanyOwner(user, data) || isCompanyHeadPerson(user, data);
}

/** Designated preview platform owner — not every company director/owner role. */
export function isDesignatedPlatformOwner(actor) {
  if (!actor) return false;
  const id = String(actor.id || actor.userId || actor.employeeId || "").trim();
  const email = String(actor.email || "").trim().toLowerCase();
  return PLATFORM_OWNER_PREVIEW_IDS.has(id) || PLATFORM_OWNER_PREVIEW_EMAILS.has(email);
}

/** Independent لوحة المالك: platform owner, not a company manager or station manager. */
export function canOpenOwnerBoard(actor) {
  if (!actor) return false;
  if (actor.platformOwner === true || actor.admin === true || actor.localPreviewOwner === true) return true;
  const role = String(actor.role || "").toLowerCase();
  if (role === "admin") return true;
  return isDesignatedPlatformOwner(actor);
}

export function platformOwnerGate(actor) {
  if (canOpenOwnerBoard(actor)) return { ok: true };
  return {
    ok: false,
    error: "OWNER_BOARD",
    reason: "لوحة المالك لمالك المنصة فقط — مدير الشركة ومدير الفرع لا يفتحانها ولا يغيّران اشتراك شركة.",
    reasonEn: "The owner board is for the platform owner only — a company manager or a station manager cannot open it or change a company's subscription.",
  };
}

export function ownerBoardGate(actor) {
  return platformOwnerGate(actor);
}

/** Resolve the actor who may open /owner — Base44 admin or designated local preview apex. */
export function resolveOwnerBoardActor(user, { localPreview = false, sessionUserId = "", sessionEmail = "" } = {}) {
  if (user && canOpenOwnerBoard(user)) {
    return {
      ...user,
      platformOwner: true,
      localPreviewOwner: user.localPreviewOwner === true || isDesignatedPlatformOwner(user),
    };
  }
  const probe = {
    id: sessionUserId || user?.id || "",
    email: sessionEmail || user?.email || "",
  };
  // Designated preview apex (نيار) may open even if Base44.me() failed —
  // session id/email is enough; company directors without that id stay gated.
  if (canOpenOwnerBoard(probe)) {
    return {
      id: probe.id || "emp_owner_preview",
      email: probe.email || "preview@nirovera.local",
      role: "admin",
      platformOwner: true,
      localPreviewOwner: true,
      admin: true,
    };
  }
  return null;
}

export function subscriptionStatus(company, today = "") {
  const day = String(today || new Date().toISOString()).slice(0, 10);
  if (company?.frozen === true) return { id: "frozen", ar: "مجمّد", en: "Frozen" };
  if (company?.subscriptionExempt === true) return { id: "exempt", ar: "معفى", en: "Exempt" };
  const end = String(company?.subscriptionEnd || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(end) && end < day) return { id: "ended", ar: "منتهٍ", en: "Ended" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) return { id: "active", ar: "ساري", en: "Active" };
  return { id: "open", ar: "بلا نهاية محددة", en: "No end date" };
}

export function companySubscriptionRow(company, data, today) {
  const view = dashboardSubscription(company, data);
  return {
    id: company?.id || "",
    name: company?.name || "",
    plan: company?.plan || "",
    view,
    status: subscriptionStatus(company, today),
  };
}

function finitePrice(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function rulingSubscriptionPlans(saved) {
  const rows = Array.isArray(saved) ? saved : [];
  return DEFAULT_SUBSCRIPTION_PLANS.map((plan) => {
    const hit = rows.find((row) => row && row.slug === plan.slug);
    if (!hit) return { ...plan };
    const nameAr = String(hit.nameAr || "").trim();
    const nameEn = String(hit.nameEn || "").trim();
    const monthly = finitePrice(hit.monthlyPrice);
    const yearly = finitePrice(hit.yearlyPrice);
    return {
      ...plan,
      nameAr: nameAr || plan.nameAr,
      nameEn: nameEn || plan.nameEn,
      monthlyPrice: monthly != null && monthly >= 0 ? monthly : plan.monthlyPrice,
      yearlyPrice: yearly != null && yearly >= 0 ? yearly : plan.yearlyPrice,
      currency: plan.currency || "USD",
    };
  });
}

export function persistSubscriptionPlans(draft) {
  const rows = Array.isArray(draft) ? draft : [];
  const plans = DEFAULT_SUBSCRIPTION_PLANS.map((plan) => {
    const hit = rows.find((row) => row && row.slug === plan.slug) || {};
    const nameAr = String(hit.nameAr ?? plan.nameAr).trim();
    const nameEn = String(hit.nameEn ?? plan.nameEn).trim();
    const monthly = finitePrice(hit.monthlyPrice ?? plan.monthlyPrice);
    const yearly = finitePrice(hit.yearlyPrice ?? plan.yearlyPrice);
    return { slug: plan.slug, nameAr, nameEn, monthlyPrice: monthly, yearlyPrice: yearly, currency: plan.currency || "USD", fallback: plan };
  });
  for (const plan of plans) {
    if (!plan.nameAr || !plan.nameEn) {
      return {
        ok: false,
        error: "PLAN_NAME",
        reason: "اسم الاشتراك مطلوب بالعربية والإنجليزية قبل أن يحكم الفوترة والبوابات.",
        reasonEn: "Each subscription needs an Arabic and an English name before it can rule billing and gates.",
      };
    }
    if (plan.monthlyPrice == null || plan.monthlyPrice < 0 || plan.yearlyPrice == null || plan.yearlyPrice < 0) {
      return {
        ok: false,
        error: "PLAN_PRICE",
        reason: "سعر الاشتراك رقم غير سالب — الشهري والسنوي كلاهما.",
        reasonEn: "The subscription price must be a number that is not negative — monthly and yearly.",
      };
    }
  }
  return {
    ok: true,
    plans: plans.map(({ fallback, ...plan }) => plan),
  };
}

/** Derive plan name/price for gates and billing — not for company-tenant UI chips. */
export function dashboardSubscription(company, data) {
  const plans = rulingSubscriptionPlans(data?.settings?.ownerBoard?.plans);
  const key = String(company?.plan || "free").trim().toLowerCase();
  const known = DEFAULT_SUBSCRIPTION_PLANS.find((plan) => plan.slug === key || String(plan.nameEn).toLowerCase() === key);
  const plan = plans.find((row) => row.slug === (known?.slug || key));
  if (!plan) {
    return {
      ok: false,
      error: "PLAN_UNRESOLVED",
      reason: "لا اشتراك محفوظ يطابق باقة هذه الشركة — لا يُخترع سعر.",
      reasonEn: "No saved subscription matches this company's plan — a price is not invented.",
    };
  }
  return {
    ok: true,
    slug: plan.slug,
    nameAr: plan.nameAr,
    nameEn: plan.nameEn,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    currency: plan.currency || "USD",
    labelAr: planDisplayName(plan, "ar"),
    labelEn: planDisplayName(plan, "en"),
  };
}

function validMonthDay(month, day) {
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1 || d > 31) return false;
  const probe = new Date(2024, m - 1, d);
  return probe.getMonth() === m - 1 && probe.getDate() === d;
}

export function holidayDraft(calendar, onDate) {
  return officialHolidayList(onDate, calendar).map((row) => {
    const civic = rulingCivicDate(row.id, calendar);
    const eid = rulingEidSpan(row.id, calendar);
    return {
      id: row.id,
      nameAr: row.ar,
      nameEn: row.en,
      month: civic?.month || "",
      day: civic?.day || "",
      from: row.from || "",
      to: row.to || "",
      dateOverride: !!eid,
      ownerRuled: !!row.ownerRuled,
    };
  });
}

export function persistHolidayRulings(draft) {
  const rows = Array.isArray(draft) ? draft : [];
  const holidays = {};
  for (const id of ["national", "founding"]) {
    const row = rows.find((item) => item && item.id === id) || {};
    const nameAr = String(row.nameAr || "").trim();
    const nameEn = String(row.nameEn || "").trim();
    if (!nameAr || !nameEn) {
      return {
        ok: false,
        error: "HOLIDAY_NAME",
        reason: "اسم الإجازة الرسمية مطلوب بالعربية والإنجليزية.",
        reasonEn: "Each official holiday needs an Arabic and an English name.",
      };
    }
    if (!validMonthDay(row.month, row.day)) {
      return {
        ok: false,
        error: "HOLIDAY_DATE",
        reason: `موعد ${nameAr} غير صالح — اليوم والشهر لا يكوّنان تاريخاً.`,
        reasonEn: `The date for ${nameEn} is not a real day.`,
      };
    }
    holidays[id] = {
      overridden: true,
      nameAr,
      nameEn,
      month: Number(row.month),
      day: Number(row.day),
    };
  }
  for (const id of ["fitr", "adha"]) {
    const row = rows.find((item) => item && item.id === id) || {};
    const nameAr = String(row.nameAr || "").trim();
    const nameEn = String(row.nameEn || "").trim();
    if ((row.nameAr || row.nameEn) && (!nameAr || !nameEn)) {
      return {
        ok: false,
        error: "HOLIDAY_NAME",
        reason: "اسم إجازة العيد مطلوب بالعربية والإنجليزية إن غيّرته.",
        reasonEn: "An Eid holiday needs both names when you rename it.",
      };
    }
    const from = String(row.from || "").slice(0, 10);
    const to = String(row.to || "").slice(0, 10);
    const dateOverride = row.dateOverride === true;
    if (dateOverride) {
      if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || to < from) {
        return {
          ok: false,
          error: "HOLIDAY_DATE",
          reason: "حكم موعد العيد يحتاج بداية ونهاية صحيحتين، والنهاية لا تسبق البداية.",
          reasonEn: "An Eid date ruling needs a valid start and end, and the end cannot precede the start.",
        };
      }
    }
    if (!nameAr && !nameEn && !dateOverride) continue;
    holidays[id] = {
      overridden: true,
      nameAr,
      nameEn,
      ...(dateOverride ? { from, to } : {}),
    };
  }
  return { ok: true, holidays };
}

export function persistRamadanRuling(draft, calendar) {
  const year = Number(draft?.year);
  const from = String(draft?.from || "").slice(0, 10);
  const to = String(draft?.to || "").slice(0, 10);
  if (!Number.isFinite(year) || year < 2000) {
    return {
      ok: false,
      error: "RAMADAN_YEAR",
      reason: "حدد سنة رمضان قبل الحفظ.",
      reasonEn: "Set the Ramadan year before saving.",
    };
  }
  if (!ramadanWindowForYear(year)) {
    return {
      ok: false,
      error: "RAMADAN_WINDOW",
      reason: "لا نافذة مرمّزة لهذه السنة — لا يُخمَّن رمضان خارج أم القرى.",
      reasonEn: "No encoded window for that year — Ramadan is not guessed outside Umm al-Qura.",
    };
  }
  if (!from) {
    return {
      ok: false,
      error: "RAMADAN_DATE",
      reason: "موعد بداية رمضان ناقص — اكتبه ثم احفظ ليصبح حكماً.",
      reasonEn: "Ramadan start is missing — enter it, then save so it rules.",
    };
  }
  const probe = {
    ...(calendar || {}),
    [String(year)]: {
      ...((calendar && (calendar[String(year)] || calendar[year])) || {}),
      ownerRamadanFrom: from,
      ...(to ? { ownerRamadanTo: to } : { ownerRamadanTo: "" }),
    },
  };
  if (!to) delete probe[String(year)].ownerRamadanTo;
  const ruling = ownerRamadanRuling(probe, year);
  if (!ruling?.ok) return ruling || {
    ok: false,
    error: "RAMADAN_DATE",
    reason: "موعد رمضان غير صالح.",
    reasonEn: "The Ramadan date is not valid.",
  };
  return { ok: true, year, from: ruling.from, to: ruling.to || "", length: ruling.length };
}

export function ramadanHoursRuling(calendar, onDate, employee) {
  const day = String(onDate || "").slice(0, 10);
  const stayCap = ruleValue("hours.workplace.maxHours", day);
  if (!isRamadanDay(day, calendar) || !isRamadanHoursSubject(employee)) {
    return {
      ramadan: false,
      dailyCap: ruleValue("hours.shift.ordinaryHours", day),
      weekCap: ruleValue("hours.week.ordinaryMaxHours", day),
      stayCap,
    };
  }
  return {
    ramadan: true,
    dailyCap: ruleValue("hours.ramadan.ordinaryHours", day),
    weekCap: ruleValue("hours.ramadan.weekMaxHours", day),
    stayCap,
  };
}
