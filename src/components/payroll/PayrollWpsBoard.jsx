import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Send, AlertTriangle, ShieldCheck, ListChecks } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { netOf } from "@/lib/payroll";
import {
  checkSendWpsGate,
  isWpsLate,
  wpsDeadline,
} from "@/lib/payrollDerivations";
import { buildWpsFileRows, checkWpsFileGate, wpsRowBlockers } from "@/lib/complianceDerivations";
import { toast } from "@/components/ui/use-toast";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { ACCENT, MUTED, NAVY, OK, WARN, BAD, NEUTRAL, ui, CARD, SURFACE } from "@/lib/platformStyles";
import IdentityCard from "@/components/shared/IdentityCard";

async function payrollApi(payload) {
  const res = await base44.functions.invoke("payroll", payload);
  return res?.data ?? res;
}

function profileOf(employee) {
  return employee?.profile || {};
}

function wpsLineFrom(item, employee) {
  const profile = profileOf(employee);
  const base = Number(item.base) || 0;
  const allowances = Number(item.allowances) || 0;
  return {
    employeeId: item.employeeId,
    employeeName: employee?.name || item.employeeName || "",
    nationalId: profile.nationalId || employee?.nationalId || "",
    iban: profile.iban || "",
    netPay: netOf(item),
    base,
    allowances,
    qiwaWage: item.qiwaWage != null ? item.qiwaWage : base + allowances,
  };
}

function rowBlockers(row, ar) {
  return wpsRowBlockers(row, ar);
}

const headStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.3fr) 110px 150px 100px minmax(160px,1.4fr)",
  gap: 12,
  padding: "11px 18px",
  background: SURFACE,
  borderBottom: "1px solid #E2E8F0",
  fontSize: 10,
  color: MUTED,
  fontWeight: 600,
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.3fr) 110px 150px 100px minmax(160px,1.4fr)",
  gap: 12,
  padding: "12px 18px",
  borderBottom: "1px solid #F1F5F9",
  alignItems: "center",
};

export default function PayrollWpsBoard({
  month,
  lang = "ar",
  items = [],
  employeeForItem,
  onBackToRun,
  onMeta,
}) {
  const ar = lang === "ar";
  const { company } = useAuth();
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!company?.id) return;
    try {
      const remote = await payrollApi({ action: "list", companyId: company.id, month });
      setRun(remote?.run || null);
      onMeta?.({
        status: remote?.run?.status || "",
        wps: remote?.run?.wps || null,
        heads: remote?.run?.totals?.heads || 0,
      });
    } catch {
      setRun(null);
    }
  };

  useEffect(() => { load(); }, [company?.id, month]);

  const lines = items.map((item) => wpsLineFrom(item, employeeForItem?.(item)));
  const rows = buildWpsFileRows(lines);
  const fileGate = checkWpsFileGate(rows);
  const readyCount = rows.filter((row) => rowBlockers(row, ar).length === 0).length;
  const blockedCount = rows.length - readyCount;
  const deadline = wpsDeadline(month);
  const late = isWpsLate(month);
  const approved = run?.status === "approved" || run?.status === "sent";
  const sent = run?.status === "sent" || !!run?.wpsSentAt;

  const sendWps = async () => {
    if (!run) {
      toast({
        description: ar ? "لا مسير على الخادم لهذا الشهر — جهّزه من تبويب المسير أولًا." : "No server run for this month — prepare it from the Run tab first.",
        variant: "destructive",
      });
      return;
    }
    if (!fileGate.ok) {
      toast({ description: ar ? fileGate.reason : fileGate.reasonEn, variant: "destructive" });
      return;
    }
    const gate = checkSendWpsGate(run);
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const remote = await payrollApi({ action: "sendWps", companyId: company.id, month });
      if (remote?.error) {
        toast({
          description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.reason || remote.error),
          variant: "destructive",
        });
      } else {
        toast({
          description: ar
            ? (late ? "أُنشئ ملف مدى بعد المهلة النظامية — راجِع البنك." : "أُنشئ ملف حماية الأجور. الإرسال الحي لمدى مؤجّل حتى الاعتمادات الرسمية.")
            : (late ? "Mudad file built after the statutory deadline — review with the bank." : "Wage-protection file built. Live Mudad send waits for official credentials."),
        });
        if (remote.run) {
          setRun(remote.run);
          onMeta?.({ status: remote.run.status, wps: remote.run.wps, heads: remote.run.totals?.heads || 0 });
        }
      }
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const statusChip = sent
    ? { label: ar ? "أُنشئ الملف" : "File built", style: OK }
    : approved
      ? { label: ar ? "جاهز بعد الاعتماد" : "Ready after approval", style: WARN }
      : { label: ar ? "بانتظار اعتماد المسير" : "Awaiting run approval", style: NEUTRAL };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }} dir={ar ? "rtl" : "ltr"}>
      <IdentityCard
        icon={ShieldCheck}
        kicker={ar ? "حماية الأجور" : "Wage protection"}
        title={ar ? "مدى" : "Mudad"}
        subtitle={ar
          ? "الصف جاهز عند اكتمال الهوية والآيبان وتطابق أجر قوى والصافي الموجب. الإرسال الحي مؤجّل حتى الاعتمادات الرسمية."
          : "A row is ready when national ID, IBAN, Qiwa wage match and a positive net are complete. Live send waits for official credentials."}
        rail={late ? "#B45309" : sent ? ACCENT : NAVY}
        meta={<span style={{ ...statusChip.style, borderRadius: 8 }}>{statusChip.label}</span>}
      >

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {[
            { label: ar ? "مهلة الإيداع" : "Deposit deadline", value: deadline || "—", hint: late ? (ar ? "متأخر" : "Late") : (ar ? "30 يوماً من نهاية شهر الاستحقاق" : "30 days from end of entitlement month"), warn: late },
            { label: ar ? "صفوف جاهزة" : "Ready rows", value: `${readyCount}/${rows.length}` },
            { label: ar ? "موقوف" : "Blocked", value: String(blockedCount), warn: blockedCount > 0 },
          ].map((card) => (
            <div key={card.label} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", background: CARD }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: "0.04em" }}>{card.label}</p>
              <p dir="ltr" style={{ margin: "8px 0 0", fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 18, fontWeight: 600, color: card.warn ? "#B45309" : NAVY, textAlign: "start" }}>
                {card.value}
              </p>
              {card.hint && (
                <p style={{ margin: "4px 0 0", fontSize: 10, color: card.warn ? "#B45309" : MUTED }}>{card.hint}</p>
              )}
            </div>
          ))}
        </div>

        {!approved && (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={WARN}>{ar ? "لا ملف مدى قبل اعتماد المسير" : "No Mudad file before run approval"}</span>
            {onBackToRun && (
              <button type="button" onClick={onBackToRun} style={ui.btnSecondary}>
                {ar ? "العودة للاعتماد" : "Back to approval"}
              </button>
            )}
          </div>
        )}

        {approved && !fileGate.ok && (
          <p style={{ margin: "14px 0 0", fontSize: 12, color: "#B45309", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
            {ar ? fileGate.reason : fileGate.reasonEn}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button
            type="button"
            disabled={busy || sent || !approved || !fileGate.ok}
            onClick={sendWps}
            style={{
              ...ui.btnPrimary,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: busy || sent || !approved || !fileGate.ok ? 0.45 : 1,
            }}
          >
            {busy ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />}
            {sent
              ? (ar ? "أُنشئ ملف حماية الأجور" : "Wage-protection file built")
              : (ar ? "إنشاء ملف مدى" : "Build the Mudad file")}
          </button>
          <Link to="/app/hr" style={{ fontSize: 12, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>
            {ar ? "مركز الامتثال — قوى والتأمينات" : "Compliance centre — Qiwa and GOSI"}
          </Link>
        </div>
      </IdentityCard>

      <IdentityCard
        icon={ListChecks}
        kicker={ar ? "الصفوف" : "Rows"}
        title={ar ? "جاهزية صف مدى" : "Mudad-row readiness"}
        subtitle={ar ? "الهوية · الآيبان · تطابق قوى · الصافي" : "ID · IBAN · Qiwa match · net"}
        bodyStyle={{ padding: 0 }}
      >
        {rows.length === 0 ? (
          <p style={{ margin: "24px 18px", textAlign: "center", fontSize: 13, color: MUTED }}>
            {ar ? "لا بنود في هذا النطاق — جهّز المسير أولًا." : "No lines in this scope — prepare the run first."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 720 }}>
              <div style={headStyle}>
                <div>{ar ? "الموظف" : "Employee"}</div>
                <div>{ar ? "الهوية" : "ID"}</div>
                <div>{ar ? "آيبان" : "IBAN"}</div>
                <div>{ar ? "الصافي" : "Net"}</div>
                <div>{ar ? "البوابة" : "Gate"}</div>
              </div>
              {rows.map((row) => {
                const blockers = rowBlockers(row, ar);
                const ready = blockers.length === 0;
                return (
                  <div key={row.employeeId} style={rowStyle}>
                    <EmployeeIdentityRow
                      employee={employeeForItem?.({ employeeId: row.employeeId })}
                      employeeId={row.employeeId}
                      name={row.employeeName || "—"}
                      showId={false}
                      compact
                    />
                    <span dir="ltr" style={{ fontSize: 12, color: row.nationalId ? NAVY : MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                      {row.nationalId || "—"}
                    </span>
                    <span dir="ltr" style={{ fontSize: 12, color: row.iban ? NAVY : MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                      {row.iban ? `${row.iban.slice(0, 4)}…${row.iban.slice(-4)}` : "—"}
                    </span>
                    <span dir="ltr" style={{ fontSize: 12, fontWeight: 600, color: NAVY, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                      {Number(row.netPay || 0).toLocaleString("en-US")}
                    </span>
                    <span style={ready ? OK : BAD}>
                      {ready ? (ar ? "ملف جاهز" : "File ready") : blockers[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </IdentityCard>
    </section>
  );
}
