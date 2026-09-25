import React, { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import InvoiceStatusBadge from "@/components/owner/InvoiceStatusBadge";
import InvoiceDetailsDialog from "@/components/owner/InvoiceDetailsDialog";
import InvoicePeriodFilters from "@/components/owner/InvoicePeriodFilters";
import { exportInvoiceLedgerExcel, printInvoiceLedger } from "@/lib/subscriptionInvoiceLedgerExport";
import {
  OWNER_MONO,
  OwnerSectionHead,
  OwnerStatTile,
  ownerChip,
  ownerField,
  ownerGhostBtn,
  ownerGrid,
  ownerPaper,
  ownerStack,
} from "@/components/owner/ownerUi";

const money = (value, currency, ar) => new Intl.NumberFormat(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", {
  style: "currency",
  currency,
}).format((value || 0) / 100);

export default function SubscriptionInvoicesDashboard({ ar }) {
  const [invoices, setInvoices] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    base44.functions
      .invoke("tapPayments", { action: "listPayments" })
      .then((res) => setInvoices(res.data.invoices || []))
      .catch(() => setInvoices([]));
  }, []);

  const periodInvoices = useMemo(() => {
    const now = new Date();
    const monthCount = period === "current" ? 1 : Number(period);
    const cutoff = ["all", "range"].includes(period)
      ? null
      : new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1);
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return (invoices || []).filter((invoice) => {
      const time = new Date(invoice.createdAt).getTime();
      return (!cutoff || time >= cutoff.getTime())
        && (!fromTime || time >= fromTime)
        && (!toTime || time <= toTime);
    });
  }, [invoices, period, dateFrom, dateTo]);

  const filtered = useMemo(
    () => periodInvoices.filter(
      (invoice) => (status === "all" || invoice.status === status)
        && `${invoice.number} ${invoice.companyName} ${invoice.email}`.toLowerCase().includes(search.toLowerCase()),
    ),
    [periodInvoices, search, status],
  );

  const audit = (event, invoice = {}) => base44.functions
    .invoke("tapPayments", {
      action: "recordInvoiceAudit",
      event,
      invoiceId: invoice.id || "bulk",
      invoiceNumber: invoice.number || "bulk",
      companyId: invoice.companyId || "platform",
    })
    .catch(() => {});

  const exportExcel = () => {
    audit("exported_excel");
    exportInvoiceLedgerExcel(filtered, ar);
  };
  const exportPdf = () => {
    audit("exported_pdf");
    printInvoiceLedger(filtered, ar);
  };

  if (!invoices) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--nv-accent)" }} />
      </div>
    );
  }

  const paid = periodInvoices.filter((item) => item.status === "paid");
  const due = periodInvoices.filter((item) => item.status === "open");
  const totalPaid = paid.reduce((sum, item) => sum + item.amountPaid, 0);

  return (
    <div style={ownerStack}>
      <OwnerSectionHead
        kicker={ar ? "السجل المالي القانوني" : "Financial compliance ledger"}
        title={ar ? "فواتير الاشتراكات" : "Subscription invoices"}
      />

      <div style={ownerGrid}>
        <OwnerStatTile label={ar ? "إجمالي الفواتير" : "All invoices"} value={periodInvoices.length} />
        <OwnerStatTile label={ar ? "مدفوعة" : "Paid"} value={paid.length} state="ok" />
        <OwnerStatTile label={ar ? "مستحقة" : "Outstanding"} value={due.length} state={due.length ? "warn" : "mute"} />
        <OwnerStatTile
          label={ar ? "إجمالي المحصل" : "Total collected"}
          value={money(totalPaid, paid[0]?.currency || "USD", ar)}
          state="ok"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button type="button" onClick={() => setShowReport(!showReport)} style={ownerChip(showReport)}>
          <FileText className="h-3.5 w-3.5" style={{ display: "inline", marginInlineEnd: 6, verticalAlign: -2 }} />
          {ar ? "تقرير فواتير الاشتراكات (PDF / Excel)" : "Subscription invoices report (PDF / Excel)"}
        </button>
        {showReport ? (
          <div style={{ ...ownerPaper("mute"), padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <InvoicePeriodFilters
              period={period}
              onPeriodChange={(value) => {
                setPeriod(value);
                if (value !== "range") {
                  setDateFrom("");
                  setDateTo("");
                }
              }}
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
              ar={ar}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={exportExcel} disabled={!filtered.length} style={ownerGhostBtn()}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button type="button" onClick={exportPdf} disabled={!filtered.length} style={ownerGhostBtn()}>
                <FileText className="h-4 w-4" /> PDF
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--nv-muted)" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={ar ? "بحث برقم الفاتورة أو الشركة…" : "Search invoice or company…"}
            style={{ ...ownerField(), paddingInlineStart: 36 }}
          />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={ownerField()}>
          <option value="all">{ar ? "كل الحالات" : "All statuses"}</option>
          <option value="paid">{ar ? "مدفوعة" : "Paid"}</option>
          <option value="open">{ar ? "مستحقة" : "Open"}</option>
          <option value="draft">{ar ? "مسودة" : "Draft"}</option>
          <option value="void">{ar ? "ملغاة" : "Void"}</option>
          <option value="uncollectible">{ar ? "متعذرة" : "Uncollectible"}</option>
        </select>
      </div>

      <div style={{ ...ownerPaper("mute"), overflow: "hidden", padding: 0 }}>
        <table className="mobile-cards w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--nv-line)", background: "var(--nv-soft)", textAlign: "start", fontSize: 11, color: "var(--nv-muted)" }}>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "رقم الفاتورة" : "Invoice"}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "العميل" : "Customer"}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "الحالة" : "Status"}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "التاريخ" : "Date"}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "الضريبة" : "Tax"}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "الإجمالي" : "Total"}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "المتبقي" : "Balance"}</th>
              <th style={{ padding: "12px 14px" }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((invoice) => (
              <tr key={invoice.id} style={{ borderTop: "1px solid var(--nv-line)" }}>
                <td style={{ ...OWNER_MONO, padding: "12px 14px", fontSize: 12 }} data-label={ar ? "رقم الفاتورة" : "Invoice"}>
                  {invoice.number}
                </td>
                <td style={{ padding: "12px 14px" }} data-label={ar ? "العميل" : "Customer"}>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--nv-ink)" }}>{invoice.companyName || "—"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--nv-muted)" }} dir="ltr">{invoice.email}</p>
                </td>
                <td style={{ padding: "12px 14px" }} data-label={ar ? "الحالة" : "Status"}>
                  <InvoiceStatusBadge status={invoice.status} ar={ar} />
                </td>
                <td style={{ padding: "12px 14px", color: "var(--nv-muted)" }} data-label={ar ? "التاريخ" : "Date"}>
                  {new Date(invoice.createdAt).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}
                </td>
                <td style={{ padding: "12px 14px" }} data-label={ar ? "الضريبة" : "Tax"}>
                  {money(invoice.tax, invoice.currency, ar)}
                </td>
                <td style={{ padding: "12px 14px", fontWeight: 600 }} data-label={ar ? "الإجمالي" : "Total"}>
                  {money(invoice.total, invoice.currency, ar)}
                </td>
                <td style={{ padding: "12px 14px" }} data-label={ar ? "المتبقي" : "Balance"}>
                  {money(invoice.amountDue, invoice.currency, ar)}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(invoice);
                      audit("viewed", invoice);
                    }}
                    style={ownerGhostBtn()}
                  >
                    {ar ? "التفاصيل" : "Details"}
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--nv-muted)" }}>
                  {ar ? "لا توجد فواتير مطابقة." : "No matching invoices."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <InvoiceDetailsDialog invoice={selected} onClose={() => setSelected(null)} ar={ar} onAudit={audit} />
    </div>
  );
}
