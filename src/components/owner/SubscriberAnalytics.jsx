import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, TrendingUp } from "lucide-react";
import { OWNER_MONO, OwnerSectionHead, ownerPaper, ownerStack } from "@/components/owner/ownerUi";

const PLAN_COLORS = {
  Free: "var(--nv-mute-fill)",
  Starter: "var(--nv-accent)",
  Professional: "var(--nv-navy)",
  Enterprise: "#0F1F3A",
  Custom: "#5A6B85",
};

export default function SubscriberAnalytics({ data, ar }) {
  const summary = data?.summary;
  if (!summary) return null;

  const rows = [...(data.subscriptions || []), ...(data.companiesWithoutSubscription || [])];
  const planCounts = {};
  rows.forEach((row) => {
    const plan = row.plan || "Free";
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });
  const planData = Object.entries(planCounts).map(([name, value]) => ({ name, value }));
  const growth = data.growth || [];

  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <div style={{ ...ownerPaper("ok"), padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6 }}>
        <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--nv-soft)", color: "var(--nv-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <DollarSign className="w-5 h-5" />
        </span>
        <p dir="ltr" style={{ ...OWNER_MONO, margin: 0, fontSize: 32, fontWeight: 500, color: "var(--nv-ink)", lineHeight: 1.05 }}>${summary.mrr ?? 0}</p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--nv-muted)" }}>
          {ar ? "الإيراد الشهري المتكرر (MRR)" : "Monthly Recurring Revenue (MRR)"}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)" }}>
          {ar ? `${summary.activeSubscriptions} اشتراك نشط` : `${summary.activeSubscriptions} active subscriptions`}
        </p>
      </div>

      <div style={{ ...ownerPaper("mute"), padding: 16, ...ownerStack, gap: 8 }}>
        <OwnerSectionHead title={ar ? "توزيع الباقات" : "Plan distribution"} />
        <div style={{ height: 176 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={planData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3}>
                {planData.map((row) => <Cell key={row.name} fill={PLAN_COLORS[row.name] || "#5A6B85"} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", justifyContent: "center", fontSize: 11, color: "var(--nv-ink2)" }}>
          {planData.map((row) => (
            <span key={row.name} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: PLAN_COLORS[row.name] || "#5A6B85" }} />
              {row.name}: <strong>{row.value}</strong>
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...ownerPaper("mute"), padding: 16, ...ownerStack, gap: 8 }}>
        <OwnerSectionHead
          title={(
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <TrendingUp className="w-4 h-4" style={{ color: "var(--nv-accent)" }} />
              {ar ? "نمو الشركات (شهريًا)" : "Company growth (monthly)"}
            </span>
          )}
        />
        <div style={{ height: 208 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growth} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--nv-line)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--nv-muted)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--nv-muted)" }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="var(--nv-navy)" strokeWidth={2} dot={{ r: 3, fill: "var(--nv-accent)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
