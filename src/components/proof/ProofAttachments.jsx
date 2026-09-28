import React, { useState } from "react";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { BORDER, BRAND, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

const chip = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: SURFACE,
  textDecoration: "none",
  flexWrap: "wrap",
};
const kind = (bg, fg, bd) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 9px",
  borderRadius: 20,
  fontSize: 10,
  fontWeight: 600,
  background: bg,
  color: fg,
  border: `1px solid ${bd}`,
  flexShrink: 0,
});

const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt";

function stampWhen(iso) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fileKind(name, type) {
  const lower = String(name || "").toLowerCase();
  if (String(type || "").startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(lower)) return "IMAGE";
  if (lower.endsWith(".pdf") || String(type || "").includes("pdf")) return "PDF";
  return "FILE";
}

/** Draft picker for raise forms — stores File objects until save. */
export function ProofAttachPicker({ files = [], onChange, ar = true }) {
  const list = Array.isArray(files) ? files : [];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {list.map((file, index) => (
        <span key={`${file.name || "file"}-${index}`} style={chip}>
          <span style={kind("var(--nv-bad-soft)", "#DC2626", "var(--nv-bad-soft)")}>{fileKind(file.name, file.type)}</span>
          <span style={{ fontSize: 12, color: NAVY }}>{file.name || (ar ? "مرفق" : "File")}</span>
          <button
            type="button"
            onClick={() => onChange?.(list.filter((_, i) => i !== index))}
            style={{ border: "none", background: "none", color: MUTED, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
          >
            {ar ? "حذف" : "Remove"}
          </button>
        </span>
      ))}
      <label className="nv-attach nv-attach--inline">
        <span>{ar ? "أرفق مستندًا" : "Attach a document"}</span>
        <input
          type="file"
          multiple
          accept={ACCEPT}
          className="nv-attach-native"
          onChange={(event) => {
            const picked = Array.from(event.target.files || []);
            event.target.value = "";
            if (picked.length) onChange?.([...list, ...picked]);
          }}
        />
      </label>
      {list.length === 0 ? (
        <span style={{ fontSize: 12, color: MUTED }}>{ar ? "هوية، تصريح، أو أي مستند للزيارة/العمل." : "An ID, permit, or any visit/work document."}</span>
      ) : null}
    </div>
  );
}

/** Saved attachments on the visitor / work-proof card. */
export default function ProofAttachments({
  attachments = [],
  ar = true,
  busy = false,
  canEdit = true,
  hint,
  onAdd,
  onReplace,
}) {
  const [file, setFile] = useState(null);
  const rows = Array.isArray(attachments) ? attachments : [];

  return (
    <OpsTaskSection
      title={ar ? "المستندات" : "Documents"}
      count={rows.length || undefined}
      hint={hint || (ar ? "مستندات هذه البطاقة — ليست صورة قبل/بعد، وليست مرفقات مهمة." : "Documents for this card — not before/after photos, and not a task attachment.")}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {rows.map((item, index) => {
          const when = stampWhen(item.updatedAt || item.createdAt);
          const replaced = !!item.updatedAt && item.updatedAt !== item.createdAt;
          const label = fileKind(item.name, item.type);
          return (
            <span key={item.id || `${item.name}-${index}`} style={chip}>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                  <span style={kind(label === "IMAGE" ? "var(--nv-accent-soft)" : "var(--nv-bad-soft)", label === "IMAGE" ? "#15803D" : "#DC2626", label === "IMAGE" ? "#BBF7D0" : "var(--nv-bad-soft)")}>{label}</span>
                  <span style={{ fontSize: 12, color: NAVY }}>{item.name || (ar ? "مستند" : "Document")}</span>
                </a>
              ) : (
                <>
                  <span style={kind("var(--nv-soft)", MUTED, BORDER)}>{ar ? "محلي" : "LOCAL"}</span>
                  <span style={{ fontSize: 12, color: NAVY }}>{item.name || (ar ? "مستند" : "Document")}</span>
                </>
              )}
              {when ? (
                <span dir="ltr" style={{ fontSize: 10, color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                  {replaced ? (ar ? "عُدّل" : "Updated") : (ar ? "أُضيف" : "Added")} {when}
                </span>
              ) : null}
              {canEdit && onReplace ? (
                <label style={{ fontSize: 11, color: BRAND, fontWeight: 600, cursor: "pointer" }}>
                  {ar ? "استبدال" : "Replace"}
                  <input
                    type="file"
                    accept={ACCEPT}
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const next = event.target.files?.[0];
                      if (next) onReplace(item.id || index, next);
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </span>
          );
        })}
        {canEdit && onAdd ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 10, border: "1px dashed var(--nv-line)", background: CARD, fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <span>{ar ? "أرفق مستندًا" : "Attach a document"}</span>
            <input
              type="file"
              accept={ACCEPT}
              style={{ display: "none" }}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
        ) : null}
        {file ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await onAdd?.(file);
              setFile(null);
            }}
            style={{
              padding: "8px 13px",
              borderRadius: 9,
              background: BRAND,
              color: "#fff",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {ar ? `رفع ${file.name}` : `Upload ${file.name}`}
          </button>
        ) : null}
      </div>
      {rows.length === 0 && !file ? (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
          {ar ? "لا مستندات على هذه البطاقة بعد." : "No documents on this card yet."}
        </div>
      ) : null}
    </OpsTaskSection>
  );
}
