import React, { useState } from "react";
import { getCompanyData, submitOtherRequest } from "@/lib/store";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import {
  ART81_CASES,
  ART81_EXIT_TYPE,
  DAMAGE_OBJECTION_TYPE,
  DOCUMENTS_RETURN_TYPE,
  GRIEVANCE_KINDS,
  GRIEVANCE_TYPE,
  checkGrievanceGate,
  grievanceFileDeadline,
  grievanceReplyBy,
  NIGHT_AVOID_KINDS,
  NIGHT_AVOID_TYPE,
  checkDocumentsReturnGate,
  checkNightAvoidGate,
  LEAVE_CARRY_TYPE,
  RIGHTS_REQUESTS,
  checkArt81Gate,
  checkDamageObjectionGate,
  checkLeaveCarryGate,
  damageObjectionDeadline,
} from "@/lib/rightsRequests";
import { remainingLeaveDays } from "@/lib/leaveTypes";
import { profileGender } from "@/lib/employeeProfileFields";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { regulationDate } from "@/lib/workRegulation";
import { hashConsentFile, readConsentFile } from "@/lib/writtenConsent";
import { BORDER, CARD, CONTROL_RADIUS, MUTED, NAVY } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import AttachFileButton from "@/components/shared/AttachFileButton";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { toast } from "@/components/ui/use-toast";

/**
 * «حقوق نظامية أخرى» — worker requests the Labour Law and decision 18632 provide for: carrying annual
 * leave (110), objecting to a damage deduction (91), avoiding night work on a medical certificate
 * (18632 ثالثاً ج), the return of deposited documents (64), and leaving without notice (81).
 * The contract copy (51) sits with the documents; the job-search day (78) with the leaves.
 */

const field = { fontFamily: "inherit", fontSize: 12.5, padding: "10px 12px", border: `1px solid ${BORDER}`, background: CARD, color: "var(--nv-ink)", outline: "none", width: "100%", boxSizing: "border-box", borderRadius: CONTROL_RADIUS };
const block = { padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 };
const label = { fontSize: 11.5, color: MUTED };
const pick = (on) => ({ fontFamily: "inherit", textAlign: "start", display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: on ? "#EAF3EE" : "var(--nv-card)", border: on ? "1.5px solid #3C7D50" : "1px solid var(--nv-line)" });

export default function RightsRequestRaise({ employee, companyId, ar = true, refresh, onSent }) {
  const today = todayRiyadh();
  const [kind, setKind] = useState(LEAVE_CARRY_TYPE);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const [notifiedOn, setNotifiedOn] = useState("");
  const [amount, setAmount] = useState("");
  const [caseKey, setCaseKey] = useState("");
  const [ack, setAck] = useState(false);
  const [file, setFile] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avoidKind, setAvoidKind] = useState("");
  const [avoidFrom, setAvoidFrom] = useState("");
  const [avoidUntil, setAvoidUntil] = useState("");
  const [grievanceKind, setGrievanceKind] = useState("");
  const calendar = laborCalendarOf(getCompanyData(companyId));
  const isHoliday = (iso) => isOfficialHoliday(iso, calendar);
  const gender = profileGender(employee?.profile);
  const remaining = remainingLeaveDays(employee?.profile, employee?.leaveRequests, "annual");
  const kinds = RIGHTS_REQUESTS.filter((k) => k.key !== "contract_copy");
  const meta = kinds.find((k) => k.key === kind) || kinds[0];

  const gate = kind === LEAVE_CARRY_TYPE
    ? checkLeaveCarryGate({ days, remaining, reason })
    : kind === DAMAGE_OBJECTION_TYPE
      ? checkDamageObjectionGate({ notifiedOn, amount, reason, today })
      : kind === NIGHT_AVOID_TYPE
        ? checkNightAvoidGate({ kind: avoidKind, from: avoidFrom, until: avoidUntil, file, gender })
        : kind === DOCUMENTS_RETURN_TYPE
          ? checkDocumentsReturnGate({ reason })
          : kind === GRIEVANCE_TYPE
            ? checkGrievanceGate({ notifiedOn, grievanceKind, reason, today, isHoliday })
            : checkArt81Gate({ caseKey, reason, ack });

  const pickFile = async (picked) => {
    if (!picked) return;
    setFileBusy(true);
    try {
      const [hash, url] = await Promise.all([hashConsentFile(picked), readConsentFile(picked)]);
      setFile({ name: picked.name, size: picked.size, type: picked.type, url, hash });
    } finally {
      setFileBusy(false);
    }
  };

  const send = () => {
    if (!gate.ok || busy || !employee?.id) return;
    setBusy(true);
    try {
      const res = submitOtherRequest(companyId, employee.id, {
        type: kind,
        reason: reason.trim() || (kind === NIGHT_AVOID_TYPE ? (NIGHT_AVOID_KINDS.find((k) => k.key === avoidKind)?.ar || "") : ""),
        days: kind === LEAVE_CARRY_TYPE ? days : undefined,
        remaining,
        notifiedOn: kind === DAMAGE_OBJECTION_TYPE || kind === GRIEVANCE_TYPE ? notifiedOn : undefined,
        grievanceKind: kind === GRIEVANCE_TYPE ? grievanceKind : undefined,
        amount: kind === DAMAGE_OBJECTION_TYPE ? Number(amount) : undefined,
        art81Case: kind === ART81_EXIT_TYPE ? caseKey : undefined,
        nightAvoidKind: kind === NIGHT_AVOID_TYPE ? avoidKind : undefined,
        from: kind === NIGHT_AVOID_TYPE ? avoidFrom : undefined,
        until: kind === NIGHT_AVOID_TYPE ? avoidUntil : undefined,
        gender,
        ack,
        files: file ? [file] : [],
        requestedById: employee.id,
        date: today,
      });
      if (!res?.ok) {
        toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" });
        return;
      }
      toast({ description: kind === ART81_EXIT_TYPE
        ? (ar ? "سُجّل تركك العمل وفق المادة 81 — وصل البلاغ للإدارة، وحقوقك النظامية محفوظة." : "Your Art. 81 exit is on file — management is told; your rights are kept.")
        : (ar ? "أُرسل الطلب — بانتظار رد الإدارة." : "Sent — awaiting management.") });
      setAvoidKind(""); setAvoidFrom(""); setAvoidUntil(""); setGrievanceKind("");
      setReason(""); setDays(""); setNotifiedOn(""); setAmount(""); setCaseKey(""); setAck(false); setFile(null);
      refresh?.();
      onSent?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-rights-raise="1">
      <div style={block}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "نوع الطلب" : "Request"}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 6 }}>
          {kinds.map((k) => (
            <button key={k.key} type="button" data-rights-kind={k.key} onClick={() => setKind(k.key)} style={pick(kind === k.key)}>
              <span style={{ fontWeight: kind === k.key ? 700 : 500, color: NAVY, fontSize: 12.5 }}>{ar ? k.ar : k.en}</span>
              <span style={{ fontSize: 10.5, color: MUTED }}>{ar ? k.hintAr : k.hintEn}</span>
            </button>
          ))}
        </div>
        {meta.article === "regs71"
          ? <span style={{ fontSize: 11, fontWeight: 700, color: "#0B3D27" }}>{ar ? "اللائحة التنفيذية لنظام العمل (القرار 115921 لعام 1446هـ) — المادة 71، التظلم" : "Labour Law Implementing Regulations (decision 115921, 1446H) — Art. 71, grievance"}</span>
          : meta.article === "18632"
          ? <span style={{ fontSize: 11, fontWeight: 700, color: "#0B3D27" }}>{ar ? "القرار الوزاري 18632 (1441/1/30هـ) — ثالثاً، الخدمات الصحية (ج)" : "Ministerial decision 18632 — third, health services (c)"}</span>
          : <LaborArticleCite article={meta.article} ar={ar} showOfficial showText />}
      </div>

      <div style={block}>
        {kind === LEAVE_CARRY_TYPE ? (
          <>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              {ar
                ? `الأصل أن تتمتع بإجازتك في سنة استحقاقها ولا تنزل عنها ولا تأخذ بدلها نقداً أثناء الخدمة (المادة 109). ويجوز بموافقة صاحب العمل تأجيلها أو أياماً منها إلى السنة التالية (المادة 110). المتبقي لك الآن ${remaining} يوماً.`
                : `Leave is taken in its year and never waived or cashed during service (Art. 109). With the employer's agreement it may be carried to next year (Art. 110). You have ${remaining} days left.`}
            </span>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 220 }}>
              <span style={label}>{ar ? "عدد الأيام المؤجلة" : "Days to carry"}</span>
              <input type="number" min={1} max={remaining} value={days} onChange={(e) => setDays(e.target.value)} style={field} />
            </label>
          </>
        ) : null}

        {kind === DAMAGE_OBJECTION_TYPE ? (
          <>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              {ar
                ? "لصاحب العمل أن يقتطع ما يلزم لإصلاح ما أتلفته بخطئك، بما لا يزيد على أجر خمسة أيام في الشهر. ولك أن تتظلم مما نُسب إليك أو من تقدير المبلغ خلال خمسة عشر يوم عمل من إبلاغك، وإلا سقط حقك (المادة 91). الاعتراض هنا يصل الإدارة أولاً؛ والتظلم الرسمي أمام المحكمة العمالية."
                : "The employer may deduct up to five days' wage a month for damage you caused. You may object within fifteen working days of being told (Art. 91). This reaches management first; the formal forum is the labour court."}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 9 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={label}>{ar ? "تاريخ إبلاغك بالخصم" : "Date you were told"}</span>
                <PlatformDateField ar={ar} value={notifiedOn} onChange={setNotifiedOn} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={label}>{ar ? "المبلغ المخصوم (ر.س)" : "Amount deducted (SAR)"}</span>
                <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} style={field} />
              </label>
            </div>
            {notifiedOn ? (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: gate.error === "OBJECTION_LATE" ? "var(--nv-bad-ink)" : "#2F6B43" }}>
                {ar ? `آخر يوم للتظلم: ${regulationDate(damageObjectionDeadline(notifiedOn))}` : `Last day to object: ${damageObjectionDeadline(notifiedOn)}`}
              </span>
            ) : null}
          </>
        ) : null}

        {kind === NIGHT_AVOID_TYPE ? (
          <>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              {ar
                ? "إن تبيّن بشهادة طبية أنك بحاجة لتجنب العمل الليلي، أو كنتِ حاملاً أو أماً وتبيّن حاجتك لفترات إضافية، تُنقل إلى وظيفة مماثلة في ساعات العمل المعتادة؛ وإن تعذر النقل تُقلَّص ساعات عملك إلى ست ساعات شاملة مع حفظ أجرك وإعاناتك ومزاياك المرتبطة بالعمل الليلي. والحامل محظور تشغيلها ليلاً 24 أسبوعاً قبل الوضع دون طلب (إبلاغ الحمل)."
                : "If a medical certificate shows you need to avoid night work — or, pregnant or a mother, you need extra periods off it — you move to similar ordinary-hours work, or your hours drop to six with pay and benefits kept."}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {NIGHT_AVOID_KINDS.filter((k) => !k.gender || k.gender === gender).map((k) => (
                <label key={k.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.7, cursor: "pointer" }}>
                  <input type="radio" name="nightAvoid" checked={avoidKind === k.key} onChange={() => setAvoidKind(k.key)} style={{ marginTop: 5, accentColor: "#0B3D27" }} />
                  <span>{ar ? k.ar : k.en} <span style={{ color: MUTED, fontSize: 11 }}>({k.ref})</span></span>
                </label>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 9 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={label}>{ar ? "من تاريخ" : "From"}</span>
                <PlatformDateField ar={ar} value={avoidFrom} onChange={setAvoidFrom} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={label}>{ar ? "حتى تاريخ — اتركه فارغاً إن لم تحدده الشهادة" : "Until — leave empty if open"}</span>
                <PlatformDateField ar={ar} value={avoidUntil} onChange={setAvoidUntil} />
              </label>
            </div>
          </>
        ) : null}

        {kind === GRIEVANCE_TYPE ? (
          <>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              {ar
                ? "لك أن تتظلم كتابةً من أي قرار أو إجراء أو جزاء اتُّخذ في حقك، خلال ثلاثين يوماً — عدا العطل الرسمية — من إبلاغك به، ولا تُضار من تقديم تظلمك. وتُبلَّغ بنتيجة البت خلال خمسة عشر يوماً عدا العطل الرسمية. فإن رُفض أو لم يُبت فيه كتابةً خلالها فلك الاعتراض أمام المحكمة العمالية خلال ثلاثين يوماً عدا العطل الرسمية."
                : "You may grieve in writing any decision, action or penalty taken against you within thirty days (official holidays aside) of being told, without harm to you. You are told the result within fifteen days. If refused or not decided in writing by then, you may go to the labour court within thirty days."}
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {GRIEVANCE_KINDS.map((k) => (
                <label key={k.key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                  <input type="radio" name="grievanceKind" checked={grievanceKind === k.key} onChange={() => setGrievanceKind(k.key)} style={{ accentColor: "#0B3D27" }} />
                  <span>{ar ? k.ar : k.en}</span>
                </label>
              ))}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 260 }}>
              <span style={label}>{ar ? "تاريخ إبلاغك به" : "Date you were told"}</span>
              <PlatformDateField ar={ar} value={notifiedOn} onChange={setNotifiedOn} />
            </label>
            {notifiedOn ? (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: gate.error === "GRIEVANCE_LATE" ? "var(--nv-bad-ink)" : "#2F6B43" }}>
                {ar
                  ? `آخر يوم للتظلم: ${regulationDate(grievanceFileDeadline(notifiedOn, isHoliday))} · الرد عليك حتى ${regulationDate(grievanceReplyBy(today, isHoliday))}`
                  : `Last day to grieve: ${grievanceFileDeadline(notifiedOn, isHoliday)} · answer due by ${grievanceReplyBy(today, isHoliday)}`}
              </span>
            ) : null}
          </>
        ) : null}

        {kind === DOCUMENTS_RETURN_TYPE ? (
          <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
            {ar ? "يلتزم صاحب العمل عند انتهاء عقد العمل أن يعيد إليك جميع ما أودعته لديه من شهادات أو وثائق (المادة 64). اذكرها أدناه." : "At contract end the employer returns every certificate or document you deposited (Art. 64). List them below."}
          </span>
        ) : null}

        {kind === ART81_EXIT_TYPE ? (
          <>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              {ar
                ? "يحق لك ترك العمل دون إشعار، مع احتفاظك بحقوقك النظامية كلها، في إحدى الحالات الست الآتية فقط (المادة 81). ينتهي عقدك من اليوم، ولا يتوقف على قبول الإدارة. وإن نازعك صاحب العمل في قيام الحالة فالفصل للمحكمة العمالية — فاحفظ ما يثبتها."
                : "You may leave without notice, keeping all your rights, only in one of these six cases (Art. 81). Your contract ends today; it does not wait for management. Any dispute goes to the labour court — keep your proof."}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ART81_CASES.map((c, i) => (
                <label key={c.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.7, cursor: "pointer", color: "var(--nv-ink)" }}>
                  <input type="radio" name="art81" checked={caseKey === c.key} onChange={() => setCaseKey(c.key)} style={{ marginTop: 5, accentColor: "#0B3D27" }} />
                  <span><span style={{ color: MUTED }}>{ar ? `(${i + 1}) ` : `(${i + 1}) `}</span>{ar ? c.ar : c.en}</span>
                </label>
              ))}
            </div>
          </>
        ) : null}

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={label}>{kind === ART81_EXIT_TYPE ? (ar ? "ما الذي حدث؟ بالتواريخ" : "What happened? With dates") : kind === DAMAGE_OBJECTION_TYPE ? (ar ? "سبب اعتراضك" : "Why you object") : kind === NIGHT_AVOID_TYPE ? (ar ? "ملاحظة — اختيارية" : "Note — optional") : kind === DOCUMENTS_RETURN_TYPE ? (ar ? "الوثائق المودعة" : "Deposited documents") : kind === GRIEVANCE_TYPE ? (ar ? "تظلمك: ما الذي اتُّخذ ولماذا تراه غير صحيح" : "Your grievance") : (ar ? "سبب التأجيل" : "Why")}</span>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...field, resize: "vertical" }} />
        </label>

        {kind !== LEAVE_CARRY_TYPE && kind !== DOCUMENTS_RETURN_TYPE ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <AttachFileButton ar={ar} accept="application/pdf,image/jpeg,image/png,image/webp" busy={fileBusy} label={file ? (ar ? "تغيير المرفق" : "Change attachment") : kind === NIGHT_AVOID_TYPE ? (ar ? "أرفق الشهادة الطبية — مطلوبة" : "Attach the certificate — required") : (ar ? "أرفق ما يثبت — اختياري" : "Attach proof — optional")} onPick={pickFile} />
            {file ? <span style={{ fontSize: 11.5 }} dir="ltr">{file.name}</span> : null}
          </div>
        ) : null}

        {kind === ART81_EXIT_TYPE ? (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.7, color: NAVY, cursor: "pointer" }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 4 }} />
            <span>{ar ? "أعلم أن تركي العمل ينهي عقدي من اليوم، وأن الخلاف إن وقع يُنظر أمام المحكمة العمالية." : "I understand leaving ends my contract today, and any dispute goes to the labour court."}</span>
          </label>
        ) : null}

        <span data-rights-gate={gate.ok ? "ok" : gate.error} style={{ fontSize: 11.5, fontWeight: 600, color: gate.ok ? "#2F6B43" : "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7 }}>
          {gate.ok ? (ar ? "✓ جاهز للإرسال" : "✓ Ready to send") : (ar ? gate.reason : gate.reasonEn)}
        </span>
        <button type="button" data-rights-send="1" disabled={!gate.ok || busy} onClick={send} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, height: 42, border: "none", borderRadius: 8, background: gate.ok ? "#0B3D27" : "var(--nv-line)", color: gate.ok ? "#fff" : MUTED, cursor: gate.ok ? "pointer" : "default" }}>
          {kind === ART81_EXIT_TYPE ? (ar ? "سجّل ترك العمل وأبلغ الإدارة" : "Record leaving and tell management") : (ar ? "أرسل الطلب" : "Send the request")}
        </button>
      </div>
    </div>
  );
}
