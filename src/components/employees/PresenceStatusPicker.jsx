import React from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { setPresenceStatus } from "@/lib/store";
import { isStatutoryOffDay } from "@/lib/leaveTypes";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import useAttendancePresence from "@/hooks/useAttendancePresence";

export const PRESENCE_OPTIONS = [
  { key: "online", labelKey: "presenceOnline", dot: "bg-emerald-500" },
  { key: "away", labelKey: "presenceAway", dot: "bg-amber-500" },
  { key: "busy", labelKey: "presenceBusy", dot: "bg-red-500" },
  { key: "call", labelKey: "presenceInCall", dot: "bg-violet-500" },
];

// Lets the employee manually set their own presence status. Automatically
// overridden to "On Leave" (read-only) if they have an approved leave today.
export default function PresenceStatusPicker({ user }) {
  const { t, lang } = useI18n();
  const { company, data } = useAuth();
  const onLeave = !!isStatutoryOffDay(user, new Date(), laborCalendarOf(data));
  const attendance = useAttendancePresence(user?.id);
  const current = PRESENCE_OPTIONS.find((o) => o.key === user.presenceStatus) || PRESENCE_OPTIONS[0];
  const checkedIn = !!attendance?.check_in_at && !attendance?.check_out_at;
  const inZone = attendance?.in_zone === true || attendance?.inZone === true || attendance?.location_status === "inside";
  const attendanceDot = checkedIn && inZone ? "bg-emerald-500" : checkedIn ? "bg-amber-500" : "bg-slate-400";

  if (onLeave) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted text-xs font-body">
        <span className="w-2 h-2 rounded-full bg-sky-500" /> {t("onLeaveStatus")}
      </span>
    );
  }

  if (!checkedIn) {
    const label = attendance?.check_out_at
      ? (lang === "ar" ? "تم تسجيل الانصراف" : "Checked out")
      : (lang === "ar" ? "لم يسجل الحضور" : "Not checked in");
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-body text-sky-700">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> {lang === "ar" ? "متصل بالموقع الإلكتروني" : "Online on website"}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-body text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-slate-400" /> {label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-body text-sky-700">
        <span className="h-2 w-2 rounded-full bg-sky-500" /> {lang === "ar" ? "متصل بالموقع الإلكتروني" : "Online on website"}
      </span>
      <span className={`w-2 h-2 rounded-full ${attendanceDot}`} />
      <select
        value={current.key}
        onChange={(e) => setPresenceStatus(company.id, user.id, e.target.value)}
        className="px-2.5 py-1.5 rounded-full border border-border text-xs font-body bg-card"
      >
        {PRESENCE_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>{t(o.labelKey)}</option>
        ))}
      </select>
    </div>
  );
}