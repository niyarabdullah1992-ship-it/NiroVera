import React from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { OWNER_MONO, ownerPaper } from "@/components/owner/ownerUi";

export default function RoadmapScorecard({ ar }) {
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <div style={{ ...ownerPaper("ok"), padding: 16 }}>
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--nv-ok-soft)", color: "var(--nv-ok-ink)", border: "1px solid var(--nv-ok-line)" }}>
            {ar ? "جاهزية التشغيل" : "Operational readiness"}
          </span>
          <ShieldCheck className="h-5 w-5" style={{ color: "var(--nv-accent)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
          <strong dir="ltr" style={{ ...OWNER_MONO, fontSize: 42, fontWeight: 500, color: "var(--nv-ink)", lineHeight: 1 }}>8.5</strong>
          <span style={{ paddingBottom: 4, fontSize: 13, color: "var(--nv-muted)" }}>/ 10</span>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.65, color: "var(--nv-muted)" }}>
          {ar ? "القدرات الأساسية مكتملة، والتركيز الحالي على الموثوقية والتشغيل الفعلي." : "Core capabilities are delivered; the current focus is reliability and live operations."}
        </p>
      </div>
      <div style={{ ...ownerPaper("mute"), padding: 16, background: "var(--nv-navy)", borderColor: "var(--nv-navy)", color: "#fff" }}>
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", color: "var(--nv-accent)" }}>
            {ar ? "شمولية المنصة" : "Platform coverage"}
          </span>
          <Sparkles className="h-5 w-5" style={{ color: "var(--nv-accent)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
          <strong dir="ltr" style={{ ...OWNER_MONO, fontSize: 42, fontWeight: 500, lineHeight: 1 }}>9</strong>
          <span style={{ paddingBottom: 4, fontSize: 13, opacity: 0.55 }}>/ 10</span>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.65, opacity: 0.7 }}>
          {ar ? "تغطية مؤسسية واسعة تشمل التشغيل والموارد والمالية والأمن والمستندات." : "Broad enterprise coverage across operations, people, finance, security, and documents."}
        </p>
      </div>
    </div>
  );
}
