import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { DEFAULT_SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NV";
  return parts.slice(0, 2).map((part) => part[0]).join("");
}

/**
 * Owner board chrome from owner-board.dc.html: dark rail, gold page edge, live figures.
 */
export default function OwnerBoardFrame({
  ar,
  user,
  sections,
  tab,
  onTab,
  companies,
  refreshing,
  onRefresh,
  onLogout,
  onOpenApp,
  children,
}) {
  const [summary, setSummary] = useState(null);
  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((row) => row.slug === "professional");
  const current = sections.find((section) => section.value === tab) || sections[0];

  useEffect(() => {
    let live = true;
    base44.functions.invoke("subscriptionOverview", {})
      .then((response) => { if (live) setSummary(response.data?.summary || null); })
      .catch(() => { if (live) setSummary(null); });
    return () => { live = false; };
  }, [refreshing, companies.length]);

  const mrr = summary?.mrr == null ? "—" : String(summary.mrr);
  const active = summary?.activeSubscriptions ?? companies.length;
  const overdue = summary?.expired ?? "—";

  return (
    <div data-owner="frame" dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "208px minmax(0, 1fr)", background: "#F4F7F5", color: "#111418" }}>
      <style>{`
        @media (max-width: 860px) {
          [data-owner="frame"] { grid-template-columns: 1fr !important; }
          [data-owner="rail"] { position: relative !important; height: auto !important; }
          [data-owner="stats"] { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      <aside data-owner="rail" style={{ background: "#0B2A1C", color: "#E6EFE9", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 0, height: "100vh", boxSizing: "border-box", overflow: "auto" }}>
        <div>
          <strong style={{ display: "block", color: "#fff", fontSize: 14 }}>نيروفيرا</strong>
          <span style={{ fontSize: 10.5, color: "#A9CDB8" }}>{ar ? "لوحة المالك · /owner" : "Owner board · /owner"}</span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.12)" }}>
          {sections.map((section) => {
            const on = section.value === tab;
            return (
              <button
                key={section.value}
                type="button"
                onClick={() => onTab(section.value)}
                style={{
                  textAlign: "start",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: on ? "rgba(255,255,255,.12)" : "transparent",
                  color: on ? "#fff" : "#A9CDB8",
                  fontWeight: on ? 700 : 500,
                  fontSize: 13,
                }}
              >
                {section.label}
              </button>
            );
          })}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.12)" }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#C8A45A", color: "#111418", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{initials(user?.name || user?.email)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ display: "block", fontSize: 12, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || user?.email}</strong>
            <span style={{ fontSize: 10, color: "#A9CDB8" }}>{ar ? "مالك المنصة" : "Platform owner"}</span>
          </div>
          <button type="button" onClick={onLogout} style={{ fontSize: 11, color: "#F3C8CF", background: "transparent", border: "1px solid rgba(255,255,255,.18)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>{ar ? "خروج" : "Out"}</button>
        </div>
        <div style={{ marginTop: "auto", padding: 12, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}>
          <span style={{ fontSize: 10.5, color: "#A9CDB8" }}>{ar ? "الإيراد الشهري المتكرّر" : "Monthly recurring revenue"}</span>
          <strong style={{ display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, color: "#fff", direction: "ltr" }}>{mrr} <span style={{ fontSize: 11, color: "#A9CDB8" }}>USD</span></strong>
        </div>
      </aside>

      <main style={{ padding: "20px 24px 48px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        <section style={{ background: "#fff", border: "1px solid #E4E9E6", borderInlineStart: "4px solid #C8A45A", borderRadius: 12, padding: "14px 18px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "#2F6B43", fontWeight: 600 }}>
            <span style={{ width: 12, height: 2, background: "#C8A45A", borderRadius: 2 }} />
            {ar ? "مالك المنصة" : "Platform owner"}
          </span>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>{current?.label}</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#555C66" }}>{current?.hint}</p>
            </div>
            <div data-owner="stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(96px, auto))", gap: 8 }}>
              {[
                [ar ? "الإيراد الشهري" : "Monthly revenue", mrr, "USD"],
                [ar ? "شركات نشطة" : "Active companies", active, ar ? "شركة" : "co."],
                [ar ? "منتهية" : "Expired", overdue, ar ? "اشتراك" : "sub."],
                [ar ? "الباقة الاحترافية" : "Professional plan", plan?.monthlyPrice ?? "—", `${plan?.currency || ""} / ${ar ? "شهر" : "mo"}`],
              ].map(([label, value, unit]) => (
                <div key={label} style={{ padding: "8px 12px", borderRadius: 8, background: "#F5F7F6", border: "1px solid #E4E9E6" }}>
                  <span style={{ display: "block", fontSize: 10.5, color: "#555C66" }}>{label}</span>
                  <strong style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17 }}>{value}</strong>
                  <span style={{ fontSize: 10, color: "#555C66", marginInlineStart: 4 }}>{unit}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" onClick={onOpenApp} style={chip}>{ar ? "منصة الشركة" : "Company app"}</button>
            <button type="button" onClick={onRefresh} disabled={refreshing} style={chip}>{ar ? "تحديث" : "Refresh"}</button>
            {["subscribers", "plans", "invoices", "audit", "news"].map((value) => {
              const section = sections.find((row) => row.value === value);
              if (!section) return null;
              const filled = value === "news";
              return (
                <button key={value} type="button" onClick={() => onTab(value)} style={filled ? chipFill : chip}>{section.label}</button>
              );
            })}
          </div>
        </section>
        {children}
      </main>
    </div>
  );
}

const chip = {
  height: 28,
  padding: "0 11px",
  borderRadius: 999,
  border: "1px solid #E4E9E6",
  background: "#fff",
  color: "#111418",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
};

const chipFill = {
  ...chip,
  background: "#0B3D27",
  color: "#fff",
  border: "none",
};
