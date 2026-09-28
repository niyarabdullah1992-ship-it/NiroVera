import React, { useState } from "react";
import { Download, Loader2, RefreshCw, Undo2 } from "lucide-react";
import IdentityCard from "@/components/shared/IdentityCard";
import { signGhostBtn, signKicker, signPrimaryBtn, signProofGrid } from "@/components/files/signingUi";
import { ACCENT, BORDER, DANGER, MUTED, NAVY, NAVY_FILL, SURFACE, textarea } from "@/lib/platformStyles";
import SigningAuditTrail from "@/components/files/SigningAuditTrail";
import { DEADLINE_REFUSAL_REASON, REFUSAL_DEADLINE, retractDaysLabel } from "@/lib/multiSignDerivations";
import { formatUiNumber } from "@/lib/dateFormat";

export default function PublicSignStateCard({ ar, type, info, done, message, onRetry, onRetract, retracting, retractError }) {
  const [retractReason, setRetractReason] = useState("");
  const [showRetract, setShowRetract] = useState(false);
  if (type === "loading") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <IdentityCard title={ar ? "جاري فتح الطلب" : "Opening request"}>
          <div style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 style={{ width: 22, height: 22, color: MUTED }} className="animate-spin" />
          </div>
        </IdentityCard>
      </div>
    );
  }
  const success = type === "success";
  const rejected = type === "rejected";
  const waiting = type === "waiting";
  const skipped = type === "skipped";
  const deleted = type === "deleted";
  const finalUrl = done?.docUrl || info?.docUrl;
  const fingerprint = done?.finalHash || info?.finalHash;
  const state = done?.status || info?.status;
  const closedWithRefusal = state === "completed_with_refusal";
  const closed = Boolean(done?.completed) || state === "completed" || closedWithRefusal;
  const refusalReason = done?.reason || info?.rejectionReason || info?.signer?.rejectionReason;
  const deadlineRefuse = rejected && (
    done?.rejectionCause === REFUSAL_DEADLINE
    || info?.signer?.rejectionCause === REFUSAL_DEADLINE
    || refusalReason === DEADLINE_REFUSAL_REASON
  );
  const title = success
    ? (ar ? "تم تسجيل توقيعك" : "Your signature was recorded")
    : rejected
      ? (deadlineRefuse
        ? (ar ? "رفض بانتهاء المدة" : "Refused — deadline elapsed")
        : (ar ? "سُجّل رفضك" : "Your refusal was recorded"))
      : waiting
        ? (ar ? "لا يمكن التوقيع الآن" : "You can't sign yet")
        : skipped
          ? (ar ? "استمر الملف دون توقيعك" : "The file continued without your signature")
          : deleted
            ? (ar ? "طُلب التوقيع محذوف" : "This signing request was deleted")
            : (ar ? "تعذّر فتح الطلب" : "The request couldn't be opened");
  const canRetract = Boolean(success && (done?.canRetract || info?.canRetract || info?.signer?.canRetract));
  const retractUntil = done?.retractUntil || info?.signer?.retractUntil;
  const retractDays = done?.retractDays ?? info?.signer?.retractDays ?? 1;
  const untilText = retractUntil
    ? new Date(retractUntil).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh" })
    : "";
  const subtitle = success
    ? (canRetract
      ? (ar
        ? `سُجّل توقيعك مع مهلة تراجع ${retractDaysLabel(retractDays, true)}${untilText ? ` حتى ${untilText}` : ""}. أُشعر المرسل، وبعد انتهائها لا يمكن التراجع ويُثبت في سجل التدقيق.`
        : `Your signature is recorded with a ${retractDaysLabel(retractDays, false)} retraction window${untilText ? ` until ${untilText}` : ""}. The sender was alerted; after it closes retraction is locked in the audit trail.`)
      : closedWithRefusal
        ? (ar ? "أُغلق المستند بحالة «مكتمل مع رفض». الامتناع لا يوقف الملف — نزّل النسخة النهائية دون الرجوع للرافضين." : "The document closed as “completed with refusal”. A refusal does not block the file — download the final copy without going back to the refusers.")
        : closed
          ? (ar ? "اكتملت جميع التوقيعات وتم توثيق النسخة النهائية." : "All signatures are complete and the final copy is verified.")
          : Number(info?.pendingCount) === 0
            ? (ar ? "سُجّل توقيعك. التنزيل بعد أن يمرّر المنشئ التوقيع." : "Your signature is saved. Download waits until the creator releases the file.")
            : (ar ? "تم حفظ توقيعك، والطلب بانتظار بقية الأطراف." : "Your signature is saved; the request is waiting for the remaining parties."))
    : rejected
      ? (deadlineRefuse
        ? (ar
          ? "انتهت مهلة اليوم أو اليومين أو الثلاثة أيام دون إتمام التوقيع. سُجّل السبب: «رفض بانتهاء المدة». يمكن للمنشئ إعادة فتح رابطك."
          : "The 1–3 day window closed without a completed signature. The reason recorded is “deadline elapsed”. The creator can reopen your link.")
        : (ar
          ? `سُجّل رفضك مع سببه وأُشعر المرسل${refusalReason ? ` — ${refusalReason}` : ""}. المستند لا يتوقف: بقية الموقّعين يواصلون، ويُغلق بحالة «مكتمل مع رفض».`
          : `Your refusal and its reason were recorded and the sender was notified${refusalReason ? ` — ${refusalReason}` : ""}. The document does not stop: the other signers continue, and it closes as “completed with refusal”.`))
      : waiting
        ? (ar ? "التوقيع متوازٍ — لا ترتيب إلزامي. رابطك معلّق الآن لأن الطلب لا يقبل توقيعًا. حدّث الحالة أو اطلب رابطًا جديدًا من المرسل." : "Signing is parallel — there is no forced order. Your link is open but the request is not accepting a signature. Refresh the status or ask the sender for a new link.")
        : skipped
          ? (ar ? "من لم يوقّع لا يوقف الملف. سُجّل أنك لم تُجب في سجل التدقيق، وأُغلق رابطك." : "Silence does not block the file. Your lack of a signature is in the audit trail, and this link is closed.")
          : deleted
            ? (ar
              ? `حذفها ${info?.creatorName || "المنشئ"}${info?.deletionReason ? ` — ${info.deletionReason}` : ""}. رابط التوقيع مغلق.`
              : `Deleted by ${info?.creatorName || "the creator"}${info?.deletionReason ? ` — ${info.deletionReason}` : ""}. This signing link is closed.`)
            : message;

  const stateKey = canRetract
    ? (ar ? "مهلة تراجع · معلّق" : "Retract window · pending")
    : closedWithRefusal
      ? (ar ? "مكتمل مع رفض" : "Completed with refusal")
      : closed
        ? (ar ? "مكتمل" : "Completed")
        : success
          ? (ar ? "وُقّع · بانتظار الأطراف" : "Signed · awaiting parties")
          : rejected
            ? (deadlineRefuse ? (ar ? "رفض بانتهاء المدة" : "Refused — deadline") : (ar ? "رفض" : "Refused"))
            : waiting
              ? (ar ? "معلّق" : "Waiting")
              : skipped
                ? (ar ? "مُتخطّى" : "Skipped")
                : deleted
                  ? (ar ? "محذوف" : "Deleted")
                  : (ar ? "خطأ" : "Error");
  const proof = [
    [ar ? "الحالة" : "State", stateKey],
    ...(untilText ? [[ar ? "حتى" : "Until", untilText]] : []),
    [ar ? "بصمة الملف" : "SHA-256", fingerprint || (canRetract ? (ar ? "يُثبَّت بعد إغلاق المهلة" : "Sealed after the window closes") : "—")],
    [ar ? "التحقق" : "Verify", info?.verificationId || "—"],
    [ar ? "الأطراف" : "Parties", info ? `${formatUiNumber(info.signedCount, ar)} / ${formatUiNumber(info.totalCount, ar)}` : "—"],
    [ar ? "الموقّع" : "Signer", info?.signer?.name || "—"],
  ];
  const rail = success ? ACCENT : rejected || deleted ? NAVY_FILL : type === "error" ? DANGER : NAVY_FILL;
  const coolingGrid = canRetract
    ? { ...signProofGrid, border: "1px solid var(--nv-line)", background: "var(--nv-warn-soft)" }
    : signProofGrid;

  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "28px 20px 40px" }}>
      <div style={{ width: "min(560px, 100%)" }}>
        <IdentityCard
          kicker={ar ? "النتيجة" : "Outcome"}
          title={title}
          subtitle={subtitle}
          dir={ar ? "rtl" : "ltr"}
          rail={rail}
          bodySurface
        >
          <div style={{ ...coolingGrid, marginBottom: 16, borderRadius: 12 }}>
            {proof.map(([key, value]) => (
              <React.Fragment key={key}>
                <span style={{ color: canRetract ? "var(--nv-warn-ink)" : MUTED }}>{key}</span>
                <span style={{ color: canRetract && key === proof[0][0] ? "var(--nv-warn-ink)" : NAVY, fontWeight: 500, overflowWrap: "anywhere" }}>{value}</span>
              </React.Fragment>
            ))}
          </div>
          {(success || rejected || skipped) && info?.auditTrail?.length ? (
            <div style={{ marginBottom: 16 }}>
              <SigningAuditTrail events={info.auditTrail} ar={ar} open />
            </div>
          ) : null}
          {rejected && refusalReason ? (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE, padding: "10px 12px", fontSize: 12, lineHeight: 1.8, color: NAVY, marginBottom: 16 }}>
              <span style={{ ...signKicker, display: "block", marginBottom: 6 }}>{ar ? "السبب" : "Reason"}</span>
              {refusalReason}
            </div>
          ) : null}
          {canRetract ? (
            <div style={{ border: "1px solid var(--nv-line)", borderRadius: 12, background: "var(--nv-warn-soft)", padding: 12, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "var(--nv-warn-ink)" }}>
                {ar ? "خلال المهلة يمكنك سحب توقيعك فيعود الطلب بانتظارك ويُستعاد الملف السابق. بعد انتهائها تُثبَّت البصمة ولا تراجع." : "During the window you can withdraw; the request returns to awaiting you and the previous file is restored. After it closes the fingerprint is sealed and there is no retract."}
              </p>
              {showRetract ? (
                <>
                  <textarea
                    value={retractReason}
                    onChange={(event) => setRetractReason(event.target.value)}
                    placeholder={ar ? "سبب التراجع (اختياري)" : "Reason for retracting (optional)"}
                    style={{ ...textarea, minHeight: 72, marginTop: 10, background: "var(--nv-card)" }}
                  />
                  <button
                    type="button"
                    onClick={() => onRetract?.(retractReason)}
                    disabled={retracting}
                    style={{ ...signPrimaryBtn, background: "var(--nv-bad-fill)", opacity: retracting ? 0.4 : 1, marginTop: 8 }}
                  >
                    {retracting ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Undo2 style={{ width: 14, height: 14 }} />}
                    {ar ? "تأكيد سحب التوقيع" : "Confirm retraction"}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setShowRetract(true)} style={{ ...signGhostBtn, marginTop: 8, color: "var(--nv-warn-ink)", borderColor: "var(--nv-line)" }}>
                  <Undo2 style={{ width: 14, height: 14 }} />
                  {ar ? "سحب توقيعي" : "Retract my signature"}
                </button>
              )}
            </div>
          ) : null}
          {retractError ? (
            <p style={{ margin: "0 0 12px", background: "var(--nv-bad-soft)", padding: "10px 12px", fontSize: 12, color: DANGER }}>{retractError}</p>
          ) : null}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {success && closed && !canRetract && finalUrl ? (
              <a href={finalUrl} target="_blank" rel="noreferrer" style={{ ...signPrimaryBtn, textDecoration: "none" }}>
                <Download style={{ width: 14, height: 14 }} />{ar ? "تنزيل النسخة النهائية" : "Download final copy"}
              </a>
            ) : null}
            {success && canRetract && finalUrl ? (
              <a href={finalUrl} target="_blank" rel="noreferrer" style={{ ...signPrimaryBtn, textDecoration: "none" }}>
                <Download style={{ width: 14, height: 14 }} />{ar ? "تنزيل النسخة الموقّعة" : "Download signed copy"}
              </a>
            ) : null}
            {!success && !rejected && !skipped && !deleted ? (
              <button type="button" onClick={onRetry} style={signPrimaryBtn}>
                <RefreshCw style={{ width: 14, height: 14 }} />{waiting ? (ar ? "تحديث الحالة" : "Refresh status") : (ar ? "إعادة المحاولة" : "Try again")}
              </button>
            ) : null}
          </div>
        </IdentityCard>
      </div>
    </div>
  );
}
