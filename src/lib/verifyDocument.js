import { coolingUntilOf, lastSignedHash } from "./multiSignDerivations.js";

export const VERIFY_NAVY = "#14213d";
export const VERIFY_GREEN = "#1d9a5b";
export const VERIFY_OK = "#137a49";
export const VERIFY_RED = "#8a1c2b";
export const VERIFY_GRAY = "#4b5567";
export const VERIFY_AMBER = "#8a6516";
export const VERIFY_BG = "#eceef2";
export const VERIFY_LINE = "#dfe3ea";
export const VERIFY_MUTED = "#4b5567";
export const VERIFY_LABEL = "#6b7280";
export const VERIFY_MAX_BYTES = 25 * 1024 * 1024;

const STATUS_OF = {
  ok: "valid",
  modified: "tampered",
  none: "unknown",
  cooling: "cooling",
  reuse: "reuse",
};

export function verifyKindOf(answer) {
  const kind = String(answer?.kind || "").toLowerCase();
  if (kind === "ok" || kind === "modified" || kind === "none" || kind === "cooling" || kind === "reuse") return kind;
  const status = String(answer?.status || "").toLowerCase();
  if (status === "valid") return "ok";
  if (status === "tampered") return "modified";
  if (status === "unknown") return "none";
  if (status === "cooling" || status === "reuse") return status;
  return "";
}

function publicRow(row, extra = {}) {
  return {
    verificationId: row?.verificationId || null,
    signerName: row?.signerName || null,
    fileName: row?.fileName || null,
    signedAt: row?.signedAt || null,
    ...extra,
  };
}

function requestPublic(request, extra = {}) {
  const signed = (request?.signers || []).filter((row) => row.status === "signed");
  const last = signed.slice().sort((a, b) => Date.parse(a.signedAt || 0) - Date.parse(b.signedAt || 0)).at(-1);
  return publicRow({
    verificationId: request.verificationId,
    signerName: signed.map((row) => row.name).filter(Boolean).join("، ") || request.creatorName || "",
    fileName: request.fileName,
    signedAt: last?.signedAt || request.lastActivityAt || request.createdAt,
  }, extra);
}

function answer(kind, fields = {}) {
  return { status: STATUS_OF[kind], kind, ...fields };
}

function sealedHashOf(request) {
  return String(request?.finalHash || lastSignedHash(request?.signers) || "").toLowerCase();
}

export function fileNameKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/-signed(?=\.pdf$)/i, "")
    .replace(/\.pdf$/i, "")
    .replace(/[\s_\-]+/g, "");
}

function requestHashes(request) {
  const hashes = new Set();
  const sealed = sealedHashOf(request);
  if (sealed) hashes.add(sealed);
  (request?.signers || []).forEach((row) => {
    const hash = String(row.documentHash || "").toLowerCase();
    if (/^[0-9a-f]{64}$/.test(hash)) hashes.add(hash);
  });
  return hashes;
}

function requestByFileHash(requests, hash) {
  if (!hash) return null;
  return (requests || []).find((row) => requestHashes(row).has(hash)) || null;
}

function relatedByFileName(registry, requests, fileName) {
  const key = fileNameKey(fileName);
  if (!key) return { registry: null, request: null };
  return {
    registry: (registry || []).find((row) => fileNameKey(row.fileName) === key) || null,
    request: (requests || []).find((row) => fileNameKey(row.fileName) === key) || null,
  };
}

/**
 * Public verify derivation. Figures come from the registry / live request —
 * never from hard-coded demo names or hashes.
 */
export function deriveVerifyResult({ registry = [], requests = [], fileHash, verificationId, fileName } = {}) {
  const hash = String(fileHash || "").toLowerCase();
  const id = String(verificationId || "").trim();
  const byHash = hash ? registry.find((row) => String(row.fileHash || "").toLowerCase() === hash) : null;
  const byId = id ? registry.find((row) => row.verificationId === id) : null;
  const reqById = id ? requests.find((row) => row.verificationId === id) : null;
  const reqByHash = requestByFileHash(requests, hash);

  if (byHash && byId && byHash.verificationId !== byId.verificationId) {
    return answer("reuse", publicRow(byId, {
      uploadedHash: hash,
      registryHash: byId.fileHash,
      originalFileName: byId.fileName,
    }));
  }

  if (byHash) {
    return answer("ok", publicRow(byHash, { uploadedHash: hash, registryHash: byHash.fileHash }));
  }

  if (byId) {
    return answer("modified", publicRow(byId, { uploadedHash: hash, registryHash: byId.fileHash }));
  }

  if (reqById) {
    const coolingUntil = coolingUntilOf(reqById.signers);
    if (coolingUntil && !reqById.finalHash) {
      return answer("cooling", requestPublic(reqById, {
        coolingUntil,
        uploadedHash: hash,
        registryHash: sealedHashOf(reqById),
      }));
    }
    const sealed = sealedHashOf(reqById);
    if (sealed && hash && sealed === hash) {
      return answer("ok", requestPublic(reqById, { uploadedHash: hash, registryHash: sealed }));
    }
    if (sealed && hash && sealed !== hash) {
      return answer("modified", requestPublic(reqById, { uploadedHash: hash, registryHash: sealed }));
    }
  }

  if (reqByHash) {
    const coolingUntil = coolingUntilOf(reqByHash.signers);
    if (coolingUntil && !reqByHash.finalHash) {
      return answer("cooling", requestPublic(reqByHash, {
        coolingUntil,
        uploadedHash: hash,
        registryHash: sealedHashOf(reqByHash),
      }));
    }
    return answer("ok", requestPublic(reqByHash, { uploadedHash: hash, registryHash: sealedHashOf(reqByHash) || hash }));
  }

  const related = relatedByFileName(registry, requests, fileName);
  if (related.registry) {
    return answer("modified", publicRow(related.registry, {
      uploadedHash: hash,
      registryHash: related.registry.fileHash,
    }));
  }
  if (related.request) {
    const coolingUntil = coolingUntilOf(related.request.signers);
    if (coolingUntil && !related.request.finalHash) {
      return answer("cooling", requestPublic(related.request, {
        coolingUntil,
        uploadedHash: hash,
        registryHash: sealedHashOf(related.request),
      }));
    }
    const sealed = sealedHashOf(related.request);
    if (sealed) {
      return answer("modified", requestPublic(related.request, { uploadedHash: hash, registryHash: sealed }));
    }
  }

  return answer("none", { uploadedHash: hash, registryHash: "" });
}

export function preferVerifyAnswer(remote, local) {
  const rank = (row) => {
    const kind = verifyKindOf(row);
    if (kind === "reuse") return 5;
    if (kind === "cooling") return 4;
    if (kind === "ok" || kind === "modified") return 3;
    if (kind === "none") return 1;
    if (row?.status === "error") return 0;
    return 0;
  };
  if (!remote) return local;
  if (!local) return remote;
  return rank(remote) >= rank(local) ? remote : local;
}

export function verifyOutcomeCopy(kind, ar) {
  const rows = {
    ok: {
      mark: "✓",
      color: VERIFY_OK,
      bg: "#f2faf6",
      border: "#bfe6d2",
      title: ar ? "الملف سليم ومطابق للسجل" : "The file matches the registry",
      desc: ar
        ? "بصمة هذا الملف تطابق النسخة المسجّلة تماماً. لم يُعدَّل بايت واحد بعد الختم، وكل مهل التراجع مغلقة."
        : "This file’s fingerprint matches the registered copy exactly. Not one byte changed after sealing, and every retract window is closed.",
      note: ar
        ? "المطابقة على مستوى البايت: لو تغيّر حرف واحد لظهرت النتيجة «معدّل»."
        : "Match is byte-level: change a single character and the result becomes modified.",
    },
    modified: {
      mark: "!",
      color: VERIFY_RED,
      bg: "#fdf2f3",
      border: "#eccdd1",
      title: ar ? "الملف معدّل بعد التوقيع" : "The file was changed after signing",
      desc: ar
        ? "رقم التحقق مسجّل لدينا، لكن بصمة الملف الذي اخترته لا تطابق النسخة الموقّعة. اطلب النسخة الأصلية من المرسل."
        : "The verification id is on record, but this file’s fingerprint does not match the signed copy. Ask the sender for the original.",
      note: ar
        ? "الكشف يقيني لكنه لا يبيّن ما الذي تغيّر ولا من غيّره. تنبيه: إعادة حفظ الملف أو طباعته كـ PDF تغيّر البايتات وتُظهر هذه النتيجة رغم تطابق المحتوى — ارفع النسخة كما استلمتها."
        : "Detection is certain but does not show what changed or who changed it. Re-saving or printing as PDF changes the bytes and yields this result even when the content looks the same — use the copy as you received it.",
    },
    none: {
      mark: "—",
      color: VERIFY_GRAY,
      bg: "#f5f6f8",
      border: VERIFY_LINE,
      title: ar ? "لا يوجد سجل لهذا الملف" : "No registry record for this file",
      desc: ar
        ? "لم نجد بصمة هذا الملف في سجل الشركة. الختم على الصفحة لا يكفي: السجل يحفظ SHA-256 للنسخة التي نُزلت فور الختم. إن وقّعت للتو فأدخل رقم التحقق من الإيصال، أو أعد تنزيل النسخة من الحالة بعد إغلاق مهلة التراجع."
        : "This file’s fingerprint is not in the company registry. A seal on the page is not enough: the registry stores the SHA-256 of the copy downloaded at sealing. If you just signed, paste the verification id from the receipt, or download the copy from Status after retract windows close.",
      note: ar
        ? "إعادة حفظ PDF أو طباعته تغيّر البايتات فيظهر «لا يوجد سجل» أو «معدّل» رغم أن المحتوى يبدو نفسه."
        : "Re-saving or printing a PDF changes the bytes and yields “no record” or “modified” even when the content looks the same.",
    },
    cooling: {
      mark: "⏳",
      color: VERIFY_AMBER,
      bg: "#fdf6e8",
      border: "#ecd9a8",
      title: ar ? "موقّع — مهلة تراجع مفتوحة" : "Signed — retract window still open",
      desc: ar
        ? "الملف موقّع لكن مهلة تراجع أحد الأطراف لم تنتهِ بعد، فلم تُثبَّت البصمة النهائية ولم يُسجَّل الملف في السجل النهائي."
        : "The file is signed, but a retract window is still open, so the final fingerprint is not sealed and the file is not in the final registry.",
      note: ar
        ? "البصمة المعروضة مؤقتة؛ النهائية تُثبَّت بعد إغلاق كل مهل التراجع."
        : "The fingerprint shown is temporary; the final one is sealed after every retract window closes.",
    },
    reuse: {
      mark: "!",
      color: VERIFY_RED,
      bg: "#fdf2f3",
      border: "#eccdd1",
      title: ar ? "رقم تحقق مُعاد استخدامه" : "Verification id reused on another file",
      desc: ar
        ? "رقم التحقق مرتبط بمستند آخر مسجّل مسبقاً. كل رقم مربوط بملف واحد للأبد."
        : "This verification id is already bound to another registered document. Each id is bound to one file forever.",
      note: ar
        ? "رقم التحقق مربوط بملف واحد للأبد، ومحاولة استخدامه على غيره تُسجَّل في سجل التدقيق."
        : "The id is bound to one file forever; using it on another is recorded in the audit trail.",
    },
  };
  return rows[kind] || null;
}

export function isPdfFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

export function fileTooLarge(file) {
  return Boolean(file && file.size > VERIFY_MAX_BYTES);
}
