import React, { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/PowerCareAuth";
import { canCreateTasks, isCompanyOwner } from "@/lib/permissions";
import useStationScope from "@/hooks/useStationScope";
import { rosterMineScopeCopy, rosterTableHeading, rosterTableStation, SW } from "@/lib/shiftWeek";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { slab } from "@/components/schedules/scheduleChrome";

const ShiftWeekBoard = lazy(() => import("@/components/schedules/ShiftWeekBoard"));

export default function ShiftsPlatformBoard({ lang = "ar", kicker, lane = "mine", employees: employeesProp, canManage = false }) {
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const headerScope = useStationScope();
  const mine = lane !== "manage";
  const table = rosterTableStation({
    lane: mine ? "mine" : "manage",
    employee: currentUser,
    headerScope,
    stations: data?.stations || [],
    fallbackStationId: currentUser?.managedStations?.[0] || data?.stations?.[0]?.id || null,
  });
  const heading = rosterTableHeading({
    lane: mine ? "mine" : "manage",
    stationName: table.stationName,
    missingWorkStation: table.missingWorkStation,
    canManage,
    ar,
  });
  const headerOther = !!(headerScope && headerScope !== "all" && table.workStationId && String(headerScope) !== String(table.workStationId));
  const mineScope = rosterMineScopeCopy({
    stationName: table.stationName,
    headerOther,
    ar,
  });
  const stationId = table.stationId;
  /** «كل الفروع» in the header still opens one branch editor — said once, under the page head. */
  const scopeNote = !mine && table.headerAll && stationId && table.stationName ? (
    <div style={{ ...slab, padding: "11px 18px", borderInlineStart: "3px solid var(--nv-warn-fill)", fontSize: 11.5, color: SW.gold, lineHeight: 1.7 }}>
      {ar
        ? `هذا محرّر فرع ${table.stationName} — النطاق «كل الفروع» لا يخلط جداول الفروع. اختر فرعاً من الهيدر لتبديل المحرر.`
        : `This is the ${table.stationName} editor — “all stations” does not mix branch weeks. Pick a station in the header to switch.`}
    </div>
  ) : null;
  const canManageRotaPolicy = !!(currentUser && data && (
    isCompanyOwner(currentUser, data)
    || ["director", "ops_manager", "station_manager"].includes(currentUser.role)
    || canCreateTasks(currentUser)
  ));
  const source = (data?.employees || []).length
    ? data.employees
    : (Array.isArray(employeesProp) && employeesProp.length ? employeesProp : (currentUser ? [currentUser] : []));
  const employees = hydrateEmployeesLeave(source, data);

  return (
    <div className="nv-ops-cal" style={{ display: "flex", flexDirection: "column", gap: 16, color: SW.ink, fontSize: 13, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }} dir={ar ? "rtl" : "ltr"}>
      {!stationId && (
        <section style={{ ...slab, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: SW.ink }}>{heading.gridTitle}</span>
          <span style={{ fontSize: 13, color: SW.mid, lineHeight: 1.8 }}>
            {heading.emptyReason
              || (ar
                ? "لا فرع محدد — لا جدول يُعرض."
                : "No branch is selected — no roster to show.")}
          </span>
        </section>
      )}

      {stationId && (
        <Suspense
          fallback={
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Loader2 style={{ width: 20, height: 20, color: SW.green }} className="animate-spin" />
            </div>
          }
        >
          <ShiftWeekBoard
            schedule={(data?.schedules || []).find((row) => String(row.stationId) === String(stationId)) || { stationId, shiftTypes: [], assignments: {} }}
            employees={employees}
            stationId={stationId}
            stationName={table.stationName}
            companyId={company?.id}
            currentUser={currentUser}
            canEdit={!mine && canManageRotaPolicy}
            mode={mine ? "mine" : "manage"}
            lang={lang}
            kicker={kicker}
            scopeNote={scopeNote}
            manageLink={null}
            gridTitle={heading.gridTitle}
            gridLead={heading.gridLead}
          />
        </Suspense>
      )}
    </div>
  );
}
