import React, { useEffect, useState } from "react";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { BORDER, BRAND, CARD, MUTED, NAVY, SURFACE, field } from "@/lib/platformStyles";

const chip = { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE, textDecoration: "none", flexWrap: "wrap" };
const kind = (bg, fg, bd) => ({ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: bg, color: fg, border: `1px solid ${bd}`, flexShrink: 0 });

function stampWhen(iso) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Steps + attachments — both editable, each change stamps an update time. */
export default function OpsTaskAttachments({
  taskId,
  attachments,
  steps = [],
  stepsUpdatedAt,
  attachmentsUpdatedAt,
  ar,
  busy,
  canEdit = true,
  onAddAttachment,
  onReplaceAttachment,
  onSaveSteps,
}) {
  const [file, setFile] = useState(null);
  const [editing, setEditing] = useState(false);
  const stepText = Array.isArray(steps) ? steps.join("\n") : String(steps || "");
  const [draft, setDraft] = useState(stepText);

  useEffect(() => {
    setDraft(stepText);
    setEditing(false);
  }, [taskId, stepText]);

  const lastStamp = stepsUpdatedAt || attachmentsUpdatedAt;
  const aside = lastStamp
    ? (
      <span dir="ltr" style={{ fontSize: 10, color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
        {ar ? "آخر تحديث" : "Updated"} {stampWhen(lastStamp)}
      </span>
    )
    : null;

  return (
    <OpsTaskSection title={ar ? "الخطوات والمرفقات" : "Steps & attachments"} count={(attachments.length || 0) + (Array.isArray(steps) ? steps.length : (stepText ? 1 : 0)) || null} aside={aside}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{ar ? "خطوات التنفيذ" : "Execution steps"}</span>
            {stepsUpdatedAt ? <span dir="ltr" style={{ fontSize: 10, color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>{stampWhen(stepsUpdatedAt)}</span> : null}
            {canEdit && !editing && (
              <button type="button" onClick={() => setEditing(true)} style={{ marginInlineStart: "auto", border: "none", background: "transparent", color: BRAND, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {ar ? "تعديل" : "Edit"}
              </button>
            )}
          </div>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.max(3, draft.split("\n").length)}
                placeholder={ar ? "سطر لكل خطوة…" : "One step per line…"}
                style={{ ...field, minHeight: 84, resize: "vertical", lineHeight: 1.6 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onSaveSteps?.(draft);
                    setEditing(false);
                  }}
                  style={{ padding: "7px 12px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {ar ? "حفظ الخطوات" : "Save steps"}
                </button>
                <button type="button" onClick={() => { setDraft(stepText); setEditing(false); }} style={{ padding: "7px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  {ar ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          ) : steps.length === 0 && !stepText ? (
            <div style={{ fontSize: 12, color: MUTED }}>{ar ? "لم تُحدَّد خطوات — يمكن إضافتها هنا مع تاريخ التحديث." : "No steps yet — add them here; the update time is stamped."}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {(Array.isArray(steps) ? steps : stepText.split("\n").filter(Boolean)).map((s, i) => (
                <div key={`${taskId}-step-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span dir="ltr" style={{ width: 20, height: 20, borderRadius: "50%", background: "#F1F5F9", color: MUTED, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'IBM Plex Sans',sans-serif", marginTop: 1 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: NAVY, lineHeight: 1.6, textWrap: "pretty" }}>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{ar ? "المرفقات" : "Attachments"}</span>
            {attachmentsUpdatedAt ? <span dir="ltr" style={{ fontSize: 10, color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>{stampWhen(attachmentsUpdatedAt)}</span> : null}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {attachments.map((f, i) => {
              const isAudio = /\.(webm|m4a|ogg|mp3|wav)$/i.test(f.name || "") || String(f.type || "").startsWith("audio/");
              const when = stampWhen(f.updatedAt || f.createdAt);
              const replaced = !!f.updatedAt && f.updatedAt !== f.createdAt;
              return (
                <span key={f.id || `${taskId}-att-${i}`} style={chip}>
                  {isAudio && f.url ? (
                    <>
                      <span style={kind("#EAF6EF", "#14683F", "#BBF7D0")}>{ar ? "صوت" : "AUDIO"}</span>
                      <audio src={f.url} controls style={{ height: 28, maxWidth: 180 }} />
                    </>
                  ) : f.url ? (
                    <a href={f.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                      <span style={kind("#FEF2F2", "#DC2626", "#FECACA")}>{(f.name || "").toLowerCase().endsWith(".pdf") ? "PDF" : "FILE"}</span>
                      <span style={{ fontSize: 12, color: NAVY }}>{f.name || "file"}</span>
                    </a>
                  ) : (
                    <>
                      <span style={kind("#F1F5F9", MUTED, BORDER)}>{ar ? "محلي" : "LOCAL"}</span>
                      <span style={{ fontSize: 12, color: NAVY }}>{f.name || "file"}</span>
                    </>
                  )}
                  {when ? (
                    <span dir="ltr" style={{ fontSize: 10, color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                      {replaced ? (ar ? "عُدّل" : "Updated") : (ar ? "أُضيف" : "Added")} {when}
                    </span>
                  ) : null}
                  {canEdit && onReplaceAttachment && (
                    <label style={{ fontSize: 11, color: BRAND, fontWeight: 600, cursor: "pointer" }}>
                      {ar ? "استبدال" : "Replace"}
                      <input
                        type="file"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const next = e.target.files?.[0];
                          if (next) onReplaceAttachment(f.id || i, next);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </span>
              );
            })}
            {canEdit && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 10, border: "1px dashed #CBD5E1", background: CARD, fontSize: 12, color: MUTED, cursor: "pointer" }}>
                <span>{ar ? "أرفق ملفًا" : "Attach file"}</span>
                <input type="file" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            )}
            {file && (
              <button type="button" disabled={busy} onClick={async () => { await onAddAttachment?.(file); setFile(null); }} style={{ padding: "8px 13px", borderRadius: 9, background: BRAND, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.5 : 1 }}>
                {ar ? `رفع ${file.name}` : `Upload ${file.name}`}
              </button>
            )}
          </div>
          {attachments.length === 0 && !file && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{ar ? "لا مرفقات بعد." : "No attachments yet."}</div>
          )}
        </div>
      </div>
    </OpsTaskSection>
  );
}
