import React, { useCallback, useEffect, useRef, useState } from "react";
import pdfjsLib from "@/lib/pdfjsSetup";
import { looksLikePdf } from "@/lib/pdfBytes";
import { BORDER, BRAND, CARD, MUTED } from "@/lib/platformStyles";
import { MARK_GLYPHS, isMarkField } from "@/lib/signPdf";
import SignMarkGlyph from "@/components/files/SignMarkGlyph";
import {
  STAMP_CANVAS_HEIGHT,
  STAMP_CANVAS_WIDTH,
  TEXT_HEIGHT_PERCENT,
  TEXT_WIDTH_PERCENT,
  fitStampSize,
} from "@/lib/signatureStampGeometry";

const NO_GUIDES = { page: 0, x: null, y: null };
/** How close a dragged field must come to a neighbour's centre line to snap onto it. */
const SNAP_PERCENT = 0.7;

const CMAP = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`;
const FONTS = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;
const STAMP_RATIO = STAMP_CANVAS_HEIGHT / STAMP_CANVAS_WIDTH;

async function pdfBytesFrom(source) {
  if (!source) return null;
  if (typeof source !== "string") return new Uint8Array(await source.arrayBuffer());
  const response = await fetch(source);
  if (!response.ok) throw new Error(`pdf-fetch-${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export function useSigningPdf(source) {
  const [pdf, setPdf] = useState(null);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState("");

  useEffect(() => {
    if (!source) return undefined;
    let active = true;
    let loaded = null;
    setPdf(null);
    setFailed(false);
    setFailReason("");
    (async () => {
      try {
        const data = await pdfBytesFrom(source);
        if (!active) return;
        if (!looksLikePdf(data)) {
          setFailed(true);
          setFailReason("not-pdf");
          return;
        }
        const doc = await pdfjsLib.getDocument({
          data,
          cMapUrl: CMAP,
          cMapPacked: true,
          standardFontDataUrl: FONTS,
          useSystemFonts: false,
          disableFontFace: true,
        }).promise;
        if (!active) {
          doc.destroy?.();
          return;
        }
        loaded = doc;
        setPdf(doc);
      } catch {
        if (active) {
          setFailed(true);
          setFailReason("open-failed");
        }
      }
    })();
    return () => {
      active = false;
      loaded?.destroy?.();
    };
  }, [source]);

  return { pdf, failed, failReason };
}

/** Renders one PDF page to a canvas at an exact CSS width. */
export function PdfPageCanvas({ pdf, pageNumber, width, onSize }) {
  const canvasRef = useRef(null);
  const taskRef = useRef(null);
  const onSizeRef = useRef(onSize);
  onSizeRef.current = onSize;

  useEffect(() => {
    if (!pdf || !canvasRef.current) return undefined;
    let cancelled = false;
    (async () => {
      const previous = taskRef.current;
      if (previous) {
        previous.cancel();
        try { await previous.promise; } catch { /* cancelled */ }
      }
      if (cancelled) return;
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const cssScale = width / base.width;
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: cssScale * ratio });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${base.height * cssScale}px`;
      onSizeRef.current?.(pageNumber, { width, height: base.height * cssScale });
      const task = page.render({ canvasContext: canvas.getContext("2d"), viewport });
      taskRef.current = task;
      try {
        await task.promise;
      } catch (error) {
        if (error?.name !== "RenderingCancelledException") throw error;
      } finally {
        if (taskRef.current === task) taskRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
      taskRef.current?.cancel();
    };
  }, [pdf, pageNumber, width]);

  return <canvas ref={canvasRef} style={{ display: "block", width, height: Math.round(width * 1.414) }} />;
}

function fieldBox(field, size, stampRatio = STAMP_RATIO) {
  const scale = (field.scale || 100) / 100;
  if (field.type === "signature") {
    return fitStampSize(size.width, size.height, stampRatio, scale);
  }
  const height = Math.max(20, size.height * (TEXT_HEIGHT_PERCENT / 100) * scale);
  // A mark is square so it drops cleanly into a printed checkbox.
  if (isMarkField(field)) return { width: height, height };
  return { width: size.width * (TEXT_WIDTH_PERCENT / 100) * scale, height };
}

/** Continuous page stage — click to place, drag to move, click a text field to fill it. */
export default function SigningWorkspacePages({
  pdf,
  pageCount,
  pageWidth,
  fields,
  textValues,
  signers,
  sealPreview,
  activeFieldId,
  ar,
  placing,
  onPlace,
  onMove,
  onSelect,
  onRemove,
  onTextChange,
  onVisiblePage,
  stampRatio = STAMP_RATIO,
}) {
  const sizesRef = useRef({});
  const pageRefs = useRef({});
  const movedRef = useRef(false);
  const [, setTick] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [guides, setGuides] = useState(NO_GUIDES);

  const noteSize = useCallback((pageNumber, size) => {
    const known = sizesRef.current[pageNumber];
    if (known && Math.abs(known.width - size.width) < 0.5 && Math.abs(known.height - size.height) < 0.5) return;
    sizesRef.current[pageNumber] = size;
    setTick((value) => value + 1);
  }, []);

  const pointFor = (pageNumber, event) => {
    const host = pageRefs.current[pageNumber];
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const startDrag = (event, field) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(field.id);
    const start = pointFor(field.page, event);
    if (!start) return;
    const offsetX = start.x - field.x;
    const offsetY = start.y - field.y;
    const peers = fields.filter((other) => other.page === field.page && other.id !== field.id);
    movedRef.current = false;
    const move = (moveEvent) => {
      const point = pointFor(field.page, moveEvent);
      if (!point) return;
      movedRef.current = true;
      let x = Math.min(98, Math.max(2, point.x - offsetX));
      let y = Math.min(98, Math.max(2, point.y - offsetY));
      // Snap onto a neighbour's centre line so a column of fields stays a column.
      let lineX = null;
      let lineY = null;
      for (const peer of peers) {
        if (lineX === null && Math.abs(peer.x - x) <= SNAP_PERCENT) { x = peer.x; lineX = peer.x; }
        if (lineY === null && Math.abs(peer.y - y) <= SNAP_PERCENT) { y = peer.y; lineY = peer.y; }
      }
      setGuides((current) => (current.page === field.page && current.x === lineX && current.y === lineY
        ? current
        : { page: field.page, x: lineX, y: lineY }));
      onMove?.(field.id, { x, y });
    };
    const stop = () => {
      setGuides(NO_GUIDES);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const startResize = (event, field) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startScale = field.scale || 100;
    const min = field.type === "signature" ? 65 : 50;
    const max = field.type === "signature" ? 135 : 200;
    const move = (moveEvent) => {
      const delta = ((moveEvent.clientX - startX) / (pageWidth || 560)) * 400;
      onMove?.(field.id, { scale: Math.min(max, Math.max(min, Math.round(startScale + (ar ? -delta : delta)))) });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  useEffect(() => {
    if (!onVisiblePage || !pageCount) return undefined;
    let io = null;
    let host = null;
    let cancelled = false;
    let frame = 0;
    const markIntersecting = () => {
      if (!host) return;
      const view = host.getBoundingClientRect();
      for (let page = 1; page <= pageCount; page += 1) {
        const node = pageRefs.current[page];
        if (!node) continue;
        const box = node.getBoundingClientRect();
        if (box.bottom > view.top && box.top < view.bottom) onVisiblePage(page);
      }
    };
    const attach = () => {
      if (cancelled) return;
      host = pageRefs.current[1]?.parentElement;
      if (!host) {
        frame = requestAnimationFrame(attach);
        return;
      }
      markIntersecting();
      io = typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const page = Number(entry.target.getAttribute("data-signing-page"));
            if (page) onVisiblePage(page);
          }
        }, { root: host, threshold: 0 })
        : null;
      for (let page = 1; page <= pageCount; page += 1) {
        const node = pageRefs.current[page];
        if (node && io) io.observe(node);
      }
      host.addEventListener("scroll", markIntersecting, { passive: true });
    };
    attach();
    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      io?.disconnect();
      host?.removeEventListener("scroll", markIntersecting);
    };
  }, [pageCount, onVisiblePage]);

  return (
    <>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => {
        const size = sizesRef.current[pageNumber] || { width: pageWidth, height: pageWidth * 1.414 };
        const pageFields = fields.filter((field) => field.page === pageNumber);
        return (
          <div
            key={pageNumber}
            ref={(node) => { pageRefs.current[pageNumber] = node; }}
            data-signing-page={pageNumber}
            onClick={(event) => {
              const point = pointFor(pageNumber, event);
              if (point) onPlace?.(pageNumber, point);
            }}
            style={{
              position: "relative",
              flex: "none",
              background: CARD,
              boxShadow: "0 1px 3px rgba(20,40,75,.12), 0 8px 24px rgba(20,40,75,.08)",
              cursor: placing ? "crosshair" : "default",
            }}
          >
            <PdfPageCanvas pdf={pdf} pageNumber={pageNumber} width={pageWidth} onSize={noteSize} />
            <span
              dir="ltr"
              style={{
                position: "absolute",
                bottom: 6,
                insetInline: 0,
                textAlign: "center",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: MUTED,
                pointerEvents: "none",
              }}
            >
              {pageNumber} / {pageCount}
            </span>

            {guides.page === pageNumber && guides.x !== null ? (
              <span style={{ position: "absolute", left: `${guides.x}%`, top: 0, bottom: 0, width: 1, background: BRAND, pointerEvents: "none", zIndex: 4 }} />
            ) : null}
            {guides.page === pageNumber && guides.y !== null ? (
              <span style={{ position: "absolute", top: `${guides.y}%`, insetInline: 0, height: 1, background: BRAND, pointerEvents: "none", zIndex: 4 }} />
            ) : null}

            {pageFields.map((field) => {
              const box = fieldBox(field, size, stampRatio);
              const signer = signers[field.signer] || signers[0];
              const active = activeFieldId === field.id;
              const editing = editingId === field.id;
              const value = textValues[field.id] || "";
              // Your own required field left empty is the one thing that will
              // block the finish button — flag it on the page, not only in the gate.
              const gap = field.signer === 0 && field.type === "text" && field.required !== false && !value;
              return (
                <div
                  key={field.id}
                  onPointerDown={(event) => { if (!editing) startDrag(event, field); }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (movedRef.current) { movedRef.current = false; return; }
                    onSelect?.(field.id);
                    if (field.signer !== 0) return;
                    // A mark flips between tick and cross in place; only real
                    // text fields open an input.
                    if (isMarkField(field)) {
                      const next = MARK_GLYPHS[(MARK_GLYPHS.indexOf(value) + 1) % MARK_GLYPHS.length];
                      onTextChange?.(field.id, next);
                    } else if (field.type === "text") {
                      setEditingId(field.id);
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: box.width,
                    height: box.height,
                    transform: "translate(-50%, -50%)",
                    border: `1.5px ${field.type === "signature" ? "solid" : "dashed"} ${gap ? "#B45309" : signer?.color || BRAND}`,
                    background: field.type === "signature"
                      ? "rgba(255,255,255,.92)"
                      : `color-mix(in oklab, ${gap ? "#B45309" : signer?.color || BRAND} 8%, #fff)`,
                    borderRadius: 4,
                    boxSizing: "border-box",
                    cursor: editing ? "text" : "move",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                    zIndex: active ? 3 : 1,
                    boxShadow: active ? "0 6px 16px rgba(20,40,75,.22)" : "none",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: editing ? "auto" : "none",
                  }}>
                  {field.type === "signature" ? (
                    field.signer === 0 && sealPreview ? (
                      <img src={sealPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
                    ) : (
                      <span style={{ pointerEvents: "none", textAlign: "center", lineHeight: 1.4 }}>
                        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: signer?.color || BRAND }}>
                          {ar ? "توقيع" : "Signature"}
                        </span>
                        <span style={{ display: "block", fontSize: 9, color: MUTED }}>{signer?.name}</span>
                      </span>
                    )
                  ) : isMarkField(field) ? (
                    <span
                      title={field.signer === 0 ? (ar ? "اضغط للتبديل بين صح وخطأ" : "Click to flip between tick and cross") : undefined}
                      style={{ pointerEvents: "none", lineHeight: 1, color: value ? "#14284B" : MUTED }}
                    >
                      <SignMarkGlyph glyph={value || MARK_GLYPHS[0]} size={Math.max(14, box.height * 0.62)} color="currentColor" />
                    </span>
                  ) : editing ? (
                    <input
                      autoFocus
                      className="nv-signing-inline nv-signing-inline--fill"
                      value={value}
                      onChange={(event) => onTextChange?.(field.id, event.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") setEditingId(null); }}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        textAlign: "center",
                        fontFamily: "inherit",
                        fontSize: 12,
                        color: "#14284B",
                      }}
                    />
                  ) : (
                    <span style={{ pointerEvents: "none", fontSize: 12, color: value ? "#14284B" : MUTED, padding: "0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {value || field.label}
                    </span>
                  )}
                  </div>

                  {active ? (
                    <>
                      <button
                        type="button"
                        aria-label={ar ? "إلغاء الحقل" : "Remove field"}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => { event.stopPropagation(); onRemove?.(field.id); }}
                        style={{
                          position: "absolute",
                          top: 0,
                          insetInlineEnd: 0,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          border: `1.5px solid ${CARD}`,
                          background: "#14284B",
                          color: "#fff",
                          fontSize: 15,
                          lineHeight: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          zIndex: 5,
                          boxShadow: "0 1px 4px rgba(20,40,75,.28)",
                          transform: ar ? "translate(-100%, -50%)" : "translate(100%, -50%)",
                        }}
                      >
                        ×
                      </button>
                      <span
                        role="presentation"
                        onPointerDown={(event) => startResize(event, field)}
                        style={{
                          position: "absolute",
                          bottom: -7,
                          insetInlineEnd: -7,
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          border: `2px solid ${CARD}`,
                          background: signer?.color || BRAND,
                          cursor: "ew-resize",
                        }}
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/** Page rail — thumbnails with a dot on pages that already carry fields. */
export function SigningWorkspaceThumbs({ pdf, pageCount, fields, activePage, onSelect, ar }) {
  return (
    <>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => {
        const hasFields = fields.some((field) => field.page === pageNumber);
        const current = activePage === pageNumber;
        return (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onSelect?.(pageNumber)}
            aria-label={ar ? `الصفحة ${pageNumber}` : `Page ${pageNumber}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <div style={{ position: "relative", border: `1.5px solid ${current ? "#14284B" : BORDER}`, borderRadius: 3, overflow: "hidden", background: CARD }}>
              <PdfPageCanvas pdf={pdf} pageNumber={pageNumber} width={72} />
              {hasFields ? (
                <span style={{ position: "absolute", bottom: 5, insetInlineEnd: 5, width: 8, height: 8, borderRadius: "50%", background: BRAND }} />
              ) : null}
            </div>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED }}>{pageNumber}</span>
          </button>
        );
      })}
    </>
  );
}
