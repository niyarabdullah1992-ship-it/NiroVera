import React from "react";
import { Clock3 } from "lucide-react";
import { OWNER_MONO, ownerPaper } from "@/components/owner/ownerUi";

const duration = (seconds, ar) => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${Math.round(value)} ${ar ? "ث" : "sec"}`;
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  return `${minutes} ${ar ? "د" : "min"}${rest ? ` ${rest} ${ar ? "ث" : "sec"}` : ""}`;
};

export default function VisitorDurationPanel({ stats, ar }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--nv-muted)" }}>
          <Clock3 className="h-3.5 w-3.5" />
          {ar ? "مدة الزيارات" : "Visit duration"}
        </p>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--nv-ink)" }}>
          {ar ? "المتوسط" : "Average"}: {duration(stats.averageVisitSeconds, ar)}
        </p>
      </div>
      <div style={{ ...ownerPaper("mute"), overflow: "auto", padding: 0 }}>
        <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--nv-soft)", color: "var(--nv-muted)", textAlign: "start" }}>
              <th style={{ padding: "8px 12px", fontWeight: 600 }}>{ar ? "التاريخ" : "Date"}</th>
              <th style={{ padding: "8px 12px", fontWeight: 600 }}>{ar ? "الدولة" : "Country"}</th>
              <th style={{ padding: "8px 12px", fontWeight: 600 }}>{ar ? "الجهاز" : "Device"}</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "end" }}>{ar ? "المدة" : "Duration"}</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentVisits?.map((visit) => (
              <tr key={visit.id} style={{ borderTop: "1px solid var(--nv-line)", color: "var(--nv-ink)" }}>
                <td style={{ padding: "8px 12px" }}>
                  {new Date(visit.createdAt).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {visit.country || (ar ? "غير معروف" : "Unknown")}
                  {visit.city ? ` — ${visit.city}` : ""}
                </td>
                <td style={{ padding: "8px 12px" }}>{visit.device || "—"}</td>
                <td style={{ ...OWNER_MONO, padding: "8px 12px", textAlign: "end", fontWeight: 600 }}>
                  {duration(visit.durationSeconds, ar)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
