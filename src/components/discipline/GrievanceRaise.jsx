import React, { useEffect, useState } from "react";
import { getCompanyData, submitOtherRequest } from "@/lib/store";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { GRIEVANCE_KINDS, GRIEVANCE_TYPE, checkGrievanceGate, grievanceFileDeadline, grievanceReplyBy } from "@/lib/rightsRequests";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { regulationDate } from "@/lib/workRegulation";
import { hashConsentFile, readConsentFile } from "@/lib/writtenConsent";
import PlatformDateField from "@/components/shared/PlatformDateField";
import AttachDropzone from "@/components/shared/AttachDropzone";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import { Checklist, FieldLabel, LawLine, SendButton, StepHead, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import { toast } from "@/components/ui/use-toast";

/**
 * «تظلّم من قرار أو إجراء أو جزاء» (Model regulation Art. 71) — raised in «الجزاءات». The same gate
 * (checkGrievanceGate) and the same stored other-request (type "grievance") as before, so the review
 * inbox, serviceStory, fileArchive and the 15-day reply clock read it unchanged. `prefill` comes from a
 * sanction line: { grievanceKind: "penalty", notifiedOn, reason, sanctionRef }. It renders as the body of the
 * «طلب جديد» frame in الجزاءات (the frame carries the title; the sanction is picked above it).
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

  const told = String(notifiedOn || "").slice(0, 10);
  const lastDay = told ? grievanceFileDeadline(told, isHoliday) : "";
  // The checklist reads the same conditions the gate checks; the gate alone decides the send.
  const checks = [
    { ok: Boolean(grievanceKind), text: ar ? "ما تتظلّم منه محدّد" : "What you grieve is set" },
    { ok: Boolean(told) && told <= today, text: ar ? "تاريخ إبلاغك محدّد" : "The notice date is set" },
    { ok: Boolean(told) && lastDay >= today, text: ar ? "ضمن ثلاثين يوماً من إبلاغك" : "Within thirty days of notice" },
    { ok: String(reason || "").trim().length >= 15, text: ar ? "التظلّم مكتوب بوقائعه" : "The grievance is written out" },
  ];

  return (
    <div data-grievance-raise="" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <LawLine cite={ar ? "النموذج الموحد م71" : "Model Art. 71"}>
        {ar
          ? "كتابةً خلال 30 يوماً من إبلاغك عدا العطل، ويُرد عليك خلال 15 يوماً. لا تُضار من تظلّمك."
          : "In writing within 30 days of notice (holidays aside); answered within 15 days. No harm to you for filing."}
      </LawLine>
      {prefill?.sanctionRef ? null : (
        <>
          <StepHead first label={ar ? "ما تتظلّم منه" : "What you grieve"} />
          <SubTypeGrid label={ar ? "ما تتظلّم منه" : "What you grieve"}>
            {GRIEVANCE_KINDS.map((k) => (
              <SubTypeOption key={k.key} dataKey={`grievance-${k.key}`} on={grievanceKind === k.key} title={ar ? k.ar : k.en} onClick={() => setGrievanceKind(k.key)} />
            ))}
          </SubTypeGrid>
        </>
      )}
      <StepHead first={Boolean(prefill?.sanctionRef)} label={ar ? "السبب" : "The reason"} note={lastDay ? (ar ? `آخر يوم ${regulationDate(lastDay)} · الرد حتى ${regulationDate(grievanceReplyBy(today, isHoliday))}` : `Last day ${lastDay} · answer by ${grievanceReplyBy(today, isHoliday)}`) : ""} />
      <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 280 }}>
        <FieldLabel>{ar ? "تاريخ إبلاغك به" : "Date you were told"}</FieldLabel>
        <PlatformDateField ar={ar} value={notifiedOn} onChange={setNotifiedOn} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>{ar ? "ما الذي اتُّخذ ولماذا تراه غير صحيح" : "What was taken and why it is wrong"}</FieldLabel>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} style={textareaStyle} />
      </label>
      <AttachDropzone
        ar={ar}
        accept="application/pdf,image/jpeg,image/png,image/webp"
        busy={fileBusy}
        file={file}
        label={ar ? "أرفق ما يثبت" : "Attach proof"}
        onPick={(picked) => (picked ? pickFile(picked) : setFile(null))}
        onClear={() => setFile(null)}
      />
      <Checklist items={checks} dataKey="grievance" />
      <span data-grievance-gate={gate.ok ? "ok" : gate.error} hidden={gate.ok} style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-warn-ink)", lineHeight: 1.7 }}>
        {gate.ok ? "" : (ar ? gate.reason : gate.reasonEn)}
      </span>
      <SendButton ready={gate.ok && !busy} onClick={send} dataAttr={{ "data-grievance-send": "" }}>
        {ar ? "أرسل التظلّم" : "Send the grievance"}
      </SendButton>
    </div>
  );
}
