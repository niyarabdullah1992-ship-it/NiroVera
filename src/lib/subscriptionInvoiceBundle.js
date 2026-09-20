import { POWERCARE_MARK_URL } from "@/lib/brand";
import { subscriptionInvoiceNumber } from "@/lib/subscriptionInvoiceExport";
import { subscriptionBillableAmount, subscriptionTotals, formatSubscriptionMoney } from "@/lib/subscriptionTax";
import { CLEAN_PRINT_CSS } from "@/lib/pdfTheme";

const esc = (value) => String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const date = (value, ar) => new Date(value || Date.now()).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");

export function printSubscriptionInvoiceBundle(rows, ar) {
  const subscriptions = rows.filter((row) => row.status !== "no_subscription");
  const combined = subscriptionTotals(subscriptions.reduce((sum, row) => sum + subscriptionBillableAmount(row), 0));
  const totalMoney = (value) => formatSubscriptionMoney(value, "USD", ar);
  const invoices = subscriptions.map((row) => {
    const currency = row.currency || "USD";
    const totals = subscriptionTotals(subscriptionBillableAmount(row));
    const money = (value) => formatSubscriptionMoney(value, currency, ar);
    const cycle = row.billing === "yearly" ? (ar ? "سنوي" : "Yearly") : (ar ? "شهري" : "Monthly");
    return `<section class="invoice-page"><header><img src="${POWERCARE_MARK_URL}" alt="NiroVera"><div><p class="kicker">NIROVERA</p><h1>${ar ? "فاتورة اشتراك" : "Subscription invoice"}</h1></div><b>${esc(subscriptionInvoiceNumber(row))}</b></header><div class="grid"><div><small>${ar ? "العميل" : "Customer"}</small><strong>${esc(row.companyName || "—")}</strong><p>${esc(row.email || "—")}</p></div><div><small>${ar ? "تاريخ الإصدار" : "Issue date"}</small><strong>${esc(date(row.startedAt, ar))}</strong></div></div><div class="grid three"><div><small>${ar ? "الباقة" : "Plan"}</small><strong>${esc(row.plan || "—")}</strong></div><div><small>${ar ? "دورة الفوترة" : "Billing cycle"}</small><strong>${esc(cycle)}</strong></div><div><small>${ar ? "العملة" : "Currency"}</small><strong>${esc(currency)}</strong></div></div><div class="grid three"><div><small>${ar ? "قبل الضريبة" : "Subtotal"}</small><strong>${money(totals.subtotal)}</strong></div><div><small>${ar ? "ضريبة القيمة المضافة 15%" : "VAT 15%"}</small><strong>${money(totals.vat)}</strong></div><div><small>${ar ? "الإجمالي شامل الضريبة" : "Total including VAT"}</small><strong>${money(totals.total)}</strong></div></div><div class="foot">NiroVera • ${ar ? "فاتورة إلكترونية" : "Electronic invoice"}</div></section>`;
  }).join("");
  const html = `<!doctype html><html dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${ar ? "جميع فواتير الاشتراكات" : "All subscription invoices"}</title><style>${CLEAN_PRINT_CSS}.cover,.invoice-page{width:210mm;min-height:297mm;padding:16mm;page-break-after:always}.invoice-page:last-child{page-break-after:auto}header{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid #E2E8F0}header img{width:44px;height:44px;object-fit:contain}header>b{margin-inline-start:auto;font:700 12px monospace}.grid{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-top:16px}.grid.three{grid-template-columns:repeat(3,1fr)}.grid>div{padding:12px;border:1px solid #E2E8F0;border-radius:10px}small{display:block;color:#5A6B85;font-size:10px;margin-bottom:4px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:20px}.summary div{padding:12px;border:1px solid #E2E8F0;border-radius:10px}</style></head><body><section class="cover"><div class="rule"></div><p class="kicker" style="margin-top:16px">NIROVERA</p><h1>${ar ? "كتاب فواتير الاشتراكات" : "Subscription invoice book"}</h1><p class="meta">${ar ? "ملف موحد لجميع الاشتراكات" : "One unified file for all subscriptions"} • ${date(Date.now(), ar)}</p><div class="summary"><div><small>${ar ? "عدد الاشتراكات" : "Subscriptions"}</small><strong>${subscriptions.length}</strong></div><div><small>${ar ? "قبل الضريبة" : "Subtotal"}</small><strong>${totalMoney(combined.subtotal)}</strong></div><div><small>${ar ? "الضريبة 15%" : "VAT 15%"}</small><strong>${totalMoney(combined.vat)}</strong></div><div><small>${ar ? "الإجمالي" : "Total"}</small><strong>${totalMoney(combined.total)}</strong></div></div></section>${invoices}<script>onload=()=>setTimeout(()=>print(),500)</script></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
