import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import ProfessionalInfoTab from "@/components/employees/ProfessionalInfoTab";
import CertificatesTab from "@/components/employees/CertificatesTab";
import SalaryTab from "@/components/employees/SalaryTab";
import LeaveTab from "@/components/employees/LeaveTab";
import HRCommunicationsTab from "@/components/employees/HRCommunicationsTab";
import DisciplineOnFile from "@/components/employees/DisciplineOnFile";
import ContractTab from "@/components/employees/ContractTab";
import LoginAccessCard from "@/components/employees/LoginAccessCard";
import AccountSettingsCard from "@/components/employees/AccountSettingsCard";
import DeleteEmployeeAccountCard from "@/components/employees/DeleteEmployeeAccountCard";
import OffboardingTab from "@/components/employees/OffboardingTab";
import EmpPointsTab from "@/components/employees/EmpPointsTab";
import EmpAlertsStrip from "@/components/employees/EmpAlertsStrip";
import AssignmentTab from "@/components/employees/AssignmentTab";
import { employeeJobGrade, gradesForList, orderedJobGrades, jobGradeLabel } from "@/lib/jobGrades";
import { BORDER, CARD, MUTED, NAVY, ui } from "@/lib/platformStyles";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import ErpSectionFrame from "@/components/erp/ErpSectionFrame";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { applyDueLaborRules } from "@/lib/store";

/** Primary file tabs — MHRSD order: identity register → contract → wage → leave → certs → org. */
const TABS = [
  { key: "professionalInfo", ar: "ملف الموظف", en: "Employee file", hintAr: "الهوية تؤكدها الهوية. المادة تظهر على الخيار الذي يستند إليها.", hintEn: "Nationality is confirmed by the ID. The article appears on the option that relies on it." },
  { key: "contract", ar: "عقد العمل", en: "Contract", hintAr: "المادة 75 للعقد غير المحدد، و55 للمحدد، و51 للنسخة المكتوبة. المادة 37 لغير السعودي فقط.", hintEn: "Article 75 for indefinite, 55 for fixed-term, 51 for the written copy. Article 37 is for non-Saudis only." },
  { key: "salary", ar: "الأجر", en: "Wage", hintAr: "المادة 93 لحد الحسم. التأمينات وحماية الأجور بلا شارة نظام.", hintEn: "Article 93 for the deduction cap. GOSI and WPS have no Labour Law chip." },
  { key: "leave", ar: "الإجازات", en: "Leave", hintAr: "كل نوع إجازة يستشهد بمادته السارية ونصّها المرمّز.", hintEn: "Each leave type cites its in-force article and encoded text." },
  { key: "certificates", ar: "الشهادات", en: "Certifications", hintAr: "الشهادات دليل مهني على الملف — ليست مادة مستقلة.", hintEn: "Certificates are professional evidence on the file — not a standalone article." },
  { key: "assignment", ar: "الإسناد", en: "Assignment", hintAr: "الإسناد من الهيكل. لا يُحرَّر الفرع من هذا الملف.", hintEn: "Assignment comes from the org tree. Branch is not edited on this file." },
];

function ApplyLaborOnFile({ companyId, employeeId }) {
  useEffect(() => {
    if (!companyId || !employeeId) return;
    applyDueLaborRules(companyId, employeeId);
  }, [companyId, employeeId]);
  return null;
}

export default function EmployeeProfile() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, dir, lang } = useI18n();
  const ar = lang === "ar" || dir === "rtl";
  const { data, currentUser, company } = useAuth();
  const wantComplete = searchParams.get("complete") === "1";
  const [tab, setTab] = useState("professionalInfo");
  const [autoEdit, setAutoEdit] = useState(wantComplete);

  if (!data || !currentUser) return null;
  const employee = (data.employees || []).find((e) => e.id === employeeId);
  if (!employee) {
    return (
      <p style={{ padding: "24px", fontSize: "13px", color: MUTED }}>—</p>
    );
  }

  const isSelf = currentUser.id === employee.id;
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
            : "This profile is private — you can only view your own profile. Colleagues' data is available to their managers and HR."}
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            marginTop: "16px",
            background: "none",
            border: "none",
            color: MUTED,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {t("back")}
        </button>
      </div>
    );
  }

  const canManageHRProfile = canManageEmployeeHR(currentUser, employee, data);
  const canManage = canManageEmployees(currentUser) || currentUser.role === "director" || currentUser.role === "ops_manager" || canManageHRProfile;
  const canEditGrade = isCompanyOwner(currentUser, data) || currentUser.role === "director" || hasHRPermission(currentUser, data, "manage_employees") || canManageHRProfile;
  const canEditSalary = canAdjustPayroll(currentUser, data);
  const canApproveLeave = canManage || hasHRPermission(currentUser, data, "manage_leave");
  const canApproveCerts = canManage || hasHRPermission(currentUser, data, "manage_leave");
  const canEditContract = canManageEmployeeContract(currentUser, employee, data);
  const canReplyCommunication = canManageEmployeeCommunication(currentUser, employee, data);
  const stationName = (data.stations || []).find((s) => s.id === employee.stationId)?.name;
  const fallbackPosition = employee.customTitle || getRoleLabel(company, employee.role, t);
  const grade = employeeJobGrade(employee, data);

  const sections = TABS.map((tb) => ({
    value: tb.key,
    label: ar ? tb.ar : tb.en,
    hint: ar ? tb.hintAr : tb.hintEn,
  }));

  return (
    <PlatformStampShell
      ar={ar}
      title={ar ? "ملف الموظف" : "Employee file"}
      hint={ar
        ? "الهوية ثم العقد ثم الأجر ثم الإجازة ثم الشهادات — نفس سلسلة الإثبات."
        : "Identity, then contract, then wage, then leave, then certificates — the same proof chain."}
      sections={sections}
      tool={tab}
      onTool={setTab}
      meta={(
        <button
          type="button"
          onClick={() => navigate("/app/hr")}
          style={{ ...ui.btnGhost, display: "flex", alignItems: "center", gap: "7px" }}
        >
          {ar ? "رجوع إلى الدليل" : "Back to directory"}
        </button>
      )}
      legal={ar
        ? "شارة المادة تظهر فقط إن كان المصدر نظام العمل. التأمينات وحماية الأجور تُشرح كنص تشغيلي بلا مادة مخترعة."
        : "The article chip appears only when the source is the Labour Law. GOSI and wage protection are explained as operational text, never an invented article."}
    >
      <ErpSectionFrame
        path="/app/hr"
        ar={ar}
        hideProof
        stats={[
          { label: ar ? "الموظف" : "Employee", value: employee.name?.split(" ")[0] || "—" },
          { label: ar ? "الفرع" : "Station", value: stationName || "—" },
          { label: ar ? "الدرجة" : "Grade", value: jobGradeLabel(grade) || "—" },
        ]}
      >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {canEditContract ? <ApplyLaborOnFile companyId={company.id} employeeId={employee.id} /> : null}
      <ProfileHero
        employee={employee}
        companyId={company.id}
        canEdit={isSelf || canManage}
        roleLabel={employee.profile?.position || fallbackPosition}
        grade={grade}
        stationName={stationName}
      />

      <EmpAlertsStrip employee={employee} lang={lang} />

      {!profileCompletionStats(employee).done && (
        <ProfileCompletionCard
          employee={employee}
          isSelf={isSelf}
          ar={ar}
          onContinue={() => {
            setTab("professionalInfo");
            setAutoEdit(canManage);
            if (wantComplete) {
              searchParams.delete("complete");
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}

      {tab === "assignment" && (
        <AssignmentTab
          employee={employee}
          companyId={company.id}
          lang={lang}
          canManage={canManage && !isSelf}
          stations={data.stations || []}
          currentUser={currentUser}
        />
      )}
      {tab === "professionalInfo" && (
        <ProfessionalInfoTab
          employee={employee}
          companyId={company.id}
          canEdit={canManage}
          isSelf={isSelf}
          canEditGrade={canEditGrade}
          grades={(() => {
            const listId = (data.smartPositions || []).find((item) => item.employeeId === employee.id)?.templateId
              || employee.profile?.listId
              || "";
            return listId ? gradesForList(data, listId) : orderedJobGrades(data);
          })()}
          fallbackPosition={fallbackPosition}
          stationName={stationName}
          autoEdit={autoEdit}
        />
      )}
      {tab === "certificates" && (
        <CertificatesTab
          employee={employee}
          companyId={company.id}
          canEdit={isSelf || canManage}
          canApprove={canApproveCerts}
          currentUser={currentUser}
        />
      )}
      {tab === "salary" && (
        <SalaryTab employee={employee} companyId={company.id} canEdit={canEditSalary} />
      )}
      {tab === "leave" && (
        <LeaveTab
          employee={employee}
          companyId={company.id}
          currentUser={currentUser}
          isSelf={isSelf}
          canApprove={canApproveLeave}
        />
      )}
      {tab === "contract" && (
        <ContractTab employee={employee} companyId={company.id} canEdit={canEditContract} />
      )}

      <IdentityCard
        kicker={ar ? "أمر إداري" : "Administrative command"}
        title={ar ? "السجل التأديبي والتواصل" : "Disciplinary record and communications"}
        subtitle={ar
          ? "الإنذار والتواصل يُحفظان في الملف. التحقيق والجزاء: اكتب الرسالة وأرفق الملف في محادثة الواقعة."
          : "Warnings and communications are kept on the file. Investigation and sanctions: write the message and attach the file in the case conversation."}
      >
        <DisciplineOnFile
          employee={employee}
          companyId={company.id}
          currentUser={currentUser}
          cases={data.disciplinaryCases || []}
          canManage={canManage && !isSelf}
          ar={ar}
        />
        <HRCommunicationsTab
          employee={employee}
          companyId={company.id}
          currentUser={currentUser}
          isSelf={isSelf}
          canReply={canReplyCommunication}
          data={data}
        />
      </IdentityCard>

      <IdentityCard
        kicker={ar ? "أمر إنهاء" : "End-of-service command"}
        title={ar ? "نهاية الخدمة" : "End of service"}
        subtitle={ar ? "الأمر يحسب المكافأة من مدة الخدمة وسبب الانتهاء." : "The command calculates the award from service length and the reason for ending."}
        meta={<LaborArticleCite ruleId="eos.gratuity.cite" ar={ar} />}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <LaborArticleCite ruleId="eos.gratuity.cite" ar={ar} showText />
          <EmpPointsTab employee={employee} data={data} lang={lang} />
          <OffboardingTab
            employee={employee}
            companyId={company.id}
            currentUser={currentUser}
            canManage={canManage && !isSelf}
          />
        </div>
      </IdentityCard>

      {(isSelf || (canManage && !isSelf) || canDeleteAccount) && (
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
      </ErpSectionFrame>
    </PlatformStampShell>
  );
}
