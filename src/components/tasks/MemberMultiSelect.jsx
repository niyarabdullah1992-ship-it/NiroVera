import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

// Assign one task to several members — closed by default, opens into a searchable checklist.
export default function MemberMultiSelect({ members, selected, onChange, lang, emptyLabel }) {
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = q ? members.filter((m) => (m.name || "").toLowerCase().includes(q)) : members;
  const picked = members.filter((m) => selected.includes(m.id));
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (members.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-body">
        {emptyLabel || (ar ? "لا يوجد أعضاء في هذا الفرع." : "No members in this station.")}
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-start text-sm font-body"
      >
        <span className={`flex-1 truncate ${selected.length ? "" : "text-muted-foreground"}`}>
          {selected.length
            ? (ar ? `${selected.length} عضو مختار` : `${selected.length} members selected`)
            : (ar ? "اختر الأعضاء" : "Select members")}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {!open && picked.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {picked.slice(0, 6).map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent-text">
              {m.name}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggle(m.id)} />
            </span>
          ))}
          {picked.length > 6 && (
            <span className="inline-flex items-center rounded-full border border-dashed border-input px-2 py-0.5 text-[11px] text-muted-foreground">
              +{picked.length - 6}
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-[70] overflow-hidden rounded-xl border border-input bg-card shadow-lg">
          <div className="relative border-b border-input bg-muted/40 p-1.5">
            <Search className="absolute top-1/2 start-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? "ابحث عن عضو..." : "Search member..."}
              className="w-full rounded-md border border-input px-8 py-1.5 text-sm font-body"
            />
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto p-1.5">
            {shown.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground font-body">{ar ? "لا توجد نتائج." : "No results."}</p>
            ) : shown.map((m) => {
              const on = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-sm font-body hover:bg-muted"
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-accent bg-accent text-accent-foreground" : "border-input"}`}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{m.name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-input bg-muted/40 px-2.5 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {ar ? `${selected.length} من ${members.length}` : `${selected.length} of ${members.length}`}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onChange(selected.length === members.length ? [] : members.map((m) => m.id))}
                className="rounded-md border border-dashed border-input px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {selected.length === members.length ? (ar ? "إلغاء الكل" : "Clear all") : (ar ? "تحديد الكل" : "Select all")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground"
              >
                {ar ? "تم" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}