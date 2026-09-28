import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  CaseSensitive,
  CircleCheck,
  IdCard,
  Loader2,
  Mail,
  PenLine,
  SquareCheck,
  Stamp,
  Type,
  UserRound,
} from "lucide-react";
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
import SigningStudioFrame from "@/components/files/SigningStudioFrame";
import { envelopeCode, signGhostBtn, signMono as mono, signPrimaryBtn, signingDocTitle } from "@/components/files/signingUi";
import { BORDER, CARD, INK, MUTED, SURFACE } from "@/lib/platformStyles";
const SIGNER_COLORS = ["#1d9a5b", "#14213d", "#6b7280", "#8a6516"];

const TOOLS = [
  { id: "sig", type: "signature", glyph: "SIG", ar: "التوقيع", chipAr: "توقيع", en: "Signature", scale: 100 },
  { id: "init", type: "text", glyph: "IN", ar: "الأحرف الأولى", en: "Initials", scale: 70 },
  { id: "seal", type: "signature", glyph: "SEAL", ar: "الختم", chipAr: "ختم", en: "Stamp", scale: 100 },
  { id: "date", type: "text", glyph: "DD/MM", ar: "تاريخ التوقيع", chipAr: "التاريخ", en: "Signing date", chipEn: "Date", scale: 70 },
  { id: "name", type: "text", glyph: "Aa", ar: "الاسم", en: "Name", scale: 100 },
  { id: "email", type: "text", glyph: "MAIL", ar: "البريد الإلكتروني", en: "Email", scale: 110 },
  { id: "org", type: "text", glyph: "ORG", ar: "الجهة", en: "Organisation", scale: 100 },
  { id: "role", type: "text", glyph: "TTL", ar: "الصفة", en: "Title", scale: 90 },
  { id: "txt", type: "text", glyph: "TXT", ar: "نص", en: "Text", scale: 100 },
  { id: "check", type: "text", glyph: "✓", ar: "مربع اختيار", en: "Checkbox", scale: 50 },
  { id: "yn", type: "text", glyph: "YN", ar: "صح أو خطأ", en: "Yes or no", scale: 80 },
];

const FIELD_GROUPS = [
  { id: "sign", ar: "التوقيع", en: "Signature", tools: ["sig", "init", "seal", "date"] },
  { id: "who", ar: "بيانات الموقّع", en: "Signer details", tools: ["name", "email", "org", "role"] },
  { id: "input", ar: "إدخال", en: "Input", tools: ["txt", "check", "yn"] },
];

const TOOL_ICONS = {
  sig: PenLine,
  init: CaseSensitive,
  seal: Stamp,
  date: CalendarDays,
  name: UserRound,
  email: Mail,
  org: Building2,
  role: IdCard,
  txt: Type,
  check: SquareCheck,
  yn: CircleCheck,
};

function toolIcon(id) {
  const Icon = TOOL_ICONS[id] || PenLine;
  return <Icon aria-hidden="true" strokeWidth={1.75} style={{ width: 16, height: 16 }} />;
}

function personInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}.${parts[1].slice(0, 1)}`;
}

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
  const [finishAsk, setFinishAsk] = useState(false);
  const [studioStep, setStudioStep] = useState(1);
  const [rail, setRail] = useState("");
  const [orderMode, setOrderMode] = useState("parallel");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [openIdentity, setOpenIdentity] = useState(null);
  const [focusAdd, setFocusAdd] = useState(false);
  const addRef = useRef(null);
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

  const roster = useMemo(() => (employees || [])
    .filter((employee) => employee?.name || employee?.email)
    .map((employee) => {
      const profile = employee.profile || {};
      return {
        id: employee.id || employee.employeeId,
        name: employee.name || "",
        email: String(employee.email || "").toLowerCase(),
        role: employee.role || "",
        stationId: employee.stationId || null,
        title: profile.jobTitle || employee.jobTitle || profile.position || "",
        code: employee.employeeNo || profile.employeeNo || employee.employeeNumber || profile.employeeNumber || profile.nationalId || employee.nationalId || "",
      };
    }), [employees]);
  const employeeOptions = useMemo(() => roster.filter((employee) => employee.email), [roster]);

  useEffect(() => () => { if (receipt?.downloadUrl) URL.revokeObjectURL(receipt.downloadUrl); }, [receipt?.downloadUrl]);

  const defaultValueFor = useCallback((toolId) => {
    const name = currentUser?.profile?.signatureName || currentUser?.name || "";
    if (toolId === "date") return new Date().toLocaleDateString("en-GB");
    if (toolId === "name") return name;
    if (toolId === "email") return currentUser?.email || "";
    if (toolId === "init") return String(name).trim().split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join(".");
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
    label: ar ? (item.chipAr || item.ar) : (item.chipEn || item.en),
    page,
    x: clampPercent(x),
    y: clampPercent(y),
    scale: item.scale,
    signer,
    required: item.type === "text",
  }), [ar]);

  const placeField = (page, point, toolId) => {
    const item = TOOLS.find((entry) => entry.id === toolId) || activeTool;
    if (toolId) setTool(item.id);
    const field = makeField(item, page, point.x, point.y, signerIndex);
    setFields((current) => [...current, field]);
    if (item.type === "text" && signerIndex === 0) {
      setTextValues((current) => ({ ...current, [field.id]: defaultValueFor(item.id) }));
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
          ? `تعذّر إيداع البصمة (${reason}) — احتفظ بها أدناه يدويًا.`
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
      signingMode: orderMode === "sequential" ? "sequential" : "parallel",
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
  const canSend = !placeBlock;

  useEffect(() => {
    if (!consentReady && intent) setIntent(false);
  }, [consentReady, intent]);

  const requestFinish = () => {
    if (!canSend) {
      setError(placeBlock || (ar ? "أكمل الحقول على الصفحات أولاً." : "Finish the fields on the pages first."));
      return;
    }
    setError("");
    setFinishAsk(true);
  };
  const requestLeave = () => {
    if (busy) return;
    if (receipt || (!fields.length && !intent)) {
      onClose?.();
      return;
    }
    setLeaveAsk(true);
  };
  const addFromEmployee = (person) => {
    if (!canGroup || !emailValid(person.email) || signers.length >= MAX_PARALLEL_SIGNERS) return;
    setSigners((current) => {
      if (current.some((signer) => signer.email.trim().toLowerCase() === person.email)) return current;
      return [...current, {
        key: `emp-${person.id}-${Date.now()}`,
        name: person.name,
        email: person.email,
        contact: person.title || (ar ? "من المنشأة" : "From the company"),
        color: SIGNER_COLORS[current.length % SIGNER_COLORS.length],
        external: true,
        employeeId: person.id,
        role: person.role,
        stationId: person.stationId,
      }];
    });
  };

  const downloadSource = () => {
    const url = sourceUrl || (file ? URL.createObjectURL(file) : "");
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = file?.name || "document.pdf";
    link.click();
    if (!sourceUrl && file) URL.revokeObjectURL(url);
  };

  const printSource = () => {
    const url = sourceUrl || (file ? URL.createObjectURL(file) : "");
    if (!url) return;
    const win = window.open(url, "_blank", "noopener");
    if (!win) return;
    const kick = () => { try { win.focus(); win.print(); } catch { /* the browser blocked print */ } };
    win.addEventListener("load", kick);
    window.setTimeout(kick, 800);
  };

  useEffect(() => {
    if (studioStep !== 1 || !focusAdd) return;
    addRef.current?.scrollIntoView({ block: "start" });
    setFocusAdd(false);
  }, [studioStep, focusAdd]);

  const fileMeta = [
    file?.name,
    pageCount ? (ar ? countAr(pageCount, ["صفحة واحدة", "صفحتان", "صفحات", "صفحة"]) : `${pageCount} page${pageCount > 1 ? "s" : ""}`) : null,
    file?.size ? `${Math.round(file.size / 1024)} KB` : null,
  ].filter(Boolean).join(" · ");

  const docTitle = signingDocTitle(file?.name) || (ar ? "مستند" : "Document");
  const envId = envelopeCode(docVerificationId);
  const pageLabel = pageCount
    ? (ar ? countAr(pageCount, ["صفحة واحدة", "صفحتان", "صفحات", "صفحة"]) : `${pageCount} page${pageCount > 1 ? "s" : ""}`)
    : "";
  const nextLabel = studioStep === 1
    ? (ar ? "التالي: التوقيع" : "Next: signing")
    : studioStep === 2
      ? (ar ? "التالي: حقول" : "Next: fields")
      : (group ? (ar ? "إرسال للتوقيع" : "Send for signature") : (ar ? "إنهاء التوقيع" : "Finish signing"));
  const takenEmails = new Set(signers.map((signer) => signer.email.trim().toLowerCase()).filter(Boolean));
  const takenIds = new Set(signers.map((signer) => signer.employeeId).filter(Boolean).map(String));
  const availablePeople = roster.filter((person) => {
    if (person.email && takenEmails.has(person.email)) return false;
    if (person.id && takenIds.has(String(person.id))) return false;
    return true;
  });
  const peopleNeedle = peopleQuery.trim().toLowerCase();
  const shownPeople = availablePeople.filter((person) => !peopleNeedle || `${person.name} ${person.title} ${person.code} ${person.email}`.toLowerCase().includes(peopleNeedle));

  const goHeaderNext = () => {
    if (studioStep === 1) {
      setStudioStep(2);
      return;
    }
    if (studioStep === 2) {
      setStudioStep(3);
      return;
    }
    requestFinish();
  };

  const toolButton = (item) => {
    const on = tool === item.id;
    return (
      <button
        key={item.id}
        type="button"
        draggable
        aria-pressed={on}
        onDragStart={(event) => {
          setTool(item.id);
          event.dataTransfer.setData("application/x-nv-field", item.id);
          event.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => setTool(item.id)}
        style={{
          fontFamily: "inherit",
          boxSizing: "border-box",
          width: "100%",
          height: 40,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 6,
          padding: "0 8px",
          border: on ? "1px solid var(--nv-navy)" : `1px solid ${BORDER}`,
          borderRadius: 10,
          background: on ? "var(--nv-navy)" : "var(--nv-card)",
          color: on ? "#fff" : MUTED,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          cursor: "grab",
          textAlign: "start",
        }}
      >
        <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", color: on ? "#fff" : "var(--nv-ink)" }}>{toolIcon(item.id)}</span>
        <span style={{ minWidth: 0, whiteSpace: "nowrap" }}>{ar ? item.ar : item.en}</span>
      </button>
    );
  };

  const fieldsPanel = (
    <>
      <div style={{ padding: "16px 16px 4px" }}>
        <strong style={{ fontSize: 15 }}>{ar ? "الحقول" : "Fields"}</strong>
        <p style={{ margin: "6px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.65 }}>
          {ar
            ? "توقيع، تاريخ، نص، وغيرها توضع باسم الموقّع المختار أعلاه وبأونه."
            : "Signature, date, text and the rest land under the signer selected above, in their color."}
        </p>
      </div>
      {FIELD_GROUPS.map((group) => (
        <section key={group.id} style={{ padding: "8px 10px 2px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 6px" }}>{ar ? group.ar : group.en}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
            {group.tools.map((id) => toolButton(TOOLS.find((item) => item.id === id)))}
          </div>
          {group.id === "input" && tool === "check" ? (
            <div style={{ display: "flex", gap: 6, padding: "6px 0 0" }}>
              {MARK_GLYPHS.map((glyph) => (
                <button key={glyph} type="button" aria-pressed={mark === glyph} onClick={() => chooseMark(glyph)} style={{ fontFamily: "inherit", height: 28, minWidth: 28, borderRadius: 8, border: `1px solid ${mark === glyph ? "var(--nv-navy)" : BORDER}`, background: mark === glyph ? "var(--nv-navy)" : "var(--nv-card)", color: mark === glyph ? "#fff" : INK, cursor: "pointer" }}>
                  {glyph}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ))}

      <div style={{ padding: "10px 16px 0" }}>
        <button type="button" onClick={suggestSpots} disabled={!pdf || detecting} style={{ width: "100%", height: 36, borderRadius: 8, border: `1px solid ${BORDER}`, background: "var(--nv-card)", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: !pdf || detecting ? "wait" : "pointer", opacity: !pdf || detecting ? 0.55 : 1 }}>
          {detecting ? (ar ? "جارٍ قراءة النص…" : "Reading the text…") : (ar ? "اقترح المواضع من نص المستند" : "Suggest positions from the document text")}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 12px" }}>
        <select
          className="nv-signing-field"
          value=""
          onChange={(event) => {
            const found = templates.find((item) => item.id === event.target.value);
            if (found) applyTemplate(found);
          }}
          style={{ flex: 1, minWidth: 0, height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: "var(--nv-card)", fontFamily: "inherit", fontSize: 12, color: MUTED, padding: "0 8px" }}
        >
          <option value="">{ar ? "تطبيق قالب…" : "Apply a template…"}</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
        {naming ? (
          <input
            autoFocus
            className="nv-signing-field"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") storeTemplate(); if (event.key === "Escape") setNaming(false); }}
            placeholder={ar ? "اسم القالب" : "Template name"}
            style={{ width: 120, height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, padding: "0 8px", fontFamily: "inherit", fontSize: 12 }}
          />
        ) : (
          <button type="button" onClick={() => fields.length && setNaming(true)} disabled={!fields.length} style={{ height: 34, padding: "0 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "var(--nv-card)", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: fields.length ? "pointer" : "not-allowed", whiteSpace: "nowrap", opacity: fields.length ? 1 : 0.5 }}>
            {ar ? "حفظ كقالب" : "Save as template"}
          </button>
        )}
      </div>
      {templates.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 8px" }}>
          {templates.map((template) => (
            <button key={template.id} type="button" onClick={() => dropTemplate(template.id)} style={{ fontFamily: "inherit", fontSize: 11, border: `1px solid ${BORDER}`, background: "var(--nv-card)", borderRadius: 8, padding: "2px 8px", color: MUTED, cursor: "pointer" }}>
              {template.name} ×
            </button>
          ))}
        </div>
      ) : null}

      <section style={{ padding: "8px 16px 16px", borderTop: `1px solid ${BORDER}` }}>
        <strong style={{ fontSize: 15 }}>{ar ? "الموقّعون" : "Signers"}</strong>
        <p style={{ margin: "6px 0 8px", fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
          {ar ? "لكل موقّع لون يُعرف به حقوله" : "Each signer has a color that marks their fields"}
        </p>
        <div style={{ display: "flex", background: "var(--nv-page)", borderRadius: 10, padding: 3, marginBottom: 10 }}>
          <button type="button" onClick={() => setOrderMode("parallel")} style={{ flex: 1, height: 32, border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: orderMode === "parallel" ? "var(--nv-navy)" : "transparent", color: orderMode === "parallel" ? "#fff" : MUTED }}>
            {ar ? "بالتوازي" : "Parallel"}
          </button>
          <button type="button" onClick={() => setOrderMode("sequential")} style={{ flex: 1, height: 32, border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: orderMode === "sequential" ? "var(--nv-navy)" : "transparent", color: orderMode === "sequential" ? "#fff" : MUTED }}>
            {ar ? "بالتسلسل" : "Sequential"}
          </button>
        </div>
        {signers.map((signer, index) => {
          const on = signerIndex === index;
          const known = signer.name.trim() && emailValid(signer.email);
          const editing = signer.external && (editingSigner === index || !known);
          return (
            <div key={signer.key} onClick={() => setSignerIndex(index)} style={{ border: `1px solid ${on ? "var(--nv-line)" : "var(--nv-line)"}`, borderRadius: 12, padding: "10px 10px 6px", marginBottom: 8, background: "var(--nv-card)", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--nv-page)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{index + 1}</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: signer.color, flex: "none" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signer.name || (ar ? "موقّع جديد" : "New signer")}</span>
                  </span>
                  <span style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {index === 0 && !signer.external ? (ar ? "أنت · صاحب الختم" : "You · seal owner") : signer.email}
                  </span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "3px 8px", flex: "none" }}>{ar ? "يوقّع" : "Signs"}</span>
                {signer.external ? (
                  <button type="button" aria-label={ar ? "حذف الموقّع" : "Remove signer"} onClick={(event) => { event.stopPropagation(); removeSigner(index); }} style={{ border: "none", background: "none", color: MUTED, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                ) : (
                  <button type="button" aria-label={ar ? "تعديل" : "Edit"} onClick={(event) => { event.stopPropagation(); setEditingSigner(editing ? null : index); }} style={{ border: "none", background: "none", color: MUTED, cursor: "pointer", fontSize: 12 }}>▾</button>
                )}
              </div>
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }} onClick={(event) => event.stopPropagation()}>
                  {employeeOptions.length ? (
                    <select className="nv-signing-field" value={signer.employeeId || ""} onChange={(event) => pickEmployee(index, event.target.value)} style={{ height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: "inherit", fontSize: 12 }}>
                      <option value="">{ar ? "من الفريق…" : "From the team…"}</option>
                      {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                    </select>
                  ) : null}
                  <input className="nv-signing-field" value={signer.name} onChange={(event) => patchSigner(index, { name: event.target.value })} placeholder={ar ? "اسم الموقّع" : "Signer name"} style={{ height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, padding: "0 8px", fontFamily: "inherit" }} />
                  <input dir="ltr" className="nv-signing-field" value={signer.email} onChange={(event) => patchSigner(index, { email: event.target.value, employeeId: null })} placeholder="name@example.com" style={{ height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, padding: "0 8px", fontFamily: mono.fontFamily, fontSize: 12 }} />
                </div>
              ) : null}
              <button type="button" onClick={(event) => { event.stopPropagation(); setOpenIdentity(openIdentity === index ? null : index); }} style={{ marginTop: 6, width: "100%", textAlign: "start", border: "none", background: "transparent", color: MUTED, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>
                ▾ {ar ? "التحقق من الهوية — بلا – داخل المنصة" : "Identity check — none, inside the platform"}
              </button>
              {openIdentity === index ? (
                <p style={{ margin: "0 0 6px", fontSize: 11.5, color: MUTED, lineHeight: 1.65 }}>
                  {ar
                    ? "يُعرَف الموقّع بحسابه داخل المنصة. لا يُطلب تحقق هوية خارجي على هذا المظروف."
                    : "The signer is known by their account inside the platform. This envelope does not ask for an outside identity check."}
                </p>
              ) : null}
            </div>
          );
        })}
      </section>

      <section ref={addRef} style={{ padding: "12px 16px 20px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontSize: 14 }}>{ar ? "إضافة موقّع من المنشأة" : "Add a signer from the company"}</strong>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? `${availablePeople.length} متاح` : `${availablePeople.length} available`}</span>
        </div>
        <input
          className="nv-signing-field"
          value={peopleQuery}
          onChange={(event) => setPeopleQuery(event.target.value)}
          placeholder={ar ? "الاسم أو الصفة أو الرقم الوظيفي" : "Name, title, or employee number"}
          style={{ width: "100%", height: 34, marginTop: 8, borderRadius: 8, border: `1px solid ${BORDER}`, padding: "0 10px", fontFamily: "inherit", fontSize: 12, boxSizing: "border-box" }}
        />
        <div style={{ marginTop: 8 }}>
          {shownPeople.length ? shownPeople.map((person) => (
            <div key={person.id || person.email} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid var(--nv-line)` }}>
              <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--nv-page)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{personInitials(person.name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</span>
                <span style={{ display: "block", fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[person.title, person.code].filter(Boolean).join(" · ") || person.email || (ar ? "من المنشأة" : "From the company")}
                </span>
              </span>
              <button
                type="button"
                disabled={!canGroup || !emailValid(person.email) || signers.length >= MAX_PARALLEL_SIGNERS}
                onClick={() => addFromEmployee(person)}
                style={{ height: 28, padding: "0 10px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "var(--nv-card)", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", flex: "none" }}
              >
                {ar ? "إضافة" : "Add"}
              </button>
            </div>
          )) : (
            <p style={{ margin: "8px 0", fontSize: 12, color: MUTED }}>{ar ? "لا موظفون مطابقون." : "No matching employees."}</p>
          )}
        </div>
        {canGroup && signers.length < MAX_PARALLEL_SIGNERS ? (
          <button type="button" onClick={addSigner} style={{ marginTop: 8, border: "none", background: "none", color: INK, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
            {ar ? "إضافة بريد خارجي" : "Add an external email"}
          </button>
        ) : null}
      </section>
    </>
  );

  const signStep = (
    <section style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <strong style={{ fontSize: 15 }}>{ar ? "التوقيع" : "Signing"}</strong>
      <span style={{ color: "var(--nv-ok-ink)", fontWeight: 700, fontSize: 12.5 }}>{ar ? "توقيع آمن · بصمة التراث" : "Secure Sign · heritage fingerprint"}</span>
      <p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.7 }}>
        {ar
          ? "يُدمج الختم في ملف PDF، وتُحسب بصمة SHA-256، ويُسجَّل رقم التحقق في سجل الشركة. ليست شهادة حكومية مؤهلة."
          : "The seal is merged into the PDF, a SHA-256 fingerprint is computed, and the verification id is written to the company registry."}
      </p>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        {sealPreview || signatureUrl ? <img src={sealPreview || signatureUrl} alt="" style={{ width: 64, height: 44, objectFit: "contain" }} /> : <span style={{ width: 64, height: 44, border: `1px dashed ${BORDER}`, borderRadius: 8 }} />}
        <span dir="ltr" style={{ ...mono, fontSize: 11 }}>{docVerificationId}</span>
      </div>
      {!group ? (
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.65 }}>
          <input type="checkbox" checked={intent} onChange={(event) => setIntent(event.target.checked)} style={{ marginTop: 3 }} />
          {ar
            ? "أقرّ بأنني راجعت المستند، وأن وضع هذا الختم يعبّر عن نيّتي في التوقيع."
            : "I confirm I reviewed the document and that this seal expresses my intent to sign."}
        </label>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
          {orderMode === "sequential"
            ? (ar ? "يُحفظ الترتيب على المظروف. أي طرف معلّق يستطيع التوقيع من رابطه." : "The order is stored on the envelope. Any pending party can still sign from their link.")
            : (ar ? "بالتوازي: كل طرف يوقّع من رابطه دون انتظار الباقين." : "Parallel: each party signs from their link without waiting.")}
        </p>
      )}
      {placeBlock ? <p style={{ margin: 0, fontSize: 12, color: "var(--nv-bad-ink)" }}>{placeBlock}</p> : null}
      <button type="button" onClick={requestFinish} disabled={busy} style={{ height: 36, border: "none", borderRadius: 8, background: "var(--nv-navy)", color: "#fff", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
        {group ? (ar ? "إرسال للتوقيع" : "Send for signature") : (ar ? "إنهاء وتوقيع" : "Finish and sign")}
      </button>
    </section>
  );

  const fieldsStep = (
    <section style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <strong style={{ fontSize: 15 }}>{ar ? "حقول" : "Fields"}</strong>
      <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{ar ? `${fields.length} حقول على الصفحات` : `${fields.length} fields on the pages`}</p>
      {fields.length ? fields.map((field) => {
        const owner = signers[field.signer];
        return (
          <button key={field.id} type="button" onClick={() => { setActiveFieldId(field.id); setActivePage(field.page); }} style={{ textAlign: "start", fontFamily: "inherit", border: `1px solid ${BORDER}`, background: "var(--nv-card)", borderRadius: 10, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: owner?.color || "var(--nv-ok-ink)", flex: "none" }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 12.5 }}>{field.label}</span>
              <span style={{ display: "block", fontSize: 11, color: MUTED }}>{owner?.name} · {ar ? `صفحة ${field.page}` : `Page ${field.page}`}</span>
            </span>
          </button>
        );
      }) : <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{ar ? "لم تُوضع حقول بعد. ارجع إلى الخطوة الأولى." : "No fields yet. Go back to the first step."}</p>}
    </section>
  );

  return (
    <>
      <SigningStudioFrame
        ar={ar}
        title={docTitle}
        envelopeId={envId}
        pageLabel={pageLabel}
        step={studioStep}
        fieldCount={fields.length}
        nextLabel={nextLabel}
        onBack={requestLeave}
        onStep={setStudioStep}
        onNext={goHeaderNext}
        onAutoPlace={suggestSpots}
        autoPlaceBusy={!pdf || detecting}
        signers={signers}
        signerIndex={signerIndex}
        onPickSigner={setSignerIndex}
        onAddSigners={() => { setStudioStep(1); setFocusAdd(true); }}
        people={shownPeople}
        peopleQuery={peopleQuery}
        onPeopleQuery={setPeopleQuery}
        onAddPerson={(person) => addFromEmployee(person)}
        rail={rail}
        onRail={(mode) => setRail((current) => (current === mode ? "" : mode))}
        zoom={zoom}
        onZoom={(dir) => setZoom((value) => (dir > 0 ? Math.min(1.6, +(value + 0.1).toFixed(2)) : Math.max(0.6, +(value - 0.1).toFixed(2))))}
        onDownload={downloadSource}
        onPrint={printSource}
        note={note}
        error={error && !finishAsk && !receipt ? error : ""}
        toolbarExtra={selectedField ? (
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, background: SURFACE, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{selectedField.label}</span>
            {selectedField.type === "text" ? (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED }}>
                <input type="checkbox" checked={selectedField.required !== false} onChange={(event) => patchField(selectedField.id, { required: event.target.checked })} />
                {ar ? "مطلوب" : "Required"}
              </label>
            ) : null}
            <button type="button" onClick={() => duplicateField(selectedField.id)} style={chipBtn}>{ar ? "نسخة" : "Duplicate"}</button>
            {pageCount > 1 ? <button type="button" onClick={() => repeatOnEveryPage(selectedField.id)} style={chipBtn}>{ar ? "على كل الصفحات" : "On every page"}</button> : null}
            <button type="button" onClick={() => removeField(selectedField.id)} style={chipBtn}>{ar ? "حذف" : "Delete"}</button>
          </div>
        ) : null}
        thumbs={rail === "pages" && pdf ? (
          <div style={{ width: 96, flex: "none", overflow: "auto", background: "var(--nv-card)", borderInlineStart: `1px solid ${BORDER}`, padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <SigningWorkspaceThumbs
              pdf={pdf}
              pageCount={pageCount}
              fields={fields}
              activePage={activePage}
              ar={ar}
              onSelect={(page) => {
                setActivePage(page);
                document.querySelector(`[data-signing-page="${page}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          </div>
        ) : null}
        panel={studioStep === 2 ? signStep : studioStep === 3 ? fieldsStep : fieldsPanel}
      >
        {rail === "summary" ? (
          <aside style={{ position: "absolute", top: 12, insetInlineEnd: 12, zIndex: 4, width: 240, background: "var(--nv-card)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, boxShadow: "0 8px 24px rgba(20,33,61,.08)" }}>
            <strong style={{ display: "block", marginBottom: 4 }}>{docTitle}</strong>
            <span style={{ display: "block", fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>{fileMeta}</span>
            <span style={{ display: "block", fontSize: 12, marginTop: 6 }}>{ar ? `${fields.length} حقول · ${signers.length} موقّعين` : `${fields.length} fields · ${signers.length} signers`}</span>
            <span style={{ display: "block", fontSize: 12, color: MUTED }}>{orderMode === "sequential" ? (ar ? "بالتسلسل" : "Sequential") : (ar ? "بالتوازي" : "Parallel")}</span>
          </aside>
        ) : null}
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
            placing={Boolean(tool)}
            appearance="gold"
            onPlace={placeField}
            onMove={patchField}
            onSelect={setActiveFieldId}
            onRemove={removeField}
            onTextChange={(id, value) => setTextValues((current) => ({ ...current, [id]: value }))}
            onVisiblePage={noteVisiblePage}
          />
        ) : (
          <div style={{ width: "min(100%, 640px)", aspectRatio: "1 / 1.3", background: "var(--nv-card)", border: "1px solid var(--nv-line)", boxShadow: "0 1px 3px rgba(0,0,0,.08)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: MUTED, padding: "10%", textAlign: "center", boxSizing: "border-box" }}>
            {failed ? null : <Loader2 className="h-5 w-5 animate-spin" />}
            <span style={{ fontSize: 13, lineHeight: 1.8, color: "#4B5567" }}>
              {failed
                ? (failReason === "not-pdf"
                  ? (ar ? "الملف المرفوع ليس PDF صالحاً. ارفع PDF، أو صورة PNG/JPEG تُغلَّف تلقائياً في صفحة واحدة." : "That file is not a valid PDF. Upload a PDF, or a PNG/JPEG which is wrapped into one page.")
                  : (ar ? "تعذّر قراءة هذا الـ PDF. إن كان محمياً بكلمة مرور أو تالفاً فصدّره من جديد ثم ارفعه." : "This PDF could not be read. If it is password-protected or damaged, export a new PDF and upload that."))
                : (ar ? "جارٍ فتح المستند…" : "Opening the document…")}
            </span>
          </div>
        )}
      </SigningStudioFrame>

      {leaveAsk && !receipt ? (
        <div role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) setLeaveAsk(false); }} style={{ position: "fixed", inset: 0, background: "rgba(20,40,75,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 80 }}>
          <div dir={ar ? "rtl" : "ltr"} style={{ width: "min(420px, 100%)", background: CARD, border: "1px solid var(--nv-line)", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: INK }}>{ar ? "هل أنت متأكد؟" : "Are you sure?"}</span>
            <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
              {ar ? "مغادرة التحضير تُلغي الحقول التي وضعتها على الصفحات." : "Leaving prepare discards the fields you placed on the pages."}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setLeaveAsk(false)} style={signPrimaryBtn}>{ar ? "البقاء" : "Stay"}</button>
              <button type="button" onClick={() => { setLeaveAsk(false); onClose?.(); }} style={signGhostBtn}>{ar ? "مغادرة دون توقيع" : "Leave unsigned"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {(finishAsk || receipt) ? (
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
          onIntentChange={setIntent}
          busy={busy}
          error={error}
          receipt={receipt}
          onConfirm={confirm}
          onClose={() => {
            if (busy) return;
            if (receipt) onClose?.();
            else setFinishAsk(false);
          }}
        />
      ) : null}
    </>
  );
}
