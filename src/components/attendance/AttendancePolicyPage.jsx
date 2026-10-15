import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations } from "@/lib/permissions";
import { DutyBoard, DutyHeadline, DutyNumber, DutyTile, DutyTiles } from "@/components/schedules/DutyTiles";
import { ManageDutySideAuto, useManageDutyWeek } from "@/components/schedules/ManageDutySide";
import { dutyTone } from "@/components/schedules/dutyStatus";
import AttendanceSettingsBoard from "@/components/attendance/AttendanceSettingsBoard";
import AttendanceLocationsPanel from "@/components/attendance/AttendanceLocationsPanel";

/**
 * «السياسة والمواقع» (الإدارة) — the same skeleton as every duty page:
 * one full-width column (policy + hours law, then branch points). No tiles and no side column:
 * every figure here is already the heading of its own form below.
 */
export default function AttendancePolicyPage({ company, currentUser, t, lang = "ar", canEditSettings = false }) {
  const ar = lang === "ar";
  const { data } = useAuth();
  const [policy, setPolicy] = useState(null);
  const week = useManageDutyWeek({ ar });
  const stations = useMemo(() => visibleStations(currentUser, data), [currentUser, data]);
  const placed = stations.filter((station) => station.lat != null && station.lng != null).length;
  const published = week.pub?.kind === "published" || week.pub?.kind === "implicit";
  const locationOn = policy ? policy.gps_enabled === true : null;

  return (
    <>

      <DutyBoard
        main={(
          <>
            <AttendanceSettingsBoard company={company} currentUser={currentUser} t={t} canEditSettings={canEditSettings} onSettings={setPolicy} />
            <AttendanceLocationsPanel t={t} lang={lang} />
          </>
        )}
      />
    </>
  );
}
