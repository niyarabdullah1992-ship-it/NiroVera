import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, PenLine } from "lucide-react";
import { PdfPageCanvas, SigningWorkspaceThumbs, useSigningPdf } from "@/components/files/SigningWorkspacePages";
import { signGhostBtn, signKicker, signMono } from "@/components/files/signingUi";
import { ACCENT, BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";
import { STAMP_WIDTH_PERCENT, fitStampSize } from "@/lib/signatureStampGeometry";
import { stampAspect } from "@/lib/stampStudio";
import { MARK_GLYPHS, isMarkField } from "@/lib/signPdf";
import SignMarkGlyph from "@/components/files/SignMarkGlyph";
import { consentFileKind } from "@/lib/documentReadGate";

const fieldWidth = (field) => (isMarkField(field) ? 6 : field.type === "text" ? 26 : STAMP_WIDTH_PERCENT) * ((field.scale || 100) / 100);

function fieldCaption(field, ar) {
  if (isMarkField(field)) return ar ? "صح / خطأ" : "Tick / cross";
  if (field.type === "text") return field.label || (ar ? "حقل نص" : "Text field");
  return ar ? "موضع توقيعك" : "Your signature field";
}

function fieldGlyph(field) {
  if (isMarkField(field)) return MARK_GLYPHS[0];
  if (field.type === "text") return "Aa";
  return "SIG";
}

export default function PublicSignDocumentPanel({ ar, info, textValues, onTextChange, onSignatureClick, interactive = true, focusPage, stampPreview, stampConfig, onPageSeen }) {
  const fields = info.signer.spots || (info.signer.spot ? [{ ...info.signer.spot, id: "signature", type: "signature" }] : []);
  const fieldPages = fields.map((field) => field.page || 1);
  const fileKind = consentFileKind({ name: info.fileName, url: info.docUrl });
  const imageUrl = fileKind === "image" ? info.docUrl : "";
  const { pdf, failed, failReason } = useSigningPdf(imageUrl ? null : info.docUrl);
  const [page, setPage] = useState(fields[0]?.page || 1);
  const [zoom, setZoom] = useState(1);
  const [pageBox, setPageBox] = useState({ w: 560, h: 560 * 1.414 });
  const ready = Boolean(pdf) || failed || !info.docUrl || Boolean(imageUrl);
  const pages = imageUrl ? 1 : (pdf?.numPages || (ready ? 1 : Math.max(1, ...fieldPages, 1)));
  const pageWidth = Math.round(560 * zoom);
  const missing = !info.docUrl || (failed && !imageUrl);
  const loading = Boolean(info.docUrl) && !pdf && !failed && !imageUrl;

  const seenRef = useRef(onPageSeen);
  seenRef.current = onPageSeen;

  useEffect(() => {
    if (focusPage) setPage(focusPage);
  }, [focusPage]);

  useEffect(() => {
    seenRef.current?.(page, { pages, ready });
  }, [page, pages, ready]);

  useEffect(() => {
    if (pdf?.numPages) setPage((current) => Math.min(current, pdf.numPages));
  }, [pdf?.numPages]);

  const pageFields = fields.filter((field) => (field.page || 1) === page);
  const sealRatio = stampAspect(stampConfig?.design);

  return (
    <section data-nv="sign-doc" style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, maxWidth: "100%", overflow: "hidden", gridArea: "doc" }}>
      <div style={{ height: 40, background: CARD, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", fontSize: 12, color: MUTED, flexShrink: 0 }}>
        <span style={signKicker}>{ar ? "المستند" : "Document"}</span>
        <span style={{ fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.fileName}</span>
        <div dir="ltr" style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.6, +(value + 0.1).toFixed(2)))} style={{ ...signGhostBtn, padding: 4, minWidth: 28, height: 24 }}>+</button>
          <span style={{ ...signMono, width: 44, textAlign: "center", fontSize: 11 }}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.6, +(value - 0.1).toFixed(2)))} style={{ ...signGhostBtn, padding: 4, minWidth: 28, height: 24 }}>−</button>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} style={{ ...signGhostBtn, padding: 4, minWidth: 24, height: 24, opacity: page === 1 ? 0.35 : 1 }} aria-label={ar ? "الصفحة السابقة" : "Previous page"}>
            <ChevronLeft style={{ width: 14, height: 14 }} />
          </button>
          <span style={{ ...signMono, width: 48, textAlign: "center", fontSize: 11 }}>{page} / {pages}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page === pages} style={{ ...signGhostBtn, padding: 4, minWidth: 24, height: 24, opacity: page === pages ? 0.35 : 1 }} aria-label={ar ? "الصفحة التالية" : "Next page"}>
            <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
      <div dir="ltr" style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "grid", gridTemplateColumns: pdf ? "120px minmax(0, 1fr)" : "minmax(0, 1fr)" }}>
        {pdf ? (
          <aside dir="ltr" className="nv-signing-thumbs" style={{ overflow: "auto", padding: "14px 12px", borderRight: `1px solid ${BORDER}`, background: CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <SigningWorkspaceThumbs pdf={pdf} pageCount={pages} fields={fields} activePage={page} onSelect={setPage} ar={ar} />
          </aside>
        ) : null}
        <div style={{ minHeight: 0, overflow: "auto", padding: "22px 0 50px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 48, color: MUTED, fontSize: 13 }}>
              <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
              {ar ? "جارٍ فتح المستند…" : "Opening the document…"}
            </div>
          ) : missing ? (
            <MissingDocument ar={ar} info={info} failed={failed} failReason={failReason} />
          ) : (
            <div
              dir="ltr"
              style={{
                position: "relative",
                width: pageWidth,
                margin: "0 auto",
                background: "var(--nv-card)",
                border: `1px solid ${BORDER}`,
                boxShadow: "0 8px 24px rgba(20,40,75,.06)",
                borderRadius: 4,
                direction: "ltr",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={info.fileName || ""}
                  onLoad={(event) => {
                    const node = event.currentTarget;
                    const next = { w: node.clientWidth || pageWidth, h: node.clientHeight || pageWidth };
                    setPageBox((current) => (current.w === next.w && current.h === next.h ? current : next));
                  }}
                  style={{ display: "block", width: pageWidth, height: "auto" }}
                />
              ) : (
                <PdfPageCanvas
                  pdf={pdf}
                  pageNumber={page}
                  width={pageWidth}
                  onSize={(_, size) => setPageBox((current) => (
                    current.w === size.width && current.h === size.height
                      ? current
                      : { w: size.width, h: size.height }
                  ))}
                />
              )}
              {pageFields.map((field) => {
                const isMark = isMarkField(field);
                const markValue = textValues[field.id] || "";
                const filled = field.type === "text" ? Boolean(String(textValues[field.id] || "").trim()) : false;
                const liveSeal = field.type === "signature" && Boolean(stampPreview);
                const sealBox = field.type === "signature"
                  ? fitStampSize(pageBox.w, pageBox.h, sealRatio, (field.scale || 100) / 100)
                  : null;
                return (
                  <div
                    key={field.id}
                    style={{
                      position: "absolute",
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: sealBox ? sealBox.width : `${fieldWidth(field)}%`,
                      height: sealBox ? sealBox.height : undefined,
                      minHeight: field.type === "text" && !isMark ? 42 : undefined,
                      aspectRatio: isMark ? "1 / 1" : undefined,
                      transform: "translate(-50%, -50%)",
                      borderRadius: 8,
                      border: liveSeal ? "none" : `1.5px ${filled ? "solid" : "dashed"} ${field.type === "text" ? NAVY : ACCENT}`,
                      background: liveSeal ? "transparent" : filled ? "var(--nv-card)" : field.type === "text" ? "rgba(247,248,250,.95)" : "rgba(30,158,99,.10)",
                      padding: field.type === "text" && !isMark ? 4 : 0,
                      boxSizing: "border-box",
                      overflow: liveSeal ? "hidden" : undefined,
                    }}
                  >
                    {!interactive ? (
                      <div style={{ display: "flex", height: "100%", minHeight: isMark ? 0 : 36, alignItems: "center", justifyContent: "center", gap: 6, padding: "0 6px", textAlign: "center", fontSize: isMark ? 14 : 11, fontWeight: 600, color: NAVY }}>
                        <span style={{ width: 17, height: 13, borderRadius: 4, background: field.type === "text" ? NAVY : ACCENT, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>{fieldGlyph(field)}</span>
                        {isMark ? null : fieldCaption(field, ar)}
                      </div>
                    ) : isMark ? (
                      <button
                        type="button"
                        title={ar ? "اضغط للتبديل بين صح وخطأ" : "Tap to flip between tick and cross"}
                        onClick={() => onTextChange(field.id, MARK_GLYPHS[(MARK_GLYPHS.indexOf(markValue) + 1) % MARK_GLYPHS.length])}
                        style={{ display: "flex", height: "100%", width: "100%", alignItems: "center", justifyContent: "center", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit", lineHeight: 1, color: markValue ? NAVY : MUTED, opacity: markValue ? 1 : 0.45, padding: 0 }}
                      >
                        <SignMarkGlyph glyph={markValue || MARK_GLYPHS[0]} size={16} color="currentColor" />
                      </button>
                    ) : field.type === "text" ? (
                      <label style={{ position: "relative", display: "block", height: "100%" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 8, fontWeight: 600, color: NAVY }}>
                          <PenLine style={{ width: 10, height: 10 }} />
                          {field.label || (ar ? "اكتب النص" : "Enter text")}
                        </span>
                        <input
                          value={textValues[field.id] || ""}
                          onChange={(event) => onTextChange(field.id, event.target.value)}
                          style={{ height: 28, width: "100%", borderRadius: 8, border: `1px solid ${BORDER}`, background: "var(--nv-card)", padding: "0 6px", fontSize: 10, color: NAVY, outline: "none" }}
                        />
                      </label>
                    ) : liveSeal ? (
                      <button type="button" onClick={onSignatureClick} style={{ display: "block", height: "100%", width: "100%", padding: 0, background: "transparent", border: 0, cursor: "pointer" }}>
                        <img src={stampPreview} alt={ar ? "ختمك على المستند" : "Your seal on the document"} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                      </button>
                    ) : (
                      <button type="button" onClick={onSignatureClick} style={{ display: "flex", height: "100%", minHeight: 48, width: "100%", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, fontWeight: 600, color: NAVY, background: "transparent", border: 0, cursor: "pointer" }}>
                        <span style={{ width: 17, height: 13, borderRadius: 4, background: ACCENT, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>{ar ? "توقيع" : "SIG"}</span>
                        {ar ? "اضغط لإضافة التوقيع" : "Tap to add signature"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MissingDocument({ ar, info, failed, failReason }) {
  return (
    <div style={{ width: "min(480px, calc(100% - 32px))", marginTop: 36, padding: 20, border: `1px dashed ${BORDER}`, borderRadius: 12, background: CARD, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 650, color: NAVY }}>{info.fileName || (ar ? "بلا ملف" : "No file")}</p>
      <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: MUTED }}>
        {failed
          ? (failReason === "not-pdf"
            ? (ar ? "المرفق ليس PDF صالحاً. اطلب من المرسل رفع PDF أو صورة PNG/JPEG." : "The attachment is not a valid PDF. Ask the sender to upload a PDF or a PNG/JPEG.")
            : (ar ? "تعذّر قراءة المرفق كـ PDF. إن كان الملف محمياً أو تالفاً فاطلب إرسالاً جديداً." : "The attachment could not be read as a PDF. If it is protected or damaged, ask for a new send."))
          : (ar ? "لا يوجد ملف PDF على هذا الطلب — ليست معاينة مستند. اطلب من المرسل إرفاق الملف." : "This request has no PDF — this is not a document preview. Ask the sender to attach the file.")}
      </p>
    </div>
  );
}
