import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  canManageEmployees,
  hasHRPermission,
  canViewEmployeeProfile,
  isCompanyOwner,
  canManageEmployeeHR,
  canEditEmployeeFile,
  canEditEmployeeFileWage,
  EMPLOYEE_FILE_HR_ONLY_LINE,
  EMPLOYEE_FILE_CORRECTION_HREF,
} from "@/lib/permissions";
import { getRoleLabel } from "@/lib/roles";
import { Lock } from "lucide-react";
import { hrManagerForStation } from "@/lib/hrTree";
import { employeeJobGrade } from "@/lib/jobGrades";
import ProfileHero from "@/components/employees/ProfileHero";
import ProfileCompletionCard, { profileCompletionStats } from "@/components/employees/ProfileCompletionCard";
import CertificatesTab from "@/components/employees/CertificatesTab";
import DisciplineOnFile from "@/components/employees/DisciplineOnFile";
import LoginAccessCard from "@/components/employees/LoginAccessCard";
import AccountSettingsCard from "@/components/employees/AccountSettingsCard";
import DeleteEmployeeAccountCard from "@/components/employees/DeleteEmployeeAccountCard";
import OffboardingTab from "@/components/employees/OffboardingTab";
import HoursOnFile from "@/components/employees/HoursOnFile";
import OffboardingCustodyBoard from "@/components/employees/OffboardingCustodyBoard";
import EmpAlertsStrip from "@/components/employees/EmpAlertsStrip";
import AssignmentTab from "@/components/employees/AssignmentTab";
import { AllowanceLedgerCard, SiteConditionsCard } from "@/components/payroll/PayslipLedger";
import { stationWithSite } from "@/lib/siteRemoteness";
import EmployeeFileSummary from "@/components/employees/EmployeeFileSummary";
import EmployeeFileFieldCard, { EmployeeFileWageCard } from "@/components/employees/EmployeeFileFieldCard";
import EmployerDutiesCard from "@/components/employees/EmployerDutiesCard";
import { contractHint, fileAlertHint } from "@/lib/rightHints.disc";
import ContractLawPanel from "@/components/employees/ContractLawPanel";
import ContractTab from "@/components/employees/ContractTab";
import FileArchiveTab from "@/components/employees/FileArchiveTab";
import { checkHiringAgeGate } from "@/lib/employerDuties";
import EmployeeFileGrowthBoard from "@/components/employees/EmployeeFileGrowthBoard";
import EmployeeFileVoiceBoard from "@/components/employees/EmployeeFileVoiceBoard";
import { buildEmployeeFileView, employeeFileDraftSeed, employeeFileVoice, isViewerOwnFile, serviceLabel, splitEmployeeFileDraft } from "@/lib/employeeFileView";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";
import SectionBackLink from "@/components/shared/SectionBackLink";
import IdentityCard from "@/components/shared/IdentityCard";
import { applyDueLaborRules, openDueNightRotateCycles, patchEmployeeFile, updateCompany } from "@/lib/store";
import { checkFileChangeConsentGate, necessityDaysUsed, NECESSITY_CAP_DAYS, spendConsent } from "@/lib/consentEffects";
import { toast } from "@/components/ui/use-toast";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { syncEmployeeSalaryToPayroll } from "@/lib/payroll";
import { gosiRegistrationIso } from "@/lib/facts";
import { regulationOf } from "@/lib/workRegulation";

const TABS = [
  { key: "summary", ar: "ملخّص الملف", en: "File summary" },
  { key: "identity", ar: "الهوية والتوظيف", en: "Identity and employment" },
  { key: "contract", ar: "العقد والأجر", en: "Contract and wage" },
  { key: "duty", ar: "ما يُحفظ على الملف", en: "Kept on the file" },
  { key: "compliance", ar: "الالتزام والمنصات", en: "Compliance and platforms" },
  { key: "growth", ar: "التدرّج والجزاءات", en: "Progression and sanctions" },
  { key: "docs", ar: "العهد", en: "Custody" },
  { key: "archive", ar: "أرشيف الملف", en: "File archive" },
];

const LEGACY_TAB = {
  professionalInfo: "identity",
  salary: "contract",
  hours: "duty",
  schedule: "duty",
  certificates: "identity",
  // Leave lives in طلباتي and the payslip in قسيمتي — the file does not repeat them.
  leave: "summary",
  payslip: "contract",
  assignment: "growth",
  // The file log tab became the documents archive; the change trail stays on employee.fileLog.
  audit: "archive",
};

// Art. 55 and the leave floors rewrite file facts, so they run from an HR (file-editor) session only;
// the night-consent cycle opens a request, not a file fact, and runs for every viewer.
function ApplyLaborOnFile({ companyId, employeeId, canEditFile }) {
  useEffect(() => {
    if (!companyId || !employeeId) return;
    if (canEditFile) applyDueLaborRules(companyId, employeeId);
    openDueNightRotateCycles(companyId, undefined, employeeId);
  }, [companyId, employeeId, canEditFile]);
  return null;
}

function managerNameOf(employee, employees = []) {
  const id = employee?.profile?.directManagerId || employee?.managerId || employee?.reportsTo;
  return (employees || []).find((item) => String(item.id) === String(id))?.name || "";
}

export default function EmployeeProfile() {
  const { employeeId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, dir, lang } = useI18n();
  const ar = lang === "ar" || dir === "rtl";
  const { data, currentUser, company } = useAuth();
  const wantComplete = searchParams.get("complete") === "1";
  const requested = searchParams.get("tab") || "summary";
  const [tab, setTab] = useState(LEGACY_TAB[requested] || requested);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [positionChange, setPositionChange] = useState("");
  const [necessityUntil, setNecessityUntil] = useState("");

  if (!data || !currentUser) return null;
  const employee = (data.employees || []).find((e) => e.id === employeeId);
  if (!employee) {
    return <p style={{ padding: "24px", fontSize: "13px", color: MUTED }}>—</p>;
  }

  const isSelf = isViewerOwnFile(employee, currentUser);
  const voice = employeeFileVoice({ employee, currentUser, ar });
  const showFileRetentionNote = !isSelf && (isCompanyOwner(currentUser, data) || !!currentUser.hrLevelId);

  if (!canViewEmployeeProfile(currentUser, employee, data)) {
    return (
      <div style={{
        maxWidth: "440px",
        margin: "64px auto",
        textAlign: "center",
        padding: "28px 24px",
        borderRadius: "16px",
        border: `1px solid ${BORDER}`,
        background: CARD,
      }}
      >
        <Lock style={{ width: 28, height: 28, margin: "0 auto 12px", color: MUTED }} />
        <p style={{ margin: 0, fontWeight: 600, color: NAVY }}>{t("confidential")}</p>
        <p style={{ margin: "10px 0 0", fontSize: "13px", color: MUTED, lineHeight: 1.7 }}>
          {ar
            ? "هذا الملف الشخصي خاص — يمكنك فقط عرض ملفك الشخصي. بيانات الزملاء متاحة لمديريهم وللموارد البشرية."
            : "This profile is private — you can only view your own profile. Colleagues' data are available to their managers and HR."}
        </p>
        <div style={{ marginTop: 16 }}>
          <SectionBackLink ar={ar} label={ar ? "الموارد البشرية" : "HR"} to="/app/hr" />
        </div>
      </div>
    );
  }

  const canManageHRProfile = canManageEmployeeHR(currentUser, employee, data);
  const canManage = canManageEmployees(currentUser) || currentUser.role === "director" || currentUser.role === "ops_manager" || canManageHRProfile;
  // The whole file is filled by HR only (owner and director as account administrators): managers and
  // the employee read it; the employee changes a fact through «طلب تعديل بيان».
  const canEditFile = canEditEmployeeFile(currentUser, employee, data);
  const canEditSalary = canEditEmployeeFileWage(currentUser, employee, data);
  const canApproveLeave = canManage || hasHRPermission(currentUser, data, "manage_leave");
  const canEditContract = canEditFile;
  const stationName = (data.stations || []).find((s) => s.id === employee.stationId)?.name;
  const fallbackPosition = employee.customTitle || getRoleLabel(company, employee.role, t);
  const roleLabel = employee.profile?.position || fallbackPosition;
  const view = buildEmployeeFileView({
    employee,
    stationName,
    roleLabel,
    cases: data.disciplinaryCases || [],
    assets: data.assets || [],
    managerName: managerNameOf(employee, data.employees),
    ar,
    canEditFile,
    manageRequests: canApproveLeave,
    isSelf,
    laborCalendar: laborCalendarOf(data),
  });

  const openTab = (next) => setTab(next);
  const setDraftField = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(employeeFileDraftSeed(employee));

  const startEdit = () => {
    setDraft(employeeFileDraftSeed(employee));
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft({});
    setPositionChange("");
    setNecessityUntil("");
  };
  const seed = editing ? employeeFileDraftSeed(employee) : {};
  const positionChanged = editing && String(seed.position || "").trim() && String(draft.position ?? seed.position).trim() !== String(seed.position || "").trim();
  const saveEdit = () => {
    if (!canEditFile || !dirty) return;
    const { profile, name, phone } = splitEmployeeFileDraft(draft);
    // Arts. 59–60 — a move off the monthly wage, or substantially different work, needs the worker's
    // signed consent (spent by this save); incidental necessity is dated and capped at 30 days a year.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
    const consentGate = checkFileChangeConsentGate({
      employee,
      before: { wageType: employee.profile?.wageType || "monthly", position: seed.position },
      after: { wageType: profile.wageType ?? employee.profile?.wageType, position: profile.position ?? seed.position },
      positionChange,
      necessityUntil,
      today,
    });
    if (!consentGate.ok) {
      toast({ description: ar ? consentGate.reason : consentGate.reasonEn, variant: "destructive" });
      return;
    }
    // Art. 162 — a birth date that puts the worker under fifteen at hiring is refused.
    const ageGate = checkHiringAgeGate({ birthDate: profile.birthDate ?? employee.profile?.birthDate, hireDate: profile.hireDate ?? employee.profile?.hireDate });
    if (!ageGate.ok) {
      toast({ description: ar ? ageGate.reason : ageGate.reasonEn, variant: "destructive" });
      return;
    }
    if (!canEditSalary) {
      delete profile.baseSalary;
      delete profile.housingAllowance;
      delete profile.transportAllowance;
      delete profile.otherAllowances;
      delete profile.allowances;
      // Named Art. 2 lines and site allowances are wage too — payroll rights only.
      for (const key of ["hazardAllowance", "livingAllowance", "commissionAmount", "remoteAreaAllowance", "medicalDistanceAllowance", "mealAllowance"]) delete profile[key];
    }
    if (!canEditContract) {
      delete profile.contractType;
      delete profile.contractEndDate;
      delete profile.wageType;
    }
    if (Object.prototype.hasOwnProperty.call(profile, "gosiRegisteredAt")) {
      profile.gosiRegisteredAt = gosiRegistrationIso(profile.gosiRegisteredAt);
    }
    patchEmployeeFile(company.id, employee.id, {
      profile,
      name,
      phone,
      log: {
        text: ar ? "تعديل بيانات الملف" : "File fields updated",
        by: currentUser.name || currentUser.email,
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        dot: "#3C7D50",
      },
    });
    if (consentGate.spend.length || consentGate.necessity) {
      updateCompany(company.id, (d) => {
        const emp = (d.employees || []).find((row) => row.id === employee.id);
        if (!emp) return;
        for (const row of consentGate.spend) {
          spendConsent((emp.otherRequests || []).find((req) => req.id === row.consentId), { what: row.what, by: currentUser.name || "" });
        }
        if (consentGate.necessity) {
          emp.necessityLog = Array.isArray(emp.necessityLog) ? emp.necessityLog : [];
          emp.necessityLog.push({ ...consentGate.necessity, by: currentUser.name || "" });
        }
      });
    }
    syncEmployeeSalaryToPayroll(company.id, employee.id);
    setEditing(false);
    setDraft({});
    setPositionChange("");
    setNecessityUntil("");
  };
  const commitGosiRegisteredAt = (field, iso) => {
    if (field !== "gosiRegisteredAt" || !canEditFile) return;
    const next = gosiRegistrationIso(iso);
    patchEmployeeFile(company.id, employee.id, {
      profile: { gosiRegisteredAt: next },
      log: {
        text: ar ? "تعديل تاريخ التسجيل في التأمينات" : "GOSI registration date updated",
        by: currentUser.name || currentUser.email,
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        dot: "#3C7D50",
      },
    });
    syncEmployeeSalaryToPayroll(company.id, employee.id);
  };

  const roleNote = canEditFile
    ? (ar ? "تُحرّر هذا الملف باسمك. كل حفظ يُكتب باسمك ووقته." : "You edit this file in your name. Every save is written with your name and time.")
    : (ar ? EMPLOYEE_FILE_HR_ONLY_LINE.ar : EMPLOYEE_FILE_HR_ONLY_LINE.en);

  const legal = ar
    ? "شارة المادة تظهر فقط إن كان المصدر نظام العمل السعودي. التأمينات وحماية الأجور والضمان الصحي ومنصة قوى جهات وأنظمة تشغيل لا مواد، فتُشرح نصّاً بلا شارة. هذه الصفحة أداة تشغيل لا فتوى قانونية — عند الخلاف يُرجع إلى النص الرسمي وإلى الموارد البشرية."
    : "The article chip appears only when the source is the Saudi Labour Law. GOSI, wage protection, CCHI and Qiwa are platforms — explained as operational text, never an invented article. This page is an operating tool, not a legal opinion.";
  const hireIso = employee.profile?.hireDate || employee.hireDate || employee.startDate || "";
  const grade = employeeJobGrade(employee, data);
  const hrPerson = hrManagerForStation(data, employee.stationId);
  const showFullIdentity = Boolean(canManageHRProfile || canEditFile);
  const contractLine = (view.contract || []).find((row) => row.k === (ar ? "نوع العقد" : "Contract type"))?.v || "—";
  const fileAction = {
    fontFamily: "inherit",
    height: 36,
    padding: "0 14px",
    borderRadius: 8,
    border: "none",
    background: "#3C7D50",
    color: "#F4F7F5",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
      <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {company?.id && employee?.id ? <ApplyLaborOnFile companyId={company.id} employeeId={employee.id} canEditFile={canEditFile} /> : null}

        {!isSelf ? (
          <SectionBackLink ar={ar} label={ar ? "الموارد البشرية" : "HR"} to="/app/hr" />
        ) : null}

        <ProfileHero
          employee={employee}
          companyId={company.id}
          canEdit={canEditFile}
          roleLabel={roleLabel}
          stationName={stationName}
          currentUser={currentUser}
          gradeLabel={grade?.gradeNumber || "—"}
          managerName={managerNameOf(employee, data.employees)}
          hrName={hrPerson?.name || ""}
          serviceText={serviceLabel(hireIso, ar)}
          contractText={contractLine}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10, flexWrap: "wrap" }}>
          {canEditFile ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={editing ? cancelEdit : startEdit} style={fileAction}>
                {editing ? (ar ? "وضع التحرير" : "Editing") : (ar ? "تحرير الملف" : "Edit file")}
              </button>
              {editing ? (
                <>
                  <button type="button" onClick={saveEdit} disabled={!dirty} style={{ ...fileAction, opacity: dirty ? 1 : 0.45, cursor: dirty ? "pointer" : "default" }}>
                    {ar ? "حفظ" : "Save"}
                  </button>
                  <button type="button" onClick={cancelEdit} style={{ ...fileAction, background: "transparent", color: "var(--nv-ink)", border: "1px solid var(--nv-line)" }}>
                    {ar ? "تراجع" : "Cancel"}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          {positionChanged ? (
            <fieldset data-position-change="1" style={{ flex: "1 1 100%", border: "1px solid var(--nv-warn-line)", background: "var(--nv-warn-soft)", borderRadius: 10, padding: "10px 12px", margin: 0, display: "grid", gap: 6 }}>
              <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink)", padding: "0 4px" }}>
                {ar ? `تغيّر المسمّى إلى «${String(draft.position || "").trim()}» — ما طبيعته؟ (المادة 60)` : "The title changed — what kind of change? (Art. 60)"}
              </legend>
              {[
                ["minor", ar ? "تصحيح في التسمية — العمل نفسه" : "A wording fix — the same work"],
                ["essential", ar ? "عمل يختلف جوهرياً — بموافقته الكتابية الموقّعة" : "Substantially different work — with signed consent"],
                ["necessity", ar ? `ضرورة عارضة مؤقتة — حتى ${NECESSITY_CAP_DAYS} يوماً في السنة (استُخدم ${necessityDaysUsed(employee, "work", new Date().getFullYear())})` : `Temporary incidental necessity — up to ${NECESSITY_CAP_DAYS} days a year`],
              ].map(([value, text]) => (
                <label key={value} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--nv-ink)", cursor: "pointer" }}>
                  <input type="radio" name="position-change" value={value} checked={positionChange === value} onChange={() => setPositionChange(value)} />
                  {text}
                </label>
              ))}
              {positionChange === "necessity" ? (
                <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--nv-ink2)", maxWidth: 280 }}>
                  {ar ? "ينتهي التكليف المؤقت في" : "The temporary assignment ends on"}
                  <PlatformDateField ar={ar} value={necessityUntil} onChange={setNecessityUntil} />
                </label>
              ) : null}
            </fieldset>
          ) : null}
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{voice.warnings}</span>
          <span style={{ fontSize: 12, color: "var(--nv-ink3)", lineHeight: 1.6, minWidth: 0 }}>{roleNote}</span>
        </div>

        <nav aria-label={voice.title} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {TABS.map((item) => {
            const on = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => openTab(item.key)}
                aria-current={on ? "page" : undefined}
                style={{
                  fontFamily: "inherit",
                  height: 34,
                  padding: "0 13px",
                  borderRadius: 999,
                  border: on ? "none" : "1px solid var(--nv-line)",
                  background: on ? "#3C7D50" : "var(--nv-card)",
                  color: on ? "#F4F7F5" : "var(--nv-ink)",
                  fontSize: 12,
                  fontWeight: on ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {item.key === "summary" && isSelf ? (ar ? "ملفي" : "My file")
                  : item.key === "archive" && isSelf ? (ar ? "أرشيف ملفي" : "My file archive")
                    // Sanctions are not on his own file — the tab is «التدرّج» only.
                    : item.key === "growth" && isSelf ? (ar ? "التدرّج" : "Progression")
                      : (ar ? item.ar : item.en)}
              </button>
            );
          })}
        </nav>

        <EmpAlertsStrip employee={employee} currentUser={currentUser} lang={lang} />

        {tab === "summary" && (
          <EmployeeFileSummary
            view={view}
            ar={ar}
            onOpenTab={openTab}
            employee={employee}
            isSelf={isSelf}
            roleLabel={roleLabel}
            stationName={stationName}
            companyName={company?.name || ""}
            cases={data.disciplinaryCases || []}
            assets={data.assets || []}
            regulation={regulationOf(data)}
            canEditFile={canEditFile}
          />
        )}

        {tab === "identity" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: 16, alignItems: "stretch" }}>
              {view.idCards.map((card) => (
                <EmployeeFileFieldCard key={card.title} card={card} editing={editing} draft={draft} onDraft={setDraftField} ar={ar} showFull={showFullIdentity} />
              ))}
            </div>
            {isSelf && !canEditFile ? (
              <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "طلب تعديل بيان" : "Ask to correct a field"}</strong>
                <span style={{ fontSize: 12, color: "var(--nv-ink3)", lineHeight: 1.7 }}>
                  {ar ? "يُرفع إلى الموارد البشرية ويُعتمد قبل أن يظهر في ملفك، ويُكتب باسم من اعتمده." : "It goes to HR and is approved before it appears on your file, under the name of whoever approves it."}
                </span>
                <Link to={EMPLOYEE_FILE_CORRECTION_HREF} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 8, background: "#3C7D50", color: "#F4F7F5", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                  {ar ? "اطلب تعديل بيان" : "Request a correction"}
                </Link>
              </section>
            ) : null}
            <CertificatesTab
              employee={employee}
              companyId={company.id}
              canEdit={canEditFile}
              canApprove={canEditFile}
              currentUser={currentUser}
            />
          </>
        )}

        {tab === "contract" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: 14, alignItems: "stretch" }}>
            <EmployeeFileFieldCard
              card={{
                title: ar ? "عقد العمل" : "Employment contract",
                what: ar ? "نوع العقد ومدّته من نظام العمل؛ النسخة المكتوبة والتوثيق مسؤولية صاحب العمل." : "Type and term come from the Law; the written copy is the employer's duty.",
                hint: contractHint(employee, { view: isSelf ? "employee" : "manager", ar }),
                rows: view.contract,
                note: view.contractNote,
              }}
              editing={editing}
              draft={draft}
              onDraft={setDraftField}
              ar={ar}
              showFull={showFullIdentity}
            />
            <EmployeeFileFieldCard
              card={{
                title: ar ? "مكافأة نهاية الخدمة" : "End-of-service award",
                what: ar ? "تقدير مشتق من مدة الخدمة والأجر الأخير." : "An estimate derived from service length and last wage.",
                hint: fileAlertHint({ ruleId: "eos.gratuity.cite", value: "" }, employee, { view: isSelf ? "employee" : "manager", ar }),
                rows: view.eos,
                note: view.eosNote,
              }}
            />
            <EmployeeFileWageCard
              title={ar ? "الأجر" : "Wage"}
              what={ar ? "الأجر الأساسي والبدلات؛ الإجمالي مشتق لا مُدخَل. تاريخ التسجيل في التأمينات يُكتب هنا." : "Base and allowances; the total is derived, not typed. The GOSI registration date is entered here."}
              rows={view.wageRows}
              note={view.wageNote}
              editing={editing}
              draft={draft}
              onDraft={setDraftField}
              canEditWage={canEditSalary}
              canEditDate={canEditFile}
              ar={ar}
              onCommitDate={commitGosiRegisteredAt}
            />
          </div>
        )}
        {tab === "contract" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {canEditContract || isSelf ? <ContractTab employee={employee} companyId={company.id} canEdit={canEditContract && !isSelf} viewerId={currentUser.id} /> : null}
            {canEditContract || isSelf ? <ContractLawPanel employee={employee} ar={ar} /> : null}
            <AllowanceLedgerCard employee={employee} ar={ar} />
            <SiteConditionsCard
              employee={employee}
              station={stationWithSite(data, employee.stationId)}
              ar={ar}
              editing={editing}
              draft={draft}
              onDraft={setDraftField}
              canEdit={canEditFile}
            />
            {canEditFile && !isSelf ? <OffboardingTab employee={employee} companyId={company.id} currentUser={currentUser} canManage /> : null}
          </div>
        )}

        {tab === "duty" && (
          /* Only what is kept on the file: weekly rest, hours basis and the Art. 108 category — read by
             the roster and attendance. The week, its rule checks and the absence record live in الحضور. */
          <HoursOnFile employee={employee} data={data} lang={lang} />
        )}

        {tab === "compliance" && (
          <>
            <EmployerDutiesCard employee={employee} companyId={company.id} ar={ar} canManage={canEditFile && !isSelf} by={currentUser.name || ""} />

            {!profileCompletionStats(employee).done && (
              <ProfileCompletionCard
                employee={employee}
                isSelf={isSelf}
                ar={ar}
                canComplete={canEditFile}
                onContinue={() => {
                  setTab("identity");
                  if (canEditFile) startEdit();
                  if (wantComplete) {
                    searchParams.delete("complete");
                    setSearchParams(searchParams, { replace: true });
                  }
                }}
              />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 14, alignItems: "stretch" }}>
              {view.platforms.map((card) => (
                <EmployeeFileFieldCard
                  key={card.name}
                  card={{
                    title: card.name,
                    what: card.what,
                    tag: card.state,
                    tagColor: card.color,
                    tagBg: card.bg,
                    tagBorder: card.border,
                    rows: card.rows,
                    note: card.note,
                  }}
                  editing={editing}
                  draft={draft}
                  onDraft={setDraftField}
                  ar={ar}
                  showFull={showFullIdentity}
                />
              ))}
            </div>
          </>
        )}

        {tab === "growth" && (
          <>
            <EmployeeFileGrowthBoard view={view} ar={ar} self={isSelf} />
            <EmployeeFileVoiceBoard
              employee={employee}
              publicReports={data.publicReports || []}
              employees={data.employees || []}
              stations={data.stations || []}
              ar={ar}
              canManage={canManage}
              chainIds={data.complaintEscalationChain || []}
              viewer={currentUser}
              data={data}
            />
            <AssignmentTab
              employee={employee}
              companyId={company.id}
              lang={lang}
              canManage={canEditFile && !isSelf}
              stations={data.stations || []}
              currentUser={currentUser}
            />
            {canManage && !isSelf ? (
              <DisciplineOnFile
                employee={employee}
                companyId={company.id}
                currentUser={currentUser}
                cases={data.disciplinaryCases || []}
                canManage={canManage && !isSelf}
                ar={ar}
              />
            ) : null}
          </>
        )}

        {tab === "docs" && (
          /* «عهدتي» — only the custody list; documents and certificates sit in الهوية, duties in الالتزام. */
          <OffboardingCustodyBoard employee={employee} canManage={canEditFile && !isSelf} lang={lang} custodyOnly />
        )}

        {tab === "archive" && (
          <FileArchiveTab employee={employee} data={data} isSelf={isSelf} managerView={canManage && !isSelf} ar={ar} />
        )}

        {(isSelf || (canManage && !isSelf) || showFileRetentionNote) && tab === "identity" && (
          <IdentityCard
            kicker={ar ? "دخول المنصة" : "Platform access"}
            title={ar ? "إعدادات الحساب والدخول" : "Account and sign-in settings"}
            subtitle={ar
              ? "تغيير كلمة المرور فقط. بيانات الشركة والموظفين تبقى محفوظة وسرية — لا حذف للشركة ولا لملف الموظف."
              : "Password change only. Company and employee data stay stored and confidential — neither the company nor the employee file can be deleted."}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {isSelf && <AccountSettingsCard employee={employee} company={company} />}
              {canManage && !isSelf && <LoginAccessCard employee={employee} companyId={company.id} />}
              {showFileRetentionNote && <DeleteEmployeeAccountCard />}
            </div>
          </IdentityCard>
        )}

        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.65, color: "var(--nv-ink3)" }}>{legal}</p>
      </div>
  );
}
