import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { PieChart as PieIcon, TrendingUp } from "lucide-react";
import { DEFAULT_SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";
import { OWNER_MONO, OwnerCard } from "@/components/owner/ownerUi";

const PLAN_COLORS = {
  free: "#B9C6BE",
  starter: "#5FA27A",
  professional: "#1F5C3A",
  enterprise: "#C8A45A",
  custom: "#5A6B85",
};

/** Arabic/English display name for a plan key as stored on an account ("Enterprise", "enterprise", …). */
export function planLabel(plan, ar) {
  const key = String(plan || "Free").toLowerCase();
  const row = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === key || String(p.nameEn).toLowerCase() === key);
  if (row) return ar ? row.nameAr : row.nameEn;
  if (key === "custom") return ar ? "مخصّصة" : "Custom";
  return plan || "—";
}

function monthLabel(month, ar) {
  const [y, m] = String(month || "").split("-").map(Number);
  if (!y || !m) return month;
  try {
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(ar ? "ar-SA-u-ca-gregory" : "en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  } catch {
    return month;
  }
}

export default function SubscriberAnalytics({ data, ar }) {
  const summary = data?.summary;
  if (!summary) return null;

  const rows = [...(data.subscriptions || []), ...(data.companiesWithoutSubscription || [])];
  const planCounts = {};
  rows.forEach((row) => {
    const key = String(row.plan || "Free").toLowerCase();
    planCounts[key] = (planCounts[key] || 0) + 1;
  });
  const planData = Object.entries(planCounts).map(([key, value]) => ({ key, name: planLabel(key, ar), value }));
  const total = planData.reduce((sum, row) => sum + row.value, 0);

  // a single month draws a lone dot — pad back to six months so growth reads as a line
  const raw = data.growth || [];
  const byMonth = new Map(raw.map((row) => [row.month, row.count]));
  const last = raw.length ? raw[raw.length - 1].month : new Date().toISOString().slice(0, 7);
  const [ly, lm] = last.split("-").map(Number);
  const growth = [];
  let running = 0;
  const before = raw.filter((row) => {
    const [y, m] = row.month.split("-").map(Number);
    return (y * 12 + m) <= (ly * 12 + lm - 6);
  }).reduce((sum, row) => sum + row.count, 0);
  running = before;
  for (let i = 5; i >= 0; i -= 1) {
    const idx = ly * 12 + (lm - 1) - i;
    const month = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
    const added = byMonth.get(month) || 0;
    running += added;
    growth.push({ month: monthLabel(month, ar), added, total: running });
  }

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)" }} data-owner-split="">
      <OwnerCard title={ar ? "نمو الشركات — آخر 6 أشهر" : "Company growth — last 6 months"} icon={TrendingUp}>
        <div style={{ height: 230, direction: "ltr" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="nvOwnerGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2F7A4D" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2F7A4D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--nv-line)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--nv-muted)" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--nv-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid var(--nv-line)", fontSize: 12, direction: ar ? "rtl" : "ltr" }}
                formatter={(value, name) => [value, name === "total" ? (ar ? "إجمالي الشركات" : "Total companies") : (ar ? "جديدة" : "New")]}
              />
              <Area type="monotone" dataKey="total" stroke="#2F7A4D" strokeWidth={2.4} fill="url(#nvOwnerGrowth)" dot={{ r: 3, fill: "#2F7A4D", strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </OwnerCard>

      <OwnerCard title={ar ? "توزيع الباقات" : "Plan distribution"} icon={PieIcon}>
        <div style={{ position: "relative", height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={planData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={planData.length > 1 ? 3 : 0} stroke="none">
                {planData.map((row) => <Cell key={row.key} fill={PLAN_COLORS[row.key] || "#5A6B85"} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--nv-line)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <strong style={{ ...OWNER_MONO, fontSize: 24, color: "var(--nv-ink)" }}>{total}</strong>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "شركة" : "companies"}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {planData.map((row) => (
            <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: PLAN_COLORS[row.key] || "#5A6B85", flexShrink: 0 }} />
              <span style={{ flex: 1, color: "var(--nv-ink2)" }}>{row.name}</span>
              <strong style={OWNER_MONO}>{row.value}</strong>
              <span style={{ color: "var(--nv-muted)", fontSize: 11.5, minWidth: 38, textAlign: "end" }}>{total ? Math.round((row.value / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </OwnerCard>
    </div>
  );
}
