/**
 * «أرشيف الملف» — every DOCUMENT that sits on this employee's file, gathered from records the
 * platform already keeps. Not a change log: who-edited-what stays on employee.fileLog (the proof
 * trail serviceStory reads); this lists papers — contracts, decisions, letters, copies, receipts,
 * acknowledgements. Pure: nothing is typed here, every line is read from a record.
 *
 * Proof chip, from what the record actually carries:
 *   sealed   — «مختوم»: a stored hash or a verification id (signing seal, sealed letter, sealed consent)
 *   signed   — «موقّع»: a dated signature or an approval by the named person, no stored hash
 *   uploaded — «مرفوع»: a file copy attached to the file
 *   ack      — «بإقرار»: the worker's own acknowledgement (regulation, custody receipt)
 *
 * Not here on purpose: pay slips (قسيمتي), leave requests (طلباتي), open requests not yet settled.
 */
import { faceOf, penaltyLabel } from "./disciplineBoard.js";
import { niceFileDate } from "./employeeFileView.js";
import { regulationVersion } from "./workRegulation.js";
import { DOC_KINDS } from "./requestWorkspace.js";
import { otherRequestTypeLabel, STUDY_CONSENT_TYPE } from "./otherRequestDerivations.js";
import { consentRowHref, consentStatus, isWrittenConsent } from "./writtenConsent.js";
import { isDeletedRequest, isRegistrable } from "./multiSignDerivations.js";
import { isRequestSigningPackage } from "./requestSigning.js";
import { DOCUMENTS_RETURN_TYPE } from "./rightsRequests.js";
import { contractHint, serviceCertificateHint } from "./rightHints.disc.js";

export const ARCHIVE_GROUPS = [
  { id: "contracts", ar: "العقود", en: "Contracts" },
  { id: "decisions", ar: "القرارات والجزاءات", en: "Decisions and sanctions" },
  { id: "letters", ar: "الشهادات والخطابات", en: "Certificates and letters" },
  { id: "identity", ar: "الهوية والوثائق", en: "Identity and documents" },
  { id: "custody", ar: "العهد والإخلاء", en: "Custody and clearance" },
  { id: "acks", ar: "الإقرارات", en: "Acknowledgements" },
];

export const ARCHIVE_PROOF = {
  sealed: { ar: "مختوم", en: "Sealed" },
  signed: { ar: "موقّع", en: "Signed" },
  uploaded: { ar: "مرفوع", en: "Uploaded" },
  ack: { ar: "بإقرار", en: "Acknowledged" },
};

const DOC_LABELS = {
  driving_licence: { ar: "رخصة القيادة", en: "Driving licence" },
  passport: { ar: "جواز السفر", en: "Passport" },
  iqama: { ar: "الإقامة", en: "Iqama" },
  national_id: { ar: "الهوية الوطنية", en: "National ID" },
  work_permit: { ar: "رخصة العمل", en: "Work permit" },
  medical_insurance: { ar: "وثيقة التأمين الطبي", en: "Medical insurance" },
  insurance: { ar: "وثيقة التأمين الطبي", en: "Medical insurance" },
  gosi: { ar: "شهادة التأمينات", en: "GOSI certificate" },
};

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

/** Short display of a stored hash (hex only, 8 characters) — empty when there is none. */
export function shortArchiveHash(hash) {
  const h = String(hash || "").replace(/[^0-9a-f]/gi, "");
  return h.length >= 8 ? h.slice(0, 8).toLowerCase() : "";
}

function proofOf(id, ar, { hash = "", ref = "" } = {}) {
  const short = shortArchiveHash(hash);
  return { id, label: ar ? ARCHIVE_PROOF[id].ar : ARCHIVE_PROOF[id].en, hash: short, ref: short || String(ref || "").trim() };
}

const fileUrlOf = (f) => String(f?.url || f?.file_url || f?.fileUrl || "").trim();
const fileNameOf = (f) => String(f?.name || f?.fileName || "").trim();
const verifyHrefOf = (id) => (String(id || "").trim() ? `/verify?id=${encodeURIComponent(String(id).trim())}` : "");
const docKindLabel = (id, ar) => {
  const row = DOC_KINDS.find((k) => k.id === id);
  return row ? (ar ? row.ar : row.en) : "";
};

/**
 * @returns {{ groups: Array<{ id, label, items: Array, missing: Array }>, count: number, empty: boolean, emptyLine: string }}
 * Item: { id, group, title, type, date, at, by, proof: { id, label, hash, ref }, open, verifyHref, downloadUrl, print }
 *   open = { to } (in-app route) or { href } (file) — or null.
 * Missing (manager view only): { id, group, title, note, hint } — a paper the law expects that is not archived.
 */
export function buildFileArchive({
  employee,
  cases = [],
  assets = [],
  regulation = null,
  signatureRequests = [],
  signedDocuments = [],
  managerView = false,
  ar = true,
  today,
  profileHref = "",
} = {}) {
  const emptyLine = ar ? "لا وثيقة مؤرشفة على هذا الملف بعد." : "No document archived on this file yet.";
  if (!employee) return { groups: [], count: 0, empty: true, emptyLine };
  const p = employee.profile || {};
  const c = p.contract || {};
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const hr = ar ? "الموارد البشرية" : "HR";
  const me = String(employee.name || "").trim() || (ar ? "الموظف" : "The employee");
  const hire = dateOnly(p.hireDate || employee.hireDate || employee.startDate);
  const items = [];
  const push = (group, row) => {
    if (!row?.title) return;
    const date = String(row.date || "").slice(0, 19);
    items.push({
      group,
      type: "",
      by: hr,
      open: null,
      verifyHref: "",
      downloadUrl: "",
      print: "",
      ...row,
      date,
      at: dateOnly(date) ? niceFileDate(date, ar) : "—",
      by: String(row.by || "").trim() || hr,
    });
  };

  // ── Contracts (Arts. 51–52): the signed model, an uploaded signed copy, a written probation extension.
  const contractTo = profileHref ? `${profileHref}?tab=contract` : "";
  if (c.generated && c.workerAck?.at) {
    push("contracts", {
      id: "contract-model",
      title: ar ? "عقد العمل — النموذج الموحد" : "Employment contract — unified model",
      type: ar ? "عقد عمل" : "Employment contract",
      date: c.workerAck.at,
      by: c.workerAck.name || me,
      proof: c.workerAck.hash ? proofOf("sealed", ar, { hash: c.workerAck.hash }) : proofOf("signed", ar),
      open: contractTo ? { to: contractTo } : null,
      print: "contract",
    });
  }
  const contractUrl = String(c.fileUrl || p.contractUrl || p.contractPdf || "").trim();
  const contractName = String(c.fileName || p.contractFileName || "").trim();
  if (contractUrl || contractName) {
    push("contracts", {
      id: "contract-file",
      title: contractName || (ar ? "عقد العمل الموقّع" : "Signed employment contract"),
      type: ar ? "نسخة عقد موقّعة" : "Signed contract copy",
      date: c.signedAt || c.uploadedAt || c.startDate || hire,
      by: c.uploadedBy || hr,
      proof: c.fileHash ? proofOf("sealed", ar, { hash: c.fileHash }) : proofOf("uploaded", ar),
      open: contractUrl ? { href: contractUrl } : (contractTo ? { to: contractTo } : null),
      downloadUrl: contractUrl,
    });
  }
  const second = p.probationSecondFile;
  if (second && (fileUrlOf(second) || fileNameOf(second))) {
    push("contracts", {
      id: "probation-second",
      title: fileNameOf(second) || (ar ? "اتفاق تمديد التجربة" : "Probation extension"),
      type: ar ? "اتفاق تجربة مكتوب — م 53" : "Written probation agreement — Art. 53",
      date: second.at || second.uploadedAt || hire,
      proof: second.hash ? proofOf("sealed", ar, { hash: second.hash }) : proofOf("uploaded", ar),
      open: fileUrlOf(second) ? { href: fileUrlOf(second) } : null,
      downloadUrl: fileUrlOf(second),
    });
  }

  // ── Decisions: a sanction is a document once signed; the grievance ruling follows it (Arts. 71–72).
  (cases || []).filter((item) => String(item.employeeId) === String(employee.id)).forEach((item, i) => {
    const face = faceOf(item.status).id;
    if (!["signed", "objected", "closed"].includes(face) || !dateOnly(item.signedAt)) return;
    const label = penaltyLabel(item, ar);
    const hash = item.finalHash || item.signedHash || item.fileHash || "";
    const voided = dateOnly(item.voidedAt);
    push("decisions", {
      id: `sanction-${item.id || i}`,
      title: ar ? `قرار جزاء «${label}»` : `Sanction decision «${label}»`,
      type: voided ? (ar ? "قرار جزاء — أُلغي" : "Sanction decision — voided") : (ar ? "قرار جزاء — م 71" : "Sanction decision — Art. 71"),
      date: item.signedAt,
      by: item.signedBy || item.decidedBy,
      proof: hash ? proofOf("sealed", ar, { hash }) : proofOf("signed", ar),
      open: { to: "/app/discipline" },
      detail: item.reason || item.note || "",
    });
    if (dateOnly(item.appealedAt) && dateOnly(item.rulingAt) && item.rulingLabel) {
      push("decisions", {
        id: `ruling-${item.id || i}`,
        title: ar ? `نتيجة التظلّم: ${item.rulingLabel}` : `Grievance outcome: ${item.rulingLabel}`,
        type: ar ? "قرار في تظلّم — م 72" : "Grievance ruling — Art. 72",
        date: item.rulingAt,
        by: item.rulingBy,
        proof: proofOf("signed", ar),
        open: { to: "/app/discipline" },
      });
    }
  });

  // ── Requests that ended in a paper (طلباتي): issued letters, consents, custody, documents returned.
  let serviceCertificateArchived = false;
  for (const request of employee.otherRequests || []) {
    if (!request) continue;
    const type = request.type;
    const status = String(request.status || "");
    const reviewedAt = request.reviewedAt || request.approvedAt || request.answeredAt || request.decidedAt || request.createdAt;
    const reviewer = request.reviewedBy || request.approvedBy || hr;

    if (isWrittenConsent(request)) {
      if (consentStatus(request) !== "yes") continue;
      const sealId = request.seal?.signatureId || request.verifyId || "";
      const paper = request.paper || {};
      push("acks", {
        id: `consent-${request.id}`,
        title: (ar ? request.titleAr : request.titleEn) || (ar ? "موافقة خطية" : "Written consent"),
        type: ar ? `موافقة خطية${request.citeAr ? ` — ${request.citeAr}` : ""}` : `Written consent${request.citeEn ? ` — ${request.citeEn}` : ""}`,
        date: request.answeredAt || reviewedAt,
        by: me,
        proof: sealId || paper.hash ? proofOf("sealed", ar, { hash: paper.hash, ref: sealId }) : proofOf("signed", ar),
        open: fileUrlOf(paper) ? { href: fileUrlOf(paper) } : { to: consentRowHref(request) },
        verifyHref: verifyHrefOf(sealId) || (paper.hash ? "/verify" : ""),
        downloadUrl: fileUrlOf(paper),
      });
      continue;
    }

    if (status !== "approved") continue;

    if (type === "salary_letter" || type === "employment_letter" || type === "document") {
      const file = request.issuedFile || request.paper || request.senderFile || null;
      const url = fileUrlOf(file) || String(request.documentUrl || "").trim();
      const kindName = request.docKind ? docKindLabel(request.docKind, ar) : "";
      const group = request.docKind === "contract" ? "contracts" : request.docKind === "clear" ? "custody" : "letters";
      if (request.docKind === "exp") serviceCertificateArchived = true;
      const typeLabel = request.docKind === "exp"
        ? (ar ? "شهادة خدمة — م 64" : "Service certificate — Art. 64")
        : request.docKind === "contract"
          ? (ar ? "نسخة العقد — م 51" : "Contract copy — Art. 51")
          : (kindName || otherRequestTypeLabel(type, ar));
      push(group, {
        id: `letter-${request.id}`,
        title: request.title || kindName || fileNameOf(file) || otherRequestTypeLabel(type, ar),
        type: typeLabel,
        date: file?.at || reviewedAt,
        by: reviewer,
        proof: request.verifyId || file?.hash ? proofOf("sealed", ar, { hash: file?.hash, ref: request.verifyId }) : proofOf("signed", ar),
        open: url ? { href: url } : { to: "/app/requests/archive" },
        verifyHref: verifyHrefOf(request.verifyId) || (file?.hash ? "/verify" : ""),
        downloadUrl: url,
      });
      continue;
    }
    if (type === STUDY_CONSENT_TYPE) {
      const file = request.issuedFile || request.approvalFile;
      if (!file || !(fileUrlOf(file) || fileNameOf(file))) continue;
      push("letters", {
        id: `study-${request.id}`,
        title: fileNameOf(file) || (ar ? "الموافقة الدراسية" : "Study consent"),
        type: ar ? "موافقة دراسية — م 115" : "Study consent — Art. 115",
        date: file.at || reviewedAt,
        by: reviewer,
        proof: file.hash ? proofOf("sealed", ar, { hash: file.hash }) : proofOf("uploaded", ar),
        open: fileUrlOf(file) ? { href: fileUrlOf(file) } : null,
        verifyHref: file.hash ? "/verify" : "",
        downloadUrl: fileUrlOf(file),
      });
      continue;
    }
    if (type === "custody") {
      const file = request.paper || request.issuedFile || request.senderFile || null;
      const url = fileUrlOf(file) || String(request.documentUrl || "").trim();
      push("custody", {
        id: `custody-req-${request.id}`,
        title: request.title || fileNameOf(file) || (ar ? "إقرار عهدة" : "Custody acknowledgement"),
        type: ar ? "إقرار عهدة موقّع" : "Signed custody acknowledgement",
        date: file?.at || reviewedAt,
        by: me,
        proof: request.verifyId || file?.hash ? proofOf("sealed", ar, { hash: file?.hash, ref: request.verifyId }) : proofOf("ack", ar),
        open: url ? { href: url } : { to: "/app/requests/archive" },
        verifyHref: verifyHrefOf(request.verifyId) || (file?.hash ? "/verify" : ""),
        downloadUrl: url,
      });
      continue;
    }
    if (type === DOCUMENTS_RETURN_TYPE) {
      push("custody", {
        id: `docs-return-${request.id}`,
        title: ar ? "إعادة الوثائق المودعة" : "Deposited documents returned",
        type: ar ? "محضر إعادة — م 64" : "Return record — Art. 64",
        date: reviewedAt,
        by: reviewer,
        proof: proofOf("signed", ar),
        open: { to: "/app/requests/archive" },
      });
    }
  }
  if (p.contractExit?.serviceCertificateIssued) serviceCertificateArchived = true;

  // ── Certificates and copies attached to the file.
  if (p.salaryCertificateUrl) {
    push("letters", {
      id: "salary-certificate",
      title: p.salaryCertificateName || (ar ? "شهادة الراتب" : "Salary certificate"),
      type: ar ? "شهادة راتب" : "Salary certificate",
      date: p.salaryCertificateAt || "",
      proof: proofOf("uploaded", ar),
      open: { href: p.salaryCertificateUrl },
      downloadUrl: p.salaryCertificateUrl,
    });
  }
  (employee.certificates || []).forEach((cert, i) => {
    if (!cert || /reject|مرفوض/i.test(String(cert.status || ""))) return;
    const url = fileUrlOf(cert);
    const approved = Boolean(cert.approvedAt) || /approv|معتمد/i.test(String(cert.status || ""));
    if (!cert.fileHash && !url && !approved) return;
    push("letters", {
      id: `cert-${cert.id || i}`,
      title: cert.name || (ar ? "شهادة مهنية" : "Professional certificate"),
      type: ar ? "شهادة مهنية أو تدريبية" : "Professional or training certificate",
      date: cert.issueDate || cert.approvedAt || cert.createdAt,
      by: cert.approvedBy || cert.by,
      proof: cert.fileHash ? proofOf("sealed", ar, { hash: cert.fileHash }) : url ? proofOf("uploaded", ar) : proofOf("signed", ar),
      open: url ? { href: url } : (profileHref ? { to: `${profileHref}?tab=identity` } : null),
      verifyHref: cert.fileHash ? "/verify" : "",
      downloadUrl: url,
    });
  });
  (employee.trainings || []).forEach((r, i) => {
    const file = r?.certificate || r?.certificateFile || null;
    const url = fileUrlOf(file) || String(r?.certificateUrl || "").trim();
    if (!url) return;
    push("letters", {
      id: `training-${r.id || i}`,
      title: ar ? `شهادة «${r.course || "تدريب"}»` : `Certificate «${r.course || "training"}»`,
      type: ar ? "شهادة تدريب — م 45" : "Training certificate — Art. 45",
      date: r.to || r.documentedAt || r.from,
      by: r.provider || r.documentedBy,
      proof: file?.hash ? proofOf("sealed", ar, { hash: file.hash }) : proofOf("uploaded", ar),
      open: { href: url },
      downloadUrl: url,
    });
  });
  (Array.isArray(employee.docs) ? employee.docs : []).forEach((d, i) => {
    const url = fileUrlOf(d);
    if (!url) return;
    const label = DOC_LABELS[d.kind] || null;
    push("identity", {
      id: `doc-${d.id || d.kind || i}`,
      title: label ? (ar ? label.ar : label.en) : (fileNameOf(d) || (ar ? "وثيقة" : "Document")),
      type: ar ? `نسخة وثيقة${d.number ? ` · ${d.number}` : ""}` : `Document copy${d.number ? ` · ${d.number}` : ""}`,
      date: d.uploadedAt || d.at || d.issueDate || "",
      by: d.uploadedBy || d.by,
      proof: d.hash ? proofOf("sealed", ar, { hash: d.hash }) : proofOf("uploaded", ar),
      open: { href: url },
      downloadUrl: url,
    });
  });
  (Array.isArray(p.qualificationFiles) ? p.qualificationFiles : []).forEach((f, i) => {
    const url = fileUrlOf(f);
    if (!url && !fileNameOf(f)) return;
    push("identity", {
      id: `qualification-${f.id || i}`,
      title: fileNameOf(f) || (ar ? "المؤهل العلمي" : "Qualification"),
      type: ar ? "صورة المؤهل" : "Qualification copy",
      date: f.at || f.createdAt || "",
      proof: f.hash ? proofOf("sealed", ar, { hash: f.hash }) : proofOf("uploaded", ar),
      open: url ? { href: url } : null,
      downloadUrl: url,
    });
  });
  const night = p.nightMedicalReport;
  if (night && (fileUrlOf(night) || fileNameOf(night))) {
    push("identity", {
      id: "night-medical",
      title: fileNameOf(night) || (ar ? "تقرير اللياقة للعمل الليلي" : "Night-work fitness report"),
      type: ar ? "تقرير لياقة طبية — قرار 18632" : "Medical fitness report — decision 18632",
      date: night.issuedAt || night.at || p.nightMedicalIssuedAt || "",
      proof: night.hash ? proofOf("sealed", ar, { hash: night.hash }) : proofOf("uploaded", ar),
      open: fileUrlOf(night) ? { href: fileUrlOf(night) } : null,
      downloadUrl: fileUrlOf(night),
    });
  }

  // ── Custody receipts (Art. 65(2)) and the exit papers.
  (assets || []).filter((a) => String(a.holderId || a.assignedTo || "") === String(employee.id)).forEach((a, i) => {
    const name = a.name || a.title || (ar ? "عهدة" : "custody");
    const ref = a.serial || a.code || "";
    const evidence = String(a.evidenceUrl || "").trim();
    const acked = a.ackAt || a.acknowledgedAt;
    if (acked || evidence) {
      push("custody", {
        id: `custody-in-${a.id || i}`,
        title: ar ? `استلام عهدة «${name}»${ref ? ` (${ref})` : ""}` : `Custody received «${name}»${ref ? ` (${ref})` : ""}`,
        type: ar ? "إقرار استلام" : "Receipt",
        date: acked || a.handedAt || a.assignedAt,
        by: me,
        proof: proofOf("ack", ar),
        open: evidence ? { href: evidence } : null,
        downloadUrl: evidence,
      });
    }
    if (dateOnly(a.returnedAt)) {
      const by = a.receivedBy || a.returnedBy || "";
      push("custody", {
        id: `custody-out-${a.id || i}`,
        title: ar ? `إعادة عهدة «${name}»${ref ? ` (${ref})` : ""}` : `Custody returned «${name}»${ref ? ` (${ref})` : ""}`,
        type: ar ? "محضر إعادة" : "Return record",
        date: a.returnedAt,
        by,
        proof: by ? proofOf("signed", ar) : proofOf("ack", ar),
      });
    }
  });
  const exit = p.contractExit;
  if (exit) {
    const asked = exit.resignationSubmittedAt || exit.noticeAt || exit.noticeGivenAt || exit.noticeGivenDate;
    if (dateOnly(asked)) {
      const worker = exit.party === "worker" || exit.reason === "resignation";
      push("custody", {
        id: "exit-notice",
        title: exit.reason === "resignation" ? (ar ? "خطاب الاستقالة" : "Resignation letter") : (ar ? "إشعار إنهاء العقد" : "Notice ending the contract"),
        type: ar ? "إنهاء العلاقة التعاقدية" : "End of the employment relationship",
        date: asked,
        by: worker ? me : (exit.by || hr),
        proof: proofOf("signed", ar),
      });
    }
    const evidence = [...(Array.isArray(exit.evidenceFiles) ? exit.evidenceFiles : []), ...(exit.evidenceName ? [exit.evidenceName] : [])];
    evidence.forEach((f, i) => {
      const name = typeof f === "string" ? f : fileNameOf(f);
      const url = typeof f === "string" ? "" : fileUrlOf(f);
      if (!name && !url) return;
      push("custody", {
        id: `exit-evidence-${i}`,
        title: name || (ar ? "مستند إنهاء العقد" : "Exit document"),
        type: ar ? "مستند مرفق بالإنهاء" : "Attached to the exit",
        date: (typeof f === "object" && f?.at) || exit.decidedAt || exit.effectiveDate || "",
        by: exit.by || hr,
        proof: proofOf("uploaded", ar),
        open: url ? { href: url } : null,
        downloadUrl: url,
      });
    });
  }

  // ── Acknowledgements: the work regulation (model Art. 3(3)) and papers he signed on the signing desk.
  const regAck = regulation?.acks?.[employee.id];
  if (regAck?.at) {
    const version = regulationVersion(regulation);
    const current = !version || String(regAck.version || "") === version;
    push("acks", {
      id: "regulation-ack",
      title: ar ? `الإقرار بالاطلاع على لائحة تنظيم العمل${current ? "" : " (نسخة سابقة)"}` : `Work regulation acknowledged${current ? "" : " (earlier version)"}`,
      type: ar ? "إقرار — اللائحة النموذجية م 3" : "Acknowledgement — model Art. 3",
      date: regAck.at,
      by: regAck.name || me,
      proof: proofOf("ack", ar),
      open: { to: "/app/discipline?tab=schedule" },
    });
  }
  const email = String(employee.email || "").trim().toLowerCase();
  for (const record of signatureRequests || []) {
    if (!record || isDeletedRequest(record) || !isRegistrable(record.status) || isRequestSigningPackage(record)) continue;
    const signer = (record.signers || []).find((s) => (
      (s.employeeId && String(s.employeeId) === String(employee.id))
      || (email && String(s.email || "").trim().toLowerCase() === email)
    ));
    if (!signer || signer.status !== "signed") continue;
    const name = String(record.fileName || record.title || "").replace(/\.pdf$/i, "").trim();
    push("acks", {
      id: `signing-${record.id}`,
      title: name || (ar ? "مستند موقّع" : "Signed document"),
      type: ar ? "مستند موقّع رقمياً" : "Digitally signed document",
      date: signer.signedAt || record.releasedAt || record.lastActivityAt,
      by: record.creatorName || hr,
      proof: proofOf("sealed", ar, { hash: record.finalHash || signer.documentHash, ref: record.verificationId }),
      open: { to: "/app/signing" },
      verifyHref: verifyHrefOf(record.verificationId) || "/verify",
      downloadUrl: String(record.finalDocUrl || record.docUrl || "").trim(),
    });
  }
  for (const doc of signedDocuments || []) {
    const owner = doc?.employeeId || doc?.subjectEmployeeId || doc?.subjectId;
    if (!owner || String(owner) !== String(employee.id)) continue;
    push("acks", {
      id: `sealed-${doc.id}`,
      title: doc.title || (ar ? "مستند مختوم" : "Sealed document"),
      type: ar ? "مستند مختوم" : "Sealed document",
      date: doc.signedAt || doc.createdAt,
      by: doc.signedBy || hr,
      proof: proofOf("sealed", ar, { hash: doc.fileHash || doc.hash, ref: doc.sealId }),
      open: { to: "/app/signing" },
      verifyHref: verifyHrefOf(doc.sealId) || "/verify",
      downloadUrl: String(doc.url || doc.fileUrl || "").trim(),
    });
  }

  // ── What the law expects on the file and is not archived — manager view only, one muted line each.
  const missing = [];
  if (managerView) {
    if (!items.some((row) => row.group === "contracts")) {
      missing.push({
        id: "missing-contract",
        group: "contracts",
        title: ar ? "عقد العمل المكتوب" : "Written employment contract",
        note: ar ? "غير مؤرشف" : "Not archived",
        hint: contractHint(employee, { view: "manager", ar, today: day, to: contractTo }),
      });
    }
    const end = dateOnly(p.contractExit?.effectiveDate || p.contractExit?.lastDay);
    if (end && end <= day && !serviceCertificateArchived) {
      missing.push({
        id: "missing-service-certificate",
        group: "letters",
        title: ar ? "شهادة الخدمة" : "Service certificate",
        note: ar ? "غير مؤرشف" : "Not archived",
        hint: serviceCertificateHint(employee, { view: "manager", ar, today: day, to: "/app/requests/manage" }),
      });
    }
  }

  // Newest first inside a group; undated last. One line per id.
  const seen = new Set();
  const unique = items.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
  const groups = ARCHIVE_GROUPS.map((g) => ({
    id: g.id,
    label: ar ? g.ar : g.en,
    items: unique
      .filter((row) => row.group === g.id)
      .sort((a, b) => (b.date ? 1 : 0) - (a.date ? 1 : 0) || String(b.date).localeCompare(String(a.date))),
    missing: missing.filter((row) => row.group === g.id),
  })).filter((g) => g.items.length || g.missing.length);

  return { groups, count: unique.length, empty: unique.length === 0 && missing.length === 0, emptyLine };
}

/** Type filter + text search inside the tab. Empty groups drop out. */
export function filterFileArchive(archive, { group = "all", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  const match = (row) => !q || [row.title, row.type, row.by, row.at, row.proof?.ref, row.detail]
    .some((v) => String(v || "").toLowerCase().includes(q));
  return (archive?.groups || [])
    .filter((g) => group === "all" || g.id === group)
    .map((g) => ({ ...g, items: g.items.filter(match), missing: q ? g.missing.filter(match) : g.missing }))
    .filter((g) => g.items.length || g.missing.length);
}
