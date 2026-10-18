import { visibleStations, canSeeAllStations, canAdjustPayroll } from "@/lib/permissions";
import { canSeeVoiceItem, isOwnVoice, isVoiceHrReceiver } from "@/lib/voicePrivacy";

// Builds a compact JSON snapshot of the company data the current user is allowed
// to see — sent as context to the AI assistant so it can answer questions about
// stations, employees, tasks, reports and safety.
export function buildAssistantContext(data, currentUser) {
  const stations = visibleStations(currentUser, data);
  const stationIds = new Set(stations.map((s) => s.id));
  const stationName = (id) => stations.find((s) => s.id === id)?.name || (id ? "other" : "HQ");

  const employees = data.employees
    .filter((e) => !e.stationId ? canSeeAllStations(currentUser) : stationIds.has(e.stationId))
    .map((e) => ({ id: e.id, name: e.name, role: e.role, position: e.position || undefined, station: stationName(e.stationId), points: e.points || 0 }));

  const empName = (id) => data.employees.find((e) => e.id === id)?.name || "—";

  const tasks = data.tasks
    .filter((tk) => !tk.stationId || stationIds.has(tk.stationId))
    .slice(-60)
    .map((tk) => ({ title: tk.title, status: tk.status, progress: tk.progress, target: tk.dailyTarget, station: stationName(tk.stationId), assignee: empName(tk.assignedTo), createdAt: tk.createdAt }));

  const reports = data.reports
    .filter((r) => !r.stationId || stationIds.has(r.stationId))
    .slice(-30)
    .map((r) => ({ title: r.title, content: r.content, status: r.status, station: stationName(r.stationId), author: empName(r.authorId), date: r.createdAt }));

  const safety = (data.safety || [])
    .filter((s) => stationIds.has(s.stationId))
    .map((s) => ({ station: stationName(s.stationId), level: s.level, incidents: s.incidents, hazards: s.hazards }));

  const visibleEmployeeIds = new Set(employees.map((e) => e.id));
  const plans = (data.plans || []).filter((p) => !p.stationId || stationIds.has(p.stationId)).map((p) => ({ title: p.title, station: stationName(p.stationId), startDate: p.startDate, endDate: p.endDate, status: p.status, notes: p.notes }));
  const schedules = (data.schedules || []).filter((s) => stationIds.has(s.stationId)).map((s) => ({ station: stationName(s.stationId), shifts: (s.shiftTypes || []).map((x) => `${x.label}: ${x.start}-${x.end}`).join(" | ") }));
  // Anonymous reports reach HR only: the assistant answers about them only to an HR receiver in scope.
  const complaints = (data.anonymousReports || []).filter((r) => canSeeVoiceItem({ ...r, bucket: "anon" }, currentUser, data) && !isOwnVoice({ ...r, bucket: "anon" }, currentUser)).filter((r) => !r.stationId || stationIds.has(r.stationId) || isVoiceHrReceiver(currentUser, data)).map((r) => ({ station: stationName(r.stationId), type: r.type, priority: r.priority, status: r.status, escalationLevel: r.escalationLevel || 0, message: r.message, createdAt: r.createdAt }));
  const files = (data.files || []).filter((f) => !f.stationId || stationIds.has(f.stationId)).map((f) => ({ name: f.name, type: f.type, station: stationName(f.stationId), mimeType: f.mimeType, url: f.url, createdAt: f.createdAt }));
  const targets = (data.targets || []).filter((x) => !x.stationId || stationIds.has(x.stationId)).map((x) => ({ title: x.title, station: stationName(x.stationId), assignee: empName(x.assignedTo), target: x.totalTasks || x.task_target, completed: x.completed || x.completed_tasks, deadline: x.deadline || x.end_date, status: x.status }));
  const employeeDetails = (data.employees || []).filter((e) => visibleEmployeeIds.has(e.id) && (currentUser.role !== "employee" || e.id === currentUser.id)).map((e) => ({ employeeId: e.id, employee: e.name, certificates: (e.certificates || []).map((c) => ({ id: c.id, name: c.name || c.title, status: c.status })), leaveRequests: (e.leaveRequests || []).map((r) => ({ id: r.id, type: r.type, status: r.status, days: r.days || 0, startDate: r.startDate, endDate: r.endDate })) }));
  const payroll = (data.payrollRuns || []).slice(-12).map((run) => ({ period: run.period || run.month, status: run.status, items: (run.items || []).filter((item) => canAdjustPayroll(currentUser, data) || item.employeeId === currentUser.id).map((item) => ({ employee: empName(item.employeeId), netSalary: item.netSalary, paid: item.paid })) }));

  return {
    company: data.name,
    today: new Date().toISOString().slice(0, 10),
    stations: stations.map((s) => ({ name: s.name, location: s.location, type: s.type, status: s.status, manager: empName(s.managerId), gpsConfigured: s.lat != null && s.lng != null, radiusMeters: s.radiusMeters })),
    employees,
    tasks,
    targets,
    dailyReports: reports,
    safety,
    plans,
    schedules,
    complaints,
    files,
    employeeDetails,
    payroll,
    notifications: (data.notifications || []).filter((entry) => entry.userId === currentUser.id).slice(0, 30).map(({ text, read, createdAt }) => ({ text, read, createdAt })),
    planner: (data.plannerItems || []).filter((entry) => !entry.userId || entry.userId === currentUser.id).slice(-30),
    journal: (data.journalEntries || []).filter((entry) => !entry.userId || entry.userId === currentUser.id).slice(-30),
    hrStructure: (data.hrLevels || []).map((h) => ({ name: h.name, role: h.role, scope: h.scope, order: h.order, active: h.active !== false })),
  };
}