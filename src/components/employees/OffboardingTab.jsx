import React from "react";
import { useI18n } from "@/lib/i18n";
import OffboardingCustodyBoard from "@/components/employees/OffboardingCustodyBoard";
import ContractExitCard from "@/components/employees/ContractExitCard";

/** Thin shell — custody / EOS board is server-derived via `offboarding`. */
export default function OffboardingTab({ employee, canManage, companyId }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <>
      <ContractExitCard employee={employee} companyId={companyId} ar={ar} canManage={!!canManage} />
      <OffboardingCustodyBoard
        employee={employee}
        canManage={!!canManage}
        lang={lang}
      />
    </>
  );
}
