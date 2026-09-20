import React, { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sha256HexOfBuffer } from "@/lib/fileHash";
import { getCompanyToken } from "@/lib/store";
import { verifyLocalSignedDoc, verifyPublicSignedDoc } from "@/lib/localSignedDocs";
import { BORDER, CARD, INK, MUTED, SURFACE, field, labelMuted } from "@/lib/platformStyles";
import { signGhostBtn, signMono, signPrimaryBtn } from "@/components/files/signingUi";
import {
  VERIFY_AMBER,
  VERIFY_MUTED,
  VERIFY_NAVY,
  VERIFY_OK,
  VERIFY_RED,
  fileTooLarge,
  isPdfFile,
  preferVerifyAnswer,
  verifyKindOf,
  verifyOutcomeCopy,
} from "@/lib/verifyDocument";

/** Latin token that does not flip the surrounding Arabic row. */
function Ltr({ children, style, ar }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: "isolate", textAlign: ar ? "right" : "left", ...style }}>
      {children}
    </span>
  );
}

function stampWhen(value, ar) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    calendar: "gregory",
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function fileMeta(file) {
  if (!file) return "";
  const kb = file.size >= 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(file.size / 1024))} KB`;
  return `${file.name} · ${kb}`;
}

function fileStateLabel(kind, ar) {
  if (kind === "ok") return ar ? "مكتمل · مسجّل" : "Complete · registered";
  if (kind === "modified") return ar ? "بصمة غير مطابقة" : "Fingerprint mismatch";
  if (kind === "none") return ar ? "غير مسجّل" : "Not registered";
  if (kind === "cooling") return "pending · cooling";
  if (kind === "reuse") return "SIGNATURE_REUSE";
  return "—";
}

export default function VerifyDocumentCard({ ar, companyId, initialId = "", embed = false }) {
  const [checking, setChecking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [pickError, setPickError] = useState("");
  const [verId, setVerId] = useState(initialId);
  const fileRef = useRef(null);

  useEffect(() => {
    setVerId(initialId);
  }, [initialId]);

  const takeFile = (next) => {
    if (!next) return;
    if (!isPdfFile(next)) {
      setPickError(ar ? "اختر ملف PDF فقط." : "Choose a PDF file only.");
      return;
    }
    if (fileTooLarge(next)) {
      setPickError(ar ? "الملف أكبر من 25 ميغابايت." : "The file is larger than 25 MB.");
      return;
    }
    setPickError("");
    setResult(null);
    setFile(next);
  };

  const run = async () => {
    if (!file || checking) return;
    setChecking(true);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const fileHash = await sha256HexOfBuffer(buffer);
      const local = companyId
        ? verifyLocalSignedDoc(companyId, { fileHash, verificationId: verId.trim(), fileName: file.name })
        : verifyPublicSignedDoc({ fileHash, verificationId: verId.trim(), fileName: file.name });
      let remote = null;
      try {
        const res = await base44.functions.invoke("signedDocs", {
          action: "verify",
          fileHash,
          verificationId: verId.trim() || null,
          fileName: file.name,
          companyId: companyId || "",
          sessionToken: companyId ? getCompanyToken(companyId) : "",
        });
        remote = res.data;
      } catch {
        remote = null;
      }
      const answer = preferVerifyAnswer(remote, local) || { status: "unknown", kind: "none" };
      setResult({
        ...answer,
        uploadedHash: answer.uploadedHash || fileHash,
        registryHash: answer.registryHash || "",
        fileName: file.name,
      });
    } catch {
      setResult({ status: "error", kind: "" });
    } finally {
      setChecking(false);
    }
  };

  const kind = verifyKindOf(result);
  const copy = verifyOutcomeCopy(kind, ar);
  const dash = "—";
  const facts = !copy ? [] : kind === "reuse"
    ? [
      { label: ar ? "المستند الأصلي" : "Original document", value: result.originalFileName || result.fileName || dash, latin: false, color: VERIFY_NAVY },
      { label: ar ? "رقم التحقق" : "Verification id", value: result.verificationId || dash, latin: true, color: VERIFY_RED },
      { label: ar ? "سُجّل في" : "Registered at", value: stampWhen(result.signedAt, ar), latin: true, color: VERIFY_NAVY },
        { label: ar ? "حالة الملف" : "File state", value: fileStateLabel(kind, ar), latin: true, color: VERIFY_RED },
    ]
    : kind === "cooling"
      ? [
        { label: ar ? "الموقّع" : "Signer", value: result.signerName || dash, latin: false, color: VERIFY_NAVY },
        { label: ar ? "رقم التحقق" : "Verification id", value: result.verificationId || dash, latin: true, color: VERIFY_AMBER },
        { label: ar ? "تنتهي المهلة" : "Window closes", value: stampWhen(result.coolingUntil, ar), latin: true, color: VERIFY_AMBER },
        { label: ar ? "حالة الملف" : "File state", value: fileStateLabel(kind, ar), latin: true, color: VERIFY_AMBER },
      ]
      : [
        { label: ar ? "الموقّع" : "Signer", value: result.signerName || dash, latin: false, color: kind === "none" ? MUTED : INK },
        { label: ar ? "رقم التحقق" : "Verification id", value: result.verificationId || dash, latin: true, color: kind === "ok" ? VERIFY_OK : kind === "none" ? MUTED : INK },
        { label: ar ? "تاريخ التوقيع" : "Signed at", value: result.signedAt ? stampWhen(result.signedAt, ar) : dash, latin: true, color: kind === "none" ? MUTED : INK },
        { label: ar ? "حالة الملف" : "File state", value: fileStateLabel(kind, ar), latin: !ar, color: copy.color },
      ];

  const uploaded = result?.uploadedHash || "";
  const registry = result?.registryHash || "";

  return (
    <div dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"}>
      <div style={{ padding: embed ? 0 : "20px 24px", display: "flex", flexDirection: "column", gap: 16, textAlign: "start" }}>
      <label>
        <span style={{ ...labelMuted, display: "block", textAlign: "start" }}>
          {ar ? "رقم التحقق" : "Verification id"}{" "}
          <span>({ar ? "اختياري" : "optional"})</span>
        </span>
        <input
          className="nv-verify-field"
          value={verId}
          onChange={(event) => setVerId(event.target.value)}
          dir="ltr"
          placeholder="PWC-XXXX-XXXX-XXXX"
          autoComplete="off"
          style={{
            ...field,
            ...signMono,
            background: CARD,
            letterSpacing: "0.06em",
            outline: "none",
          }}
        />
      </label>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !checking && fileRef.current?.click()}
        onKeyDown={(event) => { if (event.key === "Enter") fileRef.current?.click(); }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          takeFile(event.dataTransfer.files?.[0]);
        }}
        style={{
          position: "relative",
          background: dragging || file ? "#f3fbf6" : CARD,
          border: `1.5px dashed ${dragging || file ? "#1d9a5b" : "#dfe3ea"}`,
          borderRadius: 14,
          padding: "40px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 11,
          textAlign: "center",
          cursor: checking ? "wait" : "pointer",
        }}
      >
        <span style={{ width: 44, height: 44, borderRadius: 10, background: SURFACE, border: "1px solid #dfe3ea", display: "inline-flex", alignItems: "center", justifyContent: "center", color: INK }}>
          {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload style={{ width: 20, height: 20 }} />}
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: INK }}>
          {file
            ? (ar ? "الملف جاهز للمطابقة" : "File ready to match")
            : (ar ? "اسحب النسخة المختومة هنا أو اخترها" : "Drop the sealed copy here, or pick it")}
        </span>
        <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.8, maxWidth: 480 }}>
          {file
            ? (ar ? "اضغط «تحقق الآن» لحساب البصمة ومطابقتها مع سجل الشركة." : "Press Verify now to compute the fingerprint and match it against the company registry.")
            : (ar ? "رقم التحقق أعلاه اختياري: البصمة وحدها تكفي لمعرفة إن كان الملف مطابقًا للسجل أم عُدّل بعد الختم." : "The verification id above is optional: the fingerprint alone tells whether the file matches the registry or was changed after sealing.")}
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center", ...signMono, fontSize: 11, color: MUTED, marginTop: 4 }}>
          <Ltr>PDF · ≤ 25 MB</Ltr>
          <span>·</span>
          <span style={{ fontFamily: "inherit" }}>{ar ? "لا يُرفع الملف" : "The file is never uploaded"}</span>
        </span>
        <span style={{ ...signPrimaryBtn, marginTop: 8, pointerEvents: "none" }}>
          {file ? (ar ? "اختيار ملف آخر" : "Choose another file") : (ar ? "اختيار ملف" : "Choose a file")}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => { takeFile(event.target.files?.[0]); event.target.value = ""; }}
          onClick={(event) => event.stopPropagation()}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
        />
      </div>

      {file ? (
        <div style={{ border: `1px solid ${BORDER}`, background: SURFACE, borderRadius: 10, padding: "10px 12px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
          <span style={{ width: 34, height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, display: "inline-flex", alignItems: "center", justifyContent: "center", ...signMono, fontSize: 9, color: MUTED }}>PDF</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
            <Ltr ar={ar} style={{ ...signMono, fontSize: 11, color: MUTED }}>{fileMeta(file)}</Ltr>
          </span>
          <button
            type="button"
            onClick={() => { setFile(null); setResult(null); setPickError(""); }}
            style={{ ...signGhostBtn, padding: "7px 10px", fontSize: 12 }}
          >
            {ar ? "إزالة" : "Remove"}
          </button>
        </div>
      ) : null}

      {pickError ? <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{pickError}</p> : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={run}
          disabled={!file || checking}
          style={{ ...signPrimaryBtn, opacity: !file || checking ? 0.45 : 1, cursor: !file || checking ? "not-allowed" : "pointer" }}
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {checking ? (ar ? "جارٍ حساب البصمة…" : "Computing the fingerprint…") : (ar ? "تحقق الآن" : "Verify now")}
        </button>
        <span style={{ fontSize: 12, color: MUTED }}>
          {checking
            ? (ar ? "SHA-256 على جهازك — الملف لا يُرفع" : "SHA-256 on your device — the file is not uploaded")
            : file
              ? (ar ? "تُحسب SHA-256 على جهازك" : "SHA-256 is computed on your device")
              : (ar ? "اختر الملف أولاً" : "Choose the file first")}
        </span>
      </div>

      {result?.status === "error" && !copy ? (
        <p style={{ margin: 0, fontSize: 12, color: "#8a1c2b" }}>{ar ? "تعذّر التحقق — حاول مجددًا." : "Verification failed — try again."}</p>
      ) : null}
      </div>

      {copy ? (
        <div style={{ borderTop: "1px solid #eef0f4", padding: embed ? "16px 0 0" : "20px 24px", display: "flex", flexDirection: "column", gap: 16, textAlign: "start" }}>
          <div style={{ border: "1px solid var(--nv-line, #dfe3ea)", borderTop: `3px solid ${copy.color}`, background: copy.bg, borderRadius: 14, boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)", padding: "18px 20px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 16, alignItems: "start" }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, background: copy.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>{copy.mark}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, textAlign: "start" }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: copy.color }}>{copy.title}</span>
              <span style={{ fontSize: 13, lineHeight: 1.9, color: "#3c4657" }}>{copy.desc}</span>
              <span style={{ fontSize: 12, lineHeight: 1.9, color: VERIFY_MUTED, borderTop: `1px solid ${copy.border}`, paddingTop: 8, marginTop: 2 }}>{copy.note}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", border: "1px solid #eef0f4", borderRadius: 14, overflow: "hidden" }}>
            {facts.map((fact) => (
              <div key={fact.label} style={{ padding: "13px 16px", borderInlineStart: "1px solid #eef0f4", display: "flex", flexDirection: "column", gap: 3, alignItems: "stretch", textAlign: "start" }}>
                <span style={{ fontSize: 11, color: MUTED }}>{fact.label}</span>
                {fact.latin ? (
                  <Ltr ar={ar} style={{ fontSize: 13, fontWeight: 600, color: fact.color, ...signMono }}>{fact.value}</Ltr>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: fact.color }}>{fact.value}</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "start" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>{ar ? "مطابقة البصمة" : "Fingerprint match"}</span>
            {[
              { label: "UPLOADED", value: uploaded || dash, color: kind === "ok" ? VERIFY_OK : INK },
              { label: "REGISTRY", value: kind === "none" || !registry ? "no record" : registry, color: kind === "ok" ? VERIFY_OK : kind === "none" ? MUTED : VERIFY_RED },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 11, borderBottom: "1px solid #f2f4f7", paddingBottom: 7 }}>
                <span style={{ ...signMono, color: MUTED, flex: "none" }}>{row.label}</span>
                <Ltr ar={ar} style={{ ...signMono, flex: 1, minWidth: 0, wordBreak: "break-all", color: row.color }}>{row.value}</Ltr>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
