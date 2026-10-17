import React, { forwardRef, useRef, useState } from "react";
import NvIcon from "@/components/shared/NvIcon";

/**
 * The one attachment control in طلباتي: a calm dropzone row (dashed hairline, radius 8, paperclip),
 * «أرفق ملفاً» with «اختياري» or «مطلوب», the accepted types and size limit in muted text, and
 * drag-and-drop. Once a file is attached it becomes a row: name, size in mono, and a remove cross.
 * The native input stays off-screen; `onPick(file | null)` receives the picked File.
 */
function formatSize(bytes, ar) {
  const n = Number(bytes) || 0;
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} ${ar ? "ك.ب" : "KB"}`;
  return `${(n / (1024 * 1024)).toFixed(1)} ${ar ? "م.ب" : "MB"}`;
}

function Clip() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

const AttachDropzone = forwardRef(function AttachDropzone({
  ar = true,
  accept = "application/pdf,image/jpeg,image/png,image/webp",
  required = false,
  busy = false,
  disabled = false,
  file = null,
  error = "",
  label,
  hint,
  typesLabel,
  showNeed = true,
  onPick,
  onClear,
}, ref) {
  const localRef = useRef(null);
  const inputRef = ref || localRef;
  const [over, setOver] = useState(false);
  const need = required ? (ar ? "مطلوب" : "Required") : (ar ? "اختياري" : "Optional");
  // typesLabel === null hides the muted types line (callers that do not know their limits).
  const types = typesLabel === null ? "" : (typesLabel || (ar ? "PDF أو صورة · حتى 25 ميجابايت" : "PDF or image · up to 25 MB"));
  const hintLine = [hint, types].filter(Boolean).join(" · ");
  const open = () => { if (!disabled && !busy) inputRef.current?.click(); };

  return (
    <div className="nv-dropzone-wrap" data-attach={file ? "filled" : "empty"} data-required={required ? "1" : "0"}>
      <input
        ref={inputRef}
        className="nv-attach-native"
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || busy}
        onChange={(event) => {
          onPick?.(event.target.files?.[0] || null);
          event.target.value = "";
        }}
      />
      {file?.name ? (
        <div className="nv-dropzone-file">
          <span className="nv-dropzone-clip"><Clip /></span>
          {file.url ? (
            <a className="nv-dropzone-name" href={file.url} download={file.name} dir="auto">{file.name}</a>
          ) : (
            <span className="nv-dropzone-name" dir="auto">{file.name}</span>
          )}
          {file.size ? <span className="nv-dropzone-size" dir="ltr">{formatSize(file.size, false)}</span> : null}
          <button
            type="button"
            className="nv-dropzone-remove"
            aria-label={ar ? "أزل المرفق" : "Remove attachment"}
            title={ar ? "أزل المرفق" : "Remove attachment"}
            onClick={() => (onClear ? onClear() : onPick?.(null))}
          >
            <NvIcon name="cross" size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`nv-dropzone${over ? " is-over" : ""}`}
          disabled={disabled || busy}
          onClick={open}
          onDragOver={(event) => { event.preventDefault(); if (!over) setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            const dropped = event.dataTransfer?.files?.[0];
            if (dropped && !disabled && !busy) onPick?.(dropped);
          }}
        >
          <span className="nv-dropzone-clip"><Clip /></span>
          <span className="nv-dropzone-copy">
            <span className="nv-dropzone-line">
              <span className="nv-dropzone-label">{busy ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…") : (label || (ar ? "أرفق ملفاً" : "Attach a file"))}</span>
              {showNeed ? <span className="nv-dropzone-need" data-need={required ? "required" : "optional"}>{need}</span> : null}
            </span>
            {hintLine ? <span className="nv-dropzone-hint">{hintLine}</span> : null}
          </span>
        </button>
      )}
      {error ? <span className="nv-dropzone-error" role="alert">{error}</span> : null}
    </div>
  );
});

export default AttachDropzone;
