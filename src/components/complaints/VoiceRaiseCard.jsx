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
import { VOICE_CHANNELS, VOICE_TOPICS } from "@/lib/voiceBoard";

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

function stepHead(n, label) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0B3D27", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 11, flex: "none" }}>{n}</span>
      <strong style={{ fontSize: 14, color: "var(--nv-ink)" }}>{label}</strong>
      <span style={{ flex: 1, height: 1, background: "var(--nv-line)" }} />
    </div>
  );
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
}) {
  const topic = VOICE_TOPICS.find((row) => row.id === topicId) || VOICE_TOPICS[0];
  return (
    <article style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--nv-paper)", minWidth: 0 }}>
      <header style={{ background: "linear-gradient(135deg, #0B3D27, #0F5535)", color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ width: 44, height: 44, borderRadius: 10, background: "#C8A45A", color: "#0B3D27", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }} aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16v11H9l-5 4z" />
            <path d="M8 9h8" />
            <path d="M8 12h5" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: 17 }}>{ar ? `بطاقة صوت الموظف — ${channelRow.ar}` : `Employee voice card — ${channelRow.en}`}</strong>
          <span style={{ fontSize: 12, color: "#C5DBCD" }}>{reporter}</span>
        </div>
        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 12, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, padding: "3px 10px" }}>—</span>
      </header>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        {stepHead("1", ar ? "القناة — تحدّد الهوية والمهلة" : "Channel — identity and window")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {VOICE_CHANNELS.map((row) => {
            const on = channel === row.id;
            const anon = row.id === "anonymous";
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onChannel(row.id)}
                style={{
                  fontFamily: "inherit",
                  textAlign: "start",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  padding: "12px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  background: on ? (anon ? "#111418" : "#0B3D27") : "var(--nv-card)",
                  color: on ? "#fff" : "var(--nv-ink)",
                  border: `1px solid ${on ? (anon ? "#111418" : "#0B3D27") : "var(--nv-line)"}`,
                }}
              >
                <strong style={{ fontSize: 13 }}>{ar ? row.ar : row.en}</strong>
                <span style={{ fontSize: 11, color: on ? "#D5E3DA" : "var(--nv-muted)" }}>
                  {ar ? row.identityAr : row.identityEn}
                  {" · "}
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{row.hours}</span>
                  {ar ? " ساعة" : " h"}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "10px 12px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", flex: "none" }}>
            {ar ? channelRow.lawAr : channelRow.lawEn}
          </span>
          <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{ar ? channelRow.promiseAr : channelRow.promiseEn}</span>
        </div>

        {stepHead("2", ar ? "الموضوع" : "Subject")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
          {VOICE_TOPICS.map((row) => {
            const on = topicId === row.id;
            const Icon = TOPIC_ICON[row.id] || Info;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onTopic(row.id)}
                style={{
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 48,
                  padding: "8px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  boxSizing: "border-box",
                  fontWeight: on ? 700 : 500,
                  textAlign: "start",
                  background: on ? "#0B3D27" : "var(--nv-card)",
                  color: on ? "#fff" : "var(--nv-ink)",
                  border: `1px solid ${on ? "#0B3D27" : "var(--nv-line)"}`,
                  boxShadow: on ? "0 6px 16px rgba(6,61,38,.16)" : "none",
                }}
              >
                <Icon size={18} strokeWidth={2} color={on ? "#ffffff" : "var(--nv-ok-ink)"} style={{ flex: "none" }} />
                <span style={{ fontSize: 12.5, lineHeight: 1.35, textWrap: "balance" }}>{ar ? row.ar : row.en}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 11.5, color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)", border: "1px solid var(--nv-warn-line)", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{topic.cite}</span>
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
            {wit ? (ar ? "✓ لديّ شهود أو مستند" : "✓ I have witnesses or a document") : (ar ? "لديّ شهود أو مستند" : "I have witnesses or a document")}
          </button>
          {channel !== "anonymous" ? (
            <button type="button" onClick={onAck} style={toggleStyle(ack)}>
              {ack ? (ar ? "✓ أقرّ بصحة ما كتبت" : "✓ I confirm what I wrote is true") : (ar ? "أقرّ بصحة ما كتبت" : "I confirm what I wrote is true")}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6, background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "12px 14px" }}>
          {checks.map((row) => (
            <span key={row.text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: row.ok ? "var(--nv-ok-ink)" : "var(--nv-muted)" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none", background: row.ok ? "var(--nv-ok-soft)" : "var(--nv-mute-soft)", color: row.ok ? "var(--nv-ok-ink)" : "var(--nv-muted)" }}>{row.ok ? "✓" : "·"}</span>
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
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 46,
            borderRadius: 10,
            border: canSend && channel === "anonymous" ? "1px solid #C8A45A" : "none",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            background: canSend ? (channel === "anonymous" ? "#111418" : "#3C7D50") : "var(--nv-line)",
            color: canSend ? "#fff" : "var(--nv-muted)",
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          {submitText}
        </button>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", textAlign: "center", lineHeight: 1.7 }}>{slaLine}</span>
      </div>
    </article>
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
