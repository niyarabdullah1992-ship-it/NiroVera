import React, { forwardRef, useRef } from "react";
import AttachDropzone from "@/components/shared/AttachDropzone";

/**
 * The platform file control. Block use renders the one طلباتي dropzone (dashed hairline, radius 8,
 * paperclip, drag-and-drop) so every form attaches files the same way; `inline` keeps the small
 * text-button for tight rows. The native file input stays off-screen.
 */
const AttachFileButton = forwardRef(function AttachFileButton({
  ar = true,
  label,
  accept,
  busy = false,
  disabled = false,
  inline = false,
  required,
  hint,
  typesLabel,
  onPick,
}, ref) {
  const localRef = useRef(null);
  const inputRef = ref || localRef;

  if (!inline) {
    return (
      <AttachDropzone
        ref={inputRef}
        ar={ar}
        accept={accept}
        busy={busy}
        disabled={disabled}
        label={label}
        hint={hint}
        required={Boolean(required)}
        showNeed={required !== undefined}
        typesLabel={typesLabel === undefined ? (/pdf/i.test(accept || "") ? undefined : null) : typesLabel}
        onPick={onPick}
      />
    );
  }

  const text = busy
    ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…")
    : (label || (ar ? "أرفق الملف" : "Attach the file"));

  return (
    <>
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
      <button
        type="button"
        className="nv-attach nv-attach--inline"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {text}
      </button>
    </>
  );
});

export default AttachFileButton;
