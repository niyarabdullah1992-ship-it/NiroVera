import { addCompanyFile, getCompanyToken } from "@/lib/store";
import { requestReplyHref } from "@/lib/requestWorkspace";
import { recordSafetyIncident } from "@/lib/safetyStore";
import { canManageEmployees, hasHRPermission } from "@/lib/permissions";
import { buildAssistantContext } from "./assistantContext";
import { printReport } from "@/lib/printReport";
import { generateSignedReport } from "@/lib/signedReport";
import { base44 } from "@/api/base44Client";
import { exportExcelColored } from "@/lib/exportExcelColored";
import { buildDocumentHtml, openDocumentHtml } from "@/lib/printDocument";
import { enrichAssistantContext } from "@/lib/assistantLiveContext";
import { uiDateLocale } from "@/lib/dateFormat";
import { inventoryCall } from "@/lib/inventoryApi";
import { expensesCall } from "@/lib/expensesApi";

// Turns markdown-ish document text ("## heading", "- bullet", paragraphs) into sections.
function parseDocContent(md) {
  const sections = [];
  let cur = null;
  for (const line of String(md || "").split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const h = l.match(/^#{1,4}\s*(.+)/);
    if (h) { cur = { heading: h[1], body: "", bullets: [] }; sections.push(cur); continue; }
    if (!cur) { cur = { heading: "", body: "", bullets: [] }; sections.push(cur); }
    if (/^[-*•]\s+/.test(l)) cur.bullets.push(l.replace(/^[-*•]\s+/, ""));
    else cur.body += (cur.body ? "\n" : "") + l;
  }
  return sections.filter((s) => s.heading || s.body || s.bullets.length);
}

// Executes real actions requested by the AI assistant (exports, task creation, status updates).
// Every write action is permission-gated; exports only include data the user can already see.

const WRITE_ROLES = ["director", "ops_manager", "pgm", "station_manager"];

function downloadCSV(filename, rows) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

const norm = (s) => String(s || "").trim().toLowerCase();
const matches = (a, b) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));

async function datasetRows(action, data, currentUser, company) {
  const ctx = buildAssistantContext(data, currentUser);
  await enrichAssistantContext(ctx, { session: { companyId: company.id }, data });
  const dataset = norm(action.dataset);
  if (dataset === "tasks" || dataset === "targets") {
    const res = await base44.functions.invoke("supabaseTargets", {
      action: "listTargets",
      companyId: company.id,
      sessionToken: getCompanyToken(company.id),
    });
    let tasks = (res?.data?.targets || []).map((item) => ({
      title: item.title,
      status: item.status,
      progress: item.completed_tasks || 0,
      target: item.task_target,
      station: data.stations.find((station) => station.id === item.station_id)?.name || "—",
      assignee: data.employees.find((employee) => employee.id === (item.assignment_id || item.employee_id))?.name || "—",
      deadline: item.end_date,
      priority: item.priority,
    }));
    const filter = norm(action.filter);
    if (filter === "incomplete") tasks = tasks.filter((item) => !["completed", "done"].includes(norm(item.status)));
    if (filter === "completed") tasks = tasks.filter((item) => ["completed", "done"].includes(norm(item.status)));
    if (filter === "active" || filter === "overdue") tasks = tasks.filter((item) => norm(item.status) === filter);
    return tasks;
  }
  if (dataset === "attendance") {
    const ids = ctx.employees.map((e) => e.id);
    if (!ids.length) return [];
    const res = await base44.functions.invoke("supabaseAttendance", { action: "listDaily", employeeIds: ids });
    return (res?.data?.rows || []).map((r) => ({ employee: r.employee_name, status: r.status, checkIn: r.check_in_at, checkOut: r.check_out_at, workHours: r.work_hours, location: r.location_status }));
  }
  const map = {
    employees: ctx.employees.map(({ id, ...e }) => e),
    tasks: ctx.tasks,
    targets: ctx.targets,
    reports: ctx.dailyReports.map(({ content, ...r }) => r),
    stations: ctx.stations,
    safety: ctx.safety.map((s) => ({ ...s, hazards: (s.hazards || []).join(" | ") })),
    plans: ctx.plans,
    schedules: ctx.schedules,
    complaints: ctx.complaints,
    files: ctx.files,
    hr: ctx.hrStructure,
    leaves: ctx.employeeDetails.map((e) => ({ employee: e.employee, leaveRequests: e.leaveRequests })),
    certificates: ctx.employeeDetails.map((e) => ({ employee: e.employee, certificates: e.certificates })),
    performance: ctx.employees.map(({ id, name, station, points }) => ({ name, station, points })),
    inventory: ctx.inventory,
    inventory_movements: ctx.inventoryMovements,
    material_requests: ctx.materialRequests,
    expenses: ctx.expenses,
    payroll: ctx.payroll.flatMap((run) => run.items.map((item) => ({ period: run.period, status: run.status, ...item }))),
  };
  return map[dataset];
}

export async function executeAssistantAction(action, { data, company, currentUser, t }) {
  const canWrite = WRITE_ROLES.includes(currentUser.role);
  const sessionAuth = { companyId: company.id, sessionToken: getCompanyToken(company.id) };

  if (action.type === "export_data") {
    const dataset = norm(action.dataset);
    const rows = await datasetRows(action, data, currentUser, company);
    const isBlankSchedule = dataset === "schedules" && (!rows || !rows.length);
    if ((!rows || !rows.length) && !isBlankSchedule) return { ok: false, message: t("aiNoData") };

    const headers = isBlankSchedule
      ? [t("employeeName"), t("station"), t("date"), t("shift"), t("workStartTime"), t("workEndTime")]
      : Object.keys(rows[0]);
    const tableRows = isBlankSchedule
      ? Array.from({ length: 12 }, () => headers.map(() => ""))
      : rows.map((r) => Object.values(r));

    if (norm(action.format) === "pdf") {
      printReport({
        title: action.reportTitle || dataset,
        companyName: data.name || "",
        periodLabel: new Date().toLocaleDateString(uiDateLocale(document.documentElement.dir === "rtl")),
        dir: document.documentElement.dir,
        sections: [{ heading: action.reportTitle || dataset, headers, rows: tableRows }],
        logoUrl: data.reportBranding?.logoUrl || "",
        color: data.reportBranding?.color || "#14284B",
      });
      return { ok: true, message: t("aiPdfDone") };
    }
    exportExcelColored({
      filename: `${dataset}_${new Date().toISOString().slice(0, 10)}`,
      title: action.reportTitle || dataset,
      headers,
      rows: tableRows,
      color: data.reportBranding?.color || "#14284B",
      dir: document.documentElement.dir,
    });
    return { ok: true, message: t("aiExportDone") };
  }

  if (action.type === "create_document") {
    const ar = document.documentElement.dir === "rtl";
    const title = action.docTitle || action.reportTitle || action.title || (ar ? "مستند" : "Document");
    let sections = Array.isArray(action.sections) && action.sections.length ? action.sections : parseDocContent(action.docContent);
    if (!sections.length && action.description) sections = [{ heading: "", body: action.description, bullets: [] }];
    if (!sections.length) return { ok: false, message: t("aiActionFailed") };
    const html = buildDocumentHtml({
      title,
      subtitle: action.subtitle || "",
      sections,
      dir: document.documentElement.dir,
      companyName: data.name || "",
      authorName: currentUser?.name || "",
      color: data.reportBranding?.color || "#14284B",
      logoUrl: data.reportBranding?.logoUrl || "",
    });
    // Save a copy into the Files section so the document is always findable.
    let savedUrl = null;
    try {
      const file = new File([html], `${title}.html`, { type: "text/html" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      addCompanyFile(company.id, {
        name: file.name, parentId: null, url: file_url,
        size: file.size, mimeType: "text/html",
        uploadedBy: currentUser?.name || "", stationId: null,
      });
      savedUrl = file_url;
    } catch { /* file save is best-effort — the print window still opens */ }
    const opened = openDocumentHtml(html);
    if (!opened && !savedUrl) return { ok: false, message: t("aiActionFailed") };
    const msg = ar
      ? `تم إنشاء المستند «${title}»${savedUrl ? " وحفظه في قسم الملفات" : ""} — يمكنك فتحه من البطاقة أدناه وتحميله PDF عبر زر الطباعة.`
      : `Document "${title}" created${savedUrl ? " and saved to the Files section" : ""} — open it from the card below and download it as PDF via the print button.`;
    return { ok: true, message: msg, doc: savedUrl ? { title, url: savedUrl } : null };
  }

  if (action.type === "sign_report") {
    const rows = await datasetRows(action, data, currentUser, company);
    const hasRows = Array.isArray(rows) && rows.length > 0;
    const { verificationId } = await generateSignedReport({
      title: action.reportTitle || action.dataset,
      companyName: data.name || "",
      dir: document.documentElement.dir,
      headers: hasRows ? Object.keys(rows[0]) : [document.documentElement.dir === "rtl" ? "لا توجد بيانات حالية" : "No current data"],
      rows: hasRows ? rows.map((r) => Object.values(r)) : [],
      signerName: currentUser?.profile?.signatureName || currentUser.name,
      signatureUrl: currentUser?.profile?.signatureUrl || "",
      signerId: currentUser.id,
      companyId: company.id,
      logoUrl: data.reportBranding?.logoUrl || "",
    });
    return { ok: true, message: `${t("aiReportSigned")} ${verificationId}` };
  }

  if (action.type === "open_page") {
    const routes = {
      dashboard: "/app", executive: "/app/executive", tasks: "/app/tasks", attendance: "/app/attendance",
      reports: "/app", performance: "/app/performance", employees: "/app/employees",
      stations: "/app/stations", hr: "/app/hr", payroll: "/app/payroll", complaints: "/app/complaints",
      files: "/app/files",
      signing: "/app/signing", verify: "/verify",
      inventory: "/app/inventory", expenses: "/app/expenses", safety: "/app/safety",
      leave: "/app/requests/leave", requests: "/app/requests",
    };
    const path = routes[norm(action.page)];
    if (!path) return { ok: false, message: t("aiActionFailed") };
    window.open(path, "_blank");
    return { ok: true, message: t("aiOpeningPage") };
  }

  if (action.type === "create_inventory_item") {
    const station = data.stations.find((entry) => matches(entry.name, action.station || ""));
    if (!station || !action.title || !action.itemCode || !action.supplierName || Number(action.quantity) <= 0 || Number(action.totalCost) < 0) return { ok: false, message: t("aiNoData") };
    await inventoryCall(sessionAuth, "createItem", { name: action.title, itemCode: action.itemCode, supplierName: action.supplierName, locationId: station.id, quantity: Number(action.quantity), totalCost: Number(action.totalCost), minimumStock: Number(action.minimumStock || 0), purchaseDate: new Date().toISOString().slice(0, 10) });
    return { ok: true, message: document.documentElement.dir === "rtl" ? "تم تسجيل عملية الشراء في المخزون." : "Inventory purchase recorded." };
  }

  if (["request_inventory", "issue_inventory", "review_inventory_request"].includes(action.type)) {
    const inventory = await inventoryCall(sessionAuth, "list", { stations: data.stations || [] });
    if (action.type === "review_inventory_request") {
      await inventoryCall(sessionAuth, "reviewRequest", { requestId: action.requestId, decision: action.decision });
      return { ok: true, message: document.documentElement.dir === "rtl" ? "تمت مراجعة طلب المواد." : "Material request reviewed." };
    }
    const item = inventory.requestItems.find((entry) => matches(entry.name, action.title || "") || matches(entry.itemCode, action.title || ""));
    if (!item) return { ok: false, message: t("aiNoData") };
    if (action.type === "request_inventory") {
      const source = data.stations.find((entry) => matches(entry.name, action.sourceStation || ""));
      const destination = data.stations.find((entry) => matches(entry.name, action.destinationStation || ""));
      if (!source || !destination) return { ok: false, message: t("aiNoData") };
      await inventoryCall(sessionAuth, "request", { itemId: item.id, sourceStationId: source.id, stationId: destination.id, quantity: Number(action.quantity), notes: action.description });
      return { ok: true, message: document.documentElement.dir === "rtl" ? "تم إرسال طلب المواد." : "Material request submitted." };
    }
    const station = data.stations.find((entry) => matches(entry.name, action.station || ""));
    const employee = data.employees.find((entry) => matches(entry.name, action.assignee || ""));
    if (!station || !employee) return { ok: false, message: t("aiNoData") };
    await inventoryCall(sessionAuth, "issueToWork", { itemId: item.id, fromLocationId: station.id, employeeId: employee.id, quantity: Number(action.quantity), workReference: action.workReference, workDate: action.workDate, notes: action.description || "" });
    return { ok: true, message: document.documentElement.dir === "rtl" ? "تم صرف الصنف للعمل." : "Inventory issued to work." };
  }

  if (action.type === "review_expense") {
    const reviewAction = String(action.decision || "").startsWith("finance_") ? "financeReview" : "managerReview";
    await expensesCall(sessionAuth, reviewAction, { claimId: action.claimId, decision: action.decision });
    return { ok: true, message: document.documentElement.dir === "rtl" ? "تمت مراجعة المصروف." : "Expense reviewed." };
  }

  if (action.type === "submit_leave") {
    window.open("/app/requests/leave", "_blank");
    return {
      ok: true,
      message: document.documentElement.dir === "rtl"
        ? "تقديم الإجازة يتم من قسم طلباتي — فُتح مسار الإجازة هناك. عبّئ النوع والتاريخ والإقرار من ذلك النموذج."
        : "Leave is raised in My Requests — the leave lane is open. Complete type, dates, and the acknowledgement there.",
    };
  }

  if (action.type === "review_leave") {
    const allowed = canManageEmployees(currentUser) || hasHRPermission(currentUser, data, "manage_leave") || hasHRPermission(currentUser, data, "manage_employees");
    if (!allowed) return { ok: false, message: t("aiNoPermission") };
    window.open(requestReplyHref({ manage: true }), "_blank");
    return {
      ok: true,
      message: document.documentElement.dir === "rtl"
        ? "الرد على الإجازة والموافقة الدراسية يتم من قسم طلباتي — فُتح المسار هناك."
        : "Leave and study-consent replies are written in My Requests — that lane is open.",
    };
  }

  if (action.type === "log_safety_incident") {
    const station = action.station ? data.stations.find((entry) => matches(entry.name, action.station)) : null;
    if (!station || !String(action.description || "").trim()) return { ok: false, message: t("aiNoData") };
    const saved = recordSafetyIncident(company.id, station.id, action.description, currentUser.name);
    return { ok: saved, message: saved ? (document.documentElement.dir === "rtl" ? "تم تسجيل حادث السلامة." : "Safety incident recorded.") : t("aiActionFailed") };
  }

  if (action.type === "create_task") {
    if (!canWrite) return { ok: false, message: t("aiNoPermission") };
    const station = action.station ? data.stations.find((s) => matches(s.name, action.station)) : null;
    const assignee = action.assignee ? data.employees.find((e) => matches(e.name, action.assignee)) : null;
    if ((action.station && !station) || (action.assignee && !assignee)) return { ok: false, message: t("aiNoData") };
    const homeStation = station || (currentUser.stationId
      ? data.stations.find((s) => String(s.id) === String(currentUser.stationId))
      : null);
    const assignmentType = assignee ? "member" : homeStation ? "station_team" : null;
    if (!assignmentType) return { ok: false, message: t("aiNoData") };
    try {
      const res = await base44.functions.invoke("supabaseTargets", {
        action: "createTarget",
        ...sessionAuth,
        managerId: currentUser.id,
        title: action.title || "Untitled task",
        description: action.description || "",
        steps: action.steps || "",
        section: action.section || "",
        taskTarget: Number(action.taskTarget || action.dailyTarget) || 1,
        assignmentType,
        assignmentId: assignee ? assignee.id : homeStation.id,
        employeeId: assignee?.id || null,
        stationId: assignee ? (assignee.stationId || null) : homeStation.id,
        priority: ["urgent", "high", "medium", "low"].includes(action.priority) ? action.priority : "medium",
        days: Number(action.days) > 0 ? Number(action.days) : 30,
      });
      if (res?.data?.target) return { ok: true, message: t("aiTaskCreated") };
      return { ok: false, message: res?.data?.error || t("aiActionFailed") };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.error || t("aiActionFailed") };
    }
  }

  if (action.type === "log_progress") {
    try {
      const res = await base44.functions.invoke("supabaseTargets", {
        action: "listTargets",
        ...sessionAuth,
        userId: currentUser.id,
      });
      const tg = (res?.data?.targets || []).find((x) => matches(x.title, action.taskTitle || ""));
      if (!tg) return { ok: false, message: t("aiNoData") };
      await base44.functions.invoke("supabaseTargets", {
        action: "updateProgress",
        ...sessionAuth,
        targetId: tg.id,
        amount: Number(action.amount) || 1,
        userId: currentUser.id,
        managerId: tg.manager_id,
        employeeName: currentUser.name,
        proofFiles: [],
      });
      return { ok: true, message: t("aiStatusUpdated") };
    } catch (err) {
      const code = err?.response?.data?.error;
      return { ok: false, message: code === "PROOF_REQUIRED" ? t("proofRequired") : (code || t("aiActionFailed")) };
    }
  }

  if (action.type === "report_task_issue") {
    const res = await base44.functions.invoke("supabaseTargets", { action: "listTargets", ...sessionAuth, userId: currentUser.id });
    const task = (res?.data?.targets || []).find((entry) => matches(entry.title, action.taskTitle || ""));
    if (!task || !String(action.description || "").trim()) return { ok: false, message: t("aiNoData") };
    await base44.functions.invoke("supabaseTargets", {
      action: "addComment", ...sessionAuth, targetId: task.id,
      content: String(action.description).trim(), files: [], isIssue: true,
    });
    return { ok: true, message: document.documentElement.dir === "rtl" ? "تم تسجيل مشكلة المهمة وإشعار المسؤول." : "Task issue reported and the responsible manager was notified." };
  }

  if (action.type === "send_email") {
    if (!canWrite) return { ok: false, message: t("aiNoPermission") };
    const to = String(action.to || "").trim();
    const subject = String(action.subject || "").trim();
    const message = String(action.message || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !message) return { ok: false, message: t("aiNoData") };
    await base44.functions.invoke("gmailNotify", { ...sessionAuth, kind: "assistant_email", to, subject, text: message });
    return { ok: true, message: document.documentElement.dir === "rtl" ? `تم إرسال البريد إلى ${to}.` : `Email sent to ${to}.` };
  }

  return { ok: false, message: t("aiActionFailed") };
}