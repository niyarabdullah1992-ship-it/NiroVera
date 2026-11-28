import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  ExternalLink,
  Layers,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Moon,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ownerKpiCss } from "@/components/owner/ownerUi";

const ICONS = {
  glance: LayoutDashboard,
  companies: Building2,
  subscribers: Users,
  rulings: CreditCard,
  invoices: Receipt,
  plans: Layers,
  holidays: CalendarDays,
  ramadan: Moon,
  report: BarChart3,
  feedback: Star,
  audit: ShieldCheck,
  roadmap: MapIcon,
  news: Megaphone,
};

const GROUPS = [
  { ar: "الرئيسية", en: "Home", items: ["glance"] },
  { ar: "العملاء والاشتراكات", en: "Customers & billing", items: ["companies", "subscribers", "rulings", "invoices", "plans"] },
  { ar: "أحكام المنصة", en: "Platform rulings", items: ["holidays", "ramadan"] },
  { ar: "المنصة", en: "Platform", items: ["report", "feedback", "audit", "roadmap", "news"] },
];

const RAIL_BG = "#0A2418";
const GOLD = "#C8A45A";

function initials(name) {
  const parts = String(name || "").trim().split(/[\s@.]+/).filter(Boolean);
  if (!parts.length) return "NV";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

/**
 * لوحة مالك المنصة: قائمة جانبية مجمّعة بأيقونات، وشريط علوي بعنوان القسم وأدواته.
 * الأرقام تعيش داخل الأقسام نفسها — لا تكرار لها في الرأس.
 */
export default function OwnerBoardFrame({
  ar,
  user,
  sections,
  tab,
  onTab,
  refreshing,
  refreshKey,
  onRefresh,
  onLogout,
  onOpenApp,
  children,
}) {
  const [summary, setSummary] = useState(null);
  const current = sections.find((section) => section.value === tab) || sections[0];
  const byValue = new Map(sections.map((section) => [section.value, section]));

  useEffect(() => {
    let live = true;
    base44.functions.invoke("subscriptionOverview", {})
      .then((response) => { if (live) setSummary(response.data?.summary || null); })
      .catch(() => { if (live) setSummary(null); });
    return () => { live = false; };
    // refreshKey يُبصم على كل تحديث: اليدوي والتلقائي كل 30 ثانية وعند العودة إلى النافذة.
  }, [refreshKey]);

  const attention = (summary?.frozen || 0) + (summary?.expired || 0) + (summary?.pastDue || 0);
  const badges = { subscribers: attention || null };

  return (
    <div data-owner="frame" dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "256px minmax(0, 1fr)", background: "var(--nv-page, #F3F6F4)", color: "var(--nv-ink, #111418)" }}>
      <style>{`
        [data-owner="nav"] button { transition: background .15s ease, color .15s ease; }
        [data-owner="nav"] button:hover { background: rgba(255,255,255,.06); color: #fff; }
        [data-owner="nav"] button[data-on="1"] { background: rgba(255,255,255,.10); color: #fff; }
        [data-owner="tool"]:hover { border-color: var(--nv-accent-border, #B9D3C2); background: var(--nv-accent-soft, #EEF5F0); }
        [data-owner="frame"] main > [data-owner="body"] > * { animation: nvOwnerIn .22s ease both; }
        @keyframes nvOwnerIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        ${ownerKpiCss}
        @media (max-width: 960px) {
          [data-owner="frame"] { grid-template-columns: 1fr !important; }
          [data-owner="rail"] { position: relative !important; height: auto !important; padding: 12px !important; }
          [data-owner="nav"] { flex-direction: row !important; overflow-x: auto; gap: 4px !important; }
          [data-owner="nav"] [data-owner="group-label"], [data-owner="rail-foot"] { display: none !important; }
          [data-owner="nav"] button { white-space: nowrap; width: auto !important; }
          [data-owner="topbar"] { position: static !important; }
          [data-owner-split] { grid-template-columns: 1fr !important; }
          [data-owner-split] > * { position: static !important; }
        }
      `}</style>

      <aside data-owner="rail" style={{ background: `linear-gradient(180deg, ${RAIL_BG} 0%, #071A11 100%)`, color: "#D8E6DD", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 0, height: "100vh", boxSizing: "border-box", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${GOLD}, #A8843E)`, color: RAIL_BG, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17, boxShadow: "0 4px 14px rgba(200,164,90,.25)" }}>N</span>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", color: "#fff", fontSize: 15, letterSpacing: ".01em" }}>{ar ? "نيروفيرا" : "NiroVera"}</strong>
            <span style={{ fontSize: 11, color: "#8FB39D" }}>{ar ? "لوحة مالك المنصة" : "Platform owner console"}</span>
          </div>
        </div>

        <nav data-owner="nav" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {GROUPS.map((group) => (
            <div key={group.en} style={{ display: "contents" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span data-owner="group-label" style={{ fontSize: 10.5, fontWeight: 700, color: "#5F8A70", padding: "0 10px 4px", letterSpacing: ".04em" }}>{ar ? group.ar : group.en}</span>
                {group.items.map((value) => {
                  const section = byValue.get(value);
                  if (!section) return null;
                  const Icon = ICONS[value] || LayoutDashboard;
                  const on = value === tab;
                  const badge = badges[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      data-on={on ? "1" : "0"}
                      onClick={() => onTab(value)}
                      style={{
                        position: "relative",
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textAlign: "start",
                        border: "none",
                        cursor: "pointer",
                        borderRadius: 9,
                        padding: "9px 10px",
                        background: "transparent",
                        color: on ? "#fff" : "#A9C7B4",
                        fontWeight: on ? 700 : 500,
                        fontSize: 13.5,
                        fontFamily: "inherit",
                      }}
                    >
                      {on ? <span style={{ position: "absolute", insetInlineStart: -14, top: 8, bottom: 8, width: 3, borderRadius: 3, background: GOLD }} /> : null}
                      <Icon size={17} strokeWidth={on ? 2.1 : 1.8} style={{ color: on ? GOLD : "currentColor", flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{section.label}</span>
                      {badge ? <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "#B4433A", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{badge}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div data-owner="rail-foot" style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
            <span style={{ fontSize: 11, color: "#8FB39D" }}>{ar ? "الإيراد الشهري المتكرّر" : "Monthly recurring revenue"}</span>
            <strong dir="ltr" style={{ display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, color: "#fff", marginTop: 2, textAlign: ar ? "right" : "left" }}>
              ${summary?.mrr ?? 0}
            </strong>
            <span style={{ fontSize: 11, color: "#8FB39D" }}>
              {ar ? `${summary?.activeSubscriptions ?? 0} اشتراك نشط` : `${summary?.activeSubscriptions ?? 0} active`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 6px 0", borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: GOLD, color: RAIL_BG, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{initials(user?.name || user?.email)}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ display: "block", fontSize: 12.5, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || user?.email}</strong>
              <span style={{ fontSize: 11, color: "#8FB39D" }}>{ar ? "مالك المنصة" : "Platform owner"}</span>
            </div>
            <button type="button" onClick={onLogout} title={ar ? "خروج" : "Sign out"} style={{ width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#E7B5BC", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 8, cursor: "pointer" }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header data-owner="topbar" style={{ position: "sticky", top: 0, zIndex: 20, background: "color-mix(in oklab, var(--nv-page, #F3F6F4) 86%, transparent)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--nv-line, #E4E9E6)" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 11.5, color: "var(--nv-muted, #6B7480)" }}>
                {ar ? "مالك المنصة" : "Platform owner"} <span style={{ opacity: .5, margin: "0 4px" }}>/</span> {current?.label}
              </span>
              <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "var(--nv-ink, #111418)", lineHeight: 1.25 }}>{current?.label}</h1>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--nv-muted, #6B7480)" }}>{current?.hint}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" data-owner="tool" onClick={onRefresh} disabled={refreshing} title={ar ? "تحديث البيانات" : "Refresh data"} style={toolBtn}>
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                <span>{ar ? "تحديث" : "Refresh"}</span>
              </button>
              <button type="button" data-owner="tool" onClick={onOpenApp} style={toolBtn}>
                <ExternalLink size={15} />
                <span>{ar ? "منصة الشركة" : "Company app"}</span>
              </button>
            </div>
          </div>
        </header>
        <div data-owner="body" style={{ maxWidth: 1280, width: "100%", margin: "0 auto", padding: "24px 28px 56px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18 }}>
          {children}
        </div>
      </main>
    </div>
  );
}

const toolBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 36,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid var(--nv-line, #E4E9E6)",
  background: "var(--nv-card, #fff)",
  color: "var(--nv-ink, #111418)",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  transition: "background .15s ease, border-color .15s ease",
};
