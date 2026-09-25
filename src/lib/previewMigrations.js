import { isSigningDeskNotice } from "./notificationKind.js";
import { seatCompanyHeadOnRoot } from "./peopleTreeGraph.js";
import { addDays, weekDateKeys, weekKeyFromDate, weekStartDate } from "./shiftWeek.js";
import { companyRootStation } from "./stationTree.js";
export { applyPreviewStationPin, migratePreviewStationPins, PREVIEW_STATION_PINS } from "./previewStationPins.js";

/** Preview-only clock/proof seeds. Kept out of store↔localPreview to avoid a cycle. */

export function previewTodayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** رأس المنشأة lives on the company root, not a child branch leftover from the first seed. */
export function migratePreviewCompanyHeadWorkplace(data) {
  return seatCompanyHeadOnRoot(data);
}

/**
 * Preview voice / branch review: نيار عبدالله is مدير الفرع on فرع الخفجي
 * (stations[].managerId). Older seeds had أحمد السالم there.
 */
export function migratePreviewVoiceBranchManager(data) {
  if (!data || data.previewVoiceBranchManagerNiyar) return false;
  const stations = Array.isArray(data.stations) ? data.stations : [];
  const people = Array.isArray(data.employees) ? data.employees : [];
  const north = stations.find((row) => row.id === "st_north_preview")
    || stations.find((row) => String(row.name || "").includes("الخفجي"));
  const owner = people.find((row) => row.id === "emp_owner_preview")
    || people.find((row) => row.id === data.ownerId)
    || people.find((row) => row.role === "director");
  const ahmed = people.find((row) => row.id === "emp_manager_preview")
    || people.find((row) => row.name === "أحمد السالم");
  if (!north?.id || !owner?.id) {
    data.previewVoiceBranchManagerNiyar = true;
    return false;
  }
  let changed = false;
  if (String(north.managerId || "") !== String(owner.id)) {
    north.managerId = owner.id;
    changed = true;
  }
  const northId = String(north.id);
  const owned = new Set((owner.managedStations || []).map(String));
  if (!owned.has(northId)) {
    owner.managedStations = [...owned, northId];
    changed = true;
  }
  if (ahmed && String(ahmed.id) !== String(owner.id)) {
    const nextManaged = (ahmed.managedStations || []).map(String).filter((id) => id !== northId);
    if (nextManaged.length !== (ahmed.managedStations || []).length) {
      ahmed.managedStations = nextManaged;
      changed = true;
    }
    if (ahmed.role === "station_manager" && !nextManaged.length) {
      ahmed.role = "employee";
      changed = true;
    }
  }
  const orgMgr = (data.orgTree || []).find((row) => row.id === "org_mgr");
  if (orgMgr && orgMgr.title === "مدير الفرع" && String(orgMgr.refId) !== String(owner.id)) {
    orgMgr.title = "مشرف تشغيل";
    changed = true;
  }
  const seat = (data.orgSeats || []).find((row) => row.id === "seat_vac_tech");
  if (seat && String(seat.approverId || "") === String(ahmed?.id || "")) {
    seat.approverId = owner.id;
    changed = true;
  }
  data.previewVoiceBranchManagerNiyar = true;
  return changed;
}

/**
 * Preview fixtures authored as open-air work, seeded before `mode` had a place
 * for it. Only these known demo ids are corrected — a store's own tasks keep
 * whatever their supervisor stated, since nobody can tell after the fact where
 * the hands actually were.
 */
const PREVIEW_FIELD_TASK_IDS = ["tk_1", "tk_4", "tk_preview_group"];

export function migratePreviewFieldTasks(data) {
  const list = Array.isArray(data?.tasks) ? data.tasks : [];
  if (!list.length) return false;
  let changed = false;
  data.tasks = list.map((task) => {
    if (!PREVIEW_FIELD_TASK_IDS.includes(String(task?.id || ""))) return task;
    if (task.mode === "field") return task;
    changed = true;
    return { ...task, mode: "field" };
  });
  return changed;
}

export function migratePreviewSigningNotices(data) {
  const list = Array.isArray(data?.notifications) ? data.notifications : [];
  if (!list.length) return false;
  const next = list.filter((row) => {
    if (String(row?.id || "").startsWith("nt_sign_")) return false;
    return !isSigningDeskNotice(row?.text);
  });
  if (next.length === list.length) return false;
  data.notifications = next;
  return true;
}

export function migratePreviewRotaClock(data, today = previewTodayKey()) {
  if (!data?.schedules?.length) return false;
  let changed = false;
  for (const schedule of data.schedules) {
    const assignments = schedule.assignments && typeof schedule.assignments === "object" ? { ...schedule.assignments } : {};
    let dirty = false;
    if (!assignments[today]) {
      const keys = Object.keys(assignments).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
      const last = keys[keys.length - 1];
      if (last) {
        assignments[today] = assignments[last];
        dirty = true;
      }
    }
    const template = assignments[today] || Object.values(assignments).find((value) => value && typeof value === "object" && !Array.isArray(value));
    if (template) {
      for (let weekday = 0; weekday <= 4; weekday += 1) {
        if (!assignments[weekday] && !assignments[String(weekday)]) {
          assignments[weekday] = template;
          dirty = true;
        }
      }
    }
    if (dirty) {
      schedule.assignments = assignments;
      changed = true;
    }
  }
  return changed;
}

export function migratePreviewWeekRota(data) {
  if (!data?.schedules?.length) return false;
  if (data.previewWeekRotaSeeded) return false;
  let changed = false;
  const people = Array.isArray(data.employees) ? data.employees : [];
  const fieldId = people.find((person) => person.role === "employee" && person.name === "عمر ناصر")?.id
    || people.find((person) => person.role === "employee")?.id;
  const hassanId = people.find((person) => person.name === "حسن العمري")?.id;
  for (const schedule of data.schedules) {
    const types = Array.isArray(schedule.shiftTypes) ? [...schedule.shiftTypes] : [];
    if (!types.some((shift) => shift.id === "evening" || (shift.start === "15:00" && shift.end === "23:00"))) {
      types.push({ id: "evening", start: "15:00", end: "23:00", label: "مسائي", restMinutes: 30 });
      changed = true;
    }
    if (!types.some((shift) => shift.id === "night" || (shift.start === "23:00" && shift.end === "07:00"))) {
      types.push({ id: "night", start: "23:00", end: "07:00", label: "ليلي", restMinutes: 30 });
      changed = true;
    }
    for (const shift of types) {
      if (shift.restMinutes == null) {
        shift.restMinutes = 30;
        changed = true;
      }
    }
    schedule.shiftTypes = types;
    const nightId = types.find((shift) => shift.id === "night" || shift.start === "23:00")?.id;
    const eveningId = types.find((shift) => shift.id === "evening" || (shift.start === "15:00" && shift.end === "23:00"))?.id;
    const morningId = types.find((shift) => shift.id === "morning" || shift.start === "07:00")?.id;
    for (const [key, day] of Object.entries(schedule.assignments || {})) {
      if (!day || typeof day !== "object" || Array.isArray(day)) continue;
      const weekday = /^\d{4}-\d{2}-\d{2}$/.test(key) ? new Date(`${key}T12:00:00`).getDay() : Number(key);
      if (fieldId && morningId && nightId && (day[morningId] || []).includes(fieldId)) {
        day[morningId] = day[morningId].filter((id) => id !== fieldId);
        day[nightId] = [...new Set([...(day[nightId] || []), fieldId])];
        changed = true;
      }
      if (hassanId && eveningId && weekday >= 0 && weekday <= 4 && !(day[eveningId] || []).includes(hassanId)) {
        day[eveningId] = [...new Set([...(day[eveningId] || []), hassanId])];
        if (morningId) day[morningId] = (day[morningId] || []).filter((id) => id !== hassanId);
        changed = true;
      }
    }
  }
  data.previewWeekRotaSeeded = true;
  return true || changed;
}

/**
 * Preview fixture: نيار عبدالله stays morning. Dated keys that drifted onto
 * evening / night (roster clicks, clock copy) must not open 18632 on ملفي.
 */
export function migratePreviewOwnerMorningRota(data) {
  if (data?.previewOwnerNightStreakSeeded) return false;
  if (!data?.schedules?.length) return false;
  const people = Array.isArray(data.employees) ? data.employees : [];
  const ownerId = data.ownerId
    || people.find((person) => person.id === "emp_owner_preview")?.id
    || people.find((person) => person.name === "نيار عبدالله")?.id
    || people.find((person) => person.role === "director")?.id;
  if (!ownerId) return false;
  const ownerStation = people.find((person) => person.id === ownerId)?.stationId || "";
  let changed = false;
  for (const schedule of data.schedules) {
    if (ownerStation && schedule.stationId && String(schedule.stationId) !== String(ownerStation)) continue;
    const types = Array.isArray(schedule.shiftTypes) ? schedule.shiftTypes : [];
    const morningId = types.find((shift) => shift.id === "morning" || shift.start === "07:00")?.id;
    const eveningId = types.find((shift) => shift.id === "evening" || (shift.start === "15:00" && shift.end === "23:00"))?.id;
    const nightId = types.find((shift) => shift.id === "night" || shift.start === "23:00")?.id;
    if (!morningId) continue;
    for (const day of Object.values(schedule.assignments || {})) {
      if (!day || typeof day !== "object" || Array.isArray(day)) continue;
      const onEvening = !!(eveningId && (day[eveningId] || []).includes(ownerId));
      const onNight = !!(nightId && (day[nightId] || []).includes(ownerId));
      if (!onEvening && !onNight) continue;
      if (onEvening) day[eveningId] = (day[eveningId] || []).filter((id) => id !== ownerId);
      if (onNight) day[nightId] = (day[nightId] || []).filter((id) => id !== ownerId);
      day[morningId] = [...new Set([...(day[morningId] || []), ownerId])];
      changed = true;
    }
  }
  return changed;
}

const OWNER_NIGHT_STREAK_WEEKS = 14;

function previewOwnerPerson(data) {
  const people = Array.isArray(data?.employees) ? data.employees : [];
  return people.find((person) => person.id === "emp_owner_preview")
    || people.find((person) => person.name === "نيار عبدالله")
    || people.find((person) => person.role === "director")
    || null;
}

/** 14 dated night-worker weeks for نيار so 18632 consent + notice can open. */
export function seedPreviewOwnerNightStreak(data, today = previewTodayKey()) {
  if (!data) return false;
  if (data.previewOwnerNightStreakSeeded) return false;
  const owner = previewOwnerPerson(data);
  if (!owner?.id) return false;
  const stationId = owner.stationId || companyRootStation(data.stations)?.id;
  if (!stationId) return false;
  data.schedules = Array.isArray(data.schedules) ? data.schedules : [];
  let schedule = data.schedules.find((row) => String(row.stationId) === String(stationId));
  if (!schedule) {
    schedule = {
      id: "sch_owner_night_preview",
      stationId,
      published: true,
      nightCompensation: true,
      shiftTypes: [],
      assignments: {},
      publishedWeeks: {},
    };
    data.schedules.push(schedule);
  }
  schedule.shiftTypes = Array.isArray(schedule.shiftTypes) ? schedule.shiftTypes : [];
  if (!schedule.shiftTypes.some((shift) => shift.id === "night" || shift.start === "23:00")) {
    schedule.shiftTypes.push({ id: "night", start: "23:00", end: "07:00", label: "ليلي", restMinutes: 30 });
  }
  if (!schedule.shiftTypes.some((shift) => shift.id === "morning" || shift.start === "07:00")) {
    schedule.shiftTypes.push({ id: "morning", start: "07:00", end: "15:00", label: "صباحي", restMinutes: 30 });
  }
  const nightId = schedule.shiftTypes.find((shift) => shift.id === "night" || shift.start === "23:00")?.id;
  const morningId = schedule.shiftTypes.find((shift) => shift.id === "morning" || shift.start === "07:00")?.id;
  const eveningId = schedule.shiftTypes.find((shift) => shift.id === "evening" || (shift.start === "15:00" && shift.end === "23:00"))?.id;
  if (!nightId) return false;
  const start = weekStartDate(typeof today === "string" ? new Date(`${today}T12:00:00`) : today);
  schedule.assignments = schedule.assignments && typeof schedule.assignments === "object" ? schedule.assignments : {};
  schedule.publishedWeeks = schedule.publishedWeeks && typeof schedule.publishedWeeks === "object" ? schedule.publishedWeeks : {};
  schedule.weekDirty = schedule.weekDirty && typeof schedule.weekDirty === "object" ? schedule.weekDirty : {};
  const paintDay = (slot) => {
    const day = { ...(schedule.assignments[slot] || {}) };
    if (morningId) day[morningId] = (day[morningId] || []).filter((id) => id !== owner.id);
    if (eveningId) day[eveningId] = (day[eveningId] || []).filter((id) => id !== owner.id);
    day[nightId] = [...new Set([...(day[nightId] || []), owner.id])];
    schedule.assignments[slot] = day;
  };
  for (let week = 0; week < OWNER_NIGHT_STREAK_WEEKS; week += 1) {
    const weekStart = addDays(start, -7 * week);
    schedule.publishedWeeks[weekKeyFromDate(weekStart)] = { at: new Date().toISOString() };
    delete schedule.weekDirty[weekKeyFromDate(weekStart)];
    for (const key of weekDateKeys(weekStart)) {
      const weekday = new Date(`${key}T00:00:00`).getDay();
      if (weekday >= 0 && weekday <= 4) paintDay(key);
    }
  }
  for (const weekday of [0, 1, 2, 3, 4]) paintDay(weekday);
  owner.otherRequests = (owner.otherRequests || []).filter((row) => row.id !== "wcon_preview_owner");
  if (owner.profile?.nightConsentAt) {
    owner.profile = { ...owner.profile };
    delete owner.profile.nightConsentAt;
  }
  data.previewOwnerNightStreakSeeded = true;
  return true;
}

export function seedPreviewProofCycle(data, today = previewTodayKey()) {
  if (!data) return false;
  let changed = false;
  const stations = Array.isArray(data.stations) ? data.stations : [];
  const people = Array.isArray(data.employees) ? data.employees : [];
  const north = stations.find((station) => station.id === "st_north_preview")?.id || stations[0]?.id;
  const east = stations.find((station) => station.id === "st_east_preview")?.id || stations[1]?.id || north;
  const ownerId = data.ownerId || people[0]?.id || "";
  const managerId = people.find((person) => person.role === "station_manager")?.id || people[1]?.id || ownerId;
  const field = people.filter((person) => person.role === "employee" || !["director", "ops_manager", "station_manager"].includes(person.role));
  const employeeId = field[0]?.id || people[2]?.id || ownerId;
  const hassanId = field[1]?.id || employeeId;
  const shift = (days) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + days);
    return previewTodayKey(date);
  };
  const yesterday = shift(-1);
  const soon = shift(2);

  if (!Array.isArray(data.workProofs) || !data.workProofs.some((item) => String(item.id || "").startsWith("wp_preview_"))) {
    data.workProofs = [
      {
        id: "wp_preview_live",
        ref: "WP-LIVE01",
        title: "صيانة مضخة الخط الثالث",
        workReason: "تسريب في الوصلة",
        entityName: "شركة الإمداد",
        client: "شركة الإمداد",
        stationId: north,
        // Open-air line work, so the sun ban reaches this one; the valve job below is indoors.
        place: "field",
        beforeStamp: "07:20",
        startedAt: `${today}T07:20:00`,
        createdAt: `${today}T07:20:00`,
        status: "await",
        raiserId: employeeId,
        raiserName: "عمر ناصر",
      },
      {
        id: "wp_preview_ended",
        ref: "WP-DONE01",
        title: "فحص صمام الطوارئ",
        workReason: "فحص دوري",
        entityName: "مقاول السلامة",
        client: "مقاول السلامة",
        stationId: north,
        place: "onsite",
        beforeStamp: "08:00",
        afterStamp: "11:10",
        startedAt: `${yesterday}T08:00:00`,
        endedAt: `${yesterday}T11:10:00`,
        approvedAt: `${yesterday}T11:15:00`,
        status: "sealed",
        sealId: "NV-WP-0001-SEED",
        raiserId: employeeId,
      },
      ...(Array.isArray(data.workProofs) ? data.workProofs : []),
    ];
    changed = true;
  }

  if (!Array.isArray(data.visitorProofs) || !data.visitorProofs.some((item) => String(item.id || "").startsWith("vp_preview_"))) {
    data.visitorProofs = [
      {
        id: "vp_preview_live",
        ref: "VP-LIVE01",
        title: "مهندس تفتيش",
        visitReason: "تفتيش معدات",
        stationId: north,
        stationIds: [north],
        visitFrom: today,
        visitTo: soon,
        arrivedAt: `${today}T09:00:00`,
        status: "on_site",
        leftAt: null,
        people: [{ name: "خالد المرشد", nationality: "سعودي", idType: "national_id", id: "1088122334" }],
        personName: "خالد المرشد",
        raiserId: managerId,
      },
      {
        id: "vp_preview_left",
        ref: "VP-LEFT01",
        title: "مورد قطع",
        visitReason: "تسليم قطع",
        stationId: east,
        stationIds: [east],
        visitFrom: yesterday,
        visitTo: yesterday,
        arrivedAt: `${yesterday}T10:00:00`,
        leftAt: `${yesterday}T15:00:00`,
        status: "left",
        people: [{ name: "رافق علي", nationality: "مصري", idType: "iqama", id: "2451001122" }],
        personName: "رافق علي",
        raiserId: ownerId,
      },
      ...(Array.isArray(data.visitorProofs) ? data.visitorProofs : []),
    ];
    changed = true;
  }

  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  if (!tasks.some((task) => task.id === "tk_preview_team")) {
    data.tasks = [
      ...tasks,
      {
        id: "tk_preview_team",
        ref: "LOC-010",
        title: "تجهيز وردية الخفجي — لكل الفريق",
        status: "active",
        stationId: north,
        assignMode: "all",
        memberIds: [ownerId, managerId, employeeId, hassanId],
        ownerId: managerId,
        assignedTo: managerId,
        priority: "medium",
        effortWeight: 2,
        workKind: "cp",
        mode: "onsite",
        completedCount: 0,
        targetCount: 1,
        createdAt: new Date().toISOString(),
        dueAt: `${soon}T15:00:00`,
      },
      {
        id: "tk_preview_group",
        ref: "LOC-011",
        title: "قياس ضغط المضخة — عمر وحسن",
        status: "active",
        stationId: north,
        assignMode: "some",
        memberIds: [employeeId, hassanId],
        ownerId: employeeId,
        assignedTo: employeeId,
        priority: "high",
        effortWeight: 3,
        workKind: "cm",
        mode: "field",
        completedCount: 0,
        targetCount: 1,
        createdAt: new Date().toISOString(),
        dueAt: `${today}T15:00:00`,
      },
    ];
    changed = true;
  }
  return changed;
}

const PREVIEW_SITE_FORM = {
  name: "نموذج-تغيير-موقع-العمل.pdf",
  hash: "SITE58PREVIEW",
  url: "/signing-preview-pumps.pdf",
};

const PREVIEW_NIGHT_FORM = {
  name: "موافقة-ليلية-18632.pdf",
  hash: "NIGHT18632PREVIEW",
  url: "/signing-preview-pumps.pdf",
};

const PREVIEW_CONSENT_MARK = { id: "consent-sign", type: "signature", page: 1, x: 72, y: 84, scale: 100 };

function previewConsentForm(request) {
  const topic = String(request?.topic || request?.type || "");
  if (topic === "night" || topic === "night_consent") return PREVIEW_NIGHT_FORM;
  return PREVIEW_SITE_FORM;
}

function attachPreviewConsentForms(data) {
  let changed = false;
  data.signatureRequests = Array.isArray(data.signatureRequests) ? data.signatureRequests : [];
  for (const employee of data.employees || []) {
    for (const request of employee.otherRequests || []) {
      if (request.type !== "written_consent" && request.type !== "night_consent") continue;
      const form = previewConsentForm(request);
      const wrongNightName = (request.topic === "night" || request.type === "night_consent")
        && /موقع[- ]العمل|تغيير[- ]موقع/.test(String(request.senderFile?.name || ""));
      if (!request.senderFile?.url || wrongNightName) {
        request.senderFile = { ...form, url: request.senderFile?.url || form.url };
        changed = true;
      }
      if (!request.signMark) {
        request.signMark = { ...PREVIEW_CONSENT_MARK };
        changed = true;
      }
      if (request.signRequestId || request.signToken) {
        delete request.signRequestId;
        delete request.signToken;
        changed = true;
      }
    }
  }
  return changed;
}

export function seedPreviewWrittenConsent(data, today = previewTodayKey()) {
  if (!data?.employees?.length) return false;
  if (data.previewWrittenConsentSeeded) return attachPreviewConsentForms(data);
  const owner = data.employees.find((row) => row.id === "emp_owner_preview") || data.employees.find((row) => row.role === "director");
  const field = data.employees.find((row) => row.id === "emp_field_preview") || data.employees.find((row) => row.role === "employee");
  if (!owner || !field) return false;
  const dueDate = new Date(`${today}T12:00:00`);
  dueDate.setDate(dueDate.getDate() + 7);
  const due = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;
  const now = new Date().toISOString();
  const draft = (id, topic, titleAr, titleEn, citeAr, citeEn, reason, requestedBy, requestedById) => ({
    id,
    type: "written_consent",
    topic,
    titleAr,
    titleEn,
    citeAr,
    citeEn,
    reason,
    deadline: due,
    status: "open",
    requestedBy,
    requestedById,
    createdAt: now,
  });
  owner.otherRequests = owner.otherRequests || [];
  field.otherRequests = field.otherRequests || [];
  if (!field.otherRequests.some((row) => row.type === "written_consent")) {
    field.otherRequests.unshift({
      ...draft(
        "wcon_preview_field",
        "site",
        "تغيير موقع العمل",
        "Change of work site",
        "المادة 58",
        "Art. 58",
        "تطلب الإدارة إقرارك الخطي بالانتقال إلى موقع عمل آخر ضمن المدينة نفسها، مع بقاء الأجر والمسمّى كما هما.",
        owner.name,
        owner.id,
      ),
      senderFile: { ...PREVIEW_SITE_FORM },
      signMark: { ...PREVIEW_CONSENT_MARK },
    });
  }
  data.previewWrittenConsentSeeded = true;
  attachPreviewConsentForms(data);
  return true;
}

function ensurePreviewWage(person, wage) {
  if (!person || Number(person.profile?.baseSalary) > 0) return false;
  person.profile = { ...(person.profile || {}), baseSalary: wage };
  return true;
}

export function seedPreviewDiscipline(data, today = previewTodayKey()) {
  if (!data?.employees?.length) return false;
  const owner = data.employees.find((row) => row.id === "emp_owner_preview") || data.employees.find((row) => row.role === "director");
  const manager = data.employees.find((row) => row.id === "emp_manager_preview") || data.employees.find((row) => row.role === "station_manager");
  const field = data.employees.find((row) => row.id === "emp_field_preview") || data.employees.find((row) => row.role === "employee");
  if (!owner || !field) return false;
  const wages = ensurePreviewWage(owner, 15500) || ensurePreviewWage(field, 9000) || ensurePreviewWage(manager, 12800);
  if (data.previewDisciplineSeeded) return wages;
  const cases = Array.isArray(data.disciplinaryCases) ? data.disciplinaryCases : [];
  if (cases.some((row) => String(row.id || "").startsWith("dsc_preview_"))) {
    data.previewDisciplineSeeded = true;
    return true;
  }
  const iso = (day, hour = "10:00:00") => `${day}T${hour}`;
  const shift = (days) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const notified = shift(-7);
  const defence = shift(-5);
  const signed = shift(-4);
  const lastYear = `${Number(today.slice(0, 4)) - 1}-08-12`;
  data.disciplinaryCases = [
    {
      id: "dsc_preview_owner_signed",
      employeeId: owner.id,
      status: "notify",
      note: "تأخّر متكرّر — 3 مرات في شهر واحد",
      penalty: "حسم يوم",
      cutDays: 1,
      createdAt: iso(notified),
      notifiedAt: iso(notified),
      hearingEndedAt: iso(defence),
      signedAt: iso(signed),
      decidedAt: iso(signed),
      signedBy: manager?.name || "أحمد السالم",
      evidence: ["إبلاغ كتابي"],
    },
    {
      id: "dsc_preview_field_defence",
      employeeId: field.id,
      status: "hearing",
      note: "مغادرة الموقع قبل انتهاء الوردية بلا إذن",
      penalty: "حسم يوم",
      cutDays: 1,
      createdAt: iso(shift(-11)),
      notifiedAt: iso(shift(-11)),
      hearingEndedAt: iso(shift(-9)),
      evidence: ["محضر سماع"],
    },
    {
      id: "dsc_preview_mgr_notice",
      employeeId: manager?.id || field.id,
      status: "notice",
      note: "تجاهل تعليمات السلامة عند نقطة العزل",
      penalty: "إنذار",
      cutDays: 0,
      createdAt: iso(shift(-10)),
      notifiedAt: iso(shift(-10)),
      evidence: ["إبلاغ كتابي"],
    },
    {
      id: "dsc_preview_closed_year",
      employeeId: field.id,
      status: "closed",
      note: "إتلاف عهدة بإهمال — عدّة قياس",
      penalty: "حسم يومين",
      cutDays: 2,
      createdAt: iso(lastYear, "09:00:00"),
      notifiedAt: iso(shift(-400)),
      hearingEndedAt: iso(shift(-398)),
      signedAt: iso(lastYear),
      decidedAt: iso(lastYear),
      signedBy: owner.name,
      rulingAt: iso(lastYear, "16:00:00"),
      rulingBy: owner.name,
      rulingLabel: "نُفّذ وأُغلق",
      rulingNote: "استقرّ الملف.",
      evidence: ["محضر"],
    },
    ...cases,
  ];
  data.previewDisciplineSeeded = true;
  return true;
}

export function seedPreviewVoice(data, today = previewTodayKey()) {
  if (!data?.employees?.length) return false;
  if (data.previewVoiceSeeded) return false;
  const owner = data.employees.find((row) => row.id === "emp_owner_preview") || data.employees.find((row) => row.role === "director");
  const manager = data.employees.find((row) => row.id === "emp_manager_preview") || data.employees.find((row) => row.role === "station_manager");
  const field = data.employees.find((row) => row.id === "emp_field_preview") || data.employees.find((row) => row.role === "employee");
  if (!owner || !field) return false;
  const pub = Array.isArray(data.publicReports) ? data.publicReports : [];
  const anon = Array.isArray(data.anonymousReports) ? data.anonymousReports : [];
  if (pub.some((row) => String(row.id || "").startsWith("pub_preview_")) || anon.some((row) => String(row.id || "").startsWith("an_preview_"))) {
    data.previewVoiceSeeded = true;
    return true;
  }
  const iso = (day, hour = "10:00:00") => `${day}T${hour}`;
  const shift = (days) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  data.publicReports = [
    {
      id: "pub_preview_idea",
      authorId: owner.id,
      stationId: owner.stationId || manager?.stationId,
      type: "suggestion",
      kind: "suggestion",
      title: "توحيد نموذج تسليم الوردية",
      message: "كل مشرف يكتب تسليم الوردية بصيغته، فتضيع الملاحظات بين الورديات.",
      priority: "low",
      status: "open",
      escalationLevel: 0,
      createdAt: iso(shift(-4), "08:00:00"),
    },
    {
      id: "pub_preview_case",
      authorId: field.id,
      stationId: field.stationId,
      type: "complaint",
      kind: "public",
      title: "تأخير صرف بدل الوردية المسائية",
      message: "بدل الوردية المسائية لشهرين لم يُصرف مع الراتب.",
      priority: "medium",
      status: "open",
      escalationLevel: 0,
      createdAt: iso(shift(-1), "14:00:00"),
    },
    ...pub,
  ];
  data.anonymousReports = [
    {
      id: "an_preview_rest",
      type: "complaint",
      kind: "anonymous",
      anonymous: true,
      anonymousId: "AN-1842",
      title: "ورديات متتالية دون راحة أسبوعية",
      message: "ثلاثة عاملين في المناوبة الليلية بلا يوم راحة منذ أسبوعين.",
      priority: "high",
      status: "open",
      stationId: field.stationId,
      escalationLevel: 0,
      createdAt: iso(shift(-1), "21:10:00"),
    },
    ...anon.filter((row) => row.id !== "an_1"),
  ];
  data.previewVoiceSeeded = true;
  return true;
}

/** Enough approved proof across recent months so the performance range can derive a board. */
export function seedPreviewPerformance(data, today = previewTodayKey()) {
  if (!data || data.previewPerformanceSeeded) return false;
  const people = Array.isArray(data.employees) ? data.employees : [];
  if (!people.length) return false;
  const byName = (name) => people.find((person) => person.name === name);
  const titles = {
    "نيار عبدالله": "مشرف تشغيل",
    "أحمد السالم": "مشرف تشغيل",
    "عمر ناصر": "فنّي ميداني",
    "حسن العمري": "فنّي ميداني",
    "سارة حسن": "ضابط سلامة",
    "نورة القحطاني": "أخصائية عملاء",
  };
  for (const person of people) {
    const title = titles[person.name];
    if (title && !person.jobTitle) person.jobTitle = title;
  }
  const niyar = byName("نيار عبدالله") || people.find((person) => person.role === "director");
  const ahmed = byName("أحمد السالم") || people.find((person) => person.role === "station_manager");
  const omar = byName("عمر ناصر") || people.find((person) => person.role === "employee");
  const hassan = byName("حسن العمري");
  const sara = byName("سارة حسن") || people.find((person) => person.role === "safety_officer");
  const noura = byName("نورة القحطاني");
  const shiftMonth = (monthsAgo, day = 12) => {
    const date = new Date(`${today}T12:00:00`);
    date.setMonth(date.getMonth() - monthsAgo);
    date.setDate(Math.min(day, 28));
    return previewTodayKey(date);
  };
  const stamp = (day, hour = "11:00:00") => `${day}T${hour}`;
  const task = (id, person, title, monthsAgo, { late = false, status = "completed", effort = 2 } = {}) => {
    if (!person) return null;
    const day = shiftMonth(monthsAgo, 8 + (id.length % 12));
    const due = late ? shiftMonth(monthsAgo, 4) : shiftMonth(monthsAgo, 20);
    return {
      id,
      ref: `PERF-${id.slice(-4).toUpperCase()}`,
      title,
      status,
      stationId: person.stationId,
      assignedTo: person.id,
      ownerId: person.id,
      memberIds: [person.id],
      priority: effort >= 3 ? "high" : "medium",
      effortWeight: effort,
      workKind: "cm",
      mode: "onsite",
      completedCount: status === "completed" ? 1 : 0,
      targetCount: 1,
      createdAt: stamp(shiftMonth(monthsAgo + 1, 20), "08:00:00"),
      dueAt: stamp(due, "17:00:00"),
      approvedAt: status === "completed" ? stamp(day, "14:20:00") : null,
    };
  };
  const extra = [
    task("tk_perf_n1", niyar, "مراجعة تشغيل الخفجي", 0, { effort: 3 }),
    task("tk_perf_n2", niyar, "اعتماد إثبات الأسبوع", 1, { effort: 3 }),
    task("tk_perf_n3", niyar, "جولة فروع الربع", 2, { effort: 4 }),
    task("tk_perf_n4", niyar, "إغلاق ملاحظات السلامة", 3, { effort: 2 }),
    task("tk_perf_n5", niyar, "خطة تغطية العيد", 4, { effort: 2 }),
    task("tk_perf_n6", niyar, "مراجعة أهداف المشرفين", 1, { effort: 2 }),
    task("tk_perf_a1", ahmed, "تسليم وردية الخفجي", 0, { effort: 2 }),
    task("tk_perf_a2", ahmed, "مراجعة مهام الفريق", 1, { effort: 3 }),
    task("tk_perf_a3", ahmed, "تجهيز تقرير الفرع", 2, { effort: 2 }),
    task("tk_perf_a4", ahmed, "متابعة صيانة المضخة", 3, { effort: 3 }),
    task("tk_perf_a5", ahmed, "تأكيد حضور الوردية", 4, { effort: 1 }),
    task("tk_perf_o1", omar, "صيانة مضخة الخط الثالث", 0, { effort: 4 }),
    task("tk_perf_o2", omar, "فحص صمام الطوارئ", 1, { effort: 3 }),
    task("tk_perf_o3", omar, "قراءة عداد الشهر", 2, { effort: 1 }),
    task("tk_perf_o4", omar, "تغيير فلتر الخط", 3, { effort: 2 }),
    task("tk_perf_o5", omar, "تثبيت لوحة السلامة", 1, { effort: 2 }),
    task("tk_perf_o6", omar, "تقرير تسريب الوصلة", 4, { late: true, effort: 2 }),
    task("tk_perf_h1", hassan, "قياس ضغط المضخة", 0, { effort: 3 }),
    task("tk_perf_h2", hassan, "جولة معدات المساء", 1, { effort: 2 }),
    task("tk_perf_h3", hassan, "تنظيف غرفة المحابس", 2, { late: true, effort: 1 }),
    task("tk_perf_h4", hassan, "تجهيز عدة الوردية", 3, { effort: 2 }),
    task("tk_perf_s1", sara, "إغلاق بلاغ تسرب", 0, { effort: 3 }),
    task("tk_perf_s2", sara, "تدريب إخلاء رابغ", 1, { effort: 3 }),
    task("tk_perf_s3", sara, "جرد معدات الطوارئ", 2, { effort: 2 }),
    task("tk_perf_s4", sara, "تقرير حادثة وشيكة", 3, { effort: 2 }),
    task("tk_perf_s5", sara, "مراجعة تصاريح العمل", 4, { effort: 2 }),
    task("tk_perf_u1", noura, "متابعة طلب عميل رابغ", 0, { effort: 2 }),
    task("tk_perf_u2", noura, "إغلاق شكوى العداد", 1, { effort: 2 }),
    task("tk_perf_u3", noura, "تحديث بيانات العميل", 2, { effort: 1 }),
    task("tk_perf_u4", noura, "تأكيد موعد الصيانة", 3, { effort: 1 }),
    task("tk_perf_u5", noura, "تقرير رضا الأسبوع", 1, { effort: 2 }),
    task("tk_perf_open", omar, "فحص أسبوعي مفتوح", 0, { status: "active", effort: 2 }),
  ].filter(Boolean);
  const have = new Set((data.tasks || []).map((row) => row.id));
  const add = extra.filter((row) => !have.has(row.id));
  if (!add.length) {
    data.previewPerformanceSeeded = true;
    return true;
  }
  data.tasks = [...add, ...(data.tasks || [])];
  data.previewPerformanceSeeded = true;
  return true;
}

const PREVIEW_GENDER_BY_ID = {
  emp_owner_preview: "male",
  emp_manager_preview: "male",
  emp_field_preview: "male",
  emp_hse_preview: "female",
  emp_noura_preview: "female",
  emp_hassan_preview: "male",
};

const PREVIEW_GENDER_BY_NAME = {
  "نيار عبدالله": "male",
  "أحمد السالم": "male",
  "عمر ناصر": "male",
  "سارة حسن": "female",
  "نورة القحطاني": "female",
  "حسن العمري": "male",
};

/** Preview files were seeded without gender, so maternity/paternity gates could not tell Omar from Noura. */
export function migratePreviewEmployeeGenders(data) {
  const people = Array.isArray(data?.employees) ? data.employees : [];
  if (!people.length) return false;
  let changed = false;
  for (const person of people) {
    const profile = person.profile && typeof person.profile === "object" ? person.profile : (person.profile = {});
    if (String(profile.gender || "").trim()) continue;
    const next = PREVIEW_GENDER_BY_ID[person.id] || PREVIEW_GENDER_BY_NAME[person.name] || "";
    if (!next) continue;
    profile.gender = next;
    changed = true;
  }
  return changed;
}

/** Existing preview workspaces were seeded without a register — operations need real rows. */
export function migratePreviewAssets(data) {
  if (!data || !Array.isArray(data.stations) || !data.stations.length) return false;
  if (Array.isArray(data.assets) && data.assets.length) return false;
  const north = data.stations.find((row) => /خفجي|Khafji|north/i.test(row.name || "")) || data.stations[0];
  const east = data.stations.find((row) => /رابغ|Rabigh|east/i.test(row.name || "")) || data.stations[1] || data.stations[0];
  const manager = (data.employees || []).find((row) => row.id === "emp_manager_preview") || (data.employees || []).find((row) => /أحمد/.test(row.name || ""));
  const hse = (data.employees || []).find((row) => row.id === "emp_hse_preview") || (data.employees || []).find((row) => /سارة/.test(row.name || ""));
  data.assets = [
    {
      id: "ast_1",
      name: "مولد احتياطي 80 ك.و",
      assetCode: "GEN-080",
      qrCode: "AST-GEN080",
      category: "معدات تشغيل",
      stationId: north.id,
      originStationId: north.id,
      holderId: manager?.id || null,
      holderName: manager?.name || "—",
      status: "in_custody",
      value: 42000,
      purchaseDate: "2025-03-12",
      nextInspectionDate: "2026-12-01",
    },
    {
      id: "ast_2",
      name: "جهاز فحص عزل",
      assetCode: "TST-MEG",
      qrCode: "AST-TSTMEG",
      category: "أجهزة قياس",
      stationId: east.id,
      originStationId: east.id,
      holderId: hse?.id || null,
      holderName: hse?.name || "—",
      status: "available",
      value: 8500,
      purchaseDate: "2025-08-20",
      nextInspectionDate: "2026-10-15",
    },
  ];
  if (!Array.isArray(data.assetCustody) || !data.assetCustody.length) {
    data.assetCustody = [{
      id: "cst_1",
      assetId: "ast_1",
      fromId: null,
      fromName: "—",
      toId: manager?.id || null,
      toName: manager?.name || "—",
      stationId: north.id,
      handedAt: new Date().toISOString(),
      notes: "initial",
    }];
  }
  if (!Array.isArray(data.assetMaintenance)) data.assetMaintenance = [];
  if (!Array.isArray(data.assetTransfers)) data.assetTransfers = [];
  return true;
}
