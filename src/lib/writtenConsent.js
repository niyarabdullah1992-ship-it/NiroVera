import { consentFileKind, normalizeSignMark } from "./documentReadGate.js";

/** Written consent raised by a manager and signed from My Requests. */

export const WRITTEN_CONSENT_TYPE = "written_consent";

/** Ministry path: write → sign in قسم التوقيع → upload + اعتماد. Refuse is one direct action. */
export const CONSENT_MINISTRY_HINT_AR = "اكتب موافقة خطية → وقّع الملف في قسم التوقيع → ارفع النسخة هنا للاعتماد. رفض = زر مباشر.";
export const CONSENT_MINISTRY_HINT_EN = "Write a written consent → sign the file in Digital signing → upload the copy here to approve. Refuse is one direct button.";

export const CONSENT_TOPICS = [
  {
    id: "night",
    ar: "الاستمرار في الوردية الليلية",
    en: "Stay on the night shift",
    citeAr: "قرار 18632",
    citeEn: "Decision 18632",
    decisionId: "18632",
    bodyAr: "مضى على إسنادك كعامل ليلي ثلاثة أشهر. تطلب الإدارة إقرارك الخطي بالاستمرار أو الرفض. الموافقة تُحفظ في الملف مع حق التراجع في أي وقت — لا تجديد شهري واجب. إن رُفضت يُدوَّر العمل لساعات عادية شهراً على الأقل. أسبوع صباحي واحد لا يصفّر عدّ الثلاثة أشهر.",
    bodyEn: "You have been assigned as a night worker for three months. Management asks for your written consent to continue or refuse. Consent stays on the file with the right to withdraw at any time — monthly renewal is not a legal duty. If refused, the work rotates to ordinary hours for at least one month. One morning week does not reset the three-month count.",
  },
  {
    id: "site",
    ar: "تغيير موقع العمل",
    en: "Change of work site",
    citeAr: "المادة 58",
    citeEn: "Art. 58",
    article: "58",
    bodyAr: "تطلب الإدارة إقرارك الخطي بالانتقال إلى موقع عمل آخر ضمن المدينة نفسها، مع بقاء الأجر والمسمّى كما هما.",
    bodyEn: "Management asks for your written consent to move to another site in the same city, with pay and title unchanged.",
  },
  {
    id: "ot",
    ar: "ساعات عمل إضافية",
    en: "Overtime hours",
    citeAr: "المادة 107",
    citeEn: "Art. 107",
    article: "107",
    bodyAr: "تطلب الإدارة إقرارك الخطي بالعمل ساعات إضافية خلال فترة الذروة، بأجر إضافي وفق النظام، وبما لا يتجاوز الحد النظامي.",
    bodyEn: "Management asks for your written consent to overtime in a peak period, at the statutory premium and within the legal cap.",
  },
];

export function consentTopicMeta(id) {
  return CONSENT_TOPICS.find((row) => row.id === id) || CONSENT_TOPICS[0];
}

export function isWrittenConsent(request) {
  return request?.type === WRITTEN_CONSENT_TYPE;
}

export function consentStatus(request) {
  return request?.status || "open";
}

export function isOpenConsent(request) {
  return isWrittenConsent(request) && consentStatus(request) === "open";
}

export function flattenWrittenConsents(employees = []) {
  return (employees || [])
    .flatMap((employee) => (employee.otherRequests || [])
      .filter(isWrittenConsent)
      .map((request) => ({ ...request, employee })))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function openWrittenConsents(employees = []) {
  return flattenWrittenConsents(employees).filter((row) => consentStatus(row) === "open");
}

export function openWrittenConsentCount(employees = []) {
  return openWrittenConsents(employees).length;
}

export function isNightWrittenConsent(request) {
  return isWrittenConsent(request)
    && (request.topic === "night" || request.decisionId === "18632" || request.citeAr === "قرار 18632");
}

/** Open night written consent is owed — red due glow. Quiet file stays green. */
export function nightWrittenConsentGlow(employees = []) {
  return openWrittenConsents(employees).some(isNightWrittenConsent) ? "due" : "off";
}

export function mineWrittenConsents(employees = []) {
  return flattenWrittenConsents(employees)
    .sort((a, b) => {
      const openA = consentStatus(a) === "open" ? 0 : 1;
      const openB = consentStatus(b) === "open" ? 0 : 1;
      if (openA !== openB) return openA - openB;
      return new Date(b.answeredAt || b.createdAt || 0) - new Date(a.answeredAt || a.createdAt || 0);
    });
}

/** The request is the source. Seal state is derived from it — same idea as signing. */
export function consentSealFace(item, ar = true) {
  const status = consentStatus(item);
  if (status === "yes") {
    return { tone: "#15803D", label: ar ? "مختوم" : "Sealed", ref: item.seal?.signatureId || "" };
  }
  if (status === "no") {
    return { tone: "#DC2626", label: ar ? "رُفضت" : "Refused", ref: "" };
  }
  return { tone: "#1E9E63", label: ar ? "مفتوحة في طلباتي" : "Open in My Requests", ref: "" };
}

export function savedConsentSeals(profile) {
  const out = [];
  if (profile?.signatureUrl) {
    out.push({
      id: "signature",
      labelAr: profile.signatureName ? `توقيعي — ${profile.signatureName}` : "توقيعي المحفوظ",
      labelEn: profile.signatureName ? `My seal — ${profile.signatureName}` : "My saved seal",
      url: profile.signatureUrl,
      signatureId: profile.signatureId || "",
    });
  }
  if (profile?.stampConfig && profile?.signatureRawUrl && profile.signatureRawUrl !== profile.signatureUrl) {
    out.push({
      id: "stamp",
      labelAr: "ختمي",
      labelEn: "My stamp",
      url: profile.signatureRawUrl,
      signatureId: profile.signatureId || "",
    });
  }
  return out;
}

export function consentSignHref() {
  return "/app/requests";
}

/** Real in-app target — paper confirm in طلباتي, never an empty href or /app/signing. */
export function consentRowHref(item) {
  return item?.id ? `/app/requests#consent-${item.id}` : "/app/requests";
}

export function checkConfirmConsentPaperGate({ paper, ack } = {}) {
  if (!ack) {
    return {
      ok: false,
      error: "ACK_REQUIRED",
      reason: "أشّر على الإقرار أولاً.",
      reasonEn: "Tick the acknowledgement first.",
    };
  }
  if (!paper?.name && !paper?.url) {
    return {
      ok: false,
      error: "PAPER_REQUIRED",
      reason: "اكتب موافقة خطية، وقّع الملف في قسم التوقيع، ثم ارفع النسخة هنا لاعتماد الطلب.",
      reasonEn: "Write a written consent, sign the file in Digital signing, then upload the copy here to approve the request.",
    };
  }
  if (consentFileKind(paper) !== "pdf" && consentFileKind(paper) !== "image") {
    return {
      ok: false,
      error: "FILE_KIND",
      reason: "النسخة الموقّعة تكون PDF أو صورة.",
      reasonEn: "The signed copy must be a PDF or an image.",
    };
  }
  return { ok: true };
}

/** Signing-desk rows that belong to a طلباتي package — they live in My Requests. */
export function isConsentSigningRequest(row) {
  return Boolean(
    row?.consentId
    || row?.otherRequestId
    || row?.kind === WRITTEN_CONSENT_TYPE
    || ["salary_letter", "employment_letter", "document", "custody"].includes(row?.kind),
  );
}

export function deskSigningRows(rows) {
  return (rows || []).filter((row) => !isConsentSigningRequest(row));
}

export function isConsentSignToken(token, signatureRequests = [], employees = []) {
  if (!token) return false;
  if (findConsentBySigning(employees, { token })) return true;
  for (const employee of employees || []) {
    if ((employee.otherRequests || []).some((row) => row.signToken === token)) return true;
  }
  return (signatureRequests || []).some((row) => {
    if (!isConsentSigningRequest(row)) return false;
    if (row.myToken === token) return true;
    return (row.signers || []).some((signer) => signer.token === token || `${row.id}.${signer.token}` === token);
  });
}

export function consentSignerEmail(employee) {
  const email = String(employee?.email || "").toLowerCase().trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return email;
  const slug = String(employee?.id || "worker").replace(/[^a-z0-9]/gi, "") || "worker";
  return `${slug}@consent.nirovera.local`;
}

export function consentPdfName(file, title = "") {
  const raw = String(file?.name || title || "consent.pdf");
  if (raw.toLowerCase().endsWith(".pdf")) return raw.slice(0, 200);
  return `${raw.replace(/\.[^.]+$/, "") || "consent"}.pdf`.slice(0, 200);
}

export function consentSignerSpot(signMark) {
  const mark = normalizeSignMark(signMark) || { id: "consent-sign", type: "signature", page: 1, x: 72, y: 84, scale: 100 };
  return {
    id: mark.id || "consent-sign",
    type: "signature",
    page: mark.page || 1,
    x: mark.x,
    y: mark.y,
    scale: mark.scale || 100,
  };
}

export function findConsentBySigning(employees = [], { requestId, token } = {}) {
  for (const employee of employees || []) {
    const request = (employee.otherRequests || []).find((row) => {
      if (!isWrittenConsent(row)) return false;
      if (requestId && row.signRequestId === requestId) return true;
      return Boolean(token && row.signToken === token);
    });
    if (request) return { employee, request };
  }
  return null;
}

export function checkRaiseConsentGate({ employeeId, body, deadline, file, paper }) {
  if (!employeeId) {
    return { ok: false, error: "EMPLOYEE_REQUIRED", reason: "اختر الموظف.", reasonEn: "Choose the employee." };
  }
  if (String(body || "").trim().length <= 10) {
    return { ok: false, error: "BODY_REQUIRED", reason: "اكتب نص الطلب كما سيقرؤه الموظف.", reasonEn: "Write the request as the worker will read it." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deadline || ""))) {
    return { ok: false, error: "DEADLINE_REQUIRED", reason: "حدد مهلة الرد.", reasonEn: "Set a reply deadline." };
  }
  if (!file?.name && !file?.url) {
    return { ok: false, error: "FILE_REQUIRED", reason: "أرفق النموذج ليكتبه الموظف ويوقّعه في قسم التوقيع ثم يرفعه هنا.", reasonEn: "Attach the form so the worker can write it, sign it in Digital signing, then upload it here." };
  }
  if (consentFileKind(file) !== "pdf" && consentFileKind(file) !== "image") {
    return { ok: false, error: "FILE_KIND", reason: "أرفق PDF أو صورة.", reasonEn: "Attach a PDF or image." };
  }
  return { ok: true };
}

export function checkAcceptConsentGate({ ack, paper }) {
  return checkConfirmConsentPaperGate({ paper, ack });
}

export function checkRefuseConsentGate() {
  return { ok: true };
}

export async function hashConsentFile(file) {
  if (!file) return "";
  const buf = await file.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16).toUpperCase();
  }
  return `F${file.size}${String(file.name || "").length}`;
}

export function readConsentFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}
