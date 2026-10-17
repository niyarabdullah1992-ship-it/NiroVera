import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { articleOfficialText, BOE_LABOUR_LAW_URL } from "@/lib/laborArticleTexts";
import { HRSD_IMPLEMENTING_REGS_URL } from "@/lib/laborRules";
import { decision18632Gist } from "@/lib/decision18632";
import { HEAT_BAN_DECISION_PDF, heatBanDecisionGist } from "@/lib/heatBanDecision";
import { MODEL_SOURCE_AR, MODEL_SOURCE_EN, MODEL_SOURCE_URL, modelArticlesBody } from "@/lib/modelArticleTexts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NvIcon from "@/components/shared/NvIcon";

/**
 * «حقك» / «التزامك» with the scale glyph — one small inline trigger per item. Click opens a small popover (a bottom
 * sheet on narrow screens) with exactly three lines: the right/duty for THIS item, what to do if it is
 * not applied (one action), and the statute link that opens the official text.
 * The hint object comes from src/lib/rightHints.js (or any builder with the same shape).
 */

const GREEN = "var(--nv-ok-ink)";
const INK = "var(--nv-ink)";
const MUTED = "var(--nv-muted)";

/** The rights mark — the master glyph of the platform icon family (NvIcon «scale»). */
export function ScaleGlyph({ size = 13 }) {
  return <NvIcon name="scale" size={size} inline={false} />;
}

/** The official-text reader for an article / decision / regulation article. */
export function StatuteDialog({ law, open, onOpenChange, ar = true, onDate }) {
  if (!law) return null;
  // Annex 1 (the unified model regulation) — its own registry, never the Labour Law's.
  // A label like «النموذج الموحد م42» that arrived without `model` still reads Annex 1, never the Labour Law.
  const modelIds = law.model
    || (/^(النموذج الموحد|Model Art)/.test(String(law.label || "")) ? String(law.label).match(/\d+/g) : null);
  const isModel = Boolean(modelIds && modelIds.length);
  const model = isModel ? modelArticlesBody(modelIds, ar) : "";
  const official = !isModel && law.article ? articleOfficialText(law.article, onDate) : null;
  const statute = official ? (ar ? official.ar : official.en) : "";
  const decision = law.decisionId === "18632"
    ? decision18632Gist(ar)
    : law.decisionId === "3337" ? heatBanDecisionGist(ar, onDate) : "";
  const body = model || statute || decision;
  const sourceHref = isModel
    ? MODEL_SOURCE_URL
    : law.decisionId === "3337"
      ? HEAT_BAN_DECISION_PDF
      : law.regs ? HRSD_IMPLEMENTING_REGS_URL : (official?.sourceUrl || BOE_LABOUR_LAW_URL);
  const kind = isModel
    ? (ar ? "النموذج الموحد" : "Unified model")
    : law.regs
      ? (ar ? "اللائحة التنفيذية" : "Implementing Regs")
      : law.decisionId
        ? (ar ? "قرار وزاري" : "Ministerial decision")
        : (ar ? "نظام العمل" : "Labour Law");
  const lede = isModel
    ? (ar ? `النص من ${MODEL_SOURCE_AR}.` : `Text from ${MODEL_SOURCE_EN}.`)
    : law.regs
      ? (ar ? "النص الكامل في ملف الوزارة الرسمي." : "The full text is in the ministry's official file.")
      : law.decisionId
        ? (ar ? "النص الرسمي، وتحته ما تطبّقه المنصة منه." : "The official text, and below it what the platform applies.")
        : (ar ? "كما هو منشور في هيئة الخبراء." : "As published by the Bureau of Experts.");
  const sourceLabel = isModel || law.regs
    ? (ar ? "اللائحة التنفيذية وملحقاتها (PDF)" : "Implementing regulations and annexes (PDF)")
    : law.decisionId === "3337"
      ? (ar ? "صورة القرار الموقّعة (PDF)" : "Signed decision (PDF)")
      : (ar ? "النص في هيئة الخبراء" : "BOE official text");
  const blocks = statuteBlocks(body);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={ar ? "rtl" : "ltr"} className="font-body max-h-[85vh] overflow-y-auto sm:max-w-xl" style={{ padding: 0, gap: 0, borderRadius: 12 }}>
        <DialogHeader className={ar ? "text-right sm:text-right" : "text-left"} style={{ padding: "20px 22px 14px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", gap: 6 }}>
          <span style={{ alignSelf: "flex-start", marginRight: ar ? 34 : 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: GREEN, background: "var(--nv-ok-soft)", border: "1px solid var(--nv-ok-line)", borderRadius: 999, padding: "2px 10px" }}>
            <NvIcon name="scale" size={12} inline={false} />
            {kind}
          </span>
          <DialogTitle className="font-heading" style={{ color: INK, fontSize: 19, lineHeight: 1.4 }}>{law.label}</DialogTitle>
          <DialogDescription style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>{lede}</DialogDescription>
        </DialogHeader>
        <div data-statute-body="1" style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {blocks.length ? blocks.map((block, i) => (
            block.kind === "reading" ? (
              <section key={i} style={{ borderRadius: 8, background: "var(--nv-soft, #F6F8FA)", border: "1px solid var(--nv-line2, #EEF2F7)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: GREEN }}>
                  <NvIcon name="check" size={13} inline={false} />
                  {ar ? "ما تطبّقه المنصة" : "What the platform applies"}
                </span>
                <p style={{ margin: 0, fontSize: 13.5, color: INK, lineHeight: 1.95 }}>{block.text}</p>
              </section>
            ) : (
              <section key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {block.head ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink2)" }}>{block.head}</span> : null}
                <p style={{ margin: 0, fontSize: 14.5, color: INK, lineHeight: 2.05, paddingInlineStart: 14, borderInlineStart: "3px solid var(--nv-ok-line)", whiteSpace: "pre-wrap" }}>{block.text}</p>
              </section>
            )
          )) : (
            <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
              {ar ? "النص الكامل في المصدر الرسمي أدناه." : "The full text is at the official source below."}
            </p>
          )}
        </div>
        <div style={{ padding: "12px 22px 16px", borderTop: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: MUTED }}>{ar ? "المصدر الرسمي" : "Official source"}</span>
          <a href={sourceHref} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card, #fff)", fontSize: 12, fontWeight: 600, color: GREEN, textDecoration: "none" }}>
            {sourceLabel}
            <span aria-hidden>{ar ? "↖" : "↗"}</span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Splits a statute body into readable blocks: «quoted official text», a model article (heading line +
 * text), and the platform's reading («ما تقرأه المنصة من هذا النص: …») as its own block.
 */
function statuteBlocks(body) {
  const READ = /^(ما تقرأه المنصة من هذا النص|ما تقرؤه المنصة من هذا النص|What the platform reads from it)\s*:\s*/;
  return String(body || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (READ.test(part)) return { kind: "reading", text: part.replace(READ, "") };
      const lines = part.split("\n");
      if (lines.length > 1 && /^(النموذج الموحد م|Model Art)/.test(lines[0])) {
        return { kind: "text", head: lines[0], text: lines.slice(1).join("\n") };
      }
      const text = part.replace(/^[«“]\s*/, "").replace(/\s*[»”]\.?$/, "");
      return { kind: "text", head: "", text };
    });
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
        {hint.ifNot || hint.action ? (
          <div style={row}>
            <span style={key}>{ifNotLabel}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", minWidth: 0 }}>
              {hint.ifNot ? <span style={{ fontSize: 12, lineHeight: 1.7, color: "var(--nv-ink2, var(--nv-ink))" }}>{hint.ifNot}</span> : null}
              <HintAction action={hint.action} ar={ar} onAction={onAction} onDone={() => setOpen(false)} />
            </span>
          </div>
        ) : null}
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
