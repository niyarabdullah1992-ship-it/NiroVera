// deno-lint-ignore-file no-explicit-any
/**
 * Backend copy of the Art. 79 bis parts of src/lib/exitRequests.js — resignation state, postponement,
 * withdrawal and deemed acceptance. Keep in step with the frontend (scripts/test-cloud-parity.mjs).
 */
import { ruleValue } from "./laborRules.ts";

export const RESIGNATION_TYPE = "resignation";

/** The law asks no reason for a resignation — the field is there for the worker, never required. */
export const RESIGNATION_REASON_HINT_AR = "اختياري — لا يُشترط ذكر سبب للاستقالة";
export const RESIGNATION_REASON_HINT_EN = "Optional — a resignation needs no reason";

/**
 * Which law ends the contract when the worker leaves:
 *  - "notice75": an open-ended (غير محدد المدة) contract — Art. 74(3) + Art. 75: the worker ends it by
 *    written notice (30 days on a monthly wage), no acceptance needed; it ends when the notice runs out.
 *  - "resignation79bis": a fixed-term contract — Art. 1 defines resignation for a fixed-term contract;
 *    Art. 79 bis: accepted, deemed accepted after 30 days, or postponed up to 60.
 * An empty contract type keeps the Art. 79 bis flow (the file must say open-ended for Art. 75).
 */
export const EXIT_ROUTE_NOTICE75 = "notice75";
export const EXIT_ROUTE_79BIS = "resignation79bis";

export function resignationRouteFor(profile: any) {
  const raw = String(profile?.contractType || profile?.contract?.type || "").trim().toLowerCase();
  if (["indefinite", "unlimited", "open", "open-ended", "غير محدد المدة"].includes(raw)) return EXIT_ROUTE_NOTICE75;
  return EXIT_ROUTE_79BIS;
}

function isNotice75(row: any) {
  return row?.exitRoute === EXIT_ROUTE_NOTICE75;
}

function addDays(key: any, n: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || "").slice(0, 10));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: any, b: any) {
  const pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(a || "").slice(0, 10));
  const pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b || "").slice(0, 10));
  if (!pa || !pb) return null;
  return Math.round((new Date(+pb[1], +pb[2] - 1, +pb[3]).getTime() - new Date(+pa[1], +pa[2] - 1, +pa[3]).getTime()) / 86400000);
}

/** Dates that follow from a resignation submitted on `date` with last working day `lastDay`. */
export function resignationFacts({ date, lastDay, route }: any = {}) {
  const notice = Number(ruleValue("contract.notice.workerMonthlyDays", date)) || 30;
  const accept = Number(ruleValue("contract.resignation.autoAcceptDays", date)) || 30;
  const withdraw = Number(ruleValue("contract.resignation.withdrawDays", date)) || 7;
  const postpone = Number(ruleValue("contract.resignation.postponeMaxDays", date)) || 60;
  const noticeDays = daysBetween(date, lastDay);
  return {
    noticeNeed: notice,
    noticeDays,
    noticeShort: noticeDays != null && noticeDays < notice,
    deemedAcceptedOn: route === EXIT_ROUTE_NOTICE75 ? "" : addDays(date, accept),
    withdrawUntil: route === EXIT_ROUTE_NOTICE75 ? "" : addDays(date, withdraw),
    postponeMax: route === EXIT_ROUTE_NOTICE75 ? 0 : postpone,
    noticeEndsOn: addDays(date, notice),
    route: route === EXIT_ROUTE_NOTICE75 ? EXIT_ROUTE_NOTICE75 : EXIT_ROUTE_79BIS,
  };
}


/**
 * Where a resignation stands on `today` under Art. 79 bis.
 *  - pending: within the first 30 days; the employer may accept, or postpone with a written reason.
 *  - postponed: acceptance postponed until `postponedUntil` (≤ 60 days from the explanation).
 *  - due: the 30 days (or the postponement) have run out — it is accepted by law.
 * The employer may not refuse it. The worker may withdraw within 7 days, unless already accepted.
 */
export function resignationState(row: any, today?: any) {
  const day = String(today || new Date().toISOString()).slice(0, 10);
  const submitted = String(row?.date || row?.createdAt || "").slice(0, 10);
  if (isNotice75(row)) {
    // Art. 75: written notice ends the open-ended contract when it runs out — nothing to accept or postpone.
    const n = resignationFacts({ date: submitted, route: EXIT_ROUTE_NOTICE75 });
    const endsOn = String(row?.lastDay || "").slice(0, 10) || n.noticeEndsOn;
    let stage = "notice";
    if (["withdrawn", "rejected"].includes(row?.status)) stage = row.status;
    else if (day >= endsOn) stage = row?.status === "approved" && row?.settledAt ? "accepted" : "due";
    else if (row?.status === "approved") stage = "acknowledged";
    return { stage, submitted, deemedAcceptedOn: "", endsOn, postponedUntil: "", canPostpone: false, postponeMax: 0, withdrawUntil: "", canWithdraw: false, route: EXIT_ROUTE_NOTICE75 };
  }
  const f = resignationFacts({ date: submitted });
  const postponedUntil = String(row?.postponedUntil || "").slice(0, 10);
  const accepted = row?.status === "approved";
  let stage = "pending";
  if (accepted) stage = "accepted";
  else if (["withdrawn", "rejected"].includes(row?.status)) stage = row.status;
  else if (postponedUntil) stage = day >= postponedUntil ? "due" : "postponed";
  else if (f.deemedAcceptedOn && day >= f.deemedAcceptedOn) stage = "due";
  return {
    stage,
    submitted,
    deemedAcceptedOn: f.deemedAcceptedOn,
    endsOn: postponedUntil || f.deemedAcceptedOn,
    postponedUntil,
    canPostpone: stage === "pending" && !postponedUntil && !!f.deemedAcceptedOn && day < f.deemedAcceptedOn,
    postponeMax: f.postponeMax,
    withdrawUntil: f.withdrawUntil,
    canWithdraw: (stage === "pending" || stage === "postponed") && !!f.withdrawUntil && day <= f.withdrawUntil,
  };
}

/** Postponing acceptance: before the 30 days end, a written reason, up to 60 days from today (the explanation date). */
export function checkPostponeResignationGate({ row, days, reason, today }: any = {}) {
  const st = resignationState(row, today);
  if (isNotice75(row)) {
    return { ok: false, error: "NOTICE75_NO_POSTPONE", reason: "موقوف — العقد غير محدد المدة ينتهي بإشعار العامل الكتابي عند انقضاء مهلته (المادة 75)؛ لا قبول ولا تأجيل فيه.", reasonEn: "Blocked — an open-ended contract ends on the worker's written notice when it runs out (Art. 75); there is no acceptance or postponement." };
  }
  if (!st.canPostpone) {
    return {
      ok: false,
      error: "POSTPONE_CLOSED",
      reason: st.postponedUntil
        ? "أُجّل القبول من قبل — لا يُؤجَّل مرة ثانية (المادة 79 مكرر)."
        : `انتهت مدة الثلاثين يوماً (${st.deemedAcceptedOn}) — الاستقالة مقبولة نظاماً ولا تُؤجَّل (المادة 79 مكرر).`,
      reasonEn: "Postponement is closed — Art. 79 bis allows it once, before the 30 days end.",
    };
  }
  const n = Math.floor(Number(days));
  if (!(n >= 1 && n <= st.postponeMax)) {
    return { ok: false, error: "POSTPONE_DAYS", reason: `مدة التأجيل من يوم إلى ${st.postponeMax} يوماً (المادة 79 مكرر).`, reasonEn: `Postpone 1 to ${st.postponeMax} days (Art. 79 bis).` };
  }
  if (String(reason || "").trim().length < 10) {
    return { ok: false, error: "POSTPONE_REASON", reason: "اكتب إيضاحاً مسبباً يوضح مصلحة العمل — يُسلَّم للعامل مكتوباً (المادة 79 مكرر).", reasonEn: "Write the reason (work interest) — it is given to the worker in writing (Art. 79 bis)." };
  }
  const day = String(today || new Date().toISOString()).slice(0, 10);
  return { ok: true, until: addDays(day, n), days: n };
}

export function checkWithdrawResignationGate(row: any, today?: any) {
  const st = resignationState(row, today);
  if (st.canWithdraw) return { ok: true };
  if (isNotice75(row)) {
    return { ok: false, error: "NOTICE75_WITHDRAW", reason: "إشعار إنهاء العقد غير محدد المدة لا يُسحب بإرادة العامل وحده بعد وصوله — يلزم اتفاق صاحب العمل (المادة 75).", reasonEn: "A notice ending an open-ended contract is not withdrawn by the worker alone once delivered — the employer must agree (Art. 75)." };
  }
  return {
    ok: false,
    error: "WITHDRAW_CLOSED",
    reason: st.stage === "accepted"
      ? "قُبلت الاستقالة — لا يصح العدول بعد القبول (المادة 79 مكرر)."
      : `مضت سبعة أيام على تقديم الاستقالة (حتى ${st.withdrawUntil}) — لا يصح العدول بعدها إلا باتفاق مع صاحب العمل (المادة 79 مكرر).`,
    reasonEn: "Withdrawal is allowed only within 7 days of submitting and before acceptance (Art. 79 bis).",
  };
}

/** Resignations the law has accepted by `today`: [{ employeeId, requestId, endsOn, via }]. */
export function dueResignations(data: any, today?: any) {
  const out: any[] = [];
  for (const emp of data?.employees || []) {
    for (const row of emp.otherRequests || []) {
      if (row?.type !== RESIGNATION_TYPE) continue;
      // "revise" = a resignation the old screen "returned" to postpone — the 30 days still run on it.
      const notice = isNotice75(row);
      if (!["pending", "pending_manager", "under_review", "postponed", "revise"].includes(String(row.status || "pending")) && !(notice && row.status === "approved" && !row.settledAt)) continue;
      const st = resignationState(row, today);
      if (st.stage === "due") out.push({ employeeId: emp.id, requestId: row.id, endsOn: st.endsOn, via: notice ? "notice75" : st.postponedUntil ? "postponement" : "silence" });
    }
  }
  return out;
}
