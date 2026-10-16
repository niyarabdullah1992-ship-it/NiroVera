import React, { useEffect, useState } from "react";
import { getCompanyData, submitOtherRequest } from "@/lib/store";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { GRIEVANCE_KINDS, GRIEVANCE_TYPE, checkGrievanceGate, grievanceFileDeadline, grievanceReplyBy } from "@/lib/rightsRequests";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { regulationDate } from "@/lib/workRegulation";
import { hashConsentFile, readConsentFile } from "@/lib/writtenConsent";
import { BORDER, CARD, CONTROL_RADIUS, MUTED } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import AttachFileButton from "@/components/shared/AttachFileButton";
import { toast } from "@/components/ui/use-toast";
import NvIcon from "@/components/shared/NvIcon";

const field = { fontFamily: "inherit", fontSize: 12.5, padding: "10px 12px", border: `1px solid ${BORDER}`, background: CARD, color: "var(--nv-ink)", outline: "none", width: "100%", boxSizing: "border-box", borderRadius: CONTROL_RADIUS };
const label = { fontSize: 11.5, color: MUTED };

/**
 * «تظلّم من قرار أو إجراء أو جزاء» (Model regulation Art. 71) — raised in «الجزاءات». The same gate
 * (checkGrievanceGate) and the same stored other-request (type "grievance") as before, so the review
 * inbox, serviceStory, fileArchive and the 15-day reply clock read it unchanged. `prefill` comes from a
 * sanction line: { grievanceKind: "penalty", notifiedOn, reason, sanctionRef }.
 */
export default function GrievanceRaise({ employee, companyId, ar = true, refresh, onSent, prefill = null }) {
  const today = todayRiyadh();
  const calendar = laborCalendarOf(getCompanyData(companyId));
  const isHoliday = (iso) => isOfficialHoliday(iso, calendar);
  const [grievanceKind, setGrievanceKind] = useState(prefill?.grievanceKind || "");
  const [notifiedOn, setNotifiedOn] = useState(prefill?.notifiedOn || "");
  const [reason, setReason] = useState(prefill?.reason || "");
  const [file, setFile] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  // A new «تظلّم» on another sanction line refills the form.
  useEffect(() => {
    if (!prefill) return;
    setGrievanceKind(prefill.grievanceKind || "");
    setNotifiedOn(prefill.notifiedOn || "");
    setReason(prefill.reason || "");
  }, [prefill]);

  const gate = checkGrievanceGate({ notifiedOn, grievanceKind, reason, today, isHoliday });

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
        type: GRIEVANCE_TYPE,
        reason: reason.trim(),
        notifiedOn,
        grievanceKind,
        files: file ? [file] : [],
        requestedById: employee.id,
        date: today,
      });
      if (!res?.ok) {
        toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" });
        return;
      }
      toast({ description: ar ? "أُرسل تظلّمك — يُبتّ فيه كتابةً خلال 15 يوماً، ولا تُضار من تقديمه." : "Grievance sent — decided in writing within 15 days." });
      setGrievanceKind(""); setNotifiedOn(""); setReason(""); setFile(null);
      refresh?.();
      onSent?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article data-grievance-raise="" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 10, overflow: "hidden", maxWidth: 760, width: "100%" }}>
      <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ fontSize: 15 }}>{ar ? "تظلّم من قرار أو إجراء أو جزاء" : "Grieve a decision, action or penalty"}</strong>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#0B3D27" }}>{ar ? "اللائحة التنفيذية لنظام العمل — المادة 71" : "Implementing Regulations — Art. 71"}</span>
        {prefill?.sanctionRef ? <span data-grievance-sanction="" style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? `عن الجزاء: ${prefill.sanctionRef}` : `On sanction: ${prefill.sanctionRef}`}</span> : null}
      </header>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
          {ar
            ? "لك أن تتظلم كتابةً خلال ثلاثين يوماً — عدا العطل الرسمية — من إبلاغك، ولا تُضار من تظلّمك. وتُبلَّغ بالنتيجة خلال خمسة عشر يوماً؛ فإن رُفض أو لم يُبتّ فيه فلك المحكمة العمالية خلال ثلاثين يوماً."
            : "Grieve in writing within thirty days (holidays aside) of being told, without harm to you. You hear the result within fifteen days; if refused or undecided, the labour court within thirty days."}
        </span>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
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
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={label}>{ar ? "تظلمك: ما الذي اتُّخذ ولماذا تراه غير صحيح" : "Your grievance"}</span>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...field, resize: "vertical" }} />
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AttachFileButton ar={ar} accept="application/pdf,image/jpeg,image/png,image/webp" busy={fileBusy} label={file ? (ar ? "تغيير المرفق" : "Change attachment") : (ar ? "أرفق ما يثبت — اختياري" : "Attach proof — optional")} onPick={pickFile} />
          {file ? <span style={{ fontSize: 11.5 }} dir="ltr">{file.name}</span> : null}
        </div>
        <span data-grievance-gate={gate.ok ? "ok" : gate.error} style={{ fontSize: 11.5, fontWeight: 600, color: gate.ok ? "#2F6B43" : "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7 }}>
          {gate.ok ? <><NvIcon name="check" size={12} strokeWidth={2} /> {ar ? "جاهز للإرسال" : "Ready to send"}</> : (ar ? gate.reason : gate.reasonEn)}
        </span>
        <button type="button" data-grievance-send="" disabled={!gate.ok || busy} onClick={send} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, height: 42, border: "none", borderRadius: 8, background: gate.ok ? "#0B3D27" : "var(--nv-line)", color: gate.ok ? "#fff" : MUTED, cursor: gate.ok ? "pointer" : "default" }}>
          {ar ? "أرسل التظلّم" : "Send the grievance"}
        </button>
      </div>
    </article>
  );
}
