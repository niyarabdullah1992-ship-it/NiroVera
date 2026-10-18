import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PdfPageCanvas, useSigningPdf } from "@/components/files/SigningWorkspacePages";
import { isMarkField } from "@/lib/signPdf";
import { consentFileKind } from "@/lib/documentReadGate";
import { RETRACT_DAY_OPTIONS, retractDaysLabel } from "@/lib/multiSignDerivations";
import { verificationUrlFor } from "@/lib/verificationBadge";
import NvIcon from "@/components/shared/NvIcon";
import SignaturePad from "@/components/files/SignaturePad";
import { fieldProgress, nextRequiredField } from "@/lib/signingEnvelopes";

const NAVY = "#0B3D27";
const LINK = "var(--nv-navy)";
const GREEN = "#3C7D50";
const LINE = "var(--nv-line)";
const PAPER = "var(--nv-page, #F4F5F7)";
const MONO = "'IBM Plex Mono', monospace";
// Calligraphic Arabic first — the platform's signature fonts (ensureSignatureFonts).
const FONTS = [
  "'Aref Ruqaa', serif",
  "'Amiri', serif",
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
  // A «ختم» field from an older envelope is a signature like any other — one mark per signer.
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
    color: "var(--nv-ink)",
    borderRadius: 8,
    boxShadow: "0 20px 60px rgba(20,33,61,.3)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

export default function RecipientSignStudio({ signing, onBack, onOpenStudio }) {
  const {
    ar, info, textValues, setTextValue, stampPreview, stampConfig, patchStampConfig, sealLocked,
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
  const [cursorId, setCursorId] = useState(null);
  const [adoptTab, setAdoptTab] = useState("type");
  const [markDraft, setMarkDraft] = useState("");

  const rejected = Boolean(done?.rejected || info?.status === "rejected" || signer.status === "rejected");
  const success = !rejected && Boolean(done || signer.status === "signed");
  const displayName = name.trim() || signer.name || "";
  const initials = initialsOf(displayName);

  const valueOf = (field) => {
    const kind = kindOf(field);
    if (kind === "sig") return filledSig[field.id] ? displayName : "";
    return String(textValues[field.id] || "");
  };

  const isFilled = (field) => Boolean(valueOf(field));
  const progress = fieldProgress(fields, isFilled);
  const left = progress.required;
  // «التالي ›» walks the required fields in reading order from the one just handled.
  const nextField = nextRequiredField(fields, isFilled, cursorId);
  const allSeen = Array.from({ length: pages }, (_, index) => index).every((page) => seen[page]);
  const pageWidth = `min(100%, ${Math.round(640 * zoom)}px)`;

  const jumpTo = (field) => {
    if (!field) return;
    setCursorId(field.id);
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
    setCursorId(field.id);
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
      <span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--nv-bad-fill)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}><NvIcon name="cross" size={22} strokeWidth={2} inline={false} /></span>
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
    <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ width: 44, height: 44, borderRadius: "50%", background: GREEN, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}><NvIcon name="check" size={22} strokeWidth={2} inline={false} /></span>
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
        {verifyHref ? <a dir="ltr" href={verifyHref} style={{ textAlign: "end", color: LINK }}>{info.verificationId}</a> : <span>—</span>}
      </div>
      {done?.docUrl ? <a href={done.docUrl} style={{ fontSize: 12, fontWeight: 600, color: LINK }}>{ar ? "تنزيل النسخة" : "Download the copy"}</a> : null}
      {done?.canRetract || info?.canRetract ? (
        <button type="button" onClick={() => setRetractOpen(true)} style={ghostBtn}>{ar ? "سحب التوقيع خلال المهلة" : "Withdraw within the window"}</button>
      ) : null}
    </section>
  ) : null;

  return (
    <div className="nv-sign-studio nv-recipient-studio" dir={ar ? "rtl" : "ltr"} style={{ position: "fixed", inset: 0, zIndex: 80, background: PAPER, overflow: banner ? "auto" : "hidden", padding: banner ? 16 : 0, display: "flex", flexDirection: "column", gap: banner ? 12 : 0 }}>
      {banner || (
        <>
          {/* Top bar: back, the document, progress — nothing else. */}
          <header data-recipient-top="1" style={{ background: "var(--nv-card)", borderBottom: `1px solid ${LINE}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, flex: "none", minWidth: 0 }}>
            <button type="button" onClick={onBack} style={{ fontFamily: "inherit", border: "none", background: "transparent", color: "var(--nv-muted)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 0", flex: "none" }}>
              <span aria-hidden="true">{ar ? "→" : "←"}</span>
              {ar ? "رجوع" : "Back"}
            </button>
            <span style={{ width: 1, height: 26, background: LINE, flex: "none" }} />
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, lineHeight: 1.4 }}>
              <strong style={{ fontSize: 14, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{String(info?.fileName || "").replace(/\.(pdf|png|jpe?g)$/i, "")}</strong>
              <span style={{ fontSize: 11.5, color: "var(--nv-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fromLine}</span>
            </div>
            <div data-recipient-progress={`${progress.done}/${progress.total}`} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flex: "none" }}>
              <span style={{ fontSize: 12, color: "var(--nv-ink2)", whiteSpace: "nowrap" }}>
                <span dir="ltr" style={{ fontFamily: MONO, color: "var(--nv-ink)", fontWeight: 600 }}>{progress.done}</span>
                {ar ? " من " : " of "}
                <span dir="ltr" style={{ fontFamily: MONO, color: "var(--nv-ink)", fontWeight: 600 }}>{progress.total}</span>
                {ar ? " حقول" : " fields"}
              </span>
              <span style={{ width: 96, height: 3, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: GREEN }} />
              </span>
            </div>
          </header>

          {needSeen && !allSeen ? (
            <div style={{ padding: "8px 16px", background: "var(--nv-warn-soft)", borderBottom: `1px solid ${LINE}`, fontSize: 12, color: "var(--nv-warn-ink)", flex: "none" }}>
              {ar ? `تصفّح كل الصفحات قبل الإنهاء — ${unread.join("، ")} لم تُفتح بعد.` : `Open every page before finishing — ${unread.join(", ")} still unread.`}
            </div>
          ) : null}

          <div data-sgscroll="1" onScroll={markSeen} style={{ position: "relative", flex: 1, minHeight: 0, overflow: "auto", padding: "16px 12px 28px", background: PAPER, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {/* «التالي ›» — the guide that walks the required fields in order. */}
            {left ? (
              <div style={{ position: "sticky", top: 0, zIndex: 6, alignSelf: "stretch", display: "flex", justifyContent: "flex-start", pointerEvents: "none" }}>
                <button type="button" data-recipient-next="1" onClick={onNext} disabled={busy} style={{ pointerEvents: "auto", height: 34, padding: "0 14px", borderRadius: 8, border: "none", background: "#0B3D27", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 12px rgba(20,40,30,.18)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {started ? (ar ? "التالي" : "Next") : (ar ? "ابدأ" : "Start")}
                  <span aria-hidden="true">{ar ? "‹" : "›"}</span>
                </button>
              </div>
            ) : null}
            {!started ? (
              <span style={{ fontSize: 12, color: "var(--nv-muted)", textAlign: "center", maxWidth: 520 }}>
                {ar
                  ? `راجع المستند${pages > 1 ? ` (${pages} صفحات)` : ""}، و«ابدأ» ينقلك إلى كل حقل مطلوب.`
                  : "Review the document; Start takes you to each required field."}
              </span>
            ) : null}
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
                <div key={index} data-sgpage={String(index)} style={{ position: "relative", width: pageWidth, aspectRatio: unreadable ? "1 / 1.15" : "1 / 1.3", background: "#fff", border: `1px solid ${LINE}`, boxShadow: "0 1px 3px rgba(0,0,0,.08)", flex: "none" }}>
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
                  <span dir="ltr" style={{ position: "absolute", bottom: "2.5%", insetInline: 0, textAlign: "center", fontFamily: MONO, fontSize: 10, color: "#9AA3A0", pointerEvents: "none" }}>
                    {index + 1} / {pages}
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
                        data-recipient-field={field.id}
                        aria-label={`${labelOf(kind, field, ar) || flag}${value ? "" : ` · ${ar ? "مطلوب" : "required"}`}`}
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
                          border: value ? "1px dashed transparent" : current ? `2px solid ${GREEN}` : "1px dashed #C8A45A",
                          background: value ? "transparent" : current ? "rgba(60,125,80,.08)" : "rgba(200,164,90,.12)",
                          outline: "none",
                        }}
                      >
                        {current && !value ? (
                          <span style={{ position: "absolute", top: "50%", insetInlineStart: "100%", transform: "translateY(-50%)", marginInlineStart: 8, height: 24, padding: "0 10px", borderRadius: 6, background: GREEN, color: "#fff", fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>{flag}</span>
                        ) : null}
                        {kind === "sig" && value && stampPreview ? (
                          <img src={stampPreview} alt="" style={{ width: "100%", height: 48, objectFit: "contain" }} />
                        ) : (
                          <span style={{
                            fontWeight: 700,
                            fontSize: kind === "init" || kind === "sig" ? 18 : 12.5,
                            fontFamily: (kind === "sig" || kind === "init") && value ? FONTS[fontIndex] : "inherit",
                            color: value ? "#14284B" : "#6B4E00",
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

          {error ? <p style={{ margin: 0, padding: "8px 16px", background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)", fontSize: 12, flex: "none" }}>{error}</p> : null}
          {busy && stage ? <p style={{ margin: 0, padding: "8px 16px", fontSize: 12, color: "var(--nv-ink2)", background: "var(--nv-card)", flex: "none" }}>{stage}</p> : null}

          {/* Sticky bottom bar: zoom, decline, and the one finishing action. */}
          <footer data-recipient-bottom="1" style={{ background: "var(--nv-card)", borderTop: `1px solid ${LINE}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flex: "none", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button type="button" aria-label={ar ? "تصغير" : "Zoom out"} onClick={() => setZoom((value) => Math.max(0.7, +(value - 0.1).toFixed(2)))} style={zoomBtn}>−</button>
              <span dir="ltr" style={{ fontFamily: MONO, width: 44, textAlign: "center", fontSize: 12, color: "var(--nv-ink)" }}>{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label={ar ? "تكبير" : "Zoom in"} onClick={() => setZoom((value) => Math.min(1.4, +(value + 0.1).toFixed(2)))} style={zoomBtn}>+</button>
            </span>
            <button type="button" onClick={() => setDeclining(true)} style={{ ...ghostBtn, height: 36 }}>{ar ? "رفض التوقيع" : "Decline"}</button>
            <span style={{ flex: 1 }} />
            {left ? (
              <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>
                {ar ? "متبقٍ " : ""}<span dir="ltr" style={{ fontFamily: MONO, color: "var(--nv-ink)" }}>{left}</span>{ar ? " مطلوب" : " required left"}
              </span>
            ) : null}
            <button type="button" data-recipient-finish="1" onClick={onNext} disabled={busy} style={{ height: 38, padding: "0 18px", borderRadius: 8, border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", background: left ? "var(--nv-line2, #EEF1EF)" : "#0B3D27", color: left ? "var(--nv-ink2)" : "#fff" }}>
              {busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "إنهاء التوقيع" : "Finish signing")}
            </button>
          </footer>
        </>
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
              <button type="button" onClick={() => { setTextValue(ynField.id, "✓ صح"); setYnField(null); }} style={{ height: 44, borderRadius: 6, border: "1px solid var(--nv-line)", background: "#F2FAF6", color: GREEN, fontWeight: 700, cursor: "pointer" }}><NvIcon name="check" size={14} strokeWidth={2} /> {ar ? "صح" : "Yes"}</button>
              <button type="button" onClick={() => { setTextValue(ynField.id, "✗ خطأ"); setYnField(null); }} style={{ height: 44, borderRadius: 6, border: "1px solid var(--nv-line)", background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)", fontWeight: 700, cursor: "pointer" }}><NvIcon name="cross" size={14} strokeWidth={2} /> {ar ? "خطأ" : "No"}</button>
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
          <div role="dialog" aria-modal="true" aria-label={ar ? "اعتماد توقيعك" : "Adopt your signature"} data-adopt-dialog="1" style={{ ...sheet(520), maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100dvh - 32px)", overflow: "auto", boxSizing: "border-box" }}>
            <strong style={{ fontSize: 15 }}>{ar ? "اعتماد توقيعك" : "Adopt your signature"}</strong>
            {sealLocked ? (
              <>
                <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.7 }}>{ar ? "ختمك المحفوظ يُختم به هذا المستند." : "Your saved seal stamps this document."}</span>
                {stampPreview ? <img src={stampPreview} alt="" style={{ height: 72, objectFit: "contain", alignSelf: "center", border: `1px solid ${LINE}`, borderRadius: 8, padding: 6, background: "#fff" }} /> : null}
              </>
            ) : (
              <>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--nv-muted)" }}>
                  {ar ? "الاسم الكامل" : "Full name"}
                  <input value={name} onChange={(event) => setName(event.target.value)} style={{ height: 38, padding: "0 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, color: "var(--nv-ink)", background: "var(--nv-card)", fontFamily: "inherit" }} />
                </label>
                <div role="tablist" aria-label={ar ? "طريقة التوقيع" : "Signature method"} style={{ display: "flex", gap: 6 }}>
                  {[["type", ar ? "اكتب" : "Type"], ["draw", ar ? "ارسم" : "Draw"], ["upload", ar ? "ارفع" : "Upload"]].map(([id, text]) => (
                    <button key={id} type="button" role="tab" aria-selected={adoptTab === id} onClick={() => setAdoptTab(id)} style={{ fontFamily: "inherit", height: 30, padding: "0 14px", borderRadius: 999, border: adoptTab === id ? "none" : `1px solid ${LINE}`, background: adoptTab === id ? GREEN : "var(--nv-card)", color: adoptTab === id ? "#fff" : "var(--nv-ink2)", fontSize: 12, fontWeight: adoptTab === id ? 700 : 500, cursor: "pointer" }}>{text}</button>
                  ))}
                </div>
                {adoptTab === "type" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                    {FONTS.map((font, index) => (
                      <button key={font} type="button" aria-pressed={fontIndex === index} onClick={() => setFontIndex(index)} style={{ height: 62, borderRadius: 8, cursor: "pointer", border: `1px solid ${fontIndex === index ? GREEN : LINE}`, boxShadow: fontIndex === index ? `0 0 0 1px ${GREEN}` : "none", background: "var(--nv-card)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 14px" }}>
                        <span style={{ font: `700 22px ${font}`, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName || (ar ? "اسمك" : "Your name")}</span>
                        <span style={{ font: `700 16px ${font}`, color: "var(--nv-muted)" }}>{initials || "—"}</span>
                      </button>
                    ))}
                  </div>
                ) : adoptTab === "draw" ? (
                  <SignaturePad ar={ar} signerName={displayName} markOnly onMark={setMarkDraft} />
                ) : (
                  <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 110, borderRadius: 8, border: `1px dashed ${LINE}`, background: "var(--nv-soft)", cursor: "pointer", padding: 12 }}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file || !file.type.startsWith("image/")) return;
                        const reader = new FileReader();
                        reader.onload = () => setMarkDraft(String(reader.result || ""));
                        reader.readAsDataURL(file);
                      }}
                      style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                    />
                    {markDraft ? <img src={markDraft} alt="" style={{ maxHeight: 72, maxWidth: "100%", objectFit: "contain" }} /> : (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nv-ink)" }}>{ar ? "ارفع صورة توقيعك" : "Upload your signature image"}</span>
                        <span dir="ltr" style={{ fontSize: 11, color: "var(--nv-muted)", fontFamily: MONO }}>PNG · JPG</span>
                      </>
                    )}
                  </label>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--nv-muted)" }}>
                  <span>{ar ? "الأحرف الأولى" : "Initials"}</span>
                  <span style={{ font: `700 18px ${FONTS[fontIndex]}`, color: "var(--nv-ink)" }}>{initials || "—"}</span>
                </div>
              </>
            )}
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
              {ar ? "باعتماده تقرّ بأن هذا التوقيع وأحرفك الأولى يمثّلانك في هذا المستند." : "Adopting means this signature and your initials represent you on this document."}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                data-adopt-confirm="1"
                disabled={!displayName || (!sealLocked && adoptTab !== "type" && !markDraft)}
                onClick={() => {
                  if (!displayName) return;
                  if (!sealLocked) patchStampConfig?.({ name: displayName, markUrl: adoptTab === "type" ? "" : markDraft });
                  setAdopted(true);
                  setAdoptOpen(false);
                  const field = fields.find((item) => item.id === pendingId);
                  if (field) {
                    if (kindOf(field) === "init") setTextValue(field.id, initialsOf(displayName));
                    else setFilledSig((current) => ({ ...current, [field.id]: true }));
                  }
                  setPendingId(null);
                }}
                style={{ ...navyBtn, flex: 1, background: "#0B3D27", opacity: !displayName || (!sealLocked && adoptTab !== "type" && !markDraft) ? 0.45 : 1 }}
              >
                {ar ? "اعتمد ووقّع" : "Adopt and sign"}
              </button>
              <button type="button" onClick={() => setAdoptOpen(false)} style={ghostBtn}>{ar ? "إلغاء" : "Cancel"}</button>
              {onOpenStudio ? <button type="button" onClick={onOpenStudio} style={ghostBtn}>{ar ? "ستوديو الختم" : "Seal studio"}</button> : null}
            </div>
          </div>
        </Scrim>
      ) : null}

      {finishing ? (
        <Scrim onClose={() => setFinishing(false)}>
          <div role="dialog" aria-modal="true" data-finish-dialog="1" style={{ ...sheet(460), maxWidth: "calc(100vw - 32px)", boxSizing: "border-box" }}>
            <strong style={{ fontSize: 15 }}>{ar ? "إنهاء التوقيع" : "Finish signing"}</strong>
            <span style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--nv-ink2)" }}>{ar ? "يُختم المستند بتوقيعك وتُحفظ بصمته، ويصل الإشعار إلى المرسل." : "Your signature is applied, the fingerprint is stored, and the sender is notified."}</span>
            <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "مهلة التراجع عن توقيعك" : "Window to withdraw your signature"}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {RETRACT_DAY_OPTIONS.map((days) => (
                <button key={days} type="button" aria-pressed={retractDays === days} onClick={() => setRetractDays(days)} style={{ flex: 1, height: 34, borderRadius: 8, border: `1px solid ${retractDays === days ? GREEN : LINE}`, background: retractDays === days ? "var(--nv-ok-soft, #E6F2EA)" : "var(--nv-card)", color: "var(--nv-ink)", fontSize: 11.5, fontWeight: retractDays === days ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                  {retractDaysLabel(days, ar)}
                </button>
              ))}
            </div>
            <label data-consent-line="1" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.7, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
              <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} style={{ marginTop: 4, accentColor: GREEN }} />
              <span>
                {ar ? "أوافق على استخدام التوقيع الإلكتروني، وأقرّ بأنني راجعت المستند وأن توقيعي يعبّر عن نيّتي." : "I agree to use an electronic signature; I reviewed the document and my signature expresses my intent."}
                <span style={{ display: "block", fontSize: 11.5, color: "var(--nv-muted)" }}>
                  {ar ? "يُعتدّ بالتوقيع الإلكتروني وفق نظام التعاملات الإلكترونية في المملكة." : "Electronic signatures are recognised under the Saudi Electronic Transactions Law."}
                </span>
              </span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" data-finish-confirm="1" disabled={!ack || busy} onClick={confirmSign} style={{ ...navyBtn, flex: 1, background: "#0B3D27", opacity: !ack ? 0.45 : 1 }}>{ar ? "إنهاء التوقيع" : "Finish signing"}</button>
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
  borderRadius: 8,
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
  borderRadius: 8,
  border: `1px solid ${LINE}`,
  background: "var(--nv-card)",
  color: "var(--nv-ink2)",
  fontFamily: "inherit",
  fontSize: 12.5,
  cursor: "pointer",
};

const zoomBtn = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: `1px solid ${LINE}`,
  background: "var(--nv-card)",
  cursor: "pointer",
  color: LINK,
};
