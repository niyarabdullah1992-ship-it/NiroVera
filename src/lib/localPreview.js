import {
  activateCompanySession,
  getSession,
  setSession,
} from "@/lib/store";
import { appParams } from "@/lib/app-params";

export const LOCAL_PREVIEW_COMPANY_ID = "local-preview-nirovera";
export const LOCAL_PREVIEW_FLAG = "powercare_local_preview";

/** Demo branch labels — free names, not a forced East/West region layer. */
const PREVIEW_BRANCH_RENAMES = {
  "الفرع الشمالية": "فرع الخفجي",
  "الفرع الشرقية": "فرع رابغ",
  "North Station": "Khafji Branch",
  "East Station": "Rabigh Branch",
};

/** Rewrite legacy compass demo names on already-seeded local preview data. */
export function migratePreviewBranchNames(data) {
  if (!data?.stations?.length) return data;
  let changed = false;
  const stations = data.stations.map((st) => {
    const next = PREVIEW_BRANCH_RENAMES[st.name];
    if (!next || next === st.name) return st;
    changed = true;
    return { ...st, name: next };
  });
  if (!changed) return data;
  const tasks = (data.tasks || []).map((t) => {
    let title = t.title || "";
    for (const [from, to] of Object.entries(PREVIEW_BRANCH_RENAMES)) {
      if (title.includes(from)) title = title.split(from).join(to);
    }
    return title === t.title ? t : { ...t, title };
  });
  return { ...data, stations, tasks };
}

export function isBase44BackendConfigured() {
  return Boolean(appParams.appBaseUrl && String(appParams.appId || "").trim());
}

export function isLocalPreviewActive() {
  try {
    return localStorage.getItem(LOCAL_PREVIEW_FLAG) === "1";
  } catch {
    return false;
  }
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

/**
 * Seeds a rich local workspace and opens a director session
 * so /app works without Base44 cloud auth.
 */
export function enterLocalPreview() {
  const companyId = LOCAL_PREVIEW_COMPANY_ID;
  const stationNorth = "st_north_preview";
  const stationEast = "st_east_preview";
  const ownerId = "emp_owner_preview";
  const managerId = "emp_manager_preview";
  const employeeId = "emp_field_preview";
  const hseId = "emp_hse_preview";
  const now = new Date().toISOString();

  const regKey = "powercare_registry";
  let registry = { companies: [] };
  try {
    registry = JSON.parse(localStorage.getItem(regKey) || '{"companies":[]}');
    if (!registry.companies) registry.companies = [];
  } catch {
    registry = { companies: [] };
  }

  const meta = {
    id: companyId,
    name: "NiroVera Preview",
    ownerEmail: "preview@nirovera.local",
    plan: "enterprise",
    allowedEmailDomain: "",
    createdAt: now,
    subscriptionStart: now,
    subscriptionEnd: null,
    subscriptionExempt: true,
  };
  const idx = registry.companies.findIndex((c) => c.id === companyId);
  if (idx >= 0) registry.companies[idx] = { ...registry.companies[idx], ...meta };
  else registry.companies.push(meta);
  localStorage.setItem(regKey, JSON.stringify(registry));

  const data = {
    id: companyId,
    name: meta.name,
    plan: "enterprise",
    directorId: ownerId,
    ownerId,
    stations: [
      { id: stationNorth, name: "فرع الخفجي", createdAt: now, managerId },
      { id: stationEast, name: "فرع رابغ", createdAt: now },
    ],
    employees: [
      {
        id: ownerId,
        name: "نيار عبدالله",
        email: "preview@nirovera.local",
        role: "director",
        stationId: stationNorth,
        managedStations: [stationNorth, stationEast],
        phone: "0595414472",
        anonymousId: "a_owner",
        createdAt: now,
        leaveRequests: [],
        profile: { satisfactionScore: 92 },
      },
      {
        id: managerId,
        name: "أحمد السالم",
        email: "ahmed@nirovera.local",
        role: "station_manager",
        stationId: stationNorth,
        phone: "",
        anonymousId: "a_mgr",
        createdAt: now,
        managedStations: [stationNorth],
        leaveRequests: [{ id: "lv_1", status: "pending", type: "annual" }],
        profile: { satisfactionScore: 88 },
      },
      {
        id: employeeId,
        name: "عمر ناصر",
        email: "omar@nirovera.local",
        role: "employee",
        stationId: stationNorth,
        attendanceStatus: "absent",
        phone: "",
        anonymousId: "a_emp",
        createdAt: now,
        leaveRequests: [],
        profile: {
          satisfactionScore: 81,
          nationality: "مصري",
          idType: "iqama",
          nationalId: "2000000001",
          idExpiry: "2026-10-20",
          passportExpiry: "2026-08-01",
          medicalInsuranceExpiry: "2026-09-20",
          hireDate: "2020-01-15",
          birthDate: "1990-05-01",
        },
        certificates: [
          { id: "cert_fa_preview", name: "الإسعافات الأولية", code: "fa", expiryDate: "2026-10-01", status: "approved" },
        ],
        docs: [
          { kind: "driving_licence", number: "DL-1", expiryDate: "2026-09-30" },
        ],
      },
      {
        id: hseId,
        name: "سارة حسن",
        email: "sara@nirovera.local",
        role: "safety_officer",
        stationId: stationEast,
        phone: "",
        anonymousId: "a_hse",
        createdAt: now,
        leaveRequests: [],
        profile: { satisfactionScore: 90 },
      },
    ],
    tasks: [
      {
        id: "tk_1",
        ref: "LOC-001",
        title: "فحص وصيانة مضخات الخط الثالث",
        status: "active",
        stationId: stationNorth,
        assignedTo: employeeId,
        ownerId: employeeId,
        priority: "high",
        effortWeight: 4,
        weight: 4,
        workKind: "cm",
        mode: "onsite",
        completedCount: 34,
        completed_tasks: 34,
        targetCount: 50,
        task_target: 50,
        planHorizon: "w",
        createdAt: now,
        dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
      },
      {
        id: "tk_2",
        ref: "LOC-002",
        title: "تحديث لوحات السلامة",
        status: "active",
        stationId: stationEast,
        assignedTo: hseId,
        ownerId: hseId,
        priority: "medium",
        effortWeight: 2,
        weight: 2,
        workKind: "pm",
        mode: "onsite",
        completedCount: 0,
        completed_tasks: 0,
        targetCount: 1,
        task_target: 1,
        planHorizon: "w",
        createdAt: now,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: "tk_3",
        ref: "LOC-003",
        title: "قراءة العداد الشهرية",
        status: "completed",
        approvedAt: now,
        stationId: stationNorth,
        assignedTo: employeeId,
        ownerId: employeeId,
        priority: "low",
        effortWeight: 1,
        weight: 1,
        workKind: "pm",
        mode: "remote",
        completedCount: 1,
        completed_tasks: 1,
        targetCount: 1,
        task_target: 1,
        planHorizon: "m",
        attestation: "أُنجزت القراءة الميدانية وفق الجدول",
        createdAt: now,
        dueAt: now,
      },
      {
        id: "tk_4",
        ref: "LOC-004",
        title: "جولة سلامة أسبوعية — فرع الخفجي",
        status: "active",
        stationId: stationNorth,
        assignedTo: managerId,
        ownerId: managerId,
        priority: "medium",
        effortWeight: 3,
        workKind: "cp",
        mode: "onsite",
        completedCount: 0,
        targetCount: 1,
        planHorizon: "w",
        createdAt: now,
        dueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      },
    ],
    reports: [
      {
        id: "rp_1",
        kind: "daily",
        title: "تقرير وردية صباحية",
        status: "pending",
        stationId: stationNorth,
        dateKey: (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })(),
        filedAt: "13:10",
        filedBy: "أحمد السالم",
        note: "الوردية مستقرة · مضخة الخط الثالث تحت الصيانة",
        approved: false,
        createdAt: now,
      },
      {
        id: "rp_2",
        kind: "daily",
        title: "تقرير وردية — الشرقية",
        status: "missing",
        stationId: stationEast,
        dateKey: (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })(),
        filedAt: null,
        approved: false,
        createdAt: now,
      },
    ],
    anonymousReports: [
      { id: "an_1", type: "suggestion", priority: "medium", status: "open", stationId: stationNorth, createdAt: now },
    ],
    publicReports: [],
    safety: [
      {
        id: "sf_1",
        stationId: stationNorth,
        level: "yellow",
        hazards: [{ id: "hz_1", title: "عمل على ارتفاع", severity: 3, likelihood: 3, status: "open" }],
        incidentLog: [
          { at: now, description: "شبه حادثة — سقوط أداة من السقالة", reporter: "سارة حسن" },
        ],
        daysWithoutIncident: 12,
      },
      {
        id: "sf_2",
        stationId: stationEast,
        level: "green",
        hazards: [],
        incidentLog: [],
        daysWithoutIncident: 45,
      },
    ],
    files: [
      { id: "fld_contracts", type: "folder", name: "العقود", stationId: stationNorth, parentId: null, createdAt: now },
      { id: "fld_hse", type: "folder", name: "السلامة", stationId: stationEast, parentId: null, createdAt: now },
      { id: "fl_1", type: "file", name: "عقد عمل — نموذج.pdf", stationId: stationNorth, parentId: "fld_contracts", createdAt: now },
      { id: "fl_2", type: "file", name: "تصريح عمل مرتفعات.pdf", stationId: stationEast, parentId: "fld_hse", createdAt: now },
      {
        id: "fl_municipality",
        type: "file",
        name: "رخصة البلدية",
        stationId: stationNorth,
        parentId: "fld_contracts",
        createdAt: now,
        validFrom: "2025-01-01",
        validUntil: "2026-09-15",
      },
    ],
    plans: [],
    notifications: [
      { id: "nt_1", userId: ownerId, title: "طلب إجازة بانتظار الاعتماد", read: false, createdAt: now },
    ],
    templates: [],
    targets: [],
    hrLevels: [],
    jobGrades: [],
    hrClusters: [],
    schedules: (() => {
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return [
        {
          id: "sch_1",
          stationId: stationNorth,
          published: true,
          shiftTypes: [{ id: "morning", start: "07:00", end: "15:00", label: "صباحي" }],
          assignments: {
            [dateKey]: { morning: [ownerId, managerId, employeeId] },
          },
        },
        {
          id: "sch_2",
          stationId: stationEast,
          published: true,
          shiftTypes: [{ id: "morning", start: "07:00", end: "15:00", label: "صباحي" }],
          assignments: {
            [dateKey]: { morning: [hseId] },
          },
        },
      ];
    })(),
    stationChatGroups: [],
    personalPlaces: [],
    personalAttendance: [],
    attendanceSettings: { schedule_required: false, gps_enabled: false },
    plannerItems: [],
    journalEntries: [],
    payrollRuns: [{
      id: "pr_1",
      month: "2026-08",
      status: "ready",
      createdAt: now,
      items: [
        { id: "pi_1", employeeId: ownerId, employeeName: "نيار عبدالله", employeeStationId: null, base: 18000, allowances: 3000, bonus: 0, deductions: 0, currency: "SAR", paid: false },
        { id: "pi_2", employeeId: managerId, employeeName: "أحمد السالم", employeeStationId: stationNorth, base: 12000, allowances: 2500, bonus: 500, deductions: 200, currency: "SAR", paid: false },
        { id: "pi_3", employeeId, employeeName: "عمر ناصر", employeeStationId: stationNorth, base: 7500, allowances: 1500, bonus: 0, deductions: 0, currency: "SAR", paid: false },
        { id: "pi_4", employeeId: hseId, employeeName: "سارة حسن", employeeStationId: stationEast, base: 9000, allowances: 1800, bonus: 0, deductions: 0, currency: "SAR", paid: false },
      ],
    }],
    payroll: [{ id: "py_1", month: "2026-08" }],
    orgTree: [
      { id: "org_owner", type: "employee", refId: ownerId, title: "المدير", parentId: null, order: 0 },
      { id: "org_mgr", type: "employee", refId: managerId, title: "مدير الفرع", parentId: "org_owner", order: 0 },
      { id: "org_st_n", type: "station", refId: stationNorth, title: "فرع الخفجي", parentId: "org_mgr", order: 0 },
      { id: "org_hse", type: "employee", refId: hseId, title: "سلامة الفرع", parentId: "org_owner", order: 1 },
      { id: "org_st_e", type: "station", refId: stationEast, title: "فرع رابغ", parentId: "org_hse", order: 0 },
      { id: "org_field", type: "employee", refId: employeeId, title: "فني", parentId: "org_st_n", order: 0 },
    ],
    smartPositions: [],
    orgSeats: [
      {
        id: "seat_vac_tech",
        title: "فني تشغيل",
        stationId: stationNorth,
        listId: "field",
        gradeId: "",
        employeeId: null,
        approverId: managerId,
        salaryMin: null,
        salaryMax: null,
        createdAt: now,
      },
    ],
    complaintEscalationChain: [],
    signatureRequests: [{
      id: "sg_1",
      status: "pending",
      title: "شهادة إنجاز — فحص المضخات",
      source: "workproof",
      createdAt: now,
      stationId: stationNorth,
    }],
    signedDocuments: [{
      id: "sd_1",
      title: "قرار إجازة — أحمد السالم",
      source: "leave",
      status: "signed",
      sealId: "NV-SIG-A1B2-C3D4",
      signedAt: now,
      stationId: stationNorth,
    }],
    expenses: [
      {
        id: "ex_1",
        status: "submitted",
        amount: 450,
        afterTaxAmount: 450,
        beforeTaxAmount: 450,
        taxAmount: 0,
        stationId: stationNorth,
        stationIds: [stationNorth],
        title: "قطع غيار مضخة",
        description: "قطع غيار مضخة",
        expenseType: "tools_equipment",
        requesterName: "عمر ناصر",
        expenseDate: now.slice(0, 10),
        currency: "SAR",
        receiptUrl: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="#F7F8FA"/><text x="24" y="48" font-size="18" fill="#14284B">إيصال — قطع غيار</text><text x="24" y="80" font-size="13" fill="#5A6B85">450 SAR</text></svg>'),
        createdAt: now,
      },
      {
        id: "ex_2",
        status: "finance_approved",
        amount: 120,
        afterTaxAmount: 120,
        beforeTaxAmount: 120,
        taxAmount: 0,
        stationId: stationEast,
        stationIds: [stationEast],
        title: "مستلزمات سلامة",
        description: "مستلزمات سلامة",
        expenseType: "tools_equipment",
        requesterName: "سارة حسن",
        expenseDate: now.slice(0, 10),
        currency: "SAR",
        receiptUrl: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="#F7F8FA"/><text x="24" y="48" font-size="18" fill="#14284B">إيصال — سلامة</text><text x="24" y="80" font-size="13" fill="#5A6B85">120 SAR</text></svg>'),
        createdAt: now,
      },
    ],
    expenseClaims: [],
    stationBudgets: [
      { stationId: stationNorth, stationName: "فرع الخفجي", limit: 50000, currency: "SAR" },
      { stationId: stationEast, stationName: "فرع رابغ", limit: 40000, currency: "SAR" },
    ],
    inventory: [{ id: "inv_1", name: "قفازات عازلة", qty: 24, stationId: stationNorth, itemCode: "PPE-0120", minimumStock: 20 }],
    inventoryItems: [
      { id: "ivi_1", name: "قاطع 32A", itemCode: "BRK-32A", qty: 3, stationId: stationNorth, minQty: 5, leadDays: 10 },
      { id: "ivi_2", name: "كبل XLPE 4×95", itemCode: "CBL-495", qty: 12, stationId: stationEast, minQty: 4, leadDays: 14 },
    ],
    messages: [
      { id: "ms_1", text: "اكتمل الفحص", stationId: stationNorth, createdAt: now },
      { id: "ms_2", text: "يرجى مراجعة تصريح العمل", stationId: stationEast, createdAt: now },
    ],
    settings: { rateLimitDaily: 3, rateLimitWeekly: 10, rateLimitMonthly: 30 },
    reportBranding: {},
  };

  localStorage.setItem(`powercare_company_${companyId}`, JSON.stringify(data));
  localStorage.setItem(LOCAL_PREVIEW_FLAG, "1");

  // Prefer direct session write — avoids cloud email side-effects in ensureOwnerUser path.
  try {
    setSession({ companyId, userId: ownerId });
  } catch {
    localStorage.setItem("powercare_session", JSON.stringify({ companyId, userId: ownerId }));
  }

  // Keep activate as a soft fallback if session helpers change.
  try {
    if (!getSession()?.userId) activateCompanySession(meta);
  } catch {
    localStorage.setItem("powercare_session", JSON.stringify({ companyId, userId: ownerId }));
  }

  return { companyId, userId: ownerId };
}

export function exitLocalPreview() {
  try {
    localStorage.removeItem(LOCAL_PREVIEW_FLAG);
  } catch {
    // ignore
  }
}
