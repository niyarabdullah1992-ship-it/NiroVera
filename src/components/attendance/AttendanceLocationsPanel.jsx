import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany } from "@/lib/store";
import { canManageStations, visibleStations } from "@/lib/permissions";
import useStationScope from "@/hooks/useStationScope";
import StationLocationEditor from "@/components/stations/StationLocationEditor";
import { ACCENT, BORDER, MUTED, NAVY, OK, SURFACE, WARN } from "@/lib/platformStyles";

const sectionHead = { fontSize: 13, fontWeight: 600, color: NAVY, margin: 0 };

export default function AttendanceLocationsPanel({ t, lang = "ar" }) {
  const ar = lang === "ar";
  const { company, currentUser, data } = useAuth();
  const headerScope = useStationScope();
  const [editingId, setEditingId] = useState("");

  const stations = useMemo(() => visibleStations(currentUser, data), [currentUser, data]);

  useEffect(() => {
    if (!stations.length) return;
    const scoped = headerScope && headerScope !== "all"
      ? stations.find((station) => String(station.id) === String(headerScope))
      : null;
    setEditingId((prev) => {
      if (prev && stations.some((station) => String(station.id) === String(prev))) return prev;
      return String(scoped?.id || stations[0].id);
    });
  }, [headerScope, stations]);

  const saveLocation = (id, coords) => {
    if (!company?.id) return;
    updateCompany(company.id, (draft) => {
      const station = (draft.stations || []).find((row) => row.id === id);
      if (station) {
        station.lat = coords.lat;
        station.lng = coords.lng;
        station.radiusMeters = coords.radiusMeters;
      }
    });
  };

  const canEdit = (station) =>
    canManageStations(currentUser, data)
    || station.managerId === currentUser?.id
    || currentUser?.stationId === station.id;

  return (
    <section className="nv-att-card" style={{ background: "var(--nv-card, #fff)", border: `1px solid ${BORDER}`, overflow: "hidden" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <p style={{ ...sectionHead, fontSize: 15, fontWeight: 700 }}>
          {ar ? "مواقع الحضور" : "Attendance locations"}
          {stations.length ? (
            <span style={{ fontWeight: 500, color: MUTED, marginInlineStart: 8 }}>
              {ar ? `· ${stations.length} فروع` : `· ${stations.length} stations`}
            </span>
          ) : null}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
          {ar
            ? "لكل فرع قسم موقع ونطاق مستقل. النطاق في الأعلى لا يخفي الفروع من هنا."
            : "Each station has its own point and range. Header scope does not hide stations here."}
        </p>
      </div>
      {stations.length === 0 ? (
        <p style={{ margin: 0, padding: "16px 20px", fontSize: 12, color: MUTED }}>
          {ar ? "لا توجد فروع ظاهرة في صلاحيتك." : "No stations in your permission."}
        </p>
      ) : (
        stations.map((station) => {
          const hasLocation = station.lat != null && station.lng != null;
          const on = String(editingId) === String(station.id);
          const scoped = headerScope && headerScope !== "all" && String(headerScope) === String(station.id);
          return (
            <section key={station.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <button
                type="button"
                onClick={() => setEditingId(String(station.id))}
                aria-expanded={on}
                style={{
                  fontFamily: "inherit",
                  textAlign: "start",
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "13px 20px",
                  border: "none",
                  borderInlineEnd: `3px solid ${on ? ACCENT : "transparent"}`,
                  background: on ? SURFACE : "transparent",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 12,
                  alignItems: "baseline",
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: on ? 700 : 600, color: NAVY }} dir="auto">
                    {station.name}
                    {scoped ? (
                      <span style={{ fontWeight: 500, color: MUTED, marginInlineStart: 8, fontSize: 11 }}>
                        {ar ? "النطاق الحالي" : "Current scope"}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: 11, color: MUTED }}>
                    {hasLocation
                      ? (ar ? "نقطة ونطاق محفوظان" : "Point and range saved")
                      : (ar ? "بلا نقطة — حدّد الموقع" : "No point — set the location")}
                  </span>
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
                  {hasLocation ? `${station.radiusMeters || 200} ${ar ? "م" : "m"}` : "—"}
                </span>
              </button>
              {on ? (
                <div style={{ padding: "14px 20px 16px", background: SURFACE }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    {hasLocation ? (
                      <span style={OK}>
                        <CheckCircle2 style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} />
                        {" "}{t("locationSet")}
                      </span>
                    ) : (
                      <span style={WARN}>
                        <AlertTriangle style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} />
                        {" "}{t("locationNotSet")}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: MUTED, marginInlineStart: "auto" }}>
                      <MapPin style={{ width: 11, height: 11, display: "inline", verticalAlign: "middle" }} />
                      {" "}{ar ? "اضغط الخريطة لنقل النقطة" : "Click the map to move the point"}
                    </span>
                  </div>
                  {canEdit(station) ? (
                    <StationLocationEditor
                      key={station.id}
                      inline
                      t={t}
                      station={station}
                      onSave={(coords) => saveLocation(station.id, coords)}
                      onCancel={() => {}}
                    />
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                      {ar ? "عرض فقط — تعديل الموقع يحتاج صلاحية إدارة الفروع." : "View only — changing the point needs station-manage permission."}
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          );
        })
      )}
      {stations.length ? (
        <div style={{ padding: "13px 20px" }}>
          <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
            {ar
              ? "تغيير الموقع لا يسري بأثر رجعي على أيام مضت."
              : "Changing the location does not rewrite past days."}
          </span>
        </div>
      ) : null}
    </section>
  );
}
