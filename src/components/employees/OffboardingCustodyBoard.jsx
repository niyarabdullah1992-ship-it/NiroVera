import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  checkCompleteOffboardingGate,
  checkMarkReturnedGate,
  deriveEos,
  deriveSettlementDeadline,
} from "@/lib/offboardingDerivations";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { toast } from "@/components/ui/use-toast";
import { BORDER, BRAND, BRAND_DEEP, MUTED, NAVY, OK, WARN, BAD, NEUTRAL, CARD, SURFACE } from "@/lib/platformStyles";

async function offboardingApi(payload) {
  const res = await base44.functions.invoke("offboarding", payload);
  return res?.data ?? res;
}

const STEP_LABEL = {
  assets: { ar: "تسليم العهد والأصول", en: "Return assigned assets" },
  safety: { ar: "إخلاء طرف من السلامة", en: "Safety clearance" },
  settlement: { ar: "تسوية المستحقات المالية", en: "Final settlement" },
  access: { ar: "إلغاء صلاحيات الدخول", en: "Revoke system access" },
  qiwa: { ar: "إنهاء العقد في منصة قوى", en: "Terminate contract in Qiwa" },
  certificate: { ar: "شهادة الخبرة", en: "Experience certificate" },
};

function stepChip(state, ar) {
  if (state === "blocked") return { text: ar ? "موقوف" : "Blocked", style: BAD };
  if (state === "done") {
    return { text: ar ? "مكتمل" : "Done", style: OK };
  }
  if (state === "ready") return { text: ar ? "جاهز للاحتساب" : "Ready to compute", style: WARN };
  return { text: ar ? "عند الإغلاق" : "On completion", style: NEUTRAL };
}

function accessChip(state, ar, completed) {
  if (completed || state === "done") {
    return { text: ar ? "أُلغيت" : "Revoked", style: OK };
  }
  return { text: ar ? "عند الإغلاق" : "On completion", style: NEUTRAL };
}

function qiwaChip(state, ar, completed) {
  if (completed || state === "done") {
    return { text: ar ? "أُرسل" : "Submitted", style: OK };
  }
  return { text: ar ? "عند الإغلاق" : "On completion", style: NEUTRAL };
}

function certChip(state, ar, completed) {
  if (completed || state === "done") {
    return { text: ar ? "صدرت" : "Issued", style: OK };
  }
  return { text: ar ? "عند الإغلاق" : "On completion", style: NEUTRAL };
}

function chipForStep(step, ar, completed) {
  if (step.id === "access") return accessChip(step.state, ar, completed);
  if (step.id === "qiwa") return qiwaChip(step.state, ar, completed);
  if (step.id === "certificate") return certChip(step.state, ar, completed);
  return stepChip(step.state, ar);
}

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

const card = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: "16px",
  padding: "18px 20px",
};

const actStyle = {
  padding: "5px 13px",
  borderRadius: "8px",
  border: `1px solid ${BRAND}`,
  background: CARD,
  color: BRAND_DEEP,
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};

/** Platform isTabOff — L2811–2872 */
export default function OffboardingCustodyBoard({ employee, canManage = false, lang = "ar" }) {
  const ar = lang === "ar";
  const { company, currentUser } = useAuth();
  const [caseRow, setCaseRow] = useState(null);
  const [busy, setBusy] = useState(false);

  const applyRemote = (remote) => {
    setCaseRow(remote?.case || null);
  };

  const load = async () => {
    if (!company?.id || !employee?.id) return;
    try {
      let remote = await offboardingApi({
        action: "get",
        companyId: company.id,
        employeeId: employee.id,
      });
      if (!remote?.case && canManage) {
        remote = await offboardingApi({
          action: "seedDemo",
          companyId: company.id,
          employeeId: employee.id,
          employeeName: employee.name,
          stationId: employee.stationId || null,
          hireDate: employee.profile?.hireDate || employee.hireDate || undefined,
          base: employee.profile?.baseSalary ?? employee.profile?.salary?.base ?? employee.salary?.base,
          allowances: employee.profile?.allowances ?? employee.profile?.salary?.allowances ?? employee.salary?.allowances,
          annualLeaveUsed: employee.profile?.leave?.annual,
        });
      }
      applyRemote(remote);
    } catch {
      setCaseRow(null);
    }
  };

  useEffect(() => { load(); }, [company?.id, employee?.id, canManage]);

  const run = async (payload, okMsg) => {
    if (!company?.id || !employee?.id) return;
    setBusy(true);
    try {
      const remote = await offboardingApi({
        ...payload,
        companyId: company.id,
        employeeId: employee.id,
      });
      if (remote?.error) {
        toast({
          description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.reason || remote.error),
          variant: "destructive",
        });
      } else {
        if (okMsg) toast({ description: okMsg });
        applyRemote(remote);
      }
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const markReturned = async (asset) => {
    const gate = checkMarkReturnedGate(caseRow, asset.id);
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    await run(
      { action: "markReturned", assetId: asset.id },
      ar ? `استُلمت: ${asset.name}` : `Returned: ${asset.name}`,
    );
  };

  const complete = async () => {
    const gate = checkCompleteOffboardingGate(caseRow, {
      contractExit: employee?.profile?.contractExit,
      employee,
      leaveRequests: employee?.leaveRequests,
    });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    if (!window.confirm(
      ar
        ? "سيتم إنهاء الخدمة وإلغاء الصلاحيات وإكمال قائمة قوى الداخلية. الإرسال الحي لمنصة قوى غير مفعّل بعد. هل تريد المتابعة؟"
        : "This will complete offboarding, revoke access and close the internal Qiwa checklist. Live Qiwa API send is not enabled yet. Continue?",
    )) return;
    await run(
      { action: "complete" },
      ar ? "أُنهيت الخدمة وأُلغيت الصلاحيات — قائمة قوى الداخلية مكتملة (بلا إرسال حي)" : "Offboarding completed, access revoked — internal Qiwa checklist closed (no live send)",
    );
  };

  if (!currentUser) return null;

  const eos = caseRow
    ? deriveEos({
      ...caseRow,
      contractExit: employee?.profile?.contractExit || caseRow.contractExit,
      gender: employee?.profile?.gender,
      profile: employee?.profile,
    })
    : null;
  const settlement = deriveSettlementDeadline({
    reason: employee?.profile?.contractExit?.reason || caseRow?.contractExit?.reason || caseRow?.exitReason,
    lastWorkDate: employee?.profile?.contractExit?.effectiveDate || caseRow?.contractExit?.effectiveDate,
    contractExit: employee?.profile?.contractExit || caseRow?.contractExit,
  });
  const completed = caseRow?.status === "completed";
  const outstanding = caseRow?.outstandingCount || 0;
  const gateOpen = !!caseRow?.gateOpen;

  const offGateStyle = (completed || outstanding === 0)
    ? {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "13px 16px",
      borderRadius: "12px",
      background: "#ECFDF3",
      border: "1px solid #BBF7D0",
      fontSize: "13px",
      color: "#15803D",
      fontWeight: 500,
    }
    : {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "13px 16px",
      borderRadius: "12px",
      background: "#FEF2F2",
      border: "1px solid #FECACA",
      fontSize: "13px",
      color: "#991B1B",
      fontWeight: 500,
    };

  const gateText = completed
    ? (ar ? "أُنهيت الخدمة — الصلاحيات ملغاة وقائمة قوى الداخلية مكتملة" : "Offboarding completed — access revoked and internal Qiwa checklist closed")
    : outstanding > 0
      ? (ar
        ? `${outstanding} عهدة لم تُستلم — إنهاء الخدمة موقوف`
        : `${outstanding} assets outstanding — offboarding is blocked`)
      : (ar ? "كل العهد مُستلمة — يمكن إنهاء الخدمة" : "All assets returned — offboarding can complete");

  const offCompleteStyle = completed
    ? {
      marginTop: "16px",
      padding: "10px 20px",
      borderRadius: "9px",
      background: SURFACE,
      color: MUTED,
      border: `1px solid ${BORDER}`,
      fontSize: "13px",
      fontWeight: 600,
      cursor: "default",
      fontFamily: "inherit",
    }
    : gateOpen
      ? {
        marginTop: "16px",
        padding: "10px 20px",
        borderRadius: "9px",
        background: BRAND,
        color: "#fff",
        border: "none",
        fontSize: "13px",
        fontWeight: 600,
        cursor: busy ? "wait" : "pointer",
        fontFamily: "inherit",
        opacity: busy ? 0.6 : 1,
      }
      : {
        marginTop: "16px",
        padding: "10px 20px",
        borderRadius: "9px",
        background: BORDER,
        color: MUTED,
        border: "none",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "not-allowed",
        fontFamily: "inherit",
      };

  const yearsLabel = eos?.preStart
    ? (ar ? "لم تبدأ الخدمة بعد" : "Service has not commenced")
    : eos
      ? (ar ? `${Number(eos.years || 0).toFixed(1)} سنة خدمة` : `${Number(eos.years || 0).toFixed(1)} years of service`)
      : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} dir={ar ? "rtl" : "ltr"}>
      <div style={offGateStyle}>{gateText}</div>

      <div style={card}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
          {ar ? "العهد المسجّلة" : "Assigned assets"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "8px" }}>
          {(caseRow?.assets || []).map((asset) => {
            const returned = asset.status === "returned";
            return (
              <div
                key={asset.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderTop: "1px solid #F1F5F9",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: "13px", color: NAVY }}>{asset.name}</div>
                  <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px", fontFamily: "'IBM Plex Mono',monospace" }} dir="ltr">
                    {asset.serial || "—"}
                  </div>
                </div>
                <span style={returned ? OK : BAD}>
                  {returned ? (ar ? "مُستلم" : "Returned") : (ar ? "لم يُسلَّم" : "Outstanding")}
                </span>
                {canManage && !completed && !returned && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => markReturned(asset)}
                    style={{ ...actStyle, opacity: busy ? 0.5 : 1 }}
                  >
                    {busy ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : null}
                    {" "}{ar ? "استلمت العهدة" : "Mark returned"}
                  </button>
                )}
              </div>
            );
          })}
          {!caseRow?.assets?.length && (
            <div style={{ padding: "22px 0", textAlign: "center", fontSize: "13px", color: MUTED }}>
              {ar ? "لا عهد مسجّلة بعد." : "No custody assets yet."}
            </div>
          )}
        </div>
      </div>

      {eos && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
              {ar ? "مكافأة نهاية الخدمة" : "End-of-service award"}
            </div>
            <div style={{ fontSize: "11px", color: MUTED }}>{yearsLabel}</div>
          </div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.65, textWrap: "pretty" }}>
            {ar
              ? "تُحسب المادة 84 أولاً. الفصل وفق المادة 80 بغير مكافأة. ترك العمل وفق المادة 81 يحفظ الحقوق كاملة. الاستقالة تطبّق المادة 85. المادة 87 إذا أنهت العاملة العقد خلال ستة أشهر من الزواج أو ثلاثة أشهر من الوضع. القوة القاهرة في المادة 74 تستحق المادة 84 كاملة."
              : "Article 84 is calculated first. Article 80 dismissal is without award. Leaving under Article 81 preserves full rights. Resignation applies Article 85. Article 87 applies if a female worker ends the contract within six months of marriage or three months of childbirth. Force majeure under Article 74 is a full Article 84 award."}
          </div>
          {eos?.citeRuleId ? (
            <div style={{ marginTop: "10px" }}>
              <LaborArticleCite ruleId={eos.citeRuleId} ar={ar} showText />
            </div>
          ) : null}
          {eos.preStart ? (
            <div style={{
              marginTop: "12px",
              padding: "11px 13px",
              borderRadius: "10px",
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              fontSize: "11px",
              color: "#92400E",
              lineHeight: 1.7,
              textWrap: "pretty",
            }}
            >
              {ar
                ? "لا تستحق مكافأة نهاية خدمة قبل أول يوم عمل فعلي."
                : "No end-of-service gratuity accrues before the first actual working day."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
              {[
                { label: ar ? "آخر أجر شامل (أساسي + بدلات)" : "Final wage (base + allowances)", value: fmt(eos.wage) },
                { label: ar ? "نصف شهر × أول 5 سنوات" : "Half month × first 5 years", value: fmt(eos.firstFive) },
                { label: ar ? "شهر كامل × ما بعد 5 سنوات" : "Full month × years beyond 5", value: fmt(eos.beyondFive) },
                ...(eos.art80
                  ? [{ label: ar ? "المادة 80 — بلا مكافأة" : "Article 80 — no award", value: fmt(eos.gratuity) }]
                  : eos.art81
                    ? [{ label: ar ? "المادة 81 — الحقوق كاملة" : "Article 81 — full rights", value: fmt(eos.gratuity) }]
                    : eos.fraction != null && eos.fraction !== 1
                      ? [{ label: ar ? `تطبيق المادة 85 (${Math.round(eos.fraction * 100)}٪)` : `Article 85 applied (${Math.round(eos.fraction * 100)}%)`, value: fmt(eos.gratuity) }]
                      : eos.art87
                        ? [{ label: ar ? "المادة 87 — المكافأة كاملة" : "Article 87 — full award", value: fmt(eos.gratuity) }]
                        : [{ label: ar ? "مكافأة نهاية الخدمة" : "End-of-service award", value: fmt(eos.gratuity) }]),
                {
                  label: ar ? `بدل ${eos.unusedAnnualDays} يوم إجازة غير مستنفدة` : `${eos.unusedAnnualDays} days unused annual leave`,
                  value: fmt(eos.leaveCash),
                },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "12px",
                    paddingBottom: "10px",
                    borderBottom: "1px solid #F1F5F9",
                  }}
                >
                  <span style={{ fontSize: "12px", color: MUTED }}>{r.label}</span>
                  <span dir="ltr" style={{ fontSize: "13px", fontWeight: 500, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right", color: NAVY }}>
                    {r.value}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <LaborArticleCite ruleId="eos.unusedLeave.cite" ar={ar} showText />
              </div>
              {eos.unlawful?.applies ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "12px",
                    paddingBottom: "10px",
                    borderBottom: "1px solid #F1F5F9",
                  }}
                  >
                    <span style={{ fontSize: "12px", color: MUTED }}>
                      {ar
                        ? `تعويض المادة 77 إن ثبت الإنهاء غير المشروع — لا يُضاف إلى الإجمالي`
                        : `Article 77 indemnity if termination is unlawful — not added to the total`}
                    </span>
                    <span dir="ltr" style={{ fontSize: "13px", fontWeight: 500, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right", color: NAVY }}>
                      {fmt(eos.unlawful.amount)}
                    </span>
                  </div>
                  <LaborArticleCite ruleId="eos.unlawful.cite" ar={ar} showText />
                </div>
              ) : null}
              <div style={{ marginTop: 10 }}>
                <LaborArticleCite ruleId={settlement.workerEnded ? "eos.settlement.workerDays" : "eos.settlement.employerDays"} ar={ar} showText />
                <div style={{ fontSize: 12, color: settlement.late ? "#B45309" : MUTED, marginTop: 6, lineHeight: 1.65 }}>
                  {settlement.pending
                    ? (ar ? "مهلة التصفية تبدأ من آخر يوم عمل." : "The settlement window starts from the last working day.")
                    : settlement.late
                      ? (ar ? `تجاوزت مهلة التصفية (${settlement.due}).` : `The settlement window (${settlement.due}) has passed.`)
                      : (ar ? `تصفية الحقوق حتى ${settlement.due} (${settlement.days} أيام).` : `Settle entitlements by ${settlement.due} (${settlement.days} days).`)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
                  {ar ? "الإجمالي المستحق" : "Total due"}
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span dir="ltr" style={{ fontSize: "22px", fontWeight: 600, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right", color: NAVY }}>
                    {fmt(eos.total)}
                  </span>
                  <span style={{ fontSize: "12px", color: MUTED }}>SAR</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
          {ar ? "إنهاء الخدمة" : "Offboarding"}
        </div>
        <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.65, textWrap: "pretty" }}>
          {ar
            ? "لا يُغلق إنهاء الخدمة قبل استلام كل العهد وإلغاء الصلاحيات — الخطوتان مترابطتان في النظام."
            : "Offboarding cannot close before every asset is returned and access is revoked — the two steps are linked."}
          {" "}
          <Link to="/app/assets" style={{ color: NAVY, fontWeight: 600 }}>
            {ar ? "سجل الأصول والعهد" : "Assets & custody register"}
          </Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "12px" }}>
          {(caseRow?.steps || []).map((step) => {
            const label = STEP_LABEL[step.id] || { ar: step.id, en: step.id };
            const chip = chipForStep(step, ar, completed);
            return (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "11px 0",
                  borderTop: "1px solid #F1F5F9",
                }}
              >
                <span style={{ flex: 1, fontSize: "13px", color: NAVY }}>{ar ? label.ar : label.en}</span>
                <span style={chip.style}>{chip.text}</span>
              </div>
            );
          })}
        </div>

        {canManage ? (
          <button
            type="button"
            disabled={busy || completed || !gateOpen}
            onClick={complete}
            style={offCompleteStyle}
            title={
              completed
                ? (ar ? "الخدمة منتهية بالفعل" : "Already completed")
                : !gateOpen
                  ? (ar ? "استلم كل العهد أولًا" : "Return every asset first")
                  : undefined
            }
          >
            {busy ? <Loader2 style={{ width: 14, height: 14, display: "inline", verticalAlign: "middle" }} className="animate-spin" /> : null}
            {" "}
            {completed
              ? (ar ? "أُنهيت الخدمة" : "Offboarding completed")
              : (ar ? "أنهِ الخدمة" : "Complete offboarding")}
          </button>
        ) : (
          <div style={{ marginTop: "14px", fontSize: "12px", color: MUTED }}>
            {ar ? "إجراءات إنهاء الخدمة متاحة للإدارة والموارد البشرية فقط." : "Offboarding is available to management and HR only."}
          </div>
        )}
      </div>
    </div>
  );
}
