import React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import usePowerCareLogin from "@/hooks/usePowerCareLogin";
import GoogleIcon from "@/components/GoogleIcon";
import { AppleIcon, MicrosoftIcon } from "@/components/ProviderIcons";
import OtpStep from "@/components/landing/OtpStep";
import { isBase44BackendConfigured, PREVIEW_ACCOUNTS } from "@/lib/localPreview";
import GoogleAccountPicker from "@/components/landing/GoogleAccountPicker";

/**
 * @param {object} props
 * @param {"company"|"individual"} [props.fixedKind] — locks portal; no cross-type login.
 * @param {string} [props.returnPath]
 * @param {boolean} [props.showTypeSelector] — legacy company/individual toggle (avoid when fixedKind set).
 */
export default function PowerCareLoginPanel({ showTypeSelector = false, fixedKind = null, returnPath = "/login" }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const flow = usePowerCareLogin(returnPath, fixedKind);
  if (flow.googleAccounts.length) return <GoogleAccountPicker accounts={flow.googleAccounts} onSelect={flow.chooseGoogleAccount} onBack={() => flow.setGoogleAccounts([])} loading={flow.loading} lang={lang} />;
  if (flow.pendingId) return <OtpStep email={flow.email} accounts={flow.accounts} onVerify={flow.verify} onResend={flow.resend} onBack={flow.backFromOtp} />;
  const previewMode = !isBase44BackendConfigured() && flow.kind !== "individual";
  return <div className="space-y-2">
    {previewMode ? (
      <div data-preview-accounts="1" style={{ border: "1px solid var(--nv-line, #E4E9E6)", borderRadius: 10, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ padding: "9px 12px", background: "var(--nv-soft, #F5F7F6)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 12.5, color: "var(--nv-ink, #0F1A14)" }}>{ar ? "حسابات المعاينة" : "Preview accounts"}</strong>
          <span style={{ fontSize: 11, color: "var(--nv-muted, #6B7570)" }}>{ar ? "اضغط الحساب للدخول — بلا رمز" : "Tap an account to sign in — no code"}</span>
        </div>
        {PREVIEW_ACCOUNTS.map((acc) => {
          const on = flow.email.trim().toLowerCase() === acc.email;
          return (
            <button
              key={acc.id}
              type="button"
              data-preview-account={acc.id}
              onClick={() => { flow.setEmail(acc.email); flow.enterAs(acc.email); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "none", borderTop: "1px solid var(--nv-line2, #EEF1EF)", background: on ? "rgba(11,61,39,.06)" : "transparent", cursor: "pointer", textAlign: "start", fontFamily: "inherit" }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink, #0F1A14)" }}>{ar ? acc.nameAr : acc.nameEn}</span>
                <span style={{ fontSize: 11, color: "var(--nv-muted, #6B7570)" }}>{ar ? acc.roleAr : acc.roleEn}</span>
              </span>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--nv-muted, #6B7570)" }}>{acc.email}</span>
              <span aria-hidden style={{ fontSize: 12, fontWeight: 700, color: "#0B3D27", flexShrink: 0 }}>{ar ? "دخول ›" : "Enter ›"}</span>
            </button>
          );
        })}
      </div>
    ) : null}
    {showTypeSelector && !fixedKind && (
      <p className="text-center text-xs text-muted-foreground">
        {ar ? "استخدم بوابة الدخول المناسبة لنوع حسابك." : "Use the login portal that matches your account type."}
      </p>
    )}
    <div className="space-y-2">
      <button type="button" onClick={flow.google} disabled={flow.loading} className="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"><GoogleIcon className="h-5 w-5" />Continue with Google</button>
      <button type="button" onClick={flow.microsoft} disabled={flow.loading} className="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"><MicrosoftIcon className="h-5 w-5" />Continue with Microsoft</button>
      <button type="button" onClick={flow.apple} disabled={flow.loading} className="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"><AppleIcon className="h-5 w-5" />Continue with Apple</button>
    </div>
    <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{t("orDivider")}<span className="h-px flex-1 bg-border" /></div>
    <form onSubmit={flow.submit} className="space-y-2">
      <label className="block text-xs text-muted-foreground">{t("email")}<input type="email" required autoComplete="email" value={flow.email} onChange={(e) => flow.setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" /></label>
      <label className="block text-xs text-muted-foreground">{t("password")}<input type="password" required={!previewMode} autoComplete="current-password" value={flow.password} onChange={(e) => flow.setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" /></label>
      {flow.error && <p className="text-sm text-destructive">{flow.error}</p>}
      <button disabled={flow.loading} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">{flow.loading && <Loader2 className="h-4 w-4 animate-spin" />}{flow.loading ? t("pleaseWaitBtn") : t("login")}</button>
    </form>
      <Link to={`/forgot-password?type=${flow.kind}`} className="block text-center text-sm font-semibold text-[var(--nv-ink)] underline underline-offset-4">{t("forgotPasswordLink")}</Link>
  </div>;
}
