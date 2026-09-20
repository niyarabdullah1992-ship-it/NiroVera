import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { commandSigningSnapshot } from "@/lib/multiSignDerivations";
import { invokeLocalMultiSign, shouldUseLocalMultiSign } from "@/lib/localMultiSignFallback";
import { deskSigningRows } from "@/lib/writtenConsent";

const EMPTY = commandSigningSnapshot([]);

function listLocal(company, user, data) {
  if (!company?.id || !user?.id) return [];
  const actor = {
    id: user.id,
    userId: user.id,
    email: (user.email || "").toLowerCase(),
    name: user.name || "",
    role: user.role || "",
    companyId: company.id,
  };
  return deskSigningRows(invokeLocalMultiSign(
    { action: "list", companyId: company.id },
    { actor, employees: data?.employees || [] },
  ).requests || []);
}

/** Live signing snapshot for Command Center — local preview or multiSign list. */
export default function useCommandSigningSnapshot(company, user, data) {
  const [snap, setSnap] = useState(EMPTY);

  useEffect(() => {
    if (!company?.id || !user?.id) {
      setSnap(EMPTY);
      return undefined;
    }
    let active = true;
    const local = () => commandSigningSnapshot(listLocal(company, user, data));
    if (shouldUseLocalMultiSign()) {
      setSnap(local());
      return undefined;
    }
    base44.functions
      .invoke("multiSign", {
        action: "list",
        companyId: company.id,
        sessionToken: getCompanyToken(company.id),
        userId: user.id,
        email: (user.email || "").toLowerCase(),
      })
      .then((response) => {
        if (active) setSnap(commandSigningSnapshot(deskSigningRows(response.data?.requests || [])));
      })
      .catch(() => {
        if (active) setSnap(local());
      });
    return () => {
      active = false;
    };
  }, [company?.id, user?.id, user?.email, user?.name, user?.role, data?.employees, data?.signatureRequests?.length]);

  return snap;
}
