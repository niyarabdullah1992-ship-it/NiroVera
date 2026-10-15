/**
 * What each record prints as — a work order, a work proof, a visitor pass. Pure builders that
 * return a printSheet() sheet from what the detail view already shows; no new numbers here.
 */

const p2 = (n) => String(n).padStart(2, "0");

export function printStamp(v) {
  if (!v) return "";
  const d = new Date(String(v).length === 10 ? `${v}T12:00:00` : v);
  if (Number.isNaN(d.getTime())) return "";
  const date = `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
  return String(v).length === 10 ? date : `${date} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function vehicleLine(v = {}) {
  const plate = v.plate || [v.plateLetters, v.plateNumbers].filter(Boolean).join(" ");
  return [[v.maker, v.model, v.year].filter(Boolean).join(" "), v.type, plate].filter(Boolean).join(" · ");
}

/** National IDs print masked to the last four — a sheet leaves the system. */
export function maskId(id) {
  const s = String(id || "").replace(/\s+/g, "");
  if (!s) return "";
  return s.length <= 4 ? s : `•••• ${s.slice(-4)}`;
}

export function taskWorkOrderSheet({ task = {}, ar = true, doneN = 0, targetN = 1, status, owner, branch, doers, creator, recurrence, points, priority }) {
  const logs = (Array.isArray(task.comments) ? task.comments : []).filter((c) => c?.kind === "log");
  const shares = new Map();
  for (const c of logs) {
    const n = String(c.authorName || "").trim();
    if (n) shares.set(n, (shares.get(n) || 0) + Math.max(0, Number(c.amount) || 0));
  }
  return {
    ar,
    kicker: ar ? "المهام والعمليات · أمر عمل" : "Tasks & operations · Work order",
    title: task.title || "—",
    subtitle: task.workTypeText || task.workType || "",
    ref: task.ref || task.id || "",
    status,
    facts: [
      { label: ar ? "الإنجاز" : "Done", value: `${doneN}/${targetN}`, mono: true },
      { label: ar ? "الاستحقاق" : "Due", value: printStamp(task.dueAt), mono: true },
      { label: ar ? "الفرع" : "Branch", value: branch },
      { label: ar ? "المسؤول" : "Owner", value: owner },
      { label: ar ? "أنشأها" : "Created by", value: creator },
      { label: ar ? "الأولوية" : "Priority", value: priority },
      { label: ar ? "التكرار" : "Repeats", value: recurrence },
      { label: ar ? "النقاط" : "Points", value: points },
      { label: ar ? "اعتمدها" : "Approved by", value: task.approvedByName || "" },
      { label: ar ? "المنفّذون" : "Doers", value: doers, wide: true },
    ],
    blocks: [
      task.description ? { type: "text", heading: ar ? "المطلوب" : "What is asked", body: task.description } : null,
      {
        type: "table",
        heading: ar ? `سجل الإنجاز · ${logs.length}` : `Progress log · ${logs.length}`,
        cols: [ar ? "الوقت" : "When", ar ? "من" : "Who", ar ? "الكمية" : "Amount", ar ? "الملاحظة" : "Note"],
        monoCols: [0, 2],
        nowrapCols: [0, 2],
        rows: logs.map((c) => [printStamp(c.at || c.createdAt), c.authorName || "—", String(Math.max(0, Number(c.amount) || 0)), c.text || ""]),
        empty: ar ? "لم يُسجَّل إنجاز بعد." : "No progress logged yet.",
      },
      shares.size > 1 ? {
        type: "table",
        heading: ar ? "حصص الفريق" : "Team shares",
        cols: [ar ? "الاسم" : "Name", ar ? "الكمية" : "Amount", ar ? "النسبة" : "Share"],
        monoCols: [1, 2],
        rows: [...shares.entries()].sort((a, b) => b[1] - a[1]).map(([n, a]) => [n, String(a), `${Math.round((a / Math.max(1, doneN)) * 100)}%`]),
      } : null,
    ].filter(Boolean),
    signatures: [
      { label: ar ? "المنفّذ" : "Doer", name: owner },
      { label: ar ? "المشرف المعتمد" : "Approving supervisor", name: task.approvedByName || "" },
    ],
  };
}

export function workProofSheet({ proof = {}, ar = true, stageLabel, tone, branch, span, crew = [], vehicles: rawVehicles = [] }) {
  const vehicles = rawVehicles.filter((v) => vehicleLine(v));
  return {
    ar,
    kicker: ar ? "المهام والعمليات · إثبات عمل" : "Tasks & operations · Work proof",
    title: proof.entityName || proof.title || (ar ? "جهة خارجية" : "Outside party"),
    subtitle: proof.workReason || "",
    ref: proof.ref || proof.id || "",
    status: stageLabel ? { label: stageLabel, tone } : null,
    facts: [
      { label: ar ? "النوع" : "Kind", value: proof.entityKind === "individual" ? (ar ? "مؤسسة فردية" : "Individual") : (ar ? "جهة خارجية" : "Outside company") },
      { label: ar ? "الفرع" : "Branch", value: branch },
      { label: ar ? "رفعه" : "Raised by", value: proof.raiserName },
      { label: ar ? "البداية" : "Started", value: printStamp(proof.startedAt || proof.createdAt), mono: true },
      { label: ar ? "النهاية" : "Ended", value: printStamp(proof.endedAt), mono: true },
      { label: ar ? "المدة" : "Span", value: span },
      { label: ar ? "السجل التجاري" : "CR number", value: proof.entityCr || "", mono: true },
      { label: ar ? "المشروع" : "Project", value: proof.entityProject || "" },
      { label: ar ? "الموقع الجغرافي" : "Location check", value: proof.geoVerdict === "out" ? (ar ? "خارج النطاق" : "Outside range") : proof.geoVerdict === "in" ? (ar ? "داخل النطاق" : "Inside range") : "" },
    ],
    blocks: [
      {
        type: "table",
        heading: ar ? `العمال · ${crew.length}` : `Crew · ${crew.length}`,
        cols: [ar ? "الاسم" : "Name", ar ? "الهوية" : "ID", ar ? "المهنة" : "Role", ar ? "دخل" : "In", ar ? "خرج" : "Out"],
        monoCols: [1, 3],
        nowrapCols: [1, 3, 4],
        rows: crew.map((x) => [x.name || "—", maskId(x.id), x.title || x.role || "", printStamp(x.inAt), printStamp(x.outAt) || (ar ? "في الموقع" : "On site")]),
        empty: ar ? "لا عمال مسجّلون." : "No crew recorded.",
      },
      vehicles.length ? {
        type: "table",
        heading: ar ? `السيارات · ${vehicles.length}` : `Vehicles · ${vehicles.length}`,
        cols: [ar ? "السيارة" : "Vehicle"],
        rows: vehicles.map((v) => [vehicleLine(v)]),
      } : null,
    ].filter(Boolean),
    signatures: [
      { label: ar ? "مسؤول الجهة" : "Party representative", name: crew[0]?.name || "" },
      { label: ar ? "مشرف الفرع" : "Branch supervisor", name: "" },
    ],
    note: ar ? "أرقام الهوية مختصرة لآخر أربعة أرقام. الصور والمرفقات تبقى في المنصة." : "IDs show the last four digits. Photos and files stay on the platform.",
  };
}

export function visitorPassSheet({ proof = {}, ar = true, stateLabel, tone, branch, people = [], vehicles: rawVehicles = [], from, to, duration }) {
  const vehicles = rawVehicles.filter((v) => vehicleLine(v));
  return {
    ar,
    kicker: ar ? "المهام والعمليات · تصريح زائر" : "Tasks & operations · Visitor pass",
    title: people[0]?.name || proof.personName || proof.title || "—",
    subtitle: people.length > 1 ? (ar ? `ومعه ${people.length - 1}` : `+${people.length - 1} more`) : "",
    ref: proof.ref || proof.id || "",
    status: stateLabel ? { label: stateLabel, tone } : null,
    facts: [
      { label: ar ? "الفرع" : "Branch", value: branch },
      { label: ar ? "المضيف" : "Host", value: proof.hostName || (ar ? "بدون مضيف" : "No host") },
      { label: ar ? "سجّلها" : "Recorded by", value: proof.raiserName },
      { label: ar ? "من" : "From", value: printStamp(from), mono: true },
      { label: ar ? "حتى" : "Until", value: printStamp(to || from), mono: true },
      { label: ar ? "المدة" : "Length", value: duration },
      { label: ar ? "سبب الزيارة" : "Visit reason", value: proof.visitReason, wide: true },
    ],
    blocks: [
      {
        type: "table",
        heading: ar ? `الزوار · ${people.length}` : `Visitors · ${people.length}`,
        cols: [ar ? "الاسم" : "Name", ar ? "الهوية" : "ID", ar ? "الصفة" : "Title", ar ? "البطاقة" : "Badge", ar ? "دخل" : "In", ar ? "خرج" : "Out"],
        monoCols: [1, 3, 4],
        nowrapCols: [1, 4, 5],
        rows: people.map((x) => [x.name || "—", maskId(x.id), x.title || "", x.badge || "", printStamp(x.inAt || proof.arrivedAt), printStamp(x.outAt) || (ar ? "في الفرع" : "On site")]),
        empty: ar ? "لا زوار مسجّلون." : "No visitors recorded.",
      },
      vehicles.length ? {
        type: "table",
        heading: ar ? `السيارات · ${vehicles.length}` : `Vehicles · ${vehicles.length}`,
        cols: [ar ? "السيارة" : "Vehicle"],
        rows: vehicles.map((v) => [vehicleLine(v)]),
      } : null,
    ].filter(Boolean),
    signatures: [
      { label: ar ? "الزائر" : "Visitor", name: people[0]?.name || "" },
      { label: ar ? "المضيف" : "Host", name: proof.hostName || "" },
      { label: ar ? "الأمن / الاستقبال" : "Security / reception", name: "" },
    ],
    note: ar ? "يُعاد التصريح عند المغادرة. أرقام الهوية مختصرة لآخر أربعة أرقام." : "Return the pass on leaving. IDs show the last four digits.",
  };
}

/** A settled request as a decision notice — what was asked, what was decided, by whom, and the trail. */
export function requestDecisionSheet({ row = {}, ar = true, branch = "", tone = "mute", trail = [], article = "" }) {
  const src = row.source || {};
  const days = Number(src.days) || 0;
  return {
    ar,
    kicker: ar ? "طلباتي · إشعار قرار" : "Requests · Decision notice",
    title: row.title || "—",
    subtitle: row.employeeName || "",
    ref: row.ref && row.ref !== "—" ? row.ref : (row.requestId || ""),
    status: row.statusLabel ? { label: row.statusLabel, tone } : null,
    facts: [
      { label: ar ? "الموظف" : "Employee", value: row.employeeName },
      { label: ar ? "الفرع" : "Branch", value: branch },
      { label: ar ? "تاريخ القرار" : "Decided", value: printStamp(row.at), mono: true },
      { label: ar ? "من" : "From", value: printStamp(src.startDate), mono: true },
      { label: ar ? "إلى" : "To", value: printStamp(src.endDate), mono: true },
      { label: ar ? "الأيام" : "Days", value: days ? String(days) : "", mono: true },
      { label: ar ? "صاحب القرار" : "Decided by", value: row.reviewedBy },
      { label: ar ? "السند النظامي" : "Legal basis", value: article },
      { label: ar ? "السبب / الملاحظة" : "Reason / note", value: row.reason, wide: true },
    ],
    blocks: [
      {
        type: "trail",
        heading: ar ? "سجل التدقيق" : "Audit trail",
        items: trail.map((e) => ({ at: printStamp(e.at), who: e.by || "", what: e.text || "" })),
      },
    ],
    signatures: [
      { label: ar ? "الموظف" : "Employee", name: row.employeeName || "" },
      { label: ar ? "صاحب القرار" : "Decided by", name: row.reviewedBy || "" },
    ],
  };
}
