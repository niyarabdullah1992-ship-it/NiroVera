/** Official wording already stored for the schedule and compliance surfaces.
 *  Labour articles come from the BOE text. Decision 3337 is its own paragraph.
 *  Decision 18632 is the verbatim medical sentences plus the catalog clauses.
 */

import { articleOfficialText } from "./laborArticleTexts.js";
import { explainRule } from "./laborRules.js";
import { DECISION_3337_TEXT_AR, DECISION_3337_TEXT_EN, heatBanDecisionLabel } from "./heatBanDecision.js";
import { NIGHT_MEDICAL_AVOID_QUOTE_AR, NIGHT_MEDICAL_TRANSFER_QUOTE_AR } from "./decision18632.js";

const NIGHT_CLAUSE_IDS = [
  "hours.night.startHour",
  "hours.night.endHour",
  "hours.night.workerHours",
  "hours.night.restHours",
  "hours.night.rotateWeeks",
  "hours.night.rotateOrdinaryWeeks",
  "hours.night.compensateOrReduce",
  "hours.night.pregnancyBanWeeks",
  "hours.night.incidentalYearDays",
  "hours.night.medicalYearMonths",
];

export function labourArticleBody(article, ar = true, onDate) {
  const official = articleOfficialText(article, onDate);
  if (!official) return "";
  return ar ? official.ar : official.en;
}

export function decision3337Body(ar = true) {
  return ar ? DECISION_3337_TEXT_AR : DECISION_3337_TEXT_EN;
}

export function decision3337Title(ar = true) {
  return heatBanDecisionLabel(ar);
}

/** Written clauses of Decision 18632 that the night gates already store. */
export function decision18632Body(ar = true, onDate) {
  const clauses = [];
  const seen = new Set();
  const push = (text) => {
    const line = String(text || "").trim();
    if (!line || seen.has(line)) return;
    seen.add(line);
    clauses.push(line);
  };
  if (ar) {
    push(NIGHT_MEDICAL_AVOID_QUOTE_AR);
    push(NIGHT_MEDICAL_TRANSFER_QUOTE_AR);
  }
  for (const id of NIGHT_CLAUSE_IDS) {
    const row = explainRule(id, onDate);
    push(ar ? row?.hintAr : row?.hintEn);
  }
  return clauses.join("\n\n");
}

export function decision18632Title(ar = true) {
  return ar ? "القرار الوزاري 18632 لسنة 1441هـ" : "Ministerial Decision 18632 of 1441 AH";
}
