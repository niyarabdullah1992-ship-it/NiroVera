/** Expenses / operating budget — station spend vs limit; receipt before approve.
 *  Keep in sync with base44/shared/expenseDerivations.ts
 */

export const WATCH_PCT = 85;
export const NEAR_LIMIT_PCT = 95;
export const PAYOUT_SLA_HOURS = 48;

export function clampPct(spent, limit) {
  const lim = Number(limit) || 0;
  if (lim <= 0) return Number(spent) > 0 ? 100 : 0;
  return Math.min(999, Math.round((Math.max(0, Number(spent) || 0) / lim) * 100));
}

export function deriveBudgetTag(pct) {
  const p = Number(pct) || 0;
  if (p >= 100) return "over";
  if (p >= NEAR_LIMIT_PCT) return "near_limit";
  if (p >= WATCH_PCT) return "watch";
  return "on_track";
}

export function approvedSpendForStation(claims, stationId) {
  return (claims || [])
    .filter((c) => c.stationId === stationId && (c.status === "approved" || c.status === "paid"))
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

export function enrichBudget(budget, claims = []) {
  const limit = Math.max(0, Number(budget.limit) || 0);
  const spent = approvedSpendForStation(claims, budget.stationId);
  const remaining = Math.max(0, limit - spent);
  const pct = clampPct(spent, limit);
  const tag = deriveBudgetTag(pct);
  return {
    ...budget,
    limit,
    spent,
    remaining,
    pct,
    tag,
    currency: String(budget.currency || "SAR").toUpperCase(),
  };
}

export function deriveCompanyBudget(budgets = [], claims = []) {
  const rows = budgets.map((b) => enrichBudget(b, claims));
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const limit = rows.reduce((s, r) => s + r.limit, 0);
  return {
    rows,
    spent,
    limit,
    pct: clampPct(spent, limit),
    nearLimitCount: rows.filter((r) => r.tag === "near_limit" || r.tag === "over").length,
    watchCount: rows.filter((r) => r.tag === "watch").length,
  };
}

export function hoursSince(iso, nowMs = Date.now()) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (nowMs - t) / (1000 * 60 * 60));
}

export function isDelayedPayout(claim, nowMs = Date.now()) {
  if (claim.status !== "approved") return false;
  return hoursSince(claim.approvedAt, nowMs) >= PAYOUT_SLA_HOURS;
}

export function enrichClaim(claim, nowMs = Date.now()) {
  const amount = Math.max(0, Number(claim.amount) || 0);
  const status = claim.status || "pending";
  const hasReceipt = !!(claim.receiptUrl && String(claim.receiptUrl).trim());
  return {
    ...claim,
    amount,
    status,
    hasReceipt,
    delayed: isDelayedPayout({ ...claim, status, amount }, nowMs),
    currency: String(claim.currency || "SAR").toUpperCase(),
  };
}

export function deriveExpenseAlert(claims = [], nowMs = Date.now()) {
  const enriched = claims.map((c) => enrichClaim(c, nowMs));
  const pending = enriched.filter((c) => c.status === "pending");
  const delayed = enriched.filter((c) => c.delayed);
  const missingReceipt = pending.filter((c) => !c.hasReceipt);
  return {
    pendingCount: pending.length,
    delayedPayoutCount: delayed.length,
    missingReceiptCount: missingReceipt.length,
  };
}

export function checkSubmitClaimGate(input) {
  const title = String(input.title || "").trim();
  const stationId = String(input.stationId || "").trim();
  const amount = Number(input.amount);
  if (!title) {
    return {
      ok: false,
      error: "TITLE_REQUIRED",
      reason: "عنوان المطالبة مطلوب.",
      reasonEn: "Claim title is required.",
    };
  }
  if (!stationId) {
    return {
      ok: false,
      error: "STATION_REQUIRED",
      reason: "الفرع مطلوبة.",
      reasonEn: "Station is required.",
    };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: "AMOUNT_REQUIRED",
      reason: "المبلغ يجب أن يكون أكبر من صفر.",
      reasonEn: "Amount must be greater than zero.",
    };
  }
  if (!input.receiptUrl || !String(input.receiptUrl).trim()) {
    return {
      ok: false,
      error: "RECEIPT_REQUIRED",
      reason: "الإيصال مطلوب قبل تقديم المطالبة.",
      reasonEn: "A receipt is required before submitting the claim.",
    };
  }
  const surface = checkOperatingClaimSurfaceGate(title);
  if (!surface.ok) return surface;
  return { ok: true, title, stationId, amount };
}

/** Graduated operating-claim review: amount derives the path — it is not chosen. */
export const EXPENSE_APPROVAL_POLICY = [
  { upTo: 500, steps: ["mgr"] },
  { upTo: 5000, steps: ["mgr", "fin"] },
  { upTo: Infinity, steps: ["mgr", "fin", "cfo"] },
];

export function approvalStepsForAmount(amount) {
  const total = Math.max(0, Number(amount) || 0);
  return (EXPENSE_APPROVAL_POLICY.find((row) => total <= row.upTo) || EXPENSE_APPROVAL_POLICY[2]).steps;
}

export function claimNeedsCfo(amount) {
  return approvalStepsForAmount(amount).includes("cfo");
}

/** Budget board uses pending / approved / rejected / paid. */
export function toBudgetStatus(status) {
  if (status === "submitted" || status === "manager_approved" || status === "cfo_pending") return "pending";
  if (status === "finance_approved") return "approved";
  if (status === "cfo_approved") return "approved";
  if (status === "manager_rejected" || status === "finance_rejected" || status === "cfo_rejected") return "rejected";
  return status || "pending";
}

/** Historical stocky titles stay on the ledger and are labelled — they are not new operating claims. */
export function annotateLegacyStockSurface(claim) {
  if (!claim || claim.legacyStockSurface) return claim;
  const title = `${claim.description || ""} ${claim.title || ""} ${claim.customExpenseType || ""}`;
  if (!checkOperatingClaimSurfaceGate(title).ok) {
    return { ...claim, legacyStockSurface: true };
  }
  return claim;
}

const STOCKY_TITLE = /قفاز|كبل|زيت|فلتر|قاطع|مستلزمات|قطع غيار|أصناف|مخزون|خوذ|كمام|gloves|cable|oil|filter|breaker|stock|ppe|helmet|spare/i;

/** Operating claims stay off the inventory surface. */
export function checkOperatingClaimSurfaceGate(title) {
  if (STOCKY_TITLE.test(String(title || ""))) {
    return {
      ok: false,
      error: "STOCK_SURFACE",
      reason: "وصفك يدلّ على شراء صنف يُخزَّن — سجّله في المخزون لا كمصروفات تشغيل.",
      reasonEn: "This description is a stocked item — record it on Inventory, not as an operating claim.",
    };
  }
  return { ok: true };
}

export function checkApproveClaimGate(claim, budget, claims = []) {
  if (!claim) {
    return {
      ok: false,
      error: "CLAIM_NOT_FOUND",
      reason: "المطالبة غير موجودة.",
      reasonEn: "Claim not found.",
    };
  }
  if (claim.status && claim.status !== "pending") {
    return {
      ok: false,
      error: "ALREADY_DECIDED",
      reason: "المطالبة حُسمت مسبقًا.",
      reasonEn: "Claim already decided.",
    };
  }
  if (!claim.receiptUrl || !String(claim.receiptUrl).trim()) {
    return {
      ok: false,
      error: "RECEIPT_REQUIRED",
      reason: "لا اعتماد بلا إيصال مرفق.",
      reasonEn: "Cannot approve without a receipt attachment.",
    };
  }
  if (!budget) {
    return {
      ok: false,
      error: "BUDGET_MISSING",
      reason: "لا ميزانية لهذا الفرع.",
      reasonEn: "No budget configured for this station.",
    };
  }
  const spent = approvedSpendForStation(claims, claim.stationId);
  const amount = Number(claim.amount) || 0;
  const limit = Number(budget.limit) || 0;
  if (limit > 0 && spent + amount > limit) {
    return {
      ok: false,
      error: "BUDGET_EXCEEDED",
      // Every other figure on this surface is thousands-separated; the remainder was
      // the one number printed raw.
      reason: `تجاوز ميزانية الفرع — المتبقي ${Math.max(0, limit - spent).toLocaleString("en-US")}.`,
      reasonEn: `Station budget exceeded — remaining ${Math.max(0, limit - spent).toLocaleString("en-US")}.`,
    };
  }
  return { ok: true };
}

export function checkRejectClaimGate(claim) {
  if (!claim) {
    return {
      ok: false,
      error: "CLAIM_NOT_FOUND",
      reason: "المطالبة غير موجودة.",
      reasonEn: "Claim not found.",
    };
  }
  if (claim.status && claim.status !== "pending") {
    return {
      ok: false,
      error: "ALREADY_DECIDED",
      reason: "المطالبة حُسمت مسبقًا.",
      reasonEn: "Claim already decided.",
    };
  }
  return { ok: true };
}

export function checkMarkPaidGate(claim) {
  if (!claim) {
    return {
      ok: false,
      error: "CLAIM_NOT_FOUND",
      reason: "المطالبة غير موجودة.",
      reasonEn: "Claim not found.",
    };
  }
  if (claim.status !== "approved") {
    return {
      ok: false,
      error: "NOT_APPROVED",
      reason: "الصرف بعد الاعتماد فقط.",
      reasonEn: "Payout only after approval.",
    };
  }
  return { ok: true };
}
