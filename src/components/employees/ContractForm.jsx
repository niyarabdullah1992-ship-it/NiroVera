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
import AttachFileButton from "@/components/shared/AttachFileButton";
import { MUTED, NAVY_FILL, field, ui } from "@/lib/platformStyles";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { checkContractTermGate, nationalityIsSaudi } from "@/lib/complianceDerivations";
import { WORK_PATTERN_OPTIONS, checkProbationGate, workPatternForcesFixed } from "@/lib/contractLawDerivations";
import { getCompanyData } from "@/lib/store";
import { checkContractRequiredContent, checkContractSaveGate, contractModelFields, contractSheet } from "@/lib/contractDocument";
import { printSheet } from "@/lib/printSheet";
import { readConsentFile } from "@/lib/writtenConsent";

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
  // Arts. 51–52 · Regs Art. 18: the contract may be generated from the unified model instead of uploaded.
  const [generate, setGenerate] = useState(Boolean(contract?.generated) || !contract?.fileUrl);
  const [qiwa, setQiwa] = useState(employee?.profile?.qiwaRegistered !== false && Boolean(employee?.profile?.qiwaRegistered));
  const [probation, setProbation] = useState(Boolean(employee?.profile?.probation));
  const [probationDays, setProbationDays] = useState(String(employee?.profile?.probationDays || ""));
  const [priorProbation, setPriorProbation] = useState(Boolean(employee?.profile?.probationPriorAtEmployer));
  const [secondWritten, setSecondWritten] = useState(Boolean(employee?.profile?.probationSecondWritten));
  const [secondFile, setSecondFile] = useState(employee?.profile?.probationSecondFile || null);
  const companyData = getCompanyData(companyId) || {};
  const station = (companyData.stations || []).find((row) => String(row.id) === String(employee?.stationId || employee?.station_id || ""));
  const modelFields = contractModelFields({
    employee,
    company: {
      name: companyData.legalName || companyData.name || "",
      address: companyData.settings?.address || companyData.address || companyData.settings?.city || "",
      crNumber: companyData.settings?.crNumber || companyData.crNumber || "",
    },
    station,
    contract: { type: fixed ? "fixed" : contractType, startDate, endDate: fixed ? endDate : "", probation, probationDays: Number(probationDays) || 0 },
  });
  const missingContent = generate ? checkContractRequiredContent(modelFields, ar) : [];
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
    const docGate = checkContractSaveGate({ fields: modelFields, hasFile: hasExisting || isPdf, generated: generate, ar });
    if (!docGate.ok) {
      setError(ar ? docGate.reason : docGate.reasonEn);
      return;
    }
    const probGate = checkProbationGate({ probation, probationDays: Number(probationDays) || 0, probationPriorAtEmployer: priorProbation, probationSecondWritten: secondWritten, probationSecondFile: secondFile, today: startDate });
    if (!probGate.ok) {
      setError(ar ? probGate.reason : probGate.reasonEn);
      return;
    }
    if (!generate && !hasExisting && !isPdf) {
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
        qiwaRegistered: qiwa,
        probation,
        probationDays: probation ? Number(probationDays) || 0 : "",
        probationPriorAtEmployer: probation ? priorProbation : false,
        probationSecondWritten: probation && priorProbation ? secondWritten : false,
        probationSecondFile: probation && priorProbation ? secondFile : null,
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
          ...(generate ? {
            generated: true,
            generatedAt: new Date().toISOString(),
            model: modelFields,
            // A changed contract needs the worker's signature again.
            workerAck: contract?.generated && JSON.stringify(contract?.model || {}) === JSON.stringify(modelFields) ? (contract?.workerAck || null) : null,
          } : { generated: false }),
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
        <div data-contract-model="" style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--nv-line)", borderRadius: 10, padding: "10px 12px" }}>
          <label style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", color: "var(--nv-ink)" }}>
            <input type="checkbox" checked={generate} onChange={(e) => { setGenerate(e.target.checked); setError(""); }} />
            {ar ? "أنشئ العقد من النموذج الموحد (المادة 52 · اللائحة م18) — نسختان بالعربية، ويوقّعه العامل من ملفه" : "Generate from the unified model (Art. 52 · Regs Art. 18) — the worker signs it from their file"}
          </label>
          {generate ? (
            missingContent.length ? (
              <span data-contract-missing="" style={{ fontSize: 11.5, color: "var(--nv-bad-ink)", lineHeight: 1.7 }}>
                {ar ? `أكمل في الملف قبل الحفظ: ${missingContent.join("، ")}.` : `Complete on the file first: ${missingContent.join(", ")}.`}
              </span>
            ) : (
              <span style={{ fontSize: 11.5, color: "var(--nv-ok-ink)" }}>{ar ? "محتوى العقد مكتمل وفق النموذج الموحد." : "The contract content is complete."}</span>
            )
          ) : null}
          {generate ? (
            <button type="button" style={{ ...ui.btnGhost, alignSelf: "flex-start" }} onClick={() => printSheet(contractSheet(modelFields, { ar: true, ref: employee?.id || "" }))}>
              {ar ? "معاينة العقد وطباعته" : "Preview and print"}
            </button>
          ) : null}
          <label style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", color: "var(--nv-ink)" }}>
            <input type="checkbox" checked={probation} onChange={(e) => setProbation(e.target.checked)} />
            {ar ? "فترة تجربة منصوص عليها في العقد (المادة 53)" : "Probation stated in the contract (Art. 53)"}
          </label>
          {probation ? (
            <>
              <input type="number" min={1} max={180} value={probationDays} onChange={(e) => setProbationDays(e.target.value)} placeholder={ar ? "مدة التجربة بالأيام (حتى 180)" : "Probation days (up to 180)"} style={field} />
              <label style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", color: "var(--nv-ink)" }}>
                <input type="checkbox" checked={priorProbation} onChange={(e) => setPriorProbation(e.target.checked)} />
                {ar ? "سبق أن خضع للتجربة لدى المنشأة (تجربة ثانية — المادة 54)" : "Already on probation here before (second probation — Art. 54)"}
              </label>
              {priorProbation ? (
                <>
                  <label style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", color: "var(--nv-ink)" }}>
                    <input type="checkbox" checked={secondWritten} onChange={(e) => setSecondWritten(e.target.checked)} />
                    {ar ? "اتفق الطرفان كتابةً على التجربة الثانية (مهنة أخرى أو بعد انقطاع ستة أشهر)" : "The parties agreed the second probation in writing"}
                  </label>
                  <AttachFileButton ar={ar} accept="application/pdf,image/*" label={secondFile?.name ? (ar ? `الاتفاق: ${secondFile.name}` : `Agreement: ${secondFile.name}`) : (ar ? "أرفق الاتفاق المكتوب" : "Attach the written agreement")} onPick={async (picked) => { if (picked) setSecondFile({ name: picked.name, url: await readConsentFile(picked) }); }} />
                </>
              ) : null}
            </>
          ) : null}
          <label style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", color: "var(--nv-ink)" }}>
            <input type="checkbox" checked={qiwa} onChange={(e) => setQiwa(e.target.checked)} />
            {ar ? "وُثّق العقد في قوى (اللائحة م18/2)" : "Documented on Qiwa (Regs Art. 18(2))"}
          </label>
        </div>
        <AttachFileButton
          ar={ar}
          accept="application/pdf,.pdf"
          label={file?.name ? (ar ? `تغيير العقد: ${file.name}` : `Change the contract: ${file.name}`) : (ar ? "أرفق عقد PDF" : "Attach the contract PDF")}
          onPick={(picked) => {
            setFile(picked);
            setError("");
          }}
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
        {error && <p style={{ margin: 0, fontSize: "12px", color: "var(--nv-bad-ink)" }}>{error}</p>}
        {liveTermGate.warning === "ART55_CONVERTED" ? (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--nv-warn-ink)", lineHeight: 1.65 }}>
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
