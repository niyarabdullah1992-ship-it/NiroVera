import React, { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { uploadFileOrLocal } from "@/lib/localFileUpload";
import { ACCENT, NAVY, BORDER, SURFACE, BRAND_BORDER, BRAND_SOFT, DANGER } from "@/lib/platformStyles";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export default function ExpenseReceiptUploader({ value, fileName, onChange, ar }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return setError(ar ? "الصيغ المدعومة: PDF، JPG، PNG، WEBP." : "Supported formats: PDF, JPG, PNG, WEBP.");
    if (file.size > MAX_SIZE) return setError(ar ? "يجب ألا يتجاوز حجم الملف 10 ميجابايت." : "The file must not exceed 10 MB.");
    setError("");
    setUploading(true);
    try {
      const result = await uploadFileOrLocal(file);
      onChange(result.file_url, file.name);
    } catch (err) {
      setError(
        String(err?.message) === "file_too_large_local"
          ? (ar ? "ارفع ملفًا أصغر من 1.5 ميجابايت حتى تعود خدمة الرفع." : "Upload a file under 1.5 MB until the file service returns.")
          : (ar ? "تعذر رفع الإيصال. حاول مرة أخرى." : "Receipt upload failed. Please try again."),
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignSelf: "end" }}>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={upload} style={{ display: "none" }} />
      {!value ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            borderRadius: 10,
            border: `1px dashed ${BRAND_BORDER}`,
            background: BRAND_SOFT,
            padding: "10px 12px",
            fontSize: "13px",
            color: NAVY,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.5 : 1,
            fontFamily: "inherit",
          }}
        >
          {uploading ? <Loader2 style={{ width: 16, height: 16, color: ACCENT }} className="animate-spin" /> : <Upload style={{ width: 16, height: 16, color: ACCENT }} />}
          {uploading ? (ar ? "جارٍ رفع الإيصال..." : "Uploading receipt...") : (ar ? "رفع الإيصال — صورة أو PDF" : "Upload receipt — image or PDF")}
        </button>
      ) : (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: SURFACE,
          padding: "10px 12px",
        }}>
          <a href={value} target="_blank" rel="noreferrer" style={{ display: "flex", minWidth: 0, alignItems: "center", gap: "8px", fontSize: "13px", color: ACCENT, textDecoration: "none" }}>
            <FileText style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
          </a>
          <button type="button" onClick={() => onChange("", "")} style={{ border: "none", background: "transparent", color: DANGER, cursor: "pointer", padding: 4 }}>
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}
      {error && <p style={{ margin: 0, fontSize: "12px", color: DANGER }}>{error}</p>}
    </div>
  );
}
