import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { articleOfficialText, BOE_LABOUR_LAW_URL } from "@/lib/laborArticleTexts";
import { HRSD_IMPLEMENTING_REGS_URL } from "@/lib/laborRules";
import { decision18632Gist } from "@/lib/decision18632";
import { HEAT_BAN_DECISION_PDF, heatBanDecisionGist } from "@/lib/heatBanDecision";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * «⚖ حقك» / «⚖ التزامك» — one small inline trigger per item. Click opens a small popover (a bottom
 * sheet on narrow screens) with exactly three lines: the right/duty for THIS item, what to do if it is
 * not applied (one action), and the statute link that opens the official text.
 * The hint object comes from src/lib/rightHints.js (or any builder with the same shape).
 */

const GREEN = "var(--nv-ok-ink)";
const INK = "var(--nv-ink)";
const MUTED = "var(--nv-muted)";

export function ScaleGlyph({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden focusable="false" style={{ flex: "none" }}>
      <path d="M8 2v11M4.5 13.5h7M3 4.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3 4.5 1.4 8.4a1.9 1.9 0 0 0 3.2 0L3 4.5Zm10 0-1.6 3.9a1.9 1.9 0 0 0 3.2 0L13 4.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

/** The official-text reader for an article / decision / regulation article. */
export function StatuteDialog({ law, open, onOpenChange, ar = true, onDate }) {
  if (!law) return null;
  const official = law.article ? articleOfficialText(law.article, onDate) : null;
  const statute = official ? (ar ? official.ar : official.en) : "";
  const decision = law.decisionId === "18632"
    ? decision18632Gist(ar)
    : law.decisionId === "3337" ? heatBanDecisionGist(ar, onDate) : "";
  const body = statute || decision;
  const sourceHref = law.decisionId === "3337"
    ? HEAT_BAN_DECISION_PDF
    : law.regs ? HRSD_IMPLEMENTING_REGS_URL : (official?.sourceUrl || BOE_LABOUR_LAW_URL);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={ar ? "rtl" : "ltr"} className="font-body max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className={ar ? "pr-8 text-right sm:text-right" : "pr-8 text-left"}>
          <DialogTitle className="font-heading" style={{ color: INK }}>{law.label}</DialogTitle>
          <DialogDescription>
            {law.regs
              ? (ar ? "مادة من اللائحة التنفيذية لنظام العمل — النص في ملف الوزارة الرسمي." : "An article of the Implementing Regulations — the text is in the ministry's official file.")
              : law.decisionId
                ? (ar ? "نص القرار الوزاري كما تقرؤه المنصة." : "The ministerial decision as the platform reads it.")
                : (ar ? "نص المادة من نظام العمل كما هو منشور في هيئة الخبراء." : "The article as published by the Bureau of Experts.")}
          </DialogDescription>
        </DialogHeader>
        {body ? (
          <p style={{ margin: 0, fontSize: 14, color: INK, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{body}</p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
            {ar ? "النص الكامل في المصدر الرسمي أدناه." : "The full text is at the official source below."}
          </p>
        )}
        <a href={sourceHref} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: GREEN, textDecoration: "underline", textUnderlineOffset: 3, alignSelf: "flex-start" }}>
          {law.regs
            ? (ar ? "اللائحة التنفيذية (PDF)" : "Implementing regulations (PDF)")
            : law.decisionId === "3337"
              ? (ar ? "صورة القرار الموقّعة (PDF)" : "Signed decision (PDF)")
              : (ar ? "النص في هيئة الخبراء" : "BOE official text")}
        </a>
      </DialogContent>
    </Dialog>
  );
}

/** «المادة 109» as a quiet link that opens the official text; a product rule reads as plain text. */
export function StatuteLink({ law, ar = true, onDate, style }) {
  const [open, setOpen] = useState(false);
  if (!law) return null;
  if (law.product) {
    return <span style={{ fontSize: 11, color: MUTED, ...style }}>{law.label}</span>;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: GREEN, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap", ...style }}
      >
        {law.label}
      </button>
      <StatuteDialog law={law} open={open} onOpenChange={setOpen} ar={ar} onDate={onDate} />
    </>
  );
}

/** The one action a hint offers: an in-page flow (onAction), a route, or an external page. */
export function HintAction({ action, ar = true, onAction, onDone }) {
  if (!action?.label) return null;
  const s = {
    fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: GREEN, background: "none",
    border: "none", padding: 0, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap",
  };
  const label = <>{action.label} <span aria-hidden>{ar ? "‹" : "›"}</span></>;
  if (action.href) {
    return <a href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined} style={s} onClick={onDone}>{label}</a>;
  }
  if (action.to && !onAction) return <Link to={action.to} style={s} onClick={onDone}>{label}</Link>;
  return (
    <button type="button" style={s} onClick={() => { onAction?.(action); onDone?.(); }}>
      {label}
    </button>
  );
}

const NARROW = 560;
const PANEL_W = 300;

export default function RightHint({ hint, ar = true, onAction, onDate, style }) {
  const [open, setOpen] = useState(false);
  const [lawOpen, setLawOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const trigger = useRef(null);
  const panel = useRef(null);
  const id = useRef(`nv-rh-${Math.random().toString(36).slice(2, 9)}`).current;

  const place = () => {
    const el = trigger.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < NARROW) { setPos({ sheet: true }); return; }
    const width = Math.min(PANEL_W, vw - 16);
    let left = ar ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const h = panel.current?.offsetHeight || 170;
    const below = r.bottom + 6;
    const top = below + h > vh - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
    setPos({ sheet: false, left, top, width });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    const onDown = (e) => {
      if (panel.current?.contains(e.target) || trigger.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const t = setTimeout(() => panel.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  if (!hint) return null;
  const word = hint.word || (ar ? (hint.view === "manager" ? "التزامك" : "حقك") : (hint.view === "manager" ? "Your duty" : "Your right"));
  const ifNotLabel = ar ? "إن لم يُطبَّق:" : "If not applied:";
  const lawLabel = ar ? "النص النظامي:" : "The statute:";
  const row = { display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 8, alignItems: "baseline", padding: "8px 0", borderTop: "1px solid var(--nv-line2, var(--nv-line))" };
  const key = { fontSize: 11, fontWeight: 700, color: MUTED, whiteSpace: "nowrap" };

  const sheet = pos?.sheet;
  const box = sheet
    ? { position: "fixed", insetInline: 0, bottom: 0, maxHeight: "70vh", overflowY: "auto", borderRadius: "14px 14px 0 0", padding: "14px 16px calc(14px + env(safe-area-inset-bottom))" }
    : { position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? PANEL_W, borderRadius: 10, padding: "10px 14px 6px" };

  const body = open ? createPortal(
    <>
      {sheet ? <div aria-hidden style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.28)", zIndex: 80 }} /> : null}
      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-label={word}
        tabIndex={-1}
        dir={ar ? "rtl" : "ltr"}
        data-right-hint-panel="1"
        style={{
          ...box,
          zIndex: 81,
          boxSizing: "border-box",
          background: "var(--nv-card)",
          color: INK,
          border: "1px solid var(--nv-line)",
          boxShadow: "0 10px 30px var(--nv-shadow, rgba(0,0,0,.12))",
          fontFamily: "var(--font-body, inherit)",
          outline: "none",
          textAlign: "start",
        }}
      >
        <div style={{ ...row, borderTop: "none", paddingTop: 2 }}>
          <span style={{ ...key, color: GREEN }}>{word}:</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.75, color: INK }}>{hint.right}</span>
        </div>
        <div style={row}>
          <span style={key}>{ifNotLabel}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", minWidth: 0 }}>
            {hint.ifNot ? <span style={{ fontSize: 12, lineHeight: 1.7, color: "var(--nv-ink2, var(--nv-ink))" }}>{hint.ifNot}</span> : null}
            <HintAction action={hint.action} ar={ar} onAction={onAction} onDone={() => setOpen(false)} />
          </span>
        </div>
        <div style={row}>
          <span style={key}>{lawLabel}</span>
          {hint.law?.product ? (
            <span style={{ fontSize: 11.5, color: MUTED }}>{ar ? "قرار تشغيلي — بلا مادة في نظام العمل" : "Operational — no Labour Law article"}</span>
          ) : (
            <button
              type="button"
              onClick={() => { setOpen(false); setLawOpen(true); }}
              style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: GREEN, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, justifySelf: "start" }}
            >
              {hint.law?.label}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="nv-right-hint"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        data-right-hint={hint.view}
        style={{
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.4,
          color: GREEN,
          background: "transparent",
          border: "none",
          padding: "2px 0",
          cursor: "pointer",
          whiteSpace: "nowrap",
          ...style,
        }}
      >
        <ScaleGlyph />
        <span>{word}</span>
      </button>
      {body}
      <StatuteDialog law={hint.law} open={lawOpen} onOpenChange={setLawOpen} ar={ar} onDate={onDate} />
    </>
  );
}
