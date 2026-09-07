import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { Inbox, PenLine, ShieldCheck, Users } from "lucide-react";
import MySignatureCard from "@/components/files/MySignatureCard";
import MultiSignCard from "@/components/files/MultiSignCard";
import MultiSignInbox from "@/components/files/MultiSignInbox";
import VerifyDocumentCard from "@/components/files/VerifyDocumentCard";
import HowSigningWorks from "@/components/files/HowSigningWorks";
import SigningProofBand from "@/components/files/SigningProofBand";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import ErpSectionFrame from "@/components/erp/ErpSectionFrame";
import { erpKicker } from "@/lib/erpModuleMeta";
import { canCreateSignatureRequests, visibleEmployees } from "@/lib/permissions";
import { MUTED, NAVY, pageCol } from "@/lib/platformStyles";
import { ensureSignatureFonts } from "@/lib/typedSignatureImage";

export default function FileSigning() {
  const { lang } = useI18n();
  const { company, data, currentUser } = useAuth();
  const ar = lang === "ar";
  const [searchParams, setSearchParams] = useSearchParams();
  const [multiRefresh, setMultiRefresh] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => { ensureSignatureFonts(); }, []);

  const canCreate = currentUser && data ? canCreateSignatureRequests(currentUser, data) : false;
  const sections = useMemo(() => [
    {
      value: "individual",
      label: ar ? "توقيع فردي" : "Individual",
      hint: ar
        ? "ارفع المستند، ضع ختمك على الصفحة، ثم وقّعه باسمك وبصفتك."
        : "Upload the document, place your seal on the page, then sign in your name and capacity.",
      icon: PenLine,
    },
    ...(canCreate ? [{
      value: "group",
      label: ar ? "توقيع جماعي" : "Group",
      hint: ar
        ? "المستند ثم الموقّعون ثم الحقول ثم الإرسال — نفس سلسلة الختم."
        : "Document, then signers, then fields, then send — the same seal chain.",
      icon: Users,
    }] : []),
    {
      value: "inbox",
      label: ar ? "الصندوق" : "Inbox",
      hint: ar
        ? "طلبات بانتظار توقيعك، ونسخ مكتملة جاهزة للتحميل."
        : "Requests waiting for your signature, and completed copies ready to download.",
      icon: Inbox,
      count: pendingCount,
    },
    {
      value: "verify",
      label: ar ? "تحقق" : "Verify",
      hint: ar
        ? "ارفع النسخة الموقّعة أو أدخل رقم التحقق لمطابقة البصمة مع السجل."
        : "Upload the signed copy or enter the verification id to match the fingerprint to the registry.",
      icon: ShieldCheck,
    },
  ], [ar, canCreate, pendingCount]);

  const requested = searchParams.get("tab");
  const allowed = new Set(sections.map((section) => section.value));
  const tool = allowed.has(requested) ? requested : "individual";

  const setTool = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "individual") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!currentUser || !company) return;
    base44.functions.invoke("multiSign", {
      action: "list",
      companyId: company.id,
      sessionToken: getCompanyToken(company.id),
      userId: currentUser.id,
      email: (currentUser.email || "").toLowerCase(),
    }).then((response) => setPendingCount((response.data?.requests || []).filter((request) => request.myStatus === "pending").length)).catch(() => setPendingCount(0));
  }, [company, currentUser, multiRefresh]);

  if (!currentUser || !company) {
    return (
      <div style={{ ...pageCol, margin: "0 auto" }}>
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "جارٍ تحميل قسم التوقيع…" : "Loading signing…"}</p>
      </div>
    );
  }

  const scopedEmployees = visibleEmployees(currentUser, data || { stations: [], employees: [] });
  const legal = (
    <>
      {ar
        ? "توقيع إلكتروني متقدم داخل المنشأة وفق نظام التعاملات الإلكترونية: هوية الموقّع، إثبات الإرادة، سلامة المحتوى، والتحقق. ليس شهادة رقمية مؤهلة من مركز تصديق مرخّص."
        : "An advanced in-company electronic signature under the Electronic Transactions Law: signer identity, intent, content integrity, and verification. Not a qualified certificate from a licensed CSP."}
      {" "}
      {ar ? "التحقق العلني عبر" : "Public verification at"}{" "}
      <Link to="/verify" style={{ color: NAVY, fontWeight: 600 }}>/verify</Link>
      {ar ? " دون الدخول إلى المنصة." : " — no platform login required."}
    </>
  );

  return (
    <PlatformStampShell
      ar={ar}
      appearance="signing"
      className="nv-signing-stage"
      kicker={erpKicker("/app/signing", lang)}
      title={ar ? "التوقيع الرقمي" : "Digital signing"}
      hint={ar
        ? "ختم واحد يُحفظ بهويتك، يُوضع على الصفحة، ثم يُوقَّع باسمك وبصفتك — التحقق العلني بلا دخول."
        : "One seal saved to your identity, placed on the page, then signed in your name — public verify with no login."}
      sections={sections}
      tool={tool}
      onTool={setTool}
      legal={legal}
    >
      <ErpSectionFrame
        path="/app/signing"
        ar={ar}
        stats={[
        { label: ar ? "بانتظار توقيعك" : "Awaiting your sign", value: pendingCount, tone: pendingCount > 0 ? "warn" : "ok" },
        { label: ar ? "التحقق العلني" : "Public verify", value: ar ? "مفتوح" : "Open", hint: "/verify" },
      ]}
      >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SigningProofBand ar={ar} />
      {tool === "individual" && (
        <MySignatureCard
          companyId={company.id}
          companyName={company.name}
          currentUser={currentUser}
          ar={ar}
        />
      )}
      {tool === "group" && canCreate && (
        <MultiSignCard
          currentUser={currentUser}
          companyId={company.id}
          employees={scopedEmployees}
          ar={ar}
          onCreated={() => setMultiRefresh((n) => n + 1)}
        />
      )}
      {tool === "inbox" && (
        <MultiSignInbox
          currentUser={currentUser}
          companyId={company.id}
          ar={ar}
          refreshKey={multiRefresh}
          onPendingChange={setPendingCount}
        />
      )}
      {tool === "verify" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <VerifyDocumentCard ar={ar} />
          <HowSigningWorks ar={ar} />
        </div>
      )}
      </div>
      </ErpSectionFrame>
    </PlatformStampShell>
  );
}
