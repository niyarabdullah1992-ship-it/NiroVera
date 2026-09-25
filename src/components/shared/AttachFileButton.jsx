import React, { forwardRef, useRef } from "react";

/**
 * The platform file control: a white pill, sage edge, navy label.
 * The native file input stays off-screen.
 */
const AttachFileButton = forwardRef(function AttachFileButton({
  ar = true,
  label,
  accept,
  busy = false,
  disabled = false,
  inline = false,
  onPick,
}, ref) {
  const localRef = useRef(null);
  const inputRef = ref || localRef;
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
        className={inline ? "nv-attach nv-attach--inline" : "nv-attach"}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {text}
      </button>
    </>
  );
});

export default AttachFileButton;
