import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { updateEmployeeProfile } from "@/lib/store";
import { Loader2, Save, FileText } from "lucide-react";
import {
  CONTRACT_TYPE_OPTIONS,
  canonicalFieldValue,
  isFixedContractType,
} from "@/lib/employeeProfileFields";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { MUTED, NAVY_FILL, field, ui } from "@/lib/platformStyles";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { checkContractTermGate, nationalityIsSaudi } from "@/lib/complianceDerivations";
import { WORK_PATTERN_OPTIONS, workPatternForcesFixed } from "@/lib/contractLawDerivations";

export default function ContractForm({ employee, companyId, contract, ar, onDone }) {
  const [file, setFile] = useState(null);
  const [contractType, setContractType] = useState(
    canonicalFieldValue(
      { options: "contractType" },
      contract?.type || employee?.profile?.contractType || "indefinite",
    ) || "indefinite",
  );
  const [startDate, setStartDate] = useState(contract?.startDate || employee?.profile?.hireDate || "");
  const [endDate, setEndDate] = useState(contract?.endDate || "");
  const [workPattern, setWorkPattern] = useState(contract?.workPattern || employee?.profile?.workPattern || "ordinary");
  const [renewalCount, setRenewalCount] = useState(
    String(contract?.renewalCount ?? employee?.profile?.contractRenewalCount ?? ""),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nonSaudi = nationalityIsSaudi(employee?.nationality || employee?.profile?.nationality) === false;
  const fixed = nonSaudi || workPatternForcesFixed(workPattern) || isFixedContractType(contractType);
  const hasExisting = Boolean(contract?.fileUrl);
  const typeRuleId = nonSaudi ? "contract.nonSaudi.fixed.cite" : (fixed ? "contract.fixed.cite" : "contract.indefinite.cite");
  const liveTermGate = checkContractTermGate({
    contractType: fixed ? "fixed" : contractType,
    contractEndDate: fixed ? endDate : "",
    hireDate: startDate,
    nationality: employee?.nationality || employee?.profile?.nationality,
    nationalId: employee?.nationalId || employee?.profile?.nationalId,
    profile: employee?.profile,
  });

  const save = async () => {
    const isPdf = file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!hasExisting && !isPdf) {
      setError(ar ? "ارفع عقد العمل بصيغة PDF." : "Upload the employment contract as a PDF.");
      return;
    }
    if (file && !isPdf) {
      setError(ar ? "الملف يجب أن يكون PDF." : "The file must be a PDF.");
      return;
    }
    if (!startDate) {
      setError(ar ? "أدخل تاريخ بداية العقد." : "Enter the contract start date.");
      return;
    }
    if (fixed && !endDate && !nonSaudi) {
      setError(ar ? "العقد محدد المدة يحتاج تاريخ نهاية (المادة 55)." : "A fixed-term contract needs an end date (Article 55).");
      return;
    }
    if (endDate && endDate < startDate) {
      setError(ar ? "تاريخ النهاية قبل البداية." : "The end date is before the start date.");
      return;
    }
    const termGate = checkContractTermGate({
      contractType: fixed ? "fixed" : contractType,
      contractEndDate: fixed ? endDate : "",
      hireDate: startDate,
      nationality: employee?.nationality || employee?.profile?.nationality,
      nationalId: employee?.nationalId || employee?.profile?.nationalId,
    });
    if (!termGate.ok) {
      setError(ar ? termGate.reason : termGate.reasonEn);
      return;
    }
    setSaving(true);
    try {
      let fileUrl = contract?.fileUrl || "";
      let fileName = contract?.fileName || "";
      if (file) {
        const uploaded = await base44.integrations.Core.UploadFile({ file });
        fileUrl = uploaded.file_url;
        fileName = file.name;
      }
      updateEmployeeProfile(companyId, employee.id, {
        contractType: fixed ? "fixed" : contractType,
        contractEndDate: fixed ? (endDate || termGate.endDate || "") : "",
        workPattern,
        contractRenewalCount: fixed ? (Number(renewalCount) || 0) : "",
        contract: {
          fileUrl,
          fileName,
          startDate,
          endDate: fixed ? (endDate || termGate.endDate || "") : "",
          type: fixed ? "fixed" : contractType,
          workPattern,
          renewalCount: fixed ? (Number(renewalCount) || 0) : 0,
        },
      });
      onDone();
    } catch {
      setError(ar ? "تعذر حفظ العقد. حاول مرة أخرى." : "The contract could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <IdentityCard
      icon={FileText}
      kicker={ar ? "عقد مكتوب" : "Written contract"}
      title={ar ? "عقد العمل — جاهز لملف قوى" : "Employment contract — Qiwa file"}
      subtitle={ar
        ? "يُحفظ في الملف — الإرسال الحي لقوى عند الاعتماد. غير محدد المدة يبقى بلا تاريخ نهاية."
        : "Stored on the file — live Qiwa send waits for credentials. Indefinite contracts stay open-ended."}
      meta={<LaborArticleCite ruleId={typeRuleId} ar={ar} />}
      dir={ar ? "rtl" : "ltr"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <LaborArticleCite ruleId={typeRuleId} ar={ar} showText />
        <LaborArticleCite ruleId="contract.written.cite" ar={ar} showText />
        <label style={{ fontSize: "11px", color: MUTED }}>
          {ar ? "نوع العقد" : "Contract type"}
          <select
            value={nonSaudi ? "fixed" : contractType}
            onChange={(e) => {
              const next = e.target.value;
              setContractType(next);
              if (!isFixedContractType(next) && !nonSaudi && !workPatternForcesFixed(workPattern)) setEndDate("");
              setError("");
            }}
            disabled={nonSaudi}
            style={{ ...field, marginTop: 6 }}
          >
            {CONTRACT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "11px", color: MUTED }}>
          {ar ? "نموذج العقد" : "Contract template"}
          <select
            value={workPattern}
            onChange={(e) => {
              setWorkPattern(e.target.value);
              if (workPatternForcesFixed(e.target.value)) setContractType("fixed");
              setError("");
            }}
            style={{ ...field, marginTop: 6 }}
          >
            {WORK_PATTERN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>
            ))}
          </select>
        </label>
        {workPattern === "flexible" ? (
          <>
            <LaborArticleCite ruleId="contract.pattern.flexible.cite" ar={ar} showText />
            <LaborArticleCite ruleId="contract.pattern.flexible.nitaqatHours" ar={ar} showText />
          </>
        ) : null}
        {workPattern === "remote" ? <LaborArticleCite ruleId="contract.pattern.remote.cite" ar={ar} showText /> : null}
        {workPattern === "part_time" ? <LaborArticleCite ruleId="contract.pattern.partTime.cite" ar={ar} showText /> : null}
        {(workPattern === "temporary" || workPattern === "seasonal") ? <LaborArticleCite ruleId="contract.casual.maxDays" ar={ar} showText /> : null}
        {(!nonSaudi && (fixed || employee?.profile?.art55AppliedAt || liveTermGate.warning === "ART55_CONVERTED")) ? (
          <>
            <LaborArticleCite ruleId="contract.fixed.continuation.cite" ar={ar} showText />
            {fixed ? (
            <label style={{ fontSize: "11px", color: MUTED }}>
              {ar ? "عدد التجديدات المتتالية (المادة 55)" : "Consecutive renewals (Article 55)"}
              <input
                type="number"
                min={0}
                max={20}
                value={renewalCount}
                onChange={(e) => setRenewalCount(e.target.value)}
                style={{ ...field, marginTop: 6 }}
              />
            </label>
            ) : null}
          </>
        ) : null}
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setError("");
          }}
          style={{ ...field, height: "auto", padding: "8px 12px" }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "12px" }}>
          <label style={{ fontSize: "11px", color: MUTED }}>
            {ar ? "تاريخ بداية العقد" : "Contract start date"}
            <div style={{ marginTop: 6 }}>
              <PlatformDateField ar={ar} value={startDate} onChange={setStartDate} />
            </div>
          </label>
          <label style={{ fontSize: "11px", color: MUTED }}>
            {ar ? "تاريخ نهاية العقد" : "Contract end date"}
            <div style={{ marginTop: 6 }}>
              <PlatformDateField ar={ar} value={endDate} min={startDate} disabled={!fixed} onChange={setEndDate} />
            </div>
          </label>
        </div>
        {error && <p style={{ margin: 0, fontSize: "12px", color: "#DC2626" }}>{error}</p>}
        {liveTermGate.warning === "ART55_CONVERTED" ? (
          <p style={{ margin: 0, fontSize: "12px", color: "#B45309", lineHeight: 1.65 }}>
            {ar
              ? "الحفظ يكتب المادة 55: العقد يصبح غير محدد المدة في الملف. تاريخ نهاية جديد في المستقبل هو تجديد مكتوب ويبقى محدد المدة."
              : "Saving writes Article 55: the file becomes indefinite. A new future end date is a written renewal and stays fixed-term."}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onDone}
            style={ui.btnGhost}
          >
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              padding: "8px 15px",
              borderRadius: "9px",
              border: "none",
              background: NAVY_FILL,
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Save style={{ width: 14, height: 14 }} />}
            {ar ? "حفظ العقد" : "Save contract"}
          </button>
        </div>
      </div>
    </IdentityCard>
  );
}
