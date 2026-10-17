import React, { useMemo, useState } from "react";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { proveNightObligation } from "@/lib/store";
import { uploadFileOrLocal } from "@/lib/localFileUpload";
import { firstAidCertificate, NIGHT_FOOD_METHODS } from "@/lib/nightObligations";
import { ghostButton } from "@/components/schedules/scheduleChrome";

const field = {
  fontFamily: "inherit",
  fontSize: 12,
  height: 30,
  boxSizing: "border-box",
  padding: "0 9px",
  border: "1px solid var(--nv-line, #E2E8F0)",
  borderRadius: DS_CONTROL_RADIUS,
  background: "var(--nv-card, #fff)",
  color: "var(--nv-ink, #14284B)",
  width: "100%",
  minWidth: 0,
  outline: "none",
  textAlign: "start",
};
const label = { fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6 };
const line = { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };

function niceExpiry(key, ar) {
  if (!key) return "";
  const d = new Date(`${String(key).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function FilePick({ ar, file, onFile, required = false }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span style={line}>
      <input
        type="file"
        accept=".pdf,.doc,.docx,image/*"
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          if (!picked) return;
          setBusy(true);
          setErr("");
          try {
            const up = await uploadFileOrLocal(picked);
            onFile({ url: up.file_url, name: up.name || picked.name, mimeType: picked.type || "" });
          } catch {
            setErr(ar ? "تعذّر رفع الملف — جرّب ملفاً أصغر." : "Upload failed — try a smaller file.");
          } finally {
            setBusy(false);
          }
        }}
        style={{ fontFamily: "inherit", fontSize: 11.5, maxWidth: "100%", minWidth: 0 }}
      />
      {busy ? <span style={label}>{ar ? "يُرفع…" : "Uploading…"}</span> : null}
      {file?.name ? <span style={{ ...label, color: "var(--nv-ink2)" }}>{file.name}</span> : null}
      {err ? <span style={{ ...label, color: "var(--nv-bad-ink)" }}>{err}</span> : null}
      {required && !file ? <span style={label}>{ar ? "الملف مطلوب." : "A file is required."}</span> : null}
    </span>
  );
}

/**
 * «أثبت» — the small inline form under one 18632 obligation row. Writes the same flag the publish gate reads,
 * with the proof (who/when + fields) beside it — see proveNightObligation.
 */
export default function NightObligationProof({ obligationKey, ar = true, companyId, stationId, employees = [], actor, onSaved, onCancel }) {
  const [aiders, setAiders] = useState([]);
  const [extraName, setExtraName] = useState("");
  const [method, setMethod] = useState("");
  const [party, setParty] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [ack, setAck] = useState(false);

  const people = useMemo(() => (employees || []).filter((row) => row && row.id && row.name).map((row) => {
    const cert = firstAidCertificate(row);
    const expiry = String(cert?.expiryDate || "").slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return { id: row.id, name: row.name, cert, expiry, expired: !!(expiry && expiry < today) };
  }), [employees]);

  let proof = null;
  let ready = false;
  if (obligationKey === "nightFirstAidReady") {
    const pickedRows = people.filter((row) => aiders.includes(row.id));
    const typed = extraName.trim() ? [{ name: extraName.trim() }] : [];
    proof = { aiders: [...pickedRows.map((row) => ({ employeeId: row.id, name: row.name, certId: row.cert?.id || null })), ...typed] };
    /* An expired certificate cannot prove the row — at least one current (or unlisted) first-aider. */
    ready = typed.length > 0 || pickedRows.some((row) => !row.expired);
  } else if (obligationKey === "nightEmergencyTransferReady") {
    proof = { method: method.trim(), party: party.trim(), contact: contact.trim(), file: file || undefined };
    ready = !!(proof.method && proof.contact);
  } else if (obligationKey === "nightFoodAccessReady") {
    proof = { method, note: note.trim() };
    ready = !!method;
  } else if (obligationKey === "nightTrainingParity") {
    proof = { acknowledged: true };
    ready = ack;
  } else if (obligationKey === "nightGuidePublished") {
    proof = { file };
    ready = !!file?.url;
  }

  const save = () => {
    if (!ready || !companyId || !stationId) return;
    proveNightObligation(companyId, { stationId, key: obligationKey, proof, by: actor?.id || null, byName: actor?.name || "" });
    onSaved?.();
  };

  return (
    <div
      data-night-proof-form={obligationKey}
      dir={ar ? "rtl" : "ltr"}
      style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 12px", border: "1px solid var(--nv-line2, #EEF2F7)", borderRadius: DS_CONTROL_RADIUS, background: "var(--nv-paper, var(--nv-card))", minWidth: 0 }}
    >
      {obligationKey === "nightFirstAidReady" ? (
        <>
          <span style={label}>{ar ? "من المسعف المدرَّب على ورديات الليل؟ تُقرأ شهادته من ملفه — إن انتهت عاد البند ناقصاً." : "Who is the trained first-aider on night shifts? Their certificate is read from the file — if it expires the row returns to missing."}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
            {people.map((row) => (
              <label key={row.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: "var(--nv-ink)", minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={aiders.includes(row.id)}
                  onChange={(e) => setAiders((list) => (e.target.checked ? [...list, row.id] : list.filter((id) => id !== row.id)))}
                />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                <span style={{ ...label, color: row.expired ? "var(--nv-bad-ink)" : row.cert ? "var(--nv-ok-ink)" : "var(--nv-muted)", whiteSpace: "nowrap" }}>
                  {!row.cert
                    ? (ar ? "لا شهادة إسعاف في الملف" : "No first-aid certificate on file")
                    : row.expired
                      ? (ar ? `منتهية ${niceExpiry(row.expiry, ar)}` : `Expired ${niceExpiry(row.expiry, ar)}`)
                      : row.expiry
                        ? (ar ? `سارية حتى ${niceExpiry(row.expiry, ar)}` : `Valid to ${niceExpiry(row.expiry, ar)}`)
                        : (ar ? "شهادة في الملف" : "Certificate on file")}
                </span>
              </label>
            ))}
          </div>
          <span style={line}>
            <span style={label}>{ar ? "أو اسم مسعف من خارج القائمة" : "Or a first-aider not listed"}</span>
            <input value={extraName} onChange={(e) => setExtraName(e.target.value)} style={field} />
          </span>
        </>
      ) : null}

      {obligationKey === "nightEmergencyTransferReady" ? (
        <>
          <span style={line}>
            <span style={label}>{ar ? "طريقة النقل (مثلاً: إسعاف الهلال الأحمر، سيارة الموقع)" : "Transfer method (e.g. Red Crescent ambulance, site vehicle)"}</span>
            <input value={method} onChange={(e) => setMethod(e.target.value)} style={field} />
          </span>
          <span style={line}>
            <span style={label}>{ar ? "الجهة (اختياري)" : "Party (optional)"}</span>
            <input value={party} onChange={(e) => setParty(e.target.value)} style={field} />
          </span>
          <span style={line}>
            <span style={label}>{ar ? "رقم التواصل" : "Contact number"}</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} dir="ltr" inputMode="tel" style={field} />
          </span>
          <span style={line}>
            <span style={label}>{ar ? "مرفق (اختياري) — عقد أو خطة الطوارئ" : "Attachment (optional) — contract or emergency plan"}</span>
            <FilePick ar={ar} file={file} onFile={setFile} />
          </span>
        </>
      ) : null}

      {obligationKey === "nightFoodAccessReady" ? (
        <>
          <span style={label}>{ar ? "كيف يصل العامل الليلي إلى الطعام؟" : "How does the night worker reach food?"}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {NIGHT_FOOD_METHODS.map((row) => (
              <label key={row.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--nv-ink)" }}>
                <input type="radio" name="night-food-method" checked={method === row.id} onChange={() => setMethod(row.id)} />
                {ar ? row.ar : row.en}
              </label>
            ))}
          </div>
          <span style={line}>
            <span style={label}>{ar ? "ملاحظة (اختياري)" : "Note (optional)"}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} style={field} />
          </span>
        </>
      ) : null}

      {obligationKey === "nightTrainingParity" ? (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--nv-ink)", lineHeight: 1.7 }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 4 }} />
          <span>
            {ar
              ? "تُقرّ الموارد البشرية بأن العامل الليلي يتساوى مع العامل النهاري في فرص التأهيل والتدريب والترقية (القرار 18632 — متطلبات أ). يُجدَّد الإقرار كل عام."
              : "HR acknowledges that night workers have the same qualification, training and promotion opportunities as day workers (decision 18632 — requirement a). Renewed every year."}
          </span>
        </label>
      ) : null}

      {obligationKey === "nightGuidePublished" ? (
        <span style={line}>
          <span style={label}>{ar ? "ارفع دليل إجراءات العمل الليلي — يُنشر في ملفات المنشأة ليطّلع عليه العاملون." : "Upload the night-work procedures guide — it is published to the company files for workers."}</span>
          <FilePick ar={ar} file={file} onFile={setFile} required />
        </span>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={save}
          disabled={!ready}
          style={ghostButton({ background: ready ? "var(--nv-navy, #14284B)" : "var(--nv-card)", color: ready ? "#fff" : "var(--nv-muted)", borderColor: ready ? "var(--nv-navy, #14284B)" : "var(--nv-line)", cursor: ready ? "pointer" : "not-allowed" })}
        >
          {ar ? "حفظ الإثبات" : "Save proof"}
        </button>
        <button type="button" onClick={onCancel} style={ghostButton()}>
          {ar ? "إلغاء" : "Cancel"}
        </button>
        <span style={label}>{ar ? `يُسجَّل باسم ${actor?.name || "المستخدم"} وتاريخ اليوم.` : `Recorded as ${actor?.name || "you"} with today's date.`}</span>
      </div>
    </div>
  );
}
