import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { activateCompanySession, createCompany, deleteCompany, syncCompanyAccount, getCompanyToken, updateCompanyPlan } from "@/lib/store";
import { useAuth as usePowerCareAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { Check, Loader2 } from "lucide-react";
import MarketingChrome from "@/components/landing/MarketingChrome";
import SignupDialog from "@/components/pricing/SignupDialog";
import { DEFAULT_SUBSCRIPTION_PLANS, normalizePlanConfig, planDisplayName, planFeatures } from "@/lib/subscriptionPlans";
import { appsEnabledForPlan } from "@/lib/suiteApps";

export default function Pricing() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { session, company } = usePowerCareAuth();
  const ownerUpgrade = session?.role === "owner" && !!company;
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState("monthly");
  const [googleEmail, setGoogleEmail] = useState("");
  const pendingCompanyRef = useRef(null);
  const [plans, setPlans] = useState(DEFAULT_SUBSCRIPTION_PLANS);

  useEffect(() => {
    base44.entities.SubscriptionPlan.list("sortOrder", 50).then((items) => {
      const active = items.filter((plan) => plan.active);
      if (active.length) setPlans(active);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.has("apple_signup") ? "Apple" : params.has("microsoft_signup") ? "Microsoft" : params.has("google_signup") ? "Google" : null;
    if (!provider) return;
    const saved = JSON.parse(sessionStorage.getItem("powercare_social_signup") || "null");
    sessionStorage.removeItem("powercare_social_signup");
    if (!saved) return;
    setBilling(saved.billing || "monthly");
    setActivePlan(plans.find((plan) => plan.slug === saved.planId) || null);
    base44.auth.me().then((user) => setGoogleEmail(user.email || "")).catch(() => setError(lang === "ar" ? `تعذر التسجيل باستخدام ${provider}.` : `${provider} sign-up could not be completed.`));
  }, []);

  const saveSocialSignup = () => {
    const orgType = "company";
    sessionStorage.setItem("powercare_social_signup", JSON.stringify({ planId: activePlan.slug, billing, orgType }));
  };
  const handleGoogleSignup = () => {
    saveSocialSignup();
    base44.auth.loginWithProvider("sso", "/pricing?google_signup=1");
  };
  const handleMicrosoftSignup = () => {
    saveSocialSignup();
    base44.auth.loginWithProvider("microsoft", "/pricing?microsoft_signup=1");
  };
  const handleAppleSignup = () => {
    saveSocialSignup();
    base44.auth.loginWithProvider("apple", "/pricing?apple_signup=1");
  };

  const handleTrialSignup = async ({ companyName, ownerEmail, ownerPassword, authMethod, pendingId, otpCode }) => {
    setError("");
    const orgType = "company";
    if (!pendingId) {
      try {
        const response = await base44.functions.invoke("companyDirectory", { action: "startSignupOtp", email: ownerEmail, plan: activePlan.slug, orgType });
        return response.data;
      } catch (error) {
        setError(error?.response?.data?.error === "email_exists" ? (lang === "ar" ? "هذا البريد مسجل مسبقًا في نفس نوع الجهة." : "This email is already registered for this organization type.") : (lang === "ar" ? "تعذر إرسال رمز التحقق." : "Could not send the verification code."));
        return false;
      }
    }
    const activationDate = new Date().toISOString().slice(0, 10);
    const company = pendingCompanyRef.current || createCompany(
      { name: companyName, ownerEmail, ownerPassword: authMethod === "google" ? crypto.randomUUID() + crypto.randomUUID() : ownerPassword, plan: activePlan.nameEn, subscriptionStart: activationDate, subscriptionEnd: null, orgType },
      { sync: false }
    );
    pendingCompanyRef.current = company;
    const saved = await syncCompanyAccount(company, { pendingId, code: otpCode });
    if (saved !== true) {
      pendingCompanyRef.current = null;
      deleteCompany(company.id);
      setError(saved === "email_exists"
        ? (lang === "ar" ? "لديك حساب من نفس النوع مسجّل بهذا البريد — يرجى تسجيل الدخول بدلًا من إنشاء حساب جديد." : "This email already has an account of this type — please sign in instead of creating a new one.")
        : ["invalid_code", "invalid_or_expired", "signup_otp_required"].includes(saved)
          ? (lang === "ar" ? "رمز التحقق غير صحيح أو منتهي الصلاحية." : "The verification code is invalid or expired.")
          : (lang === "ar" ? "تعذر حفظ حساب الشركة. يرجى المحاولة مرة أخرى." : "The company account could not be saved. Please try again."));
      return false;
    }
    pendingCompanyRef.current = null;
    activateCompanySession(company);
    base44.functions.invoke("subscriberEmails", { action: "welcome", companyId: company.id, sessionToken: getCompanyToken(company.id) }).catch(() => {});
    // Clear welcome flag so Dashboard shows the suite first-run modal.
    try { localStorage.removeItem(`nirovera_suite_welcome_${company.id}`); } catch { /* ignore */ }
    navigate("/app?suiteWelcome=1");
    return true;
  };

  const handleOwnerUpgrade = async (plan) => {
    if (!ownerUpgrade) return;
    setActivePlan(plan);
    setLoading(true);
    setError("");
    try {
      const planName = plan.nameEn;
      if (plan.freeNow || (billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice) === 0) {
        await updateCompanyPlan(company.id, planName, new Date().toISOString().slice(0, 10), null);
        navigate("/app");
      } else {
        if (window.self !== window.top) throw new Error(lang === "ar" ? "الدفع متاح من الموقع المنشور فقط." : "Payment is available from the published site only.");
        const res = await base44.functions.invoke("tapPayments", { action: "createCharge", plan: plan.slug, billing, companyId: company.id, sessionToken: getCompanyToken(company.id), returnUrl: window.location.origin });
        if (!res.data?.url) throw new Error(res.data?.error || "Tap checkout failed");
        window.location.href = res.data.url;
      }
    } catch (error) {
      setError(error?.message || (lang === "ar" ? "تعذرت ترقية الحساب. حاول مرة أخرى." : "Account upgrade failed. Please try again."));
    } finally { setLoading(false); }
  };

  const handlePaidSignup = async ({ companyName, ownerEmail, authMethod }) => {
    if (window.self !== window.top) {
      setError(t("checkoutIframeError"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("tapPayments", {
        action: "createCharge",
        plan: activePlan.slug,
        billing,
        companyName,
        ownerEmail,
        authMethod,
        returnUrl: window.location.origin,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setError(res.data?.error || t("checkoutGenericError"));
      }
    } catch (e) {
      setError(e?.response?.data?.error === "email_exists"
        ? (lang === "ar" ? "لديك حساب شركة مسجّل بهذا البريد — يرجى تسجيل الدخول بدلًا من إنشاء حساب جديد." : "This email already has a company account — please sign in instead of creating a new one.")
        : t("checkoutGenericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingChrome ar={lang === "ar"} lang={lang} loggedIn={!!session} onToggleLang={() => setLang(lang === "ar" ? "en" : "ar")} ctaHref="/login">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--nv-accent-deep)]">
            {lang === "ar" ? "NiroVera" : "NiroVera"}
          </p>
          <h1 className="mb-3 text-center text-4xl font-semibold text-[var(--nv-ink)] md:text-5xl">{t("pricingHeading")}</h1>
          <p className="mb-4 text-center text-[var(--nv-muted)]">{lang === "ar"
            ? "سجّل شركتك وافتح الحزمة كاملة — حضور ومهام وإثبات ورواتب وامتثال وزارة."
            : "Register your company and open the full suite — attendance, tasks, proof, payroll, and ministry compliance."}</p>
        </div>
        <p className="mx-auto mb-10 w-fit rounded-full border border-[var(--nv-line)] bg-[var(--nv-card)] px-4 py-1.5 text-sm font-semibold text-[var(--nv-ink)]">
          {lang === "ar" ? "تسجيل شركة / مؤسسة" : "Company signup"}
        </p>

        {error && <p className="text-center text-sm text-red-500 font-body mb-6">{error}</p>}

        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex rounded-full border border-[var(--nv-line)] bg-[var(--nv-card)] p-1 text-sm text-[var(--nv-ink)]"><button onClick={() => setBilling("monthly")} className={`rounded-full px-4 py-2 ${billing === "monthly" ? "bg-[var(--nv-accent)] text-white" : ""}`}>{lang === "ar" ? "شهري" : "Monthly"}</button><button onClick={() => setBilling("yearly")} className={`rounded-full px-4 py-2 ${billing === "yearly" ? "bg-[var(--nv-accent)] text-white" : ""}`}>{lang === "ar" ? "سنوي" : "Yearly"}</button></div>
          <div className="w-fit rounded-full border border-[var(--nv-accent-border)] bg-[var(--nv-accent-soft)] px-5 py-2 text-sm font-semibold text-[var(--nv-accent-deep)]">{plans.every((plan) => plan.freeNow || (billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice) === 0) ? (lang === "ar" ? "عرض ترويجي: جميع الباقات مجانية حاليًا" : "Promotion: all plans are currently free") : (lang === "ar" ? "دفع آمن عبر Tap Payments" : "Secure payment via Tap Payments")}</div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div key={plan.id || plan.slug} className="flex flex-col rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-card)] p-6 text-[var(--nv-ink)] shadow-[0_8px_24px_rgba(20,40,75,.06)]">
              <div className="mb-4 h-[3px] rounded-full bg-[var(--nv-navy)]" />
              <h3 className="mb-1 text-xl font-semibold text-[var(--nv-ink)]">{planDisplayName(plan, lang)}</h3>
              <p className="text-3xl font-semibold text-[var(--nv-ink)]">{billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice} {plan.currency}</p>
              <p className="mb-3 text-xs text-[var(--nv-muted)]">{billing === "yearly" ? (lang === "ar" ? "سنويًا" : "per year") : (lang === "ar" ? "شهريًا" : "per month")}</p>
              {plan.freeNow ? <p className="mb-4 text-xs font-medium text-[var(--nv-accent-deep)]">{lang === "ar" ? "متاحة مجانًا في الوقت الراهن" : "Available free for the time being"}</p> : <p className="mb-4 text-xs text-[var(--nv-muted)]">{lang === "ar" ? "تضاف ضريبة القيمة المضافة 15% عند الدفع" : "15% VAT is added at checkout"}</p>}
              <ul className="space-y-2 mb-4 flex-1">
                {planFeatures(plan, lang).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[var(--nv-muted)]">
                    <Check className="w-4 h-4 text-[var(--nv-accent)] shrink-0 mt-0.5" strokeWidth={2} />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mb-6 text-xs text-[var(--nv-muted)]">
                {lang === "ar"
                  ? `${appsEnabledForPlan(normalizePlanConfig(plan)).length} تطبيقًا مفعّلًا في مساحة الشركة`
                  : `${appsEnabledForPlan(normalizePlanConfig(plan)).length} apps enabled in the company space`}
              </p>
              <button
                onClick={() => ownerUpgrade ? handleOwnerUpgrade(plan) : setActivePlan(plan)}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--nv-accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading && activePlan?.slug === plan.slug ? <Loader2 className="w-4 h-4 animate-spin" /> : ownerUpgrade ? (lang === "ar" ? `ترقية إلى ${plan.nameAr}` : `Upgrade to ${plan.nameEn}`) : (plan.freeNow || (billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice) === 0) ? (lang === "ar" ? "ابدأ مجانًا" : "Start free") : (lang === "ar" ? "اشترك الآن" : "Subscribe now")}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-5 text-xs text-[var(--nv-muted)]"><Link to="/privacy" className="hover:text-[var(--nv-ink)]">{lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}</Link><Link to="/terms" className="hover:text-[var(--nv-ink)]">{lang === "ar" ? "الشروط والأحكام" : "Terms & Conditions"}</Link><Link to="/refund-policy" className="hover:text-[var(--nv-ink)]">{lang === "ar" ? "سياسة الاسترجاع" : "Refund Policy"}</Link></div>
      </div>

      {activePlan && (
        <SignupDialog
          key={`${activePlan.id}-${googleEmail}`}
          plan={activePlan}
          isFree={activePlan.freeNow || (billing === "yearly" ? activePlan.yearlyPrice : activePlan.monthlyPrice) === 0}
          onClose={() => { pendingCompanyRef.current = null; setActivePlan(null); setError(""); }}
          onSubmit={activePlan.freeNow || (billing === "yearly" ? activePlan.yearlyPrice : activePlan.monthlyPrice) === 0 ? handleTrialSignup : handlePaidSignup}
          onGoogle={handleGoogleSignup}
          onMicrosoft={handleMicrosoftSignup}
          onApple={handleAppleSignup}
          googleEmail={googleEmail}
          error={error}
        />
      )}
    </MarketingChrome>
  );
}