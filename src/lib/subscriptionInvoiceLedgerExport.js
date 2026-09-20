import { exportExcelColored } from "@/lib/exportExcelColored";
import { POWERCARE_MARK_URL } from "@/lib/brand";
import { CLEAN_PRINT_CSS } from "@/lib/pdfTheme";

const money = (value, currency, ar) => new Intl.NumberFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", { style: "currency", currency }).format((value || 0) / 100);
const esc = (value) => String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const headers = (ar) => ar ? ["رقم الفاتورة", "الشركة", "الحالة", "تاريخ الإصدار", "العملة", "قبل الضريبة", "الضريبة", "الإجمالي", "المدفوع", "المتبقي"] : ["Invoice number", "Company", "Status", "Issue date", "Currency", "Subtotal", "Tax", "Total", "Paid", "Balance"];
const row = (invoice, ar) => [invoice.number, invoice.companyName || invoice.email, invoice.status, new Date(invoice.createdAt).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB"), invoice.currency, money(invoice.subtotal, invoice.currency, ar), money(invoice.tax, invoice.currency, ar), money(invoice.total, invoice.currency, ar), money(invoice.amountPaid, invoice.currency, ar), money(invoice.amountDue, invoice.currency, ar)];

export function exportInvoiceLedgerExcel(invoices, ar) {
  exportExcelColored({
    filename: "subscription_invoice_ledger",
    title: ar ? "سجل فواتير الاشتراكات" : "Subscription invoice ledger",
    headers: headers(ar),
    rows: invoices.map((invoice) => row(invoice, ar)),
    dir: ar ? "rtl" : "ltr",
  });
}

export function printInvoiceLedger(invoices, ar) {
  const dir = ar ? "rtl" : "ltr";
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const total = paid.reduce((sum, invoice) => sum + (invoice.amountPaid || 0), 0);
  const currency = paid[0]?.currency || invoices[0]?.currency || "SAR";
  const statusLabel = (status) => ar ? ({ paid: "مدفوعة", open: "مستحقة", draft: "مسودة", void: "ملغاة", uncollectible: "متعذرة" }[status] || status) : status;
  const cards = invoices.map((invoice) => `<article class="card"><div class="invoice-head"><div><small>${ar ? "رقم الفاتورة" : "Invoice number"}</small><strong>${esc(invoice.number)}</strong></div><span class="status">${esc(statusLabel(invoice.status))}</span></div><div class="identity"><div><small>${ar ? "العميل" : "Customer"}</small><b>${esc(invoice.companyName || invoice.email)}</b></div><div><small>${ar ? "تاريخ الإصدار" : "Issue date"}</small><b>${esc(new Date(invoice.createdAt).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB"))}</b></div><div><small>${ar ? "العملة" : "Currency"}</small><b>${esc(invoice.currency)}</b></div></div><div class="amounts"><div><small>${ar ? "قبل الضريبة" : "Subtotal"}</small><b>${money(invoice.subtotal, invoice.currency, ar)}</b></div><div><small>${ar ? "الضريبة" : "VAT"}</small><b>${money(invoice.tax, invoice.currency, ar)}</b></div><div><small>${ar ? "الإجمالي" : "Total"}</small><b>${money(invoice.total, invoice.currency, ar)}</b></div><div><small>${ar ? "المدفوع" : "Paid"}</small><b>${money(invoice.amountPaid, invoice.currency, ar)}</b></div><div><small>${ar ? "المتبقي" : "Balance"}</small><b>${money(invoice.amountDue, invoice.currency, ar)}</b></div></div></article>`).join("");
  const html = `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${ar ? "سجل فواتير الاشتراكات" : "Subscription invoice ledger"}</title><style>${CLEAN_PRINT_CSS}body{padding:16mm}.logo{width:44px;height:44px;object-fit:contain}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.summary div,.card{border:1px solid #E2E8F0;border-radius:10px;background:#fff}.summary div{padding:12px;text-align:center}.card{margin-top:10px;padding:14px;break-inside:avoid}.invoice-head{display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid #E2E8F0}.status{padding:4px 10px;border:1px solid #E2E8F0;border-radius:999px;font-size:11px;font-weight:600}.identity,.amounts{display:grid;gap:10px;padding-top:10px}.identity{grid-template-columns:2fr 1fr .6fr}.amounts{grid-template-columns:repeat(5,1fr)}small{display:block;color:#5A6B85;font-size:10px;margin-bottom:4px}</style></head><body><div class="rule"></div><header style="display:flex;align-items:center;gap:12px;padding:16px 0"><img class="logo" src="${POWERCARE_MARK_URL}" alt="NiroVera"><div><p class="kicker">NIROVERA</p><h1>${ar ? "سجل فواتير الاشتراكات" : "Subscription invoice ledger"}</h1><p class="meta">${new Date().toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}</p></div></header><div class="summary"><div><small>${ar ? "إجمالي الفواتير" : "Total invoices"}</small><b>${invoices.length}</b></div><div><small>${ar ? "الفواتير المدفوعة" : "Paid invoices"}</small><b>${paid.length}</b></div><div><small>${ar ? "إجمالي المحصل" : "Total collected"}</small><b>${money(total, currency, ar)}</b></div></div>${cards}<div class="foot">NiroVera • ${ar ? "سجل مالي" : "Financial record"}</div><script>onload=()=>setTimeout(()=>print(),500)</script></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
