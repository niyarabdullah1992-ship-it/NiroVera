import { CLEAN_PRINT_CSS } from "@/lib/pdfTheme";

const esc = (value) => String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (value, currency, ar) => new Intl.NumberFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", { style: "currency", currency: currency || "SAR" }).format((value || 0) / 100);

export function printOfficialInvoice(invoice, ar) {
  const dir = ar ? "rtl" : "ltr";
  const date = new Date(invoice.createdAt).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");
  const status = ar ? ({ paid: "مدفوعة", open: "مستحقة", void: "ملغاة", uncollectible: "متعذرة التحصيل" }[invoice.status] || invoice.status) : invoice.status;
  const billing = invoice.billing === "yearly" ? (ar ? "سنوي / Yearly" : "Yearly / سنوي") : (ar ? "شهري / Monthly" : "Monthly / شهري");
  const row = (label, value, emphasis = false) => `<div class="row${emphasis ? " emphasis" : ""}"><span class="value">${esc(value)}</span><span class="label">${esc(label)}</span></div>`;
  const html = `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(invoice.number)}</title><style>${CLEAN_PRINT_CSS}body{padding:16mm}.card{margin-top:12px;padding:14px 16px;border:1px solid #E2E8F0;border-radius:10px;background:#fff}h2{margin:0 0 8px;font-size:13px;color:#14284B}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:6px 0;font-size:13px;border-bottom:1px solid #F1F5F9}.value{text-align:start}.label{text-align:end;color:#5A6B85}.emphasis{font-size:16px;font-weight:700;border-bottom:0}.emphasis .value{color:#1E9E63}</style></head><body><div class="rule"></div><p class="kicker" style="margin-top:16px">NIROVERA</p><h1>${ar ? "فاتورة ضريبية رسمية" : "Official tax invoice"}</h1><p class="meta">${esc(invoice.number)} • ${esc(date)}</p><section class="card">${row(ar ? "رقم الفاتورة" : "Invoice number", invoice.number)}${row(ar ? "تاريخ الإصدار" : "Issue date", date)}${row(ar ? "حالة الدفع" : "Payment status", status)}</section><section class="card"><h2>${ar ? "بيانات العميل" : "Bill to"}</h2>${row(ar ? "اسم العميل" : "Customer name", invoice.companyName)}${row(ar ? "البريد الإلكتروني" : "Email", invoice.email)}${row(ar ? "معرّف العميل" : "Customer ID", invoice.companyId)}</section><section class="card"><h2>${ar ? "تفاصيل الاشتراك" : "Subscription"}</h2>${row(ar ? "الخطة" : "Plan", invoice.plan)}${row(ar ? "دورة الفوترة" : "Billing cycle", billing)}${row(ar ? "الرقم المرجعي" : "Reference", invoice.paymentReference || invoice.chargeId)}</section><section class="card">${row(ar ? "المبلغ قبل الضريبة" : "Subtotal", money(invoice.subtotal, invoice.currency, ar))}${row(ar ? "ضريبة القيمة المضافة" : "VAT", money(invoice.tax, invoice.currency, ar))}${row(ar ? "الإجمالي" : "Total", money(invoice.total, invoice.currency, ar), true)}</section><div class="foot">${ar ? "فاتورة إلكترونية صادرة عن NiroVera." : "Electronic invoice issued by NiroVera."}</div><script>onload=()=>setTimeout(()=>print(),350)</script></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
