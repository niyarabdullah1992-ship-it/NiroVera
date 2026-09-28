import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDate } from "@/lib/dateFormat";
import { netOf } from "@/lib/payroll";
import {
  checkSendWpsGate,
  isWpsLate,
  wpsDeadline,
} from "@/lib/payrollDerivations";
import { buildWpsFileRows, checkWpsFileGate, wpsRowBlockers } from "@/lib/complianceDerivations";
import { localPayrollAction } from "@/lib/localPayrollFallback";
import { toast } from "@/components/ui/use-toast";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { MUTED, NAVY, OK, WARN, BAD, NEUTRAL, ui, CARD, SURFACE } from "@/lib/platformStyles";

async function payrollApi(payload) {
  const res = await base44.functions.invoke("payroll", payload);
  const data = res?.data ?? res;
  // Preview answers this function without running it; without the local mirror the
  // board reported "no server run" for a run that exists, and the build did nothing.
  if (data?.localPreview) return localPayrollAction(payload) || data;
  return data;
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
    // Never invented: an unknown contract wage is an unmatched row, and the row has to
    // say so rather than show "file ready" for something the build gate will refuse.
    qiwaWage: item.qiwaWage != null ? item.qiwaWage : null,
  };
}

function rowBlockers(row, ar) {
  return wpsRowBlockers(row, ar);
}

const COLUMNS = "minmax(140px,1.3fr) 120px 160px 120px minmax(190px,1.5fr)";

const headStyle = {
  display: "grid",
  gridTemplateColumns: COLUMNS,
  gap: 12,
  padding: "11px 18px",
  background: SURFACE,
  borderBottom: "1px solid var(--nv-line)",
  fontSize: 10,
  color: MUTED,
  fontWeight: 600,
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: COLUMNS,
  gap: 12,
  padding: "12px 18px",
  borderBottom: "1px solid var(--nv-line)",
  alignItems: "start",
};

const monoStyle = { fontSize: 12, fontFamily: "'IBM Plex Sans',sans-serif" };

/** Blocked rows first, the most blocked before the least, then the ready ones — the
 *  order the hiring gaps sheet uses, so the one row holding up the file is never buried. */
function sortByBlockers(entries, ar) {
  return [...entries].sort((a, b) =>
    b.blockers.length - a.blockers.length
    || String(a.row.employeeName || "").localeCompare(String(b.row.employeeName || ""), ar ? "ar" : "en"));
}

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
  // The five-column row needs 720px; below that it folded off-screen behind a horizontal
  // scrollbar, taking the readiness column — the one that says what to do — with it.
  const narrow = useIsMobile();

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
  const entries = sortByBlockers(rows.map((row) => ({ row, blockers: rowBlockers(row, ar) })), ar);
  const readyCount = entries.filter((entry) => entry.blockers.length === 0).length;
  const blockedCount = entries.length - readyCount;
  // The header carries the news, not a neutral tally: what stands between today and a
  // buildable file.
  const readiness = blockedCount === 0
    ? (ar ? "كل الصفوف جاهزة — الملف قابل للبناء" : "Every row is ready — the file can be built")
    : blockedCount === 1
      ? (ar ? "صفّ واحد يمنع بناء الملف" : "One row blocks the file build")
      : (ar ? `${blockedCount} صفوف تمنع بناء الملف` : `${blockedCount} rows block the file build`);
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
        } else if (remote.localApplied) {
          await load();
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
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={statusChip.style}>{statusChip.label}</span>
        {!approved && onBackToRun ? (
          <button type="button" onClick={onBackToRun} style={ui.btnSecondary}>
            {ar ? "العودة للاعتماد" : "Back to approval"}
          </button>
        ) : null}
      </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div className="nv-paper" style={{ border: "1px solid var(--nv-line)", padding: "14px 16px", background: CARD }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: "0.04em" }}>{ar ? "مهلة الإيداع" : "Deposit deadline"}</p>
            <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 600, color: late ? "var(--nv-warn-ink)" : NAVY }}>
              {deadline ? formatDate(deadline, lang, { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </p>
            {late && <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--nv-warn-ink)" }}>{ar ? "متأخر" : "Late"}</p>}
          </div>
          <div className="nv-paper" style={{ border: "1px solid var(--nv-line)", padding: "14px 16px", background: CARD }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: "0.04em" }}>{ar ? "جاهزية الصفوف" : "Row readiness"}</p>
            <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 600, color: blockedCount ? "var(--nv-warn-ink)" : NAVY, lineHeight: 1.5 }}>
              {rows.length ? readiness : (ar ? "لا صفوف بعد" : "No rows yet")}
            </p>
            {rows.length > 0 && (
              <p dir="ltr" style={{ margin: "4px 0 0", fontSize: 10, color: MUTED, textAlign: "start" }}>{`${readyCount}/${rows.length}`}</p>
            )}
          </div>
        </div>

        {approved && !fileGate.ok && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nv-warn-ink)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
            {ar ? fileGate.reason : fileGate.reasonEn}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
        </div>

        {rows.length === 0 ? (
          <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: MUTED }}>
            {ar ? "لا بنود في هذا النطاق — جهّز المسير أولًا." : "No lines in this scope — prepare the run first."}
          </p>
        ) : (
          <div>
            {!narrow && (
              <div style={headStyle}>
                <div>{ar ? "الموظف" : "Employee"}</div>
                <div>{ar ? "الهوية" : "ID"}</div>
                <div>{ar ? "آيبان" : "IBAN"}</div>
                <div>{ar ? "الصافي المحوَّل" : "Net transferred"}</div>
                <div>{ar ? "الجاهزية" : "Readiness"}</div>
              </div>
            )}
            {entries.map(({ row, blockers }) => {
              const ready = blockers.length === 0;
              const identity = (
                <EmployeeIdentityRow
                  employee={employeeForItem?.({ employeeId: row.employeeId })}
                  employeeId={row.employeeId}
                  name={row.employeeName || "—"}
                  showId={false}
                  compact
                />
              );
              const nationalId = (
                <span dir="ltr" style={{ ...monoStyle, color: row.nationalId ? NAVY : MUTED }}>{row.nationalId || "—"}</span>
              );
              const iban = (
                <span dir="ltr" style={{ ...monoStyle, color: row.iban ? NAVY : MUTED }}>
                  {row.iban ? `${row.iban.slice(0, 4)}…${row.iban.slice(-4)}` : "—"}
                </span>
              );
              const net = (
                <span dir="ltr" style={{ ...monoStyle, fontWeight: 600, color: NAVY }}>
                  {Number(row.netPay || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
              );
              // A ready row asks for nothing, so it keeps no fill and no border; the
              // saturation belongs to the rows that hold the file back, and every reason
              // is named — fixing the first one used to leave the row blocked again.
              const readiness = ready ? (
                <span style={{ fontSize: 12, color: MUTED }}>{ar ? "جاهز" : "Ready"}</span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "start", gap: 6 }}>
                  {blockers.map((blocker) => (
                    <span key={blocker} style={BAD}>{blocker}</span>
                  ))}
                  <Link
                    to={`/app/employees/${encodeURIComponent(row.employeeId)}`}
                    style={{ ...ui.btnRow, display: "inline-block", textDecoration: "none" }}
                  >
                    {ar ? "أصلِح في ملف الموظف" : "Fix in the employee file"}
                  </Link>
                </div>
              );

              if (narrow) {
                return (
                  <div
                    key={row.employeeId}
                    style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--nv-line)" }}
                  >
                    {identity}
                    <div style={{ display: "grid", gap: 6 }}>
                      {[
                        [ar ? "الهوية" : "ID", nationalId],
                        [ar ? "آيبان" : "IBAN", iban],
                        [ar ? "الصافي المحوَّل" : "Net transferred", net],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
                          {value}
                        </div>
                      ))}
                    </div>
                    {readiness}
                  </div>
                );
              }

              return (
                <div key={row.employeeId} style={rowStyle}>
                  {identity}
                  {nationalId}
                  {iban}
                  {net}
                  {readiness}
                </div>
              );
            })}
            <p style={{ margin: "10px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
              {ar
                ? "الصافي المحوَّل هو نفسه رقم القسيمة: الأساسي والبدلات والمكافأة + الأجر الإضافي المعتمد − الخصومات الموثّقة − حصة التأمينات."
                : "Net transferred is the payslip figure: base, allowances and bonus + approved overtime − documented deductions − the GOSI employee share."}
            </p>
          </div>
        )}
    </section>
  );
}
