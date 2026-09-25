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
  canManageEmployeeCommunication,
} from "@/lib/permissions";
import { getRoleLabel } from "@/lib/roles";
import { Lock } from "lucide-react";
import ProfileHero from "@/components/employees/ProfileHero";
import ProfileCompletionCard, { profileCompletionStats } from "@/components/employees/ProfileCompletionCard";
import CertificatesTab from "@/components/employees/CertificatesTab";
import LeaveTab from "@/components/employees/LeaveTab";
import HRCommunicationsTab from "@/components/employees/HRCommunicationsTab";
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
import { buildEmployeeFileView, employeeFileDraftSeed, employeeFileVoice, isViewerOwnFile, splitEmployeeFileDraft } from "@/lib/employeeFileView";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { BORDER, CARD, MUTED, NAVY, ui } from "@/lib/platformStyles";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import SectionBackLink from "@/components/shared/SectionBackLink";
import IdentityCard from "@/components/shared/IdentityCard";
import { OpsControlBar } from "@/components/tasks/OpsToolbarStrip";
import { applyDueLaborRules, openDueNightRotateCycles, patchEmployeeFile } from "@/lib/store";

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
  const canDeleteAccount = !isSelf && employee.id !== data.ownerId && (isCompanyOwner(currentUser, data) || !!currentUser.hrLevelId);

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
  const canReplyCommunication = canManageEmployeeCommunication(currentUser, employee, data);
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
    patchEmployeeFile(company.id, employee.id, {
      profile,
      name,
      phone,
      log: {
        text: ar ? "تعديل بيانات الملف" : "File fields updated",
        by: currentUser.name || currentUser.email,
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        dot: "#14213D",
      },
    });
    setEditing(false);
    setDraft({});
  };

  const roleNote = isSelf && !canManage
    ? (ar ? "تقرأ ملفك. التعديل للموارد البشرية والإدارة." : "You read your file. HR and management edit it.")
    : canEditFile
      ? (ar ? "تُحرّر هذا الملف باسمك. كل حفظ يُسجَّل في سجل الملف." : "You edit this file in your name. Every save is written on the file log.")
      : (ar ? "عرض فقط — لا تعديل على هذا الملف من دورك." : "View only — your role cannot edit this file.");

  const legal = ar
    ? "شارة المادة تظهر فقط إن كان المصدر نظام العمل السعودي. التأمينات وحماية الأجور والضمان الصحي ومنصة قوى جهات وأنظمة تشغيل لا مواد، فتُشرح نصّاً بلا شارة. هذه الصفحة أداة تشغيل لا فتوى قانونية — عند الخلاف يُرجع إلى النص الرسمي وإلى الموارد البشرية."
    : "The article chip appears only when the source is the Saudi Labour Law. GOSI, wage protection, CCHI and Qiwa are platforms — explained as operational text, never an invented article. This page is an operating tool, not a legal opinion.";

  return (
    <PlatformStampShell
      ar={ar}
      maxWidth={1280}
      kicker={ar ? "مساحتي" : "My space"}
      title={voice.title}
      hint={ar
        ? <>سجلّك في مكان واحد. الطلبات تولد في <Link to="/app/requests" style={{ color: "#FBF3E1" }}>طلباتي</Link>، ودوامك في <Link to="/app/attendance" style={{ color: "#FBF3E1" }}>الدوام والحضور</Link>، وأثرها على <Link to="/app/shifts" style={{ color: "#FBF3E1" }}>جدول الدوام</Link>.</>
        : <>Your record in one place. Requests are raised in <Link to="/app/requests" style={{ color: "#FBF3E1" }}>My requests</Link>; attendance is in <Link to="/app/attendance" style={{ color: "#FBF3E1" }}>Time & Attendance</Link> and the effect lands on <Link to="/app/shifts" style={{ color: "#FBF3E1" }}>the roster</Link>.</>}
      sections={TABS.map((item) => ({ value: item.key, label: ar ? item.ar : item.en }))}
      tool={tab}
      onTool={openTab}
      legal={legal}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {company?.id && employee?.id ? <ApplyLaborOnFile companyId={company.id} employeeId={employee.id} /> : null}

        {!isSelf ? (
          <SectionBackLink ar={ar} label={ar ? "الموارد البشرية" : "HR"} to="/app/hr" />
        ) : null}

        <section style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <ProfileHero
            employee={employee}
            companyId={company.id}
            canEdit={isSelf || canManage}
            roleLabel={roleLabel}
            stationName={stationName}
            currentUser={currentUser}
          />
        </section>

        <OpsControlBar>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10, flexWrap: "wrap", padding: "8px 10px" }}>
            {canEditFile ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={editing ? cancelEdit : startEdit} style={editing ? ui.btnCreateQuiet : ui.btnCreate}>
                  {editing ? (ar ? "وضع التحرير" : "Editing") : (ar ? "تحرير الملف" : "Edit file")}
                </button>
                {editing ? (
                  <>
                    <button type="button" onClick={saveEdit} disabled={!dirty} style={{ ...ui.btnCreate, opacity: dirty ? 1 : 0.45, cursor: dirty ? "pointer" : "default" }}>
                      {ar ? "حفظ" : "Save"}
                    </button>
                    <button type="button" onClick={cancelEdit} style={ui.btnGhost}>
                      {ar ? "تراجع" : "Cancel"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2F6B43", background: "#E6F2EA", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{voice.warnings}</span>
            <span style={{ fontSize: 12, color: "#555C66", lineHeight: 1.6, minWidth: 0 }}>{roleNote}</span>
          </div>
        </OpsControlBar>

        {view.compliance.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            {view.compliance.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => openTab(chip.tab)}
                style={{
                  fontFamily: "inherit",
                  textAlign: "start",
                  border: "1px solid #E4E9E6",
                  borderRadius: 12,
                  background: "#fff",
                  borderTop: `3px solid ${chip.color}`,
                  cursor: "pointer",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#111418" }}>{chip.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: chip.color }}>{chip.state}</span>
                <span style={{ fontSize: 11, color: "#555C66", lineHeight: 1.55 }}>{chip.note}</span>
              </button>
            ))}
          </div>
        ) : null}

        <EmpAlertsStrip employee={employee} currentUser={currentUser} lang={lang} />

        {tab === "summary" && <EmployeeFileSummary view={view} ar={ar} onOpenTab={openTab} />}

        {tab === "identity" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: 16, alignItems: "stretch" }}>
              {view.idCards.map((card) => (
                <EmployeeFileFieldCard key={card.title} card={card} editing={editing} draft={draft} onDraft={setDraftField} ar={ar} />
              ))}
            </div>
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
              what={ar ? "الأجر الأساسي والبدلات؛ الإجمالي مشتق لا مُدخَل." : "Base and allowances; the total is derived, not typed."}
              rows={view.wageRows}
              note={view.wageNote}
              editing={editing}
              draft={draft}
              onDraft={setDraftField}
              canEditWage={canEditSalary}
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
            <HRCommunicationsTab
              employee={employee}
              companyId={company.id}
              currentUser={currentUser}
              isSelf={isSelf}
              canReply={canReplyCommunication}
              data={data}
            />
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
          <section className="nv-paper" style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1EF" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "#111418" }}>{ar ? "سجل الملف" : "File log"}</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.75, marginTop: 3 }}>
                {ar ? "كل تغيير ظاهر باسم من أجراه ووقته. لا تعديل صامت." : "Every visible change names who made it and when. No silent edit."}
              </div>
            </div>
            {view.audit.length === 0 ? (
              <div style={{ padding: "16px 20px", fontSize: 12, color: MUTED }}>{ar ? "لا حركة مثبتة بعد." : "No written movement yet."}</div>
            ) : view.audit.map((row) => (
              <div key={`${row.text}-${row.at}`} style={{ padding: "12px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12, alignItems: "start" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: row.dot || "#3C7D50", marginTop: 6 }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "#111418", lineHeight: 1.8 }}>{row.text}</span>
                  <span style={{ fontSize: 10, color: MUTED }}>{row.by}</span>
                </span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{row.at}</span>
              </div>
            ))}
          </section>
        )}

        {(isSelf || (canManage && !isSelf) || canDeleteAccount) && (tab === "identity" || tab === "compliance") && (
          <IdentityCard
            kicker={ar ? "دخول المنصة" : "Platform access"}
            title={ar ? "إعدادات الحساب والدخول" : "Account and sign-in settings"}
            subtitle={ar
              ? "كلمة المرور وحذف الحساب أمر تشغيلي للمنصة — ليست مادة من نظام العمل."
              : "Password and account deletion are platform commands — not a Labour Law article."}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {isSelf && <AccountSettingsCard employee={employee} company={company} />}
              {canManage && !isSelf && <LoginAccessCard employee={employee} companyId={company.id} />}
              {canDeleteAccount && <DeleteEmployeeAccountCard employee={employee} companyId={company.id} />}
            </div>
          </IdentityCard>
        )}

      </div>
    </PlatformStampShell>
  );
}
