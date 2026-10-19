import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { isBase44BackendConfigured, openApp, previewLogin } from "@/lib/localPreview";

function resolveKind(fixedKind, search) {
  if (fixedKind === "individual" || fixedKind === "company") return fixedKind;
  if (fixedKind === "gov") return "company";
  const type = new URLSearchParams(search).get("type");
  if (type === "individual") return "individual";
  return "company";
}

export default function usePowerCareLogin(returnPath = "/login", fixedKind = null) {
  const { login, loginWithGoogle, verifyOtp, session } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [kind, setKind] = useState(() => resolveKind(fixedKind, window.location.search));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [googleAccounts, setGoogleAccounts] = useState([]);
  const [googleOtpAccountKey, setGoogleOtpAccountKey] = useState(null);

  useEffect(() => {
    if (fixedKind) setKind(fixedKind);
  }, [fixedKind]);

  useEffect(() => { if (session) navigate("/app", { replace: true }); }, [session, navigate]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.has("apple_login") ? "Apple" : params.has("microsoft_login") ? "Microsoft" : params.has("google_login") ? "Google" : null;
    if (!provider) return;
    params.delete("google_login");
    params.delete("microsoft_login");
    params.delete("apple_login");
    const cleanSearch = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}${window.location.hash}`);
    setLoading(true);
    const loginKind = resolveKind(fixedKind, window.location.search);
    setKind(loginKind);
    loginWithGoogle(loginKind).then((result) => {
      if (result?.selectionRequired) setGoogleAccounts(result.accounts || []);
      else if (result?.otpRequired) {
        setEmail(result.email || "");
        setPendingId(result.pendingId);
        setAccounts([]);
        setGoogleOtpAccountKey(result.accountKey || null);
      } else if (!result) setError(lang === "ar"
        ? `أنت لا تملك حسابًا مرتبطًا بـ ${provider} في هذه البوابة. استخدم البوابة الصحيحة أو أنشئ حسابًا جديدًا.`
        : `You do not have a NiroVera account linked to ${provider} on this portal. Use the correct portal or create an account.`);
    }).catch((error) => {
      const message = error.message || `${provider} login failed`;
      setError(provider === "Google" ? message : message.replaceAll("Google", provider));
    }).finally(() => setLoading(false));
  }, []);

  const wrongKindMessage = lang === "ar"
    ? (kind === "company"
      ? "هذا الحساب لا ينتمي إلى بوابة الشركات — استخدم بوابة الأفراد."
      : "هذا الحساب لا ينتمي إلى بوابة الأفراد — استخدم بوابة الشركات.")
    : (kind === "company"
      ? "This account does not belong to the company portal — use the individual portal."
      : "This account does not belong to the individual portal — use the company portal.");

  /** Preview build: sign straight in as a preview person — no password, no code. */
  const enterAs = (address) => {
    const local = previewLogin(address);
    if (!local) { setError(lang === "ar" ? "لا حساب معاينة بهذا البريد" : "No preview account with this email"); return false; }
    openApp("/app");
    return true;
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(""); setLoading(true);
    // No backend (the preview build): the preview accounts sign in locally with the preview password.
    if (!isBase44BackendConfigured()) {
      setLoading(false);
      enterAs(email);
      return;
    }
    try {
      const result = await login(email, password, kind);
      if (!result) setError(lang === "ar" ? "البريد أو كلمة المرور غير صحيحة" : "Invalid email or password");
      else if (result.wrongKind) setError(wrongKindMessage);
      else if (result.otpRequired) { setPendingId(result.pendingId); setAccounts(result.accounts || []); }
    } catch (error) {
      setError(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };
  const verify = async (code, companyId) => !!(await verifyOtp(pendingId, code, companyId));
  const resend = async () => {
    try {
      const result = googleOtpAccountKey
        ? await loginWithGoogle(kind, googleOtpAccountKey)
        : await login(email, password, kind);
      if (!result?.otpRequired) return false;
      setPendingId(result.pendingId); setAccounts(result.accounts || []); return true;
    } catch (error) {
      setError(error.message || "Could not resend the code"); return false;
    }
  };
  const google = () => {
    if (!isBase44BackendConfigured()) {
      setError(lang === "ar" ? "الدخول بحسابات Google وMicrosoft وApple يعمل حين يتصل الخادم — ادخل هنا بالبريد وكلمة المرور." : "Google, Microsoft and Apple sign-in work once the server is connected — sign in here with email and password.");
      return;
    }
    base44.auth.loginWithProvider("google", `${returnPath}?google_login=1&type=${kind}`);
  };
  const microsoft = () => {
    if (!isBase44BackendConfigured()) {
      setError(lang === "ar" ? "الدخول بحسابات Google وMicrosoft وApple يعمل حين يتصل الخادم — ادخل هنا بالبريد وكلمة المرور." : "Google, Microsoft and Apple sign-in work once the server is connected — sign in here with email and password.");
      return;
    }
    base44.auth.loginWithProvider("microsoft", `${returnPath}?microsoft_login=1&type=${kind}`);
  };
  const apple = () => {
    if (!isBase44BackendConfigured()) {
      setError(lang === "ar" ? "الدخول بحسابات Google وMicrosoft وApple يعمل حين يتصل الخادم — ادخل هنا بالبريد وكلمة المرور." : "Google, Microsoft and Apple sign-in work once the server is connected — sign in here with email and password.");
      return;
    }
    base44.auth.loginWithProvider("apple", `${returnPath}?apple_login=1&type=${kind}`);
  };
  const chooseGoogleAccount = async (accountKey) => {
    setError(""); setLoading(true);
    const result = await loginWithGoogle(kind, accountKey);
    if (result?.otpRequired) {
      setEmail(result.email || "");
      setPendingId(result.pendingId);
      setAccounts([]);
      setGoogleAccounts([]);
      setGoogleOtpAccountKey(result.accountKey || accountKey);
    } else if (!result) setError(lang === "ar" ? "تعذر فتح هذه المساحة" : "Could not open this workspace");
    setLoading(false);
  };
  const backFromOtp = () => { setPendingId(null); setGoogleOtpAccountKey(null); };
  return { enterAs, kind, setKind, email, setEmail, password, setPassword, error, loading, pendingId, accounts, googleAccounts, setGoogleAccounts, submit, verify, resend, google, microsoft, apple, chooseGoogleAccount, backFromOtp };
}
