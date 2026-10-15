import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { requestWrittenConsent } from "@/lib/store";
import {
  CONSENT_TOPICS,
  checkRaiseConsentGate,
  consentStatus,
  consentTopicMeta,
  flattenWrittenConsents,
  hashConsentFile,
  readConsentFile,
} from "@/lib/writtenConsent";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { BORDER, CARD, CONTROL_RADIUS, MUTED } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import AttachFileButton from "@/components/shared/AttachFileButton";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { toast } from "@/components/ui/use-toast";
import { consentEffectLine } from "@/lib/consentEffects";

/**
 * طلب موافقة خطية — one of the tiles in «رفع طلب لموظف», for the cases where the Law makes the
 * worker's written consent the condition: a move that changes residence (58), monthly → daily pay
 * (59), substantially different work (60). Compensatory leave (107) is chosen by the worker on each
 * overtime assignment.
 * The person comes from the picker above. The worker signs the form or refuses from طلباتي; the
 * status is read from the signed copy. Night 18632 opens by itself and is not raised here.
 */

const STEP_AR = ["ترسله أنت", "الموظف يوقّع النموذج أو يرفض من «طلباتي»", "تُعتمد الحالة من النسخة الموقّعة"];
const STEP_EN = ["You send it", "The worker signs the form or refuses in My requests", "Status is read from the signed copy"];

const field = {
  fontFamily: "inherit",
  fontSize: 12.5,
  padding: "10px 12px",
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  borderRadius: CONTROL_RADIUS,
};

const block = { padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 };
const label = { fontSize: 11.5, color: MUTED };

function dayLabel(iso, ar) {
  const d = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return new Date(`${d}T12:00:00`).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "long" });
}

function daysLeft(deadline) {
  const d = String(deadline || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return Math.round((new Date(`${d}T00:00:00Z`) - new Date(`${todayRiyadh()}T00:00:00Z`)) / 86400000);
}

function statusFace(item, ar) {
  const s = consentStatus(item);
  if (s === "yes") return { tone: "ok", text: ar ? "وافق ووقّع" : "Agreed and signed" };
  if (s === "no") return { tone: "bad", text: ar ? "رفض" : "Refused" };
  const left = daysLeft(item.deadline);
  if (left != null && left < 0) return { tone: "bad", text: ar ? "انتهت المهلة بلا رد" : "No reply by the deadline" };
  const n = left === 1 ? "يوم واحد" : left === 2 ? "يومان" : left >= 3 && left <= 10 ? `${left} أيام` : `${left} يوماً`;
  return { tone: "warn", text: ar ? (left == null ? "بانتظار رده" : left === 0 ? "بانتظار رده · آخر يوم" : `بانتظار رده · باقي ${n}`) : `Awaiting reply${left != null ? ` · ${left}d left` : ""}` };
}

const pill = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  height: 24,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  color: `var(--nv-${tone}-ink)`,
  background: `var(--nv-${tone}-soft)`,
  border: `1px solid var(--nv-${tone}-line)`,
});

export default function WrittenConsentRaise({ employees = [], employeeId, ar = true, refresh }) {
  const { company, currentUser } = useAuth();
  // 18632 opens by itself; 107 is the worker's own choice (pay or leave) when he accepts each overtime
  // assignment — so neither is sent from here.
  const topics = CONSENT_TOPICS.filter((row) => row.id !== "night" && row.id !== "ot");
  const [topic, setTopic] = useState(topics[0]?.id || "site");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(`${todayRiyadh()}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [body, setBody] = useState(() => (ar ? consentTopicMeta(topics[0]?.id).bodyAr : consentTopicMeta(topics[0]?.id).bodyEn));
  const [file, setFile] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const meta = consentTopicMeta(topic);
  const person = employees.find((row) => String(row.id) === String(employeeId));

  const sent = useMemo(
    () => flattenWrittenConsents(employees).filter((row) => row.topic !== "night" && (row.requestedById === currentUser?.id || employees.some((emp) => emp.id === row.employee?.id))),
    [employees, currentUser?.id],
  );

  const pickTopic = (id) => {
    setTopic(id);
    const m = consentTopicMeta(id);
    setBody(ar ? m.bodyAr : m.bodyEn);
  };

  const pickFile = async (picked) => {
    if (!picked) return;
    setFileBusy(true);
    setFileError("");
    try {
      const [hash, url] = await Promise.all([hashConsentFile(picked), readConsentFile(picked)]);
      setFile({ name: picked.name, size: picked.size, hash, url, type: picked.type });
    } catch {
      setFileError(ar ? "تعذّرت قراءة الملف — جرّب PDF أو صورة أصغر." : "Could not read the file — try a smaller PDF or image.");
      setFile(null);
    } finally {
      setFileBusy(false);
    }
  };

  const self = Boolean(employeeId) && String(employeeId) === String(currentUser?.id);
  const gate = self
    ? { ok: false, reason: "الموافقة تُطلب من الموظف المعني — اختر موظفاً غيرك من الأعلى.", reasonEn: "Consent is asked of the worker concerned — pick someone other than yourself above." }
    : checkRaiseConsentGate({ employeeId, body, deadline, file, paper: null });

  const send = () => {
    if (!gate.ok || !company?.id) return;
    const result = requestWrittenConsent(company.id, employeeId, {
      topic,
      body,
      deadline,
      file,
      paper: null,
      requestedBy: currentUser?.name,
      requestedById: currentUser?.id,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    setFile(null);
    toast({ description: ar ? `أُرسل طلب الموافقة إلى ${person?.name || "الموظف"}. يصله في «طلباتي» ليوقّع أو يرفض.` : `Sent to ${person?.name || "the worker"}. It reaches My requests to sign or refuse.` });
    refresh?.();
  };

  return (
    <div data-consent-raise="1" style={{ display: "flex", flexDirection: "column" }}>
      <div style={block}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13 }}>{ar ? "ما الذي تطلب الموافقة عليه؟" : "What is the consent for?"}</strong>
          <span style={{ fontSize: 11.5, color: MUTED }}>{ar ? "الحالات التي يشترط فيها النظام موافقة العامل الكتابية" : "Cases where the Law requires the worker's written consent"}</span>
        </span>
        <div className="nv-req-kind-grid" data-consent-topics="1">
          {topics.map((row) => (
            <button key={row.id} type="button" className="nv-req-kind-card" aria-pressed={topic === row.id} data-consent-topic={row.id} onClick={() => pickTopic(row.id)}>
              <span className="nv-req-kind-mark" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{row.article || "—"}</span>
              <span className="nv-req-kind-copy">
                <span className="nv-req-kind-title">{ar ? row.ar : row.en}</span>
                <span className="nv-req-kind-hint">{ar ? row.hintAr : row.hintEn}</span>
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: CONTROL_RADIUS, background: "var(--nv-soft, #F6F8FA)", border: "1px solid var(--nv-line2)" }}>
          <LaborArticleCite article={meta.article} ar={ar} showOfficial />
          <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.75, flex: "1 1 220px" }}>{ar ? meta.withoutAr : meta.withoutEn}</span>
        </div>
      </div>

      <div style={block}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 12, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={label}>{ar ? "يُرسل إلى" : "Sent to"}</span>
            <span style={{ ...field, display: "flex", alignItems: "center", minHeight: 40, background: "var(--nv-soft, #F6F8FA)", fontWeight: 700 }}>{person?.name || (ar ? "اختر الموظف من الأعلى" : "Pick the worker above")}</span>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={label}>{ar ? "آخر موعد لرده" : "Reply by"}</span>
            <PlatformDateField ar={ar} value={deadline} onChange={setDeadline} style={{ minHeight: 40, height: 40, fontSize: 12.5, borderRadius: CONTROL_RADIUS }} />
          </label>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={label}>{ar ? "نص الطلب كما سيقرؤه الموظف" : "The text the worker will read"}</span>
          <textarea data-consent-body="1" value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ ...field, resize: "vertical", lineHeight: 1.9 }} />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>{ar ? "النموذج الذي سيوقّعه (PDF أو صورة)" : "The form they will sign (PDF or image)"}</span>
          {file?.name ? (
            <span data-consent-file="1" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 12px", borderRadius: CONTROL_RADIUS, border: "1px solid var(--nv-ok-line)", background: "var(--nv-ok-soft)" }}>
              <strong style={{ fontSize: 12.5, color: "var(--nv-ok-ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 160px" }}>{file.name}</strong>
              <ConsentFileLink file={file} ar={ar}>{ar ? "معاينة" : "Preview"}</ConsentFileLink>
              <button type="button" onClick={() => setFile(null)} style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, height: 28, padding: "0 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: "var(--nv-ink2)", cursor: "pointer" }}>{ar ? "أزل" : "Remove"}</button>
            </span>
          ) : (
            <AttachFileButton ar={ar} accept="application/pdf,image/jpeg,image/png,image/webp" busy={fileBusy} label={ar ? "أرفق النموذج" : "Attach the form"} onPick={pickFile} />
          )}
          {fileError ? <span style={{ fontSize: 11.5, color: "var(--nv-bad-ink)" }}>{fileError}</span> : null}
        </div>
      </div>

      <div style={{ ...block, gap: 9 }}>
        <ol data-consent-steps="1" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(ar ? STEP_AR : STEP_EN).map((step, i) => (
            <li key={step} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--nv-ink2)" }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: i === 0 ? "#0B3D27" : "var(--nv-soft, #EEF2EF)", color: i === 0 ? "#fff" : "var(--nv-ink2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
              {step}
              {i < 2 ? <span aria-hidden style={{ width: 14, height: 1, background: "var(--nv-line)" }} /> : null}
            </li>
          ))}
        </ol>
        <button
          type="button"
          data-consent-send="1"
          disabled={!gate.ok || fileBusy}
          onClick={send}
          style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", height: 40, width: "100%", border: "none", borderRadius: CONTROL_RADIUS, fontSize: 13, fontWeight: 700, background: gate.ok ? "var(--nv-navy, #0B3D27)" : "var(--nv-line)", color: gate.ok ? "#fff" : MUTED, cursor: gate.ok ? "pointer" : "default" }}
        >
          {ar ? "أرسل طلب الموافقة" : "Send the consent request"}
        </button>
        {!gate.ok ? <span data-consent-gate="1" style={{ fontSize: 11.5, color: "var(--nv-warn-ink)", lineHeight: 1.7 }}>{ar ? gate.reason : gate.reasonEn}</span> : null}
      </div>

      <div data-consent-sent="1" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "baseline", gap: 8, borderBottom: sent.length ? "1px solid var(--nv-line2)" : "none" }}>
          <strong style={{ fontSize: 13 }}>{ar ? "طلبات الموافقة المرسلة" : "Consent requests sent"}</strong>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: MUTED }}>{sent.length}</span>
          {!sent.length ? <span style={{ fontSize: 11.5, color: MUTED }}>{ar ? "— لم تُرسل طلباً بعد." : "— none yet."}</span> : null}
        </div>
        {sent.map((row) => {
          const face = statusFace(row, ar);
          const m = consentTopicMeta(row.topic);
          return (
            <div key={row.id} data-consent-row={row.id} style={{ padding: "11px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{row.employee?.name || "—"}</strong>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ink2)", border: "1px solid var(--nv-line)", borderRadius: 6, padding: "1px 7px", fontFamily: "'IBM Plex Mono', monospace" }}>{ar ? `م ${row.article || m.article || "—"}` : `Art. ${row.article || m.article || "—"}`}</span>
                </span>
                <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
                  {ar ? (m.id === row.topic ? m.ar : row.titleAr) : (m.id === row.topic ? m.en : row.titleEn)}
                  {row.deadline ? ` · ${ar ? "الرد حتى" : "reply by"} ${dayLabel(row.deadline, ar)}` : ""}
                </span>
                <span data-consent-effect="1" style={{ fontSize: 11.5, color: consentStatus(row) === "no" ? "var(--nv-bad-ink)" : consentStatus(row) === "yes" ? "var(--nv-ok-ink)" : MUTED, lineHeight: 1.6 }}>{consentEffectLine(row, ar)}</span>
                <span style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11.5 }}>
                  {row.senderFile?.url ? <ConsentFileLink file={row.senderFile} ar={ar}>{ar ? "النموذج" : "The form"}</ConsentFileLink> : null}
                  {row.paper?.url ? <ConsentFileLink file={row.paper} ar={ar}>{ar ? "النسخة الموقّعة" : "Signed copy"}</ConsentFileLink> : null}
                </span>
              </span>
              <span style={pill(face.tone)}>{face.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
