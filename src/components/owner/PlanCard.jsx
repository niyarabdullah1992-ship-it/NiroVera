import React from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import { OWNER_MONO, ownerGhostBtn, ownerPaper } from "@/components/owner/ownerUi";

function statusChip(active, ar) {
  return {
    display: "inline-flex",
    width: "fit-content",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 9px",
    borderRadius: 999,
    color: active ? "var(--nv-ok-ink)" : "var(--nv-mute-ink)",
    background: active ? "var(--nv-ok-soft)" : "var(--nv-mute-soft)",
    border: `1px solid ${active ? "var(--nv-ok-line)" : "var(--nv-mute-line)"}`,
  };
}

export default function PlanCard({ plan, ar, onEdit, onToggle, onDelete }) {
  const name = ar ? plan.nameAr : plan.nameEn;
  return (
    <article style={{ ...ownerPaper(plan.active ? "ok" : "mute"), padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="nv-h" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" }}>{name}</h3>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--nv-muted)", ...OWNER_MONO }}>{plan.slug}</p>
        </div>
        <span style={statusChip(plan.active, ar)}>
          {plan.active ? (ar ? "مفعّلة" : "Active") : (ar ? "متوقفة" : "Inactive")}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--nv-ink)" }}>
        <strong>{plan.monthlyPrice} {plan.currency}</strong> / {ar ? "شهر" : "month"} · <strong>{plan.yearlyPrice} {plan.currency}</strong> / {ar ? "سنة" : "year"}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.65 }}>
        {ar ? "الفروع" : "Stations"}: {plan.maxStations ?? (ar ? "غير محدود" : "Unlimited")} · {ar ? "الموظفون" : "Employees"}: {plan.maxEmployees ?? (ar ? "غير محدود" : "Unlimited")} · {(plan.enabledSections || []).length} {ar ? "قسم" : "sections"}
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={onEdit} style={ownerGhostBtn()} title={ar ? "تعديل" : "Edit"}><Pencil className="h-4 w-4" /></button>
        <button type="button" onClick={onToggle} style={ownerGhostBtn()} title={ar ? "تفعيل أو إيقاف" : "Toggle"}><Power className="h-4 w-4" /></button>
        <button type="button" onClick={onDelete} style={{ ...ownerGhostBtn(), color: "var(--nv-bad-ink)", borderColor: "var(--nv-bad-line)" }} title={ar ? "حذف" : "Delete"}><Trash2 className="h-4 w-4" /></button>
      </div>
    </article>
  );
}
