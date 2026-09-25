import { updateCompany } from "@/lib/store";
import { hangOrphanStationsUnderCompany, isCompanyRootStation, isHrUnit, stationParentId } from "@/lib/stationTree";
import { appendOrgStructureEvent } from "@/lib/orgStructureLog";
import { applyWorkplaceManagerRule } from "@/lib/peopleTreeGraph";

export function getStationDependencySummary(data, stationId) {
  const belongs = (item) => item?.stationId === stationId || item?.station_id === stationId || item?.assignmentId === stationId || item?.assignment_id === stationId;
  return { employees: (data?.employees || []).filter((e) => e.stationId === stationId).length, openTasks: (data?.tasks || []).filter((t) => belongs(t) && t.status !== "completed").length, attendance: (data?.personalAttendance || []).filter(belongs).length, safety: (data?.safety || []).filter(belongs).length };
}

export function deleteStationWithData(companyId, stationId, { mode, targetStationId } = {}) {
  if (!stationId || !["transfer", "delete"].includes(mode) || (mode === "transfer" && (!targetStationId || targetStationId === stationId))) return false;
  let blocked = false;
  updateCompany(companyId, (data) => {
    const station = (data.stations || []).find((item) => String(item.id) === String(stationId));
    if (isCompanyRootStation(station) || isHrUnit(station)) {
      blocked = true;
      return;
    }
    const parentId = stationParentId(station);
    const stationName = station.name || "";
    (data.stations || []).forEach((item) => {
      if (String(stationParentId(item) || "") === String(stationId)) {
        item.parentStationId = parentId;
      }
    });
    const moveOrRemove = (items) => mode === "transfer" ? (items || []).map((item) => item.stationId === stationId ? { ...item, stationId: targetStationId } : item) : (items || []).filter((item) => item.stationId !== stationId);
    (data.employees || []).forEach((employee) => {
      if (employee.stationId === stationId) employee.stationId = mode === "transfer" ? targetStationId : null;
      if (employee.hrStationId === stationId) employee.hrStationId = mode === "transfer" ? targetStationId : null;
      employee.managedStations = [...new Set((employee.managedStations || []).flatMap((id) => id === stationId ? (mode === "transfer" ? [targetStationId] : []) : [id]))];
      (employee.actingAssignments || []).forEach((item) => {
        if (String(item.stationId) === String(stationId) && !item.endedAt) item.endedAt = new Date().toISOString();
      });
    });
    data.tasks = mode === "transfer" ? (data.tasks || []).map((task) => ({ ...task, stationId: task.stationId === stationId ? targetStationId : task.stationId, assignmentId: task.assignmentId === stationId ? targetStationId : task.assignmentId })) : (data.tasks || []).filter((task) => task.stationId !== stationId && task.assignmentId !== stationId);
    if (mode === "transfer") {
      const sourceSafety = (data.safety || []).find((record) => record.stationId === stationId);
      const targetSafety = (data.safety || []).find((record) => record.stationId === targetStationId);
      if (sourceSafety && targetSafety) {
        ["hazards", "riskItems", "incidentLog", "hazardLog", "permits", "approvalLog"].forEach((key) => { targetSafety[key] = [...(targetSafety[key] || []), ...(sourceSafety[key] || [])]; });
        data.safety = (data.safety || []).filter((record) => record !== sourceSafety);
      } else data.safety = moveOrRemove(data.safety);
    } else data.safety = moveOrRemove(data.safety);
    data.personalAttendance = moveOrRemove(data.personalAttendance);
    ["reports", "anonymousReports", "publicReports", "files", "plans", "templates"].forEach((key) => { data[key] = moveOrRemove(data[key]); });
    if (mode === "transfer") {
      const source = (data.schedules || []).find((schedule) => schedule.stationId === stationId);
      const target = (data.schedules || []).find((schedule) => schedule.stationId === targetStationId);
      if (source && target) {
        target.assignments = target.assignments || {};
        target.shiftTypes = [...(target.shiftTypes || []), ...(source.shiftTypes || []).filter((shift) => !(target.shiftTypes || []).some((item) => item.id === shift.id))];
        Object.entries(source.assignments || {}).forEach(([day, shifts]) => { target.assignments[day] = { ...(target.assignments[day] || {}), ...shifts }; });
      } else if (source) source.stationId = targetStationId;
    }
    data.schedules = (data.schedules || []).filter((schedule) => schedule.stationId !== stationId);
    data.orgSeats = mode === "transfer"
      ? (data.orgSeats || []).map((seat) => String(seat.stationId) === String(stationId) ? { ...seat, stationId: targetStationId } : seat)
      : (data.orgSeats || []).filter((seat) => String(seat.stationId) !== String(stationId));
    data.orgTree = (data.orgTree || []).filter((node) => !(node.type === "station" && String(node.refId) === String(stationId)));
    (data.payrollRuns || []).forEach((run) => (run.items || []).forEach((item) => { if (item.employeeStationId === stationId) item.employeeStationId = mode === "transfer" ? targetStationId : null; }));
    ["hrClusters", "stationChatGroups"].forEach((key) => (data[key] || []).forEach((item) => { item.stationIds = [...new Set((item.stationIds || []).flatMap((id) => id === stationId ? (mode === "transfer" ? [targetStationId] : []) : [id]))]; }));
    data.stations = (data.stations || []).filter((item) => item.id !== stationId);
    hangOrphanStationsUnderCompany(data.stations);
    applyWorkplaceManagerRule(data);
    appendOrgStructureEvent(data, {
      type: "deleted",
      stationId,
      stationName,
      to: parentId,
    });
  });
  return !blocked;
}