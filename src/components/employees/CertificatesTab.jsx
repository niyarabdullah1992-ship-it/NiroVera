import React, { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { base44 } from "@/api/base44Client";
import { addCertificate, removeCertificate, setCertificateStatus } from "@/lib/store";
import { Loader2, Plus, Check, X, Paperclip } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { BORDER, MUTED, NAVY, NAVY_FILL, OK, WARN, BAD, NEUTRAL, field, CARD, SURFACE } from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";

/** Competency codes tracked on the employee file (CERT_FOR). */
export const COMPETENCY_CODES = [
  { code: "loto", ar: "العزل والوسم LOTO", en: "Lock-out / tag-out" },
  { code: "fa", ar: "الإسعافات الأولية", en: "First aid" },
  { code: "wah", ar: "العمل على ارتفاع", en: "Work at height" },
  { code: "cs", ar: "الأماكن المحصورة", en: "Confined space" },
];

function daysTo(iso) {
  if (!iso) return null;
  const d = Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00`) - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

function expiryChip(iso, status, ar, t) {
  if (status === "rejected") return { text: t("rejected"), style: BAD };
  if (status === "pending") return { text: t("pending"), style: WARN };
  const d = daysTo(iso);
  if (d === null) {
    if (status === "approved") return { text: ar ? "ساري" : "Valid", style: OK };
    return { text: "—", style: NEUTRAL };
  }
  if (d < 0 || status === "expired") return { text: ar ? "منتهٍ" : "Expired", style: BAD };
  if (d <= 60) return { text: ar ? `${d} يومًا` : `${d} days`, style: WARN };
  return { text: ar ? "ساري" : "Valid", style: OK };
}

function niceDate(iso, ar) {
  if (!iso) return "—";
  try {
    return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(
      ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
      { year: "numeric", month: "short", day: "numeric" },
    );
  } catch {
    return String(iso).slice(0, 10);
  }
}

const COLS = "minmax(220px,1.6fr) minmax(180px,1fr) 130px 110px";

/** Platform isTabCerts — L2875–2899 */
export default function CertificatesTab({ employee, companyId, canEdit, canApprove, currentUser }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [code, setCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const certs = employee.certificates || [];

  const submit = async () => {
    if (!name.trim() || !file) return;
    setUploading(true);
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      const selected = COMPETENCY_CODES.find((c) => c.code === code);
      addCertificate(companyId, employee.id, {
        name: name.trim(),
        category: category.trim() || (selected ? (ar ? selected.ar : selected.en) : ""),
        code: code || null,
        expiryDate: expiryDate || null,
        url: up.file_url,
        fileName: file.name,
        uploadedBy: currentUser?.name,
      });
      setName("");
      setCategory("");
      setCode("");
      setExpiryDate("");
      setFile(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const decide = (id, status) => setCertificateStatus(companyId, employee.id, id, status, currentUser?.name);

  const head = {
    display: "grid",
    gridTemplateColumns: COLS,
    gap: "12px",
    padding: "10px 20px",
    background: SURFACE,
    borderTop: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
    fontSize: "10px",
    letterSpacing: "0.06em",
    color: MUTED,
    fontWeight: 600,
  };

  const inputStyle = { ...field };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} dir={ar ? "rtl" : "ltr"}>
      <ChromeBox padded={false}>
        <div style={{ padding: "16px 20px 12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "الشهادات والتراخيص" : "Certifications and licences"}
          </div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>
            {ar
              ? "المؤهلات والرخص المهنية جزء من ملف العامل. يُفضَّل تجديد الشهادة المنتهية من قسم السلامة."
              : "Qualifications and professional licences belong on the employee file. Renew an expired certificate from Safety when you can."}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: "620px" }}>
            <div style={head}>
              <div>{ar ? "الشهادات والتراخيص" : "Certifications and licences"}</div>
              <div>{ar ? "الجهة المانحة" : "Issuer"}</div>
              <div>{ar ? "تاريخ الانتهاء" : "Expiry"}</div>
              <div>{ar ? "الحالة" : "Status"}</div>
            </div>
            {certs.length === 0 ? (
              <div style={{ padding: "22px 20px", fontSize: "13px", color: MUTED }}>
                {t("noCertificates")}
              </div>
            ) : (
              certs.map((c) => {
                const codeMeta = COMPETENCY_CODES.find((x) => x.code === c.code);
                const issuer = c.category || (codeMeta ? (ar ? codeMeta.ar : codeMeta.en) : "—");
                const chip = expiryChip(c.expiryDate, c.status || "pending", ar, t);
                return (
                  <div
                    key={c.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: COLS,
                      gap: "12px",
                      padding: "13px 20px",
                      borderBottom: "1px solid #F1F5F9",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "13px", fontWeight: 500, color: NAVY, textDecoration: "none" }}
                      >
                        {c.name}
                      </a>
                      {(canApprove || canEdit) && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                          {canApprove && (c.status || "pending") === "pending" && (
                            <>
                              <button
                                type="button"
                                title={t("approveCert")}
                                onClick={() => decide(c.id, "approved")}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "8px",
                                  border: "1px solid #BBF7D0",
                                  background: "#ECFDF3",
                                  color: "#15803D",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                <Check style={{ width: 12, height: 12 }} />
                              </button>
                              <button
                                type="button"
                                title={t("rejectCert")}
                                onClick={() => decide(c.id, "rejected")}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "8px",
                                  border: "1px solid #FECACA",
                                  background: "#FEF2F2",
                                  color: "#DC2626",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                <X style={{ width: 12, height: 12 }} />
                              </button>
                            </>
                          )}
                          {canEdit && (
                            <ConfirmDeleteDialog
                              onConfirm={() => removeCertificate(companyId, employee.id, c.id)}
                              trigger={
                                <button
                                  type="button"
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "8px",
                                    border: `1px solid ${BORDER}`,
                                    background: CARD,
                                    color: "#DC2626",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    fontSize: "11px",
                                  }}
                                >
                                  {ar ? "حذف" : "Delete"}
                                </button>
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: MUTED }}>{issuer}</div>
                    <div style={{ fontSize: "12px", color: MUTED }}>{niceDate(c.expiryDate, ar)}</div>
                    <div><span style={chip.style}>{chip.text}</span></div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </ChromeBox>

      {canEdit && (
        <ChromeBox>
        <details>
          <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: NAVY, listStyle: "none" }}>
            {ar ? "إضافة شهادة جديدة" : "Add a certificate"}
          </summary>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: "12px",
            marginTop: "14px",
          }}
          >
            <div>
              <div style={{ fontSize: "11px", color: MUTED, marginBottom: "6px" }}>{t("certificateName")}</div>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: MUTED, marginBottom: "6px" }}>
                {ar ? "كود الكفاءة" : "Competency code"}
              </div>
              <select value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {COMPETENCY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{ar ? c.ar : c.en}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: MUTED, marginBottom: "6px" }}>
                {ar ? "تاريخ الانتهاء" : "Expiry date"}
              </div>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: MUTED, marginBottom: "6px" }}>{t("category")}</div>
              <input value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: MUTED, marginBottom: "6px" }}>{t("attachFile")}</div>
              <input ref={inputRef} type="file" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                style={{
                  ...inputStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <Paperclip style={{ width: 12, height: 12 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {file ? file.name : t("attachFile")}
                </span>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim() || !file || uploading}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "9px",
                  border: "none",
                  background: NAVY_FILL,
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity: !name.trim() || !file || uploading ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {uploading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Plus style={{ width: 14, height: 14 }} />}
                {t("addCertificate")}
              </button>
            </div>
          </div>
        </details>
        </ChromeBox>
      )}
    </div>
  );
}
