import React from "react";
import { Check, Pencil, Power, Trash2 } from "lucide-react";
import { OWNER_MONO, ownerGhostBtn, ownerPaper, ownerStatusChip } from "@/components/owner/ownerUi";

export default function PlanCard({ plan, ar, onEdit, onToggle, onDelete }) {
  const name = ar ? plan.nameAr : plan.nameEn;
  const featured = plan.slug === "professional";
  const features = (ar ? plan.featuresAr : plan.featuresEn) || [];
  const unlimited = "∞";
  return (
    <article
      style={{
        ...ownerPaper(),
        position: "relative",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: plan.active ? 1 : 0.7,
        borderColor: featured ? "#C8A45A" : "var(--nv-line)",
        boxShadow: featured ? "0 10px 30px rgba(200,164,90,.16)" : undefined,
      }}
    >
      {featured ? (
        <span style={{ position: "absolute", top: -11, insetInlineStart: 18, background: "#C8A45A", color: "#1E1606", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999 }}>
          {ar ? "الأكثر طلبًا" : "Most popular"}
        </span>
      ) : null}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="nv-h" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--nv-ink)" }}>{name}</h3>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--nv-muted)", ...OWNER_MONO }}>{plan.slug}</p>
        </div>
        <span style={ownerStatusChip(plan.active ? "ok" : "mute")}>
          {plan.active ? (ar ? "مفعّلة" : "Active") : (ar ? "متوقفة" : "Inactive")}
        </span>
      </div>

      <div>
        <div dir="ltr" style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: ar ? "flex-end" : "flex-start" }}>
          <span style={{ ...OWNER_MONO, fontSize: 34, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1 }}>${plan.monthlyPrice}</span>
          <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>/ {ar ? "شهر" : "mo"}</span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--nv-muted)" }}>
          {ar ? "أو" : "or"} <strong dir="ltr" style={{ color: "var(--nv-ink2)" }}>${plan.yearlyPrice}</strong> {ar ? "سنويًا" : "yearly"}
          {plan.freeNow ? <span style={{ ...ownerStatusChip("warn"), marginInlineStart: 8, padding: "1px 8px", fontSize: 10.5 }}>{ar ? "مجانية حاليًا" : "Free for now"}</span> : null}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          [ar ? "الفروع" : "Stations", plan.maxStations ?? unlimited],
          [ar ? "الموظفون" : "Employees", plan.maxEmployees ?? unlimited],
          [ar ? "الأقسام" : "Sections", (plan.enabledSections || []).length],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "var(--nv-soft)", borderRadius: 9, padding: "8px 10px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: 10.5, color: "var(--nv-muted)" }}>{label}</span>
            <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{value}</strong>
          </div>
        ))}
      </div>

      {features.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
          {features.map((feature) => (
            <li key={feature} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--nv-ink2)" }}>
              <Check size={14} style={{ color: "var(--nv-accent)", flexShrink: 0 }} /> {feature}
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--nv-line)" }}>
        <button type="button" onClick={onEdit} style={{ ...ownerGhostBtn(), flex: 1 }}><Pencil className="h-4 w-4" /> {ar ? "تعديل" : "Edit"}</button>
        <button type="button" onClick={onToggle} style={ownerGhostBtn()} title={plan.active ? (ar ? "إيقاف" : "Deactivate") : (ar ? "تفعيل" : "Activate")}><Power className="h-4 w-4" /></button>
        <button type="button" onClick={onDelete} style={{ ...ownerGhostBtn(), color: "var(--nv-bad-ink)", borderColor: "var(--nv-bad-line)" }} title={ar ? "حذف" : "Delete"}><Trash2 className="h-4 w-4" /></button>
      </div>
    </article>
  );
}
