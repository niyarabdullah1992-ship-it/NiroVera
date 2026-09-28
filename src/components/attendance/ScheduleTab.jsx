import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations, canManageSchedule } from "@/lib/permissions";
import StationScheduleEditor from "@/components/schedules/StationScheduleEditor";
import { Radio } from "lucide-react";
import { ACCENT, MUTED, NAVY, SURFACE, CARD } from "@/lib/platformStyles";

/** Monthly station shift schedule — Platform matrix chrome lives in StationScheduleEditor. */
export default function ScheduleTab({ preferredStationId = null, hidePickerWhenScoped = false }) {
  const { t, lang } = useI18n();
  const { data, company, currentUser } = useAuth();
  const [selectedStation, setSelectedStation] = useState(preferredStationId || null);
  const ar = lang === "ar";

  useEffect(() => {
    if (preferredStationId) setSelectedStation(preferredStationId);
  }, [preferredStationId]);

  if (!data || !currentUser) return null;
  const stations = visibleStations(currentUser, data);

  if (!selectedStation) {
    // The scoped host already names this gate above the matrix — repeating it
    // here printed the same blocking reason twice.
    if (hidePickerWhenScoped) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>{t("manageScheduleNote")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(214px,1fr))", gap: 10 }}>
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedStation(s.id)}
              style={{
                borderRadius: 13,
                border: "1px solid var(--nv-line)",
                background: CARD,
                padding: "14px 16px",
                textAlign: "start",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 1px 0 var(--nv-line)",
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--nv-accent-soft)",
                  color: ACCENT,
                  flexShrink: 0,
                }}
              >
                <Radio style={{ width: 16, height: 16 }} strokeWidth={1.75} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY }}>{s.name}</span>
                <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 3 }}>{t("monthlySchedule")}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const station = data.stations.find((s) => s.id === selectedStation);
  const canManage = canManageSchedule(currentUser, data, selectedStation);

  return (
    <div>
      {!preferredStationId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 12,
            marginBottom: 4,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--nv-line)",
            background: SURFACE,
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedStation(null)}
            style={{
              border: "1px solid var(--nv-line)",
              background: CARD,
              color: MUTED,
              borderRadius: 9,
              height: 32,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {ar ? "← الفروع" : "← Stations"}
          </button>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: NAVY, textAlign: "center" }}>
            {station?.name}
          </div>
        </div>
      )}
      <StationScheduleEditor companyId={company.id} stationId={selectedStation} canManage={canManage} />
    </div>
  );
}
