import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { setEmployeePassword, changeOwnerPassword } from "@/lib/store";
import { KeyRound } from "lucide-react";
import { ACCENT, BORDER, MUTED, NAVY, field, labelMuted, ui, CARD } from "@/lib/platformStyles";

/** Own-file account settings: password change only. Company purge is not offered. */
export default function AccountSettingsCard({ employee, company }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const isOwner = !!company.ownerEmail && (employee.email || "").toLowerCase() === company.ownerEmail.toLowerCase();
  const canChangePassword = isOwner || !!employee.email;

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ fontSize: "14px", fontWeight: 600, color: NAVY }}>{ar ? "كلمة المرور" : "Password"}</div>
      <p style={{ margin: 0, fontSize: "11px", color: MUTED, lineHeight: 1.65 }}>
        {ar
          ? "إعدادات الحساب لتغيير كلمة المرور فقط. بيانات الشركة والموظفين تبقى محفوظة وسرية — لا يُحذف حساب الشركة من هنا."
          : "Account settings change the password only. Company and employee data stay stored and confidential — the company account cannot be deleted here."}
      </p>
      {canChangePassword ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "8px" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ ...labelMuted, display: "flex", alignItems: "center", gap: "4px" }}>
              <KeyRound style={{ width: 12, height: 12 }} /> {t("newEmployeePassword")}
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={field} autoComplete="new-password" />
          </div>
          <button type="button" onClick={savePassword} disabled={saving || !password} style={{ ...ui.btnPrimary, opacity: saving || !password ? 0.5 : 1 }}>{t("save")}</button>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: "11px", color: MUTED }}>{t("emailRequiredForLogin")}</p>
      )}
      {msg && <p style={{ margin: 0, fontSize: "11px", color: ACCENT }}>{msg}</p>}
    </div>
  );
}
