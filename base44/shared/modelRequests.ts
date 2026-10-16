// deno-lint-ignore-file no-explicit-any
// Backend copy of src/lib/modelRequests.js — keep the two in step (scripts/test-model-requests.mjs).
/**
 * Requests the unified model work regulation (Annex 1 of decision 115921) gives the worker or puts on
 * the establishment, that had no home in طلباتي:
 *
 *   النموذج الموحد م9   — لا نقل يقتضي تغيير محل الإقامة بغير موافقة العامل كتابةً؛ وفي الضرورة العارضة
 *                          (حتى ثلاثين يوماً في السنة) تتحمل المنشأة تكاليف انتقاله وإقامته خلال تلك المدة.
 *   النموذج الموحد م12  — من نُقل إلى مكان يقتضي تغيير محل إقامته يستحق نفقات نقله ومن يعولهم شرعاً
 *                          المقيمين معه، بما فيها نفقات الإركاب ونقل الأمتعة، ما لم يكن النقل بناءً على رغبته.
 *   النموذج الموحد م24  — الانتداب خارج مقر العمل: وسائل النقل (أو مقابلها بموافقته)، مقابل السكن والطعام ما لم
 *                          تؤمّنه المنشأة، والبدل اليومي حسب درجة العامل — يُحدَّد في قرار الانتداب، ويُحتسب
 *                          من مغادرة مقر العمل إلى العودة.
 *   النموذج الموحد م46  — من حضر أو تبيّن أنه مستعد للعمل ولم يمنعه إلا سبب راجع إلى المنشأة فله أجر تلك المدة.
 *
 * Each claim feeds the wage run as a reimbursement (outside the wage, outside the Art. 93 cap); the
 * prevented day keeps the day paid. Pure: no store; the client copy is src/lib/modelRequests.js.
 */

export const RELOCATION_TYPE = "relocation_expenses";
export const MISSION_TYPE = "mission";
export const PREVENTED_TYPE = "employer_prevented";
export const MODEL_REQUEST_TYPES = [RELOCATION_TYPE, MISSION_TYPE, PREVENTED_TYPE];

/** What a residence-changing transfer reimburses (model Art. 12); «stay» only for a necessity posting (Art. 9/2). */
export const RELOCATION_ITEMS = [
  { key: "self", ar: "نفقات انتقال العامل", en: "The worker's travel" },
  { key: "family", ar: "نفقات انتقال من يعولهم شرعاً المقيمين معه", en: "Travel of dependants living with him" },
  { key: "tickets", ar: "نفقات الإركاب (التذاكر)", en: "Tickets" },
  { key: "belongings", ar: "نفقات نقل الأمتعة", en: "Moving belongings" },
  { key: "stay", ar: "الإقامة خلال مدة التكليف المؤقت", en: "Stay during the temporary posting", necessityOnly: true },
];

const APPROVED = new Set(["approved", "signed"]);
const LIVE = new Set(["pending", "pending_manager", "open", "approved", "signed"]);

const dateOnly = (v: unknown): string => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};
const money = (v: unknown): number => Math.round((Number(v) || 0) * 100) / 100;

function dayCount(from: unknown, to: unknown) {
  const a = dateOnly(from);
  const b = dateOnly(to);
  if (!a || !b || b < a) return 0;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
}

const fail = (error: string, reason: string, reasonEn: string, extra: Record<string, unknown> = {}): any => ({ ok: false, error, reason, reasonEn, ...extra });

/* ───────────────────────── model Arts. 9 / 12 — relocation expenses ───────────────────────── */

/** Transfers on the file that change the residence (consented) or post him away for a necessity. */
export function residenceTransfers(employee: any) {
  return (employee?.stationTransfers || []).filter((row: any) => row && !row.voidedAt && (row.residence === "change" || row.residence === "necessity"));
}

/**
 * The worker claims the expenses of a transfer that changed his residence. Blocked, with the reason
 * named, when no such transfer is on the file, when the move was his own wish, or when it is claimed
 * twice. Amounts are per item; the total is what HR approves and the run reimburses.
 */
export function checkRelocationClaimGate({ employee, transferId, items = {}, otherRequests }: any = {}) {
  const transfers = residenceTransfers(employee);
  if (!transfers.length) {
    return fail("RELOCATION_NO_TRANSFER",
      "لا نقل في ملفك يقتضي تغيير محل الإقامة — النفقات تُستحق عن هذا النقل وحده (النموذج الموحد م12).",
      "No transfer on your file changes your residence — the expenses are owed for such a move only (model Art. 12).");
  }
  const transfer = transfers.find((row: any) => String(row.id) === String(transferId || "")) || (transferId ? null : transfers[0]);
  if (!transfer) return fail("RELOCATION_TRANSFER_UNKNOWN", "اختر النقل الذي تطالب بنفقاته.", "Pick the transfer you claim for.");
  if (transfer.reasonCode === "employee_request") {
    return fail("RELOCATION_WORKER_WISH",
      "هذا النقل سُجّل بناءً على طلبك — لا تُستحق عنه نفقات النقل (النموذج الموحد م12).",
      "This transfer was recorded at your own request — no relocation expenses are owed (model Art. 12).");
  }
  const rows = otherRequests || employee?.otherRequests || [];
  if (rows.some((row: any) => row?.type === RELOCATION_TYPE && LIVE.has(row.status || "pending") && String(row.details?.transferId || "") === String(transfer.id))) {
    return fail("RELOCATION_ALREADY_CLAIMED", "طالبتَ بنفقات هذا النقل من قبل — تابع الطلب القائم.", "You already claimed this transfer — follow the open request.");
  }
  const necessity = transfer.residence === "necessity";
  const lines: Array<{ key: string; amount: number }> = [];
  for (const item of RELOCATION_ITEMS) {
    const raw = items?.[item.key];
    if (raw == null || raw === "") continue;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return fail("RELOCATION_AMOUNT_INVALID", `المبلغ في «${item.ar}» غير صحيح.`, `The amount under "${item.en}" is invalid.`);
    if (amount === 0) continue;
    if (item.necessityOnly && !necessity) {
      return fail("RELOCATION_STAY_NOT_OWED", "الإقامة تُحمَّل على المنشأة في التكليف المؤقت للضرورة فقط (النموذج الموحد م9/2).", "The stay is borne by the company only on a temporary necessity posting (model Art. 9(2)).");
    }
    lines.push({ key: item.key, amount: money(amount) });
  }
  const total = money(lines.reduce((sum: number, row: any) => sum + row.amount, 0));
  if (!(total > 0)) return fail("RELOCATION_AMOUNT_REQUIRED", "اكتب مبلغ بند واحد على الأقل.", "Enter the amount of at least one item.");
  return {
    ok: true,
    transferId: transfer.id,
    basis: necessity ? "model9_2" : "model12",
    effectiveDate: dateOnly(transfer.effectiveDate),
    lines,
    total,
  };
}

/* ───────────────────────── model Art. 24 — secondment (الانتداب) ───────────────────────── */

export function missionDays(from: unknown, to: unknown) {
  return dayCount(from, to);
}

/**
 * The manager assigns a mission (قرار الانتداب). The decision must carry what Art. 24 lists:
 * transport (or its cash with the worker's consent), lodging and food (or their cost), and the daily
 * allowance by grade. The sum is paid with the wage of the month the mission ends.
 */
export function checkMissionGate({
  employee,
  actorId,
  from,
  to,
  destination,
  dailyRate,
  transportProvided = true,
  transportCost = 0,
  transportConsent = false,
  lodgingProvided = true,
  lodgingPerDay = 0,
  otherRequests,
}: any = {}) {
  if (!employee?.id) return fail("EMPLOYEE_REQUIRED", "اختر الموظف المنتدب.", "Pick the worker.");
  if (actorId && String(actorId) === String(employee.id)) {
    return fail("MISSION_SELF", "الانتداب قرار من المنشأة — لا ينتدب أحد نفسه.", "A mission is the company's decision — nobody assigns himself.");
  }
  if (String(destination || "").trim().length < 2) return fail("MISSION_DESTINATION_REQUIRED", "اكتب جهة الانتداب ومكانه.", "Write where the mission is.");
  const a = dateOnly(from);
  const b = dateOnly(to);
  if (!a || !b) return fail("MISSION_DATES_REQUIRED", "حدّد تاريخ المغادرة وتاريخ العودة.", "Set the departure and return dates.");
  if (b < a) return fail("MISSION_DATES_INVALID", "تاريخ العودة يسبق تاريخ المغادرة.", "The return date is before the departure date.");
  const rate = Number(dailyRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return fail("MISSION_RATE_REQUIRED",
      "حدّد البدل اليومي للانتداب حسب درجة العامل وفق فئات المنشأة (النموذج الموحد م24/3).",
      "Set the daily mission allowance by the worker's grade per the company's categories (model Art. 24(3)).");
  }
  if (!transportProvided) {
    if (!transportConsent) {
      return fail("MISSION_TRANSPORT_CONSENT",
        "تؤمّن المنشأة وسيلة النقل، ولا يُصرف مقابلها نقداً إلا بموافقة العامل (النموذج الموحد م24/1).",
        "The company provides the transport; cash in its place needs the worker's consent (model Art. 24(1)).");
    }
    if (!(Number(transportCost) > 0)) return fail("MISSION_TRANSPORT_COST", "اكتب مقابل النقل المصروف.", "Enter the transport cash.");
  }
  if (!lodgingProvided && !(Number(lodgingPerDay) > 0)) {
    return fail("MISSION_LODGING_COST",
      "لم تؤمّن المنشأة السكن والطعام — اكتب مقابلهما اليومي (النموذج الموحد م24/2).",
      "The company does not provide lodging and food — enter their daily cost (model Art. 24(2)).");
  }
  const rows = otherRequests || employee?.otherRequests || [];
  const clash = rows.find((row: any) => row?.type === MISSION_TYPE && LIVE.has(row.status || "pending")
    && dateOnly(row.details?.from) <= b && dateOnly(row.details?.to) >= a);
  if (clash) {
    return fail("MISSION_OVERLAP", `انتداب قائم يتداخل مع هذه المدة (${dateOnly(clash.details?.from)} — ${dateOnly(clash.details?.to)}).`, "An open mission overlaps these dates.");
  }
  const days = dayCount(a, b);
  const allowance = money(days * rate);
  const lodging = lodgingProvided ? 0 : money(days * Number(lodgingPerDay));
  const transport = transportProvided ? 0 : money(transportCost);
  return { ok: true, from: a, to: b, days, allowance, lodging, transport, total: money(allowance + lodging + transport) };
}

/* ───────────────────────── model Art. 46 — prevented by the establishment ───────────────────────── */

/** A manager records that the establishment kept a present, ready worker from working that day. */
export function checkEmployerPreventedGate({ employee, actorId, date, reason, today, otherRequests }: any = {}) {
  if (!employee?.id) return fail("EMPLOYEE_REQUIRED", "اختر الموظف.", "Pick the worker.");
  if (actorId && String(actorId) === String(employee.id)) {
    return fail("PREVENTED_SELF", "يسجّله المدير — لا يُسجَّل على الملف من صاحبه.", "A manager records it — not on the actor's own file.");
  }
  const day = dateOnly(date);
  if (!day) return fail("PREVENTED_DATE_REQUIRED", "حدّد اليوم.", "Set the day.");
  const now = dateOnly(today) || new Date().toISOString().slice(0, 10);
  if (day > now) return fail("PREVENTED_FUTURE", "لا يُسجَّل منع ليوم لم يأتِ.", "A future day cannot be recorded.");
  if (String(reason || "").trim().length < 8) {
    return fail("PREVENTED_REASON_REQUIRED",
      "اكتب السبب الراجع إلى المنشأة الذي منع العامل الحاضر المستعد من العمل (النموذج الموحد م46).",
      "Write the company-side cause that kept the present, ready worker from working (model Art. 46).");
  }
  const rows = otherRequests || employee?.otherRequests || [];
  if (rows.some((row: any) => row?.type === PREVENTED_TYPE && LIVE.has(row.status || "approved") && dateOnly(row.date) === day)) {
    return fail("PREVENTED_DUPLICATE", "هذا اليوم مسجّل من قبل.", "This day is already recorded.");
  }
  return { ok: true, date: day };
}

/** Days in `month` (YYYY-MM) the establishment prevented the worker — paid, never absence. */
export function preventedDaysInMonth(employee: any, month: unknown) {
  const prefix = `${String(month || "").slice(0, 7)}-`;
  const days = new Set<string>();
  for (const row of employee?.otherRequests || []) {
    if (row?.type !== PREVENTED_TYPE || !APPROVED.has(row.status || "")) continue;
    const day = dateOnly(row.date);
    if (day.startsWith(prefix)) days.add(day);
  }
  return days;
}

/* ───────────────────────── feed to the wage run ───────────────────────── */

/** The month an approved claim is paid in: a mission with the month it ends; relocation with its approval. */
export function reimbursementMonth(row: any) {
  if (row?.type === MISSION_TYPE) return dateOnly(row.details?.to).slice(0, 7);
  return (dateOnly(row?.approvedAt) || dateOnly(row?.reviewedAt) || dateOnly(row?.date)).slice(0, 7);
}

/** Approved relocation and mission sums for one month — a reimbursement line, outside the wage. */
export function expenseRefundsForMonth(employee: any, month: unknown) {
  const key = String(month || "").slice(0, 7);
  const refs: Array<{ id: string; type: string; amount: number }> = [];
  for (const row of employee?.otherRequests || []) {
    if (![RELOCATION_TYPE, MISSION_TYPE].includes(row?.type) || !APPROVED.has(row.status || "")) continue;
    if (reimbursementMonth(row) !== key) continue;
    const amount = money(row.details?.total ?? row.amount);
    if (amount > 0) refs.push({ id: row.id, type: row.type, amount });
  }
  return { amount: money(refs.reduce((sum: number, row: any) => sum + row.amount, 0)), refs };
}

/** The server/raise check for any of the three types — one entry point for submitOther. */
export function checkModelRequestSubmit(request: any, employee: any, { actorId, today }: any = {}) {
  const type = request?.type;
  const d = request?.details || {};
  // The page sends the form (items / transportCost); a stored or synced row carries the normalised figures.
  if (type === RELOCATION_TYPE) {
    const items = d.items || Object.fromEntries((d.lines || []).map((l: any) => [l.key, l.amount]));
    return checkRelocationClaimGate({ employee, transferId: d.transferId, items, otherRequests: (employee?.otherRequests || []).filter((row: any) => row?.id !== request.id) });
  }
  if (type === MISSION_TYPE) {
    return checkMissionGate({ employee, actorId, ...d, transportCost: d.transportCost ?? d.transport, otherRequests: (employee?.otherRequests || []).filter((row: any) => row?.id !== request.id) });
  }
  if (type === PREVENTED_TYPE) {
    return checkEmployerPreventedGate({ employee, actorId, date: request.date, reason: request.reason, today, otherRequests: (employee?.otherRequests || []).filter((row: any) => row?.id !== request.id) });
  }
  return { ok: true };
}
