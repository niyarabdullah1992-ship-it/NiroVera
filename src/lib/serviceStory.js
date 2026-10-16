/**
 * «قصة خدمتي» — the service story on ملفي: what happened on this file, when, who did it, and what
 * proves it. Pure. Every event is read from a record already on the file; nothing is typed here.
 *
 * Proof chip, from what the record actually carries:
 *   sealed — «مختوم»: a document hash is stored with it (contract signature, sealed sanction, certificate file)
 *   signed — «موقّع»: a dated signature or signed upload, without a stored hash
 *   ack    — «بإقرار»: the worker's own acknowledgement (work regulation, custody receipt, consent)
 *   log    — «من السجل»: written on the file log by the person named, nothing more
 *
 * Not here on purpose: leave, balances and injuries (طلباتي), pay slips (قسيمتي), generic field edits.
 */
import { CONTRACT_TYPE_OPTIONS, optionLabel } from "./employeeProfileFields.js";
import { faceOf, penaltyLabel } from "./disciplineBoard.js";
import { niceFileDate } from "./employeeFileView.js";
import { regulationVersion } from "./workRegulation.js";

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

export const PROOF_KINDS = {
  sealed: { ar: "مختوم", en: "Sealed" },
  signed: { ar: "موقّع", en: "Signed" },
  ack: { ar: "بإقرار", en: "Acknowledged" },
  log: { ar: "من السجل", en: "From the log" },
};

function proof(id, ar, hash = "") {
  const h = String(hash || "").replace(/[^0-9a-f]/gi, "");
  return { id, label: ar ? PROOF_KINDS[id].ar : PROOF_KINDS[id].en, hash: h.length >= 8 ? h.slice(0, 8) : "" };
}

/** File-log lines the story keeps, by what they say. Leave, injuries and pay slips belong elsewhere. */
const LOG_SKIP = /إجاز|اجاز|إصاب|اصاب|قسيم|leave|injur|payslip/i;
// Word-start only: «تبديل وردية» is not an allowance.
const LOG_WAGE = /(^|[\s«(—-])(ال)?(أجر|راتب|بدل)|wage|salary|allowance/i;
const LOG_MOVE = /نقل|انتقال|الفرع|المحطة|المسم[ىّ]|ترقي|تكليف|transfer|station|promot|title|acting/i;
const LOG_EXIT = /إنهاء العقد|انتهاء العقد|استقال|ترك العمل|resign|terminat|end of contract/i;

export function classifyFileLogLine(text) {
  const t = String(text || "");
  if (!t || LOG_SKIP.test(t)) return "";
  if (LOG_EXIT.test(t)) return "exit";
  if (LOG_WAGE.test(t)) return "wage";
  if (LOG_MOVE.test(t)) return "move";
  return "";
}

const EXIT_REASON = {
  resignation: { ar: "قدّم الاستقالة", en: "Resignation submitted" },
  article_81: { ar: "ترك العمل وفق المادة 81", en: "Left work under Art. 81" },
};

/**
 * @returns {{ years: Array<{ year: string, current: boolean, open: boolean, events: Array }>, count: number }}
 * Events: { id, date, at (display), text, actor, kind, proof: { id, label, hash } } — newest first.
 */
export function buildServiceStory({
  employee,
  cases = [],
  assets = [],
  regulation = null,
  roleLabel = "",
  selfView = false,
  ar = true,
  today,
} = {}) {
  if (!employee) return { years: [], count: 0 };
  const p = employee.profile || {};
  const c = p.contract || {};
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const me = selfView ? (ar ? "أنت" : "You") : (String(employee.name || "").trim() || (ar ? "الموظف" : "The employee"));
  const hr = ar ? "الموارد البشرية" : "HR";
  const events = [];
  const push = (id, date, text, actor, kind, pr) => {
    const d = dateOnly(date);
    if (!d || d > day || !text) return;
    events.push({ id, date: d, at: niceFileDate(d, ar), text, actor: String(actor || "").trim() || hr, kind, proof: pr });
  };

  // Joining.
  const hire = dateOnly(p.hireDate || employee.hireDate || employee.startDate);
  const job = String(roleLabel || p.position || employee.position || "").trim();
  if (hire) {
    push("hire", hire, ar ? `الالتحاق بالعمل${job ? ` على وظيفة «${job}»` : ""}` : `Joined${job ? ` as ${job}` : ""}`, hr, "hire", proof("log", ar));
  }

  // The contract: the worker's signature on the generated model, or a signed copy uploaded.
  const type = optionLabel(CONTRACT_TYPE_OPTIONS, c.type || p.contractType || "", ar);
  if (c.workerAck?.at) {
    push("contract-ack", c.workerAck.at, ar ? `توقيع عقد العمل${type ? ` (${type})` : ""} على النموذج الموحد` : `Signed the employment contract${type ? ` (${type})` : ""}`, me, "contract", c.workerAck.hash ? proof("sealed", ar, c.workerAck.hash) : proof("signed", ar));
  } else if (c.fileUrl || c.fileName) {
    const at = c.signedAt || c.uploadedAt || c.startDate || hire;
    push("contract-file", at, ar ? `حُفظت نسخة العقد الموقّعة${type ? ` (${type})` : ""}` : `Signed contract copy filed${type ? ` (${type})` : ""}`, c.uploadedBy || hr, "contract", c.fileHash ? proof("sealed", ar, c.fileHash) : proof("signed", ar));
  }
  if (p.art55AppliedAt) {
    push("art55", p.art55AppliedAt, ar ? "صار العقد غير محدد المدة بحكم المادة 55" : "The contract became open-ended under Art. 55", ar ? "المنصة" : "Platform", "contract", proof("log", ar));
  }

  // Work regulation acknowledgement (model Art. 3(3)) — only for the version in force.
  const ack = regulation?.acks?.[employee.id];
  if (ack?.at) {
    const version = regulationVersion(regulation);
    const current = !version || String(ack.version || "") === version;
    push("regulation", ack.at, ar ? `الإقرار بالاطلاع على لائحة تنظيم العمل${current ? "" : " (نسخة سابقة)"}` : `Acknowledged the work regulation${current ? "" : " (an earlier version)"}`, me, "regulation", proof("ack", ar));
  }

  // Moves and acting assignments.
  (employee.stationMoves || employee.transfers || []).forEach((m, i) => {
    const from = m.fromName || m.from || "";
    const to = m.toName || m.to || "";
    push(`move-${i}`, m.at || m.createdAt, ar ? `النقل${from ? ` من ${from}` : ""}${to ? ` إلى ${to}` : ""}` : `Moved${from ? ` from ${from}` : ""}${to ? ` to ${to}` : ""}`, m.by, "move", m.consentId || m.ackAt ? proof("ack", ar) : proof("log", ar));
  });
  (employee.actingAssignments || []).forEach((a, i) => {
    const title = a.title || a.roleLabel || a.role || "";
    push(`acting-${i}`, a.from || a.startedAt || a.createdAt, ar ? `تكليف${title ? ` بعمل «${title}»` : ""}${dateOnly(a.until) ? ` حتى ${niceFileDate(a.until, ar)}` : ""}` : `Acting assignment${title ? ` as ${title}` : ""}`, a.by, "move", a.consentId ? proof("ack", ar) : proof("log", ar));
  });

  // Training and certificates.
  (employee.trainings || []).forEach((r, i) => {
    const hours = Number(r.hours) || 0;
    push(`training-${r.id || i}`, r.to || r.from, ar ? `إتمام برنامج «${r.course || "تدريب"}»${r.provider ? ` — ${r.provider}` : ""}${hours ? ` · ${hours} ساعة` : ""}` : `Completed «${r.course || "training"}»${r.provider ? ` — ${r.provider}` : ""}${hours ? ` · ${hours}h` : ""}`, r.documentedBy || r.by, "training", proof("log", ar));
  });
  (employee.certificates || []).forEach((cert, i) => {
    if (cert.status && /reject|مرفوض/i.test(String(cert.status))) return;
    push(`cert-${cert.id || i}`, cert.issueDate || cert.approvedAt || cert.createdAt, ar ? `شهادة «${cert.name || "مهنية"}»` : `Certificate «${cert.name || "professional"}»`, cert.approvedBy || cert.by, "training", cert.fileHash ? proof("sealed", ar, cert.fileHash) : (cert.approvedAt ? proof("signed", ar) : proof("log", ar)));
  });

  // Sanctions: only what was signed; the objection and its outcome follow it.
  (cases || []).filter((item) => String(item.employeeId) === String(employee.id)).forEach((item, i) => {
    const face = faceOf(item.status).id;
    if (!["signed", "objected", "closed"].includes(face) || !dateOnly(item.signedAt)) return;
    const label = penaltyLabel(item, ar);
    const hash = item.finalHash || item.signedHash || item.fileHash || "";
    push(`sanction-${item.id || i}`, item.signedAt, ar ? `جزاء «${label}»${item.reason || item.note ? ` — ${item.reason || item.note}` : ""}` : `Sanction «${label}»`, item.signedBy || item.decidedBy, "sanction", hash ? proof("sealed", ar, hash) : proof("signed", ar));
    if (dateOnly(item.appealedAt)) {
      push(`grievance-${item.id || i}`, item.appealedAt, ar ? `تظلّم كتابي من جزاء «${label}»` : `Written grievance on «${label}»`, me, "sanction", proof("signed", ar));
    }
    if (dateOnly(item.rulingAt) && item.rulingLabel) {
      push(`ruling-${item.id || i}`, item.rulingAt, ar ? `نتيجة التظلّم: ${item.rulingLabel}` : `Grievance outcome: ${item.rulingLabel}`, item.rulingBy, "sanction", proof("log", ar));
    }
    if (dateOnly(item.voidedAt)) {
      push(`void-${item.id || i}`, item.voidedAt, ar ? `أُلغي جزاء «${label}»` : `Sanction «${label}» voided`, item.voidedBy, "sanction", proof("log", ar));
    }
  });

  // Custody handed and returned (Art. 65(2)).
  (assets || []).filter((a) => String(a.holderId || a.assignedTo || "") === String(employee.id)).forEach((a, i) => {
    const name = a.name || a.title || (ar ? "عهدة" : "custody");
    const ref = a.serial || a.code || "";
    push(`custody-in-${a.id || i}`, a.handedAt || a.assignedAt, ar ? `استلام عهدة «${name}»${ref ? ` (${ref})` : ""}` : `Received custody «${name}»${ref ? ` (${ref})` : ""}`, a.handedBy || a.by, "custody", a.ackAt || a.acknowledgedAt || a.evidenceUrl ? proof("ack", ar) : proof("log", ar));
    if (dateOnly(a.returnedAt)) {
      push(`custody-out-${a.id || i}`, a.returnedAt, ar ? `إعادة عهدة «${name}»` : `Returned custody «${name}»`, a.receivedBy || a.returnedBy, "custody", proof("log", ar));
    }
  });

  // File-log lines: wage changes, moves and exits written by the person who made them.
  (employee.fileLog || []).forEach((row, i) => {
    const kind = classifyFileLogLine(row.text);
    if (!kind) return;
    push(`log-${i}`, row.at, String(row.text).trim(), row.by, kind, proof("log", ar));
  });

  // Exit.
  const exit = p.contractExit;
  if (exit) {
    const reason = EXIT_REASON[exit.reason];
    const asked = exit.resignationSubmittedAt || exit.noticeAt;
    if (asked) {
      push("exit-notice", asked, reason ? (ar ? reason.ar : reason.en) : (ar ? "إشعار بإنهاء العقد" : "Notice to end the contract"), exit.party === "worker" ? me : (exit.by || hr), "exit", exit.party === "worker" ? proof("signed", ar) : proof("log", ar));
    }
    if (exit.effectiveDate) {
      push("exit-end", exit.effectiveDate, ar ? "انتهاء العلاقة التعاقدية" : "The employment relationship ended", hr, "exit", proof("log", ar));
    }
  }

  // Newest first; same-day order keeps the stronger proof on top. One line per (date, text).
  const rank = { sealed: 0, signed: 1, ack: 2, log: 3 };
  const seen = new Set();
  const sorted = events
    .sort((a, b) => b.date.localeCompare(a.date) || rank[a.proof.id] - rank[b.proof.id])
    .filter((e) => {
      const key = `${e.date}|${e.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const currentYear = day.slice(0, 4);
  const byYear = new Map();
  for (const e of sorted) {
    const y = e.date.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(e);
  }
  const years = [...byYear.entries()].map(([year, list], index) => ({
    year,
    current: year === currentYear,
    // Years before this one start folded; when this year is quiet, the newest year stays open.
    open: year >= currentYear || (index === 0 && !byYear.has(currentYear)),
    events: list,
  }));
  return { years, count: sorted.length };
}
