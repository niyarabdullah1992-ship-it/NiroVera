import React, { useRef } from "react";
import { Plus, X } from "lucide-react";

export default function AssistantImageUpload({ file, onSelect, disabled, ar }) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="absolute start-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] border border-[var(--nv-line)] bg-[var(--nv-soft)] text-[var(--nv-ink)] hover:bg-[var(--nv-card)] hover:border-[var(--nv-ink)] disabled:opacity-50" aria-label={ar ? "إضافة صورة أو ملف" : "Add image or file"} title={ar ? "إضافة صورة أو ملف" : "Add image or file"}>
        <Plus className="h-5 w-5" strokeWidth={2} />
      </button>
      <input ref={inputRef} type="file" accept="image/*,.pdf,.csv,.xlsx,.xls,audio/*" className="hidden" onChange={(event) => onSelect(event.target.files?.[0] || null)} />
      {file && <div className="absolute bottom-full start-0 mb-2 flex max-w-full items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs shadow-sm"><span className="max-w-48 truncate">{file.name}</span><button type="button" onClick={() => onSelect(null)} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={ar ? "إزالة الملف" : "Remove file"}><X className="h-3.5 w-3.5" /></button></div>}
    </>
  );
}