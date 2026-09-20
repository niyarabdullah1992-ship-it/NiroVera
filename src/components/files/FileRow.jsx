import React, { useState } from "react";
import { FileText, Image as ImageIcon, FileSpreadsheet, File as FileIcon, Download, Trash2, Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import RenameDialog from "@/components/files/RenameDialog";
import { BORDER, MUTED, NAVY, NEUTRAL, CARD } from "@/lib/platformStyles";
import { uiDateLocale } from "@/lib/dateFormat";
import { identityIconWrap } from "@/components/shared/IdentityCard";

function fileIcon(mimeType = "", name = "") {
  const n = name.toLowerCase();
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.includes("pdf") || n.endsWith(".pdf")) return FileText;
  if (mimeType.includes("sheet") || n.endsWith(".xlsx") || n.endsWith(".csv")) return FileSpreadsheet;
  return FileIcon;
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const iconBtn = {
  width: 28,
  height: 28,
  border: "none",
  background: "transparent",
  color: MUTED,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

export default function FileRow({ file, onDelete, onRename, stationName }) {
  const { t, lang } = useI18n();
  const [renameOpen, setRenameOpen] = useState(false);
  const Icon = fileIcon(file.mimeType, file.name);
  const meta = [
    formatSize(file.size),
    file.createdAt ? new Date(file.createdAt).toLocaleDateString(uiDateLocale(lang)) : "",
    file.uploadedBy ? `${t("uploadedBy")} ${file.uploadedBy}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
      }}
    >
      <span style={{ ...identityIconWrap, width: 32, height: 32, borderRadius: 9 }}>
        <Icon style={{ width: 15, height: 15 }} strokeWidth={1.75} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="auto">
          {file.name}
        </p>
        {meta ? (
          <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {meta}
          </p>
        ) : null}
      </div>
      {stationName ? <span style={NEUTRAL}>{stationName}</span> : null}
      {onRename ? (
        <button type="button" onClick={() => setRenameOpen(true)} style={iconBtn} aria-label={lang === "ar" ? "تعديل" : "Edit"}>
          <Pencil style={{ width: 14, height: 14 }} />
        </button>
      ) : null}
      <a href={file.url} target="_blank" rel="noopener noreferrer" style={iconBtn} aria-label={t("downloadFile")}>
        <Download style={{ width: 14, height: 14 }} />
      </a>
      {onDelete ? (
        <ConfirmDeleteDialog
          onConfirm={onDelete}
          trigger={
            <button type="button" style={iconBtn} aria-label={t("delete")}>
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          }
        />
      ) : null}
      {onRename ? (
        <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} initialName={file.name} onRename={onRename} />
      ) : null}
    </div>
  );
}
