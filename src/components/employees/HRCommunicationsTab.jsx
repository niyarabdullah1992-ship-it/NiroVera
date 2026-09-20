import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { addHRMessage } from "@/lib/store";
import { Send } from "lucide-react";
import CommentFiles, { CommentAttachments } from "@/components/tasks/CommentFiles";
import VoiceRecorder from "@/components/tasks/VoiceRecorder";
import TreeCommunicationTargetPicker from "@/components/employees/TreeCommunicationTargetPicker";
import { adminCommunicationTargets } from "@/lib/orgTree";
import { BORDER, MUTED, NAVY, SURFACE, field, ui, BRAND_BORDER, BRAND_SOFT, BRAND_DEEP, CARD } from "@/lib/platformStyles";
import { employeeFileVoice } from "@/lib/employeeFileView";

export default function HRCommunicationsTab({ employee, companyId, currentUser, isSelf, canReply, data }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const voice = employeeFileVoice({ employee, currentUser, ar });
  const targets = useMemo(
    () => adminCommunicationTargets(data, employee.id, { ar }),
    [data, employee.id, ar],
  );
  const defaultId = targets[0]?.id || "channel:company_hr";
  const [targetId, setTargetId] = useState(defaultId);
  const selectedTarget = targets.find((item) => item.id === targetId) || targets[0];
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const messages = employee.hrMessages || [];
  const canSend = isSelf || canReply;

  useEffect(() => {
    if (!targets.some((t) => t.id === targetId)) setTargetId(defaultId);
  }, [targets, targetId, defaultId]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    const target = selectedTarget || {
      id: "channel:company_hr",
      name: ar ? "موارد بشرية الشركة" : "Company HR",
      kind: "company",
    };
    addHRMessage(companyId, employee.id, {
      from: isSelf ? "employee" : "hr",
      targetId: isSelf ? target.id : employee.id,
      targetName: isSelf ? target.name : employee.name,
      channel: target.kind === "tree" ? "tree" : "company",
      text: text.trim(),
      files,
      senderName: currentUser.name,
    });
    setText("");
    setFiles([]);
  };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "10px", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, flex: "1 1 220px", fontSize: "14px", fontWeight: 600, color: NAVY }}>
          {voice.warnings}
        </h3>
      </div>

      <div style={{
        borderRadius: "10px",
        border: `1px solid ${BRAND_BORDER}`,
        background: BRAND_SOFT,
        padding: "10px 12px",
        fontSize: "12px",
        color: BRAND_DEEP,
        lineHeight: 1.65,
        marginBottom: "12px",
      }}
      >
        {ar
          ? "مسار رسمي يُحفظ في ملف الموظف. الإرسال إلى موارد بشرية الشركة متاح دائمًا — الشجرة التنظيمية خيار إضافي عند ضبط المدير."
          : "Official thread kept on the employee file. Company HR is always available — the org tree is an extra option when a manager is configured."}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "24rem", overflowY: "auto" }}>
        {messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: MUTED }}>
            {ar ? "لا توجد رسائل رسمية بعد." : "No official messages yet."}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: m.from === "employee" ? "flex-start" : "flex-end" }}>
              <div style={{
                maxWidth: "75%",
                padding: "10px 12px",
                borderRadius: "10px",
                fontSize: "13px",
                background: m.from === "employee" ? SURFACE : "color-mix(in oklab, #1E9E63 12%, #fff)",
                color: NAVY,
              }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: MUTED, marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600 }}>{m.senderName}</span>
                  <span>·</span>
                  <span>
                    {m.targetName
                      || (m.channel === "company" || String(m.targetId || "").startsWith("channel:")
                        ? (ar ? "موارد بشرية الشركة" : "Company HR")
                        : (m.target === "hq" ? t("hqHRTarget") : t("stationHRTarget")))}
                  </span>
                  {m.channel === "tree" && (
                    <>
                      <span>·</span>
                      <span>{ar ? "عبر الشجرة" : "via tree"}</span>
                    </>
                  )}
                </div>
                {m.text && <p style={{ margin: 0 }}>{m.text}</p>}
                <CommentAttachments files={m.files} />
              </div>
            </div>
          ))
        )}
      </div>

      {canSend && (
        <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${BORDER}` }}>
          {isSelf && (
            <TreeCommunicationTargetPicker
              targets={targets}
              value={selectedTarget?.id || defaultId}
              onChange={setTargetId}
              ar={ar}
            />
          )}
          {!isSelf && canReply && (
            <p style={{ margin: 0, fontSize: "11px", color: MUTED }}>
              {ar ? `الرد يُحفظ في ملف ${employee.name} ويُبلَّغ الموظف.` : `Reply is saved on ${employee.name}'s file and the employee is notified.`}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "8px" }}>
            <CommentFiles files={files} setFiles={setFiles} />
            <VoiceRecorder files={files} setFiles={setFiles} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={ar ? "اكتب رسالتك الرسمية..." : "Write your official message..."}
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
                gap: "6px",
              }}
            >
              <Send style={{ width: 14, height: 14 }} /> {t("send")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
