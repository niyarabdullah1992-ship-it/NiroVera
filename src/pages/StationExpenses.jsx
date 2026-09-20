import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { expensesCall } from "@/lib/expensesApi";
import ExpenseStats from "@/components/expenses/ExpenseStats";
import ExpenseList from "@/components/expenses/ExpenseList";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import SectionBackLink from "@/components/shared/SectionBackLink";
import { pageKicker } from "@/lib/moduleMeta";
import { MUTED, SURFACE } from "@/lib/platformStyles";

export default function StationExpenses() {
  const { stationId } = useParams();
  const { session, data } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const station = data?.stations?.find((item) => item.id === stationId);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const stationVersion = (data?.stations || []).map((item) => item.id).sort().join("|");
  useEffect(() => {
    setLoading(true);
    expensesCall(session, "list", { stations: data?.stations || [] }).then((result) => {
      setClaims(result.claims.filter((claim) => (claim.stationIds?.length ? claim.stationIds : [claim.stationId]).includes(stationId)));
    }).finally(() => setLoading(false));
  }, [session?.token, stationId, stationVersion]);

  if (!station) {
    return (
      <PlatformStampShell
        ar={ar}
        kicker={pageKicker("/app/expenses", lang)}
        title={ar ? "مصروفات الفرع" : "Station expenses"}
        hint={ar ? "هذا الفرع غير موجود في النطاق الحالي." : "This station is not in the current scope."}
      >
        <p style={{ margin: 0, fontSize: 13, color: MUTED, textAlign: "center", padding: 24 }}>
          {ar ? "الفرع غير موجودة." : "Station not found."}
        </p>
      </PlatformStampShell>
    );
  }

  const stations = data.stations.map((item) => ({ ...item, stationId: item.id }));

  return (
    <PlatformStampShell
      ar={ar}
      kicker={pageKicker("/app/expenses", lang)}
      title={ar ? `مصروفات ${station.name}` : `${station.name} expenses`}
      hint={ar ? "السجل المالي الخاص بهذا الفرع فقط." : "Financial expense ledger for this station only."}
      lead={<SectionBackLink ar={ar} label={ar ? "المصروفات" : "Expenses"} to="/app/expenses" />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ExpenseStats claims={claims} ar={ar} />
        {loading
          ? <div style={{ height: 160, borderRadius: 16, background: SURFACE }} />
          : <ExpenseList claims={claims} stations={stations} canManagerReview={false} canFinanceReview={false} ar={ar} />}
      </div>
    </PlatformStampShell>
  );
}
