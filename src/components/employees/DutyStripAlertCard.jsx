import React, { useState } from "react";
import { Link } from "react-router-dom";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { citeRule, explainRule } from "@/lib/laborRules";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";
import { DS_CONTROL_RADIUS, DS_RADIUS } from "@/lib/designSystem";
import { cardAwaitsNightConsent, nightConsentWaitCopy } from "@/lib/shiftWeek";
import LawGateStatusPill, { LawGateArticleBadge } from "@/components/shared/LawGateStatusPill";
import NvIcon from "@/components/shared/NvIcon";
import { ArrowLeft, ArrowRight, BookOpen, ChevronUp } from "lucide-react";
import { sectionRoutesForCard } from "@/lib/sectionRoutes";

export const DUTY_ALERT_DUE = "var(--nv-bad-fill)";
export const DUTY_ALERT_BLOCK = "var(--nv-bad-ink)";

const AR = { letterSpacing: 0 };

/**
 * Card actions — institutional controls, not underlined text.
 * "quiet" (default): bordered secondary · "go": the section the decision belongs to (filled).
 */
export function dutyAlertActionStyle(kind = "quiet") {
  const go = kind === "go";
  return {
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    height: 30,
    boxSizing: "border-box",
    padding: "0 12px",
    borderRadius: DS_CONTROL_RADIUS,
    border: go ? `1px solid ${NAVY_FILL}` : `1px solid ${BORDER}`,
    background: go ? NAVY_FILL : CARD,
    color: go ? "#FFFFFF" : NAVY,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    lineHeight: 1,
    whiteSpace: "nowrap",
    ...AR,
  };
}

/** «في طلباتي ›» → «افتح في طلباتي»: a verb on the button, the arrow drawn as an icon. */
function sectionActionLabel(label, ar) {
  const clean = String(label || "").replace(/\s*[›‹]\s*$/, "").trim();
  if (ar && /^في\s/.test(clean)) return `افتح ${clean}`;
  if (!ar && /^In\s/.test(clean)) return `Open ${clean.slice(3)}`;
  return clean;
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
  row = false,
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
  // The fixed rule: each alert opens in its own section (طلباتي · السلامة), never the employee file.
  const sectionLinks = (() => {
    const routes = sectionRoutesForCard(card);
    const legacy = dutyRequestsHref(card);
    if (legacy && !routes.some((row) => row.section === "requests")) routes.unshift({ section: "requests", href: legacy });
    return routes.map((row) => {
      const nightRequest = row.section === "requests" && (cardAwaitsNightConsent(card) || row.gateId === "night_medical" || card.gateId === "night_medical");
      return { ...row, label: nightRequest || !row.ar ? dutyRequestsLabel(card, ar) : (ar ? row.ar : row.en) };
    });
  })();
  const awaitConsent = cardAwaitsNightConsent(card);
  const gates = cardGateIds(card);
  const ordinaryApply = card.audience !== "employee"
    && typeof onApplyOrdinary === "function"
    && cardAwaitsNightConsent(card);
  const remedyApply = card.audience !== "employee"
    && typeof onNightRemedy === "function"
    && (gates.includes("night_compensate") || gates.includes("night_performer_comp"));
  const hasActions = hasStatute || children || sectionLinks.length || ordinaryApply || remedyApply;
  const personName = String(card.name || "").trim();
  const masthead = String(card.instrument || "").trim();
  const showName = Boolean(personName && card.audience === "manager");
  /** Row chrome: 24px control-radius chips, hairline rows — one chip style across جدول الدوام. */
  const pillSkin = row ? { height: 24, boxSizing: "border-box", padding: "0 9px", borderRadius: DS_CONTROL_RADIUS, fontSize: 11, fontWeight: 600, lineHeight: 1 } : undefined;
  const badgeSkin = row ? { height: 24, minWidth: 34, borderRadius: DS_CONTROL_RADIUS } : undefined;
  const onDate = row && card.onDate ? String(card.onDate) : "";
  const statusPill = <LawGateStatusPill status={block ? "blocked" : "waiting"} ar={ar} style={pillSkin} />;
  return (
    <article
      className="nv-duty-circular"
      data-glow={card.glow || (block ? "block" : "due")}
      data-gate={card.gateId || undefined}
      data-audience={card.audience || undefined}
      data-row={row ? "1" : undefined}
      style={row ? {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 18px",
        borderBottom: "1px solid var(--nv-line2, #EEF2F7)",
        background: "transparent",
        color: NAVY,
        ...AR,
      } : {
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
          <strong data-duty-name="1" style={{ fontSize: row ? 12.5 : 14, fontWeight: 700, color: NAVY, lineHeight: 1.4, ...AR }}>
            {personName}
          </strong>
          {onDate ? <span dir="ltr" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: MUTED }}>{onDate}</span> : null}
          <span style={{ marginInlineStart: "auto" }}>{statusPill}</span>
        </div>
      ) : card.subject ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: row ? 12.5 : 13, fontWeight: 600, color: NAVY, lineHeight: 1.45, ...AR }}>{card.subject}</span>
          {onDate ? <span dir="ltr" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: MUTED }}>{onDate}</span> : null}
          <span style={{ marginInlineStart: "auto" }}>{statusPill}</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {onDate ? <span dir="ltr" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: MUTED }}>{onDate}</span> : null}
          <span style={{ marginInlineStart: "auto" }}>{statusPill}</span>
        </div>
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
                style={row ? {
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                  padding: "2px 0",
                } : {
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
                {row && article ? <LawGateArticleBadge article={article} style={badgeSkin} /> : null}
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
                {!row && article ? <LawGateArticleBadge article={article} /> : null}
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
        <div data-duty-actions="1" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 10, marginTop: 2, borderTop: `1px solid ${BORDER}` }}>
          {sectionLinks.map((link) => (
            <Link key={link.href} to={link.href} data-section-link={link.section} style={dutyAlertActionStyle("go")}>
              {sectionActionLabel(link.label, ar)}
              {ar ? <ArrowLeft size={14} aria-hidden /> : <ArrowRight size={14} aria-hidden />}
            </Link>
          ))}
          {hasStatute ? (
            <button
              type="button"
              data-read-statute="1"
              onClick={() => setReadOpen((v) => !v)}
              aria-expanded={readOpen}
              style={dutyAlertActionStyle()}
            >
              {readOpen ? <ChevronUp size={14} aria-hidden /> : <BookOpen size={14} aria-hidden />}
              {readOpen ? (ar ? "إخفاء النص" : "Hide the text") : (ar ? "اقرأ النص النظامي" : "Read the statute")}
            </button>
          ) : null}
          {children ? <span style={{ display: "contents" }}>{children}</span> : null}
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
                    {ar ? "أجر" : "Pay"}{allowKind === "pay" ? <> <NvIcon name="check" size={12} /></> : null}
                  </button>
                  <button type="button" onClick={() => setAllowKind("transport")} style={dutyAlertActionStyle()}>
                    {ar ? "نقل" : "Transport"}{allowKind === "transport" ? <> <NvIcon name="check" size={12} /></> : null}
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
              {/* One «change to ordinary hours» pair per card: when «صباحي / مسائي» already sits above, not twice. */}
              {ordinaryApply ? null : (
                <>
                  <button type="button" onClick={() => onNightRemedy("morning")} style={dutyAlertActionStyle()}>
                    {ar ? "غيّر إلى صباحي" : "Change to morning"}
                  </button>
                  <button type="button" onClick={() => onNightRemedy("evening")} style={dutyAlertActionStyle()}>
                    {ar ? "غيّر إلى مسائي" : "Change to evening"}
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
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
