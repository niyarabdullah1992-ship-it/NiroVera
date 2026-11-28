import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Wallet,
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
import { OwnerCard, ownerPaper, ownerStatusChip } from "@/components/owner/ownerUi";
import { currencyLabel } from "@/lib/subscriptionPlans";

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
    [ar ? "الإيراد الشهري MRR" : "MRR", `${summary.mrr ?? 0} ${currencyLabel("SAR", ar)}`],
    [ar ? "الإيراد السنوي ARR" : "ARR", `${summary.arr ?? 0} ${currencyLabel("SAR", ar)}`],
  ];

  const quick = [
    { icon: Plus, label: ar ? "إنشاء شركة" : "New company", hint: ar ? "حساب جديد بمالكه وباقته" : "Account, owner and plan", tab: "companies" },
    { icon: Users, label: ar ? "إدارة المشتركين" : "Manage subscribers", hint: ar ? "تمديد، تجميد، ترقية" : "Extend, freeze, upgrade", tab: "subscribers" },
    { icon: Layers, label: ar ? "الباقات والأسعار" : "Plans & pricing", hint: ar ? "الأسعار والحدود والميزات" : "Prices, limits, features", tab: "plans" },
    { icon: Megaphone, label: ar ? "إرسال خبر" : "Broadcast news", hint: ar ? "إعلان لكل الشركات" : "Announce to all companies", tab: "news" },
  ];

  const fmtNum = (n) => Number(n || 0).toLocaleString("en-US");
  const today = new Date().toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const heroStats = [
    { label: ar ? "الشركات المسجلة" : "Companies", value: summary.totalCompanies, tab: "companies" },
    { label: ar ? "اشتراكات نشطة" : "Active", value: summary.activeSubscriptions, tab: "subscribers", note: ar ? `${summary.trialing || 0} تجريبي` : `${summary.trialing || 0} trial` },
    { label: ar ? "تحتاج انتباهك" : "Need attention", value: attention, tab: "subscribers", alert: attention > 0 },
  ];

  return (
    <>
      <section data-owner-hero="" style={hero}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{today}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#C8A45A", display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Wallet size={15} /> {ar ? "الإيراد الشهري المتكرر" : "Monthly recurring revenue"}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 48, fontWeight: 600, color: "#fff", lineHeight: 1.05 }}>{fmtNum(summary.mrr)}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,.75)" }}>{currencyLabel("SAR", ar)}</span>
          </div>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.62)" }}>
            {ar ? `سنويًا ${fmtNum(summary.arr)} ر.س · قبل ضريبة القيمة المضافة` : `${fmtNum(summary.arr)} SAR yearly · before VAT`}
          </span>
        </div>
        <div data-owner-hero-stats="" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", alignSelf: "stretch", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 14 }}>
          {heroStats.map((item, index) => (
            <button key={item.label} type="button" onClick={go(item.tab)} data-owner-hero-stat="" style={{ ...heroStat, borderInlineStart: index ? "1px solid rgba(255,255,255,.09)" : "none" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.62)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                {item.alert ? <span style={{ width: 7, height: 7, borderRadius: 99, background: "#F87171" }} /> : null}
                {item.label}
              </span>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 30, fontWeight: 600, color: "#fff", lineHeight: 1 }}>{fmtNum(item.value)}</span>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)", minHeight: 16 }}>{item.note || (item.alert ? (ar ? `${summary.frozen || 0} مجمّدة · ${summary.expired || 0} منتهية` : `${summary.frozen || 0} frozen · ${summary.expired || 0} expired`) : "")}</span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {quick.map((item) => (
          <button key={item.tab} type="button" data-owner="quick" onClick={go(item.tab)} style={quickBtn}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--nv-accent-soft)", color: "var(--nv-accent-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <item.icon size={18} />
            </span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{item.label}</span>
              <span style={{ fontSize: 11.5, color: "var(--nv-muted)", fontWeight: 500 }}>{item.hint}</span>
            </span>
            <Arrow size={15} style={{ color: "var(--nv-muted)" }} />
          </button>
        ))}
      </div>

      <SubscriberAnalytics data={data} ar={ar} />

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: endingSoon.length ? "minmax(0, 2fr) minmax(260px, 1fr)" : "minmax(0, 1fr)", alignItems: "start" }} data-owner-split="">
        <OwnerCard padding={0} style={{ gap: 0 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 20px" }}>
            <h3 className="nv-h" style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Users size={16} style={{ color: "var(--nv-accent)" }} />
              {ar ? "أحدث المشتركين" : "Latest subscribers"}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <OwnerExportButtons
                compact
                filename="powercare_owner_analytics"
                title={ar ? "ملخص أداء المنصة" : "Platform performance summary"}
                headers={[ar ? "المؤشر" : "Metric", ar ? "القيمة" : "Value"]}
                rows={exportRows}
                ar={ar}
              />
              <button type="button" onClick={go("subscribers")} style={linkBtn}>
                {ar ? "عرض الكل" : "View all"} <Arrow size={14} />
              </button>
            </div>
          </header>
          {rows.length === 0 ? (
            <p style={{ margin: 0, padding: "8px 20px 22px", fontSize: 13, color: "var(--nv-muted)" }}>{ar ? "لا مشتركين بعد." : "No subscribers yet."}</p>
          ) : (
            <div>
              <div data-owner-sub-grid="" style={{ ...subGrid, padding: "8px 20px", background: "var(--nv-soft)", borderTop: "1px solid var(--nv-line)", fontSize: 11.5, fontWeight: 600, color: "var(--nv-muted)" }}>
                <span>{ar ? "الشركة" : "Company"}</span>
                <span>{ar ? "الباقة" : "Plan"}</span>
                <span>{ar ? "المتبقي" : "Left"}</span>
                <span>{ar ? "الحالة" : "Status"}</span>
              </div>
              {rows.slice(0, 6).map((row, index) => {
                const [tone, text] = statusOf(row, ar);
                return (
                  <div data-owner-sub-grid="" key={row.accountId || row.id || index} style={{ ...subGrid, padding: "12px 20px", borderTop: "1px solid var(--nv-line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--nv-accent-soft)", color: "var(--nv-accent-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                        {String(row.companyName || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.companyName || "—"}</p>
                        <p style={{ margin: 0, fontSize: 11.5, color: "var(--nv-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.email || "—"}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12.5, color: "var(--nv-ink2)", fontWeight: 600 }}>{planLabel(row.plan, ar)}</span>
                    <span style={{ fontSize: 12.5, color: "var(--nv-muted)" }}>{row.daysLeft == null ? "—" : (ar ? `${row.daysLeft} يوم` : `${row.daysLeft}d`)}</span>
                    <span style={ownerStatusChip(tone)}>{text}</span>
                  </div>
                );
              })}
            </div>
          )}
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
        [data-owner="quick"]:hover { border-color: var(--nv-accent-border) !important; transform: translateY(-1px); box-shadow: 0 8px 22px rgba(16,40,28,.08) !important; }
        [data-owner-hero-stat]:hover { background: rgba(255,255,255,.05) !important; }
        @media (max-width: 960px) {
          [data-owner-hero] { grid-template-columns: 1fr !important; padding: 22px !important; }
          [data-owner-sub-grid] { grid-template-columns: minmax(0, 1fr) auto !important; }
          [data-owner-sub-grid] > :nth-child(2), [data-owner-sub-grid] > :nth-child(3) { display: none; }
        }
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

const hero = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.25fr)",
  gap: 28,
  alignItems: "center",
  padding: "26px 28px",
  borderRadius: 18,
  color: "#fff",
  background: "radial-gradient(120% 140% at 0% 0%, rgba(200,164,90,.22) 0%, rgba(200,164,90,0) 45%), linear-gradient(135deg, #0A2418 0%, #11382A 100%)",
  boxShadow: "0 14px 36px rgba(10,36,24,.18)",
};

const heroStat = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 10,
  padding: "18px 20px",
  background: "transparent",
  border: "none",
  color: "inherit",
  fontFamily: "inherit",
  textAlign: "start",
  cursor: "pointer",
  transition: "background .15s ease",
};

const subGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 120px 90px 100px",
  alignItems: "center",
  gap: 14,
};

const quickBtn = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  boxShadow: "0 1px 2px rgba(16,40,28,.04)",
  border: "1px solid var(--nv-line)",
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  textAlign: "start",
  cursor: "pointer",
  transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
};
