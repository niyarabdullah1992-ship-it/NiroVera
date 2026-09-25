import React, { useState } from "react";
import { Link } from "react-router-dom";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { citeRule, explainRule } from "@/lib/laborRules";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { DS_RADIUS } from "@/lib/designSystem";
import { cardAwaitsNightConsent, nightConsentWaitCopy } from "@/lib/shiftWeek";
import LawGateStatusPill, { LawGateArticleBadge } from "@/components/shared/LawGateStatusPill";

export const DUTY_ALERT_DUE = "var(--nv-bad-fill)";
export const DUTY_ALERT_BLOCK = "var(--nv-bad-ink)";

const AR = { letterSpacing: 0 };

/** Quiet secondary action — underline, muted, not a primary CTA. */
export function dutyAlertActionStyle() {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 500,
    padding: "2px 0",
    border: "none",
    background: "transparent",
    color: MUTED,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
    textDecorationColor: "color-mix(in oklab, var(--nv-muted, #6B7280) 55%, transparent)",
    display: "inline-flex",
    alignItems: "center",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    ...AR,
  };
}

function dutyCardHasStatute(card) {
  if (!card) return false;
  if (card.decisionId) return true;
  if (String(card.ruleId || "").startsWith("hours.heat.")) return true;
  if (!card.ruleId) return false;
  if (citeRule(card.ruleId)?.article) return true;
  const row = explainRule(card.ruleId);
  return Boolean(row?.article || row?.source === "ministerial");
}

function dutyStatuteIds(card, heat) {
  const ids = [];
  for (const row of card?.items || []) {
    if (row?.ruleId && !ids.includes(row.ruleId)) ids.push(row.ruleId);
  }
  if (card?.ruleId && !ids.includes(card.ruleId)) ids.push(card.ruleId);
  if (heat && !ids.some((id) => String(id).startsWith("hours.heat."))) ids.push("hours.heat.startHour");
  return ids;
}

function dutyRequestsHref(card) {
  if (card?.requestsHref) return card.requestsHref;
  if (card?.gateId === "night_medical" || cardAwaitsNightConsent(card)) {
    return card.audience === "employee" ? "/app/requests" : "/app/requests/manage";
  }
  return "";
}

function dutyRequestsLabel(card, ar) {
  if (cardAwaitsNightConsent(card)) {
    return card.audience === "employee"
      ? (ar ? "أوافق أو أرفض العمل الليلي" : "Agree or refuse night work")
      : (ar ? "موافقة الليل في طلباتي — للموظف فقط" : "Night consent in Requests — worker only");
  }
  if (card?.gateId === "night_medical") {
    return ar ? "افتح لياقة ليلية في طلباتي" : "Open Night fitness in My Requests";
  }
  return ar ? "افتح القرار في طلباتي" : "Open the decision in My Requests";
}

/** Article code for LawGate badge — not the full «المادة ٩٨» sentence. */
function itemArticleCode(item, masthead) {
  const own = String(item?.instrument || "").trim();
  if (own && own !== masthead) {
    const digits = own.match(/\d[\d/.-]*/);
    if (digits) return digits[0];
  }
  if (item?.ruleId) {
    const cite = citeRule(item.ruleId);
    if (cite?.article) return String(cite.article);
  }
  if (item?.decisionId) return String(item.decisionId);
  return "";
}

function cardGateIds(card) {
  return [card?.gateId, ...(card?.items || []).map((row) => row.gateId)].filter(Boolean);
}

/**
 * Quiet person register inside حكم المنصة — soft card, not a second stamped document.
 * Name + status pill, compact alert rows, quiet secondary links. Arabic letter-spacing stays 0.
 */
export default function DutyStripAlertCard({
  card,
  ar = true,
  children,
  onApplyOrdinary,
  onNightRemedy,
  hideJudgment = false,
}) {
  const [readOpen, setReadOpen] = useState(false);
  const [cutOpen, setCutOpen] = useState(false);
  const [allowOpen, setAllowOpen] = useState(false);
  const [allowKind, setAllowKind] = useState("");
  const [allowAmount, setAllowAmount] = useState("");
  if (!card) return null;
  const block = card.level === "block";
  const heat = card.decisionId === "3337" || String(card.ruleId || "").startsWith("hours.heat.");
  const items = Array.isArray(card.items) ? card.items : [];
  const hasStatute = heat || dutyCardHasStatute(card);
  const statuteIds = items.length && card.ruleId
    ? [card.ruleId]
    : dutyStatuteIds(card, heat);
  const requestsHref = dutyRequestsHref(card);
  const fileHref = card.href && card.audience === "manager" && items.length ? card.href : "";
  const awaitConsent = cardAwaitsNightConsent(card);
  const gates = cardGateIds(card);
  const ordinaryApply = card.audience !== "employee"
    && typeof onApplyOrdinary === "function"
    && cardAwaitsNightConsent(card);
  const remedyApply = card.audience !== "employee"
    && typeof onNightRemedy === "function"
    && (gates.includes("night_compensate") || gates.includes("night_performer_comp"));
  const hasActions = hasStatute || children || requestsHref || fileHref || ordinaryApply || remedyApply;
  const personName = String(card.name || "").trim();
  const masthead = String(card.instrument || "").trim();
  const showName = Boolean(personName && card.audience === "manager");
  return (
    <article
      className="nv-duty-circular"
      data-glow={card.glow || (block ? "block" : "due")}
      data-gate={card.gateId || undefined}
      data-audience={card.audience || undefined}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        boxSizing: "border-box",
        padding: "11px 12px",
        border: "1px solid var(--nv-line, #E2E8F0)",
        borderRadius: DS_RADIUS,
        boxShadow: "none",
        background: "var(--nv-card, #fff)",
        color: NAVY,
        ...AR,
      }}
    >
      {showName ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong data-duty-name="1" style={{ fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.4, ...AR }}>
            {personName}
          </strong>
          <LawGateStatusPill status={block ? "blocked" : "waiting"} ar={ar} />
        </div>
      ) : card.subject ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, lineHeight: 1.45, ...AR }}>{card.subject}</span>
          <LawGateStatusPill status={block ? "blocked" : "waiting"} ar={ar} />
        </div>
      ) : (
        <LawGateStatusPill status={block ? "blocked" : "waiting"} ar={ar} />
      )}

      {items.length ? (
        <ul
          data-duty-items="1"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {items.map((item) => {
            const article = itemArticleCode(item, masthead);
            return (
              <li
                key={item.id}
                data-gate={item.gateId || undefined}
                dir={ar ? "rtl" : "ltr"}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                  padding: "6px 8px",
                  borderRadius: 10,
                  background: "var(--nv-inset, var(--nv-soft, #F7F8FA))",
                  border: "1px solid var(--nv-line, #E2E8F0)",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--nv-ink2, #334155)",
                    lineHeight: 1.55,
                    textAlign: ar ? "right" : "left",
                    ...AR,
                  }}
                >
                  {item.headline || item.title}
                </span>
                {article ? <LawGateArticleBadge article={article} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {card.headline ? (
            <strong style={{ fontSize: 13, fontWeight: 600, color: NAVY, lineHeight: 1.5, ...AR }}>{card.headline}</strong>
          ) : null}
          {card.body ? (
            <p style={{ margin: 0, fontSize: 12, color: NAVY, lineHeight: 1.7, ...AR }}>{card.body}</p>
          ) : null}
        </span>
      )}

      {!hideJudgment && card.judgment ? (
        <span data-judgment="1" style={{ fontSize: 11, fontWeight: 400, color: MUTED, lineHeight: 1.55, ...AR }}>
          {card.judgment}
        </span>
      ) : null}

      {card.footer ? (
        <span style={{ fontSize: 11, fontWeight: 400, color: MUTED, ...AR }}>{card.footer}</span>
      ) : null}

      {awaitConsent ? (
        <span data-night-consent-wait="1" style={{ fontSize: 12, color: NAVY, lineHeight: 1.65, ...AR }}>
          {nightConsentWaitCopy(ar, { audience: card.audience || "manager" })}
        </span>
      ) : null}

      {hasActions ? (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", paddingTop: 2 }}>
          {hasStatute ? (
            <button
              type="button"
              onClick={() => setReadOpen((v) => !v)}
              aria-expanded={readOpen}
              style={dutyAlertActionStyle()}
            >
              {readOpen ? (ar ? "اختصر النص" : "Show less") : (ar ? "اقرأ النص" : "Read the text")}
            </button>
          ) : null}
          {requestsHref ? (
            <Link to={requestsHref} style={dutyAlertActionStyle()}>
              {dutyRequestsLabel(card, ar)}
            </Link>
          ) : null}
          {fileHref ? (
            <Link to={fileHref} style={dutyAlertActionStyle()}>
              {ar ? "افتح الملف" : "Open the file"}
            </Link>
          ) : null}
          {ordinaryApply ? (
            <>
              <button type="button" onClick={() => onApplyOrdinary("morning")} style={dutyAlertActionStyle()}>
                {ar ? "صباحي" : "Morning"}
              </button>
              <button type="button" onClick={() => onApplyOrdinary("evening")} style={dutyAlertActionStyle()}>
                {ar ? "مسائي" : "Evening"}
              </button>
            </>
          ) : null}
          {remedyApply ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setAllowOpen((on) => !on);
                  setCutOpen(false);
                }}
                style={dutyAlertActionStyle()}
              >
                {ar ? "بدل" : "Allowance"}
              </button>
              {allowOpen ? (
                <>
                  <button type="button" onClick={() => setAllowKind("pay")} style={dutyAlertActionStyle()}>
                    {ar ? (allowKind === "pay" ? "أجر ✓" : "أجر") : (allowKind === "pay" ? "Pay ✓" : "Pay")}
                  </button>
                  <button type="button" onClick={() => setAllowKind("transport")} style={dutyAlertActionStyle()}>
                    {ar ? (allowKind === "transport" ? "نقل ✓" : "نقل") : (allowKind === "transport" ? "Transport ✓" : "Transport")}
                  </button>
                  {allowKind ? (
                    <>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="decimal"
                        value={allowAmount}
                        onChange={(event) => setAllowAmount(event.target.value)}
                        placeholder={ar ? "المبلغ ر.س" : "Amount SAR"}
                        aria-label={ar ? "مبلغ التعويض بالريال" : "Compensation amount in riyals"}
                        style={{
                          fontFamily: "inherit",
                          fontSize: 12,
                          fontWeight: 600,
                          width: 92,
                          padding: "2px 6px",
                          border: `1px solid ${BORDER}`,
                          background: SURFACE,
                          color: NAVY,
                          ...AR,
                        }}
                      />
                      <button
                        type="button"
                        disabled={!Number(allowAmount)}
                        onClick={() => onNightRemedy("allowance", { allowanceKind: allowKind, amount: Number(allowAmount) })}
                        style={{ ...dutyAlertActionStyle(), opacity: Number(allowAmount) ? 1 : 0.45 }}
                      >
                        {ar ? "سجّل" : "Record"}
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setCutOpen((on) => !on);
                  setAllowOpen(false);
                }}
                style={dutyAlertActionStyle()}
              >
                {ar ? "تقليص الساعات" : "Reduce hours"}
              </button>
              {cutOpen ? [1, 2, 3].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => onNightRemedy("reduce", { cutHours: hours })}
                  style={dutyAlertActionStyle()}
                >
                  {ar ? `−${hours}س` : `−${hours}h`}
                </button>
              )) : null}
              <button type="button" onClick={() => onNightRemedy("morning")} style={dutyAlertActionStyle()}>
                {ar ? "غيّر إلى صباحي" : "Change to morning"}
              </button>
              <button type="button" onClick={() => onNightRemedy("evening")} style={dutyAlertActionStyle()}>
                {ar ? "غيّر إلى مسائي" : "Change to evening"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {children ? (
        <div style={{ width: "100%" }}>{children}</div>
      ) : null}

      {readOpen && hasStatute ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
          {(statuteIds.length ? statuteIds : [card.ruleId || (heat ? "hours.heat.startHour" : undefined)]).map((ruleId) => (
            <LaborArticleCite
              key={ruleId || "statute"}
              ruleId={ruleId}
              ar={ar}
              showChip={false}
              showOfficial
              hideToggle
            />
          ))}
        </span>
      ) : null}
    </article>
  );
}
