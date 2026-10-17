import React from "react";
import {
  AlertTriangle,
  Banknote,
  Clock3,
  FileText,
  Info,
  MapPin,
  PenLine,
  Shield,
} from "lucide-react";
import AttachFileButton from "@/components/shared/AttachFileButton";
import { ABUSE_VOICE_CHANNEL, VOICE_CHANNELS, VOICE_TOPICS, voiceRouteLine } from "@/lib/voiceBoard";
import NvIcon from "@/components/shared/NvIcon";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import { SectionHead, slab } from "@/components/schedules/scheduleChrome";

const TOPIC_ICON = {
  wage: Banknote,
  hours: Clock3,
  leave: FileText,
  safety: Shield,
  conduct: AlertTriangle,
  place: MapPin,
  contract: PenLine,
  other: Info,
};

const inputStyle = {
  height: 42,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--nv-line)",
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
  fontFamily: "inherit",
  fontSize: 13,
};

/** A step inside the sheet, read like طلباتي's sub-heads («نوع الإجازة»): label, muted note, hairline above. */
function stepHead(n, label, note = "") {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, paddingTop: n === "1" ? 0 : 14, borderTop: n === "1" ? "none" : "1px solid var(--nv-line2, #EEF1EF)" }}>
      <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{label}</strong>
      {note ? <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{note}</span> : null}
    </div>
  );
}

/** «شكوى سرية» → «س»: skip the shared «شكوى» so each channel keeps its own letter. */
function leadingLetter(label) {
  const word = String(label || "").trim().replace(/^شكوى\s+/, "");
  return Array.from(word)[0] || "";
}

export default function VoiceRaiseCard({
  ar,
  channel,
  onChannel,
  topicId,
  onTopic,
  title,
  onTitle,
  body,
  onBody,
  when,
  onWhen,
  want,
  onWant,
  wit,
  onWit,
  ack,
  onAck,
  file,
  onFile,
  checks,
  canSend,
  onSend,
  submitText,
  slaLine,
  reporter,
  channelRow,
  receipt,
  abuseSlot = null,
}) {
  const topic = VOICE_TOPICS.find((row) => row.id === topicId) || VOICE_TOPICS[0];
  return (
    <section data-voice-raise="1" style={{ ...slab, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <SectionHead
        title={ar ? `صوت جديد — ${channelRow.ar}` : `New voice — ${channelRow.en}`}
        note={reporter}
      />
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {stepHead("1", ar ? "القناة" : "Channel", ar ? "تحدّد الهوية والمهلة" : "Sets identity and window")}
        <div className="nv-req-kind-grid" role="radiogroup" aria-label={ar ? "القناة" : "Channel"}>
          {[...VOICE_CHANNELS, ABUSE_VOICE_CHANNEL].map((row) => {
            const on = channel === row.id;
            const label = ar ? row.ar : row.en;
            return (
              <button
                key={row.id}
                type="button"
                className="nv-req-kind-card"
                data-voice-channel={row.id}
                aria-pressed={on}
                onClick={() => onChannel(row.id)}
              >
                <span className="nv-req-kind-mark">{leadingLetter(label)}</span>
                <span className="nv-req-kind-copy">
                  <span className="nv-req-kind-title">{label}</span>
                  <span className="nv-req-kind-hint">
                    {ar ? row.identityAr : row.identityEn}
                    {" · "}
                    {row.windowAr ? (ar ? row.windowAr : row.windowEn) : (
                      <>
                        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{row.hours}</span>
                        {ar ? " ساعة" : " h"}
                      </>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 8, padding: "10px 12px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", flex: "none" }}>
            {ar ? channelRow.lawAr : channelRow.lawEn}
          </span>
          <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{ar ? channelRow.promiseAr : channelRow.promiseEn}</span>
        </div>
        {/* Who receives it, in one calm line — HR-only channels never pass the manager. */}
        <span data-voice-route={channel === "complaint" ? "ladder" : "hr"} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ok-ink)", lineHeight: 1.7 }}>
          {voiceRouteLine(channel, ar)}
        </span>

        {abuseSlot ? abuseSlot : (<>

        {stepHead("2", ar ? "الموضوع" : "Subject", ar ? "كل موضوع بمادته" : "Each subject with its article")}
        <SubTypeGrid label={ar ? "الموضوع" : "Subject"}>
          {VOICE_TOPICS.map((row) => {
            const Icon = TOPIC_ICON[row.id] || Info;
            return (
              <SubTypeOption
                key={row.id}
                dataKey={row.id}
                on={topicId === row.id}
                title={(
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Icon size={15} strokeWidth={1.75} color="var(--nv-ok-ink)" aria-hidden style={{ flex: "none" }} />
                    {ar ? row.ar : row.en}
                  </span>
                )}
                onClick={() => onTopic(row.id)}
              />
            );
          })}
        </SubTypeGrid>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 11, color: "var(--nv-ink2)", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 999, padding: "1px 9px", whiteSpace: "nowrap" }}>{topic.cite}</span>
          <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{ar ? topic.ruleAr : topic.ruleEn}</span>
        </div>

        {stepHead("3", ar ? "الواقعة" : "The incident")}
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{ar ? "عنوان مختصر" : "Short title"}</span>
          <input
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            placeholder={channel === "suggestion" ? (ar ? "ما الذي تقترح تحسينه؟" : "What do you suggest improving?") : channel === "complaint" ? (ar ? "ما الحقّ الذي تطلبه؟" : "What right are you claiming?") : (ar ? "ما الخطر أو التجاوز؟" : "What is the risk or the breach?")}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{ar ? "التفصيل" : "Detail"}</span>
          <textarea
            value={body}
            onChange={(event) => onBody(event.target.value)}
            placeholder={channel === "anonymous"
              ? (ar ? "اكتب الواقعة بلا ما يدلّ عليك — ولا تذكر اسمك، فالبلاغ يصل برقم لا باسم." : "Write the incident without what names you — it arrives as a number, not a name.")
              : (ar ? "الواقعة، ومن حضرها، وأثرها على العمل" : "The incident, who was there, and its effect on the work")}
            style={{ ...inputStyle, height: "auto", minHeight: 84, padding: "10px 12px", resize: "vertical", lineHeight: 1.7 }}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {channel !== "suggestion" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{ar ? "تاريخ الواقعة" : "Date of the incident"}</span>
              <input type="date" value={when} onChange={(event) => onWhen(event.target.value)} dir="ltr" style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} />
            </label>
          ) : null}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{ar ? "ما الذي تطلبه؟" : "What are you asking for?"}</span>
            <input
              value={want}
              onChange={(event) => onWant(event.target.value)}
              placeholder={channel === "suggestion" ? (ar ? "مثال: تجربة الفكرة في فرعنا شهراً" : "Example: try the idea at our station for a month") : (ar ? "مثال: صرف المستحق مع أجر الشهر القادم" : "Example: pay the due amount with next month's wage")}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" onClick={onWit} style={toggleStyle(wit)}>
            {wit ? <><NvIcon name="check" size={12} strokeWidth={2} /> {ar ? "لديّ شهود أو مستند" : "I have witnesses or a document"}</> : (ar ? "لديّ شهود أو مستند" : "I have witnesses or a document")}
          </button>
          {channel !== "anonymous" ? (
            <button type="button" onClick={onAck} style={toggleStyle(ack)}>
              {ack ? <><NvIcon name="check" size={12} strokeWidth={2} /> {ar ? "أقرّ بصحة ما كتبت" : "I confirm what I wrote is true"}</> : (ar ? "أقرّ بصحة ما كتبت" : "I confirm what I wrote is true")}
            </button>
          ) : null}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{ar ? "أرفق ملفاً — اختياري" : "Attach a file — optional"}</span>
          <AttachFileButton ar={ar} label={ar ? "أرفق الملف" : "Attach the file"} onPick={onFile} />
          <span style={{ fontSize: 11, color: file ? "var(--nv-ok-ink)" : "var(--nv-muted)", lineHeight: 1.7 }}>
            {file
              ? (ar ? `مرفق: ${file.name} · بصمته ${file.hash.slice(0, 16)}…` : `Attached: ${file.name} · hash ${file.hash.slice(0, 16)}…`)
              : (channel === "anonymous"
                ? (ar ? "تُحسب بصمته على جهازك. تجنّب ما يحمل اسمك — صورة أو مستند باسمك يكشفك." : "Its hash is taken on your device. Avoid anything that names you.")
                : (ar ? "تُحسب بصمته على جهازك ويُحال مع صوتك كما هو." : "Its hash is taken on your device and travels with the voice as it is."))}
          </span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 8, padding: "12px 14px" }}>
          {checks.map((row) => (
            <span key={row.text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: row.ok ? "var(--nv-ok-ink)" : "var(--nv-muted)" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none", background: row.ok ? "var(--nv-ok-soft)" : "var(--nv-mute-soft)", color: row.ok ? "var(--nv-ok-ink)" : "var(--nv-muted)" }}>{row.ok ? <NvIcon name="check" size={11} strokeWidth={2.25} inline={false} /> : "·"}</span>
              {row.text}
            </span>
          ))}
        </div>
        {receipt ? (
          <span style={{ fontSize: 12, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "9px 11px", lineHeight: 1.8 }}>
            {receipt}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", height: 40, width: "100%", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: canSend ? "var(--nv-ok-fill, #3C7D50)" : "var(--nv-soft, #E4E9E6)", color: canSend ? "#fff" : "var(--nv-muted, #5B665F)", cursor: canSend ? "pointer" : "default" }}
        >
          {submitText}
        </button>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", textAlign: "center", lineHeight: 1.7 }}>{slaLine}</span>
        </>)}
      </div>
    </section>
  );
}

function toggleStyle(on) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 36,
    padding: "0 12px",
    borderRadius: 8,
    fontSize: 12.5,
    cursor: "pointer",
    background: on ? "var(--nv-ok-soft)" : "var(--nv-card)",
    color: on ? "var(--nv-ok-ink)" : "var(--nv-ink2)",
    border: `1px solid ${on ? "var(--nv-ok-line)" : "var(--nv-line)"}`,
    fontWeight: on ? 600 : 400,
  };
}
