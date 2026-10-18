import React from "react";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";

/**
 * «أنظمة الوزارة — ما يخص صوت الموظف» — the shared frame (lib/ministrySections, section «voice»).
 * `lane` «employee» reads the worker's own voices and cases; «manage» the queue HR runs.
 * `abuseCases` — the harassment / abuse cases this viewer may see; `calendar` skips official holidays.
 */
export default function VoiceLawPanel({ ar, lane = "employee", breached = 0, abuseCases = [], calendar, today }) {
  const day = today || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  return (
    <MinistrySectionPanel
      sectionKey="voice"
      lane={lane}
      ar={ar}
      today={day}
      inputs={{ breached, abuseCases, calendar }}
    />
  );
}
