import React from "react";
import { announceRamadanLength, announceRamadanStart } from "@/lib/store";
import { ramadanAnnouncementOf, ramadanWindowForYear } from "@/lib/ummAlQuraCalendar";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { toast } from "@/components/ui/use-toast";

const NAVY = "#14213d";
const MUTED = "#6b7280";
const LINE = "#dfe3ea";

function startShiftLabel(shift, ar) {
  if (shift === -1) return ar ? "يوماً قبل أم القرى" : "one day before Umm al-Qura";
  if (shift === 1) return ar ? "يوماً بعد أم القرى" : "one day after Umm al-Qura";
  return ar ? "كما في أم القرى" : "as predicted by Umm al-Qura";
}

export default function LaborCalendarCard({
  companyId,
  laborCalendar,
  year,
  canEdit = false,
  ar = true,
  onSaved,
}) {
  const y = Number(year) || new Date().getFullYear();
  const win = ramadanWindowForYear(y);
  const status = ramadanAnnouncementOf(y, laborCalendar);
  const announceStart = (shift) => {
    if (!companyId || !canEdit) return;
    const result = announceRamadanStart(companyId, y, shift, { by: "company" });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({
      description: ar
        ? `ثُبِت 1 رمضان ${y} في ${result.ramadanFrom} — ${startShiftLabel(shift, true)}.`
        : `1 Ramadan ${y} is recorded as ${result.ramadanFrom}.`,
    });
    onSaved?.();
  };
  const announce = (length) => {
    if (!companyId || !canEdit) return;
    const result = announceRamadanLength(companyId, y, length, { by: "company" });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({
      description: ar
        ? `ثُبِت رمضان ${y} على ${length} يوماً — اليوم الأخير ${status.day30 && length === 29 ? "صار أول أيام الفطر" : "يوم 30 رمضان"}.`
        : `Ramadan ${y} is recorded as ${length} days.`,
    });
    onSaved?.();
  };

  return (
    <section style={{ background: "#fff", border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "تقويم أم القرى — رمضان والأعياد" : "Umm al-Qura — Ramadan and Eids"}</span>
        <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
          {ar
            ? "أم القرى تتوقع 1 رمضان. الرؤية أحياناً تقدّمه أو تؤخره يوماً — سجّل البداية بعد الثبوت. الأيام 1–29 تُقفل بعدها. اليوم 30 لا يُخمَّن: يُعلَن 29 أو 30، ثم يُقفل الفطر من اليوم التالي لآخر يوم."
            : "Umm al-Qura predicts 1 Ramadan. Sighting may move it one day earlier or later — record the start after it is confirmed. Days 1–29 then lock. Day 30 is never guessed: announce 29 or 30, then Eid al-Fitr locks from the day after the last Ramadan day."}
        </span>
        <LaborArticleCite ruleId="hours.ramadan.ordinaryHours" ar={ar} showText />
        <LaborArticleCite ruleId="leave.eid.cite" ar={ar} showText />
      </div>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!win ? (
          <span style={{ fontSize: 12, color: MUTED }}>{ar ? `لا نافذة مرمّزة لرمضان ${y}.` : `No encoded Ramadan window for ${y}.`}</span>
        ) : (
          <>
            <span style={{ fontSize: 12, color: NAVY, lineHeight: 1.8 }}>
              {ar
                ? `توقع أم القرى لـ 1 رمضان ${y}: ${status.predictedFrom}. البداية المعتمدة: ${status.from}. اليوم 30 المحتمل: ${status.day30}.`
                : `Umm al-Qura 1 Ramadan ${y}: ${status.predictedFrom}. Recorded start: ${status.from}. Provisional day 30: ${status.day30}.`}
            </span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
              {status.startPending
                ? (ar ? "البداية لم تُعلن — اليوم السابق لتوقع أم القرى يُعامل رمضان حمايةً حتى تُسجَّل الرؤية: يوماً قبل، أو كما هي، أو يوماً بعد." : "Start not announced — the day before the Umm al-Qura prediction is treated as Ramadan until the sighting is recorded: one day early, as predicted, or one day late.")
                : (ar ? `البداية معلنة: ${status.from} (${startShiftLabel(status.startShift, true)}).` : `Start announced: ${status.from} (${startShiftLabel(status.startShift, false)}).`)}
            </span>
            {canEdit && status.startPending ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => announceStart(-1)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 12px", border: `1px solid ${LINE}`, background: "#fff", color: NAVY, cursor: "pointer" }}>
                  {ar ? "بدأ يوماً قبل" : "Started one day early"}
                </button>
                <button type="button" onClick={() => announceStart(0)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 12px", border: `1px solid ${LINE}`, background: "#fff", color: NAVY, cursor: "pointer" }}>
                  {ar ? "كما في أم القرى" : "As Umm al-Qura"}
                </button>
                <button type="button" onClick={() => announceStart(1)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 12px", border: `1px solid ${LINE}`, background: "#fff", color: NAVY, cursor: "pointer" }}>
                  {ar ? "بدأ يوماً بعد" : "Started one day late"}
                </button>
              </div>
            ) : null}
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
              {status.pending
                ? (ar ? "الطول لم يُعلن — الأيام 1–29 رمضان، واليوم 30 يُعامل رمضان حمايةً حتى الإعلان." : "Length not announced — days 1–29 are Ramadan; day 30 is treated as Ramadan to protect the worker until announced.")
                : (ar ? `الطول معلن: ${status.length} يوماً. آخر يوم رمضان: ${status.lastDay}.` : `Length announced: ${status.length} days. Last Ramadan day: ${status.lastDay}.`)}
            </span>
            {canEdit && status.pending ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => announce(29)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 12px", border: `1px solid ${LINE}`, background: "#fff", color: NAVY, cursor: "pointer" }}>
                  {ar ? "أعلن 29 يوماً" : "Announce 29 days"}
                </button>
                <button type="button" onClick={() => announce(30)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 12px", border: `1px solid ${LINE}`, background: "#fff", color: NAVY, cursor: "pointer" }}>
                  {ar ? "أعلن 30 يوماً" : "Announce 30 days"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
