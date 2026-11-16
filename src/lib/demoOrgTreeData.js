export const DEMO_ORG_EMAIL_DOMAIN = "demo.nirovera.local";
export const DEMO_ORG_MANAGER_EMAIL = `salem.khafji@${DEMO_ORG_EMAIL_DOMAIN}`;
export const DEMO_ORG_EAST_EMAIL = `sultan.east@${DEMO_ORG_EMAIL_DOMAIN}`;
export const DEMO_ORG_WEST_EMAIL = `turki.west@${DEMO_ORG_EMAIL_DOMAIN}`;
export const DEMO_ORG_DAMMAM_EMAIL = `bandar.dammam@${DEMO_ORG_EMAIL_DOMAIN}`;
export const DEMO_ORG_PORT_EMAIL = `yousef.port@${DEMO_ORG_EMAIL_DOMAIN}`;
export const DEMO_ORG_OFFICE_EMAIL = `hassan.office@${DEMO_ORG_EMAIL_DOMAIN}`;
export const DEMO_ORG_JEDDAH_EMAIL = `majid.jeddah@${DEMO_ORG_EMAIL_DOMAIN}`;
export const DEMO_ORG_NOURA_EMAIL = `noura.hq@${DEMO_ORG_EMAIL_DOMAIN}`;

/** Branch HR officers of the demo: who completes the files of each branch (one person serves up to three). */
export const DEMO_BRANCH_HR = [
  { email: `sara.hr.west@${DEMO_ORG_EMAIL_DOMAIN}`, branches: ["فرع جدة", "فرع رابغ"] },
  { email: `reem.hr.khafji@${DEMO_ORG_EMAIL_DOMAIN}`, branches: ["فرع الخفجي"] },
  { email: `mona.hr.dammam@${DEMO_ORG_EMAIL_DOMAIN}`, branches: ["فرع الدمام", "المكتب الرئيسي", "ميناء الدمام"] },
];

export const DEMO_BRANCH_MANAGERS = [
  { branch: "المنطقة الشرقية", email: DEMO_ORG_EAST_EMAIL },
  { branch: "المنطقة الغربية", email: DEMO_ORG_WEST_EMAIL },
  { branch: "فرع الخفجي", email: DEMO_ORG_MANAGER_EMAIL },
  { branch: "فرع جدة", email: DEMO_ORG_JEDDAH_EMAIL },
  { branch: "فرع الدمام", email: DEMO_ORG_DAMMAM_EMAIL },
  { branch: "ميناء الدمام", email: DEMO_ORG_PORT_EMAIL },
  { branch: "المكتب الرئيسي", email: DEMO_ORG_OFFICE_EMAIL },
];

const FIRST = [
  "فهد", "خالد", "عبدالله", "محمد", "سلطان", "نايف", "ماجد", "بندر", "تركي", "عمر",
  "يوسف", "حسن", "إبراهيم", "سعد", "فيصل", "راكان", "نواف", "مشعل", "عبدالعزيز", "وليد",
  "طلال", "هشام", "أنس", "زياد", "باسم", "حسام", "معتز", "عادل", "سامي", "نبيل",
];
const LAST = [
  "القحطاني", "الدوسري", "الشمري", "الحربي", "الغامدي", "الزهراني", "المطيري", "العنزي",
  "الشهري", "السبيعي", "البقمي", "الجهني", "العمري", "الرشيدي", "الخالدي", "السهلي", "المالكي", "العجمي",
];
const STAFF_TITLES = ["فني تشغيل", "فني صيانة", "مشغل محطة", "مراقب وردية", "موظف إداري"];

export function demoOrgBranchPlan() {
  return [
    { name: "المنطقة الغربية", parent: "", unitKind: "manager" },
    { name: "فرع جدة", parent: "المنطقة الغربية", unitKind: "branch" },
    { name: "المنطقة الشرقية", parent: "", unitKind: "manager" },
    { name: "فرع الخفجي", parent: "المنطقة الشرقية", unitKind: "branch" },
    { name: "فرع الدمام", parent: "المنطقة الشرقية", unitKind: "branch" },
    { name: "المكتب الرئيسي", parent: "فرع الدمام", unitKind: "branch" },
    { name: "ميناء الدمام", parent: "فرع الدمام", unitKind: "branch" },
  ];
}

function staffName(index) {
  const first = FIRST[index % FIRST.length];
  const last = LAST[Math.floor(index / FIRST.length) % LAST.length];
  const name = `${first} ${last}`;
  return name === "سالم العتيبي" ? `${first} ${LAST[(Math.floor(index / FIRST.length) + 1) % LAST.length]}` : name;
}

function hireDate(index) {
  const start = new Date(2023, 2, 12);
  start.setDate(start.getDate() + ((index * 11) % 700));
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

function nationalId(index) {
  return String(1093100001 + index);
}

function phone(index) {
  return `05${String(94000000 + index).slice(-8)}`;
}

function staffRow({ slug, index, branch, title, reportsTo, extraBranches = "" }) {
  return {
    name: staffName(index),
    email: `${slug}.${String(index + 1).padStart(2, "0")}@${DEMO_ORG_EMAIL_DOMAIN}`,
    nationalId: nationalId(index + 40),
    phone: phone(index + 40),
    hireDate: hireDate(index),
    list: "العمليات",
    title,
    grade: "متوسط",
    branch,
    parentBranch: "",
    reportsTo,
    extraBranches,
  };
}

export function demoOrgHireRows() {
  const rows = [
    {
      name: "سالم العتيبي",
      email: DEMO_ORG_MANAGER_EMAIL,
      nationalId: "1093100000",
      phone: "0594100001",
      hireDate: "2021-04-01",
      list: "القيادة",
      title: "مدير الفرع",
      grade: "مدير",
      branch: "فرع الخفجي",
      parentBranch: "",
      reportsTo: "سلطان الحربي",
      extraBranches: "",
    },
    {
      name: "ماجد السلمي",
      email: DEMO_ORG_JEDDAH_EMAIL,
      nationalId: "1093100002",
      phone: "0594100002",
      hireDate: "2020-09-12",
      list: "القيادة",
      title: "مدير الفرع",
      grade: "مدير",
      branch: "فرع جدة",
      parentBranch: "",
      reportsTo: "تركي الغامدي",
      extraBranches: "",
    },
    {
      name: "نورة القحطاني",
      email: DEMO_ORG_NOURA_EMAIL,
      nationalId: "1093100003",
      phone: "0594100003",
      hireDate: "2019-01-15",
      list: "القيادة",
      title: "مدير تنفيذي",
      grade: "مدير",
      branch: "",
      onCompanyRoot: true,
      parentBranch: "",
      reportsTo: "",
      extraBranches: "",
    },
    {
      name: "سلطان الحربي",
      email: DEMO_ORG_EAST_EMAIL,
      nationalId: "1093100007",
      phone: "0594100007",
      hireDate: "2018-11-02",
      list: "القيادة",
      title: "مدير المنطقة",
      grade: "مدير",
      branch: "المنطقة الشرقية",
      parentBranch: "",
      reportsTo: "نورة القحطاني",
      extraBranches: "",
    },
    {
      name: "تركي الغامدي",
      email: DEMO_ORG_WEST_EMAIL,
      nationalId: "1093100008",
      phone: "0594100008",
      hireDate: "2019-05-18",
      list: "القيادة",
      title: "مدير المنطقة",
      grade: "مدير",
      branch: "المنطقة الغربية",
      parentBranch: "",
      reportsTo: "نورة القحطاني",
      extraBranches: "",
    },
    {
      name: "بندر العتيبي",
      email: DEMO_ORG_DAMMAM_EMAIL,
      nationalId: "1093100009",
      phone: "0594100009",
      hireDate: "2020-02-10",
      list: "القيادة",
      title: "مدير الفرع",
      grade: "مدير",
      branch: "فرع الدمام",
      parentBranch: "",
      reportsTo: "سلطان الحربي",
      extraBranches: "",
    },
    {
      name: "حسن العمري",
      email: DEMO_ORG_OFFICE_EMAIL,
      nationalId: "1093100010",
      phone: "0594100010",
      hireDate: "2021-08-22",
      list: "القيادة",
      title: "مدير الموقع",
      grade: "مدير",
      branch: "المكتب الرئيسي",
      parentBranch: "",
      reportsTo: "بندر العتيبي",
      extraBranches: "",
    },
    {
      name: "يوسف الجهني",
      email: DEMO_ORG_PORT_EMAIL,
      nationalId: "1093100011",
      phone: "0594100011",
      hireDate: "2021-12-04",
      list: "القيادة",
      title: "مدير الموقع",
      grade: "مدير",
      branch: "ميناء الدمام",
      parentBranch: "",
      reportsTo: "بندر العتيبي",
      extraBranches: "",
    },
    {
      name: "سعد الدوسري",
      email: `saad.hq@${DEMO_ORG_EMAIL_DOMAIN}`,
      nationalId: "1093100004",
      phone: "0594100004",
      hireDate: "2022-03-01",
      list: "الموارد البشرية",
      title: "مدير موارد بشرية",
      grade: "مدير",
      branch: "",
      onCompanyRoot: true,
      parentBranch: "",
      reportsTo: "نورة القحطاني",
      extraBranches: "",
    },
    {
      name: "لينا الحربي",
      email: `lina.hq@${DEMO_ORG_EMAIL_DOMAIN}`,
      nationalId: "1093100005",
      phone: "0594100005",
      hireDate: "2022-06-20",
      list: "المالية",
      title: "مسؤول مالية",
      grade: "متوسط",
      branch: "",
      onCompanyRoot: true,
      parentBranch: "",
      reportsTo: "نورة القحطاني",
      extraBranches: "",
    },
    {
      name: "فهد الشمري",
      email: `fahd.hq@${DEMO_ORG_EMAIL_DOMAIN}`,
      nationalId: "1093100006",
      phone: "0594100006",
      hireDate: "2023-02-08",
      list: "العمليات",
      title: "منسق عمليات",
      grade: "متوسط",
      branch: "",
      onCompanyRoot: true,
      parentBranch: "",
      reportsTo: "نورة القحطاني",
      extraBranches: "",
    },
    {
      name: "سارة المالكي",
      email: `sara.hr.west@${DEMO_ORG_EMAIL_DOMAIN}`,
      nationalId: "1093100101",
      phone: "0594100101",
      hireDate: "2022-05-01",
      list: "الموارد البشرية",
      title: "مسؤول موارد بشرية",
      grade: "متوسط",
      branch: "فرع جدة",
      parentBranch: "",
      reportsTo: "نورة القحطاني",
      extraBranches: "",
    },
    {
      name: "ريم الشهري",
      email: `reem.hr.khafji@${DEMO_ORG_EMAIL_DOMAIN}`,
      nationalId: "1093100102",
      phone: "0594100102",
      hireDate: "2022-05-01",
      list: "الموارد البشرية",
      title: "مسؤول موارد بشرية",
      grade: "متوسط",
      branch: "فرع الخفجي",
      parentBranch: "",
      reportsTo: "نورة القحطاني",
      extraBranches: "",
    },
    {
      name: "منى العتيبي",
      email: `mona.hr.dammam@${DEMO_ORG_EMAIL_DOMAIN}`,
      nationalId: "1093100103",
      phone: "0594100103",
      hireDate: "2022-05-01",
      list: "الموارد البشرية",
      title: "مسؤول موارد بشرية",
      grade: "متوسط",
      branch: "فرع الدمام",
      parentBranch: "",
      reportsTo: "نورة القحطاني",
      extraBranches: "",
    },
  ];
  let n = 0;
  for (let i = 0; i < 17; i += 1) {
    rows.push(staffRow({ slug: "jeddah", index: n, branch: "فرع جدة", title: STAFF_TITLES[i % STAFF_TITLES.length], reportsTo: "ماجد السلمي" }));
    n += 1;
  }
  for (let i = 0; i < 21; i += 1) {
    rows.push(staffRow({ slug: "khafji", index: n, branch: "فرع الخفجي", title: STAFF_TITLES[i % STAFF_TITLES.length], reportsTo: "سالم العتيبي" }));
    n += 1;
  }
  for (let i = 0; i < 24; i += 1) {
    rows.push(staffRow({ slug: "hq", index: n, branch: "المكتب الرئيسي", title: STAFF_TITLES[i % STAFF_TITLES.length], reportsTo: "حسن العمري" }));
    n += 1;
  }
  for (let i = 0; i < 18; i += 1) {
    rows.push(staffRow({ slug: "port", index: n, branch: "ميناء الدمام", title: STAFF_TITLES[i % STAFF_TITLES.length], reportsTo: "يوسف الجهني" }));
    n += 1;
  }
  return rows;
}
