import React from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { useOrgTerms } from "@/hooks/useOrgTerms";
import { INK, MUTED } from "@/lib/platformStyles";

/**
 * States whose view the command center is showing — plain meta, not toggles.
 * Persona derives from role/position; facility type is locked at signup.
 */
export default function DashboardPersonaBar({ lang = "ar", onGreen = false }) {
  const ar = lang === "ar";
  const { currentUser, data } = useAuth();
  const { terms } = useOrgTerms();

  const role = currentUser?.role || "employee";
  const persona = (() => {
    if (role === "employee") return "employee";
    if (["station_manager", "pgm"].includes(role)) return "manager";
    if (currentUser?.hrLevelId || role === "ops_manager") return "hr";
    if (["director", "owner"].includes(role) || currentUser?.id === data?.ownerId) return "executive";
    return "hr";
  })();

  const PERSONA_LABEL = {
    employee: { ar: "موظف", en: "Employee" },
    manager: { ar: "مدير مباشر", en: "Line manager" },
    hr: { ar: "موارد بشرية", en: "HR" },
    executive: { ar: "تنفيذي", en: "Executive" },
  };
  const label = PERSONA_LABEL[persona];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, color: onGreen ? "#A9CDB8" : MUTED }}>{ar ? "العرض بصلاحية" : "Viewing as"}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: onGreen ? "#fff" : INK, lineHeight: 1.35 }}>
        {ar ? label.ar : label.en}
        <span style={{ fontWeight: 400, color: onGreen ? "#C5DBCD" : MUTED }}> · {ar ? "شركة" : terms.orgKindShort}</span>
      </span>
    </div>
  );
}
