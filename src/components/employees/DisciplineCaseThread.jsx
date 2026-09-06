import React, { useState } from "react";
import { addDisciplineMessage } from "@/lib/store";
import { Send } from "lucide-react";
import CommentFiles, { CommentAttachments } from "@/components/tasks/CommentFiles";
import { BORDER, MUTED, NAVY, SURFACE, field, ui } from "@/lib/platformStyles";

export default function DisciplineCaseThread({
  caseRow,
  companyId,
  currentUser,
  canManage,
  isSubject,
  ar,
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const messages = caseRow?.messages || [];
  const canSend = Boolean((canManage || isSubject) && companyId && caseRow?.id && currentUser);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    addDisciplineMessage(companyId, caseRow.id, {
      from: isSubject ? "employee" : "hr",
      text: text.trim(),
      files,
      senderName: currentUser?.name,
    });
    setText("");
    setFiles([]);
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: MUTED }}>
        {ar ? "محادثة الملف" : "Case conversation"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "18rem", overflowY: "auto" }}>
        {messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
            {ar ? "لا رسائل بعد — اكتب رسالة وأرفق الملف." : "No messages yet — write a note and attach the file."}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: m.from === "employee" ? "flex-start" : "flex-end" }}>
              <div
                style={{
                  maxWidth: "80%",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 13,
                  background: m.from === "employee" ? SURFACE : "color-mix(in oklab, #1E9E63 12%, #fff)",
                  color: NAVY,
                }}
              >
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>
                  {m.senderName || (m.from === "employee" ? (ar ? "الموظف" : "Employee") : (ar ? "الموارد البشرية" : "HR"))}
                </div>
                {m.text ? <p style={{ margin: 0 }}>{m.text}</p> : null}
                <CommentAttachments files={m.files} />
              </div>
            </div>
          ))
        )}
      </div>
      {canSend ? (
        <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <CommentFiles files={files} setFiles={setFiles} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={ar ? "اكتب رسالة التحقيق أو التظلم..." : "Write a hearing or appeal message..."}
              style={{ ...field, flex: 1 }}
            />
            <button
              type="submit"
              disabled={!text.trim() && files.length === 0}
              style={{
                ...ui.btnPrimary,
                opacity: !text.trim() && files.length === 0 ? 0.4 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Send style={{ width: 14, height: 14 }} /> {ar ? "إرسال" : "Send"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
