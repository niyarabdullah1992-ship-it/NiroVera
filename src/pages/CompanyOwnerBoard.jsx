import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, LogIn, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { listCompanyAccounts } from "@/api/platformEntities";
import { useI18n } from "@/lib/i18n";
import {
  createCompany,
  deleteCompany,
  getCompanyData,
  getSession,
  listCompanies,
  setSession,
} from "@/lib/store";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { ownerBoardSections, platformOwnerGate, resolveOwnerBoardActor } from "@/lib/ownerBoard";
import { DEFAULT_SUBSCRIPTION_PLANS, planDisplayName } from "@/lib/subscriptionPlans";
import { logAudit } from "@/lib/auditLog";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import OwnerBoardFrame from "@/components/owner/OwnerBoardFrame";
import IdentityCard from "@/components/shared/IdentityCard";
import { MUTED, SURFACE, ui } from "@/lib/platformStyles";
import {
  OwnerCard,
  ownerField,
  ownerGhostBtn,
  ownerPrimaryBtn,
  ownerStatusChip,
} from "@/components/owner/ownerUi";
import { planLabel } from "@/components/owner/SubscriberAnalytics";
import NewsBroadcast from "@/components/owner/NewsBroadcast";
import SubscribersDashboard from "@/components/owner/SubscribersDashboard";
import SaasAnalyticsDashboard from "@/components/owner/SaasAnalyticsDashboard";
import PlatformRoadmap from "@/components/owner/PlatformRoadmap";
import ProductFeedbackDashboard from "@/components/owner/ProductFeedbackDashboard";
import PlatformReportDashboard from "@/components/owner/PlatformReportDashboard";
import AuditLogDashboard from "@/components/owner/AuditLogDashboard";
import PlanManagement from "@/components/owner/PlanManagement";
import SubscriptionInvoicesDashboard from "@/components/owner/SubscriptionInvoicesDashboard";
import OwnerCompanyRulings from "@/components/owner/OwnerCompanyRulings";

const EMPTY_FORM = {
  name: "",
  ownerEmail: "",
  ownerPassword: "",
  plan: "Professional",
  allowedEmailDomain: "",
};

export default function CompanyOwnerBoard() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tab, setTab] = useState("glance");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const finish = (raw) => {
      if (cancelled) return;
      const session = getSession();
      setUser(resolveOwnerBoardActor(raw, {
        localPreview: isLocalPreviewActive(),
        sessionUserId: session?.userId || "",
        sessionEmail: session?.email || "",
      }));
    };
    base44.auth.me().then(finish).catch(() => finish(null));
    return () => { cancelled = true; };
  }, []);

  const refresh = async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    const localCompanies = listCompanies();
    try {
      const accounts = await listCompanyAccounts();
      const merged = new Map(localCompanies.map((company) => [company.id, company]));
      accounts.forEach((account) => merged.set(account.companyId, {
        ...merged.get(account.companyId),
        id: account.companyId,
        name: account.name || merged.get(account.companyId)?.name || account.companyId,
        ownerEmail: account.ownerEmail,
        plan: account.plan || merged.get(account.companyId)?.plan,
        subscriptionStart: account.subscriptionStart ?? merged.get(account.companyId)?.subscriptionStart,
        subscriptionEnd: account.subscriptionEnd ?? merged.get(account.companyId)?.subscriptionEnd,
        subscriptionExempt: account.subscriptionExempt === true || merged.get(account.companyId)?.subscriptionExempt === true,
        frozen: account.frozen === true,
      }));
      setCompanies([...merged.values()]);
    } catch {
      setCompanies(localCompanies);
    }
    setRefreshKey((value) => value + 1);
    // stamp لا يُبصم هنا. هذا التحديث يعمل تلقائياً كل 30 ثانية وعند كل عودة إلى النافذة،
    // و OwnerCompanyRulings يعيد بذر نموذجي الإجازات ورمضان على كل تغيّر في stamp — فكان
    // ما يكتبه المالك يُمسح كل نصف دقيقة قبل أن يحفظه. تبقى البصمة لما بعد الحفظ (onStamp)
    // وهو موضعها الصحيح؛ ونموذج الاشتراك يعيد بذر نفسه من companies بلا حاجة إليها.
    if (showLoading) setRefreshing(false);
  };

  useEffect(() => {
    if (!platformOwnerGate(user).ok) return;
    refresh();
    const interval = window.setInterval(() => refresh(), 30000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  if (user === undefined) return null;

  const access = platformOwnerGate(user);
  if (!access.ok) {
    return (
      <div style={{ minHeight: "100vh", background: SURFACE, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} dir={ar ? "rtl" : "ltr"}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <IdentityCard
            icon={ShieldAlert}
            tone="bad"
            ar={ar}
            flag={ar ? "لا صلاحية" : "No access"}
            title={ar ? "لوحة المالك" : "Owner board"}
            subtitle={ar ? access.reason : access.reasonEn}
          >
            <button type="button" onClick={() => navigate("/")} style={ui.btnBlock}>{ar ? "عودة" : "Back"}</button>
          </IdentityCard>
        </div>
      </div>
    );
  }

  const handleCreate = (event) => {
    event.preventDefault();
    if (!form.name || !form.ownerEmail || !form.ownerPassword) return;
    const company = createCompany(form);
    logAudit(company.id, "company_created", user.email, `${user.email} created company "${company.name}" (${company.plan}).`);
    setForm(EMPTY_FORM);
    refresh();
  };

  const handleDelete = (id) => {
    const company = companies.find((row) => row.id === id);
    deleteCompany(id);
    logAudit(id, "company_deleted", user.email, `${user.email} deleted company "${company?.name || id}".`);
    refresh();
  };

  const handleEnter = (id) => {
    const data = getCompanyData(id);
    if (!data) return;
    const userId = data.ownerId
      || data.employees.find((row) => row.id === data.ownerId)?.id
      || data.employees.find((row) => row.role === "director")?.id
      || data.employees[0]?.id
      || null;
    setSession({ companyId: id, userId });
    navigate("/app");
  };

  const sections = ownerBoardSections(ar);

  return (
    <OwnerBoardFrame
        ar={ar}
        user={user}
        sections={sections}
        tab={tab}
        onTab={setTab}
        companies={companies}
        refreshing={refreshing}
        refreshKey={refreshKey}
        onRefresh={() => refresh(true)}
        onLogout={() => base44.auth.logout("/")}
        onOpenApp={() => navigate("/app")}
      >
        {tab === "glance" ? <SaasAnalyticsDashboard key={`glance-${refreshKey}`} lang={lang} onTab={setTab} /> : null}

        {tab === "companies" ? (
          <div data-owner-split="" style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 1fr)", alignItems: "start" }}>
            <OwnerCard
              padding={0}
              style={{ gap: 0 }}
            >
              <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 18px" }}>
                <h3 className="nv-h" style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={16} style={{ color: "var(--nv-accent)" }} />
                  {ar ? "الشركات المسجلة" : "Registered companies"}
                  <span style={{ ...ownerStatusChip("mute"), marginInlineStart: 4 }}>{companies.length}</span>
                </h3>
              </header>
              {companies.length === 0 ? (
                <p style={{ margin: 0, padding: "8px 18px 22px", fontSize: 13, color: MUTED }}>{ar ? "لا شركات بعد. أنشئ أول شركة من النموذج." : "No companies yet. Create the first one."}</p>
              ) : null}
              {companies.map((company) => {
                const tone = company.frozen ? "bad" : company.subscriptionExempt ? "mute" : "ok";
                const text = company.frozen ? (ar ? "مجمّدة" : "Frozen") : company.subscriptionExempt ? (ar ? "معفاة" : "Exempt") : (ar ? "نشطة" : "Active");
                return (
                  <div key={company.id} data-owner="company-row" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: 14, padding: "14px 18px", borderTop: "1px solid var(--nv-line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--nv-accent-soft)", color: "var(--nv-accent-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                        {String(company.name || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {company.ownerEmail || "—"} · {ar ? "باقة" : "Plan"} {planLabel(company.plan, ar)}
                        </p>
                      </div>
                    </div>
                    <span style={ownerStatusChip(tone)}>{text}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <button type="button" onClick={() => handleEnter(company.id)} style={ownerGhostBtn()}>
                        <LogIn className="h-4 w-4" strokeWidth={1.75} /> {ar ? "دخول" : "Enter"}
                      </button>
                      <ConfirmDeleteDialog
                        onConfirm={() => handleDelete(company.id)}
                        trigger={(
                          <button type="button" title={ar ? "حذف" : "Delete"} style={{ ...ownerGhostBtn(), color: "var(--nv-bad-ink, #DC2626)", padding: "8px 10px" }}>
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        )}
                      />
                    </div>
                  </div>
                );
              })}
              <p style={{ margin: 0, padding: "12px 18px", fontSize: 11.5, color: MUTED, borderTop: "1px solid var(--nv-line)", background: "var(--nv-soft)", borderRadius: "0 0 12px 12px" }}>
                {ar ? "«دخول» يفتح منصة الشركة بجلسة مالكها. الحذف نهائي ولا يمكن التراجع عنه." : "Enter opens the company app as its owner. Delete is permanent."}
              </p>
            </OwnerCard>

            <OwnerCard title={t("createCompany")} icon={Plus} style={{ position: "sticky", top: 108 }}>
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  ["name", t("companyName"), "text", true, ar ? "مثال: شركة الأفق" : "e.g. Horizon Co."],
                  ["ownerEmail", ar ? "بريد مالك الشركة" : "Owner email", "email", true, "owner@company.com"],
                  ["ownerPassword", t("password"), "password", true, ""],
                ].map(([key, label, type, required, placeholder]) => (
                  <label key={key} style={fieldLabel}>
                    <span>{label}</span>
                    <input style={ownerField()} type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} required={required} />
                  </label>
                ))}
                <label style={fieldLabel}>
                  <span>{ar ? "الباقة" : "Plan"}</span>
                  <select style={ownerField()} value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}>
                    {DEFAULT_SUBSCRIPTION_PLANS.filter((plan) => plan.slug !== "free").map((plan) => (
                      <option key={plan.slug} value={plan.nameEn}>{planDisplayName(plan, ar ? "ar" : "en")} — {plan.monthlyPrice} {plan.currency}</option>
                    ))}
                  </select>
                </label>
                <label style={fieldLabel}>
                  <span>{t("allowedEmailDomain")} <em style={{ fontStyle: "normal", color: MUTED, fontWeight: 400 }}>({ar ? "اختياري" : "optional"})</em></span>
                  <input style={ownerField()} value={form.allowedEmailDomain} onChange={(event) => setForm({ ...form, allowedEmailDomain: event.target.value })} placeholder="@company.com" />
                </label>
                <button type="submit" style={{ ...ownerPrimaryBtn(), height: 42, marginTop: 4 }}>
                  <Plus className="h-4 w-4" /> {t("createCompany")}
                </button>
              </form>
            </OwnerCard>
          </div>
        ) : null}

        {tab === "rulings" ? (
          <OwnerCompanyRulings
            ar={ar}
            actor={user}
            companies={companies}
            focus="subscriptions"
            stamp={stamp}
            onStamp={() => setStamp((value) => value + 1)}
          />
        ) : null}

        {tab === "holidays" ? (
          <OwnerCompanyRulings
            ar={ar}
            actor={user}
            companies={companies}
            focus="holidays"
            stamp={stamp}
            onStamp={() => setStamp((value) => value + 1)}
          />
        ) : null}

        {tab === "ramadan" ? (
          <OwnerCompanyRulings
            ar={ar}
            actor={user}
            companies={companies}
            focus="ramadan"
            stamp={stamp}
            onStamp={() => setStamp((value) => value + 1)}
          />
        ) : null}

        {tab === "subscribers" ? <SubscribersDashboard key={`subscribers-${refreshKey}`} ar={ar} /> : null}
        {tab === "invoices" ? <SubscriptionInvoicesDashboard key={`invoices-${refreshKey}`} ar={ar} /> : null}
        {tab === "plans" ? <PlanManagement ar={ar} /> : null}
        {tab === "report" ? <PlatformReportDashboard key={`report-${refreshKey}`} ar={ar} /> : null}
        {tab === "feedback" ? <ProductFeedbackDashboard key={`feedback-${refreshKey}`} ar={ar} companies={companies} /> : null}
        {tab === "audit" ? <AuditLogDashboard key={`audit-${refreshKey}`} ar={ar} companies={companies} /> : null}
        {tab === "roadmap" ? <PlatformRoadmap ar={ar} /> : null}
        {tab === "news" ? <NewsBroadcast key={`news-${refreshKey}`} /> : null}
    </OwnerBoardFrame>
  );
}

const fieldLabel = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--nv-ink2)",
};
