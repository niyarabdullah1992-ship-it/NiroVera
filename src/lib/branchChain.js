/**
 * One escalation ladder per branch, read from the org (branch manager → up the line, or the branch's
 * own ladder when HR set one). المهام and صوت الموظف both read this — same chain, same people.
 */
import { branchEscalationCardLine } from "./orgDerivations.js";

/** The ladder as review tiers: label, the person who handles it, empty for a vacant seat. */
export function branchReviewTiers(data, stationId) {
  const line = branchEscalationCardLine(stationId, data) || [];
  return line.map((step, i) => {
    const name = String(step.name || "").trim();
    const title = String(step.title || "").trim();
    const labelAr = step.vacant ? `مقعد شاغر${title ? ` — ${title}` : ""}` : [name, title].filter(Boolean).join(" — ") || `المستوى ${i + 1}`;
    const labelEn = step.vacant ? `Vacant seat${title ? ` — ${title}` : ""}` : [name, title].filter(Boolean).join(" — ") || `Level ${i + 1}`;
    return {
      id: step.employeeId ? String(step.employeeId) : `vacant_${i}`,
      labelAr,
      labelEn,
      handlerIds: step.employeeId ? [String(step.employeeId)] : [],
      vacant: !!step.vacant,
      acting: !!step.acting,
    };
  });
}
