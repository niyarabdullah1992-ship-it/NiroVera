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
    !article106 && !rejectGate.ok ? { tone: "stop", text: ar ? rejectGate.reason : rejectGate.reasonEn } : null,
  ].filter(Boolean);

  return (
    <div className="nv-req-decision" dir={ar ? "rtl" : "ltr"}>
      <section className="nv-req-decision-col">
        <header className="nv-req-decision-head">
          <strong>{ar ? "قرار الجهة المعتمدة" : "Approver decision"}</strong>
          <em>{showFile ? hint : (ar ? "يُحفظ مع الطلب" : "Stored with the request")}</em>
        </header>
        <div className="nv-req-decision-side">
          {showFile ? (
            <div className="nv-req-decision-file">
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
                className="nv-attach nv-req-decision-attach"
                disabled={busy || fileBusy}
                onClick={() => fileRef.current?.click()}
              >
                {fileBusy ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…") : attachLabel}
              </button>
              {file?.name ? (
                <span className="nv-req-decision-chosen">
                  <span>{ar ? "المختار" : "Chosen"}</span>
                  <strong dir="ltr">{file.name}</strong>
                  <button type="button" onClick={onClearFile}>{ar ? "أزل" : "Remove"}</button>
                </span>
              ) : null}
              {fileError ? <span className="nv-req-decision-hint is-stop">{fileError}</span> : null}
            </div>
          ) : (
            <span className="nv-req-decision-quiet">{ar ? "لا مرفق لهذا القرار" : "No file on this decision"}</span>
          )}
          {showExamNotice ? (
            <label className="nv-req-decision-exam">
              <span>{ar ? "تاريخ صدور ورقة المواعيد" : "Timetable issue date"}</span>
              <PlatformDateField ar={ar} value={examNotice} onChange={onExamNotice} />
            </label>
          ) : null}
        </div>
      </section>

      <section className="nv-req-decision-col">
        <header className="nv-req-decision-head">
          <strong>{ar ? "سبب الرفض أو الإعادة" : "Reason to refuse or return"}</strong>
          <em>{ar ? "يُطلب عند الرفض أو الإعادة فقط، ويُحفظ في سجل التدقيق" : "Required only to refuse or return, and stored on the audit trail"}</em>
        </header>
        <label className="nv-req-decision-reason">
          <textarea
            value={note}
            rows={3}
            onChange={(event) => onNote?.(event.target.value)}
            placeholder={ar ? "اكتب السبب هنا" : "Write the reason here"}
          />
        </label>
      </section>

      <section className="nv-req-decision-col">
        <header className="nv-req-decision-head">
          <strong>{ar ? "الإجراء" : "Action"}</strong>
          <em>{ar ? "اعتماد أو إعادة أو رفض" : "Approve, return, or refuse"}</em>
        </header>
        <div className="nv-req-decision-actions">
          <button
            type="button"
            className="nv-req-decision-primary"
            disabled={!approveOk}
            onClick={onApprove}
          >
            {approveLabel || (ar ? "اعتمد وأصدر الملف" : "Approve and issue the file")}
          </button>
          <button
            type="button"
            className="nv-req-decision-secondary"
            disabled={busy || !noteReady}
            onClick={onRevise}
          >
            {ar ? "أعده للتعديل" : "Return for a change"}
          </button>
          {article106 || !rejectGate.ok ? (
            <button type="button" className="nv-req-decision-refuse" disabled>
              {ar ? "ارفض" : "Refuse"}
            </button>
          ) : (
            <button
              type="button"
              className="nv-req-decision-refuse"
              disabled={busy || refuseBlocked}
              onClick={onReject}
            >
              {ar ? "ارفض" : "Refuse"}
            </button>
          )}
        </div>
      </section>

      {gateNotes.length ? (
        <div className="nv-req-decision-notes">
          {gateNotes.map((item) => (
            <p key={item.text} className={`nv-req-decision-note${item.tone ? ` is-${item.tone}` : ""}`}>{item.text}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
