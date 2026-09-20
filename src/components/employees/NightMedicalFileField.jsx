import React from "react";
import { Link } from "react-router-dom";
import { nightMedicalReportOf } from "@/lib/decision18632";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import { MUTED, NAVY } from "@/lib/platformStyles";

/**
 * تنبيه only. Night-fitness upload and period live on طلباتي (لياقة ليلية).
 */
export default function NightMedicalFileField({
  employee,
  canRead = true,
  ar = true,
  compact = false,
  requestsHref = "/app/requests",
  unmet = false,
}) {
  const file = nightMedicalReportOf(employee);
  const showFiled = !!(canRead && file?.url);
  const showNotice = unmet || !file?.url;

  if (!showFiled && !showNotice) return null;

  return (
    <div
      data-night-medical-notice="1"
      style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 8, width: "100%", marginTop: compact ? 4 : 10 }}
    >
      {showFiled ? (
        <ConsentFileLink file={file} ar={ar}>
          {ar ? `افتح التقرير الطبي${file.name ? ` — ${file.name}` : ""}` : `Open the medical report${file.name ? ` — ${file.name}` : ""}`}
        </ConsentFileLink>
      ) : (
        <span style={{ fontSize: 12, color: NAVY, lineHeight: 1.7 }}>
          {ar ? "تنبيه: لا تقرير طبي مسجّل" : "Notice: no medical report is on file."}
        </span>
      )}
      <Link to={requestsHref} style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "none" }}>
        {requestsHref === "/app/requests/manage"
          ? (ar ? "افتح الطلب في إدارة طلباتي" : "Open the request in Request admin")
          : (ar ? "افتح لياقة ليلية في طلباتي" : "Open Night fitness in My Requests")}
      </Link>
      <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.7 }}>
        {ar ? "الإدارة لا ترفع تقرير اللياقة — الموظف يقدّمه من ملفي." : "Management does not file the fitness report — the worker submits it from My file."}
      </span>
    </div>
  );
}
