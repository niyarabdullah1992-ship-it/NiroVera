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

function GoldGlyph({ tool }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#C4A24A", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  if (tool === "name" || tool === "email") {
    return <svg {...common} aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19" /></svg>;
  }
  if (tool === "date") {
    return <svg {...common} aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>;
  }
  if (tool === "seal" || tool === "org") {
    return <svg {...common} aria-hidden="true"><path d="M12 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" /><path d="M8 21h8" /></svg>;
  }
  if (tool === "check") {
    return <svg {...common} aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12l3 3 5-6" /></svg>;
  }
  return <svg {...common} aria-hidden="true"><path d="M4 20l4-1 10-10-3-3L5 16z" /><path d="M13 6l3 3" /></svg>;
}

/** Square yes/no box. A yes uses the ok ink; an empty or no box stays a quiet line. */
function YnChoiceBox({ value }) {
  const yes = String(value || "").startsWith("✓");
  const no = String(value || "").startsWith("✗");
  return (
    <span
      aria-hidden="true"
      data-yn-state={yes ? "yes" : no ? "no" : "empty"}
      style={{
        width: 16,
        height: 16,
        flex: "none",
        boxSizing: "border-box",
        borderRadius: 3,
        border: `1px solid ${yes ? "var(--nv-ok-line, #BFE6D2)" : "var(--nv-line, #DFE3EA)"}`,
        background: "var(--nv-card)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {yes ? (
        <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.1 8.2 L6.4 11.3 L12.9 4.2" fill="none" stroke="var(--nv-ok-ink, #137A49)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : no ? (
        <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.2 4.2 L11.8 11.8 M11.8 4.2 L4.2 11.8" fill="none" stroke="var(--nv-ink)" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      ) : null}
    </span>
  );
}
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
  appearance = "",
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
            onDragOver={(event) => {
              if (event.dataTransfer?.types?.includes("application/x-nv-field")) event.preventDefault();
            }}
            onDrop={(event) => {
              const raw = event.dataTransfer?.getData("application/x-nv-field");
              if (!raw) return;
              event.preventDefault();
              const point = pointFor(pageNumber, event);
              if (point) onPlace?.(pageNumber, point, raw);
            }}
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
              const measured = fieldBox(field, size, stampRatio);
              const yn = field.tool === "yn";
              const gold = appearance === "gold" && !yn;
              const box = yn
                ? { width: Math.max(measured.width, 196), height: Math.max(measured.height, 40) }
                : gold
                  ? { width: Math.max(measured.width, isMarkField(field) ? 36 : 132), height: Math.max(measured.height, isMarkField(field) ? 32 : 42) }
                  : measured;
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
                    } else if (field.tool === "yn") {
                      onTextChange?.(field.id, String(value).startsWith("✗") ? "✓ صح" : "✗ خطأ");
                    } else if (field.type === "text") {
                      setEditingId(field.id);
                    }
                  }}
                  data-signing-tool={field.tool || ""}
                  style={{
                    position: "absolute",
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: box.width,
                    height: box.height,
                    transform: "translate(-50%, -50%)",
                    border: yn
                      ? "1px solid var(--nv-line, #DFE3EA)"
                      : gold
                        ? `1px solid ${gap ? "var(--nv-warn-line)" : "var(--nv-line)"}`
                        : `1.5px ${field.type === "signature" ? "solid" : "dashed"} ${gap ? "#B45309" : signer?.color || BRAND}`,
                    background: yn
                      ? "var(--nv-card)"
                      : gold
                        ? "#FBF3D0"
                        : field.type === "signature"
                          ? "rgba(255,255,255,.92)"
                          : `color-mix(in oklab, ${gap ? "var(--nv-warn-ink)" : signer?.color || BRAND} 8%, #fff)`,
                    borderRadius: yn || gold ? 10 : 4,
                    boxSizing: "border-box",
                    cursor: editing ? "text" : "move",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                    zIndex: active ? 3 : 1,
                    boxShadow: active ? "0 6px 16px rgba(20,40,75,.22)" : (gold ? "0 1px 2px rgba(180,140,40,.18)" : "none"),
                  }}
                >
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    overflow: yn ? "visible" : "hidden",
                    borderRadius: yn ? 10 : 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: yn ? "0 12px" : 0,
                    pointerEvents: editing ? "auto" : "none",
                  }}>
                  {field.type === "signature" && !gold ? (
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
                      style={{ pointerEvents: "none", lineHeight: 1, color: value ? "var(--nv-ink)" : MUTED }}
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
                        color: "var(--nv-ink)",
                      }}
                    />
                  ) : yn ? (
                    <span dir={ar ? "rtl" : "ltr"} style={{ pointerEvents: "none", display: "inline-flex", alignItems: "center", gap: 8, color: "var(--nv-ink)", fontWeight: 600, fontSize: 13, lineHeight: 1.2, maxWidth: "100%" }}>
                      <span style={{ whiteSpace: "nowrap" }}>{field.label || (ar ? "صح أو خطأ" : "Yes or no")}</span>
                      <YnChoiceBox value={value} />
                    </span>
                  ) : gold ? (
                    <span style={{ pointerEvents: "none", display: "inline-flex", alignItems: "center", gap: 8, color: "#8A6A1A", fontWeight: 700, fontSize: 13, padding: "0 10px", maxWidth: "100%" }}>
                      <GoldGlyph tool={field.tool} />
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value || field.label}</span>
                    </span>
                  ) : (
                    <span style={{ pointerEvents: "none", fontSize: 12, color: value ? "var(--nv-ink)" : MUTED, padding: "0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                          background: "var(--nv-navy)",
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
                          background: yn ? "var(--nv-navy)" : (signer?.color || BRAND),
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
            <div style={{ position: "relative", border: `1.5px solid ${current ? "var(--nv-navy)" : BORDER}`, borderRadius: 3, overflow: "hidden", background: CARD }}>
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
