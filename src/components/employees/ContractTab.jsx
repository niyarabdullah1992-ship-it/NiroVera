import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import ContractForm from "@/components/employees/ContractForm";
import { BORDER, MUTED, NAVY, OK, WARN, BAD, SURFACE, ui } from "@/lib/platformStyles";
import { CONTRACT_TYPE_OPTIONS, isFixedContractType, optionLabel } from "@/lib/employeeProfileFields";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { FileText } from "lucide-react";
import { EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";
import { deriveArt55Conversion } from "@/lib/contractLawDerivations";
import { applyDueLaborRules } from "@/lib/store";
import PolicyDeviationAlert from "@/components/shared/PolicyDeviationAlert";

const PDF_CHIP = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 9px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: 600,
  background: "#FEF2F2",
  color: "#DC2626",
  border: "1px solid #FECACA",
  flexShrink: 0,
};

function daysTo(iso) {
  if (!iso) return null;
  const d = Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00`) - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

function expiryChip(iso, ar) {
  const d = daysTo(iso);
  if (d === null) return { text: ar ? "مفتوح" : "Open-ended", style: OK };
  if (d < 0) return { text: ar ? "منتهٍ" : "Expired", style: BAD };
  if (d <= EXPIRY_WARN_DAYS) return { text: ar ? `${d} يومًا` : `${d} days`, style: WARN };
  return { text: ar ? "ساري" : "Valid", style: OK };
}

function niceDate(iso, ar) {
  if (!iso) return "";
  try {
    return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(
      ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
      { year: "numeric", month: "short", day: "numeric" },
    );
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Platform isTabContract — L2741–2762 */
export default function ContractTab({ employee, companyId, canEdit }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const profile = employee.profile || {};
  const contract = profile.contract;
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ContractForm employee={employee} companyId={companyId} contract={contract} ar={ar} onDone={() => setEditing(false)} />;
  }

  const typeRaw = contract?.type || profile.contractType || "";
  const type = optionLabel(CONTRACT_TYPE_OPTIONS, typeRaw, ar) || typeRaw || "—";
  const start = contract?.startDate || profile.hireDate || "";
  const end = contract?.endDate || "";
  const endChip = end ? expiryChip(end, ar) : { text: ar ? "مفتوح" : "Open-ended", style: OK };
  const qiwa = profile.qiwaRegistered === false
    ? (ar ? "لا" : "No")
    : (ar ? "نعم · مسجَّل في الملف" : "Yes · recorded in file");
  const probation = Boolean(profile.probation);

  const rows = [
    { label: ar ? "نوع العقد" : "Contract type", value: type || "—", chipText: "", chipStyle: null },
    ...(probation ? [{
      label: ar ? "فترة التجربة" : "Probation",
      value: ar ? "طبقة على العقد — ليست نوعاً ثالثاً. غير السعودي يبقى محدد المدة (المادة 37)." : "Overlay on the contract — not a third type. A non-Saudi file stays fixed-term (Article 37).",
      chipText: ar ? "تجربة" : "Probation",
      chipStyle: WARN,
    }] : []),
    { label: ar ? "تاريخ البداية" : "Start date", value: start ? niceDate(start, ar) : "—", chipText: "", chipStyle: null },
    {
      label: ar ? "تاريخ النهاية" : "End date",
      value: end ? niceDate(end, ar) : (ar ? "غير محدد" : "Not set"),
      chipText: endChip.text,
      chipStyle: endChip.style,
    },
    { label: ar ? "مسجَّل في قوى" : "Registered in Qiwa", value: qiwa, chipText: "", chipStyle: null },
  ];

  const fileName = contract?.fileName
    || (contract?.fileUrl ? (ar ? "عقد العمل الموقّع.pdf" : "Signed employment contract.pdf") : null);

  const typeRuleId = isFixedContractType(typeRaw)
    ? "contract.fixed.cite"
    : (typeRaw ? "contract.indefinite.cite" : null);
  const art55 = deriveArt55Conversion(employee);
  const renewals = profile.contractRenewalCount ?? contract?.renewalCount;
  const appliedAt = profile.art55AppliedAt;

  useEffect(() => {
    if (!canEdit || !companyId || !employee?.id || !art55.converts) return;
    applyDueLaborRules(companyId, employee.id);
  }, [canEdit, companyId, employee?.id, art55.converts]);

  return (
    <IdentityCard
      icon={FileText}
      kicker={ar ? "عقد مكتوب" : "Written contract"}
      title={ar ? "عقد العمل" : "Employment contract"}
      subtitle={ar
        ? "نوع العقد يستشهد بالمادة 75 أو 55. النسخة المكتوبة والتوثيق من المادة 51. نموذج الوزارة من المادة 52."
        : "Contract type cites Article 75 or 55. The written copy and documentation are Article 51. The Ministry model is Article 52."}
      meta={<LaborArticleCite ruleId={typeRuleId || "contract.written.cite"} ar={ar} />}
      dir={ar ? "rtl" : "ltr"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: 12 }}>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={ui.btnGhost}
          >
            {contract?.fileUrl ? (ar ? "تحديث العقد" : "Update contract") : (ar ? "رفع عقد" : "Upload contract")}
          </button>
        ) : (
          <span style={{ fontSize: "10px", color: MUTED }}>{ar ? "للإدارة فقط" : "Management only"}</span>
        )}
      </div>
      {typeRuleId ? <div style={{ marginBottom: 14 }}><LaborArticleCite ruleId={typeRuleId} ar={ar} showText /></div> : null}
      <LaborArticleCite ruleId="contract.written.cite" ar={ar} showText />
      <LaborArticleCite ruleId="contract.model.cite" ar={ar} showText />
      {probation ? <LaborArticleCite ruleId="contract.probation.excludeOfficialHolidays.cite" ar={ar} showText /> : null}
      {profile.workPattern === "flexible" ? (
        <>
          <LaborArticleCite ruleId="contract.pattern.flexible.cite" ar={ar} showText />
          <LaborArticleCite ruleId="contract.pattern.flexible.nitaqatHours" ar={ar} showText />
        </>
      ) : null}
      {profile.workPattern === "part_time" ? <LaborArticleCite ruleId="contract.pattern.partTime.cite" ar={ar} showText /> : null}
      {(profile.workPattern === "temporary" || profile.workPattern === "seasonal") ? <LaborArticleCite ruleId="contract.casual.maxDays" ar={ar} showText /> : null}
      {(isFixedContractType(typeRaw) || appliedAt || art55.converts || art55.approaching) ? (
        <div style={{ marginTop: 14 }}>
          <LaborArticleCite ruleId="contract.fixed.continuation.cite" ar={ar} showText />
          {renewals != null && String(renewals) !== "" ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>
              {ar ? `تجديدات مسجّلة: ${renewals}` : `Recorded renewals: ${renewals}`}
            </p>
          ) : null}
          {art55.converts ? (
            <div style={{ marginTop: 10 }}>
              <PolicyDeviationAlert gate={{ ok: false, reason: art55.reason, reasonEn: art55.reasonEn, cite: art55.cite }} ruleId="contract.fixed.continuation.cite" ar={ar} />
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => applyDueLaborRules(companyId, employee.id)}
                  style={{ ...ui.btnGhost, marginTop: 8 }}
                >
                  {ar ? "تطبيق المادة 55 على الملف" : "Apply Article 55 to the file"}
                </button>
              ) : null}
            </div>
          ) : art55.approaching ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#B45309", lineHeight: 1.65 }}>
              {ar
                ? "المادة 55 قريبة: ثلاثة تجديدات أو أربع سنوات ثم الاستمرار يحوّل العقد إلى غير محدد المدة."
                : "Article 55 is near: three renewals or four years, then continuing, converts the contract to indefinite."}
            </p>
          ) : appliedAt ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
              {ar
                ? `طُبّقت المادة 55 في ${appliedAt} — النوع في الملف غير محدد المدة.`
                : `Article 55 was applied on ${appliedAt} — the file type is indefinite.`}
            </p>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "14px", marginTop: "18px" }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ fontSize: "11px", color: MUTED }}>{r.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
              <span style={{ flex: 1, fontSize: "13px", color: NAVY }}>{r.value}</span>
              {r.chipText ? <span style={r.chipStyle}>{r.chipText}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {fileName ? (
        <a
          href={contract.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "18px",
            padding: "12px 14px",
            borderRadius: "11px",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            textDecoration: "none",
          }}
        >
          <span style={PDF_CHIP}>PDF</span>
          <span style={{ flex: 1, fontSize: "13px", color: NAVY }}>{fileName}</span>
        </a>
      ) : (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginTop: "18px",
          padding: "12px 14px",
          borderRadius: "11px",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
        }}
        >
          <span style={PDF_CHIP}>PDF</span>
          <span style={{ flex: 1, fontSize: "13px", color: MUTED }}>
            {ar ? "لا يوجد عقد مرفوع بعد" : "No contract uploaded yet"}
          </span>
        </div>
      )}
    </IdentityCard>
  );
}
