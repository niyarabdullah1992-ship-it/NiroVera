import React, { useState } from "react";
import { citeLeaveType, citeRule, explainLeaveType, explainRule, formatRuleFigure, HRSD_IMPLEMENTING_REGS_URL } from "@/lib/laborRules";
import { articleOfficialText, BOE_LABOUR_LAW_URL } from "@/lib/laborArticleTexts";
import { decision18632Gist, decision18632RightsNote } from "@/lib/decision18632";
import {
  HEAT_BAN_DECISION_PDF,
  heatBanDecisionDutiesNote,
  heatBanDecisionGist,
  heatBanDecisionTitle,
  isHeatBanRuleId,
} from "@/lib/heatBanDecision";
import { leaveCiteRuleId } from "@/lib/leaveTypes";
import { MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";
import StatutoryItem from "@/components/labor/StatutoryItem";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function QuietProductNote({ ar }) {
  return (
    <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
      {ar ? "قرار تشغيلي — بلا مادة في نظام العمل." : "Operational decision — no Labour Law article."}
    </p>
  );
}

function OfficialStatuteBlock({ title, body, rest, ar, link }) {
  const [open, setOpen] = useState(false);
  const full = rest ? `${body}\n\n${rest}` : body;
  if (!body) return null;
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        minWidth: 0,
        maxWidth: "min(100%, 28rem)",
        width: "100%",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          fontFamily: "inherit",
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 0",
          border: "none",
          background: "transparent",
          color: NAVY,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        {open ? (ar ? "اختصر النص" : "Show less") : (ar ? "اقرأ النص" : "Read the text")}
      </button>
      {open ? (
        <div
          style={{
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            background: SURFACE,
            border: "1px solid var(--nv-line)",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: NAVY }}>
            {title}
          </span>
          <p style={{ margin: 0, fontSize: 12, color: NAVY, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {full}
          </p>
          {link?.href ? (
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {link.label}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Labour Law article for a rule that actually fired.
 * The chip is a button: press it to read the official BOE article text.
 * `showOfficial` keeps the statute available on the card — collapsed until «اقرأ النص».
 * Chip only when source is labour. `showText` prints the operational encoding
 * (or the operational note for GOSI/WPS/product — never a fake المادة).
 */
export default function LaborArticleCite({
  ruleId,
  leaveType,
  profile,
  cite,
  article: articleProp,
  decisionId: decisionProp,
  productOnly = false,
  onDate,
  ar = true,
  showText = false,
  showOfficial = false,
  tone,
  entitlement,
  block,
  warn,
  glow = "off",
  showChip = true,
}) {
  const [open, setOpen] = useState(false);
  const appliedId = ruleId || (leaveType ? leaveCiteRuleId(leaveType, profile, onDate) : null);
  const labour = cite
    || (appliedId ? citeRule(appliedId, onDate) : null)
    || (leaveType ? citeLeaveType(leaveType, onDate) : null);
  const row = labour
    || (appliedId ? explainRule(appliedId, onDate) : null)
    || (leaveType ? explainLeaveType(leaveType, onDate) : null);
  const article = String(articleProp || row?.article || "").trim();
  const nightRule = String(appliedId || row?.id || "").startsWith("hours.night.");
  const decisionId = String(decisionProp || (nightRule || article === "18632" ? "18632" : "")).trim();
  const official = article && article !== "18632" ? articleOfficialText(article, onDate) : null;
  const statute = official ? (ar ? official.ar : official.en) : "";
  const gist = decisionId === "18632" ? decision18632Gist(ar) : "";
  const rights = decisionId === "18632" ? decision18632RightsNote(ar) : "";
  // No article names the banned hours — decision 3337 does. So the decision text leads,
  // and the article it was issued on follows, labelled as the basis rather than as the ban.
  const heatRule = isHeatBanRuleId(appliedId || row?.id);
  const heatGist = heatRule ? heatBanDecisionGist(ar, onDate) : "";
  const officialBody = heatGist || statute || gist;
  const officialRest = heatRule
    ? [
      heatBanDecisionDutiesNote(ar),
      statute
        ? `${ar ? `سند القرار — نص المادة ${article}:` : `The decision's basis — Art. ${article}:`}\n${statute}`
        : "",
    ].filter(Boolean).join("\n\n")
    : (statute ? "" : (rights && rights !== gist ? rights : ""));
  const canRead = Boolean(article && article !== "18632");
  const hasStatute = Boolean(officialBody);
  const isProduct = productOnly || (!canRead && !decisionId && (Boolean(leaveType) || Boolean(row) || !row));

  if (!row && !article && !decisionId) {
    if (showOfficial && (productOnly || leaveType)) return <QuietProductNote ar={ar} />;
    return null;
  }

  const labelAr = row?.labelAr || (article ? `المادة ${article}` : (decisionId ? `قرار ${decisionId}` : ""));
  const labelEn = row?.labelEn || (article ? `Art. ${article}` : (decisionId ? `Decision ${decisionId}` : ""));
  const encoding = ar ? (row?.hintAr || "") : (row?.hintEn || "");
  const chipProps = {
    article: canRead ? article : undefined,
    source: row?.source || (decisionId ? "ministerial" : (canRead ? "labour" : undefined)),
    decisionId: decisionId || undefined,
    ruleId: appliedId || row?.id,
    leaveType,
    ar,
    tone,
    entitlement,
    block,
    warn,
    glow,
    compact: true,
    label: ar ? labelAr : labelEn,
  };
  const chip = canRead ? (
    <StatutoryItem
      {...chipProps}
      as="button"
      onClick={() => setOpen(true)}
      title={ar ? "اقرأ نص المادة" : "Read the article text"}
    />
  ) : null;
  const badge = !canRead && (labelAr || decisionId) ? <StatutoryItem {...chipProps} /> : null;
  const reader = canRead ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir={ar ? "rtl" : "ltr"} className="font-body max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className={ar ? "pr-8 text-right sm:text-right" : "pr-8 text-left"}>
          <DialogTitle className="font-heading" style={{ color: NAVY }}>
            {ar ? labelAr : labelEn}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "نص المادة من نظام العمل كما هو منشور في هيئة الخبراء. المصدر الرسمي للنص، لا الترميز التشغيلي في المنصة."
              : "The article text from the Labour Law as published by the Bureau of Experts. This is the official wording, not the product encoding."}
          </DialogDescription>
        </DialogHeader>
        {statute ? (
          <p style={{ margin: 0, fontSize: 14, color: NAVY, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{statute}</p>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: NAVY, lineHeight: 1.8 }}>
            {encoding || (ar ? "النص الرسمي لهذه المادة غير محمّل بعد." : "Official text for this article is not loaded yet.")}
          </p>
        )}
        {encoding && statute ? (
          <div style={{ borderTop: "1px solid var(--nv-line)", paddingTop: 12 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: MUTED }}>
              {ar ? "ما تطبّقه المنصة" : "What the platform applies"}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>{encoding}</p>
          </div>
        ) : null}
        {row?.value != null && row?.unit ? (
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
            {ar ? "الرقم الساري:" : "In-force figure:"}{" "}
            <span>{formatRuleFigure(row.value, row.unit, ar)}</span>
          </p>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a
            href={official?.sourceUrl || BOE_LABOUR_LAW_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 32,
              padding: "0 12px",
              borderRadius: 10,
              background: NAVY_FILL,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {ar ? "النص في هيئة الخبراء" : "BOE official text"}
          </a>
          <a
            href={HRSD_IMPLEMENTING_REGS_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 32,
              padding: "0 12px",
              borderRadius: 10,
              border: "1px solid var(--nv-line)",
              color: NAVY,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {ar ? "اللائحة التنفيذية (PDF)" : "Implementing regulations (PDF)"}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;
  const mark = showChip ? (chip || badge) : null;
  // For the sun ban the decision box already carries the wording, the basis and the
  // employer duty, so printing the operational encoding under it repeats the same paragraph.
  const heatEssayDuplicates = heatRule && showOfficial && hasStatute;
  const essay = showText && encoding && !heatEssayDuplicates ? (
    <p style={{ margin: 0, fontSize: 12, color: canRead ? NAVY : MUTED, lineHeight: 1.7, textWrap: "pretty", maxWidth: "100%" }}>
      {encoding}
    </p>
  ) : null;
  const officialBlock = showOfficial && hasStatute ? (
    <OfficialStatuteBlock
      title={heatRule
        ? heatBanDecisionTitle(ar)
        : (ar
          ? (canRead ? `نص ${labelAr}` : `نص قرار ${decisionId}`)
          : (canRead ? `${labelEn} — official text` : `Decision ${decisionId} — official gist`))}
      body={officialBody}
      rest={officialRest}
      ar={ar}
      link={heatRule
        ? { href: HEAT_BAN_DECISION_PDF, label: ar ? "صورة القرار الموقّعة (PDF)" : "Signed decision scan (PDF)" }
        : null}
    />
  ) : (showOfficial && isProduct && !hasStatute ? <QuietProductNote ar={ar} /> : null);
  if (!mark && !essay && !officialBlock) return reader || null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {mark}
      {reader}
      {officialBlock}
      {essay}
    </div>
  );
}
