// Content of the official copyright registration document (SAIP) —
// program description + full source inventory + representative code excerpts.

export const AUTHOR = {
  nameAr: "نيار عبدالله سويلم الرنياوي",
  nameEn: "Niyar Abdullah Sweilem Al-Raniawi",
};

export const PROGRAM = {
  nameAr: "NiroVera — NiroVera",
  nameEn: "NiroVera",
};

export const DESCRIPTION_SECTIONS = [
  {
    title: "فكرة البرنامج",
    body: "«NiroVera» (NiroVera) منصة رقمية سحابية متكاملة لإدارة الشركات والموارد البشرية، صُممت لتمكين المؤسسات من إدارة موظفيها وفروع عملها ومهامها اليومية من مكان واحد. يقوم البرنامج على فكرة ربط الحضور الوظيفي بالموقع الجغرافي الفعلي للموظف: فلا يُقبل تسجيل الحضور إلا إذا كان الموظف داخل النطاق الجغرافي المحدد لمقر عمله، مع تحديد نطاق المسافة المسموح لكل فرع عمل على الخريطة. كما تدعم المنصة نمط «المساحة الشخصية» للأفراد، بأدوات إنتاجية شخصية وتجربة توقيع رقمي مستقلة.",
  },
  {
    title: "أولاً: نظام الحضور والانصراف الجغرافي",
    body: "حضور وانصراف مرتبط بالموقع الجغرافي (GPS) مع تحقق إلزامي من الموقع قبل القبول، وقياس المسافة عن مقر العمل بدقة الأمتار، وقبول الحضور في أي فرع مصرح بها للموظف (الأقرب أولاً). يشمل النظام: تسجيل حضور سريع بلمسة واحدة مع تهيئة مسبقة للـGPS عند فتح التطبيق، واحتساب التأخير بالدقائق مقارنة بجدول الوردية، وانصراف مبكر موثق، وأعذار معتمدة، وخرائط تفاعلية لمواقع الفروع، وتقارير شهرية وتحليلات، ومسح تلقائي يومي (Workflows) لرصد الغياب والتأخير وإرسال التنبيهات.",
  },
  {
    title: "ثانياً: نظام المهام والأهداف",
    body: "نظام مهام هرمي بمجلدات وأقسام قابلة للتخصيص لكل فرع، يدعم إسناد المهام لموظف أو لفريق فرع أو لفريق المقر الرئيسي، مع أولويات (عادي/عاجل)، وأهداف عددية بنسبة إنجاز محسوبة، وتصعيد تلقائي للمهام الحرجة عبر سلسلة الصلاحيات، وبلاغات توقف العمل، وأرشيف ذكي يصنف المهام المكتملة حسب مدتها (سنوية/نصفية/ربعية/شهرية)، وتعليقات بمرفقات ملفات وتسجيلات صوتية.",
  },
  {
    title: "ثالثاً: الموارد البشرية والرواتب",
    body: "هيكل موارد بشرية مرن بدرجات وظيفية ومستويات قابلة للتخصيص بالكامل (عدد الدرجات، المسميات، النطاقات)، يشكل سلسلة تصعيد رسمية للشكاوى والاعتراضات، مع نظام بلاغات مجهولة الهوية محمية بتشفير أحادي الاتجاه لا يمكن عكسه. وتشمل وحدة الرواتب: استيراد مسيرات الرواتب من ملفات CSV/Excel بمطابقة تلقائية عبر البريد الإلكتروني، وقوالب رواتب، وإدارة الإجازات بأنواعها وأرصدتها وطلباتها واعتمادها، وملفات موظفين شاملة (شهادات، معلومات مهنية، رسائل HR).",
  },
  {
    title: "رابعاً: السلامة المهنية (HSE) ومركز القيادة الذكي",
    body: "وحدة سلامة مهنية ترصد الحوادث والمخاطر المفتوحة وتصنف الفروع الحرجة، وتغذي «مركز القيادة الذكي» في لوحة التحكم: درجة مخاطر مُوزّنة (Weighted Risk Scoring) مستوحاة من مصفوفات المخاطر وفق ISO 45001، تجمع الغياب والتأخير وتوقف العمل والتقارير المعلقة وحوادث السلامة في نسبة استقرار واحدة، مع شفافية كاملة في طريقة الحساب وأوزان قابلة للمعايرة من مالك الشركة حسب طبيعة نشاطها، وتنبؤات مخاطر استباقية وملخصات يومية ذكية.",
  },
  {
    title: "خامساً: التوقيع الإلكتروني الموثق",
    body: "نظام توقيع إلكتروني للمستندات على مستوى احترافي: توقيع شخصي (كتابةً بخطوط فنية أو رسمًا باللمس) برقم تحقق مشفّر فريد بصيغة PWC-XXXX-XXXX-XXXX مشتق من بصمة SHA-256، وتوقيع متعدد الأطراف عبر روابط خاصة لكل موقّع دون حاجة لحساب، وتحديد موضع التوقيع بحرية على أي صفحة مع تكبير وتصغير باللمس، وختم شارة تحقق نهائية على المستند بعد اكتمال جميع التواقيع، وبصمة ملف نهائية (File Hash) تربط رقم التحقق بالملف الموقع حصراً، وصفحة تحقق عامة من صحة أي مستند.",
  },
  {
    title: "سادساً: المساعد الذكي «نيرو» والتواصل الداخلي",
    body: "مساعد ذكاء اصطناعي «نيرو» يجيب عن أسئلة الإدارة من بيانات الشركة الفعلية، ويولّد ملخصات يومية ذكية وتنبيهات استباقية واقتراحات قرارات، وينشئ ملفات ومستندات حسب الطلب. إضافة إلى نظام دردشة داخلي لكل فرع مع رسائل خاصة ومجموعات مخصصة ومرفقات ومعرض وسائط وبحث، وإشعارات بريدية عبر تكامل Gmail، ومزامنة مواعيد مع تقويم Google.",
  },
  {
    title: "سابعاً: التقارير والتعددية اللغوية والاشتراكات",
    body: "تقارير أداء ومقارنات بين الموظفين والفروع والمجموعات قابلة للتصدير PDF/Excel بهوية الشركة البصرية (شعار ولون مخصص)، ودعم 9 لغات مع اتجاه كتابة تلقائي (RTL) للعربية، ونظام اشتراكات بخطط أسعار (Starter/Professional/Enterprise) مع بوابة دفع إلكترونية Stripe وفترة تجريبية وتذكيرات تلقائية، ولوحة مالك للمنصة لإدارة المشتركين وإحصاءات الزوار.",
  },
  {
    title: "البنية التقنية والأمان",
    body: "بُني البرنامج بتقنية React مع Vite للواجهة الأمامية، وTailwind CSS لنظام التصميم، وقواعد بيانات سحابية (Supabase وBase44) للتخزين والمزامنة اللحظية، ووظائف خلفية (Backend Functions) بتقنية Deno للتكاملات الخارجية: البريد الإلكتروني عبر Gmail، وتقويم Google، وخدمات الموقع الجغرافي، وبوابة الدفع Stripe. يعتمد النظام عزلًا كاملًا لبيانات كل شركة (Multi-Tenancy)، وجلسات دخول مشفّرة برموز عشوائية منتهية الصلاحية، وتحققًا ثنائيًا إلزاميًا عبر رمز OTP بالبريد الإلكتروني لجميع الحسابات، وتخزين كلمات المرور بتجزئة PBKDF2 دون أي تخزين للنص الصريح، وسجل تدقيق (Audit Log) للعمليات الحساسة.",
  },
];

// Full source-code inventory — every file in the program (grouped).
export const FILE_TREE = [
  {
    group: "نواة التطبيق والإعدادات",
    files: ["src/App.jsx", "src/main.jsx", "src/index.css", "index.html", "tailwind.config.js", "vite.config.js", "package.json", "src/lib/query-client.js", "src/lib/utils.js", "src/lib/app-params.js", "src/lib/PageNotFound.jsx", "src/api/base44Client.js"],
  },
  {
    group: "الصفحات الرئيسية (Pages)",
    files: ["src/pages/Landing.jsx", "src/pages/Login.jsx", "src/pages/Register.jsx", "src/pages/ForgotPassword.jsx", "src/pages/ResetPassword.jsx", "src/pages/Dashboard.jsx", "src/pages/Operations.jsx", "src/pages/Complaints.jsx", "src/pages/OrgStructure.jsx", "src/pages/EmployeeProfile.jsx", "src/pages/HRStructureManagement.jsx", "src/pages/Payroll.jsx", "src/pages/Performance.jsx", "src/pages/Safety.jsx", "src/pages/Attendance.jsx", "src/pages/Files.jsx", "src/pages/FileSigning.jsx", "src/pages/WorkProof.jsx", "src/pages/Assistant.jsx", "src/pages/OwnerPanel.jsx", "src/pages/Pricing.jsx", "src/pages/PricingSuccess.jsx", "src/pages/Verify.jsx", "src/pages/PublicSign.jsx", "src/pages/About.jsx", "src/pages/Privacy.jsx", "src/pages/Security.jsx", "src/pages/Terms.jsx", "src/pages/PowerCarePresentation.jsx", "src/pages/CopyrightDoc.jsx"],
  },
  {
    group: "المنطق والمكتبات (Libraries)",
    files: ["src/lib/PowerCareAuth.jsx", "src/lib/store.js", "src/lib/i18n.jsx", "src/lib/i18nExtra.js", "src/lib/permissions.js", "src/lib/hrLevels.js", "src/lib/roles.js", "src/lib/escalation.js", "src/lib/attendance.js", "src/lib/geo.js", "src/lib/geocodeStations.js", "src/lib/leaveTypes.js", "src/lib/payroll.js", "src/lib/payrollTemplate.js", "src/lib/salaryImport.js", "src/lib/riskWeights.js", "src/lib/signPdf.js", "src/lib/multiSignStamp.js", "src/lib/verificationBadge.js", "src/lib/fileHash.js", "src/lib/signedReport.js", "src/lib/exportExcelColored.js", "src/lib/printReport.js", "src/lib/printDocument.js", "src/lib/pdfTheme.js", "src/lib/assistantActions.js", "src/lib/assistantContext.js", "src/lib/auditLog.js", "src/lib/emailAlerts.js", "src/lib/notificationRoute.js", "src/lib/notificationFilters.js", "src/lib/planLimits.js", "src/lib/trackVisit.js", "src/lib/dateFormat.js", "src/lib/mediaAccess.js", "src/lib/navVisibility.js"],
  },
  {
    group: "مكونات لوحة التحكم ومركز القيادة",
    files: ["src/components/dashboard/EmployeeDashboard.jsx", "src/components/dashboard/StationManagerDashboard.jsx", "src/components/dashboard/HandoffCommandBoard.jsx", "src/components/dashboard/OperationsModuleGrid.jsx", "src/components/dashboard/DashboardPersonaBar.jsx"],
  },
  {
    group: "مكونات الحضور والجدولة",
    files: ["src/components/attendance/QuickCheckInCard.jsx", "src/components/attendance/CheckInOutCard.jsx", "src/components/attendance/AttendanceDailyDashboard.jsx", "src/components/attendance/AttendanceMonthlyReport.jsx", "src/components/attendance/AttendanceMapDashboard.jsx", "src/components/attendance/AttendanceSettingsBoard.jsx", "src/components/attendance/AttendanceLeaveRequests.jsx", "src/components/attendance/LocationMapModal.jsx", "src/components/attendance/ScheduleTab.jsx", "src/components/attendance/TimeFormatToggle.jsx", "src/components/schedules/StationScheduleEditor.jsx", "src/components/schedules/ScheduleCell.jsx", "src/components/schedules/ScheduleStatsBar.jsx"],
  },
  {
    group: "مكونات المهام والتقارير والأداء",
    files: ["src/components/tasks/OpsTasksTable.jsx", "src/components/tasks/OpsNewTaskModal.jsx", "src/components/tasks/OpsTaskDetail.jsx", "src/components/tasks/OpsToolbarStrip.jsx", "src/components/tasks/CommentFiles.jsx", "src/components/tasks/VoiceRecorder.jsx", "src/components/reports/ReportLibraryBoard.jsx", "src/components/performance/PerfScoreBoard.jsx", "src/components/performance/JobObjectiveBoard.jsx", "src/components/safety/StationSafetyCard.jsx"],
  },
  {
    group: "مكونات الموارد البشرية والموظفين",
    files: ["src/components/hr/FlexOrgTree.jsx", "src/components/hr/HrDirectoryBoard.jsx", "src/components/hr/OrgStructureBoard.jsx", "src/components/hr/ComplianceMhrsdBoard.jsx", "src/components/employees/ProfileHero.jsx", "src/components/employees/ProfessionalInfoTab.jsx", "src/components/employees/CertificatesTab.jsx", "src/components/employees/SalaryTab.jsx", "src/components/employees/LeaveTab.jsx", "src/components/employees/LeaveBalanceCard.jsx", "src/components/employees/LeaveTotalsEditor.jsx", "src/components/employees/HRCommunicationsTab.jsx", "src/components/employees/PresenceStatusPicker.jsx", "src/components/employees/ContractTab.jsx", "src/components/payroll/PayrollRow.jsx", "src/components/payroll/PayrollTemplateCard.jsx"],
  },
  {
    group: "مكونات التوقيع الإلكتروني والملفات",
    files: ["src/components/files/StampStudio.jsx", "src/lib/stampStudio.js", "src/components/files/SigningHome.jsx", "src/components/files/SignaturePad.jsx", "src/components/files/TypedSignature.jsx", "src/components/files/SigningWorkspace.jsx", "src/components/files/SigningWorkspacePages.jsx", "src/components/files/SigningStatusBoard.jsx", "src/components/files/SigningArchiveBoard.jsx", "src/components/files/VerifyDocumentCard.jsx", "src/components/files/FolderCard.jsx", "src/components/files/FileRow.jsx"],
  },
  {
    group: "مكونات الدردشة والمساعد الذكي والجوال",
    files: ["src/components/assistant/AssistantMessage.jsx", "src/components/assistant/VoiceControl.jsx", "src/components/assistant/SuggestedQuestions.jsx", "src/components/mobile/BottomTabBar.jsx", "src/components/mobile/PullToRefresh.jsx", "src/components/mobile/MobileSelect.jsx", "src/components/mobile/BackButton.jsx", "src/components/Layout.jsx", "src/components/Logo.jsx"],
  },
  {
    group: "الوظائف الخلفية والأتمتة (Backend & Workflows)",
    files: ["base44/functions/supabaseAttendance/entry.ts", "base44/functions/supabaseTargets/entry.ts", "base44/functions/companyDirectory/entry.ts", "base44/functions/signedDocs/entry.ts", "base44/functions/multiSign/entry.ts", "base44/functions/gmailNotify/entry.ts", "base44/functions/calendarSync/entry.ts", "base44/functions/googleGeolocate/entry.ts", "base44/functions/stripeCheckout/entry.ts", "base44/functions/subscriberEmails/entry.ts", "base44/functions/subscriptionOverview/entry.ts", "base44/functions/pageVisits/entry.ts", "base44/functions/uiTranslations/entry.ts", "base44/functions/weeklySummary/entry.ts", "base44/functions/seedDemoCompany/entry.ts", "base44/workflows/AttendanceAbsentSweep.jsonc", "base44/workflows/AttendanceLateAlertSweep.jsonc", "base44/workflows/TaskEscalationSweep.jsonc", "base44/workflows/TrialReminderSweep.jsonc", "base44/workflows/WeeklyOwnerSummary.jsonc"],
  },
  {
    group: "نماذج قاعدة البيانات (Entities)",
    files: ["CompanyAccount", "CompanySession", "Employee", "EmployeeCredential", "LoginOtp", "Station", "CompanyDataBlob", "SignedDocument", "SignatureRequest", "AuditLog", "SyncSignal", "PageVisit", "ProductFeedback", "UiTranslation"],
  },
];

// Representative source-code excerpts (the full source exceeds 250 files).
export const CODE_FILES = [
  {
    name: "src/App.jsx — موجّه التطبيق الرئيسي (Application Router)",
    code: `import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider as PowerCareAuthProvider, useAuth as usePowerCareAuth } from '@/lib/PowerCareAuth';
import Layout from '@/components/Layout';
import { lazy, Suspense } from 'react';
import Landing from './pages/Landing';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Operations = lazy(() => import('./pages/Operations'));
const Attendance = lazy(() => import('./pages/Attendance'));
const FileSigning = lazy(() => import('./pages/FileSigning'));
const HRStructureManagement = lazy(() => import('./pages/HRStructureManagement'));

function RequireAuth({ children }) {
  const { session } = useNiroVeraAuth();
  if (!session) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/sign" element={<PublicSign />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/app/tasks" element={<RequireAuth><Operations /></RequireAuth>} />
        <Route path="/app/attendance" element={<RequireAuth><Attendance /></RequireAuth>} />
        <Route path="/app/signing" element={<RequireAuth><FileSigning /></RequireAuth>} />
        <Route path="/app/hr" element={<RequireAuth><HRStructureManagement /></RequireAuth>} />
      </Routes>
    </Suspense>
  );
}`,
  },
  {
    name: "src/lib/riskWeights.js — أوزان المخاطر القابلة للمعايرة (مركز القيادة الذكي)",
    code: `// Configurable risk weights for the Command Center stability score.
// Owners can override these per-company (stored in data.settings.riskWeights).
export const DEFAULT_RISK_WEIGHTS = {
  absent: 8,        // absent employee today
  delayed: 12,      // delayed / due-soon task
  stoppage: 18,     // task stoppage issue
  reports: 4,       // pending daily report
  critical: 20,     // critical (red) safety station
  incidents: 15,    // safety incident in last 30 days
  hazards: 6,       // open safety hazard
};

export function getRiskWeights(data) {
  return { ...DEFAULT_RISK_WEIGHTS, ...(data?.settings?.riskWeights || {}) };
}

// Dashboard usage — weighted risk scoring (ISO 45001-style risk matrix):
const riskScore = Math.min(100, Math.round(
  (absentCount * w.absent) + (delayedTasks * w.delayed) +
  (stoppageCount * w.stoppage) + (pendingReports * w.reports) +
  (criticalStations * w.critical) + (recentIncidents * w.incidents) +
  (openHazards * w.hazards)
));
const stabilityScore = 100 - riskScore;`,
  },
  {
    name: "src/components/attendance/CheckInOutCard.jsx — الحضور المرتبط بالموقع الجغرافي",
    code: `const handleCheckIn = async () => {
  setError("");
  setLoading(true);
  try {
    // Location is MANDATORY before check-in — no location, no check-in.
    const coords = await getAccuratePosition();
    if (!coords) {
      setError(t("locationDenied"));
      setLoading(false);
      return;
    }
    const res = await base44.functions.invoke("supabaseAttendance", {
      action: "checkIn",
      companyId: company.id,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      stationId: currentUser.stationId || null,
      lat: coords?.lat, lng: coords?.lng,
      accuracy: coords?.accuracy ?? null,
      shiftStart: shift?.start,
      stationLat: station?.lat ?? null,
      stationLng: station?.lng ?? null,
      radiusMeters: station?.radiusMeters ?? null,
    });
    const att = res?.data?.attendance;
    if (att) { setAttendance(att); onStatusChange?.(att); }
  } catch (err) {
    const code = err?.response?.data?.error;
    setError(code === "GPS_REQUIRED" ? t("locationDenied")
      : code === "OUTSIDE_STATION" ? t("outsideLocation")
      : (code || "Failed to check in"));
  } finally {
    setLoading(false);
  }
};`,
  },
  {
    name: "src/components/files/StampStudio.jsx — التوقيع الإلكتروني برقم تحقق مشفّر",
    code: `// DocuSign-style unique signature ID: a non-reversible SHA-256 hash of the
// signer + timestamp, formatted as PWC-XXXX-XXXX-XXXX for verification.
async function generateSignatureId(userId) {
  const data = new TextEncoder().encode(\`\${userId}::\${Date.now()}::\${Math.random()}\`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return \`PWC-\${hex.slice(0, 4)}-\${hex.slice(4, 8)}-\${hex.slice(8, 12)}\`;
}

const saveSignature = async (dataUrl, typedName) => {
  setSaving(true);
  try {
    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], "signature.png", { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const sigId = await generateSignatureId(currentUser.id);
    const savedProfile = {
      signatureUrl: file_url,
      signatureId: sigId,
      signatureName: typedName || currentUser.name,
      signatureUpdatedAt: new Date().toISOString(),
    };
    updateEmployeeProfile(companyId, currentUser.id, savedProfile);
    onSaved?.(savedProfile);
    setEditing(false);
  } finally {
    setSaving(false);
  }
};`,
  },
  {
    name: "src/components/mobile/PullToRefresh.jsx — إيماءة السحب للتحديث (تجربة تطبيق أصلي)",
    code: `// Native-style pull-to-refresh: swipe down from the top of the page to
// trigger onRefresh. touchmove is registered { passive: false } so
// preventDefault() suppresses the native overscroll only while dragging
// down from the very top (window.scrollY === 0).
const onTouchMove = (e) => {
  if (startY.current == null || refreshingRef.current) return;
  if (window.scrollY !== 0) { reset(); return; }
  const dy = e.touches[0].clientY - startY.current;
  if (dy > 0) {
    pulling.current = true;
    if (e.cancelable) e.preventDefault();
    setPullBoth(Math.min(dy * 0.4, 90));
  } else if (!pulling.current) {
    startY.current = null;
  }
};

const onTouchEnd = async () => {
  const finalPull = pullRef.current;
  startY.current = null;
  if (finalPull >= 45) {
    refreshingRef.current = true;
    setRefreshing(true);
    try { await onRefreshRef.current?.(); } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPullBoth(0);
    }
  } else {
    setPullBoth(0);
  }
};`,
  },
  {
    name: "src/lib/sectionGuides.js — نظام الشروحات التفاعلية لكل قسم",
    code: `// Per-section usage guides shown at the top of every app page.
const GUIDES = {
  "/app/attendance": {
    ar: ["سجّل حضورك بزر «تسجيل حضور» — قد يُطلب تحديد موقعك للتحقق من وجودك في المقر.",
         "من «الإعدادات» حدد مواقع المقرات على الخريطة ونطاق المسافة المسموح."],
    en: ["Check in with the Check-In button — GPS verifies you are on site.",
         "In Settings, set workplace locations and the allowed radius."],
  },
  "/app/signing": {
    ar: ["احفظ توقيعك مرة واحدة — يحصل على رقم تحقق مشفّر فريد.",
         "في «توقيع» تحدّد من يوقّع الملف: أنت وحدك أو عدة أطراف، ولكل طرف رابطه الخاص.",
         "لو رفض أحد الموقّعين لا يتوقف الملف — يواصل الباقون، ويُغلق بحالة «مكتمل مع رفض» مع تسجيل السبب."],
    en: ["Save your signature once — it gets a unique encrypted ID.",
         "In Sign you decide who signs the file: you alone or several parties, each with their own link.",
         "If a signer refuses the file does not stop — the rest continue, and it closes as “completed with refusal” with the reason recorded."],
  },
};

export function getGuide(pathname, lang) {
  const guide = GUIDES[pathname];
  if (!guide) return null;
  return lang === "ar" ? guide.ar : guide.en;
}`,
  },
];