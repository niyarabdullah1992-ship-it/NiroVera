import React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import usePowerCareLogin from "@/hooks/usePowerCareLogin";
import GoogleIcon from "@/components/GoogleIcon";
import { AppleIcon, MicrosoftIcon } from "@/components/ProviderIcons";
import OtpStep from "@/components/landing/OtpStep";
import GoogleAccountPicker from "@/components/landing/GoogleAccountPicker";

const field = {
  height: 42,
  width: "100%",
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #E4E9E6",
  fontSize: 13,
  color: "#111418",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

const ssoBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 38,
  borderRadius: 8,
  border: "1px solid #E4E9E6",
  background: "#fff",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#111418",
  cursor: "pointer",
};

/**
 * Real company login on the public site. No sample accounts and no fixed OTP.
 * Mount only when the visitor is signed out — the login hook sends a session to /app.
 */
export default function SiteLoginCard({ ar }) {
  const flow = usePowerCareLogin("/", "company");
  if (flow.googleAccounts.length) {
    return (
      <GoogleAccountPicker
        accounts={flow.googleAccounts}
        onSelect={flow.chooseGoogleAccount}
        onBack={() => flow.setGoogleAccounts([])}
        loading={flow.loading}
        lang={ar ? "ar" : "en"}
      />
    );
  }
  if (flow.pendingId) {
    return (
      <OtpStep
        email={flow.email}
        accounts={flow.accounts}
        onVerify={flow.verify}
        onResend={flow.resend}
        onBack={flow.backFromOtp}
      />
    );
  }
  return (
    <form onSubmit={flow.submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <strong style={{ display: "block", fontSize: 16 }}>{ar ? "دخول المنصة" : "Platform sign-in"}</strong>
        <span style={{ fontSize: 12, color: "#555C66" }}>{ar ? "بالبريد أو الرقم الوظيفي" : "Email or job number"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
        <button type="button" onClick={flow.google} disabled={flow.loading} style={ssoBtn}><GoogleIcon className="h-4 w-4" />Google</button>
        <button type="button" onClick={flow.microsoft} disabled={flow.loading} style={ssoBtn}><MicrosoftIcon className="h-4 w-4" />Microsoft</button>
        <button type="button" onClick={flow.apple} disabled={flow.loading} style={ssoBtn}><AppleIcon className="h-4 w-4" />Apple</button>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#3A4048" }}>
        {ar ? "البريد أو الرقم الوظيفي" : "Email or job number"}
        <input value={flow.email} onChange={(event) => flow.setEmail(event.target.value)} autoComplete="username" required style={{ ...field, direction: "ltr", textAlign: "left" }} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#3A4048" }}>
        {ar ? "كلمة المرور" : "Password"}
        <input type="password" value={flow.password} onChange={(event) => flow.setPassword(event.target.value)} autoComplete="current-password" required style={{ ...field, direction: "ltr", textAlign: "left" }} />
      </label>
      {flow.error ? (
        <div style={{ fontSize: 12, color: "#9B2335", background: "#FBEBED", border: "1px solid #EDC5CB", borderRadius: 8, padding: "9px 12px" }}>{flow.error}</div>
      ) : null}
      <button type="submit" disabled={flow.loading} style={{ height: 44, border: "none", borderRadius: 8, background: "#3C7D50", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        {flow.loading ? <Loader2 className="h-4 w-4 animate-spin" style={{ verticalAlign: "middle" }} /> : null}
        {ar ? "دخول" : "Sign in"}
      </button>
      <Link to="/forgot-password?type=company" style={{ fontSize: 12, color: "#3A4048", textAlign: "center" }}>
        {ar ? "نسيت كلمة المرور" : "Forgot password"}
      </Link>
    </form>
  );
}
