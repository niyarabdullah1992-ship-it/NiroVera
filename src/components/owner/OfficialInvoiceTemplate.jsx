import React from "react";
import InvoiceStatusBadge from "@/components/owner/InvoiceStatusBadge";
import { DS_CONTROL_RADIUS, DS_EDGE_PX, DS_RADIUS } from "@/lib/designSystem";

const money = (value, currency, ar) => new Intl.NumberFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", {
  style: "currency",
  currency: currency || "SAR",
}).format((value || 0) / 100);

export default function OfficialInvoiceTemplate({ invoice, ar }) {
  const date = new Date(invoice.createdAt).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");
  const billing = invoice.billing === "yearly"
    ? (ar ? "سنوي / Yearly" : "Yearly / سنوي")
    : (ar ? "شهري / Monthly" : "Monthly / شهري");

  const row = (label, value, ltr = false, emphasis = false) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 20,
        borderBottom: "1px solid var(--nv-line)",
        padding: "6px 0",
        fontSize: 13,
      }}
    >
      <span
        dir={ltr ? "ltr" : "auto"}
        style={{
          fontWeight: emphasis ? 700 : 500,
          fontSize: emphasis ? 17 : 13,
          color: emphasis ? "var(--nv-accent)" : "var(--nv-ink)",
        }}
      >
        {value || "—"}
      </span>
      <span
        style={{
          textAlign: "end",
          fontWeight: emphasis ? 700 : 400,
          fontSize: emphasis ? 17 : 13,
          color: emphasis ? "var(--nv-ink)" : "var(--nv-muted)",
        }}
      >
        {label}
      </span>
    </div>
  );

  const section = {
    border: "1px solid var(--nv-line)",
    borderRadius: DS_CONTROL_RADIUS,
    background: "var(--nv-card)",
    padding: 14,
  };

  return (
    <article
      style={{
        marginInline: "auto",
        minHeight: 760,
        maxWidth: 672,
        overflow: "hidden",
        borderRadius: DS_RADIUS,
        border: "1px solid var(--nv-line)",
        background: "var(--nv-card)",
        color: "var(--nv-ink)",
        padding: "32px 28px",
        boxSizing: "border-box",
      }}
      dir={ar ? "rtl" : "ltr"}
    >
      <div style={{ marginBottom: 20, height: DS_EDGE_PX, background: "var(--nv-navy)" }} />
      <header>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", color: "var(--nv-muted)" }}>
          NIROVERA
        </p>
        <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600, color: "var(--nv-ink)" }}>
          {ar ? "فاتورة ضريبية رسمية" : "Official tax invoice"}
        </h2>
      </header>
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={{ ...section, background: "var(--nv-soft)" }}>
          {row(ar ? "رقم الفاتورة" : "Invoice number", invoice.number, true)}
          {row(ar ? "تاريخ الإصدار" : "Issue date", date)}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 20, padding: "6px 0", fontSize: 13 }}>
            <InvoiceStatusBadge status={invoice.status} ar={ar} />
            <span style={{ textAlign: "end", color: "var(--nv-muted)" }}>{ar ? "حالة الدفع" : "Payment status"}</span>
          </div>
        </section>
        <section style={section}>
          <h3 style={{ margin: "0 0 8px", textAlign: "end", fontSize: 13, fontWeight: 600 }}>
            {ar ? "بيانات العميل" : "Bill to"}
          </h3>
          {row(ar ? "اسم العميل" : "Customer name", invoice.companyName)}
          {row(ar ? "البريد الإلكتروني" : "Email", invoice.email, true)}
          {row(ar ? "معرّف العميل" : "Customer ID", invoice.companyId, true)}
        </section>
        <section style={section}>
          <h3 style={{ margin: "0 0 8px", textAlign: "end", fontSize: 13, fontWeight: 600 }}>
            {ar ? "تفاصيل الاشتراك" : "Subscription"}
          </h3>
          {row(ar ? "الخطة" : "Plan", invoice.plan)}
          {row(ar ? "دورة الفوترة" : "Billing cycle", billing)}
          {row(ar ? "الرقم المرجعي" : "Reference", invoice.paymentReference || invoice.chargeId, true)}
        </section>
        <section style={section}>
          {row(ar ? "المبلغ قبل الضريبة" : "Subtotal", money(invoice.subtotal, invoice.currency, ar))}
          {row(ar ? "ضريبة القيمة المضافة" : "VAT", money(invoice.tax, invoice.currency, ar))}
          {row(ar ? "الإجمالي" : "Total", money(invoice.total, invoice.currency, ar), false, true)}
        </section>
      </div>
      <footer style={{ marginTop: 20, borderTop: "1px solid var(--nv-line)", paddingTop: 12, fontSize: 12, lineHeight: 1.7, color: "var(--nv-muted)" }}>
        <p style={{ margin: 0 }}>{ar ? "فاتورة إلكترونية صادرة عن NiroVera." : "Electronic invoice issued by NiroVera."}</p>
      </footer>
    </article>
  );
}
