import React, { useEffect, useRef, useState } from "react";
import { Check, Eraser, Minus, PenTool, Plus } from "lucide-react";
import { makeSignatureStamp } from "@/lib/multiSignStamp";
import { generateVerificationId } from "@/lib/verificationBadge";
import { cropOpaque } from "@/lib/typedSignatureImage";
import { BORDER, MUTED, NAVY, ui, CARD, SURFACE } from "@/lib/platformStyles";
import StampPreview from "./StampPreview";

const DRAW_INK = "#111418";

export default function SignaturePad({ ar, signerName, verificationId, stampTheme = "heritage", stampConfig, onPreview, onSave, onMark, markOnly = false, saving }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const previous = useRef(null);
  const inkRef = useRef(false);
  const [stamp, setStamp] = useState("");
  const [thickness, setThickness] = useState(6);
  const [sealId] = useState(() => verificationId || generateVerificationId());
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  const onMarkRef = useRef(onMark);
  onMarkRef.current = onMark;

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height), time: performance.now() };
  };
  const strokeStyle = (ctx, width) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = DRAW_INK;
    ctx.fillStyle = DRAW_INK;
    ctx.lineWidth = width;
    ctx.setLineDash([]);
  };
  const start = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawing.current = true;
    const current = point(event);
    const ctx = canvasRef.current.getContext("2d");
    strokeStyle(ctx, thickness);
    ctx.beginPath();
    ctx.arc(current.x, current.y, thickness / 2, 0, Math.PI * 2);
    ctx.fill();
    previous.current = { ...current, midX: current.x, midY: current.y, width: thickness };
    inkRef.current = true;
  };
  const move = (event) => {
    if (!drawing.current || !previous.current) return;
    event.preventDefault();
    const current = point(event);
    const last = previous.current;
    const distance = Math.hypot(current.x - last.x, current.y - last.y);
    if (distance < 0.6) return;
    const velocity = distance / Math.max(current.time - last.time, 1);
    const target = Math.max(thickness * 0.55, Math.min(thickness * 1.35, thickness + 1.4 - velocity * 1.1));
    const width = last.width * 0.55 + target * 0.45;
    const midX = (last.x + current.x) / 2;
    const midY = (last.y + current.y) / 2;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(last.midX ?? last.x, last.midY ?? last.y);
    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    strokeStyle(ctx, width);
    ctx.stroke();
    previous.current = { ...current, midX, midY, width };
  };
  const emitDrawn = async () => {
    const raw = cropOpaque(canvasRef.current, 12);
    onMarkRef.current?.(raw);
    if (markOnly) return;
    try {
      const composed = await makeSignatureStamp(raw, signerName, sealId, "drawn", stampConfig || stampTheme);
      setStamp(composed);
      onPreviewRef.current?.(composed);
    } catch {
      setStamp("");
      onPreviewRef.current?.("");
    }
  };
  const end = async (event) => {
    if (event?.pointerId != null) event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!drawing.current) return;
    drawing.current = false;
    const last = previous.current;
    previous.current = null;
    if (last) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(last.midX ?? last.x, last.midY ?? last.y);
      ctx.lineTo(last.x, last.y);
      strokeStyle(ctx, last.width || thickness);
      ctx.stroke();
    }
    if (!inkRef.current) return;
    await emitDrawn();
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    inkRef.current = false;
    setStamp("");
    onMarkRef.current?.("");
    onPreviewRef.current?.("");
  };

  useEffect(() => {
    if (markOnly || !inkRef.current || !canvasRef.current) return undefined;
    let active = true;
    makeSignatureStamp(canvasRef.current.toDataURL("image/png"), signerName, sealId, "drawn", stampConfig || stampTheme)
      .then((composed) => {
        if (!active || !composed) return;
        setStamp(composed);
        onPreviewRef.current?.(composed);
      })
      .catch(() => {
        if (active) {
          setStamp("");
          onPreviewRef.current?.("");
        }
      });
    return () => { active = false; };
  }, [stampConfig, signerName, sealId, stampTheme, markOnly]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 8, border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE }}>
        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "السُمك" : "Width"}</span>
        <button type="button" onClick={() => setThickness((value) => Math.max(2, value - 1))} style={ui.btnGhost}><Minus style={{ width: 14, height: 14 }} /></button>
        <span style={{ width: 16, textAlign: "center", fontSize: 11, color: NAVY }}>{thickness}</span>
        <button type="button" onClick={() => setThickness((value) => Math.min(10, value + 1))} style={ui.btnGhost}><Plus style={{ width: 14, height: 14 }} /></button>
      </div>
      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
        <PenTool style={{ width: 13, height: 13, color: "var(--nv-ok-ink)" }} />
        {ar ? "ارسم توقيعك داخل الإطار" : "Draw your signature inside the frame"}
      </p>
      <canvas
        ref={canvasRef}
        width={1800}
        height={520}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ width: "100%", height: 148, touchAction: "none", cursor: "crosshair", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD }}
      />
      {markOnly ? null : <StampPreview src={stamp} sealId={sealId} ar={ar} />}
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: markOnly || !onSave ? "1fr" : "auto 1fr" }}>
        <button type="button" onClick={clear} style={{ ...ui.btnGhost, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Eraser style={{ width: 14, height: 14 }} />
          {ar ? "مسح" : "Clear"}
        </button>
        {markOnly || !onSave ? null : (
          <button
            type="button"
            disabled={!stamp || saving}
            onClick={() => onSave(canvasRef.current.toDataURL("image/png"), signerName, "drawn")}
            style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: !stamp || saving ? 0.45 : 1 }}
          >
            <Check style={{ width: 14, height: 14 }} />
            {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التوقيع" : "Save signature")}
          </button>
        )}
      </div>
    </div>
  );
}
