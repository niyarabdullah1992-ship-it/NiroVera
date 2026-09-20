import React from "react";
import { BellRing, CheckCircle2, Clock3, FilePlus2, MapPin, RotateCcw, Trash2, XCircle } from "lucide-react";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { DEADLINE_REFUSAL_REASON, REFUSAL_DEADLINE, signedAuditCount } from "@/lib/multiSignDerivations";

const icons = { created: FilePlus2, signed: CheckCircle2, rejected: XCircle, deleted: Trash2, retract_window: Clock3, retracted: Clock3, retract_closed: Clock3, reminder_sent: BellRing, skipped: Clock3, continued: Clock3, released: CheckCircle2, lapsed: Clock3, reopened: RotateCcw, deadline_elapsed: Clock3 };
const typeLabel = {
  created: { ar: "أُنشئ", en: "Created" },
  signed: { ar: "وقّع — وُثّق في السجل", en: "Signed — recorded" },
  rejected: { ar: "رفض", en: "Refused" },
  deleted: { ar: "حُذف", en: "Deleted" },
  retract_window: { ar: "فُتحت مهلة تراجع", en: "Retract window opened" },
  retracted: { ar: "تُراجع عن التوقيع", en: "Signature retracted" },
  retract_closed: { ar: "أُغلقت مهلة التراجع", en: "Retract window closed" },
  reminder_sent: { ar: "أُرسل تذكير", en: "Reminder sent" },
  skipped: { ar: "لم يوقّع — استمر الملف", en: "Did not sign — file continued" },
  continued: { ar: "أُمرر الملف دون الباقي", en: "File continued without the rest" },
  released: { ar: "مرّر المنشئ التوقيع — اكتمل الملف", en: "Creator released the file — signing complete" },
  lapsed: { ar: "انتهت صلاحية الرابط دون توقيع", en: "Link expired without a signature" },
  reopened: { ar: "أُعيد فتح التوقيع", en: "Signing reopened" },
  deadline_elapsed: { ar: "رفض بانتهاء المدة", en: "Refused — deadline elapsed" },
};

function eventLabel(event, ar) {
  if (event.type === "rejected" && (event.cause === REFUSAL_DEADLINE || event.reason === DEADLINE_REFUSAL_REASON)) {
    return ar ? "رفض بانتهاء المدة" : "Refused — deadline elapsed";
  }
  if (event.type === "rejected") {
    return ar ? "رفض صريح" : "Explicit refusal";
  }
  if (event.type === "continued" && event.cause === "auto_refused") {
    return ar ? "استُكمل تلقائياً بعد الرفض" : "Continued automatically after a refusal";
  }
  if (event.type === "continued" && event.cause === "auto_window_closed") {
    return ar ? "استُكمل تلقائياً بعد انتهاء مهلة التراجع" : "Continued automatically after the retract window closed";
  }
  const row = typeLabel[event.type];
  return row ? (ar ? row.ar : row.en) : event.type;
}

function eventDetail(event, ar) {
  if (event.type === "reopened") {
    return ar
      ? `أعاد ${event.actorName || "المنشئ"} فتح التوقيع لـ ${event.targetName || event.targetEmail || "الطرف"}.`
      : `${event.actorName || "The creator"} reopened signing for ${event.targetName || event.targetEmail || "the party"}.`;
  }
  if (event.type === "deadline_elapsed") {
    return ar
      ? `رُفض من لم يُتم التوقيع — ${DEADLINE_REFUSAL_REASON}.`
      : "Unsigned parties were refused because the deadline elapsed.";
  }
  if (event.cause === "retract_closed" || event.reason === "retract_closed") {
    return ar ? "أُغلقت مهلة التراجع — استمر الملف دون من لم يُجب." : "Retract windows closed — the file continued without unanswered parties.";
  }
  if (event.reason === "link_expired") {
    return ar ? "انتهت صلاحية رابط التوقيع." : "The signing link expired.";
  }
  if (event.reason === DEADLINE_REFUSAL_REASON || event.cause === REFUSAL_DEADLINE) {
    return DEADLINE_REFUSAL_REASON;
  }
  return event.reason || "";
}

export default function SigningAuditTrail({ events = [], ar, open = false }) {
  if (!events.length) return null;
  const signed = signedAuditCount(events);
  const opened = open || signed > 0;
  return (
    <details open={opened} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", fontSize: 11, fontWeight: 600, color: NAVY, letterSpacing: "0.04em" }}>
        {ar
          ? (signed
            ? `سجل التدقيق · ${signed === 1 ? "توقيع موثّق" : signed === 2 ? "توقيعان موثّقان" : `${signed} توقيعات موثّقة`}`
            : "سجل التدقيق")
          : (signed ? `AUDIT TRAIL · ${signed} recorded signature${signed === 1 ? "" : "s"}` : "AUDIT TRAIL")}
      </summary>
      {signed ? (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
          {ar ? "كل من وقّع يُوثَّق هنا بالاسم والوقت وبصمة الملف." : "Everyone who signed is recorded here with name, time, and file fingerprint."}
        </p>
      ) : null}
      <div style={{ marginTop: 10, paddingInlineStart: 12, borderInlineStart: `2px solid ${BORDER}`, display: "grid", gap: 10 }}>
        {events.map((event, index) => {
          const Icon = icons[event.type] || Clock3;
          const label = eventLabel(event, ar);
          const detail = eventDetail(event, ar);
          const targetLine = event.type === "reopened" || event.type === "rejected"
            ? (event.targetName ? (ar ? `لـ ${event.targetName}` : `for ${event.targetName}`) : "")
            : "";
          return (
            <div key={`${event.at}-${index}`} style={{ fontSize: 11 }}>
              <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, color: NAVY }}>
                <Icon style={{ width: 13, height: 13, color: event.type === "signed" ? "#15803D" : event.type === "rejected" || event.type === "deleted" ? "#DC2626" : event.type === "reopened" ? "#B45309" : NAVY }} />
                {event.actorName || "NiroVera"} · {label}{targetLine ? ` · ${targetLine}` : ""}
              </p>
              <p style={{ margin: "4px 0 0", color: MUTED }}>
                {new Date(event.at).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh" })}
              </p>
              {event.location?.lat != null && (
                <p style={{ margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4, color: MUTED }}>
                  <MapPin style={{ width: 12, height: 12 }} />
                  {event.location.lat.toFixed(5)}, {event.location.lng.toFixed(5)} ±{Math.round(event.location.accuracy || 0)}m
                </p>
              )}
              {event.retractUntil ? (
                <p style={{ margin: "4px 0 0", color: MUTED }}>
                  {event.retractDays
                    ? (ar
                      ? `مهلة ${event.retractDays === 2 ? "يومين" : event.retractDays === 3 ? "ثلاثة أيام" : "يوم واحد"}`
                      : `${event.retractDays} day${event.retractDays > 1 ? "s" : ""}`)
                    : null}
                  {" · "}
                  {new Date(event.retractUntil).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh" })}
                </p>
              ) : null}
              {detail ? (
                <p style={{ margin: "4px 0 0", color: MUTED }}>{detail}</p>
              ) : null}
              {event.documentHash && (
                <p dir="ltr" style={{ margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: MUTED }}>
                  SHA-256 {event.documentHash}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
