import React from "react";
import ChatBubble from "@/components/chat/ChatBubble";
import { MUTED } from "@/lib/platformStyles";

function personOf(employees, id) {
  const sid = String(id || "").trim();
  if (!sid) return null;
  return (employees || []).find((e) => String(e.id || "") === sid || String(e.employeeId || "") === sid) || null;
}

function commentPrefix(c, ar) {
  if (c?.kind === "log") return ar ? `إنجاز ×${c.amount || 1}` : `Done ×${c.amount || 1}`;
  if (c?.is_escalation) return ar ? "تصعيد" : "Escalation";
  if (c?.is_rejection) return ar ? "رفض" : "Rejection";
  if (c?.isIssue) return ar ? "عائق" : "Blocker";
  return "";
}

function lastEscalationComment(comments) {
  const rows = Array.isArray(comments) ? comments : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.is_escalation && String(rows[i].text || "").trim()) return rows[i];
  }
  return null;
}

/** WhatsApp-style thread for task comments, logs, blockers, and public reject/escalate reasons. */
export default function OpsTaskDiscussion({
  task,
  comments,
  ar,
  currentUserId,
  employees = [],
  onDeleteComment,
  onUndoCreate,
}) {
  const mine = String(currentUserId || "");
  const createdAt = task?.createdAt || task?.created_date;
  const createPerson = personOf(employees, task?.createdBy);
  const createIsMine = mine !== "" && (
    String(task?.createdBy || "") === mine
    || String(createPerson?.id || "") === mine
    || String(createPerson?.employeeId || "") === mine
  );
  const rows = Array.isArray(comments) ? comments : [];
  const escalationNote = lastEscalationComment(rows);

  return (
    <div
      data-nv-task-thread
      data-nv-task-scroll
      dir={ar ? "rtl" : "ltr"}
      style={{ minHeight: (rows.length || createdAt) ? 80 : 120, overflow: "visible", padding: 0, background: "transparent", display: "flex", flexDirection: "column", gap: 8 }}
    >
      {task.rejectReason ? (
        <div style={{ borderRadius: 10, background: "#FEF2F2", padding: "8px 12px", fontSize: 12, color: "#B91C1C" }}>
          {ar ? "سبب الرفض:" : "Rejection reason:"} {task.rejectReason}
        </div>
      ) : null}
      {escalationNote ? (
        <div style={{ borderRadius: 10, background: "#FFFBEB", padding: "8px 12px", fontSize: 12, color: "#92400E" }}>
          {ar ? "سبب التصعيد:" : "Escalation reason:"} {escalationNote.text}
        </div>
      ) : null}
      {createdAt ? (
        <ChatBubble
          lang={ar ? "ar" : "en"}
          isMine={createIsMine}
          onDelete={createIsMine && onUndoCreate ? () => onUndoCreate() : undefined}
          msg={{
            id: `create_${task.id}`,
            text: ar ? "أُنشئت المهمة" : "Task created",
            created_at: createdAt,
            user_name: createPerson?.name || task.createdByName || "",
            authorId: createPerson?.id || createPerson?.employeeId || task.createdBy,
            avatarUrl: createPerson?.profile?.avatarUrl || createPerson?.avatarUrl || "",
          }}
        />
      ) : null}
      {!createdAt && rows.length === 0 ? (
        <div style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: 24 }}>
          {ar ? "لا رسائل بعد — اكتب في الشريط أسفل البطاقة." : "No messages yet — write in the bar at the bottom."}
        </div>
      ) : null}
      {rows.map((c) => {
        const text = [c.text, c.stopReason ? (ar ? `سبب التوقف: ${c.stopReason}` : `Stop reason: ${c.stopReason}`) : ""]
          .filter(Boolean)
          .join("\n");
        const prefix = commentPrefix(c, ar);
        const person = personOf(employees, c.authorId);
        const isMine = mine !== "" && (
          String(c.authorId || "") === mine
          || String(person?.id || "") === mine
          || String(person?.employeeId || "") === mine
        );
        const reasonLocked = !!(c.is_rejection || c.is_escalation || c.is_auto);
        const canDelete = isMine && !reasonLocked && typeof onDeleteComment === "function";
        return (
          <ChatBubble
            key={c.id}
            lang={ar ? "ar" : "en"}
            isMine={isMine}
            allowDeleteAnytime
            onDelete={canDelete ? () => {
              return onDeleteComment(c.id);
            } : undefined}
            msg={{
              id: c.id,
              text: prefix ? `${prefix}\n${text}` : text,
              files: c.files,
              created_at: c.at || c.createdAt || new Date().toISOString(),
              user_name: person?.name || c.authorName || "",
              authorId: person?.id || person?.employeeId || c.authorId,
              avatarUrl: person?.profile?.avatarUrl || person?.avatarUrl || "",
            }}
          />
        );
      })}
    </div>
  );
}
