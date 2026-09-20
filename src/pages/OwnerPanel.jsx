import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { listCompanies, createCompany, deleteCompany, getCompanyData, setSession } from "@/lib/store";
import { logAudit } from "@/lib/auditLog";
import { Building2, Plus, Trash2, ShieldAlert, LogOut, LogIn, RefreshCw } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import IdentityCard from "@/components/shared/IdentityCard";
import { SURFACE, ui } from "@/lib/platformStyles";
import NewsBroadcast from "@/components/owner/NewsBroadcast";
import SubscribersDashboard from "@/components/owner/SubscribersDashboard";
import SaasAnalyticsDashboard from "@/components/owner/SaasAnalyticsDashboard";
import PlatformRoadmap from "@/components/owner/PlatformRoadmap";
import ProductFeedbackDashboard from "@/components/owner/ProductFeedbackDashboard";
import PlatformReportDashboard from "@/components/owner/PlatformReportDashboard";
import AuditLogDashboard from "@/components/owner/AuditLogDashboard";
import PlanManagement from "@/components/owner/PlanManagement";
import SubscriptionInvoicesDashboard from "@/components/owner/SubscriptionInvoicesDashboard";

export default function OwnerPanel() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined); // undefined = loading
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ name: "", ownerEmail: "", ownerPassword: "", plan: "Starter", allowedEmailDomain: "" });
  const [tab, setTab] = useState("analytics");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
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
        plan: account.plan,
      }));
      setCompanies([...merged.values()]);
    } catch {
      setCompanies(localCompanies);
    }
    setRefreshKey((value) => value + 1);
    if (showLoading) setRefreshing(false);
  };
  useEffect(() => {
    if (user?.role !== "admin") return;
    refresh();
    const interval = window.setInterval(() => refresh(), 30000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [user]);

  if (user === undefined) return null;

  if (!user || user.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: SURFACE, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} dir={lang === "ar" ? "rtl" : "ltr"}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <IdentityCard icon={ShieldAlert} rail="#DC2626" title={lang === "ar" ? "الوصول مرفوض" : "Access denied"} subtitle={lang === "ar" ? "هذه الصفحة مخصصة لمالك المنصة فقط." : "This page is reserved for the platform owner."}>
            <button type="button" onClick={() => navigate("/")} style={ui.btnBlock}>{t("back")}</button>
          </IdentityCard>
        </div>
      </div>
    );
  }

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.name || !form.ownerEmail || !form.ownerPassword) return;
    const company = createCompany(form);
    logAudit(company.id, "company_created", user.email, `${user.email} created company "${company.name}" (${company.plan}).`);
    setForm({ name: "", ownerEmail: "", ownerPassword: "", plan: "Starter", allowedEmailDomain: "" });
    refresh();
  };

  const handleDelete = (id) => {
    const c = companies.find((x) => x.id === id);
    deleteCompany(id);
    logAudit(id, "company_deleted", user.email, `${user.email} deleted company "${c?.name || id}".`);
    refresh();
  };

  const handleEnter = (id) => {
    const data = getCompanyData(id);
    if (!data) return;
    const userId = data.ownerId
      || data.employees.find((e) => e.id === data.ownerId)?.id
      || data.employees.find((e) => e.role === "director")?.id
      || data.employees[0]?.id
      || null;
    setSession({ companyId: id, userId });
    navigate("/app");
  };

  const ar = lang === "ar";
  const ownerSections = [
    { value: "analytics", label: ar ? "التحليلات" : "Analytics" },
    { value: "subscriptions", label: ar ? "الاشتراكات" : "Subscriptions" },
    { value: "invoices", label: ar ? "الفواتير" : "Invoices" },
    { value: "plans", label: ar ? "الباقات" : "Plans" },
    { value: "report", label: ar ? "تقرير المنصة" : "Platform report" },
    { value: "companies", label: ar ? "الشركات" : "Companies" },
    { value: "feedback", label: ar ? "التقييمات" : "Feedback" },
    { value: "audit", label: ar ? "التدقيق" : "Audit" },
    { value: "roadmap", label: ar ? "الخارطة" : "Roadmap" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, padding: "24px 16px 40px" }} dir={ar ? "rtl" : "ltr"}>
      <PlatformStampShell
        ar={ar}
        title={ar ? "لوحة المالك" : "Owner panel"}
        hint={ar ? "تشغيل المنصة والاشتراكات والشركات من سطح واحد." : "Run the platform, subscriptions and companies from one surface."}
        sections={ownerSections}
        tool={tab}
        onTool={setTab}
        meta={(
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={() => refresh(true)} disabled={refreshing} style={ui.btnGhost}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {ar ? "تحديث" : "Refresh"}
            </button>
            <button type="button" onClick={() => base44.auth.logout("/")} style={ui.btnSecondary}>
              <LogOut className="h-3.5 w-3.5" />
              {t("logout")}
            </button>
          </div>
        )}
      >
        {tab === "analytics" && <SaasAnalyticsDashboard key={`analytics-${refreshKey}`} lang={lang} />}
        {tab === "subscriptions" && <SubscribersDashboard key={`subscriptions-${refreshKey}`} ar={lang === "ar"} />}
        {tab === "invoices" && <SubscriptionInvoicesDashboard key={`invoices-${refreshKey}`} ar={lang === "ar"} />}
        {tab === "plans" && <PlanManagement ar={lang === "ar"} />}
        {tab === "report" && <PlatformReportDashboard key={`report-${refreshKey}`} ar={lang === "ar"} />}
        {tab === "roadmap" && <PlatformRoadmap ar={lang === "ar"} />}
        {tab === "feedback" && <ProductFeedbackDashboard key={`feedback-${refreshKey}`} ar={lang === "ar"} companies={companies} />}
        {tab === "audit" && <AuditLogDashboard key={`audit-${refreshKey}`} ar={lang === "ar"} companies={companies} />}

        {tab === "companies" && (<>
        <IdentityCard icon={Building2} title={`${t("companies")} (${companies.length})`}>
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-[#14284B]">
                <Building2 className="w-4 h-4" /> {t("companies")} ({companies.length})
              </h3>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {companies.length === 0 && <p className="text-sm text-[#5A6B85] font-body">No companies yet.</p>}
              {companies.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-[#F7F8FA] border border-[#E2E8F0]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-[#14284B]">{c.name}</p>
                    <p className="text-xs text-[#5A6B85] truncate">{c.ownerEmail} · {c.plan}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleEnter(c.id)} title={lang === "ar" ? "دخول" : "Enter"} className="p-2 text-[#1E9E63] hover:bg-white rounded-md">
                      <LogIn className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                    <ConfirmDeleteDialog
                      onConfirm={() => handleDelete(c.id)}
                      trigger={
                        <button className="p-2 text-red-500 hover:bg-white rounded-md">
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-3 pt-4 border-t border-[#E2E8F0]">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-[#14284B]">
              <Plus className="w-4 h-4" /> {t("createCompany")}
            </h3>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("companyName")} required
              className="w-full px-3 py-2 rounded-[9px] border border-[#E2E8F0] bg-white text-[#14284B] text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#14284B]" />
            <input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder={t("email")} required
              className="w-full px-3 py-2 rounded-[9px] border border-[#E2E8F0] bg-white text-[#14284B] text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#14284B]" />
            <input value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} placeholder={t("password")} required
              className="w-full px-3 py-2 rounded-[9px] border border-[#E2E8F0] bg-white text-[#14284B] text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#14284B]" />
            <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
              className="w-full px-3 py-2 rounded-[9px] border border-[#E2E8F0] bg-white text-[#14284B] text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#14284B]">
              <option>Starter</option>
              <option>Professional</option>
              <option>Enterprise</option>
            </select>
            <input value={form.allowedEmailDomain} onChange={(e) => setForm({ ...form, allowedEmailDomain: e.target.value })} placeholder={t("allowedEmailDomain") + " (e.g. @acwa.com)"}
              className="w-full px-3 py-2 rounded-[9px] border border-[#E2E8F0] bg-white text-[#14284B] text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#14284B]" />
            <button type="submit" className="w-full py-2.5 rounded-[9px] bg-[#1E9E63] text-white text-sm font-semibold">
              {t("createCompany")}
            </button>
          </form>
        </div>
        </IdentityCard>

        <NewsBroadcast />


        </>)}
      </PlatformStampShell>
    </div>
  );
}