/** Signable طلباتي types attach a file, download it, and raise a hand-signed copy. */

import { consentFileKind } from "./documentReadGate.js";
import {
  WRITTEN_CONSENT_TYPE,
  checkRaiseConsentGate,
  consentSignHref,
  consentSignerSpot,
  findConsentBySigning,
  isWrittenConsent,
} from "./writtenConsent.js";

export const LETTER_SIGNABLE_TYPES = ["salary_letter", "employment_letter", "document", "custody"];
export const SIGNABLE_REQUEST_TYPES = [WRITTEN_CONSENT_TYPE, ...LETTER_SIGNABLE_TYPES];

export function isSignableRequestType(type) {
  return SIGNABLE_REQUEST_TYPES.includes(type);
}

export function isLetterSignableType(type) {
  return LETTER_SIGNABLE_TYPES.includes(type);
}

export function isSignableRequest(request) {
  return isSignableRequestType(request?.type);
}

export function isOpenSignableRequest(request) {
  if (!isSignableRequest(request)) return false;
  if (isWrittenConsent(request)) return (request.status || "open") === "open";
  const status = request.status || "pending";
  return status === "pending" || status === "pending_employee" || status === "pending_manager";
}

export function hasOpenRequestSigning(request) {
  return isOpenSignableRequest(request) && Boolean(request?.signToken);
}

export function requestSignHref() {
  return consentSignHref();
}

export function requestSignerSpot(signMark) {
  return consentSignerSpot(signMark);
}

/** Signing-desk rows that belong to a طلباتي package — they stay in My Requests. */
export function isRequestSigningPackage(row) {
  return Boolean(
    row?.consentId
    || row?.otherRequestId
    || row?.kind === WRITTEN_CONSENT_TYPE
    || isSignableRequestType(row?.kind),
  );
}

export const ISSUED_LETTER_MAX_BYTES = 10 * 1024 * 1024;

function checkPaperKind(file, emptyError) {
  if (!file?.name && !file?.url) {
    return emptyError;
  }
  const kind = consentFileKind(file);
  if (kind !== "pdf" && kind !== "image") {
    return {
      ok: false,
      error: "FILE_KIND",
      reason: "أرفق PDF أو صورة (JPG / PNG / WEBP).",
      reasonEn: "Attach a PDF or an image (JPG / PNG / WEBP).",
    };
  }
  return { ok: true };
}

/** Manager-issued letter on decide — PDF/image, 10MB. Empty is not a fail here. */
export function checkIssuedLetterFileGate(file) {
  const kindGate = checkPaperKind(file, {
    ok: false,
    error: "ISSUED_FILE_REQUIRED",
    reason: "أرفق ملف الإصدار (PDF أو صورة)، أو اعتمد النسخة الموقّعة المرفوعة مع الطلب.",
    reasonEn: "Attach the issued file (PDF or image), or approve the signed copy already raised.",
  });
  if (!kindGate.ok) return kindGate;
  const size = Number(file.size) || 0;
  if (size > ISSUED_LETTER_MAX_BYTES) {
    return {
      ok: false,
      error: "FILE_SIZE",
      reason: "يجب ألا يتجاوز حجم الملف 10 ميجابايت.",
      reasonEn: "The file must not exceed 10 MB.",
    };
  }
  return { ok: true };
}

export function checkRequestSelfSignGate({ file, paper }) {
  const source = checkPaperKind(file, {
    ok: false,
    error: "FILE_REQUIRED",
    reason: "أرفق الملف وانتظر تحميله ثم نزّله للتوقيع اليدوي.",
    reasonEn: "Attach the file, wait for it to load, then download it to sign by hand.",
  });
  if (!source.ok) return source;
  return checkPaperKind(paper, {
    ok: false,
    error: "PAPER_REQUIRED",
    reason: "بعد التوقيع اليدوي ارفع النسخة الموقّعة هنا.",
    reasonEn: "After the hand signature, upload the signed copy here.",
  });
}

export function checkRaiseSignableGate({ type, file, paper, employeeId, body, deadline }) {
  if (type === WRITTEN_CONSENT_TYPE) {
    return checkRaiseConsentGate({ employeeId, body, deadline, file, paper });
  }
  if (!isLetterSignableType(type)) return { ok: true, skipped: true };
  return checkRequestSelfSignGate({ file, paper });
}

export function findSignableBySigning(employees = [], { requestId, token } = {}) {
  const consent = findConsentBySigning(employees, { requestId, token });
  if (consent) return consent;
  for (const employee of employees || []) {
    const request = (employee.otherRequests || []).find((row) => {
      if (!isSignableRequest(row)) return false;
      if (requestId && (row.signRequestId === requestId || row.id === requestId)) return true;
      return Boolean(token && row.signToken === token);
    });
    if (request) return { employee, request };
  }
  return null;
}

export function requestNeedsSignerAction(request, userId) {
  if (!hasOpenRequestSigning(request) || !userId) return false;
  return String(request.signerEmployeeId || "") === String(userId);
}

export function requestSigningAwaitingLabel(request, ar = true) {
  if (isWrittenConsent(request)) return ar ? "مفتوحة في طلباتي" : "Open in My Requests";
  return ar ? "بانتظار قرار في طلباتي" : "Awaiting a decision in My Requests";
}
