import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SubscriberAnalytics from "@/components/owner/SubscriberAnalytics";
import VisitorStatsCard from "@/components/owner/VisitorStatsCard";
import OwnerExportButtons from "@/components/owner/OwnerExportButtons";
import { OwnerSectionHead, OwnerStatTile, ownerPaper, ownerStack, ownerGrid } from "@/components/owner/ownerUi";

export default function SaasAnalyticsDashboard({ lang }) {
  const ar = lang === "ar";
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    base44.functions.invoke("subscriptionOverview", {})
      .then((response) => setData(response.data))
      .catch(() => setError(true));
  }, []);

  const summary = data?.summary;
  const metrics = summary ? [
    [ar ? "إجمالي الشركات" : "Total companies", summary.totalCompanies, "ok"],
    [ar ? "الاشتراكات النشطة" : "Active subscriptions", summary.activeSubscriptions, "ok"],
    [ar ? "المجمّدة" : "Frozen", summary.frozen || 0, summary.frozen ? "warn" : "mute"],
    [ar ? "التجريبية" : "Trials", summary.trialing, "mute"],
    [ar ? "المنتهية" : "Expired", summary.expired || 0, summary.expired ? "bad" : "mute"],
    [ar ? "الإيراد الشهري MRR" : "Monthly revenue MRR", `$${summary.mrr ?? 0}`, "ok"],
    [ar ? "الإيراد السنوي ARR" : "Annual revenue ARR", `$${summary.arr ?? 0}`, "ok"],
    [ar ? "النشطون اليوم" : "Active today", summary.activeUsersToday || 0, "mute"],
  ] : [];

  return (
    <div style={ownerStack}>
      <OwnerSectionHead
        kicker="NiroVera SaaS"
        title={ar ? "مركز أداء المنصة" : "Platform performance center"}
        meta={summary ? (
          <OwnerExportButtons
            filename="powercare_owner_analytics"
            title={ar ? "ملخص أداء المنصة" : "Platform performance summary"}
            headers={[ar ? "المؤشر" : "Metric", ar ? "القيمة" : "Value"]}
            rows={metrics.map(([label, value]) => [label, value])}
            ar={ar}
          />
        ) : null}
      />
      <p style={{ margin: 0, fontSize: 13, color: "var(--nv-muted)", lineHeight: 1.7 }}>
        {ar ? "متابعة النمو والاشتراكات والإيرادات وزوار الموقع." : "Track growth, subscriptions, revenue, and website visitors."}
      </p>

      {!data && !error ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "28px 0" }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--nv-accent)" }} />
        </div>
      ) : null}
      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--nv-bad-ink)" }}>
          {ar ? "تعذر تحميل تحليلات المنصة." : "Couldn't load platform analytics."}
        </p>
      ) : null}

      {summary ? (
        <>
          <div style={ownerGrid}>
            {metrics.map(([label, value, state]) => (
              <OwnerStatTile key={label} label={label} value={value} state={state} />
            ))}
          </div>
          <SubscriberAnalytics data={data} ar={ar} />
          {data.latestFeedback?.length > 0 ? (
            <div style={{ ...ownerStack, gap: 10 }}>
              <OwnerSectionHead title={ar ? "آخر التقييمات" : "Latest feedback"} />
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {data.latestFeedback.map((item) => (
                  <div key={item.id} style={{ ...ownerPaper("mute"), padding: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--nv-accent)" }}>{item.rating}/5</p>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.65 }}>{item.message || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      <VisitorStatsCard lang={lang} />
    </div>
  );
}
