import React, { useEffect, useState } from "react";
import { Loader2, ShieldX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import PublicProofReport from "@/components/proof/PublicProofReport";
import IdentityCard from "@/components/shared/IdentityCard";
import PublicPaperShell from "@/components/shared/PublicPaperShell";
import { MUTED } from "@/lib/platformStyles";
import { proofContentHash } from "@/lib/clientProof";

export default function ProofVerify() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const id = new URLSearchParams(window.location.search).get("id") || "";
  const [info, setInfo] = useState(null);
  const [hashMatches, setHashMatches] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    base44.functions
      .invoke("clientProof", { action: "lookup", proofId: id })
      .then(async (res) => {
        const found = res.data;
        setInfo(found);
        if (found?.found && !found.revoked) {
          const recomputed = await proofContentHash(found.payload || { items: [] });
          setHashMatches(recomputed === found.contentHash);
        }
      })
      .catch(() => setInfo({ found: false }))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PublicPaperShell dir={ar ? "rtl" : "ltr"} maxWidth={720}>
        <IdentityCard title={ar ? "التحقق من إثبات العمل" : "Work proof verification"} subtitle={ar ? "منصة NiroVera للتوثيق الميداني" : "NiroVera field verification"} />

        {loading && (
          <IdentityCard title={ar ? "جارٍ جلب الإثبات…" : "Loading proof…"}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 13 }}>
              <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
            </div>
          </IdentityCard>
        )}

        {!loading && (!id || info?.found === false) && (
          <IdentityCard icon={ShieldX} tone="bad" ar={ar} flag={ar ? "غير موجود" : "Not found"} title={ar ? "رقم الإثبات غير موجود في السجل." : "This proof reference does not exist in the registry."} />
        )}

        {!loading && info?.found && info.revoked && (
          <IdentityCard icon={ShieldX} tone="warn" ar={ar} flag={ar ? "مسحوب" : "Withdrawn"} title={ar ? "تم سحب هذا الإثبات من قبل الجهة المُصدِرة." : "This proof was withdrawn by the issuer."} />
        )}

        {!loading && info?.found && !info.revoked && <PublicProofReport info={info} hashMatches={hashMatches} ar={ar} />}
    </PublicPaperShell>
  );
}
