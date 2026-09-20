import React, { useState } from "react";
import { Folder, Trash2, Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import RenameDialog from "@/components/files/RenameDialog";
import { BORDER, MUTED, NAVY, CARD } from "@/lib/platformStyles";
import { identityIconWrap } from "@/components/shared/IdentityCard";

const iconBtn = {
  width: 26,
  height: 26,
  border: "none",
  background: "transparent",
  color: MUTED,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

export default function FolderCard({ folder, count, onOpen, onDelete, onRename }) {
  const { t, lang } = useI18n();
  const [renameOpen, setRenameOpen] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      style={{
        position: "relative",
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
        padding: "14px 14px 12px",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span style={{ ...identityIconWrap, width: 36, height: 36, borderRadius: 10 }}>
        <Folder style={{ width: 16, height: 16 }} strokeWidth={1.75} />
      </span>
      <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="auto">
        {folder.name}
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 11, color: MUTED }}>
        {count} {t("itemsUnit")}
      </p>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 8, insetInlineEnd: 8, display: "flex", gap: 2 }}>
        {onRename ? (
          <button type="button" onClick={() => setRenameOpen(true)} style={iconBtn} aria-label={lang === "ar" ? "تعديل" : "Edit"}>
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
        ) : null}
        {onDelete ? (
          <ConfirmDeleteDialog
            onConfirm={onDelete}
            trigger={
              <button type="button" style={iconBtn} aria-label={t("delete")}>
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
            }
          />
        ) : null}
      </div>
      {onRename ? (
        <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} initialName={folder.name} onRename={onRename} />
      ) : null}
    </div>
  );
}
