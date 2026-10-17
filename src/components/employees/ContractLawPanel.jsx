import React from "react";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";

/** «أنظمة الوزارة — ما يخص العقد» — under the contract card in the employee file. Read only. */
export default function ContractLawPanel({ employee, ar = true, today, lane = "employee" }) {
  const day = today || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  return <MinistrySectionPanel sectionKey="contract" lane={lane} ar={ar} today={day} inputs={{ employee }} />;
}
