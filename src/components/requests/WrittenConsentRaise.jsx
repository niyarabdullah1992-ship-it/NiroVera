import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { requestWrittenConsent } from "@/lib/store";
import {
  CONSENT_MINISTRY_HINT_AR,
  CONSENT_MINISTRY_HINT_EN,
  CONSENT_TOPICS,
  checkRaiseConsentGate,
  consentTopicMeta,
  flattenWrittenConsents,
  hashConsentFile,
  readConsentFile,
} from "@/lib/writtenConsent";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { CARD, MUTED, NAVY } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { toast } from "@/components/ui/use-toast";
import ConsentSignRow from "@/components/requests/ConsentSignRow";
import RequestEmployeePicker from "@/components/requests/RequestEmployeePicker";
import RequestSelfSignBlock from "@/components/requests/RequestSelfSignBlock";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

const field = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "9px 10px",
  border: "1px solid #dfe3ea",
  background: "#fff",
  color: NAVY,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function WrittenConsentRaise({ employees, stations = [], ar, refresh }) {
  const { company, currentUser } = useAuth();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const raiseTopics = CONSENT_TOPICS.filter((row) => row.id !== "night");
  const [topic, setTopic] = useState("site");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(`${todayRiyadh()}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [body, setBody] = useState(consentTopicMeta("site").bodyAr);
  const [file, setFile] = useState(null);
  const [paper, setPaper] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [paperBusy, setPaperBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [paperError, setPaperError] = useState("");

  const sent = useMemo(
    () => flattenWrittenConsents(employees).filter((row) => row.requestedById === currentUser?.id || employees.some((emp) => emp.id === row.employee?.id)),
    [employees, currentUser?.id],
  );

  const onTopic = (id) => {
    setTopic(id);
    const meta = consentTopicMeta(id);
    setBody(ar ? meta.bodyAr : meta.bodyEn);
  };

  const loadPicked = async (picked, { setRecord, setError, setBusy }) => {
    if (!picked) {
      setRecord(null);
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [hash, url] = await Promise.all([hashConsentFile(picked), readConsentFile(picked)]);
      setRecord({ name: picked.name, size: picked.size, hash, url, type: picked.type });
    } catch {
      setError(ar ? "تعذّر قراءة الملف." : "Could not read the file.");
      setRecord(null);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (picked) => {
    setPaper(null);
    setPaperError("");
    await loadPicked(picked, { setRecord: setFile, setError: setFileError, setBusy: setFileBusy });
  };

  const gate = checkRaiseConsentGate({ employeeId, body, deadline, file, paper });

  const send = () => {
    if (!gate.ok || !company?.id) return;
    const result = requestWrittenConsent(company.id, employeeId, {
      topic,
      body,
      deadline,
      file,
      paper,
      requestedBy: currentUser?.name,
      requestedById: currentUser?.id,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    setFile(null);
    setPaper(null);
    toast({ description: ar ? "أُرسل طلب الموافقة الخطية. الموظف يكتب ويوقّع في قسم التوقيع ثم يرفع النسخة هنا." : "The written-consent request was sent. The worker writes it, signs in Digital signing, then uploads here." });
    refresh?.();
  };

  return (
    <section style={{ background: CARD, border: "1px solid #dfe3ea", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #eef0f4", display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "إرسال طلب موافقة" : "Send a consent request"}</span>
        <LaborArticleCite
          article={consentTopicMeta(topic).article}
          decisionId={consentTopicMeta(topic).decisionId}
          ar={ar}
          showOfficial
          entitlement={topic === "night" || topic === "ot"}
        />
        <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
          {ar
            ? "ترسل الموافقة إلى الموظف — يكتب ويوقّع ويرفع النسخة. موافقة 18632 الليلية تُفتح تلقائياً ولا تُرفع من هنا."
            : "You send the consent to the worker — they write, sign, and upload the copy. Night 18632 opens automatically and is not raised here."}
        </span>
      </div>
      <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
        <RequestEmployeePicker
          employees={employees}
          stations={stations}
          value={employeeId}
          onChange={setEmployeeId}
          ar={ar}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الموضوع" : "Subject"}</span>
            <select value={topic} onChange={(e) => onTopic(e.target.value)} style={field}>
              {raiseTopics.map((row) => <option key={row.id} value={row.id}>{ar ? row.ar : row.en}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: MUTED }}>{ar ? "مهلة الرد" : "Deadline"}</span>
            <PlatformDateField ar={ar} value={deadline} onChange={setDeadline} />
          </label>
        </div>
        <RequestSelfSignBlock
          ar={ar}
          file={file}
          paper={paper}
          fileBusy={fileBusy}
          paperBusy={paperBusy}
          fileError={fileError}
          paperError={paperError}
          onPickFile={onFile}
          onClearFile={() => { setFile(null); setPaper(null); setFileError(""); setPaperError(""); }}
          onPickPaper={(picked) => loadPicked(picked, { setRecord: setPaper, setError: setPaperError, setBusy: setPaperBusy })}
          onClearPaper={() => { setPaper(null); setPaperError(""); }}
          accept="application/pdf,image/jpeg,image/png,image/webp"
          requirePaper={false}
          hint={ar ? CONSENT_MINISTRY_HINT_AR : CONSENT_MINISTRY_HINT_EN}
          fileLabel={ar ? "أرفق النموذج" : "Attach the form"}
        />
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "نص الطلب كما سيقرؤه الموظف" : "The text the worker will read"}</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ ...field, resize: "vertical", lineHeight: 1.9 }} />
        </label>
        <button type="button" disabled={!gate.ok || fileBusy || paperBusy} onClick={send} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "11px 16px", border: "none", background: gate.ok ? "#14213d" : "#eef0f4", color: gate.ok ? "#fff" : MUTED, cursor: gate.ok ? "pointer" : "default", alignSelf: "flex-start" }}>
          {gate.ok ? (ar ? "أرسل طلب الموافقة" : "Send the consent request") : (ar ? gate.reason : gate.reasonEn)}
        </button>
      </div>
      <div style={{ padding: "13px 20px", borderTop: "1px solid #eef0f4", display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "ما أرسلتُه — الحالة تُستنبط من النسخة الموقّعة" : "What I sent — status is derived from the signed copy"}</span>
        <span style={{ fontSize: 11, color: MUTED }}>{sent.length}</span>
      </div>
      {sent.length === 0 ? (
        <div style={{ padding: "16px 20px", fontSize: 11, color: MUTED, lineHeight: 1.9 }}>{ar ? "لم تُرسل طلب موافقة بعد." : "No consent request sent yet."}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2.2fr) minmax(0, 1.2fr) 140px 118px", gap: 16, padding: "11px 18px", background: "#fafbfc", borderTop: "1px solid #eef0f4", borderBottom: "1px solid #eef0f4", fontSize: 10, letterSpacing: "0.06em", color: MUTED, fontWeight: 600 }}>
            <span>{ar ? "الملف" : "File"}</span>
            <span>{ar ? "الموظف" : "Worker"}</span>
            <span>{ar ? "الحالة" : "Status"}</span>
            <span>{ar ? "الوقت" : "When"}</span>
          </div>
          {sent.map((row) => (
            <ConsentSignRow key={row.id} item={row} ar={ar} party={row.employee?.name} refresh={refresh} />
          ))}
        </>
      )}
    </section>
  );
}
