import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import HrServesPanel from "@/components/hr/HrServesPanel";
import {
  CONTRACT_TYPE_OPTIONS,
  ID_TYPE_OPTIONS,
  isFixedContractType,
  optionLabel,
  profileFieldValue,
} from "@/lib/employeeProfileFields";
import { serviceLabel } from "@/lib/employeeFileView";
import { citeRule, formatRuleFigure, ruleValue } from "@/lib/laborRules";
import { isHoursExempt108, isJuvenile, ordinaryDayCap, ordinaryWeekCap } from "@/lib/laborHoursPolicy";
import { annualBalanceSplit } from "@/lib/leaveTypes";
import { leaveRequestsForEmployeeId } from "@/lib/leaveDerivations";
import {
  activeActingAssignments,
  createVacantSeatsUnderManager,
  cycleSeatAccess,
  endSeatTenure,
  findEmployeeByName,
  jobTitleCatalog,
  occupantTitle,
  placeExistingEmployee,
  SEAT_ACCESS_ROWS,
  seatAccessOf,
  seatDrawerReason,
  seatForEmployee,
  setActingAssignment,
  setActualWorkSite,
} from "@/lib/orgHire";
import { assignHolderGrade, employeeJobGrade, gradeRank, gradeSalaryRange, gradesForTitle, ladderBands, orderedJobGrades } from "@/lib/jobGrades";
import { orgGradeColor } from "@/components/hr/orgUi";
import { buildPeopleTree, explainWorkplaceManager, pathToPerson } from "@/lib/peopleTree";
import { isCompanyRootStation, isHrUnit, isManagerUnit, stationParentId, workplaceStations } from "@/lib/stationTree";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  employeeFileLaborWeek,
  employeeShiftOnDay,
  employeeWeekHours,
  employeeWorkStationId,
  findStationById,
  stationDisplayName,
  weekDateKeys,
  weekStartDate,
} from "@/lib/shiftWeek";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";

const MONO = {
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  direction: "ltr",
  unicodeBidi: "isolate",
};

const FIELD_INPUT = {
  height: 34,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #DFE3EA",
  fontSize: 12,
  color: "#14213D",
  outline: "none",
  background: "#fff",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};

const NOTE = {
  fontSize: 11,
  color: "#4B5567",
  background: "#EEF2F8",
  border: "1px solid #DFE3EA",
  padding: "9px 11px",
  borderRadius: 10,
  lineHeight: 1.8,
};

function gradeChipStyle(color = "#4B5567") {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    padding: "0 7px",
    borderRadius: 5,
    font: "700 10.5px 'Readex Pro', sans-serif",
    color: "#fff",
    background: color,
    flex: "none",
  };
}

function dash(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function isoDate(value) {
  const key = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function todayKey() {
  const day = new Date();
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function plusDays(count) {
  const day = new Date();
  day.setDate(day.getDate() + count);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function dayFigure(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function hourFigure(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function jobNumberOf(employee) {
  const profile = employee?.profile || {};
  const tagged = [employee?.employeeNo, profile.employeeNo, profile.employeeNumber, employee?.employeeNumber]
    .map((item) => String(item || "").trim())
    .find(Boolean);
  if (tagged) return tagged;
  const alt = String(profile.employeeId || employee?.employeeId || "").trim();
  const internal = String(employee?.id || "").trim();
  if (alt && alt !== internal) return alt;
  return "";
}

function reportingStationId(data, employee) {
  const seat = seatForEmployee(data, employee?.id);
  return String(seat?.stationId || employee?.stationId || employee?.profile?.stationId || "").trim();
}

function stationByWalk(data, stationId) {
  return findStationById(data?.stations || [], stationId);
}

function affiliationName(data, employee) {
  const homeId = reportingStationId(data, employee);
  if (!homeId) return "";
  const byId = new Map((data?.stations || []).map((station) => [String(station.id), station]));
  let cursor = byId.get(String(homeId));
  const seen = new Set();
  while (cursor && !seen.has(String(cursor.id))) {
    seen.add(String(cursor.id));
    if (!isManagerUnit(cursor)) return stationDisplayName(cursor);
    const parentId = stationParentId(cursor);
    cursor = parentId ? byId.get(String(parentId)) : null;
  }
  return stationDisplayName(stationByWalk(data, homeId));
}

function titleChain(data, employee, ar) {
  const tree = buildPeopleTree(data);
  const path = pathToPerson(tree?.roots, employee?.id) || [];
  const titles = path.map((node) => String(node.job || "").trim()).filter(Boolean);
  if (titles.length) return titles.join(" ← ");
  return occupantTitle(employee, data, ar);
}

function managerLine(data, employee, ar) {
  const seat = seatForEmployee(data, employee.id);
  const managerId = String(seat?.reportsToEmployeeId || employee?.profile?.directManagerId || "").trim();
  if (managerId && managerId === String(employee.id)) return "";
  const named = String(seat?.reportsToName || "").trim();
  if (!managerId) return named;
  const hit = (data?.employees || []).find((item) => String(item.id) === managerId);
  if (!hit) return named;
  const title = occupantTitle(hit, data, ar);
  return [hit.name, title].filter(Boolean).join(" · ");
}

function scheduleFor(data, employee) {
  const stationId = employeeWorkStationId(employee);
  return (data?.schedules || []).find((row) => String(row.stationId) === String(stationId))
    || { shiftTypes: [], assignments: {} };
}

function personHasWeekDuty(schedule, employeeId, weekStart) {
  if (!employeeId) return false;
  return weekDateKeys(weekStart).some((key) => employeeShiftOnDay(schedule, employeeId, key));
}

function scheduleConstraints(employee, data, onDate, laborCalendar, ar) {
  const company = data;
  const exempt = isHoursExempt108(employee, company);
  const dayCap = exempt
    ? ruleValue("hours.shift.ordinaryHours", onDate)
    : ordinaryDayCap(employee, company, onDate, laborCalendar);
  const weekCap = exempt
    ? ruleValue("hours.week.ordinaryMaxHours", onDate)
    : ordinaryWeekCap(employee, company, onDate, laborCalendar);
  const cite = citeRule("hours.week.ordinaryMaxHours", onDate);
  const rows = [{
    src: ar ? (cite?.labelAr || "") : (cite?.labelEn || ""),
    text: ar
      ? `${formatRuleFigure(dayCap, "hours", true)} يومياً أو ${weekCap} أسبوعياً`
      : `${dayCap} hours a day or ${weekCap} a week`,
    effect: ar ? "يُفحص على الأسبوع المنشور" : "Checked on the published week",
  }];
  if (isJuvenile(employee, onDate)) {
    const juvenile = citeRule("hours.juvenile.ordinaryHours", onDate);
    const juvenileDay = ruleValue("hours.juvenile.ordinaryHours", onDate);
    rows.push({
      src: ar ? (juvenile?.labelAr || "") : (juvenile?.labelEn || ""),
      text: ar
        ? `${formatRuleFigure(juvenileDay, "hours", true)} يومياً للحدث`
        : `${juvenileDay} hours a day for a juvenile`,
      effect: ar ? "يُفحص على الأسبوع المنشور" : "Checked on the published week",
    });
  }
  return rows.filter((row) => row.src || row.text);
}

function statutoryClass(employee, data, onDate, ar) {
  if (isJuvenile(employee, onDate)) {
    const cite = citeRule("hours.juvenile.maxAgeYears", onDate);
    const label = ar ? cite?.labelAr : cite?.labelEn;
    return label ? `${label} · ${ar ? "فئة حدث" : "juvenile class"}` : "";
  }
  if (isHoursExempt108(employee, data)) {
    const cite = citeRule("hours.art108.cite", onDate);
    const label = ar ? cite?.labelAr : cite?.labelEn;
    return label ? `${label} · ${ar ? "فئة مستثناة" : "exempt class"}` : "";
  }
  return "";
}

function occupancyRows(data, employee, ar) {
  const today = isoDate(new Date().toISOString()) || new Date().toISOString().slice(0, 10);
  const seat = seatForEmployee(data, employee.id);
  const hire = isoDate(employee?.profile?.hireDate || employee?.hireDate || employee?.startDate);
  const filled = isoDate(seat?.filledAt);
  const rows = [];
  if (employee?.name) {
    rows.push({
      name: employee.name,
      type: ar ? "دائم" : "Permanent",
      acting: false,
      from: filled || hire,
      to: "",
      current: true,
    });
  }
  (data?.employees || []).forEach((person) => {
    (person?.actingAssignments || []).forEach((item) => {
      const onSeat = seat?.id && String(item.seatId || "") === String(seat.id);
      if (!onSeat) return;
      const until = isoDate(item.until);
      const ended = isoDate(item.endedAt);
      const current = !item.endedAt && (!until || until >= today);
      rows.push({
        name: person.name || "",
        type: ar ? "تكليف" : "Acting",
        acting: true,
        from: isoDate(item.from || item.createdAt),
        to: ended || until,
        current,
      });
    });
  });
  return rows
    .filter((row) => row.name)
    .sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1;
      return String(b.from || "").localeCompare(String(a.from || ""));
    });
}

function hoursAndStatus(employee, data, onDate, laborCalendar, ar) {
  const schedule = scheduleFor(data, employee);
  const weekStart = weekStartDate(onDate);
  const hasDuty = personHasWeekDuty(schedule, employee.id, weekStart);
  const exempt = isHoursExempt108(employee, data);
  if (!hasDuty) return { hours: "", status: "" };
  const station = stationByWalk(data, employeeWorkStationId(employee));
  let pack = null;
  try {
    pack = employeeFileLaborWeek({
      employee,
      schedule,
      weekStart,
      ar,
      station,
      settings: data?.settings,
      company: data,
      laborCalendar,
      today: onDate,
    });
  } catch {
    pack = null;
  }
  const cap = ordinaryWeekCap(employee, data, onDate, laborCalendar);
  const worked = pack?.hours ?? employeeWeekHours(schedule, employee.id, weekStart, employee, laborCalendar);
  const workedText = hourFigure(worked);
  const capText = dayFigure(cap);
  const hours = !exempt && workedText && capText ? `${workedText} / ${capText}` : "";
  let status = "";
  if (pack?.blockers?.length) status = ar ? "مانع قائم" : "Blocker";
  else if (pack?.warnings?.length) status = ar ? "تنبيه" : "Notice";
  else if (pack && !exempt) status = ar ? "مستوفٍ" : "In order";
  return { hours, status };
}

function leaveFraction(employee, data, onDate) {
  const profile = employee?.profile || {};
  if (!isoDate(profile.hireDate || employee?.hireDate || employee?.startDate)) return "";
  const requests = leaveRequestsForEmployeeId(employee.id, { entity: employee, roster: data?.leaveRoster || [] });
  const split = annualBalanceSplit(profile, requests, onDate);
  if (split.currentTotal == null) return "";
  const left = dayFigure(split.currentLeft);
  const total = dayFigure(split.currentTotal);
  if (!left || !total) return "";
  return `${left} / ${total}`;
}

function contractLine(employee, ar) {
  const profile = employee?.profile || {};
  const raw = profileFieldValue(profile, "contractType", employee);
  const label = optionLabel(CONTRACT_TYPE_OPTIONS, raw, ar) || "";
  if (!label) return "";
  const end = isoDate(profile.contractEndDate || profile.contract?.endDate);
  if (isFixedContractType(raw) && end) return `${label} · ${ar ? "حتى" : "until"} ${end}`;
  return label;
}

function liveGrade(employee, data) {
  const seat = seatForEmployee(data, employee?.id);
  const gradeId = seat?.gradeId || employee?.profile?.gradeId;
  const listed = (data?.jobGrades || []).find((item) => gradeId && String(item.id) === String(gradeId));
  return listed || employeeJobGrade(employee, data) || null;
}

function gradeLeaveDays(grade) {
  const raw = grade?.annualLeaveDays ?? grade?.leaveDays ?? grade?.annualDays;
  const days = Number(raw);
  return Number.isFinite(days) && days > 0 ? days : null;
}

function branchCodeOf(data, employee) {
  const homeId = reportingStationId(data, employee);
  if (!homeId) return "";
  const byId = new Map((data?.stations || []).map((station) => [String(station.id), station]));
  let cursor = byId.get(String(homeId));
  const seen = new Set();
  while (cursor && !seen.has(String(cursor.id))) {
    seen.add(String(cursor.id));
    if (!isManagerUnit(cursor)) {
      const code = String(cursor.code || "").trim();
      return code;
    }
    const parentId = stationParentId(cursor);
    cursor = parentId ? byId.get(String(parentId)) : null;
  }
  return String(stationByWalk(data, homeId)?.code || "").trim();
}

function gradeView(employee, data, ar) {
  const seat = seatForEmployee(data, employee?.id);
  const grades = orderedJobGrades(data);
  const grade = liveGrade(employee, data);
  const index = grades.findIndex((item) => grade && String(item.id) === String(grade.id));
  if (!grade) return { chip: "", label: "", range: "", leave: "", index: -1, id: "" };
  const chip = String(grade.gradeNumber || "").trim();
  const label = String((ar ? grade.title : (grade.titleEn || grade.title)) || "").trim();
  const range = gradeSalaryRange(grade);
  const min = range.min ?? (Number(seat?.salaryMin) > 0 ? Number(seat.salaryMin) : null);
  const max = range.max ?? (Number(seat?.salaryMax) > 0 ? Number(seat.salaryMax) : null);
  const money = min != null && max != null
    ? `${Number(min).toLocaleString("en-US")}–${Number(max).toLocaleString("en-US")} SAR`
    : "";
  const leaveDays = gradeLeaveDays(grade);
  const leave = leaveDays == null
    ? ""
    : (ar ? `إجازة ${dayFigure(leaveDays)} يوماً` : `${dayFigure(leaveDays)} days leave`);
  return { chip, label, range: money, leave, index, id: grade.id };
}

function actualWorkplace(data, employee, affiliation, ar) {
  const acting = activeActingAssignments(employee).find((item) => {
    const home = employeeWorkStationId(employee);
    return item?.stationId && String(item.stationId) !== String(home || "");
  });
  const place = explainWorkplaceManager(data, employee.id, { ar });
  const homeName = stationDisplayName(stationByWalk(data, employeeWorkStationId(employee)));
  const actingName = acting ? stationDisplayName(stationByWalk(data, acting.stationId)) : "";
  const name = actingName || place?.homeName || homeName;
  const differs = Boolean(name && affiliation && name !== affiliation);
  return {
    name,
    differs,
  };
}

function derivePersonPanel(employee, data, ar) {
  const onDate = new Date();
  const laborCalendar = laborCalendarOf(data);
  const profile = employee?.profile || {};
  const title = occupantTitle(employee, data, ar);
  const acting = activeActingAssignments(employee)[0];
  const actingUntil = isoDate(acting?.until);
  const name = String(employee?.name || "").trim();
  const sub = acting
    ? `${name} · ${ar ? "مكلَّف حتى" : "Acting until"} ${actingUntil || "—"}`
    : name;
  const idType = profileFieldValue(profile, "idType", employee);
  const idLabel = optionLabel(ID_TYPE_OPTIONS, idType, ar) || (ar ? "الهوية" : "ID");
  const affiliation = affiliationName(data, employee);
  const site = actualWorkplace(data, employee, affiliation, ar);
  const grade = gradeView(employee, data, ar);
  const unitCode = branchCodeOf(data, employee);
  const hire = isoDate(profile.hireDate || employee?.hireDate || employee?.startDate);
  const weekCite = citeRule("hours.week.ordinaryMaxHours", onDate);
  const article = weekCite?.article ? ` · ${weekCite.article}` : "";
  const measured = hoursAndStatus(employee, data, onDate, laborCalendar, ar);
  const history = occupancyRows(data, employee, ar);
  const since = history.find((row) => row.current && !row.acting)?.from
    || history.find((row) => row.current)?.from
    || hire;
  return {
    title,
    sub,
    chain: titleChain(data, employee, ar),
    fields: [
      { label: ar ? "الشاغل الآن" : "Current holder", value: name, strong: true },
      {
        label: ar ? "الرقم الوظيفي" : "Employee no.",
        kind: "empNo",
        value: jobNumberOf(employee),
        unit: unitCode,
        chip: grade.chip,
        gradeIndex: grade.index,
      },
      { label: ar ? "المدير المباشر" : "Direct manager", value: managerLine(data, employee, ar) },
      {
        label: ar ? "الدرجة" : "Grade",
        kind: "grade",
        chip: grade.chip,
        gradeLabel: grade.label,
        range: grade.range,
        leave: grade.leave,
        gradeIndex: grade.index,
      },
      { label: ar ? "الفرع (بالتبعية)" : "Branch (reporting)", value: affiliation, strong: true },
      {
        label: ar ? "مكان العمل الفعلي" : "Actual workplace",
        value: site.name
          ? `${site.name}${site.differs ? (ar ? " · مختلف عن التبعية" : " · differs from reporting") : ""}`
          : "",
        warn: site.differs,
      },
      { label: ar ? "العقد" : "Contract", value: contractLine(employee, ar) },
      { label: ar ? "الجنسية" : "Nationality", value: String(profile.nationality || employee?.nationality || "").trim() },
      { label: idLabel, value: String(profile.nationalId || employee?.nationalId || "").trim(), mono: true },
      { label: ar ? "تاريخ التعيين" : "Hire date", value: hire, mono: true },
      { label: ar ? "مدة الخدمة" : "Length of service", value: hire ? serviceLabel(hire, ar) : "" },
      { label: ar ? `ساعات الأسبوع${article}` : `Week hours${article}`, value: measured.hours, mono: true },
      { label: ar ? "الإجازة السنوية" : "Annual leave", value: leaveFraction(employee, data, onDate), mono: true },
      { label: ar ? "حالة الالتزام" : "Compliance", value: measured.status },
      { label: ar ? "الفئة النظامية" : "Statutory class", value: statutoryClass(employee, data, onDate, ar) },
      { label: ar ? "منذ" : "Since", value: since, mono: true },
    ],
    rules: scheduleConstraints(employee, data, onDate, laborCalendar, ar),
    history,
  };
}

function FactValue({ field }) {
  if (field.kind === "empNo") {
    return (
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
        <strong style={{ ...MONO, fontSize: 13 }}>{dash(field.value)}</strong>
        {field.unit ? (
          <span style={{ ...MONO, fontSize: 10.5, color: "#6B7280" }}>{`· ${field.unit} ·`}</span>
        ) : null}
        {field.chip ? <span style={gradeChipStyle(orgGradeColor(field.gradeIndex))}>{field.chip}</span> : null}
      </span>
    );
  }
  if (field.kind === "grade") {
    if (!field.chip && !field.gradeLabel && !field.range && !field.leave) {
      return <span style={{ color: "#6B7280" }}>—</span>;
    }
    return (
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
        {field.chip ? <span style={gradeChipStyle(orgGradeColor(field.gradeIndex))}>{field.chip}</span> : null}
        {field.gradeLabel ? <span style={{ fontSize: 11, color: "#6B7280" }}>{field.gradeLabel}</span> : null}
        {field.range ? <span style={{ ...MONO, fontSize: 11, color: "#6B7280" }}>{field.range}</span> : null}
        {field.leave ? <span style={{ fontSize: 11, color: "#6B7280" }}>{field.leave}</span> : null}
      </span>
    );
  }
  return (
    <span
      dir={field.mono && field.value ? "ltr" : undefined}
      style={{
        minWidth: 0,
        fontWeight: field.strong && field.value ? 700 : 400,
        color: field.warn ? "#8A6516" : "var(--nv-ink, #14213D)",
        ...(field.mono && field.value ? MONO : null),
      }}
    >
      {dash(field.value)}
    </span>
  );
}

function FactGrid({ fields }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr)",
        columnGap: 10,
        rowGap: 4,
        alignItems: "start",
        padding: "10px 12px",
        border: "1px solid #DFE3EA",
        background: "#F5F6FA",
        borderRadius: 10,
        fontSize: 11.5,
        lineHeight: 1.7,
      }}
    >
      {fields.map((field) => (
        <div key={field.label} style={{ display: "contents" }}>
          <span style={{ color: "#6B7280" }}>{field.label}</span>
          <FactValue field={field} />
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <span style={{ fontSize: 10, letterSpacing: "0.14em", color: "#6B7280", fontWeight: 600 }}>
      {children}
    </span>
  );
}

function tabButtonStyle(active) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 32,
    padding: 0,
    borderRadius: 9,
    boxSizing: "border-box",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    ...(active
      ? { background: "#14213D", color: "#fff", border: "1px solid #14213D" }
      : { background: "#fff", color: "#4B5567", border: "1px solid #DFE3EA" }),
  };
}

function actingError(code, ar) {
  if (code === "HOME") return ar ? "لا تكليف على فرع الموظف نفسه." : "Acting cannot be on the person's own branch.";
  if (code === "MISSING") return ar ? "المكلَّف غير موجود في السجل." : "That person is not on the roster.";
  return ar ? "تعذّر تسجيل التكليف." : "Could not record the acting assignment.";
}

function changeError(code, ar) {
  if (code === "SEAT_TAKEN") {
    return ar
      ? "المقعد مشغول. التعيين الحالي لا يستبدل شاغلاً قائماً."
      : "The seat is occupied. Placement does not replace the current holder.";
  }
  if (code === "MISSING") return ar ? "الشاغل الجديد غير موجود في السجل." : "That person is not on the roster.";
  if (code === "SEAT") return ar ? "لا مقعد حيّ لهذا الشاغل." : "This person has no live seat.";
  if (code === "ADMIN_NO_HIRE") return ar ? "المدير ليس مكان نقل." : "A manager unit is not a placement workplace.";
  if (code === "MANAGER_TAKEN") return ar ? "مدير الفرع معيّن مسبقاً." : "The branch already has a manager.";
  if (code === "EMPLOYEE_NO_TAKEN") return ar ? "الرقم الوظيفي مستخدم في هذه الشركة." : "That job number is already used in this company.";
  return ar ? "تعذّر تغيير الشاغل." : "Could not change the holder.";
}

function gradeOutOfOrder(employee, data) {
  const mine = liveGrade(employee, data);
  const mineRank = gradeRank(mine);
  if (mineRank == null) return false;
  const managerId = String(employee?.profile?.directManagerId || "");
  const manager = (data?.employees || []).find((item) => String(item.id) === managerId);
  const bossRank = gradeRank(manager ? liveGrade(manager, data) : null);
  if (bossRank != null && mineRank >= bossRank) return true;
  return (data?.employees || []).some((item) => {
    if (String(item.profile?.directManagerId || "") !== String(employee.id)) return false;
    const childRank = gradeRank(liveGrade(item, data));
    return childRank != null && childRank >= mineRank;
  });
}

function GradeSeatEditor({ employee, data, companyId, ar }) {
  const seat = seatForEmployee(data, employee?.id);
  const title = seat?.title || employee?.profile?.position || employee?.jobTitle || "";
  const grades = title ? gradesForTitle(data, title) : [];
  const current = liveGrade(employee, data);
  return (
    <>
      <SectionLabel>{ar ? "درجة الوظيفة" : "Seat grade"}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid #DFE3EA", borderRadius: 10, fontSize: 11.5 }}>
        {grades.length ? (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {grades.map((grade, index) => {
              const on = current && String(current.id) === String(grade.id);
              return (
                <button
                  key={grade.id}
                  type="button"
                  onClick={() => assignHolderGrade(companyId, {
                    employeeId: employee.id,
                    seatId: seat?.id || "",
                    gradeId: grade.id,
                  })}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 28,
                    minWidth: 40,
                    padding: "0 8px",
                    borderRadius: 8,
                    font: "700 11.5px 'Readex Pro', sans-serif",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    ...(on
                      ? { color: "#fff", background: orgGradeColor(index), border: "1px solid transparent" }
                      : { color: "#4B5567", background: "#fff", border: "1px solid #DFE3EA" }),
                  }}
                >
                  <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{grade.gradeNumber || "—"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            {title
              ? (ar ? "هذا المسمّى بلا درجات على سلّمه." : "This title has no grades on its ladder.")
              : (ar ? "لا مسمّى على هذه الوظيفة بعد." : "This seat has no title yet.")}
          </span>
        )}
        {gradeOutOfOrder(employee, data) ? (
          <span style={{ fontSize: 11, color: "#8A1C2B", background: "#FBF1F2", border: "1px solid #E9C4C9", borderRadius: 8, padding: "7px 9px" }}>
            {ar
              ? "تنبيه: الدرجة تساوي أو تتجاوز درجة المدير المباشر، أو توجد وظيفة تابعة بدرجة مساوية أو أعلى."
              : "The grade matches or exceeds the manager, or a report holds an equal or higher grade."}
          </span>
        ) : null}
        <span style={{ fontSize: 10.5, color: "#6B7280" }}>
          {ar
            ? "تغيير الدرجة يسري على شاغل الوظيفة ومن يشغلها لاحقاً، ويُسجَّل في سجل الأحداث."
            : "Changing the grade applies to the current holder and whoever fills the seat next."}
        </span>
      </div>
    </>
  );
}

function hrUnit(station) {
  return isHrUnit(station);
}

function managedBy(data, employeeId) {
  return (data?.stations || []).filter((station) => String(station.managerId || "") === String(employeeId || ""));
}

function accessPill(value) {
  if (value === "manage") return { background: "#137A49", color: "#fff", border: "1px solid #137A49" };
  if (value === "hidden") return { background: "#F5F6F8", color: "#8A1C2B", border: "1px solid #E9C4C9" };
  return { background: "#fff", color: "#4B5567", border: "1px solid #DFE3EA" };
}

function accessWord(value, ar) {
  if (value === "manage") return ar ? "إدارة" : "Manage";
  if (value === "hidden") return ar ? "بلا وصول" : "No access";
  return ar ? "عرض" : "View";
}

function titleChipStyle(on) {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 26,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    border: on ? "1px solid #14213D" : "1px solid #DFE3EA",
    background: on ? "#14213D" : "#fff",
    color: on ? "#fff" : "#4B5567",
  };
}

/** الملف tab, under occupancy — vacate, child seat, site, and seat access. */
function ManagerSeatActions({ employee, data, companyId, ar, ownerMode, onVacated, onOpenBranch }) {
  const seat = seatForEmployee(data, employee?.id);
  const catalog = jobTitleCatalog(data);
  const managerGradeId = String(seat?.gradeId || employee?.profile?.gradeId || "");
  const managerRank = gradeRank((data?.jobGrades || []).find((grade) => String(grade.id) === managerGradeId));
  const [title, setTitle] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState("");
  const access = seatAccessOf(data, employee);
  const titleGrades = gradesForTitle(data, title);
  const gradeKey = titleGrades.map((grade) => grade.id).join("|");

  useEffect(() => {
    setTitle("");
    setQty(1);
    setErr("");
    setGradeId("");
  }, [employee?.id]);

  useEffect(() => {
    const allowed = titleGrades.filter((grade) => {
      const rank = gradeRank(grade);
      return managerRank == null || rank == null || rank < managerRank;
    });
    const pick = allowed[allowed.length - 1];
    setGradeId(String(pick?.id || ""));
  }, [employee?.id, title, managerRank, gradeKey]);

  const query = title.trim();
  const chips = catalog.filter((item) => !query || item.includes(query)).slice(0, 14);
  const fresh = Boolean(query) && !catalog.some((item) => item === query);
  const managed = managedBy(data, employee?.id);
  const branch = managed.find((station) => !isCompanyRootStation(station) && !hrUnit(station)) || null;
  const locked = managed.find((station) => hrUnit(station)) || managed.find((station) => isCompanyRootStation(station)) || null;
  const lockTitle = !locked
    ? ""
    : (hrUnit(locked)
      ? (ar ? "قسم الموارد البشرية (HR)" : "Human resources (HR)")
      : (ar
        ? `فرع ${stationDisplayName(locked) || "المقر الرئيسي"} (${String(locked.code || "HQ").trim()})`
        : `${stationDisplayName(locked) || "Headquarters"} (${String(locked.code || "HQ").trim()})`));
  const affiliation = affiliationName(data, employee);
  const workId = String(employee?.profile?.workStationId || "");
  const sites = workplaceStations(data?.stations || []);
  const bands = ladderBands(data);
  const chosen = titleGrades.find((grade) => String(grade.id) === String(gradeId)) || null;
  const codeMatch = String(chosen?.gradeNumber || bands[0]?.gradeNumber || "").match(/^(.*?)(\d+)\s*$/);
  const codePrefix = codeMatch ? (codeMatch[1] || "م") : "م";
  const addLabel = qty > 1
    ? (ar ? `إنشاء ${qty} وظائف شاغرة` : `Create ${qty} vacant seats`)
    : (ar ? "إنشاء المنصب" : "Create the seat");
  const showReason = (result) => {
    setErr((ar ? result?.reason : result?.reasonEn) || seatDrawerReason(result?.error, ar) || "");
  };

  const vacate = () => {
    if (!companyId) {
      setErr(ar ? "إخلاء المقعد لمن يدير الهيكل." : "Vacating is for someone who manages the org.");
      return;
    }
    const result = endSeatTenure(companyId, employee.id);
    if (!result.ok) {
      showReason(result);
      return;
    }
    onVacated?.();
  };

  const createSeat = () => {
    if (!companyId) {
      setErr(ar ? "إنشاء المنصب لمن يدير الهيكل." : "Creating a seat is for someone who manages the org.");
      return;
    }
    const result = createVacantSeatsUnderManager(companyId, {
      managerId: employee.id,
      title,
      gradeId,
      qty,
    });
    if (!result.ok) {
      showReason(result);
      return;
    }
    setErr("");
    setTitle("");
    setQty(1);
  };

  const cycle = (row) => {
    if (!companyId) return;
    const result = cycleSeatAccess(companyId, employee.id, row.id, { owner: ownerMode });
    if (!result.ok) showReason(result);
    else setErr("");
  };

  const chooseSite = (value) => {
    if (!companyId) return;
    const result = setActualWorkSite(companyId, employee.id, value);
    if (!result.ok) showReason(result);
    else setErr("");
  };

  const gradeBlocked = (rank) => managerRank != null && rank != null && rank >= managerRank;

  const pickBand = (band) => {
    const match = titleGrades.find((grade) => gradeRank(grade) === band.rank);
    if (!title || !match || gradeBlocked(band.rank)) return;
    setErr("");
    setGradeId(match.id);
  };

  const typeRank = (raw) => {
    const digits = String(raw || "").replace(/[^0-9]/g, "");
    if (!digits) return;
    const rank = Number(digits);
    const match = titleGrades.find((grade) => gradeRank(grade) === rank);
    if (!title || !match || gradeBlocked(rank)) {
      setErr(gradeBlocked(rank)
        ? (ar ? "درجة المنصب يجب أن تكون أقل من درجة المدير." : "The new grade must be below the manager's grade.")
        : (ar ? "هذه الدرجة ليست على سلّم هذا المسمّى." : "That grade is not on this title's ladder."));
      return;
    }
    setErr("");
    setGradeId(match.id);
  };

  return (
    <>
      <button
        type="button"
        onClick={vacate}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: 34,
          borderRadius: 10,
          border: "1px solid #E9C4C9",
          background: "#fff",
          color: "#8A1C2B",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {ar ? "إنهاء شغل الوظيفة اليوم — تصبح شاغرة" : "End the seat today — it becomes vacant"}
      </button>
      <SectionLabel>{ar ? "منصب جديد تحت هذه الوظيفة" : "New seat under this job"}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", border: "1px solid #DFE3EA", borderRadius: 8, background: "#fff", overflow: "hidden", fontSize: 11.5 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderBottom: "1px solid #EEF1F5" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#4B5567", fontWeight: 700 }}>
            <span>{ar ? "1 · المسمّى الوظيفي" : "1 · Job title"}</span>
            <span style={{ fontWeight: 500, color: "#8E9A93" }}>{ar ? "من الدليل أو جديد" : "Catalog or new"}</span>
          </div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={ar ? "ابحث في الدليل أو اكتب مسمّى جديداً" : "Search the catalog or type a new title"}
            style={FIELD_INPUT}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 4, maxHeight: 112, overflow: "auto", padding: 2 }}>
            {chips.length ? chips.map((item) => (
              <button key={item} type="button" onClick={() => setTitle(item)} style={{ ...titleChipStyle(title === item), justifyContent: "center" }}>
                {item}
              </button>
            )) : (
              <span style={{ fontSize: 11, color: "#6B7280", gridColumn: "1 / -1" }}>{ar ? "الدليل فارغ. اكتب مسمّى لإضافته." : "The catalog is empty. Type a title to add it."}</span>
            )}
          </div>
          {fresh ? (
            <span style={{ fontSize: 10.5, color: "#137A49" }}>
              {ar ? "مسمّى جديد — يُضاف إلى دليل المسميات عند الإنشاء." : "New title — it joins the catalog when the seat is created."}
            </span>
          ) : null}
        </div>
        {title && titleGrades.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px 0" }}>
            <span style={{ fontSize: 11, color: "#4B5567", fontWeight: 700 }}>{ar ? "المرتبة في المسار" : "Rank on the track"}</span>
            {titleGrades.map((grade) => {
              const on = String(grade.id) === String(gradeId);
              const rank = gradeRank(grade);
              const dim = gradeBlocked(rank);
              const meta = [grade.experience, grade.requirement, dim ? (ar ? "أعلى من درجة المدير" : "At or above the manager") : ""].filter(Boolean).join(" · ");
              return (
                <button
                  key={grade.id}
                  type="button"
                  disabled={dim}
                  onClick={() => { if (!dim) { setErr(""); setGradeId(grade.id); } }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 5,
                    boxSizing: "border-box",
                    textAlign: "start",
                    fontFamily: "inherit",
                    opacity: dim ? 0.45 : 1,
                    cursor: dim ? "not-allowed" : "pointer",
                    background: on && !dim ? "#EEF2F8" : "#fff",
                    border: dim ? "1px dashed #DFE3EA" : (on ? "1px solid #14213D" : "1px solid #EEF1F5"),
                  }}
                >
                  <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, minWidth: 28, borderRadius: 4, font: "700 10px 'Readex Pro', sans-serif", color: "#fff", background: orgGradeColor(Math.max(0, (rank || 1) - 1)), unicodeBidi: "isolate" }}>{grade.gradeNumber || "—"}</span>
                  <strong style={{ fontSize: 12, flex: 1 }}>{grade.title || (ar ? "مرتبة" : "Rank")}</strong>
                  {meta ? <span style={{ fontSize: 10.5, color: "#6B7280" }}>{meta}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderBottom: "1px solid #EEF1F5" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#4B5567", fontWeight: 700 }}>
            <span>{ar ? "2 · الدرجة" : "2 · Grade"}</span>
            <span style={{ fontWeight: 500, color: "#8E9A93" }}>{chosen?.title || (ar ? "من سلّم الدرجات" : "From the ladder")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#6B7280" }}>
            <span>{ar ? "رقم الدرجة" : "Grade no."}</span>
            <span style={{ display: "flex", alignItems: "center", border: "1px solid #DFE3EA", borderRadius: 5, overflow: "hidden", height: 30, background: "#fff" }}>
              <span style={{ padding: "0 7px", font: "700 11px 'Readex Pro', sans-serif", borderInlineEnd: "1px solid #EEF1F5", height: "100%", display: "inline-flex", alignItems: "center" }}>{codePrefix}</span>
              <input
                inputMode="numeric"
                value={chosen ? String(gradeRank(chosen) || "") : ""}
                onChange={(event) => typeRank(event.target.value)}
                style={{ width: 40, height: "100%", border: 0, outline: "none", textAlign: "center", font: "600 13px 'IBM Plex Mono', monospace", color: "#14213D", background: "transparent" }}
              />
            </span>
            <span>{ar ? "أو اختر:" : "or pick:"}</span>
          </div>
          {bands.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 4 }}>
              {bands.map((band, index) => {
                const match = title ? titleGrades.find((grade) => gradeRank(grade) === band.rank) : null;
                const above = gradeBlocked(band.rank);
                const off = !title || !match || above;
                const on = Boolean(match) && String(match.id) === String(gradeId);
                const tip = above
                  ? (ar ? "مساوية لدرجة المدير أو أعلى" : "Equal to the manager or higher")
                  : (!match && title ? (ar ? "خارج نطاق هذا المنصب" : "Outside this title") : (band.level || band.gradeNumber));
                return (
                  <button
                    key={band.key}
                    type="button"
                    title={tip}
                    disabled={off}
                    onClick={() => pickBand(band)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 30,
                      boxSizing: "border-box",
                      borderRadius: 4,
                      font: "700 11.5px 'Readex Pro', sans-serif",
                      fontFamily: "inherit",
                      ...(off
                        ? { cursor: "not-allowed", background: "#F5F6F8", color: "#C5CEC9", border: "1px dashed #DFE3EA" }
                        : on
                          ? { cursor: "pointer", color: "#fff", background: orgGradeColor(index), border: "1px solid transparent" }
                          : { cursor: "pointer", color: "#4B5567", background: "#fff", border: "1px solid #DFE3EA" }),
                    }}
                  >
                    <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{band.gradeNumber || "—"}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "#6B7280" }}>{ar ? "لا درجات على السلّم بعد. أضف درجة أعلى من سلّم الدرجات." : "No grades on the ladder yet. Add a higher grade on the ladder."}</span>
          )}
          {title && !titleGrades.length ? (
            <span style={{ fontSize: 11, color: "#8A1C2B" }}>
              {ar ? "هذا المسمّى بلا درجات. أضفها من سلّم الدرجات." : "This title has no grades. Add them on the grade ladder."}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 12, borderBottom: "1px solid #EEF1F5" }}>
          <span style={{ fontSize: 11, color: "#4B5567", fontWeight: 700 }}>{ar ? "3 · عدد الوظائف" : "3 · Seat count"}</span>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #DFE3EA", borderRadius: 6, overflow: "hidden" }}>
            <button type="button" aria-label={ar ? "أقل" : "Fewer"} onClick={() => setQty((value) => Math.max(1, value - 1))} style={{ width: 32, height: 32, border: 0, background: "#fff", cursor: "pointer", fontSize: 15, color: "#14213D", fontFamily: "inherit" }}>−</button>
            <input
              type="number"
              min={1}
              max={20}
              value={qty}
              aria-label={ar ? "عدد الوظائف" : "Seat count"}
              onChange={(event) => setQty(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
              style={{ width: 44, height: 32, border: 0, borderInline: "1px solid #DFE3EA", font: "600 13px 'IBM Plex Mono', monospace", textAlign: "center", color: "#14213D", outline: "none", boxSizing: "border-box" }}
            />
            <button type="button" aria-label={ar ? "أكثر" : "More"} onClick={() => setQty((value) => Math.min(20, value + 1))} style={{ width: 32, height: 32, border: 0, background: "#fff", cursor: "pointer", fontSize: 15, color: "#14213D", fontFamily: "inherit" }}>+</button>
          </div>
        </div>
        <div style={{ padding: 12 }}>
          <button
            type="button"
            onClick={createSeat}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: 38,
              borderRadius: 6,
              background: "#14213D",
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: 0,
              fontFamily: "inherit",
            }}
          >
            {addLabel}
          </button>
        </div>
      </div>
      <FormError text={err} />
      {locked ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "#EEF2F8", border: "1px solid #C3CBD8", fontSize: 11.5, color: "#14213D", lineHeight: 1.8 }}>
          <span style={{ fontSize: 14, lineHeight: 1.4 }} aria-hidden>🔒</span>
          <span>
            <strong>{lockTitle}</strong>
            {ar
              ? " — وحدة ثابتة في الهيكل: لا تُحذف ولا تُنقل ولا تتغيّر درجتها أو مسمّاها. يتغيّر الشاغل فقط (تغيير نهائي أو تكليف)."
              : " — a fixed unit: it is not deleted, moved, or renamed, and its grade stays. Only the holder changes."}
          </span>
        </div>
      ) : null}
      <GradeSeatEditor employee={employee} data={data} companyId={companyId} ar={ar} />
      {branch ? (
        <button
          type="button"
          onClick={() => onOpenBranch?.(branch.id)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 34,
            borderRadius: 10,
            border: "1px solid #DFE3EA",
            background: "#fff",
            color: "#14213D",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {ar ? "إعدادات الفرع" : "Branch settings"}
        </button>
      ) : null}
      <>
          <SectionLabel>{ar ? "مكان العمل الفعلي" : "Actual workplace"}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid #DFE3EA", borderRadius: 10, fontSize: 11.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "#6B7280" }}>{ar ? "الفرع بالتبعية" : "Reporting branch"}</span>
              <strong>{affiliation || "—"}</strong>
            </div>
            <select
              value={workId}
              onChange={(event) => chooseSite(event.target.value)}
              style={{ height: 34, padding: "0 8px", borderRadius: 9, border: "1px solid #DFE3EA", fontSize: 11.5, color: "#14213D", background: "#fff", fontFamily: "inherit" }}
            >
              <option value="">{ar ? `مطابق للتبعية — ${affiliation || "—"}` : `Same as reporting — ${affiliation || "—"}`}</option>
              {sites.map((station) => (
                <option key={station.id} value={station.id}>
                  {stationDisplayName(station)}
                  {station.code ? ` · ${station.code}` : ""}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 10.5, color: "#6B7280", lineHeight: 1.8 }}>
              {ar
                ? "يُضبط حين يعمل الموظف فعلياً في فرع غير فرع مديره (مثل أخصائي موارد بشرية في الرس يتبع المقر). مكان العمل يحدّد الحضور والجدول وموقع حظر الشمس، والتبعية تحدّد الاعتماد والتصعيد."
                : "Set when the person works at a branch other than their manager's (an HR specialist in Al-Rass can report to headquarters). The workplace drives attendance, the roster, and the heat-ban location. Reporting drives approval and escalation."}
            </span>
          </div>
      </>
      <SectionLabel>{ar ? "صلاحيات الإدارة — ما يديره صاحب هذه الوظيفة" : "Admin access — what this seat holder manages"}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {SEAT_ACCESS_ROWS.map((row) => {
          const value = access[row.id] || "view";
          const lockedRow = Boolean(row.ownerOnly && !ownerMode);
          return (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", border: "1px solid #DFE3EA", borderRadius: 10 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <strong style={{ fontSize: 12 }}>{ar ? row.ar : row.en}</strong>
                <span style={{ fontSize: 10, color: "#6B7280" }}>{ar ? row.hintAr : row.hintEn}</span>
              </div>
              <button
                type="button"
                disabled={lockedRow}
                onClick={() => cycle(row)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 76,
                  height: 28,
                  padding: "0 12px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: lockedRow ? "default" : "pointer",
                  fontFamily: "inherit",
                  flex: "none",
                  ...accessPill(value),
                }}
              >
                {accessWord(value, ar)}
              </button>
            </div>
          );
        })}
      </div>
      <span style={{ fontSize: 10.5, color: "#6B7280", lineHeight: 1.8 }}>
        {ar
          ? "«إدارة» تمنح الاعتماد والتعديل في القسم، و«عرض» تمنح القراءة فقط. الصلاحية على الوظيفة لا الشخص، فتنتقل إلى المكلَّف مدة تكليفه. طلباتي والحضور والجدول بوابة حضور واحدة، والجزاءات تُفتح مع الهيكل لأن لا منحة جزاءات مستقلة. كل تغيير يُسجَّل في سجل الأحداث."
          : "Manage grants approval and edits. View is read-only. The grant sits on the seat, follows an acting holder, and each change is logged."}
      </span>
    </>
  );
}

function FormError({ text }) {
  if (!text) return null;
  return (
    <div style={{ fontSize: 11, color: "#8A1C2B", background: "#FBF1F2", border: "1px solid #E9C4C9", padding: "8px 11px", borderRadius: 10 }}>
      {text}
    </div>
  );
}

/**
 * Person card on the workforce tree → side drawer.
 * الملف / تكليف / تغيير نهائي from workforce.dc.html.
 */
export default function OrgEmployeePreview({
  open,
  employee = null,
  data = null,
  ar = true,
  vacantHint = "",
  companyId = "",
  canWrite = false,
  onOpenBranch,
  onClose,
}) {
  const { currentUser } = useAuth();
  const ownerMode = Boolean(currentUser && (
    String(currentUser.id) === String(data?.ownerId || "")
    || currentUser.role === "owner"
    || currentUser.isOwner
  ));
  const [tab, setTab] = useState("profile");
  const [formErr, setFormErr] = useState("");
  const [act, setAct] = useState(() => ({ person: "", from: todayKey(), to: plusDays(30) }));
  const [chg, setChg] = useState(() => ({ person: "", from: todayKey() }));
  const live = useMemo(() => {
    if (!employee) return null;
    return (data?.employees || []).find((item) => String(item.id) === String(employee.id)) || employee;
  }, [employee, data]);

  useEffect(() => {
    if (!open) return;
    setTab("profile");
    setFormErr("");
    setAct({ person: "", from: todayKey(), to: plusDays(30) });
    setChg({ person: "", from: todayKey() });
  }, [open, live?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const panel = useMemo(
    () => (open && live ? derivePersonPanel(live, data, ar) : null),
    [open, live, data, ar],
  );
  const roster = useMemo(
    () => (data?.employees || []).filter((item) => item && item.role !== "system" && String(item.name || "").trim()),
    [data],
  );

  if (!open || typeof document === "undefined") return null;

  const headerName = live?.name || (ar ? "شاغرة" : "Vacant");
  const vacantSub = vacantHint || (ar ? "الوظيفة بلا شاغل" : "This seat is empty");
  const pickTab = (next) => {
    setTab(next);
    setFormErr("");
  };

  const saveActing = () => {
    const person = act.person.trim();
    if (!canWrite || !companyId) {
      setFormErr(ar ? "تسجيل التكليف لمن يدير الهيكل." : "Acting is recorded by someone who manages the org.");
      return;
    }
    if (!person) {
      setFormErr(ar ? "اكتب اسم المكلَّف" : "Enter the acting person's name");
      return;
    }
    if (!act.from || !act.to || act.to < act.from) {
      setFormErr(ar ? "تاريخ النهاية يجب أن يكون بعد البداية" : "The end date must be after the start");
      return;
    }
    if (act.from > todayKey()) {
      setFormErr(ar
        ? "التكليف المسجّل يبدأ اليوم ويحفظ تاريخ النهاية. لا يُجدول من تاريخ لاحق."
        : "The live acting record starts today and stores the end date. A future start is not scheduled.");
      return;
    }
    const hit = findEmployeeByName(data, person);
    if (!hit?.id) {
      setFormErr(ar ? "المكلَّف يجب أن يكون موظفاً مسجّلاً بالاسم الكامل." : "The acting person must be a registered employee, full name.");
      return;
    }
    const seat = seatForEmployee(data, live.id);
    const stationId = String(seat?.stationId || live.stationId || "").trim();
    const result = setActingAssignment(companyId, hit.id, {
      stationId,
      until: act.to,
      seatId: seat?.id || "",
      title: seat?.title || occupantTitle(live, data, ar),
    });
    if (!result.ok) {
      setFormErr(actingError(result.error, ar));
      return;
    }
    setFormErr("");
    setAct({ person: "", from: todayKey(), to: plusDays(30) });
    setTab("profile");
  };

  const saveChange = () => {
    const person = chg.person.trim();
    if (!canWrite || !companyId) {
      setFormErr(ar ? "تغيير الشاغل لمن يدير الهيكل." : "Holder changes are recorded by someone who manages the org.");
      return;
    }
    if (!person) {
      setFormErr(ar ? "اكتب اسم الشاغل الجديد" : "Enter the new holder's name");
      return;
    }
    if (!chg.from) {
      setFormErr(ar ? "حدّد تاريخ البداية" : "Set the start date");
      return;
    }
    const hit = findEmployeeByName(data, person);
    if (!hit?.id) {
      setFormErr(ar ? "الشاغل الجديد يجب أن يكون موظفاً مسجّلاً بالاسم الكامل." : "The new holder must be a registered employee, full name.");
      return;
    }
    const seat = seatForEmployee(data, live.id);
    if (!seat?.id) {
      setFormErr(changeError("SEAT", ar));
      return;
    }
    if (seat.employeeId && String(seat.employeeId) !== String(hit.id)) {
      setFormErr(changeError("SEAT_TAKEN", ar));
      return;
    }
    if (String(seat.employeeId || "") === String(hit.id)) {
      setFormErr(ar ? "هذا الشاغل على المقعد بالفعل." : "This person already holds the seat.");
      return;
    }
    const result = placeExistingEmployee(companyId, hit.id, {
      seatId: seat.id,
      name: hit.name,
      hireDate: hit.profile?.hireDate || live.profile?.hireDate,
      reportsTo: seat.reportsToName,
      reportsToId: seat.reportsToEmployeeId,
    });
    if (!result.ok) {
      setFormErr(changeError(result.error, ar));
      return;
    }
    setFormErr("");
    setChg({ person: "", from: todayKey() });
    setTab("profile");
  };

  return createPortal(
    <div
      role="presentation"
      dir={ar ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 480,
        display: "flex",
        justifyContent: "flex-start",
      }}
    >
      <div
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
        style={{ position: "absolute", inset: 0, background: "rgba(15,26,48,.28)" }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={live
          ? (ar ? `ملف ${live.name || "الموظف"}` : `File for ${live.name || "employee"}`)
          : (ar ? "مقعد بلا موظف" : "Vacant seat")}
        style={{
          position: "relative",
          width: "min(94vw, 420px)",
          height: "100%",
          background: "#fff",
          borderInlineEnd: "1px solid #DFE3EA",
          boxShadow: "0 0 40px rgba(20,33,61,.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #DFE3EA",
            background: "#F5F6FA",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <strong style={{ font: "700 16px 'Readex Pro', var(--font-heading), sans-serif", color: "var(--nv-ink, #14213D)" }}>
              {headerName}
            </strong>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onClose}
              style={{
                all: "unset",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#4B5567",
                fontFamily: "inherit",
              }}
            >
              {ar ? "إغلاق" : "Close"}
            </button>
          </div>
          {live && panel?.sub && panel.sub !== live.name ? (
            <span style={{ fontSize: 11.5, color: "#4B5567" }}>{panel.sub}</span>
          ) : null}
          {panel?.chain ? (
            <span style={{ fontSize: 11, color: "#6B7280" }}>{panel.chain}</span>
          ) : (!live ? (
            <span style={{ fontSize: 11.5, color: "#4B5567" }}>{vacantSub}</span>
          ) : null)}
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {panel ? (
            <>
              {canWrite ? (
                <div role="tablist" aria-label={ar ? "ملف الموظف" : "Employee file"} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <button type="button" role="tab" aria-selected={tab === "profile"} onClick={() => pickTab("profile")} style={tabButtonStyle(tab === "profile")}>
                    {ar ? "الملف" : "File"}
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "acting"} onClick={() => pickTab("acting")} style={tabButtonStyle(tab === "acting")}>
                    {ar ? "تكليف" : "Acting"}
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "change"} onClick={() => pickTab("change")} style={tabButtonStyle(tab === "change")}>
                    {ar ? "تغيير نهائي" : "Permanent change"}
                  </button>
                </div>
              ) : null}
              {tab === "profile" || !canWrite ? (
              <>
              <FactGrid fields={panel.fields} />
              <SectionLabel>{ar ? "قيود الوظيفة على الجدول" : "Schedule constraints"}</SectionLabel>
              {panel.rules.map((rule) => (
                <div
                  key={`${rule.src}-${rule.text}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    padding: "10px 12px",
                    border: "1px solid #DFE3EA",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1px 7px",
                        borderRadius: 7,
                        fontSize: 9.5,
                        fontWeight: 600,
                        background: "#F8FAFC",
                        color: "#4B5567",
                        border: "1px solid #DFE3EA",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rule.src}
                    </span>
                    <span style={{ flex: 1, fontSize: 11.5 }}>{rule.text}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#4B5567" }}>{rule.effect}</span>
                </div>
              ))}
              <SectionLabel>{ar ? "سجل شغل الوظيفة" : "Seat occupancy"}</SectionLabel>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  borderInlineStart: "2px solid #DFE3EA",
                  marginInlineStart: 6,
                  paddingInlineStart: 12,
                }}
              >
                {panel.history.length ? panel.history.map((row) => {
                  const dot = row.current
                    ? (row.acting ? "#137A49" : "#14213D")
                    : "#C7CCD6";
                  const range = `${row.from || "—"} → ${row.to || (row.current ? (ar ? "الآن" : "now") : "—")}`;
                  return (
                    <div key={`${row.name}-${row.type}-${row.from}-${row.to}`} style={{ position: "relative", padding: "4px 0 10px" }}>
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          insetInlineStart: -19,
                          top: 10,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: dot,
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 12 }}>{row.name}</strong>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0 6px",
                            borderRadius: 6,
                            fontSize: 9.5,
                            fontWeight: 700,
                            ...(row.acting
                              ? { color: "#137A49", background: "#F2FAF6", border: "1px solid #BFE6D2" }
                              : { color: "#4B5567", background: "#F5F6F8", border: "1px solid #DFE3EA" }),
                          }}
                        >
                          {row.type}
                        </span>
                      </div>
                      <span style={{ fontSize: 10.5, color: "#6B7280", ...MONO }}>{range}</span>
                    </div>
                  );
                }) : (
                  <span style={{ fontSize: 11.5, color: "#6B7280", padding: "4px 0 10px" }}>—</span>
                )}
              </div>
              {canWrite ? (
                <>
                <ManagerSeatActions
                  employee={live}
                  data={data}
                  companyId={companyId}
                  ar={ar}
                  ownerMode={ownerMode}
                  onVacated={onClose}
                  onOpenBranch={onOpenBranch}
                />
                <HrServesPanel employee={live} data={data} companyId={companyId} ar={ar} canWrite={canWrite} />
                </>
              ) : (
                <HrServesPanel employee={live} data={data} companyId={companyId} ar={ar} canWrite={false} />
              )}
              </>
              ) : null}
              {tab === "acting" ? (
                <>
                  <div style={NOTE}>
                    {ar
                      ? "التكليف يمنح الصلاحيات كاملة بين تاريخين، ويظهر على البطاقة، وينتهي تلقائياً فيعود الشاغل الأصلي."
                      : "Acting grants the full authority between two dates, shows on the card, and ends automatically so the original holder returns."}
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#6B7280" }}>
                    {ar ? "المكلَّف" : "Acting person"}
                    <input
                      value={act.person}
                      onChange={(event) => setAct((current) => ({ ...current, person: event.target.value }))}
                      placeholder={ar ? "اسم المكلَّف" : "Acting person's name"}
                      list="org-drawer-roster"
                      style={FIELD_INPUT}
                    />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#6B7280" }}>
                      {ar ? "من" : "From"}
                      <input type="date" value={act.from} onChange={(event) => setAct((current) => ({ ...current, from: event.target.value }))} style={{ ...FIELD_INPUT, direction: "ltr" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#6B7280" }}>
                      {ar ? "إلى" : "To"}
                      <input type="date" value={act.to} onChange={(event) => setAct((current) => ({ ...current, to: event.target.value }))} style={{ ...FIELD_INPUT, direction: "ltr" }} />
                    </label>
                  </div>
                  <FormError text={formErr} />
                  <button
                    type="button"
                    onClick={saveActing}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 36,
                      borderRadius: 10,
                      background: "#137A49",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {ar ? "تكليف بين التاريخين" : "Assign between the dates"}
                  </button>
                </>
              ) : null}
              {tab === "change" ? (
                <>
                  <div style={NOTE}>
                    {ar
                      ? "التغيير النهائي يقفل فترة الشاغل الحالي بتاريخ اليوم السابق ويفتح فترة الجديد من التاريخ المحدد. لا يُحذف أحد من السجل."
                      : "A permanent change closes the current holder's period on the day before and opens the new one from the chosen date. Nobody is deleted from the record."}
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#6B7280" }}>
                    {ar ? "الشاغل الجديد" : "New holder"}
                    <input
                      value={chg.person}
                      onChange={(event) => setChg((current) => ({ ...current, person: event.target.value }))}
                      placeholder={ar ? "اسم الشاغل الجديد" : "New holder's name"}
                      list="org-drawer-roster"
                      style={FIELD_INPUT}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#6B7280" }}>
                    {ar ? "من تاريخ" : "From"}
                    <input type="date" value={chg.from} onChange={(event) => setChg((current) => ({ ...current, from: event.target.value }))} style={{ ...FIELD_INPUT, direction: "ltr" }} />
                  </label>
                  <FormError text={formErr} />
                  <button
                    type="button"
                    onClick={saveChange}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 36,
                      borderRadius: 10,
                      background: "#14213D",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {ar ? "تغيير الشاغل نهائياً" : "Change the holder permanently"}
                  </button>
                </>
              ) : null}
              <datalist id="org-drawer-roster">
                {roster.map((item) => <option key={item.id} value={item.name} />)}
              </datalist>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.7 }}>
              {vacantHint || (ar ? "لا يوجد موظف على هذا المقعد." : "No employee on this seat.")}
            </span>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
