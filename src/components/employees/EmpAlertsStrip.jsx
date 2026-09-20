import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { OK, WARN, BAD } from "@/lib/platformStyles";
import { checkContractTermGate, collectEmployeeValidityDocs, EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";
import { deriveProbationProgress, deriveArt55Conversion } from "@/lib/contractLawDerivations";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { nightRotateStage, pendingNightRotate } from "@/lib/nightRotateCycle";
import { annualEntitlementDue } from "@/lib/leaveEntitlementCycle";
import { employeeFileVoice } from "@/lib/employeeFileView";

function daysTo(iso) {
  if (!iso) return null;
  const d = Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00`) - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

function expiryChip(iso, ar) {
  const d = daysTo(iso);
  if (d === null) return null;
  if (d < 0) return { text: ar ? "منتهٍ" : "Expired", style: BAD };
  if (d <= EXPIRY_WARN_DAYS) return { text: ar ? `${d} يومًا` : `${d} days`, style: WARN };
  return { text: ar ? "ساري" : "Valid", style: OK };
}

function niceDate(iso, ar) {
  if (!iso) return "—";
  try {
    return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(
      ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
      { year: "numeric", month: "short", day: "numeric" },
    );
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Platform emp alerts — L2648–2661 «يحتاج تجديدًا». Same dated-doc collector as ministry alerts. */
export default function EmpAlertsStrip({ employee, currentUser, lang = "ar" }) {
  const ar = lang === "ar";
  const profile = employee?.profile || {};
  const voice = employeeFileVoice({ employee, currentUser, ar });

  const alerts = useMemo(() => {
    const rows = [];
    for (const doc of collectEmployeeValidityDocs(employee)) {
      const chip = expiryChip(doc.expiryDate, ar);
      if (!chip) continue;
      if (chip.text === (ar ? "ساري" : "Valid")) continue;
      rows.push({
        label: ar ? doc.docLabelAr : doc.docLabelEn,
        value: niceDate(doc.expiryDate, ar),
        chipText: chip.text,
        chipStyle: chip.style,
      });
    }
    const term = checkContractTermGate(employee);
    if (term.error === "CONTRACT_END_REQUIRED" || term.error === "CONTRACT_NONSAUDI_FIXED_REQUIRED") {
      rows.push({
        label: ar ? "العقد محدد المدة" : "Fixed-term contract",
        value: ar ? (term.reason || "يحتاج تصحيحاً") : (term.reasonEn || "Needs correction"),
        chipText: ar ? "موقوف" : "Blocked",
        chipStyle: BAD,
        ruleId: term.error === "CONTRACT_NONSAUDI_FIXED_REQUIRED" ? "contract.nonSaudi.fixed.cite" : "contract.fixed.cite",
      });
    } else if (term.warning === "ART55_CONVERTED") {
      rows.push({
        label: ar ? "المادة 55" : "Article 55",
        value: ar ? (term.reason || "يُعد غير محدد المدة") : (term.reasonEn || "Deemed indefinite"),
        chipText: ar ? "يُكتب في الملف" : "Written to file",
        chipStyle: WARN,
        ruleId: "contract.fixed.continuation.cite",
      });
    } else if (term.error === "CONTRACT_EXPIRED" || term.warning === "CONTRACT_EXPIRING" || term.warning === "CONTRACT_TERM_DEEMED_YEAR") {
      const contractEnd = profile.contract?.endDate || profile.contractEndDate || term.endDate;
      rows.push({
        label: ar ? "انتهاء العقد" : "Contract end",
        value: niceDate(contractEnd, ar),
        chipText: term.error === "CONTRACT_EXPIRED"
          ? (ar ? "منتهٍ" : "Expired")
          : term.warning === "CONTRACT_TERM_DEEMED_YEAR"
            ? (ar ? "سنة مفترضة" : "Deemed year")
            : (ar ? `${term.days} يومًا` : `${term.days} days`),
        chipStyle: term.error === "CONTRACT_EXPIRED" ? BAD : WARN,
        ruleId: term.warning === "CONTRACT_TERM_DEEMED_YEAR" ? "contract.nonSaudi.deemedTermDays" : "contract.fixed.cite",
      });
    }
    const probation = deriveProbationProgress(employee);
    if (probation.warning === "PROBATION_ENDING" || probation.warning === "PROBATION_ENDED") {
      rows.push({
        label: ar ? "فترة التجربة" : "Probation",
        value: probation.warning === "PROBATION_ENDED"
          ? (ar ? "انتهت" : "Ended")
          : (ar ? `${probation.remaining} يومًا` : `${probation.remaining} days`),
        chipText: probation.warning === "PROBATION_ENDED" ? (ar ? "انتهت" : "Ended") : (ar ? "تنبيه 15 يوماً" : "15-day watch"),
        chipStyle: probation.warning === "PROBATION_ENDED" ? BAD : WARN,
        ruleId: "contract.probation.warnDays",
      });
    }
    const nightPending = pendingNightRotate(employee);
    if (nightPending) {
      const stage = nightRotateStage(nightPending);
      rows.push({
        label: ar ? "موافقة العمل الليلي" : "Night-work consent",
        value: ar ? "سارية حتى تختار: موافقة أو تقليص ساعات أو تدوير" : "In force until you choose: consent, reduced hours, or rotation",
        chipText: stage === "active" ? (ar ? "سارية" : "In force") : (ar ? "سارية" : "In force"),
        chipStyle: BAD,
        href: "/app/requests",
        ruleId: "hours.night.rotateWeeks",
      });
    }
    const leaveDue = annualEntitlementDue(employee);
    if (leaveDue.due || leaveDue.reason === "notified") {
      rows.push({
        label: ar ? "الإجازة السنوية المستحقة" : "Annual leave entitlement",
        value: leaveDue.kind === "year_end" || String(leaveDue.noticeKey || "").endsWith("year_end")
          ? (ar ? `${leaveDue.remaining} يوماً متبقية قبل نهاية سنة الاستحقاق` : `${leaveDue.remaining} days left before the entitlement year ends`)
          : (ar ? `سنة الاستحقاق بدأت — رصيد ${leaveDue.remaining} يوماً` : `Entitlement year started — ${leaveDue.remaining} days`),
        chipText: ar ? "المادة 109" : "Art. 109",
        chipStyle: WARN,
        href: "/app/requests",
        ruleId: "leave.annual.days",
      });
    }
    const art55 = deriveArt55Conversion(employee);
    if (art55.converts && term.warning !== "ART55_CONVERTED") {
      rows.push({
        label: ar ? "المادة 55" : "Article 55",
        value: ar ? (art55.reason || "يُعد غير محدد المدة") : (art55.reasonEn || "Deemed indefinite"),
        chipText: ar ? "يُكتب في الملف" : "Written to file",
        chipStyle: BAD,
        ruleId: "contract.fixed.continuation.cite",
      });
    } else if (art55.approaching) {
      rows.push({
        label: ar ? "المادة 55" : "Article 55",
        value: ar ? "اقتراب حد التجديد أو الأربع سنوات" : "Near the renewal or four-year cap",
        chipText: ar ? "متابعة" : "Watch",
        chipStyle: WARN,
        ruleId: "contract.fixed.continuation.cite",
      });
    }
    return rows;
  }, [employee, profile, ar]);

  if (!alerts.length) return null;

  return (
    <section
      className="nv-file-card"
      style={{
        background: "#FDF6E8",
        border: "1px solid #ECD9A8",
        borderTop: "3px solid var(--nv-warn-fill, #D97706)",
        borderRadius: 14,
        boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
        padding: "13px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
      }}
      dir={ar ? "rtl" : "ltr"}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: "#8A6516" }}>
        {voice.warnings}
      </span>
      {alerts.map((a) => (
        <div key={`${a.label}-${a.value}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "6px minmax(0,1fr) auto", gap: 11, alignItems: "start" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.chipStyle?.color || "#8A6516", marginTop: 6 }} />
            {a.href ? (
              <Link to={a.href} style={{ fontSize: 11, color: "#3C4657", lineHeight: 1.85, minWidth: 0, fontWeight: 600 }}>
                {a.label} — {a.value}
              </Link>
            ) : (
              <span style={{ fontSize: 11, color: "#3C4657", lineHeight: 1.85, minWidth: 0 }}>{a.label} — {a.value}</span>
            )}
            <span style={{ fontSize: 10, fontWeight: 600, color: a.chipStyle?.color || "#8A6516", whiteSpace: "nowrap" }}>{a.chipText}</span>
          </div>
          {a.ruleId ? <LaborArticleCite ruleId={a.ruleId} ar={ar} /> : null}
        </div>
      ))}
    </section>
  );
}
