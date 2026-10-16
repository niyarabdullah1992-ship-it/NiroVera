import React, { useMemo } from "react";
import MinistryLawPanel from "@/components/schedules/MinistryLawPanel";
import { CONTRACT_MINISTRY_CARDS, contractMinistryRows } from "@/lib/contractMinistryRows";

/** «أنظمة الوزارة — ما يخص العقد» — under the contract card in the employee file. Read only. */
export default function ContractLawPanel({ employee, ar = true, today }) {
  const rows = useMemo(() => contractMinistryRows(employee, { today, ar }), [employee, today, ar]);
  return (
    <MinistryLawPanel
      ar={ar}
      dataKey="contract"
      title={ar ? "أنظمة الوزارة — ما يخص العقد" : "Ministry rules — the contract"}
      cards={CONTRACT_MINISTRY_CARDS(ar)}
      rows={rows}
      footer={ar
        ? "انتهاء العقد (النموذج الموحد م57) وتذكرة العودة (م11) في «أنظمة الوزارة — نهاية الخدمة» مع ملف إنهاء الخدمة."
        : "How a contract ends (model Art. 57) and the return ticket (Art. 11) read in «Ministry rules — the end of service» with the exit file."}
    />
  );
}
