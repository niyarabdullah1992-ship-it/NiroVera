import { exportExcelColored } from "@/lib/exportExcelColored";
import { subscriptionTotals, subscriptionBillableAmount, formatSubscriptionMoney } from "@/lib/subscriptionTax";
import { POWERCARE_MARK_URL } from "@/lib/brand";
import { CLEAN_PRINT_CSS } from "@/lib/pdfTheme";

export const subscriptionInvoiceNumber = (row) => {
  const source = String(row.id || row.accountId || row.email || "invoice").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const year = new Date(row.startedAt || Date.now()).getFullYear();
  return `PC-${year}-${source.slice(-8).padStart(8, "0")}`;
};

export const subscriptionInvoiceRow = (row, ar) => {
  const currency = row.currency || "USD";
  const totals = subscriptionTotals(subscriptionBillableAmount(row));
  const money = (value) => formatSubscriptionMoney(value, currency, ar);
  return [subscriptionInvoiceNumber(row), row.companyName || "—", row.email || "—", row.plan || "—", row.billing === "yearly" ? (ar ? "سنوي" : "Yearly") : (ar ? "شهري" : "Monthly"), new Date(row.startedAt || Date.now()).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB"), currency, money(totals.subtotal), money(totals.vat), money(totals.total)];
};

const headers = (ar) => ar ? ["رقم الفاتورة", "الشركة", "البريد الإلكتروني", "الباقة", "الدورة", "تاريخ الإصدار", "العملة", "قبل الضريبة", "الضريبة 15%", "الإجمالي"] : ["Invoice number", "Company", "Email", "Plan", "Cycle", "Issue date", "Currency", "Before VAT", "VAT 15%", "Total"];
const esc = (value) => String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const rowsWithTotal = (rows, ar) => {
  const detailRows = rows.map((row) => subscriptionInvoiceRow(row, ar));
  const totals = subscriptionTotals(rows.reduce((sum, row) => sum + subscriptionBillableAmount(row), 0));
  const money = (value) => formatSubscriptionMoney(value, "USD", ar);
  return [...detailRows, [ar ? "الإجمالي" : "TOTAL", "", "", "", "", "", "USD", money(totals.subtotal), money(totals.vat), money(totals.total)]];
};

export function exportSubscriptionInvoicesExcel(rows, ar, filename = "subscription_invoices") {
  exportExcelColored({ filename, title: ar ? "فواتير الاشتراكات" : "Subscription invoices", headers: headers(ar), rows: rowsWithTotal(rows, ar), dir: ar ? "rtl" : "ltr" });
}

export function printSubscriptionInvoices(rows, ar, title) {
  const dir = ar ? "rtl" : "ltr";
  const cards = rows.map((item) => {
    const currency = item.currency || "USD";
    const totals = subscriptionTotals(subscriptionBillableAmount(item));
    const formatted = (value) => formatSubscriptionMoney(value, currency, ar);
    const issueDate = new Date(item.startedAt || Date.now()).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");
    const cycle = item.billing === "yearly" ? (ar ? "سنوي / Yearly" : "Yearly / سنوي") : (ar ? "شهري / Monthly" : "Monthly / شهري");
    const line = (label, value, total = false) => `<div class="line${total ? " total" : ""}"><span>${esc(value)}</span><small>${esc(label)}</small></div>`;
    return `<article class="statement"><div class="statement-head"><div><small>${ar ? "رقم البيان / Statement number" : "Statement number / رقم البيان"}</small><strong>${esc(subscriptionInvoiceNumber(item))}</strong></div><span class="badge">${ar ? "بيان اشتراك" : "SUBSCRIPTION"}</span></div><section class="customer"><div><small>${ar ? "العميل / Customer" : "Customer / العميل"}</small><b>${esc(item.companyName || "—")}</b><p>${esc(item.email || "—")}</p></div><div><small>${ar ? "تاريخ الإصدار / Issue date" : "Issue date / تاريخ الإصدار"}</small><b>${esc(issueDate)}</b></div></section><section class="service"><h2>${ar ? "تفاصيل الاشتراك / Subscription details" : "Subscription details / تفاصيل الاشتراك"}</h2>${line(ar ? "الباقة / Plan" : "Plan / الباقة", item.plan || "—")}${line(ar ? "دورة الفوترة / Billing cycle" : "Billing cycle / دورة الفوترة", cycle)}${line(ar ? "العملة / Currency" : "Currency / العملة", currency)}</section><section class="totals">${line(ar ? "المبلغ قبل الضريبة / Subtotal" : "Subtotal / المبلغ قبل الضريبة", formatted(totals.subtotal))}${line(ar ? "ضريبة القيمة المضافة (15%) / VAT" : "VAT (15%) / ضريبة القيمة المضافة", formatted(totals.vat))}${line(ar ? "الإجمالي شامل الضريبة / Total" : "Total including VAT / الإجمالي", formatted(totals.total), true)}</section></article>`;
  }).join("");
  const html = `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(title || (ar ? "بيان الاشتراك" : "Subscription statement"))}</title><style>${CLEAN_PRINT_CSS}body{padding:16mm}.logo{width:44px;height:44px;object-fit:contain}.statement{margin-top:16px;padding:16px;border:1px solid #E2E8F0;border-radius:10px;break-inside:avoid}.statement-head{display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #E2E8F0}.badge{padding:4px 10px;border:1px solid #E2E8F0;border-radius:999px;color:#14284B;font-size:11px;font-weight:600}.customer{display:grid;grid-template-columns:2fr 1fr;gap:16px;padding:14px 0}.line{display:grid;grid-template-columns:1fr auto;gap:16px;padding:6px 0;border-bottom:1px solid #F1F5F9;font-size:13px}.total{font-weight:700;border-bottom:0}.total span{color:#1E9E63}</style></head><body><div class="rule"></div><header style="display:flex;align-items:center;gap:12px;padding:16px 0"><img class="logo" src="${POWERCARE_MARK_URL}" alt="NiroVera"><div><p class="kicker">NIROVERA</p><h1>${ar ? "بيان الاشتراك" : "Subscription statement"}</h1></div></header>${cards}<div class="foot">NiroVera • ${new Date().toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}</div><script>onload=()=>setTimeout(()=>print(),500)</script></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}