import React, { useEffect, useState } from "react";
import { submitOtherRequest } from "@/lib/store";
import { DAMAGE_OBJECTION_TYPE, checkDamageObjectionGate, damageObjectionDeadline, workingDaysBetween } from "@/lib/rightsRequests";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { regulationDate } from "@/lib/workRegulation";
import { hashConsentFile, readConsentFile } from "@/lib/writtenConsent";
import PlatformDateField from "@/components/shared/PlatformDateField";
import AttachDropzone from "@/components/shared/AttachDropzone";
import { Checklist, FieldLabel, LawLine, SendButton, StepHead, inputStyle, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import { toast } from "@/components/ui/use-toast";

/**
 * «اعتراض على خصم إتلاف» (Labour Law Art. 91) — raised in «الجزاءات». The same gate
 * (checkDamageObjectionGate) and the same stored other-request (type "damage_objection") as when it
 * sat in طلباتي, so the manager inbox, the payroll refund (reconcileDamageObjections), serviceStory and
 * fileArchive read it unchanged. `prefill` comes from a damage line on payroll:
 * { notifiedOn, amount, damageCaseId, deductionLineId, lineRef }.
 */
export default function DamageObjectionRaise({ employee, companyId, ar = true, refresh, onSent, prefill = null }) {
  const today = todayRiyadh();
  const [notifiedOn, setNotifiedOn] = useState(prefill?.notifiedOn || "");
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : "");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  // «اعترض» on another damage line refills the form.
  useEffect(() => {
    if (!prefill) return;
    setNotifiedOn(prefill.notifiedOn || "");
    setAmount(prefill.amount ? String(prefill.amount) : "");
  }, [prefill]);

  const gate = checkDamageObjectionGate({ notifiedOn, amount, reason, today });
  const last = notifiedOn ? damageObjectionDeadline(notifiedOn) : "";
  const left = last && today <= last ? workingDaysBetween(today, last) : 0;

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
        type: DAMAGE_OBJECTION_TYPE,
        reason: reason.trim(),
        notifiedOn,
        amount: Number(amount),
        // From a payroll line: the objection names exactly the case it contests (the refund follows it).
        damageCaseId: prefill?.damageCaseId || undefined,
        deductionLineId: prefill?.deductionLineId || undefined,
        files: file ? [file] : [],
        requestedById: employee.id,
        date: today,
      });
      if (!res?.ok) {
        toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" });
        return;
      }
      toast({ description: ar ? "أُرسل اعتراضك — إن قُبل رُدّ المبلغ في المسير." : "Objection sent — if accepted the amount is refunded on payroll." });
      setNotifiedOn(""); setAmount(""); setReason(""); setFile(null);
      refresh?.();
      onSent?.();
    } finally {
      setBusy(false);
    }
  };

  const checks = [
    { ok: Boolean(notifiedOn) && String(notifiedOn).slice(0, 10) <= today, text: ar ? "تاريخ إبلاغك بالخصم محدّد" : "The notice date is set" },
    { ok: Boolean(last) && today <= last, text: ar ? "ضمن 15 يوم عمل من إبلاغك" : "Within 15 working days of notice" },
    { ok: Number(amount) > 0, text: ar ? "المبلغ المخصوم مكتوب" : "The amount is written" },
    { ok: String(reason || "").trim().length >= 15, text: ar ? "سبب الاعتراض مكتوب" : "The reason is written" },
  ];

  return (
    <div data-damage-objection-raise="" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <LawLine cite={ar ? "نظام العمل م91" : "Labour Law Art. 91"}>
        {ar
          ? "خلال 15 يوم عمل من إبلاغك بالخصم وتقديره، وإلا سقط الحق. إن قُبل رُدّ المبلغ في المسير."
          : "Within 15 working days of being told, or the right lapses. If accepted the amount is refunded on payroll."}
      </LawLine>
      <StepHead first label={ar ? "الخصم" : "The deduction"} note={last ? (ar ? `آخر يوم ${regulationDate(last)}${left ? ` · بقي ${left} يوم عمل` : ""}` : `Last day ${last}${left ? ` · ${left} working days left` : ""}`) : ""} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <FieldLabel>{ar ? "تاريخ إبلاغك بالخصم" : "Date you were told"}</FieldLabel>
          <PlatformDateField ar={ar} value={notifiedOn} onChange={setNotifiedOn} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <FieldLabel>{ar ? "المبلغ المخصوم (ر.س)" : "Amount deducted (SAR)"}</FieldLabel>
          <input type="number" min={0} dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)" }} />
        </label>
      </div>
      <StepHead label={ar ? "السبب" : "The reason"} />
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>{ar ? "خطأ غيرك، أو قوة قاهرة، أو أن التقدير مبالغ فيه" : "Someone else's fault, force majeure, or an inflated valuation"}</FieldLabel>
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
      <Checklist items={checks} dataKey="damage" />
      <span data-damage-objection-gate={gate.ok ? "ok" : gate.error} hidden={gate.ok} style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-warn-ink)", lineHeight: 1.7 }}>
        {gate.ok ? "" : (ar ? gate.reason : gate.reasonEn)}
      </span>
      <SendButton ready={gate.ok && !busy} onClick={send} dataAttr={{ "data-damage-objection-send": "" }}>
        {ar ? "أرسل الاعتراض" : "Send the objection"}
      </SendButton>
    </div>
  );
}
