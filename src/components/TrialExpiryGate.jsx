import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { LockKeyhole, LogOut } from "lucide-react";
import { ALL_PLANS_CURRENTLY_FREE } from "@/lib/pricingPolicy";
import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";
import IdentityCard from "@/components/shared/IdentityCard";
import PlatformBoot from "@/components/shared/PlatformBoot";
import { SURFACE, ui } from "@/lib/platformStyles";

export default function TrialExpiryGate({ company, children }) {
  const [access, setAccess] = useState(null);
  const [checkedCompanyId, setCheckedCompanyId] = useState(null);
  useEffect(() => {
    if (!company?.id) return;
    if (isLocalPreviewActive() || company.id === LOCAL_PREVIEW_COMPANY_ID || company.subscriptionExempt) {
      setAccess({ exists: true, subscriptionExempt: true });
      setCheckedCompanyId(company.id);
      return;
    }
    let active = true;
    setAccess(null);
    setCheckedCompanyId(null);
    base44.functions.invoke("companyDirectory", { action: "accountExists", companyId: company.id })
      .then((res) => { if (active) { setAccess(res.data); setCheckedCompanyId(company.id); } })
      .catch(() => { if (active) { setAccess({ exists: true }); setCheckedCompanyId(company.id); } });
    return () => { active = false; };
  }, [company?.id, company?.subscriptionExempt]);

  if (company?.id && (access === null || checkedCompanyId !== company.id)) {
    return <PlatformBoot variant="shell" />;
  }

  if (access?.frozen) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: SURFACE, padding: 24 }} dir="rtl">
        <div style={{ width: "100%", maxWidth: 520 }}>
          <IdentityCard
            icon={LockKeyhole}
            title="تم إيقاف الوصول مؤقتًا"
            subtitle={access.frozenReason || "يرجى التواصل مع دعم NiroVera لمزيد من المعلومات."}
          >
            <button
              type="button"
              onClick={() => { localStorage.removeItem("powercare_session"); window.location.href = "/"; }}
              style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: 8, height: 40 }}
            >
              <LogOut style={{ width: 14, height: 14 }} />
              العودة إلى الصفحة الرئيسية
            </button>
          </IdentityCard>
        </div>
      </div>
    );
  }

  if (ALL_PLANS_CURRENTLY_FREE || access?.subscriptionExempt || company?.subscriptionExempt || !company?.subscriptionEnd) return children;
  const rawEnd = String(company.subscriptionEnd);
  const expiresAt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(rawEnd) ? `${rawEnd}T23:59:59.999` : rawEnd).getTime();
  if (Number.isFinite(expiresAt) && Date.now() > expiresAt) return <Navigate to="/pricing?expired=1" replace />;
  return children;
}
