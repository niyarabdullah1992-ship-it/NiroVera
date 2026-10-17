/**
 * «مظروف جديد» — the setup page and the field step, read as gates that name their gap, plus the
 * reminder schedule an envelope carries. Pure: no React, no store.
 *
 * The signing rules (order, retract windows, release) stay in multiSignDerivations; this file only
 * decides whether a setup may move on, whether the fields may be sent, which reminders are due, and
 * the one-line progress a list row shows.
 */
import { settledState } from "./multiSignDerivations.js";
import { signingTurn } from "./signingEnvelopes.js";

const DAY = 86400000;
export const ENVELOPE_MAX_RECIPIENTS = 100;
export const emailValid = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());

/** «التذكير»: how often each pending party is reminded automatically. 0 = only by hand. */
export const REMINDER_CHOICES = Object.freeze([
  { days: 0, ar: "يدوياً فقط", en: "By hand only", subAr: "تذكّر من القائمة متى شئت", subEn: "Remind from the list when you choose" },
  { days: 1, ar: "كل يوم", en: "Every day", subAr: "حتى يوقّع أو تنتهي الصلاحية", subEn: "Until they sign or the link expires" },
  { days: 2, ar: "كل يومين", en: "Every 2 days", subAr: "حتى يوقّع أو تنتهي الصلاحية", subEn: "Until they sign or the link expires" },
  { days: 3, ar: "كل 3 أيام", en: "Every 3 days", subAr: "حتى يوقّع أو تنتهي الصلاحية", subEn: "Until they sign or the link expires" },
  { days: 7, ar: "كل أسبوع", en: "Every week", subAr: "حتى يوقّع أو تنتهي الصلاحية", subEn: "Until they sign or the link expires" },
]);

/** «صلاحية الروابط»: days a signing link stays open. */
export const EXPIRY_CHOICES = Object.freeze([7, 14, 30, 60]);
export const DEFAULT_EXPIRY_DAYS = 30;

export function clampReminderDays(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? Math.min(30, n) : 0;
}

export function clampExpiryDays(value) {
  const n = Math.round(Number(value) || 0);
  return n >= 1 ? Math.min(90, n) : DEFAULT_EXPIRY_DAYS;
}

/** The parties who sign, in envelope order: you first when you sign too. */
export function envelopeSigners({ recipients = [], meSigns = false, me = null } = {}) {
  const others = (recipients || []).filter((row) => !row.isMe);
  return meSigns && me ? [{ ...me, isMe: true }, ...others] : others;
}

/**
 * The setup gate: documents, parties, subject. Returns { ok, mode: "self" | "group", reason, gaps[] }.
 * «self» = only you sign (your seal closes the file now); «group» = an envelope that is sent.
 */
export function checkEnvelopeSetupGate({
  docs = [],
  recipients = [],
  meSigns = false,
  me = null,
  subject = "",
  sealReady = false,
  canGroup = true,
  ar = true,
} = {}) {
  const gaps = [];
  const signers = envelopeSigners({ recipients, meSigns, me });
  const others = signers.filter((row) => !row.isMe);
  const mode = others.length ? "group" : "self";
  if (!(docs || []).length) gaps.push(ar ? "أضف مستنداً واحداً على الأقل" : "Add at least one document");
  if (!signers.length) gaps.push(ar ? "أضف مستلماً، أو اختر «أنا أيضاً أوقّع»" : "Add a recipient, or choose “I sign too”");
  if (mode === "self" && signers.length && !sealReady) gaps.push(ar ? "صمّم ختمك أولاً — توقيعك وحدك يُختم به" : "Design your seal first — signing alone uses it");
  if (others.length && !canGroup) gaps.push(ar ? "إرسال المظاريف لأصحاب صلاحية الإرسال" : "Sending envelopes needs the sending right");
  if (signers.length > ENVELOPE_MAX_RECIPIENTS) gaps.push(ar ? `الحد ${ENVELOPE_MAX_RECIPIENTS} مستلم` : `Up to ${ENVELOPE_MAX_RECIPIENTS} recipients`);
  const unnamed = others.filter((row) => !String(row.name || "").trim()).length;
  if (unnamed) gaps.push(ar ? "أكمل اسم كل مستلم" : "Complete each recipient’s name");
  const badEmail = others.filter((row) => !emailValid(row.email)).length;
  if (badEmail) gaps.push(ar ? "بريد صالح لكل مستلم" : "A valid email for each recipient");
  const emails = signers.map((row) => String(row.email || "").trim().toLowerCase()).filter(Boolean);
  if (new Set(emails).size !== emails.length) gaps.push(ar ? "بريد مكرر بين المستلمين" : "A repeated email between recipients");
  if (mode === "group" && !String(subject || "").trim()) gaps.push(ar ? "اكتب موضوع المظروف" : "Write the envelope subject");
  return {
    ok: gaps.length === 0,
    mode,
    signers,
    gaps,
    reason: gaps.length ? (ar ? `يبقى: ${gaps.join(" · ")}` : `Still needed: ${gaps.join(" · ")}`) : "",
  };
}

const isSealField = (field) => field?.tool === "seal";
const isSignatureField = (field) => field?.type === "signature";

/**
 * The field gate before sending: every party has a signature field; a party whose company stamp is
 * required has a «الختم» field. `signers[i].stamp` marks the requirement; `field.signer` is the index.
 */
export function checkEnvelopeFieldsGate({ signers = [], fields = [], ar = true } = {}) {
  const noSign = [];
  const noSeal = [];
  (signers || []).forEach((signer, index) => {
    const mine = (fields || []).filter((field) => field.signer === index);
    const name = signer.name || (ar ? `المستلم ${index + 1}` : `Recipient ${index + 1}`);
    if (!mine.some(isSignatureField)) noSign.push(name);
    if (signer.stamp && !mine.some(isSealField)) noSeal.push(name);
  });
  const gaps = [];
  if (noSign.length) gaps.push(ar ? `حقل توقيع لـ: ${noSign.join("، ")}` : `A signature field for: ${noSign.join(", ")}`);
  if (noSeal.length) gaps.push(ar ? `حقل «الختم» لـ: ${noSeal.join("، ")} (طُلب ختمه)` : `A stamp field for: ${noSeal.join(", ")} (stamp required)`);
  return {
    ok: gaps.length === 0,
    noSign,
    noSeal,
    gaps,
    reason: gaps.length ? (ar ? `يبقى: ${gaps.join(" · ")}` : `Still needed: ${gaps.join(" · ")}`) : "",
  };
}

function lastReminderFor(request, signer) {
  const email = String(signer?.email || "").toLowerCase();
  const times = (request?.auditTrail || [])
    .filter((event) => event?.type === "reminder_sent")
    .filter((event) => (email && String(event.targetEmail || "").toLowerCase() === email) || (!event.targetEmail && event.targetName && event.targetName === signer?.name))
    .map((event) => Date.parse(event.at || ""))
    .filter(Boolean);
  return times.length ? Math.max(...times) : 0;
}

/**
 * Reminders an envelope owes now: its creator set «التذكير» every N days; each party whose turn it
 * is (all pending in parallel, the first pending in sequence) and who was not reminded — or sent the
 * envelope — in the last N days is due. Closed, expired or unscheduled envelopes owe nothing.
 */
export function dueAutoReminders(request, now = Date.now()) {
  const every = clampReminderDays(request?.reminderEveryDays);
  if (!every || !request?.isCreator) return [];
  if (settledState(request, now).state !== "pending") return [];
  const expires = Date.parse(request?.expiresAt || "");
  if (expires && expires <= now) return [];
  const sent = Date.parse(request?.createdAt || "") || 0;
  return signingTurn(request)
    .map((index) => request.signers[index])
    .filter((signer) => signer?.email)
    .filter((signer) => {
      const last = Math.max(sent, lastReminderFor(request, signer));
      return last && now - last >= every * DAY;
    });
}

/** When the next automatic reminder falls, or null (none scheduled / nothing pending). */
export function nextAutoReminderAt(request, now = Date.now()) {
  const every = clampReminderDays(request?.reminderEveryDays);
  if (!every || settledState(request, now).state !== "pending") return null;
  const sent = Date.parse(request?.createdAt || "") || 0;
  const times = signingTurn(request)
    .map((index) => request.signers[index])
    .filter((signer) => signer?.email)
    .map((signer) => Math.max(sent, lastReminderFor(request, signer)) + every * DAY);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

/** «1 من 3 وقّعوا · بانتظار نورة» — the row's one line, derived from the stored signers. */
export function envelopeProgressLine(request, ar = true, now = Date.now()) {
  const signers = request?.signers || [];
  const total = signers.length;
  const signed = signers.filter((row) => row.status === "signed").length;
  const { state } = settledState(request, now);
  const head = ar ? `${signed} من ${total} وقّعوا` : `${signed} of ${total} signed`;
  if (state === "deleted") return ar ? `${head} · أُلغي` : `${head} · voided`;
  if (state === "rejected") return ar ? `${head} · رُفض` : `${head} · declined`;
  if (state === "completed_with_refusal") return ar ? `${head} · اكتمل مع رفض` : `${head} · complete with a refusal`;
  if (state === "completed") return ar ? `${head} · اكتمل` : `${head} · complete`;
  if (state === "awaiting_release") return ar ? `${head} · بانتظار تمرير المرسل` : `${head} · waiting for the sender’s release`;
  const turn = signingTurn(request).map((index) => signers[index]?.name).filter(Boolean);
  if (!turn.length) return head;
  const who = turn.length > 2 ? (ar ? `${turn.slice(0, 2).join("، ")} و${turn.length - 2} آخرين` : `${turn.slice(0, 2).join(", ")} +${turn.length - 2}`) : turn.join(ar ? "، " : ", ");
  return ar ? `${head} · بانتظار ${who}` : `${head} · waiting for ${who}`;
}
