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
import { orderedFields } from "@/lib/signingEnvelopes";
import { checkEnvelopeFieldsGate, clampExpiryDays, clampReminderDays } from "@/lib/envelopeSetup";
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
import SignMarkGlyph from "@/components/files/SignMarkGlyph";
// Muted per-recipient tints — never the green accent, which marks the selected field only.
export const SIGNER_COLORS = ["#3B5A86", "#8A6A2E", "#2F7480", "#9A5B2E", "#7A5148", "#5F6B7A"];

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
  initialTemplateId = "",
  initialSigners = null,
  initialOrderMode = "parallel",
  envelopeMeta = null,
  startStep = 2,
  ar,
  onOpenStudio,
  onClose,
  onBackToSetup,
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
  // 2 المستلمون · 3 الحقول · 4 المراجعة والإرسال — step 1 (the upload) happened on the home.
  const [studioStep, setStudioStep] = useState(startStep);
  const [leaveTarget, setLeaveTarget] = useState("close");
  const [rail, setRail] = useState("");
  const [orderMode, setOrderMode] = useState(initialOrderMode === "sequential" ? "sequential" : "parallel");
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
  // «مظروف جديد» hands over its recipients in envelope order; you are the row keyed "me" — when
  // you sign too — wherever the order put you.
  const [signers, setSigners] = useState(() => (initialSigners?.length ? initialSigners.map((row, index) => (row.isMe ? {
    key: "me",
    name: row.name || currentUser?.profile?.signatureName || currentUser?.name || "",
    email: row.email || currentUser?.email || "",
    contact: ar ? "أنت · صاحب الختم" : "You · seal owner",
    color: row.color || SIGNER_COLORS[index % SIGNER_COLORS.length],
    external: false,
    stamp: Boolean(row.stamp),
  } : {
    key: row.key || `signer-${index}`,
    name: row.name || "",
    email: row.email || "",
    contact: row.outside ? (ar ? "من خارج المنشأة" : "Outside the company") : (row.title || (ar ? "من المنشأة" : "From the company")),
    color: row.color || SIGNER_COLORS[index % SIGNER_COLORS.length],
    external: true,
    outside: Boolean(row.outside),
    employeeId: row.employeeId || null,
    role: row.role || "",
    stationId: row.stationId || null,
    stamp: Boolean(row.stamp),
  })) : [{
    key: "me",
    name: currentUser?.profile?.signatureName || currentUser?.name || "",
    email: currentUser?.email || "",
    contact: ar ? "أنت · صاحب الختم" : "You · seal owner",
    color: SIGNER_COLORS[0],
    external: false,
  }]));

  const pageCount = pdf?.numPages || 0;
  const pageWidth = Math.round(560 * zoom);
  // Your row ("me") may sit anywhere in the order, or be absent when only others sign.
  const meIndex = signers.findIndex((signer) => signer.key === "me");
  const group = signers.some((signer) => signer.key !== "me");
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
    if (isMarkField(selected) && selected.signer === meIndex) {
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
    if (item.type === "text" && signerIndex === meIndex) {
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
      if (signerIndex === meIndex) {
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
    placed.filter((field) => field.type === "text" && field.signer === meIndex)
      .forEach((field) => { values[field.id] = defaultValueFor(field.tool); });
    setTextValues(values);
    setActiveFieldId(null);
    setNote(ar
      ? `طُبّق «${template.name}» — ${countAr(placed.length, ["حقل واحد", "حقلان", "حقول", "حقلًا"])}.`
      : `Applied "${template.name}" — ${placed.length} field${placed.length > 1 ? "s" : ""}.`);
  };

  // A template picked on the home («قالب الحقول») lands once the pages are known.
  const templateApplied = useRef(false);
  useEffect(() => {
    if (templateApplied.current || !initialTemplateId || !pageCount) return;
    const found = templates.find((item) => item.id === initialTemplateId);
    templateApplied.current = true;
    if (found) applyTemplate(found);
  }, [initialTemplateId, pageCount, templates]);

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

  // Sequential order: move a recipient up or down. You (row 1, the seal owner) stay first; the
  // fields follow their recipient.
  const moveSigner = (index, dir) => {
    const target = index + dir;
    const floor = meIndex === 0 ? 1 : 0;
    if (index < floor || target < floor || target >= signers.length) return;
    setSigners((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setFields((current) => current.map((field) => (
      field.signer === index ? { ...field, signer: target } : field.signer === target ? { ...field, signer: index } : field
    )));
    setSignerIndex(target);
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

  const myFields = useMemo(() => fields.filter((field) => field.signer === meIndex), [fields, meIndex]);
  const mySignature = myFields.some((field) => field.type === "signature");
  // Every party has a signature field, and a party whose stamp was required has a «الختم» field.
  const fieldsGate = checkEnvelopeFieldsGate({ signers, fields, ar });
  const everySignerPlaced = fieldsGate.ok;
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
          ? fieldsGate.reason
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
    const selfEmail = String(currentUser.email || signers[meIndex]?.email || "").trim().toLowerCase();
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
          spots: spotsFor(meIndex),
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
      subject: String(envelopeMeta?.subject || "").trim(),
      message: String(envelopeMeta?.message || "").trim(),
      reminderEveryDays: clampReminderDays(envelopeMeta?.reminderEveryDays),
      expiryDays: clampExpiryDays(envelopeMeta?.expiryDays),
      signers: signers.map((signer, index) => {
        const isMe = signer.key === "me";
        return {
          name: signer.name.trim(),
          email: signer.email.trim(),
          employeeId: signer.employeeId || (isMe ? currentUser.id : null),
          role: signer.role || (isMe ? currentUser.role || "" : ""),
          stationId: signer.stationId || (isMe ? currentUser.stationId || null : null),
          signatureUrl: isMe ? signatureUrl || "" : "",
          // «من خارج المنشأة»: a recipient added by email with no employee record.
          external: !isMe && (signer.outside === true || !signer.employeeId),
          stampRequired: Boolean(signer.stamp),
          spots: spotsFor(index),
        };
      }),
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
    // The local ledger outlives this page: a blob: URL dies with it, so a small file travels as a
    // data URL and the parties can still open it from their desk or link after a reload.
    const localDocUrl = async () => {
      if (file && file.size <= 3 * 1024 * 1024) {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => resolve("");
          reader.readAsDataURL(file);
        });
        if (dataUrl) return dataUrl;
      }
      return sourceUrl || "";
    };
    let body;
    if (shouldUseLocalMultiSign()) {
      body = invokeLocalMultiSign({ ...payload, docUrl: await localDocUrl() }, { actor, employees });
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
        body = invokeLocalMultiSign({ ...payload, docUrl: await localDocUrl() }, { actor, employees });
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
  const requestLeave = (target = "close") => {
    if (busy) return;
    const go = target === "setup" && onBackToSetup ? onBackToSetup : onClose;
    if (receipt || (!fields.length && !intent)) {
      go?.();
      return;
    }
    setLeaveTarget(target);
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
    if (studioStep !== 2 || !focusAdd) return;
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
  const nextLabel = studioStep === 2
    ? (ar ? "التالي: الحقول" : "Next: fields")
    : studioStep === 3
      ? (ar ? "التالي: المراجعة" : "Next: review")
      : (group ? (ar ? "أرسل" : "Send") : (ar ? "إنهاء التوقيع" : "Finish signing"));
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
    if (studioStep < 4) {
      setStudioStep(studioStep + 1);
      return;
    }
    requestFinish();
  };
  const goStep = (id) => {
    // Opened from «مظروف جديد»: المستندات and المستلمون live on the setup page.
    if (onBackToSetup && id <= 2) {
      requestLeave("setup");
      return;
    }
    if (id <= 1) {
      requestLeave();
      return;
    }
    setStudioStep(id);
  };

  const toolButton = (item) => {
    const on = tool === item.id;
    return (
      <button
        key={item.id}
        type="button"
        draggable
        data-tool={item.id}
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
          border: on ? "1px solid #3C7D50" : `1px solid ${BORDER}`,
          borderRadius: 8,
          background: on ? "var(--nv-ok-soft, #E6F2EA)" : "var(--nv-card)",
          color: on ? INK : MUTED,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          cursor: "grab",
          textAlign: "start",
        }}
      >
        <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", color: on ? "#3C7D50" : "var(--nv-ink)" }}>{toolIcon(item.id)}</span>
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
            ? "توقيع، تاريخ، نص، وغيرها توضع باسم المستلم المختار أعلاه وبلونه."
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
                  <SignMarkGlyph glyph={glyph} size={14} />
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

      <section style={{ padding: "10px 16px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong style={{ fontSize: 13 }}>{ar ? "على الصفحات" : "On the pages"}</strong>
          <span dir="ltr" style={{ ...mono, fontSize: 12, color: MUTED }}>{fields.length}</span>
        </div>
        {fields.length ? orderedFields(fields).map((field) => {
          const owner = signers[field.signer];
          const on = activeFieldId === field.id;
          return (
            <button key={field.id} type="button" onClick={() => { setActiveFieldId(field.id); setActivePage(field.page); document.querySelector(`[data-signing-page="${field.page}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} style={{ textAlign: "start", fontFamily: "inherit", border: `1px solid ${on ? "#3C7D50" : BORDER}`, background: "var(--nv-card)", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: owner?.color || MUTED, flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.label}</span>
              <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{owner?.name || "—"}</span>
              <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED }}>p{field.page}</span>
            </button>
          );
        }) : <span style={{ fontSize: 12, color: MUTED }}>{ar ? "لا حقول بعد — اسحب «التوقيع» إلى موضعه." : "No fields yet — drag a signature to its spot."}</span>}
      </section>
    </>
  );

  const recipientsPanel = (
    <>
      <section style={{ padding: "16px 16px 12px" }}>
        <strong style={{ fontSize: 15 }}>{ar ? "المستلمون" : "Recipients"}</strong>
        <p style={{ margin: "6px 0 8px", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          {ar ? "لكل مستلم لون تُعرف به حقوله." : "Each recipient has a tint that marks their fields."}
        </p>
        <div style={{ display: "flex", background: "var(--nv-page)", borderRadius: 10, padding: 3, marginBottom: 10 }}>
          <button type="button" onClick={() => setOrderMode("parallel")} style={{ flex: 1, height: 32, border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: orderMode === "parallel" ? "var(--nv-card)" : "transparent", color: orderMode === "parallel" ? INK : MUTED, boxShadow: orderMode === "parallel" ? "0 0 0 1px #3C7D50" : "none" }}>
            {ar ? "بالتوازي" : "Parallel"}
          </button>
          <button type="button" onClick={() => setOrderMode("sequential")} style={{ flex: 1, height: 32, border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: orderMode === "sequential" ? "var(--nv-card)" : "transparent", color: orderMode === "sequential" ? INK : MUTED, boxShadow: orderMode === "sequential" ? "0 0 0 1px #3C7D50" : "none" }}>
            {ar ? "بالترتيب" : "In order"}
          </button>
        </div>
        {signers.map((signer, index) => {
          const on = signerIndex === index;
          const known = signer.name.trim() && emailValid(signer.email);
          const editing = signer.external && (editingSigner === index || !known);
          return (
            <div key={signer.key} onClick={() => setSignerIndex(index)} style={{ border: `1px solid ${on ? signer.color : "var(--nv-line)"}`, borderRadius: 8, padding: "10px 10px 6px", marginBottom: 8, background: "var(--nv-card)", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span dir="ltr" style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--nv-page)", fontSize: 11, fontWeight: 700, fontFamily: mono.fontFamily, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{index + 1}</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: signer.color, flex: "none" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signer.name || (ar ? "موقّع جديد" : "New signer")}</span>
                  </span>
                  <span style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {signer.key === "me" ? (ar ? "أنت · صاحب الختم" : "You · seal owner") : signer.email}
                  </span>
                </span>
                {orderMode === "sequential" && signer.key !== "me" ? (
                  <span style={{ display: "inline-flex", gap: 2, flex: "none" }}>
                    <button type="button" aria-label={ar ? "قدّمه في الترتيب" : "Move up"} disabled={index < 2} onClick={(event) => { event.stopPropagation(); moveSigner(index, -1); }} style={{ ...chipBtn, padding: "2px 7px", opacity: index < 2 ? 0.4 : 1 }}>↑</button>
                    <button type="button" aria-label={ar ? "أخّره في الترتيب" : "Move down"} disabled={index >= signers.length - 1} onClick={(event) => { event.stopPropagation(); moveSigner(index, 1); }} style={{ ...chipBtn, padding: "2px 7px", opacity: index >= signers.length - 1 ? 0.4 : 1 }}>↓</button>
                  </span>
                ) : null}
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, flex: "none" }}>{ar ? "يوقّع" : "Signs"}</span>
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

  const expiryDays = clampExpiryDays(envelopeMeta?.expiryDays);
  const reminderDays = clampReminderDays(envelopeMeta?.reminderEveryDays);
  const expiresOn = new Date(Date.now() + expiryDays * 86400000).toLocaleDateString("en-GB");
  const reviewRow = { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${BORDER}`, fontSize: 12.5, minWidth: 0 };
  const signStep = (
    <section data-studio-review="1" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <strong style={{ fontSize: 15 }}>{ar ? "المراجعة والإرسال" : "Review and send"}</strong>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED, paddingBottom: 4 }}>
          <span>{ar ? "المستلمون" : "Recipients"}</span>
          <span>{group ? (orderMode === "sequential" ? (ar ? "بالترتيب" : "In order") : (ar ? "بالتوازي" : "In parallel")) : (ar ? "توقيعك وحدك" : "Only you sign")}</span>
        </div>
        {signers.map((signer, index) => {
          const n = fields.filter((field) => field.signer === index).length;
          const hasSig = fields.some((field) => field.signer === index && field.type === "signature");
          return (
            <div key={signer.key} style={reviewRow}>
              <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED, width: 14, textAlign: "center" }}>{index + 1}</span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: signer.color, flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{signer.name || (ar ? "بلا اسم" : "Unnamed")}</span>
              {hasSig ? null : <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)", border: "1px solid var(--nv-warn-line)", borderRadius: 8, padding: "1px 7px" }}>{ar ? "بلا حقل توقيع" : "No signature field"}</span>}
              <span dir="ltr" style={{ ...mono, fontSize: 12 }}>{n}</span>
              <span style={{ fontSize: 11.5, color: MUTED }}>{ar ? "حقول" : "fields"}</span>
            </div>
          );
        })}
      </div>
      <div style={{ ...reviewRow, borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ flex: 1, color: MUTED }}>{ar ? "ختمك" : "Your seal"}</span>
        {sealPreview || signatureUrl ? <img src={sealPreview || signatureUrl} alt="" style={{ width: 56, height: 34, objectFit: "contain" }} /> : null}
        <span dir="ltr" style={{ ...mono, fontSize: 11 }}>{docVerificationId}</span>
      </div>
      {group ? (
        <div style={{ ...reviewRow, borderTop: "none", paddingTop: 0 }}>
          <span style={{ flex: 1, color: MUTED }}>{ar ? "صلاحية الروابط" : "Links valid until"}</span>
          <span dir="ltr" style={{ ...mono, fontSize: 12 }}>{expiresOn}</span>
        </div>
      ) : null}
      {group ? (
        <div style={{ ...reviewRow, borderTop: "none", paddingTop: 0 }}>
          <span style={{ flex: 1, color: MUTED }}>{ar ? "التذكير التلقائي" : "Automatic reminder"}</span>
          <span style={{ fontSize: 12 }}>{reminderDays ? (ar ? (reminderDays === 1 ? "كل يوم" : reminderDays === 2 ? "كل يومين" : reminderDays === 7 ? "كل أسبوع" : `كل ${reminderDays} أيام`) : `Every ${reminderDays} day${reminderDays > 1 ? "s" : ""}`) : (ar ? "يدوياً فقط" : "By hand only")}</span>
        </div>
      ) : null}
      {group && envelopeMeta?.subject ? (
        <div style={{ ...reviewRow, borderTop: "none", paddingTop: 0 }}>
          <span style={{ color: MUTED, flex: "none" }}>{ar ? "الموضوع" : "Subject"}</span>
          <span dir="auto" style={{ flex: 1, minWidth: 0, textAlign: "end", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{envelopeMeta.subject}</span>
        </div>
      ) : null}
      {!signatureUrl && onOpenStudio ? (
        <button type="button" onClick={onOpenStudio} style={{ ...chipBtn, alignSelf: "flex-start", fontSize: 12, padding: "6px 12px" }}>{ar ? "صمّم ختمك" : "Design your seal"}</button>
      ) : null}
      {!group ? (
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.65 }}>
          <input type="checkbox" checked={intent} onChange={(event) => setIntent(event.target.checked)} style={{ marginTop: 3, accentColor: "#3C7D50" }} />
          {ar
            ? "أوافق على استخدام التوقيع الإلكتروني، وأقرّ بأنني راجعت المستند وأن ختمي يعبّر عن نيّتي في التوقيع."
            : "I agree to use an electronic signature; I reviewed the document and this seal expresses my intent to sign."}
        </label>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
          {orderMode === "sequential"
            ? (ar ? "يُحفظ الترتيب على المظروف ويظهر لكل طرف؛ ويستطيع أي طرف معلّق التوقيع من رابطه." : "The order is stored and shown; any pending party can still sign from their link.")
            : (ar ? "يوقّع كل طرف من رابطه دون انتظار الباقين، وتذكّرهم من «توقيعاتي»." : "Each party signs from their link without waiting; remind them from the desk.")}
        </p>
      )}
      <span data-send-gate={placeBlock ? "gap" : "ok"} style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.7, color: placeBlock ? "var(--nv-warn-ink, #8A5A12)" : "#2F6B43" }}>
        {placeBlock || (group
          ? (ar ? `✓ جاهز للإرسال — ${countAr(signers.length, ["طرف واحد", "طرفان", "أطراف", "طرفاً"])}${orderMode === "sequential" ? " بالتسلسل" : " بالتوازي"}` : `✓ Ready to send — ${signers.length} parties`)
          : (ar ? "✓ جاهز — يُختم ويُغلق ببصمته" : "✓ Ready — stamped and closed with its fingerprint"))}
      </span>
      <button type="button" data-studio-send="1" onClick={requestFinish} disabled={busy} style={{ height: 42, border: "none", borderRadius: 8, background: placeBlock ? "var(--nv-line)" : "var(--nv-navy, #0B3D27)", color: placeBlock ? MUTED : "#fff", fontWeight: 700, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
        {group ? (ar ? "أرسل" : "Send") : (ar ? "إنهاء التوقيع" : "Finish signing")}
      </button>
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
        onBack={() => requestLeave()}
        onStep={goStep}
        onNext={goHeaderNext}
        onAutoPlace={suggestSpots}
        autoPlaceBusy={!pdf || detecting}
        signers={signers}
        signerIndex={signerIndex}
        onPickSigner={setSignerIndex}
        onAddSigners={() => { if (onBackToSetup) { requestLeave("setup"); return; } setStudioStep(2); setFocusAdd(true); }}
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
        panel={studioStep === 2 ? recipientsPanel : studioStep === 3 ? fieldsPanel : signStep}
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
            meIndex={meIndex}
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
              {leaveTarget === "setup"
                ? (ar ? "العودة إلى إعداد المظروف تُلغي الحقول التي وضعتها؛ المستندات والمستلمون يبقون." : "Going back to the setup discards the fields you placed; documents and recipients stay.")
                : (ar ? "مغادرة التحضير تُلغي الحقول التي وضعتها على الصفحات." : "Leaving prepare discards the fields you placed on the pages.")}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setLeaveAsk(false)} style={signPrimaryBtn}>{ar ? "البقاء" : "Stay"}</button>
              <button type="button" onClick={() => { setLeaveAsk(false); if (leaveTarget === "setup" && onBackToSetup) onBackToSetup(); else onClose?.(); }} style={signGhostBtn}>{leaveTarget === "setup" ? (ar ? "عُد إلى الإعداد" : "Back to setup") : (ar ? "مغادرة دون توقيع" : "Leave unsigned")}</button>
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
          orderMode={orderMode}
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
