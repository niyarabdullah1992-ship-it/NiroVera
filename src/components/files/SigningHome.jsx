import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { imageBlobToPdf } from "@/lib/signPdf";
import SigningStatusBoard, { settledState, stateLabel } from "@/components/files/SigningStatusBoard";
import { canDownloadFinal, isArchivedSigningEnvelope, isOpenSigningState } from "@/lib/multiSignDerivations";
import VerifyWorkspace from "@/components/files/VerifyWorkspace";
import { signMono as mono } from "./signingUi";
import {
  SIGN_BODY,
  SIGN_INK,
  SIGN_LINE,
  SIGN_MUTED,
  SIGN_WHITE,
} from "@/components/files/SigningSectionFrame";
import { formatUiNumber } from "@/lib/dateFormat";
import { pageKicker } from "@/lib/moduleMeta";

const MAX_SIZE = 25 * 1024 * 1024;
const isPdf = (file) => file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
const isPng = (file) => file?.type === "image/png" || file?.name?.toLowerCase().endsWith(".png");
const isJpeg = (file) => file?.type === "image/jpeg" || /\.jpe?g$/i.test(file?.name || "");
const isImage = (file) => isPng(file) || isJpeg(file);

const PAPER = {
  background: SIGN_WHITE,
  border: `1px solid ${SIGN_LINE}`,
  borderRadius: 14,
  boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
  boxSizing: "border-box",
};

const TONE = {
  action: { ink: "var(--nv-warn-ink)", soft: "var(--nv-warn-soft)", line: "var(--nv-warn-line)", fill: "var(--nv-warn-fill)" },
  waiting: { ink: "var(--nv-ink)", soft: "var(--nv-g1)", line: "var(--nv-box)", fill: "var(--nv-navy)" },
  done: { ink: "var(--nv-ok-ink)", soft: "var(--nv-ok-soft)", line: "var(--nv-ok-line)", fill: "var(--nv-ok-fill)" },
  declined: { ink: "var(--nv-bad-ink)", soft: "var(--nv-bad-soft)", line: "var(--nv-bad-line)", fill: "var(--nv-bad-fill)" },
  draft: { ink: "var(--nv-mute-ink)", soft: "var(--nv-mute-soft)", line: "var(--nv-mute-line)", fill: "var(--nv-mute-fill)" },
};

function deskBucket(request) {
  const { state, cooling } = settledState(request);
  if (state === "deleted" || state === "rejected") return "declined";
  if (state === "completed" || state === "completed_with_refusal") return "done";
  if (state === "pending" && request.myStatus === "pending" && !cooling) return "action";
  return "waiting";
}

function storedFingerprint(request) {
  const finalHash = String(request?.finalHash || "").trim();
  if (finalHash) return finalHash;
  const events = Array.isArray(request?.auditTrail) ? request.auditTrail : [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const hash = String(events[index]?.documentHash || "").trim();
    if (hash) return hash;
  }
  return "";
}

function shortFingerprint(value) {
  const clean = String(value || "").replace(/\s/g, "");
  if (!clean) return "";
  if (clean.length <= 18) return clean;
  return `${clean.slice(0, 8)}…${clean.slice(-4)}`;
}

function closeStamp(request) {
  const { state } = settledState(request);
  if (state === "deleted") return request.deletedAt || request.lastActivityAt || "";
  return request.releasedAt || request.lastActivityAt || request.completedAt || "";
}

function partyLine(request, currentUser, ar) {
  const mine = String(currentUser?.email || "").toLowerCase();
  const parties = (request.signers || [])
    .filter((signer) => String(signer.email || "").toLowerCase() !== mine)
    .map((signer) => signer.name)
    .filter(Boolean);
  const names = parties.length ? parties : (request.signers || []).map((signer) => signer.name).filter(Boolean);
  return names.join(ar ? "، " : ", ") || "—";
}

function deskLabel(request, ar) {
  const derived = settledState(request);
  const bucket = deskBucket(request);
  if (bucket === "action") return ar ? "يحتاج توقيعك" : "Needs your signature";
  if (derived.state === "deleted") return ar ? "مُلغى" : "Voided";
  if (derived.state === "pending") return ar ? "بانتظار الآخرين" : "Waiting on others";
  if (derived.cooling) return stateLabel(derived.state, ar, true);
  return stateLabel(derived.state, ar, false, derived);
}

function pillStyle(bucket) {
  const tone = TONE[bucket] || TONE.draft;
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 22,
    padding: "0 9px",
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 700,
    whiteSpace: "nowrap",
    color: tone.ink,
    background: tone.soft,
    border: `1px solid ${tone.line}`,
  };
}

function stamp(value, ar) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function weekStart(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

function recentWeeks() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const keys = [];
  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - index * 7);
    keys.push(date.toISOString().slice(0, 10));
  }
  return keys;
}

async function downloadFinalCopy(request) {
  if (!request?.docUrl) return;
  try {
    const blob = await fetch(request.docUrl).then((response) => response.blob());
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const anchor = link;
    anchor.href = url;
    anchor.download = request.fileName || "document.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch {
    window.open(request.docUrl, "_blank");
  }
}

const HEADS = {
  home: {
    ar: ["الاتفاقيات", "كل ما أرسلته أو وصلك للتوقيع، مرتّباً حسب ما يحتاج تصرّفك."],
    en: ["Agreements", "Everything you sent or received to sign, ordered by what needs you."],
  },
  track: {
    ar: ["تتبّع المظروف", "مسار كل طرف ووقت كل حدث. البصمة تُثبَّت بعد إغلاق المهلة وتمرير المنشئ."],
    en: ["Track envelope", "Each party and each event. The fingerprint registers after cooling closes and the creator releases."],
  },
  templates: {
    ar: ["مكتبة القوالب", "لا كتالوج قوالب محفوظ. التحضير يبدأ برفع المستند إلى الورشة."],
    en: ["Template library", "There is no saved template catalog. Preparation starts by uploading a document into the workshop."],
  },
  reports: {
    ar: ["التقارير", "أرقام مشتقّة من مظاريف الشركة الظاهرة لك. لا أرقام تجريبية."],
    en: ["Reports", "Figures derived from the company envelopes you can see. No sample numbers."],
  },
  settings: {
    ar: ["الإعدادات", "ختمك وبصمة SHA-256 وسجل الشركة. التحقق العام يبقى على الرابط العام."],
    en: ["Settings", "Your seal, the SHA-256 fingerprint, and the company registry. Public verify stays on the public link."],
  },
  verify: {
    ar: ["التحقق من المستند", "تُحسب بصمة الملف على جهازك وتُطابق سجل الشركة. الملف لا يُرفع إلى الخادم."],
    en: ["Verify a document", "The file fingerprint is computed on your device and matched to the company registry. The file is never uploaded."],
  },
  archive: {
    ar: ["الأرشيف", "المكتمل والمرفوض والمُلغى يغادر الاتفاقيات ويبقى هنا بتاريخ الإغلاق والبصمة إن وُجدت."],
    en: ["Archive", "Completed, refused, and voided envelopes leave Agreements and stay here with the close date and any stored fingerprint."],
  },
};

export default function SigningHome({
  ar,
  lang,
  currentUser,
  companyId,
  companyName = "",
  employees = [],
  stations = [],
  requests,
  loading,
  initialFilter = "all",
  activeFilter,
  sealPreview,
  sealId,
  sealReady,
  onOpenStudio,
  onRemoveSeal,
  onOpenDocument,
  onOpenRequest,
  onReload,
  focusRequestId = "",
  sentLinks = [],
}) {
  const inputRef = useRef(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState(() => (initialFilter === "mine" ? "action" : "all"));
  const [archiveFolder, setArchiveFolder] = useState("all");
  const [view, setView] = useState(() => (
    initialFilter === "verify" ? "verify"
      : initialFilter === "status" ? "track"
        : initialFilter === "archive" ? "archive"
          : "home"
  ));
  const [selectedId, setSelectedId] = useState(focusRequestId || "");

  useEffect(() => {
    if (!activeFilter) return;
    if (activeFilter === "mine") { setView("home"); setFolder("action"); }
    else if (activeFilter === "verify") setView("verify");
    else if (activeFilter === "status") setView("track");
    else if (activeFilter === "archive") { setView("archive"); setArchiveFolder("all"); }
    else if (activeFilter === "all") { setView("home"); setFolder("all"); }
  }, [activeFilter]);

  useEffect(() => {
    if (!focusRequestId) return;
    setSelectedId(focusRequestId);
    setView("track");
  }, [focusRequestId]);

  const rows = useMemo(() => requests || [], [requests]);
  const monthKey = new Date().toISOString().slice(0, 7);
  const counts = useMemo(() => {
    const tally = { action: 0, waiting: 0, done: 0, doneMonth: 0, declined: 0, refused: 0 };
    rows.forEach((row) => {
      const bucket = deskBucket(row);
      if (bucket === "action") tally.action += 1;
      else if (bucket === "waiting") tally.waiting += 1;
      else if (bucket === "done") {
        tally.done += 1;
        if (String(row.lastActivityAt || row.createdAt || "").slice(0, 7) === monthKey) tally.doneMonth += 1;
      } else if (bucket === "declined") {
        tally.declined += 1;
        if (settledState(row).state === "rejected") tally.refused += 1;
      }
    });
    return tally;
  }, [monthKey, rows]);

  const knownEmails = useMemo(() => {
    const set = new Set();
    employees.forEach((employee) => {
      const email = String(employee.email || "").toLowerCase();
      if (email) set.add(email);
    });
    const mine = String(currentUser?.email || "").toLowerCase();
    if (mine) set.add(mine);
    return set;
  }, [currentUser?.email, employees]);

  const activeRows = useMemo(() => rows.filter((row) => !isArchivedSigningEnvelope(row)), [rows]);
  const archiveRows = useMemo(() => rows.filter((row) => isArchivedSigningEnvelope(row)), [rows]);
  const query = q.trim();
  const matchesQuery = (row) => {
    if (!query) return true;
    const blob = [
      row.fileName,
      row.verificationId,
      row.finalHash,
      row.creatorName,
      ...(row.signers || []).map((signer) => `${signer.name || ""} ${signer.email || ""}`),
    ].join(" ");
    return blob.includes(query);
  };
  const listed = activeRows.filter((row) => {
    if (folder === "draft") return false;
    if (folder !== "all" && deskBucket(row) !== folder) return false;
    return matchesQuery(row);
  });
  const archivedListed = archiveRows.filter((row) => {
    const bucket = deskBucket(row);
    if (archiveFolder === "done" && bucket !== "done") return false;
    if (archiveFolder === "declined" && bucket !== "declined") return false;
    return matchesQuery(row);
  });

  const selected = rows.find((row) => row.id === selectedId) || null;
  const head = HEADS[view] || HEADS.home;
  const title = ar ? head.ar[0] : head.en[0];
  const lede = ar ? head.ar[1] : head.en[1];

  const accept = async (file) => {
    if (!file) return;
    setError("");
    if (file.size > MAX_SIZE) {
      setError(ar ? "الحد الأعلى 25 ميجابايت." : "The limit is 25MB.");
      return;
    }
    if (!isPdf(file) && !isImage(file)) {
      setError(ar
        ? "ورشة التوقيع تفتح PDF أو صورة PNG/JPEG. ملفات Word وExcel تُصدَّر إلى PDF ثم تُرفع هنا."
        : "The workspace opens PDF or a PNG/JPEG image. Export Word or Excel to PDF, then upload that.");
      return;
    }
    setPreparing(true);
    try {
      if (isPdf(file)) {
        onOpenDocument({ file, sourceUrl: URL.createObjectURL(file) });
      } else {
        const { bytes } = await imageBlobToPdf(file, false);
        const pdfFile = new File([bytes], file.name.replace(/\.(png|jpe?g)$/i, ".pdf"), { type: "application/pdf" });
        onOpenDocument({ file: pdfFile, sourceUrl: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) });
      }
    } catch {
      setError(ar
        ? "تعذّر تغليف الصورة في PDF. جرّب PNG أو JPEG، أو صدّر المستند إلى PDF ثم ارفعه."
        : "Couldn't wrap that image into a PDF. Try PNG or JPEG, or export the document to PDF and upload that.");
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openRow = (request) => {
    if (deskBucket(request) === "action" && request.myToken) {
      onOpenRequest(request);
      return;
    }
    setSelectedId(request.id);
    setView("track");
  };

  const goNav = (id) => {
    if (id === "prepare") {
      inputRef.current?.click();
      return;
    }
    if (id === "archive") {
      setArchiveFolder("all");
      setView("archive");
      return;
    }
    if (id === "track" && !selectedId) {
      const open = rows.find((row) => !isArchivedSigningEnvelope(row)) || rows[0];
      if (open) setSelectedId(open.id);
    }
    setView(id);
  };

  const kpis = [
    { id: "action", label: ar ? "يحتاج توقيعك" : "Needs you", value: counts.action },
    { id: "waiting", label: ar ? "بانتظار الآخرين" : "Waiting on others", value: counts.waiting },
    { id: "done", label: ar ? "مكتمل هذا الشهر" : "Completed this month", value: counts.doneMonth },
    { id: "declined", label: ar ? "مرفوض" : "Refused", value: counts.refused },
  ];

  const folders = [
    ["action", ar ? "يحتاج توقيعك" : "Needs you", counts.action],
    ["waiting", ar ? "بانتظار الآخرين" : "Waiting on others", counts.waiting],
    ["draft", ar ? "المسودات" : "Drafts", 0],
    ["all", ar ? "الكل" : "All", activeRows.length],
  ];
  const archiveChips = [
    ["all", ar ? "الكل" : "All", archiveRows.length],
    ["done", ar ? "مكتمل" : "Completed", counts.done],
    ["declined", ar ? "مرفوض ومُلغى" : "Refused and voided", counts.declined],
  ];

  const nav = [
    ["home", ar ? "الاتفاقيات" : "Agreements", counts.action],
    ["prepare", ar ? "تحضير وإرسال" : "Prepare & send", 0],
    ["track", ar ? "تتبّع المظروف" : "Track envelope", 0],
    ["archive", ar ? "الأرشيف" : "Archive", 0],
    ["templates", ar ? "القوالب" : "Templates", 0],
    ["reports", ar ? "التقارير" : "Reports", 0],
    ["settings", ar ? "الإعدادات" : "Settings", 0],
  ];

  const actionTab = (on) => ({
    fontFamily: "inherit",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    padding: "0 14px",
    flex: "none",
    flexShrink: 0,
    whiteSpace: "nowrap",
    overflow: "visible",
    textOverflow: "clip",
    fontSize: 13,
    fontWeight: on ? 700 : 600,
    lineHeight: 1.4,
    color: on ? "#fff" : "var(--nv-ink)",
    background: on ? "var(--nv-btn-fill)" : "var(--nv-card)",
    border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`,
    borderRadius: 8,
    cursor: "pointer",
  });
  const greenBtn = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 34,
    padding: "0 14px",
    borderRadius: 10,
    background: "var(--nv-btn-fill)",
    color: "#fff",
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    cursor: preparing ? "wait" : "pointer",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  };
  const navyBtn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 34,
    padding: "0 14px",
    borderRadius: 10,
    background: "var(--nv-navy)",
    color: "#fff",
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
  const ghostBtn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 30,
    padding: "0 12px",
    borderRadius: 9,
    background: SIGN_WHITE,
    color: SIGN_INK,
    border: `1px solid ${SIGN_LINE}`,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  return (
    <div className="nv-sign-home" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ ...PAPER, padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 10, letterSpacing: ".14em", color: SIGN_MUTED, fontWeight: 600 }}>{pageKicker("/app/signing", lang)}</span>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <h2 style={{ margin: 0, font: "700 16px var(--font-heading), sans-serif", letterSpacing: "-0.01em" }}>{title}</h2>
            <p style={{ margin: 0, fontSize: 11, color: SIGN_MUTED, textWrap: "pretty" }}>{lede}</p>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            {kpis.map((item) => {
              const settledKpi = item.id === "done" || item.id === "declined";
              const on = settledKpi
                ? view === "archive" && archiveFolder === item.id
                : view === "home" && folder === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="nv-sign-kpi"
                  onClick={() => {
                    if (settledKpi) {
                      setArchiveFolder(item.id);
                      setView("archive");
                      return;
                    }
                    setFolder(item.id);
                    setView("home");
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    paddingInlineEnd: 14,
                    border: "none",
                    borderInlineEnd: "1px solid var(--nv-line3)",
                    background: "transparent",
                    fontFamily: "inherit",
                    textAlign: "start",
                    boxShadow: on ? `inset 0 -2px 0 ${TONE[item.id].fill}` : "none",
                  }}
                >
                  <span style={{ fontSize: 10, color: SIGN_MUTED, whiteSpace: "nowrap" }}>{item.label}</span>
                  <span dir="ltr" style={{ ...mono, fontSize: 18, fontWeight: 500, color: TONE[item.id].ink }}>{formatUiNumber(item.value, ar)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="nv-sign-query"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              if (view === "archive") return;
              setView("home");
              setFolder("all");
            }}
            placeholder={ar ? "⌕ ابحث في الاتفاقيات والأطراف" : "Search agreements and parties"}
            style={{ height: 34, flex: 1, minWidth: 220, maxWidth: 420, padding: "0 12px", borderRadius: 10, border: `1px solid ${SIGN_LINE}`, background: SIGN_WHITE, fontSize: 12, outline: "none", color: SIGN_INK, fontFamily: "inherit" }}
          />
          <span style={{ flex: 1 }} />
          <div className="nv-sign-actions" style={{ display: "flex", alignItems: "center", gap: 16, flex: "none", flexShrink: 0 }}>
            <button type="button" className="nv-sign-action" onClick={onOpenStudio} style={actionTab(false)}>{ar ? "الختم" : "Seal"}</button>
            <button type="button" className="nv-sign-action" aria-current={view === "verify" ? "page" : undefined} onClick={() => setView("verify")} style={actionTab(view === "verify")}>{ar ? "التحقق من المستند" : "Verify a document"}</button>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={preparing} style={greenBtn}>
            {preparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "＋"}
            {ar ? "مستند جديد للتوقيع" : "New document to sign"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg"
            onChange={(event) => accept(event.target.files?.[0])}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        </div>
        {error ? <span style={{ fontSize: 12, color: "var(--nv-bad-ink)", lineHeight: 1.6 }}>{error}</span> : null}
        <nav style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none", margin: "0 -20px", padding: "0 14px", borderTop: "1px solid var(--nv-line3)" }}>
          {nav.map(([id, label, badge]) => {
            const on = view === id;
            return (
              <button
                key={id}
                type="button"
                className="nv-sign-nav"
                onClick={() => goNav(id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 42,
                  padding: "0 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flex: "none",
                  border: "none",
                  borderBottom: `2px solid ${on ? "var(--nv-navy)" : "transparent"}`,
                  background: "transparent",
                  color: on ? "var(--nv-ink)" : SIGN_BODY,
                  fontWeight: on ? 700 : 400,
                  fontFamily: "inherit",
                  borderRadius: 0,
                }}
              >
                {label}
                {badge > 0 ? (
                  <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", height: 18, padding: "0 6px", borderRadius: 999, font: "600 10px 'IBM Plex Mono', monospace", background: "var(--nv-warn-fill)", color: "#fff" }}>
                    {formatUiNumber(badge, ar)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </section>

      {view === "home" ? (
        <section style={{ ...PAPER, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line3)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {folders.map(([id, label, count]) => {
              const on = folder === id;
              return (
                <button
                  key={id}
                  type="button"
                  className="nv-sign-pill"
                  onClick={() => setFolder(id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: on ? "var(--nv-navy)" : SIGN_WHITE,
                    color: on ? "#fff" : SIGN_BODY,
                    border: on ? "1px solid var(--nv-navy)" : `1px solid ${SIGN_LINE}`,
                  }}
                >
                  {label}
                  <span dir="ltr" style={mono}>{formatUiNumber(count, ar)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
              <thead>
                <tr>
                  {(ar ? ["المستند", "الحالة والتقدّم", "الأطراف", ""] : ["Document", "Status and progress", "Parties", ""]).map((label) => (
                    <th key={label || "act"} style={{ textAlign: "start", fontSize: 10.5, color: SIGN_MUTED, fontWeight: 600, padding: "8px 14px", background: "var(--nv-hover)", borderBottom: `1px solid var(--nv-line3)`, whiteSpace: "nowrap" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests === null || loading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, fontSize: 12, color: SIGN_MUTED }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Loader2 className="h-4 w-4 animate-spin" />{ar ? "جارٍ تحميل المستندات…" : "Loading documents…"}</span>
                    </td>
                  </tr>
                ) : listed.map((request) => {
                  const bucket = deskBucket(request);
                  const { signed, total } = settledState(request);
                  const pct = total ? Math.round((signed / total) * 100) : 0;
                  const partyText = partyLine(request, currentUser, ar);
                  const downloadReady = canDownloadFinal(request);
                  const actLabel = bucket === "action" ? (ar ? "وقّع" : "Sign") : downloadReady ? (ar ? "تنزيل" : "Download") : (ar ? "تتبّع" : "Track");
                  const actStyle = bucket === "action"
                    ? { ...ghostBtn, background: "var(--nv-warn-fill)", color: "#fff", borderColor: "var(--nv-warn-fill)" }
                    : ghostBtn;
                  return (
                    <tr
                      key={request.id}
                      onClick={() => openRow(request)}
                      style={{ cursor: "pointer", background: bucket === "action" ? "var(--nv-warn-soft)" : SIGN_WHITE }}
                    >
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                          <span style={{ width: 32, height: 38, borderRadius: 5, flex: "none", display: "inline-flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 5, boxSizing: "border-box", font: "700 8px 'IBM Plex Mono', monospace", color: "#fff", background: TONE[bucket].fill }}>PDF</span>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <strong style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 340 }}>{request.fileName}</strong>
                            <span dir="ltr" style={{ ...mono, fontSize: 10, color: SIGN_MUTED, textAlign: "end" }}>{request.verificationId || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                          <span style={pillStyle(bucket)}>{deskLabel(request, ar)}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 56, height: 5, borderRadius: 999, background: "var(--nv-soft)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: TONE[bucket].fill }} />
                            </div>
                            <span dir="ltr" style={{ ...mono, fontSize: 10.5, fontWeight: 600 }}>{formatUiNumber(`${signed}/${total}`, ar)}</span>
                            <span dir="ltr" style={{ ...mono, fontSize: 10, color: SIGN_MUTED }}>{stamp(request.lastActivityAt || request.createdAt, ar)}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)", fontSize: 11.5, color: SIGN_BODY }}>{partyText}</td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)", position: "sticky", insetInlineEnd: 0, background: "inherit" }}>
                        <button
                          type="button"
                          style={actStyle}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (downloadReady && bucket !== "action") {
                              downloadFinalCopy(request);
                              return;
                            }
                            openRow(request);
                          }}
                        >
                          {actLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {requests !== null && !loading && listed.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: SIGN_MUTED, lineHeight: 1.8 }}>
              {folder === "draft"
                ? (ar ? "لا مسودات محفوظة. «مستند جديد» يفتح الورشة مباشرة." : "No saved drafts. New document opens the workshop directly.")
                : query
                  ? (ar ? `لا اتفاقية تطابق «${query}».` : `No agreement matches “${query}”.`)
                  : folder === "all"
                    ? (ar ? "لا اتفاقيات قيد التوقيع. ما اكتمل أو رُفض أو أُلغي تجده في الأرشيف." : "No agreement is in signing. Completed, refused, and voided envelopes are in the archive.")
                    : (ar ? "لا اتفاقيات في هذا المجلد." : "No agreements in this folder.")}
            </div>
          ) : null}
        </section>
      ) : null}

      {view === "archive" ? (
        <section style={{ ...PAPER, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line3)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {archiveChips.map(([id, label, count]) => {
              const on = archiveFolder === id;
              return (
                <button
                  key={id}
                  type="button"
                  className="nv-sign-pill"
                  onClick={() => setArchiveFolder(id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: on ? "var(--nv-navy)" : SIGN_WHITE,
                    color: on ? "#fff" : SIGN_BODY,
                    border: on ? "1px solid var(--nv-navy)" : `1px solid ${SIGN_LINE}`,
                  }}
                >
                  {label}
                  <span dir="ltr" style={mono}>{formatUiNumber(count, ar)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  {(ar
                    ? ["المستند", "الأطراف", "الحالة", "تاريخ الإغلاق", "البصمة", ""]
                    : ["Document", "Parties", "Status", "Closed", "Fingerprint", ""]
                  ).map((label) => (
                    <th key={label || "act"} style={{ textAlign: "start", fontSize: 10.5, color: SIGN_MUTED, fontWeight: 600, padding: "8px 14px", background: "var(--nv-hover)", borderBottom: "1px solid var(--nv-line3)", whiteSpace: "nowrap" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests === null || loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, fontSize: 12, color: SIGN_MUTED }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Loader2 className="h-4 w-4 animate-spin" />{ar ? "جارٍ تحميل الأرشيف…" : "Loading the archive…"}</span>
                    </td>
                  </tr>
                ) : archivedListed.map((request) => {
                  const bucket = deskBucket(request);
                  const finger = storedFingerprint(request);
                  const downloadReady = canDownloadFinal(request);
                  return (
                    <tr key={request.id} onClick={() => openRow(request)} style={{ cursor: "pointer", background: SIGN_WHITE }}>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                          <span style={{ width: 32, height: 38, borderRadius: 5, flex: "none", display: "inline-flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 5, boxSizing: "border-box", font: "700 8px 'IBM Plex Mono', monospace", color: "#fff", background: TONE[bucket].fill }}>PDF</span>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <strong style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{request.fileName}</strong>
                            <span dir="ltr" style={{ ...mono, fontSize: 10, color: SIGN_MUTED, textAlign: "end" }}>{request.verificationId || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)", fontSize: 11.5, color: SIGN_BODY }}>{partyLine(request, currentUser, ar)}</td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)" }}>
                        <span style={pillStyle(bucket)}>{deskLabel(request, ar)}</span>
                      </td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)" }}>
                        <span dir="ltr" style={{ ...mono, fontSize: 10.5, color: SIGN_BODY }}>{stamp(closeStamp(request), ar)}</span>
                      </td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)" }}>
                        <span dir="ltr" title={finger || undefined} style={{ ...mono, fontSize: 10.5, color: finger ? SIGN_INK : SIGN_MUTED }}>{finger ? shortFingerprint(finger) : "—"}</span>
                      </td>
                      <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line3)", position: "sticky", insetInlineEnd: 0, background: "inherit" }}>
                        <button
                          type="button"
                          style={ghostBtn}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (downloadReady) {
                              downloadFinalCopy(request);
                              return;
                            }
                            openRow(request);
                          }}
                        >
                          {downloadReady ? (ar ? "تنزيل" : "Download") : (ar ? "فتح" : "Open")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {requests !== null && !loading && archivedListed.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: SIGN_MUTED, lineHeight: 1.8 }}>
              {query
                ? (ar ? `لا مظروف مؤرشف يطابق «${query}».` : `No archived envelope matches “${query}”.`)
                : (ar ? "لا مظاريف في الأرشيف. المكتمل والمرفوض والمُلغى ينتقل إلى هنا بعد إغلاقه." : "Nothing is in the archive. Completed, refused, and voided envelopes move here once they close.")}
            </div>
          ) : null}
        </section>
      ) : null}

      {view === "track" ? (
        <SigningStatusBoard
          requests={requests === null ? null : (selected ? [selected] : rows.filter((row) => isOpenSigningState(settledState(row).state)).slice(0, 1))}
          loading={loading}
          currentUser={currentUser}
          companyId={companyId}
          ar={ar}
          onReload={onReload}
          focusRequestId={selected?.id || ""}
          sentLinks={sentLinks}
          variant="path"
          knownEmails={knownEmails}
        />
      ) : null}

      {view === "verify" ? <VerifyWorkspace ar={ar} companyId={companyId} /> : null}

      {view === "templates" ? (
        <section style={{ ...PAPER, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <strong style={{ font: "700 14px var(--font-heading), sans-serif" }}>{ar ? "لا قوالب محفوظة" : "No saved templates"}</strong>
          <p style={{ margin: 0, fontSize: 12, color: SIGN_BODY, lineHeight: 1.8, maxWidth: 640 }}>
            {ar
              ? "المكتبة في المرجع واجهة فقط. هنا ترفع المستند إلى ورشة التحضير، ثم تضع الختم أو ترسله للأطراف."
              : "The reference library is layout only. Here you upload the document into the workshop, then seal it or send it to the parties."}
          </p>
          <button type="button" onClick={() => inputRef.current?.click()} style={{ ...navyBtn, alignSelf: "flex-start" }}>{ar ? "مستند جديد للتوقيع" : "New document to sign"}</button>
        </section>
      ) : null}

      {view === "reports" ? (
        <ReportsBoard ar={ar} rows={rows} stations={stations} onOpen={(request) => { setSelectedId(request.id); setView("track"); }} />
      ) : null}

      {view === "settings" ? (
        <section className="nv-sign-reports" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16, alignItems: "start" }}>
          <div style={{ ...PAPER, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <strong style={{ font: "700 13.5px var(--font-heading), sans-serif" }}>{ar ? "الختم" : "Seal"}</strong>
            <span style={{ fontSize: 12, color: SIGN_INK }}>{companyName ? `${companyName} · ${ar ? "التوقيع" : "Signing"}` : (ar ? "نيروفيرا · التوقيع" : "NiroVera · Signing")}</span>
            <div style={{ border: `1px solid ${SIGN_LINE}`, borderRadius: 10, background: SIGN_WHITE, minHeight: 72, padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {sealPreview
                ? <img src={sealPreview} alt={ar ? "ختمك" : "Your seal"} style={{ maxWidth: "100%", maxHeight: 72, objectFit: "contain" }} />
                : <span style={{ fontSize: 12, color: SIGN_MUTED }}>{ar ? "لم يُنشأ الختم بعد." : "No seal yet."}</span>}
            </div>
            {sealId ? <span dir="ltr" style={{ ...mono, fontSize: 10, color: "var(--nv-ok-fill)", textAlign: "end" }}>{sealId}</span> : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onOpenStudio} style={{ ...ghostBtn, flex: 1 }}>{sealReady ? (ar ? "تغيير الختم" : "Change seal") : (ar ? "صمّم ختمك" : "Design your seal")}</button>
              {sealReady ? <button type="button" onClick={onRemoveSeal} style={ghostBtn}>{ar ? "حذف" : "Remove"}</button> : null}
            </div>
          </div>
          <div style={{ ...PAPER, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <strong style={{ font: "700 13.5px var(--font-heading), sans-serif" }}>{ar ? "الأمان والاحتفاظ" : "Security and retention"}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "6px 14px", fontSize: 11.5 }}>
              <span style={{ color: SIGN_MUTED }}>{ar ? "البصمة" : "Fingerprint"}</span>
              <span dir="ltr" style={{ ...mono, textAlign: "end" }}>SHA-256</span>
              <span style={{ color: SIGN_MUTED }}>{ar ? "التحقق" : "Verify"}</span>
              <span>{ar ? "على جهازك، مقابل سجل الشركة" : "On your device, against the company registry"}</span>
              <span style={{ color: SIGN_MUTED }}>{ar ? "مهلة التراجع" : "Retract window"}</span>
              <span>{ar ? "تُغلق قبل تثبيت البصمة ورقم التحقق" : "Closes before the fingerprint and verification id register"}</span>
              <span style={{ color: SIGN_MUTED }}>{ar ? "العزل" : "Isolation"}</span>
              <span>{ar ? "مظاريف هذه الشركة فقط" : "This company's envelopes only"}</span>
            </div>
            <span style={{ fontSize: 10.5, color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)", border: "1px solid var(--nv-warn-line)", padding: "8px 10px", borderRadius: 9, lineHeight: 1.7 }}>
              {ar
                ? "ليست شهادة حكومية مؤهلة. رابط الطرف شخصي، والحذف يبقى في الأرشيف مع السبب."
                : "Not a qualified government certificate. A party link is personal, and deletion stays in the archive with its reason."}
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReportsBoard({ ar, rows, stations, onOpen }) {
  const weeks = recentWeeks();
  const sent = weeks.map((key) => rows.filter((row) => weekStart(row.createdAt) === key).length);
  const done = weeks.map((key) => rows.filter((row) => deskBucket(row) === "done" && weekStart(row.lastActivityAt || row.createdAt) === key).length);
  const max = Math.max(1, ...sent, ...done);
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthCount = rows.filter((row) => String(row.createdAt || "").slice(0, 7) === monthKey).length;
  const doneCount = rows.filter((row) => deskBucket(row) === "done").length;
  const rate = rows.length ? Math.round((doneCount / rows.length) * 100) : 0;
  const durations = rows.filter((row) => deskBucket(row) === "done").map((row) => {
    const start = Date.parse(row.createdAt || "");
    const end = Date.parse(row.lastActivityAt || row.createdAt || "");
    if (!start || !end || end < start) return null;
    return (end - start) / 86400000;
  }).filter((value) => value !== null);
  const average = durations.length ? (durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
  const refused = rows.filter((row) => settledState(row).state === "rejected").length;
  const stuck = rows.filter((row) => {
    if (!isOpenSigningState(settledState(row).state)) return false;
    const at = Date.parse(row.lastActivityAt || row.createdAt || "");
    return at && (Date.now() - at) >= 3 * 86400000;
  });
  const byStation = new Map();
  rows.filter((row) => deskBucket(row) === "done").forEach((row) => {
    const station = (stations || []).find((item) => item.id === row.stationId);
    const name = station?.name || station?.nameAr || (ar ? "غير مربوط بفرع" : "No branch");
    const start = Date.parse(row.createdAt || "");
    const end = Date.parse(row.lastActivityAt || row.createdAt || "");
    const days = start && end && end >= start ? (end - start) / 86400000 : null;
    const current = byStation.get(name) || { name, total: 0, n: 0 };
    if (days !== null) {
      current.total += days;
      current.n += 1;
    }
    byStation.set(name, current);
  });
  const depts = [...byStation.values()].map((row) => ({ ...row, avg: row.n ? row.total / row.n : 0 })).sort((left, right) => right.avg - left.avg).slice(0, 5);
  const deptMax = Math.max(1, ...depts.map((row) => row.avg));
  const kpis = [
    { label: ar ? "مظاريف هذا الشهر" : "Envelopes this month", value: formatUiNumber(monthCount, ar), note: ar ? "من تاريخ الإنشاء" : "By created date" },
    { label: ar ? "نسبة الإكمال" : "Completion", value: formatUiNumber(`${rate}%`, ar), note: ar ? "المكتمل من الظاهر لك" : "Completed among what you can see" },
    { label: ar ? "متوسط وقت الإكمال" : "Average completion", value: average === null ? "—" : formatUiNumber(`${average.toFixed(1)} ${ar ? "يوم" : "d"}`, ar), note: ar ? "من الإنشاء حتى آخر نشاط" : "From creation to last activity" },
    { label: ar ? "مرفوض" : "Refused", value: formatUiNumber(refused, ar), note: ar ? "رفضه الجميع" : "Refused by every party" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {kpis.map((item) => (
          <div key={item.label} style={{ ...PAPER, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: SIGN_MUTED }}>{item.label}</span>
            <strong dir="ltr" style={{ ...mono, fontSize: 24, fontWeight: 600, textAlign: "end" }}>{item.value}</strong>
            <span style={{ fontSize: 11, color: SIGN_BODY }}>{item.note}</span>
          </div>
        ))}
      </section>
      <div className="nv-sign-reports" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <section style={{ ...PAPER, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong style={{ font: "700 13.5px var(--font-heading), sans-serif" }}>{ar ? "مظاريف مُرسلة — 12 أسبوعاً" : "Sent envelopes — 12 weeks"}</strong>
            <span style={{ fontSize: 11, color: SIGN_MUTED }}>{ar ? "المكتمل بالأخضر" : "Completed in green"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6, alignItems: "end", height: 150 }}>
            {weeks.map((key, index) => (
              <div key={key} title={`${sent[index]} / ${done[index]}`} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", gap: 2 }}>
                <span style={{ borderRadius: "4px 4px 0 0", height: `${Math.round(((sent[index] - Math.min(sent[index], done[index])) / max) * 100)}%`, background: "var(--nv-box)", minHeight: sent[index] ? 2 : 0 }} />
                <span style={{ borderRadius: "0 0 2px 2px", height: `${Math.round((Math.min(sent[index], done[index]) / max) * 100)}%`, background: "var(--nv-ok-fill)", minHeight: done[index] ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6, font: "500 9.5px 'IBM Plex Mono', monospace", color: SIGN_MUTED, textAlign: "center" }}>
            {weeks.map((key) => <span key={key} dir="ltr">{key.slice(5)}</span>)}
          </div>
        </section>
        <section style={{ ...PAPER, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <strong style={{ font: "700 13.5px var(--font-heading), sans-serif" }}>{ar ? "متوسط وقت الإكمال حسب الفرع" : "Average completion by branch"}</strong>
          {depts.length === 0 ? <span style={{ fontSize: 12, color: SIGN_MUTED }}>{ar ? "لا مكتمل بعد ليُحسب المتوسط." : "Nothing completed yet, so there is no average."}</span> : depts.map((row) => (
            <div key={row.name} style={{ display: "grid", gridTemplateColumns: "110px minmax(0, 1fr) 54px", gap: 10, alignItems: "center", fontSize: 11.5 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
              <div style={{ height: 8, borderRadius: 999, background: "var(--nv-soft)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round((row.avg / deptMax) * 100)}%`, background: row.avg > 3 ? "var(--nv-bad-fill)" : "var(--nv-ok-fill)" }} />
              </div>
              <span dir="ltr" style={{ ...mono, textAlign: "end" }}>{formatUiNumber(row.avg.toFixed(1), ar)}</span>
            </div>
          ))}
        </section>
      </div>
      <section style={{ ...PAPER, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line3)" }}>
          <strong style={{ font: "700 13.5px var(--font-heading), sans-serif" }}>{ar ? "متعثّرة — لم تكتمل بعد 3 أيام" : "Stuck — still open after 3 days"}</strong>
        </div>
        {stuck.length === 0 ? (
          <div style={{ padding: "16px 18px", fontSize: 12, color: SIGN_MUTED }}>{ar ? "لا مظروف مفتوح تجاوز 3 أيام." : "No open envelope is past 3 days."}</div>
        ) : stuck.map((row) => {
          const days = Math.floor((Date.now() - Date.parse(row.lastActivityAt || row.createdAt)) / 86400000);
          const who = (row.signers || []).find((signer) => signer.status === "pending")?.name || row.creatorName || "—";
          return (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(120px, 180px) 90px auto", gap: 12, alignItems: "center", padding: "10px 18px", borderBottom: "1px solid var(--nv-line2)", fontSize: 12 }}>
              <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.fileName}</strong>
              <span style={{ color: SIGN_BODY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</span>
              <span dir="ltr" style={{ ...mono, color: "var(--nv-bad-ink)", textAlign: "end" }}>{formatUiNumber(days, ar)} {ar ? "يوم" : "d"}</span>
              <button type="button" onClick={() => onOpen(row)} style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 10px", borderRadius: 8, border: `1px solid ${SIGN_LINE}`, background: SIGN_WHITE, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{ar ? "تتبّع" : "Track"}</button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
