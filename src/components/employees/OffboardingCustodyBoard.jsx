import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  checkAddCustodyGate,
  checkCompleteOffboardingGate,
  checkMarkReturnedGate,
  custodyDebtOf,
  deriveEos,
  deriveSettlementDeadline,
  eosEndMs,
} from "@/lib/offboardingDerivations";
import { averageActualWage, deriveFinalSettlement, isAverageWageBasis } from "@/lib/payrollLaw";
import { recordFinalSettlementPaid } from "@/lib/payrollLawStore";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { compPayout, hoursWord } from "@/lib/compLeave";
import { toast } from "@/components/ui/use-toast";
import { BORDER, BRAND, BRAND_DEEP, MUTED, NAVY, OK, WARN, BAD, NEUTRAL, CARD, SURFACE } from "@/lib/platformStyles";

async function offboardingApi(payload) {
  const res = await base44.functions.invoke("offboarding", payload);
  return res?.data ?? res;
}

const STEP_LABEL = {
  assets: { ar: "تسليم العهد", en: "Return custody" },
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

const fieldStyle = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: NAVY,
  fontSize: "12px",
  fontFamily: "inherit",
  minWidth: 0,
};

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
  const { company, currentUser, data } = useAuth();
  const [caseRow, setCaseRow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ name: "", serial: "", value: "", handedAt: "", evidenceName: "", evidenceUrl: "" });
  const [uploading, setUploading] = useState(false);

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

  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const attachEvidence = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      setDraft((prev) => ({ ...prev, evidenceName: file.name, evidenceUrl: up?.file_url || up?.url || "" }));
    } catch {
      // The file name alone still names the handover paper; the URL is optional.
      setDraft((prev) => ({ ...prev, evidenceName: file.name, evidenceUrl: "" }));
    } finally {
      setUploading(false);
    }
  };

  const addCustody = async () => {
    const item = {
      name: draft.name.trim(),
      serial: draft.serial.trim() || undefined,
      value: draft.value === "" ? 0 : Number(draft.value),
      handedAt: draft.handedAt || undefined,
      evidenceName: draft.evidenceName || undefined,
      evidenceUrl: draft.evidenceUrl || undefined,
    };
    const gate = checkAddCustodyGate(caseRow, item, todayIso());
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    await run({ action: "addCustody", item }, ar ? `سُجّلت العهدة: ${item.name}` : `Custody recorded: ${item.name}`);
    setDraft({ name: "", serial: "", value: "", handedAt: "", evidenceName: "", evidenceUrl: "" });
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

  // Arts. 84/87/111: service, the Art. 87 windows and accrued leave are measured to the exit
  // date (effective date, else last day), not to whenever the file happens to be opened.
  const exitRow = employee?.profile?.contractExit || caseRow?.contractExit || {};
  const endMs = eosEndMs({ contractExit: exitRow });
  const endDay = new Date(endMs);
  const endIso = `${endDay.getFullYear()}-${String(endDay.getMonth() + 1).padStart(2, "0")}-${String(endDay.getDate()).padStart(2, "0")}`;
  // Art. 96: piece / commission-only wages settle on the last year's average actual wage.
  const average = isAverageWageBasis(employee) ? averageActualWage(data?.payrollRuns || [], employee?.id, endIso.slice(0, 7)) : null;
  const eos = caseRow
    ? deriveEos({
      ...caseRow,
      contractExit: exitRow,
      gender: employee?.profile?.gender,
      profile: employee?.profile,
      leaveRequests: employee?.leaveRequests || [],
      averageWage: average?.average,
      averageWageBasis: Boolean(average?.months),
    }, endMs)
    : null;
  const settlement = deriveSettlementDeadline({
    reason: exitRow.reason || caseRow?.exitReason,
    lastWorkDate: exitRow.effectiveDate || exitRow.lastDay,
    contractExit: exitRow,
    settlementPaidAt: exitRow.settlementPaidAt,
  });
  const comp = eos ? compPayout(employee, endIso, eos.wage) : { hours: 0, amount: 0 };
  // Art. 88: the final settlement — partial month, award, leave and comp hours, less work debts set off.
  const custodyDebt = custodyDebtOf(caseRow?.assets || []);
  const finalSettlement = eos ? deriveFinalSettlement({
    employee,
    eos,
    payrollRuns: data?.payrollRuns || [],
    exitDate: exitRow.effectiveDate || exitRow.lastDay || "",
    monthlyWage: eos.wage,
    custodyDebt,
    extras: comp.amount,
    deadline: settlement,
  }) : null;
  const markSettlementPaid = () => {
    if (!company?.id || !employee?.id || !finalSettlement) return;
    const res = recordFinalSettlementPaid(company.id, employee.id, { amount: finalSettlement.net });
    if (res?.error) {
      toast({ description: ar ? (res.reason || res.error) : (res.reasonEn || res.error), variant: "destructive" });
      return;
    }
    toast({ description: ar ? "سُجّل صرف التصفية النهائية — أُغلقت مهلة المادة 88." : "Final settlement recorded as paid — the Art. 88 window is closed." });
  };
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
      background: "var(--nv-accent-soft)",
      border: "1px solid var(--nv-ok-line)",
      fontSize: "13px",
      color: "var(--nv-ok-ink)",
      fontWeight: 500,
    }
    : {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "13px 16px",
      borderRadius: "12px",
      background: "var(--nv-bad-soft)",
      border: "1px solid var(--nv-line)",
      fontSize: "13px",
      color: "var(--nv-bad-ink)",
      fontWeight: 500,
    };

  const gateText = completed
    ? (ar ? "أُنهيت الخدمة — الصلاحيات ملغاة وقائمة قوى الداخلية مكتملة" : "Offboarding completed — access revoked and internal Qiwa checklist closed")
    : outstanding > 0
      ? (ar
        ? `${outstanding} عهدة لم تُستلم — إنهاء الخدمة موقوف`
        : `${outstanding} custody items outstanding — offboarding is blocked`)
      : (ar ? "كل العهد مُستلمة — يمكن إنهاء الخدمة" : "All custody returned — offboarding can complete");

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
          {ar ? "العهد المسجّلة" : "Custody held"}
        </div>
        <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.65 }}>
          {ar
            ? "ما سُلّم للموظف من أدوات صاحب العمل ويُعاد عند انتهاء الخدمة (المادة 65/2). القيمة غير المسلّمة تُحسم في التصفية النهائية بحد أجر 5 أيام (المادة 91)."
            : "Employer tools handed to the employee, returned at exit (Art. 65(2)). Unreturned value is set off in the final settlement, capped at 5 days' wage (Art. 91)."}
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
                  borderTop: "1px solid var(--nv-line)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: "13px", color: NAVY }}>{asset.name}</div>
                  <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px", fontFamily: "'IBM Plex Mono',monospace" }} dir="ltr">
                    {asset.serial || "—"}
                  </div>
                  <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>
                    {Number(asset.value ?? asset.cost) > 0 ? `${fmt(asset.value ?? asset.cost)} ${ar ? "ر.س" : "SAR"}` : (ar ? "بلا قيمة مسجّلة" : "No value recorded")}
                    {asset.handedAt ? ` · ${ar ? "سُلّمت" : "Handed"} ${String(asset.handedAt).slice(0, 10)}` : ""}
                    {asset.returnedAt ? ` · ${ar ? "أُعيدت" : "Returned"} ${String(asset.returnedAt).slice(0, 10)}` : ""}
                    {asset.evidenceName ? (
                      <>
                        {" · "}
                        {asset.evidenceUrl
                          ? <a href={asset.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: NAVY }}>{asset.evidenceName}</a>
                          : asset.evidenceName}
                      </>
                    ) : null}
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
              {ar ? "لا عهد مسجّلة بعد." : "No custody recorded yet."}
            </div>
          )}
        </div>
        {canManage && !completed && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginTop: "10px", paddingTop: "12px", borderTop: "1px solid var(--nv-line)" }}>
            <input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={ar ? "العهدة (مثال: حاسب محمول)" : "Item (e.g. laptop)"}
              style={{ ...fieldStyle, flex: "2 1 180px" }}
            />
            <input
              value={draft.serial}
              onChange={(event) => setDraft((prev) => ({ ...prev, serial: event.target.value }))}
              placeholder={ar ? "الرقم التسلسلي أو الوصف" : "Serial or description"}
              style={{ ...fieldStyle, flex: "1 1 140px" }}
            />
            <input
              type="number"
              min="0"
              value={draft.value}
              onChange={(event) => setDraft((prev) => ({ ...prev, value: event.target.value }))}
              placeholder={ar ? "القيمة (ر.س)" : "Value (SAR)"}
              style={{ ...fieldStyle, flex: "0 1 110px" }}
            />
            <input
              type="date"
              value={draft.handedAt}
              onChange={(event) => setDraft((prev) => ({ ...prev, handedAt: event.target.value }))}
              aria-label={ar ? "تاريخ التسليم" : "Handed on"}
              style={{ ...fieldStyle, flex: "0 1 140px" }}
            />
            <label style={{ ...actStyle, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              {uploading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : null}
              {draft.evidenceName || (ar ? "محضر التسليم" : "Handover paper")}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(event) => attachEvidence(event.target.files?.[0])} />
            </label>
            <button type="button" disabled={busy || uploading} onClick={addCustody} style={{ ...actStyle, opacity: busy || uploading ? 0.5 : 1 }}>
              {ar ? "تسجيل عهدة" : "Record custody"}
            </button>
          </div>
        )}
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
              ? `تُحسب المادة 84 أولاً حتى ${eos.endDate || ""}. الفصل وفق المادة 80 بغير مكافأة. ترك العمل وفق المادة 81 يحفظ الحقوق كاملة. الاستقالة تطبّق المادة 85. المادة 87: ترك العامل العمل لقوة قاهرة خارجة عن إرادته، أو إنهاء العاملة العقد خلال ستة أشهر من الزواج أو ثلاثة أشهر من الوضع — المكافأة كاملة. العمولات من الأجر ما لم يُتفق على استبعادها (المادة 86)${eos.suspendedDays ? `، وتُستبعد ${eos.suspendedDays} يوماً موقوفة من الإجازة بلا أجر (المادة 116)` : ""}.`
              : `Article 84 is calculated first, to ${eos.endDate || ""}. Article 80 dismissal is without award. Leaving under Article 81 preserves full rights. Resignation applies Article 85. Article 87: a worker leaving through force majeure beyond his will, or a female worker ending the contract within six months of marriage or three months of childbirth — the full award. Commissions are wage unless excluded by agreement (Art. 86)${eos.suspendedDays ? `; ${eos.suspendedDays} suspended unpaid-leave days are left out (Art. 116)` : ""}.`}
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
              background: "var(--nv-warn-soft)",
              border: "1px solid var(--nv-line)",
              fontSize: "11px",
              color: "var(--nv-warn-ink)",
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
                { label: eos.averageBasis ? (ar ? "متوسط أجر السنة الأخيرة (المادة 96)" : "Last year's average wage (Art. 96)") : (ar ? `آخر أجر شامل (أساسي + بدلات${eos.commission ? " + عمولات" : ""})` : `Final wage (base + allowances${eos.commission ? " + commissions" : ""})`), value: fmt(eos.wage) },
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
                // Regs 22 bis — comp leave not taken before leaving is paid at the actual hourly wage.
                ...(() => {
                  return comp.hours > 0
                    ? [{ label: ar ? `أجرة ${hoursWord(comp.hours)} إجازة تعويضية لم تُؤخذ (اللائحة 22 مكرر)` : `${comp.hours} h untaken compensatory leave (regs 22 bis)`, value: fmt(comp.amount) }]
                    : [];
                })(),
              ].map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "12px",
                    paddingBottom: "10px",
                    borderBottom: "1px solid var(--nv-line)",
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
                    borderBottom: "1px solid var(--nv-line)",
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
                <div style={{ fontSize: 12, color: settlement.late ? "var(--nv-warn-ink)" : MUTED, marginTop: 6, lineHeight: 1.65 }}>
                  {settlement.closed
                    ? (ar ? `صُرفت التصفية في ${settlement.paidAt}${settlement.paidLate ? ` — بعد المهلة (${settlement.due})` : ""}.` : `Settlement paid on ${settlement.paidAt}${settlement.paidLate ? ` — after the window (${settlement.due})` : ""}.`)
                    : settlement.pending
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
                    {fmt(eos.total + comp.amount)}
                  </span>
                  <span style={{ fontSize: "12px", color: MUTED }}>SAR</span>
                </div>
              </div>
              {finalSettlement ? (
                <div data-final-settlement="1" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "التصفية النهائية — المادة 88" : "Final settlement — Art. 88"}</div>
                  {[
                    finalSettlement.partialDays
                      ? { label: ar ? `أجر الشهر الأخير — ${finalSettlement.partialDays} يوماً` : `Final month's wage — ${finalSettlement.partialDays} days`, value: fmt(finalSettlement.partialWage) }
                      : { label: ar ? (finalSettlement.monthPaid ? "أجر الشهر الأخير — مصروف في المسير" : "أجر الشهر الأخير — حدد تاريخ الخروج") : (finalSettlement.monthPaid ? "Final month's wage — paid in the run" : "Final month's wage — set the exit date"), value: "—" },
                    { label: ar ? "المكافأة وبدل الإجازة والساعات التعويضية" : "Award, leave pay and comp hours", value: fmt(finalSettlement.eosTotal + finalSettlement.extras) },
                    ...(finalSettlement.advances ? [{ label: ar ? "تُخصم سلف قائمة (دين بسبب العمل)" : "Less outstanding advances (work debt)", value: `− ${fmt(Math.min(finalSettlement.advances, finalSettlement.setOff))}` }] : []),
                    ...(finalSettlement.custodyDebt ? [{
                      label: ar
                        ? `تُخصم عهدة لم تُسلَّم — حتى أجر 5 أيام (المادة 91)${finalSettlement.custodyToCourt ? `؛ الباقي ${fmt(finalSettlement.custodyToCourt)} يُطلب أمام المحكمة العمالية` : ""}`
                        : `Less unreturned custody — up to 5 days' wage (Art. 91)${finalSettlement.custodyToCourt ? `; the remaining ${fmt(finalSettlement.custodyToCourt)} is claimed before the labour court` : ""}`,
                      value: `− ${fmt(finalSettlement.custodySetOff)}`,
                    }] : []),
                  ].map((r) => (
                    <div key={r.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 12, color: MUTED }}>{r.label}</span>
                      <span dir="ltr" style={{ fontSize: 13, color: NAVY }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{ar ? "صافي التصفية" : "Net settlement"}</span>
                    <span dir="ltr" style={{ fontSize: 18, fontWeight: 600, color: NAVY }}>{fmt(finalSettlement.net)} SAR</span>
                  </div>
                  {canManage && !finalSettlement.paidAt ? (
                    <button type="button" onClick={markSettlementPaid} style={{ ...actStyle, alignSelf: "flex-start" }}>
                      {ar ? "تسجيل صرف التصفية" : "Record settlement paid"}
                    </button>
                  ) : null}
                </div>
              ) : null}
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
            : "Offboarding cannot close before every custody item is returned and access is revoked — the two steps are linked."}
          {" "}
          <Link to="/app/requests" style={{ color: NAVY, fontWeight: 600 }}>
            {ar ? "طلبات العهدة في طلباتي" : "Custody requests in My Requests"}
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
                  borderTop: "1px solid var(--nv-line)",
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
                  ? (ar ? "استلم كل العهد أولًا" : "Return all custody first")
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
