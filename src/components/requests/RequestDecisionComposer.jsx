import React, { useRef } from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";

/**
 * Calm RTL decision cell for إدارة.
 * One filled accent (approve). Reason is a textarea, required only to refuse or return.
 * The native file input stays off-screen; the visible control is Arabic.
 */
export default function RequestDecisionComposer({
  ar = true,
  busy = false,
  note = "",
  onNote,
  showFile = false,
  fileOptional = true,
  fileTitle = "",
  fileLabel,
  fileHint,
  file = null,
  fileBusy = false,
  fileError = "",
  accept,
  onPickFile,
  onClearFile,
  showExamNotice = false,
  examNotice = "",
  onExamNotice,
  approveGate = { ok: true },
  rejectGate = { ok: true },
  refuseBlocked = false,
  noteReady = false,
  article106 = false,
  approveLabel,
  onApprove,
  onReject,
  onRevise,
  grounds = null,
  groundName = "",
  ground = "",
  onGround,
  verified = false,
  onVerified,
}) {
  const fileRef = useRef(null);
  const approveOk = !!approveGate.ok && !busy && !fileBusy;
  const attachLabel = file?.name
    ? (ar ? "تغيير النسخة المختومة" : "Change the stamped copy")
    : (fileLabel || (ar ? "أرفق النسخة المختومة" : "Attach the stamped copy"));
  const hint = fileHint || (fileOptional
    ? (ar ? "اختياري · PDF أو صورة" : "Optional · PDF or image")
    : (ar ? "مطلوب قبل الاعتماد · PDF أو صورة" : "Required before approval · PDF or image"));

  const gateNotes = [
    !approveGate.ok ? { tone: "stop", text: ar ? approveGate.reason : approveGate.reasonEn } : null,
    approveGate.ok && approveGate.via === "late_notice" ? { tone: "ok", text: ar ? approveGate.reason : approveGate.reasonEn } : null,
    article106 ? { tone: "", text: ar ? "المادة 106: العمل إجباري — يجوز رد اختيار التعويض فقط." : "Article 106: the work is mandatory — you may only return the compensation choice." } : null,
    !article106 && !rejectGate.ok && !["REFUSAL_GROUND_REQUIRED", "REFUSAL_VERIFY_REQUIRED"].includes(rejectGate.error) ? { tone: "stop", text: ar ? rejectGate.reason : rejectGate.reasonEn } : null,
  ].filter(Boolean);

  // One decision bar: reason (and the stamped copy when the type issues one), then the three outcomes in a row.
  return (
    <div className="nv-dec" dir={ar ? "rtl" : "ltr"} data-req-decision="1">
      <div className="nv-dec-head">
        <strong>{ar ? "قرارك" : "Your decision"}</strong>
        <span>{ar ? "السبب مطلوب للرفض أو الإعادة فقط، ويُحفظ في سجل التدقيق باسمك." : "A reason is required only to refuse or return, and is stored on the audit trail in your name."}</span>
      </div>
      <div className={`nv-dec-body${showFile || showExamNotice ? " has-side" : ""}`}>
        {grounds && grounds.length ? (
          <fieldset className="nv-dec-grounds" data-refusal-grounds="1">
            <legend>{ar ? "حق نظامي — يُرفض فقط إن لم يثبت شرطه" : "A statutory right — refused only if its condition is not met"}</legend>
            {grounds.map((g) => (
              <label key={g.key} className={ground === g.key ? "is-on" : ""}>
                <input type="radio" name={`ground-${groundName || grounds.map((x) => x.key).join("")}`} checked={ground === g.key} onChange={() => onGround?.(g.key)} />
                <span>{ar ? g.ar : g.en}</span>
              </label>
            ))}
            <label className={`nv-dec-verify${verified ? " is-on" : ""}`}>
              <input type="checkbox" checked={verified} onChange={(e) => onVerified?.(e.target.checked)} />
              <span>{ar ? "تحققت من السبب قبل الرفض" : "I checked the ground before refusing"}</span>
            </label>
            <em>{ar ? "خطأ في التعبئة؟ أعده للتعديل بدل الرفض. ولا يُرفض لظروف العمل." : "A filing mistake? Return it for a change instead. Never refused for work reasons."}</em>
          </fieldset>
        ) : null}
        <label className="nv-dec-reason">
          <span>{grounds && grounds.length ? (ar ? "تفصيل (اختياري للرفض، مطلوب للإعادة)" : "Detail (optional to refuse, required to return)") : (ar ? "سبب الرفض أو الإعادة" : "Reason to refuse or return")}</span>
          <textarea
            value={note}
            rows={2}
            onChange={(event) => onNote?.(event.target.value)}
            placeholder={ar ? "اكتب السبب هنا" : "Write the reason here"}
          />
        </label>
        {showFile || showExamNotice ? (
          <div className="nv-dec-side">
            {showFile ? (
              <div className="nv-dec-file">
                <span>{fileTitle || (fileOptional ? (ar ? "النسخة المختومة" : "Stamped copy") : (ar ? "ملف الموافقة" : "Consent letter"))} <em>{hint}</em></span>
                <input
                  ref={fileRef}
                  className="nv-req-file-native"
                  type="file"
                  accept={accept}
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    onPickFile?.(event.target.files?.[0] || null);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="nv-dec-attach"
                  disabled={busy || fileBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {fileBusy ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…") : attachLabel}
                </button>
                {file?.name ? (
                  <span className="nv-dec-chosen">
                    <strong dir="ltr">{file.name}</strong>
                    <button type="button" onClick={onClearFile}>{ar ? "أزل" : "Remove"}</button>
                  </span>
                ) : null}
                {fileError ? <span className="nv-dec-note is-stop">{fileError}</span> : null}
              </div>
            ) : null}
            {showExamNotice ? (
              <label className="nv-dec-file">
                <span>{ar ? "تاريخ صدور ورقة المواعيد" : "Timetable issue date"}</span>
                <PlatformDateField ar={ar} value={examNotice} onChange={onExamNotice} />
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
      {gateNotes.length ? (
        <div className="nv-dec-notes">
          {gateNotes.map((item) => (
            <p key={item.text} className={`nv-dec-note${item.tone ? ` is-${item.tone}` : ""}`}>{item.text}</p>
          ))}
        </div>
      ) : null}
      <div className="nv-dec-actions">
        <button type="button" className="nv-dec-approve" disabled={!approveOk} onClick={onApprove}>
          {approveLabel || (ar ? "اعتمد وأصدر الملف" : "Approve and issue the file")}
        </button>
        <button type="button" className="nv-dec-return" disabled={busy || !noteReady} onClick={onRevise}>
          {ar ? "أعده للتعديل" : "Return for a change"}
        </button>
        {article106 || !rejectGate.ok ? (
          <button type="button" className="nv-dec-refuse" disabled>{ar ? "ارفض" : "Refuse"}</button>
        ) : (
          <button type="button" className="nv-dec-refuse" disabled={busy || refuseBlocked} onClick={onReject}>
            {ar ? "ارفض" : "Refuse"}
          </button>
        )}
      </div>
    </div>
  );
}
