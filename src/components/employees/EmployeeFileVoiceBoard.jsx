import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import VoiceArchiveBoard from "@/components/complaints/VoiceArchiveBoard";
import { employeeVoiceArchiveCards } from "@/lib/voiceBoard";
import { defaultEscalationChain, deriveEscalationChain } from "@/lib/complaintDerivations";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";

/**
 * Settled named voice trail on the open employee file.
 * Anonymous reports never appear here.
 */
export default function EmployeeFileVoiceBoard({
  employee,
  publicReports = [],
  employees = [],
  stations = [],
  ar = true,
  canManage = false,
  chainIds = [],
}) {
  const chain = useMemo(() => {
    if (chainIds?.length) return deriveEscalationChain(chainIds, employees);
    const home = stations.find((row) => String(row.id) === String(employee?.stationId))
      || stations.find((row) => row.managerId)
      || stations[0];
    const named = employees.find((row) => String(row.id) === String(home?.managerId))?.name
      || employees.find((row) => row.role === "station_manager")?.name;
    return defaultEscalationChain(named);
  }, [chainIds, employees, stations, employee?.stationId]);

  const cards = useMemo(
    () => employeeVoiceArchiveCards({
      publicReports,
      employeeId: employee?.id,
      employees,
      stations,
      ar,
      chain,
      canManage,
    }),
    [publicReports, employee?.id, employees, stations, ar, chain, canManage],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        className="nv-paper"
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "أرشيف صوت الموظف" : "Employee voice archive"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            {ar
              ? "اقتراحاته وشكاواه المستقرّة فقط — بلاغاته المجهولة لا تُكتب على الملف."
              : "Only settled suggestions and named complaints — anonymous reports are never written on the file."}
          </span>
        </div>
        <Link
          to="/app/complaints"
          style={{
            marginInlineStart: "auto",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--nv-ok-ink)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {ar ? "صوت الموظف ←" : "Employee voice →"}
        </Link>
      </div>
      <VoiceArchiveBoard
        cards={cards}
        ar={ar}
        canManage={false}
        scope="employee"
        employeeName={employee?.name || ""}
      />
    </div>
  );
}
