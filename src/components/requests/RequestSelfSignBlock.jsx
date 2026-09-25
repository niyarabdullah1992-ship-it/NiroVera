import React, { useRef } from "react";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import AttachFileButton from "@/components/shared/AttachFileButton";
import { CONSENT_MINISTRY_HINT_AR, CONSENT_MINISTRY_HINT_EN } from "@/lib/writtenConsent";
import { BORDER, CARD, MUTED } from "@/lib/platformStyles";

const OK = "#137a49";

function FileMeta({ file, ar, linkLabel, onClear, busy, idle }) {
  if (file?.name) {
    return (
      <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
        <span style={{ color: OK }}>{file.name}{file.hash ? ` · ${file.hash}` : ""}</span>
        <ConsentFileLink file={file} ar={ar}>{linkLabel}</ConsentFileLink>
        <button type="button" onClick={onClear} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "4px 10px", border: `1px solid ${BORDER}`, background: CARD, color: MUTED, cursor: "pointer" }}>
          {ar ? "أزل" : "Remove"}
        </button>
      </span>
    );
  }
  if (!busy && !idle) return null;
  return <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>{busy ? (ar ? "جارٍ تحميل الملف…" : "Loading the file…") : idle}</span>;
}

export default function RequestSelfSignBlock({
  ar,
  file,
  paper,
  fileBusy,
  paperBusy,
  fileError,
  paperError,
  onPickFile,
  onClearFile,
  onPickPaper,
  onClearPaper,
  accept,
  fileInputRef,
  required = true,
  requirePaper = true,
  title,
  hint,
  fileLabel,
  paperLabel,
  downloadLabel,
}) {
  const paperRef = useRef(null);
  const blurb = hint === undefined
    ? (ar ? CONSENT_MINISTRY_HINT_AR : CONSENT_MINISTRY_HINT_EN)
    : hint;
  const sourceReady = !!file?.url;
  const paperReady = !!paper?.url;
  const showSourceInput = !sourceReady && !fileBusy;
  const showPaperInput = sourceReady && requirePaper && !paperReady && !paperBusy;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, border: `1px dashed ${sourceReady ? "#bfe6d2" : BORDER}`, background: sourceReady ? "#f2faf6" : CARD, padding: "12px 12px" }}>
      {title ? <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span> : null}
      {blurb ? <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>{blurb}</span> : null}

      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontSize: 11, color: MUTED }}>{fileLabel || (ar ? "أرفق الملف" : "Attach the file")}</span>
        {showSourceInput ? (
          <AttachFileButton
            ref={fileInputRef}
            ar={ar}
            accept={accept}
            busy={fileBusy}
            label={fileLabel || (ar ? "أرفق الملف" : "Attach the file")}
            onPick={onPickFile}
          />
        ) : null}
        <FileMeta
          file={file}
          ar={ar}
          linkLabel={downloadLabel || (ar ? "نزّل للتوقيع في قسم التوقيع" : "Download to sign in Digital signing")}
          onClear={() => {
            if (fileInputRef?.current) fileInputRef.current.value = "";
            onClearFile?.();
          }}
          busy={fileBusy}
          idle={required ? "" : (ar ? "اختياري." : "Optional.")}
        />
      </label>
      {fileError ? <span style={{ fontSize: 11, color: "#8a1c2b" }}>{fileError}</span> : null}

      {sourceReady && requirePaper ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{paperLabel || (ar ? "ارفع النسخة الموقّعة" : "Upload the signed copy")}</span>
          {showPaperInput ? (
            <AttachFileButton
              ref={paperRef}
              ar={ar}
              accept={accept}
              busy={paperBusy}
              label={paperLabel || (ar ? "أرفق النسخة الموقّعة" : "Attach the signed copy")}
              onPick={onPickPaper}
            />
          ) : null}
          <FileMeta
            file={paper}
            ar={ar}
            linkLabel={ar ? "نزّل النسخة الموقّعة" : "Download the signed copy"}
            onClear={() => {
              if (paperRef.current) paperRef.current.value = "";
              onClearPaper?.();
            }}
            busy={paperBusy}
            idle=""
          />
          {paperError ? <span style={{ fontSize: 11, color: "#8a1c2b" }}>{paperError}</span> : null}
        </label>
      ) : null}
    </div>
  );
}
