export const SUBSCRIPTION_VAT_RATE = 0.15;

export function subscriptionTotals(amount) {
  const subtotal = Math.max(0, Number(amount) || 0);
  const vat = Math.round(subtotal * SUBSCRIPTION_VAT_RATE * 100) / 100;
  return { subtotal, vat, total: Math.round((subtotal + vat) * 100) / 100 };
}

export function subscriptionBillableAmount(row) {
  if (!row || row.exempt === true || row.isFree === true || row.plan === "Free") return 0;
  return Math.max(0, Number(row.amount ?? row.customPrice) || 0);
}

export function formatSubscriptionMoney(amount, currency = "USD", ar = false) {
  return new Intl.NumberFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}