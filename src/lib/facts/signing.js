/**
 * Secure Sign / stamps / public verify — Proof Cycle step 5.
 * Tokens belong on SignatureRequest (or nested otherRequests), never on WorkProof.
 */

export const SIGNING_FACTS = Object.freeze([
  {
    id: "signing.request",
    domain: "signing",
    scope: "envelope",
    home: "signatureRequests / SignatureRequest",
    path: "signatureRequests",
    storeKey: "signatureRequests",
    writer: "signing-create",
    stored: true,
    isolation: "companyId",
    proofCycle: 5,
    legacyKeys: ["signingChain"],
    surfaceAr: "التوقيع الآمن",
    noteAr: "signers[].token نصف الرابط العام. signingChain متوقف عن الكتابة.",
  },
  {
    id: "signing.signedDoc",
    domain: "signing",
    scope: "badge",
    home: "SignedDocument / signedDocRegistry",
    path: "signedDocRegistry",
    storeKey: "signedDocRegistry",
    writer: "signing-sign",
    stored: true,
    isolation: "companyId",
    proofCycle: 5,
    surfaceAr: "التحقق العام",
    noteAr: "companyId اختياري على بعض صفوف التحقق العام — لا تُفرض دون تعبئة.",
  },
  {
    id: "signing.files",
    domain: "signing",
    scope: "file",
    home: "files",
    path: "files",
    blobCategory: "files",
    writer: "signing-create",
    stored: true,
    isolation: "companyId",
    legacyKeys: ["smartArchive"],
    surfaceAr: "الأرشيف",
  },
  {
    id: "signing.templates",
    domain: "signing",
    scope: "template",
    home: "signingFieldTemplates",
    path: "signingFieldTemplates",
    storeKey: "signingFieldTemplates",
    writer: "signing-create",
    stored: true,
    isolation: "preview",
    surfaceAr: "قوالب التوقيع",
  },
]);

export function readSignatureRequests(company) {
  return Array.isArray(company?.signatureRequests) ? company.signatureRequests : [];
}

export function readSignedDocRegistry(company) {
  return Array.isArray(company?.signedDocRegistry) ? company.signedDocRegistry : [];
}

export function readFiles(company) {
  return Array.isArray(company?.files) ? company.files : [];
}
