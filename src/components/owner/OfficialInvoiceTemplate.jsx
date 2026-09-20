import React from "react";
import InvoiceStatusBadge from "@/components/owner/InvoiceStatusBadge";

const money = (value, currency, ar) => new Intl.NumberFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", { style: "currency", currency: currency || "SAR" }).format((value || 0) / 100);

export default function OfficialInvoiceTemplate({ invoice, ar }) {
  const date = new Date(invoice.createdAt).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");
  const billing = invoice.billing === "yearly" ? (ar ? "سنوي / Yearly" : "Yearly / سنوي") : (ar ? "شهري / Monthly" : "Monthly / شهري");
  const row = (label, value, ltr = false, emphasis = false) => (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-[#E2E8F0] py-1.5 text-sm last:border-0">
      <span className={emphasis ? "text-lg font-bold text-[#1E9E63]" : "font-medium text-[#14284B]"} dir={ltr ? "ltr" : "auto"}>{value || "—"}</span>
      <span className={emphasis ? "text-lg font-bold text-[#14284B]" : "text-end text-[#5A6B85]"}>{label}</span>
    </div>
  );
  return (
    <article className="mx-auto min-h-[760px] max-w-2xl overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white px-7 py-8 text-[#14284B] sm:px-10 sm:py-9" dir={ar ? "rtl" : "ltr"}>
      <div className="mb-5 h-[3px] bg-[#14284B]" />
      <header>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-[#5A6B85]">NIROVERA</p>
        <h2 className="mt-1 text-xl font-semibold">{ar ? "فاتورة ضريبية رسمية" : "Official tax invoice"}</h2>
      </header>
      <div className="mt-5 space-y-3">
        <section className="rounded-xl border border-[#E2E8F0] bg-[#F7F8FA] p-4">
          {row(ar ? "رقم الفاتورة" : "Invoice number", invoice.number, true)}
          {row(ar ? "تاريخ الإصدار" : "Issue date", date)}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 py-1.5 text-sm">
            <InvoiceStatusBadge status={invoice.status} ar={ar} />
            <span className="text-end text-[#5A6B85]">{ar ? "حالة الدفع" : "Payment status"}</span>
          </div>
        </section>
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <h3 className="mb-2 text-end text-sm font-semibold">{ar ? "بيانات العميل" : "Bill to"}</h3>
          {row(ar ? "اسم العميل" : "Customer name", invoice.companyName)}
          {row(ar ? "البريد الإلكتروني" : "Email", invoice.email, true)}
          {row(ar ? "معرّف العميل" : "Customer ID", invoice.companyId, true)}
        </section>
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <h3 className="mb-2 text-end text-sm font-semibold">{ar ? "تفاصيل الاشتراك" : "Subscription"}</h3>
          {row(ar ? "الخطة" : "Plan", invoice.plan)}
          {row(ar ? "دورة الفوترة" : "Billing cycle", billing)}
          {row(ar ? "الرقم المرجعي" : "Reference", invoice.paymentReference || invoice.chargeId, true)}
        </section>
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          {row(ar ? "المبلغ قبل الضريبة" : "Subtotal", money(invoice.subtotal, invoice.currency, ar))}
          {row(ar ? "ضريبة القيمة المضافة" : "VAT", money(invoice.tax, invoice.currency, ar))}
          {row(ar ? "الإجمالي" : "Total", money(invoice.total, invoice.currency, ar), false, true)}
        </section>
      </div>
      <footer className="mt-5 border-t border-[#E2E8F0] pt-3 text-xs leading-6 text-[#5A6B85]">
        <p>{ar ? "فاتورة إلكترونية صادرة عن NiroVera." : "Electronic invoice issued by NiroVera."}</p>
      </footer>
    </article>
  );
}
