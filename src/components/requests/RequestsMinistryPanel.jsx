import React from "react";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";

/**
 * «أنظمة الوزارة — ما يخص طلباتي» (employee) / «ما يخص الطلبات» (management) — the shared frame
 * (lib/ministrySections, section «requests», built on requestsMinistryRows). Hours, rest, overtime and
 * the night / sun roster stay in «أنظمة الوزارة — ما يخص الدوام».
 *   employee — a rule the request form runs is «مستوفٍ»; its pill says متاح / بانتظار قرار / معتمد
 *   manage   — summed over `people` in scope; a rule with a request awaiting decision is «تنبيه»
 */
export default function RequestsMinistryPanel({ ar = true, lang = "ar", subject, people = [], lane = "employee", liveArticle = "", liveKind = "", fileMode = false, today }) {
  const day = today || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  return (
    <MinistrySectionPanel
      sectionKey="requests"
      lane={lane}
      ar={ar}
      today={day}
      inputs={{ subject, people, liveArticle, liveKind, lang, fileMode }}
    />
  );
}
