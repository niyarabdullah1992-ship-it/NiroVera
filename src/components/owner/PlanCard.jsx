import React from "react";
import { Check, Pencil, Power, Trash2 } from "lucide-react";
import { OWNER_MONO, ownerGhostBtn, ownerPaper, ownerStatusChip } from "@/components/owner/ownerUi";
import { currencyLabel } from "@/lib/subscriptionPlans";

const GOLD = "#C8A45A";

export default function PlanCard({ plan, ar, allFree = false, onEdit, onToggle, onDelete }) {
  const name = ar ? plan.nameAr : plan.nameEn;
  const featured = plan.slug === "professional";
  const features = (ar ? plan.featuresAr : plan.featuresEn) || [];
  const unlimited = "∞";
  // the featured plan reads dark-green with gold, the rest stay on paper
  const c = featured
    ? { ink: "#fff", ink2: "rgba(255,255,255,.82)", muted: "rgba(255,255,255,.55)", tile: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.12)", check: GOLD }
    : { ink: "var(--nv-ink)", ink2: "var(--nv-ink2)", muted: "var(--nv-muted)", tile: "var(--nv-soft)", line: "var(--nv-line)", check: "var(--nv-accent)" };
  const ghost = featured
    ? { ...ownerGhostBtn(), background: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.16)", color: "#fff" }
    : ownerGhostBtn();
  const yearlySaving = plan.monthlyPrice > 0 ? Math.round((1 - plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100) : 0;
  return (
    <article
      style={{
        ...ownerPaper(),
        position: "relative",
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity: plan.active ? 1 : 0.7,
        borderRadius: 18,
        ...(featured ? {
          background: "radial-gradient(120% 90% at 100% 0%, rgba(200,164,90,.22) 0%, rgba(200,164,90,0) 55%), linear-gradient(160deg, #0A2418 0%, #12402A 100%)",
          border: `1px solid ${GOLD}`,
          boxShadow: "0 18px 40px rgba(10,36,24,.22)",
          color: "#fff",
        } : {}),
      }}
    >
      {featured ? (
        <span style={{ position: "absolute", top: -12, insetInlineStart: 20, background: GOLD, color: "#1E1606", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 999, boxShadow: "0 4px 12px rgba(200,164,90,.35)" }}>
          {ar ? "الأكثر طلبًا" : "Most popular"}
        </span>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h3 className="nv-h" style={{ margin: 0, fontSize: 19, fontWeight: 800, color: c.ink }}>{name}</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {plan.freeNow && !allFree ? <span style={ownerStatusChip("warn")}>{ar ? "مجانية حاليًا" : "Free now"}</span> : null}
          {!plan.active ? <span style={ownerStatusChip("mute")}>{ar ? "متوقفة" : "Inactive"}</span> : null}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ ...OWNER_MONO, fontSize: 40, fontWeight: 700, color: c.ink, lineHeight: 1 }}>{Number(plan.monthlyPrice || 0).toLocaleString("en-US")}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: featured ? GOLD : c.ink2 }}>{currencyLabel(plan.currency, ar)}</span>
          <span style={{ fontSize: 12.5, color: c.muted }}>/ {ar ? "شهريًا" : "month"}</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: c.muted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {plan.monthlyPrice > 0 ? (
            <>
              <span>{ar ? "أو" : "or"} <strong style={{ color: c.ink2 }}>{Number(plan.yearlyPrice || 0).toLocaleString("en-US")} {currencyLabel(plan.currency, ar)}</strong> {ar ? "سنويًا" : "yearly"}</span>
              {yearlySaving > 0 ? <span style={{ fontSize: 11, fontWeight: 700, color: featured ? GOLD : "var(--nv-accent-deep)" }}>{ar ? `وفّر ${yearlySaving}%` : `save ${yearlySaving}%`}</span> : null}
            </>
          ) : (
            <span>{ar ? "مجانية دائمًا" : "Always free"}</span>
          )}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          [ar ? "الفروع" : "Stations", plan.maxStations ?? unlimited],
          [ar ? "الموظفون" : "Employees", plan.maxEmployees ?? unlimited],
          [ar ? "الأقسام" : "Sections", (plan.enabledSections || []).length],
        ].map(([label, value]) => (
          <div key={label} style={{ background: c.tile, borderRadius: 11, padding: "10px 8px", textAlign: "center" }}>
            <strong style={{ display: "block", fontSize: 17, color: c.ink }}>{value}</strong>
            <span style={{ display: "block", fontSize: 11, color: c.muted, marginTop: 2 }}>{label}</span>
          </div>
        ))}
      </div>

      {features.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
          {features.map((feature) => (
            <li key={feature} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: c.ink2 }}>
              <span style={{ width: 18, height: 18, borderRadius: 99, background: featured ? "rgba(200,164,90,.18)" : "var(--nv-accent-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Check size={11} strokeWidth={3} style={{ color: c.check }} />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 14, borderTop: `1px solid ${c.line}` }}>
        <button type="button" onClick={onEdit} style={{ ...ghost, flex: 1 }}><Pencil className="h-4 w-4" /> {ar ? "تعديل" : "Edit"}</button>
        <button type="button" onClick={onToggle} style={ghost} title={plan.active ? (ar ? "إيقاف" : "Deactivate") : (ar ? "تفعيل" : "Activate")}><Power className="h-4 w-4" /></button>
        <button type="button" onClick={onDelete} style={{ ...ghost, color: featured ? "#FCA5A5" : "var(--nv-bad-ink)", borderColor: featured ? "rgba(252,165,165,.35)" : "var(--nv-bad-line)" }} title={ar ? "حذف" : "Delete"}><Trash2 className="h-4 w-4" /></button>
      </div>
    </article>
  );
}
