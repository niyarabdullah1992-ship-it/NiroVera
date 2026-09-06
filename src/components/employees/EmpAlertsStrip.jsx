import React, { useMemo } from "react";
import { OK, WARN, BAD } from "@/lib/platformStyles";
import { checkContractTermGate, EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";
import { deriveProbationProgress, deriveArt55Conversion } from "@/lib/contractLawDerivations";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

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

const EXPIRY_FIELDS = [
  { keys: ["idExpiry", "iqamaExpiry"], ar: "انتهاء الهوية / الإقامة", en: "ID / Iqama expiry" },
  { keys: ["workPermitExpiry"], ar: "انتهاء رخصة العمل", en: "Work permit expiry" },
  { keys: ["passportExpiry"], ar: "انتهاء الجواز", en: "Passport expiry" },
  { keys: ["medicalInsuranceExpiry"], ar: "انتهاء التأمين الطبي", en: "Medical insurance expiry" },
];

/** Platform emp alerts — L2648–2661 «يحتاج تجديدًا». */
export default function EmpAlertsStrip({ employee, lang = "ar" }) {
  const ar = lang === "ar";
  const profile = employee?.profile || {};

  const alerts = useMemo(() => {
    const rows = [];
    for (const field of EXPIRY_FIELDS) {
      const iso = field.keys.map((k) => profile[k]).find(Boolean);
      if (!iso) continue;
      const chip = expiryChip(iso, ar);
      if (!chip) continue;
      if (chip.text === (ar ? "ساري" : "Valid")) continue;
      rows.push({
        label: ar ? field.ar : field.en,
        value: niceDate(iso, ar),
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
    <div style={{
      background: "#FFFBEB",
      border: "1px solid #FDE68A",
      borderRadius: "14px",
      padding: "16px 18px",
    }}
      dir={ar ? "rtl" : "ltr"}
    >
      <div style={{ fontSize: "13px", fontWeight: 600, color: "#B45309" }}>
        {ar ? "يحتاج تجديدًا" : "Needs renewal"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginTop: "12px" }}>
        {alerts.map((a) => (
          <div
            key={`${a.label}-${a.value}`}
            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 200px", fontSize: "13px", color: "#78350F" }}>{a.label}</span>
              <span style={{ fontSize: "12px", color: "#92400E" }}>{a.value}</span>
              <span style={a.chipStyle}>{a.chipText}</span>
            </div>
            {a.ruleId ? <LaborArticleCite ruleId={a.ruleId} ar={ar} showText /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
