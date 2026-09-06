import React from "react";
import { Camera, FileSignature, MapPin, ShieldAlert, ShieldCheck } from "lucide-react";
import ProofCardsSummary from "@/components/proof/ProofCardsSummary";
import IdentityCard from "@/components/shared/IdentityCard";
import { ACCENT, MUTED, NAVY, num } from "@/lib/platformStyles";

export default function PublicProofReport({ info, hashMatches, ar }) {
  const items = info.payload?.items || [];
  const totalPhotos = items.reduce((sum, item) => sum + (item.photoEvidence || 0), 0);
  const onSite = items.filter((item) => item.verifiedOnSite).length;
  const fmt = (value) => (value ? new Date(value).toLocaleDateString(ar ? "ar-SA" : "en-GB") : "—");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <IdentityCard
        icon={hashMatches ? ShieldCheck : ShieldAlert}
        rail={hashMatches ? ACCENT : "#DC2626"}
        title={hashMatches ? (ar ? "إثبات عمل موثّق" : "Verified work record") : (ar ? "المحتوى لا يطابق البصمة المسجّلة" : "Content does not match the registered fingerprint")}
        subtitle={ar
          ? "بصمة SHA-256 محسوبة من محتوى هذا التقرير ومقارنة بالسجل وقت الإصدار."
          : "SHA-256 fingerprint recomputed from this report's content and compared with the registry at issue time."}
        dir={ar ? "rtl" : "ltr"}
        bodySurface
      >
        <p dir="ltr" style={{ margin: 0, wordBreak: "break-all", fontFamily: "ui-monospace, monospace", fontSize: 10, color: MUTED }}>{info.contentHash}</p>
      </IdentityCard>

      <IdentityCard kicker={info.proofId} title={info.projectName || (ar ? "تقرير أعمال" : "Work report")} dir={ar ? "rtl" : "ltr"} bodySurface>
        <div style={{ display: "grid", gap: 8, fontSize: 12, color: MUTED, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <p style={{ margin: 0 }}>{ar ? "المنفّذ" : "Contractor"}: <span style={{ color: NAVY }}>{info.companyName || "—"}</span></p>
          <p style={{ margin: 0 }}>{ar ? "العميل" : "Client"}: <span style={{ color: NAVY }}>{info.clientName || "—"}</span></p>
          <p style={{ margin: 0 }}>{ar ? "الفترة" : "Period"}: <span style={{ color: NAVY }} dir="ltr">{fmt(info.periodStart)} – {fmt(info.periodEnd)}</span></p>
          <p style={{ margin: 0 }}>{ar ? "تاريخ الإصدار" : "Issued"}: <span style={{ color: NAVY }} dir="ltr">{fmt(info.issuedAt)}</span></p>
        </div>
      </IdentityCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {[[items.length, ar ? "بنود منجزة" : "Completed items"], [totalPhotos, ar ? "أدلة مصوّرة" : "Photo evidence"], [onSite, ar ? "منفَّذة في الموقع" : "On-site verified"]].map(([value, label]) => (
          <IdentityCard key={label} title={label} dir={ar ? "rtl" : "ltr"}>
            <p style={{ margin: 0, ...num(NAVY), fontSize: 24 }}>{value}</p>
          </IdentityCard>
        ))}
      </div>

      <ProofCardsSummary cards={info.payload?.clientCards || []} ar={ar} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, index) => (
          <IdentityCard key={index} title={item.title} dir={ar ? "rtl" : "ltr"} bodySurface>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 11, color: MUTED }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin style={{ width: 12, height: 12 }} />{item.station || "—"}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Camera style={{ width: 12, height: 12 }} />{item.photoEvidence || 0}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FileSignature style={{ width: 12, height: 12 }} />{item.attestations || 0}</span>
              <span dir="ltr">{fmt(item.startDate)} → {fmt(item.endDate)}</span>
              <span>{item.completed}/{item.target}</span>
            </div>
          </IdentityCard>
        ))}
      </div>

      <p style={{ margin: 0, textAlign: "center", fontSize: 11, color: MUTED }}>
        {ar
          ? "لا يتضمن هذا التقرير أي بيانات تعريفية عن الموظفين — يعرض العمل وأدلته الميدانية فقط."
          : "This report contains no employee identifying data — only the work and its field evidence."}
      </p>
    </div>
  );
}
