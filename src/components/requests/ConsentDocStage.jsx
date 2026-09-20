import React, { useEffect, useRef, useState } from "react";
import { PdfPageCanvas, useSigningPdf } from "@/components/files/SigningWorkspacePages";
import { consentFileKind, defaultConsentMark, normalizeSignMark } from "@/lib/documentReadGate";
import { STAMP_WIDTH_PERCENT } from "@/lib/signatureStampGeometry";
import { MUTED, NAVY } from "@/lib/platformStyles";

function pointOn(node, event) {
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.min(96, Math.max(4, ((event.clientY - rect.top) / rect.height) * 100)),
  };
}

function MarkBox({ mark, page, sealUrl, label }) {
  if (!mark || (mark.page || 1) !== page) return null;
  const width = STAMP_WIDTH_PERCENT * ((mark.scale || 100) / 100);
  return (
    <div
      style={{
        position: "absolute",
        left: `${mark.x}%`,
        top: `${mark.y}%`,
        width: `${width}%`,
        aspectRatio: "900 / 240",
        transform: "translate(-50%, -50%)",
        border: `1.5px dashed ${sealUrl ? "#137a49" : "#14213d"}`,
        background: sealUrl ? "transparent" : "rgba(20,33,61,.06)",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {sealUrl ? (
        <img src={sealUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{ fontSize: 10, fontWeight: 700, color: NAVY, padding: 4, textAlign: "center" }}>{label}</span>
      )}
    </div>
  );
}

export default function ConsentDocStage({
  ar,
  file,
  mark,
  onMark,
  mode = "read",
  sealUrl,
  readAt,
  onRead,
}) {
  const kind = consentFileKind(file);
  const { pdf, failed } = useSigningPdf(kind === "pdf" ? file?.url : null);
  const hostRef = useRef(null);
  const seenRef = useRef(new Set());
  const readRef = useRef(onRead);
  readRef.current = onRead;
  const [pageWidth, setPageWidth] = useState(480);
  const [pageCount, setPageCount] = useState(kind === "pdf" ? 0 : 1);
  const [seen, setSeen] = useState(0);
  const placed = normalizeSignMark(mark);
  const placing = mode === "place";
  const label = placing
    ? (ar ? "موضع توقيع الموظف" : "Worker signature spot")
    : (ar ? "موضع التوقيع — حدّده مقدّم الطلب" : "Signature spot — placed by the requester");

  useEffect(() => {
    if (pdf?.numPages) setPageCount(pdf.numPages);
  }, [pdf?.numPages]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const update = () => setPageWidth(Math.max(280, Math.min(520, host.clientWidth - 24)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [file?.url]);

  useEffect(() => {
    if (readAt || !readRef.current) return;
    if (kind === "image") readRef.current();
    if (kind === "pdf" && pageCount && seen >= pageCount) readRef.current();
  }, [kind, pageCount, seen, readAt]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || kind !== "pdf" || !pageCount) return undefined;
    const nodes = [...host.querySelectorAll("[data-consent-page]")];
    const observer = new IntersectionObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const page = Number(entry.target.getAttribute("data-consent-page"));
        if (!page || seenRef.current.has(page)) continue;
        seenRef.current.add(page);
        changed = true;
      }
      if (changed) setSeen(seenRef.current.size);
    }, { root: host, threshold: 0.55 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [kind, pageCount, pdf]);

  const place = (page, event) => {
    if (!placing || !onMark) return;
    const point = pointOn(event.currentTarget, event);
    if (!point) return;
    onMark({ ...(placed || defaultConsentMark()), page, x: point.x, y: point.y });
  };

  if (!file?.url) {
    return (
      <div style={{ padding: "12px 14px", border: "1px dashed #c7ccd6", fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
        {ar ? "لا ملف للعرض." : "No file to show."}
      </div>
    );
  }

  const hint = (
    <div style={{ padding: "10px 12px", borderBottom: "1px solid #eef0f4", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
        {ar ? "حمّل الملف، وقّعه يدوياً أو عبر قسم التوقيع منفصلاً، ثم ارفع النسخة هنا." : "Download the file, sign it by hand or separately in Digital signing, then upload the copy here."}
      </span>
      <a href={file.url} download={file.name || (ar ? "مرفق-الموافقة" : "consent-file")} style={{ fontSize: 11, fontWeight: 600, color: "#137a49", textDecoration: "none" }}>
        {ar ? "نزّل الملف المصدر" : "Download the source file"}
      </a>
    </div>
  );

  if (kind === "image") {
    return (
      <div style={{ border: "1px solid #dfe3ea", background: "#fafbfc" }}>
        {hint}
        <div
          onClick={(event) => place(1, event)}
          style={{ position: "relative", cursor: placing ? "crosshair" : "default" }}
        >
          <img src={file.url} alt={file.name || ""} style={{ display: "block", width: "100%" }} />
          <MarkBox mark={placed} page={1} sealUrl={sealUrl} label={label} />
        </div>
      </div>
    );
  }

  if (kind === "other" || failed) {
    return (
      <div style={{ padding: "12px 14px", border: "1px solid #dfe3ea", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
          {ar ? "تعذّرت المعاينة المباشرة. حمّل الملف، وقّعه يدوياً أو عبر قسم التوقيع منفصلاً، ثم ارفع النسخة هنا." : "Live preview failed. Download the file, sign it by hand or separately in Digital signing, then upload the copy here."}
        </span>
        {file.url ? <a href={file.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "#137a49" }}>{ar ? "افتح الملف" : "Open the file"}</a> : null}
        {placing && onMark && !placed ? (
          <button type="button" onClick={() => onMark(defaultConsentMark())} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 12px", border: "1px solid #14213d", background: "#14213d", color: "#fff", cursor: "pointer", alignSelf: "flex-start" }}>
            {ar ? "ضع التوقيع أسفل الصفحة" : "Place the mark at the foot"}
          </button>
        ) : null}
        {!placing && !readAt && onRead ? (
          <button type="button" onClick={onRead} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 12px", border: "1px solid #14213d", background: "#14213d", color: "#fff", cursor: "pointer", alignSelf: "flex-start" }}>
            {ar ? "قرأت الملف" : "I read the file"}
          </button>
        ) : null}
      </div>
    );
  }

  const pages = pdf?.numPages || pageCount || 1;
  return (
    <div style={{ border: "1px solid #dfe3ea", background: "#fafbfc" }}>
      {hint}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f4", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>{file.name}</span>
        <span dir="ltr" style={{ marginInlineStart: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED }}>
          {placing
            ? (placed ? (ar ? `ص ${placed.page}` : `p${placed.page}`) : (ar ? "اضغط لوضع التوقيع" : "Click to place"))
            : (readAt ? (ar ? "قُرئ" : "Read") : `${seen} / ${pages}`)}
        </span>
      </div>
      <div ref={hostRef} style={{ maxHeight: 420, overflow: "auto", padding: "12px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {pdf ? Array.from({ length: pages }, (_, index) => {
          const page = index + 1;
          return (
            <div
              key={page}
              data-consent-page={page}
              onClick={(event) => place(page, event)}
              style={{ position: "relative", cursor: placing ? "crosshair" : "default", boxShadow: "0 1px 3px rgba(20,33,61,.08)" }}
            >
              <PdfPageCanvas pdf={pdf} pageNumber={page} width={pageWidth} />
              <MarkBox mark={placed} page={page} sealUrl={sealUrl} label={label} />
            </div>
          );
        }) : (
          <span style={{ fontSize: 11, color: MUTED, padding: 24 }}>{ar ? "جارٍ فتح المستند…" : "Opening the document…"}</span>
        )}
      </div>
    </div>
  );
}
