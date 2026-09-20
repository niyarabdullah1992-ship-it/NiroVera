import { getCompanyData, updateCompany } from "@/lib/store";
import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";
import { buildDummySignatureRequests, dummySigningEmployees } from "@/lib/multiSignDerivations";
import { deriveVerifyResult } from "@/lib/verifyDocument";

/**
 * Local mirror of the `signedDocs` registry, used when the cloud session cannot
 * authorize a registration (local preview has no CompanySession token). It keeps
 * the same contract as the backend so the verify tab behaves identically:
 * one verificationId is bound to exactly one file hash, forever.
 */

const rows = (companyId) => {
  const data = getCompanyData(companyId);
  return Array.isArray(data?.signedDocRegistry) ? data.signedDocRegistry : [];
};

const requestsOf = (companyId) => {
  const data = getCompanyData(companyId);
  return Array.isArray(data?.signatureRequests) ? data.signatureRequests : [];
};

export function registerLocalSignedDoc(companyId, entry) {
  const verificationId = String(entry?.verificationId || "").slice(0, 40);
  const fileHash = String(entry?.fileHash || "").toLowerCase();
  if (!verificationId || !/^[0-9a-f]{64}$/.test(fileHash)) {
    return { error: "INVALID_INPUT", reason: "رقم التحقق وبصمة SHA-256 مطلوبان." };
  }
  const existing = rows(companyId).find((row) => row.verificationId === verificationId);
  if (existing) {
    if (existing.fileHash === fileHash) return { ok: true, record: existing };
    return { error: "SIGNATURE_REUSE", reason: "رقم التحقق مرتبط بملف آخر — لا يُعاد استخدامه." };
  }
  const record = {
    verificationId,
    fileHash,
    signerName: String(entry?.signerName || "").slice(0, 120),
    signerId: String(entry?.signerId || "").slice(0, 64),
    fileName: String(entry?.fileName || "").slice(0, 200),
    signedAt: new Date().toISOString(),
  };
  updateCompany(companyId, (data) => {
    data.signedDocRegistry = [record, ...(Array.isArray(data.signedDocRegistry) ? data.signedDocRegistry : [])];
  });
  if (!rows(companyId).some((row) => row.verificationId === verificationId)) {
    return { error: "NOT_STORED", reason: "لا توجد نسخة محلية لبيانات الشركة." };
  }
  return { ok: true, record };
}

export function verifyLocalSignedDoc(companyId, { fileHash, verificationId, fileName } = {}) {
  return deriveVerifyResult({
    registry: rows(companyId),
    requests: requestsOf(companyId),
    fileHash,
    verificationId,
    fileName,
  });
}

function previewRequests() {
  const stored = requestsOf(LOCAL_PREVIEW_COMPANY_ID);
  if (stored.length) return stored;
  const people = dummySigningEmployees();
  return buildDummySignatureRequests({
    companyId: LOCAL_PREVIEW_COMPANY_ID,
    actor: people[0],
    employees: people,
  });
}

/** Public /verify with no session: preview flag may still expose the local registry. */
export function verifyPublicSignedDoc({ fileHash, verificationId, fileName } = {}) {
  if (!isLocalPreviewActive()) {
    return deriveVerifyResult({ registry: [], requests: [], fileHash, verificationId, fileName });
  }
  return deriveVerifyResult({
    registry: rows(LOCAL_PREVIEW_COMPANY_ID),
    requests: previewRequests(),
    fileHash,
    verificationId,
    fileName,
  });
}
