import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart3, Users, Eye, CalendarDays, MapPin, Clock3 } from "lucide-react";
import VisitorDurationPanel from "@/components/owner/VisitorDurationPanel";
import { OWNER_MONO, OwnerSectionHead, ownerInset, ownerPaper, ownerStack } from "@/components/owner/ownerUi";

export default function VisitorStatsCard({ lang }) {
  const ar = lang === "ar";
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    base44.functions
      .invoke("pageVisits", { action: "stats" })
      .then((res) => setStats(res.data))
      .catch(() => setError(true));
  }, []);

  const tiles = stats
    ? [
        { label: ar ? "زيارات اليوم" : "Visits today", value: stats.todayVisits, icon: Eye },
        { label: ar ? "زوار اليوم (فريد)" : "Unique today", value: stats.todayUnique, icon: Users },
        { label: ar ? "إجمالي الزيارات" : "Total visits", value: stats.totalVisits, icon: BarChart3 },
        { label: ar ? "إجمالي الزوار" : "Total unique", value: stats.totalUnique, icon: Users },
        { label: ar ? "متوسط زيارة اليوم" : "Today's average", value: `${Math.round((stats.todayAverageVisitSeconds || 0) / 60)} ${ar ? "د" : "min"}`, icon: Clock3 },
      ]
    : [];

  const maxDay = stats ? Math.max(1, ...stats.days.map((d) => d.visits)) : 1;

  return (
    <div style={{ ...ownerPaper("mute"), padding: 16, ...ownerStack, gap: 14 }}>
      <OwnerSectionHead
        title={(
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <BarChart3 className="w-4 h-4" />
            {ar ? "إحصائيات زوار الموقع" : "Website visitor stats"}
          </span>
        )}
      />

      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--nv-muted)" }}>{ar ? "تعذّر تحميل الإحصائيات." : "Couldn't load stats."}</p>
      ) : !stats ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--nv-muted)" }}>…</p>
      ) : (
        <div style={ownerStack}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            {tiles.map((tile) => (
              <div key={tile.label} style={{ ...ownerInset(), textAlign: "center" }}>
                <tile.icon className="w-4 h-4 mx-auto mb-1" style={{ color: "var(--nv-accent)" }} />
                <p dir="ltr" style={{ ...OWNER_MONO, margin: 0, fontSize: 22, fontWeight: 500, color: "var(--nv-ink)", lineHeight: 1 }}>{tile.value}</p>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--nv-muted)" }}>{tile.label}</p>
              </div>
            ))}
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--nv-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CalendarDays className="w-3.5 h-3.5" /> {ar ? "آخر 7 أيام" : "Last 7 days"}
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96 }}>
              {stats.days.map((day) => (
                <div key={day.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                  <span style={{ fontSize: 10, color: "var(--nv-ink2)" }}>{day.visits}</span>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div style={{ width: "100%", borderRadius: "6px 6px 0 0", background: "var(--nv-accent)", height: `${Math.max((day.visits / maxDay) * 100, 4)}%` }} />
                  </div>
                  <span style={{ fontSize: 9, color: "var(--nv-muted)" }}>{day.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--nv-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <MapPin className="w-3.5 h-3.5" /> {ar ? "مواقع الزوار" : "Visitor locations"}
            </p>
            {(!stats.locations || stats.locations.length === 0) ? (
              <p style={{ margin: 0, fontSize: 12, color: "var(--nv-muted)" }}>
                {ar ? "لا توجد بيانات مواقع بعد — ستظهر مع الزيارات الجديدة." : "No location data yet — it will appear with new visits."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {stats.locations.map((loc) => (
                  <div key={`${loc.country}-${loc.city}`} style={{ ...ownerInset(), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {loc.country}{loc.city ? ` — ${loc.city}` : ""}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)", flexShrink: 0 }}>
                      {loc.visits} {ar ? "زيارة" : "visits"} · {loc.unique} {ar ? "زائر" : "unique"} · {Math.round((loc.averageDurationSeconds || 0) / 60)} {ar ? "د" : "min"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <VisitorDurationPanel stats={stats} ar={ar} />
        </div>
      )}
    </div>
  );
}
