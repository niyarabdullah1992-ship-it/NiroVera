import React from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { DutyBoard } from "@/components/schedules/DutyTiles";
import AttendanceSettingsBoard from "@/components/attendance/AttendanceSettingsBoard";
import AttendanceLocationsPanel from "@/components/attendance/AttendanceLocationsPanel";

/**
 * «السياسة والمواقع» (الإدارة) — the same skeleton as every duty page:
 * one full-width column (policy, then branch points). The Art. 17 posting lives with the roster (WorkPostingSetting). No tiles and no side column.
 */
export default function AttendancePolicyPage({ company, currentUser, t, lang = "ar", canEditSettings = false }) {
  return (
    <DutyBoard
      main={(
        <>
          <AttendanceSettingsBoard company={company} currentUser={currentUser} t={t} canEditSettings={canEditSettings} />
          <AttendanceLocationsPanel t={t} lang={lang} />
        </>
      )}
    />
  );
}
