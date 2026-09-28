import React from "react";
import { createPortal } from "react-dom";
import { X, BadgeCheck, AlertTriangle, History } from "lucide-react";
import { formatDateTime, formatOpenDuration } from "@/lib/dateFormat";

// Full permanent record for one station: every approval, incident and closed hazard,
// merged chronologically. Data is stored on the station's safety record and
// synced to the cloud with the rest of the company data.
export default function StationSafetyLog({ station, rec, lang, onClose }) {
  const ar = lang === "ar";
  const entries = [
    ...((rec?.approvalLog || []).map((a) => ({ type: "approval", at: a.at, who: a.by, text: ar ? "اعتماد بيانات السلامة" : "Safety data approved" }))),
    ...((rec?.incidentLog || []).map((i) => {
      const card = i.card || {};
      const level = ar ? card.levelAr : card.levelEn;
      return {
        type: "incident",
        at: i.at,
        who: i.anonymous ? (ar ? "بلاغ بلا اسم" : "Anonymous") : (i.by || ""),
        text: [i.description || (ar ? "حادثة سلامة" : "Safety incident"), level, ar ? card.categoryAr : card.categoryEn].filter(Boolean).join(" · "),
      };
    })),
    ...((rec?.hazardLog || []).map((h) => {
      const duration = h.openedAt
        ? formatOpenDuration(h.openedAt, lang, h.closedAt ? new Date(h.closedAt).getTime() : Date.now())
        : "";
      return {
        type: "hazard",
        at: h.closedAt,
        who: h.closedBy || "",
        text: `${ar ? "أُغلق الخطر" : "Hazard closed"}: ${h.description}${duration ? (ar ? ` — بقي مفتوحًا ${duration}` : ` — open for ${duration}`) : ""}${h.beforePhoto?.url && h.afterPhoto?.url ? (ar ? " (قبل/بعد)" : " (before/after)") : ""}`,
      };
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  // Rendered through a portal onto <body> so no page container (overflow,
  // transform, RTL wrappers) can hide or clip the dialog.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" dir={ar ? "rtl" : "ltr"} onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl bg-card border border-border shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            <div>
              <h3 className="font-body font-semibold text-sm">{ar ? "سجل الفرع" : "Station record"}</h3>
              <p className="text-[11px] text-muted-foreground font-body">{station.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground font-body text-center py-8">
              {ar ? "لا توجد سجلات بعد — كل اعتماد وحادثة وإغلاق خطر يُحفظ هنا تلقائيًا." : "No records yet — every approval, incident and hazard closure is saved here automatically."}
            </p>
          )}
          {entries.map((e, i) => (
            <div key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${e.type === "incident" ? "border-red-200 bg-red-50/50" : "border-emerald-200 bg-emerald-50/50"}`}>
              {e.type === "incident"
                ? <AlertTriangle className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
                : <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-body font-semibold">{e.text}</p>
                <p className="text-[10px] text-muted-foreground font-body mt-0.5">
                  {e.who && <span className="font-semibold">{e.who} — </span>}
                  {formatDateTime(e.at, lang)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}