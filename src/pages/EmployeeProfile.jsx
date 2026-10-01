import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  canManageEmployees,
  hasHRPermission,
  canViewEmployeeProfile,
  isCompanyOwner,
  canAdjustPayroll,
  canManageEmployeeHR,
  canManageEmployeeContract,
} from "@/lib/permissions";
import { getRoleLabel } from "@/lib/roles";
import { Lock } from "lucide-react";
import { hrManagerForStation } from "@/lib/hrTree";
import { employeeJobGrade } from "@/lib/jobGrades";
import ProfileHero from "@/components/employees/ProfileHero";
import ProfileCompletionCard, { profileCompletionStats } from "@/components/employees/ProfileCompletionCard";
import CertificatesTab from "@/components/employees/CertificatesTab";
import LeaveTab from "@/components/employees/LeaveTab";
import DisciplineOnFile from "@/components/employees/DisciplineOnFile";
import LoginAccessCard from "@/components/employees/LoginAccessCard";
import AccountSettingsCard from "@/components/employees/AccountSettingsCard";
import DeleteEmployeeAccountCard from "@/components/employees/DeleteEmployeeAccountCard";
import OffboardingTab from "@/components/employees/OffboardingTab";
import EmpAlertsStrip from "@/components/employees/EmpAlertsStrip";
import AssignmentTab from "@/components/employees/AssignmentTab";
import HoursOnFile from "@/components/employees/HoursOnFile";
import EmployeeFileSummary from "@/components/employees/EmployeeFileSummary";
import EmployeeFileFieldCard, { EmployeeFileWageCard } from "@/components/employees/EmployeeFileFieldCard";
import EmployeeFileLeaveBoard from "@/components/employees/EmployeeFileLeaveBoard";
import EmployeeFileDocsBoard from "@/components/employees/EmployeeFileDocsBoard";
import EmployeeFileGrowthBoard from "@/components/employees/EmployeeFileGrowthBoard";
import EmployeeFileVoiceBoard from "@/components/employees/EmployeeFileVoiceBoard";
import { buildEmployeeFileView, employeeFileDraftSeed, employeeFileVoice, isViewerOwnFile, serviceLabel, splitEmployeeFileDraft } from "@/lib/employeeFileView";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";
import SectionBackLink from "@/components/shared/SectionBackLink";
import IdentityCard from "@/components/shared/IdentityCard";
import { applyDueLaborRules, openDueNightRotateCycles, patchEmployeeFile } from "@/lib/store";
import { syncEmployeeSalaryToPayroll } from "@/lib/payroll";
import { gosiRegistrationIso } from "@/lib/facts";

const TABS = [
  { key: "summary", ar: "ملخّص الملف", en: "File summary" },
  { key: "identity", ar: "الهوية والتوظيف", en: "Identity and employment" },
  { key: "contract", ar: "العقد والأجر", en: "Contract and wage" },
  { key: "leave", ar: "الإجازات", en: "Leave" },
  { key: "compliance", ar: "الالتزام والمنصات", en: "Compliance and platforms" },
  { key: "growth", ar: "التدرّج والجزاءات", en: "Progression and sanctions" },
  { key: "docs", ar: "الوثائق والعهد", en: "Documents and custody" },
  { key: "audit", ar: "سجل الملف", en: "File log" },
];

const LEGACY_TAB = {
  professionalInfo: "identity",
  salary: "contract",
  hours: "identity",
  certificates: "docs",
  assignment: "growth",
};

function ApplyLaborOnFile({ companyId, employeeId }) {
  useEffect(() => {
    if (!companyId || !employeeId) return;
    applyDueLaborRules(companyId, employeeId);
    openDueNightRotateCycles(companyId, undefined, employeeId);
  }, [companyId, employeeId]);
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
  const canEditSalary = canAdjustPayroll(currentUser, data);
  const canApproveLeave = canManage || hasHRPermission(currentUser, data, "manage_leave");
  const canApproveCerts = canManage || hasHRPermission(currentUser, data, "manage_leave");
  const canEditContract = canManageEmployeeContract(currentUser, employee, data);
  const canEditFile = Boolean(canManage);
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
  };
  const saveEdit = () => {
    if (!canEditFile || !dirty) return;
    const { profile, name, phone } = splitEmployeeFileDraft(draft);
    if (!canEditSalary) {
      delete profile.baseSalary;
      delete profile.housingAllowance;
      delete profile.transportAllowance;
      delete profile.otherAllowances;
      delete profile.allowances;
    }
    if (!canEditContract) {
      delete profile.contractType;
      delete profile.contractEndDate;
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
    syncEmployeeSalaryToPayroll(company.id, employee.id);
    setEditing(false);
    setDraft({});
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

  const roleNote = isSelf && !canManage
    ? (ar ? "تقرأ ملفك. التعديل للموارد البشرية والإدارة." : "You read your file. HR and management edit it.")
    : canEditFile
      ? (ar ? "تُحرّر هذا الملف باسمك. كل حفظ يُسجَّل في سجل الملف." : "You edit this file in your name. Every save is written on the file log.")
      : (ar ? "عرض فقط — لا تعديل على هذا الملف من دورك." : "View only — your role cannot edit this file.");

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
        {company?.id && employee?.id ? <ApplyLaborOnFile companyId={company.id} employeeId={employee.id} /> : null}

        {!isSelf ? (
          <SectionBackLink ar={ar} label={ar ? "الموارد البشرية" : "HR"} to="/app/hr" />
        ) : null}

        <ProfileHero
          employee={employee}
          companyId={company.id}
          canEdit={isSelf || canManage}
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
                {ar ? item.ar : item.en}
              </button>
            );
          })}
        </nav>

        <EmpAlertsStrip employee={employee} currentUser={currentUser} lang={lang} />

        {tab === "summary" && <EmployeeFileSummary view={view} ar={ar} onOpenTab={openTab} />}

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
                  {ar ? "يُرفع إلى الموارد البشرية ويُعتمد قبل أن يظهر في ملفك، ويُكتب في سجل الملف." : "It goes to HR and is approved before it appears on your file, and the save is written on the file log."}
                </span>
                <Link to="/app/requests" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 8, background: "#3C7D50", color: "#F4F7F5", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                  {ar ? "اطلب تعديل بيان" : "Request a correction"}
                </Link>
              </section>
            ) : null}
            <HoursOnFile employee={employee} data={data} lang={lang} />
          </>
        )}

        {tab === "contract" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: 14, alignItems: "stretch" }}>
            <EmployeeFileFieldCard
              card={{
                title: ar ? "عقد العمل" : "Employment contract",
                what: ar ? "نوع العقد ومدّته من نظام العمل؛ النسخة المكتوبة والتوثيق مسؤولية صاحب العمل." : "Type and term come from the Law; the written copy is the employer's duty.",
                tag: ar ? "المادة 51 · 75 · 98" : "Art. 51 · 75 · 98",
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
                tag: ar ? "المادة 84 · 85" : "Art. 84 · 85",
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

        {tab === "leave" && (
          <>
            <EmployeeFileLeaveBoard view={view} ar={ar} />
            <LeaveTab
              employee={employee}
              companyId={company.id}
              currentUser={currentUser}
              isSelf={isSelf}
              canApprove={canApproveLeave}
            />
          </>
        )}

        {tab === "compliance" && (
          <>
            {!profileCompletionStats(employee).done && (
              <ProfileCompletionCard
                employee={employee}
                isSelf={isSelf}
                ar={ar}
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
            <EmployeeFileGrowthBoard view={view} ar={ar} />
            <EmployeeFileVoiceBoard
              employee={employee}
              publicReports={data.publicReports || []}
              employees={data.employees || []}
              stations={data.stations || []}
              ar={ar}
              canManage={canManage}
              chainIds={data.complaintEscalationChain || []}
            />
            <AssignmentTab
              employee={employee}
              companyId={company.id}
              lang={lang}
              canManage={canManage && !isSelf}
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
          <>
            <EmployeeFileDocsBoard view={view} ar={ar} />
            <CertificatesTab
              employee={employee}
              companyId={company.id}
              canEdit={isSelf || canManage}
              canApprove={canApproveCerts}
              currentUser={currentUser}
            />
            <OffboardingTab
              employee={employee}
              companyId={company.id}
              currentUser={currentUser}
              canManage={canManage && !isSelf}
            />
          </>
        )}

        {tab === "audit" && (
          <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line)" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "سجل الملف" : "File log"}</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.75, marginTop: 3 }}>
                {ar ? "كل تغيير ظاهر باسم من أجراه ووقته. لا تعديل صامت." : "Every visible change names who made it and when. No silent edit."}
              </div>
            </div>
            {view.audit.length === 0 ? (
              <div style={{ padding: "16px 20px", fontSize: 12, color: MUTED }}>{ar ? "لا حركة مثبتة بعد." : "No written movement yet."}</div>
            ) : view.audit.map((row) => (
              <div key={`${row.text}-${row.at}`} style={{ padding: "12px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12, alignItems: "start" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: row.dot || "var(--nv-btn-fill)", marginTop: 6 }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--nv-ink)", lineHeight: 1.8 }}>{row.text}</span>
                  <span style={{ fontSize: 10, color: MUTED }}>{row.by}</span>
                </span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{row.at}</span>
              </div>
            ))}
          </section>
        )}

        {(isSelf || (canManage && !isSelf) || showFileRetentionNote) && (tab === "identity" || tab === "compliance") && (
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
