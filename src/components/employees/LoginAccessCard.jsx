import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { KeyRound } from "lucide-react";
import { setEmployeePassword } from "@/lib/store";
import { ACCENT, BORDER, MUTED, NAVY, field, ui, CARD } from "@/lib/platformStyles";

export default function LoginAccessCard({ employee, companyId }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const save = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setMessage(t("passwordTooShort")); return; }
    setSaving(true);
    setMessage("");
    const ok = await setEmployeePassword(companyId, employee.id, employee.email, password);
    setSaving(false);
    setMessage(ok ? t("employeePasswordSaved") : t("employeePasswordFailed"));
    if (ok) setPassword("");
  };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <KeyRound style={{ width: 16, height: 16, color: ACCENT }} />
        <div style={{ fontSize: "14px", fontWeight: 600, color: NAVY }}>{t("loginAccess")}</div>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: "11px", color: MUTED, lineHeight: 1.6 }}>{t("loginAccessNote")}</p>
      {!employee.email ? (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--nv-bad-ink)" }}>{t("emailRequiredForLogin")}</p>
      ) : (
        <form onSubmit={save} style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("newEmployeePassword")}
            style={{ ...field, flex: "1 1 200px" }}
          />
          <button type="submit" disabled={saving || !password} style={{ ...ui.btnPrimary, opacity: saving || !password ? 0.5 : 1 }}>
            {saving ? "…" : t("save")}
          </button>
        </form>
      )}
      {message && <p style={{ margin: "8px 0 0", fontSize: "11px", color: MUTED }}>{message}</p>}
    </div>
  );
}
