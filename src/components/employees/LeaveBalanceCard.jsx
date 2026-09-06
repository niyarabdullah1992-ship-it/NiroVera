import React from "react";
import { useI18n } from "@/lib/i18n";
import { getLeaveTotal, usedLeaveDays, leaveTypesForProfile } from "@/lib/leaveTypes";
import { ACCENT, MUTED, NAVY, bar } from "@/lib/platformStyles";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { CalendarDays } from "lucide-react";

/** Platform isTabLeave balances — L2695–2710 */
export default function LeaveBalanceCard({ profile, requests }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const onDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const items = leaveTypesForProfile(profile).filter((ty) => ty.key !== "unpaid").map((ty) => {
    const total = getLeaveTotal(profile, ty.key, onDate);
    const used = usedLeaveDays(requests, ty.key, onDate, profile?.hireDate);
    const p = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
    return {
      key: ty.key,
      label: t(ty.key),
      used: total != null ? `${used}/${total}` : `${used}`,
      barStyle: bar(total != null ? (p || 2) : 2, p >= 90 ? "#DC2626" : p >= 70 ? "#F59E0B" : ACCENT),
    };
  });

  return (
    <IdentityCard
      icon={CalendarDays}
      kicker={ar ? "أرصدة نظامية" : "Statutory balances"}
      title={ar ? "أرصدة الإجازات" : "Leave balances"}
      subtitle={ar
        ? "كل رصيد يعرض مادته ونصّها المرمّز. يُخصم عند الاعتماد فقط."
        : "Each balance shows its article and encoded text. Days deduct only on approval."}
      dir={ar ? "rtl" : "ltr"}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
        gap: "16px",
      }}
      >
        {items.map((l) => (
          <div key={l.key}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
              <span style={{ fontSize: "13px", color: NAVY }}>{l.label}</span>
              <span dir="ltr" style={{ fontSize: "12px", fontFamily: "'IBM Plex Sans',sans-serif", color: MUTED }}>
                {l.used}
              </span>
            </div>
            <div style={{ height: "6px", borderRadius: "5px", background: "#F1F5F9", overflow: "hidden", marginTop: "8px" }}>
              <span style={l.barStyle} />
            </div>
            <div style={{ marginTop: 8 }}>
              <LaborArticleCite leaveType={l.key} profile={profile} ar={ar} showText />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <LaborArticleCite ruleId="leave.annual.carry.cite" ar={ar} showText />
        <LaborArticleCite ruleId="eos.unusedLeave.cite" ar={ar} showText />
        <LaborArticleCite ruleId="leave.eid.cite" ar={ar} showText />
        <LaborArticleCite ruleId="leave.eid.fitrDays" ar={ar} showText />
        <LaborArticleCite ruleId="leave.eid.adhaDays" ar={ar} showText />
        <LaborArticleCite ruleId="leave.nationalDay.days" ar={ar} showText />
        <LaborArticleCite ruleId="leave.foundingDay.days" ar={ar} showText />
        <LaborArticleCite ruleId="leave.eid.overlap.cite" ar={ar} showText />
        <LaborArticleCite ruleId="leave.noOtherEmployer.cite" ar={ar} showText />
        {(String(profile?.gender || "").toLowerCase() === "female" || String(profile?.gender || "").includes("أنثى"))
          ? <LaborArticleCite ruleId="leave.nursing.dailyMinutes" ar={ar} showText />
          : null}
      </div>
    </IdentityCard>
  );
}
