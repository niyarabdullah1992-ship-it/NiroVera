import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import pdfjsLib from "@/lib/pdfjsSetup";
import StampOnPage from "@/components/files/StampOnPage";
import { STAMP_CANVAS_HEIGHT, STAMP_CANVAS_WIDTH, STAMP_WIDTH_PERCENT } from "@/lib/signatureStampGeometry";

export default function InlinePdfPlacement({ url, fields, onFieldsChange, textValues, signaturePreview, ar, onPageChange }) {
  const canvasRef = useRef(null); const wrapRef = useRef(null); const renderTaskRef = useRef(null);
  const [pdf, setPdf] = useState(null); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [width, setWidth] = useState(800); const [loading, setLoading] = useState(true); const [selectedId, setSelectedId] = useState(null);
  useEffect(() => { let active = true; pdfjsLib.getDocument({ url, cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`, cMapPacked: true, standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`, useSystemFonts: false, disableFontFace: true }).promise.then((doc) => { if (active) { setPdf(doc); setPages(doc.numPages); } }); return () => { active = false; renderTaskRef.current?.cancel(); }; }, [url]);
  useEffect(() => { const host = wrapRef.current?.parentElement; if (!host) return; const update = () => setWidth(Math.max(280, host.clientWidth - 32)); update(); const observer = new ResizeObserver(update); observer.observe(host); return () => observer.disconnect(); }, []);
  useEffect(() => { if (!pdf || !canvasRef.current) return; let cancelled = false; (async () => { const previous = renderTaskRef.current; if (previous) { previous.cancel(); try { await previous.promise; } catch {} } if (cancelled) return; setLoading(true); const pdfPage = await pdf.getPage(page); if (cancelled) return; const base = pdfPage.getViewport({ scale: 1 }); const cssScale = width / base.width; const viewport = pdfPage.getViewport({ scale: cssScale * (window.devicePixelRatio || 1) }); const canvas = canvasRef.current; canvas.width = viewport.width; canvas.height = viewport.height; canvas.style.width = `${width}px`; canvas.style.height = `${base.height * cssScale}px`; const task = pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }); renderTaskRef.current = task; try { await task.promise; if (!cancelled) setLoading(false); } catch (error) { if (error?.name !== "RenderingCancelledException") throw error; } finally { if (renderTaskRef.current === task) renderTaskRef.current = null; } })(); return () => { cancelled = true; renderTaskRef.current?.cancel(); }; }, [pdf, page, width]);
  useEffect(() => { onPageChange?.(page); }, [page, onPageChange]);
  const updateField = (id, patch) => onFieldsChange(fields.map((item) => item.id === id ? { ...item, ...patch } : item));
  const drag = (event, field) => { event.preventDefault(); setSelectedId(field.id); const rect = wrapRef.current.getBoundingClientRect(); const startX = event.clientX; const startY = event.clientY; const originX = field.x; const originY = field.y; const move = (e) => updateField(field.id, { x: Math.min(96, Math.max(4, originX + ((e.clientX - startX) / rect.width) * 100)), y: Math.min(96, Math.max(4, originY + ((e.clientY - startY) / rect.height) * 100)) }); const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop); };
  const resize = (event, field) => { event.stopPropagation(); event.preventDefault(); const startX = event.clientX; const startScale = field.scale || 100; const stageWidth = wrapRef.current?.clientWidth || 600; const move = (e) => updateField(field.id, { scale: Math.min(200, Math.max(40, Math.round(startScale + ((e.clientX - startX) / stageWidth) * 400))) }); const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop); };
  const visible = fields.filter((field) => field.page === page);
  const selected = visible.find((field) => field.id === selectedId);
  return (
    <div className="document-first-page-preview relative flex min-h-[78vh] w-full min-w-0 justify-center overflow-auto bg-[var(--nv-soft)] p-4 pb-24 sm:p-7 sm:pb-24">
      <div ref={wrapRef} className="relative h-fit max-w-full overflow-visible bg-white shadow-sm ring-1 ring-[var(--nv-line)]">
        <canvas ref={canvasRef} className="document-first-page-canvas block max-w-full" />
        {visible.map((field) => {
          const fieldWidth = (field.type === "signature" ? STAMP_WIDTH_PERCENT : 26) * ((field.scale || 100) / 100);
          const active = selectedId === field.id;
          return <div key={field.id} onPointerDown={(event) => drag(event, field)} className={`absolute cursor-move touch-none overflow-visible ${field.type === "text" ? "flex items-center justify-center rounded-md border-2 border-[var(--nv-navy)] bg-[var(--nv-soft)] px-2 text-xs font-bold text-[var(--nv-ink)]" : ""}`} style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${fieldWidth}%`, minHeight: field.type === "text" ? 32 : undefined, aspectRatio: field.type === "signature" ? `${STAMP_CANVAS_WIDTH} / ${STAMP_CANVAS_HEIGHT}` : undefined, transform: "translate(-50%, -50%)", zIndex: active ? 3 : 1 }}>
            {field.type === "signature" ? (
              <StampOnPage src={signaturePreview} name={ar ? "التوقيع" : "Signature"} color="var(--nv-ok-ink)" selected={active} onRemove={() => { onFieldsChange(fields.filter((item) => item.id !== field.id)); setSelectedId(null); }} onResizeStart={(event) => resize(event, field)} />
            ) : (
              <>
                {textValues[field.id] || field.label}
                {active ? <span data-resize="true" onPointerDown={(event) => resize(event, field)} className="absolute -bottom-2 -end-2 h-5 w-5 cursor-se-resize rounded-sm border-2 border-white bg-[var(--nv-btn-fill)] shadow-md" /> : null}
                <button type="button" aria-label={ar ? "حذف الحقل" : "Delete field"} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onFieldsChange(fields.filter((item) => item.id !== field.id)); setSelectedId(null); }} className="absolute -end-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-destructive text-destructive-foreground shadow-md"><X className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>;
        })}
      </div>
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-primary/70"><Loader2 className="h-7 w-7 animate-spin text-accent" /></div>}
      <div className="absolute bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[var(--nv-line)] bg-white/95 px-3 py-2.5 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border p-1.5 disabled:opacity-35">{ar ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button><span className="min-w-14 text-center text-xs font-bold">{page} / {pages}</span><button type="button" disabled={page === pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-lg border p-1.5 disabled:opacity-35">{ar ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></div>
        {selected ? <div className="flex min-w-0 flex-1 items-center gap-2"><span className="shrink-0 text-[10px] font-bold text-muted-foreground">{ar ? "الحجم" : "Size"} {selected.scale || 100}%</span><input type="range" min="40" max="200" step="5" value={selected.scale || 100} onChange={(event) => updateField(selected.id, { scale: Number(event.target.value) })} className="min-w-0 flex-1 accent-current" /></div> : <span className="text-[10px] text-muted-foreground">{ar ? "اسحب التوقيع وحدده لتغيير حجمه" : "Drag the signature and select it to resize"}</span>}
      </div>
    </div>
  );
}