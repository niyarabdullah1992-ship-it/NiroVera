import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
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
  ownerField,
  ownerGhostBtn,
  ownerInset,
  ownerPaper,
  ownerPrimaryBtn,
  OwnerSectionHead,
  ownerStack,
} from "@/components/owner/ownerUi";
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
      const accounts = await base44.entities.CompanyAccount.list("-created_date", 500);
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
    setStamp((value) => value + 1);
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
            rail="var(--nv-danger, #DC2626)"
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
        onRefresh={() => refresh(true)}
        onLogout={() => base44.auth.logout("/")}
        onOpenApp={() => navigate("/app")}
      >
        {tab === "glance" ? <SaasAnalyticsDashboard key={`glance-${refreshKey}`} lang={lang} /> : null}

        {tab === "companies" ? (
          <>
            <div style={{ ...ownerPaper("mute"), padding: 16, ...ownerStack }}>
              <OwnerSectionHead
                title={ar ? `الشركات (${companies.length})` : `Companies (${companies.length})`}
              />
              <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                {ar ? "دخول الشركة يفتح /app بجلسة مالكها. الحذف نهائي من السجل المحلي." : "Entering a company opens /app as its owner session. Delete is permanent from the local registry."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {companies.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا شركات بعد." : "No companies yet."}</p>
                  ) : null}
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      style={{
                        ...ownerInset(),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--nv-ink)" }}>{company.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED }}>{company.ownerEmail} · {company.plan}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <button type="button" onClick={() => handleEnter(company.id)} title={ar ? "دخول" : "Enter"} style={ownerGhostBtn()}>
                          <LogIn className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                        <ConfirmDeleteDialog
                          onConfirm={() => handleDelete(company.id)}
                          trigger={(
                            <button type="button" style={{ ...ownerGhostBtn(), color: "var(--nv-bad-ink, #DC2626)" }}>
                              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                            </button>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, borderTop: "1px solid var(--nv-line)" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--nv-ink)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Plus className="h-4 w-4" /> {t("createCompany")}
                  </p>
                  <input style={ownerField()} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t("companyName")} required />
                  <input style={ownerField()} value={form.ownerEmail} onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })} placeholder={t("email")} required />
                  <input style={ownerField()} type="password" value={form.ownerPassword} onChange={(event) => setForm({ ...form, ownerPassword: event.target.value })} placeholder={t("password")} required />
                  <select style={ownerField()} value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}>
                    {DEFAULT_SUBSCRIPTION_PLANS.filter((plan) => plan.slug !== "free").map((plan) => (
                      <option key={plan.slug} value={plan.nameEn}>{planDisplayName(plan, ar ? "ar" : "en")}</option>
                    ))}
                  </select>
                  <input style={ownerField()} value={form.allowedEmailDomain} onChange={(event) => setForm({ ...form, allowedEmailDomain: event.target.value })} placeholder={`${t("allowedEmailDomain")} (e.g. @acwa.com)`} />
                  <button type="submit" style={ownerPrimaryBtn()}>{t("createCompany")}</button>
                </form>
              </div>
            </div>
          </>
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
