import React from "react";
import { Loader2, Upload } from "lucide-react";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

const fileInputCover = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
  fontSize: 18,
};

export default function PowerCareUploadZone({
  onClick,
  disabled,
  loading,
  title,
  description,
  formats,
  compact = false,
  label,
  inputRef,
  accept,
  onFileChange,
}) {
  const isArabic = /[\u0600-\u06FF]/.test(`${title || ""} ${description || ""}`);
  const uploadLabel = label || (isArabic ? "رفع ملف" : "Upload file");
  const boxStyle = {
    position: "relative",
    width: "100%",
    minHeight: compact ? 88 : 148,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
        padding: compact ? "16px 18px" : "28px 20px",
    borderRadius: 14,
    border: `1px dashed ${BORDER}`,
    background: SURFACE,
    cursor: disabled || loading ? "default" : "pointer",
    fontFamily: "inherit",
    opacity: disabled ? 0.55 : 1,
    transition: "border-color .18s ease, background .18s ease",
  };
  const inner = (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}>
      <span style={{
        width: 40,
        height: 40,
        borderRadius: 11,
        background: "#EEF2F6",
        color: NAVY,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {loading ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : <Upload style={{ width: 18, height: 18 }} />}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{title || uploadLabel}</span>
      {description ? <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{description}</span> : null}
      {formats ? <span style={{ fontSize: 11, color: MUTED }}>{formats}</span> : null}
    </span>
  );

  if (typeof onFileChange === "function") {
    return (
      <label className={`nv-upload-zone${compact ? " nv-upload-zone--compact" : ""}`} style={boxStyle} aria-label={uploadLabel}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onFileChange}
          disabled={disabled || loading}
          style={fileInputCover}
        />
        {inner}
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={uploadLabel}
      className={`nv-upload-zone${compact ? " nv-upload-zone--compact" : ""}`}
      style={boxStyle}
    >
      {inner}
    </button>
  );
}
