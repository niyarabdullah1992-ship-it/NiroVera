import PersonSearchAdd from "@/components/shared/PersonSearchAdd";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Loader2, X } from "lucide-react";
import AttachDropzone from "@/components/shared/AttachDropzone";
import SectionBackLink from "@/components/shared/SectionBackLink";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import NvIcon from "@/components/shared/NvIcon";
import { SectionHead, mono, slab } from "@/components/schedules/scheduleChrome";
import { BORDER, CARD, CONTROL_RADIUS, MUTED } from "@/lib/platformStyles";
import { formatUiNumber } from "@/lib/dateFormat";
import { PDF_NEEDS_PASSWORD,
  ENVELOPE_DOC_ACCEPT,
  countPdfPages,
  docTitleOf,
  envelopeDocRefusal,
  moveDoc,
} from "@/lib/envelopeDocuments";
import {
  DEFAULT_EXPIRY_DAYS,
  EXPIRY_CHOICES,
  REMINDER_CHOICES,
  checkEnvelopeSetupGate,
  emailValid,
} from "@/lib/envelopeSetup";
import { initialsOf } from "@/lib/signingEnvelopes";

// Muted per-recipient tints — the same palette the field editor paints their fields with.
export const RECIPIENT_COLORS = ["#3B5A86", "#8A6A2E", "#2F7480", "#9A5B2E", "#7A5148", "#5F6B7A"];

// The طلباتي raise-frame field (FileCorrectionRaise): label above, hairline, radius 8.
const field = { fontFamily: "inherit", fontSize: 12.5, padding: "10px 12px", border: `1px solid ${BORDER}`, background: CARD, color: "var(--nv-ink)", outline: "none", width: "100%", boxSizing: "border-box", borderRadius: CONTROL_RADIUS };
const block = { padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 };
const label = { fontSize: 11.5, color: MUTED };
const quietBtn = { fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" };
const iconBtn = { fontFamily: "inherit", width: 26, height: 26, borderRadius: 6, border: "1px solid transparent", background: "transparent", color: MUTED, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, flex: "none" };

const countAr = (n, [one, two, few, many]) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);

function sizeLabel(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

let seq = 0;
const key = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

/** A draft keeps its documents as data URLs; turn them back into Files. */
function fileFromDataUrl(doc) {
  try {
    const [head, body] = String(doc.dataUrl || "").split(",");
    const type = (head.match(/data:([^;]+)/) || [])[1] || doc.type || "application/pdf";
    const bin = atob(body || "");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], doc.name || "document.pdf", { type });
  } catch {
    return null;
  }
}

function readDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

/**
 * «مظروف جديد» — one page, the طلباتي raise frame: المستندات · المستلمون · الرسالة · التذكير والصلاحية,
 * then the readiness line and the dark-green «التالي: الحقول». Nothing is sent from here; the field
 * editor sends. The page only gathers what the envelope is, and refuses to move on with a named gap.
 */
export default function EnvelopeSetup({
  ar,
  currentUser,
  employees = [],
  stations = [],
  canGroup = false,
  sealReady = false,
  sealPreview = "",
  initial = null,
  busy = false,
  error = "",
  onOpenStudio,
  onCancel,
  onNext,
  onSaveDraft,
}) {
  const me = useMemo(() => ({
    key: "me",
    isMe: true,
    name: currentUser?.profile?.signatureName || currentUser?.name || "",
    email: String(currentUser?.email || "").toLowerCase(),
    employeeId: currentUser?.id || null,
    role: currentUser?.role || "",
    stationId: currentUser?.stationId || null,
  }), [currentUser]);

  const [docs, setDocs] = useState([]);
  const [docError, setDocError] = useState("");
  const [reading, setReading] = useState(false);
  const [meSigns, setMeSigns] = useState(initial?.meSigns !== false);
  const [myStamp, setMyStamp] = useState(initial?.myStamp === true);
  const [recipients, setRecipients] = useState(() => (initial?.recipients || []).map((row, index) => ({ ...row, key: row.key || key("r"), color: row.color || RECIPIENT_COLORS[(index + 1) % RECIPIENT_COLORS.length] })));
  const [orderMode, setOrderMode] = useState(initial?.orderMode === "sequential" ? "sequential" : "parallel");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [subjectTouched, setSubjectTouched] = useState(Boolean(initial?.subject));
  const [message, setMessage] = useState(initial?.message || "");
  const [reminderEveryDays, setReminderEveryDays] = useState(Number(initial?.reminderEveryDays) || 0);
  const [expiryDays, setExpiryDays] = useState(Number(initial?.expiryDays) || DEFAULT_EXPIRY_DAYS);
  const [extName, setExtName] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extError, setExtError] = useState("");
  const [dragKey, setDragKey] = useState("");
  const [draftId] = useState(initial?.id || "");
  const docsMissing = Boolean(initial?.docsMissing);

  const addFiles = async (files) => {
    setDocError("");
    if (!files?.length) return;
    setReading(true);
    try {
      let next = docs;
      for (const file of files) {
        const refusal = envelopeDocRefusal(file, next, ar);
        if (refusal) { setDocError(`${file.name}: ${refusal}`); continue; }
        const pages = await countPdfPages(file);
        if (pages === PDF_NEEDS_PASSWORD) { setDocError(ar ? `${file.name}: الملف محمي بكلمة مرور فتح — احفظه نسخة بلا كلمة مرور ثم ارفعه، فالموقّعون لا يستطيعون فتحه.` : `${file.name}: this PDF needs a password to open — save a copy without it, then upload.`); continue; }
        if (pages === 0) { setDocError(ar ? `${file.name}: تعذّر قراءة هذا الـ PDF — إن كان محمياً أو تالفاً فصدّره من جديد.` : `${file.name}: this PDF could not be read — export it again.`); continue; }
        next = [...next, { key: key("doc"), name: file.name, size: file.size, type: file.type, file, pages }];
      }
      setDocs(next);
    } finally {
      setReading(false);
    }
  };

  // Files handed over from the desk dropzone, or kept on a draft.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const handed = (initial?.files || []).filter(Boolean);
    const kept = (initial?.docs || []).map(fileFromDataUrl).filter(Boolean);
    const all = [...handed, ...kept];
    if (all.length) addFiles(all);
  }, []);

  // The subject follows the first document until the sender writes their own.
  useEffect(() => {
    if (subjectTouched) return;
    const first = docs[0];
    setSubject(first ? (ar ? `للتوقيع: ${docTitleOf(first.name)}` : `Please sign: ${docTitleOf(first.name)}`) : "");
  }, [docs, subjectTouched, ar]);

  const roster = useMemo(() => (employees || [])
    .filter((emp) => emp?.email && String(emp.email).toLowerCase() !== me.email)
    .map((emp) => {
      const profile = emp.profile || {};
      const station = (stations || []).find((row) => String(row.id) === String(emp.stationId));
      const title = profile.jobTitle || emp.jobTitle || profile.position || "";
      return {
        id: String(emp.id || emp.employeeId),
        name: emp.name || "",
        email: String(emp.email || "").toLowerCase(),
        role: emp.role || "",
        stationId: emp.stationId || null,
        title,
        sub: [title, station?.name].filter(Boolean).join(" · "),
      };
    }), [employees, stations, me.email]);
  const taken = new Set(recipients.map((row) => row.email));
  const availablePeople = roster.filter((person) => !taken.has(person.email));

  const nextColor = () => RECIPIENT_COLORS[(recipients.length + 1) % RECIPIENT_COLORS.length];
  const addPerson = (person) => {
    setRecipients((list) => [...list, {
      key: key("r"),
      name: person.name,
      email: person.email,
      employeeId: person.id,
      role: person.role,
      stationId: person.stationId,
      title: person.title,
      outside: false,
      stamp: false,
      color: nextColor(),
    }]);
  };
  const addExternal = () => {
    setExtError("");
    const name = extName.trim();
    const email = extEmail.trim().toLowerCase();
    if (!name) { setExtError(ar ? "اكتب اسم المستلم." : "Write the recipient's name."); return; }
    if (!emailValid(email)) { setExtError(ar ? "بريد غير صالح." : "Invalid email."); return; }
    if (taken.has(email) || email === me.email) { setExtError(ar ? "هذا البريد مضاف بالفعل." : "That email is already on the envelope."); return; }
    setRecipients((list) => [...list, { key: key("x"), name, email, employeeId: null, role: "", stationId: null, title: "", outside: true, stamp: false, color: nextColor() }]);
    setExtName("");
    setExtEmail("");
  };
  const patchRecipient = (rowKey, patch) => setRecipients((list) => list.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)));
  const removeRecipient = (rowKey) => setRecipients((list) => list.filter((row) => row.key !== rowKey));
  const moveRecipient = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= recipients.length) return;
    setRecipients((list) => {
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const dropOn = (targetKey) => {
    if (!dragKey || dragKey === targetKey) return;
    setRecipients((list) => {
      const from = list.findIndex((row) => row.key === dragKey);
      const to = list.findIndex((row) => row.key === targetKey);
      if (from < 0 || to < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragKey("");
  };

  const gate = checkEnvelopeSetupGate({ docs, recipients, meSigns, me, subject, sealReady, canGroup, ar });
  const totalPages = docs.reduce((sum, doc) => sum + (doc.pages || 0), 0);
  const parties = (meSigns ? 1 : 0) + recipients.length;
  const sequential = orderMode === "sequential" && parties > 1;

  const envelope = () => ({
    id: draftId || undefined,
    docs,
    meSigns,
    myStamp,
    me,
    recipients,
    orderMode,
    subject: subject.trim(),
    message: message.trim(),
    reminderEveryDays,
    expiryDays,
  });

  const saveDraft = async () => {
    const withData = await Promise.all(docs.map(async (doc) => ({ name: doc.name, size: doc.size, type: doc.type, dataUrl: await readDataUrl(doc.file) })));
    onSaveDraft?.({ ...envelope(), docs: withData });
  };

  const partyRow = (row, index, { isMe = false } = {}) => {
    const step = sequential ? (meSigns ? index + 1 : index + 1) : null;
    return (
      <div
        key={row.key}
        data-recipient={isMe ? "me" : row.email}
        draggable={!isMe && sequential}
        onDragStart={() => !isMe && setDragKey(row.key)}
        onDragOver={(event) => { if (!isMe && dragKey) event.preventDefault(); }}
        onDrop={() => !isMe && dropOn(row.key)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 10, background: dragKey === row.key ? "var(--nv-soft, #F6F8F7)" : CARD, minWidth: 0, flexWrap: "wrap" }}
      >
        {sequential ? (
          <span data-step={step} dir="ltr" style={{ ...mono, width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--nv-line)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", color: "var(--nv-ink)" }}>{step}</span>
        ) : null}
        {!isMe && sequential ? <GripVertical aria-hidden size={14} style={{ color: MUTED, cursor: "grab", flex: "none" }} /> : null}
        {/* The recipient's colour (the same one his fields carry on the page) lives in his initials — no side bar. */}
        <span aria-hidden data-recipient-mark={row.color || RECIPIENT_COLORS[0]} style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: row.color || RECIPIENT_COLORS[0], background: `color-mix(in oklab, ${row.color || RECIPIENT_COLORS[0]} 12%, var(--nv-card))`, border: `1px solid color-mix(in oklab, ${row.color || RECIPIENT_COLORS[0]} 35%, var(--nv-card))` }}>{initialsOf(row.name || row.email)}</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: "1 1 160px" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.name || "—"}{isMe ? <span style={{ fontWeight: 500, color: MUTED }}>{ar ? " · أنت" : " · you"}</span> : null}
          </span>
          <span dir="auto" style={{ fontSize: 11.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isMe
              ? (sealReady ? (ar ? "يوقّع بتوقيعك المحفوظ" : "Signs with your saved signature") : (ar ? "تعتمد توقيعك عند التوقيع" : "You adopt your signature when you sign"))
              : [row.outside ? (ar ? "من خارج المنشأة" : "Outside the company") : (row.title || (ar ? "من المنشأة" : "From the company")), row.email].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-ink2)", flex: "none" }}>{ar ? "يوقّع" : "Signs"}</span>
        {!isMe && sequential ? (
          <span style={{ display: "inline-flex", gap: 2, flex: "none" }}>
            <button type="button" aria-label={ar ? "قدّمه" : "Move up"} disabled={index - (meSigns ? 1 : 0) <= 0} onClick={() => moveRecipient(index - (meSigns ? 1 : 0), -1)} style={{ ...iconBtn, opacity: index - (meSigns ? 1 : 0) <= 0 ? 0.35 : 1 }}><ArrowUp size={14} /></button>
            <button type="button" aria-label={ar ? "أخّره" : "Move down"} disabled={index - (meSigns ? 1 : 0) >= recipients.length - 1} onClick={() => moveRecipient(index - (meSigns ? 1 : 0), 1)} style={{ ...iconBtn, opacity: index - (meSigns ? 1 : 0) >= recipients.length - 1 ? 0.35 : 1 }}><ArrowDown size={14} /></button>
          </span>
        ) : null}
        {!isMe ? (
          <button type="button" aria-label={ar ? `احذف ${row.name}` : `Remove ${row.name}`} onClick={() => removeRecipient(row.key)} style={iconBtn}><X size={14} /></button>
        ) : null}
      </div>
    );
  };

  const nextLabel = gate.mode === "self" ? (ar ? "التالي: موضع ختمك" : "Next: place your seal") : (ar ? "التالي: الحقول" : "Next: fields");

  return (
    <div data-envelope-setup="1" dir={ar ? "rtl" : "ltr"} style={{ width: "min(920px, 100%)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <SectionBackLink ar={ar} label={ar ? "التوقيع الرقمي" : "Digital signing"} onClick={onCancel} />
        <button type="button" data-save-draft="1" onClick={saveDraft} disabled={busy || reading} style={quietBtn}>{ar ? "احفظ كمسودة" : "Save as draft"}</button>
      </div>

      <section style={{ ...slab, overflow: "hidden" }}>
        <SectionHead
          title={ar ? "مظروف جديد" : "New envelope"}
          note={ar ? "المستندات والمستلمون والرسالة هنا، ثم تضع الحقول على الصفحات وترسل." : "Documents, recipients and the message here; then you place the fields on the pages and send."}
        />

        {/* 1 · المستندات */}
        <div style={block} data-setup-section="docs">
          <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "المستندات" : "Documents"}</span>
          {docsMissing && !docs.length ? (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--nv-warn-ink, #8A5A12)" }}>{ar ? "هذه المسودة لم تحتفظ بملفاتها (أكبر من سعة الجهاز) — أرفقها من جديد." : "This draft could not keep its files — attach them again."}</span>
          ) : null}
          {docs.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {docs.map((doc, index) => (
                <div key={doc.key} data-envelope-doc={doc.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, background: CARD, minWidth: 0 }}>
                  <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED, width: 16, textAlign: "center", flex: "none" }}>{index + 1}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                    <span dir="auto" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docTitleOf(doc.name)}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>
                      <span dir="ltr" style={mono}>{formatUiNumber(doc.pages)}</span> {ar ? (doc.pages === 1 ? "صفحة" : "صفحات") : (doc.pages === 1 ? "page" : "pages")} · <span dir="ltr" style={mono}>{sizeLabel(doc.size)}</span>
                    </span>
                  </span>
                  <button type="button" aria-label={ar ? "قدّمه" : "Move up"} disabled={index === 0} onClick={() => setDocs((list) => moveDoc(list, index, -1))} style={{ ...iconBtn, opacity: index === 0 ? 0.35 : 1 }}><ArrowUp size={14} /></button>
                  <button type="button" aria-label={ar ? "أخّره" : "Move down"} disabled={index === docs.length - 1} onClick={() => setDocs((list) => moveDoc(list, index, 1))} style={{ ...iconBtn, opacity: index === docs.length - 1 ? 0.35 : 1 }}><ArrowDown size={14} /></button>
                  <button type="button" aria-label={ar ? `أزل ${doc.name}` : `Remove ${doc.name}`} onClick={() => setDocs((list) => list.filter((row) => row.key !== doc.key))} style={iconBtn}><X size={14} /></button>
                </div>
              ))}
              {docs.length > 1 ? (
                <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
                  {ar
                    ? <>تُضم بهذا الترتيب في ملف توقيع واحد · <span dir="ltr" style={mono}>{formatUiNumber(totalPages)}</span> صفحة — بصمة واحدة ورابط تحقق واحد.</>
                    : <>Joined in this order into one signing file · <span dir="ltr" style={mono}>{totalPages}</span> pages — one fingerprint, one verify link.</>}
                </span>
              ) : null}
            </div>
          ) : null}
          <AttachDropzone
            ar={ar}
            required
            showNeed={!docs.length}
            multiple
            busy={reading}
            error={docError}
            accept={ENVELOPE_DOC_ACCEPT}
            label={docs.length ? (ar ? "أضف مستنداً آخر" : "Add another document") : (ar ? "اسحب المستندات هنا أو اخترها" : "Drop the documents here or choose them")}
            typesLabel={ar ? "PDF أو صورة PNG/JPEG · حتى 25 ميجابايت للملف" : "PDF or PNG/JPEG · up to 25 MB each"}
            onPickMany={addFiles}
            onPick={(file) => addFiles(file ? [file] : [])}
          />
        </div>

        {/* 2 · المستلمون */}
        <div style={block} data-setup-section="recipients">
          <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "المستلمون" : "Recipients"}</span>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, lineHeight: 1.7, color: "var(--nv-ink)", cursor: "pointer" }}>
            <input type="checkbox" data-me-signs="1" checked={meSigns} onChange={(event) => setMeSigns(event.target.checked)} style={{ marginTop: 5 }} />
            <span>{ar ? "أنا أيضاً أوقّع" : "I sign too"}</span>
          </label>
          {meSigns && !sealReady ? (
            <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
              {recipients.length
                ? (ar ? "لا ختم محفوظ لك — تعتمد توقيعك عند دورك مثل بقية المستلمين، أو " : "No saved seal — you adopt your signature on your turn like the others, or ")
                : (ar ? "توقيعك وحدك يُختم بختمك — " : "Signing alone uses your seal — ")}
              <button type="button" onClick={onOpenStudio} style={{ border: "none", background: "none", padding: 0, color: "var(--nv-ok-ink, #2F6B43)", fontWeight: 700, fontFamily: "inherit", fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>{ar ? "صمّم ختمك" : "design your seal"}</button>
            </span>
          ) : null}

          {parties > 1 ? (
            <SubTypeGrid label={ar ? "ترتيب التوقيع" : "Signing order"}>
              <SubTypeOption dataKey="parallel" on={orderMode === "parallel"} title={ar ? "بالتوازي" : "In parallel"} sub={ar ? "يصل الطلب للجميع معاً ويوقّع كلٌ متى شاء" : "Everyone gets it at once and signs when they choose"} onClick={() => setOrderMode("parallel")} />
              <SubTypeOption dataKey="sequential" on={orderMode === "sequential"} title={ar ? "بالتسلسل" : "In order"} sub={ar ? "يُعرض الترتيب على المظروف ويُذكَّر صاحب الدور" : "The order shows on the envelope; the party whose turn it is gets reminded"} onClick={() => setOrderMode("sequential")} />
            </SubTypeGrid>
          ) : null}

          {(meSigns || recipients.length) ? (
            <div data-recipient-list="1" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {meSigns ? partyRow({ ...me, color: RECIPIENT_COLORS[0] }, 0, { isMe: true }) : null}
              {recipients.map((row, index) => partyRow(row, index + (meSigns ? 1 : 0)))}
            </div>
          ) : null}

          {canGroup ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                <span style={label}>{ar ? "أضف من المنشأة" : "Add from the company"}</span>
                {/* Search, then add — the company list stays folded until a name is typed. */}
                <PersonSearchAdd
                  ar={ar}
                  dataKey="envelope"
                  rows={availablePeople.map((person) => ({ ...person, sub: person.sub || person.email, hay: [person.name, person.sub, person.email].filter(Boolean).join(" ") }))}
                  onPick={(person) => addPerson(person)}
                  emptyScope={ar ? "لا موظف آخر ببريد في نطاقك." : "No other employee with an email in your scope."}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                <span style={label}>{ar ? "أو مستلم من خارج المنشأة" : "Or a recipient outside the company"}</span>
                <div className="nv-env-ext-row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr) auto", gap: 8, alignItems: "center" }}>
                  <style>{"@media (max-width: 560px){.nv-env-ext-row{grid-template-columns:1fr !important}}"}</style>
                  <input data-ext-name="1" value={extName} onChange={(event) => setExtName(event.target.value)} placeholder={ar ? "الاسم" : "Name"} style={{ ...field, width: "100%", minWidth: 0, boxSizing: "border-box" }} />
                  <input data-ext-email="1" dir="ltr" value={extEmail} onChange={(event) => setExtEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addExternal(); }} placeholder="name@example.com" style={{ ...field, ...mono, textAlign: "left", width: "100%", minWidth: 0, boxSizing: "border-box" }} />
                  <button type="button" data-ext-add="1" onClick={addExternal} style={{ ...quietBtn, height: 40, minHeight: 40, padding: "0 18px", justifyContent: "center" }}>{ar ? "أضف" : "Add"}</button>
                </div>
                {extError ? <span role="alert" style={{ fontSize: 11.5, color: "var(--nv-bad-ink)" }}>{extError}</span> : (
                  <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{ar ? "يصله رابط توقيع خاص به على بريده، ويوقّع دون حساب في المنصة." : "They get a personal signing link by email and sign without a platform account."}</span>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* 3 · الرسالة — only an envelope that is sent carries one */}
        {gate.mode === "group" ? (
          <div style={block} data-setup-section="message">
            <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "الرسالة" : "Message"}</span>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>{ar ? "الموضوع" : "Subject"}</span>
              <input data-envelope-subject="1" value={subject} maxLength={160} onChange={(event) => { setSubject(event.target.value); setSubjectTouched(true); }} style={field} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={label}>{ar ? "نص الرسالة — اختياري" : "Message — optional"}</span>
              <textarea data-envelope-message="1" rows={3} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={ar ? "ما الذي يوقّعونه ولماذا، وأي موعد يهمّك." : "What they sign, why, and any date that matters."} style={{ ...field, resize: "vertical" }} />
            </label>
          </div>
        ) : null}

        {/* 4 · التذكير والصلاحية */}
        {gate.mode === "group" ? (
          <div style={block} data-setup-section="reminders">
            <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "التذكير والصلاحية" : "Reminders and expiry"}</span>
            <span style={label}>{ar ? "تذكير تلقائي لمن عليه الدور" : "Automatic reminder to whoever’s turn it is"}</span>
            <SubTypeGrid label={ar ? "التذكير" : "Reminders"}>
              {REMINDER_CHOICES.map((choice) => (
                <SubTypeOption key={choice.days} dataKey={`remind-${choice.days}`} on={reminderEveryDays === choice.days} title={ar ? choice.ar : choice.en} sub={ar ? choice.subAr : choice.subEn} onClick={() => setReminderEveryDays(choice.days)} />
              ))}
            </SubTypeGrid>
            <span style={label}>{ar ? "صلاحية روابط التوقيع" : "Signing links stay open"}</span>
            <SubTypeGrid label={ar ? "الصلاحية" : "Expiry"}>
              {EXPIRY_CHOICES.map((days) => (
                <SubTypeOption key={days} dataKey={`expiry-${days}`} on={expiryDays === days} title={ar ? `${days} يوماً` : `${days} days`} sub={ar ? "بعدها يُغلق ما لم يُوقَّع" : "After that, what is unsigned closes"} onClick={() => setExpiryDays(days)} />
              ))}
            </SubTypeGrid>
          </div>
        ) : null}

        {/* Readiness + the one primary — exactly the «أرسل الطلب» footer of طلباتي */}
        <div style={{ ...block, borderBottom: "none" }}>
          {sealPreview && gate.mode === "self" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, color: MUTED }}>
              <img src={sealPreview} alt="" style={{ height: 30, maxWidth: 90, objectFit: "contain", border: "1px solid var(--nv-line)", borderRadius: 6, background: "#fff", padding: 2 }} />
              {ar ? "يُختم المستند بختمك ويُغلق فوراً ببصمته." : "The document is stamped with your seal and closes at once with its fingerprint."}
            </span>
          ) : null}
          <span data-setup-gate={gate.ok ? "ok" : "gap"} style={{ fontSize: 11.5, fontWeight: 600, color: gate.ok ? "#2F6B43" : "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7 }}>
            {gate.ok
              ? <><NvIcon name="check" size={12} strokeWidth={2} /> {gate.mode === "self"
                ? (ar ? "جاهز — تضع ختمك على الصفحة ثم تُنهي" : "Ready — place your seal on the page, then finish")
                : (ar ? `جاهز للحقول — ${countAr(gate.signers.length, ["مستلم واحد", "مستلمان", "مستلمين", "مستلماً"])}${sequential ? " بالتسلسل" : parties > 1 ? " بالتوازي" : ""}` : `Ready for fields — ${gate.signers.length} recipient${gate.signers.length > 1 ? "s" : ""}`)}</>
              : gate.reason}
          </span>
          {error ? <span role="alert" style={{ fontSize: 11.5, color: "var(--nv-bad-ink)" }}>{error}</span> : null}
          <button type="button" data-setup-next="1" disabled={!gate.ok || busy || reading} onClick={() => onNext?.(envelope(), gate)} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, height: 42, border: "none", borderRadius: 8, background: gate.ok ? "#0B3D27" : "var(--nv-line)", color: gate.ok ? "#fff" : MUTED, cursor: gate.ok && !busy ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {nextLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
