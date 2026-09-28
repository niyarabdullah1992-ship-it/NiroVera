import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { LANGUAGES } from "@/lib/i18n";
import { updateCompany, setEmployeePassword, changeOwnerPassword, purgeCompanyAccount } from "@/lib/store";
import { KeyRound, Pencil, AlertTriangle, Loader2, Building2 } from "lucide-react";
import { ACCENT, BORDER, MUTED, NAVY, DANGER, field, labelMuted, ui, CARD } from "@/lib/platformStyles";

export default function AccountSettingsCard({ employee, company }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { logout, session } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(employee.name);
  const [emailLanguage, setEmailLanguage] = useState(company.emailLanguage || lang);
  const [savingEmailLanguage, setSavingEmailLanguage] = useState(false);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ownerStep, setOwnerStep] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const isOwner = !!company.ownerEmail && (employee.email || "").toLowerCase() === company.ownerEmail.toLowerCase();

  const saveName = () => {
    const clean = name.trim();
    if (!clean || clean === employee.name) return;
    updateCompany(company.id, (d) => {
      const emp = d.employees.find((e) => e.id === employee.id);
      if (emp) emp.name = clean;
    });
    setMsg(t("nameUpdated"));
  };

  const savePassword = async () => {
    if (password.length < 6) { setMsg(t("passwordTooShort")); return; }
    setSaving(true);
    let ok = false;
    try {
      if (isOwner) ok = await changeOwnerPassword(company.id, password);
      else if (employee.email) ok = await setEmployeePassword(company.id, employee.id, employee.email, password);
    } catch { ok = false; }
    setSaving(false);
    setMsg(ok ? t("passwordUpdated") : t("employeePasswordFailed"));
    if (ok) setPassword("");
  };

  const saveEmailLanguage = async () => {
    setSavingEmailLanguage(true);
    const response = await base44.functions.invoke("companyDirectory", {
      action: "updateEmailLanguage",
      companyId: company.id,
      sessionToken: session?.token,
      emailLanguage,
    }).catch(() => null);
    setSavingEmailLanguage(false);
    setMsg(response?.data?.ok
      ? (ar ? "تم حفظ لغة رسائل البريد." : "Email language saved.")
      : (ar ? "تعذّر حفظ لغة البريد." : "Couldn't save email language."));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ fontSize: "14px", fontWeight: 600, color: NAVY }}>{t("myAccount")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "8px" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label style={{ ...labelMuted, display: "flex", alignItems: "center", gap: "4px" }}>
            <Pencil style={{ width: 12, height: 12 }} /> {t("employeeName")}
          </label>
          <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} style={field} />
        </div>
        <button type="button" onClick={saveName} style={ui.btnPrimary}>{t("save")}</button>
      </div>
      {(isOwner || employee.email) ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "8px" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ ...labelMuted, display: "flex", alignItems: "center", gap: "4px" }}>
              <KeyRound style={{ width: 12, height: 12 }} /> {t("newEmployeePassword")}
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={field} />
          </div>
          <button type="button" onClick={savePassword} disabled={saving || !password} style={{ ...ui.btnPrimary, opacity: saving || !password ? 0.5 : 1 }}>{t("save")}</button>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: "11px", color: MUTED }}>{t("emailRequiredForLogin")}</p>
      )}
      {isOwner && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "8px", borderTop: `1px solid ${BORDER}`, paddingTop: "14px" }}>
          <div style={{ flex: "1 1 220px" }}>
            <label style={labelMuted}>{ar ? "لغة رسائل البريد الإلكتروني" : "Email message language"}</label>
            <select value={emailLanguage} onChange={(event) => setEmailLanguage(event.target.value)} style={field}>
              {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.flag} {language.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={saveEmailLanguage} disabled={savingEmailLanguage} style={{ ...ui.btnPrimary, opacity: savingEmailLanguage ? 0.5 : 1 }}>
            {savingEmailLanguage ? (ar ? "جارٍ الحفظ..." : "Saving...") : t("save")}
          </button>
        </div>
      )}
      {msg && <p style={{ margin: 0, fontSize: "11px", color: ACCENT }}>{msg}</p>}

      {isOwner && (
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: DANGER }}>
            <Building2 style={{ width: 14, height: 14 }} /> {ar ? "حذف حساب الشركة" : "Delete Company Account"}
          </div>
          <p style={{ margin: 0, fontSize: "11px", color: MUTED, lineHeight: 1.6 }}>
            {ar
              ? "هذا الإجراء يحذف الشركة نهائيًا: جميع الفروع والموظفين وكل البيانات المخزّنة ستُمسح ولا يمكن استرجاعها."
              : "This permanently purges the company: all stations, employees and every stored data record will be erased and cannot be recovered."}
          </p>
          {ownerStep === 0 && (
            <button type="button" onClick={() => setOwnerStep(1)} style={ui.btnDanger}>
              {ar ? "حذف حساب الشركة" : "Delete Company Account"}
            </button>
          )}
          {ownerStep === 1 && (
            <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--nv-line)", background: "var(--nv-bad-soft)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: DANGER, display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                {ar
                  ? "تحذير: سيتم مسح الشركة بالكامل — الفروع، الموظفون، المهام، التقارير وكل البيانات."
                  : "Warning: the company will be wiped — stations, employees, tasks, reports and all data."}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setOwnerStep(2)} style={ui.btnDanger}>{ar ? "أفهم — متابعة" : "I understand — continue"}</button>
                <button type="button" onClick={() => setOwnerStep(0)} style={ui.btnGhost}>{t("cancel")}</button>
              </div>
            </div>
          )}
          {ownerStep === 2 && (
            <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--nv-line)", background: "var(--nv-bad-soft)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: DANGER, fontWeight: 600 }}>
                {ar ? "تأكيد نهائي — لا يمكن التراجع." : "Final confirmation — this cannot be undone."}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    const ok = await purgeCompanyAccount(company.id).catch(() => false);
                    setDeleting(false);
                    if (ok) { logout(); navigate("/"); }
                    else {
                      setOwnerStep(0);
                      setMsg(ar ? "تعذّر حذف حساب الشركة — حاول مجددًا." : "Couldn't delete the company account — please try again.");
                    }
                  }}
                  style={{ ...ui.btnDanger, display: "inline-flex", alignItems: "center", gap: "6px", opacity: deleting ? 0.5 : 1 }}
                >
                  {deleting ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : null}
                  {ar ? "احذف الشركة نهائيًا" : "Permanently delete company"}
                </button>
                <button type="button" disabled={deleting} onClick={() => setOwnerStep(0)} style={ui.btnGhost}>{t("cancel")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
