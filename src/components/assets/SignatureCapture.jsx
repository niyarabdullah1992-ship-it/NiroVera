import React, { useRef, useState } from "react";
import { Eraser, Check, Loader2 } from "lucide-react";
import { uploadFileOrLocal } from "@/lib/localFileUpload";

// Compact two-party handover signature pad — draws, then uploads a PNG.
export default function SignatureCapture({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [saving, setSaving] = useState(false);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = point(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = point(e);
    ctx.strokeStyle = "#111418"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const end = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); onChange(""); };

  const save = async () => {
    setSaving(true);
    const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, "image/png"));
    const file = new File([blob], "signature.png", { type: "image/png" });
    const up = await uploadFileOrLocal(file);
    onChange(up.file_url);
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-body text-muted-foreground">{label}</p>
      <canvas
        ref={canvasRef}
        width={520}
        height={150}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-[110px] rounded-[10px] border border-border bg-card touch-none"
      />
      <div className="flex items-center gap-2">
        <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-body hover:bg-muted">
          <Eraser className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-body hover:bg-muted disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        {value && <span className="text-xs font-body text-emerald-700">موقّع</span>}
      </div>
    </div>
  );
}