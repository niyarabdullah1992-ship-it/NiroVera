import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Loader2, Search } from "lucide-react";
import SubscriberRow from "@/components/owner/SubscriberRow";
import SubscriberAnalytics from "@/components/owner/SubscriberAnalytics";
import SubscriptionRevenueSummary from "@/components/owner/SubscriptionRevenueSummary";
import SubscriptionBulkExport from "@/components/owner/SubscriptionBulkExport";
import { subscriptionTotals, subscriptionBillableAmount, formatSubscriptionMoney } from "@/lib/subscriptionTax";
import {
  OwnerSectionHead,
  OwnerStatTile,
  ownerChip,
  ownerField,
  ownerGhostBtn,
  ownerGrid,
  ownerPaper,
  ownerStack,
} from "@/components/owner/ownerUi";

export default function SubscribersDashboard({ ar }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("subscriptionOverview", {});
      setData(res.data);
    } catch {
      setError(ar ? "تعذر تحميل البيانات." : "Failed to load data.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const summary = data?.summary;
  const allRows = [...(data?.subscriptions || []), ...(data?.companiesWithoutSubscription || [])];
  const rows = allRows.filter((row) => {
    if (statusFilter === "active" && !(row.status === "active" || row.status === "trialing" || row.status === "manual_active")) return false;
    if (statusFilter === "problem" && !(row.status === "past_due" || row.status === "unpaid" || row.status === "canceled")) return false;
    if (statusFilter === "none" && row.status !== "no_subscription") return false;
    if (statusFilter === "frozen" && !row.frozen) return false;
    const q = search.trim().toLowerCase();
    if (q && !(row.companyName || "").toLowerCase().includes(q) && !(row.email || "").toLowerCase().includes(q)) return false;
    return true;
  });
  const tableTotals = subscriptionTotals(rows.reduce((sum, row) => sum + subscriptionBillableAmount(row), 0));
  const stats = summary ? [
    { label: ar ? "الشركات المسجلة" : "Registered companies", value: summary.totalCompanies },
    { label: ar ? "اشتراكات نشطة" : "Active subscriptions", value: summary.activeSubscriptions },
    { label: ar ? "تجريبي" : "Trialing", value: summary.trialing },
    { label: ar ? "متأخر الدفع" : "Past due", value: summary.pastDue, warn: summary.pastDue > 0 },
    { label: ar ? "الاشتراكات المجمّدة" : "Frozen subscriptions", value: summary.frozen || 0, warn: summary.frozen > 0 },
  ] : [];

  const filters = [
    { key: "all", ar: "الكل", en: "All" },
    { key: "active", ar: "نشط", en: "Active" },
    { key: "problem", ar: "متعثر/ملغى", en: "Issues" },
    { key: "frozen", ar: "مجمّد", en: "Frozen" },
    { key: "none", ar: "بدون اشتراك", en: "No sub" },
  ];

  return (
    <div style={ownerStack}>
      <OwnerSectionHead
        kicker={ar ? "مركز العمليات المالية" : "Financial operations"}
        title={ar ? "إدارة الاشتراكات" : "Subscription management"}
        meta={(
          <button type="button" onClick={load} disabled={loading} title={ar ? "تحديث" : "Refresh"} style={ownerGhostBtn()}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      />

      {loading && !data ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 0", fontSize: 13, color: "var(--nv-muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
        </div>
      ) : null}
      {error ? <p style={{ margin: 0, fontSize: 13, color: "var(--nv-bad-ink)" }}>{error}</p> : null}

      {summary ? (
        <>
          <div style={ownerGrid}>
            {stats.map((stat) => (
              <OwnerStatTile key={stat.label} label={stat.label} value={stat.value} warn={stat.warn} state={stat.warn ? "warn" : "mute"} />
            ))}
          </div>

          <SubscriptionRevenueSummary amount={summary.mrr} ar={ar} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SubscriptionBulkExport rows={allRows} ar={ar} />
          </div>
          <SubscriberAnalytics data={data} ar={ar} />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--nv-muted)" }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={ar ? "بحث باسم الشركة أو الإيميل…" : "Search by company or email…"}
                style={{ ...ownerField(), paddingInlineStart: 36 }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {filters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  style={ownerChip(statusFilter === filter.key)}
                >
                  {ar ? filter.ar : filter.en}
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...ownerPaper("mute"), overflow: "hidden", padding: 0 }}>
            <table className="w-full text-sm mobile-cards" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--nv-line)", background: "var(--nv-soft)", textAlign: "start", fontSize: 11, color: "var(--nv-muted)" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "الشركة" : "Company"}</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "الباقة" : "Plan"}</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "الحالة" : "Status"}</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "بداية الاشتراك" : "Start"}</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "نهاية الاشتراك" : "End"}</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "المتبقي" : "Left"}</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "بيان الاشتراك" : "Account statement"}</th>
                  <th style={{ padding: "12px 14px", fontWeight: 600 }}>{ar ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "24px 14px", textAlign: "center", color: "var(--nv-muted)" }}>
                      {ar ? "لا يوجد مشتركون بعد." : "No subscribers yet."}
                    </td>
                  </tr>
                ) : null}
                {rows.map((row, index) => (
                  <SubscriberRow key={row.id || row.accountId || index} row={row} ar={ar} onChanged={load} />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--nv-line)", background: "var(--nv-soft)" }}>
                  <td colSpan={8} style={{ padding: "14px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "8px 20px", fontSize: 12, color: "var(--nv-ink2)" }}>
                      <span>{ar ? "قبل الضريبة" : "Before VAT"}: <strong dir="ltr">{formatSubscriptionMoney(tableTotals.subtotal, "USD", ar)}</strong></span>
                      <span>{ar ? "الضريبة 15%" : "VAT 15%"}: <strong dir="ltr">{formatSubscriptionMoney(tableTotals.vat, "USD", ar)}</strong></span>
                      <span style={{ color: "var(--nv-ok-ink)" }}>{ar ? "الإجمالي شامل الضريبة" : "Total including VAT"}: <strong dir="ltr">{formatSubscriptionMoney(tableTotals.total, "USD", ar)}</strong></span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
