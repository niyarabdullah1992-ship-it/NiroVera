import React, { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { base44 } from "@/api/base44Client";
import { Paperclip, X, FileText, Loader2, Download } from "lucide-react";
import { MUTED, INK, SURFACE } from "@/lib/platformStyles";

const isImage = (name = "", type = "") =>
  /^image\/(png|jpe?g|gif|webp|svg)$/i.test(type) || /\.(png|jpe?g|gif|webp|svg)$/i.test(name);

/** variant: "button" (default label) | "icon" (WhatsApp-style paperclip in composer). */
export default function CommentFiles({
  files,
  setFiles,
  disabled,
  variant = "button",
  showList = true,
  showAttach = true,
}) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const iconOnly = variant === "icon";

  const handleFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;
    setUploading(true);
    const newFiles = [];
    for (const f of Array.from(fileList)) {
      try {
        const up = await base44.integrations.Core.UploadFile({ file: f });
        newFiles.push({ url: up.file_url, name: f.name, type: f.type || "file" });
      } catch {
        alert(`${f.name}: ${t("attachmentFailed")}`);
      }
    }
    setUploading(false);
    if (newFiles.length) setFiles([...(files || []), ...newFiles]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (i) => {
    setFiles((files || []).filter((_, idx) => idx !== i));
  };

  const count = (files || []).length;
  const list = showList && count > 0 ? (
    <div className="flex flex-wrap gap-1.5" style={iconOnly ? { width: "100%", padding: "0 18px 8px" } : undefined}>
      {(files || []).map((f, i) => (
        <div
          key={i}
          className="group relative flex items-center gap-1.5 pe-7 ps-2 py-1 rounded-md text-xs font-body max-w-[200px]"
          style={{ background: SURFACE, border: "1px solid var(--nv-line)", color: INK }}
        >
          {isImage(f.name, f.type) ? (
            <img src={f.url} alt={f.name} className="w-4 h-4 rounded object-cover" />
          ) : (
            <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--nv-ok-ink)" }} />
          )}
          <a href={f.url} target="_blank" rel="noopener noreferrer" download={f.name} className="truncate hover:underline" title={f.name} style={{ color: INK }}>
            {f.name}
          </a>
          <button type="button" onClick={() => removeAt(i)} className="absolute end-0.5 top-0.5 p-0.5 rounded hover:bg-black/5" title={t("removeFile")}>
            <X className="w-3 h-3" style={{ color: MUTED }} />
          </button>
        </div>
      ))}
    </div>
  ) : null;

  const trigger = showAttach ? (
    <>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        title={uploading ? t("uploading") : t("attachFile")}
        aria-label={uploading ? t("uploading") : t("attachFile")}
        style={iconOnly ? {
          width: 38,
          height: 38,
          borderRadius: 999,
          border: "none",
          background: "transparent",
          color: MUTED,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled || uploading ? "not-allowed" : "pointer",
          opacity: disabled || uploading ? 0.5 : 1,
          flexShrink: 0,
          fontFamily: "inherit",
          position: "relative",
        } : undefined}
        className={iconOnly ? undefined : "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-body border border-border hover:bg-muted transition-colors disabled:opacity-50"}
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className={iconOnly ? "w-5 h-5" : "w-3.5 h-3.5"} strokeWidth={iconOnly ? 1.75 : 2} />}
        {!iconOnly && (uploading ? t("uploading") : count > 0 ? `${t("attachFile")} (${count})` : t("attachFile"))}
        {iconOnly && count > 0 && !uploading && (
          <span
            style={{
              position: "absolute",
              top: 4,
              insetInlineEnd: 4,
              minWidth: 14,
              height: 14,
              padding: "0 3px",
              borderRadius: 20,
              background: "var(--nv-btn-fill)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              lineHeight: "14px",
              textAlign: "center",
            }}
          >
            {count}
          </span>
        )}
      </button>
    </>
  ) : null;

  if (iconOnly && showAttach && !showList) return trigger;
  if (iconOnly && !showAttach) return list;

  return (
    <div className="space-y-1.5">
      {list}
      {trigger}
    </div>
  );
}

const isAudio = (name = "", type = "") => /^audio\//i.test(type) || /\.(webm|mp3|wav|m4a|ogg)$/i.test(name);

export function CommentAttachments({ files }) {
  const { t } = useI18n();
  if (!files || !files.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {files.map((f, i) =>
        isAudio(f.name, f.type) ? (
          <audio key={i} src={f.url} controls className="h-8 max-w-[220px]" />
        ) : (
          <a
            key={i}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            download={f.name}
            className="group inline-flex items-center gap-1.5 ps-2 pe-2.5 py-1 rounded-md bg-muted/70 border border-border text-xs font-body hover:bg-muted transition-colors max-w-[220px]"
            title={f.name}
          >
            {isImage(f.name, f.type) ? (
              <img src={f.url} alt={f.name} className="w-4 h-4 rounded object-cover" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
            )}
            <span className="truncate text-foreground">{f.name}</span>
            <Download className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        )
      )}
    </div>
  );
}