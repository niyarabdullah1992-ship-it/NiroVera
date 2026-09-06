import React, { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { updateEmployeeProfile } from "@/lib/store";
import { syncEmployeeSalaryToPayroll } from "@/lib/payroll";
import { base44 } from "@/api/base44Client";
import { Loader2, Banknote, Stamp } from "lucide-react";
import { normalizeLocalizedNumber } from "@/lib/localizedNumber";
import { MUTED, NAVY, NAVY_FILL, ui, field } from "@/lib/platformStyles";
import { isSaudiForNitaqat } from "@/lib/complianceDerivations";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

const money = (n) => Number(n || 0).toLocaleString("en-US");

/** Platform isTabSalary — L2713–2738 */
export default function SalaryTab({ employee, companyId, canEdit }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const profile = employee.profile || {};
  const [form, setForm] = useState({
    baseSalary: profile.baseSalary || "",
    allowances: profile.allowances || "",
    currency: profile.currency || "SAR",
  });

  const base = Number(profile.baseSalary) || 0;
  const allow = Number(profile.allowances) || 0;
  const currency = profile.currency || "SAR";
  const saudi = isSaudiForNitaqat({ ...profile, nationalId: profile.nationalId || employee.nationalId, nationality: profile.nationality || employee.nationality });
  const gosiEmp = saudi ? Math.round(base * 0.0975) : 0;
  const net = base + allow - gosiEmp;

  const rows = [
    { label: ar ? "الراتب الأساسي" : "Base salary", value: money(base) },
    { label: ar ? "البدلات" : "Allowances", value: money(allow) },
    saudi
      ? { label: ar ? "التأمينات الاجتماعية — حصة الموظف 9.75%" : "GOSI — employee share 9.75%", value: `-${money(gosiEmp)}` }
      : { label: ar ? "التأمينات — أخطار مهنية 2% على صاحب العمل" : "GOSI — 2% occupational hazards, employer-paid", value: ar ? "لا خصم على الموظف" : "No employee deduction" },
  ];

  const save = () => {
    const baseSalary = Number(normalizeLocalizedNumber(form.baseSalary));
    const allowances = Number(normalizeLocalizedNumber(form.allowances || 0));
    const cur = String(form.currency || "").trim().toUpperCase();
    if (!Number.isFinite(baseSalary) || baseSalary <= 0 || !Number.isFinite(allowances) || allowances < 0 || !/^[A-Z]{3}$/.test(cur)) {
      setError(ar ? "أدخل راتبًا أساسيًا موجبًا وبدلات غير سالبة ورمز عملة من 3 أحرف." : "Enter a positive base salary, non-negative allowances, and a 3-letter currency code.");
      return;
    }
    updateEmployeeProfile(companyId, employee.id, { baseSalary, allowances, currency: cur });
    syncEmployeeSalaryToPayroll(companyId, employee.id);
    setError("");
    setEditing(false);
  };

  const uploadCertificate = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      updateEmployeeProfile(companyId, employee.id, { salaryCertificateUrl: up.file_url, salaryCertificateName: file.name });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const inputStyle = { ...field };

  const iban = String(profile.iban || "").replace(/\s+/g, "").toUpperCase();
  const wageMeta = canEdit ? (
    editing ? (
      <button type="button" onClick={save} style={{ ...ui.btnGhost, background: NAVY_FILL, color: "#fff", border: "none", fontWeight: 600 }}>
        {t("save")}
      </button>
    ) : (
      <button type="button" onClick={() => setEditing(true)} style={ui.btnGhost}>{t("edit")}</button>
    )
  ) : (
    <span style={{ fontSize: "10px", color: MUTED }}>{ar ? "للإدارة فقط" : "Management only"}</span>
  );

  return (
    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "flex-start" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ flex: "999 1 320px" }}>
      <IdentityCard
        icon={Banknote}
        kicker={ar ? "أجر مشتق" : "Derived wage"}
        title={ar ? "الأجر" : "Wage"}
        subtitle={ar
          ? "الأساسي والبدلات في الملف. المادة 93 لحد الحسم. التأمينات بلا شارة نظام."
          : "Base and allowances on the file. Article 93 for the deduction cap. GOSI has no Labour Law chip."}
        meta={wageMeta}
      >
        <div style={{ marginBottom: 14 }}>
          <LaborArticleCite ruleId="payroll.deduction.capRatio" ar={ar} showText />
        </div>
        {saudi ? (
          <div style={{ marginBottom: 14 }}>
            <LaborArticleCite ruleId="compliance.gosi.employeeRate" ar={ar} showText />
          </div>
        ) : null}
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "11px", marginTop: "16px" }}>
            {[["baseSalary", ar ? "الراتب الأساسي" : "Base salary"], ["allowances", ar ? "البدلات" : "Allowances"], ["currency", ar ? "العملة" : "Currency"]].map(([key, label]) => (
              <div key={key}>
                <div style={{ fontSize: "11px", color: MUTED, marginBottom: "6px" }}>{label}</div>
                <input
                  type="text"
                  inputMode={key === "currency" ? "text" : "decimal"}
                  value={form[key]}
                  onChange={(e) => {
                    setForm({ ...form, [key]: key === "currency" ? e.target.value : normalizeLocalizedNumber(e.target.value) });
                    setError("");
                  }}
                  style={inputStyle}
                />
              </div>
            ))}
            {error && <div style={{ fontSize: "12px", color: "#DC2626" }}>{error}</div>}
          </div>
        ) : !canEdit && !profile.baseSalary ? (
          <div style={{ marginTop: "16px", fontSize: "13px", color: MUTED }}>—</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "11px", marginTop: "16px" }}>
            {rows.map((r) => (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "12px",
                  paddingBottom: "11px",
                  borderBottom: "1px solid #F1F5F9",
                }}
              >
                <span style={{ fontSize: "13px", color: MUTED }}>{r.label}</span>
                <span dir="ltr" style={{ fontSize: "14px", fontWeight: 500, fontFamily: "'IBM Plex Sans',sans-serif", color: NAVY }}>
                  {r.value}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", paddingTop: "4px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "الصافي الشهري" : "Monthly net"}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span dir="ltr" style={{ fontSize: "22px", fontWeight: 600, fontFamily: "'IBM Plex Sans',sans-serif", color: NAVY }}>
                  {money(net)}
                </span>
                <span style={{ fontSize: "12px", color: MUTED }}>{currency}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: "11px", color: MUTED }}>
            {ar ? "الآيبان — حماية الأجور (مدد)" : "IBAN — wage protection (Mudad)"}
          </div>
          <div dir="ltr" style={{ marginTop: "6px", fontSize: "13px", color: iban ? NAVY : MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
            {iban || "—"}
          </div>
          <LaborArticleCite ruleId="payroll.wage.payment.cite" ar={ar} showText />
          <LaborArticleCite ruleId="payroll.wps.deadlineDayOfMonth" ar={ar} showText />
        </div>
      </IdentityCard>
      </div>

      <div style={{ flex: "1 1 260px", maxWidth: "340px" }}>
      <IdentityCard
        icon={Stamp}
        kicker={ar ? "أمر إثبات" : "Proof command"}
        title={ar ? "شهادة تعريف بالراتب" : "Salary certificate"}
        subtitle={ar
          ? "تُصدر بختم رقمي وتُسجَّل في سجل التدقيق — ليست مادة مستقلة."
          : "Issued with a digital seal and recorded in the audit trail — not a standalone article."}
      >
        {profile.salaryCertificateUrl && (
          <a
            href={profile.salaryCertificateUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", marginTop: "12px", fontSize: "13px", color: NAVY }}
          >
            {profile.salaryCertificateName || (ar ? "شهادة تعريف بالراتب" : "Salary certificate")}
          </a>
        )}
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => uploadCertificate(e.target.files?.[0])} />
        <button
          type="button"
          disabled={!canEdit || uploading}
          onClick={() => fileRef.current?.click()}
          style={{
            ...ui.btnBlock,
            opacity: !canEdit || uploading ? 0.5 : 1,
            cursor: !canEdit || uploading ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {uploading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : null}
          {ar ? "أصدر الشهادة" : "Issue certificate"}
        </button>
      </IdentityCard>
      </div>
    </div>
  );
}
