import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import SectionBackLink from "@/components/shared/SectionBackLink";
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { MARK_GLYPHS, isMarkField, signPdfFile } from "@/lib/signPdf";
import {
  deleteFieldTemplate,
  detectFieldSpots,
  listFieldTemplates,
  saveFieldTemplate,
} from "@/lib/signingFieldTools";
import { sha256HexOfBuffer } from "@/lib/fileHash";
import { registerLocalSignedDoc } from "@/lib/localSignedDocs";
import { invokeLocalMultiSign, shouldUseLocalMultiSign } from "@/lib/localMultiSignFallback";
import { createGateMessage, MAX_PARALLEL_SIGNERS } from "@/lib/multiSignDerivations";
import { isServiceOutage, refusalError } from "@/lib/serviceErrors";
import { generateVerificationId, loadBadgeQr, verificationUrlFor } from "@/lib/verificationBadge";
import { OFFICIAL_STAMP_THEME } from "@/lib/signatureStampThemes";
import { renderStampDataUrl, stampAspect } from "@/lib/stampStudio";
import { appParams } from "@/lib/app-params";
import SigningWorkspacePages, { SigningWorkspaceThumbs, useSigningPdf } from "@/components/files/SigningWorkspacePages";
import SigningFinishDialog from "@/components/files/SigningFinishDialog";
import SigningStepRail from "@/components/files/SigningStepRail";
import { signGhostBtn, signMono as mono, signPrimaryBtn } from "@/components/files/signingUi";
import SignMarkGlyph from "@/components/files/SignMarkGlyph";
import { BORDER, BRAND, CARD, INK, MUTED, SURFACE } from "@/lib/platformStyles";
const SIGNER_COLORS = ["#1d9a5b", "#14213d", "#6b7280", "#8a6516"];

const TOOLS = [
  { id: "sig", type: "signature", glyph: "SIG", ar: "توقيع", en: "Signature", scale: 100 },
  { id: "txt", type: "text", glyph: "TXT", ar: "نص حر", en: "Free text", scale: 100 },
  { id: "date", type: "text", glyph: "DD/MM", ar: "التاريخ", en: "Date", scale: 70 },
  { id: "name", type: "text", glyph: "Aa", ar: "الاسم", en: "Name", scale: 100 },
  { id: "role", type: "text", glyph: "TTL", ar: "الصفة", en: "Capacity", scale: 90 },
  { id: "check", type: "text", glyph: "✓", ar: "صح أو خطأ", en: "Check or cross", scale: 50 },
];

const clampPercent = (value) => Math.min(96, Math.max(4, value));
// Arabic counts inflect the noun: one, a dual, a small plural (3–10) and a large one.
const countAr = (n, [one, two, few, many]) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const emailValid = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());

function signingBaseUrl() {
  try {
    if (appParams.appBaseUrl) return String(appParams.appBaseUrl).replace(/\/+$/, "");
  } catch { /* fall through */ }
  return window.location.origin;
}

const chipBtn = {
  fontFamily: "inherit",
  fontSize: 11,
  padding: "5px 9px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: INK,
  cursor: "pointer",
  lineHeight: 1.4,
};

const iconBtn = {
  fontFamily: "inherit",
  width: 26,
  height: 26,
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: INK,
  cursor: "pointer",
  lineHeight: 1,
};

export default function SigningWorkspace({
  file,
  sourceUrl,
  currentUser,
  companyId,
  employees = [],
  canGroup = false,
  sealPreview,
  signatureUrl,
  signatureRawUrl,
  signatureVariant,
  stampConfig,
  ar,
  onOpenStudio,
  onClose,
  onSigned,
}) {
  const { pdf, failed, failReason } = useSigningPdf(file || sourceUrl);
  const stageRef = useRef(null);
  // One verification id per document, never the profile seal id: the registry
  // binds an id to a single file hash forever, so reusing it would reject every
  // document after the first.
  const [docVerificationId] = useState(() => generateVerificationId());
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState("sig");
  const [mark, setMark] = useState(MARK_GLYPHS[0]);
  const [signerIndex, setSignerIndex] = useState(0);
  const [fields, setFields] = useState([]);
  const [textValues, setTextValues] = useState({});
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [activePage, setActivePage] = useState(1);

  useEffect(() => {
    setActivePage(1);
    setIntent(false);
    setLeaveAsk(false);
  }, [file, sourceUrl]);
  const [intent, setIntent] = useState(false);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const consentRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [templates, setTemplates] = useState(() => listFieldTemplates(companyId));
  const [templateName, setTemplateName] = useState("");
  const [naming, setNaming] = useState(false);
  const [editingSigner, setEditingSigner] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [signers, setSigners] = useState(() => [{
    key: "me",
    name: currentUser?.profile?.signatureName || currentUser?.name || "",
    email: currentUser?.email || "",
    contact: ar ? "أنت · صاحب الختم" : "You · seal owner",
    color: SIGNER_COLORS[0],
    external: false,
  }]);

  const pageCount = pdf?.numPages || 0;
  const pageWidth = Math.round(560 * zoom);
  const group = signers.length > 1;
  const activeTool = TOOLS.find((item) => item.id === tool) || TOOLS[0];

  const employeeOptions = useMemo(() => (employees || [])
    .filter((employee) => employee?.email)
    .map((employee) => ({
      id: employee.id || employee.employeeId,
      name: employee.name || "",
      email: String(employee.email).toLowerCase(),
      role: employee.role || "",
      stationId: employee.stationId || null,
    })), [employees]);

  useEffect(() => () => { if (receipt?.downloadUrl) URL.revokeObjectURL(receipt.downloadUrl); }, [receipt?.downloadUrl]);

  const defaultValueFor = useCallback((toolId) => {
    const name = currentUser?.profile?.signatureName || currentUser?.name || "";
    if (toolId === "date") return new Date().toLocaleDateString("en-GB");
    if (toolId === "name") return name;
    if (toolId === "check") return mark;
    return "";
  }, [currentUser, mark]);

  // The palette pair doubles as an editor for the selected mark, so a placed
  // tick can become a cross without deleting and re-placing it.
  const chooseMark = (glyph) => {
    setTool("check");
    setMark(glyph);
    const selected = fields.find((field) => field.id === activeFieldId);
    if (isMarkField(selected) && selected.signer === 0) {
      setTextValues((current) => ({ ...current, [selected.id]: glyph }));
    }
  };

  const makeField = useCallback((item, page, x, y, signer) => ({
    id: `${item.id}-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    tool: item.id,
    type: item.type,
    label: ar ? item.ar : item.en,
    page,
    x: clampPercent(x),
    y: clampPercent(y),
    scale: item.scale,
    signer,
    required: item.type === "text",
  }), [ar]);

  const placeField = (page, point) => {
    const field = makeField(activeTool, page, point.x, point.y, signerIndex);
    setFields((current) => [...current, field]);
    if (activeTool.type === "text" && signerIndex === 0) {
      setTextValues((current) => ({ ...current, [field.id]: defaultValueFor(activeTool.id) }));
    }
    setActiveFieldId(field.id);
  };

  const patchField = (id, patch) => setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  const removeField = (id) => {
    setFields((current) => current.filter((field) => field.id !== id));
    setTextValues((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setActiveFieldId((current) => (current === id ? null : current));
  };

  const cloneField = (source, patch) => ({
    ...source,
    ...patch,
    id: `${source.tool}-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
  });

  const duplicateField = (id) => {
    const source = fields.find((field) => field.id === id);
    if (!source) return;
    const copy = cloneField(source, { x: clampPercent(source.x + 4), y: clampPercent(source.y + 4) });
    setFields((current) => [...current, copy]);
    if (textValues[id] !== undefined) setTextValues((current) => ({ ...current, [copy.id]: textValues[id] }));
    setActiveFieldId(copy.id);
  };

  // Long contracts want the same field or tick on every page — one click
  // instead of one placement per page.
  const repeatOnEveryPage = (id) => {
    const source = fields.find((field) => field.id === id);
    if (!source || pageCount < 2) return;
    const copies = [];
    for (let page = 1; page <= pageCount; page += 1) {
      if (page === source.page) continue;
      const taken = fields.some((field) => field.page === page
        && field.signer === source.signer
        && field.tool === source.tool
        && Math.abs(field.x - source.x) < 2
        && Math.abs(field.y - source.y) < 2);
      if (taken) continue;
      copies.push(cloneField(source, { page }));
    }
    if (!copies.length) {
      setNote(ar ? "الحقل موجود على كل الصفحات بالفعل." : "That field already sits on every page.");
      return;
    }
    setFields((current) => [...current, ...copies]);
    const value = textValues[id];
    if (value !== undefined) {
      setTextValues((current) => {
        const next = { ...current };
        copies.forEach((copy) => { next[copy.id] = value; });
        return next;
      });
    }
    setNote(ar
      ? `نُسخ الحقل إلى ${countAr(copies.length, ["صفحة واحدة", "صفحتين", "صفحات", "صفحة"])}.`
      : `Copied onto ${copies.length} more page${copies.length > 1 ? "s" : ""}.`);
  };

  // Reads the document's own text layer and parks fields next to the labels it
  // finds. A scanned image has no text layer — the empty result says so.
  const suggestSpots = async () => {
    if (!pdf || detecting) return;
    setDetecting(true);
    setNote("");
    try {
      const spots = await detectFieldSpots(pdf);
      const toolFor = { signature: "sig", date: "date", name: "name" };
      const fresh = [];
      for (const spot of spots) {
        const item = TOOLS.find((entry) => entry.id === toolFor[spot.kind]);
        if (!item) continue;
        const taken = [...fields, ...fresh].some((field) => field.page === spot.page
          && field.tool === item.id
          && Math.abs(field.x - spot.x) < 6
          && Math.abs(field.y - spot.y) < 4);
        if (taken) continue;
        fresh.push(makeField(item, spot.page, spot.x, spot.y, signerIndex));
      }
      if (!fresh.length) {
        setNote(ar
          ? "لا مواضع واضحة في نص المستند — قد يكون ممسوحًا ضوئيًا، ضع الحقول يدويًا."
          : "No clear anchors in the document text — it may be a scan, so place the fields by hand.");
        return;
      }
      setFields((current) => [...current, ...fresh]);
      if (signerIndex === 0) {
        setTextValues((current) => {
          const next = { ...current };
          fresh.filter((field) => field.type === "text").forEach((field) => { next[field.id] = defaultValueFor(field.tool); });
          return next;
        });
      }
      setNote(ar
        ? `${countAr(fresh.length, ["موضع واحد مقترح", "موضعان مقترحان", "مواضع مقترحة", "موضعًا مقترحًا"])} لـ${signers[signerIndex]?.name || ""} — احذف ما لا يلزم.`
        : `${fresh.length} suggested spot${fresh.length > 1 ? "s" : ""} for ${signers[signerIndex]?.name || ""} — delete what you don't need.`);
    } finally {
      setDetecting(false);
    }
  };

  const storeTemplate = () => {
    if (!fields.length) return;
    const saved = saveFieldTemplate(companyId, templateName, fields);
    setTemplates(listFieldTemplates(companyId));
    setTemplateName("");
    setNaming(false);
    setNote(saved ? (ar ? `حُفظ القالب «${saved.name}».` : `Saved "${saved.name}".`) : "");
  };

  const applyTemplate = (template) => {
    if (!template || !pageCount) return;
    const placed = template.fields.map((field) => ({
      ...field,
      id: `${field.tool}-${Date.now()}-${Math.round(Math.random() * 1e4)}-${Math.round(Math.random() * 1e3)}`,
      page: Math.min(field.page, pageCount),
      signer: Math.min(field.signer, signers.length - 1),
    }));
    setFields(placed);
    const values = {};
    placed.filter((field) => field.type === "text" && field.signer === 0)
      .forEach((field) => { values[field.id] = defaultValueFor(field.tool); });
    setTextValues(values);
    setActiveFieldId(null);
    setNote(ar
      ? `طُبّق «${template.name}» — ${countAr(placed.length, ["حقل واحد", "حقلان", "حقول", "حقلًا"])}.`
      : `Applied "${template.name}" — ${placed.length} field${placed.length > 1 ? "s" : ""}.`);
  };

  const dropTemplate = (id) => {
    deleteFieldTemplate(companyId, id);
    setTemplates(listFieldTemplates(companyId));
  };

  const selectedField = fields.find((field) => field.id === activeFieldId) || null;

  // The listener binds once; a ref keeps it looking at fresh state and handlers.
  const keyboard = useRef({});
  keyboard.current = { selectedField, duplicateField, removeField, patchField };
  useEffect(() => {
    const onKey = (event) => {
      const { selectedField: field, ...act } = keyboard.current;
      const target = event.target;
      if (!field || target?.isContentEditable) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        act.duplicateField(field.id);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        act.removeField(field.id);
        return;
      }
      const step = event.shiftKey ? 2 : 0.4;
      const nudge = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      }[event.key];
      if (!nudge) return;
      event.preventDefault();
      act.patchField(field.id, { x: clampPercent(field.x + nudge[0]), y: clampPercent(field.y + nudge[1]) });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addSigner = () => {
    setSigners((current) => {
      if (current.length >= MAX_PARALLEL_SIGNERS) return current;
      const index = current.length;
      return [...current, {
        key: `signer-${index}-${Date.now()}`,
        name: "",
        email: "",
        contact: ar ? "بريد الموقّع" : "Signer email",
        color: SIGNER_COLORS[index % SIGNER_COLORS.length],
        external: true,
      }];
    });
    setSignerIndex(signers.length);
    setEditingSigner(signers.length);
  };

  const patchSigner = (index, patch) => setSigners((current) => current.map((signer, position) => (position === index ? { ...signer, ...patch } : signer)));
  const pickEmployee = (index, employeeId) => {
    const employee = employeeOptions.find((item) => String(item.id) === String(employeeId));
    if (!employee) {
      patchSigner(index, { employeeId: null, role: "", stationId: null });
      return;
    }
    patchSigner(index, { name: employee.name, email: employee.email, employeeId: employee.id, role: employee.role, stationId: employee.stationId });
    setEditingSigner(null);
  };
  const removeSigner = (index) => {
    setSigners((current) => current.filter((_, position) => position !== index));
    setFields((current) => current
      .filter((field) => field.signer !== index)
      .map((field) => (field.signer > index ? { ...field, signer: field.signer - 1 } : field)));
    setSignerIndex(0);
    setEditingSigner(null);
  };

  const myFields = useMemo(() => fields.filter((field) => field.signer === 0), [fields]);
  const mySignature = myFields.some((field) => field.type === "signature");
  const everySignerPlaced = signers.every((_, index) => fields.some((field) => field.signer === index && field.type === "signature"));
  const signersValid = signers.every((signer) => signer.name.trim() && emailValid(signer.email));

  // A field marked required must carry a value before the document leaves your
  // hands; the gate names how many are empty and where they sit.
  const missingRequired = myFields.filter((field) => field.type === "text"
    && field.required !== false
    && !String(textValues[field.id] || "").trim());
  const missingReason = missingRequired.length
    ? (() => {
      const pages = [...new Set(missingRequired.map((field) => field.page))].sort((a, b) => a - b);
      const count = countAr(missingRequired.length, ["حقل مطلوب واحد فارغ", "حقلان مطلوبان فارغان", "حقول مطلوبة فارغة", "حقلًا مطلوبًا فارغًا"]);
      return ar
        ? `عندك ${count} — ${pages.length > 1 ? "الصفحات" : "الصفحة"} ${pages.join("، ")}.`
        : `${missingRequired.length} required field${missingRequired.length > 1 ? "s" : ""} of yours ${missingRequired.length > 1 ? "are" : "is"} empty — page${pages.length > 1 ? "s" : ""} ${pages.join(", ")}.`;
    })()
    : "";

  const placeBlock = !pdf
    ? (ar ? "جارٍ فتح المستند…" : "Opening the document…")
    : group
      ? (!signersValid
        ? (ar ? "أكمل اسم وبريد كل موقّع." : "Complete each signer's name and email.")
        : !everySignerPlaced
          ? (ar ? "ضع حقل توقيع لكل موقّع." : "Place a signature field for every signer.")
          : missingReason)
      : !signatureUrl
        ? (ar ? "افتح ستوديو الختم وأنشئ ختمك أولاً." : "Open the stamp studio and create your seal first.")
        : !mySignature
          ? (ar ? "ضع ختمك على الصفحة أولاً." : "Place your seal on the page first.")
          : missingReason;

  const noteVisiblePage = useCallback((page) => {
    const n = Number(page);
    if (!Number.isFinite(n) || n < 1) return;
    setActivePage(n);
  }, []);

  const scrollToPage = (page) => {
    const node = stageRef.current?.querySelector(`[data-signing-page="${page}"]`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
    noteVisiblePage(page);
  };

  const spotsFor = (index) => fields
    .filter((field) => field.signer === index)
    .map((field) => ({
      id: field.id,
      type: field.type,
      tool: field.tool,
      required: field.required !== false,
      label: field.type === "text" ? field.label : "",
      page: field.page,
      x: field.x,
      y: field.y,
      scale: field.scale,
    }));

  const selfSign = async () => {
    const id = docVerificationId;
    const signerName = currentUser?.profile?.signatureName || currentUser?.name || "";
    const anchor = myFields.find((field) => field.type === "signature");
    const qr = await loadBadgeQr(id);
    // Re-render the studio seal against this document's own verification id, so the
    // QR on the page resolves to this file and not to the owner's identity code.
    const stampDataUrl = stampConfig
      ? await renderStampDataUrl(stampConfig, { verificationId: id, verificationUrl: verificationUrlFor(id) })
      : "";
    const { bytes } = await signPdfFile(
      sourceUrl,
      signatureRawUrl || null,
      signerName,
      id,
      anchor,
      qr,
      (anchor?.scale || 100) / 100,
      false,
      myFields,
      textValues,
      signatureVariant,
      OFFICIAL_STAMP_THEME,
      stampDataUrl,
    );
    const fileHash = await sha256HexOfBuffer(bytes);
    const entry = { verificationId: id, fileHash, signerName, signerId: currentUser.id, fileName: file.name };
    const signedUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));

    // Always write the local registry first so Verify on this device can match
    // the exact sealed bytes even when the cloud session cannot register.
    const localReg = registerLocalSignedDoc(companyId, entry);
    let registry = localReg.ok ? "local" : "none";
    let registryNote = localReg.ok
      ? ""
      : (ar ? "تعذّر حفظ البصمة على هذا الجهاز." : "Couldn't store the fingerprint on this device.");
    try {
      await base44.functions.invoke("signedDocs", {
        action: "register",
        ...entry,
        companyId,
        sessionToken: getCompanyToken(companyId),
      });
      registry = "company";
      registryNote = "";
    } catch (err) {
      const reason = err?.response?.data?.error || err?.message || "";
      if (String(reason).includes("SIGNATURE_REUSE")) throw err;
      if (localReg.ok) {
        registry = "local";
        registryNote = ar
          ? `سُجّلت البصمة على هذا الجهاز — سجل الشركة لم يقبل الطلب (${reason}).`
          : `Fingerprint stored on this device — the company registry refused the call (${reason}).`;
      } else {
        registry = "none";
        registryNote = ar
          ? `تعذّر التسجيل (${reason}) — احتفظ بالبصمة أدناه يدويًا.`
          : `Registration failed (${reason}) — keep the fingerprint below yourself.`;
      }
    }

    const actor = {
      id: currentUser.id,
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email || "",
      role: currentUser.role || "",
      stationId: currentUser.stationId || null,
      companyId,
    };
    const selfEmail = String(currentUser.email || signers[0]?.email || "").trim().toLowerCase();
    if (emailValid(selfEmail)) {
      invokeLocalMultiSign({
        action: "selfSign",
        companyId,
        fileName: file.name,
        verificationId: id,
        fileHash,
        docUrl: signedUrl,
        signers: [{
          name: signerName,
          email: selfEmail,
          employeeId: currentUser.id,
          role: currentUser.role || "",
          stationId: currentUser.stationId || null,
          spots: spotsFor(0),
        }],
      }, { actor, employees });
    }

    setReceipt({
      kind: "self",
      registry,
      registryNote,
      verificationId: id,
      fileHash,
      date: new Date().toLocaleDateString("en-GB"),
      downloadUrl: signedUrl,
      downloadName: `${file.name.replace(/\.(pdf|png)$/i, "")}-signed.pdf`,
      verifyUrl: registry === "company" ? verificationUrlFor(id) : "",
    });
    onSigned?.({ signatureId: id, timestamp: new Date().toISOString(), verified: true });
  };

  const groupSend = async () => {
    const verificationId = generateVerificationId();
    const payload = {
      action: "create",
      companyId,
      sessionToken: getCompanyToken(companyId),
      creatorId: currentUser.id,
      creatorName: currentUser.name,
      creatorEmail: currentUser.email || "",
      fileName: file.name,
      verificationId,
      signatureTheme: OFFICIAL_STAMP_THEME,
      signers: signers.map((signer, index) => ({
        name: signer.name.trim(),
        email: signer.email.trim(),
        employeeId: signer.employeeId || (index === 0 ? currentUser.id : null),
        role: signer.role || (index === 0 ? currentUser.role || "" : ""),
        stationId: signer.stationId || (index === 0 ? currentUser.stationId || null : null),
        signatureUrl: index === 0 ? signatureUrl || "" : "",
        external: Boolean(signer.external),
        spots: spotsFor(index),
      })),
      appUrl: signingBaseUrl(),
      lang: ar ? "ar" : "en",
    };
    const actor = {
      id: currentUser.id,
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email || "",
      role: currentUser.role || "",
      stationId: currentUser.stationId || null,
      companyId,
    };
    let body;
    if (shouldUseLocalMultiSign()) {
      body = invokeLocalMultiSign({ ...payload, docUrl: sourceUrl || "" }, { actor, employees });
    } else {
      try {
        const { file_url: docUrl } = await base44.integrations.Core.UploadFile({ file });
        const response = await base44.functions.invoke("multiSign", { ...payload, docUrl });
        body = response?.data || response;
      } catch (err) {
        // A refused request — the account may not raise this package — is not an
        // outage: creating it on the local ledger would hand out signing links the
        // server just declined to issue.
        if (!isServiceOutage(err)) throw refusalError(err);
        body = invokeLocalMultiSign({ ...payload, docUrl: sourceUrl || "" }, { actor, employees });
        if (body?.error) throw err;
      }
    }
    if (body?.error) throw new Error(createGateMessage(body.error, ar) || body.reason || body.error);
    const links = Object.entries(body.links || {}).map(([email, url]) => ({
      email,
      url,
      name: signers.find((signer) => signer.email.trim().toLowerCase() === email.toLowerCase())?.name || email,
    }));
    const receiptBody = {
      kind: "group",
      verificationId,
      links,
      local: !!body.local,
      requestId: body.requestId || "",
      createdAt: new Date().toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh" }),
    };
    setReceipt(receiptBody);
    onSigned?.(receiptBody);
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      if (group) await groupSend();
      else await selfSign();
    } catch (err) {
      const raw = err?.response?.data?.error || err?.message || "";
      setError(createGateMessage(raw, ar) || (ar ? "تعذّر إكمال العملية — " : "Couldn't complete — ") + raw);
    } finally {
      setBusy(false);
    }
  };

  const signed = group ? everySignerPlaced : Boolean(signatureUrl && mySignature);
  const consentReady = signed && !missingReason && Boolean(pdf);
  const proceedBlock = placeBlock
    || (!group && !intent ? (ar ? "أشّر على الإقرار في الشريط الجانبي أولاً." : "Tick the acknowledgement in the side rail first.") : "");
  const canConfirm = !proceedBlock;

  useEffect(() => {
    if (!consentReady && intent) setIntent(false);
  }, [consentReady, intent]);

  const focusConsent = () => {
    consentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const refuseAdvance = (reason) => {
    focusConsent();
    setError(reason || proceedBlock || (ar ? "لا انتقال إلى التسجيل إلا بعد التوقيع." : "Registry opens only after you sign."));
  };
  const requestLeave = () => {
    if (busy) return;
    if (receipt || (!fields.length && !intent)) {
      onClose?.();
      return;
    }
    setLeaveAsk(true);
  };
  const step = receipt ? 3 : (consentReady ? 2 : 1);
  const steps = [
    { number: 1, label: ar ? "الحقول" : "Fields" },
    { number: 2, label: ar ? "الإقرار" : "Consent", onClick: () => focusConsent() },
    {
      number: 3,
      label: ar ? "التسجيل" : "Registry",
      onClick: receipt ? undefined : () => refuseAdvance(signed
        ? proceedBlock
        : (ar ? "لا انتقال إلى التسجيل إلا بعد التوقيع." : "Registry opens only after you sign.")),
    },
  ].map((item) => ({
    ...item,
    done: item.number === 3 ? Boolean(receipt) : (receipt || (item.number === 1 && consentReady) || (item.number === 2 && canConfirm)),
    current: step === item.number,
  }));

  const fileMeta = [
    file?.name,
    pageCount ? (ar ? countAr(pageCount, ["صفحة واحدة", "صفحتان", "صفحات", "صفحة"]) : `${pageCount} page${pageCount > 1 ? "s" : ""}`) : null,
    file?.size ? `${Math.round(file.size / 1024)} KB` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className="nv-signing-workspace nv-sign-frame"
      style={{
        display: "grid",
        gridTemplateRows: "56px minmax(0, 1fr)",
        height: "calc(100dvh - 132px)",
        minHeight: 520,
        background: "#fafbfc",
        border: "1px solid #dfe3ea",
        borderRadius: 14,
        boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
        overflow: "hidden",
        fontSize: 13,
        color: "#14213d",
        width: "min(1320px, 100%)",
        margin: "0 auto",
      }}
    >
      <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 16, padding: "0 16px", minWidth: 0 }}>
        <SectionBackLink
          ar={ar}
          label={ar ? "التوقيع الرقمي" : "Digital signing"}
          onClick={requestLeave}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file?.name?.replace(/\.[^.]+$/, "") || (ar ? "مستند" : "Document")}
          </span>
          <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED, textAlign: ar ? "right" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {fileMeta}
          </span>
        </div>

        <div style={{ marginInlineStart: "auto" }}>
          <SigningStepRail className="nv-signing-steps-rail" steps={steps} />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: "none" }}>
          <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
            {ar
              ? countAr(fields.length, ["حقل واحد", "حقلان", "حقول", "حقلًا"])
              : `${fields.length} field${fields.length === 1 ? "" : "s"}`}
          </span>
          <button
            type="button"
            onClick={() => {
              if (canConfirm) {
                setError("");
                confirm();
              } else {
                refuseAdvance();
              }
            }}
            disabled={busy}
            title={proceedBlock || undefined}
            style={{
              ...signPrimaryBtn,
              cursor: !canConfirm || busy ? "not-allowed" : "pointer",
              opacity: !canConfirm || busy ? 0.45 : 1,
            }}
          >
            {group ? (ar ? "إرسال للتوقيع" : "Send for signature") : (ar ? "إنهاء وتوقيع" : "Finish and sign")}
          </button>
        </div>
      </header>

      <div className="nv-signing-workspace-body" style={{ display: "grid", gridTemplateColumns: "288px minmax(0, 1fr) 120px", minHeight: 0 }}>
        <aside style={{ background: CARD, borderInlineEnd: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", minHeight: 0, overflow: "auto" }}>
          <div style={{ padding: "16px 16px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{ar ? "الحقول" : "Fields"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
              {ar
                ? "اختر حقلاً ثم اضغط على الصفحة لوضعه، أو اسحبه لتحريكه. علامة صح أو خطأ تنقلب بضغطة عليها."
                : "Pick a field, click the page to place it, drag to move it. A tick flips to a cross with one click."}
            </span>
          </div>

          <div style={{ padding: "6px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {TOOLS.map((item) => {
              const on = tool === item.id;
              const tile = {
                fontFamily: "inherit",
                fontSize: 12,
                padding: "10px 8px",
                borderRadius: 10,
                border: `1px solid ${on ? "#14213d" : BORDER}`,
                background: on ? SURFACE : CARD,
                color: INK,
                fontWeight: on ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              };
              if (item.id === "check") {
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setTool(item.id)}
                    onKeyDown={(event) => { if (event.key === "Enter") setTool(item.id); }}
                    style={tile}
                  >
                    <span style={{ display: "inline-flex", borderRadius: 4, overflow: "hidden", border: `1.5px solid ${on ? "var(--nv-navy, #14284B)" : MUTED}` }}>
                      {MARK_GLYPHS.map((glyph, index) => {
                        const picked = on && mark === glyph;
                        return (
                          <button
                            key={glyph}
                            type="button"
                            aria-pressed={picked}
                            aria-label={glyph === "✓" ? (ar ? "علامة صح" : "Tick") : (ar ? "علامة إلغاء" : "Cross")}
                            onClick={(event) => { event.stopPropagation(); chooseMark(glyph); }}
                            style={{
                              fontFamily: "inherit",
                              width: 25,
                              height: 22,
                              padding: 0,
                              border: "none",
                              borderInlineStart: index ? `1.5px solid ${on ? "var(--nv-navy, #14284B)" : MUTED}` : "none",
                              background: picked ? "var(--nv-navy, #14284B)" : "transparent",
                              color: picked ? "#fff" : MUTED,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <SignMarkGlyph glyph={glyph} size={12} color="currentColor" />
                          </button>
                        );
                      })}
                    </span>
                    {ar ? item.ar : item.en}
                  </div>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(item.id)}
                  style={tile}
                >
                  <span style={{
                    width: 34,
                    height: 22,
                    borderRadius: 4,
                    border: `1.5px ${on ? "solid" : "dashed"} ${on ? "var(--nv-navy, #14284B)" : MUTED}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    ...mono,
                    color: on ? INK : MUTED,
                  }}
                  >
                    {item.glyph}
                  </span>
                  {ar ? item.ar : item.en}
                </button>
              );
            })}
          </div>

          {selectedField ? (
            <div style={{ margin: "10px 12px 0", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 8, background: SURFACE }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                {selectedField.tool === "txt" ? (
                  // A free field is only useful if it can say what it wants — the
                  // label is the prompt the other signer reads on the page.
                  <input
                    className="nv-signing-field"
                    value={selectedField.label}
                    onChange={(event) => patchField(selectedField.id, { label: event.target.value })}
                    placeholder={ar ? "سمِّ الحقل — مثال: رقم الهوية" : "Name the field — e.g. ID number"}
                    style={{ flex: 1, minWidth: 0, fontWeight: 600 }}
                  />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedField.label}</span>
                )}
                <span dir="ltr" style={{ ...mono, fontSize: 10, color: MUTED, flex: "none" }}>P{selectedField.page} · {selectedField.scale}%</span>
              </div>
              {selectedField.type === "text" ? (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedField.required !== false}
                    onChange={(event) => patchField(selectedField.id, { required: event.target.checked })}
                  />
                  {ar ? "مطلوب قبل الإرسال" : "Required before sending"}
                </label>
              ) : null}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" style={chipBtn} onClick={() => duplicateField(selectedField.id)}>
                  {ar ? "نسخة" : "Duplicate"}
                </button>
                {pageCount > 1 ? (
                  <button type="button" style={chipBtn} onClick={() => repeatOnEveryPage(selectedField.id)}>
                    {ar ? "على كل الصفحات" : "On every page"}
                  </button>
                ) : null}
                <button type="button" style={chipBtn} onClick={() => removeField(selectedField.id)}>
                  {ar ? "حذف" : "Delete"}
                </button>
              </div>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                {ar
                  ? "الأسهم تحرّك الحقل، Shift خطوة أكبر، Ctrl+D ينسخه، Delete يحذفه."
                  : "Arrows nudge it, Shift for a bigger step, Ctrl+D copies, Delete removes."}
              </span>
            </div>
          ) : null}

          <div style={{ padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: 7 }}>
            <button
              type="button"
              onClick={suggestSpots}
              disabled={!pdf || detecting}
              style={{ ...chipBtn, fontSize: 12, padding: "7px 10px", opacity: !pdf || detecting ? 0.5 : 1, cursor: !pdf || detecting ? "wait" : "pointer" }}
            >
              {detecting
                ? (ar ? "جارٍ قراءة نص المستند…" : "Reading the document text…")
                : (ar ? "اقترح مواضع من نص المستند" : "Suggest spots from the document text")}
            </button>

            {naming ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  className="nv-signing-field"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") storeTemplate(); if (event.key === "Escape") setNaming(false); }}
                  placeholder={ar ? "اسم القالب" : "Template name"}
                  style={{ flex: 1, minWidth: 0, fontFamily: "inherit", fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, padding: "5px 8px", outline: "none", color: INK }}
                />
                <button type="button" style={chipBtn} onClick={storeTemplate}>{ar ? "حفظ" : "Save"}</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                disabled={!fields.length}
                style={{ ...chipBtn, fontSize: 12, padding: "7px 10px", opacity: fields.length ? 1 : 0.5 }}
              >
                {ar ? "احفظ هذا التوزيع كقالب" : "Save this layout as a template"}
              </button>
            )}

            {templates.length ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {templates.map((template) => (
                    <span key={template.id} style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: CARD }}>
                      <button
                        type="button"
                        onClick={() => applyTemplate(template)}
                        style={{ fontFamily: "inherit", fontSize: 11, padding: "4px 8px", border: "none", background: "none", color: INK, cursor: "pointer" }}
                      >
                        {template.name} · {template.fields.length}
                      </button>
                      <button
                        type="button"
                        aria-label={ar ? "حذف القالب" : "Delete template"}
                        onClick={() => dropTemplate(template.id)}
                        style={{ fontFamily: "inherit", fontSize: 12, lineHeight: 1, padding: "4px 7px", border: "none", borderInlineStart: `1px solid ${BORDER}`, background: "none", color: MUTED, cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                  {ar ? "تطبيق قالب يستبدل الحقول الموضوعة الآن." : "Applying a template replaces the fields placed now."}
                </span>
              </>
            ) : null}

            {note ? <span style={{ fontSize: 11, color: BRAND, lineHeight: 1.6 }}>{note}</span> : null}
          </div>

          <div style={{ padding: "16px 16px 4px", marginTop: 10, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>{ar ? "الموقّعون" : "Signers"}</span>
            {canGroup && signers.length < MAX_PARALLEL_SIGNERS ? (
              <button type="button" onClick={addSigner} style={{ fontFamily: "inherit", fontSize: 12, background: "none", border: "none", color: INK, cursor: "pointer", textDecoration: "underline" }}>
                {ar ? "إضافة موقّع" : "Add signer"}
              </button>
            ) : null}
          </div>
          <p style={{ margin: 0, padding: "0 16px 10px", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            {group
              ? (ar
                ? `${countAr(signers.length, ["موقّع واحد", "موقّعان", "موقّعين", "موقّعًا"])} — يصل كل واحد رابطه الخاص ويوقّع متى شاء بلا ترتيب. ولو رفض أحدهم يواصل الباقون.`
                : `${signers.length} signers — each gets a private link and may sign first. If one refuses the rest carry on.`)
              : (ar
                ? "أنت وحدك الآن. أضف موقّعًا لتحويله إلى مستند متعدد الأطراف."
                : "Just you for now. Add a signer to turn this into a multi-party document.")}
          </p>

          <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {signers.map((signer, index) => {
              const on = signerIndex === index;
              const count = fields.filter((field) => field.signer === index).length;
              // The creator's row turns editable when group sending needs an email we don't have.
              const editable = signer.external || (group && !emailValid(signer.email));
              // Once a signer is named and reachable the row folds back to the same
              // one-line shape as yours; "تغيير" reopens it.
              const known = signer.name.trim() && emailValid(signer.email);
              const editing = editable && (editingSigner === index || !known);
              return (
                <div
                  key={signer.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSignerIndex(index)}
                  onKeyDown={(event) => { if (event.key === "Enter") setSignerIndex(index); }}
                  style={{
                    textAlign: "start",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${on ? "#14213d" : BORDER}`,
                    background: on ? SURFACE : CARD,
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "10px minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: signer.color }} />
                  <span style={{ display: "flex", flexDirection: "column", gap: editing ? 5 : 3, minWidth: 0 }}>
                    {editing ? (
                      <>
                        {employeeOptions.length ? (
                          <select
                            className="nv-signing-field"
                            value={signer.employeeId || ""}
                            onChange={(event) => pickEmployee(index, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            style={{ fontFamily: "inherit", border: `1px solid ${BORDER}`, background: CARD, outline: "none", color: signer.employeeId ? INK : MUTED, maxWidth: "100%" }}
                          >
                            <option value="">{ar ? "من الفريق أو بريد خارجي…" : "From the team, or an external email…"}</option>
                            {employeeOptions.map((employee) => (
                              <option key={employee.id} value={employee.id}>{employee.name}</option>
                            ))}
                          </select>
                        ) : null}
                        <input
                          className="nv-signing-inline nv-signing-inline--underline"
                          value={signer.name}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => patchSigner(index, { name: event.target.value })}
                          placeholder={ar ? "اسم الموقّع" : "Signer name"}
                          style={{ fontFamily: "inherit", fontSize: 13, outline: "none", color: INK }}
                        />
                        <input
                          dir="ltr"
                          className="nv-signing-inline nv-signing-inline--underline"
                          value={signer.email}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => patchSigner(index, { email: event.target.value, employeeId: null, role: "", stationId: null })}
                          onBlur={() => { if (known) setEditingSigner(null); }}
                          placeholder="name@example.com"
                          list="nv-signing-emails"
                          style={{ ...mono, fontSize: 11, outline: "none", color: MUTED, textAlign: ar ? "right" : "left" }}
                        />
                      </>
                    ) : (
                      <>
                        <span style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signer.name}</span>
                        <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED, textAlign: ar ? "right" : "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {signer.external ? signer.email : signer.contact}
                        </span>
                      </>
                    )}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {editable && !editing ? (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setEditingSigner(index); }}
                        style={{ fontFamily: "inherit", border: "none", background: "none", color: MUTED, cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}
                      >
                        {ar ? "تغيير" : "Change"}
                      </button>
                    ) : null}
                    <span style={{ ...mono, fontSize: 11, color: MUTED }}>{count}</span>
                    {signer.external ? (
                      <button
                        type="button"
                        aria-label={ar ? "حذف الموقّع" : "Remove signer"}
                        onClick={(event) => { event.stopPropagation(); removeSigner(index); }}
                        style={{ fontFamily: "inherit", border: "none", background: "none", color: MUTED, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
            <datalist id="nv-signing-emails">
              {employees.filter((employee) => employee?.email).map((employee) => (
                <option key={employee.id} value={employee.email}>{employee.name}</option>
              ))}
            </datalist>
          </div>

          <div style={{ marginTop: "auto", padding: "14px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, color: MUTED }}>{ar ? "ختمك المحفوظ — لكل إرسال وللمنصة" : "Your saved seal — send and platform"}</span>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 10px", background: SURFACE, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 10, alignItems: "center" }}>
              {sealPreview || signatureUrl ? (
                <img src={sealPreview || signatureUrl} alt="" style={{ width: 46, height: 34, objectFit: "contain" }} />
              ) : (
                <span style={{ width: 46, height: 34, borderRadius: 10, border: `1px dashed ${BORDER}`, display: "inline-block" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 13, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentUser?.profile?.signatureName || currentUser?.name}
                </span>
                <span dir="ltr" style={{ ...mono, fontSize: 9, color: signatureUrl ? BRAND : MUTED, textAlign: ar ? "right" : "left" }}>
                  {signatureUrl ? docVerificationId : (ar ? "بلا ختم" : "no seal")}
                </span>
              </div>
            </div>
            {onOpenStudio ? (
              <button type="button" onClick={onOpenStudio} style={{ ...signGhostBtn, width: "100%" }}>
                {signatureUrl ? (ar ? "ستوديو الختم — تعديل" : "Stamp studio — edit") : (ar ? "فتح ستوديو الختم" : "Open stamp studio")}
              </button>
            ) : null}

            <div ref={consentRef} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
              <span style={{ fontWeight: 600 }}>{ar ? "الإقرار" : "Consent"}</span>
              {group ? (
                <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                  {ar
                    ? "يُرسَل رابط خاص لكل موقّع. لا ترتيب: أي طرف يوقّع أولًا أو ثانيًا أو ثالثًا."
                    : "Each signer gets a private link. No queue: any party may sign first, second, or third."}
                </p>
              ) : (
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: consentReady ? "pointer" : "default", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, opacity: consentReady ? 1 : 0.55 }}>
                  <input
                    type="checkbox"
                    checked={intent && consentReady}
                    disabled={!consentReady}
                    onChange={(event) => consentReady && setIntent(event.target.checked)}
                    style={{ marginTop: 3, accentColor: BRAND }}
                  />
                  <span style={{ lineHeight: 1.65, fontSize: 12, color: INK }}>
                    {ar
                      ? (!signed
                        ? "ضع ختمك على الصفحة أولاً — الإقرار يُفتح بعد التوقيع."
                        : "أقرّ بأنني راجعت المستند بالكامل، وأنّ وضع هذا الختم يعبّر عن نيّتي في التوقيع، وفق نظام التعاملات الإلكترونية.")
                      : (!signed
                        ? "Place your seal on the page first — acknowledgement unlocks after you sign."
                        : "I confirm that I reviewed the whole document and that placing this seal expresses my intent to sign, under the Electronic Transactions Law.")}
                  </span>
                </label>
              )}
              {proceedBlock ? <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{proceedBlock}</span> : null}
              {error && !receipt ? <p style={{ margin: 0, fontSize: 12, color: "#DC2626", lineHeight: 1.6 }}>{error}</p> : null}
              <button
                type="button"
                onClick={() => {
                  if (!canConfirm) {
                    refuseAdvance(proceedBlock);
                    return;
                  }
                  setError("");
                  confirm();
                }}
                disabled={!canConfirm || busy}
                style={{ ...signPrimaryBtn, width: "100%", opacity: !canConfirm || busy ? 0.45 : 1, cursor: !canConfirm || busy ? "not-allowed" : "pointer" }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {group
                  ? (busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال الطلبات" : "Send requests"))
                  : (busy ? (ar ? "جارٍ الختم…" : "Sealing…") : (ar ? "ختم وتسجيل" : "Seal and register"))}
              </button>
            </div>
          </div>
        </aside>

        <section style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
          <div style={{ height: 40, background: CARD, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", fontSize: 12, color: MUTED, minWidth: 0 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ar
                ? `الحقل: ${activeTool.ar} · الموقّع: ${signers[signerIndex]?.name || "—"}. اضغط على الصفحة للوضع، واضغط على حقلك النصي لتعبئته.`
                : `Field: ${activeTool.en} · Signer: ${signers[signerIndex]?.name || "—"}. Click the page to place, click your text field to fill it.`}
            </span>
            <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.6, +(value - 0.1).toFixed(2)))} style={iconBtn}>−</button>
              <span dir="ltr" style={{ ...mono, width: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.6, +(value + 0.1).toFixed(2)))} style={iconBtn}>+</button>
            </div>
          </div>

          <div
            ref={stageRef}
            style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "28px 0 60px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}
          >
            {pdf ? (
              <SigningWorkspacePages
                pdf={pdf}
                pageCount={pageCount}
                pageWidth={pageWidth}
                fields={fields}
                textValues={textValues}
                signers={signers}
                sealPreview={sealPreview || signatureUrl}
                stampRatio={stampAspect(stampConfig?.design)}
                activeFieldId={activeFieldId}
                ar={ar}
                placing
                onPlace={placeField}
                onMove={patchField}
                onSelect={setActiveFieldId}
                onRemove={removeField}
                onTextChange={(id, value) => setTextValues((current) => ({ ...current, [id]: value }))}
                onVisiblePage={noteVisiblePage}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: MUTED, paddingTop: 40 }}>
                {failed ? null : <Loader2 className="h-5 w-5 animate-spin" />}
                <span style={{ fontSize: 13 }}>
                  {failed
                    ? (failReason === "not-pdf"
                      ? (ar ? "الملف المرفوع ليس PDF صالحاً. ارفع PDF، أو صورة PNG/JPEG تُغلَّف تلقائياً في صفحة واحدة." : "That file is not a valid PDF. Upload a PDF, or a PNG/JPEG which is wrapped into one page.")
                      : (ar ? "تعذّر قراءة هذا الـ PDF. إن كان محمياً بكلمة مرور أو تالفاً فصدّره من جديد ثم ارفعه." : "This PDF could not be read. If it is password-protected or damaged, export a new PDF and upload that."))
                    : (ar ? "جارٍ فتح المستند…" : "Opening the document…")}
                </span>
              </div>
            )}
          </div>
        </section>

        <aside className="nv-signing-thumbs" style={{ background: CARD, borderInlineStart: `1px solid ${BORDER}`, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 12, overflow: "auto", alignItems: "center" }}>
          {pdf ? (
            <SigningWorkspaceThumbs
              pdf={pdf}
              pageCount={pageCount}
              fields={fields}
              activePage={activePage}
              onSelect={scrollToPage}
              ar={ar}
            />
          ) : null}
        </aside>
      </div>

      {leaveAsk && !receipt ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(event) => { if (event.target === event.currentTarget) setLeaveAsk(false); }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,40,75,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 60,
          }}
        >
          <div
            dir={ar ? "rtl" : "ltr"}
            style={{
              width: "min(420px, 100%)",
              background: CARD,
              border: "1px solid #dfe3ea",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 16, color: INK }}>
              {ar ? "الملف لم يُوقَّع بعد" : "The file is not signed yet"}
            </span>
            <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
              {ar
                ? "لا انتقال إلى التسجيل إلا بعد وضع الختم والإقرار. المغادرة تُلغي الحقول على الصفحة."
                : "Registry opens only after you sign and acknowledge. Leaving discards the marks on the page."}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setLeaveAsk(false)} style={signPrimaryBtn}>
                {ar ? "البقاء والتوقيع" : "Stay and sign"}
              </button>
              <button
                type="button"
                onClick={() => { setLeaveAsk(false); onClose?.(); }}
                style={signGhostBtn}
              >
                {ar ? "مغادرة دون توقيع" : "Leave unsigned"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <SigningFinishDialog
          ar={ar}
          mode={group ? "group" : "self"}
          fileName={file?.name || ""}
          fieldCount={fields.length}
          pageCount={pageCount}
          signers={signers.map((signer, index) => ({
            key: signer.key,
            name: signer.name || (ar ? "بلا اسم" : "Unnamed"),
            color: signer.color,
            fieldCount: fields.filter((field) => field.signer === index).length,
          }))}
          intent={intent}
          busy={busy}
          error={error}
          receipt={receipt}
          onConfirm={confirm}
          onClose={() => {
            if (busy) return;
            if (receipt) onClose?.();
          }}
        />
      ) : null}
    </div>
  );
}
