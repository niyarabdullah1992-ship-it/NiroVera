/**
 * «صحيفة الجزاءات» — unified model regulation Art. 69: each worker has a penalties record listing the
 * type of offence, the date it happened and the penalty imposed, kept in his service file.
 *
 * How the record and the old one-year «erase» setting (discipline.record.eraseDays) fit the texts:
 *   - Art. 69 keeps every penalty in the service file — nothing is ever deleted from the record.
 *   - Art. 61 (with Labour Law Art. 68 as the platform cites it): no increase on a repeat once 180
 *     days have passed since the worker was told of the previous penalty — that is the only time
 *     limit the texts put on a penalty's effect, and the repeat gate already applies it.
 *   - So eraseDays (never below the 180-day cooloff) only folds an old penalty in the worker's own
 *     «الجزاءات» list under «سوابق»; it stays in the record HR keeps, and has no effect on counting.
 * Pure (node-testable).
 */
import { ruleValue } from "./laborRules.js";

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};
function addDays(iso, n) {
  const d = dateOnly(iso);
  if (!d) return "";
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
function rule(id, day, fallback) {
  try { return Number(ruleValue(id, day)) || fallback; } catch { return fallback; }
}

/**
 * One sanction against the texts on `today`:
 *   inRecord — always (Art. 69) · countsForRepeat — inside the 180 days of Art. 61
 *   foldedForWorker — older than eraseDays: shown under «سوابق» in the worker's list, never hidden.
 */
export function sanctionRecordState(item, { today } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const cooloff = rule("discipline.repeat.cooloffDays", day, 180);
  const fold = Math.max(cooloff, rule("discipline.record.eraseDays", day, 365));
  const signed = dateOnly(item?.signedAt || item?.decidedAt);
  const told = signed || dateOnly(item?.notifiedAt);
  const repeatUntil = signed ? addDays(told, cooloff) : "";
  const foldOn = signed ? addDays(signed, fold) : "";
  return {
    inRecord: true,
    signed,
    repeatUntil,
    countsForRepeat: Boolean(signed && day <= repeatUntil),
    foldOn,
    foldedForWorker: Boolean(signed && day >= foldOn),
    cooloff,
    fold,
  };
}

/** The HR view of the record: signed penalties of one worker, newest first, with Art. 69's three fields. */
export function penaltiesRecordRows(cases = [], employeeId, { today, ar = true } = {}) {
  return (cases || [])
    .filter((item) => String(item?.employeeId) === String(employeeId || "") && dateOnly(item?.signedAt || item?.decidedAt))
    .map((item) => {
      const state = sanctionRecordState(item, { today });
      return {
        id: item.id,
        offence: String(item.regulationOffence || item.note || item.reason || "").trim(),
        occurredAt: dateOnly(item.discoveredAt || item.createdAt),
        penalty: (ar ? item.penaltyAr || item.penalty : item.penaltyEn || item.penalty) || "",
        signedAt: state.signed,
        repeat: state.countsForRepeat
          ? (ar ? `يُحتسب في التكرار حتى ${state.repeatUntil}` : `Counts for a repeat until ${state.repeatUntil}`)
          : (ar ? `مضى ${state.cooloff} يوماً — لا يُشدَّد به (م61)` : `${state.cooloff} days passed — no increase (Art. 61)`),
        state,
      };
    })
    .sort((a, b) => String(b.signedAt).localeCompare(String(a.signedAt)));
}
