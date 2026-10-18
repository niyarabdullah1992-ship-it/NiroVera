import React, { useState } from "react";
import { submitOtherRequest } from "@/lib/store";
import {
  FILE_CORRECTION_FIELDS,
  FILE_CORRECTION_NOT_HERE_AR,
  FILE_CORRECTION_NOT_HERE_EN,
  FILE_CORRECTION_TYPE,
  checkSubmitFileCorrectionGate,
  fileCorrectionCurrent,
  fileCorrectionField,
} from "@/lib/fileCorrection";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { hashConsentFile, readConsentFile } from "@/lib/writtenConsent";
import { BORDER, CARD, CONTROL_RADIUS, MUTED } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import AttachDropzone from "@/components/shared/AttachDropzone";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import { checkRequestFilesGate, requestAttachmentRule } from "@/lib/otherRequestDerivations";
import { toast } from "@/components/ui/use-toast";
import NvIcon from "@/components/shared/NvIcon";

const field = { fontFamily: "inherit", fontSize: 12.5, padding: "10px 12px", border: `1px solid ${BORDER}`, background: CARD, color: "var(--nv-ink)", outline: "none", width: "100%", boxSizing: "border-box", borderRadius: CONTROL_RADIUS };
const block = { padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 };
const label = { fontSize: 11.5, color: MUTED };
const mono = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" };

/**
 * «طلب تعديل الملف الوظيفي» — the employee picks one personal fact, writes the new value, attaches the
 * document when the fact comes from one, and HR approves; only then is the file written, in HR's name.
 */
export default function FileCorrectionRaise({ employee, companyId, ar = true, refresh, onSent }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = fileCorrectionField(key);
  const current = meta ? fileCorrectionCurrent(employee, key, ar) : "";
  const gate = checkSubmitFileCorrectionGate({ field: key, value, reason, files: file ? [file] : [], employee });
  const attach = requestAttachmentRule(FILE_CORRECTION_TYPE);

  const pickFile = async (picked) => {
    setFileError("");
    if (!picked) { setFile(null); return; }
    const shape = checkRequestFilesGate([{ name: picked.name, size: picked.size, type: picked.type }]);
    if (!shape.ok) { setFileError(ar ? shape.reason : shape.reasonEn); return; }
    setFileBusy(true);
    try {
      const [hash, url] = await Promise.all([hashConsentFile(picked), readConsentFile(picked)]);
      setFile({ name: picked.name, size: picked.size, type: picked.type, url, hash });
    } catch {
      setFileError(ar ? "تعذّر قراءة الملف." : "Could not read the file.");
    } finally {
      setFileBusy(false);
    }
  };

  const choose = (next) => {
    setKey(next);
    setValue("");
  };

  const send = () => {
    if (!gate.ok || busy || !employee?.id) return;
    setBusy(true);
    try {
      const res = submitOtherRequest(companyId, employee.id, {
        type: FILE_CORRECTION_TYPE,
        field: key,
        newValue: value,
        reason: reason.trim(),
        files: file ? [file] : [],
        requestedById: employee.id,
        date: todayRiyadh(),
      });
      if (!res?.ok) {
        toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" });
        return;
      }
      toast({ description: ar ? "أُرسل الطلب إلى الموارد البشرية — يُكتب في ملفك بعد اعتماده." : "Sent to HR — it is written to your file once approved." });
      setKey(""); setValue(""); setReason(""); setFile(null);
      refresh?.();
      onSent?.();
    } finally {
      setBusy(false);
    }
  };

  const input = !meta ? null : meta.input === "date" ? (
    <PlatformDateField ar={ar} value={value} onChange={setValue} />
  ) : meta.input === "select" ? (
    <SubTypeGrid label={ar ? meta.ar : meta.en}>
      {meta.options.map((opt) => (
        <SubTypeOption key={opt.value} dataKey={opt.value} on={value === opt.value} title={ar ? opt.ar : opt.en} onClick={() => setValue(opt.value)} />
      ))}
    </SubTypeGrid>
  ) : (
    <input
      data-fc-value="1"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      dir={meta.input === "text" ? "auto" : "ltr"}
      inputMode={meta.input === "phone" || meta.input === "nationalId" ? "numeric" : undefined}
      placeholder={meta.input === "phone" ? "05XXXXXXXX" : meta.input === "iban" ? "SA00 0000 0000 0000 0000 0000" : meta.input === "nationalId" ? "1XXXXXXXXX" : ""}
      style={{ ...field, ...(meta.input === "text" ? {} : mono), textAlign: meta.input === "text" ? "start" : "left" }}
    />
  );

  return (
    <div data-file-correction-raise="1">
      <div style={block}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "البيان المطلوب تعديله" : "The fact to change"}</span>
        <SubTypeGrid label={ar ? "البيان" : "Fact"}>
          {FILE_CORRECTION_FIELDS.map((row) => (
            <SubTypeOption key={row.key} dataKey={row.key} on={key === row.key} title={ar ? row.ar : row.en} sub={row.proof ? (ar ? "بمرفق" : "With proof") : undefined} onClick={() => choose(row.key)} />
          ))}
        </SubTypeGrid>
        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{ar ? FILE_CORRECTION_NOT_HERE_AR : FILE_CORRECTION_NOT_HERE_EN}</span>
      </div>

      {meta ? (
        <div style={block}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span style={label}>{ar ? "في ملفك الآن" : "On your file now"}</span>
              <span data-fc-current="1" dir="auto" style={{ ...field, background: "var(--nv-soft, #F6F8F7)", color: current ? "var(--nv-ink)" : MUTED, ...(current && meta.input !== "text" && meta.input !== "select" ? mono : {}), overflowWrap: "anywhere" }}>
                {current || (ar ? "غير مسجّل" : "Not on file")}
              </span>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span style={label}>{ar ? "القيمة الصحيحة" : "Correct value"}</span>
              {meta.input === "select" ? null : input}
            </label>
          </div>
          {meta.input === "select" ? input : null}

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={label}>{ar ? "سبب التعديل" : "Why it changes"}</span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...field, resize: "vertical" }} />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={label}>{meta.proof ? (ar ? "الوثيقة التي يُعتمد منها البيان" : "The document the fact is taken from") : (ar ? "مرفق — اختياري" : "Attachment — optional")}</span>
            <AttachDropzone
              ar={ar}
              accept={attach.accept}
              required={!!meta.proof}
              busy={fileBusy}
              file={file}
              error={fileError}
              onPick={pickFile}
              onClear={() => { setFile(null); setFileError(""); }}
            />
          </div>

          <span data-fc-gate={gate.ok ? "ok" : gate.error} style={{ fontSize: 11.5, fontWeight: 600, color: gate.ok ? "#2F6B43" : "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7 }}>
            {gate.ok ? <><NvIcon name="check" size={12} strokeWidth={2} /> {ar ? "جاهز للإرسال إلى الموارد البشرية" : "Ready to send to HR"}</> : (ar ? gate.reason : gate.reasonEn)}
          </span>
          <button type="button" data-fc-send="1" disabled={!gate.ok || busy} onClick={send} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, height: 42, border: "none", borderRadius: 8, background: gate.ok ? "#0B3D27" : "var(--nv-line)", color: gate.ok ? "#fff" : MUTED, cursor: gate.ok ? "pointer" : "default" }}>
            {ar ? "أرسل الطلب" : "Send the request"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
