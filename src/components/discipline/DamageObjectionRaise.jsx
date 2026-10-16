import React, { useEffect, useState } from "react";
import { submitOtherRequest } from "@/lib/store";
import { DAMAGE_OBJECTION_TYPE, checkDamageObjectionGate, damageObjectionDeadline, workingDaysBetween } from "@/lib/rightsRequests";
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

  return (
    <article data-damage-objection-raise="" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 10, overflow: "hidden", maxWidth: 760, width: "100%", boxSizing: "border-box" }}>
      <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ fontSize: 15 }}>{ar ? "اعتراض على خصم إتلاف" : "Object to a damage deduction"}</strong>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#0B3D27" }}>{ar ? "نظام العمل — المادة 91 · خلال 15 يوم عمل من إبلاغك" : "Labour Law — Art. 91 · within 15 working days of notice"}</span>
        {prefill?.lineRef ? <span data-damage-objection-line="" style={{ fontSize: 12, color: "var(--nv-ink2)", overflowWrap: "anywhere" }}>{ar ? `عن الخصم: ${prefill.lineRef}` : `On deduction: ${prefill.lineRef}`}</span> : null}
      </header>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
          {ar
            ? "لصاحب العمل أن يقتطع ما يلزم لإصلاح ما أتلفته بخطئك، بما لا يزيد على أجر خمسة أيام في الشهر، ولا يُحسم إن كان التلف بخطأ غيرك أو بقوة قاهرة. ولك أن تتظلم مما نُسب إليك أو من تقدير المبلغ خلال خمسة عشر يوم عمل من إبلاغك، وإلا سقط حقك. الاعتراض هنا يصل الإدارة أولاً؛ والتظلم الرسمي أمام المحكمة العمالية."
            : "The employer may deduct up to five days' wage a month for damage you caused — none if caused by others or force majeure. You may object to the fault or the valuation within fifteen working days of being told, or the right lapses. This reaches management first; the formal forum is the labour court."}
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 9 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={label}>{ar ? "تاريخ إبلاغك بالخصم" : "Date you were told"}</span>
            <PlatformDateField ar={ar} value={notifiedOn} onChange={setNotifiedOn} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={label}>{ar ? "المبلغ المخصوم (ر.س)" : "Amount deducted (SAR)"}</span>
            <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} style={field} />
          </label>
        </div>
        {last ? (
          <span data-damage-objection-deadline={last} style={{ fontSize: 11.5, fontWeight: 600, color: gate.error === "OBJECTION_LATE" ? "var(--nv-bad-ink)" : "#2F6B43" }}>
            {ar
              ? `آخر يوم للاعتراض: ${regulationDate(last)}${left ? ` · بقي ${left} يوم عمل` : ""}`
              : `Last day to object: ${last}${left ? ` · ${left} working days left` : ""}`}
          </span>
        ) : null}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={label}>{ar ? "سبب اعتراضك" : "Why you object"}</span>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...field, resize: "vertical" }} />
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AttachFileButton ar={ar} accept="application/pdf,image/jpeg,image/png,image/webp" busy={fileBusy} label={file ? (ar ? "تغيير المرفق" : "Change attachment") : (ar ? "أرفق ما يثبت — اختياري" : "Attach proof — optional")} onPick={pickFile} />
          {file ? <span style={{ fontSize: 11.5, overflowWrap: "anywhere" }} dir="ltr">{file.name}</span> : null}
        </div>
        <span data-damage-objection-gate={gate.ok ? "ok" : gate.error} style={{ fontSize: 11.5, fontWeight: 600, color: gate.ok ? "#2F6B43" : "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7 }}>
          {gate.ok ? <><NvIcon name="check" size={12} strokeWidth={2} /> {ar ? "جاهز للإرسال" : "Ready to send"}</> : (ar ? gate.reason : gate.reasonEn)}
        </span>
        <button type="button" data-damage-objection-send="" disabled={!gate.ok || busy} onClick={send} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, height: 42, border: "none", borderRadius: 8, background: gate.ok ? "#0B3D27" : "var(--nv-line)", color: gate.ok ? "#fff" : MUTED, cursor: gate.ok ? "pointer" : "default" }}>
          {ar ? "أرسل الاعتراض" : "Send the objection"}
        </button>
      </div>
    </article>
  );
}
