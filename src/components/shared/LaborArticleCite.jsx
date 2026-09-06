import React, { useState } from "react";
import { citeLeaveType, citeRule, explainLeaveType, explainRule, HRSD_IMPLEMENTING_REGS_URL } from "@/lib/laborRules";
import { articleOfficialText, BOE_LABOUR_LAW_URL } from "@/lib/laborArticleTexts";
import { leaveCiteRuleId } from "@/lib/leaveTypes";
import { MUTED, NAVY, NAVY_FILL, tag } from "@/lib/platformStyles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Labour Law article for a rule that actually fired.
 * The chip is a button: press it to read the official BOE article text.
 * Chip only when source is labour. `showText` prints the operational encoding
 * (or the operational note for GOSI/WPS/product — never a fake المادة).
 */
export default function LaborArticleCite({
  ruleId,
  leaveType,
  profile,
  cite,
  onDate,
  ar = true,
  showText = false,
}) {
  const [open, setOpen] = useState(false);
  const appliedId = ruleId || (leaveType ? leaveCiteRuleId(leaveType, profile, onDate) : null);
  const labour = cite
    || (appliedId ? citeRule(appliedId, onDate) : null)
    || (leaveType ? citeLeaveType(leaveType, onDate) : null);
  const row = showText
    ? (labour
      || (appliedId ? explainRule(appliedId, onDate) : null)
      || (leaveType ? explainLeaveType(leaveType, onDate) : null))
    : labour;
  if (!row) return null;
  const labelAr = row.labelAr || (row.article ? `المادة ${row.article}` : "");
  const labelEn = row.labelEn || (row.article ? `Art. ${row.article}` : "");
  const encoding = ar ? (row.hintAr || "") : (row.hintEn || "");
  const official = row.article ? articleOfficialText(row.article, onDate) : null;
  const statute = official ? (ar ? official.ar : official.en) : "";
  const canRead = Boolean(row.article);
  const chip = canRead ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title={ar ? "اقرأ نص المادة" : "Read the article text"}
      style={{ ...tag("#F8FAFC", MUTED, "#E2E8F0"), cursor: "pointer", fontFamily: "inherit" }}
    >
      {ar ? labelAr : labelEn}
    </button>
  ) : null;
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
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 12 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: MUTED }}>
              {ar ? "ما تطبّقه المنصة" : "What the platform applies"}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>{encoding}</p>
          </div>
        ) : null}
        {row.value != null && row.unit ? (
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
            {ar ? "الرقم الساري:" : "In-force figure:"}{" "}
            <span dir="ltr">{row.value} {row.unit}</span>
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
              borderRadius: 8,
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
              borderRadius: 8,
              border: "1px solid #E2E8F0",
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
  if (!showText) {
    return (
      <>
        {chip}
        {reader}
      </>
    );
  }
  if (!chip && !encoding) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      {chip}
      {reader}
      {encoding ? (
        <p style={{ margin: 0, fontSize: 12, color: canRead ? NAVY : MUTED, lineHeight: 1.7, textWrap: "pretty" }}>
          {encoding}
        </p>
      ) : null}
    </div>
  );
}
