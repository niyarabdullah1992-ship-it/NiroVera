/**
 * «بطاقتي المهنية» — the identity card at the top of ملفي, and its «ختم الإثبات».
 * Pure: facts come from the file as it stands; the seal code is a hash of those facts, derived on
 * every read and never stored. Change a key fact and the code changes — that is the whole proof.
 * Pay, leave balances and injuries are not on the card: they live in قسيمتي and طلباتي.
 */
import { sha256HexOfBuffer } from "./fileHash.js";
import { CONTRACT_TYPE_OPTIONS, optionLabel, profileFieldValue } from "./employeeProfileFields.js";
import { readEmployeeNo } from "./employeeNumber.js";
import { readGosiRegisteredAt, readNationality, readSubscriberNumber } from "./facts/index.js";
import { niceFileDate, serviceLabel } from "./employeeFileView.js";

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

/** Two letters from the first and last word, kept apart (ZWNJ) so Arabic letters do not join. */
export function nameInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "—";
  const first = [...words[0]][0] || "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] || "") : "";
  return last ? `${first}‌${last}` : first;
}

export function hireIsoOf(employee) {
  const p = employee?.profile || {};
  return dateOnly(p.hireDate || employee?.hireDate || employee?.startDate);
}

/** Qiwa on the file: an explicit «not registered», a registered title, or nothing recorded. */
export function qiwaStateOf(employee, ar = true) {
  const p = employee?.profile || {};
  const title = String(p.qiwaTitle || p.qiwaStatus || "").trim();
  if (p.qiwaRegistered === false) return { ok: false, text: ar ? "غير مسجَّل" : "Not registered" };
  if (title) return { ok: true, text: ar ? `مسجَّل — ${title}` : `Registered — ${title}` };
  return { ok: false, text: ar ? "لم يُسجَّل في الملف" : "Not recorded on the file" };
}

export function gosiStateOf(employee, ar = true) {
  const number = readSubscriberNumber(employee);
  if (!number) return { ok: false, text: ar ? "لا رقم اشتراك" : "No subscriber number" };
  const since = readGosiRegisteredAt(employee);
  return { ok: true, text: ar ? `مشترك${since ? ` منذ ${niceFileDate(since, ar)}` : ""}` : `Subscribed${since ? ` since ${niceFileDate(since, ar)}` : ""}` };
}

/**
 * The card: who, what, where, and seven plain facts. `rows[].mono` marks codes; `rows[].gap` marks a
 * fact the file is missing (shown as a small chip, the value itself stays in ink).
 */
export function buildMyFileCard({ employee, roleLabel = "", stationName = "", ar = true, today } = {}) {
  const p = employee?.profile || {};
  const hire = hireIsoOf(employee);
  const contractRaw = profileFieldValue(p, "contractType", employee);
  const contract = optionLabel(CONTRACT_TYPE_OPTIONS, contractRaw, ar) || "";
  const qiwa = qiwaStateOf(employee, ar);
  const gosi = gosiStateOf(employee, ar);
  const no = readEmployeeNo(employee);
  const nationality = readNationality(employee) || String(p.nationality || "").trim();
  const job = String(roleLabel || p.position || employee?.position || "").trim();
  const rows = [
    { id: "no", k: ar ? "الرقم الوظيفي" : "Employee no.", v: no || "—", mono: true, gap: !no },
    { id: "hire", k: ar ? "تاريخ الالتحاق" : "Joined", v: hire ? niceFileDate(hire, ar) : "—", gap: !hire },
    { id: "service", k: ar ? "مدة الخدمة" : "Service", v: hire ? serviceLabel(hire, ar, today) : "—", gap: false },
    { id: "contract", k: ar ? "نوع العقد" : "Contract", v: contract || "—", gap: !contract },
    { id: "qiwa", k: ar ? "منصة قوى" : "Qiwa", v: qiwa.text, gap: !qiwa.ok },
    { id: "gosi", k: ar ? "التأمينات الاجتماعية" : "GOSI", v: gosi.text, gap: !gosi.ok },
    { id: "nationality", k: ar ? "الجنسية" : "Nationality", v: nationality || "—", gap: !nationality },
  ];
  return {
    name: String(employee?.name || "").trim() || "—",
    initials: nameInitials(employee?.name),
    job: job || "—",
    branch: String(stationName || "").trim() || "—",
    rows,
    sealText: fileSealText(employee, { roleLabel: job, stationName }),
  };
}

/**
 * The facts the seal binds, as one stable string: identity, job, place, hire, contract and its signed
 * hash, Qiwa and GOSI. The order is fixed; empty facts stay as empty strings so the shape never shifts.
 */
export function fileSealText(employee, { roleLabel = "", stationName = "" } = {}) {
  const p = employee?.profile || {};
  const c = p.contract || {};
  return JSON.stringify([
    "nirovera.file.v1",
    String(employee?.id || ""),
    readEmployeeNo(employee),
    String(employee?.name || "").trim(),
    String(profileFieldValue(p, "nationalId", employee) || ""),
    readNationality(employee) || String(p.nationality || ""),
    String(roleLabel || p.position || ""),
    String(stationName || ""),
    hireIsoOf(employee),
    String(profileFieldValue(p, "contractType", employee) || ""),
    String(c.workerAck?.hash || c.fileHash || c.fileName || p.contractFileName || ""),
    String(p.qiwaRegistered === false ? "no" : (p.qiwaTitle || p.qiwaStatus || "")),
    readSubscriberNumber(employee),
  ]);
}

/** «A1B2-C3D4-E5F6» — the first 12 hex digits of SHA-256 over the seal text. */
export function formatSealCode(hex) {
  const h = String(hex || "").replace(/[^0-9a-f]/gi, "").slice(0, 12).toUpperCase();
  if (h.length < 12) return "";
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

export async function fileSealCode(text) {
  try {
    const hex = await sha256HexOfBuffer(new TextEncoder().encode(String(text || "")));
    return formatSealCode(hex);
  } catch {
    return "";
  }
}
