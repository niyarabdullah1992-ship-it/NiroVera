import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Layers,
  Loader2,
  Megaphone,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import SubscriberAnalytics, { planLabel } from "@/components/owner/SubscriberAnalytics";
import VisitorStatsCard from "@/components/owner/VisitorStatsCard";
import OwnerExportButtons from "@/components/owner/OwnerExportButtons";
import { OwnerCard, OwnerKpi, ownerPaper, ownerStatusChip } from "@/components/owner/ownerUi";

function statusOf(row, ar) {
  if (row.frozen) return ["bad", ar ? "مجمّد" : "Frozen"];
  if (row.status === "exempt") return ["mute", ar ? "معفى" : "Exempt"];
  if (row.status === "active" || row.status === "manual_active") return ["ok", ar ? "نشط" : "Active"];
  if (row.status === "trialing") return ["warn", ar ? "تجريبي" : "Trial"];
  if (row.status === "past_due" || row.status === "unpaid") return ["warn", ar ? "متأخر الدفع" : "Past due"];
  return ["mute", ar ? "بلا اشتراك" : "No plan"];
}

export default function SaasAnalyticsDashboard({ lang, onTab }) {
  const ar = lang === "ar";
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    base44.functions.invoke("subscriptionOverview", {})
      .then((response) => setData(response.data))
      .catch(() => setError(true));
  }, []);

  const go = (tab) => (onTab ? () => onTab(tab) : undefined);
  const summary = data?.summary;
  const Arrow = ar ? ArrowLeft : ArrowRight;

  if (!data && !error) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--nv-accent)" }} />
      </div>
    );
  }
  if (error || !summary) {
    return (
      <OwnerCard>
        <p style={{ margin: 0, fontSize: 13, color: "var(--nv-bad-ink)" }}>{ar ? "تعذر تحميل تحليلات المنصة." : "Couldn't load platform analytics."}</p>
      </OwnerCard>
    );
  }

  const rows = [...(data.subscriptions || []), ...(data.companiesWithoutSubscription || [])];
  const attention = (summary.frozen || 0) + (summary.expired || 0) + (summary.pastDue || 0);
  const endingSoon = rows.filter((row) => row.daysLeft != null && row.daysLeft >= 0 && row.daysLeft <= 14);

  const exportRows = [
    [ar ? "إجمالي الشركات" : "Total companies", summary.totalCompanies],
    [ar ? "الاشتراكات النشطة" : "Active subscriptions", summary.activeSubscriptions],
    [ar ? "المجمّدة" : "Frozen", summary.frozen || 0],
    [ar ? "التجريبية" : "Trials", summary.trialing || 0],
    [ar ? "المنتهية" : "Expired", summary.expired || 0],
    [ar ? "الإيراد الشهري MRR" : "MRR", `$${summary.mrr ?? 0}`],
    [ar ? "الإيراد السنوي ARR" : "ARR", `$${summary.arr ?? 0}`],
  ];

  const quick = [
    { icon: Plus, label: ar ? "إنشاء شركة" : "New company", tab: "companies" },
    { icon: Users, label: ar ? "إدارة المشتركين" : "Manage subscribers", tab: "subscribers" },
    { icon: Layers, label: ar ? "الباقات والأسعار" : "Plans & pricing", tab: "plans" },
    { icon: Megaphone, label: ar ? "إرسال خبر للمشتركين" : "Broadcast news", tab: "news" },
  ];

  return (
    <>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <OwnerKpi big icon={CircleDollarSign} tone="gold" label={ar ? "الإيراد الشهري (MRR)" : "Monthly revenue (MRR)"} value={`$${summary.mrr ?? 0}`} sub={ar ? `سنويًا $${summary.arr ?? 0}` : `$${summary.arr ?? 0} annually`} />
        <OwnerKpi big icon={Building2} tone="ok" label={ar ? "الشركات المسجلة" : "Registered companies"} value={summary.totalCompanies} sub={ar ? "اضغط لإدارتها" : "Open to manage"} onClick={go("companies")} />
        <OwnerKpi big icon={Users} tone="ok" label={ar ? "اشتراكات نشطة" : "Active subscriptions"} value={summary.activeSubscriptions} sub={ar ? `${summary.trialing || 0} تجريبي` : `${summary.trialing || 0} trialing`} onClick={go("subscribers")} />
        <OwnerKpi big icon={AlertTriangle} tone={attention ? "bad" : "mute"} label={ar ? "تحتاج انتباهك" : "Need attention"} value={attention} sub={attention ? (ar ? `${summary.frozen || 0} مجمّدة · ${summary.expired || 0} منتهية` : `${summary.frozen || 0} frozen · ${summary.expired || 0} expired`) : (ar ? "كل الاشتراكات سليمة" : "All subscriptions healthy")} onClick={go("subscribers")} />
      </div>

      <SubscriberAnalytics data={data} ar={ar} />

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", alignItems: "start" }} data-owner-split="">
        <OwnerCard padding={0} style={{ gap: 0 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 18px 12px" }}>
            <h3 className="nv-h" style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Users size={16} style={{ color: "var(--nv-accent)" }} />
              {ar ? "المشتركون" : "Subscribers"}
            </h3>
            <button type="button" onClick={go("subscribers")} style={linkBtn}>
              {ar ? "عرض الكل" : "View all"} <Arrow size={14} />
            </button>
          </header>
          {rows.length === 0 ? (
            <p style={{ margin: 0, padding: "8px 18px 20px", fontSize: 13, color: "var(--nv-muted)" }}>{ar ? "لا مشتركين بعد." : "No subscribers yet."}</p>
          ) : (
            <div>
              {rows.slice(0, 6).map((row, index) => {
                const [tone, text] = statusOf(row, ar);
                return (
                  <div key={row.accountId || row.id || index} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: 14, padding: "12px 18px", borderTop: "1px solid var(--nv-line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--nv-accent-soft)", color: "var(--nv-accent-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                        {String(row.companyName || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.companyName || "—"}</p>
                        <p style={{ margin: 0, fontSize: 11.5, color: "var(--nv-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.email || "—"}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12.5, color: "var(--nv-ink2)", fontWeight: 600 }}>{planLabel(row.plan, ar)}</span>
                    <span style={ownerStatusChip(tone)}>{text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </OwnerCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <OwnerCard title={ar ? "إجراءات سريعة" : "Quick actions"}>
            <div style={{ display: "grid", gap: 8 }}>
              {quick.map((item) => (
                <button key={item.tab} type="button" data-owner="quick" onClick={go(item.tab)} style={quickBtn}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--nv-accent-soft)", color: "var(--nv-accent-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <item.icon size={15} />
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <Arrow size={14} style={{ color: "var(--nv-muted)" }} />
                </button>
              ))}
            </div>
            <OwnerExportButtons
              filename="powercare_owner_analytics"
              title={ar ? "ملخص أداء المنصة" : "Platform performance summary"}
              headers={[ar ? "المؤشر" : "Metric", ar ? "القيمة" : "Value"]}
              rows={exportRows}
              ar={ar}
            />
          </OwnerCard>
          {endingSoon.length ? (
            <OwnerCard title={ar ? "تنتهي قريبًا" : "Ending soon"} icon={CalendarClock}>
              {endingSoon.slice(0, 5).map((row, index) => (
                <div key={row.accountId || index} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{row.companyName}</span>
                  <span style={ownerStatusChip(row.daysLeft <= 3 ? "bad" : "warn")}>{ar ? `${row.daysLeft} يوم` : `${row.daysLeft}d`}</span>
                </div>
              ))}
            </OwnerCard>
          ) : null}
        </div>
      </div>

      {data.latestFeedback?.length > 0 ? (
        <OwnerCard title={ar ? "آخر التقييمات" : "Latest feedback"} icon={TrendingUp}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {data.latestFeedback.map((item) => (
              <div key={item.id} style={{ ...ownerPaper(), padding: 12, boxShadow: "none" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#B08A3A" }}>{"★".repeat(Math.round(item.rating || 0))} <span style={{ color: "var(--nv-muted)", fontWeight: 500 }}>{item.rating}/5</span></p>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.65 }}>{item.message || "—"}</p>
              </div>
            ))}
          </div>
        </OwnerCard>
      ) : null}

      <VisitorStatsCard lang={lang} />

      <style>{`
        [data-owner="quick"]:hover { border-color: var(--nv-accent-border) !important; background: var(--nv-accent-soft) !important; }
      `}</style>
    </>
  );
}

const linkBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  border: "none",
  background: "transparent",
  color: "var(--nv-accent-deep)",
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
  padding: 0,
};

const quickBtn = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--nv-line)",
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  textAlign: "start",
  cursor: "pointer",
  transition: "background .15s ease, border-color .15s ease",
};
