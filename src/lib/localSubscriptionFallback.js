/**
 * The platform owner's subscription desk without the Base44 server — the same actions and the same
 * response shape as base44/functions/subscriptionOverview, written on the local company registry
 * (powercare_registry). The owner board's «المشتركون» and «الباقات» sections read and write here when
 * the server is not reachable, so a company's subscription can be entered, changed, frozen and
 * extended on this device. Every change is kept in a local audit trail.
 */
import { DEFAULT_SUBSCRIPTION_PLANS } from "./subscriptionPlans.js";

const REGISTRY_KEY = "powercare_registry";
const PLANS_KEY = "powercare_local_plans";
const AUDIT_KEY = "powercare_local_platform_audit";
const MANUAL_PLAN_MONTHLY_PRICE = { Starter: 49, Professional: 149, Enterprise: 249 };
const VALID_PLANS = new Set(["Starter", "Professional", "Enterprise", "Custom"]);
const DAY = 86400000;

const read = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

function registry() {
  const reg = read(REGISTRY_KEY, { companies: [] });
  return { ...reg, companies: Array.isArray(reg?.companies) ? reg.companies : [] };
}

/** A company's account fields, as the server's CompanyAccount carries them. */
function accountOf(company) {
  return {
    id: company.id,
    companyId: company.id,
    name: company.name || "",
    ownerEmail: company.ownerEmail || "",
    plan: company.plan || "Free",
    customPrice: company.customPrice ?? null,
    subscriptionStart: company.subscriptionStart || null,
    subscriptionEnd: company.subscriptionEnd || null,
    subscriptionExempt: company.subscriptionExempt === true,
    exemptReason: company.exemptReason || null,
    frozen: company.frozen === true,
    frozenAt: company.frozenAt || null,
    frozenReason: company.frozenReason || null,
    created_date: company.createdAt || null,
  };
}

export function localPlatformAudit() {
  return read(AUDIT_KEY, []);
}

function audit(account, action, oldValue, newValue, reason = "") {
  const rows = read(AUDIT_KEY, []);
  rows.unshift({
    id: `aud_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    companyId: account?.companyId || "platform",
    action,
    performedBy: "Platform owner",
    details: `${account?.name || "Company"}: ${oldValue || "—"} → ${newValue || "—"}`,
    reason: String(reason || "").slice(0, 1000) || null,
    oldValue: String(oldValue ?? ""),
    newValue: String(newValue ?? ""),
    created_date: new Date().toISOString(),
  });
  write(AUDIT_KEY, rows.slice(0, 500));
}

function patchCompany(id, patch) {
  const reg = registry();
  const company = reg.companies.find((row) => String(row.id) === String(id));
  if (!company) return null;
  Object.assign(company, patch);
  write(REGISTRY_KEY, reg);
  // the company's own blob carries the plan name its pages read (companyMeta on the server)
  if (patch.plan !== undefined) {
    const key = `powercare_company_${id}`;
    const data = read(key, null);
    if (data) { data.plan = patch.plan; write(key, data); }
  }
  return company;
}

export function localPlans() {
  const stored = read(PLANS_KEY, null);
  if (Array.isArray(stored) && stored.length) return stored;
  const seeded = DEFAULT_SUBSCRIPTION_PLANS.map((plan) => ({ ...plan, id: `plan_${plan.slug}` }));
  write(PLANS_KEY, seeded);
  return seeded;
}

export function localPlanWrite(kind, idOrPlan, patch) {
  const plans = localPlans();
  if (kind === "create") {
    const plan = { ...idOrPlan, id: `plan_${Date.now().toString(36)}` };
    write(PLANS_KEY, [...plans, plan]);
    return plan;
  }
  if (kind === "update") {
    const next = plans.map((plan) => (plan.id === idOrPlan ? { ...plan, ...patch, id: plan.id } : plan));
    write(PLANS_KEY, next);
    return next.find((plan) => plan.id === idOrPlan) || null;
  }
  if (kind === "delete") {
    write(PLANS_KEY, plans.filter((plan) => plan.id !== idOrPlan));
    return { ok: true };
  }
  return null;
}

/** The overview rows and summary, as subscriptionOverview returns them. */
function overview(now = Date.now()) {
  const accounts = registry().companies.map(accountOf);
  const promotionalFree = new Set(localPlans().filter((plan) => plan.freeNow === true).map((plan) => plan.nameEn));
  const rows = accounts.map((account) => {
    const endTs = account.subscriptionEnd ? Date.parse(account.subscriptionEnd) : null;
    const promo = promotionalFree.has(account.plan || "Free");
    const free = promo || account.subscriptionExempt;
    const active = free || (!!endTs && endTs > now && account.plan !== "Free");
    const listPrice = account.plan === "Custom" ? Math.max(0, Number(account.customPrice) || 0) : (MANUAL_PLAN_MONTHLY_PRICE[account.plan] || 0);
    return {
      accountId: account.id,
      companyName: account.name,
      email: account.ownerEmail,
      plan: account.plan,
      billing: "monthly",
      status: account.subscriptionExempt ? "exempt" : active ? "manual_active" : "no_subscription",
      startedAt: account.subscriptionStart ? Date.parse(account.subscriptionStart) : null,
      endsAt: free ? null : endTs,
      daysLeft: free || !endTs ? null : Math.ceil((endTs - now) / DAY),
      amount: free ? 0 : listPrice,
      customPrice: account.customPrice,
      currency: "USD",
      exempt: account.subscriptionExempt,
      isFree: free || listPrice === 0,
      exemptReason: account.exemptReason,
      frozen: account.frozen,
      frozenAt: account.frozenAt,
      frozenReason: account.frozenReason,
    };
  });
  const active = rows.filter((row) => ["manual_active", "exempt"].includes(row.status));
  const summary = {
    totalCompanies: accounts.length,
    activeSubscriptions: active.length,
    trialing: 0,
    pastDue: rows.filter((row) => row.status === "no_subscription" && row.endsAt && row.endsAt < now).length,
    canceled: rows.filter((row) => row.status === "no_subscription").length,
    frozen: accounts.filter((account) => account.frozen).length,
    expired: rows.filter((row) => row.endsAt && row.endsAt < now).length,
    endingSoon: active.filter((row) => row.daysLeft != null && row.daysLeft <= 14).length,
    byPlan: Object.fromEntries(["Free", "Starter", "Professional", "Enterprise", "Custom"].map((plan) => [plan, (plan === "Free" ? rows : active).filter((row) => row.plan === plan).length])),
  };
  summary.mrr = Math.round(active.reduce((sum, row) => sum + (row.amount || 0), 0) * 100) / 100;
  summary.arr = Math.round(summary.mrr * 12 * 100) / 100;
  summary.manualActive = active.length;
  summary.activeUsersToday = 0;
  const growthMap = {};
  for (const account of accounts) { const month = String(account.created_date || "").slice(0, 7); if (month) growthMap[month] = (growthMap[month] || 0) + 1; }
  const growth = Object.entries(growthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  rows.sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));
  return { summary, subscriptions: [], companiesWithoutSubscription: rows, growth, latestFeedback: [], local: true };
}

const fail = (error, status = 400) => {
  const err = new Error(error);
  err.response = { status, data: { error } };
  throw err;
};

/** Same contract as the server function: no action → overview; an action → { ok: true } or a thrown error. */
export function localSubscriptionOverview(body = {}, now = Date.now()) {
  const action = String(body.action || "");
  if (!action) return overview(now);
  if (action === "invoices") return { invoices: [] };
  if (action === "recordInvoiceAudit") return { ok: true };
  if (action === "platformReport") {
    return { companies: registry().companies.map((company) => ({ companyId: company.id, companyName: company.name, plan: company.plan || "—", employees: (read(`powercare_company_${company.id}`, {})?.employees || []).length, completedTasks: 0, attendanceRate: 0, loginSessions: 0, signedDocuments: 0, feedbackCount: 0, averageRating: null })) };
  }
  const company = registry().companies.find((row) => String(row.id) === String(body.accountId || ""));
  if (!company) fail("Company account not found", 404);
  const account = accountOf(company);
  const today = isoDay(now);
  const reason = String(body.reason || "").trim();
  if (action === "freeze") {
    if (!reason) fail("Freeze reason is required");
    patchCompany(account.id, { frozen: true, frozenAt: new Date(now).toISOString(), frozenReason: reason });
    audit(account, "subscription_frozen", account.frozen ? "frozen" : "active", "frozen", reason);
  } else if (action === "unfreeze") {
    patchCompany(account.id, { frozen: false, frozenAt: null, frozenReason: null });
    audit(account, "subscription_unfrozen", "frozen", "active", reason);
  } else if (action === "activate") {
    const end = isoDay(Math.max(now, Date.parse(account.subscriptionEnd || "") || 0) + 30 * DAY);
    patchCompany(account.id, { plan: !account.plan || account.plan === "Free" ? "Starter" : account.plan, subscriptionStart: today, subscriptionEnd: end, subscriptionExempt: false, exemptReason: null, frozen: false, frozenAt: null, frozenReason: null });
    audit(account, "subscription_activated", account.subscriptionEnd || "inactive", end, reason);
  } else if (action === "deactivate" || action === "cancelNow" || action === "cancelAtPeriodEnd") {
    const end = isoDay(now - DAY);
    patchCompany(account.id, { subscriptionEnd: end, subscriptionExempt: false, exemptReason: null });
    audit(account, action === "deactivate" ? "subscription_deactivated" : "subscription_canceled", account.subscriptionEnd || "active", end, reason);
  } else if (action === "reactivate") {
    audit(account, "subscription_reactivated", account.subscriptionEnd || "active", account.subscriptionEnd || "active", reason);
  } else if (action === "addDays") {
    const days = Math.min(3650, Math.max(1, Number(body.days) || 0));
    const end = isoDay(Math.max(now, Date.parse(account.subscriptionEnd || "") || 0) + days * DAY);
    patchCompany(account.id, { subscriptionStart: account.subscriptionStart || today, subscriptionEnd: end, frozen: false, frozenAt: null, frozenReason: null });
    audit(account, "subscription_days_added", account.subscriptionEnd || "—", end, `${days} days`);
  } else if (action === "exempt") {
    if (!reason) fail("Exemption reason is required");
    patchCompany(account.id, { subscriptionExempt: true, exemptReason: reason, frozen: false, frozenAt: null, frozenReason: null });
    audit(account, "subscription_exempted", "billable", "exempt", reason);
  } else if (action === "removeExemption") {
    patchCompany(account.id, { subscriptionExempt: false, exemptReason: null });
    audit(account, "subscription_exemption_removed", "exempt", "billable", reason);
  } else if (action === "changePlan" || action === "extend" || action === "updateAccount") {
    if ((action === "changePlan" || action === "updateAccount") && body.plan !== undefined) {
      if (!VALID_PLANS.has(String(body.plan))) fail("Invalid plan");
      const freePlan = body.freePlan === true;
      const customPrice = body.plan === "Custom" && !freePlan ? Math.max(0, Number(body.customPrice) || 0) : null;
      patchCompany(account.id, { plan: body.plan, customPrice, subscriptionExempt: freePlan, exemptReason: freePlan ? "Plan made free by platform owner" : null });
      audit(account, "subscription_plan_changed", `${account.plan}${account.subscriptionExempt ? " (free)" : account.customPrice != null ? ` ($${account.customPrice})` : ""}`, `${body.plan}${freePlan ? " (free)" : customPrice != null ? ` ($${customPrice})` : ""}`, reason);
    }
    if ((action === "extend" || action === "updateAccount") && body.subscriptionEnd !== undefined) {
      const nextEnd = body.subscriptionEnd || null;
      const fresh = registry().companies.find((row) => String(row.id) === String(account.id));
      patchCompany(account.id, { subscriptionStart: body.subscriptionStart || fresh?.subscriptionStart || null, subscriptionEnd: nextEnd });
      if (account.subscriptionEnd !== nextEnd) audit(account, "subscription_extended", account.subscriptionEnd || "—", nextEnd || "—", reason);
    }
  } else {
    fail(`Unknown action ${action}`);
  }
  return { ok: true, local: true };
}

/** What TrialExpiryGate asks the server: does the account exist, is it frozen or exempt. */
export function localAccountAccess(companyId) {
  const company = registry().companies.find((row) => String(row.id) === String(companyId || ""));
  if (!company) return { exists: true };
  return { exists: true, frozen: company.frozen === true, frozenReason: company.frozenReason || null, subscriptionExempt: company.subscriptionExempt === true };
}
