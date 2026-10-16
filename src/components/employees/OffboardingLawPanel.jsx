import React, { useMemo } from "react";
import MinistryLawPanel from "@/components/schedules/MinistryLawPanel";
import { OFFBOARDING_MINISTRY_CARDS, offboardingMinistryRows } from "@/lib/offboardingMinistryRows";
import { mono } from "@/components/schedules/scheduleChrome";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/**
 * «أنظمة الوزارة — نهاية الخدمة» — under the end-of-service case (manager / HR), and read only on the
 * leaving worker's own file. Rows come from lib/offboardingMinistryRows; the board passes its own
 * award and comp figures so the panel and the settlement read the same numbers.
 */
export default function OffboardingLawPanel({ employee, caseRow = null, eos = null, comp = null, ar = true, self = false, today }) {
  const day = today || todayIso();
  const rows = useMemo(
    () => offboardingMinistryRows({ employee, caseRow, eos, comp, today: day, ar }),
    [employee, caseRow, eos, comp, day, ar],
  );
  const n = <span dir="ltr" style={mono}>{rows.length}</span>;
  return (
    <MinistryLawPanel
      ar={ar}
      dataKey="offboarding"
      title={ar ? "أنظمة الوزارة — نهاية الخدمة" : "Ministry rules — the end of service"}
      note={self
        ? (ar ? <>قراءة فقط · {n} قاعدة تحكم انتهاء خدمتك، وكل سطر يقول هل استوفتها المنشأة أو أنه للعلم.</> : <>Read only · {n} rules govern your exit; each row says whether the company has met it, or is for reference.</>)
        : (ar ? <>قراءة فقط · {n} قاعدة، والحالة من ملف الإنهاء نفسه: الإشعار والتصفية والشهادة والتذكرة.</> : <>Read only · {n} rules; status comes from the exit file itself.</>)}
      cards={OFFBOARDING_MINISTRY_CARDS(ar)}
      rows={rows}
      footer={self ? null : (ar ? "«مانع للإغلاق» يوقف إغلاق ملف إنهاء الخدمة حتى يُسجَّل — الشهادة والوثائق (64) وتذكرة العودة (م11)." : "«Blocks closing» stops the exit file until it is recorded — certificate and documents (64) and the return ticket (Art. 11).")}
    />
  );
}
