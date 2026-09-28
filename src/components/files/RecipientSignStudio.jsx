import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PdfPageCanvas, useSigningPdf } from "@/components/files/SigningWorkspacePages";
import { isMarkField } from "@/lib/signPdf";
import { consentFileKind } from "@/lib/documentReadGate";
import { RETRACT_DAY_OPTIONS, retractDaysLabel } from "@/lib/multiSignDerivations";
import { verificationUrlFor } from "@/lib/verificationBadge";

const NAVY = "var(--nv-navy)";
const GREEN = "var(--nv-btn-fill)";
const GOLD = "#F2C230";
const LINE = "var(--nv-line)";
const PAPER = "#F4F5F7";
const MONO = "'IBM Plex Mono', monospace";
const FONTS = [
  "'Amiri', serif",
  "'Aref Ruqaa', serif",
  "'Noto Naskh Arabic', serif",
  "'IBM Plex Sans Arabic', sans-serif",
];

function kindOf(field) {
  if (!field) return "text";
  if (field.type === "signature" || field.tool === "sig") return "sig";
  if (field.tool === "init") return "init";
  if (field.tool === "yn") return "yn";
  if (field.tool === "check" || isMarkField(field)) return "check";
  if (field.tool === "date") return "date";
  if (field.tool === "name") return "name";
  if (field.tool === "role") return "title";
  return "text";
}

function labelOf(kind, field, ar) {
  const map = {
    sig: ar ? "توقيع" : "Signature",
    init: ar ? "الأحرف الأولى" : "Initials",
    name: ar ? "الاسم" : "Name",
    date: ar ? "التاريخ" : "Date",
    title: ar ? "الصفة" : "Title",
    text: field?.label || (ar ? "نص" : "Text"),
    check: "",
    yn: ar ? "صح / خطأ" : "Yes / no",
  };
  return map[kind] || field?.label || "";
}

function initialsOf(name) {
  return String(name || "").trim().split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join(".");
}

function todayStamp() {
  return new Date().toLocaleDateString("en-GB");
}

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 180,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

function Scrim({ onClose, children }) {
  return (
    <div style={overlay}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,26,48,.35)" }} />
      {children}
    </div>
  );
}

function sheet(width) {
  return {
    position: "relative",
    width,
    background: "var(--nv-card)",
    borderRadius: width > 400 ? 14 : 8,
    boxShadow: "0 20px 60px rgba(20,33,61,.3)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

export default function RecipientSignStudio({ signing, onBack, onOpenStudio }) {
  const {
    ar, info, textValues, setTextValue, stampPreview, stampConfig, patchStampConfig,
    sign, reject, retract, signing: busy, stage, error, retractDays, setRetractDays, done,
  } = signing;
  const signer = info?.signer || {};
  const fields = useMemo(() => {
    const spots = signer.spots?.length
      ? signer.spots
      : (signer.spot ? [{ ...signer.spot, id: "signature", type: "signature", tool: "sig" }] : []);
    return spots.map((field, index) => ({ ...field, id: field.id || `field-${index}` }));
  }, [signer.spots, signer.spot]);

  const fileKind = consentFileKind({ name: info?.fileName, url: info?.docUrl });
  const imageUrl = fileKind === "image" ? info.docUrl : "";
  const { pdf, failed, failReason } = useSigningPdf(imageUrl ? null : info?.docUrl);
  const loadingDoc = Boolean(info?.docUrl) && !pdf && !failed && !imageUrl;
  const pages = imageUrl ? 1 : (pdf?.numPages || 1);

  const [started, setStarted] = useState(false);
  const [adopted, setAdopted] = useState(false);
  const [fontIndex, setFontIndex] = useState(0);
  const [name, setName] = useState(stampConfig?.name || signer.name || "");
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [filledSig, setFilledSig] = useState({});
  const [typing, setTyping] = useState(null);
  const [draft, setDraft] = useState("");
  const [ynField, setYnField] = useState(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [seen, setSeen] = useState({ 0: true });
  const [needSeen, setNeedSeen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [ack, setAck] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [retractOpen, setRetractOpen] = useState(false);
  const [retractNote, setRetractNote] = useState("");

  const rejected = Boolean(done?.rejected || info?.status === "rejected" || signer.status === "rejected");
  const success = !rejected && Boolean(done || signer.status === "signed");
  const displayName = name.trim() || signer.name || "";
  const initials = initialsOf(displayName);

  const valueOf = (field) => {
    const kind = kindOf(field);
    if (kind === "sig") return filledSig[field.id] ? displayName : "";
    return String(textValues[field.id] || "");
  };

  const pending = fields.filter((field) => !valueOf(field));
  const left = pending.length;
  const nextField = pending[0] || null;
  const allSeen = Array.from({ length: pages }, (_, index) => index).every((page) => seen[page]);
  const pageWidth = `min(100%, ${Math.round(640 * zoom)}px)`;

  const jumpTo = (field) => {
    if (!field) return;
    const page = document.querySelector(`[data-sgpage="${(field.page || 1) - 1}"]`);
    const scroller = document.querySelector("[data-sgscroll]");
    if (page && scroller) {
      scroller.scrollTo({ top: page.offsetTop - 24, behavior: "smooth" });
    }
  };

  const applyAuto = (field) => {
    const kind = kindOf(field);
    if (kind === "name") setTextValue(field.id, displayName);
    else if (kind === "date") setTextValue(field.id, todayStamp());
    else if (kind === "title" && signer.role) setTextValue(field.id, signer.role);
    else if (kind === "check") setTextValue(field.id, textValues[field.id] === "✗" ? "✓" : (textValues[field.id] ? "✗" : "✓"));
    else if (kind === "init") setTextValue(field.id, initials);
    else if (kind === "sig") setFilledSig((current) => ({ ...current, [field.id]: true }));
  };

  const fillField = (field) => {
    if (!field) return;
    const kind = kindOf(field);
    if (valueOf(field) && (kind === "sig" || kind === "init" || kind === "text" || kind === "yn" || kind === "title")) {
      if (kind === "sig") setFilledSig((current) => ({ ...current, [field.id]: false }));
      else setTextValue(field.id, "");
      return;
    }
    if ((kind === "sig" || kind === "init") && !adopted) {
      setPendingId(field.id);
      setAdoptOpen(true);
      return;
    }
    if (kind === "text" || (kind === "title" && !signer.role)) {
      setDraft(textValues[field.id] || "");
      setTyping(field);
      return;
    }
    if (kind === "yn") {
      setYnField(field);
      return;
    }
    applyAuto(field);
  };

  const onNext = () => {
    if (!started) {
      setStarted(true);
      if (nextField) {
        jumpTo(nextField);
        fillField(nextField);
      }
      return;
    }
    if (nextField) {
      jumpTo(nextField);
      fillField(nextField);
      return;
    }
    if (!allSeen && pages > 1) {
      setNeedSeen(true);
      return;
    }
    setFinishing(true);
  };

  const confirmSign = () => {
    if (!ack || busy) return;
    setFinishing(false);
    const live = stampConfig || {};
    sign(live.markUrl || "", live.name || displayName, live.markUrl ? "drawn" : "typed");
  };

  const markSeen = (event) => {
    const scroller = event.currentTarget;
    scroller.querySelectorAll("[data-sgpage]").forEach((node) => {
      if (node.offsetTop < scroller.scrollTop + scroller.clientHeight - 40) {
        const page = Number(node.getAttribute("data-sgpage"));
        setSeen((current) => (current[page] ? current : { ...current, [page]: true }));
      }
    });
  };

  const unread = Array.from({ length: pages }, (_, index) => index).filter((page) => !seen[page]).map((page) => (ar ? `صفحة ${page + 1}` : `page ${page + 1}`));
  const hash = done?.finalHash || info?.finalHash || "";
  const verifyHref = info?.verificationId ? verificationUrlFor(info.verificationId) : "";
  const fromLine = info?.creatorName
    ? (ar ? `من ${info.creatorName}` : `From ${info.creatorName}`)
    : (ar ? "طلب توقيع" : "Signature request");

  const banner = rejected ? (
    <section style={{ background: "var(--nv-bad-soft)", border: "1px solid var(--nv-line)", borderRadius: 8, padding: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--nv-bad-fill)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✕</span>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <strong style={{ fontSize: 14, color: "var(--nv-bad-ink)" }}>{ar ? "رفضت التوقيع" : "You declined to sign"}</strong>
        <span style={{ fontSize: 11.5, color: "#4B5567" }}>
          {ar
            ? `السبب: «${done?.reason || info?.rejectionReason || signer.rejectionReason || reason}» — أُبلغ المرسل، والمظروف لا يُوقَّع منك.`
            : `Reason: “${done?.reason || info?.rejectionReason || signer.rejectionReason || reason}”. The sender was told.`}
        </span>
      </div>
      <button type="button" onClick={onBack} style={navyBtn}>{ar ? "العودة للاتفاقيات" : "Back to agreements"}</button>
    </section>
  ) : success ? (
    <section style={{ background: "#F2FAF6", border: "1px solid var(--nv-line)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ width: 44, height: 44, borderRadius: "50%", background: GREEN, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✓</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <strong style={{ fontSize: 14, color: GREEN }}>{ar ? "اكتمل توقيعك" : "Your signature is complete"}</strong>
          <span style={{ fontSize: 11.5, color: "#4B5567" }}>
            {done?.completed
              ? (ar ? "اكتملت الأطراف. البصمة ورابط التحقق يثبتان هذه النسخة." : "Every party has signed. The fingerprint and verify link lock this copy.")
              : (ar ? "حُفظ ختمك. النسخة الموقّعة تكتمل عندما يوقّع بقية الأطراف." : "Your seal is saved. The signed copy completes when the other parties sign.")}
          </span>
        </div>
        <button type="button" onClick={onBack} style={navyBtn}>{ar ? "العودة للاتفاقيات" : "Back to agreements"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "4px 12px", fontSize: 11, fontFamily: MONO }}>
        <span style={{ color: "var(--nv-muted)", fontFamily: "inherit" }}>{ar ? "البصمة" : "Fingerprint"}</span>
        <span dir="ltr" style={{ textAlign: "end" }}>{hash || (ar ? "تُثبَّت عند إغلاق المظروف" : "Fixed when the envelope closes")}</span>
        <span style={{ color: "var(--nv-muted)", fontFamily: "inherit" }}>{ar ? "التحقق" : "Verify"}</span>
        {verifyHref ? <a dir="ltr" href={verifyHref} style={{ textAlign: "end", color: NAVY }}>{info.verificationId}</a> : <span>—</span>}
      </div>
      {done?.docUrl ? <a href={done.docUrl} style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{ar ? "تنزيل النسخة" : "Download the copy"}</a> : null}
      {done?.canRetract || info?.canRetract ? (
        <button type="button" onClick={() => setRetractOpen(true)} style={ghostBtn}>{ar ? "سحب التوقيع خلال المهلة" : "Withdraw within the window"}</button>
      ) : null}
    </section>
  ) : null;

  return (
    <div className="nv-sign-studio" dir={ar ? "rtl" : "ltr"} style={{ position: "fixed", inset: 0, zIndex: 80, background: PAPER, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {banner || (
        <section style={{ background: "var(--nv-card)", border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          <div style={{ padding: "10px 16px", background: NAVY, color: "#fff", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button type="button" onClick={onBack} style={{ fontFamily: "inherit", border: "none", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true">←</span>
              {ar ? "العودة إلى التوقيع" : "Back to signing"}
            </button>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.35 }}>
              <strong style={{ fontSize: 13.5 }}>{String(info?.fileName || "").replace(/\.(pdf|png|jpe?g)$/i, "")}</strong>
              {fromLine ? <span style={{ fontSize: 11, color: "#C5DBCD" }}>{fromLine}</span> : null}
              <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, color: "#8FE0B5", textAlign: ar ? "end" : "start" }}>
                {info?.verificationId || ""}{pages ? ` · ${ar ? `${pages} صفحات` : `${pages} pages`}` : ""}
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 220 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.78)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "var(--nv-card)", color: NAVY, fontSize: 11, fontWeight: 700, marginInlineEnd: 6 }}>2</span>
                {ar ? "التوقيع" : "Signing"}
                <span style={{ marginInlineStart: 8, color: "#8FE0B5" }}>{ar ? "حقولك فقط" : "Your fields only"}</span>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
              <span style={{ fontSize: 11, color: "#C5DBCD" }}>
                {left ? (ar ? `متبقٍ ${left} من ${fields.length || left}` : `${left} of ${fields.length || left} left`) : (ar ? "كل الحقول مكتملة" : "Every field is complete")}
              </span>
              <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,.15)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${fields.length ? Math.round(((fields.length - left) / fields.length) * 100) : 0}%`, background: "#2F9E63" }} />
              </div>
            </div>
            <button type="button" onClick={onNext} disabled={busy} style={{ height: 32, padding: "0 16px", borderRadius: 999, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", background: left ? GOLD : GREEN, color: left ? NAVY : "#fff" }}>
              {busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : left ? (started ? (ar ? "التالي" : "Next") : (ar ? "ابدأ" : "Start")) : (ar ? "إنهاء" : "Finish")}
            </button>
            <button type="button" onClick={() => setDeclining(true)} style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", fontSize: 11.5, cursor: "pointer" }}>
              {ar ? "رفض التوقيع" : "Decline"}
            </button>
          </div>

          {!started ? (
            <div style={{ padding: "12px 18px", background: "#FFF7DE", borderBottom: "1px solid var(--nv-line)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "#5C4300" }}>
              <span style={{ flex: 1, minWidth: 240 }}>
                {ar
                  ? `راجع المستند${pages > 1 ? ` (${pages} صفحات)` : ""}، ثم اضغط «ابدأ» ليأخذك إلى كل حقل مطلوب. بمتابعتك توافق على التوقيع الإلكتروني واستلام المستند إلكترونياً.`
                  : "Review the document, then press Start. Continuing means you agree to sign and receive it electronically."}
              </span>
              <button type="button" onClick={onNext} style={{ height: 32, padding: "0 16px", borderRadius: 6, border: "none", background: GOLD, color: NAVY, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{ar ? "ابدأ" : "Start"}</button>
            </div>
          ) : null}

          {needSeen && !allSeen ? (
            <div style={{ padding: "10px 18px", background: "var(--nv-bad-soft)", borderBottom: "1px solid var(--nv-line)", fontSize: 12, color: "var(--nv-bad-ink)" }}>
              {ar ? `تصفّح كل الصفحات قبل الإنهاء — ${unread.join("، ")} لم تُفتح بعد.` : `Open every page before finishing — ${unread.join(", ")} still unread.`}
            </div>
          ) : null}

          <div data-sgscroll="1" onScroll={markSeen} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 24, background: PAPER, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ alignSelf: "stretch", display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center" }}>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.7, +(value - 0.1).toFixed(2)))} style={zoomBtn}>−</button>
              <span dir="ltr" style={{ fontFamily: MONO, width: 44, textAlign: "center", fontSize: 12 }}>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.4, +(value + 0.1).toFixed(2)))} style={zoomBtn}>+</button>
            </div>
            {loadingDoc ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--nv-muted)", marginTop: 24 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                {ar ? "جارٍ فتح المستند…" : "Opening the document…"}
              </div>
            ) : null}
            {loadingDoc ? null : Array.from({ length: pages }, (_, index) => {
              const pageFields = fields.filter((field) => (field.page || 1) === index + 1);
              const unreadable = !imageUrl && !pdf;
              return (
                <div key={index} data-sgpage={String(index)} style={{ position: "relative", width: pageWidth, aspectRatio: unreadable ? "1 / 1.15" : "1 / 1.3", background: "var(--nv-card)", border: "1px solid var(--nv-line)", boxShadow: "0 1px 3px rgba(0,0,0,.08)", flex: "none" }}>
                  {imageUrl && index === 0 ? (
                    <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  ) : pdf ? (
                    <PdfPageCanvas pdf={pdf} pageNumber={index + 1} width={Math.round(640 * zoom)} />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "12% 10%", textAlign: "center", color: "#4B5567", fontSize: 13, lineHeight: 1.8 }}>
                      {failReason === "not-pdf"
                        ? (ar ? "المرفق ليس PDF صالحاً. اطلب من المرسل رفع PDF أو صورة." : "The attachment is not a valid PDF.")
                        : (ar ? "تعذّر قراءة هذا الـ PDF. إن كان محمياً بكلمة مرور أو تالفاً فصدّره من جديد ثم ارفعه." : "This PDF could not be read. If it is protected or damaged, export it again.")}
                    </div>
                  )}
                  <span style={{ position: "absolute", bottom: "2.5%", insetInline: 0, textAlign: "center", fontFamily: MONO, fontSize: 10, color: "#C5DBCD", pointerEvents: "none" }}>
                    {ar ? `صفحة ${index + 1} من ${pages}` : `Page ${index + 1} of ${pages}`}
                  </span>
                  {pageFields.map((field) => {
                    const kind = kindOf(field);
                    const value = valueOf(field);
                    const current = started && nextField?.id === field.id;
                    const flag = kind === "sig" || kind === "init" ? (ar ? "وقّع هنا" : "Sign") : kind === "check" ? (ar ? "حدّد هنا" : "Mark") : (ar ? "املأ هنا" : "Fill");
                    return (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => { setStarted(true); fillField(field); }}
                        style={{
                          position: "absolute",
                          left: `${field.x ?? 20}%`,
                          top: `${field.y ?? 70}%`,
                          transform: "translate(-50%, -50%)",
                          minWidth: kind === "check" ? 28 : 88,
                          minHeight: 26,
                          width: kind === "sig" ? "34%" : kind === "check" ? 28 : "28%",
                          boxSizing: "border-box",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: kind === "check" ? "center" : "flex-start",
                          gap: 6,
                          padding: value ? "2px 6px" : "0 10px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          border: value ? "1px dashed transparent" : "1px solid var(--nv-line)",
                          background: value ? "transparent" : "#FCEFC0",
                          boxShadow: value ? "none" : "0 2px 6px rgba(217,169,30,.22)",
                          outline: current ? `2px solid ${GOLD}` : "none",
                          outlineOffset: 2,
                        }}
                      >
                        {current && !value ? (
                          <span style={{ position: "absolute", top: "50%", insetInlineStart: "100%", transform: "translateY(-50%)", marginInlineStart: 8, height: 26, padding: "0 10px", background: GOLD, color: NAVY, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>{flag}</span>
                        ) : null}
                        {kind === "sig" && value && stampPreview ? (
                          <img src={stampPreview} alt="" style={{ width: "100%", height: 48, objectFit: "contain" }} />
                        ) : (
                          <span style={{
                            fontWeight: 700,
                            fontSize: kind === "init" || kind === "sig" ? 18 : 12.5,
                            fontFamily: (kind === "sig" || kind === "init") && value ? FONTS[fontIndex] : "inherit",
                            color: value ? NAVY : "#6B4E00",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          >
                            {value || labelOf(kind, field, ar)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {error ? <p style={{ margin: 0, padding: "10px 18px", background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)", fontSize: 12 }}>{error}</p> : null}
          {busy && stage ? <p style={{ margin: 0, padding: "8px 18px", fontSize: 12, color: "#4B5567" }}>{stage}</p> : null}
        </section>
      )}

      {declining ? (
        <Scrim onClose={() => setDeclining(false)}>
          <div style={sheet(440)}>
            <strong style={{ fontSize: 15 }}>{ar ? "رفض التوقيع" : "Decline to sign"}</strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "يُبلَّغ المرسل بالسبب. لا يمكن التراجع عن الرفض." : "The sender is told the reason. A decline cannot be undone."}</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder={ar ? "سبب الرفض — 5 أحرف على الأقل" : "Reason — at least 5 characters"} style={{ padding: 10, borderRadius: 6, border: `1px solid ${LINE}`, fontSize: 12.5, fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={reason.trim().length < 5 || busy} onClick={() => { setDeclining(false); reject(reason.trim()); }} style={{ ...navyBtn, flex: 1, background: "var(--nv-bad-fill)", opacity: reason.trim().length < 5 ? 0.45 : 1 }}>{ar ? "رفض وإبلاغ المرسل" : "Decline and notify"}</button>
              <button type="button" onClick={() => setDeclining(false)} style={ghostBtn}>{ar ? "رجوع" : "Back"}</button>
            </div>
          </div>
        </Scrim>
      ) : null}

      {ynField ? (
        <Scrim onClose={() => setYnField(null)}>
          <div style={sheet(380)}>
            <strong style={{ fontSize: 14 }}>{ynField.label || (ar ? "صح / خطأ" : "Yes or no")}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" onClick={() => { setTextValue(ynField.id, "✓ صح"); setYnField(null); }} style={{ height: 44, borderRadius: 6, border: "1px solid var(--nv-line)", background: "#F2FAF6", color: GREEN, fontWeight: 700, cursor: "pointer" }}>✓ {ar ? "صح" : "Yes"}</button>
              <button type="button" onClick={() => { setTextValue(ynField.id, "✗ خطأ"); setYnField(null); }} style={{ height: 44, borderRadius: 6, border: "1px solid var(--nv-line)", background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)", fontWeight: 700, cursor: "pointer" }}>✗ {ar ? "خطأ" : "No"}</button>
            </div>
            <button type="button" onClick={() => setYnField(null)} style={{ alignSelf: "center", background: "none", border: "none", color: "var(--nv-muted)", cursor: "pointer" }}>{ar ? "إلغاء" : "Cancel"}</button>
          </div>
        </Scrim>
      ) : null}

      {typing ? (
        <Scrim onClose={() => setTyping(null)}>
          <div style={sheet(400)}>
            <strong style={{ fontSize: 15 }}>{typing.label || labelOf(kindOf(typing), typing, ar)}</strong>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} style={{ height: 38, padding: "0 10px", borderRadius: 6, border: `1px solid ${LINE}`, fontSize: 13, outline: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { if (!draft.trim()) return; setTextValue(typing.id, draft.trim()); setTyping(null); }} style={{ ...navyBtn, flex: 1 }}>{ar ? "حفظ" : "Save"}</button>
              <button type="button" onClick={() => setTyping(null)} style={ghostBtn}>{ar ? "إلغاء" : "Cancel"}</button>
            </div>
          </div>
        </Scrim>
      ) : null}

      {adoptOpen ? (
        <Scrim onClose={() => setAdoptOpen(false)}>
          <div style={sheet(520)}>
            <strong style={{ fontSize: 15 }}>{ar ? "اعتماد توقيعك" : "Adopt your signature"}</strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "اختر شكل الاسم. حقل التوقيع يُختم بتوقيعك الآمن وبصمة التراث، ويُسجَّل مع بريدك ووقت التوقيع." : "Pick a name style. The signature field is sealed with Secure Sign and the heritage fingerprint."}</span>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-muted)" }}>
              {ar ? "الاسم الكامل" : "Full name"}
              <input value={name} onChange={(event) => setName(event.target.value)} style={{ height: 36, padding: "0 10px", borderRadius: 9, border: `1px solid ${LINE}`, fontSize: 13, color: NAVY }} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {FONTS.map((font, index) => (
                <button key={font} type="button" onClick={() => setFontIndex(index)} style={{ height: 62, borderRadius: 6, cursor: "pointer", border: `1px solid ${fontIndex === index ? NAVY : LINE}`, background: fontIndex === index ? "var(--nv-accent-soft)" : "var(--nv-card)" }}>
                  <span style={{ font: `700 22px ${font}`, color: "var(--nv-ink)" }}>{displayName || (ar ? "اسمك" : "Your name")}</span>
                </button>
              ))}
            </div>
            {stampPreview ? <img src={stampPreview} alt="" style={{ height: 56, objectFit: "contain", alignSelf: "flex-start" }} /> : null}
            <span style={{ fontSize: 10.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
              {ar ? "باختيار «اعتماد وتوقيع» تقرّ بأن هذا التوقيع يمثّلك في هذا المستند." : "Adopting means this signature represents you on this document."}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  if (!displayName) return;
                  patchStampConfig?.({ name: displayName });
                  setAdopted(true);
                  setAdoptOpen(false);
                  const field = fields.find((item) => item.id === pendingId);
                  if (field) {
                    if (kindOf(field) === "init") setTextValue(field.id, initialsOf(displayName));
                    else setFilledSig((current) => ({ ...current, [field.id]: true }));
                  }
                  setPendingId(null);
                }}
                style={{ ...navyBtn, flex: 1 }}
              >
                {ar ? "اعتماد وتوقيع" : "Adopt and sign"}
              </button>
              <button type="button" onClick={() => setAdoptOpen(false)} style={ghostBtn}>{ar ? "إلغاء" : "Cancel"}</button>
              {onOpenStudio ? <button type="button" onClick={onOpenStudio} style={ghostBtn}>{ar ? "تغيير الختم" : "Change seal"}</button> : null}
            </div>
          </div>
        </Scrim>
      ) : null}

      {finishing ? (
        <Scrim onClose={() => setFinishing(false)}>
          <div style={sheet(440)}>
            <strong style={{ fontSize: 15 }}>{ar ? "إنهاء التوقيع؟" : "Finish signing?"}</strong>
            <span style={{ fontSize: 12.5, lineHeight: 1.7 }}>{ar ? "يُختم المستند بختمك وتُرسل النسخة إلى بقية الأطراف. البصمة تُثبَّت مع الملف." : "Your seal is applied and the copy goes to the remaining parties. The fingerprint is stored with the file."}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {RETRACT_DAY_OPTIONS.map((days) => (
                <button key={days} type="button" onClick={() => setRetractDays(days)} style={{ flex: 1, height: 34, borderRadius: 6, border: `1px solid ${retractDays === days ? NAVY : LINE}`, background: retractDays === days ? NAVY : "var(--nv-card)", color: retractDays === days ? "#fff" : NAVY, fontSize: 11, cursor: "pointer" }}>
                  {retractDaysLabel(days, ar)}
                </button>
              ))}
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.7 }}>
              <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} style={{ marginTop: 3 }} />
              {ar ? "أقرّ بأنني راجعت المستند، وأن ختمي يعبّر عن نيّتي في التوقيع." : "I reviewed the document, and my seal expresses my intent to sign."}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={!ack || busy} onClick={confirmSign} style={{ ...navyBtn, flex: 1, opacity: !ack ? 0.45 : 1 }}>{ar ? "إنهاء وتوقيع" : "Finish and sign"}</button>
              <button type="button" onClick={() => setFinishing(false)} style={ghostBtn}>{ar ? "رجوع" : "Back"}</button>
            </div>
          </div>
        </Scrim>
      ) : null}

      {retractOpen ? (
        <Scrim onClose={() => setRetractOpen(false)}>
          <div style={sheet(420)}>
            <strong style={{ fontSize: 15 }}>{ar ? "سحب التوقيع" : "Withdraw signature"}</strong>
            <textarea value={retractNote} onChange={(event) => setRetractNote(event.target.value)} rows={3} placeholder={ar ? "سبب السحب" : "Reason"} style={{ padding: 10, borderRadius: 6, border: `1px solid ${LINE}`, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={busy} onClick={() => { setRetractOpen(false); retract(retractNote.trim()); }} style={{ ...navyBtn, flex: 1 }}>{ar ? "تأكيد السحب" : "Confirm withdrawal"}</button>
              <button type="button" onClick={() => setRetractOpen(false)} style={ghostBtn}>{ar ? "رجوع" : "Back"}</button>
            </div>
          </div>
        </Scrim>
      ) : null}
    </div>
  );
}

const navyBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "none",
  background: NAVY,
  color: "#fff",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 38,
  padding: "0 16px",
  borderRadius: 10,
  border: `1px solid ${LINE}`,
  background: "var(--nv-card)",
  color: "#4B5567",
  fontSize: 12.5,
  cursor: "pointer",
};

const zoomBtn = {
  width: 26,
  height: 26,
  borderRadius: 4,
  border: `1px solid ${LINE}`,
  background: "var(--nv-card)",
  cursor: "pointer",
  color: NAVY,
};
