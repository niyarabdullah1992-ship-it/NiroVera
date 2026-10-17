import React from "react";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/**
 * «أنظمة الوزارة — ما يخص نهاية الخدمة» — under the end-of-service case (management), and read only
 * on the leaving worker's own file (`self`). The board passes its own award and comp figures so the
 * panel and the settlement read the same numbers.
 */
export default function OffboardingLawPanel({ employee, caseRow = null, eos = null, comp = null, ar = true, self = false, today }) {
  return (
    <MinistrySectionPanel
      sectionKey="offboarding"
      lane={self ? "employee" : "manage"}
      ar={ar}
      today={today || todayIso()}
      inputs={{ employee, caseRow, eos, comp }}
    />
  );
}
