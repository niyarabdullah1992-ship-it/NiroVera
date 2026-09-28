import React from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, FileText, ExternalLink, Trash2 } from "lucide-react";
import AssistantFeedback from "@/components/assistant/AssistantFeedback";
import { identityIconWrap } from "@/components/shared/IdentityCard";
import { BORDER, MUTED, NAVY, CARD } from "@/lib/platformStyles";

export default function AssistantMessage({ message, onFeedback, onDelete, ar = false }) {
  const isUser = message.role === "user";
  const displayText = isUser ? message.text : String(message.text || "").replace(
    /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g,
    "$1 $2",
  );
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`group relative max-w-[85%] rounded-xl py-3 ps-4 pe-10 text-sm font-body ${isUser ? "bg-foreground text-background" : "bg-card border border-border"}`} dir="auto">
        {onDelete && <button type="button" onClick={onDelete} aria-label={ar ? "حذف الرسالة" : "Delete message"} title={ar ? "حذف الرسالة" : "Delete message"} className={`absolute end-2 top-2 rounded-md p-1.5 opacity-70 hover:opacity-100 ${isUser ? "text-background/70 hover:bg-background/10" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"}`}><Trash2 className="h-3.5 w-3.5" /></button>}
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 text-[var(--nv-ink)]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_h3]:mt-2 [&_h3]:mb-1 [&_table]:text-xs">
            <ReactMarkdown>{displayText}</ReactMarkdown>
          </div>
        )}
        {Array.isArray(message.docs) && message.docs.map((doc, i) => (
          <a
            key={i}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
              background: CARD,
              textDecoration: "none",
            }}
          >
            <span style={identityIconWrap}>
              <FileText style={{ width: 16, height: 16 }} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, color: NAVY }} dir="auto">{doc.title}</span>
            </span>
            <ExternalLink style={{ width: 14, height: 14, color: MUTED, flexShrink: 0 }} />
          </a>
        ))}
        {!isUser && onFeedback && <AssistantFeedback value={message.feedback} onRate={onFeedback} />}
      </div>
    </div>
  );
}